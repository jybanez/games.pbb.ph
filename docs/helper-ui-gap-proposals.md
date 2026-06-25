# Helper UI Gap Proposals

No blocking Helper UI gaps are known for version 1.

Games Corner uses the vendored Helper bundle, the Helper dark theme, the Helper navbar component, the Helper icon grid component, Helper empty states, Helper busy overlays, and Helper game core primitives. App-local CSS is limited to page sizing, fixed positioning, launch splash presentation, countdown presentation, game canvas content, and game-specific layout.

Recently resolved by Helper:

- `createGameSession` now supports first-class icon close controls through `closeControl`, so Games Corner no longer hides close text or injects a local `x` glyph with CSS.

Potential future gap:

- A citizen learning/game launcher preset could be useful if multiple PBB citizen apps need the same navbar plus icon grid shell.
- Shared game-page primitives should stay app-local in Games Corner for now. If future citizen apps need the same game shell, status HUD, canvas stage, touch controls, or quiz/card grids, promote the narrow shared contract described in `docs/game-ui-components.md` into a Helper UI proposal.
