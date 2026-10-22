# inspect_fcstd.py — 在 freecadcmd 内运行，检查生成的 FCStd 装配体
# 用法: 设置环境变量 VERIFY_FCSTD=<fcstd路径> VERIFY_OUT=<json输出路径>
#   freecadcmd inspect_fcstd.py
import os
import json
import sys

import FreeCAD
import Part

EXPECTED_GROUPS = {
    "shell_top": ["topshell", "top_shell", "upper", "cover_top", "topcover", "上壳", "top"],
    "shell_bottom": ["bottomshell", "bottom_shell", "lower", "baseshell", "bottom", "下壳", "底壳"],
    "pcb": ["pcb", "board", "mainboard", "主板"],
    "lcd": ["lcd", "screen", "display", "st7789", "屏"],
    "battery": ["battery", "bat", "lipo", "电池"],
    "encoder": ["encoder", "knob", "rotary", "编码器", "旋钮"],
    "gps": ["gps", "antenna", "atgm", "天线"],
    "mount": ["mount", "bracket", "quarter", "底座", "卡口", "garmin"],
    "usb": ["usb", "typec", "charging", "充电"],
    "sd": ["sdcard", "sd_card", "microsd", "tf", "sd"],
}


def shape_of(obj):
    shape = getattr(obj, "Shape", None)
    if shape is not None and not shape.isNull():
        return shape
    return None


def main():
    fcstd = os.environ.get("VERIFY_FCSTD", "")
    out_json = os.environ.get("VERIFY_OUT", "inspect_result.json")
    result = {"fcstd": fcstd, "checks": []}

    def check(name, ok, detail=""):
        result["checks"].append({
            "name": name,
            "status": "PASS" if ok is True else ("WARN" if ok is None else "FAIL"),
            "detail": detail,
        })

    if not fcstd or not os.path.isfile(fcstd):
        check("fcstd_exists", False, "file not found: %s" % fcstd)
        _dump(result, out_json)
        return

    try:
        doc = FreeCAD.openDocument(fcstd)
    except Exception as exc:  # noqa: BLE001
        check("fcstd_open", False, "open failed: %s" % exc)
        _dump(result, out_json)
        return
    check("fcstd_open", True, "%d objects" % len(doc.Objects))

    # recompute & collect errors
    try:
        doc.recompute(None, True, True)
        err_objs = [
            o.Label for o in doc.Objects
            if ("Invalid" in o.State) or ("Error" in o.State)
        ]
        check("recompute", len(err_objs) == 0,
              "error objects: %s" % ", ".join(err_objs[:10]) if err_objs else "clean")
    except Exception as exc:  # noqa: BLE001
        check("recompute", False, "recompute raised: %s" % exc)

    # solid census + overall bbox
    solids = []
    labels = []
    bb = None
    for obj in doc.Objects:
        labels.append(obj.Label)
        shape = shape_of(obj)
        if shape is None:
            continue
        try:
            n_solids = len(shape.Solids)
        except Exception:  # noqa: BLE001
            n_solids = 0
        if n_solids > 0:
            solids.append((obj.Label, n_solids))
            obb = shape.BoundBox
            if bb is None:
                bb = obb
            else:
                bb.add(obb)

    total_solids = sum(n for _, n in solids)
    check("solid_count", total_solids >= 6,
          "%d solid(s) across %d object(s)" % (total_solids, len(solids)))

    if bb is not None:
        dims = (bb.XLength, bb.YLength, bb.ZLength)
        result["bbox_mm"] = {"x": round(dims[0], 2), "y": round(dims[1], 2), "z": round(dims[2], 2)}
        ok = dims[0] <= 60.5 and dims[1] <= 60.5 and dims[2] <= 20.5
        check("bbox_limit", ok,
              "%.1f x %.1f x %.1f mm (limit 60x60x20)" % dims)
    else:
        check("bbox_limit", False, "no solid shapes found")

    # expected part coverage (soft check → WARN)
    low = " | ".join(labels).lower()
    missing = [g for g, keys in EXPECTED_GROUPS.items()
               if not any(k in low for k in keys)]
    cov = len(EXPECTED_GROUPS) - len(missing)
    check("part_coverage",
          True if not missing else None,
          "%d/%d part groups matched; missing: %s"
          % (cov, len(EXPECTED_GROUPS), ", ".join(missing) or "-"))

    result["objects"] = sorted(labels)
    result["solid_objects"] = ["%s(%d)" % (l, n) for l, n in solids]
    _dump(result, out_json)


def _dump(result, out_json):
    with open(out_json, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    print("INSPECT_JSON_WRITTEN", out_json)


main()
