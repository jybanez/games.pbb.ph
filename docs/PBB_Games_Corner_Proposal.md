# PBB Games Corner Proposal

## Summary

PBB Games Corner is a new optional citizen engagement app for Project Bantay Bayan local nodes. It provides lightweight offline games and emergency-preparedness learning activities for citizens connected to the local PBB network.

The app is intentionally outside core emergency operations. It must be easy to disable, must not call operational app APIs in version 1, and must remain safe to remove or hide during incidents.

## Goals

- Give citizens a normal-day reason to connect to the local PBB hub.
- Provide simple, local, rights-safe games that work fully offline on LAN.
- Include learning activities related to emergency preparedness, public safety, and civic awareness.
- Look and feel like an official PBB module through Helper UI usage and a restrained dark operational theme.
- Keep implementation simple: PHP, HTML, CSS, and JavaScript under WAMP/Apache.
- Avoid any database dependency for version 1.
- Make emergency disablement and mode-based visibility clear and testable.

## Non-Goals

- No emergency dispatch, reporting, SITREP, support request, realtime, map, or relay workflow.
- No login, player profiles, score storage, analytics, or personal data collection.
- No calls to Hotline, Relay, Support System, Realtime, Hub/HQ, Maestro, MapServer, or Kit Setup APIs in version 1.
- No Docker, build system, framework dependency, external CDN, or internet call.
- No commercial ROMs, BIOS files, copyrighted game art, copyrighted music, or unlicensed third-party game content.
- No live self-registration into Landing. Kit Setup and Landing own actual app registration.

## Deployment Target

- Local path: `C:\wamp64\www\pbb\games`
- Preferred URL: `https://games.pbb.ph`
- Fallback URL: `https://pbb.ph/games`
- Runtime: WAMP / Apache / PHP local node
- Database: none
- Internet requirement: none after installation

## Ecosystem Fit

The shared PBB documentation describes a Windows/WAMP local-node ecosystem where:

- Landing is the local launcher and Kit-managed app registry surface.
- Helper is the shared static UI library.
- Kit Setup owns install/update/service wiring.
- Hotline, Relay, Support, Realtime, MapServer, Hub/HQ, and Maestro are operational or infrastructure apps with stricter data and security boundaries.

Games Corner should behave as a low-priority optional citizen app. It may be listed by Landing after Kit Setup registers it, but it should not own Landing registry writes.

## Agreed Decisions

- Vendor the Helper UI bundle locally inside Games Corner.
- Prefer the bundled Helper UI library path over direct Helper source imports.
- Use the Helper library dark theme as the required version 1 theme.
- Use Helper UI for shared shell, buttons, badges, panels, notices, tabs, empty states, and other standard UI surfaces where practical.
- Keep the homepage layout simple: fixed Helper navbar on top and a fixed Helper icon grid as the main body.
- Use local CSS/canvas/DOM for game-specific visuals and controls.
- Treat "no external assets" as no runtime dependency on internet, CDN, or remote files.
- Allow local assets only if they are original, generated, public-domain, open-source, or properly licensed.
- Defer install bundle metadata until the app is ready for Kit Setup packaging.
- Defer hardening of server-side emergency disablement if needed, but keep mode configuration and visibility behavior in version 1.
- Document Landing / Kit Setup registry metadata, but do not perform live self-registration.

## Helper UI Integration

Games Corner should vendor Helper from:

```text
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.js
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.css
```

The app should place the vendored files under a local path such as:

```text
assets/helper/helpers.ui.bundle.min.js
assets/helper/helpers.ui.bundle.min.css
```

The app should prefer the vendored bundle at runtime. Direct imports from Helper source modules should be avoided unless a specific bundled component is unavailable and the gap is documented.

The app should use the Helper dark theme as the only required version 1 theme. App-local color rules should extend Helper tokens/classes rather than introducing a separate visual system.

The README must include a `## Helper UI Usage` section documenting:

- Helper source path and bundle files used.
- Helper primitives/classes used.
- Any Helper registry keys used.
- Remaining app-local CSS and why it exists.
- Proposed Helper gaps, if any.
- How to refresh the vendored Helper bundle later.

