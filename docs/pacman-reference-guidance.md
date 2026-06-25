# Pac-Man Reference Guidance

Source reviewed: https://pacman.holenet.info/

This is guidance for improving PBB Games Corner's original `Supply Run` maze game. Do not copy Pac-Man assets, original maze layouts, names, sounds, or branding. Use the source only to understand why the classic movement and enemy behavior feel good.

## Useful Mechanics To Adopt

### Movement

- Keep movement tile-based but render at sub-cell precision.
- Player input should be queued before an intersection.
- The player should be allowed to turn slightly before the exact cell center.
- Patrols should make turn decisions at cell centers.
- The player should be slightly faster than patrols in normal play.
- Eating a dot can briefly slow or pause the player, but this should be subtle on mobile.

### Maze Rules

- Every collectible must be reachable from the player spawn.
- Actors should be tracked by their center point, even if the drawn shape overlaps nearby cells.
- Dead pockets with collectibles should be prevented by a reachability check.
- Side tunnels or safe lanes can be added later, but they should be intentional and tested.

### Patrol Behavior

- Patrols should not reverse direction freely on every decision.
- Reversal should be reserved for clear mode changes, such as chase to frightened.
- Patrols should alternate between at least two broad modes:
  - `chase`: move toward the player or a player-derived target.
  - `scatter`: move toward a personal corner or route.
  - `frightened`: move slower and less directly after a power supply.
- Different patrols should eventually have different target logic, not just identical BFS chase.

### Difficulty

- Start forgiving on mobile.
- Keep player speed higher than patrol speed.
- Make frightened patrols slower than normal patrols.
- Avoid increasing speed until base controls, maze readability, and collision timing are stable.

## Suggested Supply Run Tuning Backlog

1. Add pre-turn tolerance to the app-local smooth mover.
2. Add scatter/chase timers for patrols.
3. Prevent patrols from reversing unless a mode change forces it.
4. Give each patrol a different target rule.
5. Add a reachability validation helper for maze edits.
6. Add optional dot-eat slowdown only if the game still feels too easy.
7. Add a power-mode warning flash before power expires.

## Current Relevance

The most important near-term change is pre-turn support. Our current smooth mover is readable and no longer jumpy, but it still turns only at exact grid decisions. The classic feel depends heavily on letting the player press the next direction early and have the turn happen as soon as it becomes legal.

The second most important change is patrol mode timing. Our current patrols chase too directly. Scatter windows will make the game feel less oppressive and create openings for clearing risky areas.
