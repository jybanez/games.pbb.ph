<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Snake',
    'category' => 'Quick Game',
    'game' => 'snake',
    'module' => '/games/snake/module.js',
    'orientation' => 'landscape',
    'description' => 'Guide the line, collect supplies, and avoid running into yourself.',
    'assets' => ['/games/snake/assets/splash.png', '/games/snake/assets/home.png'],
    'launch' => [
        'start_label' => 'Start Game',
        'objective' => 'Collect supplies, grow longer, and avoid walls or your own trail.',
        'controls' => ['Arrow keys', 'Virtual joystick', 'Pause / Restart'],
        'splash_image' => '/games/snake/assets/splash.png',
        'home_image' => '/games/snake/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Snake game"></section>
<?php pbb_game_page_end(); ?>
