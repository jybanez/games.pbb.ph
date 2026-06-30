# PBB Games Corner Implementation Checklist

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked or needs decision

## Current Snapshot

- [x] App is on version `0.2.14`.
- [x] `health.php` reports 12 registered games and 7 visible games in normal mode.
- [x] Enabled visible games are Snake, Memory Cards, Breakout, Tetris, Supply Run, Sector Wing, and Survival.
- [x] Disabled registry entries remain Emergency Kit Quiz, First Aid Matching, Hazard Awareness Quiz, Retro Corner, and Barangay Trivia.
- [x] Sector Wing v2 is merged and available from `main`.
- [x] Docs-only proposal/checklist updates may use the repo protocol docs fast lane on clean `main`.

## 1. Project Foundation

- [x] Create root `index.php`.
- [x] Create `config/games.php`.
- [x] Create `config/games.registry.php`.
- [x] Create `src/GameRegistry.php`.
- [x] Create `src/ModePolicy.php`.
- [x] Create `health.php`.
- [x] Create `manifest.json`.
- [x] Create root `README.md`.
- [x] Create app asset folders under `assets/css`, `assets/js`, `assets/img`, and `assets/helper`.
- [x] Create game folders under `games/`.
- [x] Create `retro/` and `retro/roms/` placeholder folders.

## 2. Helper UI Vendoring

- [x] Copy `C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.js` into `assets/helper/`.
- [x] Copy `C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.css` into `assets/helper/`.
- [x] Add `assets/helper/README.md` documenting source path and refresh steps.
- [x] Load vendored Helper CSS from the homepage.
- [x] Load vendored Helper JS where Helper components are used.
- [x] Prefer the vendored Helper bundle at runtime instead of direct Helper source imports.
- [x] Enable/use the Helper dark theme as the version 1 theme.
- [x] Use Helper shared classes for shell, panels, surfaces, buttons, badges, notices, tabs, and empty states.
- [x] Use the Helper navbar component/primitives for the fixed top navigation.
- [x] Use the Helper icon grid component/primitives for the main launcher grid.
- [x] Use Helper `createGameSession` close control with `closeControl: { variant: "icon", icon: "actions.close" }`.
- [x] Use Helper game action buttons/groups for module-backed game commands.
- [x] Use Helper `ui.game.objects` for reusable canvas object behavior in Memory Cards.
- [x] Document Helper registry keys and primitives used in root `README.md`.
- [x] Document any Helper gaps in `docs/helper-ui-gap-proposals.md`.

## 3. App Configuration and Policy

- [x] Define `enabled`, `mode`, category toggles, landing URL, hotline URL, and emergency message in `config/games.php`.
- [x] Define registry entries for all version 1 games.
- [x] Include required registry metadata: category, subcategory, enabled flag, order, tags, estimated minutes, learning value, content rating, emergency priority, touch/keyboard metadata, orientation preference, icon identifier, and mode visibility.
- [x] Implement registry loading and normalization in `GameRegistry.php`.
- [x] Implement category filtering and sorting in `GameRegistry.php`.
- [x] Implement mode/category visibility rules in `ModePolicy.php`.
- [x] Ensure one shared policy path is used by homepage and `health.php`.
- [x] Add registry metadata for dynamic game modules, game styles, and preloadable local assets.
- [x] Add registry metadata for game orientation preference: `any`, `portrait`, or `landscape`.
- [x] Add registry support for launch splash metadata and optional bitmap launcher icons.

## 4. Homepage

- [x] Build a simple shell with a fixed Helper navbar.
- [x] Build the main body as a fixed, responsive Helper icon grid.
- [x] Render game entries as compact launcher tiles instead of large marketing cards.
- [x] Render title: `PBB Games Corner`.
- [x] Render subtitle: `Local games and learning activities available on this PBB network`.
- [x] Remove hub/network status strip from the launcher.
- [x] Render current app mode display.
- [x] Remove emergency-priority notice from the launcher.
- [x] Render category tabs: All games, Quick Games, Learning Games, Retro Corner, Local / Barangay Games.
- [x] Render game cards from `config/games.registry.php`.
- [x] Add simple local search/filter by title and tag.
- [x] Add empty state for categories with no visible enabled games.
- [x] Add `Back to PBB Landing` control.
- [x] Confirm homepage has no hardcoded game cards.
- [x] Confirm homepage works without internet access.
- [x] Implement registry-driven dynamic loader for module-backed games.
- [x] Create one active Helper `createGameSession` at a time from launcher selection.
- [x] Show Helper `createBusyOverlay` while game module styles/assets/scripts are loading.
- [x] Validate required game module contract: `mountGame(session, options)` returning a controller with `start()` and `destroy()`.
- [x] Lock mobile orientation from registry preference when supported by the browser.
- [x] Create the game session overlay before fullscreen, orientation lock, busy loading, and module mounting.
- [x] Render a standardized launch splash with Start control before active gameplay begins.
- [x] Add registry launch metadata for start label, objective, controls summary, and optional local splash image.
- [x] Remove the launch splash before gameplay starts and show a centered `3, 2, 1` countdown.
- [x] Retry registry orientation lock from the Start button user gesture.

