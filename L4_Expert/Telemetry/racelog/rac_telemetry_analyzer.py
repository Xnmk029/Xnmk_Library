# -*- coding: utf-8 -*-
"""
RAC 实时遥测数据接收、记录与多圈对比分析工具 (单文件版)

技术栈: 标准库 (tkinter / threading / socket / queue / csv / json) + numpy + matplotlib

功能:
  1. 非阻塞 UDP 接收器 (独立子线程, 默认监听 0.0.0.0:4444, 即 BeamNG OutGauge 默认端口)
     - 自适应双协议: BeamNG OutGauge 二进制帧 / JSON 帧 (内置 Mock)
     - BeamNG 设置方法: Options -> Others -> OutGauge support 勾选,
       IP 填 127.0.0.1, Port 填 4444
  2. 基于距离 (Distance-based) 的多圈数据对齐与重采样 (numpy.interp)
  3. 实时记录 + 距离突变自动分圈落盘 CSV (lap_YYYYMMDD_HHMMSS.csv)
  4. Speed/Distance 与 Pedals/Distance 双通道对比图 + 鼠标十字线差值读数
  5. 内置虚拟 UDP 遥测发送器 (Mock), 无游戏也可完整演示

运行: python rac_telemetry_analyzer.py
退出: 关闭窗口即可, 所有子线程与 Socket 会被安全释放
"""

import csv
import json
import math
import os
import queue
import random
import select
import socket
import struct
import sys
import threading
import time
import traceback
from datetime import datetime

import numpy as np

import matplotlib
matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk  # noqa: E402
from matplotlib.figure import Figure  # noqa: E402

import tkinter as tk  # noqa: E402
from tkinter import filedialog, messagebox, ttk  # noqa: E402

# ----------------------------------------------------------------------------
# 全局配置
# ----------------------------------------------------------------------------
UDP_HOST = "127.0.0.1"            # Mock 发送目标 (BeamNG 中也应把 OutGauge IP 设为本机地址)
UDP_PORT = 4444                    # BeamNG OutGauge 默认端口
UDP_BIND_HOST = "0.0.0.0"          # 监听所有网卡, 兼容游戏在另一台机器的情况
MOCK_SEND_INTERVAL = 0.02          # 20 ms
MOCK_LAP_LENGTH = 2400.0           # 模拟赛道单圈长度 (米)
LAP_RESET_THRESHOLD = 50.0         # distance 回退超过该值判定为新圈
MIN_VALID_LAP_DISTANCE = 200.0     # 少于该里程的记录不落盘 (视为无效圈)
MIN_VALID_LAP_SAMPLES = 50
RESAMPLE_STEP = 5.0                # 对齐重采样距离步长 (米)
LAP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "laps")

FRAME_FIELDS = ("timestamp", "distance", "speed", "throttle", "brake")

COLOR_LIVE = "#2ca02c"
COLOR_LAP_A = "#1f77b4"
COLOR_LAP_B = "#d62728"


