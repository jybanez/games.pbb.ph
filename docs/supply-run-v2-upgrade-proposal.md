# Supply Run V2 Upgrade Proposal

## Summary

Supply Run is already the richest quick game in the current set. It uses Helper grid primitives, a responsive maze, central patrol base, four patrol drones, supplies, power kits, lives, and custom rendering. V2 should build on that foundation by adding mission-style progression, clearer patrol/supply feedback, level layouts, and stronger win/loss moments.

The game should still feel like a fast Pac-Man-inspired supply collection game, but V2 should make each run feel like a mission through a barangay emergency route.

## Current State

Runtime: `games/pacman/module.js`

Current behavior:

- Fixed declarative maze map in `MAZE_MAP`.
- Helper `createGridMaze`, `createGridMover`, and `createGridPathfinder`.
- Four patrol drones with scatter/chase/frightened/returning/reviving behavior.
- Supplies and power kits are generated from map collectibles.
- Player has 3 lives.
- Power kits let the player send patrols back to base.
- Win state happens when all normal supplies are collected.
- Game over happens when lives reach zero.
- HUD shows score and lives.
- Controls use Helper touch D-pad and keyboard arrows.

## V2 Goals

- Add declarative mission/level definitions.
- Add clearer objective progress: supplies remaining, lives, level, and optional power timer.
- Add more readable patrol states and collision feedback.
- Add richer collection feedback and route-clear celebration.
- Add level progression after route clear.
- Keep maze movement and pathfinding Helper-owned.
- Keep game rules and tuning app-owned.

## Non-Goals

- No account-based campaign progression.
- No global rewards economy.
- No multiplayer or leaderboard.
- No random maze generator in V2.
- No real incident/operational data.
- No Helper internal patches inside Games.

## Proposed Level Model

Supply Run should use fixed declarative mission levels. Each level owns its map, tuning, supply values, patrol count, and objective text.

Suggested shape:

```js
const LEVEL_DEFINITIONS = [
  {
    id: "route-alpha",
    level: 1,
    title: "Route Alpha",
    objective: "Collect all supply markers",
    map: MAZE_MAP_LEVEL_1,
    lives: 3,
    playerSpeed: 4.4,
    patrolLimit: 4,
    patrolSpeedBase: 3.25,
    powerDuration: 7,
    supplyValue: 10,
    powerValue: 50
  }
];
```

Initial V2 can ship with two or three authored maps:

- Level 1: current route, baseline difficulty.
- Level 2: more intersections, slightly faster patrols.
- Level 3: tighter supply placement and shorter power duration.

If new maps are too much for the first pass, V2 can keep the same map and vary tuning. However, the level definition should still support per-level maps.

## Gameplay Changes

### Mission Progress

Track:

- current level
- score
- lives
- supplies remaining
- power mode time remaining

Recommended HUD:

- Top-center: `Score 420  Lv 2`
- Right-side or compact badge if space allows: `Supplies 12`
- Lives can remain in HUD text until a future icon row is available.

### Route Clear

When all normal supplies are collected:

- Freeze movement briefly.
- Show a route-clear effect following parts of the maze path.
- Show large `Route Clear` milestone and bonus points.
- Advance to next level if one exists.
- If final level is cleared, show Helper `won` result.

### Patrol Feedback

Patrol states should be more legible:

- Chase/scatter: patrol color remains distinct.
- Frightened: patrol body shifts to cooler blue/white and scan cone weakens.
- Returning: drone becomes semi-transparent and follows base route.
- Reviving: base pulses before drone re-enters.

Collision feedback:

- Player hit should show a short red pulse and respawn ring.
- Patrol sent back to base should show a score popup and return trail.

### Supply Feedback

Normal supply:

- small green pulse
- small score popup on collect

Power kit:

- larger gold pulse
- brief screen edge glow or maze glow
- power timer badge if readable

## Visual Direction

Supply Run should feel like a guided night route through barangay response zones.

