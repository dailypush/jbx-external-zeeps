# SlingShoot.swf inspection

Inspected on October 11, 2026. The SWF was read and decompressed for static inspection; its bytes were not changed and the game was not executed.

## File and code structure

- SHA-256: `e41cd4df7c24f8dfb629fcd0e7b752147786eff433a5fbbe66ff338d2a5eb24e`
- Compressed SWF (`CWS`), version 26.
- File size: 451,223 bytes; declared/decompressed size: 996,566 bytes.
- Timeline: one frame, configured for 30 frames per second. This is a file setting, not a measured performance result.
- Entry class: `SlingShoot`, extending `flash.display.MovieClip`.
- One ActionScript bytecode block: `frame1`, ABC version 46.16.
- Parsed 528 classes, 7,292 method definitions, and 6,731 method bodies. All method bodies decoded using Adobe's AVM2 opcode table.
- Game code uses `jackboxgames.slingshoot` namespaces. The file also contains Jackbox engine, blobcast, loading, configuration, and native-override classes.

## Existing overlay integration

The local HTTP integration is already compiled into `jackboxgames.slingshoot.Player.updatePlayerBlob(Object):Object` (ABC method 7287). It matches the request snippet in `html/req.txt`.

The method first calls its superclass and adds the normal controller metadata. At bytecode offset `0x0053`, it starts building a request to:

```text
http://localhost:1284/update?data=
```

It serializes and URL-encodes this object:

```javascript
{
    userId: _userId.val,
    index: _index.val,
    name: _name.val,
    color: ColorUtil.rgbToHex(this.color),
    health: playerBlob.characterCurrentHealth,
    max: playerBlob.characterMaxHealth,
    moneyGauntlet: gauntletStats.money,
    killsGauntlet: gauntletStats.kills,
    deathsGauntlet: gauntletStats.deaths,
    damageGauntlet: gauntletStats.damage,
    moneyChallenge: challengeStats.money,
    killsChallenge: challengeStats.kills,
    deathsChallenge: challengeStats.deaths,
    damageChallenge: challengeStats.damage
}
```

This is a readable reconstruction of the compiled method, not recovered original source. The method creates a new `flash.net.URLRequest` and `flash.net.URLLoader`, calls `load`, and returns the controller blob. It has no exception handlers, completion/error listeners, throttling, or duplicate suppression.

`BlobCastGameState.setCustomerBlobWithMetadata` (method 72) calls `player.updatePlayerBlob` before handing the result to BlobCast. Consequently the overlay hook runs on player-blob updates, not an independently scheduled frame loop. Actual request frequency requires a running game to measure.

`GamePlayer.controllerInfo` (method 5883) supplies the health fields from `_healthModel.maxHealth.val` and `_healthModel.currentHealth.val`. `ColorUtil.rgbToHex` (method 822) produces uppercase hexadecimal, pads to six digits, and prefixes `#`; this agrees with the overlay server's six-digit hex validation for ordinary RGB colors.

## Reset and lifecycle behavior

The localhost URL appears in the bytecode of only method 7287. That request always constructs the 14-field player payload above; there is no explicit `{"reset":true}` request in this SWF.

Relevant game lifecycle methods exist:

- `GameState.endChallenge` (150) finalizes trackers and destroys challenge content.
- `GameState.endGame` (155) changes game state and prepares results/artifact data.
- `GameState.reset` (166) and `destroy` (167) call `_resetGameState` (169).
- `GameState._onDisconnect` (168) returns to the menu and invokes the superclass disconnect handler.

These are candidate locations for explicit overlay lifecycle notifications. Choosing exact hooks requires testing transitions, because `endChallenge` also participates in cleanup and moving between challenges. Abrupt process termination cannot reliably emit an HTTP reset, so the server timeout remains useful as a fallback.

## Enhancement opportunities

1. **Reliable game-side telemetry:** isolate overlay sending in a helper, handle I/O/security errors, and catch synchronous loading errors so failures in the optional overlay do not interrupt controller-blob delivery. The absence of handlers is confirmed; its practical effect needs runtime testing.
2. **Reduce request work:** skip unchanged telemetry and use a bounded send rate with a latest-state queue. Server-side duplicate suppression currently reduces WebSocket work but does not eliminate the game's HTTP requests or loader allocation.
3. **Explicit lifecycle messages:** notify the overlay when challenges start/end and when the game returns to the menu; include a session/challenge identifier so roster transitions do not depend on player color or identity heuristics.
4. **Richer overlay without a SWF patch:** kills, deaths, damage, and challenge money are already exported. They can be displayed by changing the HTML overlay.
5. **Additional stats with a SWF patch:** `PlayerStats` includes revives, flings, and rescues, which the current telemetry object does not export.
6. **Configurable endpoint:** replace the hardcoded localhost port with a configuration setting, preserving localhost:1284 as the default.

## Gameplay modification scope

Health, damage, revival, collision, weapons, enemies, difficulty, and challenge code are present. Useful starting points include `HealthModel`, `GamePlayer`, `PlayerStats`, `StatsTracker`, `ChallengeFactory`, and `EnemyFactory`.

`GameConfig` lists external configuration groups `SSChallenges`, `SSDifficulty`, `SSEnemies`, `SSItems`, `SSTerrain`, `SSTuneables`, and `SSWeapons`. Its defaults reference `gamenews.jackboxgames.com/Games/Slingshoot/`, and other configuration can override its URL/protocol/target. No remote game configuration was fetched during this inspection.

The code also calls Jackbox native-override services for physics, audio, input, saving, and networking, and uses content loaders. Therefore this SWF alone does not establish a complete standalone runnable game. Balance changes may belong in external configuration rather than bytecode, depending on the installed game's assets and settings.

## Verification and limits

The decompressed length matched the header. The SWF tags, ABC constant pools, classes, methods, and method bodies were parsed; the ABC parser consumed its entire input. All 6,731 bodies decoded without unknown/invalid opcode errors. The selected methods were inspected statically. No Flash runtime, Java runtime, or SWF decompiler was available locally; no binary patch or live game validation was attempted.

The decoding reference was [Adobe's AVM2 opcode table](https://github.com/adobe-flash/avmplus/blob/master/core/opcodes.tbl). Counts, symbols, request fields, and lifecycle observations above come from this repository's SWF.
