"""
PY Flowing Light - Desktop Liquid Glass System Resource Monitor
Main Application Entry Point.
"""

import sys
import signal
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import QApplication

from config import ConfigManager
from monitor import SystemMonitorThread
from floating_ball import FloatingBallWidget
from settings_dialog import SettingsDialog


def main():
    # Enable High DPI scaling
    if hasattr(Qt.ApplicationAttribute, "AA_EnableHighDpiScaling"):
        QApplication.setAttribute(Qt.ApplicationAttribute.AA_EnableHighDpiScaling, True)
    if hasattr(Qt.ApplicationAttribute, "AA_UseHighDpiPixmaps"):
        QApplication.setAttribute(Qt.ApplicationAttribute.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("PY Flowing Light")
    app.setOrganizationName("PyFlowingLight")

    # Handle Ctrl+C in terminal
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    # 1. Initialize Configuration
    cfg_mgr = ConfigManager()

    # 2. Initialize Floating Ball Widget
    ball = FloatingBallWidget(cfg_mgr)

    # 3. Initialize Asynchronous Hardware Monitor Thread
    monitor_interval = cfg_mgr.get("monitor_interval", 1.0)
    monitor_thread = SystemMonitorThread(interval=monitor_interval)
    monitor_thread.stats_updated.connect(ball.update_stats)
    monitor_thread.start()

    # 4. Settings Dialog (lazy initialized or persistent instance)
    settings_dlg = None

    def open_settings_dialog():
        nonlocal settings_dlg
        if settings_dlg is None:
            settings_dlg = SettingsDialog(cfg_mgr)
            settings_dlg.config_changed.connect(on_config_updated)
        settings_dlg.show()
        settings_dlg.raise_()
        settings_dlg.activateWindow()

    def on_config_updated():
        ball.apply_config_changes()
        new_interval = cfg_mgr.get("monitor_interval", 1.0)
        monitor_thread.set_interval(new_interval)

    ball.open_settings_requested.connect(open_settings_dialog)

    # Clean shutdown handling
    def cleanup():
        if monitor_thread.isRunning():
            monitor_thread.stop()
        cfg_mgr.save()

    app.aboutToQuit.connect(cleanup)

    # Show floating ball on desktop
    ball.show()

    # Start event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
