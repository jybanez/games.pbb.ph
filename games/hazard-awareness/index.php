<?php $landingUrl = 'https://pbb.ph'; ?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hazard Awareness Quiz - PBB Games Corner</title>
    <link rel="stylesheet" href="/assets/helper/helpers.ui.bundle.min.css">
    <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="pbb-game-page" data-game="hazard-quiz">
    <header class="pbb-game-header">
        <div>
            <p class="ui-eyebrow">Learning Game</p>
            <h1 class="ui-title">Hazard Awareness Quiz</h1>
        </div>
        <div class="ui-inline">
            <a class="ui-button ui-button-ghost" href="/">Back to Games Corner</a>
            <a class="ui-button ui-button-quiet" href="<?= htmlspecialchars($landingUrl, ENT_QUOTES, 'UTF-8') ?>">Back to PBB Landing</a>
        </div>
    </header>
    <main class="pbb-game-shell">
        <section class="pbb-game-board">
            <p id="gameStatus" class="ui-badge">Question 1</p>
            <div class="pbb-game-panel">
                <h2 id="question" class="ui-title"></h2>
                <div id="choices" class="pbb-choice-grid"></div>
            </div>
        </section>
    </main>
    <script type="module" src="/assets/js/games.js"></script>
</body>
</html>

