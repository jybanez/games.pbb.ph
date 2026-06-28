# Tetris Experience V2 Proposal

## Summary

Upgrade Tetris with visual reward, progression feedback, and replay hooks so players feel stronger momentum as they clear lines and reach higher levels.

This should be considered part of **Games Experience v2**: a polish and retention layer over the existing game, not a full application version bump by itself.

## Current State

Runtime: `games/tetris/module.js`

Tetris already has the strongest leveling foundation:

- `score`
- `lines`
- `level`
- level-based drop speed through `getDropInterval()`
- score HUD showing `Score`, `Lines`, and `Lv`
- game-over overlay through Helper state chrome

The current game works, but line clears and level changes are mostly mechanical. Players do not yet get enough visual payoff for progress.

## Goals

- Make line clears feel satisfying.
- Make level-ups visible and memorable.
- Improve readability of fast play without clutter.
- Use Tetris as the first proof for progress and milestone events.
- Keep performance smooth on mobile portrait screens.
- Avoid changing core Tetris rules in this phase.

## Non-Goals

- No new game modes yet.
- No persistence or unlock storage yet.
- No leaderboard.
- No rewards economy.
- No major Helper dependency unless a missing primitive becomes obvious.

## Proposed V2 Experience

### Line Clear Feedback

Add a short visual sequence when lines clear:

- highlight cleared rows
- horizontal sweep or shimmer across the row
- brief particle or tile dissolve effect
- small sound accent through existing game audio

The line clear should resolve quickly so it does not slow gameplay.

### Level-Up Feedback

When `level` increases:

- emit a `level:start` or `difficulty:change` milestone
- show a brief center overlay such as `Level 2`
- pulse the board border or background grid
- play a stronger audio accent
- optionally brighten the active piece for a short moment

Level-up feedback should be visually louder than a line clear, but still brief.

### Landing Ghost And Placement Feedback

Add subtle help for fast play:

- ghost landing projection for the active tetromino
- short impact pulse when a piece locks
- soft-drop trail or glow when the player accelerates a piece

This improves readability and makes the game feel more polished without changing the rules.

### Home Page V2

Once progress persistence is approved, Tetris home should show:

- best score
- highest level
- most lines cleared
- last result

For now, without persistence, the home page can keep only visual richness and the `Play Now` action.

## Progress Contract

Tetris should be the first game to emit normalized progress:

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

Events:

```js
options.onProgress?.({
  type: "progress:update",
  progress: getProgress()
});

options.onMilestone?.({
  type: "level:start",
  progress: getProgress(),
  title: "Level Up",
  detail: `Level ${level}`
});
```

## Implementation Plan

1. Add local `getProgress()` and progress emission.
2. Detect level changes in `applyLineScore()`.
3. Add a lightweight line-clear animation queue.
4. Add level-up milestone overlay or app-level event handling.
5. Add lock impact pulse.
6. Add optional ghost piece.
7. Validate mobile portrait readability and performance.

## Acceptance Criteria

- Gameplay rules remain unchanged.
- Line clears have visible feedback.
- Level changes have distinct feedback.
- The HUD still remains readable.
- Animations do not hide the active piece.
- Performance stays smooth on mobile.
- Restart clears all animation state.
- Pause freezes or suppresses transient effects consistently.

## Risks

- Too much glow can make pieces hard to distinguish.
- Delaying line clear resolution can make controls feel sluggish.
- A ghost piece may confuse players if it is too bright.
- Level-up overlays can interrupt fast play if too long.

## Recommendation

Implement Tetris first as the v2 proof because it already has real levels. Keep the first slice focused on progress events, line-clear feedback, and level-up feedback before adding more advanced effects.
