#!/usr/bin/env python3
"""
RAC Telemetry Logger & Lap Comparison Tool (OutGauge Protocol)
==============================================================
Real-time OutGauge UDP telemetry receiver (BeamNG / rFactor compatible),
distance-based lap alignment, and interactive multi-lap comparison.

Protocol: OutGauge binary struct, default 127.0.0.1:4444
Dependencies: numpy, matplotlib (tkinter is stdlib)
Usage:
    python rac_telemetry_tool.py                  # listen on :4444, no mock
    python rac_telemetry_tool.py --mock           # with built-in mock sender
    python rac_telemetry_tool.py --port 4444      # custom port
"""

import sys
import os
import time
import math
import struct
import socket
import queue
import threading
import csv
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple, Dict

import numpy as np

import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)-7s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("RAC-Telemetry")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_PORT = 4444
MOCK_INTERVAL_S = 0.020  # 20 ms
CSV_DIR = Path("telemetry_logs")
RESAMPLE_POINTS = 2000  # interpolation grid density
SPEED_ZERO_TIMEOUT = 3.0  # seconds of zero speed => car reset => new lap

# OutGauge packet struct formats (little-endian)
# Packed layout (no alignment padding) = 94 bytes
OUTGAUGE_FMT_PACKED = "<I4sHfffffffIIfff16s16si"
OUTGAUGE_SIZE_PACKED = struct.calcsize(OUTGAUGE_FMT_PACKED)  # 94
# Aligned layout (2-byte pad after flags) = 96 bytes
OUTGAUGE_FMT_ALIGNED = "<I4sHxxfffffffIIfff16s16si"
OUTGAUGE_SIZE_ALIGNED = struct.calcsize(OUTGAUGE_FMT_ALIGNED)  # 96

# Industrial dark palette
CLR_BG = "#1a1a2e"
CLR_PANEL = "#16213e"
CLR_ACCENT_A = "#00d4ff"
CLR_ACCENT_B = "#ff4757"
CLR_THROTTLE = "#2ed573"
CLR_BRAKE = "#ff6348"
CLR_GRID = "#2f3542"
CLR_TEXT = "#dfe4ea"
CLR_CROSSHAIR = "#ffa502"

plt.rcParams.update({
    "figure.facecolor": CLR_BG,
    "axes.facecolor": CLR_BG,
    "axes.edgecolor": CLR_GRID,
    "axes.labelcolor": CLR_TEXT,
    "text.color": CLR_TEXT,
    "xtick.color": CLR_TEXT,
    "ytick.color": CLR_TEXT,
    "grid.color": CLR_GRID,
    "grid.alpha": 0.4,
    "font.family": "monospace",
    "font.size": 9,
})


# ===========================================================================
# OutGauge Packet Parser
# ===========================================================================
class OutGaugeFrame:
    """Parsed OutGauge telemetry frame."""
    __slots__ = ("time_ms", "flags", "speed_ms", "rpm", "turbo",
                 "engtemp", "fuel", "oilpressure", "oiltemp",
                 "dashlights", "showlights", "throttle", "brake", "clutch")

    def __init__(self):
        self.time_ms: int = 0
        self.flags: int = 0
        self.speed_ms: float = 0.0
        self.rpm: float = 0.0
        self.turbo: float = 0.0
        self.engtemp: float = 0.0
        self.fuel: float = 0.0
        self.oilpressure: float = 0.0
        self.oiltemp: float = 0.0
        self.dashlights: int = 0
        self.showlights: int = 0
        self.throttle: float = 0.0
        self.brake: float = 0.0
        self.clutch: float = 0.0

    @property
    def speed_kmh(self) -> float:
        return self.speed_ms * 3.6


def parse_outgauge(data: bytes) -> Optional[OutGaugeFrame]:
    """
    Parse a raw OutGauge UDP packet.
    Handles both packed (94B) and aligned (96B) struct layouts.
    Returns None if packet is malformed.
    """
    n = len(data)
    try:
        if n == OUTGAUGE_SIZE_ALIGNED:
            vals = struct.unpack(OUTGAUGE_FMT_ALIGNED, data)
        elif n == OUTGAUGE_SIZE_PACKED:
            vals = struct.unpack(OUTGAUGE_FMT_PACKED, data)
        else:
            return None
    except struct.error:
        return None

    frame = OutGaugeFrame()
    frame.time_ms = vals[0]
    # vals[1] = id[4], skip
    frame.flags = vals[2]
    frame.speed_ms = vals[3]
    frame.rpm = vals[4]
    frame.turbo = vals[5]
    frame.engtemp = vals[6]
    frame.fuel = vals[7]
    frame.oilpressure = vals[8]
    frame.oiltemp = vals[9]
    frame.dashlights = vals[10]
    frame.showlights = vals[11]
    frame.throttle = vals[12]
    frame.brake = vals[13]
    frame.clutch = vals[14]
    # vals[15], vals[16] = display strings, vals[17] = id2, skip
    return frame


