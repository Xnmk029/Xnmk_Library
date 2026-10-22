#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PY 流光：桌面悬浮球入口。"""

from __future__ import annotations

import sys


def _check_deps() -> None:
    missing: list[str] = []
    try:
        import PyQt6  # noqa: F401
    except ImportError:
        missing.append("PyQt6")
    try:
        import psutil  # noqa: F401
    except ImportError:
        missing.append("psutil")
    if missing:
        print("缺少依赖: " + ", ".join(missing))
        print("请先执行: pip install PyQt6 psutil")
        sys.exit(1)


def main() -> int:
    _check_deps()

    from PyQt6.QtWidgets import QApplication

    from ball_widget import FloatBall
    from config import AppConfig

    app = QApplication(sys.argv)
    app.setApplicationName("PY流光")
    app.setOrganizationName("PyFlowingLight")
    app.setQuitOnLastWindowClosed(True)

    config = AppConfig()
    config.load()

    ball = FloatBall(config)
    ball.place_default()
    ball.show()
    ball.raise_()
    return int(app.exec())


if __name__ == "__main__":
    sys.exit(main())
