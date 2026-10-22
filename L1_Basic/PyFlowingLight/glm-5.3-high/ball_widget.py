# -*- coding: utf-8 -*-
"""悬浮球本体：无边框 + 置顶 + 工具窗口 + 透明背景，自绘液态玻璃质感。

绘制层次（由外到内）：
  1. 外发光（低透明度多层圆环光晕）
  2. 旋转光环（彩虹锥形渐变 / 单色，随时间旋转）
  3. 内存占用弧（内圈，青色）
  4. CPU 占用弧（外圈，光环色）
  5. 玻璃球体（径向渐变 + 顶部高光）
  6. 中央百分比数字
"""

from __future__ import annotations

import time

from PyQt6.QtCore import QPointF, QRectF, Qt, QTimer, pyqtSignal
from PyQt6.QtGui import (QBrush, QColor, QConicalGradient, QFont, QPainter,
                         QPen, QRadialGradient)
from PyQt6.QtWidgets import QApplication, QMenu, QWidget

from config import Settings

ROT_TIMER_MS = 33  # 旋转动画帧间隔（约 30 FPS，仅光环旋转时开启）

RAINBOW_STOPS = (
    (0.00, QColor(255, 64, 64)),
    (0.17, QColor(255, 170, 40)),
    (0.33, QColor(90, 220, 70)),
    (0.50, QColor(60, 220, 220)),
    (0.67, QColor(70, 140, 255)),
    (0.83, QColor(190, 90, 255)),
    (1.00, QColor(255, 64, 64)),
)

CPU_ARC_FALLBACK_COLOR = QColor("#4FC3F7")
MEM_ARC_COLOR = QColor("#26C6DA")
TEXT_COLOR = QColor(245, 250, 255, 235)
TEXT_DIM_COLOR = QColor(230, 240, 250, 150)


