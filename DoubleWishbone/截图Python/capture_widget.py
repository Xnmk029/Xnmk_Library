import os
import sys
from PyQt5.QtWidgets import (QWidget, QApplication, QFileDialog, QTextEdit,
                             QMessageBox)
from PyQt5.QtCore import (Qt, QPoint, QRect, QSize, QTimer, pyqtSignal)
from PyQt5.QtGui import (QPainter, QColor, QPen, QBrush, QPixmap, QCursor,
                         QFont, QImage, QScreen)

from magnifier import MagnifierWidget
from toolbar import ToolbarWidget
from draw_items import (RectItem, EllipseItem, ArrowItem, LineItem,
                        TextItem, MosaicItem)


class TextInputWidget(QTextEdit):
    """文字输入框"""
    text_finished = pyqtSignal(str, QPoint)
    
    def __init__(self, pos, color, parent=None):
        super().__init__(parent)
        self.text_pos = pos
        self.text_color = color
        self.setGeometry(pos.x(), pos.y(), 200, 30)
        self.setStyleSheet(f"""
            QTextEdit {{
                background: transparent;
                color: rgb({color.red()}, {color.green()}, {color.blue()});
                border: 1px dashed rgb({color.red()}, {color.green()}, {color.blue()});
                font-family: 'Microsoft YaHei';
                font-size: 16px;
                padding: 2px;
            }}
        """)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setFocus()
    
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.text_finished.emit("", self.text_pos)
            self.hide()
        elif event.key() in (Qt.Key_Return, Qt.Key_Enter):
            if event.modifiers() & Qt.ControlModifier:
                super().keyPressEvent(event)
            else:
                text = self.toPlainText().strip()
                self.text_finished.emit(text, self.text_pos)
                self.hide()
        else:
            super().keyPressEvent(event)
            # 自动调整大小
            doc = self.document()
            doc.adjustSize()
            new_height = max(30, int(doc.size().height()) + 10)
            new_width = max(200, int(doc.idealWidth()) + 20)
            self.setFixedSize(new_width, new_height)


