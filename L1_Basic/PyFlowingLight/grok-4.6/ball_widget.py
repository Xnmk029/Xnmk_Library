#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""无边框置顶透明悬浮球：液态玻璃绘制、拖拽与右键菜单。"""

from __future__ import annotations

from PyQt6.QtCore import QPoint, QPointF, QRectF, Qt, QTimer
from PyQt6.QtGui import (
    QAction,
    QBrush,
    QColor,
    QConicalGradient,
    QFont,
    QLinearGradient,
    QPainter,
    QPainterPath,
    QPen,
    QRadialGradient,
)
from PyQt6.QtWidgets import QApplication, QMenu, QWidget

from config import AppConfig
from monitor import ResourceMonitor
from settings_dialog import SettingsDialog


class FloatBall(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__(None)
        self.config = config
        self.cpu = 0.0
        self.mem = 0.0
        self._angle = 0.0
        self._hovered = False
        self._dragging = False
        self._drag_offset = QPoint()
        self._settings: SettingsDialog | None = None

        self.setWindowTitle("PY 流光")
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating, False)
        self.setMouseTracking(True)
        self.setCursor(Qt.CursorShape.OpenHandCursor)

        self._apply_window_metrics(keep_center=False)
        self.setWindowOpacity(self.config.opacity / 100.0)

        self._anim = QTimer(self)
        self._anim.setInterval(33)
        self._anim.timeout.connect(self._on_tick)
        self._anim.start()

        self._monitor = ResourceMonitor(self)
        self._monitor.updated.connect(self._on_stats)
        self._monitor.failed.connect(self._on_monitor_failed)
        self._monitor.start()

    def _glow_pad(self) -> int:
        return max(18, self.config.line_width + 10)

    def _apply_window_metrics(self, keep_center: bool) -> None:
        side = int(self.config.diameter + self._glow_pad() * 2)
        old_center = self.frameGeometry().center() if keep_center else None
        self.setFixedSize(side, side)
        if old_center is not None:
            self.move(old_center.x() - side // 2, old_center.y() - side // 2)

    def apply_config(self) -> None:
        self.config.clamp()
        self.setWindowOpacity(self.config.opacity / 100.0)
        self._apply_window_metrics(keep_center=True)
        self._clamp_to_screen()
        self.update()

    def place_default(self) -> None:
        screen = QApplication.primaryScreen()
        if screen is None:
            return
        area = screen.availableGeometry()
        if self.config.pos_x is not None and self.config.pos_y is not None:
            self.move(int(self.config.pos_x), int(self.config.pos_y))
        else:
            x = area.right() - self.width() - 28
            y = area.center().y() - self.height() // 2
            self.move(x, y)
        self._clamp_to_screen()

    def _clamp_to_screen(self) -> None:
        screen = QApplication.screenAt(self.frameGeometry().center())
        if screen is None:
            screen = QApplication.primaryScreen()
        if screen is None:
            return
        area = screen.availableGeometry()
        geo = self.frameGeometry()
        x = min(max(geo.x(), area.left()), area.right() - geo.width())
        y = min(max(geo.y(), area.top()), area.bottom() - geo.height())
        self.move(x, y)

    def _on_tick(self) -> None:
        speed = self.config.rotation_speed
        if speed > 0:
            self._angle = (self._angle + speed * 0.033) % 360.0
            self.update()

    def _on_stats(self, cpu: float, mem: float) -> None:
        self.cpu = cpu
        self.mem = mem
        self.setToolTip(f"CPU {cpu:.0f}%\n内存 {mem:.0f}%")
        self.update()

    def _on_monitor_failed(self, message: str) -> None:
        self.cpu = 0.0
        self.mem = 0.0
        self.setToolTip(message)
        self.update()

    def _show_text(self) -> bool:
        if self.config.display_mode == "always":
            return True
        return self._hovered or self._dragging

    def _open_settings(self) -> None:
        if self._settings is None:
            self._settings = SettingsDialog(self.config, self)
            self._settings.changed.connect(self.apply_config)
        self._settings.sync_from_config()
        origin = self.mapToGlobal(QPoint(self.width() + 8, 0))
        self._settings.move(origin)
        self._settings.show()
        self._settings.raise_()
        self._settings.activateWindow()

    def _quit(self) -> None:
        self._save_position()
        self.config.save()
        self.close()
        app = QApplication.instance()
        if app is not None:
            app.quit()

    def _save_position(self) -> None:
        pos = self.pos()
        self.config.pos_x = int(pos.x())
        self.config.pos_y = int(pos.y())
        self.config.save()

    def closeEvent(self, event) -> None:
        self._anim.stop()
        self._monitor.stop()
        self._monitor.wait(1500)
        self._save_position()
        super().closeEvent(event)

    def enterEvent(self, event) -> None:
        self._hovered = True
        self.update()
        super().enterEvent(event)

    def leaveEvent(self, event) -> None:
        self._hovered = False
        self.update()
        super().leaveEvent(event)

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._dragging = True
            self._drag_offset = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:
        if self._dragging and event.buttons() & Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_offset)
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._dragging = False
            self.setCursor(Qt.CursorShape.OpenHandCursor)
            self._clamp_to_screen()
            self._save_position()
            event.accept()
            return
        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self._open_settings()
            event.accept()
            return
        super().mouseDoubleClickEvent(event)

    def contextMenuEvent(self, event) -> None:
        menu = QMenu(self)
        menu.setStyleSheet(
            "QMenu { background:#1A2030; color:#E8EEFC; border:1px solid #3A455C; padding:4px; }"
            "QMenu::item { padding:6px 18px; }"
            "QMenu::item:selected { background:#2E4A7A; }"
        )
        act_settings = QAction("设置", self)
        act_quit = QAction("退出", self)
        act_settings.triggered.connect(self._open_settings)
        act_quit.triggered.connect(self._quit)
        menu.addAction(act_settings)
        menu.addSeparator()
        menu.addAction(act_quit)
        menu.exec(event.globalPos())

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing, True)

        pad = float(self._glow_pad())
        diameter = float(self.config.diameter)
        ball = QRectF(pad, pad, diameter, diameter)
        center = ball.center()
        radius = diameter / 2.0
        ring_color = QColor(self.config.ring_color)
        load = max(self.cpu, self.mem) / 100.0

        self._draw_glow(painter, center, radius, ring_color, load)
        self._draw_glass(painter, ball, center, radius)
        self._draw_orbit(painter, center, radius, ring_color)
        self._draw_progress(painter, center, radius)
        self._draw_highlight(painter, center, radius)
        if self._show_text():
            self._draw_text(painter, ball)

    def _draw_glow(
        self,
        painter: QPainter,
        center,
        radius: float,
        ring_color: QColor,
        load: float,
    ) -> None:
        glow = QColor(ring_color)
        mix = int(40 + 80 * load)
        glow.setAlpha(mix)
        grad = QRadialGradient(center, radius * 1.45)
        inner = QColor(ring_color)
        inner.setAlpha(int(50 + 70 * load))
        mid = QColor(ring_color)
        mid.setAlpha(int(24 + 36 * load))
        edge = QColor(ring_color)
        edge.setAlpha(0)
        grad.setColorAt(0.0, QColor(255, 255, 255, 0))
        grad.setColorAt(0.52, inner)
        grad.setColorAt(0.78, mid)
        grad.setColorAt(1.0, edge)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(grad))
        painter.drawEllipse(center, radius * 1.42, radius * 1.42)

    def _draw_glass(self, painter: QPainter, ball: QRectF, center, radius: float) -> None:
        body = QRadialGradient(center.x() - radius * 0.28, center.y() - radius * 0.34, radius * 1.25)
        body.setColorAt(0.0, QColor(236, 244, 255, 92))
        body.setColorAt(0.28, QColor(160, 190, 230, 64))
        body.setColorAt(0.62, QColor(36, 48, 78, 168))
        body.setColorAt(1.0, QColor(8, 12, 24, 210))
        path = QPainterPath()
        path.addEllipse(ball)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(body))
        painter.drawPath(path)

        rim = QPen(QColor(255, 255, 255, 42))
        rim.setWidthF(1.4)
        painter.setPen(rim)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawEllipse(ball.adjusted(1.2, 1.2, -1.2, -1.2))

        shade = QLinearGradient(ball.topLeft(), ball.bottomRight())
        shade.setColorAt(0.0, QColor(255, 255, 255, 18))
        shade.setColorAt(0.45, QColor(255, 255, 255, 0))
        shade.setColorAt(1.0, QColor(0, 0, 0, 70))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(shade))
        painter.drawEllipse(ball.adjusted(3, 3, -3, -3))

    def _draw_orbit(self, painter: QPainter, center, radius: float, ring_color: QColor) -> None:
        lw = float(self.config.line_width)
        ring_rect = QRectF(
            center.x() - radius + lw * 0.55,
            center.y() - radius + lw * 0.55,
            (radius - lw * 0.55) * 2,
            (radius - lw * 0.55) * 2,
        )
        conical = QConicalGradient(center, -self._angle)
        if self.config.ring_style == "rainbow":
            stops = [
                (0.00, QColor(255, 70, 150, 230)),
                (0.16, QColor(255, 120, 40, 230)),
                (0.33, QColor(255, 220, 60, 230)),
                (0.50, QColor(40, 230, 150, 230)),
                (0.66, QColor(40, 170, 255, 230)),
                (0.83, QColor(150, 90, 255, 230)),
                (1.00, QColor(255, 70, 150, 230)),
            ]
        else:
            bright = QColor(ring_color)
            bright.setAlpha(240)
            dim = QColor(ring_color)
            dim.setAlpha(28)
            white = QColor(255, 255, 255, 200)
            stops = [
                (0.00, bright),
                (0.18, white),
                (0.36, bright),
                (0.62, dim),
                (1.00, bright),
            ]
        for pos, color in stops:
            conical.setColorAt(pos, color)

        pen = QPen(QBrush(conical), lw)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawEllipse(ring_rect)

        sweep = QPen(QColor(255, 255, 255, 170), max(1.6, lw * 0.38))
        sweep.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(sweep)
        start = int((90.0 - self._angle) * 16)
        painter.drawArc(ring_rect, start, int(48 * 16))

    def _draw_progress(self, painter: QPainter, center, radius: float) -> None:
        lw = max(2.4, float(self.config.line_width) * 0.72)
        gap = lw + 3.2
        outer_r = radius - float(self.config.line_width) - 5.0
        inner_r = outer_r - gap
        if inner_r < radius * 0.28:
            inner_r = radius * 0.28
            outer_r = inner_r + gap

        cpu_rect = QRectF(center.x() - outer_r, center.y() - outer_r, outer_r * 2, outer_r * 2)
        mem_rect = QRectF(center.x() - inner_r, center.y() - inner_r, inner_r * 2, inner_r * 2)

        self._draw_track(painter, cpu_rect, lw, QColor(90, 200, 255, 38))
        self._draw_track(painter, mem_rect, max(2.0, lw * 0.85), QColor(190, 130, 255, 38))

        cpu_pen = QPen(QColor(80, 220, 255, 230), lw)
        cpu_pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(cpu_pen)
        painter.drawArc(cpu_rect, 90 * 16, -int(self.cpu / 100.0 * 360 * 16))

        mem_pen = QPen(QColor(196, 132, 255, 230), max(2.0, lw * 0.85))
        mem_pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(mem_pen)
        painter.drawArc(mem_rect, 90 * 16, -int(self.mem / 100.0 * 360 * 16))

    def _draw_track(self, painter: QPainter, rect: QRectF, width: float, color: QColor) -> None:
        pen = QPen(color, width)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawEllipse(rect)

    def _draw_highlight(self, painter: QPainter, center, radius: float) -> None:
        hx = center.x() - radius * 0.32
        hy = center.y() - radius * 0.38
        spec = QRadialGradient(hx, hy, radius * 0.55)
        spec.setColorAt(0.0, QColor(255, 255, 255, 150))
        spec.setColorAt(0.35, QColor(220, 235, 255, 55))
        spec.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(spec))
        painter.drawEllipse(QPointF(hx, hy), radius * 0.42, radius * 0.28)

        gloss = QRectF(
            center.x() - radius * 0.62,
            center.y() - radius * 0.70,
            radius * 0.95,
            radius * 0.42,
        )
        painter.setBrush(QColor(255, 255, 255, 20))
        painter.drawEllipse(gloss)

    def _draw_text(self, painter: QPainter, ball: QRectF) -> None:
        metric = self.config.primary_metric
        painter.setPen(QColor(244, 248, 255, 235))
        family = "Segoe UI"
        if metric == "both":
            font = QFont(family, max(8, int(self.config.diameter * 0.13)))
            font.setBold(True)
            painter.setFont(font)
            cpu_text = f"{self.cpu:.0f}%"
            mem_text = f"{self.mem:.0f}%"
            mid = ball.center()
            painter.drawText(
                QRectF(ball.left(), mid.y() - self.config.diameter * 0.28, ball.width(), self.config.diameter * 0.22),
                Qt.AlignmentFlag.AlignCenter,
                cpu_text,
            )
            painter.drawText(
                QRectF(ball.left(), mid.y() + self.config.diameter * 0.02, ball.width(), self.config.diameter * 0.22),
                Qt.AlignmentFlag.AlignCenter,
                mem_text,
            )
            caption = QFont(family, max(6, int(self.config.diameter * 0.08)))
            painter.setFont(caption)
            painter.setPen(QColor(170, 190, 220, 200))
            painter.drawText(
                QRectF(ball.left(), mid.y() - self.config.diameter * 0.42, ball.width(), self.config.diameter * 0.14),
                Qt.AlignmentFlag.AlignCenter,
                "CPU",
            )
            painter.drawText(
                QRectF(ball.left(), mid.y() + self.config.diameter * 0.22, ball.width(), self.config.diameter * 0.14),
                Qt.AlignmentFlag.AlignCenter,
                "MEM",
            )
            return

        value = self.cpu if metric == "cpu" else self.mem
        label = "CPU" if metric == "cpu" else "MEM"
        font = QFont(family, max(10, int(self.config.diameter * 0.22)))
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(ball, Qt.AlignmentFlag.AlignCenter, f"{value:.0f}%")
        caption = QFont(family, max(7, int(self.config.diameter * 0.09)))
        painter.setFont(caption)
        painter.setPen(QColor(170, 190, 220, 210))
        painter.drawText(
            QRectF(ball.left(), ball.center().y() + self.config.diameter * 0.16, ball.width(), self.config.diameter * 0.18),
            Qt.AlignmentFlag.AlignCenter,
            label,
        )
