# -*- coding: utf-8 -*-
"""设置面板：滑块 / 颜色选择器 / 下拉框，改动即时生效并自动保存。"""

from __future__ import annotations

from dataclasses import replace

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor
from PyQt6.QtWidgets import (QColorDialog, QComboBox, QDialog, QFormLayout,
                             QHBoxLayout, QLabel, QPushButton, QSlider,
                             QVBoxLayout, QWidget)

from config import (MAX_DIAMETER, MAX_RING_WIDTH, MAX_ROTATION, MIN_DIAMETER,
                    MIN_RING_WIDTH, MIN_ROTATION, Settings)

HALO_MODE_ITEMS = (("rainbow", "彩虹"), ("solid", "单色"))
DISPLAY_MODE_ITEMS = (("always", "常显"), ("hover", "悬停显示"))
CENTER_METRIC_ITEMS = (("cpu", "CPU"), ("memory", "内存"))


class SettingsDialog(QDialog):
    """PY 流光设置窗口。每次控件变动即发出 settings_changed 信号。"""

    settings_changed = pyqtSignal(object)  # Settings

    def __init__(self, settings: Settings, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("PY 流光 · 设置")
        self.setObjectName("SettingsDialog")
        self.setMinimumWidth(380)
        self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, True)
        self._settings = settings.clamped()
        self._building = True  # 初始化控件时屏蔽信号回调

        root = QVBoxLayout(self)
        form = QFormLayout()
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        # 直径
        self.diameter_slider, self.diameter_value = self._make_slider(
            MIN_DIAMETER, MAX_DIAMETER, self._settings.diameter, self._on_diameter
        )
        form.addRow(self._row_label("球体直径"), self._slider_cell(self.diameter_slider, self.diameter_value, "px"))

        # 光环模式
        self.halo_mode_box = self._make_combo(HALO_MODE_ITEMS, self._settings.halo_mode, self._on_halo_mode)
        form.addRow(self._row_label("光环模式"), self.halo_mode_box)

        # 光环颜色
        self.color_btn = QPushButton()
        self.color_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.color_btn.clicked.connect(self._on_pick_color)
        self._refresh_color_button()
        form.addRow(self._row_label("光环颜色"), self.color_btn)

        # 线宽
        self.ring_slider, self.ring_value = self._make_slider(
            MIN_RING_WIDTH, MAX_RING_WIDTH, self._settings.ring_width, self._on_ring_width
        )
        form.addRow(self._row_label("光环线宽"), self._slider_cell(self.ring_slider, self.ring_value, "px"))

        # 透明度
        self.opacity_slider, self.opacity_value = self._make_slider(
            30, 100, int(self._settings.opacity * 100), self._on_opacity
        )
        form.addRow(self._row_label("窗口不透明度"), self._slider_cell(self.opacity_slider, self.opacity_value, "%"))

        # 旋转速度
        self.rotation_slider, self.rotation_value = self._make_slider(
            MIN_ROTATION, MAX_ROTATION, self._settings.rotation_speed, self._on_rotation, step=15
        )
        form.addRow(self._row_label("旋转速度"), self._slider_cell(self.rotation_slider, self.rotation_value, "°/s"))

        # 显示模式
        self.display_box = self._make_combo(DISPLAY_MODE_ITEMS, self._settings.display_mode, self._on_display_mode)
        form.addRow(self._row_label("显示模式"), self.display_box)

        # 中央指标
        self.metric_box = self._make_combo(CENTER_METRIC_ITEMS, self._settings.center_metric, self._on_metric)
        form.addRow(self._row_label("中央数字"), self.metric_box)

        root.addLayout(form)

        # 底部按钮
        buttons = QHBoxLayout()
        reset_btn = QPushButton("恢复默认")
        reset_btn.clicked.connect(self._on_reset)
        close_btn = QPushButton("关闭")
        close_btn.setDefault(True)
        close_btn.clicked.connect(self.accept)
        buttons.addWidget(reset_btn)
        buttons.addStretch(1)
        buttons.addWidget(close_btn)
        root.addLayout(buttons)

        self._building = False

    # ---------------------------------------------------------- 控件构造

    @staticmethod
    def _row_label(text: str) -> QLabel:
        return QLabel(text)

    def _make_slider(self, lo: int, hi: int, value: int, slot, step: int = 1):
        slider = QSlider(Qt.Orientation.Horizontal)
        slider.setRange(lo, hi)
        slider.setSingleStep(step)
        slider.setPageStep(step)
        slider.setValue(value)
        slider.valueChanged.connect(slot)
        value_label = QLabel(f"{value}")
        value_label.setMinimumWidth(52)
        value_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        return slider, value_label

    @staticmethod
    def _slider_cell(slider: QSlider, value_label: QLabel, unit: str) -> QWidget:
        cell = QWidget()
        lay = QHBoxLayout(cell)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(slider, 1)
        value_label.setText(f"{value_label.text()}{unit}")
        lay.addWidget(value_label)
        return cell

    @staticmethod
    def _make_combo(items, current: str, slot) -> QComboBox:
        box = QComboBox()
        for key, text in items:
            box.addItem(text, key)
        idx = box.findData(current)
        if idx >= 0:
            box.setCurrentIndex(idx)
        box.currentIndexChanged.connect(lambda _i, s=slot, b=box: s(b.currentData()))
        return box

    # ---------------------------------------------------------- 信号槽

    def _emit(self) -> None:
        if not self._building:
            self.settings_changed.emit(self._settings.clamped())

    def _on_diameter(self, value: int) -> None:
        self.diameter_value.setText(f"{value}px")
        self._settings = replace(self._settings, diameter=value)
        self._emit()

    def _on_ring_width(self, value: int) -> None:
        self.ring_value.setText(f"{value}px")
        self._settings = replace(self._settings, ring_width=value)
        self._emit()

    def _on_opacity(self, value: int) -> None:
        self.opacity_value.setText(f"{value}%")
        self._settings = replace(self._settings, opacity=value / 100.0)
        self._emit()

    def _on_rotation(self, value: int) -> None:
        self.rotation_value.setText(f"{value}°/s")
        self._settings = replace(self._settings, rotation_speed=value)
        self._emit()

    def _on_halo_mode(self, mode: str) -> None:
        self._settings = replace(self._settings, halo_mode=mode)
        self._emit()

    def _on_display_mode(self, mode: str) -> None:
        self._settings = replace(self._settings, display_mode=mode)
        self._emit()

    def _on_metric(self, metric: str) -> None:
        self._settings = replace(self._settings, center_metric=metric)
        self._emit()

    def _on_pick_color(self) -> None:
        color = QColorDialog.getColor(
            QColor(self._settings.halo_color), self, "选择光环颜色", QColorDialog.ColorDialogOption.ShowAlphaChannel
        )
        if color.isValid():
            self._settings = replace(self._settings, halo_color=color.name().upper())
            self._refresh_color_button()
            self._emit()

    def _refresh_color_button(self) -> None:
        self.color_btn.setText(self._settings.halo_color)
        self.color_btn.setStyleSheet(
            f"background-color: {self._settings.halo_color}; color: #FFFFFF; padding: 4px 10px; border: 1px solid #888;"
        )

    def _on_reset(self) -> None:
        defaults = Settings()
        self._settings = defaults.clamped()
        # 同步全部控件（building 标志避免重复发射信号）
        self._building = True
        self.diameter_slider.setValue(self._settings.diameter)
        self.diameter_value.setText(f"{self._settings.diameter}px")
        self.halo_mode_box.setCurrentIndex(self.halo_mode_box.findData(self._settings.halo_mode))
        self.ring_slider.setValue(self._settings.ring_width)
        self.ring_value.setText(f"{self._settings.ring_width}px")
        self.opacity_slider.setValue(int(self._settings.opacity * 100))
        self.opacity_value.setText(f"{int(self._settings.opacity * 100)}%")
        self.rotation_slider.setValue(self._settings.rotation_speed)
        self.rotation_value.setText(f"{self._settings.rotation_speed}°/s")
        self.display_box.setCurrentIndex(self.display_box.findData(self._settings.display_mode))
        self.metric_box.setCurrentIndex(self.metric_box.findData(self._settings.center_metric))
        self._refresh_color_button()
        self._building = False
        self._emit()
