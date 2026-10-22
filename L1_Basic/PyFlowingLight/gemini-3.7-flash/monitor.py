"""
PY Flowing Light - Hardware Monitoring Thread
Asynchronously collects real-time CPU and Memory resource statistics.
"""

import time
import math
from typing import Dict, Any
from PyQt6.QtCore import QThread, pyqtSignal

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False


class SystemMonitorThread(QThread):
    """
    Background worker thread that periodically polls CPU and RAM metrics
    without blocking the GUI rendering event loop.
    """
    # Signal emits: (cpu_percent: float, ram_percent: float, details: dict)
    stats_updated = pyqtSignal(float, float, dict)

    def __init__(self, interval: float = 1.0):
        super().__init__()
        self._interval = max(0.2, interval)
        self._running = True
        self._sim_tick = 0

        # Initialize psutil CPU polling baseline if available
        if HAS_PSUTIL:
            try:
                psutil.cpu_percent(interval=None)
            except Exception:
                pass

    def set_interval(self, interval: float):
        """Updates the polling frequency interval."""
        self._interval = max(0.2, interval)

    def run(self):
        """Main monitoring loop running in the background thread."""
        while self._running:
            cpu_percent = 0.0
            ram_percent = 0.0
            details: Dict[str, Any] = {
                "cpu_count": 0,
                "cpu_freq": 0.0,
                "ram_used_gb": 0.0,
                "ram_total_gb": 0.0,
                "source": "psutil" if HAS_PSUTIL else "simulated"
            }

            if HAS_PSUTIL:
                try:
                    # psutil.cpu_percent(None) is non-blocking after the initial call
                    cpu_percent = float(psutil.cpu_percent(interval=None))
                    vm = psutil.virtual_memory()
                    ram_percent = float(vm.percent)

                    freq = psutil.cpu_freq()
                    details["cpu_count"] = psutil.cpu_count(logical=True) or 1
                    details["cpu_freq"] = round(freq.current / 1000.0, 2) if freq and freq.current else 0.0
                    details["ram_used_gb"] = round(vm.used / (1024 ** 3), 2)
                    details["ram_total_gb"] = round(vm.total / (1024 ** 3), 2)
                except Exception as e:
                    print(f"[SystemMonitorThread] psutil error: {e}")
                    cpu_percent = 25.0
                    ram_percent = 50.0
            else:
                # Deterministic smooth sine-wave fallback if psutil is unavailable
                self._sim_tick += 1
                cpu_percent = 28.0 + math.sin(self._sim_tick * 0.25) * 18.0 + (self._sim_tick % 5) * 2.5
                ram_percent = 55.0 + math.cos(self._sim_tick * 0.15) * 10.0
                cpu_percent = max(0.0, min(100.0, cpu_percent))
                ram_percent = max(0.0, min(100.0, ram_percent))

                details["cpu_count"] = 8
                details["cpu_freq"] = 3.6
                details["ram_used_gb"] = round(16.0 * (ram_percent / 100.0), 2)
                details["ram_total_gb"] = 16.0

            # Emit new statistics to GUI
            self.stats_updated.emit(cpu_percent, ram_percent, details)

            # Sleep in small slices to allow rapid thread termination
            sleep_chunks = int(self._interval * 10)
            for _ in range(max(1, sleep_chunks)):
                if not self._running:
                    break
                self.msleep(100)

    def stop(self):
        """Stops the monitoring thread safely."""
        self._running = False
        self.wait(2000)