# ===========================================================================
# 1. Mock Telemetry Sender (OutGauge Binary)
# ===========================================================================
class MockTelemetrySender(threading.Thread):
    """Simulates BeamNG OutGauge output over UDP (binary struct)."""

    def __init__(self, port: int, interval: float = MOCK_INTERVAL_S):
        super().__init__(daemon=True, name="MockSender")
        self._port = port
        self._interval = interval
        self._stop_event = threading.Event()
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._t0 = time.perf_counter()
        self._time_ms = 0
        self._phase = 0.0
        self._lap_length = 2200.0
        self._distance = 0.0

    def stop(self):
        self._stop_event.set()

    def _build_packet(self) -> bytes:
        """Generate one OutGauge binary packet."""
        self._time_ms += int(self._interval * 1000)

        # Speed pattern (m/s): simulate corners and straights
        base = 38.0  # ~137 km/h
        speed_ms = base + 16.0 * math.sin(self._phase * 2.1) \
                   + 7.0 * math.sin(self._phase * 5.7) \
                   + 3.0 * math.sin(self._phase * 11.3)
        speed_ms = max(11.0, min(89.0, speed_ms))  # 40-320 km/h

        # Throttle/Brake from speed derivative
        speed_next = base + 16.0 * math.sin((self._phase + 0.02) * 2.1) \
                     + 7.0 * math.sin((self._phase + 0.02) * 5.7) \
                     + 3.0 * math.sin((self._phase + 0.02) * 11.3)
        accel = speed_next - speed_ms

        if accel >= 0:
            throttle = min(1.0, 0.4 + accel * 0.4)
            brake = 0.0
        else:
            throttle = 0.0
            brake = min(1.0, abs(accel) * 0.35)

        self._distance += speed_ms * self._interval
        self._phase += self._interval * (speed_ms / 28.0)

        # Lap reset
        if self._distance >= self._lap_length:
            self._distance = 0.0
            self._time_ms = 0  # simulate game time reset

        rpm = 2000.0 + speed_ms * 80.0 + throttle * 1500.0

        # Pack as aligned OutGauge struct (96 bytes)
        packet = struct.pack(
            OUTGAUGE_FMT_ALIGNED,
            self._time_ms,          # time
            b"MOCK",                # id
            0,                      # flags
            speed_ms,               # speed (m/s)
            rpm,                    # rpm
            throttle * 1.2,         # turbo (BAR)
            85.0 + speed_ms * 0.2,  # engtemp
            max(0.0, 1.0 - self._distance / self._lap_length),  # fuel
            4.5,                    # oilpressure
            95.0,                   # oiltemp
            0,                      # dashlights
            0,                      # showlights
            throttle,               # throttle
            brake,                  # brake
            0.0,                    # clutch
            b"",                    # display1
            b"",                    # display2
            0,                      # id2
        )
        return packet

    def run(self):
        log.info("MockSender (OutGauge) -> 127.0.0.1:%d @ %.0f Hz",
                 self._port, 1.0 / self._interval)
        addr = ("127.0.0.1", self._port)
        while not self._stop_event.is_set():
            packet = self._build_packet()
            try:
                self._sock.sendto(packet, addr)
            except OSError:
                break
            self._stop_event.wait(self._interval)
        self._sock.close()
        log.info("MockSender stopped.")


# ===========================================================================
# 2. UDP Receiver (OutGauge Binary, Non-blocking)
# ===========================================================================
class UDPReceiver(threading.Thread):
    """Non-blocking UDP listener for OutGauge packets -> thread-safe queue."""

    def __init__(self, port: int, data_queue: queue.Queue):
        super().__init__(daemon=True, name="UDPReceiver")
        self._port = port
        self._queue = data_queue
        self._stop_event = threading.Event()
        self._sock: Optional[socket.socket] = None

    def stop(self):
        self._stop_event.set()
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass

    def run(self):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            self._sock.bind(("0.0.0.0", self._port))
        except OSError as e:
            log.error("Cannot bind UDP port %d: %s", self._port, e)
            return
        self._sock.settimeout(0.1)
        log.info("UDPReceiver listening on 0.0.0.0:%d (OutGauge)", self._port)

        while not self._stop_event.is_set():
            try:
                data, _ = self._sock.recvfrom(512)
            except socket.timeout:
                continue
            except OSError:
                break

            frame = parse_outgauge(data)
            if frame is not None:
                try:
                    self._queue.put_nowait(frame)
                except queue.Full:
                    pass  # drop frame if consumer is too slow

        try:
            self._sock.close()
        except OSError:
            pass
        log.info("UDPReceiver stopped.")


