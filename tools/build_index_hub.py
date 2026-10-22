import os
import re
import json

base_dir = r"F:\benchmark"

# Categories to scan
categories = [
    ("L1_Basic", "Level 1: 基础工具与脚本类", "L1"),
    ("L2_Intermediate", "Level 2: 中级 Web 应用与交互游戏类", "L2"),
    ("L3_Advanced", "Level 3: 高级 3D 引擎与物理仿真类", "L3"),
    ("L4_Expert", "Level 4: 专家级原生引擎与硬件协议类", "L4"),
    ("Image", "Image: 图像生成与编辑评测", "Image"),
]

# Read README.md for metadata
readme_path = os.path.join(base_dir, "README.md")
meta_map = {}
if os.path.exists(readme_path):
    with open(readme_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("|") and "[`" in line:
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 6:
                    proj_match = re.search(r'\[`([^`]+)`\]', parts[2])
                    if proj_match:
                        proj_id = proj_match.group(1)
                        title = parts[3].replace("**", "").strip()
                        domain = parts[4].strip()
                        level = parts[5].replace("`", "").strip()
                        meta_map[proj_id] = {
                            "title": title,
                            "domain": domain,
                            "level": level
                        }

# Fallback / additional manual meta
manual_meta = {
    "ASCII_Logo": {
        "title": "ASCII：模型 ID + Logo 字符画",
        "domain": "视觉艺术与现代 UI 组件",
        "level": "L1"
    },
    "BicycleDrivetrain": {
        "title": "自行车：低多边形动态传动展示台",
        "domain": "3D 图形、物理仿真与 Shaders",
        "level": "L3"
    },
    "Minecraft": {
        "title": "我的世界：3D 体素沙盒世界",
        "domain": "3D 图形、物理仿真与 Shaders",
        "level": "L3"
    },
    "InteriorDesignRender": {
        "title": "室内软装与空间渲染",
        "domain": "图像生成与编辑",
        "level": "Image"
    }
}

for k, v in manual_meta.items():
    if k not in meta_map:
        meta_map[k] = v

projects_data = []

for cat_folder, cat_label, level_tag in categories:
    cat_dir = os.path.join(base_dir, cat_folder)
    if not os.path.isdir(cat_dir):
        continue
    
    for proj in sorted(os.listdir(cat_dir)):
        proj_dir = os.path.join(cat_dir, proj)
        if not os.path.isdir(proj_dir) or proj.startswith(".") or proj.startswith("_") or proj in ["scores", "scripts"]:
            continue
        
        meta = meta_map.get(proj, {
            "title": proj,
            "domain": "基准评测",
            "level": level_tag
        })
        
        # Check prompt & readme
        has_prompt = os.path.exists(os.path.join(proj_dir, "PROJECT_PROMPT.md"))
        has_readme = os.path.exists(os.path.join(proj_dir, "README.md"))
        
        # Discover models and deliverables
        models_list = []
        for item in sorted(os.listdir(proj_dir)):
            item_path = os.path.join(proj_dir, item)
            if os.path.isdir(item_path) and not item.startswith(".") and item not in ("golden", "verify"):
                files = os.listdir(item_path)
                entries = []
                priority_names = [
                    "index.html", "mona_lisa.svg", "bilibili-ip.user.js", 
                    "bilibili_comment_ip.user.js", "main.py", "city.html",
                    "usp-match-exploded.html", "test.html"
                ]
                for p_name in priority_names:
                    if p_name in files and p_name not in entries:
                        entries.append(p_name)
                for f in files:
                    if f.endswith((".html", ".svg", ".user.js", ".py")) and f not in entries:
                        entries.append(f)
                
                img_files = [f for f in files if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
                
                if entries or img_files:
                    models_list.append({
                        "model_name": item,
                        "folder_rel": f"{cat_folder}/{proj}/{item}",
                        "entries": entries,
                        "images": img_files[:4]
                    })
        
        # Check root files of project
        root_files = [
            f for f in os.listdir(proj_dir) 
            if f.endswith((".html", ".svg", ".py", ".user.js")) and os.path.isfile(os.path.join(proj_dir, f))
        ]
        
        projects_data.append({
            "id": proj,
            "category_folder": cat_folder,
            "category_label": cat_label,
            "level": meta.get("level", level_tag),
            "title": meta.get("title", proj),
            "domain": meta.get("domain", "通用评测"),
            "rel_path": f"{cat_folder}/{proj}",
            "has_prompt": has_prompt,
            "has_readme": has_readme,
            "models": models_list,
            "root_entries": root_files
        })

print(f"Total projects processed: {len(projects_data)}")

# HTML structure
html_head = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 大语言模型 Benchmark 测试套件 · 快捷全景导航枢纽</title>
  <style>
    :root {
      --bg-primary: #0a0c10;
      --bg-surface: #12161f;
      --bg-surface-elevated: #1a202c;
      --border-color: #242c3d;
      --border-focus: #3b82f6;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent-blue: #38bdf8;
      --accent-indigo: #818cf8;
      --accent-emerald: #34d399;
      --accent-amber: #fbbf24;
      --accent-rose: #f43f5e;
      --accent-purple: #c084fc;
      --gemini-color: #4ade80;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      --font-mono: "JetBrains Mono", Consolas, Monaco, "Courier New", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      min-height: 100vh;
      overflow-x: hidden;
    }

    .bg-glow {
      position: fixed;
      top: -200px;
      left: 50%;
      transform: translateX(-50%);
      width: 1200px;
      height: 600px;
      background: radial-gradient(ellipse at center, rgba(56, 189, 248, 0.08) 0%, rgba(129, 140, 248, 0.04) 40%, rgba(10, 12, 16, 0) 70%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      max-width: 1560px;
      margin: 0 auto;
      padding: 32px 24px 80px;
      position: relative;
      z-index: 1;
    }

    header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }

    .brand-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-badge {
      font-size: 12px;
      font-family: var(--font-mono);
      padding: 3px 8px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent-blue);
      border-radius: var(--radius-sm);
      text-transform: uppercase;
    }

    .header-desc {
      color: var(--text-muted);
      font-size: 15px;
      max-width: 960px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .action-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      text-decoration: none;
      font-size: 13px;
      border-radius: var(--radius-md);
      transition: all 0.2s;
    }

    .action-link:hover {
      background: var(--bg-surface-elevated);
      border-color: var(--accent-blue);
      color: var(--accent-blue);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-dim);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: var(--text-main);
    }

    .stat-sub {
      font-size: 12px;
      color: var(--accent-emerald);
    }

    .toolbar {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 16px 20px;
      margin-bottom: 28px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: sticky;
      top: 16px;
      z-index: 100;
      backdrop-filter: blur(16px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    }

    .search-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-input-wrapper {
      flex: 1;
      position: relative;
    }

    .search-input {
      width: 100%;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 10px 16px 10px 38px;
      font-size: 14px;
      border-radius: var(--radius-md);
      outline: none;
      transition: all 0.2s;
    }

    .search-input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      pointer-events: none;
    }

    .filter-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .filter-group-label {
      font-size: 12px;
      color: var(--text-dim);
      margin-right: 4px;
      font-weight: 600;
    }

    .tag-btn {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 5px 12px;
      font-size: 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
      font-family: var(--font-sans);
    }

    .tag-btn:hover {
      border-color: var(--text-muted);
      color: var(--text-main);
    }

    .tag-btn.active {
      background: rgba(56, 189, 248, 0.15);
      border-color: var(--accent-blue);
      color: var(--accent-blue);
      font-weight: 600;
    }

    .tag-btn.tag-gemini.active {
      background: rgba(74, 222, 128, 0.15);
      border-color: var(--gemini-color);
      color: var(--gemini-color);
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      margin: 32px 0 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-main);
    }

    .level-pill {
      font-size: 11px;
      font-family: var(--font-mono);
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
    }

    .level-pill.L1 { background: rgba(52, 211, 153, 0.12); border-color: rgba(52, 211, 153, 0.3); color: #34d399; }
    .level-pill.L2 { background: rgba(56, 189, 248, 0.12); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8; }
    .level-pill.L3 { background: rgba(129, 140, 248, 0.12); border-color: rgba(129, 140, 248, 0.3); color: #818cf8; }
    .level-pill.L4 { background: rgba(244, 63, 94, 0.12); border-color: rgba(244, 63, 94, 0.3); color: #f43f5e; }
    .level-pill.Image { background: rgba(192, 132, 252, 0.12); border-color: rgba(192, 132, 252, 0.3); color: #c084fc; }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }

    .project-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .project-card:hover {
      border-color: #3b82f6;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .card-header { margin-bottom: 12px; }

    .card-top-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .card-domain {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 500;
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .card-id {
      font-size: 12px;
      font-family: var(--font-mono);
      color: var(--text-dim);
    }

    .card-docs {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }

    .doc-link {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      text-decoration: none;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }

    .doc-link:hover {
      border-color: var(--accent-blue);
      color: var(--accent-blue);
    }

    .card-models {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .models-label {
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 600;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
    }

    .model-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .model-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 12px;
      transition: all 0.15s;
    }

    .model-item:hover { border-color: #475569; }

    .model-item.is-gemini {
      border-color: rgba(74, 222, 128, 0.35);
      background: rgba(74, 222, 128, 0.05);
    }

    .model-name {
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .model-name.gemini-text {
      color: var(--gemini-color);
    }

    .model-actions {
      display: flex;
      gap: 6px;
    }

    .btn-run {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent-blue);
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-run:hover {
      background: rgba(56, 189, 248, 0.3);
      color: #fff;
    }

    .btn-run.btn-gemini {
      background: rgba(74, 222, 128, 0.2);
      border-color: rgba(74, 222, 128, 0.4);
      color: var(--gemini-color);
    }

    .btn-run.btn-gemini:hover {
      background: rgba(74, 222, 128, 0.35);
      color: #fff;
    }

    .btn-preview {
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 3px 7px;
      font-size: 11px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }

    .btn-preview:hover {
      border-color: var(--text-main);
      color: var(--text-main);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      flex-direction: column;
      padding: 24px;
    }

    .modal-overlay.active { display: flex; }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      color: #fff;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      font-family: var(--font-mono);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .modal-btn-group { display: flex; gap: 8px; }

    .modal-btn {
      padding: 6px 12px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-color);
      color: #fff;
      font-size: 13px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-decoration: none;
    }

    .modal-btn:hover { border-color: var(--accent-blue); }

    .modal-body {
      flex: 1;
      background: #000;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
      position: relative;
    }

    .modal-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .no-results {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-dim);
      display: none;
    }

    footer {
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      text-align: center;
      color: var(--text-dim);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="bg-glow"></div>

  <div class="container">
    <header>
      <div class="header-top">
        <div>
          <div class="brand-title">
            <span>⚡ AI LLM Benchmark 测试套件</span>
            <span class="brand-badge">Quick Jump Hub</span>
          </div>
          <p class="header-desc">
            全景代码生成与系统架构横向评测套件 · 覆盖 L1 基础脚本至 L4 专家级引擎 · 包含 Gemini 3.7 Flash、Grok 4.6、DeepSeek V4、GLM 5.3 等多模型原生交付成果
          </p>
        </div>
        <div class="header-actions">
          <a href="./DOMAIN_INDEX.zh.md" class="action-link" target="_blank">📋 全景提示词索引</a>
          <a href="./PARALLEL-TEST-REPORT.md" class="action-link" target="_blank">📊 并行测试报告</a>
          <a href="./LIVE_BROADCAST_PLAN_GEMINI_GLM_DEEPSEEK.md" class="action-link" target="_blank">🎥 直播策划案</a>
          <a href="./README.md" class="action-link" target="_blank">📖 README</a>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">总评测项目数</span>
          <span class="stat-value" id="stat-total-proj">__TOTAL_PROJ__</span>
          <span class="stat-sub">5 大技术领域 · L1–L4 + Image</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">已交付模型成果数</span>
          <span class="stat-value" id="stat-total-runs" style="color: var(--accent-blue);">__TOTAL_RUNS__</span>
          <span class="stat-sub">独立代码工程 / 交付版本</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Gemini 3.7 Flash 成果</span>
          <span class="stat-value" id="stat-gemini-runs" style="color: var(--gemini-color);">__GEMINI_RUNS__</span>
          <span class="stat-sub">最新 10 项并发纯提示词全闭合生成</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">交互式 Web 演示</span>
          <span class="stat-value" id="stat-web-demos" style="color: var(--accent-amber);">__WEB_DEMOS__</span>
          <span class="stat-sub">支持在屏即时预览与独立运行</span>
        </div>
      </div>
    </header>

    <div class="toolbar">
      <div class="search-row">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" class="search-input" placeholder="输入关键词快速检索（项目名、中文标题、技术领域、模型名称如 gemini / grok / deepseek / 3D / 物理）..." autocomplete="off">
        </div>
      </div>
      <div class="filter-tags">
        <span class="filter-group-label">难度阶梯:</span>
        <button class="tag-btn active" data-filter-type="level" data-filter-val="all">全部 (All)</button>
        <button class="tag-btn" data-filter-type="level" data-filter-val="L1">L1 基础工具</button>
        <button class="tag-btn" data-filter-type="level" data-filter-val="L2">L2 交互游戏</button>
        <button class="tag-btn" data-filter-type="level" data-filter-val="L3">L3 3D与物理</button>
        <button class="tag-btn" data-filter-type="level" data-filter-val="L4">L4 专家引擎</button>
        <button class="tag-btn" data-filter-type="level" data-filter-val="Image">Image 图像</button>

        <span class="filter-group-label" style="margin-left: 12px;">模型筛选:</span>
        <button class="tag-btn tag-gemini" data-filter-type="model" data-filter-val="gemini-3.7-flash">⚡ Gemini 3.7 Flash</button>
        <button class="tag-btn" data-filter-type="model" data-filter-val="grok">Grok 4.6</button>
        <button class="tag-btn" data-filter-type="model" data-filter-val="deepseek">DeepSeek V4</button>
        <button class="tag-btn" data-filter-type="model" data-filter-val="glm">GLM 5.3</button>
        <button class="tag-btn" data-filter-type="model" data-filter-val="claude">Claude</button>
        <button class="tag-btn" data-filter-type="model" data-filter-val="qwen">Qwen</button>
      </div>
    </div>

    <div id="cardsRoot">
      __CARDS_HTML__
    </div>

    <div class="no-results" id="noResults">
      <h3>未找到匹配的评测项目或模型交付物</h3>
      <p style="margin-top: 8px;">请尝试更换搜索词或清除筛选条件</p>
    </div>

    <footer>
      <p>AI LLM Benchmark Suite · 本地全景快捷跳转目录 · 开源基于 MIT 协议</p>
    </footer>
  </div>

  <div class="modal-overlay" id="previewModal">
    <div class="modal-header">
      <div class="modal-title">
        <span id="modalTitle">Demo Preview</span>
        <span class="brand-badge" id="modalBadge">HTML</span>
      </div>
      <div class="modal-btn-group">
        <a id="modalExternalLink" href="#" target="_blank" class="modal-btn">新标签页打开 ↗</a>
        <button class="modal-btn" onclick="closeModal()">关闭 ✕</button>
      </div>
    </div>
    <div class="modal-body">
      <iframe id="modalIframe" class="modal-iframe" src="about:blank"></iframe>
    </div>
  </div>

  <script>
    const projectsData = __PROJECTS_JSON__;

    let currentLevel = 'all';
    let currentModel = 'all';
    let searchQuery = '';

    const searchInput = document.getElementById('searchInput');
    const noResults = document.getElementById('noResults');
    const cardsRoot = document.getElementById('cardsRoot');

    document.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.filterType;
        const val = btn.dataset.filterVal;

        if (type === 'level') {
          document.querySelectorAll('.tag-btn[data-filter-type="level"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentLevel = val;
        } else if (type === 'model') {
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            currentModel = 'all';
          } else {
            document.querySelectorAll('.tag-btn[data-filter-type="model"]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentModel = val;
          }
        }
        applyFilters();
      });
    });

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      applyFilters();
    });

    function applyFilters() {
      let visibleCount = 0;
      const cards = document.querySelectorAll('.project-card');

      cards.forEach(card => {
        const pLevel = card.dataset.level;
        const pTitle = (card.dataset.title || '').toLowerCase();
        const pDomain = (card.dataset.domain || '').toLowerCase();
        const pId = (card.dataset.id || '').toLowerCase();
        const pModels = (card.dataset.models || '').toLowerCase();

        let matchLevel = (currentLevel === 'all' || pLevel === currentLevel);
        let matchModel = (currentModel === 'all' || pModels.includes(currentModel));
        let matchSearch = true;

        if (searchQuery) {
          matchSearch = pTitle.includes(searchQuery) ||
                        pDomain.includes(searchQuery) ||
                        pId.includes(searchQuery) ||
                        pModels.includes(searchQuery);
        }

        if (matchLevel && matchModel && matchSearch) {
          card.style.display = 'flex';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      document.querySelectorAll('.section-block').forEach(sec => {
        const hasVisible = Array.from(sec.querySelectorAll('.project-card')).some(c => c.style.display !== 'none');
        sec.style.display = hasVisible ? 'block' : 'none';
      });

      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    const modal = document.getElementById('previewModal');
    const modalIframe = document.getElementById('modalIframe');
    const modalTitle = document.getElementById('modalTitle');
    const modalExternalLink = document.getElementById('modalExternalLink');

    function openPreview(url, title) {
      modalTitle.textContent = title;
      modalExternalLink.href = url;
      modalIframe.src = url;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.classList.remove('active');
      modalIframe.src = 'about:blank';
      document.body.style.overflow = 'auto';
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  </script>
</body>
</html>
"""

# Build card HTML and stats
total_proj = len(projects_data)
total_runs = 0
gemini_runs = 0
web_demos = 0

sections_html = ""

# Group by category
grouped = {}
for p in projects_data:
    cat = p["category_folder"]
    if cat not in grouped:
        grouped[cat] = []
    grouped[cat].append(p)

for cat_folder, cat_label, level_tag in categories:
    if cat_folder not in grouped:
        continue
    
    projs = grouped[cat_folder]
    cards_html = ""
    for p in projs:
        models_count = len(p["models"])
        total_runs += models_count
        
        models_str = " ".join([m["model_name"] for m in p["models"]])
        if "gemini-3.7-flash" in models_str:
            gemini_runs += 1
            
        models_dom = ""
        if p["models"]:
            models_dom += '<div class="card-models">'
            models_dom += '<div class="models-label"><span>已实测模型 (' + str(len(p["models"])) + ')</span><span>入口</span></div>'
            models_dom += '<div class="model-list">'
            for m in p["models"]:
                m_name = m["model_name"]
                m_folder = m["folder_rel"]
                is_gemini = "gemini-3.7-flash" in m_name
                entries = m["entries"]
                
                main_entry = entries[0] if entries else ""
                entry_url = "./" + m_folder + "/" + main_entry if main_entry else "./" + m_folder
                is_html_or_svg = main_entry.endswith((".html", ".svg"))
                if is_html_or_svg:
                    web_demos += 1
                
                gemini_cls = " is-gemini" if is_gemini else ""
                gemini_text_cls = " gemini-text" if is_gemini else ""
                gemini_btn_cls = " btn-gemini" if is_gemini else ""
                
                display_name = ("⚡ " + m_name) if is_gemini else m_name
                
                models_dom += '<div class="model-item' + gemini_cls + '">'
                models_dom += '<span class="model-name' + gemini_text_cls + '">' + display_name + '</span>'
                models_dom += '<div class="model-actions">'
                if is_html_or_svg:
                    safe_title = p['title'].replace("'", "\\'") + " - " + m_name
                    models_dom += '<button class="btn-preview" onclick="openPreview(\'' + entry_url + '\', \'' + safe_title + '\')">预览</button>'
                    models_dom += '<a href="' + entry_url + '" target="_blank" class="btn-run' + gemini_btn_cls + '">打开 ↗</a>'
                else:
                    models_dom += '<a href="./' + m_folder + '" target="_blank" class="btn-run' + gemini_btn_cls + '">查看源码 ↗</a>'
                models_dom += '</div>'
                models_dom += '</div>'
            models_dom += '</div></div>'
        elif p["root_entries"]:
            models_dom += '<div class="card-models">'
            models_dom += '<div class="models-label"><span>根目录交付物</span></div>'
            models_dom += '<div class="model-list">'
            for rf in p["root_entries"][:3]:
                rf_url = "./" + p['rel_path'] + "/" + rf
                models_dom += '<div class="model-item">'
                models_dom += '<span class="model-name">' + rf + '</span>'
                models_dom += '<a href="' + rf_url + '" target="_blank" class="btn-run">打开 ↗</a>'
                models_dom += '</div>'
            models_dom += '</div></div>'
        else:
            models_dom += '<div class="card-models"><div style="font-size: 11px; color: var(--text-dim);">待测试 / 暂无落盘产物</div></div>'
        
        prompt_link = '<a href="./' + p['rel_path'] + '/PROJECT_PROMPT.md" target="_blank" class="doc-link">提示词 📋</a>' if p["has_prompt"] else ''
        readme_link = '<a href="./' + p['rel_path'] + '/README.md" target="_blank" class="doc-link">评分标准 📖</a>' if p["has_readme"] else ''
        
        p_id = p['id']
        p_title = p['title']
        p_domain = p['domain']
        p_level = p['level']
        p_rel = p['rel_path']
        
        cards_html += f"""
        <div class="project-card" data-id="{p_id}" data-title="{p_title}" data-domain="{p_domain}" data-level="{p_level}" data-models="{models_str}">
          <div class="card-header">
            <div class="card-top-line">
              <span class="card-domain">{p_domain}</span>
              <span class="level-pill {p_level}">{p_level}</span>
            </div>
            <div class="card-title">{p_title}</div>
            <div class="card-id">{p_rel}</div>
            <div class="card-docs">
              {prompt_link}
              {readme_link}
            </div>
          </div>
          {models_dom}
        </div>
        """
    
    sections_html += f"""
    <div class="section-block" id="sec-{cat_folder}">
      <div class="section-title">
        <span class="level-pill {level_tag}">{level_tag}</span>
        <span>{cat_label}</span>
        <span style="font-size: 13px; color: var(--text-dim); font-weight: normal;">({len(projs)} 项)</span>
      </div>
      <div class="grid-container">
        {cards_html}
      </div>
    </div>
    """

full_html = html_head.replace("__TOTAL_PROJ__", str(total_proj))
full_html = full_html.replace("__TOTAL_RUNS__", str(total_runs))
full_html = full_html.replace("__GEMINI_RUNS__", str(gemini_runs))
full_html = full_html.replace("__WEB_DEMOS__", str(web_demos))
full_html = full_html.replace("__CARDS_HTML__", sections_html)
full_html = full_html.replace("__PROJECTS_JSON__", json.dumps(projects_data, ensure_ascii=False))

output_path = os.path.join(base_dir, "index.html")
with open(output_path, "w", encoding="utf-8") as f:
    f.write(full_html)

print(f"Successfully generated master index.html at {output_path} ({len(full_html)} bytes)")
