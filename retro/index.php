<?php $landingUrl = 'https://pbb.ph'; ?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Retro Corner - PBB Games Corner</title>
    <link rel="stylesheet" href="/assets/helper/helpers.ui.bundle.min.css">
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="pbb-game-page">
    <header class="pbb-game-header">
        <div>
            <p class="ui-eyebrow">Placeholder</p>
            <h1 class="ui-title">Retro Corner</h1>
        </div>
        <div class="ui-inline">
            <a class="ui-button ui-button-ghost" href="/">Back to Games Corner</a>
            <a class="ui-button ui-button-quiet" href="<?= htmlspecialchars($landingUrl, ENT_QUOTES, 'UTF-8') ?>">Back to PBB Landing</a>
        </div>
    </header>
    <main class="pbb-game-shell">
        <section class="pbb-game-board ui-panel">
            <p class="ui-eyebrow">Rights-safe content only</p>
            <h2 class="ui-title">No retro games are bundled in version 1</h2>
            <p>Only homebrew, public-domain, open-source, or properly licensed retro games may be added here in the future.</p>
            <p>Do not place commercial ROMs, BIOS files, or copyrighted games in this app unless explicit distribution and use rights are available for this deployment.</p>
        </section>
    </main>
</body>
</html>

