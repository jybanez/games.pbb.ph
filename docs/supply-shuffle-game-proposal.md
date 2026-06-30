# Survival Game Proposal

## Summary

Add **Survival** as a new PBB Games quick game. Survival is an original match-3 puzzle game with a survival-resource skin: players swap adjacent tiles, create matches, trigger cascades, and complete level objectives using local, rights-safe assets.

The game should use familiar match-3 principles as a genre reference, but it must not copy Bejeweled, Candy Crush, or any other branded board, visual language, sounds, effects, level maps, or special-tile names.

Survival is also the first good proof case for the newly vendored Helper `ui.game.effects` primitive. The match-3 rules remain Games-owned. Helper only assists with session/chrome/controls/audio primitives and non-rendering effect timing.

## Product Fit

Survival fills a useful gap in the current quick-games roster:

- It is familiar to casual players.
- It works naturally on touch screens.
- It has strong replay potential.
- It supports progression without needing accounts or persistence.
- It can use civic/preparedness imagery without feeling like a lesson.
- It gives Games a controlled place to test reusable effect timing from Helper.

Recommended tone:

- fun, bright, and satisfying
- not emergency-alarming
- not operational or tactical
- not tied to live PBB operations

## Ownership Boundary

Helper should own:

- game session overlay and close/pause chrome
- launch splash, countdown, state overlays through current session/state primitives
- touch/action controls if needed
- `ui.game.effects.createGameEffectTimeline(...)` lifecycle timing
- reduced-motion behavior inside effect timelines

Games should own:

- board model
- tile types and tile meanings
- swap validation
- match detection
- cascade/refill rules
- special tile behavior
- scoring
- level objectives
- tuning
- rendering
- sound timing
- all runtime assets

Do not ask Helper for a match-3 engine in v1.

## Non-Goals

- No online leaderboard.
- No player accounts.
- No score persistence.
- No rewards economy in v1.
- No purchases, boosters store, inventory, or merchandise.
- No external assets, CDNs, fonts, sounds, or API calls.
- No branded Bejeweled/Candy Crush mechanics, naming, art, audio, or level layouts.
- No Helper internals patched inside Games.

## Game Identity

Suggested registry identity:

```php
'id' => 'supply-shuffle',
'title' => 'Survival',
'category' => 'quick',
'subcategory' => 'puzzle',
'path' => '/games/supply-shuffle/',
'module' => '/games/supply-shuffle/module.js',
'orientation' => 'portrait',
```

Runtime files:

```text
games/supply-shuffle/index.php
games/supply-shuffle/module.js
games/supply-shuffle/assets/icon.png
games/supply-shuffle/assets/splash.png
games/supply-shuffle/assets/home.png
```

Preferred first asset direction:

- icon: square app-style board with supply tiles
- splash: landscape background, scene weighted left for launch overlay
- home: full scene centered enough to work across portrait and landscape

## Core Rules

Initial v1 rules:

- Board starts at `7 x 7` on mobile and desktop unless testing shows `8 x 8` is still comfortable.
- Player swaps adjacent tiles by tap-drag, tap-then-tap, or pointer drag.
- A swap is valid only if it creates at least one match of 3 or more.
- Invalid swaps animate out and back.
- Matched tiles clear.
- Tiles above fall down.
- New tiles refill from the top.
- Cascades continue until no matches remain.
- Level completes when objective is met before moves run out.
- Level fails when moves reach 0 before objective completion.

Recommended first tile language:

- Water: blue droplet
- Medical: green cross
- Power: yellow lightning bolt
- Comms: purple signal or radio wave
- Shelter: cyan shield or house silhouette
- Food: orange box or bowl

Tiles should not use detailed supply-object thumbnails. Use bold abstract symbols with simple geometry, a unique color, and a unique silhouette for each tile category. Each symbol must remain readable at roughly `32-48px` tile sizes on mobile. Avoid using real PBB operational icons if the game treatment makes them too playful. Generated game-specific abstract symbols are preferred.

## Scoring

Initial score model:

- 3-match: `30`
- 4-match: `60`
- 5-match: `100`
- cascade multiplier: `x1`, `x2`, `x3`, capped in v1 if needed
- objective tile collection can grant small bonus points
- remaining moves bonus at level clear

Score should be visible but not the only objective. The primary loop should be completing level targets.

## Level Model

Levels should be declarative and consumed by the game engine.

Suggested shape:

```js
const LEVEL_DEFINITIONS = [
  {
    id: "level-1",
    level: 1,
    title: "Survival Goal",
    board: { columns: 7, rows: 7 },
    moves: 18,
    tileTypes: ["water", "medical", "power", "comms", "shelter"],
    objectives: [
      { type: "collect", tile: "water", count: 10 },
      { type: "score", value: 600 }
    ],
    specialTiles: {
      lineClear: false,
      bomb: false
    },
    effects: {
      cascadeIntensity: "low"
    }
  }
];
```

Recommended v1 levels:

1. Level 1: collect one tile type, no special tiles.
2. Level 2: collect two tile types, slightly fewer moves.
3. Level 3: introduce 4-match line clear.
4. Level 4: introduce 5-match supply burst.
5. Level 5: mixed objectives with stronger cascade opportunities.

Keep v1 to a small authored set. Procedural infinite levels can come later.

## Special Tiles

Start conservative.

V1 candidates:

- 4-match creates a line-clear tile.
- 5-match creates a supply-burst tile.
- Activating a line-clear tile clears one row or column.
- Activating a supply-burst tile clears nearby same-type or adjacent tiles.

Avoid adding too many special rules before the base cascade feel is stable.

## Controls

Primary:

- touch drag from one tile to an adjacent tile
- pointer drag on desktop

Fallback:

