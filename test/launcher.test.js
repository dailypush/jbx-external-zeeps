const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/start.js'), 'utf8').replace('main().catch(', 'globalThis.done = main().catch(');
const fingerprint = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).update(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).digest('hex');

async function launch({ existing = false, stamp, installStatus = 0, platform = 'darwin' } = {}) {
    const calls = { installs: [], browsers: [], writes: [], starts: 0, errors: [] };
    const fakeProcess = { platform, versions: { node: '24.0.0' }, env: {}, chdir() {}, exitCode: 0 };
    const dependencies = {
        fs: {
            readFileSync(file, encoding) {
                if (file.endsWith('.zeeps-install')) {
                    if (!stamp) throw new Error('Missing stamp');
                    return stamp;
                }
                return fs.readFileSync(file, encoding);
            },
            writeFileSync(file, contents) { calls.writes.push({ file, contents }); }
        },
        path, crypto,
        child_process: {
            spawnSync(command, args) { calls.installs.push({ command, args }); return { status: installStatus }; },
            spawn(command, args) { calls.browsers.push({ command, args }); return { on() {}, unref() {} }; }
        },
        '../index': { startServer() { calls.starts++; return { server: { once(event, fn) { assert.equal(event, 'listening'); fn(); } } }; } }
    };
    const fakeRequire = (name) => {
        assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
        return dependencies[name];
    };
    fakeRequire.resolve = () => 'installed';
    const context = vm.createContext({ require: fakeRequire, __dirname: path.join(root, 'scripts'), process: fakeProcess,
        console: { log() {}, error(message) { calls.errors.push(message); } }, AbortSignal,
        fetch: async () => { if (!existing) throw new Error('No server'); return { json: async () => ({ app: 'jbx-external-zeeps' }) }; }
    });
    vm.runInContext(source, context);
    await context.done;
    return { calls, process: fakeProcess };
}

test('first launch installs packages and opens controls after listening', async () => {
    const { calls } = await launch();
    assert.equal(calls.installs.length, 1);
    assert.equal(calls.installs[0].command, 'npm');
    assert.equal(calls.installs[0].args[0], 'ci');
    assert.equal(calls.writes[0].contents, fingerprint);
    assert.equal(calls.starts, 1);
    assert.equal(calls.browsers[0].command, 'open');
    assert.equal(calls.browsers[0].args[0], 'http://localhost:1284/control/');
});

test('later launches reuse packages but changed package files trigger reinstall', async () => {
    assert.equal((await launch({ stamp: fingerprint })).calls.installs.length, 0);
    assert.equal((await launch({ stamp: 'old-fingerprint' })).calls.installs.length, 1);
});

test('an existing overlay is reused without installation or another server', async () => {
    const { calls } = await launch({ existing: true });
    assert.equal(calls.installs.length, 0);
    assert.equal(calls.starts, 0);
    assert.equal(calls.browsers.length, 1);
});

test('failed package installation stops with guidance and does not mark installation complete', async () => {
    const result = await launch({ installStatus: 1 });
    assert.equal(result.calls.starts, 0);
    assert.equal(result.calls.writes.length, 0);
    assert.equal(result.calls.browsers.length, 0);
    assert.equal(result.process.exitCode, 1);
    assert.match(result.calls.errors[0], /Package installation failed/);
});

test('Windows launches npm and the browser through cmd', async () => {
    const { calls } = await launch({ platform: 'win32' });
    assert.equal(calls.installs[0].command, 'cmd.exe');
    assert.equal(calls.installs[0].args.at(-1), 'npm ci');
    assert.equal(calls.browsers[0].command, 'cmd.exe');
    assert.equal(calls.browsers[0].args.at(-1), 'http://localhost:1284/control/');
});
