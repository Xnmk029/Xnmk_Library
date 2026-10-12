# -*- coding: utf-8 -*-
"""Dispatch API + static UI host for the bare-mode sandbox pipeline.

A zero-dependency (stdlib-only) HTTP service that wraps prepare / review /
collect / status and renders the copy-paste dispatch prompt for each run.

  python sandbox/scripts/dispatch_api.py [--port 8787] [--open]

Endpoints:
  GET  /                     → sandbox/dispatch/index.html
  GET  /api/projects         → discoverable projects (L1-L4/Image/Vision/NativeWorkflowBench)
  GET  /api/runs?model=      → run table (status.py scan)
  GET  /api/dispatch?model=&run_id= → {dispatch_text, workdir}
  POST /api/prepare          → {project, model} → run + dispatch_text
  POST /api/review           → {model, run_id} or {run} → verdict + checks
  POST /api/collect          → {model, run_id, dry_run, force}
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import webbrowser
from contextlib import redirect_stdout, redirect_stderr
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    RUN_META,
    RUNS,
    RUNS_ROOT,
    SANDBOX,
    build_dispatch_text,
    dump_json,
    load_json,
    load_meta,
    workdir_of,
)
import collect_run as _collect  # noqa: E402
import prepare_run as _prepare  # noqa: E402
import review_run as _review  # noqa: E402
import status as _status  # noqa: E402

UI_HTML = SANDBOX / "dispatch" / "index.html"


def _capture(fn, *a, **kw):
    """Run a pipeline function, return (exit_code, combined_output)."""
    buf = io.StringIO()
    code = 0
    try:
        with redirect_stdout(buf), redirect_stderr(buf):
            r = fn(*a, **kw)
            code = int(r) if isinstance(r, int) else 0
    except SystemExit as e:
        code = int(e.code or 0)
    except Exception as e:  # noqa: BLE001
        code = -1
        buf.write(f"\nEXCEPTION: {e}\n")
    return code, buf.getvalue()


def harness_dir(model: str, run_id: str) -> Path:
    return RUNS / model / run_id


def api_prepare(body: dict) -> dict:
    project = (body.get("project") or "").strip()
    model = (body.get("model") or "").strip() or "anon"
    if not project:
        return {"ok": False, "error": "need project"}
    prepared = {}
    def invoke_prepare():
        prepared.update(_prepare.prepare(project, model))
    code, out = _capture(invoke_prepare)
    if code != 0:
        return {"ok": False, "error": out}
    # Use this request's result, never another concurrent request's newest run.
    meta = prepared['meta']
    hdir = RUNS / model / meta['run_id']
    wd = workdir_of(meta)
    return {
        "ok": True,
        "run_id": meta["run_id"],
        "workdir": str(wd),
        "harness": str(hdir),
        "project": meta["project_rel"],
        "dispatch_text": build_dispatch_text(meta["project"], wd),
        "log": out,
    }


def api_review(body: dict) -> dict:
    hdir = Path(body["run"]) if body.get("run") else harness_dir(body["model"], body["run_id"])
    code, out = _capture(_review.review, hdir)
    verdict = None
    try:
        verdict = load_meta(hdir).get("verdict")
    except Exception:  # noqa: BLE001
        pass
    return {"ok": code == 0, "exit": code, "verdict": verdict, "log": out}


def api_collect(body: dict) -> dict:
    hdir = Path(body["run"]) if body.get("run") else harness_dir(body["model"], body["run_id"])
    code, out = _capture(
        _collect.collect, hdir,
        dry_run=bool(body.get("dry_run")), force=bool(body.get("force")),
    )
    return {"ok": code == 0, "exit": code, "log": out}


def api_dispatch(model: str, run_id: str) -> dict:
    hdir = harness_dir(model, run_id)
    meta = load_meta(hdir)
    wd = workdir_of(meta)
    return {
        "run_id": run_id,
        "model": model,
        "workdir": str(wd),
        "status": meta.get("status"),
        "verdict": meta.get("verdict"),
        "dispatch_text": build_dispatch_text(meta["project"], wd),
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, ctype: str = "application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"))

    def log_message(self, fmt, *a):  # quieter logging
        sys.stderr.write("  " + (fmt % a) + "\n")

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path in ("/", "/index.html"):
                data = UI_HTML.read_bytes()
                self._send(200, data, "text/html; charset=utf-8")
            elif u.path == "/api/projects":
                from sandbox_lib import discover_projects
                self._json({"ok": True, "projects": discover_projects(),
                            "runs_root": str(RUNS_ROOT)})
            elif u.path == "/api/runs":
                model = q.get("model", [None])[0]
                self._json({"ok": True, "runs": _status.scan_runs(model)})
            elif u.path == "/api/dispatch":
                self._json(api_dispatch(q["model"][0], q["run_id"][0]))
            else:
                self._json({"ok": False, "error": "not found"}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"ok": False, "error": str(e)}, 500)

    def do_POST(self):
        u = urlparse(self.path)
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            if u.path == "/api/prepare":
                self._json(api_prepare(body))
            elif u.path == "/api/review":
                self._json(api_review(body))
            elif u.path == "/api/collect":
                self._json(api_collect(body))
            else:
                self._json({"ok": False, "error": "not found"}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"ok": False, "error": str(e)}, 500)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sandbox dispatch API + UI")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--open", action="store_true", help="Open the UI in a browser")
    args = ap.parse_args()

    if not UI_HTML.is_file():
        print(f"WARN: UI not found at {UI_HTML}", file=sys.stderr)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"dispatch UI:  http://127.0.0.1:{args.port}/")
    print(f"runs root:    {RUNS_ROOT}")
    if args.open:
        webbrowser.open(f"http://127.0.0.1:{args.port}/")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
