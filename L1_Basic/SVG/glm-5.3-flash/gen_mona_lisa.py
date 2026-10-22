# gen_mona_lisa.py -- deterministic pure-SVG "brush stroke" generator for a
# study replica of Leonardo da Vinci, Mona Lisa (Louvre, INV 779).
# Composition landmarks transcribed from the public-domain C2RMF reference scan.
# Output: answer.svg (1200x1600), no images, no external refs.
import math, random, os

W, H = 1200, 1600
RNG = random.Random(20260827)

def clamp(v, a, b):
    return max(a, min(b, v))

def jit(c, amt):
    d = lambda: RNG.randint(-amt, amt)
    return (clamp(c[0] + d(), 0, 255), clamp(c[1] + d(), 0, 255), clamp(c[2] + d(), 0, 255))

def hexs(c):
    return '#%02x%02x%02x' % c

def lerp(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))

def ramp(stops, t):
    t = clamp(t, 0.0, 1.0)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]
        p1, c1 = stops[i + 1]
        if t <= p1 or i == len(stops) - 2:
            tt = 0.0 if p1 == p0 else clamp((t - p0) / (p1 - p0), 0.0, 1.0)
            return lerp(c0, c1, tt)
    return stops[-1][1]

out = []
NPCOUNT = [0]

def emit(s):
    if s.lstrip().startswith('<path'):
        NPCOUNT[0] += 1
    out.append(s)

def stroke(x0, y0, x1, y1, curve, color, w, op):
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    if L < 0.5:
        L = 0.5
    nx, ny = -dy / L, dx / L
    cx, cy = (x0 + x1) / 2 + nx * curve, (y0 + y1) / 2 + ny * curve
    emit('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f" fill="none" stroke="%s" stroke-width="%.1f" stroke-linecap="round" opacity="%.3f"/>'
         % (x0, y0, cx, cy, x1, y1, hexs(color), w, op))

def taper(x0, y0, x1, y1, w0, curve, color, op=1.0):
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L, dx / L
    mx, my = (x0 + x1) / 2 + nx * curve, (y0 + y1) / 2 + ny * curve
    ax, ay = x0 + nx * w0 / 2, y0 + ny * w0 / 2
    bx, by = x0 - nx * w0 / 2, y0 - ny * w0 / 2
    emit('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f Q %.1f %.1f %.1f %.1f Z" fill="%s" fill-opacity="%.3f" stroke="none"/>'
         % (ax, ay, mx, my, x1, y1, mx, my, bx, by, hexs(color), op))

def poly(pts, fill, op=1.0):
    d = 'M ' + ' L '.join('%.1f %.1f' % p for p in pts) + ' Z'
    emit('<path d="%s" fill="%s" fill-opacity="%.3f" stroke="none"/>' % (d, hexs(fill), op))

def pip(x, y, pts):
    inside = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside

def sample_in(pts, tries=160):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1_, y0, y1_ = min(xs), max(xs), min(ys), max(ys)
    for _ in range(tries):
        x = RNG.uniform(x0, x1_)
        y = RNG.uniform(y0, y1_)
        if pip(x, y, pts):
            return x, y
    return (x0 + x1_) / 2, (y0 + y1_) / 2

LIGHT = (-0.55, -0.35)  # light from upper viewer-left, like the original

def hatch(pts, n, cx, cy, rx, ry, stops, wmin, wmax, opmin, opmax,
          lenmin, lenmax, tmin=None, tmax=None, noise=0.20, curve_amp=0.45,
          cjit=10, light=None, tf=None):
    light = light or LIGHT
    ecx = cx + light[0] * rx * 0.26
    ecy = cy + light[1] * ry * 0.26
    for _ in range(n):
        x, y = sample_in(pts)
        d = math.hypot((x - ecx) / rx, (y - ecy) / ry)
        t = clamp(1.18 - d * 0.92, 0.0, 1.0)
        if tf:
            t = tf(x, y, t)
        if tmin is not None and t < tmin:
            continue
        if tmax is not None and t > tmax:
            continue
        tt = clamp((t - (tmin or 0.0)) / max(1e-3, (tmax if tmax is not None else 1.0) - (tmin or 0.0)), 0, 1)
        c = jit(ramp(stops, tt), cjit)
        ang = math.atan2(y - cy, x - cx) + math.pi / 2 + RNG.uniform(-noise, noise)
        L = RNG.uniform(lenmin, lenmax)
        x0 = x - math.cos(ang) * L / 2
        y0 = y - math.sin(ang) * L / 2
        x1 = x + math.cos(ang) * L / 2
        y1 = y + math.sin(ang) * L / 2
        curve = curve_amp * L * RNG.choice([-1.0, 1.0]) * 0.5
        stroke(x0, y0, x1, y1, curve, c, RNG.uniform(wmin, wmax), RNG.uniform(opmin, opmax))

def flow(pts, n, fdir, stops, wmin, wmax, opmin, opmax, lenmin, lenmax,
         curve_amp=0.5, cjit=10, tf=None, avoid=None):
    for _ in range(n):
        x, y = sample_in(pts)
        if avoid and pip(x, y, avoid):
            continue
        t = 0.6
        if tf:
            t = clamp(tf(x, y), 0, 1)
        c = jit(ramp(stops, t), cjit)
        a = fdir(x, y) + RNG.uniform(-0.14, 0.14)
        L = RNG.uniform(lenmin, lenmax)
        x0, y0 = x - math.cos(a) * L / 2, y - math.sin(a) * L / 2
        x1, y1 = x + math.cos(a) * L / 2, y + math.sin(a) * L / 2
        curve = curve_amp * L * RNG.choice([-1.0, 1.0]) * 0.5
        stroke(x0, y0, x1, y1, curve, c, RNG.uniform(wmin, wmax), RNG.uniform(opmin, opmax))