class FlowingBall(QWidget):
    """桌面悬浮球窗口。"""

    settings_requested = pyqtSignal()   # 请求打开设置面板
    settings_applied = pyqtSignal(object)  # Settings，位置以外的变更由主模块统一保存

    def __init__(self, settings: Settings, monitor, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._settings = settings.clamped()
        self._monitor = monitor
        self._cpu = 0.0
        self._mem = 0.0
        self._angle = 0.0          # 光环当前旋转角（度）
        self._hovered = False
        self._drag_offset: QPointF | None = None

        self.setWindowTitle("PY 流光")
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)

        self._rot_timer = QTimer(self)
        self._rot_timer.setInterval(ROT_TIMER_MS)
        self._rot_timer.timeout.connect(self._on_rotate_tick)
        self._last_tick = time.monotonic()

        self._monitor.updated.connect(self._on_stats)
        self._apply_window_props()
        self._update_rotation_timer()

    # ---------------------------------------------------------- 配置应用

    def apply_settings(self, settings: Settings) -> None:
        """设置变更后即时生效（直径/透明度/光环参数等）。"""
        self._settings = settings.clamped()
        self._apply_window_props()
        self._update_rotation_timer()
        self.update()

    def current_settings(self) -> Settings:
        return self._settings

    def place_to_saved_or_default(self) -> None:
        """按配置记忆的位置摆放；无效则在主屏右下角偏内侧落位。"""
        screen = QApplication.primaryScreen()
        area = screen.availableGeometry() if screen else QRectF(0, 0, 800, 600).toRect()
        d = self._settings.diameter
        x, y = self._settings.pos_x, self._settings.pos_y
        if not (area.left() <= x <= area.right() - d and area.top() <= y <= area.bottom() - d):
            x = area.right() - d - 80
            y = area.bottom() - d - 80
        self.move(x, y)

    def reset_position(self) -> None:
        screen = QApplication.primaryScreen()
        area = screen.availableGeometry() if screen else QRectF(0, 0, 800, 600).toRect()
        d = self._settings.diameter
        self.move(area.center().x() - d // 2, area.center().y() - d // 2)

    def _apply_window_props(self) -> None:
        d = self._settings.diameter
        self.setFixedSize(d, d)
        self.setWindowOpacity(self._settings.opacity)

    # ------------------------------------------------------------ 数据

    def _on_stats(self, cpu: float, mem: float) -> None:
        self._cpu = float(cpu)
        self._mem = float(mem)
        self.setToolTip(f"CPU {self._cpu:.0f}%\n内存 {self._mem:.0f}%")
        self.update()

    # ------------------------------------------------------------ 旋转

    def _decoration_active(self) -> bool:
        s = self._settings
        return s.display_mode == "always" or self._hovered

    def _rotation_active(self) -> bool:
        return self._settings.rotation_speed > 0 and self._decoration_active()

    def _update_rotation_timer(self) -> None:
        active = self._rotation_active()
        if active and not self._rot_timer.isActive():
            self._last_tick = time.monotonic()
            self._rot_timer.start()
        elif not active and self._rot_timer.isActive():
            self._rot_timer.stop()

    def _on_rotate_tick(self) -> None:
        now = time.monotonic()
        dt = now - self._last_tick
        self._last_tick = now
        self._angle = (self._angle + self._settings.rotation_speed * dt) % 360.0
        self.update()

    # ------------------------------------------------------- 鼠标交互

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._drag_offset = event.globalPosition() - QPointF(self.frameGeometry().topLeft())
            event.accept()
        else:
            event.ignore()

    def mouseMoveEvent(self, event) -> None:
        if self._drag_offset is not None:
            self.move((event.globalPosition() - self._drag_offset).toPoint())
            event.accept()
        else:
            event.ignore()

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton and self._drag_offset is not None:
            self._drag_offset = None
            self.settings_applied.emit(self.saved_position_settings())
            event.accept()
        else:
            event.ignore()

    def enterEvent(self, event) -> None:
        self._hovered = True
        self._update_rotation_timer()
        self.update()
        super().enterEvent(event)

    def leaveEvent(self, event) -> None:
        self._hovered = False
        self._update_rotation_timer()
        self.update()
        super().leaveEvent(event)

    def contextMenuEvent(self, event) -> None:
        menu = QMenu(self)
        menu.addAction("设置...", self._emit_settings_requested)
        menu.addAction("重置位置", self.reset_position)
        menu.addSeparator()
        menu.addAction("退出", self._quit_app)
        menu.exec(event.globalPos())

    def _emit_settings_requested(self) -> None:
        self.settings_requested.emit()

    def _quit_app(self) -> None:
        app = QApplication.instance()
        if app is not None:
            app.quit()

    def saved_position_settings(self) -> Settings:
        """返回带当前窗口坐标的配置副本（用于位置持久化）。"""
        from dataclasses import replace

        return replace(self._settings, pos_x=self.x(), pos_y=self.y())

    # ------------------------------------------------------------ 绘制

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)

        d = float(self.width())
        cx = cy = d / 2.0
        active = self._decoration_active()

        if active:
            self._paint_glow(painter, cx, cy)
            self._paint_halo(painter, cx, cy)
        self._paint_progress_arcs(painter, cx, cy, active)
        self._paint_glass_ball(painter, cx, cy, active)
        self._paint_text(painter, cx, cy, active)

    def _halo_qcolor(self) -> QColor:
        return QColor(self._settings.halo_color)

    def _paint_glow(self, painter: QPainter, cx: float, cy: float) -> None:
        """外发光：多层低透明度圆环形成光晕。"""
        c = self.width() / 2.0
        base = self._halo_qcolor() if self._settings.halo_mode == "solid" else QColor(120, 190, 255)
        r_halo = c - self._settings.ring_width / 2.0 - 1.0
        for extra, alpha in ((10, 46), (20, 24), (32, 12)):
            color = QColor(base)
            color.setAlpha(alpha)
            painter.setPen(QPen(color, self._settings.ring_width + extra, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            radius = r_halo + extra / 2.0 - 2.0
            painter.drawEllipse(QPointF(cx, cy), radius, radius)

    def _paint_halo(self, painter: QPainter, cx: float, cy: float) -> None:
        """旋转光环：彩虹用锥形渐变全彩环；单色用带明暗段的锥形渐变体现旋转。"""
        s = self._settings
        radius = self.width() / 2.0 - s.ring_width / 2.0 - 1.0
        gradient = QConicalGradient(QPointF(cx, cy), -self._angle)
        if s.halo_mode == "solid":
            color = self._halo_qcolor()
            bright = QColor(color)
            dim = QColor(color)
            dim.setAlpha(40)
            gradient.setStops([(0.0, dim), (0.5, bright), (1.0, dim)])
        else:
            gradient.setStops(RAINBOW_STOPS)
        painter.setPen(QPen(QBrush(gradient), s.ring_width, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
        painter.drawEllipse(QPointF(cx, cy), radius, radius)

    def _paint_progress_arcs(self, painter: QPainter, cx: float, cy: float, active: bool) -> None:
        """CPU（外圈）与内存（内圈）占用弧。"""
        s = self._settings
        c = self.width() / 2.0
        halo_inner = c - s.ring_width - 2.0
        arc_w = max(3.0, min(s.ring_width, 6.0))
        r_cpu = max(6.0, halo_inner - arc_w / 2.0)
        r_mem = max(4.0, r_cpu - arc_w - 2.0)
        dim_factor = 1.0 if active else 0.55

        def draw_ring(radius: float, value: float, color: QColor) -> None:
            rect = QRectF(cx - radius, cy - radius, 2 * radius, 2 * radius)
            track = QColor(255, 255, 255, int(30 * dim_factor))
            painter.setPen(QPen(track, arc_w, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            painter.drawEllipse(rect)
            v = max(0.0, min(100.0, value))
            if v <= 0.0:
                return
            pen_color = QColor(color)
            pen_color.setAlpha(int(pen_color.alpha() * dim_factor))
            painter.setPen(QPen(pen_color, arc_w, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap))
            # 从 12 点方向顺时针绘制占用弧
            painter.drawArc(rect, 90 * 16, -int(v * 3.6) * 16)

        cpu_color = self._halo_qcolor() if self._settings.halo_mode == "solid" else CPU_ARC_FALLBACK_COLOR
        if r_mem >= 6.0 and (r_cpu - r_mem) >= 1.0:
            draw_ring(r_mem, self._mem, MEM_ARC_COLOR)
        draw_ring(r_cpu, self._cpu, cpu_color)

    def _paint_glass_ball(self, painter: QPainter, cx: float, cy: float, active: bool) -> None:
        """玻璃球体：径向渐变主体 + 顶部月牙高光。"""
        c = self.width() / 2.0
        s = self._settings
        arc_w = max(3.0, min(s.ring_width, 6.0))
        halo_inner = c - s.ring_width - 2.0
        r_cpu = max(6.0, halo_inner - arc_w / 2.0)
        r_mem = max(4.0, r_cpu - arc_w - 2.0)
        inner_edge = r_mem - arc_w / 2. - 2.0 if r_mem >= 6.0 else r_cpu - arc_w / 2.0 - 2.0
        radius = max(9.0, inner_edge)
        alpha_scale = 1.0 if active else 0.6

        tint = QColor("#BFE3FF") if s.halo_mode == "rainbow" else self._halo_qcolor().lighter(140)
        grad = QRadialGradient(QPointF(cx, cy - radius * 0.25), radius * 1.15)
        grad.setColorAt(0.0, QColor(255, 255, 255, int(95 * alpha_scale)))
        grad.setColorAt(0.55, QColor(tint.red(), tint.green(), tint.blue(), int(70 * alpha_scale)))
        grad.setColorAt(1.0, QColor(tint.red(), tint.green(), tint.blue(), int(26 * alpha_scale)))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(grad))
        painter.drawEllipse(QPointF(cx, cy), radius, radius)

        # 球体描边
        edge = QColor(255, 255, 255, int(70 * alpha_scale))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.setPen(QPen(edge, 1))
        painter.drawEllipse(QPointF(cx, cy), radius, radius)

        # 顶部月牙高光（液态玻璃质感）
        painter.setPen(Qt.PenStyle.NoPen)
        hl = QRadialGradient(QPointF(cx - radius * 0.28, cy - radius * 0.42), radius * 0.55)
        hl.setColorAt(0.0, QColor(255, 255, 255, int(150 * alpha_scale)))
        hl.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.setBrush(QBrush(hl))
        painter.drawEllipse(
            QPointF(cx - radius * 0.22, cy - radius * 0.38),
            radius * 0.42,
            radius * 0.30,
        )

    def _paint_text(self, painter: QPainter, cx: float, cy: float, active: bool) -> None:
        """中央百分比数字 + 小指标标签。"""
        d = self.width()
        value = self._mem if self._settings.center_metric == "memory" else self._cpu
        label = "内存" if self._settings.center_metric == "memory" else "CPU"

        font = QFont()
        font.setFamily("Microsoft YaHei UI")
        font.setBold(True)
        big_size = max(10, int(d * 0.22))
        font.setPixelSize(big_size)
        painter.setFont(font)
        painter.setPen(QColor(TEXT_COLOR) if active else QColor(TEXT_DIM_COLOR))
        painter.drawText(
            QRectF(cx - self.width() / 2.0, cy - big_size * 0.75, self.width(), big_size * 1.3),
            Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter,
            f"{value:.0f}%",
        )

        if d >= 76:
            small = QFont(font)
            small.setBold(False)
            small.setPixelSize(max(8, int(d * 0.09)))
            painter.setFont(small)
            painter.setPen(QColor(220, 235, 250, int(170 if active else 110)))
            painter.drawText(
                QRectF(cx - self.width() / 2.0, cy + big_size * 0.55, self.width(), small.pixelSize() * 1.6),
                Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter,
                f"{label} · 外环CPU 内环内存",
            )
