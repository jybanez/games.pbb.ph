---
name: games-agent-working-protocol
description: Use when working in `C:\wamp64\www\pbb\games` on tasks involving branch creation, branch switching, branch naming, worktree decisions, commits, pushes, pull requests, stale PRs, merged branch cleanup, Helper bundle vendoring, game registry metadata, game module contracts, game runtime assets, cross-team PBB coordination, or final Games handoff reporting.
---

# Games Agent Working Protocol

This skill makes the PBB Games agent protocol discoverable to Codex agents working in `C:\wamp64\www\pbb\games`.

Before doing any of the following, read `docs/agent-working-protocol.md` and follow it as the source of truth:

- creating, switching, naming, pushing, deleting, or cleaning task branches
- deciding whether a separate worktree under `C:\wamp64\www\pbb\games-branches\` is needed
- committing, opening PRs, handling stale PRs, or deleting merged branches
- refreshing vendored Helper bundles under `assets/helper/`
- changing game registry metadata or game module contracts
- adding or replacing game runtime assets
- coordinating with Helper, Landing, Kit Setup, Chat, or other PBB projects
- writing final handoff notes

Do not duplicate the full protocol here. Update this skill only when routing rules or critical defaults change; update `docs/agent-working-protocol.md` when the protocol itself changes.

## Key Defaults

- Start every new Games task from latest `main`.
- Check `git status` before editing.
- For ordinary docs-only proposals, assessments, prompts, and agent handoff documents, prefer direct commits to latest `main` after confirming the change is docs-only and `main` is clean.
- Create a branch for docs only when Jonathan asks for review first, docs are bundled with runtime changes, the change affects a formal protocol/contract without prior approval, or `main` cannot be edited safely.
- When a branch is needed, use branch names shaped as `<category>/<task-name>`.
- Keep one task per branch.
- Do not mix Helper vendor refreshes into unrelated game-only changes.
- Do not patch Helper internals inside Games.
- Keep runtime assets local under `games/<game-id>/assets/`.
- Use the standard game module contract:

```javascript
export function mountGame(session, options) {
  return {
    start() {},
    destroy() {}
  };
}
```

For non-trivial work, end with the Games handoff block:

```text
Branch:
Commit:
Pushed:
PR:
Tests run:
Helper vendored: yes/no
Assets changed: yes/no
Cross-team messages: yes/no
Known risks:
```
