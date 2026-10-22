"""Package the frozen Godot game question and its public inputs, without runs."""
from __future__ import annotations

import hashlib
import json
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TASK = ROOT / "NativeWorkflowBench/GodotGameDemo"
OUT = ROOT / "sandbox/packages/GodotGameDemo"
PREFIX = "GodotGameDemo_v1.0"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    registry = load(TASK / "PROMPT_REGISTRY.json")
    profile = load(TASK / "BENCH_PROFILE.json")
    release = load(TASK / "RELEASE.json")
    draft = load(TASK / "DESIGN_DRAFT.json")
    prompt = (TASK / registry["dispatchPrompt"]).read_bytes()
    assert sha(prompt) == registry["sha256"] == release["prompt"]["sha256"]
    package = {"public/PROMPT.md": prompt}
    nested_counts = {}
    for relative in registry["inputFiles"]:
        src = TASK / relative
        data = src.read_bytes()
        descriptor = {"sha256": sha(data), "size": len(data)}
        assert descriptor == profile["locked_inputs"][src.name] == release["inputs"][src.name]
        with zipfile.ZipFile(src) as z:
            assert z.testzip() is None
            for name in z.namelist():
                p = PurePosixPath(name)
                assert not p.is_absolute() and ".." not in p.parts and "\\" not in name
            nested_counts[src.name] = len(z.namelist())
        package["public/" + src.name] = data

    package["README_使用说明.txt"] = """Godot 双维度探索与轻战斗 Demo · v1.0
完整题包 / 2026-10-16 / 续作开发条件

包含内容
public/PROMPT.md：正式题面，包含游戏系统、UI、数据库、完整草地 Shader 附录与评分权重。
public/STARTER_PROJECT.zip：上一轮 GPT 6.1 sol 成果的 29 个源码/资源文件，可解压后编辑。
public/SQLITE_DEPENDENCY.zip：固定 godot-sqlite v4.6 插件、Windows x86_64 DLL、文档与许可证。
organizer/ACCEPTANCE_CHECKLIST.txt：按正式题面整理的验收清单。
organizer/SCORECARD_TEMPLATE.json：空白人工评分表；未评分保持 null。
organizer/INPUT_LOCK.json：输入与依赖版本记录。
MANIFEST.json：本题包内容的 SHA-256 和字节数。

发题方法
1. 解压本 ZIP，创建一个新的独立候选工作目录。
2. 仅将 public 目录的三个文件复制到候选工作目录。
3. 按正式题面作答。可将 STARTER_PROJECT.zip 解压到候选目录下的工程子目录，
   再将 SQLITE_DEPENDENCY.zip 的 addons/godot-sqlite 放入同一工程根目录。
   两个输入 ZIP 保持原样，解压后的源码可以重构；最终仅保留一个有效 project.godot。
4. 使用 Godot 4.5.1 stable Windows x86_64 运行。引擎不包含在题包内。
   原题面记录了派发机器上的引擎路径；其他机器可设置 GODOT4_EXE 为本机引擎路径。
5. organizer 目录供组织者验收使用。正式题面和两个输入文件与已派发版本字节一致。

条件与评分
本包起点是 GPT 6.1 sol 自身上一轮源码，属于续作开发条件。
若供其他模型使用，记录为相同既有代码起点；与从零开发条件分开比较。
需要原生 2D 与 3D 各自完整通关，且共享背包、任务、世界状态和 SQLite 存档。
UI 样式、转场及原创机制保留创作空间，草地技术基线仍全部必做。
人工评分表初始为空，包含数值评分和独立达标状态；工程启动不能代替通关或视觉验收。
独立目录和输入哈希不等于操作系统访问隔离，隔离证据状态保持 unverified。

本包不含正在开发的新成果、旧评审、历史分数、模型日志、存档或账号配置。
""".encode("utf-8")

    cases = [{**case, "status": None, "evidence": [], "notes": ""} for case in draft["acceptance_cases"]]
    render_checks = [
        ("R01", "原生双路径与共享场", "2D/3D、正交/透视、坐标换算、布局/相位/时间及交互历史连续"),
        ("R02", "草簇与交互", "根部固定、至少四源、拖动影响物、停止/快穿/交叉/移除、压草与柔和恢复"),
        ("R03", "像素与动态稳定", "320×180/640×360/1280×720、nearest、清晰UI、滤镜/色板/抖色/描边与相机慢移"),
        ("R04", "动画与风格", "连续/8fps/12fps分相，像素/Cel/水墨六组合；受光、笔触和层次实际可辨认"),
        ("R05", "云影与草场翻滚", "大风阵/草簇弯曲/叶尖三层运动，分别关闭、世界空间云影及高度关联"),
        ("R06", "场景与水面", "坡地/土路/树石/小水面；3D场景倒影、折射、泡沫、焦散，2D适配水面及交互涟漪"),
        ("R07", "调试与确定性", "控件实际生效，诊断视图、统一时间、暂停/步进/跳转/清空/重放、手动输入历史与状态JSON"),
        ("R08", "真实运行与性能", "六组各≥5秒真实镜头、单变量A/B、完整通关/混合流程；独立预热≥2秒、采样≥10秒及中位数/P95"),
    ]
    text = ["验收清单（组织者使用）", "依据：public/PROMPT.md；不增加正式题面之外的要求。", "逐项记录：达标 / 未达标 / 待验证，以及证据位置。", ""]
    for c in cases:
        text.extend([c["id"] + " " + c["name"], "观察：" + c["observe"], "状态：待验证；证据：", ""])
    for code, title, observe in render_checks:
        text.extend([code + " " + title, "观察：" + observe, "状态：待验证；证据：", ""])
    text.extend(["评分：玩法15、角色/战斗/AI15、渲染20、UI25、背包/数据库15、稳定/声音/性能5、创意5。", "渲染专项单独100分，折算×0.20；其余项目按0–4档乘权重。", "两维度通关、共享状态、真实数据库与一致性、完整UI、完整渲染基线为必做。", "必做项缺失或待验证，不宣称整体完成；分项可以保留。所有未评项保持 null。", ""])
    package["organizer/ACCEPTANCE_CHECKLIST.txt"] = "\n".join(text).encode("utf-8")

    criteria = []
    for i, item in enumerate(draft["proposed_scoring"]["criteria"], 1):
        criteria.append({"id": f"C{i:02}", **item, "grade_0_to_4": None, "points": None,
                         "method": "render_subscore_100 * 0.20" if i == 3 else "grade_0_to_4 / 4 * weight",
                         "evidence": [], "notes": ""})
    render_names = ["原生2D/3D兼容", "交互压草恢复", "像素与动态稳定", "三风格完成度", "云影风阵翻滚", "场景与水影"]
    render = [{"id": code, "label": label, "weight": weight, "grade_0_to_4": None,
               "points": None, "evidence": [], "notes": ""}
              for (code, weight), label in zip(draft["rendering_contract"]["render_score_100_weights"].items(), render_names)]
    score = {"schema_version": "1.0", "benchmark_id": profile["benchmark_id"],
             "prompt_sha256": sha(prompt), "condition": "existing_code_continuation",
             "model": None, "run_id": None, "reviewer": None, "reviewed_at": None,
             "status": "unscored", "total_100": None, "criteria": criteria,
             "render_subscore_100": None, "render_criteria": render,
             "mandatory_gates": {name: None for name in ["native_2d_complete", "native_3d_complete", "shared_world_state", "sqlite_and_consistency", "complete_player_ui", "full_render_baseline"]},
             "overall_complete": None, "acceptance_cases": cases,
             "render_checks": [{"id": c, "label": t, "observe": o, "status": None, "evidence": []} for c,t,o in render_checks],
             "isolation_verification": "unverified",
             "note": "Missing evidence remains pending/null. Engine boot alone does not establish completion. No historical scores included."}
    package["organizer/SCORECARD_TEMPLATE.json"] = json_bytes(score)
    package["organizer/INPUT_LOCK.json"] = json_bytes({
        "benchmark_id": profile["benchmark_id"], "version": release["version"],
        "condition": release["condition"], "engine_version": profile["engine_version"],
        "engine_included": False, "platform": "Windows x86_64", "renderer": profile["renderer"],
        "prompt": release["prompt"], "public_inputs": profile["locked_inputs"],
        "starter_file_count": len(release["starter_files"]), "starter_files": release["starter_files"],
        "sqlite_release": release["upstream_release"],
        "sqlite_official_demo_sha256": release["upstream_download_sha256"],
        "scoring_source": "public/PROMPT.md", "isolation_verification": "unverified"})
    manifest = {"schema_version": 1, "package": PREFIX, "benchmark_id": profile["benchmark_id"],
                "created_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
                "files": {name: {"sha256": sha(data), "size": len(data)} for name, data in sorted(package.items())}}
    package["MANIFEST.json"] = json_bytes(manifest)
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / (PREFIX + "_20261016.zip")
    if destination.exists():
        raise RuntimeError("Existing package is preserved: " + str(destination))
    with zipfile.ZipFile(destination, "w") as z:
        for name, data in sorted(package.items()):
            z.writestr(PREFIX + "/" + name, data,
                       compress_type=zipfile.ZIP_STORED if name.endswith(".zip") else zipfile.ZIP_DEFLATED,
                       compresslevel=9)
    with tempfile.TemporaryDirectory(prefix="godot-package-verify-") as temp:
        with zipfile.ZipFile(destination) as z:
            assert z.testzip() is None
            assert set(z.namelist()) == {PREFIX + "/" + name for name in package}
            z.extractall(temp)
        extracted = Path(temp) / PREFIX
        for name, expected in manifest["files"].items():
            data = (extracted / name).read_bytes()
            assert {"sha256": sha(data), "size": len(data)} == expected
        assert (extracted / "public/PROMPT.md").read_bytes() == prompt
        assert all(c["points"] is None for c in load(extracted / "organizer/SCORECARD_TEMPLATE.json")["criteria"])
    audit = {"status": "verified", "package": str(destination), "size": destination.stat().st_size,
             "sha256": sha(destination.read_bytes()), "member_count": len(package),
             "nested_zip_members": nested_counts, "prompt_matches_dispatched_version": True,
             "input_hashes_match_frozen_profile": True, "round_trip_hashes_verified": True,
             "unscored_template": True, "engine_included": False}
    (OUT / "PACKAGE_AUDIT.json").write_bytes(json_bytes(audit))
    print(json.dumps(audit, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
