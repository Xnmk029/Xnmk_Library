# -*- coding: utf-8 -*-
"""Patch scoring HTML pages: high-DPI fit-relative zoom + reliable exit."""
from __future__ import annotations

import re
from pathlib import Path

ZOOM_JS = r"""
const ZOOM_LEVELS = [
  { type: "fit", label: "Fit" },
  { type: "fitmul", m: 1.5, label: "1.5x" },
  { type: "fitmul", m: 2, label: "2x" },
  { type: "fitmul", m: 3, label: "3x" },
  { type: "fitmul", m: 4, label: "4x" },
  { type: "nat", m: 1, label: "1:1" },
  { type: "nat", m: 2, label: "2:1" }
];
function computeFitScale(img, vp) {
  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const cs = getComputedStyle(vp);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const vw = Math.max(1, vp.clientWidth - padX);
  const vh = Math.max(1, vp.clientHeight - padY);
  return Math.min(1, vw / nw, vh / nh);
}
function applyZoom() {
  const img = document.getElementById("mainImg");
  const vp = document.getElementById("viewport");
  const btn = document.getElementById("btnZoom");
  if (!img || !vp) return;
  if (!img.naturalWidth) return;
  let idx = state.zoomIndex | 0;
  if (idx < 0 || idx >= ZOOM_LEVELS.length) idx = 0;
  state.zoomIndex = idx;
  const level = ZOOM_LEVELS[idx];
  if (level.type === "fit") {
    img.style.width = "";
    img.style.height = "";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%";
    vp.classList.remove("is-zoomed");
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
    if (btn) btn.textContent = "Zoom Fit";
    return;
  }
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const fit = computeFitScale(img, vp);
  let scale;
  if (level.type === "fitmul") {
    scale = fit * level.m;
  } else {
    scale = level.m;
    if (scale <= fit * 1.02) scale = Math.max(scale * 1.5, fit * 1.5);
  }
  img.style.maxWidth = "none";
  img.style.maxHeight = "none";
  img.style.width = Math.round(nw * scale) + "px";
  img.style.height = Math.round(nh * scale) + "px";
  vp.classList.add("is-zoomed");
  if (btn) btn.textContent = "Zoom " + level.label + " · Esc";
}
function cycleZoom(dir) {
  const n = ZOOM_LEVELS.length;
  let i = state.zoomIndex | 0;
  if (i < 0 || i >= n) i = 0;
  i = (i + (dir >= 0 ? 1 : -1) + n * 10) % n;
  state.zoomIndex = i;
  applyZoom();
}
function exitZoom() {
  state.zoomIndex = 0;
  state.drag = null;
  const vp = document.getElementById("viewport");
  if (vp) vp.classList.remove("dragging");
  applyZoom();
}
"""


