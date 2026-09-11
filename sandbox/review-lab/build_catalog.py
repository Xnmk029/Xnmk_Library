# -*- coding: utf-8 -*-
"""Build sandbox/review-lab/index.html (mobile app) from official PROJECT_PROMPT.md files."""
from __future__ import annotations

import html
import json
from pathlib import Path

LAB = Path(__file__).resolve().parent          # sandbox/review-lab
ROOT = LAB.parents[1]                           # repo root
OUT_HTML = LAB / "index.html"
OUT_JSON = LAB / "catalog.json"

CATALOG = [
    {
        "id": "double-wishbone",
        "name": "双叉臂前悬挂",
        "nameEn": "DoubleWishbone",
        "slug": "DoubleWishbone",
        "projectRel": "L2_Intermediate/DoubleWishbone",
        "level": "L2",
        "domain": "3D / 运动学",
        "isNew": False,
        "tags": ["3D", "约束求解", "汽车"],
        "summary": "单一 index.html 实现可验证的双叉臂前悬挂运动学：轮跳、齿条、主销与实时求解。",
        "deliverable": "index.html",
        "color": "#3b82f6",
    },
    {
        "id": "usp",
        "name": "USP Match 机械分解",
        "nameEn": "USP",
        "slug": "USP",
        "projectRel": "L3_Advanced/USP",
        "level": "L3",
        "domain": "3D / PS1",
        "isNew": False,
        "tags": ["Three.js", "动画", "低多边形"],
        "summary": "程序化低多边形 USP Match 分解/组装循环动画，Half-Life / PS1 美学，单 HTML 交付。",
        "deliverable": "answer.html",
        "color": "#a855f7",
    },
    {
        "id": "qin-bear-svg",
        "name": "北极熊骑秦始皇",
        "nameEn": "QinBearSVG",
        "slug": "QinBearSVG",
        "projectRel": "L1_Basic/QinBearSVG",
        "level": "L1",
        "domain": "SVG 插画",
        "isNew": True,
        "tags": ["SVG", "角色", "构图"],
        "summary": "纯矢量插画：北极熊骑乘秦始皇。考核剪影可读、主从关系与幽默构图。",
        "deliverable": "answer.svg",
        "color": "#f59e0b",
    },
    {
        "id": "style-continuation",
        "name": "有文风参考续写",
        "nameEn": "StyleContinuation",
        "slug": "StyleContinuation",
        "projectRel": "L3_Advanced/StyleContinuation",
        "level": "L3",
        "domain": "网文续写",
        "isNew": True,
        "tags": ["中文", "文风红线", "节奏"],
        "summary": "在长篇口语网文范文与硬性文风规约下，自倒计时处续写侯天一/小智故事。",
        "deliverable": "answer.md",
        "color": "#10b981",
    },
    {
        "id": "voxel-lujiazui",
        "name": "体素陆家嘴三件套",
        "nameEn": "VoxelLujiazui",
        "slug": "VoxelLujiazui",
        "projectRel": "L3_Advanced/VoxelLujiazui",
        "level": "L3",
        "domain": "体素城市",
        "isNew": True,
        "tags": ["体素", "数字沙盘", "第一人称"],
        "summary": "上帝视角 + 第一人称体素陆家嘴数字沙盘：三件套天际线、黄浦江、光影与动态环境。",
        "deliverable": "answer.html",
        "color": "#06b6d4",
    },
]


def load_prompt(rel: str) -> str:
    p = ROOT / rel / "PROJECT_PROMPT.md"
    return p.read_text(encoding="utf-8")


def main() -> None:
    items = []
    for meta in CATALOG:
        prompt = load_prompt(meta["projectRel"])
        item = dict(meta)
        item["prompt"] = prompt
        item["promptChars"] = len(prompt)
        item["promptLines"] = prompt.count("\n") + 1
        items.append(item)

    catalog = {
        "generated_from": "PROJECT_PROMPT.md",
        "sandbox": "sandbox/",
        "count": len(items),
        "questions": [
            {k: v for k, v in it.items()} for it in items
        ],
    }
    OUT_JSON.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Embed as JS safely
    payload = json.dumps(items, ensure_ascii=False)
    # Prevent </script> breakout
    payload = payload.replace("</script>", "<\\/script>").replace("</Script>", "<\\/script>")

    app = HTML_SHELL.replace("__DATA__", payload)
    OUT_HTML.write_text(app, encoding="utf-8")
    print(f"wrote {OUT_HTML.relative_to(ROOT)} ({OUT_HTML.stat().st_size} bytes)")
    print(f"wrote {OUT_JSON.relative_to(ROOT)} ({OUT_JSON.stat().st_size} bytes)")
    for it in items:
        print(f"  {it['level']} {it['name']}: {it['promptChars']} chars")