## Layout Model

Version 1 should use a deliberately simple app shell:

- Fixed top navigation using the Helper navbar component/primitives.
- Main body as a fixed, responsive Helper icon grid component/primitives.
- Game entries should appear as compact launcher tiles, not large marketing cards.
- Category filters may be represented as simple navbar controls, segmented controls, or compact tabs.
- The layout should stay dense, readable, and stable on mobile and desktop.
- Avoid oversized hero sections, decorative page bands, or nested card-heavy layouts.
- App-local CSS should only pin/size/space the Helper navbar and Helper icon grid where the shared component API does not directly cover the Games Corner shell.

## Version 1 Game Set

Quick Games:

- Snake
- Memory Cards
- Breakout
- Tetris

Learning Games:

- Emergency Kit Quiz
- First Aid Matching Game
- Barangay Hazard Awareness Quiz

Placeholders:

- Retro Corner, with legal warning and no ROMs.
- Local / Barangay Games, disabled by default until local content exists.

## Game Session and Launch Model

Module-backed games should be launched through the registry and a single active Helper game session. The launcher creates the session overlay, requests fullscreen only on mobile browsers, applies the registry orientation preference where supported, shows a Helper busy overlay while local assets and modules load, mounts the game module, and then renders a standardized launch splash.

The game module contract is:

```js
export async function mountGame(session, options) {
  return {
    start() {},
    destroy() {},
    pause() {},
    resume() {}
  };
}
```

Mounting prepares the game but must not start active gameplay. Pressing Start removes the splash, shows a large `3, 2, 1` countdown over the stage, then calls `start()`.

Game session chrome should stay lightweight:

- compact top-left title pill
- top-center score/progress pill where relevant
- Helper icon-only close control
- movement controls lower-left only when needed
- action controls lower-right
- terminal states such as Game Over as centered overlays

Game controls should match the game. Snake uses a Helper ghost virtual joystick. Breakout uses direct touch/drag paddle control because it is more ergonomic than a D-pad or joystick. Tetris uses Helper touch direction controls plus Helper action buttons for mobile-first discrete movement, rotation, hard drop, pause, and restart.

## Configuration Model

Version 1 should include:

```text
config/games.php
config/games.registry.php
src/GameRegistry.php
src/ModePolicy.php
```

The registry is the source of truth for game cards and metadata. The mode policy is the source of truth for mode/category visibility.

Supported modes:

- `normal`
- `monitoring`
- `active_incident`
- `emergency`

Expected behavior:

- `normal`: show all enabled games allowed by registry and config.
- `monitoring`: show allowed games with a caution banner.
- `active_incident`: hide Quick Games and Retro Corner; show allowed Learning Games.
- `emergency`: disable all games and show emergency guidance.

## Landing / Kit Setup Integration

Version 1 should provide documentation and metadata only.

Suggested metadata belongs in `docs/landing-registry.md` and should include:

```json
{
  "app_id": "pbb-games",
  "name": "PBB Games Corner",
  "category": "citizen",
  "launch_url": "https://games.pbb.ph",
  "health_url": "https://games.pbb.ph/health.php",
  "description": "Local games and emergency-preparedness learning activities",
  "emergency_priority": "low",
  "disable_during_emergency": true,
  "ui_theme": "dark",
  "uses_helper_ui": true
}
```

Future packaging can add Kit Setup bundle metadata when the app is ready to become an installable package.

## Security and Privacy

- Do not collect names, contacts, location, photos, scores, telemetry, or analytics.
- Do not write to operational app databases or storage.
- Do not expose operational secrets in browser code.
- Do not call Relay relationship resolver or any backend-only endpoint.
- Keep all game content rights-safe and locally hosted.
- Keep the app low-priority and easy to disable.

## Open Questions

- Should the app later include a `release.json` compatible with Kit Setup app bundle metadata?
- Should future versions add optional local high scores if they remain anonymous and device-local?
- Should Learning Games eventually consume barangay-specific content from a Kit-managed local file?
- Should Helper gain game-card or citizen-learning primitives if several PBB citizen apps need similar layouts?
