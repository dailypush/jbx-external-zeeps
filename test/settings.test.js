const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readSettings, saveSettings } = require('../settings');

test('saved streamer settings survive restart; missing settings use defaults', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zeeps-settings-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'settings.json');
    assert.deepEqual(readSettings(file), { staleTimeoutMs: 120000 });
    saveSettings(file, { staleTimeoutMs: 300000 });
    assert.deepEqual(readSettings(file), { staleTimeoutMs: 300000 });
    saveSettings(file, { staleTimeoutMs: 0 });
    assert.deepEqual(readSettings(file), { staleTimeoutMs: 0 });
    assert.equal(fs.existsSync(`${file}.tmp`), false);
    fs.writeFileSync(file, 'not JSON');
    assert.throws(() => readSettings(file), /Unable to read settings/);
});
