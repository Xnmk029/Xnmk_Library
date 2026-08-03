from PyQt5.QtWidgets import (QWidget, QHBoxLayout, QPushButton, QToolButton,
                             QColorDialog, QVBoxLayout, QMenu, QAction)
from PyQt5.QtCore import Qt, pyqtSignal, QSize, QPoint
from PyQt5.QtGui import (QPainter, QColor, QPen, QIcon, QPixmap, QFont, QBrush,
                         QPainterPath, QPolygonF)
import math


class ToolButton(QToolButton):
    """自定义工具按钮 - QQ风格"""
    
    def __init__(self, icon_type="", tooltip="", parent=None):
        super().__init__(parent)
        self.icon_type = icon_type
        self.setToolTip(tooltip)
        self.setFixedSize(28, 28)
        self.setCheckable(True)
        self.setAutoRaise(True)
        self._hovered = False
        
    def enterEvent(self, event):
        self._hovered = True
        self.update()
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        self._hovered = False
        self.update()
        super().leaveEvent(event)
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        rect = self.rect().adjusted(1, 1, -1, -1)
        
        if self.isChecked():
            painter.setPen(QPen(QColor(0, 120, 215), 1))
            painter.setBrush(QBrush(QColor(200, 230, 255)))
            painter.drawRoundedRect(rect, 3, 3)
        elif self._hovered:
            painter.setPen(QPen(QColor(180, 180, 180), 1))
            painter.setBrush(QBrush(QColor(235, 240, 248)))
            painter.drawRoundedRect(rect, 3, 3)
        
        # 绘制图标
        self._draw_icon(painter, rect)
        painter.end()
    
    def _draw_icon(self, painter, rect):
        """绘制矢量图标"""
        cx, cy = rect.center().x(), rect.center().y()
        icon_color = QColor(80, 80, 80)
        painter.setPen(QPen(icon_color, 1.5))
        painter.setBrush(Qt.NoBrush)
        
        if self.icon_type == "undo":
            # 撤销箭头
            path = QPainterPath()
            path.moveTo(cx + 5, cy - 4)
            path.lineTo(cx - 4, cy - 4)
            path.lineTo(cx - 4, cy + 4)
            painter.drawPath(path)
            # 箭头头部
            painter.drawLine(cx + 5, cy - 4, cx + 2, cy - 7)
            painter.drawLine(cx + 5, cy - 4, cx + 2, cy - 1)
            
        elif self.icon_type == "redo":
            path = QPainterPath()
            path.moveTo(cx - 5, cy - 4)
            path.lineTo(cx + 4, cy - 4)
            path.lineTo(cx + 4, cy + 4)
            painter.drawPath(path)
            painter.drawLine(cx - 5, cy - 4, cx - 2, cy - 7)
            painter.drawLine(cx - 5, cy - 4, cx - 2, cy - 1)
            
        elif self.icon_type == "rect":
            painter.drawRect(cx - 6, cy - 5, 12, 10)
            
        elif self.icon_type == "ellipse":
            painter.drawEllipse(cx - 6, cy - 5, 12, 10)
            
        elif self.icon_type == "arrow":
            painter.drawLine(cx - 6, cy + 4, cx + 4, cy - 4)
            # 箭头头部
            painter.drawLine(cx + 4, cy - 4, cx - 1, cy - 3)
            painter.drawLine(cx + 4, cy - 4, cx + 3, cy + 1)
            
        elif self.icon_type == "line":
            painter.setPen(QPen(icon_color, 1.5, Qt.SolidLine, Qt.RoundCap))
            painter.drawLine(cx - 6, cy + 5, cx + 6, cy - 5)
            
        elif self.icon_type == "text":
            painter.setPen(icon_color)
            font = QFont("Arial", 12, QFont.Bold)
            painter.setFont(font)
            painter.drawText(rect, Qt.AlignCenter, "A")
            # 下划线
            painter.setPen(QPen(icon_color, 1.5))
            painter.drawLine(cx - 5, cy + 7, cx + 5, cy + 7)
            
        elif self.icon_type == "mosaic":
            # 马赛克图标 - 小方块网格
            size = 4
            for i in range(3):
                for j in range(3):
                    if (i + j) % 2 == 0:
                        painter.fillRect(cx - 6 + i * size, cy - 6 + j * size, 
                                        size - 1, size - 1, icon_color)
                    else:
                        painter.setPen(QPen(icon_color, 0.5))
                        painter.drawRect(cx - 6 + i * size, cy - 6 + j * size,
                                        size - 1, size - 1)
                        painter.setPen(Qt.NoPen)
        
        elif self.icon_type == "save":
            # 保存图标（软盘）
            painter.drawRect(cx - 6, cy - 6, 12, 12)
            painter.drawRect(cx - 3, cy - 6, 6, 5)
            painter.drawRect(cx - 4, cy + 1, 8, 5)
            
        elif self.icon_type == "pin":
            # 图钉图标
            painter.setPen(QPen(icon_color, 1.5))
            painter.drawEllipse(cx - 3, cy - 7, 6, 6)
            painter.drawLine(cx, cy - 1, cx, cy + 7)
            
        elif self.icon_type == "cancel":
            painter.setPen(QPen(QColor(200, 50, 50), 2))
            painter.drawLine(cx - 5, cy - 5, cx + 5, cy + 5)
            painter.drawLine(cx + 5, cy - 5, cx - 5, cy + 5)
            
        elif self.icon_type == "download":
            # 下载图标
            painter.drawLine(cx, cy - 6, cx, cy + 3)
            painter.drawLine(cx, cy + 3, cx - 4, cy - 1)
            painter.drawLine(cx, cy + 3, cx + 4, cy - 1)
            painter.drawLine(cx - 6, cy + 6, cx + 6, cy + 6)


