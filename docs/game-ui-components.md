# PBB Game UI Components

This document defines the reusable game UI layer for PBB Games Corner. These components are app-local for now. They should only become Helper UI proposals if the same patterns are needed by other PBB citizen apps.

## Boundaries

- Helper UI owns the civic shell primitives: buttons, badges, panels, fields, notices, tabs, navbar, icon grid, empty states, busy overlays, game sessions, game loops, game layers, close controls, virtual joysticks, touch controls, game action buttons, canvas object layers, pointer routing, and flip-card behavior.
- Games Corner owns game-specific surfaces: canvas stage content, launch splash styling, countdown styling, quiz choices, game HUD content, card art, match rules, scoring, and lifecycle glue.
- External game libraries are optional future dependencies. They must be vendored locally and used only by games that need them.

## PHP Shell

`src/GamePage.php` provides the shared game page wrapper.

Expected responsibilities:

- Load the vendored Helper CSS and app CSS.
- Set `data-theme="dark"`.
- Set `body[data-game]` for JavaScript bootstrapping.
- Render the repeated game header.
- Render `Back to Games Corner` and `Back to PBB Landing` controls.
- Read `landing_url` from `config/games.php`.

Game pages should provide only their game content inside the shared shell.

## Session HUD

Module-backed canvas games use the Helper game session overlay plus a light app-local HUD row. The title is a compact top-left pill. Scores or progress counters are top-center pills using `.pbb-game-session-score`. Avoid app-panel/card styling for HUD chrome.

```html
<div class="pbb-game-session-ui">
    <div class="pbb-game-session-hud">
        <p class="pbb-game-session-title">Snake</p>
    </div>
    <p class="ui-badge pbb-game-session-score">Score 0</p>
    <div class="pbb-game-session-movement-controls"></div>
    <div class="pbb-game-session-actions"></div>
</div>
```

Game Over, Cleared, and similar terminal states should be shown as centered overlays, not as persistent HUD text.

## Canvas Stage

Module-backed canvas games should create layers through `createGameSession(...).addLayer(...)`. Game code should read live layer canvas dimensions and derive gameplay positions from those dimensions. Avoid fixed desktop coordinates for ball, paddle, food, or block placement.

The session viewport should disable browser gesture interference when direct touch gameplay is used. Breakout sets `touchAction = "none"` while mounted because touch/dragging the paddle is the primary mobile control.

## Controls

Use Helper game controls where on-screen controls are appropriate:

- `createVirtualJoystick({ visibility: "ghost" })` for analog/directional movement, as used by Snake.
- `createGameActionButton(...)` or `createGameActionButtonGroup(...)` for Pause, Restart, and similar commands.
- Direct pointer/touch interaction when it is the natural control, as used by Breakout's drag paddle. Do not add a D-pad or joystick when drag is more ergonomic.

Place movement controls on the lower-left of the viewport and action controls on the lower-right. Use Helper visibility options such as `ghost` or `overlay` instead of app-local opacity rules where practical.

## Card and Choice Grids

Canvas memory/reveal-card games should use Helper `ui.game.objects`:

- `createGameObjectLayer()` for the canvas entity collection.
- `createPointerInputRouter(canvas, objectLayer)` for pointer hit routing.
- `createFlipCard()` for reveal/hide/matched card behavior.

Game modules still own deck generation, selected-card rules, match/miss checks, scoring, completion state, and `renderFront` / `renderBack` artwork.

DOM games should reuse:

- `.pbb-choice-grid` for quiz choices.
- `.pbb-match-grid` for two-column matching games.

Buttons should keep Helper button classes where the control is a normal command, and app-local classes where the control is a game tile.

## JavaScript Helpers

`assets/js/game-utils.js` contains small reusable utilities:

- `bindDirection(callback)`
- `bindDirectionButtons(callback)`
- `shuffle(items)`
- `clamp(value, min, max)`
- `getGameStatus(initialText)`

Module-backed games must export `mountGame(session, options)`. Mounting prepares the game UI, controls, canvas layers, and event handlers, but must not start active gameplay. It must return a controller with:

```js
{
    start() {},
    destroy() {},
    pause() {},
    resume() {}
}
```

Only `start()` begins the active loop or gameplay. Games Center owns the standardized launch flow: create the game session overlay, request fullscreen on mobile browsers only, apply the registry orientation when supported, show a busy overlay while local styles/assets/modules load, mount the game, then render a launch splash with a Start button. Pressing Start removes the splash, shows a `3, 2, 1` countdown over the stage, and only then calls `start()`.

Game-specific logic for module-backed games belongs in each game directory, for example `games/snake/module.js` and `games/breakout/module.js`. Older simple pages may still use `assets/js/games.js` until they are migrated.

## Future Library Trigger

Consider a local game library only when a specific game needs at least two of these:

- scene transitions or camera movement
- sprite animation pipelines
- many moving entities
- collision systems beyond simple rectangle checks
- particle effects or rich visual feedback
- asset preloading and lifecycle management

Recommended future order:

1. Vanilla Canvas with the local game UI layer.
2. Phaser for complete 2D games.
3. PixiJS for richer rendering without a full game framework.
4. Matter.js for physics-heavy games.
