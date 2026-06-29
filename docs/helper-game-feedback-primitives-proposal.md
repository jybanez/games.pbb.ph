# Helper Game Feedback Primitives Proposal

## Summary

PBB Games is adding more arcade-style polish across multiple games. Sector Wing v2, Tetris v2, Snake v2, Breakout, Memory Cards, and the planned **Supply Shuffle** match-3 game all need the same category of reusable support: short-lived visual feedback, score popups, animation timing, celebration moments, and compact status meters.

This proposal asks PBB Helper to consider reusable **game feedback and animation primitives** that benefit several game genres, not a single game. Games should continue owning game rules, rendering style, scoring, level definitions, collision, board logic, enemy behavior, and match-3 resolution.

## Context

Recent player feedback is consistent:

- players like the current games
- players want stronger eye-candy and more satisfying feedback
- richer feedback should encourage replay without adding accounts, remote services, or operational risk

Games has already proven several app-local patterns:

- Tetris v2 uses line-clear feedback, level-up moments, score display, and gameplay overlays.
- Snake v2 uses pickup bursts, point popups, and level-up rings/sparks.
- Supply Run v2 uses route-clear and level progression feedback.
- Sector Wing v2 uses projectile trails, shield impacts, enemy hit flashes, destroy bursts, power-up meters, route progress, and guardian status.
- Breakout and Memory Cards are planned v2 candidates and will need similar hit/match/clear/combo feedback.
- Supply Shuffle is planned as a match-3 puzzle game and will need swap, match, cascade, combo, score, and level-clear feedback.

The repeated need is not a match-3 engine or shooter engine. The repeated need is a small set of Helper-owned timing, lifecycle, accessibility, and chrome primitives that games can render through their own canvas or DOM surfaces.

## Relationship To Earlier Proposal

This is a focused follow-up to:

```text
docs/helper-reusable-game-experience-elements-proposal.md
```

Games still accepts Helper's earlier staged direction:

1. Prefer enhancing existing game state chrome where it fits.
2. Keep game-specific effects app-local until common timing needs are proven.
3. Promote non-rendering effect/timeline primitives only when several games need the same lifecycle and timing support.

Sector Wing v2 and the planned Supply Shuffle now strengthen the case for a cross-game feedback layer.

## Non-Goals

- No match-3 engine in Helper.
- No shooter engine in Helper.
- No Tetris engine in Helper.
- No game-specific art, sprites, effects, or particle styles in Helper.
- No scoring, leveling, rewards, persistence, or analytics in Helper.
- No forced canvas renderer abstraction.
- No Helper internals patched from Games.

## Candidate Helper Primitives

### 1. Game Effect Timeline

Purpose:

- manage short-lived effect lifecycles
- provide normalized progress, easing, pause/resume behavior, and cleanup
- allow each game to render effects in its own style

Potential API:

```js
const effects = createGameEffectTimeline({
  reducedMotion: "respect",
});

effects.spawn({
  type: "lineClear",
  duration: 360,
  payload: { row: 18, score: 100 },
});

effects.update(delta);

effects.forEach((effect) => {
  const progress = effect.progress;
  const eased = effect.eased;
  // Game-owned canvas or DOM rendering.
});
```

Helper owns:

- duration tracking
- progress normalization
- easing lookup
- cleanup
- pause/resume integration
- reduced-motion behavior

Games owns:

- effect meaning
- spawn timing
- payload shape
- drawing style
- gameplay impact

Cross-game consumers:

- Tetris line clears, lock pulses, level-up moments
- Snake pickup bursts and level-up rings
- Sector Wing hit flashes, shield impacts, destroy bursts, projectile trails
- Breakout block breaks and paddle/ball impacts
- Memory match glow and completion wave
- Supply Shuffle match bursts, cascades, combo trails, and tile settle effects

### 2. Floating Text Layer

Purpose:

- standardize score and event text popups without modal cards
- avoid each game implementing text lifetime, drift, fade, and accessibility separately

Potential API:

```js
const floatingText = createFloatingTextLayer(session.overlay, {
  position: "stage",
  visibility: "overlay",
  reducedMotion: "respect",
});

floatingText.show({
  text: "+250",
  tone: "success",
  x: 320,
  y: 180,
  duration: 900,
});
```

Helper owns:

- DOM placement or canvas-neutral coordinate mapping
- lifetime and fade
- responsive scaling
- optional polite announcements
- reduced-motion behavior

Games owns:

- text content
- event timing
- score values
- exact anchor coordinates

Cross-game consumers:

- Tetris score popups and combo/line clear labels
- Snake `+food` and bonus labels
- Sector Wing enemy score, pickup labels, and route clear labels
- Breakout block score and combo labels
- Memory match/miss/all-clear labels
- Supply Shuffle combo, cascade, and objective progress labels

### 3. Tween Timeline Utilities

Purpose:

- provide reusable animation timing for common value transitions
- support effects without forcing a UI component

