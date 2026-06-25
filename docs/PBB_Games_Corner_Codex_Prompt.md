# Codex Prompt: Build PBB Games Corner

You are working on **Project Bantay Bayan (PBB)**.

Build a new optional local citizen app called:

# PBB Games Corner

## 1. Purpose

**PBB Games Corner** is a lightweight local entertainment and learning app for citizens connected to the PBB local network.

It is **not part of core emergency operations**. Its purpose is to help citizens build the habit of connecting to the PBB local hub during normal days, while also offering simple educational games related to emergency preparedness, public safety, and civic awareness.

The app must feel like an official PBB module, not a random third-party arcade page.

## 2. Target Deployment

- No Docker.
- Must run under WAMP / Apache / PHP local node.
- Local path: `C:\wamp64\www\pbb\games`
- Preferred local URL: `https://games.pbb.ph`
- Alternative path if subdomain is not configured: `https://pbb.ph/games`
- Must work fully offline on LAN once installed.
- No database required for version 1.
- No external CDN dependencies.
- No internet calls.
- All CSS, JavaScript, fonts, icons, images, and game assets must be local.
- Must use dark theme by default.
- Must be easy to disable during incidents or disasters.

## 3. PBB Ecosystem Positioning

This is an optional **citizen engagement app**.

It must not interfere with:

- PBB Hotline
- PBB Relay
- PBB Support System
- PBB Realtime Server
- PBB MapServer
- PBB Hub / Hub HQ
- PBB Maestro
- PBB Kit Setup

Do not access or modify databases from any operational PBB app.

Do not call Hotline, Relay, Support, Realtime, Hub, Maestro, or MapServer APIs in version 1.

The app must remain isolated, low priority, and safe to disable.

## 4. Critical Helper UI Library Requirement

PBB Games Corner must follow the official `helpers.pbb.ph` integration model.

The Helper library was created to be the official UX/UI library of the PBB ecosystem. Do not ignore it. Do not build an unrelated design system.

### 4.1 Helper-first rule

Use the Helper UI library as the first-choice UI layer.

Where practical, app integrations should use Helper through the documented helper registry / `uiLoader` integration pattern instead of direct internal imports from `js/ui/*` or `js/incident/*`.

Before creating any app-local UI, check whether `helpers.pbb.ph` already provides the needed capability as:

- a shared component
- a preset wrapper
- a shared styling primitive
- a layout or shell primitive
- an existing CSS token/component pattern

### 4.2 Use shared Helper primitives

Use shared Helper primitives and classes where applicable, including but not limited to:

- `ui-panel`
- `ui-surface`
- `ui-field`
- `ui-label`
- `ui-badge`
- `ui-eyebrow`
- `ui-shell-header`
- `ui-shell-search`
- `ui-button`
- `ui-button-primary`
- `ui-button-ghost`
- `ui-button-quiet`
- `ui-button-borderless`
- `ui-button-link`
- `ui-button-icon`
- shared tabs/navigation primitives
- shared empty-state primitives
- shared modal/dialog/toast primitives where needed

Use Helper components for:

- shell layout
- cards / surfaces
- buttons
- status banners
- navigation
- category tabs
- filters/search
- forms, if any
- modals/dialogs, if any
- empty states
- badges
- section headers
- notices/alerts

### 4.3 Do not fork Helper behavior

Do not create duplicate local versions of Helper-owned components.

Do not create app-local fallback components for Helper-owned UI patterns.

If Helper is missing a repeated capability, do not silently create a project-local replacement.

Instead:

1. Use the closest existing Helper component or styling primitive for version 1 when it is sufficient.
2. If the gap is repeated or likely useful across PBB apps, create a documented Helper proposal in `README.md` or `docs/helper-ui-gap-proposals.md`.
3. The proposal must include:
   - the repeated use case
   - why the current Helper contract is insufficient
   - the narrowest shared API or styling change needed
   - expected demo coverage
   - expected regression coverage
4. Do not redefine Helper contracts from inside the Games app.
5. Do not normalize ad hoc local CSS overrides as the long-term solution.

### 4.4 Allowed app-local styling

App-local styling is allowed only for:

- game canvas areas
- game-specific controls
- game-specific interaction surfaces
- small layout adjustments that cannot be represented cleanly with existing Helper primitives

These local styles must still use Helper tokens and shared CSS classes as much as possible.

Any repeated app-local pattern must be documented as a candidate Helper proposal.

### 4.5 Helper UI documentation requirement

