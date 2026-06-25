<?php

require __DIR__ . '/src/ModePolicy.php';
require __DIR__ . '/src/GameRegistry.php';

$config = require __DIR__ . '/config/games.php';
$registry = GameRegistry::fromFile(__DIR__ . '/config/games.registry.php');

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'app' => 'pbb-games-corner',
    'status' => (isset($config['enabled']) ? (bool)$config['enabled'] : true) ? 'ok' : 'disabled',
    'enabled' => isset($config['enabled']) ? (bool)$config['enabled'] : true,
    'mode' => ModePolicy::mode($config),
    'version' => isset($config['version']) ? (string)$config['version'] : '0.1.0',
    'games_total' => count($registry->all()),
    'games_visible' => count($registry->visible($config)),
    'categories' => $registry->categories(),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
