# Helper Grid Maze Game Primitives Proposal

## Summary

PBB Games is preparing a Pac-Man-style quick game. Several needed pieces are reusable beyond that single game and may belong in Helper as small game primitives rather than app-local one-offs.

The goal is not for Helper to own Pac-Man, Sokoban, Bomberman, or any game-specific rules. The goal is for Helper to provide stable grid, maze, movement, collection, animation, and pathfinding primitives that multiple canvas games can share while each game keeps its own scoring, state machine, win/loss rules, level design, and theme.

## Why This Matters

Pac-Man needs grid-aligned movement, wall collision, pellets, tunnels, sprite animation, and enemy path decisions. These same concepts appear in many future quick games and learning games:

- maze escape games
- tile-based rescue route games
- Sokoban-style logistics puzzles
- Bomberman-style arena games
- dungeon crawlers
- patrol/evacuation simulations
- top-down learning maps
- collectible/scavenger games

If Games builds all of these directly inside one Pac-Man module, later games will either duplicate the logic or need a refactor. A narrow Helper primitive set would let Games build Pac-Man now while creating reusable infrastructure for future grid-based games.

## Ownership Boundary

Helper should own reusable mechanics that are not tied to a specific game brand or scoring model:

- parsing tile maps
- exposing wall/path/portal/spawn metadata
- grid-to-pixel coordinate helpers
- queued grid movement
- collision checks against a maze
- collectible storage and hit testing
- simple frame/tick sprite animation
- generic pathfinding helpers

Games should own the actual game behavior:

- Pac-Man-like rules, scoring, lives, power mode, and ghost states
- level progression and difficulty
- board layouts and themes
- win/loss decisions
- sound timing and chosen sound IDs
- persistence, rewards, and analytics policy

This matches the current Helper game-library boundary: Helper owns shared session/control/audio/chrome infrastructure; Games owns rule meaning and progression.

## Candidate Primitives

### `createGridMaze(options)`

Purpose: parse and query tile-based mazes.

Possible responsibilities:

- accept a string array, numeric matrix, or tile object matrix
- normalize rows, columns, tile size, and named tile types
- expose `isWall(row, column)`, `isPath(row, column)`, `getTile(row, column)`, `setTile(row, column, value)`
- expose `gridToPixel(row, column)`, `pixelToGrid(x, y)`, and `cellCenter(row, column)`
- expose named points such as player spawn, enemy spawns, portals, pellet origins, doors, or exits
- support wrap portals or tunnel pairs without knowing game rules
- provide `forEachCell(callback)` for rendering and setup

Possible API sketch:

```js
const maze = createGridMaze({
  map: [
    "############",
    "#P...#....G#",
    "#.##.#.##..#",
    "#....o.....#",
    "############",
  ],
  tiles: {
    "#": { type: "wall" },
    ".": { type: "path", collectible: "pellet" },
    "o": { type: "path", collectible: "power" },
    "P": { type: "path", point: "playerSpawn" },
    "G": { type: "path", point: "enemySpawn" },
  },
  cellSize: 24,
});

maze.isWall(0, 0);
maze.cellCenter(1, 1);
maze.points.playerSpawn;
```

### `createGridMover(options)`

Purpose: move an entity through a grid with queued turns and collision checks.

Possible responsibilities:

- hold current row/column and pixel position
- accept `direction` and `queuedDirection`
- move at a configured cells-per-second or pixels-per-second rate
- turn at cell centers when the queued direction is legal
- reject movement into walls via `canEnter(row, column)`
- support wrap tunnels through an app-provided `resolveExit(...)`
- expose `update(delta)`, `setDirection(direction)`, `queueDirection(direction)`, `moveTo(row, column)`, and `getState()`

Possible API sketch:

```js
const mover = createGridMover({
  row: 10,
  column: 8,
  speed: 6,
  canEnter(row, column) {
    return !maze.isWall(row, column);
  },
  resolveExit(next) {
    return maze.resolvePortal?.(next) || next;
  },
});

mover.queueDirection("left");
mover.update(delta);
```

### `createCollectibleLayer(options)`

Purpose: track pellets, coins, keys, supplies, and other grid or point collectibles.

Possible responsibilities:

- initialize collectibles from maze cells or explicit points
- support collect-by-cell or collect-by-radius
- expose `collectAt(row, column)`, `collectNear(x, y, radius)`, `remaining()`, `reset()`, and `render(ctx, renderItem?)`
- allow item metadata such as value, type, hidden, collected, or respawn

Possible API sketch:

```js
const collectibles = createCollectibleLayer({
  items: maze.collectibles,
  cellSize: maze.cellSize,
});

const collected = collectibles.collectAt(player.row, player.column);
if (collected?.type === "power") enterPowerMode();
```

### `createSpriteAnimator(options)`

Purpose: generic tick/frame animation for simple canvas sprites or sprite-like render states.

Possible responsibilities:

