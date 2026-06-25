<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Breakout',
    'category' => 'Quick Game',
    'game' => 'breakout',
    'module' => '/games/breakout/module.js',
    'orientation' => 'landscape',
    'description' => 'Clear the blocks with a paddle and ball.',
    'launch' => [
        'start_label' => 'Start Breakout',
        'objective' => 'Keep the ball in play and clear every block.',
        'controls' => ['Arrow keys', 'Touch or drag paddle'],
        'splash_image' => '/games/breakout/assets/splash.png',
        'home_image' => '/games/breakout/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Breakout game"></section>
<?php pbb_game_page_end(); ?>