def patch_html(path: Path) -> None:
    t = path.read_text(encoding="utf-8")

    # --- CSS ---
    t = re.sub(
        r"\.viewport\s*\{[^}]*\}",
        """.viewport {
    min-height: 0;
    height: 100%;
    display: grid;
    place-items: center;
    padding: 24px 48px;
    overflow: auto;
    overscroll-behavior: contain;
  }""",
        t,
        count=1,
    )
    t = re.sub(r"\.viewport\s+img\.zoomed\s*\{[^}]*\}", "", t)

    if ".viewport.is-zoomed" not in t:
        t = t.replace(
            ".viewport img {",
            """.viewport.is-zoomed { place-items: start center; cursor: grab; }
  .viewport.is-zoomed.dragging { cursor: grabbing; }
  .viewport img {""",
            1,
        )
    if ".viewport.is-zoomed img" not in t:
        m = re.search(r"(\.viewport img\s*\{[^}]*\})", t)
        if m:
            insert = (
                m.group(1)
                + """
  .viewport.is-zoomed img {
    max-width: none !important;
    max-height: none !important;
    object-fit: unset;
    cursor: inherit;
  }"""
            )
            t = t[: m.start(1)] + insert + t[m.end(1) :]

    # ensure img has width/height auto user-select
    if "-webkit-user-drag: none" not in t and "-webkit-user-drag:none" not in t:
        t = t.replace(
            "cursor: zoom-in;",
            """cursor: zoom-in;
    user-select: none;
    -webkit-user-drag: none;""",
            1,
        )

    # --- btnZoom ---
    if 'id="btnZoom"' not in t:
        t = re.sub(
            r'(<button type="button" id="btnUnscored"[^>]*>.*?</button>)',
            r'\1\n    <button type="button" id="btnZoom" title="Z zoom · Esc exit">Zoom Fit</button>',
            t,
            count=1,
        )

    # --- remove old ZOOM_STEPS ---
    t = re.sub(r"const ZOOM_STEPS = \[[^\]]+\];\s*", "", t)

    # --- state fields ---
    t = re.sub(r"zoomScale:\s*0,", "zoomIndex: 0,", t)
    t = re.sub(r"zoomed:\s*false,", "zoomIndex: 0,", t)

    # --- replace applyZoom + cycleZoom ---
    new_t = re.sub(
        r"function applyZoom\(\) \{[\s\S]*?\nfunction cycleZoom\(dir\) \{[\s\S]*?\n\}",
        ZOOM_JS.strip(),
        t,
        count=1,
    )
    if new_t == t:
        # try with optional exitZoom already partial
        new_t = re.sub(
            r"const ZOOM_LEVELS = \[[\s\S]*?function exitZoom\(\) \{[\s\S]*?\n\}",
            ZOOM_JS.strip(),
            t,
            count=1,
        )
    if new_t == t:
        # insert after STORAGE_KEY / state block if functions missing
        if "function applyZoom" not in t:
            new_t = re.sub(
                r"(const state = \{[\s\S]*?\};)",
                r"\1\n" + ZOOM_JS,
                t,
                count=1,
            )
        else:
            # force replace from first applyZoom to end of cycleZoom more greedily
            new_t = re.sub(
                r"function applyZoom\(\) \{[\s\S]*?function cycleZoom\([\s\S]*?\n\}",
                ZOOM_JS.strip(),
                t,
                count=1,
            )
    t = new_t

    # if still old applyZoom without computeFitScale, harder replace
    if "computeFitScale" not in t:
        # nuke any remaining applyZoom
        t = re.sub(r"function applyZoom\(\) \{[\s\S]*?\n\}\s*", "", t, count=1)
        t = re.sub(r"function cycleZoom\([^)]*\) \{[\s\S]*?\n\}\s*", "", t, count=1)
        t = re.sub(
            r"(const state = \{[\s\S]*?\};)",
            r"\1\n" + ZOOM_JS,
            t,
            count=1,
        )

    # go() resets
    t = re.sub(r"state\.zoomScale\s*=\s*0;", "state.zoomIndex = 0;", t)
    t = re.sub(r"state\.zoomed\s*=\s*false;", "state.zoomIndex = 0;", t)
    t = t.replace('main.classList.remove("zoomed");', "")
    t = t.replace("main.classList.remove('zoomed');", "")
    t = t.replace("if (!state.zoomScale", "if (!state.zoomIndex")
    t = t.replace("if(!state.zoomScale", "if(!state.zoomIndex")

    # onload
    if "main.onload" not in t:
        t = re.sub(
            r'(const main = document\.getElementById\("mainImg"\);\s*)',
            r"\1main.onload = () => applyZoom();\n  ",
            t,
            count=1,
        )
        t = re.sub(
            r'(const main=document\.getElementById\("mainImg"\);\s*)',
            r"\1main.onload=()=>applyZoom();\n  ",
            t,
            count=1,
        )

    # Escape handler
    if 'ev.key === "Escape"' not in t and "ev.key===\"Escape\"" not in t and "ev.key === 'Escape'" not in t:
        t = t.replace(
            'if (ev.key === "ArrowLeft")',
            'if (ev.key === "Escape") { ev.preventDefault(); exitZoom(); }\n  else if (ev.key === "ArrowLeft")',
            1,
        )
        t = t.replace(
            'if(ev.key==="ArrowLeft")',
            'if(ev.key==="Escape"){ev.preventDefault();exitZoom();}\n  else if(ev.key==="ArrowLeft")',
            1,
        )

    # Z key to cycle, ensure present
    if 'ev.key === "z"' not in t and 'ev.key==="z"' not in t:
        t = t.replace(
            'else if (ev.key === "s" || ev.key === "S")',
            'else if (ev.key === "z" || ev.key === "Z" || ev.key === "+") { ev.preventDefault(); cycleZoom(1); }\n  else if (ev.key === "-" || ev.key === "_") { ev.preventDefault(); cycleZoom(-1); }\n  else if (ev.key === "s" || ev.key === "S")',
            1,
        )
        t = t.replace(
            'else if(ev.key==="s"||ev.key==="S")',
            'else if(ev.key==="z"||ev.key==="Z"||ev.key==="+"){ev.preventDefault();cycleZoom(1);}\n  else if(ev.key==="-"||ev.key==="_"){ev.preventDefault();cycleZoom(-1);}\n  else if(ev.key==="s"||ev.key==="S")',
            1,
        )

    # fix old onclick zoomed toggle
    t = re.sub(
        r"document\.getElementById\(\"mainImg\"\)\.onclick\s*=\s*\(\)\s*=>\s*\{\s*state\.zoomed\s*=\s*!state\.zoomed;[\s\S]*?\};",
        'document.getElementById("mainImg").onclick = () => { if (state._didDrag) { state._didDrag = false; return; } cycleZoom(1); };',
        t,
        count=1,
    )

    # double-click exit
    if "dblclick" not in t:
        t = t.replace(
            'document.getElementById("mainImg").onclick',
            'document.getElementById("mainImg").ondblclick = () => exitZoom();\ndocument.getElementById("mainImg").onclick',
            1,
        )

    # resize
    if 'addEventListener("resize"' not in t:
        t = t.replace(
            "go(0);",
            'window.addEventListener("resize", () => { if (state.zoomIndex) applyZoom(); });\ngo(0);',
            1,
        )

    # btnZoom wiring if missing
    if 'getElementById("btnZoom")' not in t or 'btnZoom").onclick' not in t:
        if 'btnZoom").onclick' not in t:
            t = t.replace(
                'document.getElementById("mainImg").onclick',
                'document.getElementById("btnZoom").onclick = () => cycleZoom(1);\ndocument.getElementById("mainImg").onclick',
                1,
            )

    # drag threshold: only suppress click if real drag
    t = t.replace(
        "if (Math.abs(dx) + Math.abs(dy) > 3) state._didDrag = true;",
        "if (Math.abs(dx) + Math.abs(dy) > 8) state._didDrag = true;",
    )

    path.write_text(t, encoding="utf-8")
    check = path.read_text(encoding="utf-8")
    ok = all(k in check for k in ["computeFitScale", "exitZoom", "zoomIndex", "ZOOM_LEVELS", "btnZoom"])
    print(path.name, "OK" if ok else "INCOMPLETE", "size", path.stat().st_size)


def main():
    base = Path(r"F:\benchmark\Image")
    for name in ["评分_GrokImage2.html", "众评.html", "评分_认领.html"]:
        p = base / name
        if p.exists():
            patch_html(p)
        else:
            print("missing", name)


if __name__ == "__main__":
    main()