# ----------------------------------------------------------------------------
# 1. 虚拟 UDP 遥测发送器 (Mock Data Generator)
# ----------------------------------------------------------------------------
class MockTelemetrySender(threading.Thread):
    """
    在独立子线程中每 20ms 发送一帧模拟遥测 JSON 数据.
    赛道速度剖面由距离的正弦叠加决定 (可复现), 每圈叠加随机扰动模拟驾驶差异.
    """

    def __init__(self, host=UDP_HOST, port=UDP_PORT):
        super().__init__(name="MockSender", daemon=True)
        self._addr = (host, port)
        self._stop_event = threading.Event()
        self._sock = None
        self._lap_bias = random.uniform(-8.0, 8.0)

    def stop(self):
        self._stop_event.set()

    def _profile_speed(self, dist):
        """赛道目标速度剖面 (km/h), 仅与赛道位置有关."""
        s = dist / MOCK_LAP_LENGTH * 2.0 * math.pi
        base = 150.0
        base += 70.0 * math.sin(s * 3.0)          # 三个主弯
        base += 25.0 * math.sin(s * 7.0 + 1.3)    # 小弯组合
        return max(40.0, base + self._lap_bias)

    def run(self):
        try:
            self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        except OSError:
            traceback.print_exc()
            return

        distance = 0.0
        speed = 80.0
        t0 = time.time()
        try:
            while not self._stop_event.is_set():
                target = self._profile_speed(distance) + random.uniform(-2.0, 2.0)
                # 一阶惯性逼近目标速度
                accel = np.clip((target - speed) * 0.9, -55.0, 35.0)
                speed = max(0.0, speed + accel * MOCK_SEND_INTERVAL)

                if accel >= 0.0:
                    throttle = min(1.0, 0.25 + accel / 35.0)
                    brake = 0.0
                else:
                    throttle = 0.0
                    brake = min(1.0, -accel / 55.0)

                distance += speed / 3.6 * MOCK_SEND_INTERVAL
                if distance >= MOCK_LAP_LENGTH:
                    distance -= MOCK_LAP_LENGTH   # 过线 -> 距离归零, 触发自动分圈
                    self._lap_bias = random.uniform(-8.0, 8.0)

                frame = {
                    "timestamp": round(time.time() - t0, 4),
                    "distance": round(distance, 3),
                    "speed": round(speed, 2),
                    "throttle": round(float(throttle), 3),
                    "brake": round(float(brake), 3),
                }
                try:
                    self._sock.sendto(json.dumps(frame).encode("utf-8"), self._addr)
                except OSError:
                    pass  # 接收端尚未就绪等情况, 忽略即可
                self._stop_event.wait(MOCK_SEND_INTERVAL)
        finally:
            try:
                self._sock.close()
            except OSError:
                pass


# ----------------------------------------------------------------------------
# 2. 非阻塞 UDP 接收线程
# ----------------------------------------------------------------------------
class UdpReceiverThread(threading.Thread):
    """
    非阻塞 UDP 监听线程. 使用 select 轮询避免忙等,
    解析后的帧通过线程安全的 queue.Queue 推送给主线程, 绝不阻塞 UI.

    双协议自适应:
      1. JSON 帧 (内置 Mock / 自定义脚本)
      2. BeamNG / LFS OutGauge 二进制帧 (92 或 96 字节小端 struct).
         OutGauge 不含行驶距离字段, 由速度对时间积分得到 distance.
    """

    # OutGauge: Time, Car[4], Flags, Gear, PLID, Speed(m/s), RPM, Turbo,
    #           EngTemp, Fuel, OilPressure, OilTemp, DashLights, ShowLights,
    #           Throttle, Brake, Clutch, Display1[16], Display2[16], (ID)
    OUTGAUGE_STRUCT = struct.Struct("<I4sH2B7f2I3f16s16s")   # 92 字节 (ID 可选 +4)

    def __init__(self, data_queue, host=UDP_BIND_HOST, port=UDP_PORT):
        super().__init__(name="UdpReceiver", daemon=True)
        self._queue = data_queue
        self._host = host
        self._port = port
        self._stop_event = threading.Event()
        self._sock = None
        self.bind_error = None
        # OutGauge 距离积分状态 (仅本线程访问)
        self._og_distance = 0.0
        self._og_last_mono = None
        self._og_t0 = None

    def stop(self):
        self._stop_event.set()

    def run(self):
        try:
            self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._sock.bind((self._host, self._port))
            self._sock.setblocking(False)
        except OSError as exc:
            self.bind_error = str(exc)
            if self._sock is not None:
                try:
                    self._sock.close()
                except OSError:
                    pass
            return

        try:
            while not self._stop_event.is_set():
                try:
                    readable, _, _ = select.select([self._sock], [], [], 0.2)
                except (OSError, ValueError):
                    break
                if not readable:
                    continue
                # 尽量一次性排空内核缓冲, 降低延迟
                for _ in range(256):
                    try:
                        data, _ = self._sock.recvfrom(4096)
                    except BlockingIOError:
                        break
                    except OSError:
                        return
                    frame = self._parse(data)
                    if frame is not None:
                        try:
                            self._queue.put_nowait(frame)
                        except queue.Full:
                            pass  # 主线程消费不及, 丢弃最旧策略交由队列上限控制
        finally:
            try:
                self._sock.close()
            except OSError:
                pass

    def _parse(self, data):
        """自适应解析一帧遥测数据 (JSON 或 OutGauge), 非法帧返回 None."""
        frame = None
        if data[:1] == b"{":
            frame = self._parse_json(data)
        if frame is None:
            frame = self._parse_outgauge(data)
        if frame is None:
            return None
        if not all(math.isfinite(frame[k]) for k in FRAME_FIELDS):
            return None
        frame["throttle"] = min(1.0, max(0.0, frame["throttle"]))
        frame["brake"] = min(1.0, max(0.0, frame["brake"]))
        return frame

    @staticmethod
    def _parse_json(data):
        try:
            obj = json.loads(data.decode("utf-8"))
            return {k: float(obj[k]) for k in FRAME_FIELDS}
        except (ValueError, KeyError, TypeError, UnicodeDecodeError):
            return None

    def _parse_outgauge(self, data):
        """
        解析 BeamNG OutGauge 二进制帧 (92/96 字节).
        OutGauge 无 distance 字段 -> 用 speed 对本地单调时钟积分.
        """
        size = self.OUTGAUGE_STRUCT.size
        if len(data) not in (size, size + 4):
            return None
        try:
            vals = self.OUTGAUGE_STRUCT.unpack_from(data)
        except struct.error:
            return None
        speed_ms = vals[5]
        throttle = vals[14]
        brake = vals[15]
        if not (math.isfinite(speed_ms) and 0.0 <= speed_ms < 300.0):
            return None

        now = time.monotonic()
        if self._og_t0 is None:
            self._og_t0 = now
        if self._og_last_mono is not None:
            dt = now - self._og_last_mono
            if 0.0 < dt < 0.5:
                self._og_distance += speed_ms * dt
        self._og_last_mono = now

        return {
            "timestamp": now - self._og_t0,
            "distance": self._og_distance,
            "speed": speed_ms * 3.6,
            "throttle": float(throttle),
            "brake": float(brake),
        }