def hatch2(pts, n, cx, cy, rx, ry, stops, wmin, wmax, opmin, opmax,
           lenmin, lenmax, tmin=None, tmax=None, damp=0.45, cjit=8,
           light=None, base_ang=0.0):
    """Sfumato hatch with DAMPED tangential direction: strokes stay near the
    contour direction without spooling into visible concentric rings."""
    light = light or LIGHT
    ecx = cx + light[0] * rx * 0.26
    ecy = cy + light[1] * ry * 0.26
    for _ in range(n):
        x, y = sample_in(pts)
        d = math.hypot((x - ecx) / rx, (y - ecy) / ry)
        t = clamp(1.16 - d * 0.9, 0.0, 1.0)
        if tmin is not None and t < tmin:
            continue
        if tmax is not None and t > tmax:
            continue
        tt = clamp((t - (tmin or 0.0)) / max(1e-3, (tmax if tmax is not None else 1.0) - (tmin or 0.0)), 0, 1)
        c = jit(ramp(stops, tt), cjit)
        tang = math.atan2(y - cy, x - cx) + math.pi / 2
        ang = base_ang + tang * damp + RNG.uniform(-0.35, 0.35)
        L = RNG.uniform(lenmin, lenmax)
        x0 = x - math.cos(ang) * L / 2
        y0 = y - math.sin(ang) * L / 2
        x1 = x + math.cos(ang) * L / 2
        y1 = y + math.sin(ang) * L / 2
        curve = L * RNG.choice([-1.0, 1.0]) * 0.12
        stroke(x0, y0, x1, y1, curve, c, RNG.uniform(wmin, wmax), RNG.uniform(opmin, opmax))

# ---------------------------------------------------------------- palettes v3
SKIN = [(0.00, (70, 43, 27)), (0.30, (116, 75, 45)), (0.58, (160, 110, 66)),
        (0.80, (192, 143, 90)), (1.00, (218, 172, 114))]
SKIN_BRIGHT = [(0.00, (84, 53, 31)), (0.35, (138, 93, 55)), (0.65, (182, 129, 78)),
               (0.85, (208, 157, 101)), (1.00, (226, 184, 126))]
SKIN_SHADOW = [(0.00, (42, 26, 17)), (0.5, (80, 51, 31)), (1.0, (124, 84, 50))]
GARMENT = [(0.00, (18, 16, 12)), (0.40, (40, 36, 25)), (0.70, (66, 59, 40)), (1.00, (98, 87, 57))]
SLEEVE = [(0.00, (60, 45, 26)), (0.45, (114, 86, 48)), (0.75, (148, 112, 64)), (1.00, (178, 140, 86))]
HAIR = [(0.00, (25, 17, 11)), (0.40, (50, 35, 21)), (0.70, (84, 58, 30)), (1.00, (120, 87, 46))]
SKY = [(0.00, (196, 196, 158)), (0.5, (160, 171, 132)), (1.00, (126, 141, 110))]
MTN_FAR = [(0.00, (150, 157, 120)), (0.5, (122, 134, 104)), (1.00, (96, 110, 92))]
ROCK_WARM = [(0.00, (82, 72, 46)), (0.5, (130, 112, 72)), (1.00, (166, 144, 94))]
ROCK_COOL = [(0.00, (102, 110, 88)), (0.5, (134, 140, 108)), (1.00, (168, 172, 132))]
WATER = [(0.00, (64, 90, 82)), (0.5, (90, 118, 104)), (1.00, (136, 160, 134))]

emit('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" width="1200" height="1600">')
emit('<title>Study replica after Leonardo da Vinci, Mona Lisa (pure vector brush strokes)</title>')
emit('<desc>Research vector replica built from several thousand short arc strokes organised in glazing layers. No bitmap content.</desc>')
emit('<defs><linearGradient id="skyWash" x1="0" y1="0" x2="0" y2="1">'
     '<stop offset="0" stop-color="#c2c19a"/><stop offset="0.45" stop-color="#a0a986"/>'
     '<stop offset="1" stop-color="#808e6d"/></linearGradient></defs>')

# ================================================================= 1 ground + 2 sky
emit('<g id="ground">')
poly([(0, 0), (W, 0), (W, H), (0, H)], (42, 38, 27))
emit('</g>')
emit('<g id="sky">')
emit('<rect x="0" y="0" width="1200" height="780" fill="url(#skyWash)"/>')
for _ in range(150):
    x = RNG.uniform(0, W)
    y = RNG.uniform(0, 620)
    t = clamp(1.0 - y / 620.0, 0, 1)
    c = jit(ramp(SKY, t), 6)
    L = RNG.uniform(150, 320)
    stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-3, 3), RNG.uniform(-2, 2), c,
           RNG.uniform(1.2, 2.6), RNG.uniform(0.04, 0.10))
emit('</g>')

# ================================================================= 3 far mountains
emit('<g id="mountains-far">')
ridgeL = [(0, 336), (52, 306), (128, 360), (214, 326), (296, 416), (372, 390), (432, 466), (432, 650), (0, 650)]
ridgeR = [(762, 476), (836, 428), (916, 458), (996, 402), (1076, 436), (1146, 388), (1200, 406), (1200, 630), (762, 630)]
poly(ridgeL, (110, 122, 96), 0.55)
poly(ridgeR, (120, 130, 102), 0.5)
for _ in range(200):
    pts = ridgeL if RNG.random() < 0.5 else ridgeR
    x, y = sample_in(pts)
    t = clamp((y - 300) / 350.0, 0, 1)
    c = jit(ramp(MTN_FAR, 1 - t), 7)
    L = RNG.uniform(24, 70)
    a = RNG.uniform(0.4, 0.8) * RNG.choice([-1, 1])
    stroke(x, y, x + L, y + L * a * 0.35, RNG.uniform(-6, 6), c, RNG.uniform(1.6, 3.2), RNG.uniform(0.10, 0.22))
emit('</g>')

# ================================================================= 4 left crags (warm)
emit('<g id="crags-left">')
crag1 = [(0, 300), (56, 272), (118, 334), (166, 316), (234, 406), (316, 474), (330, 560), (300, 644), (330, 724), (0, 744)]
crag2 = [(0, 434), (52, 424), (110, 504), (170, 564), (200, 644), (170, 764), (0, 804)]
poly(crag1, (106, 94, 60), 0.88)
poly(crag2, (90, 80, 52), 0.88)
for _ in range(240):
    pts = crag1 if RNG.random() < 0.6 else crag2
    x, y = sample_in(pts)
    t = clamp((y - 260) / 540.0, 0, 1)
    c = jit(ramp(ROCK_WARM, t), 9)
    a = RNG.choice([-1, 1]) * RNG.uniform(0.15, 0.45)
    L = RNG.uniform(14, 40)
    stroke(x, y, x + L, y + L * a, RNG.uniform(-4, 4), c, RNG.uniform(1.6, 3.4), RNG.uniform(0.16, 0.36))
