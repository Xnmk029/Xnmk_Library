"""
PY Flowing Light - Settings & Configuration Dialog
Provides a modern, intuitive visual configuration panel with real-time live preview.
"""

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor, QFont
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QSlider,
    QComboBox, QPushButton, QCheckBox, QColorDialog,
    QFrame, QTabWidget, QWidget, QGroupBox
)

from config import ConfigManager, THEMES, DEFAULT_CONFIG


class SettingsDialog(QDialog):
    """
    Settings panel dialog allowing users to customize floating ball size,
    visual themes, rotation speeds, opacities, and display modes.
    """
    config_changed = pyqtSignal()

    def __init__(self, config_manager: ConfigManager, parent=None):
        super().__init__(parent)
        self.cfg_mgr = config_manager
        self.cfg = self.cfg_mgr.config

        self.setWindowTitle("PY 流光 - 个性化设置")
        self.setFixedWidth(420)
        self._init_ui()
        self._apply_stylesheet()

    def _init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(14)

        # Header Title
        title_box = QHBoxLayout()
        title_label = QLabel("✨ PY 流光桌面悬浮球设置")
        title_label.setObjectName("DialogTitle")
        title_box.addWidget(title_label)
        title_box.addStretch()
        main_layout.addLayout(title_box)

        # Tab Widget for organized settings
        tabs = QTabWidget()
        tabs.setObjectName("SettingsTabs")

        # Tab 1: Visual Style & Themes
        tab_visual = QWidget()
        layout_visual = QVBoxLayout(tab_visual)
        layout_visual.setContentsMargins(12, 16, 12, 12)
        layout_visual.setSpacing(12)

        # Theme Selection
        theme_row = QHBoxLayout()
        theme_label = QLabel("流光主题风格:")
        self.combo_theme = QComboBox()
        for key, info in THEMES.items():
            self.combo_theme.addItem(info["name"], key)
        
        current_theme = self.cfg.get("ring_mode", "rainbow")
        idx = self.combo_theme.findData(current_theme)
        if idx >= 0:
            self.combo_theme.setCurrentIndex(idx)
        self.combo_theme.currentIndexChanged.connect(self._on_theme_changed)
        theme_row.addWidget(theme_label)
        theme_row.addWidget(self.combo_theme)
        layout_visual.addLayout(theme_row)

        # Custom Solid Color Picker Row
        self.color_row_widget = QWidget()
        color_layout = QHBoxLayout(self.color_row_widget)
        color_layout.setContentsMargins(0, 0, 0, 0)
        lbl_custom_col = QLabel("定制单色颜色:")
        self.btn_color_pick = QPushButton()
        self.btn_color_pick.setObjectName("ColorPickerBtn")
        self.btn_color_pick.setFixedSize(90, 28)
        self.btn_color_pick.clicked.connect(self._pick_custom_color)
        self._update_color_button_swatch()
        color_layout.addWidget(lbl_custom_col)
        color_layout.addStretch()
        color_layout.addWidget(self.btn_color_pick)
        layout_visual.addWidget(self.color_row_widget)

        # Ball Diameter Slider
        self.slider_diameter, self.lbl_diameter_val = self._create_slider_row(
            layout_visual, "球体直径大小", 60, 140, int(self.cfg.get("diameter", 96)), "px"
        )
        self.slider_diameter.valueChanged.connect(self._on_diameter_changed)

        # Glass Opacity Slider
        init_op_val = int(self.cfg.get("opacity", 0.92) * 100)
        self.slider_opacity, self.lbl_opacity_val = self._create_slider_row(
            layout_visual, "玻璃球底透明度", 20, 100, init_op_val, "%"
        )
        self.slider_opacity.valueChanged.connect(self._on_opacity_changed)

        # Halo Ring Width Slider
        init_width_val = int(self.cfg.get("ring_width", 3.5) * 10)
        self.slider_width, self.lbl_width_val = self._create_slider_row(
            layout_visual, "流光光环粗细", 10, 80, init_width_val, "px", divisor=10.0
        )
        self.slider_width.valueChanged.connect(self._on_width_changed)

        # Halo Rotation Speed Slider
        init_speed_val = int(self.cfg.get("rotation_speed", 1.5) * 10)
        self.slider_speed, self.lbl_speed_val = self._create_slider_row(
            layout_visual, "光环流转转速", 0, 50, init_speed_val, "x", divisor=10.0
        )
        self.slider_speed.valueChanged.connect(self._on_speed_changed)

        # Ring Visibility Mode
        vis_row = QHBoxLayout()
        vis_label = QLabel("流光显示触发:")
        self.combo_vis = QComboBox()
        self.combo_vis.addItem("始终保持显示", "always")
        self.combo_vis.addItem("仅鼠标悬停时激活", "hover")
        vis_idx = self.combo_vis.findData(self.cfg.get("ring_visibility", "always"))
        if vis_idx >= 0:
            self.combo_vis.setCurrentIndex(vis_idx)
        self.combo_vis.currentIndexChanged.connect(self._on_vis_changed)
        vis_row.addWidget(vis_label)
        vis_row.addWidget(self.combo_vis)
        layout_visual.addLayout(vis_row)

        layout_visual.addStretch()
        tabs.addTab(tab_visual, "视觉与流光")

        # Tab 2: Monitoring & Behavior
        tab_behavior = QWidget()
        layout_behavior = QVBoxLayout(tab_behavior)
        layout_behavior.setContentsMargins(12, 16, 12, 12)
        layout_behavior.setSpacing(14)

        # Display Metric Mode
        disp_row = QHBoxLayout()
        disp_label = QLabel("监控指标排版:")
        self.combo_disp = QComboBox()
        self.combo_disp.addItem("双环仪表 (CPU + 内存)", "dual")
        self.combo_disp.addItem("仅 CPU 仪表", "cpu_only")
        self.combo_disp.addItem("仅 内存 仪表", "ram_only")
        self.combo_disp.addItem("自动轮播 (CPU & 内存)", "cycle")
        disp_idx = self.combo_disp.findData(self.cfg.get("display_mode", "dual"))
        if disp_idx >= 0:
            self.combo_disp.setCurrentIndex(disp_idx)
        self.combo_disp.currentIndexChanged.connect(self._on_disp_mode_changed)
        disp_row.addWidget(disp_label)
        disp_row.addWidget(self.combo_disp)
        layout_behavior.addLayout(disp_row)

        # Monitor Polling Interval Slider
        init_poll = int(self.cfg.get("monitor_interval", 1.0) * 10)
        self.slider_poll, self.lbl_poll_val = self._create_slider_row(
            layout_behavior, "资源采集刷新频率", 5, 30, init_poll, "秒", divisor=10.0
        )
        self.slider_poll.valueChanged.connect(self._on_poll_interval_changed)

        # Checkboxes Group
        grp_window = QGroupBox("窗口与位置行为")
        layout_grp = QVBoxLayout(grp_window)
        layout_grp.setSpacing(10)

        self.chk_always_top = QCheckBox("置顶显示 (Always on Top)")
        self.chk_always_top.setChecked(self.cfg.get("always_on_top", True))
        self.chk_always_top.toggled.connect(self._on_top_toggled)
        layout_grp.addWidget(self.chk_always_top)

        self.chk_lock_pos = QCheckBox("锁定悬浮球位置 (禁止鼠标拖动)")
        self.chk_lock_pos.setChecked(self.cfg.get("position_locked", False))
        self.chk_lock_pos.toggled.connect(self._on_lock_pos_toggled)
        layout_grp.addWidget(self.chk_lock_pos)

        layout_behavior.addWidget(grp_window)
        layout_behavior.addStretch()
        tabs.addTab(tab_behavior, "监控与窗口")

        main_layout.addWidget(tabs)

        # Bottom Action Buttons
        btn_box = QHBoxLayout()
        self.btn_reset = QPushButton("恢复默认设置")
        self.btn_reset.setObjectName("ResetButton")
        self.btn_reset.clicked.connect(self._on_reset_defaults)

        self.btn_close = QPushButton("完成")
        self.btn_close.setObjectName("CloseButton")
        self.btn_close.clicked.connect(self.accept)

        btn_box.addWidget(self.btn_reset)
        btn_box.addStretch()
        btn_box.addWidget(self.btn_close)
        main_layout.addLayout(btn_box)

        self._update_ui_state()

    def _create_slider_row(self, parent_layout, label_text, min_val, max_val, init_val, unit, divisor=1.0):
        row = QHBoxLayout()
        lbl = QLabel(label_text + ":")
        slider = QSlider(Qt.Orientation.Horizontal)
        slider.setRange(min_val, max_val)
        slider.setValue(init_val)

        val_str = f"{init_val / divisor:.1f} {unit}" if divisor != 1.0 else f"{init_val} {unit}"
        lbl_val = QLabel(val_str)
        lbl_val.setObjectName("ValueDisplayLabel")
        lbl_val.setFixedWidth(54)
        lbl_val.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)

        row.addWidget(lbl)
        row.addWidget(slider)
        row.addWidget(lbl_val)
        parent_layout.addLayout(row)
        return slider, lbl_val

    def _update_ui_state(self):
        """Toggles visibility of dependent controls (e.g. custom color button)."""
        is_solid = self.combo_theme.currentData() == "solid"
        self.color_row_widget.setVisible(is_solid)

    def _update_color_button_swatch(self):
        col_hex = self.cfg.get("custom_color", "#00E5FF")
        c = QColor(col_hex)
        text_col = "#000000" if c.lightness() > 140 else "#FFFFFF"
        self.btn_color_pick.setStyleSheet(f"""
            QPushButton#ColorPickerBtn {{
                background-color: {col_hex};
                color: {text_col};
                border: 2px solid #64748B;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }}
            QPushButton#ColorPickerBtn:hover {{
                border-color: #38BDF8;
            }}
        """)
        self.btn_color_pick.setText(col_hex.upper())

    # --- Change Event Handlers (Real-time sync) ---

    def _on_theme_changed(self):
        theme_key = self.combo_theme.currentData()
        self.cfg_mgr.set("ring_mode", theme_key, auto_save=True)
        self._update_ui_state()
        self.config_changed.emit()

    def _pick_custom_color(self):
        curr_col = QColor(self.cfg.get("custom_color", "#00E5FF"))
        color = QColorDialog.getColor(curr_col, self, "选择自定义流光颜色")
        if color.isValid():
            hex_str = color.name().upper()
            self.cfg_mgr.set("custom_color", hex_str, auto_save=True)
            self._update_color_button_swatch()
            self.config_changed.emit()

    def _on_diameter_changed(self, val):
        self.lbl_diameter_val.setText(f"{val} px")
        self.cfg_mgr.set("diameter", val, auto_save=True)
        self.config_changed.emit()

    def _on_opacity_changed(self, val):
        self.lbl_opacity_val.setText(f"{val} %")
        self.cfg_mgr.set("opacity", val / 100.0, auto_save=True)
        self.config_changed.emit()

    def _on_width_changed(self, val):
        w = val / 10.0
        self.lbl_width_val.setText(f"{w:.1f} px")
        self.cfg_mgr.set("ring_width", w, auto_save=True)
        self.config_changed.emit()

    def _on_speed_changed(self, val):
        s = val / 10.0
        self.lbl_speed_val.setText(f"{s:.1f} x")
        self.cfg_mgr.set("rotation_speed", s, auto_save=True)
        self.config_changed.emit()

    def _on_vis_changed(self):
        self.cfg_mgr.set("ring_visibility", self.combo_vis.currentData(), auto_save=True)
        self.config_changed.emit()

    def _on_disp_mode_changed(self):
        self.cfg_mgr.set("display_mode", self.combo_disp.currentData(), auto_save=True)
        self.config_changed.emit()

    def _on_poll_interval_changed(self, val):
        sec = val / 10.0
        self.lbl_poll_val.setText(f"{sec:.1f} 秒")
        self.cfg_mgr.set("monitor_interval", sec, auto_save=True)
        self.config_changed.emit()

    def _on_top_toggled(self, checked):
        self.cfg_mgr.set("always_on_top", checked, auto_save=True)
        self.config_changed.emit()

    def _on_lock_pos_toggled(self, checked):
        self.cfg_mgr.set("position_locked", checked, auto_save=True)
        self.config_changed.emit()

    def _on_reset_defaults(self):
        self.cfg_mgr.reset_to_default()
        self.cfg = self.cfg_mgr.config

        # Sync all controls back to default
        idx = self.combo_theme.findData(DEFAULT_CONFIG["ring_mode"])
        if idx >= 0:
            self.combo_theme.setCurrentIndex(idx)
        self.slider_diameter.setValue(DEFAULT_CONFIG["diameter"])
        self.slider_opacity.setValue(int(DEFAULT_CONFIG["opacity"] * 100))
        self.slider_width.setValue(int(DEFAULT_CONFIG["ring_width"] * 10))
        self.slider_speed.setValue(int(DEFAULT_CONFIG["rotation_speed"] * 10))
        self.combo_vis.setCurrentIndex(self.combo_vis.findData(DEFAULT_CONFIG["ring_visibility"]))
        self.combo_disp.setCurrentIndex(self.combo_disp.findData(DEFAULT_CONFIG["display_mode"]))
        self.slider_poll.setValue(int(DEFAULT_CONFIG["monitor_interval"] * 10))
        self.chk_always_top.setChecked(DEFAULT_CONFIG["always_on_top"])
        self.chk_lock_pos.setChecked(DEFAULT_CONFIG["position_locked"])
        self._update_color_button_swatch()
        self._update_ui_state()

        self.config_changed.emit()

    def _apply_stylesheet(self):
        self.setStyleSheet("""
            QDialog {
                background-color: #0F172A;
                color: #F8FAFC;
                font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
            }
            QLabel#DialogTitle {
                color: #38BDF8;
                font-size: 16px;
                font-weight: bold;
                padding-bottom: 4px;
            }
            QLabel {
                color: #CBD5E1;
                font-size: 13px;
            }
            QLabel#ValueDisplayLabel {
                color: #38BDF8;
                font-weight: bold;
            }
            QTabWidget::pane {
                border: 1px solid #334155;
                background-color: #1E293B;
                border-radius: 8px;
            }
            QTabBar::tab {
                background-color: #0F172A;
                color: #94A3B8;
                border: 1px solid #334155;
                border-bottom: none;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                padding: 6px 16px;
                margin-right: 2px;
            }
            QTabBar::tab:selected {
                background-color: #1E293B;
                color: #38BDF8;
                font-weight: bold;
            }
            QGroupBox {
                border: 1px solid #334155;
                border-radius: 6px;
                margin-top: 8px;
                padding-top: 10px;
                color: #94A3B8;
                font-weight: bold;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 4px;
            }
            QComboBox {
                background-color: #0F172A;
                color: #F1F5F9;
                border: 1px solid #475569;
                border-radius: 6px;
                padding: 4px 10px;
                font-size: 12px;
                min-width: 140px;
            }
            QComboBox:hover {
                border-color: #38BDF8;
            }
            QComboBox QAbstractItemView {
                background-color: #1E293B;
                color: #F1F5F9;
                selection-background-color: #0284C7;
                selection-color: #FFFFFF;
                border: 1px solid #475569;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: #334155;
                border-radius: 3px;
            }
            QSlider::sub-page:horizontal {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0284C7, stop:1 #38BDF8);
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #FFFFFF;
                border: 2px solid #38BDF8;
                width: 16px;
                height: 16px;
                margin: -5px 0;
                border-radius: 8px;
            }
            QSlider::handle:horizontal:hover {
                background: #E0F2FE;
                transform: scale(1.1);
            }
            QCheckBox {
                color: #CBD5E1;
                font-size: 13px;
                spacing: 8px;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
                border-radius: 4px;
                border: 1px solid #475569;
                background-color: #0F172A;
            }
            QCheckBox::indicator:checked {
                background-color: #0284C7;
                border-color: #38BDF8;
            }
            QPushButton#CloseButton {
                background-color: #0284C7;
                color: #FFFFFF;
                border: none;
                border-radius: 6px;
                padding: 6px 18px;
                font-weight: bold;
                font-size: 13px;
            }
            QPushButton#CloseButton:hover {
                background-color: #0369A1;
            }
            QPushButton#ResetButton {
                background-color: transparent;
                color: #94A3B8;
                border: 1px solid #475569;
                border-radius: 6px;
                padding: 6px 14px;
                font-size: 12px;
            }
            QPushButton#ResetButton:hover {
                background-color: #334155;
                color: #F1F5F9;
            }
        """)