# ===========================================================================
# 3. Data Recorder (Distance Integration + Lap Detection + CSV)
# ===========================================================================
class LapData:
    """Container for a single lap's telemetry arrays."""

    def __init__(self):
        self.timestamp: List[float] = []
        self.distance: List[float] = []
        self.speed: List[float] = []  # km/h
        self.throttle: List[float] = []
        self.brake: List[float] = []

    @property
    def length(self) -> int:
        return len(self.distance)

    @property
    def max_distance(self) -> float:
        return max(self.distance) if self.distance else 0.0

    def to_arrays(self) -> Dict[str, np.ndarray]:
        return {
            "timestamp": np.array(self.timestamp, dtype=np.float64),
            "distance": np.array(self.distance, dtype=np.float64),
            "speed": np.array(self.speed, dtype=np.float64),
            "throttle": np.array(self.throttle, dtype=np.float64),
            "brake": np.array(self.brake, dtype=np.float64),
        }

    @classmethod
    def from_csv(cls, path: str) -> "LapData":
        """Load lap data from a CSV file."""
        lap = cls()
        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    lap.timestamp.append(float(row["timestamp"]))
                    lap.distance.append(float(row["distance"]))
                    lap.speed.append(float(row["speed"]))
                    lap.throttle.append(float(row["throttle"]))
                    lap.brake.append(float(row["brake"]))
                except (KeyError, ValueError):
                    continue
        return lap


