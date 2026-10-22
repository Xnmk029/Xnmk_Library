#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""悬浮球配置的加载、校验与持久化。"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

CONFIG_FILENAME = "float_ball_config.json"


def config_path() -> Path:
    return Path(__file__).resolve().parent / CONFIG_FILENAME


@dataclass
class AppConfig:
    diameter: int = 108
    ring_color: str = "#6EA8FF"
    line_width: int = 6
    opacity: int = 92
    rotation_speed: int = 48
    display_mode: str = "always"  # always | hover
    ring_style: str = "rainbow"  # rainbow | solid
    primary_metric: str = "cpu"  # cpu | mem | both
    pos_x: int | None = None
    pos_y: int | None = None

    def clamp(self) -> None:
        self.diameter = int(min(140, max(60, self.diameter)))
        self.line_width = int(min(14, max(2, self.line_width)))
        self.opacity = int(min(100, max(30, self.opacity)))
        self.rotation_speed = int(min(180, max(0, self.rotation_speed)))
        if self.display_mode not in ("always", "hover"):
            self.display_mode = "always"
        if self.ring_style not in ("rainbow", "solid"):
            self.ring_style = "rainbow"
        if self.primary_metric not in ("cpu", "mem", "both"):
            self.primary_metric = "cpu"
        color = (self.ring_color or "").strip()
        if not (color.startswith("#") and len(color) in (4, 7)):
            self.ring_color = "#6EA8FF"
        else:
            self.ring_color = color.upper()

    def to_dict(self) -> dict[str, Any]:
        self.clamp()
        return asdict(self)

    def update_from_dict(self, data: dict[str, Any]) -> None:
        if not isinstance(data, dict):
            return
        for key in (
            "diameter",
            "ring_color",
            "line_width",
            "opacity",
            "rotation_speed",
            "display_mode",
            "ring_style",
            "primary_metric",
            "pos_x",
            "pos_y",
        ):
            if key in data:
                setattr(self, key, data[key])
        self.clamp()

    def load(self, path: Path | None = None) -> None:
        target = path or config_path()
        if not target.is_file():
            return
        try:
            raw = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if isinstance(raw, dict):
            self.update_from_dict(raw)

    def save(self, path: Path | None = None) -> None:
        target = path or config_path()
        payload = json.dumps(self.to_dict(), ensure_ascii=False, indent=2)
        tmp = target.with_suffix(".tmp")
        try:
            tmp.write_text(payload + "\n", encoding="utf-8")
            tmp.replace(target)
        except OSError:
            try:
                if tmp.exists():
                    tmp.unlink()
            except OSError:
                pass
            try:
                target.write_text(payload + "\n", encoding="utf-8")
            except OSError:
                pass