class ColorButton(QToolButton):
    """颜色选择按钮"""
    colorChanged = pyqtSignal(QColor)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(28, 28)
        self.setAutoRaise(True)
        self._color = QColor(255, 0, 0)
        self._hovered = False
        self.setToolTip("选择颜色")
        self.clicked.connect(self._pick_color)
    
    def _pick_color(self):
        color = QColorDialog.getColor(self._color, self, "选择颜色")
        if color.isValid():
            self._color = color
            self.colorChanged.emit(color)
            self.update()
    
    def get_color(self):
        return self._color
    
    def set_color(self, color):
        self._color = color
        self.update()
    
    def enterEvent(self, event):
        self._hovered = True
        self.update()
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        self._hovered = False
        self.update()
        super().leaveEvent(event)
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        rect = self.rect().adjusted(2, 2, -2, -2)
        
        if self._hovered:
            painter.setPen(QPen(QColor(150, 150, 150), 1))
            painter.setBrush(QBrush(QColor(230, 240, 250)))
            painter.drawRoundedRect(rect, 3, 3)
        
        # 绘制颜色指示条
        color_rect = rect.adjusted(4, 14, -4, -2)
        painter.fillRect(color_rect, self._color)
        painter.setPen(QPen(QColor(100, 100, 100), 1))
        painter.drawRect(color_rect)
        
        # 绘制"A"文字表示颜色
        painter.setPen(self._color)
        font = QFont("Arial", 11, QFont.Bold)
        painter.setFont(font)
        painter.drawText(rect.adjusted(0, -4, 0, 0), Qt.AlignCenter, "A")
        
        painter.end()


