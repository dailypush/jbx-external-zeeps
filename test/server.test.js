const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const WebSocket = require('ws');
const { createServer } = require('../index');

const player = { index: 0, userId: 'a', name: 'Player', color: '#ff0000', health: 10, max: 20, moneyGauntlet: 100 };

async function fixture(t, options) {
    const { server, wss } = createServer(options);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        wss.clients.forEach((ws) => ws.terminate());
        await new Promise((resolve) => server.close(resolve));
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    async function connect() {
        const ws = new WebSocket(url.replace('http:', 'ws:'));
        const messages = [];
        ws.on('message', (message) => messages.push(JSON.parse(message)));
        await once(ws, 'open');
        await waitFor(() => messages.length > 0);
        return { ws, messages };
    }
    return {
        url, connect,
        update: (data) => fetch(`${url}/update?data=${encodeURIComponent(JSON.stringify(data))}`)
    };
}

async function waitFor(condition) {
    const deadline = Date.now() + 2000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for broadcast');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

test('rejects malformed updates without changing state and serves overlay assets', async (t) => {
    const f = await fixture(t);
    const client = await f.connect();
    for (const suffix of ['', '?data=bad', '?data=null', '?data[]=1']) {
        assert.equal((await fetch(`${f.url}/update${suffix}`)).status, 400);
    }
    for (const change of [{ index: -1 }, { index: 6 }, { index: 0.5 }, { color: 'red' }, { health: '10' }, { max: -1 }, { moneyGauntlet: null }]) {
        assert.equal((await f.update({ ...player, ...change })).status, 400);
    }
    assert.deepEqual(client.messages, [{ players: [], first: true }]);
    assert.equal((await fetch(f.url)).status, 200);
});

test('broadcasts to all sources, deduplicates updates, and restores snapshots', async (t) => {
    const f = await fixture(t);
    const a = await f.connect();
    const b = await f.connect();
    assert.equal((await f.update(player)).status, 204);
    await waitFor(() => a.messages.length === 2 && b.messages.length === 2);
    assert.deepEqual(a.messages[1].players, [player]);
    assert.equal((await f.update(player)).status, 204);
    assert.equal((await f.update({ ...player, health: 9 })).status, 204);
    await waitFor(() => a.messages.length === 3 && b.messages.length === 3);
    assert.equal(a.messages[2].players[0].health, 9);
    a.ws.close();
    await once(a.ws, 'close');
    await f.update({ ...player, health: 8 });
    await waitFor(() => b.messages.length === 4);
    const c = await f.connect();
    assert.equal(c.messages[0].players[0].health, 8);
    assert.equal((await f.update({ reset: true })).status, 204);
    await waitFor(() => c.messages.length === 2);
    assert.deepEqual(c.messages[1], { reset: true });
    const d = await f.connect();
    assert.deepEqual(d.messages[0].players, []);
});

test('clears old roster when player zero changes identity', async (t) => {
    const f = await fixture(t);
    await f.update(player);
    await f.update({ ...player, index: 1 });
    await f.update({ ...player, userId: 'new' });
    const client = await f.connect();
    assert.equal(client.messages[0].players.length, 1);
    assert.equal(client.messages[0].players[0].userId, 'new');
});

test('expires stale state, while repeated updates keep it alive', async (t) => {
    const f = await fixture(t, { staleTimeoutMs: 150 });
    const client = await f.connect();
    await f.update(player);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await f.update(player);
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(client.messages.some((message) => message.reset), false);
    await waitFor(() => client.messages.some((message) => message.reset));
    const fresh = await f.connect();
    assert.deepEqual(fresh.messages[0].players, []);
});
