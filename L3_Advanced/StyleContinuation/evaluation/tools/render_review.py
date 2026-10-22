"""Render a completed evidence-based review; never invent or fill judgments."""
import argparse
import json
from pathlib import Path

import review as workflow


def cell(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


def citations(items):
    return "；".join(f"P{x['paragraph']:03}：{x['quote']}" for x in items)


def render(path):
    document = workflow.load_json(path)
    score = workflow.score_file(path)
    names = {c["id"]: c for c in workflow.load_json(workflow.EVAL / "rubric.json")["criteria"]}
    title = document.get("display_title", document["sample_id"])
    lines = [f"# {title}：全文评审", "",
             f"评委：{document['reviewer']}；阶段：{document['review_stage']}；规则：{score['rubric_version']}。", "",
             f"**得分：{score['score'] if score['score'] is not None else '待定'}/100；编辑状态：{score['status']}。**", "",
             document.get("summary", ""), "", "## 来源与完整性", "",
             f"- 样本：`{document['sample_id']}`",
             f"- 正文：[打开原文]({Path(document['sources']['candidate']['path']).as_posix()})",
             f"- 正文SHA-256：`{document['sources']['candidate']['sha256']}`",
             f"- 评审JSON：[证据记录]({Path(path).resolve().as_posix()})",
             f"- 评审性质：{document.get('notes', '当前模型单审，不是独立双审裁决。')}", ""]
    if score["pending"]:
        lines += ["待决：" + "；".join(score["pending"]), ""]
    if document.get("plot_review"):
        lines += ["## 剧情与文风总评", "", document["plot_review"], ""]
    lines += ["## 25项评分", "", "| 项目 | 等级 | 得分 | 判断与原文证据 |", "|---|---:|---:|---|"]
    calculated = {x["id"]: x for x in score["criteria"]}
    for ident, item in document["criteria"].items():
        points = calculated.get(ident, {}).get("points", "待定")
        why = item["reason"] + " " + citations(item["evidence"])
        lines.append(f"| {ident} {names[ident]['name']} | {item['rating']} | {points}/{names[ident]['weight']} | {cell(why)} |")
    lines += ["", "## 缺陷与修改优先级", ""]
    for issue in document["issues"]:
        lines += [f"### {issue['id']} · {issue['primary_criterion']} · {issue['severity']}", "",
                  issue["reason"], "", "原文：" + citations(issue["evidence"]), "",
                  f"状态：{issue['status']}；置信度：{issue['confidence']}；硬规则违例：{issue['hard_rule_violation']}。", ""]
        if issue.get("recommendation"):
            lines += ["修改方向：" + issue["recommendation"], ""]
    lines += ["## 钩子账本", "", "| 钩子 | 状态 | 说明与证据 |", "|---|---|---|"]
    for hook in document["hook_ledger"]:
        lines.append(f"| {hook['id']} | {cell(hook['status'])} | {cell(hook['reason'] + ' ' + citations(hook.get('evidence', [])))} |")
    lines += ["", "## 预检人工裁决", "", "| 信号 | 裁决 | 说明 |", "|---|---|---|"]
    for item in document["scan_adjudications"]:
        lines.append(f"| {item['signal_id']} | {item['decision']} | {cell(item['reason'])} |")
    if document.get("fact_checks"):
        lines += ["", "## 事实复核", ""]
        for fact in document["fact_checks"]:
            lines += ["- " + fact, ""]
    return "\n".join(lines).rstrip() + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    output = render(args.input)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(output, encoding="utf-8")
    print(json.dumps({"report": str(args.out.resolve())}, ensure_ascii=False))
