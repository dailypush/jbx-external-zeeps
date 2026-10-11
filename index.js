const path = require("path");
const express = require("express");
const WebSocket = require("ws");

const { readSettings, saveSettings, validTimeout } = require("./settings");
const MAX_PLAYERS = 6;

function validateUpdate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    if (data.reset === true) return true;
    return Number.isInteger(data.index) && data.index >= 0 && data.index < MAX_PLAYERS
        && typeof data.name === "string" && data.name.length <= 256
        && typeof data.color === "string" && /^#[\da-f]{6}$/i.test(data.color)
        && [data.health, data.max, data.moneyGauntlet].every(Number.isFinite)
        && data.health >= 0 && data.max >= 0;
}

function createServer({ staleTimeoutMs = 120000, persistSettings = () => {} } = {}) {
    const app = express();
    let lastPlayers = [];
    let staleTimer;
    let lastUpdateAt = null;
    let mode = "idle";
    app.disable("x-powered-by");
    app.use(express.static(path.join(__dirname, "html")));
    const server = require("http").createServer(app);
    const wss = new WebSocket.Server({ server, maxPayload: 16384 });

    function send(ws, message) {
        if (ws.readyState !== WebSocket.OPEN) return;
        // Reconnecting a stalled browser source restores the latest snapshot.
        if (ws.bufferedAmount > 1024 * 1024) return ws.terminate();
        ws.send(message, (error) => { if (error) ws.terminate(); });
    }

    function broadcast(data) {
        const message = JSON.stringify(data);
        wss.clients.forEach((ws) => send(ws, message));
    }

    function reset() {
        clearTimeout(staleTimer);
        lastPlayers = [];
        mode = "idle";
        broadcast({ reset: true });
    }

    function armExpiry() {
        clearTimeout(staleTimer);
        if (staleTimeoutMs > 0 && lastPlayers.some(Boolean)) {
            const remaining = Math.max(0, staleTimeoutMs - (Date.now() - lastUpdateAt));
            staleTimer = setTimeout(reset, remaining);
            staleTimer.unref();
        }
    }

    function applyUpdate(data) {
        const first = lastPlayers[0];
        if (data.index === 0 && first && (first.color !== data.color
            || (data.userId !== undefined && first.userId !== data.userId))) {
            reset();
            mode = "game";
        }
        const previous = lastPlayers[data.index];
        lastPlayers[data.index] = data;
        if (!previous || JSON.stringify(previous) !== JSON.stringify(data)) {
            broadcast({ players: lastPlayers, change: data.index });
        }
        armExpiry();
    }

    app.use("/api", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        const address = req.socket.remoteAddress;
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
            return res.status(403).json({ error: "Open the controls on the computer running the overlay." });
        }
        if (req.method === "POST") {
            const origin = req.get("Origin");
            if (origin && origin !== `${req.protocol}://${req.get("Host")}`) {
                return res.status(403).json({ error: "Use the overlay's own control page." });
            }
            if (!req.is("application/json")) return res.status(415).json({ error: "Expected JSON" });
        }
        next();
    }, express.json({ limit: "2kb" }));
    app.get("/api/status", (req, res) => {
        res.json({ app: "jbx-external-zeeps", mode, lastUpdateAt,
            playerCount: lastPlayers.filter(Boolean).length,
            views: wss.clients.size, staleTimeoutMs });
    });
    app.post("/api/reset", (req, res) => {
        reset();
        res.sendStatus(204);
    });
    app.post("/api/demo", (req, res) => {
        if (mode === "game") return res.status(409).json({ error: "Game data is active. Close the game and clear the overlay before previewing." });
        reset();
        lastUpdateAt = Date.now();
        mode = "demo";
        const colors = ["#66CCFF", "#FFBB66", "#99DD77", "#EE99CC", "#CCAAFF", "#FFFF88"];
        colors.forEach((color, index) => {
            lastPlayers[index] = { index, userId: `demo-${index}`, name: `Player ${index + 1}`,
                color, health: 100 - index * 15, max: 100, moneyGauntlet: (index + 1) * 1250 };
        });
        broadcast({ players: lastPlayers, first: true });
        armExpiry();
        res.sendStatus(204);
    });
    app.post("/api/settings", (req, res) => {
        if (!req.body || !validTimeout(req.body.staleTimeoutMs)) {
            return res.status(400).json({ error: "Enter a valid inactivity timeout." });
        }
        const settings = { staleTimeoutMs: req.body.staleTimeoutMs };
        try { persistSettings(settings); } catch (_) {
            return res.status(500).json({ error: "Could not save settings. Check that the project folder is writable." });
        }
        staleTimeoutMs = settings.staleTimeoutMs;
        armExpiry();
        res.json(settings);
    });
    app.use("/api", (error, req, res, next) => {
        res.status(error.status || 500).json({ error: "Invalid control request." });
    });

    app.get("/update", (req, res) => {
        res.set("Cache-Control", "no-store");
        let data;
        try {
            if (typeof req.query.data !== "string" || req.query.data.length > 16384) throw new Error();
            data = JSON.parse(req.query.data);
        } catch (_) {
            return res.status(400).json({ error: "Expected a JSON data query parameter" });
        }
        if (!validateUpdate(data)) return res.status(400).json({ error: "Invalid player update" });
        if (data.reset === true) {
            reset();
            return res.sendStatus(204);
        }
        if (mode === "demo") reset();
        mode = "game";
        lastUpdateAt = Date.now();
        applyUpdate(data);
        return res.sendStatus(204);
    });

    wss.on("connection", (ws) => {
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });
        ws.on("error", () => ws.terminate());
        send(ws, JSON.stringify({ players: lastPlayers, first: true }));
    });
    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        });
    }, 30000);
    heartbeat.unref();
    server.on("close", () => {
        clearTimeout(staleTimer);
        clearInterval(heartbeat);
        wss.close();
    });
    return { server, wss };
}

function startServer() {
    const settingsFile = path.join(__dirname, "settings.json");
    const settings = readSettings(settingsFile);
    const port = Number(process.env.PORT || 1284);
    const staleTimeoutMs = process.env.STALE_TIMEOUT_MS === undefined
        ? settings.staleTimeoutMs : Number(process.env.STALE_TIMEOUT_MS);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !validTimeout(staleTimeoutMs)) {
        throw new Error("Invalid PORT or STALE_TIMEOUT_MS");
    }
    const instance = createServer({ staleTimeoutMs,
        persistSettings: (next) => saveSettings(settingsFile, next) });
    instance.server.listen(port, () => {
        console.log(`Overlay running at http://localhost:${port}/`);
        console.log(`Streamer controls: http://localhost:${port}/control/`);
    });
    instance.server.on("error", (error) => {
        console.error(`Unable to start overlay: ${error.message}`);
        process.exitCode = 1;
    });
    return instance;
}

if (require.main === module) startServer();
module.exports = { createServer, validateUpdate, startServer };
