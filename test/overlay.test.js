const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../html/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const player = { index: 0, name: '<img src=x onerror=alert(1)>', color: '#ff0000', health: 10, max: 20, moneyGauntlet: 100 };

function fixture() {
    const elements = [];
    const animations = [];
    const sockets = [];
    const timers = [];
    let ready;
    const $ = (value) => {
        if (typeof value === 'function') { ready = value; return; }
        const element = {
            0: {}, classes: [], removed: false, textValue: '', htmlValue: '', writes: 0,
            addClass(name) { this.classes.push(name); return this; },
            appendTo() { return this; }, css() { return this; }, attr() { return this; },
            text(value) { this.textValue = value; this.writes++; return this; },
            html(value) { this.htmlValue = value; this.writes++; return this; },
            prop() { return '<svg></svg>'; }, remove() { this.removed = true; }
        };
        elements.push(element);
        return element;
    };
    const anime = (animation) => animations.push(animation);
    anime.remove = () => {};
    anime.set = (target, props) => Object.assign(target, props);
    class Socket {
        constructor(url) { this.url = url; sockets.push(this); }
        close() { this.onclose(); }
        message(data) { this.onmessage({ data: JSON.stringify(data) }); }
    }
    const context = vm.createContext({ $, anime, WebSocket: Socket, location: { protocol: 'https:', host: 'overlay.local:1284' }, document: { querySelector: () => ({}) }, setTimeout: (fn, delay) => timers.push({ fn, delay }) });
    vm.runInContext(script, context);
    ready();
    return { elements, animations, sockets, timers, context, nodes: (name) => elements.filter((e) => e.classes.includes(name) && !e.removed) };
}

test('renders names as text, skips unchanged writes, clamps health and responds to maximum changes', () => {
    const f = fixture();
    const ws = f.sockets[0];
    ws.message({ players: [player] });
    const name = f.nodes('player-name')[0];
    assert.equal(name.textValue, player.name);
    assert.equal(name.htmlValue, '');
    const stats = f.nodes('middle-text')[0];
    const writes = stats.writes;
    const animations = f.animations.length;
    ws.message({ players: [player] });
    assert.equal(stats.writes, writes);
    assert.equal(f.animations.length, animations);
    ws.message({ players: [{ ...player, max: 5 }] });
    assert.equal(f.animations.at(-1).width, '100%');
    ws.message({ players: [{ ...player, max: 0 }] });
    assert.equal(f.animations.at(-1).translateY, -115);
});

test('reconciles sparse rosters, replacement identities, and resets', () => {
    const f = fixture();
    const ws = f.sockets[0];
    ws.message({ players: [player, null, { ...player, index: 2 }] });
    assert.equal(f.nodes('player').length, 2);
    ws.message({ players: [{ ...player, color: '#00ff00' }] });
    assert.equal(f.nodes('player').length, 1);
    ws.message({ reset: true });
    assert.equal(f.nodes('player').length, 0);
    assert.equal(f.animations.at(-1).translateY, -115);
});

test('uses source origin, hides disconnected data, and retries with capped backoff', () => {
    const f = fixture();
    const ws = f.sockets[0];
    assert.equal(ws.url, 'wss://overlay.local:1284/');
    assert.doesNotThrow(() => ws.onmessage({ data: 'invalid json' }));
    ws.message({ players: [player] });
    ws.close();
    assert.equal(f.nodes('player').length, 0);
    assert.equal(f.timers.at(-1).delay, 500);
    for (let i = 0; i < 8; i++) {
        f.timers.at(-1).fn();
        f.sockets.at(-1).close();
    }
    assert.equal(f.timers.at(-1).delay, 10000);
    f.timers.at(-1).fn();
    f.sockets.at(-1).onopen();
    f.sockets.at(-1).close();
    assert.equal(f.timers.at(-1).delay, 500);
});
