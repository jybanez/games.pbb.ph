# Pac-Man Quick Game Proposal

## Summary

Add a Pac-Man-style quick game to PBB Games Corner after Helper ships the grid primitives. The game should be original in presentation and assets while using familiar maze-chase mechanics: move through a maze, collect supplies, avoid patrols, use power supplies for short advantage windows, and clear the board.

The implementation should follow the current module-backed quick-game pattern:

- registry entry in `config/games.registry.php`
- route at `games/pacman/index.php`
- runtime at `games/pacman/module.js`
- local splash, home, and launcher icon assets
- Helper `createGameSession` owned by the launcher
- game module returns `start`, `pause`, `resume`, `restart`, and `destroy`
- game module emits `options.onStateChange(...)`

## Product Fit

Pac-Man gives the quick-games set a classic maze game that is immediately understandable on mobile. It also proves whether Helper's proposed `ui.game.grid` primitives are broad enough for future grid games.

Recommended theme: barangay supply run.

- Player: responder/supply runner marker
- Pellets: small supply markers
- Power pellets: emergency kit boosts
- Ghosts: hazards, blockers, or patrol markers
- Maze: original PBB-styled route network

Avoid any copyrighted Pac-Man maze, sprites, character names, audio, or brand references in shipped assets.

## Helper Dependencies

Use Helper grid primitives once available:

- `createGridMaze`
- `createGridMover`
- `createGridPathfinder`

Use app-local equivalents temporarily only if implementation starts before Helper V1 lands. Keep app-local function names and data shapes close to the expected Helper APIs so replacement is mechanical.

Later Helper candidates:

- `createCollectibleLayer` for pellets, power pellets, and bonus items
- `createSpriteAnimator` for player, patrol, frightened, and score effects

## Ownership Boundary

Helper should own:

- tile map parsing and cell metadata
- wall/path checks
- grid-to-pixel and pixel-to-grid conversion
- queued grid movement and turn-at-center behavior
- cardinal pathfinding over passable cells

Games should own:

- game title, theme, assets, and original level layout
- score, lives, power mode, win/loss rules
- patrol behavior state machine
- difficulty tuning
- sounds and result messages
- mobile control composition

## Game Rules

Initial V1:

- One maze layout.
- Player starts at a named spawn.
- Four patrols start from the central patrol base.
- Collect all supply dots to win.
- Contact with a patrol while not powered costs one life.
- Contact with a patrol while powered returns the patrol to spawn and awards bonus score.
- Power supplies activate a short timer.
- Game ends when all lives are lost.

Recommended score model:

- supply dot: 10
- power supply: 50
- powered patrol catch: 100, increasing per catch in one power window if simple to implement
- bonus item: deferred

Recommended lives:

- Start with 3.
- Brief respawn delay after losing a life.
- Preserve collected dots after life loss.

## Maze Data

Keep the maze as readable local data inside `games/pacman/module.js` or a small adjacent data module if it becomes large.

Example shape:

```js
const map = [
  "###################",
  "#P....#.....#....G#",
  "#.###.#.###.#.###.#",
  "#o...............o#",
  "###################",
];
```

Suggested tile symbols:

- `#`: wall
- `.`: path with supply
- `o`: path with power supply
- `P`: player spawn
- `G`: patrol spawn inside the central base
- `B`: central base floor
- `D`: central base gate
- space: empty path
- `T`: tunnel or portal endpoint if needed

## Controls

Mobile is the primary target.

Recommended controls:

- Use Helper `createTouchControlPad` with `visibility: "overlay"` for up/down/left/right.
- Queue the next direction immediately when tapped.
- Movement turns only when the mover reaches a legal cell center.
- Support swipe on the stage as an optional enhancement after basic controls are stable.

Keyboard support:

- Arrow keys set queued direction.
- `P` routes to `options.requestPause?.()` like Tetris.

Avoid a virtual joystick for V1. Pac-Man movement is discrete and direction-queue based, so a D-pad is clearer than analog input.

## Rendering

Use one canvas layer through `session.addLayer({ id: "pacman-board", zIndex: 1, smoothing: false })`.

Layout requirements:

- Derive cell size from live canvas dimensions.
- Keep the full maze visible in portrait mobile.
- Reserve top space for the HUD and bottom space for controls.
- Center the maze horizontally.
- Do not require landscape; Pac-Man should target portrait or `any` orientation unless testing proves portrait is cramped.

Draw order:

1. background texture
2. maze walls and paths
3. collectibles
4. bonus or power indicators
5. patrols
6. player
7. temporary score/effect markers

## State And HUD

HUD should match existing quick games:

- title pill on the top-left through local shell
- top-center score badge
- optional compact lives indicator in the score badge

Example score text:

```text
Score 1240  Lives 2
```

Lifecycle:

- `reset()` calls `options.onStateChange?.("playing")`
- win calls `options.onStateChange?.("won", { title: "Route Cleared", detail: "Score 1240" })`
- game over calls `options.onStateChange?.("gameOver", { detail: "Score 1240" })`

## Implementation Plan

1. Add registry entry and files for `pacman`.
2. Add local assets: `splash.png`, `home.png`, and `icon.png`.
3. Implement static maze render and responsive layout.
4. Wire `createGridMaze` and `createGridMover`.
5. Add player movement with mobile D-pad and keyboard.
6. Add collectible setup and scoring, app-local first if Helper V1.1 is not ready.
7. Add patrols using `createGridPathfinder` for basic chase/scatter decisions.
8. Add power mode and life/respawn flow.
9. Add simple app-local animation shaped like `createSpriteAnimator`.
10. Test mobile portrait, mobile landscape, and desktop.

## Acceptance Criteria

- Game launches from Games Corner with splash and countdown.
- It is playable with touch controls on a phone.
- Maze fits without important UI overlap.
- Direction queueing feels responsive.
- Player cannot enter walls.
- Patrols navigate passable cells only.
- Collectibles update score and win state.
- Pause, resume, restart, close, and game-over overlays work.
- No external network requests.
- No copyrighted Pac-Man assets, names, or layouts are bundled.

## Open Questions

- Should the registry orientation be `portrait` or `any` after first mobile layout testing?
- Four patrols are now the V1 target after the central base and return routing stabilized.
- Should power mode be included in V1 or added immediately after the core loop works?
- Should Pac-Man ship with app-local collectible/animator helpers first, or wait for Helper V1.1?