## 5. Quick Games

- [x] Implement Snake at `games/snake/index.php`.
- [x] Implement Memory Cards at `games/memory/index.php`.
- [x] Implement Breakout at `games/breakout/index.php`.
- [x] Implement Tetris at `games/tetris/index.php`.
- [x] Implement Supply Run at `games/pacman/index.php` with internal id/path `pacman`.
- [x] Implement Sector Wing at `games/sector-wing/index.php`.
- [x] Move Snake runtime into `games/snake/module.js`.
- [x] Move Memory Cards runtime into `games/memory/module.js`.
- [x] Move Breakout runtime into `games/breakout/module.js`.
- [x] Implement Tetris runtime in `games/tetris/module.js`.
- [x] Implement Supply Run runtime in `games/pacman/module.js`.
- [x] Implement Sector Wing runtime in `games/sector-wing/module.js`.
- [x] Keep direct game pages working through the same module contract.
- [x] Add keyboard controls where useful.
- [x] Add touch controls where useful.
- [x] Use Helper ghost virtual joystick for Snake movement.
- [x] Use Helper object layer, pointer router, and flip-card behavior for Memory Cards.
- [x] Add official local Snake splash asset and local Snake launcher icon asset.
- [x] Make Breakout stage geometry responsive to the live canvas size.
- [x] Remove Breakout joystick/D-pad and use direct touch/drag paddle control on small screens.
- [x] Show Snake score and Breakout remaining-block count in the top-center HUD position.
- [x] Use Helper `createTetromino` and mobile-first Helper controls for Tetris.
- [x] Use Helper grid movement/pathing and central patrol base behavior for Supply Run.
- [x] Keep Supply Run user-facing title while preserving internal id/path `pacman`.
- [x] Add declarative mission levels, active-level tuning, route-clear transition, and level progression for Supply Run.
- [x] Add Sector Wing side-scrolling route play, lives, shield, energy, enemy waves, guardian encounter, and route-clear flow.
- [x] Add `Back to Games Corner` control on each game page.
- [x] Add `Back to PBB Landing` control on each game page.
- [x] Avoid sound by default.
- [x] Avoid score persistence and analytics.

## 5A. V2 Experience Upgrades

- [x] Create and merge `docs/tetris-experience-v2-proposal.md`.
- [x] Upgrade Tetris with right-side Next/Lines/Level layout, large score HUD, improved line-clear feedback, level-up effects, and game-over overlay cleanup.
- [x] Create and merge `docs/snake-v2-upgrade-proposal.md`.
- [x] Upgrade Snake with declarative levels, supply-based progression, compact `Score N Lv N` HUD, pickup effects, and level-up feedback.
- [x] Create and merge `docs/supply-run-v2-upgrade-proposal.md`.
- [x] Upgrade Supply Run with declarative mission levels, active-level tuning, HUD updates, and route-clear level progression.
- [x] Create and merge `docs/sector-wing-v2-upgrade-proposal.md`.
- [x] Upgrade Sector Wing with combat feedback, enemy archetypes, route progress, temporary power-ups, guardian health, and route-clear/game-over state flows.
- [x] Create `docs/supply-shuffle-game-proposal.md`.
- [ ] Upgrade Memory Cards to v2 from `docs/memory-experience-v2-proposal.md`.
- [ ] Upgrade Breakout to v2 from `docs/breakout-experience-v2-proposal.md`.
- [x] Implement Survival from `docs/supply-shuffle-game-proposal.md`.

## 6. Learning Games

- [x] Implement Emergency Kit Quiz at `games/emergency-kit-quiz/index.php`.
- [x] Implement First Aid Matching Game at `games/first-aid-matching/index.php`.
- [x] Implement Barangay Hazard Awareness Quiz at `games/hazard-awareness/index.php`.
- [x] Keep content general, useful, and non-alarming.
- [x] Add completion feedback without storing results.
- [x] Add `Back to Games Corner` control on each game page.
- [x] Add `Back to PBB Landing` control on each game page.
- [x] Ensure all content is local and rights-safe.

