const $ = (id) => document.getElementById(id);
const overlayURL = `${location.origin}/`;
$('overlay-url').value = overlayURL;
$('open-overlay').href = overlayURL;
let timeoutLoaded = false;

function feedback(message) { $('feedback').textContent = message; }
async function request(path, body) {
    const response = await fetch(`/api/${path}`, body === undefined ? { cache: 'no-store' } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) {
        let error;
        try { error = (await response.json()).error; } catch (_) { /* Use a readable fallback. */ }
        throw new Error(error || 'The request failed. Check the launcher window and try again.');
    }
    return response.status === 204 ? null : response.json();
}
async function refresh() {
    try {
        const state = await request('status');
        $('indicator').className = 'dot online';
        const age = state.lastUpdateAt ? Math.max(0, Math.floor((Date.now() - state.lastUpdateAt) / 1000)) : null;
        $('status').textContent = state.mode === 'demo' ? 'Previewing sample players'
            : state.mode === 'game' ? 'Game data received' : 'Server ready · waiting for players';
        $('detail').textContent = state.mode === 'game'
            ? `${state.playerCount} players · last update ${age} seconds ago`
            : state.mode === 'demo' ? 'Samples appear in every connected overlay, including OBS.'
            : 'Start a challenge to see player stats, or preview sample players below.';
        $('views').textContent = `${state.views} connected ${state.views === 1 ? 'view' : 'views'} (includes preview)`;
        if (!timeoutLoaded) {
            const value = String(state.staleTimeoutMs);
            if (![...$('timeout').options].some((option) => option.value === value)) {
                $('timeout').add(new Option(`${state.staleTimeoutMs / 1000} seconds (custom)`, value));
            }
            $('timeout').value = value;
            timeoutLoaded = true;
        }
    } catch (_) {
        timeoutLoaded = false;
        $('indicator').className = 'dot offline';
        $('status').textContent = 'Server offline';
        $('detail').textContent = 'Open Start Zeeps again to reconnect. Keep its command window open.';
        $('views').textContent = '';
    }
}
async function action(button, path, body, message) {
    button.disabled = true;
    try { await request(path, body); feedback(message); await refresh(); }
    catch (error) { feedback(error.message); }
    finally { button.disabled = false; }
}
$('demo').addEventListener('click', () => action($('demo'), 'demo', {}, 'Sample players are showing. Clear the overlay when you finish checking OBS.'));
$('clear').addEventListener('click', () => action($('clear'), 'reset', {}, 'Overlay cleared. Live game updates will show players again.'));
$('settings').addEventListener('submit', (event) => {
    event.preventDefault();
    action($('settings').querySelector('button'), 'settings', { staleTimeoutMs: Number($('timeout').value) }, 'Inactivity timeout saved for this and future sessions.');
});
$('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(overlayURL); feedback('URL copied. Paste it into the URL field of your OBS Browser Source.'); }
    catch (_) { $('overlay-url').focus(); $('overlay-url').select(); feedback('Press Ctrl+C (Windows) or Command+C (Mac) to copy the selected URL.'); }
});
new ResizeObserver(() => {
    const width = $('preview').clientWidth;
    $('overlay-preview').style.transform = `scale(${width / 1280})`;
    $('preview').style.height = `${115 * width / 1280 + 38}px`;
}).observe($('preview'));
refresh();
setInterval(refresh, 2000);
