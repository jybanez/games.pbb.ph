# Game Leveling Standardization Proposal

## Summary

PBB Games should standardize how games describe level, difficulty, objective, and progression metadata without turning those concepts into lifecycle states.

This proposal follows the Helper state chrome counter-proposal: lifecycle state remains limited to values such as `playing`, `paused`, `won`, and `gameOver`. Leveling is app-owned progression metadata that games can expose to the launcher, HUD, overlays, audio hooks, and future Helper display components.

## Goals

- Give every game a consistent way to report progress and difficulty.
- Keep game-specific rules inside each game module.
- Prefer declarative level definitions that a game engine or shared runtime can consume and render.
- Allow Helper state chrome to display progress metadata without owning its meaning.
- Support both arcade games and learning games.
- Avoid persistence, analytics, or identity requirements in version 1.
- Create a clean foundation for later rewards, badges, and optional anonymous local progress.
- Separate player progress persistence from system metric monitoring.

## Non-Goals

- No player profiles or accounts.
- No global XP economy in version 1.
- No server-side score or progress storage.
- No competitive leaderboards.
- No operational app integration.
- No expansion of Helper lifecycle states for `level`, `wave`, `round`, or `mission`.
- No personally identifiable metric collection.
- No remote analytics in version 1.

## Definitions

- `state`: lifecycle phase such as `playing`, `paused`, `won`, or `gameOver`.
- `level`: a named or numbered segment of game progression.
- `round`: a repeatable attempt or turn group inside a level.
- `wave`: a timed or spawned challenge group inside a level.
- `difficulty`: the active challenge tuning profile.
- `objective`: the current player-facing goal.
- `progress`: numeric or descriptive completion toward an objective.
- `milestone`: a notable progression moment, such as level complete or new difficulty reached.

## Proposed Progress Shape

Each game may emit a normalized progress object:

```js
{
  gameId: "tetris",
  mode: "classic",
  scheme: "endless",
  level: 3,
  levelId: "classic-3",
  levelName: "Level 3",
  round: null,
  wave: null,
  difficulty: "normal",
  objective: "Clear complete lines",
  score: 420,
  lives: null,
  progressCurrent: 7,
  progressTarget: 10,
  progressLabel: "Lines 7/10",
  elapsedMs: 64000
}
```

Fields should be optional. Games should only report values that are meaningful.

## Leveling Schemes

Recommended schemes:

- `fixed`: a known ordered list of levels.
- `endless`: level increases as difficulty scales.
- `roundBased`: the game repeats rounds with changing objectives.
- `waveBased`: the game advances through challenge waves.
- `curriculum`: learning-game progression through topics or questions.
- `challenge`: a single scenario with pass/fail or score.

Examples:

- Tetris: `endless`, level based on cleared lines.
- Snake: `endless`, level may scale with score or speed.
- Breakout: `fixed` or `roundBased`, level based on brick layouts.
- Memory: `fixed` or `curriculum`, level based on card count/topic.
- Learning games: deferred. The product direction is that learning games should feel as fun as quick games, while being designed around learning outcomes.

## Level Definition Shape

Games should define level metadata locally in a declarative format where practical. The intent is that a game engine or shared runtime can consume the level definition and set up/render the level without hard-coding every stage in imperative code.

```js
const levels = [
  {
    id: "memory-3x4",
    number: 1,
    title: "Basic Kit",
    difficulty: "easy",
    objective: "Match 6 pairs",
    target: { pairs: 6 },
    unlocksNext: "memory-4x4"
  }
];
```

Level definitions belong in the game module or game directory. They should not be centralized until several games need shared authoring tools.

The app registry should not include leveling details for now. The registry may eventually expose broad launcher metadata only if there is a proven launcher need, but detailed level definitions should remain with the game.

## Declarative Level Requirements

A declarative level should describe what the engine needs to set up the level:

```js
{
  id: "breakout-stage-1",
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
    ballSpeed: 1,
    paddleWidth: 1
  },
  winCondition: {
    type: "clearAll"
  }
}
```

Recommended rules:

- Use plain data objects.
- Keep functions out of level definitions unless a game has no reasonable data-only alternative.
- Use stable ids for levels.
- Keep display text near the level definition.
- Keep engine-specific rendering details minimal but explicit enough to build the stage.
- Let the game engine validate definitions before starting a level.

This gives us a path where Breakout brick layouts, Memory card counts/topics, Snake speed stages, and Tetris challenge variants can be authored as data instead of scattered logic.

## Event Model

