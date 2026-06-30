<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Survival',
    'category' => 'Quick Game',
    'game' => 'supply-shuffle',
    'module' => '/games/supply-shuffle/module.js',
    'orientation' => 'portrait',
    'description' => 'Swap survival resource tiles, clear matches, and complete compact route objectives.',
    'launch' => [
        'start_label' => 'Start Survival',
        'objective' => 'Swap adjacent survival resources to make matches, collect objectives, and clear each level before moves run out.',
        'controls' => ['Tap or drag adjacent tiles', 'Match 3 or more', 'Pause / Restart'],
        'splash_image' => '/games/supply-shuffle/assets/splash.png',
        'home_image' => '/games/supply-shuffle/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Survival game"></section>
<?php pbb_game_page_end(); ?>
