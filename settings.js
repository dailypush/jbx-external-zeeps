const fs = require('fs');

function validTimeout(value) {
    return Number.isInteger(value) && value >= 0 && value <= 2147483647;
}

function readSettings(file) {
    try {
        const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!validTimeout(settings.staleTimeoutMs)) throw new Error('Invalid inactivity timeout');
        return { staleTimeoutMs: settings.staleTimeoutMs };
    } catch (error) {
        if (error.code === 'ENOENT') return { staleTimeoutMs: 120000 };
        throw new Error(`Unable to read settings.json: ${error.message}`);
    }
}

function saveSettings(file, settings) {
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`);
    fs.renameSync(temp, file);
}

module.exports = { readSettings, saveSettings, validTimeout };