## 7. Placeholder Areas

- [x] Create Retro Corner placeholder page at `retro/index.php`.
- [x] Create `retro/README.md` with legal warning.
- [x] Create `retro/roms/README.md` with legal warning.
- [x] Ensure no ROMs, BIOS files, commercial games, copyrighted sprites, or copyrighted music are bundled.
- [x] Create disabled Local / Barangay Games registry placeholder.
- [x] Ensure disabled Local / Barangay Games do not appear as playable cards.

## 8. Health Endpoint and Manifest

- [x] Return valid JSON from `health.php`.
- [x] Include `app`, `status`, `enabled`, `mode`, `version`, `games_total`, `games_visible`, and `categories`.
- [x] Compute totals from registry and mode policy.
- [x] Set `Content-Type: application/json`.
- [x] Create `manifest.json` with local/offline-safe metadata.
- [x] Add manifest `orientation` hint for installed PWA landscape behavior.
- [x] Avoid external icons or external PWA assets.

## 9. Documentation

- [x] Write root `README.md`.
- [x] Include app overview and PBB positioning.
- [x] Include install path and local URL.
- [x] Include No Docker, no database, offline/LAN notes.
- [x] Include emergency mode behavior.
- [x] Include games registry behavior.
- [x] Include `## Helper UI Usage`.
- [x] Include Landing / Kit Setup registration note.
- [x] Include legal content warning.
- [x] Include health endpoint note.
- [x] Include acceptance test checklist.
- [x] Create `docs/helper-ui-gap-proposals.md`.
- [x] Create `docs/landing-registry.md`.
- [x] Create `docs/helper-game-feedback-primitives-proposal.md`.
- [x] Keep this proposal and checklist updated as scope changes.

## 10. Visual and UX Checks

- [x] Confirm Helper dark theme is the default and only required version 1 theme.
- [x] Confirm fixed top navbar remains usable on mobile and desktop.
- [x] Confirm fixed icon grid remains stable on mobile and desktop.
- [x] Confirm navbar and icon grid use Helper components/primitives rather than app-local replacements.
- [x] Confirm UI feels civic, calm, readable, and official.
- [x] Avoid neon arcade styling in the app shell; game-specific generated assets may use controlled neon accents.
- [x] Avoid oversized marketing hero sections.
- [x] Avoid large marketing cards for the homepage launcher.
- [x] Avoid decorative gradient blobs.
- [x] Avoid third-party UI frameworks.
- [x] Confirm mobile layout is usable.
- [x] Confirm text does not overlap on mobile or desktop.
- [x] Confirm game controls have stable dimensions and do not shift layout.
- [x] Confirm module-backed game HUD uses lightweight top-left title and top-center score/progress.
- [x] Confirm terminal states such as Game Over are shown as overlays instead of HUD text.
- [x] Confirm Breakout paddle can be controlled by touch/drag on small screens.
- [x] Confirm Memory Cards canvas flip-card selection updates the moves counter.
- [x] Confirm launch countdown appears after the splash is removed.

## 11. Offline and Network Checks

- [x] Confirm no CDN URLs are referenced.
- [x] Confirm no external JS, CSS, font, image, icon, audio, or game asset is requested.
- [x] Confirm browser dev tools show no external network requests.
- [x] Confirm all game pages run locally under Apache/PHP.
- [x] Confirm app remains usable when internet is unavailable but LAN is working.

## 12. Mode and Registry Acceptance Tests

- [x] Set `mode=normal` and verify all enabled, allowed games appear.
- [x] Set `mode=monitoring` and verify games appear with caution banner.
- [x] Set `mode=active_incident` and verify Quick Games and Retro Corner are hidden.
- [x] Set `mode=emergency` and verify all games are disabled.
- [x] Set one game `enabled=false` and verify it disappears.
- [x] Remove or disable all games from one category and verify empty state appears.
- [x] Confirm `health.php` reports current mode.
- [x] Confirm `health.php` reports correct visible game count.

## 13. Final Verification

- [x] Open `https://games.pbb.ph` and confirm homepage loads.
- [ ] Open fallback path if configured: `https://pbb.ph/games`.
- [x] Open each Quick Game and confirm it is playable.
- [x] Confirm disabled Learning Game registry entries stay hidden in the launcher until re-enabled.
- [x] Confirm every game has navigation back to Games Corner and PBB Landing.
- [x] Confirm README documents Helper UI usage and registry behavior.
- [x] Confirm Landing registry metadata is documented.
- [x] Confirm no prohibited assets are bundled.
- [x] Confirm no database files, migrations, credentials, or operational API integrations were added.
