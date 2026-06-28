# Agent Working Protocol

Date: 2026-06-26

This protocol keeps PBB Games work clean as the project grows and multiple agents or contributors work around the same Helper, asset, and game-module surfaces.

## Start Point

Every new task starts from the latest `main`.

```powershell
git checkout main
git pull --ff-only origin main
git status --short --branch
```

Do not start new work from an old feature branch unless the task is explicitly to continue that branch.

Before editing, check `git status`. If unrelated files are already modified, leave them alone and keep the new task scoped to its own files.

## Branch Naming

When a branch is needed, use meaningful branch names with this shape for all task branches, regardless of whether they are created by Codex, another agent, or a human contributor:

```text
<category>/<task-name>
```

Good examples:

```text
game/supply-run-assets
assets/tetris-home-screen
helper/vendor-refresh
docs/agent-working-protocol
ui/launcher-search
game/snake-controls
```

Avoid vague names:

```text
fixes
update
new-work
test
```

## Worktree Folder Naming

Most Games tasks can be done in the main checkout after confirming a clean baseline. When a separate checkout is needed, keep it under a Games branch workspace so it does not get mixed with other PBB apps.

Preferred structure:

```text
C:\wamp64\www\pbb\games-branches\<category>\<task-name>
```

Examples:

```text
C:\wamp64\www\pbb\games-branches\game\supply-run-assets
C:\wamp64\www\pbb\games-branches\helper\vendor-refresh
C:\wamp64\www\pbb\games-branches\ui\launcher-search
```

If the worktree must be served through a local domain, use a DNS-friendly folder name:

```text
C:\wamp64\www\pbb\games-branches\<category>-<task-name>
```

Example:

```text
C:\wamp64\www\pbb\games-branches\game-supply-run-assets
```

The matching test domain should be explicit and must not replace the main Games domain unless intended:

```text
games-supply-run.pbb.ph
games-helper-refresh.pbb.ph
games-ui-search.pbb.ph
```

## Docs Fast Lane

Docs-only proposals, assessments, prompts, and agent handoff documents are coordination artifacts. They should be easy for other agents to discover from `main`.

For docs-only work, agents may commit directly to latest `main` after confirming all of the following:

- the worktree is clean
- `main` is up to date
- only files under `docs/` or repo-owned Codex skill documentation are changed
- no runtime code, config, assets, vendored Helper bundles, or registry files are changed
- Jonathan requested the document or the document is needed to unblock another agent

Do not create a branch for ordinary docs-only proposals unless Jonathan asks for review first.

Create a branch or PR for docs when:

- the documentation is bundled with runtime/config/assets/registry changes
- the change updates a formal operating protocol or module contract and Jonathan has not explicitly approved direct implementation
- `main` is dirty, checked out elsewhere for active work, protected, or cannot be pushed directly
- the content is intentionally controversial or needs review before becoming the source of truth

When a separate worktree is needed only to avoid disturbing an active dirty checkout, a docs-only protocol update may still commit to `main` from that separate worktree as long as the changed files remain docs-only and the docs worktree is clean aside from the intended documentation changes.

## Task Isolation

One branch should solve one task.

Do not mix unrelated work into the same branch:

- no unrelated cleanup
- no unrelated formatting
- no Helper vendor refresh inside a game-only change unless required
- no registry changes inside an asset-only replacement unless the asset paths or metadata contract changed
- no documentation drift unless it is part of the task

If a second issue is discovered, document it and create a separate branch or follow-up task.

## Local And Generated Files

Do not commit local-only or generated workspace files.

Known local-only paths include:

```text
pbb-chat-token.local.json
output/
.playwright-cli/
```

Before staging, use:

```powershell
git status --short
git diff --stat
```

Only stage files that are intentionally part of the task.

## Helper Vendoring

Helper is the shared UI and game-control source of truth. Games consumes vendored Helper bundles from the official Helper repository, not ad hoc file copies.

When refreshing Helper:

1. Start from current Games `main`.
2. Confirm Helper source is on the intended official `main` commit.
3. Copy related bundle artifacts together from Helper `dist/`.
4. Keep normal UI and game bundle roles clear.
5. Verify the exact Helper modules Games consumes.

Current vendored files live under:

```text
assets/helper/helpers.ui.bundle.min.js
assets/helper/helpers.ui.bundle.min.css
assets/helper/helpers.game.bundle.min.js
assets/helper/helpers.game.bundle.min.css
```

Normal UI bundle responsibilities include launcher UI, navbar, icons, fields, buttons, empty states, and base Helper components.

Game bundle responsibilities include `ui.game.*` modules such as game sessions, controls, state chrome, audio, objects, tetromino helpers, and grid helpers.

After a Helper refresh, verify the relevant contracts. Examples:

