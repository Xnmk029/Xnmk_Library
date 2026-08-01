import colorsys
import math
import random
import sys

random.seed(1503)

WIDTH = 1200
HEIGHT = 1600

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def rgb_to_hex(r, g, b):
    r = max(0, min(255, int(r * 255)))
    g = max(0, min(255, int(g * 255)))
    b = max(0, min(255, int(b * 255)))
    return f"#{r:02x}{g:02x}{b:02x}"

def jitter_color(hex_color, h_jit=0.015, s_jit=0.03, l_jit=0.03):
    r, g, b = hex_to_rgb(hex_color)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    
    h = (h + random.gauss(0, h_jit)) % 1.0
    s = max(0.0, min(1.0, s + random.gauss(0, s_jit)))
    l = max(0.02, min(0.98, l + random.gauss(0, l_jit)))
    
    r_new, g_new, b_new = colorsys.hls_to_rgb(h, l, s)
    return rgb_to_hex(r_new, g_new, b_new)

class SVGBuilder:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.groups = {}
        self.group_order = []

    def add_group(self, group_id):
        if group_id not in self.groups:
            self.groups[group_id] = []
            self.group_order.append(group_id)

    def add_stroke(self, group_id, x0, y0, length, angle_rad, curvature, color, width, opacity, h_jit=0.012, s_jit=0.025, l_jit=0.025):
        self.add_group(group_id)
        
        c = jitter_color(color, h_jit, s_jit, l_jit) if (h_jit or s_jit or l_jit) else color
        
        x1 = x0 + length * math.cos(angle_rad)
        y1 = y0 + length * math.sin(angle_rad)
        
        mx = (x0 + x1) / 2.0
        my = (y0 + y1) / 2.0
        perp_angle = angle_rad + math.pi / 2.0
        cx = mx + curvature * length * math.cos(perp_angle)
        cy = my + curvature * length * math.sin(perp_angle)
        
        path_data = f"M {x0:.1f} {y0:.1f} Q {cx:.1f} {cy:.1f} {x1:.1f} {y1:.1f}"
        stroke_elm = f'<path d="{path_data}" stroke="{c}" stroke-width="{width:.2f}" stroke-linecap="round" fill="none" opacity="{opacity:.2f}"/>'
        self.groups[group_id].append(stroke_elm)

    def render(self):
        svg = []
        svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" width="100%" height="100%">')
        svg.append('  <style>')
        svg.append('    svg { background-color: #0a0806; }')
        svg.append('  </style>')
        svg.append('  <rect width="100%" height="100%" fill="#0a0806"/>')
        
        for g_id in self.group_order:
            svg.append(f'  <g id="{g_id}">')
            svg.extend(f'    {elm}' for elm in self.groups[g_id])
            svg.append('  </g>')
            
        svg.append('</svg>')
        return '\n'.join(svg)