class WidthButton(QToolButton):
    """线宽选择按钮"""
    widthChanged = pyqtSignal(int)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(28, 28)
        self.setAutoRaise(True)
        self._width = 3
        self._hovered = False
        self.setToolTip("线条粗细")
        self.clicked.connect(self._show_menu)
    
    def _show_menu(self):
        menu = QMenu(self)
        for w in [1, 2, 3, 5, 8]:
            action = QAction(f"  {w}px  ", self)
            action.triggered.connect(lambda checked, width=w: self._set_width(width))
            menu.addAction(action)
        
        # 在按钮下方显示菜单
        pos = self.mapToGlobal(QPoint(0, self.height()))
        menu.exec_(pos)
    
    def _set_width(self, width):
        self._width = width
        self.widthChanged.emit(width)
        self.update()
    
    def get_width(self):
        return self._width
    
    def enterEvent(self, event):
        self._hovered = True
        self.update()
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        self._hovered = False
        self.update()
        super().leaveEvent(event)
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        rect = self.rect().adjusted(2, 2, -2, -2)
        
        if self._hovered:
            painter.setPen(QPen(QColor(150, 150, 150), 1))
            painter.setBrush(QBrush(QColor(230, 240, 250)))
            painter.drawRoundedRect(rect, 3, 3)
        
        # 绘制线宽指示
        painter.setPen(QPen(QColor(60, 60, 60), self._width))
        center_y = rect.center().y()
        painter.drawLine(rect.left() + 4, center_y, rect.right() - 4, center_y)
        
        painter.end()


