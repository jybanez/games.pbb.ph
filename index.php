<?php

require __DIR__ . '/src/ModePolicy.php';
require __DIR__ . '/src/GameRegistry.php';

$config = require __DIR__ . '/config/games.php';
$registry = GameRegistry::fromFile(__DIR__ . '/config/games.registry.php');
$visibleGames = $registry->visible($config);
$mode = ModePolicy::mode($config);
$counts = $registry->visibleCountByCategory($config);

$categoryLabels = [
    'all' => 'All games',
    'quick' => 'Quick Games',
    'learning' => 'Learning Games',
    'retro' => 'Retro Corner',
    'local' => 'Local / Barangay Games',
];

$appState = [
    'mode' => $mode,
    'enabled' => isset($config['enabled']) ? (bool)$config['enabled'] : true,
    'landingUrl' => isset($config['landing_url']) ? (string)$config['landing_url'] : 'https://pbb.ph',
    'hotlineUrl' => isset($config['hotline_url']) ? (string)$config['hotline_url'] : 'https://hotline.pbb.ph',
    'categories' => $categoryLabels,
    'counts' => ['all' => count($visibleGames)] + $counts,
    'games' => $visibleGames,
];

function e($value)
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#0d1523">
    <title>PBB Games Corner</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/png" href="/assets/launcher/app-icon.png">
    <link rel="apple-touch-icon" href="/assets/launcher/app-icon.png">
    <link rel="stylesheet" href="/assets/helper/helpers.ui.bundle.min.css">
    <link rel="stylesheet" href="/assets/helper/helpers.game.bundle.min.css">
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="pbb-games-app" data-mode="<?= e($mode) ?>">
    <div id="navbarHost" class="pbb-navbar-host"></div>
    <main class="pbb-main" aria-label="PBB Games launcher">
        <section class="pbb-toolbar" aria-label="Game filters">
            <div id="categoryFilters" class="pbb-filter-row"></div>
            <input id="gameSearch" class="ui-input pbb-search" type="search" placeholder="Search title or tag" aria-label="Search games by title or tag" autocomplete="off">
        </section>

        <?php if ($mode === 'emergency' || !(isset($config['enabled']) ? (bool)$config['enabled'] : true)): ?>
            <section class="ui-panel pbb-empty-state">
                <p class="ui-eyebrow">Emergency priority</p>
                <h2 class="ui-title">Games are disabled</h2>
                <p><?= e(isset($config['emergency_message']) ? (string)$config['emergency_message'] : 'Games are disabled during emergencies.') ?></p>
                <div class="ui-inline">
                    <a class="ui-button ui-button-primary" href="<?= e((string)$appState['hotlineUrl']) ?>">Open PBB Hotline</a>
                    <a class="ui-button ui-button-ghost" href="<?= e((string)$appState['landingUrl']) ?>">Back to PBB Landing</a>
                </div>
            </section>
        <?php else: ?>
            <section id="gridHost" class="pbb-grid-host" aria-label="Games launcher"></section>
            <section id="emptyState" class="pbb-empty-state-host" hidden></section>
        <?php endif; ?>
    </main>
    <div id="gameSessionHost" class="pbb-game-session-host" aria-live="polite"></div>
    <script id="appState" type="application/json"><?= json_encode($appState, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
    <script type="module" src="/assets/helper/helpers.game.bundle.min.js"></script>
    <script type="module" src="/assets/js/app.js"></script>
</body>
</html>
