"""Export the full question with official dependencies and no model submission."""
from __future__ import annotations

import hashlib
import io
import json
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TASK = ROOT / "NativeWorkflowBench/GodotGameDemo"
OUT = ROOT / "sandbox/packages/GodotGameDemoFromScratch"
PROBE = ROOT.parent / "bench-probes/godot-sqlite-v4.6"
PREFIX = "GodotGameDemo_FromScratch_v1.0"
BENCHMARK = "godot-dual-world-demo-v1-from-scratch"
OFFICIAL_RELEASE_SHA = "1372a8fafd2aa1acd2aa62d50f5280ff8862404a65100dd32898306d99dfe9a0"
TEXT_SUFFIXES = {".md", ".txt", ".json", ".gd", ".uid", ".gdextension", ".cfg"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode_json(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def replace_once(text: str, old: str, new: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError("Expected exactly one source paragraph: " + old[:60])
    return text.replace(old, new, 1)


def clean_prompt(source: str) -> str:
    text = replace_once(source, "正式题面 v1.0 · 2026-10-16 · 续作开发条件", "正式题面 v1.0 · 2026-10-17 · 从零开发条件")
    start = text.index("提供的起点与运行环境")
    end = text.index("一、必须完成的玩法", start)
    environment = """开发起点与运行环境
- 从空白 Godot 工程开始制作。本题不提供已有游戏工程、场景、Shader、素材或参考实现；全部必做项均须在本题内完成并验证。
- SQLITE_DEPENDENCY.zip 仅包含官方 godot-sqlite v4.6 插件、Windows x86_64 的 debug/release DLL、接口文档与许可证。
- 使用 Godot 4.5.1 stable（Windows x86_64），引擎由测试环境预装；通过环境变量 GODOT4_EXE 提供本机引擎可执行文件路径。
- user:// 使用本工程独立目录，具体命名由你设置并记录。
- UI 样式、2D/3D 转场、题材、关卡细节与原创机制由你设计。

"""
    text = text[:start] + environment + text[end:]
    text = replace_once(text,
        "4. 若基于上一阶段工程继续开发，可复用和重构，但须修复未达标项；已有代码和旧截图不构成本轮效果通过证明。独立新建工程同样须满足全部基线。",
        "4. 草地 Shader、游戏系统与 UI 均从空白工程开始实现；阶段性技术验证完成后集成到同一可玩关卡。全部基线须以本题实际运行的实现和证据验证。")
    text = replace_once(text,
        "本题独立于旧 Godot Shader v2 的题面与成绩，续作条件与从零开发条件分开比较。",
        "本题为从空白工程开始的独立制作条件。")
    start = text.index("附录 A 原草地 Shader 完整技术基线（必做）")
    technical = text.index("## 一、3D / 2D 双向兼容", start)
    appendix = """附录 A 草地 Shader 完整技术基线（必做）
以下技术要求完整适用于实际可玩关卡及验收区域。画面目标为精致独立游戏所需的草簇组织、色块层次、自然交互和成片翻滚。具体美术、草种、调色与实现算法由你自行设计；UI 样式、布局和维度转场保持创作自由，功能与可读性要求保持。

"""
    text = text[:start] + appendix + text[technical:]
    text = replace_once(text, "## 八、渲染专项评分（与原题权重一致）", "## 八、渲染专项评分")
    baseline = lambda s: s.split("## 一、3D / 2D 双向兼容", 1)[1].split("## 六、调试与确定性取证", 1)[0]
    assert baseline(text) == baseline(source), "The complete technical baseline must remain unchanged"
    for forbidden in ["STARTER_PROJECT", "上一轮", "上一阶段", "续作", "F:/bench-probes", "GPT", "Gemini"]:
        assert forbidden not in text, forbidden
    return text


def official_dependency() -> tuple[bytes, dict]:
    # Rebuild from pinned upstream bytes, without the former host-written DEPENDENCY.txt.
    downloaded = (PROBE / "demo.zip").read_bytes()
    assert sha(downloaded) == OFFICIAL_RELEASE_SHA, "Pinned official download changed"
    vendor = {}
    with zipfile.ZipFile(io.BytesIO(downloaded)) as z:
        for info in z.infolist():
            n = info.filename
            prefix = "demo/addons/godot-sqlite/"
            if not n.startswith(prefix) or info.is_dir():
                continue
            if "/bin/" in n and not n.endswith(("libgdsqlite.windows.template_debug.x86_64.dll", "libgdsqlite.windows.template_release.x86_64.dll")):
                continue
            vendor[n.removeprefix("demo/")] = z.read(info)
    for name in ["README.md", "LICENSE.md"]:
        vendor["addons/godot-sqlite/" + name] = (PROBE / name).read_bytes()
    # The release README/license were fetched at tag v4.6. Compare all bytes with the
    # previously frozen official dependency, which is independent of candidate runs.
    with zipfile.ZipFile(TASK / "inputs/SQLITE_DEPENDENCY.zip") as locked:
        for name, data in vendor.items():
            assert data == locked.read(name), "Official dependency byte mismatch: " + name
    assert len(vendor) == 9
    allowed = {
        "addons/godot-sqlite/bin/libgdsqlite.windows.template_debug.x86_64.dll",
        "addons/godot-sqlite/bin/libgdsqlite.windows.template_release.x86_64.dll",
        "addons/godot-sqlite/gdsqlite.gdextension", "addons/godot-sqlite/gdsqlite.gdextension.uid",
        "addons/godot-sqlite/godot-sqlite.gd", "addons/godot-sqlite/godot-sqlite.gd.uid",
        "addons/godot-sqlite/plugin.cfg", "addons/godot-sqlite/README.md", "addons/godot-sqlite/LICENSE.md",
    }
    assert set(vendor) == allowed
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, data in sorted(vendor.items()):
            z.writestr(name, data)
    return buffer.getvalue(), {name: {"sha256": sha(data), "size": len(data)} for name, data in sorted(vendor.items())}


def main():
    source = (TASK / "PROJECT_PROMPT.md").read_text(encoding="utf-8")
    prompt = clean_prompt(source).encode("utf-8")
    dependency, vendor_manifest = official_dependency()
    draft = json.loads((TASK / "DESIGN_DRAFT.json").read_text(encoding="utf-8"))
    cases = [{**case, "status": None, "evidence": [], "notes": ""} for case in draft["acceptance_cases"]]
    for case in cases:
        case["observe"] = case["observe"].replace("原创新转场", "转场").replace("风场、水面至少一种", "风、草地、水面至少一种")
    render_checks = [
        ("R01", "原生双路径与共享场", "2D/3D、正交/透视、坐标换算、布局/相位/时间及交互历史连续"),
        ("R02", "草簇与交互", "根部固定、至少四源、可拖动影响物、停止/快穿/交叉/移除、压草及柔和恢复"),
        ("R03", "像素与动态稳定", "三档内部分辨率、nearest、独立清晰UI、滤镜/色板/抖色/描边与相机慢移"),
        ("R04", "动画与风格", "连续/8fps/12fps分相，像素/Cel/水墨六组合，受光、笔触和层次可辨认"),
        ("R05", "云影与草场翻滚", "风阵/草簇/叶尖三层运动，分别关闭与世界空间云影/高度关联"),
        ("R06", "场景与水面", "坡地/土路/树石/水面；3D场景倒影、折射、泡沫、焦散；2D水面适配与交互涟漪"),
        ("R07", "调试与确定性", "控件与诊断实际生效，统一时间、暂停/步进/跳转/复位、历史清空/重放与导出"),
        ("R08", "真实运行与性能", "六组各≥5秒真实镜头与单变量对照；完整通关/混合流程，独立预热≥2秒、采样≥10秒及中位数/P95"),
    ]
    criteria = []
    for i, item in enumerate(draft["proposed_scoring"]["criteria"], 1):
        criteria.append({"id": f"C{i:02}", **item, "grade_0_to_4": None, "points": None,
                         "method": "render_subscore_100 * 0.20" if i == 3 else "grade_0_to_4 / 4 * weight",
                         "evidence": [], "notes": ""})
    render_names = ["原生2D/3D兼容", "交互压草恢复", "像素与动态稳定", "三风格完成度", "云影风阵翻滚", "场景与水影"]
    render = [{"id": code, "label": label, "weight": weight, "grade_0_to_4": None,
               "points": None, "evidence": [], "notes": ""}
              for (code, weight), label in zip(draft["rendering_contract"]["render_score_100_weights"].items(), render_names)]
    score = {
        "schema_version": "1.0", "benchmark_id": BENCHMARK, "condition": "from_scratch",
        "prompt_sha256": sha(prompt), "model": None, "run_id": None, "reviewer": None, "reviewed_at": None,
        "status": "unscored", "total_100": None, "criteria": criteria,
        "render_subscore_100": None, "render_criteria": render,
        "mandatory_gates": {n: None for n in ["native_2d_complete", "native_3d_complete", "shared_world_state", "sqlite_and_consistency", "complete_player_ui", "full_render_baseline"]},
        "overall_complete": None, "acceptance_cases": cases,
        "render_checks": [{"id": c, "label": t, "observe": o, "status": None, "evidence": [], "notes": ""} for c,t,o in render_checks],
        "isolation_verification": "unverified", "note": "未评项与缺少证据的项目保持 null；引擎启动不代替功能、通关与视觉验收。",
    }
    checklist = ["验收清单（组织者使用）", "依据：public/PROMPT.md；各项记录达标/未达标/待验证和实际证据。", ""]
    for case in cases:
        checklist.extend([case["id"] + " " + case["name"], "观察：" + case["observe"], "状态：待验证；证据：", ""])
    for code, title, observe in render_checks:
        checklist.extend([code + " " + title, "观察：" + observe, "状态：待验证；证据：", ""])
    checklist.extend(["评分：玩法15、角色/战斗/AI15、渲染20、UI25、背包/数据库15、稳定/声音/性能5、创意5。", "渲染专项独立100分，折算×0.20；其余项目按0–4档乘权重。", "两维度通关、共享状态、真实数据库与一致性、完整UI、完整渲染基线均为必做。", "必做项未达标或缺乏证据时，不宣称整体完成；部分成果记录分项分数，未评项保持 null。", ""])
    readme = """Godot 双维度探索与轻战斗游戏 Demo · 从零开发题包 v1.0
2026-10-17

本包仅含完整测试要求、官方数据库依赖、验收清单和空白评分表。
所有游戏工程、草地 Shader、场景、UI、背包、任务、存档与原创玩法从空白 Godot 工程开始制作。

文件
public/PROMPT.md：完整正式题面，包含双维度通关、游戏系统、UI、数据库与完整草地渲染附录。
public/SQLITE_DEPENDENCY.zip：官方 godot-sqlite v4.6 插件、Windows x86_64 DLL、README 和许可证；每个文件均与固定官方来源逐字节核对。
organizer/ACCEPTANCE_CHECKLIST.txt：19 项游戏/系统验收及 8 组渲染检查。
organizer/SCORECARD_TEMPLATE.json：完整空白评分表，评分、状态和证据均待填写。
organizer/INPUT_LOCK.json：输入版本、哈希和官方依赖文件白名单。
MANIFEST.json：题包文件 SHA-256 和字节数。

使用
1. 准备 Godot 4.5.1 stable（Windows x86_64）。引擎不包含在本包内。
2. 新建独立候选工作目录，仅放入 public 中的 PROMPT.md 和 SQLITE_DEPENDENCY.zip。
3. 通过环境变量 GODOT4_EXE 提供本机引擎可执行文件路径，再按题面从空白工程作答。
4. 在自行创建的工程中解压 SQLite 依赖，使 addons/godot-sqlite 位于工程根目录。
5. organizer 内容供组织者验收使用。题面已包含公开功能要求与评分权重。

要求保持完整：原生2D/3D均可通关并共享状态，真实SQLite存档和背包，完整玩家UI，探索/解谜/轻战斗，自主机制，以及草地交互、像素优化、三风格、云影/风阵/翻滚、水面和调试/取证。
UI具体样式、维度转场、题材与小机制仍由作答者设计。

所有评分初始为空。目录隔离与哈希校验不证明操作系统访问隔离，隔离证据状态保持 unverified。
"""
    package = {
        "README_使用说明.txt": readme.encode("utf-8"),
        "public/PROMPT.md": prompt,
        "public/SQLITE_DEPENDENCY.zip": dependency,
        "organizer/ACCEPTANCE_CHECKLIST.txt": "\n".join(checklist).encode("utf-8"),
        "organizer/SCORECARD_TEMPLATE.json": encode_json(score),
        "organizer/INPUT_LOCK.json": encode_json({
            "benchmark_id": BENCHMARK, "version": "1.0", "condition": "from_scratch",
            "engine_version": "4.5.1.stable", "engine_included": False, "platform": "Windows x86_64", "renderer": "forward_plus",
            "prompt": {"sha256": sha(prompt), "size": len(prompt)},
            "public_inputs": {"SQLITE_DEPENDENCY.zip": {"sha256": sha(dependency), "size": len(dependency)}},
            "official_dependency_release": "https://github.com/2shady4u/godot-sqlite/releases/tag/v4.6",
            "official_download_sha256": OFFICIAL_RELEASE_SHA, "official_dependency_files": vendor_manifest,
            "contains_model_submission": False, "scoring_source": "public/PROMPT.md", "isolation_verification": "unverified",
        }),
    }
    manifest = {"schema_version": 1, "package": PREFIX, "benchmark_id": BENCHMARK,
                "created_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(), "condition": "from_scratch",
                "files": {name: {"sha256": sha(data), "size": len(data)} for name, data in sorted(package.items())}}
    package["MANIFEST.json"] = encode_json(manifest)
    assert len(package) == 7
    forbidden_tokens = ["STARTER_PROJECT", "gpt-6.1-sol", "gemini-4-argon", "Bellwind", "风铃草原", "20261012-022404", "starter_files", "starter_source"]
    for name, data in package.items():
        if name.endswith(".zip"):
            continue
        text = data.decode("utf-8")
        for token in forbidden_tokens:
            assert token not in text, (name, token)
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / (PREFIX + "_20261017.zip")
    source_dir = OUT / (PREFIX + "_20261017")
    if destination.exists() or source_dir.exists():
        raise RuntimeError("Existing export is preserved; choose a new release filename")
    source_dir.mkdir()
    for name, data in package.items():
        target = source_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    with zipfile.ZipFile(destination, "w") as z:
        for name, data in sorted(package.items()):
            z.writestr(PREFIX + "/" + name, data,
                       compress_type=zipfile.ZIP_STORED if name.endswith(".zip") else zipfile.ZIP_DEFLATED,
                       compresslevel=9)
    with tempfile.TemporaryDirectory(prefix="godot-clean-package-") as temp:
        with zipfile.ZipFile(destination) as z:
            assert z.testzip() is None
            assert set(z.namelist()) == {PREFIX + "/" + n for n in package}
            for name in z.namelist():
                assert not PurePosixPath(name).is_absolute() and ".." not in PurePosixPath(name).parts
            z.extractall(temp)
        extracted = Path(temp) / PREFIX
        for name, expected in manifest["files"].items():
            data = (extracted / name).read_bytes()
            assert {"sha256": sha(data), "size": len(data)} == expected
        with zipfile.ZipFile(extracted / "public/SQLITE_DEPENDENCY.zip") as z:
            assert z.testzip() is None and set(z.namelist()) == set(vendor_manifest)
            for name, expected in vendor_manifest.items():
                data = z.read(name)
                assert {"sha256": sha(data), "size": len(data)} == expected
        template = json.loads((extracted / "organizer/SCORECARD_TEMPLATE.json").read_text(encoding="utf-8"))
        assert template["total_100"] is None and template["render_subscore_100"] is None
        assert all(c["points"] is None and c["grade_0_to_4"] is None and not c["evidence"] for c in template["criteria"] + template["render_criteria"])
        assert all(c["status"] is None and not c["evidence"] for c in template["acceptance_cases"] + template["render_checks"])
    audit = {"status": "verified", "package": str(destination), "size": destination.stat().st_size,
             "sha256": sha(destination.read_bytes()), "package_files": len(package), "condition": "from_scratch",
             "model_submission_files": 0, "scene_or_shader_implementations": 0,
             "candidate_videos_images_saves_or_reports": 0, "official_dependency_files": len(vendor_manifest),
             "official_dependency_bytes_verified": True, "full_render_technical_baseline_preserved": True,
             "acceptance_cases": len(cases), "render_checks": len(render_checks), "all_scores_unfilled": True,
             "round_trip_hashes_verified": True, "prompt_sha256": sha(prompt), "engine_included": False}
    (OUT / "PACKAGE_AUDIT.json").write_bytes(encode_json(audit))
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
