# Sector Wing V2 Upgrade Proposal

## Summary

Sector Wing V1 is playable and has the right foundation for an arcade side-scroller: fullscreen game session, splash/home flow, responsive canvas, joystick and fire controls, lives, shield, energy, projectiles, pickups, level definitions, route-clear flow, and a guardian encounter.

The V2 goal is not to rebuild the game. V2 should make the existing loop feel faster, clearer, and more rewarding through stronger motion feedback, richer combat effects, clearer level structure, distinct enemy behaviors, and more exciting route-clear moments.

Sector Wing should stay original in visual language. It can use classic side-scrolling shooter principles as a genre reference, but it should not copy Gradius, Star Trek, or any other franchise-specific presentation.

## Current State

Runtime: `games/sector-wing/module.js`

Current behavior:

- Responsive side-scrolling canvas stage.
- Player ship can move freely inside the stage.
- Keyboard and touch controls are supported.
- Fire button consumes energy.
- Energy regenerates over time.
- Shield absorbs damage before life loss.
- Player has 3 lives.
- Energy and shield pickups spawn during play.
- Hazards, basic enemies, projectiles, and a guardian/boss are implemented.
- Level definitions tune duration, spawn cadence, speed, pickups, and boss behavior.
- Route clear advances levels or ends the run.
- Pause, restart, home, game-over, and route-clear state flows are already wired.

Already proven:

- Sector Wing can host custom canvas rendering without additional runtime assets.
- The current HUD can show title, lives, score, level, energy, and shield.
- App-local effects can handle bursts, text popups, respawn arrival, and route-clear transitions.
- Helper participation is not required for the first V2 implementation pass.

## V2 Goals

- Make moment-to-moment play feel faster and more alive.
- Improve combat feedback: enemy hit, enemy destroy, player hit, and pickup events should be obvious.
- Add distinct enemy behaviors so the player has to react differently.
- Add 1-2 temporary power-ups that change how the player attacks or survives.
- Make levels feel like named route segments instead of only tuning changes.
- Improve route-clear and guardian-clear payoff.
- Keep controls simple and readable on mobile landscape.
- Preserve the existing game module contract.

## Non-Goals

- No external art dependencies.
- No franchise-specific visuals or copied enemy/ship designs.
- No multiplayer, leaderboard, account persistence, or rewards economy in this pass.
- No complex shop, inventory, or upgrade tree.
- No Helper internals patched inside Games.
- No full shooter engine extraction in V2.

## Proposed Level Model

Keep levels declarative, but add a clearer route-segment structure. A level should describe route pacing, waves, pickups, hazards, and optional guardian behavior.

Suggested shape:

```js
const LEVEL_DEFINITIONS = [
  {
    id: "sector-1",
    level: 1,
    title: "Outer Lane",
    duration: 34,
    scrollSpeed: 1,
    spawnEvery: 1.16,
    energyEvery: 6.5,
    shieldEvery: 15,
    hazardSpeed: 1,
    enemySpeed: 1,
    powerups: {
      spread: { chance: 0.08, ttl: 7 },
      overcharge: { chance: 0.06, ttl: 6 }
    },
    segments: [
      { id: "opening-run", from: 0, to: 8, pattern: "light" },
      { id: "hazard-field", from: 8, to: 18, pattern: "hazards" },
      { id: "enemy-wave", from: 18, to: 30, pattern: "mixed" },
      { id: "exit-lane", from: 30, to: 34, pattern: "clear" }
    ],
    boss: null
  }
];
```

The first implementation does not need a complicated wave scheduler. It can keep the current spawn timers and use segment data to bias spawn choices, enemy types, effect intensity, and route progress display.

## Gameplay Changes

### Route Progress

Add a small route progress indicator so players understand the objective.

Recommended first pass:

- HUD text remains compact: `Score 825 Lv 1`.
- Add a subtle progress rail or compact label: `Route 42%`.
- On level clear, show `Sector Clear` with stronger animation.

### Enemy Types

V2 should add simple, readable enemy archetypes.

Recommended first pass:

- `drone`: current baseline target, slow straight motion.
- `weaver`: moves left while oscillating vertically.
- `interceptor`: enters from the right and drifts toward the player's current y-position.
- `guardian`: existing boss-style enemy, improved as a set-piece.

Each enemy type should have:

- distinct color/accent
- clear hit radius
- score value
- health
- optional movement parameters

Example:

```js
const ENEMY_TYPES = {
  drone: {
    health: 1,
    score: 50,
    speed: 1,
    color: "#a78bfa"
  },
  weaver: {
    health: 1,
    score: 75,
    speed: 1.08,
    weave: 34,
    color: "#ff8bd1"
  },
  interceptor: {
    health: 2,
    score: 120,
    speed: 1.18,
    trackStrength: 0.42,
    color: "#ffd166"
  }
};
```

### Combat Feedback

Enemy hits should no longer feel like silent overlap checks.

Add:

- hit flash on enemy impact
- small spark burst on hit
- larger explosion on enemy destroy
- short score popup near the destroyed enemy
- minor screen shake only for large explosions, guardian hits, or player damage

Avoid modal cards for normal combat feedback.

### Power-Ups

Add two temporary power-ups in V2.

Recommended first pass:

- `spread`: fire three shots in a shallow fan for a short duration.
- `overcharge`: reduce fire energy cost and add brighter projectile trails.

Optional later:

- `shield-overcharge`: temporary shield cap increase.
- `magnet`: nearby pickups drift toward the player.

Power-up rules:

- Pickups should be rare enough to feel special.
- A small HUD pill or timed ring should show the active power-up.
- Power-ups should end automatically and cleanly on pause/home/destroy.

