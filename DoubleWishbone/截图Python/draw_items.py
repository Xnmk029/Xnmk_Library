from PyQt5.QtCore import Qt, QPoint, QRect, QRectF
from PyQt5.QtGui import QPainter, QColor, QPen, QBrush, QFont, QImage, QPainterPath
import math


class DrawItem:
    """绘图项基类"""
    
    def __init__(self, color, width):
        self.color = color
        self.width = width
        self.start_point = QPoint()
        self.end_point = QPoint()
        self.finished = False
    
    def set_start(self, point):
        self.start_point = point
    
    def set_end(self, point):
        self.end_point = point
    
    def draw(self, painter):
        raise NotImplementedError
    
    def contains(self, point, tolerance=5):
        raise NotImplementedError


class RectItem(DrawItem):
    """矩形"""
    
    def draw(self, painter):
        painter.setPen(QPen(self.color, self.width))
        painter.setBrush(Qt.NoBrush)
        rect = QRect(self.start_point, self.end_point).normalized()
        painter.drawRect(rect)
    
    def contains(self, point, tolerance=5):
        rect = QRect(self.start_point, self.end_point).normalized()
        t = tolerance + self.width
        # 检查是否在边框附近
        if rect.adjusted(-t, -t, t, t).contains(point):
            if not rect.adjusted(t, t, -t, -t).contains(point):
                return True
        return False


class EllipseItem(DrawItem):
    """椭圆"""
    
    def draw(self, painter):
        painter.setPen(QPen(self.color, self.width))
        painter.setBrush(Qt.NoBrush)
        rect = QRect(self.start_point, self.end_point).normalized()
        painter.drawEllipse(rect)
    
    def contains(self, point, tolerance=5):
        rect = QRectF(self.start_point, self.end_point).normalized()
        if rect.width() == 0 or rect.height() == 0:
            return False
        center = rect.center()
        rx = rect.width() / 2
        ry = rect.height() / 2
        # 椭圆方程判断
        dx = (point.x() - center.x()) / rx
        dy = (point.y() - center.y()) / ry
        dist = math.sqrt(dx * dx + dy * dy)
        t = (tolerance + self.width) / min(rx, ry)
        return abs(dist - 1.0) < t


class ArrowItem(DrawItem):
    """箭头"""
    
    def draw(self, painter):
        painter.setPen(QPen(self.color, self.width))
        painter.setBrush(QBrush(self.color))
        
        # 画线段
        painter.drawLine(self.start_point, self.end_point)
        
        # 计算箭头
        dx = self.end_point.x() - self.start_point.x()
        dy = self.end_point.y() - self.start_point.y()
        length = math.sqrt(dx * dx + dy * dy)
        
        if length < 1:
            return
        
        # 箭头大小与线宽相关
        arrow_size = max(12, self.width * 4)
        angle = math.atan2(dy, dx)
        
        # 箭头两个点
        angle1 = angle + math.pi * 0.85
        angle2 = angle - math.pi * 0.85
        
        p1 = QPoint(
            int(self.end_point.x() + arrow_size * math.cos(angle1)),
            int(self.end_point.y() + arrow_size * math.sin(angle1))
        )
        p2 = QPoint(
            int(self.end_point.x() + arrow_size * math.cos(angle2)),
            int(self.end_point.y() + arrow_size * math.sin(angle2))
        )
        
        # 绘制实心箭头
        path = QPainterPath()
        path.moveTo(self.end_point)
        path.lineTo(p1)
        path.lineTo(p2)
        path.closeSubpath()
        painter.fillPath(path, self.color)
    
    def contains(self, point, tolerance=5):
        return self._point_near_line(point, self.start_point, self.end_point, tolerance + self.width)
    
    def _point_near_line(self, point, start, end, tolerance):
        dx = end.x() - start.x()
        dy = end.y() - start.y()
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            return (point - start).manhattanLength() < tolerance
        
        t = max(0, min(1, ((point.x() - start.x()) * dx + (point.y() - start.y()) * dy) / length_sq))
        proj = QPoint(int(start.x() + t * dx), int(start.y() + t * dy))
        dist = math.sqrt((point.x() - proj.x()) ** 2 + (point.y() - proj.y()) ** 2)
        return dist < tolerance


class LineItem(DrawItem):
    """直线"""
    
    def draw(self, painter):
        painter.setPen(QPen(self.color, self.width, Qt.SolidLine, Qt.RoundCap))
        painter.drawLine(self.start_point, self.end_point)
    
    def contains(self, point, tolerance=5):
        dx = self.end_point.x() - self.start_point.x()
        dy = self.end_point.y() - self.start_point.y()
        length_sq = dx * dx + dy * dy
        if length_sq == 0:
            return (point - self.start_point).manhattanLength() < tolerance
        
        t = max(0, min(1, ((point.x() - self.start_point.x()) * dx + 
                           (point.y() - self.start_point.y()) * dy) / length_sq))
        proj = QPoint(int(self.start_point.x() + t * dx), int(self.start_point.y() + t * dy))
        dist = math.sqrt((point.x() - proj.x()) ** 2 + (point.y() - proj.y()) ** 2)
        return dist < tolerance + self.width


class TextItem(DrawItem):
    """文字"""
    
    def __init__(self, color, width, text="", font_size=16):
        super().__init__(color, width)
        self.text = text
        self.font_size = font_size
        self.font = QFont("Microsoft YaHei", font_size)
    
    def draw(self, painter):
        if not self.text:
            return
        painter.setPen(self.color)
        painter.setFont(self.font)
        painter.drawText(self.start_point, self.text)
    
    def get_rect(self):
        """获取文字区域"""
        from PyQt5.QtWidgets import QApplication
        fm = QApplication.fontMetrics()
        fm = QFont(self.font)
        # 简单估算
        width = len(self.text) * self.font_size
        height = self.font_size * 2
        return QRect(self.start_point.x(), self.start_point.y() - self.font_size,
                     width, height)
    
    def contains(self, point, tolerance=5):
        rect = self.get_rect()
        return rect.adjusted(-tolerance, -tolerance, tolerance, tolerance).contains(point)


class MosaicItem(DrawItem):
    """马赛克"""
    
    def __init__(self, color, width, screen_pixmap=None):
        super().__init__(color, width)
        self.points = []  # 马赛克路径点
        self.screen_pixmap = screen_pixmap
        self.mosaic_size = max(8, width * 3)  # 马赛克块大小
    
    def add_point(self, point):
        self.points.append(QPoint(point))
    
    def draw(self, painter):
        if not self.points or not self.screen_pixmap:
            return
        
        # 对路径上的区域进行马赛克处理
        drawn_blocks = set()
        
        for point in self.points:
            # 计算马赛克块
            block_x = (point.x() // self.mosaic_size) * self.mosaic_size
            block_y = (point.y() // self.mosaic_size) * self.mosaic_size
            
            block_key = (block_x, block_y)
            if block_key in drawn_blocks:
                continue
            drawn_blocks.add(block_key)
            
            # 获取块中心颜色
            cx = block_x + self.mosaic_size // 2
            cy = block_y + self.mosaic_size // 2
            
            if (0 <= cx < self.screen_pixmap.width() and 
                0 <= cy < self.screen_pixmap.height()):
                color = QColor(self.screen_pixmap.toImage().pixel(cx, cy))
                rect = QRect(block_x, block_y, self.mosaic_size, self.mosaic_size)
                painter.fillRect(rect, color)
    
    def contains(self, point, tolerance=5):
        for p in self.points:
            if (point - p).manhattanLength() < self.mosaic_size:
                return True
        return False
