# Vendored Helper UI

Source files:

```text
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.js
C:\wamp64\www\hotline-helpers\dist\helpers.ui.bundle.min.css
C:\wamp64\www\hotline-helpers\dist\helpers.game.bundle.min.js
C:\wamp64\www\hotline-helpers\dist\helpers.game.bundle.min.css
```

Games Corner uses the bundled Helper UI path by default and imports `ui.navbar` and `ui.icon.grid` from the bundle module map.

Game-bundle note:

- `helpers.game.bundle.min.js` and `helpers.game.bundle.min.css` are refreshed from Helper main commit `99267f6`, which includes merged Helper PR #4.
- `createCollectibleLayer` and `createSpriteAnimator` are not part of this Helper main refresh yet; Games keeps those proof implementations app-local until the follow-up Helper PR lands.

Refresh steps:

1. Rebuild Helper in `C:\wamp64\www\hotline-helpers` if needed.
2. Copy the `dist` bundle files into this folder.
3. Re-test the homepage navbar, launcher grid, dark theme, and module-backed quick games.