Recommended effects:

- Path grid emits subtle blue line glow.
- Collectibles have clearer icons or shape differences.
- Power mode adds an animated blue/gold overlay on the route.
- Route clear traces a bright line through collected corridors.
- Drones have clearer scan cones and state-specific glow.

Avoid:

- Making patrols too detailed at phone scale.
- Visual noise that hides wall/path readability.
- Long route-clear animation before the next level.

## Controls

Current D-pad works, but Supply Run should be reviewed against the newer joystick preference from game testers.

Recommended V2 decision:

- Keep D-pad for the first V2 pass because grid movement maps directly to cardinal directions.
- Add optional swipe-to-turn on the stage if playtesting shows D-pad feels slow.
- Do not switch to joystick without testing, because analog joystick can introduce ambiguity at intersections.

If the product wants consistency with Snake:

- Use Helper `createVirtualJoystick({ visibility: "ghost" })`.
- Snap joystick output to cardinal directions.
- Keep keyboard arrows.

## Audio

Use existing Helper starter sounds:

- `move`: optional, very low volume at turns only.
- `score`: normal supply.
- `match` or brighter score: power kit.
- `error`: life lost.
- `win`: route clear.
- `lose`: game over.

Power mode can optionally loop a very quiet pulse if Helper audio supports it cleanly later. Do not add continuous audio in V2 unless it is easy to stop on pause/home.

## Persistence And Metrics

Version 2 should remain session-only unless local progress persistence is approved separately.

Future local progress candidates:

- best score
- highest route level cleared
- fewest lives lost on Level 1
- total supplies collected

Metric monitoring candidates:

- game started
- route level reached
- route clear count
- average lives remaining at route clear
- game over count
- power kit usage count

Avoid:

- storing raw player routes
- storing exact movement paths
- storing named user or incident data

## Helper Relationship

No Helper change is required to implement Supply Run V2.

Current Helper dependencies remain:

- `createGameLoop`
- `createTouchControlPad`
- `createGridMaze`
- `createGridMover`
- `createGridPathfinder`

Possible future Helper requests:

- reusable grid collectible layer for map collectibles
- reusable grid effect/route tracer
- reusable milestone animation display
- optional control abstraction that can switch D-pad, joystick, or swipe by game config

Games should not patch Helper internals for this work.

## Implementation Plan

1. Add `LEVEL_DEFINITIONS` and move current `MAZE_MAP` into level 1.
2. Initialize maze, pathfinder, supplies, actors, and tuning from the current level.
3. Update HUD with score, level, lives, and supplies remaining.
4. Add score popups for supplies and power kits.
5. Add power-mode visual treatment and optional power timer badge.
6. Add life-lost pulse and improved respawn ring.
7. Add route-clear milestone and level transition.
8. Add level 2 tuning, then level 2 map if scope allows.
9. Add final route-cleared win state after the last level.
10. Test mobile portrait, keyboard, D-pad, pause/resume, restart, home exit, route clear, and game over.

## Acceptance Criteria

- Supply Run remains playable on mobile portrait.
- Player can clearly see current level, score, lives, and route progress.
- Patrol states are visibly distinct.
- Power mode is obvious but not visually noisy.
- Route clear advances to the next level or final win state.
- Restart resets current session from Level 1.
- Pause freezes movement, timers, patrols, and effects.
- No controls overlap the board or HUD.
- No Helper vendor refresh is mixed into the branch unless explicitly needed.

## Risks

- Multiple maps can expand scope quickly.
- Patrol tuning can become unfair if speed increases too fast.
- Route-clear animation can interfere with the expected state chrome flow.
- D-pad versus joystick choice may need another mobile test round.

## Recommendation

Do Supply Run V2 after Snake V2 unless we specifically want to test multi-level maze progression first. Snake is the lower-risk place to refine collectible and milestone effects; Supply Run is the better place to validate mission levels, route-clear transitions, and richer progression once the visual language is settled.
