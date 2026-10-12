# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r"F:\bench-runs\grok-4.5\20260923-000045-YuriEdgeLadder\answer.md")
print("exists", p.exists())
if not p.exists():
    raise SystemExit(1)
text = p.read_text(encoding="utf-8")
print("bytes", p.stat().st_size)
print("chars", len(text))
heads = re.findall(r"^##\s*(R[1-5])\s*$", text, re.M)
print("heads", heads)
for h in ["R1", "R2", "R3", "R4", "R5"]:
    m = re.search(rf"^##\s*{h}\s*$(.*?)(?=^##\s*R|\Z)", text, re.M | re.S)
    if not m:
        print(h, "MISSING")
        continue
    body = m.group(1).strip()
    # rough CJK count
    n = len(re.findall(r"[\u4e00-\u9fff]", body))
    print(f"{h} cjk≈{n} paras={body.count(chr(10))+1}")
print("workdir listing:")
for f in sorted(p.parent.iterdir()):
    print(" ", f.name, f.stat().st_size)
