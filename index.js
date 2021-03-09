const express = require("express");
const app = express();
const port = 1284;
const WebSocket = require("ws");

var currentConnection = null;
var lastPlayers = [];

app.use(express.static("./html/"));
app.get("/update", (req, res) => {
    var data = JSON.parse(req.query.data);
    console.log(data);
    if (data.reset) {
        lastPlayers = [];
        if (currentConnection) currentConnection.send(JSON.stringify({ reset: true }));
        return;
    }
    if (!data.index && lastPlayers[0] && lastPlayers[0].color != data.color) lastPlayers = [];
    lastPlayers[data.index] = data;
    if (currentConnection) currentConnection.send(JSON.stringify({ players: lastPlayers, change: data.index }));
});

const server = app.listen(port, () => console.log("Server running"));
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
    currentConnection = ws;
    ws.send(JSON.stringify({ players: lastPlayers, first: true }));
    ws.on("close", () => currentConnection = null);
});