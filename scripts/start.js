const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
process.chdir(root);

function openBrowser(url) {
    const child = process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/c', 'start', '""', url], { stdio: 'ignore' })
        : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
    child.on('error', () => console.log(`Open this address in your browser: ${url}`));
    child.unref();
}

async function main() {
    if (Number(process.versions.node.split('.')[0]) < 18) throw new Error('Install Node.js LTS (18 or newer), then try again.');
    const port = Number(process.env.PORT || 1284);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number between 1 and 65535.');
    const url = `http://localhost:${port}`;
    try {
        const response = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(1500) });
        const status = await response.json();
        if (status.app === 'jbx-external-zeeps') {
            console.log('The overlay is already running. Opening its controls.');
            openBrowser(`${url}/control/`);
            return;
        }
    } catch (_) { /* Start a server when none is available. */ }
    const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const lock = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
    const fingerprint = require('crypto').createHash('sha256').update(manifest).update(lock).digest('hex');
    const stamp = path.join(root, 'node_modules', '.zeeps-install');
    let installed = false;
    try {
        installed = fs.readFileSync(stamp, 'utf8') === fingerprint;
        require.resolve('express');
        require.resolve('ws');
    } catch (_) { installed = false; }
    if (!installed) {
        console.log('Installing overlay packages. This first step needs an internet connection…');
        const result = process.platform === 'win32'
            ? spawnSync('cmd.exe', ['/d', '/c', 'npm ci'], { cwd: root, stdio: 'inherit' })
            : spawnSync('npm', ['ci'], { cwd: root, stdio: 'inherit' });
        if (result.error || result.status !== 0) throw new Error('Package installation failed. Check that Node.js includes npm and that your internet connection works, then try again.');
        fs.writeFileSync(stamp, fingerprint);
    }
    const { startServer } = require('../index');
    const { server } = startServer();
    server.once('listening', () => {
        console.log('Keep this window open while streaming. Press Ctrl+C to stop.');
        openBrowser(`${url}/control/`);
    });
}

main().catch((error) => {
    console.error(`Unable to launch: ${error.message}`);
    process.exitCode = 1;
});
