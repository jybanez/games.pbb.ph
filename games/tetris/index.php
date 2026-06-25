<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Tetris',
    'category' => 'Quick Game',
    'game' => 'tetris',
    'module' => '/games/tetris/module.js',
    'orientation' => 'portrait',
    'description' => 'Stack falling blocks, clear complete lines, and keep the board open.',
    'launch' => [
        'start_label' => 'Start Tetris',
        'objective' => 'Move, rotate, and drop falling blocks to clear complete lines.',
        'controls' => ['Touch D-pad', 'Rotate / Drop buttons', 'Keyboard arrows'],
        'splash_image' => '/games/tetris/assets/splash.png',
        'home_image' => '/games/tetris/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Tetris game"></section>
<?php pbb_game_page_end(); ?>
