# Zeeple Dome streaming overlay

Show player names, health, and earnings from Jackbox's Zeeple Dome (“Zeeps”) on your stream.

**New here? Follow the steps below in order.** You only install the tools once; after that, start the overlay server before each session.

## What you need

- An installed copy of the Jackbox game containing Zeeple Dome.
- [Node.js](https://nodejs.org/en/download): choose the **LTS** installer for your operating system. It includes npm, the tool used by the commands below. The project requires Node.js 18 or newer; use a currently supported LTS release for a new installation.
- [OBS Studio](https://obsproject.com/) or streaming software that supports a Browser Source.
- The game, overlay server, and browser source running on the **same computer** for these instructions.
- An internet connection to download Node.js and install the overlay's dependencies the first time.

The project folder includes a modified `SlingShoot.swf` that sends stats to the overlay. The unmodified game does not contain this project's localhost telemetry hook. The bundled SWF has been inspected, but compatibility with your installed game version has not been tested here; keep the original file so you can restore it.

## 1. Download and unpack this project

1. Open [the project's GitHub page](https://github.com/dailypush/jbx-external-zeeps).
2. Click **Code → Download ZIP**.
3. Extract the ZIP into a folder you can find easily, such as your Documents folder. On Windows, choose **Extract All**; on macOS, double-click the ZIP.
4. Open the extracted folder. You should see `README.md`, `package.json`, `index.js`, `SlingShoot.swf`, and the `html` folder.

Run the following commands from this extracted folder, rather than from inside the ZIP or the `html` folder.

## 2. Install Node.js and open a command window

Install Node.js using the LTS installer linked above, then open a **new** command window:

**Windows**

Open the project folder in File Explorer. Click its address bar, type `cmd`, and press Enter. This opens Command Prompt in the correct folder. The Windows commands in this guide use Command Prompt.

**macOS**

Open **Terminal** from Applications → Utilities. Type `cd ` (including the space), drag the extracted project folder from Finder into Terminal, and press Enter.

Check that Node.js and npm are available by entering each command separately:

```sh
node --version
npm --version
```

Both commands should print a version number. If either is “not recognized” or “not found,” finish installing Node.js, close the command window, and open a new one.

## 3. Install and start the overlay

Enter:

```sh
npm ci
```

This downloads the required packages. Wait until it finishes and the command prompt returns. You only need to repeat it after downloading an updated project or removing the `node_modules` folder.

Then enter:

```sh
npm start
```

You should see:

```text
Overlay running at http://localhost:1284/
```

**Leave this command window open while playing.** It runs the local overlay server. To stop it later, press **Ctrl+C**.

Open [http://localhost:1284/](http://localhost:1284/) in your web browser. An empty page is expected: the overlay stays hidden until it receives player health during a challenge. You do not need to double-click `html/index.html`.

## 4. Add the overlay to OBS

In OBS, select the scene you use for Zeeple Dome. In **Sources**, click **+ → Browser**, name it “Zeeps Overlay,” and enter these settings:

| Setting | Value |
| --- | --- |
| Local file | Off / unchecked |
| URL | `http://localhost:1284/` |
| Width | `1280` |
| Height | `115` |

Click **OK**, then place the source above your game capture in the Sources list so it draws over the game. Drag it into position and resize it on the canvas as needed. Keep the source's Width and Height settings at **1280 × 115**.

These fields are described in the [official OBS Browser Source guide](https://obsproject.com/kb/browser-source). Other streaming software should use the same URL and dimensions.

### Test the overlay before modifying the game

With the server running and OBS open, use these links in your regular web browser:

1. [Show a demo player](http://localhost:1284/update?data=%7B%22index%22%3A0%2C%22userId%22%3A%22setup-demo%22%2C%22name%22%3A%22Demo%20Player%22%2C%22color%22%3A%22%2366CCFF%22%2C%22health%22%3A75%2C%22max%22%3A100%2C%22moneyGauntlet%22%3A1234%7D). This sends sample stats to the server; look for “Demo Player” in OBS or the overlay browser tab.
2. [Clear the demo](http://localhost:1284/update?data=%7B%22reset%22%3Atrue%7D) when you finish.

The update links may leave the browser on its current page or show an empty response. The visible result appears in the overlay. The demo clears automatically after two minutes without updates. Run this check while the game is closed because it temporarily changes the displayed player data.

If the demo appears, the server and browser source are working. The next step connects the actual game.

## 5. Install the modified game file

1. **Close the Jackbox game.**
2. Open its installation folder. In Steam, right-click the game in your Library and choose **Manage → Browse local files**. For other stores, use their option to open the installed game folder.
3. Search inside that installation folder for **`SlingShoot.swf`**. Use the original game's file with this exact name; folder layouts may differ between platforms and versions.
4. Copy the original file into a separate backup folder outside the game installation. Label it clearly, for example `Zeeple Dome original SWF`.
5. Copy this project's `SlingShoot.swf` into the folder containing the original and replace that file. Keep its filename as `SlingShoot.swf`.
6. Launch the game normally through its store or launcher. Start Zeeple Dome and play until an active challenge begins.

The overlay should slide into view when players have health. You do not open the SWF directly in your web browser, and you do not need a separate Flash browser plugin.

**If you cannot find the matching SWF, stop at this step.** The replacement procedure needs to be checked for your game version/platform. You can still use the demo to verify the overlay setup.

## Each time you stream

1. Open a command window in the project folder and run `npm start`.
2. Open OBS and select your scene with the Zeeps Overlay source.
3. Launch Zeeple Dome and begin a challenge.
4. When finished, press Ctrl+C in the server window.

Browser sources reconnect automatically if the server restarts. If the game stops sending updates, the overlay clears after two minutes.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `node` or `npm` is not recognized / not found | Install Node.js LTS, then reopen your command window. |
| An error mentioning a missing `package.json` | Open a command window in the extracted project folder containing `package.json`. |
| `Cannot find module 'express'` or `'ws'` | Run `npm ci` in the project folder, then `npm start`. |
| `npm ci` cannot download packages | Check your internet connection and the error message, then try again. |
| `EADDRINUSE` or “address already in use” | Another program is using port 1284. Check for an overlay server already running in another window; you only need one. |
| Your browser cannot reach `localhost:1284` | Start the server and leave its window open. Check for errors and use `http://`, with port `1284`. |
| OBS is blank before a challenge | This is normal. Use the demo links above to check the setup. |
| The demo works, but the game never appears | Confirm the modified SWF is installed in the correct game folder and restart the game. Updates or file verification may restore the original SWF. Compatibility with your game version may need investigation. |
| The overlay is cropped or misplaced | Set the Browser Source to 1280 × 115, put it above game capture, and reposition it on the OBS canvas. |
| The overlay stays visible after exiting the game | Wait two minutes, or use the “Clear the demo” link above to clear the current overlay data immediately. |
| The game has problems after replacing the SWF | Close the game and restore your backed-up original file. |

To get help, include your operating system, game/store version, whether the demo works, and the exact error text from the server window.

## Restore the original game

Close the game. Copy your backed-up original `SlingShoot.swf` into its original location, replacing the modified file. You can keep the overlay project folder for later use.

## Optional: change the inactivity timeout

The default is **120,000 milliseconds (two minutes)**. If the overlay disappears during long quiet periods, you can increase it. Stop the current server with Ctrl+C before using one of these commands.

**Windows Command Prompt — five minutes:**

```bat
set "STALE_TIMEOUT_MS=300000"
npm start
```

**macOS / Linux — five minutes:**

```sh
STALE_TIMEOUT_MS=300000 npm start
```

Set the value to `0` to disable automatic clearing. In Windows Command Prompt, run `set "STALE_TIMEOUT_MS="` before starting again to return to the default; on macOS/Linux, start with plain `npm start` in a shell without that variable set.

## For developers

Run the tests with:

```sh
npm test
```

The game sends stats using `GET /update?data=<URL-encoded JSON>`. Valid updates return HTTP 204; malformed updates return HTTP 400. Player indices are 0–5, colors are six-digit hex strings with a leading `#`, and health, maximum health, and gauntlet money must be finite numbers. Health and maximum health must be nonnegative. Sending `{"reset":true}` clears the overlay.

`PORT` changes the server's listening port. The bundled SWF hardcodes port 1284, so changing `PORT` also requires changing the game telemetry endpoint and the browser source URL.

See [the request example](html/req.txt) and [the SWF inspection report](docs/swf-inspection.md) for implementation details.
