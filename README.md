# jbx-external-zeeps

A Zeeple Dome overlay for streaming browser sources. The modified game sends player stats to the local server using the request shown in `html/req.txt`.

## Setup

Install Node.js 18 or newer, then run:

```sh
npm ci
npm start
```

Create a Browser / BrowserSource in your streaming software with the URL `http://localhost:1284/`. Set its browser size to **1280 × 115**, then move and scale it to fit your setup.

The overlay starts transparent and slides into view during challenges when players have health. Multiple browser sources can connect at once. Sources automatically reconnect after a server restart and restore the current player stats.

If the game stops sending updates, the server clears the overlay after two minutes. Adjust this timeout if your game has longer quiet periods:

```sh
STALE_TIMEOUT_MS=300000 npm start
```

Set `STALE_TIMEOUT_MS=0` to disable expiry. An explicit update with `{"reset":true}` clears the overlay immediately. `PORT` changes the server port; update both the game request URL and browser source URL to match.

## Development

```sh
npm test
```

Player updates use `GET /update?data=<URL-encoded JSON>`. Valid updates return HTTP 204; malformed updates return HTTP 400. Player indices are 0–5, colors are six-digit hex strings with a leading `#`, and health, maximum health, and gauntlet money must be finite numbers. Health and maximum health must be nonnegative.
