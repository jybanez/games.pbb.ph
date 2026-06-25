<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Memory Cards',
    'category' => 'Quick Game',
    'game' => 'memory',
    'module' => '/games/memory/module.js',
    'orientation' => 'any',
    'description' => 'Match preparedness symbols in a compact memory game.',
    'launch' => [
        'start_label' => 'Start Matching',
        'objective' => 'Open cards and match every preparedness symbol pair.',
        'controls' => ['Tap or click cards'],
        'splash_image' => '/games/memory/assets/splash.png',
        'home_image' => '/games/memory/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Memory Cards game"></section>
<?php pbb_game_page_end(); ?>