class DataRecorder:
    """
    Consumes OutGauge frames, integrates speed->distance,
    detects lap boundaries, and persists CSV.
    """

    def __init__(self, data_queue: queue.Queue, csv_dir: Path):
        self._queue = data_queue
        self._csv_dir = csv_dir
        self._csv_dir.mkdir(parents=True, exist_ok=True)
        self._current_lap = LapData()
        self._saved_laps: List[str] = []
        self._lock = threading.Lock()
        self._on_lap_complete = None
        self._on_frame = None

        # Distance integration state
        self._distance = 0.0
        self._last_time_ms: Optional[int] = None
        self._last_wall_time: Optional[float] = None

        # Lap reset detection: game time field drop
        self._last_game_time_ms: int = 0

        # Zero-speed timeout detection
        self._zero_speed_since: Optional[float] = None

    def set_callbacks(self, on_lap_complete=None, on_frame=None):
        self._on_lap_complete = on_lap_complete
        self._on_frame = on_frame

    @property
    def current_lap(self) -> LapData:
        with self._lock:
            return self._current_lap

    @property
    def saved_laps(self) -> List[str]:
        return list(self._saved_laps)

    @property
    def current_distance(self) -> float:
        return self._distance

    def process_frames(self, max_batch: int = 200) -> int:
        """Drain queue and process frames. Returns count processed."""
        count = 0
        while count < max_batch:
            try:
                frame = self._queue.get_nowait()
            except queue.Empty:
                break
            self._ingest(frame)
            count += 1
        return count

    def _ingest(self, frame: OutGaugeFrame):
        now_wall = time.perf_counter()

        # --- Lap reset detection via game time field ---
        # OutGauge time_ms resets when car is reset in BeamNG
        if self._last_game_time_ms > 0 and frame.time_ms < self._last_game_time_ms - 1000:
            if self._current_lap.length > 50:
                self._save_current_lap()
            self._distance = 0.0
            self._last_time_ms = None

        # --- Zero-speed timeout detection (car stopped / reset) ---
        if frame.speed_ms < 0.5:
            if self._zero_speed_since is None:
                self._zero_speed_since = now_wall
            elif now_wall - self._zero_speed_since > SPEED_ZERO_TIMEOUT:
                if self._current_lap.length > 50:
                    self._save_current_lap()
                    self._distance = 0.0
                    self._last_time_ms = None
                self._zero_speed_since = None
        else:
            self._zero_speed_since = None

        self._last_game_time_ms = frame.time_ms

        # --- Distance integration (trapezoidal) ---
        if self._last_time_ms is not None:
            dt_ms = frame.time_ms - self._last_time_ms
            if 0 < dt_ms < 500:  # sanity: 0-500ms between frames
                dt_s = dt_ms / 1000.0
                self._distance += frame.speed_ms * dt_s
            elif dt_ms <= 0:
                # Fallback to wall clock if game time wraps oddly
                if self._last_wall_time is not None:
                    dt_wall = now_wall - self._last_wall_time
                    if 0 < dt_wall < 0.5:
                        self._distance += frame.speed_ms * dt_wall
        self._last_time_ms = frame.time_ms
        self._last_wall_time = now_wall

        # --- Append to current lap ---
        with self._lock:
            self._current_lap.timestamp.append(now_wall)
            self._current_lap.distance.append(self._distance)
            self._current_lap.speed.append(frame.speed_kmh)
            self._current_lap.throttle.append(frame.throttle)
            self._current_lap.brake.append(frame.brake)

        # Notify UI
        if self._on_frame:
            self._on_frame({
                "distance": self._distance,
                "speed": frame.speed_kmh,
                "throttle": frame.throttle,
                "brake": frame.brake,
                "rpm": frame.rpm,
            })

    def _save_current_lap(self):
        with self._lock:
            lap = self._current_lap
            self._current_lap = LapData()

        if lap.length < 10:
            return

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"lap_{ts}.csv"
        filepath = self._csv_dir / filename

        try:
            with open(filepath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "distance", "speed", "throttle", "brake"])
                # Normalize timestamp to lap-relative seconds
                t0 = lap.timestamp[0]
                for i in range(lap.length):
                    writer.writerow([
                        f"{lap.timestamp[i] - t0:.6f}",
                        f"{lap.distance[i]:.3f}",
                        f"{lap.speed[i]:.2f}",
                        f"{lap.throttle[i]:.4f}",
                        f"{lap.brake[i]:.4f}",
                    ])
            self._saved_laps.append(str(filepath))
            log.info("Lap saved: %s (%d samples, %.0f m)",
                     filename, lap.length, lap.max_distance)
            if self._on_lap_complete:
                self._on_lap_complete(str(filepath))
        except OSError as e:
            log.error("Failed to save lap CSV: %s", e)

    def force_save(self):
        """Manually trigger lap save."""
        if self._current_lap.length > 10:
            self._save_current_lap()
            self._distance = 0.0
            self._last_time_ms = None


