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
    <link rel="stylesheet" href="/assets/helper/helpers.ui.bundle.min.css">
    <link rel="stylesheet" href="/assets/helper/helpers.game.bundle.min.css">
    <link rel="stylesheet" href="/assets/css/app.css">
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
        'module' => $module,
        'styles' => isset($options['styles']) && is_array($options['styles']) ? array_values($options['styles']) : [],
        'assets' => isset($options['assets']) && is_array($options['assets']) ? array_values($options['assets']) : [],
        'orientation' => isset($options['orientation']) ? (string)$options['orientation'] : 'any',
        'description' => isset($options['description']) ? (string)$options['description'] : '',
        'launch' => isset($options['launch']) && is_array($options['launch']) ? $options['launch'] : [],
    ];
    ?>
    </main>
<?php if ($module !== ''): ?>
    <script id="directGameState" type="application/json"><?= json_encode($gameState, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
    <script type="module" src="/assets/helper/helpers.game.bundle.min.js"></script>
    <script type="module" src="/assets/js/game-page.js"></script>
<?php else: ?>
    <script type="module" src="/assets/js/games.js"></script>
<?php endif; ?>
</body>
</html>
<?php
}
