# PBB Games Corner

PBB Games Corner is an optional local citizen engagement app for Project Bantay Bayan. It provides lightweight local games and emergency-preparedness learning activities for citizens connected to the PBB local network.

It is not part of core emergency operations and does not call Hotline, Relay, Support System, Realtime, Hub/HQ, Maestro, MapServer, or Kit Setup APIs in version 1.

## Deployment

- Install path: `C:\wamp64\www\pbb\games`
- Primary URL: `https://games.pbb.ph`
- Fallback URL: `https://pbb.ph/games`
- Runtime: WAMP / Apache / PHP
- Docker: not used
- Database: not used
- Internet: not required after installation

## Emergency Modes

Mode is configured in `config/games.php`.

- `normal`: shows enabled games allowed by registry.
- `monitoring`: shows allowed games with a caution banner.
- `active_incident`: hides Quick Games and Retro Corner; shows allowed Learning Games.
- `emergency`: disables all games and shows emergency guidance.

## Games Registry

Game cards are generated from `config/games.registry.php`. The registry includes categories, subcategories, enabled flags, mode visibility, display order, tags, estimated play time, touch/keyboard metadata, learning value, content rating, emergency priority, module paths, local preload assets, orientation preference, launch metadata, text fallback icons, and optional bitmap launcher icons.

## Helper UI Usage

Games Corner vendors the bundled Helper UI files from:

```text
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.js
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.css
```

Vendored files:

```text
assets/helper/helpers.ui.bundle.min.js
assets/helper/helpers.ui.bundle.min.css
```

Helper usage:

- Required dark theme through `data-theme="dark"`.
- `ui.navbar` from the Helper bundle for the fixed top navbar.
- `ui.icon.grid` from the Helper bundle for the fixed launcher grid.
- `ui.empty.state` from the Helper bundle for empty launcher states.
- `ui.busy.overlay` from the Helper bundle while game assets/modules load.
- `ui.game.core` from the Helper bundle for game sessions, close controls, canvas layers, game loops, virtual joysticks, touch/action controls, and action button groups.
- `ui.game.objects` from the Helper bundle for canvas object layers, pointer routing, and flip-card behavior.
- Shared classes including `ui-button`, `ui-button-ghost`, `ui-button-quiet`, `ui-button-primary`, `ui-panel`, `ui-badge`, `ui-eyebrow`, `ui-title`, `ui-input`, `ui-field`, and `ui-label`.

App-local CSS remains for fixed page sizing, small shell spacing, game stage overlays, launch splash presentation, countdown presentation, quiz layouts, and game-specific canvas behavior.

Known Helper gaps are tracked in `docs/helper-ui-gap-proposals.md`.

Reusable app-local game shell and control patterns are documented in `docs/game-ui-components.md`.

To refresh Helper later, rebuild or update `C:\wamp64\www\hotline-helpers`, copy the two `dist` bundle files into `assets/helper`, and re-test the homepage navbar, icon grid, and dark theme.

## Landing / Kit Setup

Version 1 provides registration metadata only. Kit Setup or a future admin workflow should register this app with Landing. See `docs/landing-registry.md`.

The app-owned launcher mark is published at `https://games.pbb.ph/assets/launcher/app-icon.png` for Landing and browser install surfaces.

## Game Launch Flow

Module-backed games are launched from the registry. Games Center creates one active Helper `createGameSession`, requests fullscreen only on mobile browsers, applies the game orientation preference where supported, shows a Helper busy overlay while local assets and modules load, mounts the game module, then shows a standardized launch splash.

Pressing `Start Game` removes the splash, shows a large `3, 2, 1` countdown over the game stage, then calls the game controller `start()` method. Game modules must not begin active gameplay during mount.

Current game-specific notes:

- Snake uses a local splash background at `games/snake/assets/splash.png`, a local launcher icon at `games/snake/assets/icon.png`, a Helper ghost virtual joystick, top-center score, and Helper action buttons.
- Breakout uses a responsive canvas layout derived from the live stage size, top-center remaining-block count, keyboard control, and direct touch/drag paddle control. It intentionally does not show a D-pad or joystick.
- Memory Cards uses the same game session and launch contract, does not require a forced orientation, and uses Helper `ui.game.objects` for canvas flip-card behavior while keeping deck, matching, scoring, and completion rules in Games Corner.
- Tetris uses Helper `createTetromino` for SRS-aligned pieces and wall-kick candidates while Games Corner owns board collision, gravity, line clears, scoring, levels, and mobile-first touch controls.

## PWA Notes

`manifest.json` is local/offline-safe and includes `"orientation": "landscape"` so installed PWA mode prefers landscape. Browser support still varies by OS/browser. The runtime also retries `screen.orientation.lock(...)` from the `Start Game` user gesture for games with a registry orientation preference.

## Legal Content Warning

Do not bundle commercial ROMs, BIOS files, copyrighted games, copyrighted sprites, copyrighted music, or any asset without explicit distribution and use rights for this deployment.

Only local original, generated, public-domain, open-source, or properly licensed assets should be used.

## Health Endpoint

`/health.php` returns JSON with app status, current mode, version, total games, visible games, and categories.

## Acceptance Checklist

- [ ] Open `https://games.pbb.ph` and confirm homepage loads offline.
- [ ] Confirm Helper dark theme is active.
- [ ] Confirm homepage uses Helper navbar and Helper icon grid.
- [ ] Confirm game cards are generated from `config/games.registry.php`.
- [ ] Confirm category filters and search work.
- [ ] Open each game and confirm it runs offline.
- [ ] Confirm module-backed games show a splash, then a `3, 2, 1` countdown before gameplay starts.
- [ ] Confirm Snake shows the local splash and launcher icon.
- [ ] Confirm Breakout is playable by touch-dragging the paddle on small screens.
- [ ] Confirm installed PWA mode prefers landscape orientation after the manifest update is picked up by the browser.
- [ ] Confirm every game has `Back to Games Corner` and `Back to PBB Landing`.
- [ ] Set `mode=emergency` and verify all games are disabled.
- [ ] Set `mode=active_incident` and verify Quick Games and Retro Corner are hidden.
- [ ] Set one game `enabled=false` and verify it disappears.
- [ ] Open `health.php` and verify valid JSON.
- [ ] Confirm browser dev tools show no external network requests.
- [ ] Confirm mobile layout is usable.
- [ ] Confirm no prohibited game assets are bundled.