Potential API:

```js
const timeline = createGameTweenTimeline();

timeline.add({
  id: "tile-12-fall",
  from: { y: 80, scale: 1 },
  to: { y: 144, scale: 1.02 },
  duration: 220,
  easing: "outCubic",
});

timeline.update(delta);
```

Helper owns:

- interpolation
- easing
- sequencing
- cancellation
- pause/resume
- reduced-motion fallbacks

Games owns:

- what property values mean
- rendering
- collision/rule timing

Cross-game consumers:

- Supply Shuffle swap, reject, fall, refill, and cascade animations
- Memory flip timing and matched-pair settle
- Tetris post-clear drop timing and HUD pulses
- Sector Wing respawn/materialization and pickup magnet effects
- Breakout brick collapse and ball trail fade

### 4. Celebration And Milestone Chrome

Purpose:

- show exciting but non-blocking milestone moments
- replace plain toast/card feedback where gameplay should feel celebratory

Preferred direction:

- first enhance existing `ui.game.state.chrome.showMilestone(...)`
- only add a separate primitive if state chrome cannot support the use cases cleanly

Potential API:

```js
stateChrome.showMilestone({
  type: "levelUp",
  title: "Level Up",
  detail: "Level 3",
  tone: "success",
  duration: 1200,
  intensity: "high",
});
```

Helper owns:

- placement
- timing
- responsive typography
- non-modal behavior
- accessibility announcement
- reduced-motion fallback

Games owns:

- when the milestone appears
- milestone meaning
- text and score values
- whether gameplay pauses or continues

Cross-game consumers:

- Tetris level up and multi-line clear
- Snake level up
- Supply Run route clear
- Sector Wing route clear and guardian down
- Breakout stage clear
- Memory all matched
- Supply Shuffle level clear, large combo, and objective complete

### 5. HUD Meter Group

Purpose:

- standardize compact status bars/meters used during active gameplay
- avoid each game creating incompatible power-up/timer/progress bar DOM

Potential API:

```js
const meters = createGameMeterGroup(session.overlay, {
  position: "top-right",
  visibility: "overlay",
});

meters.update([
  { id: "energy", label: "Energy", value: 0.72, tone: "info" },
  { id: "shield", label: "Shield", value: 0.35, tone: "success" },
  { id: "spread", label: "Spread", value: 0.48, tone: "warning" },
]);
```

Helper owns:

- meter layout
- labels and accessibility
- responsive wrapping/stacking
- visibility variants
- consistent reduced-motion updates

Games owns:

- values
- thresholds
- gameplay meaning
- color/tone selection

Cross-game consumers:

- Sector Wing energy, shield, active power-up, guardian health, route progress
- Breakout stage progress, power-up timer, ball-save timer
- Supply Shuffle moves, combo timer, booster charge, objective progress
- Memory timer or streak meter if added later
- Snake bonus TTL or level progress if needed

## Suggested Priority

### Priority 1: Effect Timeline

This is the broadest reusable foundation. It can stay non-rendering and low-risk while removing duplicated effect lifecycle code.

### Priority 2: Floating Text Layer

Score/event popups are already repeated across Games. A shared layer improves consistency and reduces app-local DOM/canvas bookkeeping.

### Priority 3: Enhance State Chrome Milestones

This follows Helper's prior counter-proposal and improves level-up/clear moments without introducing a separate overlay system too early.

### Priority 4: HUD Meter Group

Sector Wing already proves this need. Supply Shuffle and Breakout v2 may confirm whether a generic meter group is worth promoting.

### Priority 5: Tween Timeline

This becomes more important once Supply Shuffle starts implementing swap/fall/cascade animations. Until then, it can remain app-local proof work.

## Supply Shuffle Boundary

Supply Shuffle should remain app-owned for:

- board model
- tile types
- swap validation
- match detection
- cascade/refill
- special tile creation
- level objectives
- scoring
- rewards

Helper should only be considered for:

- effect timing
- floating text
- tween sequencing
- milestone chrome
- meter/progress chrome

This keeps Helper focused on reusable game support rather than one genre.

## Acceptance Criteria For Helper

Any accepted primitive should:

- serve at least three current or planned Games modules
- work without external assets
- respect reduced-motion settings
- clean up on game pause, restart, home, and destroy
- not assume a specific game genre
- not require Games to surrender canvas rendering control
- be consumable from the vendored Helper game bundle

## Recommendation

Games should continue proving Supply Shuffle app-local first. In parallel, Helper can review this proposal and decide whether the first extraction should be:

1. a non-rendering `createGameEffectTimeline(...)`
2. a reusable `createFloatingTextLayer(...)`
3. an enhancement to existing `stateChrome.showMilestone(...)`

The strongest near-term Helper candidate is the non-rendering effect timeline because it benefits Sector Wing, Tetris, Snake, Breakout, Memory, and Supply Shuffle without creating a game-specific framework.
