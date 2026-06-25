# PBB Landing / Kit Setup Registration

Games Corner should be registered by Kit Setup or a future admin workflow. The app does not self-register with Landing in version 1.

Suggested registry metadata:

```json
{
  "app_id": "pbb-games",
  "name": "PBB Games Corner",
  "category": "citizen",
  "launch_url": "https://games.pbb.ph",
  "health_url": "https://games.pbb.ph/health.php",
  "description": "Local games and emergency-preparedness learning activities",
  "emergency_priority": "low",
  "disable_during_emergency": true,
  "ui_theme": "dark",
  "uses_helper_ui": true,
  "launcher": {
    "visible": true,
    "sort": 40,
    "icon": "data.grid",
    "logo_url": "https://games.pbb.ph/assets/launcher/app-icon.png",
    "logo_kind": "mark"
  }
}
```

Operational notes:

- Landing registry writes are token-protected and local-only.
- Kit Setup owns the actual registry update.
- `launcher.logo_url` points to the app-owned transparent launcher mark at `assets/launcher/app-icon.png`; `launcher.icon` remains a Helper fallback only.
- Future install-bundle metadata can be added when Games Corner is ready for packaging.
