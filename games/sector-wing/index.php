<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Sector Wing',
    'category' => 'Quick Game',
    'game' => 'sector-wing',
    'module' => '/games/sector-wing/module.js',
    'orientation' => 'landscape',
    'description' => 'Fly a compact wing craft through neon sectors, clear drone waves, and survive the route.',
    'launch' => [
        'start_label' => 'Start Sector Wing',
        'objective' => 'Dodge hazards, collect energy cells, clear drone waves, and survive each sector route.',
        'controls' => ['Arrow keys or WASD', 'Space or touch Fire', 'Pause / Restart'],
        'splash_image' => '/games/sector-wing/assets/splash.png',
        'home_image' => '/games/sector-wing/assets/home.png',
    ],
]);
?>
        <section id="directGameHost" class="pbb-direct-game-host" aria-label="Sector Wing game"></section>
<?php pbb_game_page_end(); ?>