```powershell
php health.php
node --check games\pacman\module.js
```

For bundle-specific changes, also verify in a browser or focused script that the expected bundle keys exist, such as:

```text
window.__PBB_HELPER_GAME_BUNDLE__["./ui.game.grid.js"]
window.__PBB_HELPER_GAME_BUNDLE__["./ui.game.state.chrome.js"]
window.__PBB_HELPER_GAME_BUNDLE__["./ui.game.audio.js"]
```

If a Helper gap is found, do not patch Helper internals inside Games. Document the gap and coordinate with PBB Helper through the shared chat log.

## Game Asset Protocol

Each game owns its runtime assets in its own directory:

```text
games/<game-id>/assets/
```

Generated source artwork may live outside the repository, but committed runtime copies must be local to Games and referenced through stable app paths.

Preferred standard asset names:

```text
icon.png
splash.png
home.png
```

Use the same runtime naming contract across games unless there is a clear reason to add a variant.

For asset-only replacements:

- copy the new file into the existing game asset path
- do not edit the registry if the path is unchanged
- check `git diff --stat` and confirm only intended binary files changed
- run the lightweight app checks

Do not introduce remote image, CDN, font, audio, or script dependencies. Games should work offline on the local PBB node after installation.

## Game Registry Protocol

The registry is the source of truth for launcher-visible game metadata.

Registry entries should define:

- id
- title
- category
- enabled and visible state
- route path
- module path
- preloadable local assets
- orientation preference
- icon image
- launch/home metadata

Keep leveling, rewards, persistence, and analytics out of the base registry unless a future engine contract requires registry-level discovery.

If a game is disabled or hidden, keep its assets and module paths stable unless the game is being intentionally removed.

## Game Module Protocol

Each module-backed game should keep its code and assets in its own directory:

```text
games/<game-id>/index.php
games/<game-id>/module.js
games/<game-id>/assets/
```

The required game module contract is:

```javascript
export function mountGame(session, options) {
  return {
    start() {},
    destroy() {}
  };
}
```

Controllers may expose more methods when needed, but the launcher should only require the standard contract.

Game modules should consume Helper through the provided loader or bundled module map. They should not reach into unrelated app internals.

Games own game-specific behavior:

- scoring
- lives
- levels
- rewards
- collision rules
- enemy behavior
- collectible meaning
- rendering decisions
- sound timing

Helper should own reusable primitives only:

- game session chrome
- touch controls
- action buttons
- audio playback plumbing
- object layers
- grid movement/pathfinding
- common piece/object helpers

App-local proof implementations for future Helper extraction are allowed, but they should be documented and kept narrow.

## Verification

Run checks that match the blast radius.

For asset-only changes:

```powershell
php health.php
git diff --stat
```

For PHP/config/registry changes:

```powershell
php -l index.php
php -l health.php
php health.php
```

Also lint changed PHP files directly, such as:

```powershell
php -l games\pacman\index.php
```

For JavaScript game changes:

```powershell
node --check games\<game-id>\module.js
php health.php
```

For launcher or visual behavior changes, verify in a browser at relevant viewport sizes. Mobile viewport checks matter for the launcher, splash screens, home screens, controls, fullscreen, and orientation behavior.

For Helper vendor refreshes, verify both application health and the specific Helper keys consumed by Games.

## Documentation

Update docs when the task changes a contract, operating rule, proposal, or handoff expectation.

Do not update docs for unrelated cleanup.

Long proposals should live under `docs/` and be summarized in chat rather than pasted into the shared chat log.

## Cross-Team Boundaries

Agents may inspect other PBB repositories to understand behavior, but should not edit code owned by another team unless explicitly asked.

If Helper, Landing, Kit Setup, Chat, or another PBB project needs a change, post a clear request in the shared chat log with:

- observed behavior
- expected behavior
- affected component, endpoint, or file if known
- verification already performed
- what Games needs from that team

Keep shared chat messages brief. If the message is long, create a document in the relevant repo and post the document path plus a short summary.

## Packaging And Install Bundles

Games does not currently own a Kit Setup bundle handoff flow.

When Games is ready for install/update packaging, add a formal package handoff section covering:

- main commit
- app version
- build id
- bundle path
- SHA256
- included assets
- Helper vendor commit
- tests run
- install/update notes

Until then, do not create installer or Kit handoff artifacts as part of ordinary game or UI tasks.

## Stale PRs

Do not merge old PRs directly when they are far behind `main`.

For stale PRs:

- inspect the intent
- check whether the feature is still wanted
- close if superseded
- recreate useful parts from current `main` if needed

## Agent Handoff

For non-trivial tasks, end with this handoff block:

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

For small local-only changes, a shorter summary is acceptable, but still mention tests run and any known dirty files not related to the task.
