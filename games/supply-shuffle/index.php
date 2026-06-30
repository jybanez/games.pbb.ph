<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Supply Shuffle',
    'category' => 'Quick Game',
    'game' => 'supply-shuffle',
    'module' => '/games/supply-shuffle/module.js',
    'orientation' => 'portrait',
    'description' => 'Swap preparedness supply tiles, clear matches, and complete compact route objectives.',
    'launch' => [
        'start_label' => 'Start Supply Shuffle',
        'objective' => 'Swap adjacent supply tiles to make matches, collect objectives, and clear each level before moves run out.',
        'controls' => ['Tap or drag adjacent tiles', 'Match 3 or more', 'Pause / Restart'],
        'splash_image' => '/games/supply-shuffle/assets/splash.png',
        'home_image' => '/games/supply-shuffle/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Supply Shuffle game"></section>
<?php pbb_game_page_end(); ?>
