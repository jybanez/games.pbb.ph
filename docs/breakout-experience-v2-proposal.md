# Breakout Experience V2 Proposal

## Summary

Upgrade Breakout with stronger block-hit feedback, stage identity, combo moments, and declarative stage data so clearing blocks feels more rewarding and repeatable.

This belongs to **Games Experience v2**: a retention and presentation layer over the current game rather than a full application version bump.

## Current State

Runtime: `games/breakout/module.js`

Current behavior:

- responsive canvas metrics
- direct touch or drag paddle control
- keyboard paddle control
- generated block grid
- block break effects
- ball trail
- paddle pulse
- falling wide-paddle power-up
- remaining block count in the top-center badge
- emits `won` when all blocks are cleared
- emits `gameOver` when the ball falls below the stage

Breakout already has some polish. The v2 opportunity is to make stage progress and block clearing feel more intentional.

## Goals

- Make block hits and clears more satisfying.
- Add a stage concept without changing the core rules.
- Use Breakout as the first declarative stage-layout proof.
- Keep direct paddle touch/drag as the primary mobile control.
- Keep effects readable so the ball remains easy to track.

## Non-Goals

- No multi-ball in the first v2 pass.
- No lives system in the first v2 pass.
- No persistence yet.
- No leaderboard.
- No change back to D-pad or joystick controls.

## Proposed V2 Experience

### Block Hit And Clear Polish

Improve existing effects:

- block hit flash before disappearing
- small shard or tile dissolve effect
- row clear pulse when an entire row is cleared
- final-block slow pulse or emphasis
- stronger stage-clear celebration

Effects should never obscure the ball path for more than a moment.

### Combo And Streak Feedback

Add lightweight combo feedback:

- count consecutive block hits before paddle contact
- show a small combo badge near the score HUD
- play a brighter sound for higher combo thresholds
- reset combo when the ball touches the paddle or is lost

Suggested thresholds:

- 3 hits: small glow
- 5 hits: stronger flash
- 8 hits: short milestone text

This gives arcade players a reason to keep improving even before rewards exist.

### Declarative Stage Definition

Breakout should move from generated blocks to a local stage definition:

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
      paddleWidthScale: 1,
      powerupChance: 0.18
    },
    winCondition: { type: "clearAll" }
  }
];
```

The first pass can still use one level. Later stages can vary patterns, power-up chance, speed, and paddle width.

### Home Page V2

Future persistent stats can include:

- best stage cleared
- best combo
- fastest clear
- total blocks cleared

Do not add these until persistence is approved.

## Progress Contract

Suggested progress object:

```js
{
  gameId: "breakout",
  scheme: "fixed",
  level: currentLevel.number,
  levelId: currentLevel.id,
  levelName: currentLevel.title,
  difficulty: currentLevel.difficulty,
  objective: currentLevel.objective,
  progressCurrent: clearedBlocks,
  progressTarget: totalBlocks,
  progressLabel: `Blocks ${clearedBlocks}/${totalBlocks}`,
  stats: {
    remainingBlocks,
    combo
  }
}
```

Events:

```js
options.onProgress?.({
  type: "progress:update",
  progress: getProgress()
});

options.onMilestone?.({
  type: "level:complete",
  progress: getProgress(),
  title: "Stage Cleared",
  detail: currentLevel.title
});
```

## Implementation Plan

1. Introduce a local `LEVELS` array with one current stage.
2. Build blocks from the selected level's pattern.
3. Keep responsive metrics for sizing those blocks.
4. Add `getProgress()` and emit progress after each block clear.
5. Add combo counter and reset rules.
6. Improve block-hit and row-clear visual feedback.
7. Add stage-clear celebration.
8. Validate mobile touch/drag and small-screen ball visibility.

## Acceptance Criteria

- Existing Breakout controls remain unchanged.
- The current stage is generated from level data.
- Remaining/cleared block progress is emitted.
- Block hit effects are visible but do not hide the ball.
- Combo feedback is readable and not distracting.
- Stage clear feels distinct from ordinary block clears.
- Restart resets blocks, combo, power-ups, and effects.
- Pause freezes ball, power-ups, and visual timers.

## Risks

- Combo UI may add clutter if placed poorly.
- Heavy effects can make the ball harder to track.
- Stage patterns may need balancing for small screens.
- Power-up and combo tuning can accidentally make the game too easy.

## Recommendation

Use Breakout as the third v2 proof. It should validate declarative stage layouts and arcade reward feedback after Tetris proves endless progression and Memory proves fixed-level setup.