`README.md` must include a section titled:

```md
## Helper UI Usage
```

This section must document:

- Helper bundle/source path used
- Helper registry keys or components used
- Shared CSS primitives used
- Any app-local styling that remains
- Any proposed Helper gaps for future upstream work
- How to update the Helper bundle later

## 5. Visual Design Requirement

Use a **dark PBB operational theme** as the default and only required theme for version 1.

Design direction:

- Civic
- Operational
- Calm
- Trustworthy
- Readable
- Dense but organized
- Mobile-friendly
- Dashboard-like, but not intimidating

Avoid:

- flashy neon arcade styling
- childish game portal design
- oversized marketing hero sections
- decorative gradient blobs
- unrelated third-party UI frameworks
- Bootstrap/Tailwind/CDN design imports
- emoji-heavy UI

The app should look consistent with PBB local hub modules.

## 6. Homepage Requirements

Create a simple landing page.

Required content:

- Title: `PBB Games Corner`
- Subtitle: `Local games and learning activities available on this PBB network`
- Hub/network status area
- Current app mode display:
  - `normal`
  - `monitoring`
  - `active_incident`
  - `emergency`
- Clear notice:

```text
Games may be disabled during emergencies to prioritize emergency services.
```

Required homepage features:

- Category tabs or filters
- “All games” view
- Quick Games view
- Learning Games view
- Retro Corner view
- Local / Barangay Games view
- Optional search/filter by title or tag if simple to implement
- Empty state for categories with no visible enabled games
- Game cards generated from registry, not hardcoded manually in the page
- “Back to PBB Landing” link or button

Use Helper UI components and primitives for the shell, surfaces, cards, tabs, buttons, badges, banners, and empty states wherever practical.

## 7. Games Registry Requirement

Create a local PHP registry file:

```text
config/games.registry.php
```

The homepage must read from this registry instead of hardcoding game cards.

The registry must be human-readable and ready for future editing by Kit Setup or a future admin UI.

### 7.1 Suggested registry structure

```php
<?php

return [
    [
        'id' => 'snake',
        'title' => 'Snake',
        'category' => 'quick',
        'subcategory' => 'arcade',
        'description' => 'A simple classic snake game playable offline.',
        'path' => '/games/snake/',
        'enabled' => true,
        'order' => 10,
        'mode_visibility' => ['normal', 'monitoring'],
        'tags' => ['offline', 'quick', 'mobile-friendly'],
        'estimated_minutes' => 3,
        'learning_value' => null,
        'content_rating' => 'general',
        'emergency_priority' => 'low',
        'requires_keyboard' => false,
        'supports_touch' => true,
        'icon' => 'snake',
    ],
    [
        'id' => 'emergency-kit-quiz',
        'title' => 'Emergency Kit Quiz',
        'category' => 'learning',
        'subcategory' => 'preparedness',
        'description' => 'Learn what should be inside a basic emergency kit.',
        'path' => '/games/emergency-kit-quiz/',
        'enabled' => true,
        'order' => 110,
        'mode_visibility' => ['normal', 'monitoring', 'active_incident'],
        'tags' => ['offline', 'preparedness', 'quiz'],
        'estimated_minutes' => 5,
        'learning_value' => 'Emergency preparedness',
        'content_rating' => 'general',
        'emergency_priority' => 'medium',
        'requires_keyboard' => false,
        'supports_touch' => true,
        'icon' => 'kit',
    ],
];
```

### 7.2 Registry requirements

The registry must support:

- game categories
- subcategories
- enabled/disabled games
- emergency-mode visibility rules
- display order
- tags
- estimated play time
- touch/keyboard capability metadata
- learning value metadata
- content rating metadata
- emergency priority metadata
- future Kit Setup or admin editing

## 8. Game Categories

Use the registry to group games into categories.

### 8.1 Quick Games

Registry category: `quick`

Purpose: Light entertainment during normal network use.

Initial games:

- Snake
- Memory Cards
- Breakout
- Block Puzzle / Tetris-style game if feasible

Quick Games should normally be hidden during `active_incident` and `emergency` modes.

### 8.2 Learning Games

Registry category: `learning`

Purpose: Emergency preparedness, public safety, civic learning, and local-awareness content.

Initial games:

- Emergency Kit Quiz
- Evacuation Route Challenge
- First Aid Matching Game
- Barangay Hazard Awareness Quiz

Learning Games may remain visible in `active_incident` mode if enabled and if the current mode policy allows it.