# ----------------------------------------------------------------------------
# 3. 单圈记录器: 实时缓冲 + 距离突变自动分圈 + CSV 持久化
# ----------------------------------------------------------------------------
class LapRecorder:
    """仅在主线程中被调用, 无需加锁."""

    def __init__(self, on_lap_saved=None):
        self._rows = []            # list[dict]
        self._last_distance = None
        self._on_lap_saved = on_lap_saved

    @property
    def sample_count(self):
        return len(self._rows)

    def feed(self, frame):
        """
        喂入一帧数据. 若检测到 distance 突变回退 (过线/重置),
        先落盘旧圈再开新圈. 返回保存的文件路径或 None.
        """
        saved = None
        d = frame["distance"]
        if (self._last_distance is not None
                and d < self._last_distance - LAP_RESET_THRESHOLD):
            saved = self.finalize()
        self._rows.append(frame)
        self._last_distance = d
        return saved

    def snapshot_arrays(self):
        """返回当前圈缓冲的 numpy 数组视图, 供实时绘图."""
        if not self._rows:
            return None
        dist = np.fromiter((r["distance"] for r in self._rows), dtype=float)
        spd = np.fromiter((r["speed"] for r in self._rows), dtype=float)
        thr = np.fromiter((r["throttle"] for r in self._rows), dtype=float)
        brk = np.fromiter((r["brake"] for r in self._rows), dtype=float)
        return dist, spd, thr, brk

    def finalize(self):
        """结束当前圈: 有效则保存 CSV, 无效则丢弃. 返回文件路径或 None."""
        rows, self._rows = self._rows, []
        self._last_distance = None
        if len(rows) < MIN_VALID_LAP_SAMPLES:
            return None
        covered = rows[-1]["distance"] - rows[0]["distance"]
        if covered < MIN_VALID_LAP_DISTANCE:
            return None
        path = self._write_csv(rows)
        if path and self._on_lap_saved:
            self._on_lap_saved(path, rows)
        return path

    @staticmethod
    def _write_csv(rows):
        try:
            os.makedirs(LAP_DIR, exist_ok=True)
            name = "lap_{}.csv".format(datetime.now().strftime("%Y%m%d_%H%M%S"))
            path = os.path.join(LAP_DIR, name)
            # 同一秒内多圈结束时避免覆盖
            idx = 1
            while os.path.exists(path):
                path = os.path.join(LAP_DIR, name[:-4] + "_{}.csv".format(idx))
                idx += 1
            with open(path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=list(FRAME_FIELDS))
                writer.writeheader()
                writer.writerows(rows)
            return path
        except OSError:
            traceback.print_exc()
            return None


