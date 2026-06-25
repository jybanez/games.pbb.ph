<?php
require __DIR__ . '/../../src/GamePage.php';

pbb_game_page_start([
    'title' => 'Emergency Kit Quiz',
    'category' => 'Learning Game',
    'game' => 'kit-quiz',
]);
?>
        <section class="pbb-game-board">
            <p id="gameStatus" class="ui-badge">Question 1</p>
            <div class="pbb-game-panel">
                <h2 id="question" class="ui-title"></h2>
                <div id="choices" class="pbb-choice-grid"></div>
            </div>
        </section>
<?php pbb_game_page_end(); ?>
