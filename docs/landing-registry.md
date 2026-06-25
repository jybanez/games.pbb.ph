# PBB Landing / Kit Setup Registration

Games Corner should be registered by Kit Setup or a future admin workflow. The app does not self-register with Landing in version 1.

Suggested registry metadata:

```json
{
  "id": "pbb-games",
  "name": "PBB Games Corner",
  "display_name": "Games",
  "version": "0.1.0",
  "enabled": true,
  "install_scope": "local",
  "local_url": "https://games.pbb.ph",
  "launch_url": "https://games.pbb.ph",
  "health_url": "https://games.pbb.ph/health.php",
  "audience": ["citizen"],
  "launcher": {
    "visible": true,
    "sort": 50,
    "icon": "media.gamepad",
    "logo_url": "https://games.pbb.ph/assets/launcher/app-icon.png",
    "logo_kind": "mark"
  },
  "public_gateway": {
    "enabled": false,
    "reason": "PBB Games Corner is local LAN only and is not exposed through public Landing gateway routes."
  }
}
```

Operational notes:

- Landing registry writes are token-protected and local-only.
- Kit Setup owns the actual registry update.
- `launcher.logo_url` points to the app-owned transparent launcher mark at `assets/launcher/app-icon.png`; `launcher.icon` remains a Helper fallback only.
- Future install-bundle metadata can be added when Games Corner is ready for packaging.