Games should emit progression events through the app-owned controller bridge:

```js
options.onProgress?.({
  type: "progress:update",
  progress
});

options.onMilestone?.({
  type: "level:complete",
  progress,
  title: "Level Complete",
  detail: "Next: Level 4"
});
```

Recommended event types:

- `progress:update`
- `level:start`
- `level:complete`
- `level:failed`
- `round:start`
- `round:complete`
- `wave:start`
- `wave:complete`
- `difficulty:change`
- `objective:change`

These events should not directly imply rewards. Rewards should be handled by a separate reward system that may listen to progression events.

## Helper Relationship

Helper should not own leveling rules. Helper may later support display and chrome APIs such as:

```js
chrome.updateProgress({
  level: 3,
  objective: "Clear 10 lines",
  progressCurrent: 7,
  progressTarget: 10,
  score: 420
});

chrome.showMilestone({
  type: "levelComplete",
  title: "Level Complete",
  detail: "Next: Level 4",
  actions: ["continue", "restart", "exit"]
});
```

Helper owns display/accessibility. PBB Games owns the meaning and timing.

## HUD Guidance

HUD should show only the most useful progression values for the game:

- Tetris: score, lines, level.
- Snake: score, optional speed/level if added.
- Breakout: blocks remaining, optional stage number.
- Memory: pairs and moves, optional level/topic.
- Learning games: deferred until their game format is clearer.

Avoid dense HUDs. Milestone overlays are better for larger explanations.

## Data Persistence Policy

Version 1 should keep leveling session-only.

Future persistence may be considered only if it is:

- local-only,
- anonymous,
- easy to clear,
- disabled during emergency mode,
- not used for operational decisions,
- documented in privacy notes.

Suggested future storage key:

```js
localStorage["pbb-games:progress:v1"]
```

No persistence should be added until the product decision is explicit.

If local persistence is later approved, keep two concepts separate:

- `progressSave`: the player/device-local progression snapshot.
- `progressEvent`: a transient in-session event used for HUD, overlays, rewards, and optional monitoring.

Suggested local progress shape:

```js
{
  version: 1,
  updatedAt: "2026-06-24T10:00:00+08:00",
  games: {
    tetris: {
      highestLevel: 5,
      bestScore: 1200,
      linesClearedBest: 32,
      lastPlayedAt: "2026-06-24T10:00:00+08:00"
    }
  }
}
```

This data should never include names, contact details, precise location, account identifiers, or operational incident identifiers.

## Metric Monitoring Policy

Metric monitoring should measure whether Games Corner is healthy and useful, not track individual players.

Allowed version 1 or future local-node metrics:

- game launch count by game id.
- game start count by game id.
- session completion count by state: `won`, `gameOver`, `exit`.
- load failure count by game id/module path.
- average asset/module load time.
- crash/error count.
- feature usage counts such as pause/resume/restart, without player identity.

Avoid:

- per-person histories.
- cross-session behavioral profiles.
- precise timestamps tied to a user.
- raw keypress/touch trails.
- leaderboard-like metrics.
- any metric sent to operational apps without explicit approval.

Recommended metric event shape:

```js
{
  type: "game:start",
  gameId: "tetris",
  sessionId: "ephemeral-random-id",
  mode: "normal",
  timestampBucket: "2026-06-24T10:00+08:00"
}
```

`sessionId` should be ephemeral and should not survive browser reloads unless a future privacy decision explicitly allows anonymous local device metrics.

For version 1, metric monitoring can remain console/log-only or disabled. If implemented later, prefer a local aggregate file or localStorage aggregate counters over raw event logs.

## Migration Plan

1. Keep current game scoring as-is.
2. Add app-local `onProgress` and `onMilestone` callbacks after Helper state chrome lands.
3. Update Tetris first because it already has `score`, `lines`, and `level`.
4. Add progress objects for Snake, Breakout, and Memory.
5. Use progress metadata for HUD/result overlays.
6. Add rewards only after progress events are stable.
7. Add local progress persistence only after explicit privacy approval.
8. Add aggregate metric monitoring separately from player progress.
9. Defer learning-game progression structure until learning games are redesigned as fun game experiences with learning goals.

## Open Questions

- Should level definitions live in `games/<id>/levels.js` for games that need them?
- Should each game type define its own declarative level schema, or should we force one shared schema for all games?
- During active play, what should the player always see: score/progress only, or score plus level/objective?
- Where should level/objective details appear: start splash, top HUD, pause screen, milestone overlay, or result overlay?
