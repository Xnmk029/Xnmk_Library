# -*- coding: utf-8 -*-
"""PY 流光：桌面 CPU / 内存悬浮球。

运行：python main.py
依赖：PyQt6、psutil（见 README.md / requirements.txt）
"""

from __future__ import annotations

import sys

from PyQt6.QtWidgets import QApplication

from ball_widget import FlowingBall
from config import Settings, load_settings, save_settings
from monitor import MonitorWorker
from settings_dialog import SettingsDialog

APP_NAME = "PY 流光"


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setQuitOnLastWindowClosed(True)

    settings: Settings = load_settings()
    monitor = MonitorWorker(interval=1.0)

    ball = FlowingBall(settings, monitor)
    dialog_ref: dict[str, SettingsDialog | None] = {"dlg": None}

    def apply_and_save(new_settings: Settings) -> None:
        ball.apply_settings(new_settings)
        save_settings(new_settings)

    def open_settings() -> None:
        dlg = dialog_ref["dlg"]
        if dlg is None:
            dlg = SettingsDialog(ball.current_settings(), ball)
            dlg.settings_changed.connect(apply_and_save)
            dialog_ref["dlg"] = dlg
        dlg.show()
        dlg.raise_()
        dlg.activateWindow()

    # 拖动结束后保存位置
    ball.settings_applied.connect(save_settings)
    ball.settings_requested.connect(open_settings)

    monitor.start()
    ball.place_to_saved_or_default()
    ball.show()

    ret = app.exec()

    monitor.stop()
    save_settings(ball.saved_position_settings())
    return ret


if __name__ == "__main__":
    sys.exit(main())