### 8.3 Retro Corner

Registry category: `retro`

Purpose: Placeholder for future legally cleared retro/homebrew games.

Requirements:

- Do not bundle commercial ROMs.
- Do not bundle copyrighted games without explicit rights.
- Add placeholder page explaining that only homebrew, public-domain, or properly licensed retro games may be added.
- Prepare folder structure for future EmulatorJS integration.
- Do not require EmulatorJS in version 1.

### 8.4 Local / Barangay Games

Registry category: `local`

Purpose: Future barangay-specific games and quizzes.

Initial state:

- Placeholder category only.
- Example placeholder: `Barangay Trivia`.
- Must be disabled by default until content exists.

## 9. Emergency Mode Configuration

Create a simple configuration file:

```text
config/games.php
```

It should allow:

```php
<?php

return [
    'enabled' => true,
    'mode' => 'normal', // normal | monitoring | active_incident | emergency
    'show_quick_games' => true,
    'show_learning_games' => true,
    'show_retro_corner' => true,
    'show_local_games' => true,
    'landing_url' => 'https://pbb.ph',
    'hotline_url' => 'https://hotline.pbb.ph',
    'emergency_message' => 'Games are temporarily disabled to prioritize emergency services. Please use PBB Hotline or return to the PBB Local Hub.',
];
```

### 9.1 Mode behavior

- `normal`
  - Show all enabled games and categories allowed by registry.

- `monitoring`
  - Show games but display a caution banner.

- `active_incident`
  - Hide Quick Games.
  - Hide Retro Corner.
  - Show Learning Games only if enabled.
  - Show clear incident-priority notice.

- `emergency`
  - Disable all games.
  - Show emergency message.
  - Show links back to PBB Hotline and PBB Landing.

### 9.2 Visibility rule

A game should appear only if all conditions are true:

- global app `enabled` is `true`
- game `enabled` is `true`
- game category is enabled by `config/games.php`
- current mode is included in the game’s `mode_visibility`
- current mode rules allow the category

## 10. Suggested App Structure

Use simple PHP pages and local JavaScript.

Prefer a small PHP front controller if helpful.

Suggested structure:

```text
C:\wamp64\www\pbb\games
├── index.php
├── config
│   ├── games.php
│   └── games.registry.php
├── src
│   ├── GameRegistry.php
│   └── ModePolicy.php
├── assets
│   ├── css
│   │   └── app.css
│   ├── js
│   │   └── app.js
│   ├── img
│   └── helper
│       └── README.md
├── games
│   ├── snake
│   │   └── index.php
│   ├── memory
│   │   └── index.php
│   ├── breakout
│   │   └── index.php
│   ├── block-puzzle
│   │   └── index.php
│   ├── emergency-kit-quiz
│   │   └── index.php
│   ├── evacuation-route
│   │   └── index.php
│   ├── first-aid-matching
│   │   └── index.php
│   └── hazard-awareness
│       └── index.php
├── retro
│   ├── index.php
│   ├── README.md
│   └── roms
│       └── README.md
├── docs
│   ├── helper-ui-gap-proposals.md
│   └── landing-registry.md
├── health.php
├── manifest.json
└── README.md
```

## 11. Game Page Requirements

Each game must:

- Run fully in the browser.
- Work without internet.
- Avoid external libraries unless vendored locally.
- Use the dark PBB visual style.
- Use common shared header/navigation where practical.
- Have a `Back to Games Corner` button.
- Have a `Back to PBB Landing` button.
- Be playable on mobile.
- Use keyboard and touch controls where practical.
- Avoid sound by default, or provide a mute control.
- Avoid heavy assets.
- Avoid collecting player names, scores, or analytics in version 1.
- Avoid network calls.

Game-specific UI such as canvas, touch pads, game boards, and keyboard-control hints may use app-local CSS, but should still align with Helper tokens and the dark PBB theme.

## 12. Health Endpoint

Create:

```text
health.php
```

It must return valid JSON.

Example response:

```json
{
  "app": "pbb-games-corner",
  "status": "ok",
  "enabled": true,
  "mode": "normal",
  "version": "0.1.0",
  "games_total": 0,
  "games_visible": 0,
  "categories": ["quick", "learning", "retro", "local"]
}
```

The endpoint should compute `games_total` and `games_visible` from the registry and mode policy.

## 13. Manifest

Create:

```text
manifest.json
```

Suggested fields:

```json
{
  "app_id": "pbb-games",
  "name": "PBB Games Corner",
  "short_name": "PBB Games",
  "description": "Local games and emergency-preparedness learning activities for citizens connected to the PBB local network.",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0f172a",
  "background_color": "#020617"
}
```

Do not rely on external icons or external PWA assets.

## 14. PBB Landing / Kit Setup Integration Documentation

Create:

```text
docs/landing-registry.md
```

Document how this app can be registered with PBB Landing / Kit Setup as an optional citizen app.

Suggested app registry metadata:

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
  "uses_helper_ui": true
}
```

## 15. Security and Operations

Requirements:

- No login required for initial version.
- Do not collect personal data.
- Do not store player names.
- Do not store scores.
- Do not collect analytics.
- Do not make internet calls.
- Do not include commercial copyrighted games, ROMs, sprites, sounds, music, or assets.
- Do not include copyrighted console BIOS files.
- Add README warnings about licensed game content.
- Keep this app isolated from PBB operational apps.
- Keep the app low-priority and easy to disable.
- Make emergency disablement clear and testable.

## 16. Retro Corner Legal Warning

Create:

```text
retro/README.md
retro/roms/README.md
```

Include a clear warning:

```text
Do not place commercial ROMs, BIOS files, or copyrighted games in this folder unless you have explicit rights to distribute and use them in this deployment.

Only homebrew, public-domain, open-source, or properly licensed retro games may be added.

The emulator platform is not the main legal risk. The game content and BIOS files are the legal risk.
```

## 17. README Requirements

Create a root `README.md` with:

- App overview
- Purpose and PBB positioning
- Install path
- Local URL
- No-Docker note
- No-database note
- Offline/LAN behavior
- Emergency mode behavior
- Games registry behavior
- Helper UI Usage section
- PBB Landing / Kit Setup registration note
- Legal content warning for games and ROMs
- Health endpoint note
- Acceptance test checklist

## 18. Deliverables

Deliver a working first version in:

```text
C:\wamp64\www\pbb\games
```

Required deliverables:

- `index.php`
- `config/games.php`
- `config/games.registry.php`
- `src/GameRegistry.php`
- `src/ModePolicy.php`
- `assets/css/app.css`
- `assets/js/app.js`
- `health.php`
- `manifest.json`
- `README.md`
- `docs/helper-ui-gap-proposals.md`
- `docs/landing-registry.md`
- At least 3 working Quick Games
- At least 3 working Learning Games
- Retro Corner placeholder with legal warning
- Local / Barangay Games placeholder category
- Dark PBB theme
- Helper UI integration
- No external network dependency
- No Docker dependency
- No database dependency

## 19. Acceptance Tests

Verify all of the following:

1. Open `https://games.pbb.ph` and confirm homepage loads offline.
2. Confirm the UI uses the PBB Helper UI library where practical.
3. Confirm the app uses dark theme by default.
4. Confirm game cards are generated from `config/games.registry.php`.
5. Confirm category tabs/filters work.
6. Confirm search/filter works if implemented.
7. Open each game and confirm it runs offline.
8. Confirm every game has a `Back to Games Corner` control.
9. Confirm every game has a `Back to PBB Landing` control.
10. Set `mode=emergency` and verify all games are disabled.
11. Set `mode=active_incident` and verify Quick Games and Retro Corner are hidden.
12. Set one game `enabled=false` in the registry and verify it disappears.
13. Remove all enabled games from a category and verify the empty state appears.
14. Open `health.php` and verify valid JSON response.
15. Confirm `health.php` reports the current mode.
16. Confirm browser dev tools show no external network requests.
17. Confirm mobile layout is usable.
18. Confirm app can be added to PBB Landing registry metadata.
19. Confirm `README.md` documents Helper UI usage and registry behavior.
20. Confirm `docs/helper-ui-gap-proposals.md` exists even if no gaps are currently listed.
21. Confirm no commercial ROMs, BIOS files, copyrighted sprites, copyrighted music, or copyrighted assets are bundled.

## 20. Implementation Preference

Prefer simple, readable PHP/HTML/CSS/JavaScript over frameworks.

Do not use Docker.

Do not add a database.

Do not add a build system unless absolutely necessary.

Do not bypass the PBB Helper UI library unless there is no suitable Helper component or primitive available, and even then document the gap as a Helper proposal rather than creating a silent local fork.

Build this as a clean, maintainable version 1 that can later be registered by PBB Landing / Kit Setup as an optional citizen app.
