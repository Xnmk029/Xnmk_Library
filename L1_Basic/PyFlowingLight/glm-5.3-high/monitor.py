# -*- coding: utf-8 -*-
"""系统资源监控线程：每秒采样 CPU / 内存占用率，通过 Qt 信号发送到 UI 线程。

优先使用 psutil 真实读取；若 psutil 不可用则自动退化为平滑模拟数据源，
保证程序在任何环境都能运行。
"""

from __future__ import annotations

import random
import time

from PyQt6.QtCore import QThread, pyqtSignal

try:
    import psutil

    HAS_PSUTIL = True
except ImportError:  # pragma: no cover - 仅在缺少依赖时走该分支
    psutil = None
    HAS_PSUTIL = False


class MonitorWorker(QThread):
    """后台采样线程（QThread 的 run 循环），绝不阻塞 UI 主线程。"""

    updated = pyqtSignal(float, float)  # (cpu_percent, memory_percent)

    def __init__(self, interval: float = 1.0, parent=None) -> None:
        super().__init__(parent)
        self.setObjectName("MonitorWorker")
        self.interval = max(0.2, float(interval))
        self._running = True
        self._sim_cpu = 25.0
        self._sim_mem = 45.0

    def run(self) -> None:  # noqa: D102 - QThread 覆写
        if HAS_PSUTIL:
            # cpu_percent(interval=None) 首次调用返回 0，先预热一次
            try:
                psutil.cpu_percent(interval=None)
            except Exception:  # pragma: no cover - 防御性处理
                pass

        while self._running:
            cpu, mem = self._sample()
            self.updated.emit(cpu, mem)
            self._interruptible_sleep(self.interval)

    def stop(self) -> None:
        """请求线程退出并等待其结束。"""
        self._running = False
        self.wait(int((self.interval + 1.0) * 1000))

    # ------------------------------------------------------------------

    def _sample(self) -> tuple[float, float]:
        if HAS_PSUTIL:
            try:
                cpu = float(psutil.cpu_percent(interval=None))
                mem = float(psutil.virtual_memory().percent)
                return cpu, mem
            except Exception:  # pragma: no cover - psutil 异常时退化为模拟
                pass
        # 模拟数据源：带平滑随机游走，视觉上接近真实负载曲线
        self._sim_cpu += random.uniform(-8.0, 8.0)
        self._sim_mem += random.uniform(-2.0, 2.0)
        self._sim_cpu = min(95.0, max(3.0, self._sim_cpu))
        self._sim_mem = min(90.0, max(20.0, self._sim_mem))
        return self._sim_cpu, self._sim_mem

    def _interruptible_sleep(self, seconds: float) -> None:
        deadline = time.monotonic() + seconds
        while self._running and time.monotonic() < deadline:
            time.sleep(0.1)