for _ in range(55):
    x, y = sample_in(crag1)
    stroke(x, y, x + RNG.uniform(-10, 10), y + RNG.uniform(14, 38), RNG.uniform(-4, 4),
           jit((50, 44, 28), 7), RNG.uniform(1.6, 3.6), RNG.uniform(0.2, 0.38))
emit('</g>')

# ================================================================= 5 right spires (cool, hazy)
emit('<g id="spires-right">')
sp1 = [(856, 566), (900, 434), (964, 322), (1028, 238), (1090, 308), (1138, 284), (1200, 338), (1200, 566)]
poly(sp1, (128, 136, 106), 0.7)
for _ in range(170):
    x, y = sample_in(sp1)
    t = clamp((y - 230) / 340.0, 0, 1)
    c = jit(ramp(ROCK_COOL, 1 - t * 0.7), 7)
    L = RNG.uniform(14, 44)
    stroke(x, y, x + L * 0.25, y + L * (0.5 + RNG.random() * 0.6), RNG.uniform(-4, 4), c,
           RNG.uniform(1.5, 3), RNG.uniform(0.10, 0.26))
for _ in range(45):
    x, y = sample_in(sp1)
    stroke(x, y, x + RNG.uniform(30, 90), y + RNG.uniform(-2, 2), RNG.uniform(-3, 3),
           jit((184, 188, 146), 8), RNG.uniform(2, 4), RNG.uniform(0.06, 0.15))
emit('</g>')

# ================================================================= 6 water + bridge
emit('<g id="water">')
lakeL = [(0, 622), (424, 646), (416, 792), (0, 806)]
lakeR = [(762, 506), (1200, 482), (1200, 652), (774, 664)]
midW = [(420, 650), (770, 666), (770, 710), (420, 706)]
poly(lakeL, (84, 110, 100), 0.95)
poly(lakeR, (96, 122, 110), 0.95)
poly(midW, (80, 104, 96), 0.9)
for pts, n in ((lakeL, 120), (lakeR, 150), (midW, 45)):
    for _ in range(n):
        x, y = sample_in(pts)
        c = jit(ramp(WATER, RNG.random() * 0.9), 7)
        L = RNG.uniform(30, 110)
        stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-1.5, 1.5), RNG.uniform(-3, 3), c,
               RNG.uniform(1.4, 3), RNG.uniform(0.12, 0.28))
emit('</g>')
emit('<g id="bridge">')
emit('<path d="M 900 566 Q 1044 538 1186 560" fill="none" stroke="#94885f" stroke-width="6.5" opacity="0.7"/>')
for ax0, ax1, ay in ((920, 1000, 562), (1028, 1100, 550), (1116, 1184, 558)):
    midx = (ax0 + ax1) / 2
    emit('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" fill="none" stroke="#867a58" stroke-width="4.5" opacity="0.65"/>'
         % (ax0, ay, midx, ay + 26, ax1, ay))
for px in (962, 1062, 1148):
    emit('<path d="M %.0f %.0f L %.0f %.0f" stroke="#6e6448" stroke-width="3" opacity="0.55"/>'
         % (px, 556, px, 606))
for _ in range(55):
    x = RNG.uniform(905, 1190)
    y = RNG.uniform(540, 566)
    stroke(x, y, x + RNG.uniform(-16, 16), y + RNG.uniform(-2, 2), RNG.uniform(-2, 2),
           jit((146, 134, 98), 9), RNG.uniform(1.2, 2.4), RNG.uniform(0.25, 0.45))
for _ in range(30):
    x = RNG.uniform(910, 1190)
    y = RNG.uniform(576, 620)
    stroke(x - 20, y, x + 20, y + RNG.uniform(-1, 1), 2, jit((70, 92, 84), 8),
           RNG.uniform(1.5, 3), RNG.uniform(0.15, 0.3))
emit('</g>')

# ================================================================= 7 winding road + banks + haze
emit('<g id="road-left">')
emit('<path d="M 156 650 C 116 696 212 704 182 746 C 150 790 242 790 210 838 C 184 878 120 888 100 938 C 86 972 58 994 38 1024" '
     'fill="none" stroke="#8c7040" stroke-width="20" opacity="0.32"/>')
emit('<path d="M 156 650 C 116 696 212 704 182 746 C 150 790 242 790 210 838 C 184 878 120 888 100 938" '
     'fill="none" stroke="#6a5230" stroke-width="4" opacity="0.35"/>')
for _ in range(70):
    t = RNG.random()
    cx = 150 - 40 * t + 90 * math.sin(t * 9.0)
    cy = 650 + 380 * t
    x = cx + RNG.uniform(-34, 34)
    y = cy + RNG.uniform(-16, 16)
    stroke(x, y, x + RNG.uniform(-20, 20), y + RNG.uniform(-7, 7), RNG.uniform(-3, 3),
           jit((138, 110, 64), 10), RNG.uniform(1.4, 3), RNG.uniform(0.15, 0.35))
emit('</g>')
emit('<g id="banks">')
bankL = [(0, 792), (324, 812), (296, 1004), (0, 1026)]
bankR = [(790, 668), (838, 654), (886, 666), (942, 650), (998, 662), (1056, 648), (1114, 658), (1200, 646), (1200, 890), (826, 878)]
poly(bankL, (98, 85, 53), 0.85)
poly(bankR, (118, 89, 55), 0.85)
for _ in range(230):
    pts = bankR if RNG.random() < 0.6 else bankL
    x, y = sample_in(pts)
    t = clamp((y - 630) / 400.0, 0, 1)
    c = jit(ramp(ROCK_WARM, t * 0.85 + 0.1), 12)
    L = RNG.uniform(16, 50)
    stroke(x, y, x + L * RNG.uniform(-0.5, 0.5), y + RNG.uniform(5, 22), RNG.uniform(-4, 4), c,
           RNG.uniform(1.6, 3.6), RNG.uniform(0.15, 0.38))
for _ in range(55):
    x, y = sample_in(bankR)
    stroke(x, y, x + RNG.uniform(-8, 8), y + RNG.uniform(20, 50), RNG.uniform(-4, 4),
           jit((64, 48, 30), 7), RNG.uniform(1.6, 3.6), RNG.uniform(0.2, 0.4))
for _ in range(34):
    x, y = sample_in(bankR)
    emit('<path d="M %.1f %.1f a %.1f %.1f 0 1 0 0.1 0 Z" fill="#59683f" fill-opacity="0.45"/>'
         % (x, y, RNG.uniform(2, 5), RNG.uniform(2, 5)))
