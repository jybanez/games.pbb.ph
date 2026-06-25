# Breakout Animator And Power-Ups Upgrade Proposal

## Summary

Upgrade the existing Breakout game to prove `createSpriteAnimator` and provide secondary proof for `createCollectibleLayer` through falling power-ups. Breakout blocks should not be represented as collectibles in Helper V1.1; they remain app-owned target/hit entities.

This upgrade keeps Breakout's current direct touch/drag paddle control, responsive canvas metrics, and simple rule model while adding better feedback and one small optional power-up system.

## Current State

Runtime: `games/breakout/module.js`

Implementation status:

- App-local effect instance storage is implemented until Helper exposes `createSpriteAnimator`.
- App-local point collectible layer is implemented for falling power-ups until Helper exposes `createCollectibleLayer`.
- Block break effects, ball trail, and paddle pulse are implemented.
- Falling `widePaddle` power-up is implemented and expires cleanly.

Current behavior:

- Uses Helper `createGameLoop`.
- Uses one canvas layer with smoothing enabled.
- Controls paddle by keyboard or direct pointer/touch drag.
- Stores blocks as rectangles with `live` flags.
- Loops over blocks manually for collision.
- Clears blocks immediately for rules and renders a short break effect for feedback.
- Can spawn a falling `widePaddle` power-up from block hits.
- Shows remaining block count in the top-center score badge.
- Emits `won` when all blocks are cleared and `gameOver` when the ball falls below the stage.

## Target Helper Dependencies

Primary:

- `createSpriteAnimator`

Secondary:

- `createCollectibleLayer` for falling power-ups only

Existing dependency remains:

- `createGameLoop`

## Ownership Boundary

Helper should own:

- animation timing/frame state
- concurrent effect instances if supported
- collectible storage and point/radius collection for falling power-ups

Breakout should own:

- ball physics
- paddle control
- block layout and block collision
- win/loss rules
- score and progress text
- power-up effects
- rendering style

Blocks are not collectibles for this phase. They are targets hit by a ball, and that can become a separate Helper concept only if more games need target/hit entities.

## Animator Upgrade

Use `createSpriteAnimator` for rendering-agnostic effects.

Suggested effects:

- `blockHit`: short flash or scale effect at the block that was hit
- `blockBreak`: fade/shatter effect after `live` becomes false
- `ballTrail`: short fading circles behind the ball
- `paddlePulse`: paddle brightens after ball contact or power-up collection

Possible shape:

```js
const effects = createSpriteAnimator({
  animations: {
    blockHit: { frames: [0, 1, 2], fps: 18, loop: false },
    blockBreak: { frames: [0, 1, 2, 3], fps: 20, loop: false },
    ballTrail: { frames: [0, 1, 2, 3], fps: 24, loop: false },
    paddlePulse: { frames: [0, 1, 0], fps: 12, loop: false },
  },
});
```

If Helper's animator supports instances:

```js
effects.play("blockBreak", {
  id: `block-${index}`,
  x: block.x + block.width / 2,
  y: block.y + block.height / 2,
});
```

If it only supports one active animation, keep a small app-local `effectInstances` array and use Helper only for frame progression.

## Power-Up Upgrade

Use `createCollectibleLayer` only for power-ups spawned from block hits.

Initial power-up:

- `widePaddle`: temporarily increases paddle width

Optional later power-ups:

- `slowBall`
- `extraLife` if Breakout later gains lives
- `multiBall` deferred until the physics loop is more robust

Possible shape:

```js
const powerups = createCollectibleLayer({
  coordinateMode: "point",
  items: [],
});

function maybeSpawnPowerup(block) {
  if (Math.random() > 0.18) {
    return;
  }
  powerups.spawn({
    id: `powerup-${Date.now()}`,
    type: "widePaddle",
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
    radius: 14,
    vy: getMetrics().ballSpeed * 0.35,
    value: 1,
  });
}
```

During update:

```js
powerups.forEach((item) => {
  item.y += item.vy * delta;
});

const collected = powerups.collectNear(paddleCenter, paddleY, paddleWidth / 2);
if (collected?.type === "widePaddle") {
  activateWidePaddle();
}
```

Breakout owns expiration:

```js
let widePaddleRemaining = 0;
```

The Helper collectible layer should not know how a wide paddle works.

## Mobile Controls

Keep the current direct touch/drag paddle control. It is the right control model for phones and should not be replaced by a D-pad or joystick.

Power-up collection should work naturally with the same paddle movement. Avoid adding extra action buttons.

Touch considerations:

- Keep `session.viewport.style.touchAction = "none"` while mounted.
- Keep paddle large enough for thumbs.
- Avoid power-up icons that fall behind the HUD or controls.

## Rendering Changes

Draw order:

1. background
2. block break/hit effects behind or over blocks
3. live blocks
4. falling power-ups
5. ball trail
6. paddle
7. ball

Power-up visuals:

- small rounded square or circle
- distinct color from blocks and ball
- simple icon-like glyph if readable at phone size

Animator should provide frame/progress. Breakout should decide how each frame changes alpha, scale, or color.

## Block Collision

Keep block collision app-local for this upgrade.

Allowed cleanup:

- give each block an `id`
- preserve `live` flags through resize as today
- start an animation when a block is hit
- optionally delay visual removal while the break effect plays, while still counting the block as cleared

Do not move block collision into `createCollectibleLayer`.

## Implementation Plan

1. Keep current Breakout behavior as baseline.
2. Add app-local effect instance storage until Helper exposes `createSpriteAnimator`.
3. Keep the effect shape compatible with later Helper animator migration.
4. Add block hit/break effect on block collision.
5. Add ball trail and paddle pulse.
6. Add an app-local point collectible layer for power-ups only until Helper exposes `createCollectibleLayer`.
7. Spawn `widePaddle` from a small chance on block break.
8. Add power-up movement, collection, activation, and expiration.
9. Test touch drag on mobile and resize behavior.

## Acceptance Criteria

- Breakout remains playable with direct touch/drag on phones.
- Blocks are still app-owned targets, not collectibles.
- Block hit effects appear without delaying collision response.
- Ball trail improves motion readability without clutter.
- Paddle pulse is brief and does not hide the ball.
- Falling power-ups can be collected by the paddle.
- Wide paddle effect expires cleanly and clamps paddle position.
- Restart clears active effects and power-ups.
- Pause freezes ball, effects, power-ups, and timers.
- Win and game-over overlays still work.

## Risks

- Too many effects can make the ball harder to track on small screens.
- Power-ups can complicate balance if spawn rate is too high.
- Resizing during an active wide-paddle effect must not move the paddle out of bounds.
- If Helper animator has no instance model, Breakout needs a tiny app-local effect manager.

## Recommendation

Use Breakout as the primary existing-game proof for `createSpriteAnimator`. Add falling `widePaddle` power-ups only after animation is stable, and keep block target logic outside `createCollectibleLayer`.
