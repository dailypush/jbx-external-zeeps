const path = require("path");
const express = require("express");
const WebSocket = require("ws");

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

function createServer({ staleTimeoutMs = 120000 } = {}) {
    const app = express();
    let lastPlayers = [];
    let staleTimer;
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
        broadcast({ reset: true });
    }

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
        const first = lastPlayers[0];
        if (data.index === 0 && first && (first.color !== data.color
            || (data.userId !== undefined && first.userId !== data.userId))) reset();
        clearTimeout(staleTimer);
        if (staleTimeoutMs > 0) {
            staleTimer = setTimeout(reset, staleTimeoutMs);
            staleTimer.unref();
        }
        const previous = lastPlayers[data.index];
        lastPlayers[data.index] = data;
        if (!previous || JSON.stringify(previous) !== JSON.stringify(data)) {
            broadcast({ players: lastPlayers, change: data.index });
        }
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

if (require.main === module) {
    const port = Number(process.env.PORT || 1284);
    const staleTimeoutMs = Number(process.env.STALE_TIMEOUT_MS || 120000);
    if (!Number.isInteger(port) || port < 1 || port > 65535
        || !Number.isInteger(staleTimeoutMs) || staleTimeoutMs < 0 || staleTimeoutMs > 2147483647) {
        throw new Error("Invalid PORT or STALE_TIMEOUT_MS");
    }
    const { server } = createServer({ staleTimeoutMs });
    server.listen(port, () => console.log(`Overlay running at http://localhost:${port}/`));
    server.on("error", (error) => {
        console.error(`Unable to start overlay: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { createServer, validateUpdate };
