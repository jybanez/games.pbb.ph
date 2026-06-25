# Game Rewards System Proposal

## Summary

PBB Games should treat rewards as lightweight feedback for play and learning, not as a competitive economy. Rewards should be separate from lifecycle state and separate from leveling rules.

The rewards system should listen to game events such as progress updates, level completion, wins, and learning milestones. It should grant local, rights-safe, privacy-safe rewards such as badges, medals, completion stamps, and cosmetic unlocks.

## Goals

- Encourage exploration of Games Corner without creating pressure or competition.
- Reward learning-game completion and meaningful skill milestones.
- Keep reward rules app-owned and transparent.
- Avoid player identity, server storage, analytics, and leaderboards in version 1.
- Provide a future path for anonymous local-only collections.
- Allow Helper to later render reward toasts, badges, and galleries without owning reward criteria.
- Separate reward persistence from aggregate reward metric monitoring.

## Non-Goals

- No money, tokens, coupons, raffles, or real-world value.
- No loot boxes, random paid rewards, streak pressure, or manipulative retention loops.
- No public leaderboards.
- No personal profiles in version 1.
- No rewards that affect emergency response priority or operational access.
- No cross-app rewards until Kit/Landing privacy and storage rules are defined.
- No personalized engagement analytics.
- No remote reward telemetry in version 1.

## Reward Types

Recommended V1-compatible reward types:

- `badge`: earned for a named achievement.
- `medal`: earned for performance tier within a session.
- `stamp`: earned for completing a learning topic.
- `unlock`: local cosmetic or visual option.
- `certificate`: future printable/local-only completion artifact, if approved.

Examples:

- Snake badge: `Supply Collector`, score 10.
- Memory badge: `Prepared Pairing`, match all pairs under a move target.
- Breakout medal: `Clear Board`, clear all blocks.
- Tetris badge: `Line Crew`, clear 10 lines.
- Learning stamp: `Emergency Kit Basics`, finish the quiz.

## Reward Definition Shape

Reward definitions should be explicit and local:

```js
{
  id: "tetris-line-crew",
  gameId: "tetris",
  type: "badge",
  title: "Line Crew",
  description: "Clear 10 lines in one Tetris session.",
  icon: "blocks",
  tone: "info",
  criteria: {
    event: "progress:update",
    where: { lines: { gte: 10 } }
  },
  visibility: "visible",
  persistence: "session"
}
```

Definitions can live in a game directory or a central rewards registry once there are enough rewards to justify it.

## Reward Grant Shape

When a reward is earned, the app should create a reward grant:

```js
{
  id: "grant-uuid-or-local-id",
  rewardId: "tetris-line-crew",
  gameId: "tetris",
  grantedAt: "2026-06-24T10:00:00+08:00",
  sourceEvent: "progress:update",
  sessionId: "session-local-id",
  title: "Line Crew",
  detail: "Cleared 10 lines",
  display: {
    toast: true,
    overlay: false
  }
}
```

Version 1 grants should be session-only unless an explicit local persistence decision is made.

## Criteria Model

Reward criteria should be deterministic and inspectable.

Supported criteria examples:

- score reaches threshold.
- objective completed.
- level completed.
- all pairs matched.
- clear time under target.
- mistakes below target.
- learning topic completed.

Avoid criteria based on:

- daily streaks.
- time-of-day engagement.
- social sharing.
- personal identity.
- location tracking.
- remote ranking.

## Event Sources

Rewards should listen to app-owned game events:

- `progress:update`
- `level:complete`
- `won`
- `gameOver`
- `learning:complete`
- `objective:complete`

Rewards should not be triggered directly by Helper lifecycle state alone. For example, `won` may show a result overlay, but the game or app should provide the meaningful context that decides whether a reward is earned.

## Display Guidance

Reward display should be modest:

- Use a small toast or overlay badge after the action completes.
- Do not interrupt active gameplay.
- Queue reward messages if several are earned at once.
- Let pause/result overlays include earned rewards only when useful.
- Always keep primary game controls accessible.

