#!/usr/bin/env python3
"""Zero-dependency local server for VT-4 WebGPU Studio."""
from __future__ import annotations

import argparse
import contextlib
import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class StudioHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stdout.write("[VT4] " + (fmt % args) + "\n")


def port_available(host: str, port: int) -> bool:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
        return True


def choose_port(host: str, preferred: int) -> int:
    for port in range(preferred, preferred + 40):
        if port_available(host, port):
            return port
    raise RuntimeError("未能在建议范围内找到可用端口。")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run VT-4 WebGPU Studio locally")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser automatically")
    args = parser.parse_args()

    os.chdir(ROOT)
    port = choose_port(args.host, args.port)
    url = f"http://{args.host}:{port}/"
    server = ThreadingHTTPServer((args.host, port), StudioHandler)

    print("=" * 68)
    print(" VT-4 装配与考证工作室")
    print(f" 地址：{url}")
    print(" 关闭：在本窗口按 Ctrl+C")
    print("=" * 68)

    if not args.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url, new=2)).start()

    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print("\n正在关闭本地服务器…")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