for _ in range(120):
    y = RNG.choice([RNG.uniform(460, 570), RNG.uniform(596, 676)])
    x = RNG.uniform(0, W)
    L = RNG.uniform(90, 220)
    c = jit((188, 194, 150), 8)
    stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-2, 2), RNG.uniform(-3, 3), c,
           RNG.uniform(2.5, 6), RNG.uniform(0.05, 0.13))
emit('</g>')

# ================================================================= 8 figure base
FACE = [(585, 180), (470, 205), (432, 338), (420, 420), (425, 495), (438, 548),
        (496, 594), (582, 616), (668, 598), (715, 552), (727, 500), (732, 424), (738, 342), (700, 236)]
NECK = [(514, 636), (656, 640), (682, 742), (716, 790), (752, 894), (588, 968), (428, 902), (452, 792), (482, 744)]
CHEST = [(482, 744), (682, 742), (716, 790), (752, 894), (588, 968), (428, 902), (452, 792)]
GARMENT_ALL = [(482, 744), (396, 800), (250, 874), (120, 986), (40, 1098), (0, 1185), (0, 1600),
               (1200, 1600), (1200, 1108), (1140, 1058), (1040, 986), (900, 894), (764, 798), (682, 742)]
emit('<g id="figure-base">')
poly(GARMENT_ALL, (42, 37, 26))
poly(CHEST, (162, 112, 68))
poly(NECK, (160, 110, 66))
poly(FACE, (160, 110, 66))
emit('</g>')

# ================================================================= 9 garment / dress
emit('<g id="dress">')
flow(GARMENT_ALL, 430, lambda x, y: math.atan2(1.0, 0.08 * math.sin(x * 0.012)), GARMENT,
     1.8, 4.0, 0.10, 0.30, 60, 170, curve_amp=0.12, avoid=CHEST,
     tf=lambda x, y: clamp(0.18 + 0.22 * math.sin(x * 0.010) + (1150 - abs(y - 1280)) / 2400.0, 0, 1))
for _ in range(34):
    x = RNG.uniform(500, 680)
    y = RNG.uniform(742, 768)
    stroke(x, y, x + RNG.uniform(-20, 20), y + RNG.uniform(-3, 3), RNG.uniform(-2, 2),
           jit((158, 108, 64), 8), RNG.uniform(2.5, 5), RNG.uniform(0.25, 0.5))
emit('<path d="M 434 902 Q 588 972 748 892" fill="none" stroke="#665026" stroke-width="12" opacity="0.6"/>')
for _ in range(60):
    t = RNG.random()
    x = 434 + 314 * t
    y = 902 + 70 * math.sin(math.pi * t) + RNG.uniform(-5, 5)
    stroke(x - 6, y - 2, x + 6, y + 2, RNG.uniform(-2, 2), jit((152, 118, 58), 10),
           RNG.uniform(1.0, 1.8), RNG.uniform(0.2, 0.42))
for _ in range(80):
    x, y = sample_in(GARMENT_ALL)
    if pip(x, y, CHEST):
        continue
    if y < 920 or RNG.random() < 0.35:
        stroke(x, y, x + RNG.uniform(-10, 10), y + RNG.uniform(35, 90), RNG.uniform(-3, 3),
               jit((80, 71, 47), 8), RNG.uniform(1.8, 3.2), RNG.uniform(0.06, 0.16))
for _ in range(46):
    x = RNG.uniform(370, 740)
    y = RNG.uniform(1180, 1540)
    stroke(x, y, x + RNG.uniform(-6, 6), y + RNG.uniform(45, 100), RNG.uniform(-3, 3),
           jit((26, 23, 17), 5), RNG.uniform(3.5, 8), RNG.uniform(0.10, 0.22))
for _ in range(40):
    x = RNG.uniform(420, 700)
    y = RNG.uniform(1000, 1300)
    stroke(x, y, x + RNG.uniform(-12, 12), y + RNG.uniform(40, 90), RNG.uniform(-3, 3),
           jit((92, 82, 55), 8), RNG.uniform(2, 4), RNG.uniform(0.05, 0.13))
emit('</g>')

# ================================================================= 10 sleeves
emit('<g id="sleeves">')
SLEEVE_L = [(0, 1120), (200, 1178), (360, 1252), (430, 1292), (414, 1356), (300, 1378), (140, 1356), (0, 1336)]
SLEEVE_R = [(772, 1090), (1200, 1030), (1200, 1430), (1010, 1396), (846, 1332), (776, 1244)]
poly(SLEEVE_L, (104, 80, 46), 0.95)
poly(SLEEVE_R, (40, 36, 25), 0.95)
flow(SLEEVE_L, 230, lambda x, y: 0.45, SLEEVE, 1.8, 4.0, 0.25, 0.55, 45, 120, curve_amp=0.1,
     tf=lambda x, y: clamp(0.25 + (x / 520.0) + 0.15 * math.sin(y * 0.04), 0, 1))
flow(SLEEVE_R, 210, lambda x, y: math.atan2(1.0, -0.3), GARMENT, 2.0, 4.2, 0.16, 0.4, 45, 120,
     curve_amp=0.12, tf=lambda x, y: clamp(0.18 + 0.22 * math.sin(x * 0.016), 0, 1))
for i in range(11):
    x0 = 20 + i * 34
    y0 = 1146 + i * 17
    emit('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" fill="none" stroke="#48341e" stroke-width="4.5" opacity="0.45"/>'
         % (x0, y0, x0 + 74, y0 + 84, x0 + 158, y0 + 176))
    emit('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" fill="none" stroke="#a8844a" stroke-width="2.2" opacity="0.5"/>'
         % (x0 - 6, y0 - 2, x0 + 68, y0 + 82, x0 + 152, y0 + 174))
emit('</g>')

# ================================================================= 11 neck + chest sfumato
emit('<g id="neck-chest">')
for _ in range(80):
    x, y = sample_in(NECK)
    if y < 690:
        c = jit(ramp(SKIN_SHADOW, 0.3), 8)
    else:
        tt = clamp(1 - abs(y - 820) / 280.0, 0, 1)
        c = jit(ramp(SKIN, clamp(tt * 0.75, 0, 1)), 8)
    L = RNG.uniform(9, 24)
    a = RNG.uniform(-0.3, 0.3)
    stroke(x - L / 2, y, x + L / 2, y + L * a * 0.4, RNG.uniform(-2, 2), c,
           RNG.uniform(1.6, 3.2), RNG.uniform(0.10, 0.24))
