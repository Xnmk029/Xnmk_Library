# -*- coding: utf-8 -*-
"""配置模型与持久化（JSON 存于用户主目录）。"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, replace
from pathlib import Path

CONFIG_PATH = Path.home() / ".py_flowing_light.json"

HALO_MODES = ("rainbow", "solid")
DISPLAY_MODES = ("always", "hover")
CENTER_METRICS = ("cpu", "memory")

MIN_DIAMETER, MAX_DIAMETER = 60, 140
MIN_RING_WIDTH, MAX_RING_WIDTH = 2, 14
MIN_OPACITY, MAX_OPACITY = 0.30, 1.00
MIN_ROTATION, MAX_ROTATION = 0, 360  # 度/秒


@dataclass
class Settings:
    """悬浮球全部可配置项。"""

    diameter: int = 100            # 球体直径（px，60-140）
    halo_mode: str = "rainbow"     # 光环模式: rainbow=彩虹 / solid=单色
    halo_color: str = "#4FC3F7"    # 单色光环颜色（#RRGGBB）
    ring_width: int = 4            # 光环线宽（px）
    opacity: float = 0.92          # 窗口整体不透明度（0.30-1.00）
    rotation_speed: int = 90       # 光环旋转速度（度/秒，0=停止）
    display_mode: str = "always"   # 显示模式: always=常显 / hover=悬停显示
    center_metric: str = "cpu"     # 中央数字指标: cpu / memory
    pos_x: int = -1                # 记忆位置（-1 表示使用默认位置）
    pos_y: int = -1

    def clamped(self) -> "Settings":
        """返回一份经过取值范围校验的副本，保证异常配置不会破坏 UI。"""
        return replace(
            self,
            diameter=max(MIN_DIAMETER, min(MAX_DIAMETER, int(self.diameter))),
            ring_width=max(MIN_RING_WIDTH, min(MAX_RING_WIDTH, int(self.ring_width))),
            opacity=max(MIN_OPACITY, min(MAX_OPACITY, float(self.opacity))),
            rotation_speed=max(MIN_ROTATION, min(MAX_ROTATION, int(self.rotation_speed))),
            halo_mode=self.halo_mode if self.halo_mode in HALO_MODES else "rainbow",
            display_mode=self.display_mode if self.display_mode in DISPLAY_MODES else "always",
            center_metric=self.center_metric if self.center_metric in CENTER_METRICS else "cpu",
            halo_color=_safe_color(self.halo_color, "#4FC3F7"),
            pos_x=int(self.pos_x),
            pos_y=int(self.pos_y),
        )


def _safe_color(value: str, fallback: str) -> str:
    s = str(value).strip()
    if len(s) == 7 and s[0] == "#":
        try:
            int(s[1:], 16)
            return s.upper()
        except ValueError:
            pass
    return fallback


def default_settings() -> Settings:
    return Settings().clamped()


def load_settings(path: Path = CONFIG_PATH) -> Settings:
    """读取配置文件；缺失或损坏时回退到默认值。"""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default_settings()
    if not isinstance(raw, dict):
        return default_settings()
    known = {f: raw[f] for f in Settings.__dataclass_fields__ if f in raw}
    return Settings(**known).clamped()


def save_settings(settings: Settings, path: Path = CONFIG_PATH) -> None:
    """原子写入配置文件（先写临时文件再替换）。"""
    data = asdict(settings.clamped())
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        # 配置保存失败不应影响运行中的小部件
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
