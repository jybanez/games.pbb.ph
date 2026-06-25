# Snake Collectible And Animator Upgrade Proposal

## Summary

Upgrade the existing Snake game to prove `createCollectibleLayer` and lightly prove `createSpriteAnimator` after Helper V1.1 is available. Snake is the cleanest second consumer for grid collectibles because it already has one food cell, free-cell placement, collection, score updates, and respawn behavior.

The goal is not to change Snake into a different game. The goal is to replace ad hoc food state with a reusable collectible layer and add small visual feedback while preserving the current mobile-friendly loop.

## Current State

Runtime: `games/snake/module.js`

Implementation status:

- App-local collectible layer shape is implemented until Helper exposes `createCollectibleLayer`.
- App-local food pulse and eat effects are implemented until Helper exposes `createSpriteAnimator`.
- Normal food remains the baseline collectible.
- Bonus supply now appears every 5 normal foods, expires, and gives 3 points.

Current behavior:

- Uses Helper `createGameLoop`.
- Uses Helper `createVirtualJoystick` with ghost visibility.
- Keeps food and bonus supply state in an app-local collectible layer shaped for later Helper migration.
- Uses app-provided placement checks so supplies do not spawn on the snake body or each other.
- Detects collection through `collectAt(row, column)`.
- Renders snake cells locally and renders supplies through layer iteration.
- Emits score through a top-center badge.

## Target Helper Dependencies

Primary:

- `createCollectibleLayer`

Secondary:

- `createSpriteAnimator`

Existing dependencies remain:

- `createGameLoop`
- `createVirtualJoystick`

## Ownership Boundary

Helper should own:

- collectible item storage
- grid placement with app-provided `canPlace`
- collection by row/column
- item metadata and reset behavior
- animation frame/timing state

Snake should own:

- snake body array
- direction and reverse-turn prevention
- collision with walls and body
- growth and scoring rules
- speed tuning
- rendering style
- sound choices

## Collectible Upgrade

Replace:

```js
let food = { x, y };
food = placeFood();
if (head.x === food.x && head.y === food.y) { ... }
```

With a layer shaped like:

```js
const supplies = createCollectibleLayer({
  coordinateMode: "grid",
  items: [],
  canPlace(row, column) {
    return !snake.some((part) => part.x === column && part.y === row);
  },
});
```

On reset:

```js
supplies.reset();
supplies.spawn({
  id: "food",
  type: "food",
  value: 1,
  row: startRow,
  column: startColumn,
});
```

On tick:

```js
const collected = supplies.collectAt(head.y, head.x);
if (collected) {
  score += collected.value;
  supplies.spawn({ type: "food", value: 1 });
  sound?.play?.("score");
  syncScore();
} else {
  snake.pop();
}
```

Important requirement: `canPlace` must run against the current snake body. The collectible layer should not know what a snake is.

## Optional Special Supplies

After the plain food migration is stable, add one optional special supply type to prove item metadata without making the game complex.

Candidate:

- `bonus`: appears every 5 normal foods, expires after a short timer, gives 3 points

Deferred candidates:

- slow supply
- shield supply
- score multiplier

Keep V1 focused. A single special item is enough to prove metadata, timers, and render variation.

## Animator Upgrade

Use `createSpriteAnimator` for app-rendered procedural frames, not sprite sheets.

Suggested animations:

- `foodPulse`: loops while food is available
- `eat`: short pulse at the head when food is collected
- `death`: brief body fade or flash before game-over overlay

Possible shape:

```js
const animator = createSpriteAnimator({
  animations: {
    foodPulse: { frames: [0, 1, 2, 1], fps: 6, loop: true },
    eat: { frames: [0, 1, 2], fps: 14, loop: false },
    death: { frames: [0, 1, 0, 1], fps: 10, loop: false },
  },
});
```

Snake should continue drawing rectangles or rounded cells locally. The animator should only provide current frame/progress so Snake can scale, brighten, or fade the drawn cell.

## Mobile Controls

Keep the current Helper ghost virtual joystick for now because it is already stable and usable.

Possible later improvement:

- Add swipe-to-turn on the stage.
- Keep joystick as the visible control affordance.

Do not switch Snake to a D-pad during this upgrade unless mobile testing shows the joystick is the source of input errors.

## Rendering Changes

Current draw order can stay:

1. background
2. border/grid frame
3. snake cells
4. collectible cells

Upgrade details:

- Render collectible items by iterating `supplies.forEach(...)` or `supplies.getItems(...)`.
- Use item `type` to choose color and size.
- Use `foodPulse` frame/progress to subtly scale the food marker.
- Use `eat` animation at the collected cell for one short effect.

Avoid heavy effects. Snake should stay fast and readable on low-end phones.

## Implementation Plan

1. Keep the current Snake behavior as the baseline.
2. Implement an app-local collectible layer shape until Helper exposes `createCollectibleLayer`.
3. Replace `food` and `placeFood()` with a `supplies` layer.
4. Preserve the initial food placement behavior.
5. Update tick collection logic to use `collectAt(head.y, head.x)`.
6. Update render logic to iterate collectible items.
7. Add app-local food pulse and eat effects shaped for later `createSpriteAnimator` migration.
8. Add one optional bonus supply after the base migration passes.
9. Test phone portrait/landscape behavior, joystick control, restart, pause, and resize.

## Acceptance Criteria

- Snake plays the same or better than the current version.
- Food never spawns on the snake body.
- Food collection grows the snake and increments score.
- Restart resets the collectible layer.
- Resize keeps the snake and collectibles in valid cells.
- The joystick remains usable on mobile.
- Animation does not obscure cell readability.
- No new layout overlap with HUD or controls.

## Risks

- If `createCollectibleLayer.spawn()` cannot use dynamic `canPlace`, food may spawn on the snake.
- If animation effects are too large, they can make collision readability worse.
- If bonus supplies are added too early, they may hide whether the base helper migration is correct.

## Recommendation

Use Snake as the first existing-game upgrade after Pac-Man. Keep the first pass limited to normal food through `createCollectibleLayer`, then add `createSpriteAnimator` effects, then consider one bonus supply.