hatch2(CHEST, 290, 588, 862, 190, 115, SKIN_BRIGHT, 1.4, 3.0, 0.09, 0.24, 10, 22,
       light=(-0.5, -0.3), damp=0.12)
for _ in range(22):
    t = RNG.random()
    x = 500 + 286 * t
    y = 776 + 16 * math.sin(math.pi * t) + RNG.uniform(-4, 4)
    stroke(x, y, x + RNG.uniform(14, 26), y + RNG.uniform(2, 6), RNG.uniform(-2, 2),
           jit((112, 74, 42), 8), RNG.uniform(1.6, 2.6), RNG.uniform(0.15, 0.3))
for _ in range(60):
    x, y = sample_in(CHEST)
    d = math.hypot((x - 572) / 140.0, (y - 878) / 100.0)
    if d < 1.0:
        c = jit(ramp(SKIN_BRIGHT, 0.7 + 0.3 * (1 - d)), 7)
        L = RNG.uniform(9, 22)
        stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-2, 2), RNG.uniform(-2, 2), c,
               RNG.uniform(2, 4.5), RNG.uniform(0.10, 0.24))
emit('</g>')

# ================================================================= 12 face sfumato (layered, ring-free)
FR1 = [(432, 338), (585, 248), (738, 342), (730, 416), (585, 428), (442, 414)]
CHL = [(425, 470), (520, 452), (536, 520), (520, 560), (484, 596), (438, 548)]
CHR = [(727, 505), (636, 452), (618, 520), (640, 566), (678, 600), (715, 552)]
CHIN = [(520, 566), (648, 562), (678, 600), (582, 616), (484, 596)]
emit('<g id="face-sfumato-1">')
hatch2(FR1, 80, 585, 330, 150, 88, SKIN_SHADOW, 3, 6.5, 0.06, 0.16, 10, 26, tmax=0.5, damp=0.4)
hatch2(CHL, 45, 474, 508, 60, 70, SKIN_SHADOW, 3, 6.5, 0.06, 0.16, 9, 22, tmax=0.5, light=(-0.5, 0.1))
hatch2(CHR, 80, 678, 510, 60, 70, SKIN_SHADOW, 3, 7, 0.10, 0.22, 9, 24, light=(0.55, 0.05))
hatch2(CHIN, 35, 582, 588, 70, 36, SKIN_SHADOW, 3, 6, 0.06, 0.16, 9, 22, tmax=0.5)
for _ in range(50):
    x = RNG.uniform(430, 462) if RNG.random() < 0.5 else RNG.uniform(710, 740)
    y = RNG.uniform(360, 560)
    c = jit(ramp(SKIN_SHADOW, 0.55), 8)
    stroke(x, y, x + RNG.uniform(-5, 5), y + RNG.uniform(12, 28), RNG.uniform(-2, 2), c,
           RNG.uniform(2.2, 4.4), RNG.uniform(0.13, 0.28))
for _ in range(40):
    x, y = RNG.uniform(452, 720), RNG.uniform(254, 292)
    stroke(x, y, x + RNG.uniform(-10, 10), y + RNG.uniform(6, 16), RNG.uniform(-2, 2),
           jit((106, 68, 40), 8), RNG.uniform(2.2, 4.4), RNG.uniform(0.10, 0.22))
emit('</g>')
emit('<g id="face-sfumato-2">')
hatch2(FR1, 150, 585, 330, 150, 88, SKIN, 1.5, 3.6, 0.15, 0.36, 9, 22, damp=0.4)
hatch2(CHL, 130, 474, 508, 60, 70, SKIN, 1.5, 3.6, 0.16, 0.38, 8, 20, light=(-0.5, 0.1))
hatch2(CHR, 105, 678, 510, 60, 70, SKIN, 1.5, 3.6, 0.15, 0.36, 8, 20, light=(0.5, 0.05))
hatch2(CHIN, 80, 582, 588, 70, 36, SKIN, 1.4, 3.2, 0.10, 0.26, 8, 18)
emit('</g>')
emit('<g id="face-sfumato-3">')
hatch2(FR1, 105, 585, 330, 150, 88, SKIN_BRIGHT, 1.4, 3.2, 0.13, 0.32, 8, 20, tmin=0.4, light=(-0.55, -0.35), damp=0.3)
hatch2(CHL, 70, 474, 508, 60, 70, SKIN_BRIGHT, 1.4, 3.2, 0.13, 0.32, 8, 18, tmin=0.42, light=(-0.5, 0.05), damp=0.3)
hatch2(CHIN, 40, 582, 588, 70, 36, SKIN_BRIGHT, 1.4, 3.2, 0.13, 0.30, 8, 18, tmin=0.48, damp=0.3)
for _ in range(45):
    x, y = 585 + RNG.uniform(-8, 8), RNG.uniform(440, 506)
    c = jit(ramp(SKIN_BRIGHT, 0.82), 7)
    stroke(x - 1.5, y, x + 1.5, y + RNG.uniform(8, 16), RNG.uniform(-1, 1), c, RNG.uniform(1.6, 3),
           RNG.uniform(0.14, 0.3))
for _ in range(36):
    x, y = 472 + RNG.uniform(-14, 14), 472 + RNG.uniform(-10, 10)
    c = jit(ramp(SKIN_BRIGHT, 0.75), 7)
    stroke(x, y, x + RNG.uniform(-9, 9), y + RNG.uniform(-5, 5), RNG.uniform(-2, 2), c,
           RNG.uniform(1.8, 3.4), RNG.uniform(0.10, 0.22))
emit('</g>')

