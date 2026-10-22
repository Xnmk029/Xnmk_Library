#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""后台线程轮询 CPU / 内存占用，不阻塞 UI 主线程。"""

from __future__ import annotations

from PyQt6.QtCore import QThread, pyqtSignal


class ResourceMonitor(QThread):
    """每秒采样一次系统占用率，通过信号回传到主线程。"""

    updated = pyqtSignal(float, float)
    failed = pyqtSignal(str)

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._running = True

    def stop(self) -> None:
        self._running = False

    def run(self) -> None:
        try:
            import psutil
        except ImportError:
            self.failed.emit("未安装 psutil，请执行: pip install psutil")
            return

        try:
            psutil.cpu_percent(interval=None)
        except Exception:
            pass

        while self._running:
            try:
                cpu = float(psutil.cpu_percent(interval=1.0))
                mem = float(psutil.virtual_memory().percent)
            except Exception:
                if not self._running:
                    break
                self.msleep(1000)
                continue
            if self._running:
                self.updated.emit(max(0.0, min(100.0, cpu)), max(0.0, min(100.0, mem)))