class FinishButton(QToolButton):
    """完成按钮 - QQ风格蓝色按钮"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(48, 26)
        self.setAutoRaise(True)
        self._hovered = False
        self._pressed = False
        self.setToolTip("完成 (Enter)")
    
    def enterEvent(self, event):
        self._hovered = True
        self.update()
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        self._hovered = False
        self.update()
        super().leaveEvent(event)
    
    def mousePressEvent(self, event):
        self._pressed = True
        self.update()
        super().mousePressEvent(event)
    
    def mouseReleaseEvent(self, event):
        self._pressed = False
        self.update()
        super().mouseReleaseEvent(event)
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        rect = self.rect().adjusted(1, 1, -1, -1)
        
        # 蓝色背景
        if self._pressed:
            bg_color = QColor(0, 90, 180)
        elif self._hovered:
            bg_color = QColor(0, 130, 230)
        else:
            bg_color = QColor(0, 120, 215)
        
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(bg_color))
        painter.drawRoundedRect(rect, 3, 3)
        
        # 白色文字
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Microsoft YaHei", 9)
        painter.setFont(font)
        painter.drawText(rect, Qt.AlignCenter, "完成")
        
        painter.end()


class ToolbarWidget(QWidget):
    """QQ截图工具栏"""
    
    # 信号
    tool_changed = pyqtSignal(str)  # 工具切换
    color_changed = pyqtSignal(QColor)
    width_changed = pyqtSignal(int)
    undo_triggered = pyqtSignal()
    redo_triggered = pyqtSignal()
    save_triggered = pyqtSignal()
    copy_triggered = pyqtSignal()
    pin_triggered = pyqtSignal()
    cancel_triggered = pyqtSignal()
    finish_triggered = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool |
            Qt.WindowDoesNotAcceptFocus
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedHeight(40)
        self._init_ui()
    
    def _init_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(4, 3, 4, 3)
        layout.setSpacing(2)
        
        # 撤销/重做
        self.btn_undo = ToolButton("undo", "撤销 (Ctrl+Z)")
        self.btn_undo.clicked.connect(self.undo_triggered.emit)
        layout.addWidget(self.btn_undo)
        
        self.btn_redo = ToolButton("redo", "重做 (Ctrl+Y)")
        self.btn_redo.clicked.connect(self.redo_triggered.emit)
        layout.addWidget(self.btn_redo)
        
        # 分隔线
        sep1 = self._create_separator()
        layout.addWidget(sep1)
        
        # 绘图工具
        self.btn_rect = ToolButton("rect", "矩形")
        self.btn_rect.clicked.connect(lambda: self._select_tool("rect"))
        layout.addWidget(self.btn_rect)
        
        self.btn_ellipse = ToolButton("ellipse", "椭圆")
        self.btn_ellipse.clicked.connect(lambda: self._select_tool("ellipse"))
        layout.addWidget(self.btn_ellipse)
        
        self.btn_arrow = ToolButton("arrow", "箭头")
        self.btn_arrow.clicked.connect(lambda: self._select_tool("arrow"))
        layout.addWidget(self.btn_arrow)
        
        self.btn_line = ToolButton("line", "直线")
        self.btn_line.clicked.connect(lambda: self._select_tool("line"))
        layout.addWidget(self.btn_line)
        
        self.btn_text = ToolButton("text", "文字")
        self.btn_text.clicked.connect(lambda: self._select_tool("text"))
        layout.addWidget(self.btn_text)
        
        self.btn_mosaic = ToolButton("mosaic", "马赛克")
        self.btn_mosaic.clicked.connect(lambda: self._select_tool("mosaic"))
        layout.addWidget(self.btn_mosaic)
        
        # 分隔线
        sep2 = self._create_separator()
        layout.addWidget(sep2)
        
        # 颜色和线宽
        self.btn_color = ColorButton()
        self.btn_color.colorChanged.connect(self.color_changed.emit)
        layout.addWidget(self.btn_color)
        
        self.btn_width = WidthButton()
        self.btn_width.widthChanged.connect(self.width_changed.emit)
        layout.addWidget(self.btn_width)
        
        # 分隔线
        sep3 = self._create_separator()
        layout.addWidget(sep3)
        
        # 操作按钮
        self.btn_save = ToolButton("save", "保存 (Ctrl+S)")
        self.btn_save.clicked.connect(self.save_triggered.emit)
        layout.addWidget(self.btn_save)
        
        self.btn_pin = ToolButton("pin", "钉在屏幕上")
        self.btn_pin.clicked.connect(self.pin_triggered.emit)
        layout.addWidget(self.btn_pin)
        
        self.btn_cancel = ToolButton("cancel", "取消 (Esc)")
        self.btn_cancel.clicked.connect(self.cancel_triggered.emit)
        layout.addWidget(self.btn_cancel)
        
        # QQ风格"完成"按钮（蓝色）
        self.btn_finish = FinishButton()
        self.btn_finish.clicked.connect(self.finish_triggered.emit)
        layout.addWidget(self.btn_finish)
        
        self.tool_buttons = [
            self.btn_rect, self.btn_ellipse, self.btn_arrow,
            self.btn_line, self.btn_text, self.btn_mosaic
        ]
    
    def _create_separator(self):
        """创建分隔线"""
        sep = QWidget()
        sep.setFixedSize(1, 20)
        sep.setStyleSheet("background-color: #D0D0D0;")
        return sep
    
    def _select_tool(self, tool_name):
        """选择工具"""
        for btn in self.tool_buttons:
            btn.setChecked(False)
        
        tool_map = {
            "rect": self.btn_rect,
            "ellipse": self.btn_ellipse,
            "arrow": self.btn_arrow,
            "line": self.btn_line,
            "text": self.btn_text,
            "mosaic": self.btn_mosaic,
        }
        
        if tool_name in tool_map:
            tool_map[tool_name].setChecked(True)
        
        self.tool_changed.emit(tool_name)
    
    def get_color(self):
        return self.btn_color.get_color()
    
    def get_width(self):
        return self.btn_width.get_width()
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 绘制阴影
        shadow_color = QColor(0, 0, 0, 30)
        for i in range(3):
            shadow_rect = self.rect().adjusted(-i, -i, i, i)
            painter.setPen(QPen(QColor(0, 0, 0, 15 - i * 4), 1))
            painter.setBrush(Qt.NoBrush)
            painter.drawRoundedRect(shadow_rect, 5, 5)
        
        # 绘制圆角背景
        rect = self.rect().adjusted(1, 1, -1, -1)
        painter.setPen(QPen(QColor(180, 180, 180), 1))
        painter.setBrush(QBrush(QColor(250, 250, 250, 252)))
        painter.drawRoundedRect(rect, 4, 4)
        
        painter.end()
