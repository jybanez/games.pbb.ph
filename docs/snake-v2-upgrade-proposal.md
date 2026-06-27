# Snake V2 Upgrade Proposal

## Summary

Snake V2 should turn the current clean quick-game loop into a more rewarding arcade session without changing the game identity. The current Snake module already has a strong foundation: Helper game loop, ghost virtual joystick, local collectible layer, bonus supplies, score HUD, game-state chrome, splash/home flow, and local sound hooks.

The V2 goal is to add progression, stronger collection feedback, richer scoring moments, and a more polished playfield while keeping Snake readable and fast on phones.

## Current State

Runtime: `games/snake/module.js`

Current behavior:

- Fixed 32-column responsive grid.
- Snake starts near the center and moves continuously.
- Player uses keyboard arrows or Helper `createVirtualJoystick`.
- Normal supply gives 1 point and grows the snake.
- Bonus supply appears every 5 normal supplies, expires, and gives 3 points.
- Collision with walls or the snake body ends the game.
- HUD shows score only.
- Game over uses Helper state chrome.

Already proven:

- App-local collectible layer shape for future Helper `createCollectibleLayer`.
- App-local pulse/eat effects for future Helper `createSpriteAnimator`.
- Mobile joystick standard for lower-left controls.

## V2 Goals

- Add declarative level definitions that tune speed, bonus cadence, and scoring.
- Make collection feel satisfying through particles, popups, short screen pulses, and trail glow.
- Improve the playfield with subtle grid depth and supply highlights.
- Add a level-up milestone when the player reaches a score or supply threshold.
- Keep input simple: joystick plus keyboard only.
- Keep gameplay readable on small landscape screens.
- Preserve the existing module contract.

## Non-Goals

- No maze walls in V2.
- No campaign map.
- No inventory system.
- No global rewards economy.
- No persistence unless a separate progress-storage decision is approved.
- No Helper internals patched inside Games.

## Proposed Level Model

Snake should use an endless declarative level list. The list can loop into a generated fallback after the authored levels.

Suggested shape:

```js
const LEVEL_DEFINITIONS = [
  {
    level: 1,
    title: "Warm Up",
    targetSupplies: 5,
    tickSeconds: 0.135,
    foodValue: 1,
    bonusEvery: 5,
    bonusValue: 3,
    bonusTtl: 5.5
  },
  {
    level: 2,
    title: "Faster Route",
    targetSupplies: 10,
    tickSeconds: 0.12,
    foodValue: 1,
    bonusEvery: 4,
    bonusValue: 4,
    bonusTtl: 5
  }
];
```

Level progression should be based on normal supplies collected, not total score. This avoids bonus items unexpectedly jumping several levels.

Recommended HUD:

- Top-center: `Score 12  Lv 2`
- Optional compact detail during milestone only: `Route speed up`

## Gameplay Changes

### Level Progression

- Start at Level 1 on reset.
- Increase level after reaching the current level's `targetSupplies`.
- Reduce `tickSeconds` conservatively per level.
- Increase bonus value or bonus frequency slightly.
- Show a large animated `Level 2` milestone, not a modal card.

### Scoring

- Normal supply: `foodValue`.
- Bonus supply: `bonusValue`.
- Optional streak bonus after 3 quick collections, but only if it does not make the HUD noisy.

### Supplies

Keep two supply types for V2:

- `food`: standard green supply.
- `bonus`: gold timed supply.

Defer these until after V2:

- shield
- slow motion
- multiplier
- obstacle clearing

## Visual Direction

Snake should feel like a glowing signal trail moving through a dark barangay grid.

Recommended effects:

- Snake body has a soft cyan glow and slightly brighter head.
- The head has a subtle directional highlight so movement is clear.
- Supply collection emits a small burst at the collected cell.
- Bonus supply has a pulsing gold ring and visible countdown fade.
- Level-up shows large centered text with a short radial pulse.
- Game over can briefly flash the snake body before Helper result overlay appears.

Avoid:

- Large effects that hide the next cell.
- Long animation delays before movement continues.
- Decorative scenery inside the active grid.

## Layout

Keep current full-screen game viewport.

Controls:

- Keep Helper `createVirtualJoystick({ visibility: "ghost" })`.
- Keep joystick lower-left.
- No action buttons during play except Helper state chrome pause/close behavior.

HUD:

- Game title top-left.
- Score and level top-center.
- Pause/close icon top-right through Helper game state chrome.

## Audio

Use existing Helper starter sounds:

- `move`: low-volume direction change.
- `score`: normal collection.
- `match` or `score` variant: bonus collection.
- `win` or score flourish: level-up.
- `error`: collision/game over.

Audio should remain optional and respect the current game sound toggle.

## Persistence And Metrics

Version 2 should remain session-only unless local progress persistence is approved separately.

Future local progress candidates:

- best score
- highest snake level reached
- longest snake length
- total supplies collected

Metric monitoring candidates:

- game started
- game ended by game over/home
- highest level reached per session
- average session duration bucket
- input type used: keyboard or joystick

Do not store raw movement paths.

## Helper Relationship

No Helper change is required to implement Snake V2.

Future Helper extraction candidates:

- `createCollectibleLayer` for grid supplies.
- `createSpriteAnimator` for pulse, burst, and level-up effects.
- Optional reusable milestone renderer if Tetris, Memory, Breakout, and Snake converge on the same pattern.

Games should not patch Helper internals for this work.

## Implementation Plan

1. Add local `LEVEL_DEFINITIONS`.
2. Track `levelIndex`, `normalSuppliesCollected`, and current level tuning.
3. Update movement tick timing from the current level.
4. Update supply spawning to use current level values.
5. Update HUD to include level.
6. Add collection particles and score popup.
7. Add bonus countdown/pulse render.
8. Add level-up banner and short radial pulse.
9. Add game-over snake flash before state chrome result if it does not delay too long.
10. Test desktop landscape, mobile landscape, keyboard, joystick, pause/resume, restart, and resize.

## Acceptance Criteria

- Snake remains playable and readable on mobile landscape.
- Level changes are visible and understandable.
- Speed increases feel gradual, not punishing.
- Food never spawns on the snake body.
- Bonus supplies expire cleanly.
- Restart fully resets level, score, supplies, timers, and effects.
- Pause freezes movement, timers, and effects.
- No HUD/control overlap.
- No Helper vendor refresh is mixed into the branch unless explicitly needed.

## Risks

- Speed increases can make mobile joystick control feel unfair.
- Too much glow can reduce cell readability.
- Bonus item timing can make score balancing noisy.
- If level-up animation blocks input, players may feel the game stutters.

## Recommendation

Make Snake V2 the next arcade-polish pass after Memory if we want a small, low-risk implementation. It should be the best place to refine reusable collectible and milestone patterns before applying more complex progression to Supply Run.
