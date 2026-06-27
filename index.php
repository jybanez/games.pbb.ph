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

function asset_url($path, array $config)
{
    $value = (string)$path;
    if ($value === '' || preg_match('/^(https?:)?\/\//', $value)) {
        return $value;
    }

    $version = isset($config['version']) ? (string)$config['version'] : '';
    if ($version === '') {
        return $value;
    }

    $separator = strpos($value, '?') === false ? '?' : '&';
    return $value . $separator . 'v=' . rawurlencode($version);
}

function version_game_asset_urls(array $games, array $config)
{
    return array_map(function (array $game) use ($config) {
        foreach (['module', 'icon_image'] as $field) {
            if (!empty($game[$field])) {
                $game[$field] = asset_url($game[$field], $config);
            }
        }
        foreach (['styles', 'assets'] as $field) {
            if (!empty($game[$field]) && is_array($game[$field])) {
                $game[$field] = array_map(function ($path) use ($config) {
                    return asset_url($path, $config);
                }, $game[$field]);
            }
        }
        foreach (['splash_image', 'home_image'] as $field) {
            if (!empty($game['launch'][$field])) {
                $game['launch'][$field] = asset_url($game['launch'][$field], $config);
            }
        }
        return $game;
    }, $games);
}

$appState = [
    'mode' => $mode,
    'enabled' => isset($config['enabled']) ? (bool)$config['enabled'] : true,
    'assetVersion' => isset($config['version']) ? (string)$config['version'] : '',
    'landingUrl' => isset($config['landing_url']) ? (string)$config['landing_url'] : 'https://pbb.ph',
    'hotlineUrl' => isset($config['hotline_url']) ? (string)$config['hotline_url'] : 'https://hotline.pbb.ph',
    'categories' => $categoryLabels,
    'counts' => ['all' => count($visibleGames)] + $counts,
    'games' => version_game_asset_urls($visibleGames, $config),
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
    <link rel="manifest" href="<?= e(asset_url('/manifest.json', $config)) ?>">
    <link rel="icon" type="image/png" href="<?= e(asset_url('/assets/launcher/app-icon.png', $config)) ?>">
    <link rel="apple-touch-icon" href="<?= e(asset_url('/assets/launcher/app-icon.png', $config)) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('/assets/helper/helpers.ui.bundle.min.css', $config)) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('/assets/helper/helpers.game.bundle.min.css', $config)) ?>">
    <link rel="stylesheet" href="<?= e(asset_url('/assets/css/app.css', $config)) ?>">
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
    <script type="module" src="<?= e(asset_url('/assets/helper/helpers.game.bundle.min.js', $config)) ?>"></script>
    <script type="module" src="<?= e(asset_url('/assets/js/app.js', $config)) ?>"></script>
</body>
</html>
