"""
PY Flowing Light - Desktop Liquid Glass Floating Ball Widget
Implements frameless, always-on-top, translucent liquid glass floating widget
with 60fps rotating flowing light halo, circular resource gauge arcs, and rich mouse interactions.
"""

import math
from typing import Dict, Any, Optional, List

from PyQt6.QtCore import (
    Qt, QTimer, QPoint, QRectF, QPointF, pyqtSignal
)
from PyQt6.QtGui import (
    QPainter, QColor, QRadialGradient, QConicalGradient,
    QLinearGradient, QPen, QBrush, QFont, QAction, QPainterPath,
    QActionGroup, QCursor
)
from PyQt6.QtWidgets import (
    QWidget, QMenu, QApplication
)

from config import ConfigManager, THEMES


class FloatingBallWidget(QWidget):
    """
    Desktop Liquid Glass Floating Ball Widget with flowing light halo and
    real-time CPU/RAM resource gauges.
    """
    # Emitted when settings dialog is requested
    open_settings_requested = pyqtSignal()

    PADDING = 28  # Space around ball for glow, halo, and scale bounce

    def __init__(self, config_manager: ConfigManager):
        super().__init__()
        self.cfg_mgr = config_manager
        self.cfg = self.cfg_mgr.config

        # Target and smoothed metrics for fluid transitions
        self.target_cpu = 0.0
        self.target_ram = 0.0
        self.curr_cpu = 0.0
        self.curr_ram = 0.0
        self.system_details: Dict[str, Any] = {}

        # Animation states
        self.halo_angle = 0.0
        self.target_ring_alpha = 1.0
        self.curr_ring_alpha = 1.0
        self.is_hovered = False

        # Scale and elastic bounce animation
        self.target_scale = 1.0
        self.curr_scale = 1.0
        self.bounce_frames: List[float] = []

        # Cycle mode state tracking
        self.cycle_timer_count = 0.0
        self.cycle_active_metric = "cpu"  # 'cpu' or 'ram'

        # Drag tracking
        self.is_dragging = False
        self.drag_start_pos: Optional[QPoint] = None
        self.window_start_pos: Optional[QPoint] = None
        self.DRAG_THRESHOLD = 5

        # Initialize Window Flags & Attributes
        self._apply_window_flags()
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setMouseTracking(True)

        # Update initial geometry
        self.update_geometry_size()
        self._restore_or_center_position()

        # 60 FPS Animation Timer (~16.6ms)
        self.anim_timer = QTimer(self)
        self.anim_timer.setInterval(16)
        self.anim_timer.timeout.connect(self._on_animation_tick)
        self.anim_timer.start()

    def _apply_window_flags(self):
        """Sets window flags for frameless, always-on-top, and tool widget."""
        flags = Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool
        if self.cfg.get("always_on_top", True):
            flags |= Qt.WindowType.WindowStaysOnTopHint
        self.setWindowFlags(flags)

    def update_geometry_size(self):
        """Recalculates widget geometry based on diameter and padding."""
        diameter = self.cfg.get("diameter", 96)
        total_size = int(diameter + self.PADDING * 2)
        self.setFixedSize(total_size, total_size)
        self.update()

    def _restore_or_center_position(self):
        """Restores saved position or centers on primary screen."""
        pos_x = self.cfg.get("pos_x")
        pos_y = self.cfg.get("pos_y")
        screen = QApplication.primaryScreen()
        if screen:
            screen_geo = screen.availableGeometry()
            if pos_x is not None and pos_y is not None:
                # Clamp within screen bounds
                clamped_x = max(screen_geo.left(), min(pos_x, screen_geo.right() - self.width()))
                clamped_y = max(screen_geo.top(), min(pos_y, screen_geo.bottom() - self.height()))
                self.move(int(clamped_x), int(clamped_y))
            else:
                # Default position: Top-right quadrant
                default_x = screen_geo.right() - self.width() - 80
                default_y = screen_geo.top() + 120
                self.move(int(default_x), int(default_y))
                self.cfg_mgr.set("pos_x", default_x, auto_save=False)
                self.cfg_mgr.set("pos_y", default_y, auto_save=True)

    def update_stats(self, cpu: float, ram: float, details: Dict[str, Any]):
        """Receives new hardware stats from monitor thread."""
        self.target_cpu = max(0.0, min(100.0, float(cpu)))
        self.target_ram = max(0.0, min(100.0, float(ram)))
        self.system_details = details

        # Update dynamic tooltip with rich system info
        self.setToolTip(
            f"<b>PY 流光系统悬浮球</b><br/>"
            f"━━━━━━━━━━━━━━━<br/>"
            f"<b>CPU 占用:</b> {self.target_cpu:.1f}% ({details.get('cpu_freq', 0)} GHz, {details.get('cpu_count', 1)} Cores)<br/>"
            f"<b>内存占用:</b> {self.target_ram:.1f}% ({details.get('ram_used_gb', 0):.1f} / {details.get('ram_total_gb', 0):.1f} GB)<br/>"
            f"<i>提示: 双击切换模式 | 右键唤出设置菜单</i>"
        )

    def apply_config_changes(self):
        """Called when configuration settings are modified."""
        self.cfg = self.cfg_mgr.config
        self._apply_window_flags()
        self.update_geometry_size()
        self.show()  # Re-show in case window flags were updated
        self.update()

    def _on_animation_tick(self):
        """High-frequency animation step for 60 FPS rendering."""
        # 1. Halo Rotation Angle
        speed = float(self.cfg.get("rotation_speed", 1.5))
        self.halo_angle = (self.halo_angle + speed * 1.6) % 360.0

        # 2. Ring Visibility Alpha Interpolation
        vis_mode = self.cfg.get("ring_visibility", "always")
        if vis_mode == "always" or self.is_hovered:
            self.target_ring_alpha = 1.0
        else:
            self.target_ring_alpha = 0.0
        self.curr_ring_alpha += (self.target_ring_alpha - self.curr_ring_alpha) * 0.18

        # 3. Resource Metric Gauge Damping (Smooth Arc Movement)
        self.curr_cpu += (self.target_cpu - self.curr_cpu) * 0.15
        self.curr_ram += (self.target_ram - self.curr_ram) * 0.15

        # 4. Scale and Elastic Spring Bounce Animation
        if self.bounce_frames:
            target = self.bounce_frames[0]
            self.curr_scale += (target - self.curr_scale) * 0.35
            if abs(self.curr_scale - target) < 0.005:
                self.curr_scale = target
                self.bounce_frames.pop(0)
        else:
            self.curr_scale += (self.target_scale - self.curr_scale) * 0.25

        # 5. Cycle Display Mode Timer
        if self.cfg.get("display_mode") == "cycle":
            self.cycle_timer_count += 0.016
            cycle_interval = float(self.cfg.get("cycle_interval", 3.0))
            if self.cycle_timer_count >= cycle_interval:
                self.cycle_timer_count = 0.0
                self.cycle_active_metric = "ram" if self.cycle_active_metric == "cpu" else "cpu"

        self.update()

    # --- Mouse & Interaction Events ---

    def enterEvent(self, event):
        self.is_hovered = True
        if not self.is_dragging:
            self.target_scale = 1.04
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.is_hovered = False
        if not self.is_dragging:
            self.target_scale = 1.00
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_start_pos = event.globalPosition().toPoint()
            self.window_start_pos = self.pos()
            self.is_dragging = False
            self.bounce_frames = []
            self.target_scale = 0.92
            event.accept()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self.drag_start_pos and (event.buttons() & Qt.MouseButton.LeftButton):
            if not self.cfg.get("position_locked", False):
                curr_pos = event.globalPosition().toPoint()
                delta = curr_pos - self.drag_start_pos
                if not self.is_dragging and delta.manhattanLength() > self.DRAG_THRESHOLD:
                    self.is_dragging = True
                    self.target_scale = 0.95

                if self.is_dragging and self.window_start_pos:
                    new_pos = self.window_start_pos + delta
                    # Clamp to screen
                    screen = QApplication.primaryScreen()
                    if screen:
                        geo = screen.availableGeometry()
                        nx = max(geo.left() - self.width() // 2, min(new_pos.x(), geo.right() - self.width() // 2))
                        ny = max(geo.top(), min(new_pos.y(), geo.bottom() - self.height()))
                        self.move(nx, ny)
                    else:
                        self.move(new_pos)
            event.accept()
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            if self.is_dragging:
                # Save new position
                self.cfg_mgr.set("pos_x", self.x(), auto_save=False)
                self.cfg_mgr.set("pos_y", self.y(), auto_save=True)
            # Liquid elastic bounce release
            self.bounce_frames = [1.08, 0.96, 1.02, 1.00]
            self.target_scale = 1.00
            self.drag_start_pos = None
            self.is_dragging = False
            event.accept()
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        """Double click quickly toggles display modes."""
        if event.button() == Qt.MouseButton.LeftButton:
            modes = ["dual", "cpu_only", "ram_only", "cycle"]
            curr = self.cfg.get("display_mode", "dual")
            next_mode = modes[(modes.index(curr) + 1) % len(modes)] if curr in modes else "dual"
            self.cfg_mgr.set("display_mode", next_mode, auto_save=True)
            self.bounce_frames = [1.12, 0.94, 1.00]
            self.update()
            event.accept()
        super().mouseDoubleClickEvent(event)

    def contextMenuEvent(self, event):
        """Displays rich modern right-click context menu."""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu {
                background-color: #1E293B;
                color: #F1F5F9;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 6px;
                font-family: 'Segoe UI', 'Microsoft YaHei';
                font-size: 13px;
            }
            QMenu::item {
                padding: 6px 24px 6px 12px;
                border-radius: 4px;
            }
            QMenu::item:selected {
                background-color: #38BDF8;
                color: #0F172A;
                font-weight: 600;
            }
            QMenu::separator {
                height: 1px;
                background-color: #334155;
                margin: 4px 6px;
            }
        """)

        # Settings
        action_settings = QAction("⚙️  设置面板 (Settings)...", self)
        action_settings.triggered.connect(self.open_settings_requested.emit)
        menu.addAction(action_settings)

        # Themes Submenu
        theme_menu = menu.addMenu("🎨  流光主题 (Themes)")
        current_theme = self.cfg.get("ring_mode", "rainbow")
        for key, theme_info in THEMES.items():
            act = QAction(theme_info["name"], self)
            act.setCheckable(True)
            act.setChecked(current_theme == key)
            act.triggered.connect(lambda checked, k=key: self._set_theme(k))
            theme_menu.addAction(act)

        # Display Mode Submenu
        mode_menu = menu.addMenu("📊  显示模式 (Display Mode)")
        display_modes = [
            ("dual", "双环仪表 (Dual CPU & RAM)"),
            ("cpu_only", "仅 CPU 仪表 (CPU Only)"),
            ("ram_only", "仅 内存 仪表 (RAM Only)"),
            ("cycle", "自动轮播 (Auto Cycle)")
        ]
        curr_disp = self.cfg.get("display_mode", "dual")
        for mode_key, mode_name in display_modes:
            act = QAction(mode_name, self)
            act.setCheckable(True)
            act.setChecked(curr_disp == mode_key)
            act.triggered.connect(lambda checked, m=mode_key: self._set_display_mode(m))
            mode_menu.addAction(act)

        menu.addSeparator()

        # Lock Position Toggle
        action_lock = QAction("🔒  锁定位置 (Lock Position)", self)
        action_lock.setCheckable(True)
        action_lock.setChecked(self.cfg.get("position_locked", False))
        action_lock.triggered.connect(self._toggle_lock_position)
        menu.addAction(action_lock)

        # Always on Top Toggle
        action_top = QAction("📌  窗口置顶 (Always on Top)", self)
        action_top.setCheckable(True)
        action_top.setChecked(self.cfg.get("always_on_top", True))
        action_top.triggered.connect(self._toggle_always_on_top)
        menu.addAction(action_top)

        # Center Reset
        action_center = QAction("🎯  居中复位 (Center Position)", self)
        action_center.triggered.connect(self.reset_to_screen_center)
        menu.addAction(action_center)

        menu.addSeparator()

        # Exit
        action_exit = QAction("❌  退出程序 (Exit)", self)
        action_exit.triggered.connect(QApplication.quit)
        menu.addAction(action_exit)

        menu.exec(event.globalPos())

    def _set_theme(self, theme_key: str):
        self.cfg_mgr.set("ring_mode", theme_key, auto_save=True)
        self.update()

    def _set_display_mode(self, mode: str):
        self.cfg_mgr.set("display_mode", mode, auto_save=True)
        self.update()

    def _toggle_lock_position(self, checked: bool):
        self.cfg_mgr.set("position_locked", checked, auto_save=True)

    def _toggle_always_on_top(self, checked: bool):
        self.cfg_mgr.set("always_on_top", checked, auto_save=True)
        self._apply_window_flags()
        self.show()

    def reset_to_screen_center(self):
        """Moves widget to the center of the primary display."""
        screen = QApplication.primaryScreen()
        if screen:
            geo = screen.availableGeometry()
            cx = geo.left() + (geo.width() - self.width()) // 2
            cy = geo.top() + (geo.height() - self.height()) // 2
            self.move(cx, cy)
            self.cfg_mgr.set("pos_x", cx, auto_save=False)
            self.cfg_mgr.set("pos_y", cy, auto_save=True)

    # --- Custom QPainter Rendering ---

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)

        cx = self.width() / 2.0
        cy = self.height() / 2.0
        diameter = float(self.cfg.get("diameter", 96))
        r = diameter / 2.0

        # Scale transformation with origin at sphere center
        painter.save()
        painter.translate(cx, cy)
        painter.scale(self.curr_scale, self.curr_scale)
        painter.translate(-cx, -cy)

        # 1. Outer Flowing Light Streamer Halo
        self._draw_flowing_halo(painter, cx, cy, r)

        # 2. Liquid Glass Bubble Body
        self._draw_liquid_glass_body(painter, cx, cy, r)

        # 3. Circular Hardware Metric Gauge Arcs
        self._draw_gauge_arcs(painter, cx, cy, r)

        # 4. Central Metrics Typography
        self._draw_central_typography(painter, cx, cy, r)

        # 5. Fine Glass Perimeter Rim Outline
        self._draw_rim_border(painter, cx, cy, r)

        painter.restore()

    def _draw_flowing_halo(self, painter: QPainter, cx: float, cy: float, r: float):
        """Renders the 60fps animated conical gradient flowing streamer halo."""
        if self.curr_ring_alpha <= 0.01:
            return

        ring_width = float(self.cfg.get("ring_width", 3.5))
        halo_radius = r + ring_width / 2.0 + 2.5
        alpha_mult = self.curr_ring_alpha

        painter.save()
        painter.setBrush(Qt.BrushStyle.NoBrush)

        theme_key = self.cfg.get("ring_mode", "rainbow")

        # Prepare Conical Gradient centered at (cx, cy) rotated by self.halo_angle
        grad = QConicalGradient(cx, cy, self.halo_angle)

        if theme_key == "solid":
            base_col = QColor(self.cfg.get("custom_color", "#00E5FF"))
            r_c, g_c, b_c = base_col.red(), base_col.green(), base_col.blue()
            grad.setColorAt(0.0, QColor(r_c, g_c, b_c, int(255 * alpha_mult)))
            grad.setColorAt(0.4, QColor(r_c, g_c, b_c, int(180 * alpha_mult)))
            grad.setColorAt(0.7, QColor(r_c, g_c, b_c, int(60 * alpha_mult)))
            grad.setColorAt(1.0, QColor(r_c, g_c, b_c, int(15 * alpha_mult)))
        elif theme_key in THEMES:
            for stop, hex_code in THEMES[theme_key]["colors"]:
                col = QColor(hex_code)
                col.setAlpha(int(255 * alpha_mult))
                grad.setColorAt(stop, col)
        else:
            # Fallback
            grad.setColorAt(0.0, QColor(0, 229, 255, int(255 * alpha_mult)))
            grad.setColorAt(1.0, QColor(255, 0, 128, int(255 * alpha_mult)))

        # Soft Neon Glow Layer (Thicker, translucent)
        glow_pen = QPen(QBrush(grad), ring_width + 5.5)
        glow_pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setOpacity(0.45 * alpha_mult)
        painter.setPen(glow_pen)
        painter.drawEllipse(QRectF(cx - halo_radius, cy - halo_radius, halo_radius * 2, halo_radius * 2))

        # Sharp Core Streamer Ring
        painter.setOpacity(1.0)
        ring_pen = QPen(QBrush(grad), ring_width)
        ring_pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(ring_pen)
        painter.drawEllipse(QRectF(cx - halo_radius, cy - halo_radius, halo_radius * 2, halo_radius * 2))

        painter.restore()

    def _draw_liquid_glass_body(self, painter: QPainter, cx: float, cy: float, r: float):
        """Renders 3D sphere liquid glass body with radial gradient and specular highlights."""
        opacity = float(self.cfg.get("opacity", 0.92))

        # Multi-stop 3D Radial Gradient
        light_x = cx - r * 0.35
        light_y = cy - r * 0.38
        rad_grad = QRadialGradient(QPointF(light_x, light_y), r * 1.35)

        # Luminous dark glassmorphism palette
        rad_grad.setColorAt(0.0, QColor(45, 62, 90, int(220 * opacity)))
        rad_grad.setColorAt(0.35, QColor(24, 38, 62, int(240 * opacity)))
        rad_grad.setColorAt(0.75, QColor(15, 23, 42, int(250 * opacity)))
        rad_grad.setColorAt(1.0, QColor(5, 10, 24, int(255 * opacity)))

        ball_rect = QRectF(cx - r, cy - r, r * 2, r * 2)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(rad_grad))
        painter.drawEllipse(ball_rect)

        # Top Primary Specular Highlight (Organic Gloss Arch)
        hl_path = QPainterPath()
        hl_rect = QRectF(cx - r * 0.68, cy - r * 0.88, r * 1.36, r * 0.62)
        hl_path.addEllipse(hl_rect)

        hl_grad = QLinearGradient(QPointF(cx, cy - r * 0.88), QPointF(cx, cy - r * 0.25))
        hl_grad.setColorAt(0.0, QColor(255, 255, 255, int(160 * opacity)))
        hl_grad.setColorAt(0.6, QColor(255, 255, 255, int(45 * opacity)))
        hl_grad.setColorAt(1.0, QColor(255, 255, 255, 0))

        painter.setBrush(QBrush(hl_grad))
        painter.fillPath(hl_path, QBrush(hl_grad))

        # Bottom Secondary Fresnel Internal Reflection
        bot_hl = QPainterPath()
        bot_rect = QRectF(cx - r * 0.55, cy + r * 0.45, r * 1.1, r * 0.45)
        bot_hl.addEllipse(bot_rect)

        bot_grad = QLinearGradient(QPointF(cx, cy + r * 0.9), QPointF(cx, cy + r * 0.45))
        bot_grad.setColorAt(0.0, QColor(56, 189, 248, int(60 * opacity)))
        bot_grad.setColorAt(1.0, QColor(56, 189, 248, 0))
        painter.fillPath(bot_hl, QBrush(bot_grad))

    def _draw_gauge_arcs(self, painter: QPainter, cx: float, cy: float, r: float):
        """Draws resource progress arcs (CPU / RAM)."""
        mode = self.cfg.get("display_mode", "dual")

        if mode == "dual":
            # Outer Arc: CPU
            cpu_r = r - 5.5
            cpu_span = int(-(self.curr_cpu / 100.0) * 360 * 16)
            cpu_col = self._get_metric_color(self.curr_cpu, base_type="cpu")

            # Background subtle track
            bg_pen = QPen(QColor(255, 255, 255, 25), 3.0)
            painter.setPen(bg_pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawEllipse(QRectF(cx - cpu_r, cy - cpu_r, cpu_r * 2, cpu_r * 2))

            # Active Progress Arc
            arc_pen = QPen(cpu_col, 3.0, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap)
            painter.setPen(arc_pen)
            painter.drawArc(QRectF(cx - cpu_r, cy - cpu_r, cpu_r * 2, cpu_r * 2), 90 * 16, cpu_span)

            # Inner Arc: RAM
            ram_r = r - 11.5
            ram_span = int(-(self.curr_ram / 100.0) * 360 * 16)
            ram_col = self._get_metric_color(self.curr_ram, base_type="ram")

            bg_pen_in = QPen(QColor(255, 255, 255, 20), 2.5)
            painter.setPen(bg_pen_in)
            painter.drawEllipse(QRectF(cx - ram_r, cy - ram_r, ram_r * 2, ram_r * 2))

            arc_pen_in = QPen(ram_col, 2.5, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap)
            painter.setPen(arc_pen_in)
            painter.drawArc(QRectF(cx - ram_r, cy - ram_r, ram_r * 2, ram_r * 2), 90 * 16, ram_span)

        elif mode in ("cpu_only", "ram_only", "cycle"):
            active = self.curr_cpu if (mode == "cpu_only" or (mode == "cycle" and self.cycle_active_metric == "cpu")) else self.curr_ram
            metric_type = "cpu" if (mode == "cpu_only" or (mode == "cycle" and self.cycle_active_metric == "cpu")) else "ram"

            gauge_r = r - 6.5
            span = int(-(active / 100.0) * 360 * 16)
            col = self._get_metric_color(active, base_type=metric_type)

            bg_pen = QPen(QColor(255, 255, 255, 30), 4.0)
            painter.setPen(bg_pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawEllipse(QRectF(cx - gauge_r, cy - gauge_r, gauge_r * 2, gauge_r * 2))

            arc_pen = QPen(col, 4.0, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap)
            painter.setPen(arc_pen)
            painter.drawArc(QRectF(cx - gauge_r, cy - gauge_r, gauge_r * 2, gauge_r * 2), 90 * 16, span)

    def _draw_central_typography(self, painter: QPainter, cx: float, cy: float, r: float):
        """Draws readable, crisp numeric metrics and labels in the center."""
        mode = self.cfg.get("display_mode", "dual")
        scale = r / 48.0  # Normalized reference scaling

        if mode == "dual":
            # Primary: CPU %, Secondary: RAM %
            cpu_val_int = int(round(self.curr_cpu))
            ram_val_int = int(round(self.curr_ram))

            # Main CPU Text
            f_main = QFont("Segoe UI", max(8, int(15 * scale)), QFont.Weight.Bold)
            painter.setFont(f_main)
            painter.setPen(self._get_metric_color(self.curr_cpu, "cpu"))

            # Slight text shadow for clarity
            painter.drawText(
                QRectF(cx - r, cy - r * 0.48, r * 2, r * 0.55),
                Qt.AlignmentFlag.AlignCenter,
                f"{cpu_val_int}%"
            )

            # CPU Small Sub-label
            f_lbl = QFont("Segoe UI", max(6, int(7.5 * scale)), QFont.Weight.DemiBold)
            painter.setFont(f_lbl)
            painter.setPen(QColor(148, 163, 184))
            painter.drawText(
                QRectF(cx - r, cy - r * 0.05, r * 2, r * 0.28),
                Qt.AlignmentFlag.AlignCenter,
                "CPU"
            )

            # RAM Sub-line
            f_ram = QFont("Segoe UI", max(7, int(9.5 * scale)), QFont.Weight.DemiBold)
            painter.setFont(f_ram)
            painter.setPen(self._get_metric_color(self.curr_ram, "ram"))
            painter.drawText(
                QRectF(cx - r, cy + r * 0.22, r * 2, r * 0.45),
                Qt.AlignmentFlag.AlignCenter,
                f"RAM {ram_val_int}%"
            )

        else:
            is_cpu = (mode == "cpu_only" or (mode == "cycle" and self.cycle_active_metric == "cpu"))
            val = int(round(self.curr_cpu if is_cpu else self.curr_ram))
            label = "CPU" if is_cpu else "RAM"
            col = self._get_metric_color(val, "cpu" if is_cpu else "ram")

            f_large = QFont("Segoe UI", max(10, int(19 * scale)), QFont.Weight.Bold)
            painter.setFont(f_large)
            painter.setPen(col)
            painter.drawText(
                QRectF(cx - r, cy - r * 0.45, r * 2, r * 0.55),
                Qt.AlignmentFlag.AlignCenter,
                f"{val}%"
            )

            f_sub = QFont("Segoe UI", max(7, int(9 * scale)), QFont.Weight.Bold)
            painter.setFont(f_sub)
            painter.setPen(QColor(203, 213, 225))
            painter.drawText(
                QRectF(cx - r, cy + r * 0.12, r * 2, r * 0.35),
                Qt.AlignmentFlag.AlignCenter,
                label
            )

    def _draw_rim_border(self, painter: QPainter, cx: float, cy: float, r: float):
        """Draws a subtle crystal edge border."""
        rim_pen = QPen(QColor(255, 255, 255, 75), 1.0)
        painter.setPen(rim_pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawEllipse(QRectF(cx - r, cy - r, r * 2, r * 2))

    def _get_metric_color(self, value: float, base_type: str = "cpu") -> QColor:
        """Returns dynamic warning color based on usage threshold."""
        if value >= 85.0:
            return QColor(255, 75, 75)   # High load alert red
        elif value >= 65.0:
            return QColor(255, 175, 45)  # Medium-high warning amber
        else:
            return QColor(56, 189, 248) if base_type == "cpu" else QColor(52, 211, 153)