# ================================================================= 13 features
emit('<g id="features">')
def eye(cx, cy, wd):
    ix, ox = cx - wd / 2, cx + wd / 2
    emit('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f Q %.1f %.1f %.1f %.1f Z" fill="#b49a74" fill-opacity="0.9"/>'
         % (ix, cy, cx, cy - 11, ox, cy, cx, cy + 8, ix, cy))
    emit('<path d="M %.1f %.1f a 10 10 0 1 0 0.1 0 Z" fill="#463322" fill-opacity="0.92"/>' % (cx + 1, cy + 0.5))
    emit('<path d="M %.1f %.1f a 4.2 4.2 0 1 0 0.1 0 Z" fill="#181209"/>' % (cx + 1, cy + 1))
    emit('<path d="M %.1f %.1f a 2 2 0 1 0 0.1 0 Z" fill="#c2aa82" fill-opacity="0.7"/>' % (cx - 2.5, cy - 3))
    emit('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f" fill="none" stroke="#241a10" stroke-width="1.8" opacity="0.5"/>'
         % (ix, cy, cx, cy - 10, ox, cy))
    emit('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f" fill="none" stroke="#b89a6e" stroke-width="1.1" opacity="0.35"/>'
         % (ix + 3, cy + 6, cx, cy + 10, ox - 3, cy + 5))
    for _ in range(12):
        x = RNG.uniform(ix, ox)
        t = (x - ix) / wd
        y = cy - (13 + 4 * math.sin(math.pi * t))
        stroke(x, y, x + RNG.uniform(5, 11) * RNG.choice([-1, 1]), y + RNG.uniform(-2, 2),
               RNG.uniform(-1.5, 1.5), jit((96, 64, 38), 7), RNG.uniform(1.3, 2.4), RNG.uniform(0.12, 0.26))
    for _ in range(7):
        x = RNG.uniform(ix, ox)
        y = cy + RNG.uniform(11, 15)
        stroke(x, y, x + RNG.uniform(-8, 8), y + RNG.uniform(2, 4), RNG.uniform(-2, 2),
               jit((146, 106, 64), 7), RNG.uniform(1, 1.8), RNG.uniform(0.10, 0.2))
eye(490, 432, 66)
eye(692, 434, 66)
for cx0, cy0, cx1, cy1 in ((460, 414, 548, 394), (636, 396, 724, 416)):
    for _ in range(15):
        t = RNG.random()
        bx = cx0 + (cx1 - cx0) * t
        by = cy0 + (cy1 - cy0) * t - 9 * math.sin(math.pi * t)
        a = math.atan2(cy1 - cy0, cx1 - cx0) + RNG.uniform(-0.18, 0.18)
        L = RNG.uniform(9, 20)
        stroke(bx, by, bx + math.cos(a) * L, by + math.sin(a) * L, RNG.uniform(-2, 2),
               jit((104, 72, 44), 9), RNG.uniform(1.6, 2.8), RNG.uniform(0.2, 0.4))
emit('<path d="M 560 444 Q 548 480 550 510" fill="none" stroke="#52341e" stroke-width="5" opacity="0.2"/>')
emit('<path d="M 616 446 Q 614 484 616 512" fill="none" stroke="#462c18" stroke-width="6" opacity="0.24"/>')
emit('<path d="M 546 518 Q 553 525 566 523" fill="none" stroke="#3c2413" stroke-width="2.2" opacity="0.7"/>')
emit('<path d="M 620 519 Q 613 526 601 523" fill="none" stroke="#3c2413" stroke-width="2.2" opacity="0.7"/>')
emit('<path d="M 576 527 Q 583 531 592 527" fill="none" stroke="#5a3820" stroke-width="2.4" opacity="0.3"/>')
emit('<path d="M 585 532 Q 585 540 585 546" fill="none" stroke="#a47a4e" stroke-width="2" opacity="0.3"/>')
emit('<path d="M 526 564 Q 556 550 578 554 Q 585 556 594 554 Q 620 550 646 556 Q 585 568 526 564 Z" '
     'fill="#76402a" fill-opacity="0.6"/>')
emit('<path d="M 530 567 Q 556 583 585 582 Q 614 580 644 558 Q 585 571 530 567 Z" '
     'fill="#8e5336" fill-opacity="0.65"/>')
emit('<path d="M 526 564 Q 554 570 585 568 Q 615 565 646 556" fill="none" stroke="#4c2418" stroke-width="2.2" opacity="0.5"/>')
emit('<path d="M 556 577 Q 583 582 612 576" fill="none" stroke="#bd8a5c" stroke-width="1.8" opacity="0.4"/>')
for _ in range(26):
    side = RNG.choice([-1, 1])
    x = 526 + (120 if side > 0 else 0) + RNG.uniform(-6, 6)
    y = 559 + RNG.uniform(-5, 5)
    c = jit(ramp(SKIN_SHADOW, 0.62), 7)
    stroke(x, y, x + RNG.uniform(5, 12) * side, y + RNG.uniform(-3, 3), RNG.uniform(-2, 2), c,
           RNG.uniform(1.6, 3.2), RNG.uniform(0.08, 0.2))
emit('<path d="M 566 592 Q 584 598 604 592" fill="none" stroke="#4e301b" stroke-width="3.6" opacity="0.22"/>')
emit('<path d="M 574 600 Q 584 604 596 600" fill="none" stroke="#c09258" stroke-width="2.4" opacity="0.3"/>')
for _ in range(48):
    x = RNG.uniform(508, 662)
    y = RNG.uniform(638, 686)
    stroke(x, y, x + RNG.uniform(-8, 8), y + RNG.uniform(4, 12), RNG.uniform(-2, 2),
           jit((84, 52, 30), 7), RNG.uniform(2.2, 4.4), RNG.uniform(0.12, 0.28))
for _ in range(40):
    side = RNG.choice([0, 1])
    x = RNG.uniform(506, 530) if side == 0 else RNG.uniform(640, 666)
    y = RNG.uniform(660, 800)
    stroke(x, y, x + RNG.uniform(-4, 4), y + RNG.uniform(16, 40), RNG.uniform(-3, 3),
           jit((118, 76, 44), 8), RNG.uniform(2.5, 5), RNG.uniform(0.10, 0.22))
emit('</g>')

# ================================================================= 14 hair + veil
HAIR_L = [(585, 178), (470, 205), (382, 290), (336, 400), (330, 515), (360, 640), (408, 752), (430, 845),
          (462, 852), (470, 700), (448, 600), (432, 520), (424, 430), (438, 345), (478, 300), (585, 252)]
HAIR_R = [(585, 178), (700, 208), (794, 298), (844, 412), (848, 526), (818, 650), (768, 760), (746, 846),
          (710, 852), (716, 700), (736, 600), (730, 520), (722, 432), (732, 348), (692, 302), (585, 252)]
