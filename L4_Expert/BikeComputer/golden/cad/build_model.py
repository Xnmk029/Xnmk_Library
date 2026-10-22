# build_model.py — BikeComputer golden 最小样例：参数化装配体
# 运行: freecadcmd build_model.py   (cwd = 本文件所在目录)
# 产物: out/BikeComputer.FCStd / .step / .stl
import os

import FreeCAD as App
import Part
import Mesh

# ---------------- 参数（集中定义） ----------------
P = {
    "case_xy": 52.0,        # 整机外形边长
    "case_h": 19.0,         # 整机总高（不含底座卡扣）
    "wall": 1.5,            # 外壳壁厚（>=1.2 光固化）
    "floor": 1.5,           # 底壳地板厚
    "lid": 1.5,             # 顶壳顶面厚
    "lcd_mod": 35.0,        # LCD 模组边长
    "lcd_mod_t": 3.2,       # LCD 模组厚
    "lcd_view": 28.5,       # 屏幕视窗开孔边长
    "pcb_xy": 46.0,         # PCB 边长
    "pcb_t": 1.0,           # PCB 厚
    "bat_x": 30.0,          # 683030 电池
    "bat_y": 30.0,
    "bat_t": 6.8,
    "gps_x": 10.5,          # ATGM336H 模组（含陶瓷天线总高）
    "gps_y": 10.5,
    "gps_t": 2.2,
    "gps_ant": 1.8,         # 陶瓷天线厚度（模块顶面）
    "enc_r": 5.0,           # 编码器旋钮半径（侧出滚轮）
    "enc_h": 6.0,           # 旋钮宽
    "enc_x": 23.5,          # 旋钮中心 x（右侧壁开槽外露）
    "enc_z": 12.0,          # 旋钮中心高
    "sd_w": 13.0,           # SD 卡开口宽
    "sd_h": 2.2,            # SD 卡开口高
    "usb_w": 9.5,           # USB-C 开口宽
    "usb_h": 3.6,           # USB-C 开口高
    "mount_r": 16.0,        # 码表座圆盘半径
    "mount_t": 0.8,         # 卡口盘厚
    "mount_lug": 0.5,       # 卡耳下凸
    "screw_r": 1.0,         # 螺丝柱内径
    "screw_post_r": 2.6,    # 螺丝柱外径
    "fillet_note": "外露面圆角 >=1mm 由后期 PartDesign 圆角或打印工艺保证",
}

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)

doc = App.newDocument("BikeComputer")


def box(name, x, y, z, dx, dy, dz):
    f = doc.addObject("Part::Feature", name)
    f.Shape = Part.makeBox(dx, dy, dz, App.Vector(x, y, z))
    return f


def cyl(name, x, y, z, r, h):
    f = doc.addObject("Part::Feature", name)
    f.Shape = Part.makeCylinder(r, h, App.Vector(x, y, z))
    return f


def feat(name, shape):
    f = doc.addObject("Part::Feature", name)
    f.Shape = shape
    return f


xy = P["case_xy"]
cx = -xy / 2.0  # 以中心为原点放置
H = P["case_h"]
W = P["wall"]

# ---------------- 内部堆叠（先建占位实体） ----------------
# 层序（底→顶）: 电池 | PCB+器件 | LCD 模组 | 顶盖
bat_z = P["floor"] + 0.3
pcb_z = bat_z + P["bat_t"] + 0.4
lcd_z = H - P["lid"] - P["lcd_mod_t"]

feat("Battery_700mAh", Part.makeBox(
    P["bat_x"], P["bat_y"], P["bat_t"],
    App.Vector(-P["bat_x"] / 2, -P["bat_y"] / 2, bat_z)))

feat("PCB_MainBoard", Part.makeBox(
    P["pcb_xy"], P["pcb_xy"], P["pcb_t"],
    App.Vector(-P["pcb_xy"] / 2, -P["pcb_xy"] / 2, pcb_z)))

# GPS 模组 + 陶瓷天线（靠近后缘，RF 净空区）
gx, gy = -P["pcb_xy"] / 2 + 4.0, P["pcb_xy"] / 2 - P["gps_y"] - 4.0
feat("GPS_Module_ATGM336H", Part.makeBox(
    P["gps_x"], P["gps_y"], P["gps_t"],
    App.Vector(gx, gy, pcb_z + P["pcb_t"])))
feat("GPS_Antenna_Ceramic", Part.makeBox(
    P["gps_x"], P["gps_y"], P["gps_ant"],
    App.Vector(gx, gy, pcb_z + P["pcb_t"] + P["gps_t"])))

# SD 卡座占位（左侧边缘）
feat("SD_Card_Slot", Part.makeBox(
    12.0, 11.0, 1.9,
    App.Vector(-P["pcb_xy"] / 2, -5.5, pcb_z + P["pcb_t"])))
# SD 卡插入占位（伸出外壳）
feat("SD_Card", Part.makeBox(
    2.0, 11.0, 1.0,
    App.Vector(cx - 1.0, -5.5, pcb_z + P["pcb_t"] + 0.4)))

# USB-C 连接器占位（前缘）
feat("USB_C_Connector", Part.makeBox(
    P["usb_w"], 5.0, P["usb_h"],
    App.Vector(-P["usb_w"] / 2, -P["pcb_xy"] / 2 - 1.0,
               pcb_z + P["pcb_t"] + 0.4)))

