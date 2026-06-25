<?php

final class ModePolicy
{
    const MODES = ['normal', 'monitoring', 'active_incident', 'emergency'];
    const CATEGORIES = ['quick', 'learning', 'retro', 'local'];

    public static function mode(array $config)
    {
        $mode = isset($config['mode']) ? (string)$config['mode'] : 'normal';
        return in_array($mode, self::MODES, true) ? $mode : 'normal';
    }

    public static function categoryEnabled($category, array $config)
    {
        $key = 'show_' . $category . ($category === 'retro' ? '_corner' : '_games');
        return isset($config[$key]) ? (bool)$config[$key] : true;
    }

    public static function categoryAllowedInMode($category, $mode)
    {
        if ($mode === 'emergency') {
            return false;
        }
        if ($mode === 'active_incident') {
            return $category === 'learning';
        }
        return true;
    }

    public static function gameVisible(array $game, array $config)
    {
        if (!(isset($config['enabled']) ? (bool)$config['enabled'] : true)) {
            return false;
        }
        if (!(isset($game['enabled']) ? (bool)$game['enabled'] : false)) {
            return false;
        }

        $mode = self::mode($config);
        $category = isset($game['category']) ? (string)$game['category'] : '';
        $visibility = isset($game['mode_visibility']) ? $game['mode_visibility'] : [];

        return self::categoryEnabled($category, $config)
            && self::categoryAllowedInMode($category, $mode)
            && in_array($mode, is_array($visibility) ? $visibility : [], true);
    }

    public static function banner(array $config)
    {
        $mode = self::mode($config);
        if ($mode === 'monitoring') {
            return ['tone' => 'warning', 'text' => 'Monitoring mode is active. Games remain available, but PBB services may take priority.'];
        }
        if ($mode === 'active_incident') {
            return ['tone' => 'warning', 'text' => 'Active incident mode is active. Quick games and Retro Corner are hidden.'];
        }
        if ($mode === 'emergency') {
            return ['tone' => 'critical', 'text' => isset($config['emergency_message']) ? (string)$config['emergency_message'] : 'Games are disabled during emergencies.'];
        }
        return ['tone' => 'info', 'text' => 'Games may be disabled during emergencies to prioritize emergency services.'];
    }
}