CROWN = [(438, 345), (585, 252), (730, 348), (736, 300), (676, 213), (560, 180), (468, 248)]
CROWN_IN = [(446, 340), (585, 262), (722, 346), (726, 306), (668, 226), (560, 194), (476, 256)]
emit('<g id="hair">')
poly(HAIR_L, (45, 31, 20), 0.97)
poly(HAIR_R, (41, 28, 18), 0.97)
poly(CROWN, (52, 37, 23), 0.92)
def hair_dir_l(x, y):
    return math.atan2(1.0, -0.16 + 0.10 * math.sin(y * 0.02)) + 0.16 * math.sin(y * 0.028)
def hair_dir_r(x, y):
    return math.atan2(1.0, 0.18 + 0.10 * math.sin(y * 0.021)) + 0.16 * math.sin(y * 0.029)
flow(HAIR_L, 250, hair_dir_l, HAIR, 1.6, 3.8, 0.28, 0.6, 30, 85, curve_amp=0.3,
     tf=lambda x, y: clamp(0.26 + 0.3 * math.sin(x * 0.022 + y * 0.007), 0, 1))
flow(HAIR_R, 250, hair_dir_r, HAIR, 1.6, 3.8, 0.28, 0.6, 30, 85, curve_amp=0.3,
     tf=lambda x, y: clamp(0.26 + 0.3 * math.sin(x * 0.021 + y * 0.008), 0, 1))
for _ in range(140):
    x, y = sample_in(CROWN_IN)
    ang = math.atan2(y - 320, x - 585) + math.pi / 2
    ang = max(-0.7, min(0.7, ang)) + RNG.uniform(-0.2, 0.2)
    L = RNG.uniform(12, 26)
    c = jit(ramp(HAIR, clamp(0.3 + 0.4 * (1 - (y - 180) / 150.0), 0, 1)), 8)
    stroke(x - math.cos(ang) * L / 2, y - math.sin(ang) * L / 2,
           x + math.cos(ang) * L / 2, y + math.sin(ang) * L / 2,
           RNG.uniform(-4, 4), c, RNG.uniform(1.6, 3), RNG.uniform(0.2, 0.42))
for _ in range(55):
    pts = HAIR_L if RNG.random() < 0.5 else HAIR_R
    x, y = sample_in(pts)
    L = RNG.uniform(26, 70)
    a = hair_dir_l(x, y) if pts is HAIR_L else hair_dir_r(x, y)
    taper(x, y, x + math.cos(a) * L, y + math.sin(a) * L, RNG.uniform(2, 4), RNG.uniform(-8, 8),
          jit((100, 72, 40), 10), RNG.uniform(0.18, 0.32))
for _ in range(22):
    t = RNG.random()
    if t < 0.5:
        x, y = 438 + RNG.uniform(-4, 12), RNG.uniform(340, 560)
    else:
        x, y = 728 + RNG.uniform(-12, 4), RNG.uniform(350, 570)
    stroke(x, y, x + RNG.uniform(-3, 3), y + RNG.uniform(12, 28), RNG.uniform(-3, 3),
           jit((92, 64, 36), 8), RNG.uniform(1.4, 2.6), RNG.uniform(0.10, 0.2))
emit('<path d="M 446 556 C 432 636 428 700 438 772 C 441 792 444 806 448 818" fill="none" stroke="#302013" stroke-width="8" opacity="0.8"/>')
emit('<path d="M 451 560 C 439 638 435 700 444 768" fill="none" stroke="#63441f" stroke-width="2.4" opacity="0.4"/>')
emit('<path d="M 722 574 C 736 654 740 718 730 788 C 727 806 724 820 720 830" fill="none" stroke="#2e1f12" stroke-width="8" opacity="0.8"/>')
emit('<path d="M 717 576 C 729 656 733 718 725 784" fill="none" stroke="#5d3f1d" stroke-width="2.4" opacity="0.38"/>')
emit('<path d="M 444 700 C 440 740 440 770 444 796" fill="none" stroke="#3a2a18" stroke-width="4" opacity="0.4"/>')
emit('<path d="M 733 716 C 736 752 736 780 732 804" fill="none" stroke="#382816" stroke-width="4" opacity="0.38"/>')
emit('</g>')
emit('<g id="veil">')
emit('<path d="M 398 288 Q 585 118 832 296" fill="none" stroke="#ac9668" stroke-width="2.2" opacity="0.22"/>')
emit('<path d="M 830 298 Q 850 416 842 502" fill="none" stroke="#a8925f" stroke-width="1.8" opacity="0.14"/>')
emit('<path d="M 400 290 Q 382 408 392 498" fill="none" stroke="#a8925f" stroke-width="1.6" opacity="0.11"/>')
for _ in range(48):
    t = RNG.random()
    x = 398 + 434 * t
    y = 280 + (150 - 132 * math.sin(math.pi * t)) + RNG.uniform(-7, 7)
    stroke(x, y, x + RNG.uniform(-14, 14), y + RNG.uniform(-3, 3), RNG.uniform(-3, 3),
           jit((168, 148, 104), 9), RNG.uniform(1.2, 2.4), RNG.uniform(0.05, 0.13))
emit('</g>')

# ================================================================= 15 armrest
emit('<g id="armrest">')
poly([(200, 1462), (980, 1352), (988, 1382), (208, 1496)], (36, 23, 15), 0.95)
emit('<path d="M 206 1466 Q 590 1408 982 1356" fill="none" stroke="#4e341e" stroke-width="2.2" opacity="0.4"/>')
for _ in range(32):
    t = RNG.random()
    x = 215 + 760 * t
    y = 1466 - 110 * t + RNG.uniform(-4, 4)
    stroke(x, y, x + RNG.uniform(-30, 30), y + RNG.uniform(-3, 3), RNG.uniform(-2, 2),
           jit((50, 32, 20), 6), RNG.uniform(1.6, 3), RNG.uniform(0.18, 0.36))
emit('</g>')

# ================================================================= 16 hands + forearms
emit('<g id="forearms">')
FOREARM_L = [(708, 1386), (1008, 1322), (1022, 1368), (716, 1428)]
poly(FOREARM_L, (152, 104, 64), 0.97)
for _ in range(80):
    x, y = sample_in(FOREARM_L)
    d = math.hypot((x - 860) / 160.0, (y - 1370) / 32.0)
    t = clamp(1.1 - d * 0.9, 0, 1)
    c = jit(ramp(SKIN_BRIGHT, t), 8)
    L = RNG.uniform(9, 24)
    stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-2, 2), RNG.uniform(-2, 2), c,
           RNG.uniform(1.6, 3.4), RNG.uniform(0.18, 0.4))
