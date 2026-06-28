# Helper Reusable Game Experience Elements Proposal

## Summary

PBB Games is preparing a **Games Experience v2** layer for Tetris, Memory Cards, and Breakout. The immediate goal is to make games feel more rewarding through progress feedback, milestone moments, and lightweight visual effects.

Games can start app-local, but several pieces are likely reusable across many games. This proposal asks PBB Helper to review whether these should become Helper-owned primitives.

## Helper Counter-Proposal Status

PBB Helper responded with a counter-proposal:

```text
C:\wamp64\www\hotline-helpers\docs\ui-game-experience-elements-counter-proposal.md
```

Games accepts Helper's staged direction:

1. Enhance existing `ui.game.state.chrome.showMilestone(...)` first.
2. Improve existing `chrome.updateProgress(...)` next.
3. Keep Tetris, Breakout, Memory, and Snake effects app-local until common timing needs converge.
4. Promote a non-rendering `ui.game.effects` / `createGameEffectTimeline(...)` later if the proof cases justify it.

This means the preferred first shared Helper surface is state chrome, not standalone milestone/progress primitives. The standalone `createGameMilestoneOverlay(...)`, `createGameProgressChrome(...)`, sprite-specific animator, and generic tween APIs should remain deferred unless later proof work shows a stronger need.

## Context

Recent player testing feedback:

- players like the current games
- players want more "eye-candy" and satisfying feedback
- stronger progress moments may help players continue playing and come back

Games is also beginning leveling standardization:

- Tetris: endless levels based on lines cleared
- Memory Cards: fixed declarative levels
- Breakout: fixed declarative stage layouts

The proposed Helper involvement is not about game rules. Games should continue to own scoring, leveling rules, collision, rendering style, rewards meaning, and progression timing.

## Proposed Helper-Owned Elements

### 1. Game Milestone Overlay

Purpose:

- show short, non-blocking milestone moments inside a game session
- support moments such as `Level Up`, `Stage Cleared`, `All Matched`, `Combo x5`, or `Route Cleared`

Potential API shape:

```js
const milestone = createGameMilestoneOverlay(session.overlay, {
  visibility: "overlay",
  duration: 1200,
  position: "center",
});

milestone.show({
  type: "levelUp",
  title: "Level Up",
  detail: "Level 2",
  tone: "success",
});
```

Alternative state chrome shape:

```js
stateChrome.showMilestone({
  type: "levelUp",
  title: "Level Up",
  detail: "Level 2",
  duration: 1200,
});
```

Helper should own:

- accessible announcement behavior
- positioning
- auto-dismiss timing
- reduced-motion behavior
- consistent visual chrome

Games should own:

- when milestone appears
- title/detail text
- milestone type meaning
- gameplay impact, if any

Initial consumers:

- Tetris level-up
- Breakout stage clear or combo milestone
- Memory all-matched completion

### 2. Game Progress Chrome

Purpose:

- provide a compact, consistent way to show progress metadata
- avoid every game hand-building HUD badges differently

Potential API shape:

```js
const progressChrome = createGameProgressChrome(session.overlay, {
  position: "top-center",
  visibility: "overlay",
});

progressChrome.update({
  title: "Level 2",
  primary: "Score 420",
  secondary: "Lines 7/10",
  progressCurrent: 7,
  progressTarget: 10,
});
```

Alternative state chrome shape:

```js
stateChrome.updateProgress({
  level: 2,
  objective: "Clear complete lines",
  progressCurrent: 7,
  progressTarget: 10,
  label: "Lines 7/10",
  score: 420,
});
```

Helper should own:

- layout and accessibility
- compact responsive display
- optional progress bar/pill rendering
- visual consistency with game session chrome

Games should own:

- progress calculation
- objective meaning
- which fields matter per game

Initial consumers:

- Tetris score/lines/level
- Memory pairs/moves
- Breakout blocks/stage/combo

### 3. Game Effect Timeline / Animator

Purpose:

- provide reusable timing for short visual effects
- avoid each game hand-rolling `age / duration`, cleanup, easing, and reduced-motion behavior

Potential API shape:

```js
const effects = createGameEffectTimeline({
  reducedMotion: "respect",
});

effects.spawn({
  id: "line-clear-12",
  type: "lineClear",
  duration: 360,
  payload: { row: 12 },
});

effects.update(delta);

effects.forEach((effect) => {
  const progress = effect.progress;
  const eased = effect.eased;
  // Game owns canvas rendering.
});
```

Helper should own:

- effect lifetime
- progress calculation
- cleanup
- easing helpers
- pause/resume integration if feasible
- reduced-motion handling

Games should own:

- canvas drawing
- particle style
- effect semantics
- where effects spawn

Initial consumers:

- Tetris line clear sweep, lock pulse, level-up flash
- Breakout block break, paddle pulse, ball trail
- Memory match glow, miss shake, completion wave

Relationship to existing proposals:

- This overlaps with earlier `createSpriteAnimator` discussion.
- If Helper prefers `createSpriteAnimator`, this proposal can be treated as the non-sprite/timeline side of that same primitive.

### 4. Easing And Tween Utilities

Purpose:

- make small game effects consistent without forcing a full animation component

Potential API shape:

```js
const value = easeOutCubic(progress);

const tween = createTween({
  from: 0,
  to: 1,
  duration: 240,
  easing: "outCubic",
});
```

Helper should own:

- named easing functions
- safe clamp behavior
- optional tween lifecycle helper

Games should own:

- how eased values affect rendering

Initial consumers:

- all three v2 games
- Snake and Supply Run later

## Priority Recommendation

Recommended Helper priority:

1. `createGameMilestoneOverlay` or equivalent `stateChrome.showMilestone(...)`
2. `createGameEffectTimeline` or `createSpriteAnimator` instance support
3. `createGameProgressChrome` or equivalent `stateChrome.updateProgress(...)`
4. easing/tween utilities

Reasoning:

- milestone overlay gives the most immediate retention payoff
- effect timeline avoids duplicated animation plumbing
- progress chrome is useful, but Games can keep local HUD text briefly
- easing utilities are valuable but smaller

## Non-Goals For Helper

Helper should not own:

- Tetris line clear rules
- Tetris scoring or level calculation
- Memory match rules
- Breakout ball physics
- combo scoring rules
- reward economy
- persistent player progress
- game-specific art direction
- canvas rendering style

## App-Local Fallback

Games can implement v2 proof work app-local if Helper needs more time.

Expected temporary app-local pieces:

- milestone overlay CSS/DOM
- effect arrays with `age`, `duration`, and `progress`
- per-game HUD badge updates

If Helper accepts any primitives, Games can migrate the proof code to Helper-owned APIs after the bundle refresh.

## Open Questions For Helper

- Should milestone and progress live inside `ui.game.state.chrome`, or as separate `ui.game.feedback` primitives?
- Should the animator focus on sprite frames, generic effect timelines, or both?
- Should reduced-motion handling be automatic for game feedback components?
- Can these primitives be used without forcing a specific visual style?
- Should these APIs accept a `session` directly, or work with any container element?

## Suggested First Contract

If Helper wants the smallest useful first slice, Games recommends:

```js
const milestone = createGameMilestoneOverlay(session.overlay, {
  duration: 1200,
  position: "center",
});

milestone.show({
  title: "Level Up",
  detail: "Level 2",
});

milestone.destroy();
```

This is enough for Tetris v2 level-up testing and can later expand into richer progress or effect APIs.