# ----------------------------------------------------------------------------
# 4. 核心算法: 基于距离的对齐与重采样
# ----------------------------------------------------------------------------
class LapData:
    """一圈的遥测数据 (numpy 列存), 保证 distance 严格递增."""

    def __init__(self, distance, speed, throttle, brake, label=""):
        distance = np.asarray(distance, dtype=float)
        speed = np.asarray(speed, dtype=float)
        throttle = np.asarray(throttle, dtype=float)
        brake = np.asarray(brake, dtype=float)

        order = np.argsort(distance, kind="stable")
        distance = distance[order]
        speed, throttle, brake = speed[order], throttle[order], brake[order]
        # 去掉重复距离点, 保证 np.interp 前提: x 严格递增
        keep = np.concatenate(([True], np.diff(distance) > 1e-9))
        self.distance = distance[keep] - distance[keep][0]  # 距离归零对齐起点
        self.speed = speed[keep]
        self.throttle = throttle[keep]
        self.brake = brake[keep]
        self.label = label
        if self.distance.size < 2:
            raise ValueError("有效数据点不足 (<2), 无法构成一圈曲线")

    @property
    def max_distance(self):
        return float(self.distance[-1])

    @classmethod
    def from_csv(cls, path):
        cols = {k: [] for k in FRAME_FIELDS}
        try:
            with open(path, "r", newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                if reader.fieldnames is None or not set(FRAME_FIELDS).issubset(reader.fieldnames):
                    raise ValueError(
                        "CSV 表头缺少必需字段: {}".format(", ".join(FRAME_FIELDS)))
                for row in reader:
                    try:
                        vals = {k: float(row[k]) for k in FRAME_FIELDS}
                    except (TypeError, ValueError, KeyError):
                        continue  # 跳过坏行
                    if all(math.isfinite(v) for v in vals.values()):
                        for k in FRAME_FIELDS:
                            cols[k].append(vals[k])
        except OSError as exc:
            raise ValueError("无法读取文件: {}".format(exc)) from exc
        if len(cols["distance"]) < 2:
            raise ValueError("文件中没有足够的有效数据行")
        return cls(cols["distance"], cols["speed"], cols["throttle"],
                   cols["brake"], label=os.path.basename(path))

    def resample(self, grid):
        """把本圈数据线性插值到统一距离网格上."""
        return {
            "speed": np.interp(grid, self.distance, self.speed),
            "throttle": np.interp(grid, self.distance, self.throttle),
            "brake": np.interp(grid, self.distance, self.brake),
        }


def align_laps(lap_a, lap_b, step=RESAMPLE_STEP):
    """
    以行驶距离为公共 X 轴, 将两圈重采样到相同的距离网格.
    返回 (grid, resampled_a, resampled_b).
    """
    common_max = min(lap_a.max_distance, lap_b.max_distance)
    if common_max <= step:
        raise ValueError("两圈公共距离过短, 无法对齐")
    grid = np.arange(0.0, common_max + step * 0.5, step)
    return grid, lap_a.resample(grid), lap_b.resample(grid)


# ----------------------------------------------------------------------------
# 5. 主界面 (Tkinter + 内嵌 Matplotlib)
# ----------------------------------------------------------------------------
class TelemetryApp:
    QUEUE_POLL_MS = 50      # 主线程消费队列周期
    LIVE_REDRAW_MS = 250    # 实时曲线重绘周期

    def __init__(self, root):
        self.root = root
        self.root.title(
            "RAC 遥测记录与多圈对比分析工具  (BeamNG OutGauge / JSON, UDP:{})".format(UDP_PORT))
        self.root.geometry("1180x780")
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.data_queue = queue.Queue(maxsize=8192)
        self.receiver = None
        self.mock_sender = None
        self._closing = False

        self.recorder = LapRecorder(on_lap_saved=self._lap_saved_callback)
        self.lap_a = None
        self.lap_b = None
        self._aligned = None          # (grid, res_a, res_b)
        self._live_dirty = False
        self._last_live_draw = 0.0
        self._frames_received = 0

        self._build_controls()
        self._build_figure()
        self._start_receiver()

        self.root.after(self.QUEUE_POLL_MS, self._poll_queue)

    # ------------------------------------------------------------------ UI --
    def _build_controls(self):
        bar = ttk.Frame(self.root, padding=(8, 6))
        bar.pack(side=tk.TOP, fill=tk.X)

        self.mock_btn = ttk.Button(bar, text="启动模拟数据源", command=self.toggle_mock)
        self.mock_btn.pack(side=tk.LEFT, padx=(0, 6))

        ttk.Button(bar, text="手动结束当前圈并保存",
                   command=self.manual_save_lap).pack(side=tk.LEFT, padx=6)
        ttk.Separator(bar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=8)

        ttk.Button(bar, text="加载 Lap A (蓝)",
                   command=lambda: self.load_lap("A")).pack(side=tk.LEFT, padx=6)
        ttk.Button(bar, text="加载 Lap B (红)",
                   command=lambda: self.load_lap("B")).pack(side=tk.LEFT, padx=6)
        ttk.Button(bar, text="清除对比", command=self.clear_laps).pack(side=tk.LEFT, padx=6)

        self.live_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(bar, text="显示实时曲线 (绿)",
                        variable=self.live_var,
                        command=self._request_redraw).pack(side=tk.LEFT, padx=10)

        self.status_var = tk.StringVar(
            value="等待数据... 监听 UDP {}:{} | BeamNG: Options→Others→OutGauge, "
                  "IP=127.0.0.1 Port={}".format(UDP_BIND_HOST, UDP_PORT, UDP_PORT))
        status = ttk.Label(self.root, textvariable=self.status_var, anchor=tk.W,
                           padding=(8, 3), relief=tk.SUNKEN)
        status.pack(side=tk.BOTTOM, fill=tk.X)

        self.cursor_var = tk.StringVar(value="将鼠标移入图表可查看该距离点上的 A/B 数值差异")
        cursor_lbl = ttk.Label(self.root, textvariable=self.cursor_var, anchor=tk.W,
                               padding=(8, 3), foreground="#333333")
        cursor_lbl.pack(side=tk.BOTTOM, fill=tk.X)

    def _build_figure(self):
        self.fig = Figure(figsize=(11, 6.2), dpi=100)
        self.ax_speed = self.fig.add_subplot(2, 1, 1)
        self.ax_pedal = self.fig.add_subplot(2, 1, 2, sharex=self.ax_speed)
        self.fig.subplots_adjust(hspace=0.28, left=0.07, right=0.98,
                                 top=0.95, bottom=0.09)

        self.ax_speed.set_title("Speed vs Distance")
        self.ax_speed.set_ylabel("Speed (km/h)")
        self.ax_pedal.set_title("Pedals vs Distance")
        self.ax_pedal.set_ylabel("Pedal (0-1)")
        self.ax_pedal.set_xlabel("Distance (m)")
        self.ax_pedal.set_ylim(-0.05, 1.05)
        for ax in (self.ax_speed, self.ax_pedal):
            ax.grid(True, alpha=0.3)

        # 曲线句柄 (惰性创建后仅 set_data, 提升刷新性能)
        self.line_live_speed, = self.ax_speed.plot(
            [], [], color=COLOR_LIVE, lw=1.2, alpha=0.9, label="Live")
        self.line_live_thr, = self.ax_pedal.plot(
            [], [], color=COLOR_LIVE, lw=1.0, alpha=0.9, label="Live Thr")
        self.line_live_brk, = self.ax_pedal.plot(
            [], [], color=COLOR_LIVE, lw=1.0, alpha=0.5, ls="--", label="Live Brk")

        self.line_a_speed, = self.ax_speed.plot(
            [], [], color=COLOR_LAP_A, lw=1.5, label="Lap A")
        self.line_b_speed, = self.ax_speed.plot(
            [], [], color=COLOR_LAP_B, lw=1.5, label="Lap B")
        self.line_a_thr, = self.ax_pedal.plot(
            [], [], color=COLOR_LAP_A, lw=1.3, label="A Throttle")
        self.line_a_brk, = self.ax_pedal.plot(
            [], [], color=COLOR_LAP_A, lw=1.3, ls="--", alpha=0.7, label="A Brake")
        self.line_b_thr, = self.ax_pedal.plot(
            [], [], color=COLOR_LAP_B, lw=1.3, label="B Throttle")
        self.line_b_brk, = self.ax_pedal.plot(
            [], [], color=COLOR_LAP_B, lw=1.3, ls="--", alpha=0.7, label="B Brake")

        # 十字线
        self.cross_speed = self.ax_speed.axvline(
            np.nan, color="#555555", lw=0.8, ls=":", animated=False)
        self.cross_pedal = self.ax_pedal.axvline(
            np.nan, color="#555555", lw=0.8, ls=":", animated=False)

        self.ax_speed.legend(loc="upper right", fontsize=8, ncol=3)
        self.ax_pedal.legend(loc="upper right", fontsize=8, ncol=3)

        self.canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        toolbar = NavigationToolbar2Tk(self.canvas, self.root, pack_toolbar=False)
        toolbar.update()
        toolbar.pack(side=tk.TOP, fill=tk.X)

        self._cursor_throttle = 0.0
        self.canvas.mpl_connect("motion_notify_event", self._on_mouse_move)
        self.canvas.mpl_connect("figure_leave_event", self._on_mouse_leave)
        self.canvas.draw_idle()

    # ------------------------------------------------------------- threads --
    def _start_receiver(self):
        self.receiver = UdpReceiverThread(self.data_queue)
        self.receiver.start()
        self.root.after(300, self._check_receiver_bind)

    def _check_receiver_bind(self):
        if self.receiver and self.receiver.bind_error:
            messagebox.showerror(
                "UDP 绑定失败",
                "无法监听 {}:{}\n{}\n\n请检查端口是否被占用。"
                .format(UDP_BIND_HOST, UDP_PORT, self.receiver.bind_error))
            self.status_var.set("UDP 绑定失败: " + self.receiver.bind_error)

    def toggle_mock(self):
        if self.mock_sender and self.mock_sender.is_alive():
            self.mock_sender.stop()
            self.mock_sender.join(timeout=1.0)
            self.mock_sender = None
            self.mock_btn.config(text="启动模拟数据源")
            self.status_var.set("模拟数据源已停止")
        else:
            self.mock_sender = MockTelemetrySender()
            self.mock_sender.start()
            self.mock_btn.config(text="停止模拟数据源")
            self.status_var.set("模拟数据源运行中 (每 20ms 一帧)")

    # -------------------------------------------------------- data pumping --
    def _poll_queue(self):
        """主线程周期性消费接收队列, 喂入记录器."""
        if self._closing:
            return
        try:
            processed = 0
            while processed < 2000:
                try:
                    frame = self.data_queue.get_nowait()
                except queue.Empty:
                    break
                saved = self.recorder.feed(frame)
                processed += 1
                self._frames_received += 1
                if saved:
                    self.status_var.set("检测到过线/重置, 已自动保存: " + saved)
            if processed:
                self._live_dirty = True
                if self._frames_received % 25 == 0 or processed > 25:
                    self.status_var.set(
                        "接收中: 共 {} 帧 | 当前圈缓冲 {} 点".format(
                            self._frames_received, self.recorder.sample_count))
            now = time.time()
            if (self._live_dirty and self.live_var.get()
                    and (now - self._last_live_draw) * 1000.0 >= self.LIVE_REDRAW_MS):
                self._last_live_draw = now
                self._live_dirty = False
                self._update_live_lines()
        except Exception:
            traceback.print_exc()
        finally:
            if not self._closing:
                self.root.after(self.QUEUE_POLL_MS, self._poll_queue)

    def _update_live_lines(self):
        snap = self.recorder.snapshot_arrays()
        if snap is None or not self.live_var.get():
            for ln in (self.line_live_speed, self.line_live_thr, self.line_live_brk):
                ln.set_data([], [])
        else:
            dist, spd, thr, brk = snap
            self.line_live_speed.set_data(dist, spd)
            self.line_live_thr.set_data(dist, thr)
            self.line_live_brk.set_data(dist, brk)
        self._autoscale()
        self.canvas.draw_idle()

    def _autoscale(self):
        for ax in (self.ax_speed,):
            ax.relim(visible_only=False)
            ax.autoscale_view(scalex=True, scaley=True)
        self.ax_pedal.relim()
        self.ax_pedal.autoscale_view(scalex=True, scaley=False)
        self.ax_pedal.set_ylim(-0.05, 1.05)

    def _lap_saved_callback(self, path, rows):
        print("[LapRecorder] 保存单圈数据 -> {} ({} 行)".format(path, len(rows)))

    def manual_save_lap(self):
        if self.recorder.sample_count == 0:
            messagebox.showinfo("提示", "当前没有正在记录的数据。")
            return
        path = self.recorder.finalize()
        if path:
            self.status_var.set("手动保存成功: " + path)
            messagebox.showinfo("保存成功", path)
        else:
            self.status_var.set("当前记录太短, 视为无效圈已丢弃")
            messagebox.showwarning(
                "无效圈",
                "当前记录里程不足 {:.0f} m 或采样点不足 {} 个, 已丢弃。"
                .format(MIN_VALID_LAP_DISTANCE, MIN_VALID_LAP_SAMPLES))
        self._update_live_lines()

    # ------------------------------------------------------- lap comparison --
    def load_lap(self, slot):
        initial = LAP_DIR if os.path.isdir(LAP_DIR) else os.getcwd()
        path = filedialog.askopenfilename(
            title="选择 Lap {} 的 CSV 文件".format(slot),
            initialdir=initial,
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")])
        if not path:
            return
        try:
            lap = LapData.from_csv(path)
        except ValueError as exc:
            messagebox.showerror("加载失败", str(exc))
            return
        if slot == "A":
            self.lap_a = lap
        else:
            self.lap_b = lap
        self._rebuild_comparison()
        self.status_var.set("已加载 Lap {}: {} (里程 {:.0f} m)".format(
            slot, lap.label, lap.max_distance))

    def clear_laps(self):
        self.lap_a = None
        self.lap_b = None
        self._aligned = None
        self._rebuild_comparison()
        self.status_var.set("已清除对比数据")

    def _rebuild_comparison(self):
        """根据 lap_a / lap_b 的加载情况刷新对比曲线 (含距离对齐重采样)."""
        self._aligned = None
        empty = np.array([])
        for ln in (self.line_a_speed, self.line_a_thr, self.line_a_brk,
                   self.line_b_speed, self.line_b_thr, self.line_b_brk):
            ln.set_data(empty, empty)

        try:
            if self.lap_a is not None and self.lap_b is not None:
                grid, ra, rb = align_laps(self.lap_a, self.lap_b)
                self._aligned = (grid, ra, rb)
                self.line_a_speed.set_data(grid, ra["speed"])
                self.line_a_thr.set_data(grid, ra["throttle"])
                self.line_a_brk.set_data(grid, ra["brake"])
                self.line_b_speed.set_data(grid, rb["speed"])
                self.line_b_thr.set_data(grid, rb["throttle"])
                self.line_b_brk.set_data(grid, rb["brake"])
            elif self.lap_a is not None:
                self._plot_single(self.lap_a, self.line_a_speed,
                                  self.line_a_thr, self.line_a_brk)
            elif self.lap_b is not None:
                self._plot_single(self.lap_b, self.line_b_speed,
                                  self.line_b_thr, self.line_b_brk)
        except ValueError as exc:
            messagebox.showerror("对齐失败", str(exc))

        self._autoscale()
        self.canvas.draw_idle()

    @staticmethod
    def _plot_single(lap, ln_speed, ln_thr, ln_brk):
        ln_speed.set_data(lap.distance, lap.speed)
        ln_thr.set_data(lap.distance, lap.throttle)
        ln_brk.set_data(lap.distance, lap.brake)

    def _request_redraw(self):
        self._update_live_lines()

    # ------------------------------------------------------------ crosshair --
    def _on_mouse_move(self, event):
        if event.inaxes not in (self.ax_speed, self.ax_pedal) or event.xdata is None:
            return
        now = time.time()
        if now - self._cursor_throttle < 0.03:   # 限流 ~33Hz, 避免拖慢 UI
            return
        self._cursor_throttle = now

        x = float(event.xdata)
        self.cross_speed.set_xdata([x, x])
        self.cross_pedal.set_xdata([x, x])
        self.cursor_var.set(self._cursor_text(x))
        self.canvas.draw_idle()

    def _on_mouse_leave(self, _event):
        self.cross_speed.set_xdata([np.nan, np.nan])
        self.cross_pedal.set_xdata([np.nan, np.nan])
        self.cursor_var.set("将鼠标移入图表可查看该距离点上的 A/B 数值差异")
        self.canvas.draw_idle()

    def _cursor_text(self, x):
        parts = ["距离 {:7.1f} m".format(x)]
        if self._aligned is not None:
            grid, ra, rb = self._aligned
            if grid[0] <= x <= grid[-1]:
                sa = float(np.interp(x, grid, ra["speed"]))
                sb = float(np.interp(x, grid, rb["speed"]))
                ta = float(np.interp(x, grid, ra["throttle"]))
                tb = float(np.interp(x, grid, rb["throttle"]))
                ba = float(np.interp(x, grid, ra["brake"]))
                bb = float(np.interp(x, grid, rb["brake"]))
                parts.append(
                    "速度 A {:6.1f} | B {:6.1f} | ΔA-B {:+6.1f} km/h".format(sa, sb, sa - sb))
                parts.append(
                    "油门 A {:4.2f} / B {:4.2f} (Δ{:+.2f})".format(ta, tb, ta - tb))
                parts.append(
                    "刹车 A {:4.2f} / B {:4.2f} (Δ{:+.2f})".format(ba, bb, ba - bb))
                return "   ".join(parts)
        for lap, tag in ((self.lap_a, "A"), (self.lap_b, "B")):
            if lap is not None and lap.distance[0] <= x <= lap.distance[-1]:
                parts.append("Lap {}: 速度 {:6.1f} km/h, 油门 {:4.2f}, 刹车 {:4.2f}".format(
                    tag,
                    float(np.interp(x, lap.distance, lap.speed)),
                    float(np.interp(x, lap.distance, lap.throttle)),
                    float(np.interp(x, lap.distance, lap.brake))))
        if len(parts) == 1:
            snap = self.recorder.snapshot_arrays()
            if snap is not None and snap[0].size >= 2 and snap[0][0] <= x <= snap[0][-1]:
                parts.append("Live: 速度 {:6.1f} km/h".format(
                    float(np.interp(x, snap[0], snap[1]))))
        return "   ".join(parts)

    # ------------------------------------------------------------- shutdown --
    def on_close(self):
        """优雅退出: 停止所有子线程并释放 Socket 端口."""
        if self._closing:
            return
        self._closing = True
        self.status_var.set("正在关闭...")
        try:
            if self.mock_sender is not None:
                self.mock_sender.stop()
            if self.receiver is not None:
                self.receiver.stop()
            if self.mock_sender is not None:
                self.mock_sender.join(timeout=1.5)
            if self.receiver is not None:
                self.receiver.join(timeout=1.5)
        except Exception:
            traceback.print_exc()
        finally:
            try:
                self.root.quit()
            finally:
                self.root.destroy()


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------
def main():
    root = tk.Tk()
    try:
        app = TelemetryApp(root)
    except Exception:
        traceback.print_exc()
        try:
            root.destroy()
        except tk.TclError:
            pass
        return 1
    try:
        root.mainloop()
    except KeyboardInterrupt:
        app.on_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
