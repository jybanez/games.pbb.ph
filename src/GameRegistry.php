<?php

final class GameRegistry
{
    private $games;

    public function __construct(array $games)
    {
        $this->games = array_values(array_map([$this, 'normalize'], $games));
        usort($this->games, function (array $a, array $b) {
            if ($a['order'] === $b['order']) {
                return strcmp($a['title'], $b['title']);
            }
            return $a['order'] < $b['order'] ? -1 : 1;
        });
    }

    public static function fromFile($path)
    {
        $games = require $path;
        return new self(is_array($games) ? $games : []);
    }

    public function all()
    {
        return $this->games;
    }

    public function visible(array $config)
    {
        return array_values(array_filter($this->games, function (array $game) use ($config) {
            return ModePolicy::gameVisible($game, $config);
        }));
    }

    public function categories()
    {
        return ModePolicy::CATEGORIES;
    }

    public function visibleCountByCategory(array $config)
    {
        $counts = array_fill_keys($this->categories(), 0);
        foreach ($this->visible($config) as $game) {
            $category = $game['category'];
            if (isset($counts[$category])) {
                $counts[$category]++;
            }
        }
        return $counts;
    }

    private function normalize(array $game)
    {
        return [
            'id' => isset($game['id']) ? (string)$game['id'] : '',
            'title' => isset($game['title']) ? (string)$game['title'] : 'Untitled Game',
            'category' => isset($game['category']) ? (string)$game['category'] : 'quick',
            'subcategory' => isset($game['subcategory']) ? (string)$game['subcategory'] : '',
            'description' => isset($game['description']) ? (string)$game['description'] : '',
            'path' => isset($game['path']) ? (string)$game['path'] : '#',
            'module' => isset($game['module']) ? (string)$game['module'] : '',
            'styles' => array_values(array_filter((array)(isset($game['styles']) ? $game['styles'] : []), 'is_string')),
            'assets' => array_values(array_filter((array)(isset($game['assets']) ? $game['assets'] : []), 'is_string')),
            'enabled' => isset($game['enabled']) ? (bool)$game['enabled'] : false,
            'order' => isset($game['order']) ? (int)$game['order'] : 999,
            'mode_visibility' => array_values(array_filter((array)(isset($game['mode_visibility']) ? $game['mode_visibility'] : []), 'is_string')),
            'tags' => array_values(array_filter((array)(isset($game['tags']) ? $game['tags'] : []), 'is_string')),
            'estimated_minutes' => isset($game['estimated_minutes']) ? $game['estimated_minutes'] : null,
            'learning_value' => isset($game['learning_value']) ? $game['learning_value'] : null,
            'content_rating' => isset($game['content_rating']) ? (string)$game['content_rating'] : 'general',
            'emergency_priority' => isset($game['emergency_priority']) ? (string)$game['emergency_priority'] : 'low',
            'requires_keyboard' => isset($game['requires_keyboard']) ? (bool)$game['requires_keyboard'] : false,
            'supports_touch' => isset($game['supports_touch']) ? (bool)$game['supports_touch'] : true,
            'orientation' => $this->normalizeOrientation(isset($game['orientation']) ? $game['orientation'] : 'any'),
            'launch' => $this->normalizeLaunch(isset($game['launch']) && is_array($game['launch']) ? $game['launch'] : [], $game),
            'icon' => strtoupper(substr((string)(isset($game['icon']) ? $game['icon'] : (isset($game['title']) ? $game['title'] : 'G')), 0, 2)),
            'icon_image' => isset($game['icon_image']) ? (string)$game['icon_image'] : '',
        ];
    }

    private function normalizeOrientation($orientation)
    {
        $value = strtolower(trim((string)$orientation));
        return in_array($value, ['any', 'portrait', 'landscape'], true) ? $value : 'any';
    }

    private function normalizeLaunch(array $launch, array $game)
    {
        return [
            'start_label' => isset($launch['start_label']) ? (string)$launch['start_label'] : 'Start',
            'objective' => isset($launch['objective']) ? (string)$launch['objective'] : (isset($game['description']) ? (string)$game['description'] : ''),
            'controls' => array_values(array_filter((array)(isset($launch['controls']) ? $launch['controls'] : []), 'is_string')),
            'splash_image' => isset($launch['splash_image']) ? (string)$launch['splash_image'] : '',
            'home_image' => isset($launch['home_image']) ? (string)$launch['home_image'] : '',
        ];
    }
}
