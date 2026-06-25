# Pac-Man Implementation Checklist

## Status

Current phase: first playable implementation.

Helper dependency status:

- [x] Helper agreed to `ui.game.grid` V1 boundary.
- [x] Helper implemented `ui.game.grid` V1 on PR #4.
- [x] Helper confirmed updated PR #4 commit is `d194ae7`.
- [x] Helper confirmed Games module consumption contract: `options.helper["./ui.game.grid.js"]`.
- [x] Helper fixed the `createGridMover` target convergence issue in PR #4 commit `5ed4e1b`.
- [x] Helper added `createGridMover` `preTurnTolerance` in PR #4 commit `dbbab75`.
- [x] Helper added `createGridMover().moveTowardCell(row, column)` in PR #4 commit `1abaf78`.
- [x] Helper changed `moveTowardCell(row, column)` to exact-stop by default in PR #4 commit `d194ae7`.
- [x] Games completed consumer-side review of Helper PR #4 and reported approval in chat message `db-1000`.
- [x] Helper PR #4 merged to Helper main at merge commit `99267f6`.
- [x] Games vendored Helper main game dist after PR #4 merge.

Temporary development option:

- [x] If Pac-Man starts before Helper PR #4 merge, temporarily vendor PR #4 bundle from commit `d194ae7`.
- [x] Mark temporary bundle usage clearly in the implementation notes.
- [x] Refresh Games vendored Helper game bundle again after PR #4 merge.
- [x] Report Helper `createGridMover` target convergence issue discovered during Pac-Man testing.
- [x] Replace the temporary snap-to-target guard with an app-local smooth mover while Helper PR #4 was still draft.
- [x] Replace the app-local smooth mover with Helper `createGridMover` after Helper added `preTurnTolerance` and `moveTowardCell`.
- [x] Remove the app-local post-`moveTowardCell` stop workaround after Helper made exact-stop the default.

## Reference Docs

- [x] Pac-Man proposal: `docs/pacman-game-proposal.md`
- [x] Helper grid primitives proposal: `docs/helper-grid-maze-game-primitives-proposal.md`
- [x] Helper collectible/animator adoption proposal: `docs/helper-collectible-animator-adoption-proposal.md`
- [x] Snake upgrade proposal: `docs/snake-collectible-animator-upgrade-proposal.md`
- [x] Breakout upgrade proposal: `docs/breakout-animator-powerups-upgrade-proposal.md`
- [x] Pac-Man reference guidance: `docs/pacman-reference-guidance.md`

## Scope For Pac-Man V1

- [x] Add an original Pac-Man-style quick game without copyrighted Pac-Man assets, names, sounds, or maze layouts.
- [x] Use PBB/barangay supply-run theme.
- [x] Use one original maze layout.
- [x] Use Helper `createGridMaze`.
- [x] Use Helper `createGridMover`.
- [x] Use Helper `createGridMover` `preTurnTolerance` for mobile turns.
- [x] Use Helper `createGridPathfinder`.
- [x] Keep scoring, lives, power mode, patrol behavior, collectibles, rendering, and sounds app-owned.
- [x] Keep collectible and animation code app-local for V1 unless Helper V1.1 exists before implementation.

## Files To Add

- [x] `games/pacman/index.php`
- [x] `games/pacman/module.js`
- [x] `games/pacman/assets/splash.png`
- [x] `games/pacman/assets/home.png`
- [x] `games/pacman/assets/icon.png`

## Registry

- [x] Add `pacman` entry to `config/games.registry.php`.
- [x] Category: `quick`.
- [x] Subcategory: `arcade`.
- [x] Tags include `offline`, `quick`, and `mobile-friendly`.
- [x] `requires_keyboard` is `false`.
- [x] `supports_touch` is `true`.
- [x] Choose initial orientation, likely `portrait` or `any` after layout testing.
- [x] Add launch objective.
- [x] Add launch controls: touch D-pad, keyboard arrows, pause/restart.
- [x] Add splash/home/icon asset paths.
- [x] Set display order relative to existing quick games.

## Game Module Contract

- [x] Export `mountGame(session, options = {})`.
- [x] Read core helpers from `options.helper["./ui.game.core.js"]`.
- [x] Read grid helpers from `options.helper["./ui.game.grid.js"]`.
- [x] Return controller with `start()`, `pause()`, `resume()`, `restart()`, and `destroy()`.
- [x] Do not start active gameplay during mount.
- [x] Call `options.onStateChange?.("playing")` on reset/start readiness.
- [x] Call `options.onStateChange?.("won", detail)` when maze is cleared.
- [x] Call `options.onStateChange?.("gameOver", detail)` when lives are exhausted.
- [x] Route keyboard pause through `options.requestPause?.()`.

## Layout And Controls

- [x] Use one canvas layer: `session.addLayer({ id: "pacman-board", zIndex: 1, smoothing: false })`.
- [x] Derive all board geometry from live canvas dimensions.
- [x] Keep the full maze visible on phone screens.
- [x] Reserve top space for HUD.
- [x] Reserve bottom space for touch controls.
- [x] Use Helper `createTouchControlPad` with four directions.
- [x] Queue direction changes immediately from touch controls.
- [x] Support arrow-key direction queueing.
- [x] Prevent browser gesture interference while mounted.
- [x] Clean up controls and event listeners in `destroy()`.

