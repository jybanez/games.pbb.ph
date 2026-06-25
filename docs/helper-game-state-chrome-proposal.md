# Helper Game State Chrome Proposal

## Summary

PBB Games currently owns a reusable game session state pattern on top of Helper `createGameSession`. The pattern is now stable enough to propose as a Helper-owned game chrome contract.

The goal is not for Helper to own game rules. The goal is for Helper to own common session state, contextual top-right controls, pause/result overlays, and lifecycle events that games and future audio hooks can consume consistently.

## Current PBB Games Pattern

Games Center creates one active `createGameSession` at a time. It loads assets/modules, mounts the game, shows a splash, runs a countdown, and then starts gameplay.

Current state behavior:

- `loading`: session exists, busy overlay may be visible, top-right control exits.
- `splash`: launch splash is visible, top-right control exits.
- `countdown`: countdown overlay is visible, top-right control exits.
- `playing`: top-right control becomes Pause.
- `paused`: shared pause overlay shows `Resume`, `Restart`, and `Exit`; top-right control exits.
- `won`: result overlay shows `Play Again` and `Exit`; top-right control exits.
- `gameOver`: result overlay shows `Play Again` and `Exit`; top-right control exits.
- `exiting`: app is closing/destroying the session.

The current game module contract is:

```js
export async function mountGame(session, options) {
  return {
    start() {},
    pause() {},
    resume() {},
    restart() {},
    destroy() {}
  };
}
```

The current app passes callbacks to game modules:

```js
{
  onStateChange(nextState) {},
  requestPause() {}
}
```

This works, but the app is now owning behavior that is likely shared game infrastructure.

## Proposed Helper Ownership

Helper should own the reusable state chrome layer. Games/apps should still own game rules, scoring, canvas drawing, and when a game enters `won` or `gameOver`.

Suggested Helper responsibilities:

- Standard game session states and state transitions.
- Contextual session control behavior: close icon outside play, pause icon during play.
- Standard pause overlay with configurable actions.
- Standard result overlay with configurable title, score/detail, and actions.
- Event hooks for apps and modules.
- Accessibility semantics for pause/result overlays and contextual controls.
- Integration points for `ui.game.audio` so state changes can trigger optional sounds.

Suggested app/game responsibilities:

- Decide when gameplay starts, pauses, resumes, wins, loses, or restarts.
- Provide text/content for title, score, result detail, and action labels where needed.
- Own all game rules, rendering, collision, scoring, and persistence.
- Choose whether audio is enabled and which sounds play for game-specific events.

## Proposed State Contract

Helper should define a small stable state vocabulary:

```js
const GAME_SESSION_STATES = [
  "loading",
  "splash",
  "countdown",
  "ready",
  "playing",
  "paused",
  "won",
  "gameOver",
  "exiting"
];
```

Minimum state semantics:

- `ready`: mounted but not yet actively playing.
- `playing`: input and game loop are active.
- `paused`: game loop/input should stop or ignore gameplay updates.
- `won` and `gameOver`: terminal states until restart/exit.
- `exiting`: teardown is in progress.

## Possible Helper API Shape

One possible direction is an optional state controller layered onto `createGameSession`:

```js
const session = createGameSession(host, {
  title: game.title,
  closeLabel: "Close game",
  closeControl: { variant: "icon", icon: "actions.close" },
  stateChrome: {
    enabled: true,
    initialState: "loading",
    pauseControl: {
      icon: "media.pause",
      label: "Pause game"
    },
    overlays: {
      pause: {
        title: "Paused",
        actions: ["resume", "restart", "exit"]
      },
      result: {
        actions: ["restart", "exit"]
      }
    },
    onAction(action, context) {
      // app decides how to invoke controller.pause/resume/restart/exit
    },
    onStateChange(state, previousState, context) {}
  }
});
```

Potential session API additions:

```js
session.setGameState("playing");
session.getGameState();
session.showPauseOverlay(options);
session.showResultOverlay({
  state: "gameOver",
  title: "Game Over",
  detail: "Score 12"
});
session.setContextControl("pause" | "close");
```

An alternative is a separate helper:

```js
const stateChrome = createGameStateChrome(session, {
  initialState: "loading",
  onAction(action, context) {}
});

stateChrome.setState("playing");
stateChrome.showResult({ state: "won", title: "Cleared" });
stateChrome.destroy();
```

The separate helper may be easier to add without increasing the `createGameSession` option surface too much.

## Event And Action Model

Suggested standard actions:

- `pause`
- `resume`
- `restart`
- `exit`
- `playAgain`

Suggested event payload:

```js
{
  action: "restart",
  state: "paused",
  previousState: "playing",
  source: "pause-overlay",
  session
}
```

Helper should not directly call game controller methods unless the app explicitly wires them. The app should remain the owner of controller lifecycle.

## Audio Relationship

This proposal should be coordinated with `ui.game.audio`.

State-level sounds can be optional and app-controlled:

- `pause` when entering `paused`.
- `win` when entering `won`.
- `lose` when entering `gameOver`.
- `select` for overlay action selection.

Helper should provide hooks, not force sound:

```js
createGameStateChrome(session, {
  audio,
  sounds: {
    paused: "pause",
    won: "win",
    gameOver: "lose",
    action: "select"
  },
  muted: true
});
```

PBB Games should keep sound opt-in and provide a user-visible mute control before enabling sounds broadly.

## Migration Path For PBB Games

1. Keep the current app-side implementation until Helper has a first-class contract.
2. Use this proposal to align state names and actions with Helper.
3. After Helper ships the state chrome helper, migrate Games Center from app-local pause/result overlay code.
4. Keep existing game module controller methods: `start`, `pause`, `resume`, `restart`, `destroy`.
5. Add audio only after the state contract and mute behavior are settled.

## Open Questions

- Should state chrome live inside `createGameSession` or as `createGameStateChrome(session, options)`?
- Should Helper provide default pause/result overlay DOM, or only state/control plumbing?
- Should `restart` and `playAgain` be separate actions or aliases?
- Should Helper own keyboard shortcuts like `Escape`/`P`, or should apps keep those?
- Should audio hooks be part of state chrome or kept entirely app-side?
