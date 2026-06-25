<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Supply Run',
    'category' => 'Quick Game',
    'game' => 'pacman',
    'module' => '/games/pacman/module.js',
    'orientation' => 'portrait',
    'description' => 'Navigate the route, collect supplies, and avoid patrol hazards.',
    'assets' => ['/games/pacman/assets/splash.png', '/games/pacman/assets/home.png'],
    'launch' => [
        'start_label' => 'Start Supply Run',
        'objective' => 'Collect every supply marker, use power kits, and avoid patrol hazards.',
        'controls' => ['Touch D-pad', 'Keyboard arrows', 'Pause / Restart'],
        'splash_image' => '/games/pacman/assets/splash.png',
        'home_image' => '/games/pacman/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Supply Run game"></section>
<?php pbb_game_page_end(); ?>
