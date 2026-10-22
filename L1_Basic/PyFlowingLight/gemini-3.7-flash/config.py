"""
PY Flowing Light - Configuration Management Module
Manages application settings with JSON persistence and theme presets.
"""

import json
import os
from typing import Any, Dict


# Default application configuration
DEFAULT_CONFIG: Dict[str, Any] = {
    "diameter": 96,                 # 60 to 140 px
    "opacity": 0.92,                # 0.20 to 1.00 (glass opacity)
    "ring_mode": "rainbow",         # 'rainbow', 'cyber_neon', 'aurora', 'sunset', 'emerald', 'solid'
    "custom_color": "#00E5FF",      # Hex color code for solid/custom mode
    "ring_width": 3.5,              # 1.0 to 8.0 px
    "ring_visibility": "always",    # 'always', 'hover'
    "rotation_speed": 1.5,          # 0.0 to 5.0 x
    "display_mode": "dual",         # 'dual', 'cpu_only', 'ram_only', 'cycle'
    "cycle_interval": 3.0,          # seconds per metric in cycle mode
    "monitor_interval": 1.0,        # seconds between system stat polls
    "always_on_top": True,          # float on top of other windows
    "position_locked": False,       # prevent accidental dragging
    "pos_x": None,                  # window X position on screen
    "pos_y": None                   # window Y position on screen
}

# Theme Preset Definitions
THEMES = {
    "rainbow": {
        "name": "彩虹流光 (Rainbow)",
        "colors": [
            (0.0, "#FF3366"),
            (0.17, "#FF9900"),
            (0.33, "#FFFF00"),
            (0.50, "#00FF88"),
            (0.67, "#00E5FF"),
            (0.83, "#9D00FF"),
            (1.0, "#FF3366")
        ]
    },
    "cyber_neon": {
        "name": "赛博霓虹 (Cyber Neon)",
        "colors": [
            (0.0, "#00F2FE"),
            (0.35, "#4FACFE"),
            (0.70, "#FA709A"),
            (1.0, "#00F2FE")
        ]
    },
    "aurora": {
        "name": "极光掠影 (Aurora)",
        "colors": [
            (0.0, "#0575E6"),
            (0.33, "#00F260"),
            (0.66, "#38EF7D"),
            (1.0, "#0575E6")
        ]
    },
    "sunset": {
        "name": "落日余晖 (Sunset)",
        "colors": [
            (0.0, "#FF0844"),
            (0.35, "#FFB199"),
            (0.70, "#FFD200"),
            (1.0, "#FF0844")
        ]
    },
    "emerald": {
        "name": "翡翠流光 (Emerald)",
        "colors": [
            (0.0, "#11998E"),
            (0.50, "#38EF7D"),
            (1.0, "#11998E")
        ]
    },
    "solid": {
        "name": "单色定制 (Custom Solid)",
        "colors": []  # Generated dynamically from custom_color
    }
}


class ConfigManager:
    """Manages reading, writing, and validating user configuration."""

    def __init__(self, config_filename: str = "config.json"):
        self.config_dir = os.path.dirname(os.path.abspath(__file__))
        self.config_path = os.path.join(self.config_dir, config_filename)
        self.config: Dict[str, Any] = dict(DEFAULT_CONFIG)
        self.load()

    def load(self) -> Dict[str, Any]:
        """Loads configuration from JSON file with fallback to defaults."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        for k, v in data.items():
                            if k in DEFAULT_CONFIG:
                                self.config[k] = v
            except Exception as e:
                print(f"[ConfigManager] Error reading config file: {e}")
        return self.config

    def save(self) -> bool:
        """Saves current configuration to JSON file."""
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"[ConfigManager] Error saving config file: {e}")
            return False

    def get(self, key: str, default: Any = None) -> Any:
        """Retrieves a configuration value."""
        return self.config.get(key, default if default is not None else DEFAULT_CONFIG.get(key))

    def set(self, key: str, value: Any, auto_save: bool = True):
        """Sets a configuration value and optionally persists it."""
        self.config[key] = value
        if auto_save:
            self.save()

    def reset_to_default(self):
        """Resets all configuration values to defaults and persists."""
        self.config = dict(DEFAULT_CONFIG)
        self.save()