## Maze

- [x] Define an original character-map maze.
- [x] Define tile metadata for walls, paths, supplies, power supplies, player spawn, patrol spawn, and optional tunnels.
- [x] Build maze with `createGridMaze`.
- [x] Render walls and paths from maze data.
- [x] Add a visible central patrol base with dedicated spawn/respawn cells.
- [x] Confirm wall collision prevents illegal movement.
- [x] Confirm grid-to-pixel centering is stable after resize.
- [ ] Add optional tunnel/wrap only after base maze movement is stable.

## Player Movement

- [x] Create player mover with `createGridMover`.
- [x] Remove app-local smooth mover fallback after Helper parity.
- [x] Use queued direction behavior.
- [x] Turn only when the queued direction is legal.
- [x] Keep movement speed tuned for phone controls.
- [x] Reset player to spawn after life loss.
- [x] Preserve collected supplies after life loss.

## Collectibles

- [x] Initialize supply dots from maze data.
- [x] Initialize power supplies from maze data.
- [x] Collect supplies when player reaches the cell.
- [x] Update score on collection.
- [x] Track remaining supplies.
- [x] Trigger win when all required supplies are collected.
- [x] Keep collectible state app-local but shaped similarly to future `createCollectibleLayer`.

## Patrols

- [x] Add at least one patrol for the first playable version.
- [x] Start with four patrols in the central base.
- [x] Use `createGridPathfinder` for generic next-step decisions.
- [x] Keep patrol behavior app-owned.
- [x] Add simple behavior states: chase and frightened.
- [x] Prevent patrols from entering walls.
- [x] Preserve patrol positions and behavior after player life loss.
- [x] Route eaten patrol eyes back to the central patrol base before revival.
- [x] Tune patrol speed separately from player speed.

## Reference-Guided Tuning

- [x] Add pre-turn tolerance so queued mobile turns can happen slightly before exact cell centers.
- [x] Add scatter/chase patrol timers after base movement and collision remain stable.
- [x] Prevent patrols from reversing direction except during clear mode changes.
- [x] Give each patrol a distinct target rule instead of identical direct chase.
- [x] Add a maze reachability validation check for future maze edits.
- [ ] Consider subtle dot-eat slowdown only after the mobile difficulty curve is tested.
- [ ] Add a power-mode warning flash before power expires.

## Power Mode And Lives

- [x] Start with 3 lives.
- [x] Losing contact while not powered costs one life.
- [x] Contact while powered sends patrol eyes back to spawn, revives there, and awards bonus score.
- [x] Power mode has a visible timer or clear visual state.
- [x] Power mode expires cleanly.
- [x] Game over triggers only when lives reach 0.

## Rendering And Feedback

- [x] Draw background texture.
- [x] Draw maze walls/paths.
- [x] Draw supplies and power supplies.
- [x] Draw player.
- [x] Draw patrols.
- [x] Draw powered/frightened state clearly.
- [x] Add simple app-local animation shaped like future `createSpriteAnimator`.
- [x] Keep all visuals readable on mobile.
- [x] Avoid visual clutter around controls and HUD.

## Audio

- [x] Use existing game sound interface from `options.sound`.
- [x] Play `move` sparingly, if at all, to avoid noisy continuous movement.
- [x] Play `score` on supply or power supply collection.
- [x] Play `error` or `lose` flow on life loss if appropriate.
- [x] Let launcher handle `win`, `lose`, `pause`, and `select` where already centralized.

## Pause, Resume, Restart, Destroy

- [x] `pause()` freezes movement, timers, patrols, effects, and sounds owned by the game.
- [x] `resume()` continues from the frozen state.
- [x] `restart()` resets maze state, score, lives, player, patrols, timers, and HUD.
- [x] `destroy()` stops loop and removes every event listener/control/root element.
- [x] Closing the session does not leave active animation frames or timers.

## Verification

Desktop:

- [x] Launch from Games Corner grid.
- [x] Launch direct page route.
- [x] Keyboard movement works.
- [ ] Pause/resume/restart works.
- [ ] Win state works.
- [ ] Game-over state works.

Mobile:

- [x] Phone portrait layout is playable.
- [ ] Phone landscape layout is playable or intentionally unsupported by registry orientation.
- [x] Touch controls do not overlap maze or state actions.
- [x] Direction queueing feels responsive.
- [x] Fullscreen/orientation behavior matches existing launcher behavior.

Regression:

- [x] Snake still launches.
- [x] Memory still launches.
- [x] Breakout still launches.
- [x] Tetris still launches.
- [x] Homepage grid still works.
- [x] No external network requests are introduced.

## Post-V1 Follow-Ups

- [ ] Replace app-local collectibles with Helper `createCollectibleLayer` after Helper V1.1 exists.
- [ ] Replace app-local animation timing with Helper `createSpriteAnimator` after Helper V1.1/V2 exists.
- [x] Use Pac-Man findings to refine Snake collectible upgrade with app-local Helper-shaped layer.
- [x] Use Pac-Man animation findings to refine Breakout animator upgrade with app-local effect instances.
- [ ] Add additional maze layouts only after V1 is stable.
