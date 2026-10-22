#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""悬浮球设置面板：滑块、颜色选择器、下拉框，修改后即时生效。"""

from __future__ import annotations

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor
from PyQt6.QtWidgets import (
    QColorDialog,
    QComboBox,
    QDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSlider,
    QVBoxLayout,
    QWidget,
)

from config import AppConfig

PANEL_QSS = """
QDialog, QWidget {
    background: #141820;
    color: #E8EEFC;
    font-family: "Segoe UI", "Microsoft YaHei UI", sans-serif;
    font-size: 12px;
}
QLabel#title {
    font-size: 14px;
    font-weight: 600;
    color: #F4F7FF;
    padding: 2px 0 8px 0;
}
QLabel#hint {
    color: #8B95A8;
    min-width: 36px;
}
QSlider::groove:horizontal {
    height: 6px;
    background: #2A3140;
    border-radius: 3px;
}
QSlider::handle:horizontal {
    width: 14px;
    height: 14px;
    margin: -5px 0;
    background: #6EA8FF;
    border-radius: 7px;
}
QComboBox {
    background: #1E2533;
    border: 1px solid #343C4E;
    border-radius: 6px;
    padding: 4px 8px;
    min-height: 22px;
}
QComboBox QAbstractItemView {
    background: #1E2533;
    color: #E8EEFC;
    selection-background-color: #2E4A7A;
}
QPushButton#colorBtn {
    border: 1px solid #4A5568;
    border-radius: 6px;
    min-height: 26px;
    min-width: 88px;
}
QPushButton#closeBtn {
    background: #2A3344;
    border: none;
    border-radius: 6px;
    padding: 6px 16px;
}
QPushButton#closeBtn:hover {
    background: #364056;
}
"""


class SettingsDialog(QDialog):
    changed = pyqtSignal()

    def __init__(self, config: AppConfig, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.config = config
        self.setWindowTitle("PY 流光 · 设置")
        self.setWindowFlags(
            Qt.WindowType.Tool
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.WindowCloseButtonHint
        )
        self.setModal(False)
        self.setFixedWidth(320)
        self.setStyleSheet(PANEL_QSS)
        self._building = True
        self._build_ui()
        self.sync_from_config()
        self._building = False

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(16, 14, 16, 14)
        root.setSpacing(10)

        title = QLabel("悬浮球外观与显示")
        title.setObjectName("title")
        root.addWidget(title)

        form = QFormLayout()
        form.setSpacing(8)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)

        self.diameter_slider, self.diameter_value = self._make_slider(60, 140)
        form.addRow("直径", self._wrap_slider(self.diameter_slider, self.diameter_value, "px"))

        self.color_btn = QPushButton("选择颜色")
        self.color_btn.setObjectName("colorBtn")
        self.color_btn.clicked.connect(self._pick_color)
        form.addRow("光环颜色", self.color_btn)

        self.width_slider, self.width_value = self._make_slider(2, 14)
        form.addRow("线宽", self._wrap_slider(self.width_slider, self.width_value, "px"))

        self.opacity_slider, self.opacity_value = self._make_slider(30, 100)
        form.addRow("不透明度", self._wrap_slider(self.opacity_slider, self.opacity_value, "%"))

        self.speed_slider, self.speed_value = self._make_slider(0, 180)
        form.addRow("旋转速度", self._wrap_slider(self.speed_slider, self.speed_value, "°/s"))

        self.style_combo = QComboBox()
        self.style_combo.addItem("Rainbow 彩虹", "rainbow")
        self.style_combo.addItem("单色", "solid")
        form.addRow("光环样式", self.style_combo)

        self.mode_combo = QComboBox()
        self.mode_combo.addItem("常显", "always")
        self.mode_combo.addItem("悬停显示", "hover")
        form.addRow("显示模式", self.mode_combo)

        self.metric_combo = QComboBox()
        self.metric_combo.addItem("CPU", "cpu")
        self.metric_combo.addItem("内存", "mem")
        self.metric_combo.addItem("双显", "both")
        form.addRow("中央指标", self.metric_combo)

        root.addLayout(form)

        close_btn = QPushButton("关闭")
        close_btn.setObjectName("closeBtn")
        close_btn.clicked.connect(self.hide)
        root.addWidget(close_btn, alignment=Qt.AlignmentFlag.AlignRight)

        self.diameter_slider.valueChanged.connect(self._on_changed)
        self.width_slider.valueChanged.connect(self._on_changed)
        self.opacity_slider.valueChanged.connect(self._on_changed)
        self.speed_slider.valueChanged.connect(self._on_changed)
        self.style_combo.currentIndexChanged.connect(self._on_changed)
        self.mode_combo.currentIndexChanged.connect(self._on_changed)
        self.metric_combo.currentIndexChanged.connect(self._on_changed)

    def _make_slider(self, lo: int, hi: int) -> tuple[QSlider, QLabel]:
        slider = QSlider(Qt.Orientation.Horizontal)
        slider.setRange(lo, hi)
        value = QLabel()
        value.setObjectName("hint")
        value.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        return slider, value

    def _wrap_slider(self, slider: QSlider, value: QLabel, suffix: str) -> QWidget:
        box = QWidget()
        layout = QHBoxLayout(box)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        layout.addWidget(slider, 1)
        value.setMinimumWidth(48)
        self._bind_value_label(slider, value, suffix)
        layout.addWidget(value)
        return box

    def _bind_value_label(self, slider: QSlider, label: QLabel, suffix: str) -> None:
        def refresh(v: int) -> None:
            label.setText(f"{v}{suffix}")

        slider.valueChanged.connect(refresh)
        refresh(slider.value())

    def sync_from_config(self) -> None:
        self._building = True
        cfg = self.config
        cfg.clamp()
        self.diameter_slider.setValue(cfg.diameter)
        self.width_slider.setValue(cfg.line_width)
        self.opacity_slider.setValue(cfg.opacity)
        self.speed_slider.setValue(cfg.rotation_speed)
        self._set_combo(self.style_combo, cfg.ring_style)
        self._set_combo(self.mode_combo, cfg.display_mode)
        self._set_combo(self.metric_combo, cfg.primary_metric)
        self._paint_color_btn()
        self._building = False

    def _set_combo(self, combo: QComboBox, data: str) -> None:
        index = combo.findData(data)
        combo.setCurrentIndex(index if index >= 0 else 0)

    def _paint_color_btn(self) -> None:
        color = self.config.ring_color
        self.color_btn.setStyleSheet(
            f"QPushButton#colorBtn {{ background: {color}; color: #0B0E14; font-weight: 600; }}"
        )
        self.color_btn.setText(color)

    def _pick_color(self) -> None:
        current = QColor(self.config.ring_color)
        picked = QColorDialog.getColor(current, self, "选择光环颜色")
        if picked.isValid():
            self.config.ring_color = picked.name().upper()
            self._paint_color_btn()
            self._emit_change()

    def _on_changed(self, *_args) -> None:
        if self._building:
            return
        self.config.diameter = self.diameter_slider.value()
        self.config.line_width = self.width_slider.value()
        self.config.opacity = self.opacity_slider.value()
        self.config.rotation_speed = self.speed_slider.value()
        self.config.ring_style = str(self.style_combo.currentData())
        self.config.display_mode = str(self.mode_combo.currentData())
        self.config.primary_metric = str(self.metric_combo.currentData())
        self._emit_change()

    def _emit_change(self) -> None:
        self.config.clamp()
        self.config.save()
        self.changed.emit()