# LCD 模组 + 视窗玻璃
feat("LCD_ST7789_Module", Part.makeBox(
    P["lcd_mod"], P["lcd_mod"], P["lcd_mod_t"],
    App.Vector(-P["lcd_mod"] / 2, -P["lcd_mod"] / 2, lcd_z)))
feat("LCD_CoverGlass", Part.makeBox(
    P["lcd_view"], P["lcd_view"], 0.8,
    App.Vector(-P["lcd_view"] / 2, -P["lcd_view"] / 2,
               H - P["lid"] + 0.2)))

# 编码器本体（PCB 右缘）+ 侧出滚轮旋钮（轴沿 X，右壁开槽外露）
feat("Encoder_EC11", Part.makeBox(
    11.0, 11.0, 4.0,
    App.Vector(P["enc_x"] - 9.0, -5.5, pcb_z + P["pcb_t"])))
knob = Part.makeCylinder(
    P["enc_r"], P["enc_h"],
    App.Vector(P["enc_x"] - P["enc_h"] / 2, 0, P["enc_z"]),
    App.Vector(1, 0, 0))
feat("Encoder_Knob", knob)

# ---------------- 下壳 ----------------
outer = Part.makeBox(xy, xy, H, App.Vector(cx, cx, 0))
inner_h = H - P["floor"]
inner = Part.makeBox(
    xy - 2 * W, xy - 2 * W, inner_h,
    App.Vector(cx + W, cx + W, P["floor"]))
bottom = outer.cut(inner)
# SD 开口（左侧）
bottom = bottom.cut(Part.makeBox(
    W + 0.4, P["sd_w"], P["sd_h"],
    App.Vector(cx - 0.2, -P["sd_w"] / 2, pcb_z + P["pcb_t"] + 0.3)))
# USB-C 开口（前侧）
bottom = bottom.cut(Part.makeBox(
    P["usb_w"], W + 0.4, P["usb_h"],
    App.Vector(-P["usb_w"] / 2, cx - 0.2, pcb_z + P["pcb_t"] + 0.2)))
# 编码器滚轮让位槽（右侧壁，轴向 X 的滚轮半外露）
bottom = bottom.cut(Part.makeBox(
    W + 0.6, P["enc_r"] * 2 + 2.0, P["enc_r"] * 2 + 3.0,
    App.Vector(xy / 2 - W - 0.3, -P["enc_r"] - 1.0,
               P["enc_z"] - P["enc_r"] - 1.5)))
feat("BottomShell", bottom)

# 螺丝柱（四角）
for i, (sx, sy) in enumerate([
        (-1, -1), (1, -1), (-1, 1), (1, 1)]):
    px = sx * (P["pcb_xy"] / 2 - 4.0)
    py = sy * (P["pcb_xy"] / 2 - 4.0)
    post = Part.makeCylinder(
        P["screw_post_r"], H - P["lid"] - P["floor"],
        App.Vector(px, py, P["floor"]))
    post = post.cut(Part.makeCylinder(
        P["screw_r"], H - P["lid"] - P["floor"],
        App.Vector(px, py, P["floor"])))
    feat("ScrewPost_%d" % i, post)

# ---------------- 顶壳 ----------------
lid_outer_h = P["lid"] + 3.0  # 顶壳含一圈盖沿
top = Part.makeBox(xy, xy, lid_outer_h, App.Vector(cx, cx, H - lid_outer_h))
top = top.cut(Part.makeBox(
    xy - 2 * W, xy - 2 * W, lid_outer_h - P["lid"],
    App.Vector(cx + W, cx + W, H - lid_outer_h)))
# 屏幕视窗开孔
top = top.cut(Part.makeBox(
    P["lcd_view"], P["lcd_view"], P["lid"] + 0.2,
    App.Vector(-P["lcd_view"] / 2, -P["lcd_view"] / 2, H - P["lid"] - 0.1)))
feat("TopShell", top)

# ---------------- 码表座（quarter-turn 简化卡口） ----------------
mount = Part.makeCylinder(P["mount_r"], P["mount_t"],
                          App.Vector(0, 0, -P["mount_t"]))
for ang in (0, 90, 180, 270):
    lug = Part.makeBox(6.0, 4.0, P["mount_t"] + P["mount_lug"],
                       App.Vector(P["mount_r"] - 4.0, -2.0,
                                  -P["mount_t"] - P["mount_lug"]))
    lug = lug.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), ang)
    mount = mount.fuse(lug)
feat("Mount_QuarterTurn", mount)

# ---------------- 导出 ----------------
doc.recompute(None, True, True)
fcstd_path = os.path.join(OUT, "BikeComputer.FCStd")
doc.saveAs(fcstd_path)

solids = [o for o in doc.Objects
          if getattr(o, "Shape", None) is not None and not o.Shape.isNull()
          and len(o.Shape.Solids) > 0]
Part.export(solids, os.path.join(OUT, "BikeComputer.step"))
Mesh.export(solids, os.path.join(OUT, "BikeComputer.stl"))

bb = None
for o in solids:
    b = o.Shape.BoundBox
    if bb is None:
        bb = b
    else:
        bb.add(b)
print("OBJECTS", len(doc.Objects), "SOLIDS", len(solids))
print("BBOX %.1f x %.1f x %.1f mm" % (bb.XLength, bb.YLength, bb.ZLength))
print("SAVED", fcstd_path)