- tap one tile, then tap adjacent tile

Keyboard can be deferred unless desktop testing shows a need. If added, use arrow movement plus Enter/Space selection.

No D-pad or joystick is recommended. Direct board interaction is the expected match-3 control pattern.

## Layout

Recommended orientation: `portrait`.

Screen structure:

- top-left: title pill
- top-center: compact score/level/moves HUD
- top-right: Helper close/pause control
- center: stable board area
- lower area: objective summary and optional hint/action button

Board sizing:

- derive tile size from live viewport
- keep square board visible without horizontal scrolling
- preserve stable tile boxes during animation
- reserve enough lower space for objective labels on small phones

Game home should use the current richer home-page pattern:

- full-screen background image
- Helper state controls in the top-right
- large `Play Now` button around 25% of viewport height from bottom
- hide stats when unavailable

## Effects And Animation

Use Helper `ui.game.effects.createGameEffectTimeline(...)` for lifecycle timing, not for rendering.

Recommended timelines:

- `swapEffects`: invalid swap bounce and valid swap settle
- `matchEffects`: matched tile glow/burst before removal
- `cascadeEffects`: falling/refill timing
- `scoreEffects`: short score/combo markers
- `levelEffects`: level clear celebration

Example use:

```js
const effects = createGameEffectTimeline({
  defaultDuration: 360,
  defaultEasing: "outCubic",
  reducedMotion: "respect"
});

effects.spawn({
  type: "matchBurst",
  duration: 420,
  payload: { cells: matchedCells, score: 90 }
});

effects.update(deltaMs);
effects.forEach((effect) => {
  renderEffect(effect);
});
```

Games should keep payloads flat or treat nested payloads as immutable. Use `autoRemove: false` only when final `progress: 1` rendering is required before manual removal.

## Rendering

Use canvas for the board and effects unless DOM buttons/cards prove simpler during prototype.

Draw order:

1. background board frame
2. tile shadows/backplates
3. tiles
4. active swap/fall offsets
5. match bursts and score effects
6. selection outline or hint pulse
7. overlay states

Tiles should have clear silhouettes and color differences. Do not rely on color alone; include simple abstract symbols. Avoid tiny text or initials as the primary tile identity, and do not use detailed literal item art that becomes unreadable on a small `7 x 7` mobile board.

## State Flow

Use the established game session flow:

1. Launcher creates session.
2. Busy overlay loads module/assets.
3. Splash shows `Enter Game`.
4. Home page shows `Play Now`.
5. Countdown starts after `Play Now`.
6. Gameplay starts only after countdown.
7. Close control acts as pause while playing.
8. Pause overlay offers resume, restart, and home.
9. Level clear offers next level and home.
10. Game over offers retry and home.

The module must follow:

```js
export function mountGame(session, options) {
  return {
    start() {},
    destroy() {}
  };
}
```

Additional `pause`, `resume`, and `restart` methods are allowed if the launcher/session code can use them, but they should not become required by the launcher contract.

## HUD

Recommended active HUD:

- top center: `Score N Lv N`
- moves: visually prominent but compact, e.g. `Moves 14`
- objective: small row/card below board or under score

Avoid a large modal card for routine match and score feedback. Use animation and floating-style canvas text instead.

## Sound

Sound can remain optional and off by default if the current game sound policy requires it.

If added later:

- swap
- invalid swap
- match clear
- cascade
- level clear

Use local Helper audio plumbing only. No remote sounds.

## Implementation Checklist

- [ ] Create `games/supply-shuffle/index.php`.
- [ ] Create `games/supply-shuffle/module.js`.
- [ ] Add local placeholder or final assets under `games/supply-shuffle/assets/`.
- [ ] Add registry entry with `enabled` decision explicitly set.
- [ ] Add launch metadata: objective, controls, splash/home images.
- [ ] Implement declarative `LEVEL_DEFINITIONS`.
- [ ] Implement board initialization without starting gameplay during mount.
- [ ] Implement tile swap validation.
- [ ] Implement match detection for horizontal and vertical groups.
- [ ] Implement clear, fall, and refill cascades.
- [ ] Implement objective tracking and moves limit.
- [ ] Implement score and level progression.
- [ ] Use `createGameEffectTimeline(...)` for match/cascade/score/level-clear timing.
- [ ] Implement responsive portrait board layout.
- [ ] Implement touch and pointer direct board interaction.
- [ ] Implement splash, home, countdown, pause, level-clear, and game-over flows.
- [ ] Run `node --check games\supply-shuffle\module.js`.
- [ ] Run `php -l games\supply-shuffle\index.php`.
- [ ] Run `php -l config\games.registry.php`.
- [ ] Run `php health.php`.
- [ ] Verify launcher, splash, home, countdown, play, pause, restart, home, win, and loss on desktop.
- [ ] Verify mobile portrait layout and direct tile controls.

## Acceptance Criteria

- Survival appears in the launcher only if enabled in the registry.
- The game does not start automatically on launch.
- The board fits mobile portrait without horizontal scrolling.
- Direct tile interaction is comfortable on small screens.
- Invalid swaps are visibly rejected.
- Valid matches clear, cascade, and refill cleanly.
- Cascades cannot create duplicate or lost board state.
- Level objectives update correctly.
- Level clear and game-over flows use existing game state patterns.
- No external network requests are introduced.
- No Helper internals are patched inside Games.

## Recommendation

Proceed with Survival as a new app-owned quick game after the Helper game effects vendor refresh is merged. Keep v1 narrow: one polished match-3 loop, a small declarative level set, direct touch controls, and strong but simple effect feedback. Use the implementation to test whether `createGameEffectTimeline(...)` is sufficient before asking Helper for floating text, tween, or match-grid primitives.