Possible display text:

```text
Badge earned: Line Crew
Cleared 10 lines
```

## Helper Relationship

Helper may later own:

- reward toast component.
- reward badge display component.
- reward gallery/list component.
- accessible animation timing.
- icon/badge visual treatment.

PBB Games should own:

- reward definitions.
- reward criteria.
- grant decisions.
- persistence decisions.
- privacy policy.
- emergency-mode behavior.

Potential future Helper API:

```js
const rewardsUi = createGameRewardChrome(session, {
  onDismiss(grant) {}
});

rewardsUi.showGrant({
  title: "Line Crew",
  detail: "Cleared 10 lines",
  icon: "data.grid"
});
```

This should remain separate from `createGameStateChrome()`.

## Data Persistence Policy

Version 1 should default to session-only rewards.

Future local persistence may be acceptable if:

- it is anonymous,
- it stays on the local device/browser,
- it can be cleared,
- it is disabled or hidden during emergency mode,
- it does not sync to operational systems,
- it has no real-world value.

Suggested future storage key:

```js
localStorage["pbb-games:rewards:v1"]
```

No reward persistence should be added until approved.

If local persistence is later approved, keep reward grants separate from metric events.

Suggested local reward collection shape:

```js
{
  version: 1,
  updatedAt: "2026-06-24T10:00:00+08:00",
  grants: {
    "tetris-line-crew": {
      rewardId: "tetris-line-crew",
      gameId: "tetris",
      firstGrantedAt: "2026-06-24T10:00:00+08:00",
      grantCount: 1,
      bestDetail: "Cleared 10 lines"
    }
  }
}
```

Suggested rules:

- Store reward ids and coarse details only.
- Do not store player names or accounts.
- Do not store raw gameplay input.
- Do not store exact histories unless there is a clear product need.
- Provide a clear local reset path.
- Hide or disable reward collection during emergency mode if requested by mode policy.

## Metric Monitoring Policy

Reward metrics should measure feature health and content balance, not build player profiles.

Allowed aggregate metrics:

- reward grant count by reward id.
- reward display count by reward id.
- reward dismissal count.
- reward definition errors.
- duplicate-grant prevention count.
- reward persistence read/write failures.

Avoid:

- per-user reward timelines.
- streak or retention tracking.
- comparing players.
- remote reward analytics.
- rewards earned during emergency mode unless explicitly approved.

Recommended metric event shape:

```js
{
  type: "reward:grant",
  rewardId: "tetris-line-crew",
  gameId: "tetris",
  sessionId: "ephemeral-random-id",
  timestampBucket: "2026-06-24T10:00+08:00"
}
```

For version 1, reward metric monitoring should remain disabled unless needed for local debugging. If enabled later, prefer aggregate counters instead of raw event histories.

## Safety And Ethics

Rewards should support learning and confidence, not compulsion.

Rules:

- No streak loss messaging.
- No scarcity timers.
- No random reward economy.
- No public comparison.
- No collection pressure during emergency mode.
- No rewards for reporting, dispatch, or operational workflows.
- No rewards tied to personal data.

## Migration Plan

1. Standardize progression events first.
2. Define a small reward registry for one game, preferably Tetris or Memory.
3. Keep grants session-only.
4. Show a simple earned badge message on result overlay.
5. Add a mute-friendly optional sound only after state chrome and audio preferences are settled.
6. Consider local anonymous persistence only after the app’s privacy posture is explicitly approved.
7. Add aggregate reward metrics only after persistence and privacy rules are settled.

## Open Questions

- Should rewards be shown in the launcher, or only inside game sessions?
- Should Learning Games have separate completion stamps from arcade badges?
- Should anonymous local persistence be allowed for children/shared devices?
- Should Helper own a generic reward toast, or should rewards remain app-local until multiple apps need them?
- Should emergency mode hide all rewards or only prevent new reward notifications?