def build_mona_lisa():
    builder = SVGBuilder(WIDTH, HEIGHT)
    print("Generating Masterpiece Mona Lisa Pure SVG Artwork...")

    # -------------------------------------------------------------
    # 1. BASE CANVAS & OIL GLAZING (Deep Underpainting)
    # -------------------------------------------------------------
    for _ in range(800):
        x0 = random.uniform(-100, WIDTH + 100)
        y0 = random.uniform(-100, HEIGHT + 100)
        angle = random.uniform(-0.25, 0.25)
        length = random.uniform(160, 380)
        curv = random.uniform(-0.06, 0.06)
        col = random.choice(['#0c0a07', '#130f0b', '#1a140e', '#201911', '#171e1c', '#111716'])
        w = random.uniform(16, 34)
        op = random.uniform(0.25, 0.55)
        builder.add_stroke("underpainting-glaze", x0, y0, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 2. SKY & ATMOSPHERIC PERSPECTIVE
    # -------------------------------------------------------------
    sky_top = ['#162529', '#203136', '#2b4047', '#3a525a', '#4a656e']
    sky_mid = ['#456065', '#557276', '#688588', '#7b999a', '#746a55']
    sky_horizon = ['#686452', '#7a715b', '#565648', '#424740']

    for _ in range(1500):
        x0 = random.uniform(-50, WIDTH + 50)
        y0 = random.uniform(-20, 480)
        
        if y0 < 190:
            col = random.choice(sky_top)
            w = random.uniform(5, 13)
            op = random.uniform(0.3, 0.65)
        elif y0 < 350:
            col = random.choice(sky_mid)
            w = random.uniform(4, 9.5)
            op = random.uniform(0.35, 0.7)
        else:
            col = random.choice(sky_horizon)
            w = random.uniform(3, 7.5)
            op = random.uniform(0.4, 0.75)
            
        angle = random.gauss(0, 0.08)
        length = random.uniform(50, 160)
        curv = random.uniform(-0.04, 0.04)
        builder.add_stroke("background-sky", x0, y0, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 3. DISTANT MISTY MOUNTAINS
    # -------------------------------------------------------------
    mtn_far = ['#23373c', '#2f494f', '#3f5d64', '#52747b', '#6a8d94']
    for _ in range(800):
        x0 = random.uniform(30, 520)
        y0 = random.uniform(280, 570)
        slope = -0.55 if x0 < 280 else 0.45
        angle = slope + random.gauss(0, 0.12)
        length = random.uniform(30, 80)
        curv = random.uniform(-0.08, 0.08)
        col = random.choice(mtn_far)
        w = random.uniform(3, 7.5)
        op = random.uniform(0.3, 0.7)
        builder.add_stroke("distant-mountains-left", x0, y0, length, angle, curv, col, w, op)

    for _ in range(800):
        x0 = random.uniform(680, 1170)
        y0 = random.uniform(260, 550)
        slope = 0.5 if x0 < 920 else -0.5
        angle = slope + random.gauss(0, 0.12)
        length = random.uniform(30, 80)
        curv = random.uniform(-0.08, 0.08)
        col = random.choice(mtn_far)
        w = random.uniform(3, 7.5)
        op = random.uniform(0.3, 0.7)
        builder.add_stroke("distant-mountains-right", x0, y0, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 4. LANDSCAPE: PATH, RIVER, BRIDGE, CLIFFS
    # -------------------------------------------------------------
    path_cols = ['#573b23', '#724f30', '#8e633d', '#a9784c', '#c18f5f', '#d8a575']
    for _ in range(600):
        t = random.uniform(0, 1)
        py = 940 - t * 360
        px = 220 + math.sin(t * math.pi * 2.2) * 75 + (1 - t) * 40
        angle = math.atan2(-360, (math.cos(t * math.pi * 2.2) * 75 * math.pi * 2.2 - 40)) + random.gauss(0, 0.1)
        length = random.uniform(15, 45)
        curv = random.uniform(-0.04, 0.04)
        col = random.choice(path_cols)
        w = random.uniform(2.5, 6)
        op = random.uniform(0.4, 0.85)
        builder.add_stroke("winding-path-left", px, py, length, angle, curv, col, w, op)

    left_hills = ['#161e14', '#212c1d', '#2f3b28', '#404631', '#2e2418', '#201810']
    for _ in range(1000):
        x0 = random.uniform(10, 480)
        y0 = random.uniform(540, 960)
        angle = random.gauss(0.6, 0.2)
        length = random.uniform(25, 75)
        curv = random.uniform(-0.08, 0.08)
        col = random.choice(left_hills)
        w = random.uniform(3.5, 8.5)
        op = random.uniform(0.35, 0.75)
        builder.add_stroke("landscape-hills-left", x0, y0, length, angle, curv, col, w, op)

    river_cols = ['#16282b', '#213b41', '#305058', '#436871', '#59818b', '#729ca5']
    for _ in range(600):
        t = random.uniform(0, 1)
        ry = 960 - t * 340
        rx = 1080 - math.sin(t * math.pi * 1.6) * 210 - t * 40
        angle = random.gauss(-0.25, 0.12)
        length = random.uniform(20, 55)
        curv = random.uniform(-0.04, 0.04)
        col = random.choice(river_cols)
        w = random.uniform(3, 7.5)
        op = random.uniform(0.45, 0.85)
        builder.add_stroke("winding-river-right", rx, ry, length, angle, curv, col, w, op)

    bridge_cols = ['#32261a', '#483828', '#604e3b', '#78624e', '#20160e']
    for _ in range(240):
        bx = random.uniform(870, 980)
        by = random.uniform(755, 805)
        angle = random.gauss(0, 0.08) if by < 770 else random.uniform(-0.65, 0.65)
        length = random.uniform(10, 32)
        curv = 0.22 if by >= 770 else 0.0
        col = random.choice(bridge_cols)
        w = random.uniform(2, 5)
        op = random.uniform(0.55, 0.9)
        builder.add_stroke("stone-bridge-right", bx, by, length, angle, curv, col, w, op)

    right_hills = ['#121812', '#1d251a', '#2c3325', '#3d402e', '#261c12', '#332517']
    for _ in range(1100):
        x0 = random.uniform(710, 1190)
        y0 = random.uniform(510, 960)
        angle = random.gauss(-0.65, 0.2)
        length = random.uniform(25, 75)
        curv = random.uniform(-0.08, 0.08)
        col = random.choice(right_hills)
        w = random.uniform(3.5, 8.5)
        op = random.uniform(0.35, 0.75)
        builder.add_stroke("landscape-hills-right", x0, y0, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 5. BALUSTRADE & CHAIR ARMREST
    # -------------------------------------------------------------
    pillar_cols = ['#0e0b08', '#18130e', '#241e16', '#352c21', '#473b2e']
    for _ in range(320):
        px = random.uniform(0, 75)
        py = random.uniform(480, 1080)
        angle = random.gauss(1.57, 0.04)
        length = random.uniform(40, 90)
        curv = random.uniform(-0.02, 0.02)
        col = random.choice(pillar_cols)
        w = random.uniform(4, 8.5)
        op = random.uniform(0.45, 0.85)
        builder.add_stroke("loggia-pillar-left", px, py, length, angle, curv, col, w, op)

    for _ in range(320):
        px = random.uniform(1125, 1200)
        py = random.uniform(480, 1080)
        angle = random.gauss(1.57, 0.04)
        length = random.uniform(40, 90)
        curv = random.uniform(-0.02, 0.02)
        col = random.choice(pillar_cols)
        w = random.uniform(4, 8.5)
        op = random.uniform(0.45, 0.85)
        builder.add_stroke("loggia-pillar-right", px, py, length, angle, curv, col, w, op)

    chair_cols = ['#0b0603', '#150c06', '#25170b', '#392311', '#51331a', '#6d4726', '#885c32']
    for _ in range(750):
        cx = random.uniform(180, 1020)
        cy = random.uniform(1320, 1590)
        norm_x = (cx - 600) / 420.0
        angle = norm_x * 0.36 + random.gauss(0, 0.05)
        length = random.uniform(35, 95)
        curv = -0.16 * norm_x
        col = random.choice(chair_cols)
        w = random.uniform(4.5, 11)
        op = random.uniform(0.45, 0.9)
        builder.add_stroke("chair-armrest", cx, cy, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 6. MONA LISA DRESS GOWN, EMBROIDERED TRIM & SHAWL
    # -------------------------------------------------------------
    dress_cols = ['#0e110b', '#181e13', '#232b1c', '#313c28', '#425135', '#1d160f', '#2c2216']
    for _ in range(2600):
        tx = random.uniform(250, 950)
        ty = random.uniform(660, 1580)
        
        dist_c = abs(tx - 600)
        max_w = 160 + (ty - 660) * 0.48
        if dist_c > max_w:
            continue
            
        angle = 1.57 + (tx - 600) * 0.0007 + random.gauss(0, 0.08)
        length = random.uniform(35, 95)
        curv = random.uniform(-0.05, 0.05)
        col = random.choice(dress_cols)
        w = random.uniform(3.5, 9.5)
        op = random.uniform(0.4, 0.85)
        builder.add_stroke("dress-gown-folds", tx, ty, length, angle, curv, col, w, op)

    shawl_cols = ['#1f160b', '#322414', '#47341e', '#604627', '#7b5a33', '#967041', '#b28750']
    for _ in range(1400):
        sx = random.uniform(640, 960)
        sy = random.uniform(690, 1380)
        angle = 0.72 + (sy - 690) * 0.0005 + random.gauss(0, 0.1)
        length = random.uniform(35, 85)
        curv = random.uniform(0.08, 0.26)
        col = random.choice(shawl_cols)
        w = random.uniform(3.5, 8.5)
        op = random.uniform(0.4, 0.85)
        builder.add_stroke("draped-shawl", sx, sy, length, angle, curv, col, w, op)

    gold_trim = ['#4d3b19', '#6a5123', '#8b6b2f', '#ab853b', '#cc9f48', '#edb859']
    for _ in range(550):
        t = random.uniform(-1, 1)
        ex = 600 + t * 140
        ey = 685 + (t ** 2) * 24 + random.gauss(0, 2.0)
        angle = t * 0.35 + random.gauss(0, 0.06)
        length = random.uniform(10, 24)
        curv = random.uniform(-0.03, 0.03)
        col = random.choice(gold_trim)
        w = random.uniform(1.8, 4.5)
        op = random.uniform(0.55, 0.95)
        builder.add_stroke("embroidered-trim", ex, ey, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 7. ANATOMICAL NECK & DECOLLETAGE (SFUMATO SKIN)
    # Throat center: X = 600. Tapering neck geometry from jaw Y=530 down to chest Y=660
    # -------------------------------------------------------------
    neck_shad = ['#301d0f', '#442816', '#5e3820']
    neck_mid = ['#795030', '#96643e', '#b07951']
    neck_high = ['#cc956a', '#e0ba91', '#f0d4b8']

    for _ in range(1300):
        ny = random.uniform(520, 675)
        w_half = 40 + (ny - 520) * 0.38
        nx = 600 + random.uniform(-w_half, w_half)
        
        dist_norm = (nx - 600) / w_half
        angle = 1.57 + dist_norm * 0.18 + random.gauss(0, 0.06)
        length = random.uniform(18, 45)
        curv = -0.08 * dist_norm
        
        if nx < 575 or ny > 640:
            col = random.choice(neck_shad + neck_mid)
        elif nx > 625:
            col = random.choice(neck_high + neck_mid)
        else:
            col = random.choice(neck_mid + neck_high)
            
        w = random.uniform(1.8, 5.0)
        op = random.uniform(0.35, 0.8)
        builder.add_stroke("neck-decolletage-skin", nx, ny, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 8. RENAISSANCE FACIAL OVAL & VOLUME (Head Center: X 600, Y 395)
    # -------------------------------------------------------------
    skin_deep = ['#211308', '#351e0e', '#4b2a15']
    skin_shad = ['#603b20', '#774a2b', '#915d38']
    skin_mid = ['#a8734c', '#bf885f', '#d39d74']
    skin_high = ['#e3bb91', '#f0d3b0', '#f8e4ca']

    for _ in range(3800):
        u = random.uniform(-1, 1)
        v = random.uniform(-1, 1)
        if u*u + v*v > 1.0:
            continue
            
        fx = 600 + u * 90 + (0.12 if u > 0 else 0.04) * 14
        fy = 410 + v * 120
        
        if fy < 365:
            angle = random.gauss(0, 0.08)
            curv = -0.05 * u
        elif fy > 480:
            angle = u * 0.42 + random.gauss(0, 0.06)
            curv = 0.12
        else:
            angle = u * 0.32 + random.gauss(0, 0.1)
            curv = -0.14 * u
            
        length = random.uniform(12, 38)
        w = random.uniform(1.6, 5.0)
        
        if fx < 555 or fy > 500:
            col = random.choice(skin_deep + skin_shad)
            op = random.uniform(0.35, 0.8)
        elif fx > 620 and fy < 460:
            col = random.choice(skin_mid + skin_high)
            op = random.uniform(0.35, 0.75)
        else:
            col = random.choice(skin_shad + skin_mid)
            op = random.uniform(0.35, 0.75)
            
        builder.add_stroke("face-base-sfumato", fx, fy, length, angle, curv, col, w, op)

    # -------------------------------------------------------------
    # 9. FACIAL FEATURES: EYES, NOSE, SMILE & LIPS
    # -------------------------------------------------------------
    brow_cols = ['#352011', '#4a2d18', '#603b22']
    for _ in range(220):
        bx = random.uniform(532, 572)
        by = 378 + (bx - 551)**2 * 0.018 + random.gauss(0, 1.0)
        builder.add_stroke("eyebrow-left", bx, by, random.uniform(8, 18), 0.08, -0.08, random.choice(brow_cols), 1.6, 0.5)
        bx2 = random.uniform(620, 662)
        by2 = 376 + (bx2 - 641)**2 * 0.018 + random.gauss(0, 1.0)
        builder.add_stroke("eyebrow-right", bx2, by2, random.uniform(8, 18), -0.08, -0.08, random.choice(brow_cols), 1.6, 0.5)

    eye_dark = ['#080503', '#150c06', '#23150a']
    eye_iris = ['#301d0f', '#442a17', '#5b3920']
    eye_white = ['#917f6e', '#a79583', '#bba694']
    
    # Left Eye (550, 398)
    for _ in range(260):
        ex = random.gauss(550, 10.5)
        ey = random.gauss(398, 5.0)
        dist = math.hypot(ex - 550, ey - 398)
        if dist < 4.2:
            col = random.choice(eye_dark)
            w, op = 1.5, 0.92
        elif dist < 9.0:
            col = random.choice(eye_iris)
            w, op = 1.3, 0.82
        else:
            col = random.choice(eye_white if abs(ex - 550) > 6.5 else skin_shad)
            w, op = 1.0, 0.6
        builder.add_stroke("eye-left-fine", ex, ey, random.uniform(4, 12), random.gauss(0, 0.06), 0.0, col, w, op)

    # Right Eye (641, 396)
    for _ in range(260):
        ex = random.gauss(641, 10.5)
        ey = random.gauss(396, 5.0)
        dist = math.hypot(ex - 641, ey - 396)
        if dist < 4.2:
            col = random.choice(eye_dark)
            w, op = 1.5, 0.92
        elif dist < 9.0:
            col = random.choice(eye_iris)
            w, op = 1.3, 0.82
        else:
            col = random.choice(eye_white if abs(ex - 641) > 6.5 else skin_shad)
            w, op = 1.0, 0.6
        builder.add_stroke("eye-right-fine", ex, ey, random.uniform(4, 12), random.gauss(0, 0.06), 0.0, col, w, op)

    # Nose Bridge & Nostril Wing Sfumato (X: 592..608, Y: 390..455)
    nose_shad = ['#3a2313', '#51311a', '#683f24']
    nose_high = ['#d9ab81', '#e7bc94', '#f5d0ad']
    for _ in range(350):
        ny = random.uniform(390, 455)
        nx = 595 + (ny - 390) * 0.08 + random.gauss(0, 3.0)
        if nx < 595:
            col = random.choice(nose_shad)
            op = 0.7
        else:
            col = random.choice(nose_high)
            op = 0.62
        angle = 1.57 + random.gauss(0, 0.06)
        builder.add_stroke("nose-bridge-sfumato", nx, ny, random.uniform(6, 18), angle, 0.0, col, random.uniform(1.0, 2.8), op)

    for _ in range(120):
        nx = random.uniform(582, 612)
        ny = random.uniform(450, 462)
        col = random.choice(['#1f1007', '#301a0c', '#442613'])
        builder.add_stroke("nostril-details", nx, ny, random.uniform(4, 11), 0.12, 0.08, col, 1.6, 0.82)

    # Enigmatic Mona Lisa Smile & Lips (Center X: 596, Y: 490)
    lip_dark = ['#30120c', '#421a13', '#56231b']
    lip_rosy = ['#6f3027', '#843a2e', '#994438']
    lip_high = ['#b55a4c', '#ca6c5d']
    
    for _ in range(450):
        lx = random.uniform(560, 634)
        norm_x = (lx - 596.0) / 37.0
        ly = 490 + (norm_x ** 2) * -3.0 + random.gauss(0, 1.8)
        
        if ly < 490:
            col = random.choice(lip_dark + lip_rosy)
            op = random.uniform(0.55, 0.92)
        else:
            col = random.choice(lip_rosy + lip_high)
            op = random.uniform(0.45, 0.85)
            
        angle = norm_x * -0.1 + random.gauss(0, 0.05)
        builder.add_stroke("smile-lips-sfumato", lx, ly, random.uniform(5, 15), angle, 0.03, col, random.uniform(1.0, 3.0), op)

    # -------------------------------------------------------------
    # 10. DARK FLOWING HAIR OVER SHOULDERS
    # -------------------------------------------------------------
    hair_dark = ['#040302', '#0c0906', '#18110b', '#241910', '#332417', '#443120']
    for _ in range(1200):
        hy = random.uniform(310, 880)
        hx_base = random.uniform(420, 540)
        wave = math.sin((hy - 310) * 0.016) * 22
        angle = 1.57 + math.cos((hy - 310) * 0.016) * 0.28 + random.gauss(0, 0.06)
        length = random.uniform(35, 90)
        curv = 0.16 * math.sin((hy - 310) * 0.02)
        col = random.choice(hair_dark)
        w = random.uniform(2.5, 7.5)
        op = random.uniform(0.45, 0.92)
        builder.add_stroke("hair-left-cascade", hx_base + wave, hy, length, angle, curv, col, w, op)

    for _ in range(1200):
        hy = random.uniform(310, 900)
        hx_base = random.uniform(665, 785)
        wave = math.sin((hy - 310) * 0.016) * 22
        angle = 1.57 + math.cos((hy - 310) * 0.016) * 0.28 + random.gauss(0, 0.06)
        length = random.uniform(35, 90)
        curv = -0.16 * math.sin((hy - 310) * 0.02)
        col = random.choice(hair_dark)
        w = random.uniform(2.5, 7.5)
        op = random.uniform(0.45, 0.92)
        builder.add_stroke("hair-right-cascade", hx_base + wave, hy, length, angle, curv, col, w, op)

    veil_cols = ['#332d27', '#4a4339', '#665c4d', '#827664', '#9e907d']
    for _ in range(700):
        vx = random.uniform(480, 720)
        vy = random.uniform(255, 415)
        angle = random.gauss(0, 0.22)
        length = random.uniform(20, 65)
        curv = random.uniform(-0.07, 0.07)
        col = random.choice(veil_cols)
        w = random.uniform(1.2, 3.0)
        op = random.uniform(0.12, 0.28)
        builder.add_stroke("translucent-veil", vx, vy, length, angle, curv, col, w, op)

    for _ in range(550):
        hx = random.choice([random.uniform(485, 525), random.uniform(665, 705)])
        hy = random.uniform(330, 570)
        angle = 1.57 + random.gauss(0, 0.08)
        col = random.choice(['#0d0906', '#1f160e', '#302216', '#422f1f'])
        builder.add_stroke("forefront-hair-strands", hx, hy, random.uniform(12, 38), angle, 0.08, col, random.uniform(0.8, 2.0), random.uniform(0.55, 0.9))

    # -------------------------------------------------------------
    # 11. ELEGANT FOLDED HANDS ON ARMREST (X: 470..750, Y: 1220..1360)
    # -------------------------------------------------------------
    hand_shad = ['#2b190d', '#3f2515', '#57351d']
    hand_mid = ['#72482a', '#8c5937', '#a56e48']
    hand_high = ['#c18b62', '#d3a177', '#e3b58d']

    for _ in range(700):
        hx = random.uniform(570, 740)
        hy = random.uniform(1215, 1275)
        angle = -0.26 + random.gauss(0, 0.08)
        length = random.uniform(15, 38)
        curv = -0.08
        col = random.choice(hand_mid + hand_high if hy < 1250 else hand_shad)
        builder.add_stroke("hand-right-back", hx, hy, length, angle, curv, col, random.uniform(1.8, 4.8), random.uniform(0.4, 0.8))

    for finger_i in range(4):
        f_y0 = 1235 + finger_i * 13
        for _ in range(180):
            t = random.uniform(0, 1)
            fx = 645 - t * 135
            fy = f_y0 + t * 24 + math.sin(t * math.pi) * 7 + random.gauss(0, 1.6)
            angle = 3.02 + random.gauss(0, 0.07)
            col = random.choice(hand_high if fy < f_y0 + 9 else hand_shad)
            builder.add_stroke(f"finger-right-{finger_i}", fx, fy, random.uniform(8, 22), angle, 0.04, col, random.uniform(1.2, 3.4), random.uniform(0.5, 0.85))

    for _ in range(350):
        lhx = random.uniform(465, 565)
        lhy = random.uniform(1265, 1335)
        angle = 0.38 + random.gauss(0, 0.08)
        col = random.choice(hand_mid + hand_shad)
        builder.add_stroke("hand-left-under", lhx, lhy, random.uniform(10, 26), angle, -0.04, col, random.uniform(1.5, 3.8), random.uniform(0.45, 0.8))

    # -------------------------------------------------------------
    # 12. MASTER HIGHLIGHT & SFUMATO GLAZING POLISH
    # -------------------------------------------------------------
    glaze_spots = [
        (598, 340, 50, 22),  # Forehead center light
        (642, 425, 30, 30),  # Right cheek light
        (597, 415, 8, 28),   # Nose bridge light
        (600, 595, 40, 30),  # Decolletage light
        (625, 1230, 50, 18), # Right hand back highlight
    ]
    
    for gx, gy, rx, ry in glaze_spots:
        for _ in range(250):
            x0 = random.gauss(gx, rx * 0.42)
            y0 = random.gauss(gy, ry * 0.42)
            angle = random.gauss(0, 0.22)
            length = random.uniform(8, 24)
            col = random.choice(['#e3bb91', '#f0d3b0', '#f8e4ca', '#d39d74'])
            builder.add_stroke("master-glazing-highlights", x0, y0, length, angle, 0.0, col, random.uniform(0.8, 2.0), random.uniform(0.18, 0.42))

    print(f"Total strokes generated: {sum(len(g) for g in builder.groups.values())}")
    return builder.render()

if __name__ == "__main__":
    svg_code = build_mona_lisa()
    output_path = "mona_lisa.svg"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_code)
    print(f"Successfully saved {output_path}")
