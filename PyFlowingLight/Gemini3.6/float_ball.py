import sys
import random
from PyQt6.QtCore import (
    Qt, QThread, pyqtSignal, QTimer, QPoint, QRectF, QPointF
)
from PyQt6.QtWidgets import (
    QApplication, QWidget, QMainWindow, QVBoxLayout, QHBoxLayout,
    QLabel, QComboBox, QPushButton, QSlider, QColorDialog,
    QFrame
)
from PyQt6.QtGui import (
    QPainter, QColor, QRadialGradient, QConicalGradient, QPen, QBrush,
    QFont, QPainterPath, QLinearGradient
)


class DataThread(QThread):
    """后台模拟线程，每 1 秒随机刷新 CPU 和 RAM 数据"""
    data_updated = pyqtSignal(int, int)

    def __init__(self):
        super().__init__()
        self._running = True

    def run(self):
        while self._running:
            cpu = random.randint(15, 82)
            ram = random.randint(35, 78)
            self.data_updated.emit(cpu, ram)
            self.msleep(1000)

    def stop(self):
        self._running = False
        self.wait()


class FloatingBall(QWidget):
    """桌面液态玻璃悬浮球窗口"""

    PADDING = 24  # 边缘预留绘制光晕和光环的空间

    def __init__(self):
        super().__init__()

        # 窗口属性：无边框 + 顶层 + 工具窗口 + 透明背景
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint |
            Qt.WindowType.WindowStaysOnTopHint |
            Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)

        # 参数配置
        self.ball_base_size = 86        # 60 ~ 140px
        self.ring_mode = 'rainbow'      # 'rainbow' / 'solid'
        self.ring_color = QColor(0, 195, 255)  # solid 模式颜色
        self.ring_width = 2.5           # 0.5 ~ 5.0px
        self.ring_display_mode = 'hover'# 'hover' / 'always'
        self.rotation_speed = 1.0       # 0.1 ~ 3.0
        self.glass_transparency = 50    # 0 ~ 100

        # 数据状态
        self.cpu_pct = 32
        self.ram_pct = 58

        # 动画与交互状态
        self.current_angle = 0.0
        self.target_ring_opacity = 0.0
        self.current_ring_opacity = 0.0
        self.hovered = False

        # 缩放与回弹动画状态
        self.target_scale = 1.0
        self.current_scale = 1.0
        self.bounce_keyframes = []

        # 拖动与点击判断
        self.press_pos = None
        self.drag_start_window_pos = None
        self.is_dragging = False
        self.DRAG_THRESHOLD = 5

        # 初始化窗口尺寸与位置
        self.update_window_size()
        screen_geo = QApplication.primaryScreen().availableGeometry()
        self.move(screen_geo.width() - self.width() - 80, 120)

        # 16ms 定时器 (~60fps 驱动平滑动画)
        self.anim_timer = QTimer(self)
        self.anim_timer.setInterval(16)
        self.anim_timer.timeout.connect(self.update_animation)
        self.anim_timer.start()

    def update_window_size(self):
        total_size = int(self.ball_base_size + self.PADDING * 2)
        self.setFixedSize(total_size, total_size)

    def set_data(self, cpu, ram):
        self.cpu_pct = cpu
        self.ram_pct = ram
        self.update()

    def update_animation(self):
        # 1. 旋转角度更新 (rainbow 模式)
        if self.ring_mode == 'rainbow':
            self.current_angle = (self.current_angle + self.rotation_speed * 1.2) % 360.0

        # 2. 光环透明度插值
        if self.ring_display_mode == 'always' or self.hovered:
            self.target_ring_opacity = 1.0
        else:
            self.target_ring_opacity = 0.0

        self.current_ring_opacity += (self.target_ring_opacity - self.current_ring_opacity) * 0.15

        # 3. 缩放与弹性回弹插值
        if self.bounce_keyframes:
            target = self.bounce_keyframes[0]
            self.current_scale += (target - self.current_scale) * 0.35
            if abs(self.current_scale - target) < 0.005:
                self.current_scale = target
                self.bounce_keyframes.pop(0)
        else:
            self.current_scale += (self.target_scale - self.current_scale) * 0.25

        self.update()

    # --- 鼠标交互事件 ---
    def enterEvent(self, event):
        self.hovered = True
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.hovered = False
        super().leaveEvent(event)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.press_pos = event.globalPosition().toPoint()
            self.drag_start_window_pos = self.pos()
            self.is_dragging = False
            self.bounce_keyframes = []
            self.target_scale = 0.88  # 按下反馈
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self.press_pos and (event.buttons() & Qt.MouseButton.LeftButton):
            curr_pos = event.globalPosition().toPoint()
            delta = curr_pos - self.press_pos
            if not self.is_dragging and delta.manhattanLength() > self.DRAG_THRESHOLD:
                self.is_dragging = True
                self.target_scale = 0.92  # 拖动状态微缩
            if self.is_dragging:
                self.move(self.drag_start_window_pos + delta)
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            # 松开时触发弹性回弹轨迹：108% -> 92% -> 100%
            self.bounce_keyframes = [1.08, 0.92, 1.00]
            self.target_scale = 1.0
            self.press_pos = None
            self.is_dragging = False
        super().mouseReleaseEvent(event)

    # --- QPainter 自绘逻辑 ---
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.setRenderHint(QPainter.RenderHint.TextAntialiasing)

        cx = self.width() / 2.0
        cy = self.height() / 2.0
        r = self.ball_base_size / 2.0

        # 应用缩放变换（以球心为基准）
        painter.save()
        painter.translate(cx, cy)
        painter.scale(self.current_scale, self.current_scale)
        painter.translate(-cx, -cy)

        # ----------------------------------------------------
        # 1. 第二层：旋转彩色光环与柔和光晕 (球体下方/外围)
        # ----------------------------------------------------
        if self.current_ring_opacity > 0.005:
            alpha_factor = self.current_ring_opacity
            ring_r = r + self.ring_width / 2.0 + 1.5

            if self.ring_mode == 'solid':
                # 纯色光晕
                glow_color = QColor(self.ring_color)
                glow_color.setAlpha(int(70 * alpha_factor))
                painter.setPen(QPen(glow_color, self.ring_width + 8.0, Qt.PenStyle.SolidLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawEllipse(QRectF(cx - ring_r, cy - ring_r, 2 * ring_r, 2 * ring_r))

                # 纯色主环
                main_color = QColor(self.ring_color)
                main_color.setAlpha(int(255 * alpha_factor))
                painter.setPen(QPen(main_color, self.ring_width, Qt.PenStyle.SolidLine))
                painter.drawEllipse(QRectF(cx - ring_r, cy - ring_r, 2 * ring_r, 2 * ring_r))

            else:  # rainbow 模式 (7色淡彩)
                rainbow_colors = [
                    QColor(255, 140, 140),  # 淡红
                    QColor(255, 190, 130),  # 淡橙
                    QColor(255, 240, 140),  # 淡黄
                    QColor(150, 240, 170),  # 淡绿
                    QColor(130, 235, 255),  # 淡青
                    QColor(150, 180, 255),  # 淡蓝
                    QColor(255, 140, 140)   # 闭合淡红
                ]
                stops = [0.0, 1/6, 2/6, 3/6, 4/6, 5/6, 1.0]

                # 渐变光晕
                glow_grad = QConicalGradient(cx, cy, self.current_angle)
                for stop, col in zip(stops, rainbow_colors):
                    c = QColor(col)
                    c.setAlpha(int(75 * alpha_factor))
                    glow_grad.setColorAt(stop, c)

                painter.setPen(QPen(QBrush(glow_grad), self.ring_width + 8.0, Qt.PenStyle.SolidLine))
                painter.setBrush(Qt.BrushStyle.NoBrush)
                painter.drawEllipse(QRectF(cx - ring_r, cy - ring_r, 2 * ring_r, 2 * ring_r))

                # 渐变主环
                main_grad = QConicalGradient(cx, cy, self.current_angle)
                for stop, col in zip(stops, rainbow_colors):
                    c = QColor(col)
                    c.setAlpha(int(255 * alpha_factor))
                    main_grad.setColorAt(stop, c)

                painter.setPen(QPen(QBrush(main_grad), self.ring_width, Qt.PenStyle.SolidLine))
                painter.drawEllipse(QRectF(cx - ring_r, cy - ring_r, 2 * ring_r, 2 * ring_r))

        # ----------------------------------------------------
        # 2. 第一层：玻璃球底 (径向渐变，高光向浅灰过渡，半透明)
        # ----------------------------------------------------
        transparency_factor = (100.0 - self.glass_transparency) / 100.0  # 1.0(不透明) ~ 0.0(高度透明)

        # 渐变中心偏左上方，模拟左上方光源高光
        highlight_cx = cx - r * 0.35
        highlight_cy = cy - r * 0.35
        glass_grad = QRadialGradient(QPointF(highlight_cx, highlight_cy), r * 1.4, QPointF(highlight_cx, highlight_cy))

        a_white = int(225 * max(0.15, transparency_factor))
        a_mid1  = int(130 * transparency_factor)
        a_mid2  = int(80 * transparency_factor)
        a_edge  = int(170 * transparency_factor)

        glass_grad.setColorAt(0.0, QColor(255, 255, 255, a_white))
        glass_grad.setColorAt(0.3, QColor(230, 240, 250, max(15, a_mid1)))
        glass_grad.setColorAt(0.7, QColor(165, 180, 200, max(10, a_mid2)))
        glass_grad.setColorAt(1.0, QColor(85, 100, 120, max(25, a_edge)))

        ball_rect = QRectF(cx - r, cy - r, 2 * r, 2 * r)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(glass_grad))
        painter.drawEllipse(ball_rect)

        # 球顶液体二次高光弧
        hl_path = QPainterPath()
        hl_rect = QRectF(cx - r * 0.7, cy - r * 0.85, r * 1.4, r * 0.65)
        hl_path.addEllipse(hl_rect)
        hl_grad = QLinearGradient(QPointF(cx, cy - r * 0.85), QPointF(cx, cy - r * 0.2))
        hl_grad.setColorAt(0.0, QColor(255, 255, 255, int(190 * (0.2 + 0.8 * transparency_factor))))
        hl_grad.setColorAt(1.0, QColor(255, 255, 255, 0))
        painter.setBrush(QBrush(hl_grad))
        painter.drawPath(hl_path)

        # ----------------------------------------------------
        # 3. 第三层：球内居中文字 (CPU & RAM + 小号灰色标签)
        # ----------------------------------------------------
        scale_r = r / 43.0  # 以 86px (r=43) 为参考基准进行字体缩放
        cpu_font_size = max(9, int(15 * scale_r))
        ram_font_size = max(7, int(11 * scale_r))
        lbl_font_size = max(6, int(8 * scale_r))

        font_cpu = QFont("Segoe UI", cpu_font_size, QFont.Weight.Bold)
        font_ram = QFont("Segoe UI", ram_font_size, QFont.Weight.Bold)
        font_lbl = QFont("Segoe UI", lbl_font_size, QFont.Weight.Bold)

        cpu_str = f"{self.cpu_pct}%"
        ram_str = f"{self.ram_pct}%"

        # Y 轴基线计算
        y_top = cy - r * 0.12
        y_bot = cy + r * 0.40

        # CPU 行
        painter.setFont(font_cpu)
        fm_cpu = painter.fontMetrics()
        w_cpu_val = fm_cpu.horizontalAdvance(cpu_str)

        painter.setFont(font_lbl)
        fm_lbl = painter.fontMetrics()
        w_cpu_lbl = fm_lbl.horizontalAdvance(" CPU")

        w_cpu_total = w_cpu_val + w_cpu_lbl
        start_x_cpu = cx - w_cpu_total / 2.0

        painter.setFont(font_cpu)
        painter.setPen(QColor(30, 35, 45))
        painter.drawText(QPointF(start_x_cpu, y_top), cpu_str)

        painter.setFont(font_lbl)
        painter.setPen(QColor(110, 125, 140))
        painter.drawText(QPointF(start_x_cpu + w_cpu_val, y_top), " CPU")

        # RAM 行
        painter.setFont(font_ram)
        fm_ram = painter.fontMetrics()
        w_ram_val = fm_ram.horizontalAdvance(ram_str)
        w_ram_lbl = fm_lbl.horizontalAdvance(" RAM")

        w_ram_total = w_ram_val + w_ram_lbl
        start_x_ram = cx - w_ram_total / 2.0

        painter.setFont(font_ram)
        painter.setPen(QColor(40, 48, 60))
        painter.drawText(QPointF(start_x_ram, y_bot), ram_str)

        painter.setFont(font_lbl)
        painter.setPen(QColor(115, 130, 145))
        painter.drawText(QPointF(start_x_ram + w_ram_val, y_bot), " RAM")

        # ----------------------------------------------------
        # 4. 第四层：球的边缘 (极细淡白色描边)
        # ----------------------------------------------------
        edge_pen = QPen(QColor(255, 255, 255, 210), 1.0)
        painter.setPen(edge_pen)
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawEllipse(ball_rect)

        painter.restore()


class ControlPanel(QMainWindow):
    """悬浮球独立控制面板窗口"""

    def __init__(self, floating_ball: FloatingBall):
        super().__init__()
        self.ball = floating_ball
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("悬浮球控制面板")
        self.setFixedWidth(340)

        # 浅色圆角卡片视觉风格 QSS
        self.setStyleSheet("""
            QMainWindow {
                background-color: #F8FAFC;
            }
            QWidget#CentralWidget {
                background-color: #F8FAFC;
            }
            QFrame.Card {
                background-color: #FFFFFF;
                border-radius: 12px;
                border: 1px solid #E2E8F0;
            }
            QLabel {
                color: #334155;
                font-family: 'Segoe UI', 'Microsoft YaHei';
                font-size: 13px;
            }
            QLabel.Title {
                color: #0F172A;
                font-size: 16px;
                font-weight: bold;
            }
            QLabel.ValLabel {
                color: #64748B;
                font-weight: 600;
            }
            QComboBox {
                background-color: #F1F5F9;
                border: 1px solid #CBD5E1;
                border-radius: 6px;
                padding: 4px 8px;
                color: #1E293B;
                font-size: 13px;
            }
            QComboBox:hover {
                background-color: #E2E8F0;
            }
            QPushButton#ColorBtn {
                border: 1px solid #CBD5E1;
                border-radius: 6px;
                font-size: 12px;
                padding: 4px 10px;
                background-color: #F1F5F9;
                color: #1E293B;
            }
            QPushButton#ColorBtn:hover {
                background-color: #E2E8F0;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: #E2E8F0;
                border-radius: 3px;
            }
            QSlider::sub-page:horizontal {
                background: #3B82F6;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #FFFFFF;
                border: 2px solid #3B82F6;
                width: 16px;
                height: 16px;
                margin: -5px 0;
                border-radius: 9px;
            }
            QSlider::handle:horizontal:hover {
                background: #EFF6FF;
            }
        """)

        central_widget = QWidget()
        central_widget.setObjectName("CentralWidget")
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # 标题栏
        title_label = QLabel("悬浮球控制面板")
        title_label.setProperty("class", "Title")
        main_layout.addWidget(title_label)

        # 卡片容器
        card = QFrame()
        card.setProperty("class", "Card")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(16, 16, 16, 16)
        card_layout.setSpacing(14)

        # 1. 光环模式
        row1, self.cb_mode = self.create_combo_row("光环模式", ["rainbow", "solid"])
        self.cb_mode.currentTextChanged.connect(self.on_mode_changed)
        card_layout.addLayout(row1)

        # 2. 光环颜色 (solid 模式)
        row2 = QHBoxLayout()
        lbl_color = QLabel("光环颜色")
        self.btn_color = QPushButton("选择颜色")
        self.btn_color.setObjectName("ColorBtn")
        self.btn_color.clicked.connect(self.choose_color)
        self.update_color_btn_style()
        row2.addWidget(lbl_color)
        row2.addStretch()
        row2.addWidget(self.btn_color)
        card_layout.addLayout(row2)

        # 3. 光环粗细 (0.5 ~ 5.0px)
        row3, self.sd_width, self.lbl_width_val = self.create_slider_row("光环粗细", 5, 50, 25, "px", divisor=10.0)
        self.sd_width.valueChanged.connect(self.on_width_changed)
        card_layout.addLayout(row3)

        # 4. 光环显示方式
        row4, self.cb_display = self.create_combo_row("光环显示方式", ["仅悬停时显示", "始终显示"])
        self.cb_display.currentIndexChanged.connect(self.on_display_mode_changed)
        card_layout.addLayout(row4)

        # 5. 旋转速度 (0.1 ~ 3.0)
        row5, self.sd_speed, self.lbl_speed_val = self.create_slider_row("旋转速度", 1, 30, 10, "x", divisor=10.0)
        self.sd_speed.valueChanged.connect(self.on_speed_changed)
        card_layout.addLayout(row5)

        # 6. 玻璃透明度 (0 ~ 100)
        row6, self.sd_trans, self.lbl_trans_val = self.create_slider_row("玻璃透明度", 0, 100, 50, "%")
        self.sd_trans.valueChanged.connect(self.on_transparency_changed)
        card_layout.addLayout(row6)

        # 7. 球大小 (60 ~ 140px)
        row7, self.sd_size, self.lbl_size_val = self.create_slider_row("球大小", 60, 140, 86, "px", step=2)
        self.sd_size.valueChanged.connect(self.on_size_changed)
        card_layout.addLayout(row7)

        main_layout.addWidget(card)
        main_layout.addStretch()

        # 初始化状态联动
        self.update_controls_enable_state()

    def create_combo_row(self, label_text, items):
        row = QHBoxLayout()
        lbl = QLabel(label_text)
        combo = QComboBox()
        combo.addItems(items)
        row.addWidget(lbl)
        row.addStretch()
        row.addWidget(combo)
        return row, combo

    def create_slider_row(self, label_text, min_val, max_val, init_val, unit, divisor=1.0, step=1):
        row = QHBoxLayout()
        lbl = QLabel(label_text)
        slider = QSlider(Qt.Orientation.Horizontal)
        slider.setRange(min_val, max_val)
        slider.setSingleStep(step)
        slider.setValue(init_val)

        val_text = f"{init_val / divisor:.1f} {unit}" if divisor != 1.0 else f"{init_val} {unit}"
        lbl_val = QLabel(val_text)
        lbl_val.setProperty("class", "ValLabel")
        lbl_val.setFixedWidth(52)
        lbl_val.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)

        row.addWidget(lbl)
        row.addWidget(slider)
        row.addWidget(lbl_val)
        return row, slider, lbl_val

    # --- 信号处理 ---
    def on_mode_changed(self, text):
        self.ball.ring_mode = text
        self.update_controls_enable_state()

    def choose_color(self):
        color = QColorDialog.getColor(self.ball.ring_color, self, "选择光环颜色")
        if color.isValid():
            self.ball.ring_color = color
            self.update_color_btn_style()

    def on_width_changed(self, val):
        w = val / 10.0
        self.lbl_width_val.setText(f"{w:.1f} px")
        self.ball.ring_width = w

    def on_display_mode_changed(self, index):
        self.ball.ring_display_mode = 'hover' if index == 0 else 'always'

    def on_speed_changed(self, val):
        sp = val / 10.0
        self.lbl_speed_val.setText(f"{sp:.1f} x")
        self.ball.rotation_speed = sp

    def on_transparency_changed(self, val):
        self.lbl_trans_val.setText(f"{val} %")
        self.ball.glass_transparency = val

    def on_size_changed(self, val):
        self.lbl_size_val.setText(f"{val} px")
        self.ball.ball_base_size = val
        self.ball.update_window_size()

    def update_color_btn_style(self):
        c = self.ball.ring_color
        hex_code = c.name()
        self.btn_color.setStyleSheet(f"""
            QPushButton#ColorBtn {{
                background-color: {hex_code};
                color: {'#FFFFFF' if c.lightness() < 140 else '#000000'};
                font-weight: bold;
            }}
        """)
        self.btn_color.setText(hex_code.upper())

    def update_controls_enable_state(self):
        is_solid = (self.ball.ring_mode == 'solid')
        self.btn_color.setEnabled(is_solid)
        self.sd_speed.setEnabled(not is_solid)


def main():
    app = QApplication(sys.argv)

    # 创建并启动后台模拟线程
    data_thread = DataThread()

    # 创建悬浮球窗口
    ball = FloatingBall()
    data_thread.data_updated.connect(ball.set_data)
    data_thread.start()
    ball.show()

    # 创建控制面板窗口
    panel = ControlPanel(ball)
    panel.show()

    # 优雅退出逻辑
    def on_exit():
        data_thread.stop()

    app.aboutToQuit.connect(on_exit)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