HTML_SHELL = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0b1220" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<title>题目目录 · Benchmark</title>
<style>
  :root {
    --bg: #0b1220;
    --bg2: #111a2b;
    --card: #152036;
    --card2: #1a2740;
    --text: #e8eefc;
    --muted: #93a4c3;
    --line: rgba(148, 163, 184, 0.16);
    --accent: #38bdf8;
    --ok: #34d399;
    --warn: #fbbf24;
    --danger: #f87171;
    --radius: 16px;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --tab-h: 64px;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    overscroll-behavior: none;
  }
  #app { min-height: 100%; padding-bottom: calc(var(--tab-h) + var(--safe-bottom) + 12px); }

  .top {
    position: sticky; top: 0; z-index: 20;
    padding: calc(12px + var(--safe-top)) 16px 12px;
    background: linear-gradient(180deg, rgba(11,18,32,0.98), rgba(11,18,32,0.92) 70%, rgba(11,18,32,0.86));
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .top h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .top .sub {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
  }
  .search {
    margin-top: 12px;
    display: flex; gap: 8px; align-items: center;
  }
  .search input {
    flex: 1;
    border: 1px solid var(--line);
    background: var(--bg2);
    color: var(--text);
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 15px;
    outline: none;
  }
  .search input:focus { border-color: rgba(56,189,248,0.45); }
  .chips {
    display: flex; gap: 8px; overflow-x: auto; margin-top: 10px;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    flex: 0 0 auto;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
  }
  .chip.on {
    background: rgba(56,189,248,0.14);
    border-color: rgba(56,189,248,0.45);
    color: var(--accent);
  }

  .list { padding: 12px 14px 8px; display: grid; gap: 12px; }
  .card {
    background: linear-gradient(180deg, var(--card), var(--card2));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 14px 14px 12px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.22);
  }
  .card:active { transform: scale(0.988); }
  .row { display: flex; gap: 10px; align-items: flex-start; }
  .icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: grid; place-items: center;
    font-size: 18px; font-weight: 800;
    color: #0b1220;
    flex: 0 0 auto;
  }
  .meta { flex: 1; min-width: 0; }
  .title-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .title { font-size: 16px; font-weight: 700; }
  .badge {
    font-size: 10px; font-weight: 800; letter-spacing: 0.04em;
    border-radius: 6px; padding: 2px 6px;
    background: rgba(56,189,248,0.15); color: var(--accent);
  }
  .badge.new { background: rgba(251,191,36,0.16); color: var(--warn); }
  .path {
    margin-top: 2px;
    font-size: 11px; color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    word-break: break-all;
  }
  .summary {
    margin-top: 8px;
    font-size: 13px; color: #c7d4ef;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tag {
    font-size: 11px; color: var(--muted);
    border: 1px solid var(--line); border-radius: 999px;
    padding: 2px 8px;
  }
  .empty {
    text-align: center; color: var(--muted); padding: 48px 16px; font-size: 14px;
  }

  /* Detail */
  .detail {
    position: fixed; inset: 0; z-index: 40;
    background: var(--bg);
    display: none;
    flex-direction: column;
  }
  .detail.open { display: flex; }
  .dhead {
    padding: calc(10px + var(--safe-top)) 12px 10px;
    border-bottom: 1px solid var(--line);
    background: rgba(11,18,32,0.96);
    display: flex; align-items: center; gap: 8px;
  }
  .back {
    border: 1px solid var(--line); background: var(--bg2); color: var(--text);
    border-radius: 10px; min-width: 40px; height: 40px; font-size: 18px; padding: 0 12px;
  }
  .dhead .t { flex: 1; min-width: 0; }
  .dhead .t .n { font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dhead .t .p { font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; }
  .dbody { flex: 1; overflow: auto; padding: 14px 14px calc(24px + var(--safe-bottom)); -webkit-overflow-scrolling: touch; }
  .hero {
    border-radius: var(--radius); padding: 16px;
    border: 1px solid var(--line);
    background: linear-gradient(145deg, rgba(56,189,248,0.12), rgba(15,23,42,0.2));
    margin-bottom: 14px;
  }
  .hero h2 { margin: 0 0 6px; font-size: 18px; }
  .hero p { margin: 0; color: #c7d4ef; font-size: 13px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .stat {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 12px; padding: 10px; text-align: center;
  }
  .stat b { display: block; font-size: 16px; }
  .stat span { font-size: 11px; color: var(--muted); }
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .btn {
    border: 1px solid var(--line); background: var(--card2); color: var(--text);
    border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 700;
  }
  .btn.primary {
    background: linear-gradient(180deg, #38bdf8, #0ea5e9);
    border-color: transparent; color: #04111f;
  }
  .btn.ghost { background: transparent; }
  .section-title {
    margin: 16px 0 8px; font-size: 13px; font-weight: 800;
    letter-spacing: 0.08em; color: var(--muted); text-transform: uppercase;
  }
  .code {
    background: #0a1020;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
    color: #dbe7ff;
    line-height: 1.55;
  }
  .prompt {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
    font-size: 13.5px;
    white-space: pre-wrap;
    word-break: break-word;
    color: #e7eefc;
    line-height: 1.7;
  }
  .toast {
    position: fixed; left: 50%; bottom: calc(var(--tab-h) + 24px + var(--safe-bottom));
    transform: translateX(-50%) translateY(20px);
    background: #111827; color: white;
    border: 1px solid rgba(56,189,248,0.35);
    padding: 10px 16px; border-radius: 999px;
    font-size: 13px; font-weight: 600;
    opacity: 0; pointer-events: none; transition: 0.22s ease;
    z-index: 80; max-width: 90vw; text-align: center;
  }
  .toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }

  .tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    height: calc(var(--tab-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    display: grid; grid-template-columns: 1fr 1fr;
    background: rgba(11,18,32,0.96);
    border-top: 1px solid var(--line);
    backdrop-filter: blur(12px);
  }
  .tab {
    border: 0; background: transparent; color: var(--muted);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; font-size: 11px; font-weight: 700;
  }
  .tab .ic { font-size: 18px; line-height: 1; }
  .tab.on { color: var(--accent); }
  .pane { display: none; }
  .pane.on { display: block; }
  .guide {
    padding: 16px 16px 24px;
  }
  .guide .card { margin-bottom: 12px; }
  .guide h3 { margin: 0 0 8px; font-size: 15px; }
  .guide p, .guide li { color: #c7d4ef; font-size: 13.5px; }
  .guide ol, .guide ul { margin: 8px 0; padding-left: 18px; }
  .guide li { margin: 6px 0; }
  .kbd {
    font-family: ui-monospace, monospace; font-size: 12px;
    background: #0a1020; border-radius: 6px; padding: 1px 6px;
    border: 1px solid var(--line); color: #9fd4ff;
  }
</style>
</head>
<body>
<div id="app">
  <div class="pane on" id="pane-home">
    <header class="top">
      <h1>题目目录</h1>
      <div class="sub">Benchmark 隔离派发 · <span id="countLabel">0</span> 题 · 沙箱 <span class="kbd">sandbox/</span></div>
      <div class="search">
        <input id="q" type="search" placeholder="搜索题目 / 标签 / 路径" autocomplete="off" />
      </div>
      <div class="chips" id="chips"></div>
    </header>
    <main class="list" id="list"></main>
  </div>

  <div class="pane" id="pane-guide">
    <header class="top">
      <h1>派发指南</h1>
      <div class="sub">prepare → 受测 → review → collect</div>
    </header>
    <div class="guide">
      <div class="card">
        <h3>1. 组卷（隔离 run）</h3>
        <p>在仓库根目录执行：</p>
        <div class="code">python sandbox/scripts/prepare_run.py --list
python sandbox/scripts/prepare_run.py --project DoubleWishbone --model my-model-slug</div>
        <p style="margin-top:10px;color:var(--muted);font-size:12px">只生成题面 + 纪律，不含其他模型输出与评分细则。</p>
      </div>
      <div class="card">
        <h3>2. 交给受测模型</h3>
        <ul>
          <li>仅挂载 run 目录：<span class="kbd">sandbox/runs/&lt;model&gt;/&lt;run_id&gt;/</span></li>
          <li>受测只读 <span class="kbd">TASK.md</span> 与 <span class="kbd">PROJECT_PROMPT.md</span></li>
          <li>交付物写在 run 内（见题目详情）+ <span class="kbd">result.json</span>（含 integrity）</li>
        </ul>
      </div>
      <div class="card">
        <h3>3. 自动审阅（仅题面口径）</h3>
        <div class="code">python sandbox/scripts/review_run.py --model my-model-slug --latest --strict</div>
        <p style="margin-top:10px;color:var(--muted);font-size:12px">产出 REVIEW.md 与 verdict；不读 README 评分细项。</p>
      </div>
      <div class="card">
        <h3>4. 收卷入库</h3>
        <div class="code">python sandbox/scripts/collect_run.py --run sandbox/runs/my-model-slug/&lt;run_id&gt; --dry-run
python sandbox/scripts/collect_run.py --run sandbox/runs/my-model-slug/&lt;run_id&gt;</div>
        <p style="margin-top:10px;color:var(--muted);font-size:12px">校验题面 SHA 后拷入 L*/项目/&lt;model&gt;/。</p>
      </div>
      <div class="card">
        <h3>隔离红线</h3>
        <ul>
          <li>禁止附带其他模型 answer / log / result</li>
          <li>禁止把 README 评分建议注入受测 run</li>
          <li>禁止读 DOMAIN_INDEX* 与暂存批次</li>
          <li>协议全文：<span class="kbd">sandbox/AGENTS.md</span></li>
        </ul>
      </div>
    </div>
  </div>

  <nav class="tabbar">
    <button class="tab on" data-pane="home"><span class="ic">📚</span><span>题库</span></button>
    <button class="tab" data-pane="guide"><span class="ic">🚀</span><span>派发</span></button>
  </nav>
</div>

<section class="detail" id="detail" aria-hidden="true">
  <header class="dhead">
    <button class="back" id="backBtn" type="button">‹</button>
    <div class="t">
      <div class="n" id="dName">—</div>
      <div class="p" id="dPath">—</div>
    </div>
  </header>
  <div class="dbody" id="dBody"></div>
</section>

<div class="toast" id="toast"></div>

<script>
const QUESTIONS = __DATA__;
let filterLevel = "ALL";
let query = "";

const $ = (s, el=document) => el.querySelector(s);
const listEl = $("#list");
const chipsEl = $("#chips");
const toastEl = $("#toast");

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove("on"), 1800);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

function levelOf(q) { return q.level; }

function matches(q) {
  if (filterLevel !== "ALL") {
    if (filterLevel === "NEW" && !q.isNew) return false;
    if (filterLevel !== "NEW" && q.level !== filterLevel) return false;
  }
  if (!query) return true;
  const hay = [q.name, q.nameEn, q.slug, q.projectRel, q.domain, q.summary, (q.tags||[]).join(" ")].join("\n").toLowerCase();
  return hay.includes(query.toLowerCase());
}

function renderChips() {
  const levels = ["ALL", "L1", "L2", "L3", "NEW"];
  chipsEl.innerHTML = levels.map(l => {
    const label = l === "ALL" ? "全部" : l === "NEW" ? "新题" : l;
    return `<button class="chip ${filterLevel===l?"on":""}" data-level="${l}" type="button">${label}</button>`;
  }).join("");
}

function renderList() {
  const rows = QUESTIONS.filter(matches);
  $("#countLabel").textContent = String(QUESTIONS.length);
  if (!rows.length) {
    listEl.innerHTML = `<div class="empty">没有匹配的题目</div>`;
    return;
  }
  listEl.innerHTML = rows.map(q => {
    const initials = (q.nameEn || q.name).slice(0, 2);
    return `
    <article class="card" data-id="${q.id}" role="button" tabindex="0">
      <div class="row">
        <div class="icon" style="background:${q.color}">${initials}</div>
        <div class="meta">
          <div class="title-row">
            <div class="title">${escapeHtml(q.name)}</div>
            <span class="badge">${q.level}</span>
            ${q.isNew ? `<span class="badge new">NEW</span>` : ""}
          </div>
          <div class="path">${escapeHtml(q.projectRel)}</div>
        </div>
      </div>
      <div class="summary">${escapeHtml(q.summary)}</div>
      <div class="tags">
        <span class="tag">${escapeHtml(q.domain)}</span>
        ${(q.tags||[]).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
        <span class="tag">${q.promptChars} 字符题面</span>
      </div>
    </article>`;
  }).join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dispatchSnippets(q) {
  const p = q.projectRel;
  const prepare = `python sandbox/scripts/prepare_run.py --project ${p} --model <model-slug>\n# 或短名：--project ${q.slug}`;
  const review = `python sandbox/scripts/review_run.py --model <model-slug> --latest --strict`;
  const collect = `python sandbox/scripts/collect_run.py --run sandbox/runs/<model-slug>/<run_id> --dry-run`;
  const hint = `你的工作目录是隔离 sandbox run：\n只允许读本目录 TASK.md 与 PROJECT_PROMPT.md。\n交付：${q.deliverable} + result.json（含 integrity）。`;
  return { prepare, review, collect, hint };
}

function openDetail(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) return;
  const d = $("#detail");
  $("#dName").textContent = q.name;
  $("#dPath").textContent = q.projectRel;
  const sn = dispatchSnippets(q);
  $("#dBody").innerHTML = `
    <div class="hero" style="border-color:${q.color}55">
      <h2>${escapeHtml(q.name)} ${q.isNew ? '<span class="badge new">新题</span>' : ''}</h2>
      <p>${escapeHtml(q.summary)}</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${q.level}</b><span>难度</span></div>
      <div class="stat"><b>${q.promptLines}</b><span>题面行数</span></div>
      <div class="stat"><b>${q.deliverable}</b><span>交付物</span></div>
    </div>
    <div class="actions">
      <button class="btn primary" id="copyPrompt" type="button">复制题面</button>
      <button class="btn" id="copyCmd" type="button">复制组卷命令</button>
      <button class="btn ghost" id="copyHint" type="button">复制派发话术</button>
      <button class="btn ghost" id="copyPath" type="button">复制项目路径</button>
    </div>
    <div class="section-title">隔离派发命令</div>
    <div class="code">${escapeHtml(sn.prepare)}

${escapeHtml(sn.review)}

${escapeHtml(sn.collect)}</div>
    <div class="section-title">给受测会话的话术</div>
    <div class="code">${escapeHtml(sn.hint)}</div>
    <div class="section-title">PROJECT_PROMPT.md（唯一标准）</div>
    <div class="prompt" id="promptBox">${escapeHtml(q.prompt)}</div>
    <div class="section-title">协议</div>
    <div class="code">审阅范围：project_prompt_only\n协议：sandbox/AGENTS.md\n目录：sandbox/README.md</div>
  `;
  $("#copyPrompt").onclick = async () => {
    const ok = await copyText(q.prompt);
    toast(ok ? "题面已复制" : "复制失败");
  };
  $("#copyCmd").onclick = async () => {
    const ok = await copyText(sn.prepare);
    toast(ok ? "组卷命令已复制" : "复制失败");
  };
  $("#copyHint").onclick = async () => {
    const ok = await copyText(sn.hint);
    toast(ok ? "派发话术已复制" : "复制失败");
  };
  $("#copyPath").onclick = async () => {
    const ok = await copyText(q.projectRel);
    toast(ok ? "路径已复制" : "复制失败");
  };
  d.classList.add("open");
  d.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  const d = $("#detail");
  d.classList.remove("open");
  d.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// events
listEl.addEventListener("click", (e) => {
  const card = e.target.closest(".card[data-id]");
  if (card) openDetail(card.getAttribute("data-id"));
});
listEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".card[data-id]");
    if (card) { e.preventDefault(); openDetail(card.getAttribute("data-id")); }
  }
});
$("#backBtn").addEventListener("click", closeDetail);
$("#q").addEventListener("input", (e) => { query = e.target.value || ""; renderList(); });
chipsEl.addEventListener("click", (e) => {
  const b = e.target.closest(".chip[data-level]");
  if (!b) return;
  filterLevel = b.getAttribute("data-level");
  renderChips(); renderList();
});
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const name = btn.getAttribute("data-pane");
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === btn));
    $("#pane-home").classList.toggle("on", name === "home");
    $("#pane-guide").classList.toggle("on", name === "guide");
  });
});

renderChips();
renderList();
</script>
</body>
</html>
'''

if __name__ == "__main__":
    main()