class CaptureWidget(QWidget):
    """QQ截图主窗口 - 全屏遮罩层"""
    
    # 状态枚举
    STATE_IDLE = 0          # 等待选择
    STATE_SELECTING = 1     # 正在选择区域
    STATE_SELECTED = 2      # 已选择区域
    STATE_DRAWING = 3       # 正在绘图
    STATE_MOVING = 4        # 移动选区
    STATE_RESIZING = 5      # 调整选区大小
    
    # 手柄位置
    HANDLE_SIZE = 8
    HANDLES = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br']
    
    def __init__(self):
        super().__init__()
        
        # 截取全屏
        self.screen_pixmap = self._capture_screen()
        
        # 状态
        self.state = self.STATE_IDLE
        self.select_start = QPoint()
        self.select_end = QPoint()
        self.selection_rect = QRect()
        
        # 手柄相关
        self.active_handle = None
        self.resize_start = QPoint()
        self.resize_rect = QRect()
        
        # 移动相关
        self.move_start = QPoint()
        self.move_rect_start = QRect()
        
        # 绘图相关
        self.current_tool = None
        self.draw_items = []
        self.undo_stack = []
        self.current_item = None
        self.draw_color = QColor(255, 0, 0)
        self.draw_width = 3
        
        # 文字输入
        self.text_input = None
        
        # 窗口设置
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setCursor(Qt.CrossCursor)
        
        # 全屏显示
        screen_geo = QApplication.primaryScreen().geometry()
        self.setGeometry(screen_geo)
        self.showFullScreen()
        
        # 放大镜
        self.magnifier = MagnifierWidget(self.screen_pixmap)
        self.magnifier.show()
        
        # 工具栏
        self.toolbar = ToolbarWidget()
        self.toolbar.tool_changed.connect(self._on_tool_changed)
        self.toolbar.color_changed.connect(self._on_color_changed)
        self.toolbar.width_changed.connect(self._on_width_changed)
        self.toolbar.undo_triggered.connect(self._undo)
        self.toolbar.redo_triggered.connect(self._redo)
        self.toolbar.save_triggered.connect(self._save)
        self.toolbar.copy_triggered.connect(self._copy_to_clipboard)
        self.toolbar.pin_triggered.connect(self._pin)
        self.toolbar.cancel_triggered.connect(self._cancel)
        self.toolbar.finish_triggered.connect(self._finish)
    
    def _capture_screen(self):
        """截取全屏（使用Qt原生方法，避免多显示器/DPI偏移）"""
        screen = QApplication.primaryScreen()
        pixmap = screen.grabWindow(0)
        return pixmap
    
    def _get_selection_rect(self):
        """获取当前选区矩形"""
        return QRect(self.select_start, self.select_end).normalized()
    
    def _get_handles(self):
        """获取8个手柄的位置"""
        rect = self.selection_rect
        hs = self.HANDLE_SIZE
        half = hs // 2
        
        handles = {
            'tl': QRect(rect.left() - half, rect.top() - half, hs, hs),
            'tm': QRect(rect.center().x() - half, rect.top() - half, hs, hs),
            'tr': QRect(rect.right() - half, rect.top() - half, hs, hs),
            'ml': QRect(rect.left() - half, rect.center().y() - half, hs, hs),
            'mr': QRect(rect.right() - half, rect.center().y() - half, hs, hs),
            'bl': QRect(rect.left() - half, rect.bottom() - half, hs, hs),
            'bm': QRect(rect.center().x() - half, rect.bottom() - half, hs, hs),
            'br': QRect(rect.right() - half, rect.bottom() - half, hs, hs),
        }
        return handles
    
    def _hit_handle(self, pos):
        """检测是否点击了手柄"""
        if self.state != self.STATE_SELECTED:
            return None
        handles = self._get_handles()
        for name, rect in handles.items():
            if rect.adjusted(-3, -3, 3, 3).contains(pos):
                return name
        return None
    
    def _get_handle_cursor(self, handle):
        """根据手柄获取光标样式"""
        cursor_map = {
            'tl': Qt.SizeFDiagCursor,
            'br': Qt.SizeFDiagCursor,
            'tr': Qt.SizeBDiagCursor,
            'bl': Qt.SizeBDiagCursor,
            'tm': Qt.SizeVerCursor,
            'bm': Qt.SizeVerCursor,
            'ml': Qt.SizeHorCursor,
            'mr': Qt.SizeHorCursor,
        }
        return cursor_map.get(handle, Qt.CrossCursor)
    
    # ==================== 鼠标事件 ====================
    
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            pos = event.pos()
            
            if self.state == self.STATE_IDLE:
                # 开始选择
                self.state = self.STATE_SELECTING
                self.select_start = pos
                self.select_end = pos
                self.magnifier.hide()
                
            elif self.state == self.STATE_SELECTED:
                # 检查是否点击了手柄
                handle = self._hit_handle(pos)
                if handle:
                    self.state = self.STATE_RESIZING
                    self.active_handle = handle
                    self.resize_start = pos
                    self.resize_rect = QRect(self.selection_rect)
                    return
                
                # 检查是否在选区内（移动）
                if self.selection_rect.contains(pos):
                    if self.current_tool:
                        # 有工具时开始绘图
                        self._start_drawing(pos)
                    else:
                        # 无工具时移动选区
                        self.state = self.STATE_MOVING
                        self.move_start = pos
                        self.move_rect_start = QRect(self.selection_rect)
                else:
                    # 点击选区外，重新选择
                    self.state = self.STATE_SELECTING
                    self.select_start = pos
                    self.select_end = pos
                    self.draw_items = []
                    self.undo_stack = []
                    self.toolbar.hide()
                    self.magnifier.hide()
            
            elif self.state == self.STATE_DRAWING:
                self._start_drawing(pos)
        
        elif event.button() == Qt.RightButton:
            if self.state == self.STATE_SELECTING:
                # 选择中右键取消选择
                self.state = self.STATE_IDLE
                self.selection_rect = QRect()
                self.magnifier.show()
                self.update()
            elif self.state == self.STATE_SELECTED:
                # 已选择状态右键取消选区
                self.state = self.STATE_IDLE
                self.selection_rect = QRect()
                self.draw_items = []
                self.undo_stack = []
                self.toolbar.hide()
                self.magnifier.show()
                self.update()
            else:
                self._cancel()
    
    def mouseMoveEvent(self, event):
        pos = event.pos()
        
        if self.state == self.STATE_IDLE:
            # 显示放大镜
            if not self.magnifier.isVisible():
                self.magnifier.show()
            self.magnifier.update_position(event.globalPos())
            
        elif self.state == self.STATE_SELECTING:
            self.select_end = pos
            self.selection_rect = self._get_selection_rect()
            self.update()
            
        elif self.state == self.STATE_SELECTED:
            # 更新光标
            handle = self._hit_handle(pos)
            if handle:
                self.setCursor(self._get_handle_cursor(handle))
            elif self.selection_rect.contains(pos):
                self.setCursor(Qt.SizeAllCursor if not self.current_tool else Qt.CrossCursor)
            else:
                self.setCursor(Qt.CrossCursor)
            
            # 显示放大镜（选区外）
            if not self.selection_rect.contains(pos):
                if not self.magnifier.isVisible():
                    self.magnifier.show()
                self.magnifier.update_position(event.globalPos())
            else:
                self.magnifier.hide()
            
        elif self.state == self.STATE_MOVING:
            delta = pos - self.move_start
            new_rect = self.move_rect_start.translated(delta)
            
            # 限制在屏幕内
            screen_rect = self.rect()
            if new_rect.left() < 0:
                new_rect.moveLeft(0)
            if new_rect.top() < 0:
                new_rect.moveTop(0)
            if new_rect.right() > screen_rect.right():
                new_rect.moveRight(screen_rect.right())
            if new_rect.bottom() > screen_rect.bottom():
                new_rect.moveBottom(screen_rect.bottom())
            
            self.selection_rect = new_rect
            self.select_start = new_rect.topLeft()
            self.select_end = new_rect.bottomRight()
            self._update_toolbar_position()
            self.update()
            
        elif self.state == self.STATE_RESIZING:
            self._do_resize(pos)
            self.update()
            
        elif self.state == self.STATE_DRAWING:
            if self.current_item:
                if isinstance(self.current_item, MosaicItem):
                    self.current_item.add_point(pos)
                else:
                    self.current_item.set_end(pos)
                self.update()
    
    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            pos = event.pos()
            
            if self.state == self.STATE_SELECTING:
                self.select_end = pos
                self.selection_rect = self._get_selection_rect()
                
                if self.selection_rect.width() > 3 and self.selection_rect.height() > 3:
                    self.state = self.STATE_SELECTED
                    self._show_toolbar()
                else:
                    self.state = self.STATE_IDLE
                    self.magnifier.show()
                self.update()
                
            elif self.state == self.STATE_MOVING:
                self.state = self.STATE_SELECTED
                self._update_toolbar_position()
                
            elif self.state == self.STATE_RESIZING:
                self.state = self.STATE_SELECTED
                self.active_handle = None
                self._update_toolbar_position()
                
            elif self.state == self.STATE_DRAWING:
                if self.current_item:
                    if isinstance(self.current_item, MosaicItem):
                        if len(self.current_item.points) > 0:
                            self.draw_items.append(self.current_item)
                            self.undo_stack = []
                    else:
                        dist = (self.current_item.end_point - self.current_item.start_point)
                        if dist.manhattanLength() > 3:
                            self.draw_items.append(self.current_item)
                            self.undo_stack = []
                    self.current_item = None
                self.state = self.STATE_SELECTED
                self.update()
    
    def mouseDoubleClickEvent(self, event):
        """双击完成截图"""
        if event.button() == Qt.LeftButton:
            if self.state == self.STATE_SELECTED:
                if self.selection_rect.contains(event.pos()):
                    self._finish()
    
    # ==================== 键盘事件 ====================
    
    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            if self.state == self.STATE_SELECTING:
                # 选择中按Esc取消选择
                self.state = self.STATE_IDLE
                self.selection_rect = QRect()
                self.magnifier.show()
                self.update()
            elif self.state == self.STATE_SELECTED or self.state == self.STATE_DRAWING:
                # 已选择/绘图状态按Esc取消选区
                self.state = self.STATE_IDLE
                self.selection_rect = QRect()
                self.draw_items = []
                self.undo_stack = []
                self.current_item = None
                self.toolbar.hide()
                self.magnifier.show()
                self.update()
            else:
                # 空闲状态按Esc退出
                self._cancel()
        elif event.key() == Qt.Key_Return or event.key() == Qt.Key_Enter:
            if self.state == self.STATE_SELECTED:
                self._finish()
        elif event.modifiers() == Qt.ControlModifier:
            if event.key() == Qt.Key_Z:
                self._undo()
            elif event.key() == Qt.Key_Y:
                self._redo()
            elif event.key() == Qt.Key_S:
                self._save()
            elif event.key() == Qt.Key_C:
                self._copy_to_clipboard()
    
    # ==================== 绘图 ====================
    
    def _start_drawing(self, pos):
        """开始绘图"""
        self.state = self.STATE_DRAWING
        color = self.toolbar.get_color()
        width = self.toolbar.get_width()
        
        if self.current_tool == "rect":
            self.current_item = RectItem(color, width)
            self.current_item.set_start(pos)
            self.current_item.set_end(pos)
        elif self.current_tool == "ellipse":
            self.current_item = EllipseItem(color, width)
            self.current_item.set_start(pos)
            self.current_item.set_end(pos)
        elif self.current_tool == "arrow":
            self.current_item = ArrowItem(color, width)
            self.current_item.set_start(pos)
            self.current_item.set_end(pos)
        elif self.current_tool == "line":
            self.current_item = LineItem(color, width)
            self.current_item.set_start(pos)
            self.current_item.set_end(pos)
        elif self.current_tool == "text":
            self._start_text_input(pos, color)
            self.state = self.STATE_SELECTED
        elif self.current_tool == "mosaic":
            self.current_item = MosaicItem(color, width, self.screen_pixmap)
            self.current_item.add_point(pos)
    
    def _start_text_input(self, pos, color):
        """开始文字输入"""
        if self.text_input:
            self.text_input.hide()
            self.text_input.deleteLater()
        
        self.text_input = TextInputWidget(pos, color, self)
        self.text_input.text_finished.connect(self._on_text_finished)
        self.text_input.show()
        self.text_input.setFocus()
    
    def _on_text_finished(self, text, pos):
        """文字输入完成"""
        if text:
            color = self.toolbar.get_color()
            item = TextItem(color, 1, text)
            item.set_start(pos)
            self.draw_items.append(item)
            self.undo_stack = []
            self.update()
        
        if self.text_input:
            self.text_input.deleteLater()
            self.text_input = None
    
    def _do_resize(self, pos):
        """调整选区大小"""
        rect = QRect(self.resize_rect)
        handle = self.active_handle
        
        if 'l' in handle:
            rect.setLeft(pos.x())
        if 'r' in handle:
            rect.setRight(pos.x())
        if 't' in handle:
            rect.setTop(pos.y())
        if 'b' in handle:
            rect.setBottom(pos.y())
        
        self.selection_rect = rect.normalized()
        self.select_start = self.selection_rect.topLeft()
        self.select_end = self.selection_rect.bottomRight()
        self._update_toolbar_position()
    
    # ==================== 工具栏 ====================
    
    def _show_toolbar(self):
        """显示工具栏"""
        self._update_toolbar_position()
        self.toolbar.show()
    
    def _update_toolbar_position(self):
        """更新工具栏位置"""
        rect = self.selection_rect
        toolbar_width = self.toolbar.sizeHint().width()
        
        # 默认在选区下方
        x = rect.left()
        y = rect.bottom() + 8
        
        # 如果下方空间不够，放在选区内底部
        if y + 40 > self.height():
            y = rect.bottom() - 44
        
        # 防止超出右边界
        if x + toolbar_width > self.width():
            x = self.width() - toolbar_width - 5
        
        if x < 0:
            x = 5
        
        self.toolbar.move(self.mapToGlobal(QPoint(x, y)))
        self.toolbar.adjustSize()
    
    # ==================== 槽函数 ====================
    
    def _on_tool_changed(self, tool_name):
        self.current_tool = tool_name
        if tool_name:
            self.setCursor(Qt.CrossCursor)
    
    def _on_color_changed(self, color):
        self.draw_color = color
    
    def _on_width_changed(self, width):
        self.draw_width = width
    
    def _undo(self):
        if self.draw_items:
            item = self.draw_items.pop()
            self.undo_stack.append(item)
            self.update()
    
    def _redo(self):
        if self.undo_stack:
            item = self.undo_stack.pop()
            self.draw_items.append(item)
            self.update()
    
    def _get_captured_image(self):
        """获取截图区域的图像"""
        rect = self.selection_rect
        if rect.isEmpty():
            return None
        
        # 创建绘图后的图像
        pixmap = self.screen_pixmap.copy(rect)
        
        if self.draw_items:
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            # 平移坐标到选区原点
            painter.translate(-rect.topLeft())
            for item in self.draw_items:
                item.draw(painter)
            painter.end()
        
        return pixmap
    
    def _save(self):
        """保存截图"""
        pixmap = self._get_captured_image()
        if not pixmap:
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存截图", 
            os.path.expanduser("~\\Desktop\\截图.png"),
            "PNG图片 (*.png);;JPEG图片 (*.jpg);;BMP图片 (*.bmp)"
        )
        
        if file_path:
            pixmap.save(file_path)
            self._close_all()
    
    def _copy_to_clipboard(self):
        """复制到剪贴板"""
        pixmap = self._get_captured_image()
        if pixmap:
            clipboard = QApplication.clipboard()
            clipboard.setPixmap(pixmap)
        self._close_all()
    
    def _pin(self):
        """钉在屏幕上"""
        pixmap = self._get_captured_image()
        if not pixmap:
            return
        
        # 创建置顶窗口显示截图
        pin_widget = QWidget()
        pin_widget.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        pin_widget.setAttribute(Qt.WA_TranslucentBackground)
        pin_widget.setFixedSize(pixmap.size())
        pin_widget.move(self.selection_rect.topLeft())
        
        # 保存引用防止被回收
        if not hasattr(self, '_pin_widgets'):
            self._pin_widgets = []
        self._pin_widgets.append(pin_widget)
        
        # 使用paintEvent绘制
        pin_widget.pixmap = pixmap
        pin_widget.paintEvent = lambda event, w=pin_widget: self._paint_pin(w, event)
        pin_widget.mousePressEvent = lambda event, w=pin_widget: w.close()
        
        pin_widget.show()
        self._close_all()
    
    def _paint_pin(self, widget, event):
        painter = QPainter(widget)
        painter.drawPixmap(0, 0, widget.pixmap)
        painter.end()
    
    def _finish(self):
        """完成截图（复制到剪贴板并关闭）"""
        self._copy_to_clipboard()
    
    def _cancel(self):
        """取消截图"""
        self._close_all()
    
    def _close_all(self):
        """关闭所有窗口"""
        self.magnifier.hide()
        self.magnifier.close()
        self.toolbar.hide()
        self.toolbar.close()
        if self.text_input:
            self.text_input.close()
        self.close()
        self.deleteLater()
    
    # ==================== 绘制 ====================
    
    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # 绘制屏幕截图作为背景
        painter.drawPixmap(0, 0, self.screen_pixmap)
        
        # 绘制半透明遮罩
        overlay_color = QColor(0, 0, 0, 100)
        
        if self.state == self.STATE_IDLE:
            # 全屏遮罩
            painter.fillRect(self.rect(), overlay_color)
            # 显示提示文字
            self._draw_hint_text(painter)
        else:
            # 选区外遮罩（用4个矩形绘制选区外的遮罩）
            sel = self.selection_rect
            full = self.rect()
            
            # 上方
            if sel.top() > 0:
                painter.fillRect(QRect(0, 0, full.width(), sel.top()), overlay_color)
            # 下方
            if sel.bottom() < full.height():
                painter.fillRect(QRect(0, sel.bottom() + 1, full.width(), 
                                      full.height() - sel.bottom() - 1), overlay_color)
            # 左侧
            if sel.left() > 0:
                painter.fillRect(QRect(0, sel.top(), sel.left(), sel.height()), overlay_color)
            # 右侧
            if sel.right() < full.width():
                painter.fillRect(QRect(sel.right() + 1, sel.top(), 
                                      full.width() - sel.right() - 1, sel.height()), overlay_color)
        
        # 绘制选区
        if self.state != self.STATE_IDLE and not self.selection_rect.isEmpty():
            self._draw_selection(painter)
        
        # 绘制绘图项
        if self.draw_items or self.current_item:
            painter.save()
            # 裁剪到选区
            if not self.selection_rect.isEmpty():
                painter.setClipRect(self.selection_rect)
            
            for item in self.draw_items:
                item.draw(painter)
            if self.current_item:
                self.current_item.draw(painter)
            
            painter.restore()
        
        painter.end()
    
    def _draw_hint_text(self, painter):
        """绘制提示文字（QQ风格）"""
        hint_text = "拖动鼠标选择截图区域"
        font = QFont("Microsoft YaHei", 11)
        painter.setFont(font)
        fm = painter.fontMetrics()
        text_width = fm.horizontalAdvance(hint_text)
        text_height = fm.height()
        
        # 在屏幕中央偏上显示
        x = (self.width() - text_width) // 2
        y = self.height() // 3
        
        # 绘制背景
        padding = 12
        bg_rect = QRect(x - padding, y - padding, 
                       text_width + padding * 2, text_height + padding * 2)
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(0, 0, 0, 160)))
        painter.drawRoundedRect(bg_rect, 6, 6)
        
        # 绘制文字
        painter.setPen(QColor(255, 255, 255, 220))
        painter.drawText(x, y + text_height - fm.descent(), hint_text)
    
    def _draw_selection(self, painter):
        """绘制选区边框和手柄"""
        rect = self.selection_rect
        
        # 绘制选区边框（QQ绿色）
        border_color = QColor(0, 174, 255)  # QQ蓝色边框
        painter.setPen(QPen(border_color, 2))
        painter.setBrush(Qt.NoBrush)
        painter.drawRect(rect)
        
        # 绘制尺寸信息
        size_text = f"{rect.width()} × {rect.height()}"
        font = QFont("Microsoft YaHei", 9)
        painter.setFont(font)
        
        # 文字背景
        fm = painter.fontMetrics()
        text_width = fm.horizontalAdvance(size_text) + 10
        text_height = fm.height() + 6
        
        text_x = rect.left()
        text_y = rect.top() - text_height - 4
        if text_y < 0:
            text_y = rect.top() + 4
        
        # 绘制文字背景
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(0, 0, 0, 180)))
        painter.drawRoundedRect(text_x, text_y, text_width, text_height, 3, 3)
        
        # 绘制文字
        painter.setPen(QColor(255, 255, 255))
        painter.drawText(text_x + 5, text_y + text_height - 5, size_text)
        
        # 绘制8个手柄
        if self.state == self.STATE_SELECTED:
            handles = self._get_handles()
            painter.setPen(QPen(border_color, 1))
            painter.setBrush(QBrush(QColor(255, 255, 255)))
            
            for name, handle_rect in handles.items():
                painter.drawRect(handle_rect)
                painter.fillRect(handle_rect, QColor(255, 255, 255))
                painter.setPen(QPen(border_color, 1))
                painter.drawRect(handle_rect)
