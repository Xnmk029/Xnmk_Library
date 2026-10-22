# render_preview.py — 零依赖 STL→SVG 正交线框渲染器（离线环境可用）
# 用法: python render_preview.py  → 生成 ../render/view_{top,front,iso}.svg
import math
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
STL = os.path.join(HERE, "out", "BikeComputer.stl")
RENDER = os.path.join(HERE, "..", "render")
os.makedirs(RENDER, exist_ok=True)


def read_stl(path):
    tris = []
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:5].lower() == b"solid" and b"facet" in data[:512]:
        # ASCII STL 兜底
        import re
        for m in re.finditer(rb"vertex\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)", data):
            pass
        raise SystemExit("ASCII STL not supported by this minimal renderer")
    n = struct.unpack_from("<I", data, 80)[0]
    off = 84
    for _ in range(n):
        vals = struct.unpack_from("<12fH", data, off)
        v = vals[3:12]
        tris.append([(v[0], v[1], v[2]), (v[3], v[4], v[5]), (v[6], v[7], v[8])])
        off += 50
    return tris


def project(tris, kind):
    """kind: top=XY, front=XZ, iso=等轴测"""
    out = []
    ca, sa = math.cos(math.radians(45)), math.sin(math.radians(45))
    ci, si = math.cos(math.radians(30)), math.sin(math.radians(30))
    for tri in tris:
        pts = []
        for x, y, z in tri:
            if kind == "top":
                px, py = x, y
            elif kind == "front":
                px, py = x, z
            else:  # iso
                xr = x * ca - y * ca
                yr = x * sa + y * sa
                px = xr
                py = z * ci - yr * si * 0.0 + yr * 0.5
                px, py = xr - yr * 0.5, z + yr * 0.4
            pts.append((px, py))
        out.append(pts)
    return out


def to_svg(tris2d, path, title):
    xs = [p[0] for t in tris2d for p in t]
    ys = [p[1] for t in tris2d for p in t]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0 or 1, y1 - y0 or 1
    scale = 560.0 / max(w, h)
    W, H = w * scale + 40, h * scale + 60
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %.1f %.1f">' % (W, H, W, H),
        '<rect width="100%" height="100%" fill="#f4f4f2"/>',
        '<text x="20" y="30" font-family="monospace" font-size="18" '
        'fill="#333">%s — %.1f x %.1f mm</text>' % (title, w, h),
        '<g transform="translate(20,50) scale(%.4f)" stroke="#1a4f8a" '
        'stroke-width="0.35" fill="none">' % scale,
    ]
    for tri in tris2d:
        pts = " ".join("%.2f,%.2f" % (px - x0, (y1 - y0) - (py - y0))
                       for px, py in tri)
        lines.append('<polygon points="%s"/>' % pts)
    lines.append("</g></svg>")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print("WROTE", path)


def main():
    tris = read_stl(STL)
    print("triangles:", len(tris))
    for kind in ("top", "front", "iso"):
        to_svg(project(tris, kind),
               os.path.join(RENDER, "view_%s.svg" % kind),
               "BikeComputer %s" % kind)


main()
