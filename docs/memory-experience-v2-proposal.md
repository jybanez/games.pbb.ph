# Memory Cards Experience V2 Proposal

## Summary

Upgrade Memory Cards with richer card interaction, match rewards, and declarative level structure so the game feels more satisfying and can test fixed or curriculum-style progression.

This belongs to **Games Experience v2** because the work improves player retention and presentation without changing the broader Games app version.

## Current State

Runtime: `games/memory/module.js`

Current behavior:

- fixed 3x4 board
- 6 symbol pairs
- tracks `matches`
- tracks `moves`
- uses Helper `createFlipCard`
- emits `won` when all pairs are matched
- shows `Pairs` and `Moves` in the top-center badge

The game is simple and stable, but card selection and match completion can feel quiet.

## Goals

- Make taps, flips, matches, and misses feel more tactile.
- Use Memory as the first fixed declarative level proof.
- Keep board readability high on small screens.
- Add celebratory completion feedback.
- Prepare for future learning-themed symbol sets without redesigning the game.

## Non-Goals

- No persistence yet.
- No unlocks or rewards economy yet.
- No timer pressure in the first v2 pass.
- No complex animations that slow card flipping.
- No curriculum authoring system yet.

## Proposed V2 Experience

### Card Interaction Polish

Add small feedback around every card action:

- card press scale or shadow lift
- smoother flip timing
- selected-card glow
- matched-card glow pulse
- missed-pair shake or red edge flash

Feedback should make the player's action clear without making the board visually noisy.

### Match Reward Moment

When a pair matches:

- emit a brief green/cyan pulse from both cards
- optionally draw a thin connection line between the pair
- play a match audio cue
- update progress immediately

When all pairs are matched:

- show a completion overlay
- animate all matched cards in a short wave
- show final move count

### Declarative Level Definition

Memory is a good place to prove local level definitions:

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

The first implementation can keep one level only. The value is moving board setup into data.

### Home Page V2

Future persistent stats can include:

- best move count
- fastest clear if timers are added later
- highest board level reached
- last completed level

Do not add these until local persistence is approved.

## Progress Contract

Suggested progress object:

```js
{
  gameId: "memory",
  scheme: "fixed",
  level: currentLevel.number,
  levelId: currentLevel.id,
  levelName: currentLevel.title,
  difficulty: currentLevel.difficulty,
  objective: currentLevel.objective,
  progressCurrent: matches,
  progressTarget: currentLevel.target.pairs,
  progressLabel: `Pairs ${matches}/${currentLevel.target.pairs}`,
  stats: { moves }
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
  title: "All Matched",
  detail: `Moves ${moves}`
});
```

## Implementation Plan

1. Introduce one local `LEVELS` array.
2. Build the deck from `currentLevel.symbols`.
3. Build layout from `currentLevel.layout`.
4. Add `getProgress()` and emit progress after moves and matches.
5. Add match/miss feedback effects.
6. Add completion celebration.
7. Validate touch behavior and portrait/landscape layout.

## Acceptance Criteria

- Current 3x4 Memory game behavior remains intact.
- Level data drives symbols and layout.
- Matched pairs have clear positive feedback.
- Missed pairs have clear but gentle negative feedback.
- Completion feels celebratory.
- Progress events report pairs and moves.
- Restart resets cards, moves, matches, and effects.
- Cards remain readable on phone viewports.

## Risks

- Too much animation can make the board feel slow.
- Miss feedback can feel punitive if too strong.
- More visual states can make flipped/matched/selected states harder to distinguish.
- Dynamic layouts may need extra testing before adding larger boards.

## Recommendation

Use Memory as the second v2 proof after Tetris. It is the safest game for declarative levels and the best test for tactile, low-risk visual reward.
