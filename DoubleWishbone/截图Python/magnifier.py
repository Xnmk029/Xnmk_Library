from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, QRect, QPoint
from PyQt5.QtGui import QPainter, QColor, QPen, QFont, QImage, QPixmap


class MagnifierWidget(QWidget):
    """QQ截图放大镜 - 显示光标附近像素的放大视图"""
    
    MAGNIFIER_SIZE = 150  # 放大镜窗口大小
    PIXEL_SIZE = 10       # 每个像素放大后的尺寸
    GRID_COUNT = 15       # 显示的像素格数 (15x15)
    
    def __init__(self, screen_pixmap, parent=None):
        super().__init__(parent)
        self.screen_pixmap = screen_pixmap
        self.screen_image = screen_pixmap.toImage()  # 缓存图像避免重复转换
        self.cursor_pos = QPoint(0, 0)
        
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool |
            Qt.WindowDoesNotAcceptFocus
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setAttribute(Qt.WA_ShowWithoutActivating)
        self.setFixedSize(self.MAGNIFIER_SIZE + 2, self.MAGNIFIER_SIZE + 62)
    
    def update_position(self, global_pos):
        """更新放大镜位置和内容"""
        self.cursor_pos = global_pos
        
        # 计算放大镜窗口位置（光标右下方偏移）
        offset_x = 20
        offset_y = 20
        
        # 获取屏幕尺寸
        screen = self.screen()
        if screen:
            screen_geo = screen.geometry()
            x = global_pos.x() + offset_x
            y = global_pos.y() + offset_y
            
            # 防止超出屏幕
            if x + self.width() > screen_geo.right():
                x = global_pos.x() - self.width() - offset_x
            if y + self.height() > screen_geo.bottom():
                y = global_pos.y() - self.height() - offset_y
            
            self.move(x, y)
        
        self.update()
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing, False)
        
        # 绘制背景
        painter.fillRect(self.rect(), QColor(0, 0, 0))
        
        # 绘制外边框
        painter.setPen(QPen(QColor(80, 80, 80), 1))
        painter.drawRect(self.rect().adjusted(0, 0, -1, -1))
        
        # 计算源区域（光标周围的像素）
        half = self.GRID_COUNT // 2
        src_x = self.cursor_pos.x() - half
        src_y = self.cursor_pos.y() - half
        
        # 绘制放大的像素
        for i in range(self.GRID_COUNT):
            for j in range(self.GRID_COUNT):
                px = src_x + i
                py = src_y + j
                
                # 获取像素颜色
                if (0 <= px < self.screen_image.width() and 
                    0 <= py < self.screen_image.height()):
                    color = QColor(self.screen_image.pixel(px, py))
                else:
                    color = QColor(128, 128, 128)
                
                # 绘制像素块
                rect = QRect(
                    1 + i * self.PIXEL_SIZE,
                    1 + j * self.PIXEL_SIZE,
                    self.PIXEL_SIZE,
                    self.PIXEL_SIZE
                )
                painter.fillRect(rect, color)
        
        # 绘制网格线
        painter.setPen(QPen(QColor(60, 60, 60), 1))
        for i in range(self.GRID_COUNT + 1):
            x = 1 + i * self.PIXEL_SIZE
            painter.drawLine(x, 1, x, 1 + self.GRID_COUNT * self.PIXEL_SIZE)
            y = 1 + i * self.PIXEL_SIZE
            painter.drawLine(1, y, 1 + self.GRID_COUNT * self.PIXEL_SIZE, y)
        
        # 绘制中心十字线（当前像素高亮）
        center = half
        painter.setPen(QPen(QColor(0, 200, 0), 2))
        cx = 1 + center * self.PIXEL_SIZE
        cy = 1 + center * self.PIXEL_SIZE
        painter.drawRect(cx, cy, self.PIXEL_SIZE, self.PIXEL_SIZE)
        
        # 获取当前像素颜色
        if (0 <= self.cursor_pos.x() < self.screen_image.width() and
            0 <= self.cursor_pos.y() < self.screen_image.height()):
            cur_color = QColor(self.screen_image.pixel(
                self.cursor_pos.x(), self.cursor_pos.y()))
        else:
            cur_color = QColor(0, 0, 0)
        
        # 底部信息区域
        info_y = 1 + self.GRID_COUNT * self.PIXEL_SIZE + 2
        painter.fillRect(0, info_y, self.width(), 60, QColor(0, 0, 0))
        
        # 绘制颜色预览块
        painter.fillRect(5, info_y + 4, 20, 20, cur_color)
        painter.setPen(QPen(QColor(100, 100, 100), 1))
        painter.drawRect(5, info_y + 4, 20, 20)
        
        # 绘制RGB信息
        painter.setPen(QColor(255, 255, 255))
        font = QFont("Consolas", 8)
        painter.setFont(font)
        
        rgb_text = f"R:{cur_color.red()} G:{cur_color.green()} B:{cur_color.blue()}"
        painter.drawText(30, info_y + 18, rgb_text)
        
        # 绘制坐标信息
        pos_text = f"X:{self.cursor_pos.x()} Y:{self.cursor_pos.y()}"
        painter.drawText(5, info_y + 38, pos_text)
        
        # 绘制HEX颜色
        hex_text = f"#{cur_color.red():02X}{cur_color.green():02X}{cur_color.blue():02X}"
        painter.drawText(80, info_y + 38, hex_text)
        
        painter.end()
