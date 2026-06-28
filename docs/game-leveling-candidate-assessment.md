# Game Leveling Candidate Assessment

Date: 2026-06-26

This assessment identifies where PBB Games can apply leveling first so the leveling standard can be tested against real game shapes before it becomes a wider contract.

The existing standardization proposal remains the source of truth for concepts and policy:

- `docs/game-leveling-standardization-proposal.md`

## Current Constraints

- Keep leveling out of the base game registry for now.
- Keep level definitions local to each game module or game directory.
- Keep version 1 session-only. Do not add player progress persistence until explicitly approved.
- Emit progress metadata separately from lifecycle state.
- Do not ask Helper to own leveling rules. Helper may later display progress or milestone chrome.

The existing launcher bridge currently passes `onStateChange`, `requestPause`, game metadata, Helper modules, and sound into each game module. It does not yet pass `onProgress` or `onMilestone`.

## Recommended Prototype Order

### 1. Tetris

Best first candidate.

Why:

- Already has `score`, `lines`, and `level`.
- Already computes level from lines: `Math.floor(lines / 10) + 1`.
- Already tunes difficulty from level through drop interval.
- HUD already displays `Score`, `Lines`, and `Lv`.

What it can validate:

- The normalized `progress:update` shape.
- Endless leveling.
- Level change milestones.
- Progress target such as `Lines 7/10`.
- HUD/result overlay consistency without changing gameplay.

Suggested level shape:

```js
{
  gameId: "tetris",
  scheme: "endless",
  level,
  levelId: `classic-${level}`,
  levelName: `Level ${level}`,
  difficulty: level <= 2 ? "easy" : level <= 5 ? "normal" : "hard",
  objective: "Clear complete lines",
  score,
  progressCurrent: lines % 10,
  progressTarget: 10,
  progressLabel: `Lines ${lines % 10}/10`,
  stats: { lines }
}
```

Minimum implementation:

- Add a local `getProgress()` helper.
- Call `options.onProgress?.({ type: "progress:update", progress: getProgress() })` from `syncScore()`.
- Detect level changes in `applyLineScore()` and emit `options.onMilestone?.({ type: "level:start", progress: getProgress(), title: "Level Up", detail: `Level ${level}` })`.

### 2. Memory Cards

Best declarative fixed-level candidate.

Why:

- Current level is implicitly a fixed 3x4 board with 6 pairs.
- The module already tracks `matches` and `moves`.
- It has a clean win condition: all pairs matched.
- It is low-risk because there is no continuous physics tuning.

What it can validate:

- Declarative level definitions for board size and symbol set.
- Fixed or curriculum-style levels.
- Progress based on matched pairs.
- Result quality metrics such as moves.

Suggested level definition:

```js
const LEVELS = [
  {
    id: "memory-3x4-basic-kit",
    number: 1,
    title: "Basic Kit",
    difficulty: "easy",
    objective: "Match 6 pairs",
    layout: { columns: 4, rows: 3 },
    symbols: ["W", "R", "K", "F", "M", "L"],
    target: { pairs: 6 }
  }
];
```

Minimum implementation:

- Replace the hard-coded doubled `symbols` array with a selected level definition.
- Keep rendering behavior unchanged.
- Emit progress after each move/match.

### 3. Breakout

Best declarative stage-layout candidate.

Why:

- Current stage is a generated brick grid.
- It already has a clear objective: clear all blocks.
- It already exposes remaining blocks in the HUD.
- Tuning values such as ball speed, columns, rows, and paddle width are already centralized in `getMetrics()`.

What it can validate:

- Fixed stage definitions.
- Brick pattern declarations.
- Tuning applied from level data.
- Stage complete milestone and next-stage transition later.

Suggested level definition:

```js
const LEVELS = [
  {
    id: "breakout-signal-wall-1",
    number: 1,
    title: "Signal Wall",
    difficulty: "easy",
    objective: "Clear all blocks",
    layout: {
      type: "brickGrid",
      rows: 4,
      columns: 8,
      pattern: [
        "BBBBBBBB",
        "BBBBBBBB",
        "BBBBBBBB",
        "BBBBBBBB"
      ]
    },
    tuning: {
      ballSpeedScale: 1,
      paddleWidthScale: 1
    },
    winCondition: { type: "clearAll" }
  }
];
```

Minimum implementation:

- Keep one current level but build blocks from level data.
- Emit progress using remaining/total blocks.
- Defer multi-stage advancement until the event shape is proven.

### 4. Snake

Good endless leveling candidate after Tetris.

Why:

- Current score and food count are simple.
- Bonus food already appears every 5 normal foods.
- Movement speed is currently fixed at `0.135` seconds per tick.

What it can validate:

- Endless score/food-based leveling.
- Speed tuning as level increases.
- Bonus milestone timing.

Risks:

- Speed changes affect mobile control feel quickly.
- Snake should not become frustrating while the input model is still being tuned.

Suggested approach:

- Level every 5 collected supplies or every score threshold.
- Replace the fixed tick interval with `getTickInterval()`.
- Cap speed increases conservatively.

### 5. Supply Run

Best later candidate, not first.

Why:

- It is the richest game shape: maze map, supply collectibles, power kits, lives, patrol phases, patrol pathing, and win/loss.
- It can validate route/maze level definitions once simpler games prove the contract.

What it can validate later:

- Declarative maze routes.
- Patrol tuning per level.
- Collectible distribution.
- Lives and objective progress.
- Multi-stage route progression.

Risks:

- The level schema could become too game-specific if introduced before simpler schemas are tested.
- Changing route definitions touches pathing, rendering, and gameplay balance at the same time.

Suggested approach:

- First emit progress metadata only: supplies collected, supplies total, lives, score.
- Add declarative maze levels only after Tetris, Memory, and Breakout validate the event and definition approach.

## Learning Games

The current learning entries are mostly static or placeholder-style game pages. They should not drive the first leveling standard.

Reason:

- The product direction is that learning games should be fun games designed around learning outcomes, not basic quiz screens with level wrappers.
- For now, quick games give better coverage of progression mechanics without prematurely locking the learning-game structure.

## Minimal App Contract To Prototype

Add these callbacks to the launcher bridge when mounting a game:

```js
onProgress(event) {
  // Store latest session progress and optionally update home/HUD/result views.
}

onMilestone(event) {
  // Show or log level complete / level up moments.
}
```

Recommended event forms:

```js
options.onProgress?.({
  type: "progress:update",
  progress: getProgress()
});

options.onMilestone?.({
  type: "level:start",
  progress: getProgress(),
  title: "Level Up",
  detail: "Level 2"
});
```

Keep callback handling app-owned and lightweight. Do not add persistence, analytics, or rewards during the first prototype.

## Recommended First Implementation Slice

1. Add `onProgress` and `onMilestone` support in the launcher bridge.
2. Implement Tetris progress events without changing gameplay.
3. Add a small progress debug/log surface only if needed for testing.
4. Implement Memory level definition and progress events.
5. Implement Breakout level definition and progress events.
6. Revisit the standardization proposal after the three different schemes are exercised:
   - Tetris: endless
   - Memory: fixed/curriculum-style
   - Breakout: fixed stage layout

## Open Decisions

- Should level definitions stay inside `module.js`, or move to `games/<game-id>/levels.js` once a game has more than one level?
- Should `onProgress` update the top HUD directly, or only record latest progress and let games keep HUD ownership for now?
- Should milestone overlays be app-owned now, or deferred until after progress events stabilize?
- What exact values should home pages show from progress before persistence exists?