FOREARM_R = [(0, 1268), (360, 1348), (352, 1394), (0, 1352)]
poly(FOREARM_R, (120, 92, 52), 0.95)
for _ in range(70):
    x, y = sample_in(FOREARM_R)
    t = clamp(0.2 + (x / 380.0) + 0.15 * math.sin(y * 0.05), 0, 1)
    c = jit(ramp(SLEEVE, t), 9)
    a = 0.42 + RNG.uniform(-0.12, 0.12)
    L = RNG.uniform(14, 36)
    stroke(x - math.cos(a) * L / 2, y - math.sin(a) * L / 2,
           x + math.cos(a) * L / 2, y + math.sin(a) * L / 2, RNG.uniform(-3, 3), c,
           RNG.uniform(1.6, 3.4), RNG.uniform(0.2, 0.45))
for i in range(6):
    x0 = 10 + i * 58
    y0 = 1272 + i * 12
    emit('<path d="M %.0f %.0f Q %.0f %.0f %.0f %.0f" fill="none" stroke="#503a20" stroke-width="4" opacity="0.45"/>'
         % (x0, y0, x0 + 90, y0 + 46, x0 + 190, y0 + 88))
emit('</g>')
emit('<g id="hands">')
poly([(430, 1420), (582, 1416), (578, 1454), (436, 1462)], (148, 100, 60), 0.97)
LHAND = [(702, 1378), (580, 1386), (566, 1444), (700, 1456)]
poly(LHAND, (184, 132, 84), 0.97)
for _ in range(60):
    x, y = sample_in(LHAND)
    d = math.hypot((x - 630) / 70.0, (y - 1412) / 34.0)
    t = clamp(1.15 - d * 0.85, 0, 1)
    c = jit(ramp(HAND_BRIGHT if False else SKIN_BRIGHT, t), 8)
    L = RNG.uniform(8, 20)
    stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-2, 2), RNG.uniform(-2, 2), c,
           RNG.uniform(1.5, 3.2), RNG.uniform(0.16, 0.38))
fingers_L = [((578, 1394), (462, 1398), 12), ((576, 1408), (452, 1414), 12),
             ((578, 1422), (458, 1432), 11), ((582, 1436), (472, 1448), 9)]
for a, b, w0 in fingers_L:
    taper(a[0], a[1], b[0], b[1], w0, RNG.uniform(-3, 4), jit((202, 150, 100), 7), 0.96)
    stroke((a[0] + b[0]) / 2 - 40, (a[1] + b[1]) / 2 + 8, (a[0] + b[0]) / 2 + 40, (a[1] + b[1]) / 2 + 9, 2,
           jit((138, 92, 58), 7), 1.2, 0.45)
for ky in (1400, 1414, 1428):
    emit('<path d="M 568 %.0f Q 578 %.0f 588 %.0f" fill="none" stroke="#82562f" stroke-width="1.5" opacity="0.35"/>'
         % (ky, ky - 4, ky))
taper(668, 1370, 636, 1358, 14, 5, jit((194, 142, 92), 7), 0.95)
RHAND = [(360, 1370), (438, 1430), (410, 1482), (326, 1448)]
poly(RHAND, (176, 122, 76), 0.97)
for _ in range(40):
    x, y = sample_in(RHAND)
    d = math.hypot((x - 386) / 48.0, (y - 1424) / 40.0)
    t = clamp(1.15 - d * 0.85, 0, 1)
    c = jit(ramp(SKIN_BRIGHT, t), 8)
    L = RNG.uniform(7, 18)
    stroke(x - L / 2, y, x + L / 2, y + RNG.uniform(-2, 2), RNG.uniform(-2, 2), c,
           RNG.uniform(1.4, 3), RNG.uniform(0.16, 0.36))
fingers_R = [((420, 1442), (332, 1498), 10), ((432, 1454), (348, 1506), 9), ((444, 1464), (366, 1510), 8)]
for a, b, w0 in fingers_R:
    taper(a[0], a[1], b[0], b[1], w0, RNG.uniform(4, 9), jit((196, 144, 94), 7), 0.95)
for _ in range(12):
    x = RNG.uniform(575, 700)
    y = RNG.uniform(1448, 1466)
    stroke(x, y, x + RNG.uniform(-22, 22), y + RNG.uniform(-2, 2), RNG.uniform(-2, 2),
           jit((66, 42, 25), 6), RNG.uniform(1.8, 3.6), RNG.uniform(0.12, 0.26))
emit('</g>')

emit('<g id="glaze-final">')
for _ in range(95):
    pts = RNG.choice([FACE, CHEST])
    x, y = sample_in(pts)
    cx, cy = (585, 340) if pts is FACE else (588, 856)
    ang = math.atan2(y - cy, x - cx) + math.pi / 2
    L = RNG.uniform(24, 64)
    c = jit((210, 156, 96), 14)
    stroke(x, y, x + math.cos(ang) * L, y + math.sin(ang) * L, RNG.uniform(-6, 6), c,
           RNG.uniform(4, 9), RNG.uniform(0.03, 0.06))
for _ in range(110):
    side = RNG.random()
    if side < 0.35:
        x, y = RNG.uniform(0, 210), RNG.uniform(0, H)
    elif side < 0.7:
        x, y = RNG.uniform(990, 1200), RNG.uniform(0, H)
    else:
        x, y = RNG.uniform(0, 1200), RNG.uniform(1400, 1600)
    c = jit((20, 18, 12), 5)
    L = RNG.uniform(50, 140)
    stroke(x, y, x + RNG.uniform(-L, L), y + RNG.uniform(-L, L), RNG.uniform(-14, 14), c,
           RNG.uniform(7, 16), RNG.uniform(0.05, 0.13))
for _ in range(55):
    x, y = RNG.uniform(0, W), RNG.uniform(0, H)
    L = RNG.uniform(110, 240)
    stroke(x, y, x + RNG.uniform(-L, L) * 0.4, y + L * 0.3, RNG.uniform(-16, 16), jit((146, 112, 66), 11),
           RNG.uniform(9, 18), RNG.uniform(0.03, 0.05))
emit('</g>')
emit('</svg>')

svg = '\n'.join(out) + '\n'
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'answer.svg')
with open(dst, 'w', encoding='utf-8') as f:
    f.write(svg)
print('paths:', NPCOUNT[0])
print('bytes:', os.path.getsize(dst))
print('written:', dst)