### Player Damage And Life Loss

Improve damage readability:

- shield impact ring around the ship
- brief ship flicker or chromatic pulse on hit
- low-shield warning pulse when shield is under 25%
- life-loss explosion before respawn arrival
- re-entry materialization effect should remain, but feel brighter and more intentional

### Route Clear And Guardian Clear

Route clear should feel like a reward moment:

- freeze spawning briefly
- sweep the stage forward
- show a bright route-clear wave
- show `Sector Clear` as a non-blocking milestone, not a plain toast
- carry remaining shield/energy into the next level when appropriate

For guardian levels:

- show a compact guardian health bar
- announce guardian entry with a warning pulse
- make guardian destruction larger than normal enemy destruction
- use route clear only after guardian is defeated

## Visual Direction

The recording shows the game is readable, but the playfield can feel sparse between encounters. V2 should add visual energy without sacrificing clarity.

Recommended additions:

- parallax star layers moving at different speeds
- occasional speed streaks or lane traces
- ship tilt/banking when moving vertically
- stronger engine glow while moving
- projectile trail glow
- pickup idle pulse and pickup collection burst
- subtle background route rails that react during route-clear

Keep the existing dark cyan/blue/yellow palette. Avoid making the screen noisy on mobile.

## HUD Direction

Keep the HUD compact:

- Top-left: `Sector Wing` and life icons.
- Top-center: `Score N Lv N`.
- Top-right: energy and shield bars plus pause icon.
- Optional route progress as a thin rail or small label near the score.

Avoid adding large permanent panels. The game is a full-screen action game, so HUD should stay light.

## Sound Direction

If current game sound hooks are available and stable, V2 can add or refine short local sound cues:

- fire
- enemy hit
- enemy destroy
- pickup
- shield hit
- life loss
- route clear
- guardian entry

Do not add continuous looping audio unless it is easy to pause, resume, mute, and stop reliably.

## Helper Participation

No Helper change is required for Sector Wing V2.

Use app-local implementations for:

- enemy type definitions
- projectile trails
- particle bursts
- hit flashes
- screen shake
- temporary power-up timers
- route progress

Potential future Helper extraction candidates:

- reusable effect timeline helper
- generic particle/effect lifetime manager
- non-blocking milestone helper improvements
- sprite animation helper

Do not block V2 on those extractions.

## Implementation Plan

### Phase 1: Structure And Safety

- Keep `id` and path as `sector-wing`.
- Keep title as `Sector Wing`.
- Preserve `export function mountGame(session, options)`.
- Add declarative enemy type definitions.
- Add declarative segment data to level definitions.
- Ensure pause, home, restart, countdown, and destroy cleanup still work.

### Phase 2: Visual Feedback

- Add enemy hit flash state.
- Add enemy destroy burst.
- Improve score popups.
- Add projectile trails.
- Add shield impact ring.
- Add limited screen shake.

### Phase 3: Enemy Variety

- Implement drone, weaver, and interceptor.
- Bias enemy type by level segment.
- Keep hitboxes readable and forgiving.
- Verify spawn density on mobile landscape.

### Phase 4: Power-Ups

- Add spread shot.
- Add overcharge.
- Show compact active power-up HUD.
- Ensure power-ups expire on time and reset correctly on home/restart/game-over.

### Phase 5: Route And Guardian Payoff

- Add route progress.
- Improve route-clear milestone.
- Add guardian entry warning and health bar.
- Improve guardian destroy effect.

## Acceptance Criteria

- Sector Wing remains playable on desktop and mobile landscape.
- Controls remain responsive with joystick/keyboard and fire button.
- HUD does not overlap controls or gameplay-critical objects.
- Enemy types are visually distinct and behaviorally different.
- Player can identify damage, pickup, enemy destroy, and route clear events without reading text.
- Power-ups are temporary, visible, and cleaned up on pause/home/restart.
- Route clear and guardian clear feel more significant than normal combat.
- No external assets or remote dependencies are introduced.
- `node --check games\sector-wing\module.js` passes.
- `php -l games\sector-wing\index.php` passes.
- `php -l config\games.registry.php` passes if registry changes are made.
- `php health.php` passes.
- Browser smoke checks cover launcher, splash, home, countdown, play, pause, home, restart, route clear if practical, and game over if practical.

## Risks

- Too many particles can reduce readability on small screens.
- Screen shake can become annoying if used for normal hits.
- Power-ups can make tuning too easy if they spawn too often.
- Interceptor tracking can feel unfair if it reacts too quickly.
- Guardian mechanics can become too large for a V2 polish pass if not kept simple.

Mitigation:

- Keep effects short.
- Cap active particles.
- Keep collision bounds forgiving.
- Tune mobile first.
- Add one feature at a time and verify after each phase.

## Agent Implementation Notes

An implementation agent should begin by reading:

- `docs/agent-working-protocol.md`
- `docs/sector-wing-v2-upgrade-proposal.md`
- `games/sector-wing/module.js`
- `config/games.registry.php`

The agent should start from latest `main` and use a branch such as:

```text
game/sector-wing-v2
```

The first implementation should prioritize:

1. Enemy hit/destroy feedback.
2. Enemy variety.
3. Route progress and clearer route-clear milestone.
4. One or two power-ups only if the first three items are stable.

The agent should not refresh Helper, edit Helper internals, or change unrelated games as part of this task.

## Recommendation

Proceed with Sector Wing V2 as a focused arcade-polish pass after the current docs branch lands. The highest-value improvements are combat feedback, enemy variety, route progress, and route-clear payoff. These changes should make Sector Wing feel substantially more alive while keeping the implementation bounded and app-owned.