# ===========================================================================
# 4. Distance-based Alignment & Resampling
# ===========================================================================
def resample_by_distance(lap: LapData, n_points: int = RESAMPLE_POINTS
                         ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Resample lap data onto a uniform distance grid.
    Returns: (dist_grid, speed, throttle, brake) arrays of length n_points.
    """
    arrays = lap.to_arrays()
    d = arrays["distance"]
    if len(d) < 2:
        empty = np.zeros(n_points)
        return empty, empty.copy(), empty.copy(), empty.copy()

    # Ensure strictly monotonically increasing distance
    mask = np.ones(len(d), dtype=bool)
    for i in range(1, len(d)):
        if d[i] <= d[i - 1]:
            mask[i] = False
    d_clean = d[mask]
    spd_clean = arrays["speed"][mask]
    thr_clean = arrays["throttle"][mask]
    brk_clean = arrays["brake"][mask]

    if len(d_clean) < 2:
        empty = np.zeros(n_points)
        return empty, empty.copy(), empty.copy(), empty.copy()

    d_grid = np.linspace(d_clean[0], d_clean[-1], n_points)
    speed_interp = np.interp(d_grid, d_clean, spd_clean)
    throttle_interp = np.interp(d_grid, d_clean, thr_clean)
    brake_interp = np.interp(d_grid, d_clean, brk_clean)

    return d_grid, speed_interp, throttle_interp, brake_interp


def align_two_laps(lap_a: LapData, lap_b: LapData, n_points: int = RESAMPLE_POINTS
                   ) -> Tuple[np.ndarray, dict, dict]:
    """
    Align two laps on a common distance grid (intersection of ranges).
    Returns: (common_grid, data_a_dict, data_b_dict)
    """
    da, sa, ta, ba = resample_by_distance(lap_a, n_points)
    db, sb, tb, bb = resample_by_distance(lap_b, n_points)

    d_min = max(da[0], db[0])
    d_max = min(da[-1], db[-1])

    if d_max <= d_min:
        empty = np.zeros(n_points)
        return empty, \
               {"speed": empty.copy(), "throttle": empty.copy(), "brake": empty.copy()}, \
               {"speed": empty.copy(), "throttle": empty.copy(), "brake": empty.copy()}

    common_grid = np.linspace(d_min, d_max, n_points)

    data_a = {
        "speed": np.interp(common_grid, da, sa),
        "throttle": np.interp(common_grid, da, ta),
        "brake": np.interp(common_grid, da, ba),
    }
    data_b = {
        "speed": np.interp(common_grid, db, sb),
        "throttle": np.interp(common_grid, db, tb),
        "brake": np.interp(common_grid, db, bb),
    }
    return common_grid, data_a, data_b


# ===========================================================================
# 5. Interactive Visualization (Tkinter + Matplotlib)
# ===========================================================================
class TelemetryApp:
    """Main application: real-time OutGauge plot + lap comparison."""

    def __init__(self, port: int, enable_mock: bool):
        self._port = port
        self._enable_mock = enable_mock

        self._data_queue: queue.Queue = queue.Queue(maxsize=10000)
        self._receiver: Optional[UDPReceiver] = None
        self._mock_sender: Optional[MockTelemetrySender] = None
        self._recorder = DataRecorder(self._data_queue, CSV_DIR)
        self._running = True

        self._lap_a: Optional[LapData] = None
        self._lap_b: Optional[LapData] = None
        self._lap_a_label = "Lap A"
        self._lap_b_label = "Lap B"

        # Live ring buffer
        self._live_distance: List[float] = []
        self._live_speed: List[float] = []
        self._live_throttle: List[float] = []
        self._live_brake: List[float] = []
        self._live_max_points = 4000

        self._build_ui()

        self._recorder.set_callbacks(
            on_lap_complete=self._on_lap_saved,
            on_frame=self._on_frame_received,
        )

        self._start_threads()
        self._poll_data()

    # -----------------------------------------------------------------------
    # UI
    # -----------------------------------------------------------------------
    def _build_ui(self):
        self.root = tk.Tk()
        self.root.title("RAC Telemetry - OutGauge Lap Comparison")
        self.root.configure(bg=CLR_BG)
        self.root.geometry("1320x880")
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background=CLR_BG)
        style.configure("TLabel", background=CLR_BG, foreground=CLR_TEXT,
                        font=("Consolas", 9))
        style.configure("TButton", font=("Consolas", 9))
        style.configure("Header.TLabel", font=("Consolas", 11, "bold"),
                        foreground=CLR_ACCENT_A)

        # --- Toolbar ---
        toolbar = ttk.Frame(self.root)
        toolbar.pack(side=tk.TOP, fill=tk.X, padx=6, pady=(6, 2))

        ttk.Label(toolbar, text="RAC TELEMETRY [OutGauge]",
                  style="Header.TLabel").pack(side=tk.LEFT)

        self._status_var = tk.StringVar(value="IDLE")
        ttk.Label(toolbar, textvariable=self._status_var).pack(side=tk.LEFT, padx=16)

        self._frame_count_var = tk.StringVar(value="Frames: 0")
        ttk.Label(toolbar, textvariable=self._frame_count_var).pack(side=tk.LEFT, padx=8)

        self._dist_var = tk.StringVar(value="Dist: 0 m")
        ttk.Label(toolbar, textvariable=self._dist_var).pack(side=tk.LEFT, padx=8)

        ttk.Button(toolbar, text="Save Lap [S]",
                   command=self._manual_save).pack(side=tk.RIGHT, padx=4)
        ttk.Button(toolbar, text="Load Lap A",
                   command=lambda: self._load_lap("A")).pack(side=tk.RIGHT, padx=4)
        ttk.Button(toolbar, text="Load Lap B",
                   command=lambda: self._load_lap("B")).pack(side=tk.RIGHT, padx=4)
        ttk.Button(toolbar, text="Clear",
                   command=self._clear_comparison).pack(side=tk.RIGHT, padx=4)

        # --- Figure ---
        self._fig = Figure(figsize=(13, 8.5), dpi=100, facecolor=CLR_BG)
        self._fig.subplots_adjust(left=0.06, right=0.97, top=0.94, bottom=0.06,
                                  hspace=0.28)

        self._ax_speed = self._fig.add_subplot(2, 1, 1)
        self._ax_pedals = self._fig.add_subplot(2, 1, 2, sharex=self._ax_speed)
        self._setup_axes()

        self._canvas = FigureCanvasTkAgg(self._fig, master=self.root)
        self._canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True,
                                          padx=6, pady=4)

        # Crosshair
        self._crosshair_lines = []
        self._crosshair_label = None
        self._canvas.mpl_connect("motion_notify_event", self._on_mouse_move)
        self._canvas.mpl_connect("axes_leave_event", self._on_mouse_leave)

        # --- Status bar ---
        self._info_var = tk.StringVar(
            value=f"Listening on UDP :{self._port} (OutGauge). Waiting for data...")
        ttk.Label(self.root, textvariable=self._info_var,
                  anchor=tk.W).pack(side=tk.BOTTOM, fill=tk.X, padx=6, pady=2)

        # Shortcuts
        self.root.bind("s", lambda e: self._manual_save())
        self.root.bind("q", lambda e: self._on_close())

        # Line refs
        self._line_live_speed = None
        self._line_live_thr = None
        self._line_live_brk = None
        self._line_a_speed = None
        self._line_b_speed = None
        self._line_a_thr = None
        self._line_b_thr = None
        self._line_a_brk = None
        self._line_b_brk = None
        self._total_frames = 0

    def _setup_axes(self):
        for ax, ylabel, title in [
            (self._ax_speed, "Speed (km/h)", "Speed vs Distance"),
            (self._ax_pedals, "Pedal (0-1)", "Throttle / Brake vs Distance"),
        ]:
            ax.set_facecolor(CLR_BG)
            ax.set_ylabel(ylabel)
            ax.set_title(title, color=CLR_TEXT, fontsize=10, loc="left")
            ax.grid(True, linewidth=0.5)
            ax.tick_params(labelsize=8)
        self._ax_pedals.set_xlabel("Distance (m)")
        self._ax_pedals.set_ylim(-0.05, 1.1)

    # -----------------------------------------------------------------------
    # Threading
    # -----------------------------------------------------------------------
    def _start_threads(self):
        self._receiver = UDPReceiver(self._port, self._data_queue)
        self._receiver.start()

        if self._enable_mock:
            self._mock_sender = MockTelemetrySender(self._port)
            self._mock_sender.start()
            self._status_var.set("RECEIVING (Mock OutGauge)")
        else:
            self._status_var.set(f"LISTENING :{self._port}")

    # -----------------------------------------------------------------------
    # Polling
    # -----------------------------------------------------------------------
    def _poll_data(self):
        if not self._running:
            return

        n = self._recorder.process_frames(max_batch=500)
        if n > 0:
            self._total_frames += n
            self._frame_count_var.set(f"Frames: {self._total_frames}")
            self._dist_var.set(f"Dist: {self._recorder.current_distance:.0f} m")
            self._update_live_plot()

        self.root.after(33, self._poll_data)

    def _on_frame_received(self, frame: dict):
        self._live_distance.append(frame["distance"])
        self._live_speed.append(frame["speed"])
        self._live_throttle.append(frame["throttle"])
        self._live_brake.append(frame["brake"])

        if len(self._live_distance) > self._live_max_points:
            trim = len(self._live_distance) - self._live_max_points
            self._live_distance = self._live_distance[trim:]
            self._live_speed = self._live_speed[trim:]
            self._live_throttle = self._live_throttle[trim:]
            self._live_brake = self._live_brake[trim:]

    def _on_lap_saved(self, path: str):
        self._info_var.set(f"Lap saved: {path}")
        # Clear live buffer for fresh lap
        self._live_distance.clear()
        self._live_speed.clear()
        self._live_throttle.clear()
        self._live_brake.clear()
        # Auto-load as Lap A if empty
        if self._lap_a is None:
            self._lap_a = LapData.from_csv(path)
            self._lap_a_label = Path(path).stem
            self._draw_comparison()

    # -----------------------------------------------------------------------
    # Plotting
    # -----------------------------------------------------------------------
    def _update_live_plot(self):
        ax_s = self._ax_speed
        ax_p = self._ax_pedals

        for attr in ("_line_live_speed", "_line_live_thr", "_line_live_brk"):
            line = getattr(self, attr, None)
            if line:
                line.remove()
                setattr(self, attr, None)

        if len(self._live_distance) > 1:
            d = self._live_distance
            self._line_live_speed, = ax_s.plot(
                d, self._live_speed, color=CLR_ACCENT_A, linewidth=1.0,
                alpha=0.85, label="Live")
            self._line_live_thr, = ax_p.plot(
                d, self._live_throttle, color=CLR_THROTTLE, linewidth=0.9,
                alpha=0.85, label="Throttle")
            self._line_live_brk, = ax_p.plot(
                d, self._live_brake, color=CLR_BRAKE, linewidth=0.9,
                alpha=0.85, label="Brake")
            ax_s.set_xlim(min(d), max(d))
            ax_s.set_ylim(0, max(self._live_speed) * 1.15 + 10)

        ax_s.legend(loc="upper right", fontsize=8, facecolor=CLR_PANEL,
                    edgecolor=CLR_GRID, labelcolor=CLR_TEXT)
        ax_p.legend(loc="upper right", fontsize=8, facecolor=CLR_PANEL,
                    edgecolor=CLR_GRID, labelcolor=CLR_TEXT)
        self._canvas.draw_idle()

    def _draw_comparison(self):
        for attr in ("_line_a_speed", "_line_b_speed",
                     "_line_a_thr", "_line_b_thr",
                     "_line_a_brk", "_line_b_brk"):
            line = getattr(self, attr, None)
            if line:
                line.remove()
                setattr(self, attr, None)

        if self._lap_a is None and self._lap_b is None:
            self._canvas.draw_idle()
            return

        if self._lap_a and self._lap_b:
            grid, da, db = align_two_laps(self._lap_a, self._lap_b)

            self._line_a_speed, = self._ax_speed.plot(
                grid, da["speed"], color=CLR_ACCENT_A, linewidth=1.4,
                label=self._lap_a_label)
            self._line_b_speed, = self._ax_speed.plot(
                grid, db["speed"], color=CLR_ACCENT_B, linewidth=1.4,
                label=self._lap_b_label)
            self._line_a_thr, = self._ax_pedals.plot(
                grid, da["throttle"], color=CLR_ACCENT_A, linewidth=1.0,
                linestyle="-", label=f"{self._lap_a_label} Thr")
            self._line_b_thr, = self._ax_pedals.plot(
                grid, db["throttle"], color=CLR_ACCENT_B, linewidth=1.0,
                linestyle="-", label=f"{self._lap_b_label} Thr")
            self._line_a_brk, = self._ax_pedals.plot(
                grid, da["brake"], color=CLR_ACCENT_A, linewidth=1.0,
                linestyle="--", label=f"{self._lap_a_label} Brk")
            self._line_b_brk, = self._ax_pedals.plot(
                grid, db["brake"], color=CLR_ACCENT_B, linewidth=1.0,
                linestyle="--", label=f"{self._lap_b_label} Brk")

            self._ax_speed.set_xlim(grid[0], grid[-1])
            all_spd = np.concatenate([da["speed"], db["speed"]])
            self._ax_speed.set_ylim(0, float(np.max(all_spd)) * 1.12 + 10)
            self._info_var.set(
                f"Comparing: {self._lap_a_label} vs {self._lap_b_label} | "
                f"Grid: {grid[0]:.0f}-{grid[-1]:.0f} m ({len(grid)} pts)")

        elif self._lap_a:
            da_d, da_s, da_t, da_b = resample_by_distance(self._lap_a)
            self._line_a_speed, = self._ax_speed.plot(
                da_d, da_s, color=CLR_ACCENT_A, linewidth=1.4,
                label=self._lap_a_label)
            self._line_a_thr, = self._ax_pedals.plot(
                da_d, da_t, color=CLR_THROTTLE, linewidth=1.0, label="Throttle")
            self._line_a_brk, = self._ax_pedals.plot(
                da_d, da_b, color=CLR_BRAKE, linewidth=1.0, label="Brake")
            self._ax_speed.set_xlim(da_d[0], da_d[-1])

        self._ax_speed.legend(loc="upper right", fontsize=8, facecolor=CLR_PANEL,
                              edgecolor=CLR_GRID, labelcolor=CLR_TEXT)
        self._ax_pedals.legend(loc="upper right", fontsize=8, facecolor=CLR_PANEL,
                               edgecolor=CLR_GRID, labelcolor=CLR_TEXT)
        self._canvas.draw_idle()

    # -----------------------------------------------------------------------
    # Crosshair
    # -----------------------------------------------------------------------
    def _on_mouse_move(self, event):
        if event.inaxes not in (self._ax_speed, self._ax_pedals):
            return
        if event.xdata is None:
            return

        x = event.xdata
        self._clear_crosshair()

        l1 = self._ax_speed.axvline(x, color=CLR_CROSSHAIR, linewidth=0.8, alpha=0.7)
        l2 = self._ax_pedals.axvline(x, color=CLR_CROSSHAIR, linewidth=0.8, alpha=0.7)
        self._crosshair_lines = [l1, l2]

        info_parts = [f"D={x:.1f}m"]

        if self._lap_a and self._lap_b:
            grid, da, db = align_two_laps(self._lap_a, self._lap_b, n_points=500)
            if len(grid) > 1 and grid[0] <= x <= grid[-1]:
                sa = float(np.interp(x, grid, da["speed"]))
                sb = float(np.interp(x, grid, db["speed"]))
                ta = float(np.interp(x, grid, da["throttle"]))
                tb = float(np.interp(x, grid, db["throttle"]))
                info_parts.append(f"Spd A={sa:.1f} B={sb:.1f} dV={sa-sb:+.1f}")
                info_parts.append(f"Thr A={ta:.2f} B={tb:.2f}")
        elif self._live_distance and len(self._live_distance) > 1:
            d_arr = np.array(self._live_distance)
            s_arr = np.array(self._live_speed)
            if d_arr[0] <= x <= d_arr[-1]:
                sv = float(np.interp(x, d_arr, s_arr))
                info_parts.append(f"Spd={sv:.1f} km/h")

        label_text = " | ".join(info_parts)
        y_pos = self._ax_speed.get_ylim()[1] * 0.95
        self._crosshair_label = self._ax_speed.text(
            x, y_pos, label_text, color=CLR_CROSSHAIR, fontsize=8,
            fontfamily="monospace", ha="center", va="top",
            bbox=dict(boxstyle="square,pad=0.2", facecolor=CLR_PANEL,
                      edgecolor=CLR_CROSSHAIR, alpha=0.9))

        self._canvas.draw_idle()

    def _on_mouse_leave(self, event):
        self._clear_crosshair()
        self._canvas.draw_idle()

    def _clear_crosshair(self):
        for line in self._crosshair_lines:
            try:
                line.remove()
            except ValueError:
                pass
        self._crosshair_lines = []
        if self._crosshair_label:
            try:
                self._crosshair_label.remove()
            except ValueError:
                pass
            self._crosshair_label = None

    # -----------------------------------------------------------------------
    # Actions
    # -----------------------------------------------------------------------
    def _manual_save(self):
        self._recorder.force_save()
        self._info_var.set("Manual lap save triggered.")

    def _load_lap(self, slot: str):
        path = filedialog.askopenfilename(
            title=f"Load Lap {slot} CSV",
            initialdir=str(CSV_DIR.resolve()),
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            lap = LapData.from_csv(path)
            if lap.length < 2:
                messagebox.showwarning("Load Error", "CSV has insufficient data.")
                return
        except Exception as e:
            messagebox.showerror("Load Error", f"Failed to load:\n{e}")
            return

        label = Path(path).stem
        if slot == "A":
            self._lap_a = lap
            self._lap_a_label = label
        else:
            self._lap_b = lap
            self._lap_b_label = label

        self._info_var.set(
            f"Loaded {slot}: {label} ({lap.length} pts, {lap.max_distance:.0f} m)")
        self._draw_comparison()

    def _clear_comparison(self):
        self._lap_a = None
        self._lap_b = None
        self._lap_a_label = "Lap A"
        self._lap_b_label = "Lap B"
        self._draw_comparison()
        self._info_var.set("Comparison cleared.")

    # -----------------------------------------------------------------------
    # Shutdown
    # -----------------------------------------------------------------------
    def _on_close(self):
        self._running = False
        log.info("Shutting down...")
        if self._mock_sender:
            self._mock_sender.stop()
        if self._receiver:
            self._receiver.stop()
        time.sleep(0.15)
        self._recorder.force_save()
        self.root.destroy()
        log.info("Closed.")

    def run(self):
        self.root.mainloop()


# ===========================================================================
# Entry Point
# ===========================================================================
def main():
    parser = argparse.ArgumentParser(
        description="RAC Telemetry Logger (OutGauge Protocol)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"UDP listen port (default: {DEFAULT_PORT})")
    parser.add_argument("--mock", action="store_true",
                        help="Enable built-in mock OutGauge sender for testing")
    args = parser.parse_args()

    log.info("=== RAC Telemetry Tool (OutGauge) ===")
    log.info("Port: %d | Mock: %s | CSV: %s",
             args.port, args.mock, CSV_DIR.resolve())

    app = TelemetryApp(port=args.port, enable_mock=args.mock)
    app.run()


if __name__ == "__main__":
    main()