- track animation name, frame index, elapsed time, and loop mode
- support direction-specific animations
- expose `setAnimation(name)`, `update(delta)`, `getFrame()`, and `render(ctx, drawFrame)`
- work with sprite sheets, image arrays, or app-provided drawing callbacks

Possible API sketch:

```js
const animator = createSpriteAnimator({
  animations: {
    walkRight: { frames: [0, 1, 2, 1], fps: 12, loop: true },
    frightened: { frames: [3, 4], fps: 8, loop: true },
  },
});

animator.setAnimation("walkRight");
animator.update(delta);
animator.render(ctx, drawFrame);
```

### `createGridPathfinder(options)`

Purpose: provide reusable pathfinding primitives without owning enemy AI.

Possible responsibilities:

- breadth-first search or A* over grid neighbors
- support blocked cells through `canEnter(row, column)`
- support `findPath(start, target)`, `nextStep(start, target)`, and `distanceMap(target)`
- avoid game-specific concepts such as chase, scatter, frightened, or patrol unless passed in by the app

Possible API sketch:

```js
const pathfinder = createGridPathfinder({
  rows: maze.rows,
  columns: maze.columns,
  canEnter(row, column) {
    return !maze.isWall(row, column);
  },
});

const next = pathfinder.nextStep(enemy.cell, player.cell);
```

## Reuse Matrix

| Helper primitive | Pac-Man-style game | Sokoban | Bomberman-style game | Maze rescue | Dungeon crawler | Learning map |
| --- | --- | --- | --- | --- | --- | --- |
| `createGridMaze` | walls, tunnels, spawns | walls, targets | walls, destructible areas | routes, exits | rooms, corridors | lesson nodes |
| `createGridMover` | player/enemy movement | player movement | player/enemy movement | responder movement | character movement | avatar movement |
| `createCollectibleLayer` | pellets, power pellets | optional pickups | powerups | supplies | keys, loot | quiz tokens |
| `createSpriteAnimator` | player/ghost frames | tile effects | player/bomb effects | responder markers | character sprites | mascots/icons |
| `createGridPathfinder` | ghost targeting | hint path | enemy pathing | evacuation route | enemy AI | guided navigation |

## Recommended V1 Scope

Start with the primitives that have the highest reuse and lowest risk:

1. `createGridMaze`
2. `createGridMover`
3. `createGridPathfinder`

These three unlock most tile-based game logic while leaving collectibles and animation as simple app-local code if needed.

`createCollectibleLayer` should be V1.1 if Pac-Man and at least one other game both need it.

`createSpriteAnimator` should be V1.1 or V2 because it has more rendering-style variation. Helper can keep it generic, but the exact sprite contract should be driven by more than one game.

## Non-Goals

Helper should not provide:

- a Pac-Man engine
- Pac-Man-specific ghost personalities
- copyrighted maze layouts, sprites, sounds, or terminology
- score/life/power-mode rules
- level progression
- persistence or reward grants
- a large game asset pack

## Games Integration Strategy

Pac-Man can consume the proposed primitives like this:

```js
const { createGameLoop, createTouchControlPad } = options.helper["./ui.game.core.js"];
const { createGridMaze, createGridMover, createGridPathfinder } = options.helper["./ui.game.objects.js"];

export async function mountGame(session, options = {}) {
  const maze = createGridMaze({ map, tiles, cellSize });
  const player = createGridMover({ row, column, canEnter: mazeCanEnter });
  const ghostPath = createGridPathfinder({ rows: maze.rows, columns: maze.columns, canEnter: mazeCanEnter });

  return {
    start() {},
    pause() {},
    resume() {},
    restart() {},
    destroy() {},
  };
}
```

Games still reports lifecycle changes to the app:

```js
options.onStateChange?.("playing");
options.onStateChange?.("won", { title: "Maze Cleared", detail: `Score ${score}` });
options.onStateChange?.("gameOver", { detail: `Score ${score}` });
```

## Open Questions For Helper

- Should these live in `ui.game.objects`, or should a new `ui.game.grid` module keep tile/maze primitives separate from canvas object primitives?
- Should tile maps support only character maps in V1, or support both character maps and object matrices?
- Should `createGridMover` expose pixel positions directly, or only cell positions plus a helper conversion?
- Should pathfinding include diagonal movement options in V1, or stay cardinal-only for grid games?
- Should portal/wrap handling belong in `createGridMaze` or remain an app callback passed to `createGridMover` and pathfinding?
- Is `createCollectibleLayer` broad enough for Helper V1, or should Games prove it in Pac-Man first?

## Recommendation

Ask Helper to evaluate a small `ui.game.grid` V1 module with:

- `createGridMaze`
- `createGridMover`
- `createGridPathfinder`

This gives Pac-Man a reusable foundation without making Helper responsible for Pac-Man rules. It also creates a foundation for multiple future quick games and learning games, which is the main reason this should be considered Helper-owned rather than Pac-Man-local.
