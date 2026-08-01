import sys
import ctypes
import threading
from PyQt5.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QAction
from PyQt5.QtGui import QIcon, QPixmap, QPainter, QColor, QPen
from PyQt5.QtCore import Qt, pyqtSignal, QObject
from pynput import keyboard
from capture_widget import CaptureWidget

# 设置DPI感知
if hasattr(ctypes, 'windll'):
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        pass


class HotkeySignal(QObject):
    """用于跨线程触发截图的信号"""
    triggered = pyqtSignal()


def create_tray_icon():
    """创建托盘图标"""
    # 生成一个简单的剪刀图标
    pixmap = QPixmap(32, 32)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)
    painter.setPen(QPen(QColor(0, 150, 255), 2))
    # 画一个截图图标（虚线矩形+剪刀）
    painter.drawRect(4, 6, 24, 18)
    painter.setPen(QPen(QColor(0, 150, 255), 2, Qt.DashLine))
    painter.drawRect(8, 10, 16, 10)
    painter.end()
    
    icon = QIcon(pixmap)
    tray = QSystemTrayIcon(icon)
    tray.setToolTip("QQ截图工具 (Ctrl+Alt+A)")
    
    menu = QMenu()
    action_capture = QAction("截图 (Ctrl+Alt+A)", menu)
    action_quit = QAction("退出", menu)
    menu.addAction(action_capture)
    menu.addSeparator()
    menu.addAction(action_quit)
    
    tray.setContextMenu(menu)
    return tray, action_capture, action_quit


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setApplicationName("QQ截图工具")
    
    # 热键信号
    hotkey_signal = HotkeySignal()
    
    capture_window = [None]  # 使用列表以便在闭包中修改
    
    def start_capture():
        """启动截图"""
        if capture_window[0] is not None:
            return
        capture_window[0] = CaptureWidget()
        capture_window[0].destroyed.connect(lambda: capture_window.__setitem__(0, None))
        capture_window[0].show()
    
    hotkey_signal.triggered.connect(start_capture)
    
    # 创建托盘
    tray, action_capture, action_quit = create_tray_icon()
    tray.show()
    action_capture.triggered.connect(start_capture)
    action_quit.triggered.connect(app.quit)
    
    # 全局热键监听 (Ctrl+Alt+A)
    def on_hotkey():
        hotkey_signal.triggered.emit()
    
    hotkey_listener = keyboard.GlobalHotKeys({
        '<ctrl>+<alt>+a': on_hotkey,
    })
    hotkey_listener.daemon = True
    hotkey_listener.start()
    
    # 启动时自动开始截图
    start_capture()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()
