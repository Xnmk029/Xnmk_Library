"""Evidence preparation and arithmetic only; no automatic literary judgments."""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
EVAL = BASE / "evaluation"
POLICIES = ["rubric.json", "RUBRIC.md", "GOLD_ANALYSIS.md", "FACT_CHECK.md", "README.md",
            "REVIEW_FORM.md", "tools/review.py"]
HAN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]")


def read(path):
    return Path(path).read_text(encoding="utf-8-sig")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_json(path):
    return json.loads(read(path))


def save_json(path, data, exclusive=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x" if exclusive else "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def paragraphs(text):
    result, lines, start = [], [], 0
    for number, line in enumerate(text.splitlines() + [""], 1):
        if line.strip():
            if not lines:
                start = number
            lines.append(line.strip())
        elif lines:
            body = "".join(lines)
            result.append({"id": len(result) + 1, "start_line": start,
                           "end_line": number - 1, "text": body,
                           "chars": len(re.sub(r"\s", "", body)),
                           "han_chars": len(HAN.findall(body))})
            lines = []
    return result


def analyze(text):
    parts = paragraphs(text)
    signals = []

    def flag(code, p, excerpt):
        signals.append({"id": f"S{len(signals) + 1:03}", "code": code,
                        "paragraph": p, "excerpt": excerpt, "automatic_verdict": None})

    patterns = [
        ("DASH", r"[—―]+"),
        ("NOT_BUT", r"不是[^。！？!?]{0,100}?而是"),
        ("HOW_BUT", r"如何[^。！？!?]{0,100}?但"),
        ("WHITE_KNUCKLES", r"指节发白"),
        ("NEGATIVE_OPENING", r"^[\s\"“‘「『>*#]*(?:没有|这绝非|这不是|不是|并非|绝非|未曾|不曾|不见)"),
        ("PLACEHOLDER_OR_MARKUP", r"\*\*|TODO|\[待补\]"),
        ("WRAPPER", r"^(?:#{1,6}\s|```|~~~)")
    ]
    for part in parts:
        for code, pattern in patterns:
            for match in re.finditer(pattern, part["text"]):
                flag(code, part["id"], match.group())
        if part["chars"] > 150:
            flag("PARAGRAPH_GT150", part["id"], str(part["chars"]))
        elif part["chars"] > 100:
            flag("PARAGRAPH_101_150", part["id"], str(part["chars"]))
        elif part["chars"] < 30:
            flag("SHORT_PARAGRAPH_REVIEW", part["id"], str(part["chars"]))
    han = len(HAN.findall(text))
    if han < 1200:
        flag("ADVISORY_LT1200_HAN", None, str(han))
    return {
        "counting": "空行分段；去空白字符数含标点；han_chars只计汉字；命中不等于违规",
        "stats": {"paragraphs": len(parts), "chars": sum(p["chars"] for p in parts),
                  "han_chars": han, "short_paragraphs": sum(p["chars"] < 30 for p in parts),
                  "paragraphs_101_150": sum(100 < p["chars"] <= 150 for p in parts),
                  "paragraphs_gt150": sum(p["chars"] > 150 for p in parts)},
        "paragraphs": parts, "signals": signals,
        "limitations": ["不自动评分", "不自动判断排比、比喻、文风、事实、抄袭或钩子",
                        "候选只扫描指定文件，不自动拼接log或其他答案", "不能保证受测隔离或盲审"]
    }


def snapshot(candidate):
    files = {"candidate": Path(candidate).resolve(), "prompt": BASE / "PROJECT_PROMPT.md",
             "gold": BASE / "REFERENCE_ANSWER.md"}
    files.update({"policy:" + name: EVAL / name for name in POLICIES})
    return {key: {"path": str(path), "sha256": digest(path)} for key, path in files.items()}


def scan(candidate):
    result = analyze(read(candidate))
    result["sources"] = snapshot(candidate)
    result["rubric_version"] = load_json(EVAL / "rubric.json")["version"]
    prompt = read(BASE / "PROJECT_PROMPT.md")
    story = prompt.split("【风格与剧情参考原文】", 1)[1].split("# 交付与限制要求", 1)[0]
    result["prompt_reference_paragraphs"] = paragraphs(story.strip())
    result["prompt_reference_line_note"] = "此处行号相对提取出的第一章，不是题面文件原始行号；P编号有效"
    return result


def make_review(candidate, reviewer, sample_id):
    report = scan(candidate)
    rubric = load_json(EVAL / "rubric.json")
    return {"rubric_version": rubric["version"], "sample_id": sample_id,
            "reviewer": reviewer, "review_stage": "single-review", "reviewed_at": None,
            "sources": report["sources"], "read_full_text": False,
            "scan_adjudications": [{"signal_id": s["id"], "decision": None,
                                     "reason": "", "issue_ids": []} for s in report["signals"]],
            "criteria": {c["id"]: {"rating": None, "evidence": [], "reason": "", "issue_ids": []}
                         for c in rubric["criteria"]},
            "issues": [], "hook_ledger": [], "unresolved": [],
            "notes": "先通读与人工复核，再填分；证据格式为 {paragraph: 整数, quote: 原句片段}；缺陷格式见REVIEW_FORM与工具校验。"}


def evidence_ok(evidence, parts, label):
    if not evidence:
        return False
    for item in evidence:
        number, quote = item.get("paragraph"), item.get("quote")
        if type(number) is not int or not 1 <= number <= len(parts):
            raise ValueError(f"{label}: 无效段号 {number}")
        if not isinstance(quote, str) or not quote.strip() or quote not in parts[number - 1]["text"]:
            raise ValueError(f"{label}: 引文不在指定段落")
    return True


def calculate(review, rubric, analysis):
    """Validate human judgments and sum them. Missing review evidence stays pending."""
    expected = {c["id"]: c for c in rubric["criteria"]}
    if len(expected) != len(rubric["criteria"]) or sum(c["weight"] for c in expected.values()) != 100:
        raise ValueError("评分规则ID重复或权重不等于100")
    if review.get("rubric_version") != rubric["version"]:
        raise ValueError("评分规则版本不匹配")
    if set(review.get("criteria", {})) != set(expected):
        raise ValueError("评分项缺失或多余")
    stage = review.get("review_stage")
    if stage not in {"single-review", "double-review-adjudicated"}:
        raise ValueError("未知评审阶段")
    pending = []
    if not review.get("read_full_text"):
        pending.append("未确认通读")
    if not review.get("reviewer") or not review.get("reviewed_at"):
        pending.append("缺评委或评审时间")
    if stage == "double-review-adjudicated" and not review.get("adjudication_record"):
        pending.append("缺双审原始评分和裁决记录路径")
    parts = analysis["paragraphs"]
    issues = {}
    for issue in review.get("issues", []):
        ident = issue.get("id")
        if not ident or ident in issues:
            raise ValueError("缺陷ID缺失或重复")
        if issue.get("primary_criterion") not in expected:
            raise ValueError(f"{ident}: 主评分项无效")
        if issue.get("severity") not in {"Critical", "Major", "Minor", "Note"}:
            raise ValueError(f"{ident}: 严重度无效")
        if issue.get("confidence") not in {"high", "medium", "low"}:
            raise ValueError(f"{ident}: 置信度无效")
        if type(issue.get("hard_rule_violation")) is not bool:
            raise ValueError(f"{ident}: 硬规则标记必须为布尔值")
        if issue.get("status") not in {"confirmed", "unresolved"}:
            raise ValueError(f"{ident}: 状态无效")
        if issue["status"] == "unresolved":
            pending.append(f"{ident}: 未决缺陷")
        if not issue.get("reason") or not evidence_ok(issue.get("evidence"), parts, ident):
            pending.append(f"{ident}: 缺问题依据")
        issues[ident] = issue
    dimensions = defaultdict(float)
    rows, used = [], set()
    for ident, criterion in expected.items():
        item = review["criteria"][ident]
        rating = item.get("rating")
        if rating is None:
            pending.append(f"{ident}: 未评分")
            continue
        if type(rating) is not int or rating not in rubric["rating_scale"]:
            raise ValueError(f"{ident}: 等级须为0到4的整数")
        if not item.get("reason") or not evidence_ok(item.get("evidence"), parts, ident):
            pending.append(f"{ident}: 缺评分依据")
        refs = item.get("issue_ids", [])
        if len(refs) != len(set(refs)):
            raise ValueError(f"{ident}: 缺陷引用重复")
        for ref in refs:
            if ref not in issues or issues[ref]["primary_criterion"] != ident:
                raise ValueError(f"{ident}: 缺陷{ref}不存在或跨项重复扣分")
            used.add(ref)
        if rating < 4 and not refs:
            pending.append(f"{ident}: 降分没有缺陷ID")
        if rating < 4 and refs and all(issues[r]["severity"] == "Note" for r in refs):
            raise ValueError(f"{ident}: 纯Note不得扣分")
        points = criterion["weight"] * rating / 4
        dimensions[criterion["dimension"]] += points
        rows.append({"id": ident, "rating": rating, "points": points, "weight": criterion["weight"]})
    for ident, issue in issues.items():
        if issue["status"] == "confirmed" and issue["severity"] != "Note":
            if ident not in used or review["criteria"][issue["primary_criterion"]]["rating"] == 4:
                pending.append(f"{ident}: 已确认缺陷没有反映在主项等级")
    decisions = review.get("scan_adjudications", [])
    signal_ids = {s["id"] for s in analysis["signals"]}
    if len({d["signal_id"] for d in decisions}) != len(decisions):
        raise ValueError("扫描裁决ID重复")
    if {d["signal_id"] for d in decisions} != signal_ids:
        raise ValueError("扫描裁决与当前正文不匹配")
    for decision in decisions:
        if decision.get("decision") not in {None, "confirmed", "false_positive", "exception", "unresolved"}:
            raise ValueError("未知扫描裁决")
        if decision.get("decision") in {None, "unresolved"} or not decision.get("reason"):
            pending.append(f"{decision['signal_id']}: 扫描待复核")
        refs = decision.get("issue_ids", [])
        if any(ref not in issues for ref in refs):
            raise ValueError("扫描裁决引用未知缺陷")
        if decision.get("decision") == "confirmed" and not refs:
            pending.append(f"{decision['signal_id']}: 确认命中但未归入缺陷")
    if not review.get("hook_ledger"):
        pending.append("缺钩子账本")
    pending.extend(str(x) for x in review.get("unresolved", []))
    confirmed = [i for i in issues.values() if i["status"] == "confirmed"]
    total = sum(r["points"] for r in rows)
    if pending:
        status = "PENDING"
    elif total < 60 or any(i["severity"] == "Critical" for i in confirmed):
        status = "REWORK"
    elif total < 80 or any(i["severity"] == "Major" or i["hard_rule_violation"] for i in confirmed):
        status = "REVISE"
    else:
        status = "READY"
    return {"rubric_version": rubric["version"], "sample_id": review["sample_id"],
            "reviewer": review["reviewer"], "review_stage": stage,
            "score": None if pending else total, "max_score": 100,
            "status": status, "excellent": not pending and total >= 90 and status == "READY",
            "dimensions": dict(dimensions), "criteria": rows, "pending": pending,
            "confirmed_issue_counts": {s: sum(i["severity"] == s for i in confirmed)
                                       for s in ["Critical", "Major", "Minor", "Note"]},
            "hard_rule_issue_ids": [i["id"] for i in confirmed if i["hard_rule_violation"]],
            "interpretation": "人工审稿结果的算术汇总；单审不是正式双审裁决；状态不重复扣分"}


def score_file(path):
    review = load_json(path)
    expected_sources = snapshot(review["sources"]["candidate"]["path"])
    if set(review["sources"]) != set(expected_sources):
        raise ValueError("输入或规则快照不完整")
    for key, value in expected_sources.items():
        if review["sources"][key] != value:
            raise ValueError(f"{key}: 路径或哈希已变，须重新审查")
    result = calculate(review, load_json(EVAL / "rubric.json"), analyze(read(expected_sources["candidate"]["path"])))
    result["review_file_sha256"] = digest(path)
    result["sources"] = expected_sources
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ["scan", "init", "score"]:
        child = sub.add_parser(name)
        child.add_argument("input", type=Path)
        child.add_argument("--out", type=Path, required=True)
        if name == "init":
            child.add_argument("--reviewer", required=True)
            child.add_argument("--sample-id", required=True)
    args = parser.parse_args()
    try:
        if args.command == "scan":
            result = scan(args.input)
        elif args.command == "init":
            result = make_review(args.input, args.reviewer, args.sample_id)
        else:
            result = score_file(args.input)
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        save_json(args.out, result, exclusive=args.command == "init")
        print(json.dumps({"output": str(args.out.resolve()), "status": result.get("status"),
                          "score": result.get("score"), "stats": result.get("stats")}, ensure_ascii=False))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(2, f"review error: {exc}\n")


if __name__ == "__main__":
    main()
