# sandbox — 隔离临时测试工作区

给受测模型做**临时性**测试：每次 run 只暴露 `PROJECT_PROMPT.md` 题面与纪律条款，
**不**带出同仓库其他模型输出、评分细则或兄弟题目。审阅 agent 自动对照题面出报告。

## 快速开始（编排侧）

```powershell
# 0) 列出可测项目
$env:PYTHONUTF8=1
python sandbox/scripts/prepare_run.py --list

# 1) 开一场隔离 run（主交付名从题面自动提取，写入 TASK.md 与 meta.expected_deliverable）
python sandbox/scripts/prepare_run.py --project USP --model my-model-slug
# → sandbox/runs/my-model-slug/<ts>-USP/

# 2) 把该 run 目录（仅此目录）交给受测模型作答
#    受测方可读文件：TASK.md、PROJECT_PROMPT.md
#    受测方交付：题面指定物 + result.json（含 integrity，缺失即 INVALID）+ 可选 log.md

# 3) 查看进度 / 自动审阅（仅 PROJECT_PROMPT 口径）
python sandbox/scripts/status.py --model my-model-slug
python sandbox/scripts/review_run.py --model my-model-slug --latest
# → 在 run 目录写 REVIEW.md，并回写 meta.verdict

# 4) 入库到正式项目树 <project>/<model>/（自带 verdict 闸门，仅 PASS/PASS_WITH_WARNINGS）
python sandbox/scripts/collect_run.py --run sandbox/runs/my-model-slug/<ts>-USP --dry-run
python sandbox/scripts/collect_run.py --run sandbox/runs/my-model-slug/<ts>-USP
```

## 目录布局

```
sandbox/
├── AGENTS.md              # 审阅 / 编排 / 受测 / 收卷 agent 协议（唯一入口文档）
├── README.md              # 本说明
├── protocol.json          # 机读协议摘要（角色边界、命令、verdict 闸门、禁入项）
├── ORCHESTRATOR_PROMPT.md # 编排派发提示词模板（题目清单按需填写）
├── .gitignore             # sandbox 自管理忽略规则（runs/、生成物、agent 工具状态）
├── scripts/
│   ├── sandbox_lib.py     # 公共库（发现/哈希/契约/泄漏名单）
│   ├── prepare_run.py     # 组卷：生成隔离 run
│   ├── review_run.py      # 审阅：对照 PROJECT_PROMPT 出 REVIEW.md + verdict
│   ├── collect_run.py     # 收卷：verdict 闸门 + SHA 校验后拷入正式树
│   └── status.py          # run 总览（--model / --pending / --json）
├── review-lab/            # 离线对照实验室（与流水线解耦，详见其 README）
│   ├── build_catalog.py       # 生成题库页 index.html + catalog.json
│   ├── build_review_ui.py     # 生成多模型对照 review.html
│   ├── review_ui_shell.html / verify_review.cjs / dev/ / shots/
│   └── reference-assets/      # 外部参考实现与 vendor 依赖（不入库，受测/审阅禁读）
└── runs/                  # 临时 run（不入库）
    └── <model-slug>/
        └── <YYYYMMDD-HHMMSS>-<Project>/
            ├── TASK.md            # 纪律 + 题面 + 作答契约（含主交付名）
            ├── PROJECT_PROMPT.md  # 题面原文逐字节拷贝（禁改）
            ├── meta.json          # 编排元数据（status: prepared→reviewed→collected）
            ├── <deliverable>      # 模型交付（文件名以 TASK.md 契约为准）
            ├── result.json        # 模型自报 + integrity（缺失→INVALID）
            ├── log.md             # 可选
            └── REVIEW.md          # 审阅产物
```

## 隔离模型（dir + discipline）

对齐 `Vision/` 流水线的防串题纪律，**不**做 OS 级沙箱：

| 措施 | 说明 |
|---|---|
| 空目录组卷 | run 内只有题面副本，无其他模型目录 |
| TASK.md 纪律七条 | 禁读上级、禁读 gold/其他 run、禁联网代写、integrity 自报、禁建工具状态目录 |
| preflight 可选 | `prepare` 仅校验题面存在与哈希；不拷 README 评分细则 |
| 审阅隔离 | `review_run` **只**读本 run 的题面与交付物；不读项目 README rubric |
| 收卷强制 | `collect` 内置双重校验：题面 SHA 一致 + verdict ∈ {PASS, PASS_WITH_WARNINGS} |

若需要更强隔离（工作区放到 `F:\benchmark` 之外），将 `sandbox/runs` 改为外部路径即可；
协议与脚本无需改动。

## 外部 Agent 接入

任何第三方 agent / IDE 工具进入本目录，先读 `AGENTS.md` §9 接入清单。
要点：agent 工具状态（`.codeartsdoer` / `.arts` / `.cursor` / 索引库等）**禁止**写入
`sandbox/` 或 run 目录——历史上已有两类工具在此留档，现已 gitignore，接入时请勿效仿。

## 与仓库既有约定的映射

| 本工作区 | 主仓库 |
|---|---|
| 题面唯一标准 | `L*/项目/PROJECT_PROMPT.md` |
| 模型 slug | 与正式树子目录名一致（如 `hy4-prev`） |
| 交付物 | 以题面与 run 内 TASK.md 契约为准（`answer.html` / `index.html` / `answer.svg` / `answer.md` 等） |
| 禁窥题 | 继承 Vision「七条铁律」中的身份/来源锁定与禁读名单 |
| 审阅范围 | 本次明确为 **仅 PROJECT_PROMPT**；README「自动化验收建议」留给后续运行时验收 |

## 设计决策

1. **题面整文件拷贝**：L1–L4 的 `PROJECT_PROMPT.md` 是 markdown 原文（非 Vision 的 ```text 围栏），prepare 直接 `read_bytes` 拷贝，保证逐字节一致；TASK.md 内嵌时使用动态长度围栏，题面自带代码块也不会破。
2. **审阅不读 rubric**：避免审阅提示词把验收细节泄漏给已结束的 run；运行时/视觉验收应另开审阅会话并显式打开 README。
3. **integrity 强制自报**：缺失字段与自报违规同判 INVALID——不提交 result.json 不能绕过审阅。
4. **runs 不进 git**：与 `Vision/runs/`、`暂存/` 相同策略；`sandbox/.gitignore` 自管理全部忽略项，仓库保持轻量。
5. **verdict 闸门内置**：纪律不靠文档自觉——`collect` 对 FAIL/INVALID/未审阅直接拒绝，`--force` 强收会写进 MIGRATION.md 留痕。

## 新增/修改题面后

- 题面文件变更会改变 SHA；`prepare` 生成的 `meta.prompt_sha256` 记录当次快照。
- `collect` 会再比一次正式树，防题面漂移入库。
- 无需改本脚手架代码——脚本按 `PROJECT_PROMPT.md` 自动适配。

## 相关

- 全景题表：根目录 `README.md` / `DOMAIN_INDEX.zh.md`
- Vision 全自动跑分管线：`Vision/AUTO_SCORING_PLAN.md`
- Agent 协议：[`sandbox/AGENTS.md`](./AGENTS.md)；机读版 [`sandbox/protocol.json`](./protocol.json)
- 对照实验室：[`sandbox/review-lab/README.md`](./review-lab/README.md)
