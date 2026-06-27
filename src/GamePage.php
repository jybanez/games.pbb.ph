<?php

function pbb_game_config()
{
    static $config = null;

    if ($config === null) {
        $config = require __DIR__ . '/../config/games.php';
    }

    return $config;
}

function pbb_game_e($value)
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function pbb_game_asset_url($path)
{
    $value = (string)$path;
    if ($value === '' || preg_match('/^(https?:)?\/\//', $value)) {
        return $value;
    }

    $config = pbb_game_config();
    $version = isset($config['version']) ? (string)$config['version'] : '';
    if ($version === '') {
        return $value;
    }

    $separator = strpos($value, '?') === false ? '?' : '&';
    return $value . $separator . 'v=' . rawurlencode($version);
}

function pbb_game_asset_list(array $paths)
{
    return array_map('pbb_game_asset_url', array_values($paths));
}

function pbb_game_launch_asset_urls(array $launch)
{
    foreach (['splash_image', 'home_image'] as $field) {
        if (!empty($launch[$field])) {
            $launch[$field] = pbb_game_asset_url($launch[$field]);
        }
    }
    return $launch;
}

function pbb_game_page_start(array $options)
{
    $GLOBALS['pbb_game_page_options'] = $options;
    $config = pbb_game_config();
    $title = isset($options['title']) ? (string)$options['title'] : 'PBB Game';
    $category = isset($options['category']) ? (string)$options['category'] : 'Game';
    $game = isset($options['game']) ? (string)$options['game'] : '';
    $landingUrl = isset($config['landing_url']) ? (string)$config['landing_url'] : 'https://pbb.ph';
    ?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= pbb_game_e($title) ?> - PBB Games Corner</title>
    <link rel="stylesheet" href="<?= pbb_game_e(pbb_game_asset_url('/assets/helper/helpers.ui.bundle.min.css')) ?>">
    <link rel="stylesheet" href="<?= pbb_game_e(pbb_game_asset_url('/assets/helper/helpers.game.bundle.min.css')) ?>">
    <link rel="stylesheet" href="<?= pbb_game_e(pbb_game_asset_url('/assets/css/app.css')) ?>">
</head>
<body class="pbb-game-page" data-game="<?= pbb_game_e($game) ?>">
    <header class="pbb-game-header">
        <div>
            <p class="ui-eyebrow"><?= pbb_game_e($category) ?></p>
            <h1 class="ui-title"><?= pbb_game_e($title) ?></h1>
        </div>
        <div class="ui-inline">
            <a class="ui-button ui-button-ghost" href="/">Back to Games Corner</a>
            <a class="ui-button ui-button-quiet" href="<?= pbb_game_e($landingUrl) ?>">Back to PBB Landing</a>
        </div>
    </header>
    <main class="pbb-game-shell">
<?php
}

function pbb_game_page_end()
{
    $options = isset($GLOBALS['pbb_game_page_options']) && is_array($GLOBALS['pbb_game_page_options']) ? $GLOBALS['pbb_game_page_options'] : [];
    $module = isset($options['module']) ? (string)$options['module'] : '';
    $gameState = [
        'id' => isset($options['game']) ? (string)$options['game'] : '',
        'title' => isset($options['title']) ? (string)$options['title'] : 'PBB Game',
        'category' => isset($options['category']) ? (string)$options['category'] : 'Game',
        'module' => pbb_game_asset_url($module),
        'styles' => isset($options['styles']) && is_array($options['styles']) ? pbb_game_asset_list($options['styles']) : [],
        'assets' => isset($options['assets']) && is_array($options['assets']) ? pbb_game_asset_list($options['assets']) : [],
        'orientation' => isset($options['orientation']) ? (string)$options['orientation'] : 'any',
        'description' => isset($options['description']) ? (string)$options['description'] : '',
        'launch' => isset($options['launch']) && is_array($options['launch']) ? pbb_game_launch_asset_urls($options['launch']) : [],
    ];
    ?>
    </main>
<?php if ($module !== ''): ?>
    <script id="directGameState" type="application/json"><?= json_encode($gameState, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
    <script type="module" src="<?= pbb_game_e(pbb_game_asset_url('/assets/helper/helpers.game.bundle.min.js')) ?>"></script>
    <script type="module" src="<?= pbb_game_e(pbb_game_asset_url('/assets/js/game-page.js')) ?>"></script>
<?php else: ?>
    <script type="module" src="<?= pbb_game_e(pbb_game_asset_url('/assets/js/games.js')) ?>"></script>
<?php endif; ?>
</body>
</html>
<?php
}
