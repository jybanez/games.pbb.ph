# Helper Collectible And Animator Adoption Proposal

## Summary

Helper deferred `createCollectibleLayer` and `createSpriteAnimator` until Pac-Man and at least one more game prove the exact needs. PBB Games can provide that proof by updating two existing quick games alongside Pac-Man:

- Snake
- Breakout

These two games exercise different parts of the proposed APIs without making the helpers Pac-Man-specific.

## Recommended Existing Games

### 1. Snake

Snake is the cleanest existing game for `createCollectibleLayer`.

Current local behavior:

- Snake stores one `food` cell as plain module state.
- `placeFood()` manually searches for a free cell.
- Collection is an equality check against the snake head.
- Rendering is direct rectangle drawing with no animation.

Proposed improvement:

- Replace single `food` state with a small collectible layer.
- Keep game rules app-owned: score increment, growth, speed changes, and game-over decisions remain in Snake.
- Add optional special supply items later without rewriting placement and collection logic.
- Use `createSpriteAnimator` for food pulse, snake head direction, and eat/death effects.

Possible shape:

```js
const supplies = createCollectibleLayer({
  coordinateMode: "grid",
  items: [
    { id: "food", row, column, type: "supply", value: 1 },
  ],
  canPlace(row, column) {
    return !snake.some((part) => part.x === column && part.y === row);
  },
});

const collected = supplies.collectAt(head.y, head.x);
if (collected) {
  score += collected.value;
  growSnake();
  supplies.spawn({ type: "supply", value: 1 });
}
```

`createSpriteAnimator` usage:

```js
const snakeAnimator = createSpriteAnimator({
  animations: {
    move: { frames: [0, 1], fps: 8, loop: true },
    eat: { frames: [2, 3, 2], fps: 12, loop: false },
    foodPulse: { frames: [0, 1, 2, 1], fps: 6, loop: true },
  },
});
```

Why this is useful for Helper:

- Proves `collectAt(row, column)` and grid placement.
- Proves collectible respawn/replacement after collection.
- Proves item metadata such as `type`, `value`, and `collected`.
- Proves simple procedural animation without sprite-sheet requirements.

### 2. Breakout

Breakout is the best existing game to prove animation effects, with falling power-ups as a secondary collectible proof.

Current local behavior:

- Blocks are stored as an array of rectangles with `live` flags.
- Collision loops over blocks manually.
- Clearing a block immediately removes it from rendering.
- There are no hit, shatter, score, paddle, or ball effects.

Proposed improvement:

- Use `createCollectibleLayer` only for point/radius-based falling power-up drops.
- Keep game rules app-owned: ball physics, paddle control, score, win/loss, and power-up effects stay in Breakout.
- Use `createSpriteAnimator` for block-hit flashes, block shatter/fade, ball trail, and paddle pulse.

Possible power-up shape:

```js
powerups.spawn({
  id: `wide-paddle-${Date.now()}`,
  type: "widePaddle",
  x: blockCenter.x,
  y: blockCenter.y,
  radius: 14,
});

const collected = powerups.collectNear(paddleCenter.x, paddleY, paddleWidth / 2);
```

`createSpriteAnimator` usage:

```js
const effects = createSpriteAnimator({
  animations: {
    blockHit: { frames: [0, 1, 2], fps: 18, loop: false },
    ballTrail: { frames: [0, 1, 2, 3], fps: 24, loop: false },
    paddlePulse: { frames: [0, 1, 0], fps: 12, loop: false },
  },
});
```

Why this is useful for Helper:

- Proves non-grid collectible collection without treating block targets as collectibles.
- Proves item metadata for power-up objects.
- Proves falling collectible spawn and collection behavior.
- Proves multiple concurrent short-lived animations.
- Proves animator usefulness outside character sprites.

## Cross-Game Proof Matrix

| Component | Pac-Man | Snake | Breakout |
| --- | --- | --- | --- |
| `createCollectibleLayer` grid collection | pellets and power pellets | food/supplies | not primary |
| `createCollectibleLayer` point/radius collection | bonus fruit | optional bonus supply | falling power-ups |
| `createCollectibleLayer` rectangle/target collection | not primary | not primary | out of scope for V1.1 |
| `createSpriteAnimator` character loop | player/ghost animation | snake head/body movement | not primary |
| `createSpriteAnimator` item pulse | pellets/fruit | food pulse | power-up pulse |
| `createSpriteAnimator` impact/effect | frightened/score effects | eat/death effects | block hit, trail, paddle pulse |

## API Implications For Helper

The adoption path suggests `createCollectibleLayer` should not be limited to Pac-Man pellets. It should support collectible items across grid and point/radius coordinate modes:

- `grid`: row/column collection, used by Pac-Man and Snake
- `point`: x/y/radius collection, used by bonus items and power-ups

Rectangle target/hit entities should stay out of the first collectible API. Breakout blocks can prove `createSpriteAnimator`, and a future target/entity helper can be considered only if multiple games need that shape.

Suggested operations:

- `add(item)`
- `spawn(itemOrFactory)`
- `collectAt(row, column, options?)`
- `collectNear(x, y, radius, options?)`
- `collectWhere(predicate, options?)`
- `remaining(filter?)`
- `reset(items?)`
- `forEach(callback)`
- `toJSON()` or `getState()` for app-owned persistence if needed later

The adoption path suggests `createSpriteAnimator` should stay rendering-agnostic:

- It should manage animation timing and frame state.
- It should not require sprite sheets.
- It should support app-rendered frames through callbacks.
- It should allow concurrent animation instances for effects.

Suggested operations:

- `setAnimation(name, options?)`
- `play(name, options?)`
- `update(deltaSeconds)`
- `getFrame()`
- `getState()`
- `isComplete()`
- `reset()`

## Proposed Games Work After Helper V1

Once Helper implements `ui.game.grid` V1, Games can stage this in three steps:

1. Build Pac-Man with app-local collectibles and animation shaped like the proposed APIs.
2. Update Snake to use `createCollectibleLayer` for food/supplies and `createSpriteAnimator` for food/head/eat effects.
3. Update Breakout to use `createCollectibleLayer` for falling power-ups and `createSpriteAnimator` for hit/trail/paddle effects.

This gives Helper three consumers with different needs before freezing V1.1/V2:

- Pac-Man proves maze pellets and character animation.
- Snake proves simple grid collectible respawn and lightweight procedural animation.
- Breakout proves non-grid collectible power-ups and concurrent effect animation.

## Recommendation

Tell Helper that Games can provide second-game proof for both deferred components without waiting for a brand-new game:

- Use Snake as the primary proof for `createCollectibleLayer`.
- Use Breakout as the primary proof for `createSpriteAnimator` and secondary proof for collectible power-up handling.

Keep Breakout blocks out of `createCollectibleLayer` V1.1. Use block hit, shatter, trail, and paddle effects only to validate `createSpriteAnimator`.
