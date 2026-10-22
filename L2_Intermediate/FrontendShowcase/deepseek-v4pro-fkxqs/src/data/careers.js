import { hexToRgb, makeRandom } from '../lib/color';

/** Deterministic series generators so the HUD never "flickers" between reloads. */
function series(seed, count, min, max, smooth = 0.55) {
  const rand = makeRandom(seed);
  const out = [];
  let v = (min + max) / 2;
  for (let i = 0; i < count; i += 1) {
    v = v * smooth + (min + rand() * (max - min)) * (1 - smooth);
    out.push(Math.round(v * 1000) / 1000);
  }
  return out;
}

export const OPERATOR = {
  nameCn: '陆 昭',
  nameEn: 'LU ZHAO',
  handle: '@tetra',
  callsign: 'OP-04 // TETRA',
  roleCn: '复合型创客 × 系统管理员',
  roleEn: 'COMPOSITE MAKER × SYSTEMS OPERATOR',
  clearance: 'CLEARANCE ALPHA-4',
  location: 'CN · HANGZHOU',
  geo: '30.2741°N 120.1551°E',
  years: '11',
  intro:
    '四条并行的技能主线：把语言编译成可复现的模型行为，把扭矩与公差调成可信赖的机械，把不确定的机房收敛成 99.98% 的在线率，把空间本身写成不用文字的教学关卡。跨域不是简历上的装饰，而是同一套工程直觉在四种物质上的四次落地。',
  readouts: [
    { k: 'LINK', v: 'STABLE' },
    { k: 'PWR', v: '98.4%' },
    { k: 'PING', v: '11ms' },
    { k: 'THREADS', v: '04 / 04' },
  ],
  contacts: [
    { k: 'MAIL', v: 'tetra@neurolink.ops' },
    { k: 'REPO', v: 'git.neurolink/~tetra' },
    { k: 'SIGNAL', v: 'PGP 0x4F2A·9C31' },
  ],
};

const RAW = [
  {
    id: 'ai',
    index: '01',
    code: 'PRM-01',
    label: 'AI PROMPT ENGINEER',
    labelCn: 'AI 提示词专家',
    color: '#23ff00',
    tagline: 'PROMPT IS THE NEW COMPILER',
    taglineCn: '提示词即新编译器',
    since: '2021',
    scene: 'neural',
    sceneLabel: 'SEMANTIC LATTICE // TOKEN GRAPH',
    summary:
      '把「玄学调参」变成可回归的软件工程：用分层提示协议、结构化输出约束与自动评测网格，把模型行为压进可预测的置信区间。为多智能体流水线设计上下文预算与失败兜底，让每一次生成都可复现、可审计、可回滚。',
    bullets: [
      '构建 37 套黄金集评测（Golden-Set Eval）流水线，回归失败即阻断发布。',
      '以上下文分层与语义压缩把平均 Token 成本压低 41%，首字延迟下降 380ms。',
      '设计 19 条 Agent 编排图：工具调用、自校验、断点续跑与人工接管闸门。',
    ],
    gauges: [
      { name: 'STRUCTURED PROMPTING', nameCn: '结构化提示协议', value: 96 },
      { name: 'EVAL HARNESS', nameCn: '自动评测体系', value: 91 },
      { name: 'AGENT ORCHESTRATION', nameCn: '智能体编排', value: 88 },
      { name: 'RAG / RETRIEVAL', nameCn: '检索增强', value: 84 },
      { name: 'CONTEXT BUDGETING', nameCn: '上下文预算', value: 93 },
    ],
    stack: ['Prompt DSL', 'Chain / Tree-of-Thought', 'Function Calling', 'JSON Schema Guard', 'RAG · Hybrid Rerank', 'Golden-Set Eval', 'LangGraph', 'MCP Tooling', 'vLLM Serving', 'Token Accounting'],
    stats: [
      { k: 'PROMPTS SHIPPED', v: '2,480', sub: 'in production' },
      { k: 'EVAL SUITES', v: '37', sub: 'gated on CI' },
      { k: 'TOKEN SAVED', v: '41%', sub: 'per request' },
      { k: 'AGENT FLOWS', v: '19', sub: 'multi-tool' },
    ],
    missions: [
      {
        code: 'M-A1',
        year: '2026',
        name: 'ORACLE-GRID',
        nameCn: '模型行为回归网格',
        desc: '为 6 个业务域搭建离线+在线双轨评测：1,900 条黄金样本、语义等价判分、失败样本自动聚类归因，发布前强制门禁。',
        impact: '幻觉投诉 −72%',
        tags: ['EVAL', 'CI GATE', 'CLUSTERING'],
      },
      {
        code: 'M-A2',
        year: '2025',
        name: 'CTX-COMPRESS',
        nameCn: '上下文预算编译器',
        desc: '把长会话切成可寻址的语义块，按任务动态装配上下文；引入摘要缓存与引用回填，长任务不再遗忘早期约束。',
        impact: '成本 −41% / 延迟 −380ms',
        tags: ['RAG', 'CACHE', 'BUDGET'],
      },
      {
        code: 'M-A3',
        year: '2024',
        name: 'TOOLSMITH',
        nameCn: '智能体工具工厂',
        desc: '统一工具描述规范与错误契约，工具失败可被模型读懂并自愈；长流程支持断点续跑与人工接管。',
        impact: '任务完成率 68% → 94%',
        tags: ['AGENT', 'MCP', 'RECOVERY'],
      },
    ],
    logs: [
      'load  golden_set/*.jsonl ......... 1900 ok',
      'run   eval::semantic_equiv ...... pass 0.962',
      'diff  regress vs baseline ....... 0 blockers',
      'emit  prompt_bundle@v37 ......... signed',
    ],
    meta: [
      { k: 'MODEL', v: 'MULTI-VENDOR' },
      { k: 'CTX', v: '128K' },
      { k: 'MODE', v: 'DETERMINISTIC' },
    ],
  },
  {
    id: 'bike',
    index: '02',
    code: 'MEC-02',
    label: 'BICYCLE TECHNICIAN',
    labelCn: '单车工程技师',
    color: '#ffaa00',
    tagline: 'TORQUE, TRUTH, AND A TRUE WHEEL',
    taglineCn: '扭矩、真相与一只正圆的轮',
    since: '2015',
    scene: 'drive',
    sceneLabel: 'DRIVETRAIN RIG // 12-SPEED CASSETTE',
    summary:
      '机械是不会撒谎的系统：张力不对，轮组会告诉你；链线歪了，传动效率会告诉你。以张力计、对中台与扭矩谱把手感翻译成数字，让每一辆交付的车在两万公里后依然安静、笔直、可预测。',
    bullets: [
      '手工编圈 612 组：径向/侧向跳动收敛到 0.15mm，辐条张力标准差 < 4%。',
      '建立扭矩与螺纹预处理规范，碳纤维部件零压裂、零滑移交付。',
      '为车队搭建功率计标定与传动效率台架，链线误差控制在 0.5mm 内。',
    ],
    gauges: [
      { name: 'WHEEL BUILDING', nameCn: '手工编圈与张力', value: 94 },
      { name: 'HYDRAULIC BRAKES', nameCn: '液压制动系统', value: 90 },
      { name: 'SHIFTING TUNE', nameCn: '电子/机械变速调校', value: 96 },
      { name: 'FRAME ALIGNMENT', nameCn: '车架对中与面铣', value: 88 },
      { name: 'POWER / FIT LAB', nameCn: '功率与 Fitting', value: 83 },
    ],
    stack: ['Wheel Lacing 3x', 'Tension Mapping', 'Hydraulic Bleed', 'Di2 / AXS', 'Frame Facing', 'Torque Spec', 'Bearing Press', 'Chainline Gauge', 'Powermeter Cal', 'Bike Fitting'],
    stats: [
      { k: 'WHEELS BUILT', v: '612', sub: 'hand laced' },
      { k: 'BIKES SERVICED', v: '3,150', sub: 'lifetime' },
      { k: 'AVG TRUE', v: '0.15mm', sub: 'radial dev' },
      { k: 'TORQUE ERR', v: '±2%', sub: 'calibrated' },
    ],
    missions: [
      {
        code: 'M-B1',
        year: '2026',
        name: 'TENSION-MAP',
        nameCn: '辐条张力图谱系统',
        desc: '把每组轮的 32 根辐条张力录成图谱，按轮圈型号建立目标曲线；异常辐条在装车前就被标红，而不是在赛道上断掉。',
        impact: '轮组返修率 −86%',
        tags: ['WHEEL', 'METROLOGY', 'QA'],
      },
      {
        code: 'M-B2',
        year: '2024',
        name: 'DRIVELINE-LAB',
        nameCn: '传动效率台架',
        desc: '自建阻力台架测量不同链线、链条与润滑组合的功率损失，用数据替代经验推荐配置。',
        impact: '实测传动效率 +2.1W',
        tags: ['DRIVETRAIN', 'BENCH', 'DATA'],
      },
      {
        code: 'M-B3',
        year: '2022',
        name: 'CARBON-SAFE',
        nameCn: '碳纤维装配规范',
        desc: '编写扭矩/摩擦膏/贴合面处理 SOP 与培训教材，覆盖 9 家门店技师，杜绝碳件压裂事故。',
        impact: '压裂事故 0 起 / 4 年',
        tags: ['SOP', 'TRAINING', 'SAFETY'],
      },
    ],
    logs: [
      'mount rim::carbon-45 ........... seated',
      'lace  pattern 3-cross .......... 32/32',
      'tense target 1180N ............. dev 3.4%',
      'true  radial 0.14 lateral 0.11 . within spec',
    ],
    meta: [
      { k: 'CASSETTE', v: '12-SPEED' },
      { k: 'RATIO', v: '48/34T' },
      { k: 'TORQUE', v: '5.0 N·m' },
    ],
  },
  {
    id: 'it',
    index: '03',
    code: 'SYS-03',
    label: 'IT SYSTEMS ADMIN',
    labelCn: 'IT 系统管理员',
    color: '#00f0ff',
    tagline: 'UPTIME IS A DESIGN DECISION',
    taglineCn: '在线率是设计出来的，不是运气',
    since: '2016',
    scene: 'rack',
    sceneLabel: 'RACK TELEMETRY // 46 NODES LIVE',
    summary:
      '把机房当成一份可以 review 的代码：网络分段、存储快照、备份演练、可观测性全部声明式落盘。任何一台机器可以在 20 分钟内从裸金属重建，任何一次故障都有可回放的时间线。',
    bullets: [
      '46 节点混合集群（Proxmox + K3s）声明式重建，裸金属到服务 < 20 分钟。',
      '3-2-1 备份 + 每季度真实恢复演练，RPO 15 分钟、MTTR 中位数 7 分钟。',
      'VLAN 分段与零信任隧道改造，横向移动面收敛 90%，全链路可观测。',
    ],
    gauges: [
      { name: 'LINUX INTERNALS', nameCn: 'Linux 内核与调优', value: 93 },
      { name: 'NETWORK / VLAN', nameCn: '网络分段与路由', value: 90 },
      { name: 'VIRTUALIZATION', nameCn: '虚拟化与容器', value: 92 },
      { name: 'OBSERVABILITY', nameCn: '可观测性体系', value: 87 },
      { name: 'AUTOMATION', nameCn: '基础设施自动化', value: 95 },
    ],
    stack: ['Debian / Arch', 'Proxmox VE', 'ZFS + Snapshots', 'OPNsense', 'WireGuard', 'Ansible', 'Docker / K3s', 'Prometheus', 'Grafana / Loki', 'Restic 3-2-1'],
    stats: [
      { k: 'UPTIME', v: '99.98%', sub: 'rolling 12m' },
      { k: 'NODES', v: '46', sub: 'hybrid fleet' },
      { k: 'IOPS', v: '128K', sub: 'zfs mirror' },
      { k: 'MTTR', v: '7m', sub: 'median' },
    ],
    missions: [
      {
        code: 'M-C1',
        year: '2026',
        name: 'PHOENIX-RACK',
        nameCn: '不可变基础设施重建',
        desc: '整机房 Ansible 化：PXE 引导 → 角色装配 → 密钥注入 → 服务上线全自动，配置漂移由 CI 每夜巡检。',
        impact: '重建 3 天 → 20 分钟',
        tags: ['ANSIBLE', 'PXE', 'IaC'],
      },
      {
        code: 'M-C2',
        year: '2025',
        name: 'ZERO-LATERAL',
        nameCn: '零信任网络改造',
        desc: '按业务域重划 VLAN、默认拒绝东西向流量、运维入口全部走 WireGuard + 硬件密钥。',
        impact: '横向暴露面 −90%',
        tags: ['VLAN', 'WIREGUARD', 'MFA'],
      },
      {
        code: 'M-C3',
        year: '2023',
        name: 'GLASSBOX',
        nameCn: '全链路可观测性',
        desc: '统一指标/日志/追踪三件套与告警分级，告警噪声按 SLO 收敛，值班从被动救火转为容量规划。',
        impact: '无效告警 −78%',
        tags: ['PROMETHEUS', 'LOKI', 'SLO'],
      },
    ],
    logs: [
      'ansible-playbook site.yml ...... 46 hosts',
      'zfs   scrub tank0 ............... 0 errors',
      'restic check --read-data-subset  ok',
      'slo   availability 99.98% ....... green',
    ],
    meta: [
      { k: 'FLEET', v: '46 NODES' },
      { k: 'POOL', v: 'ZFS MIRROR' },
      { k: 'RPO', v: '15 MIN' },
    ],
  },
  {
    id: 'level',
    index: '04',
    code: 'LVL-04',
    label: '3D LEVEL DESIGNER',
    labelCn: '3D 关卡设计师',
    color: '#ff0055',
    tagline: 'SPACE TEACHES BEFORE TEXT DOES',
    taglineCn: '空间先于文字完成教学',
    since: '2019',
    scene: 'block',
    sceneLabel: 'BLOCKOUT VOLUME // PACING GRAPH',
    summary:
      '关卡是一种不用说话的界面：用体量、光与视线把玩家的注意力牵到该去的地方，用节奏图把紧张与呼吸编排成曲线。先白盒可玩，再谈美术；先度量可读，再谈氛围。',
    bullets: [
      '交付 74 张关卡：以度量套件（步幅/跳跃/掩体）保证白盒即可玩。',
      '480 场可玩性测试与热力图迭代，新手首次通关率提升 2.3 倍。',
      '以遮挡体与实例化预算重构场景，Draw Call 降低 34% 仍保持视觉密度。',
    ],
    gauges: [
      { name: 'BLOCKOUT / METRICS', nameCn: '白盒与度量套件', value: 95 },
      { name: 'PLAYER GUIDANCE', nameCn: '引导与动线', value: 92 },
      { name: 'LIGHTING MOOD', nameCn: '光照与氛围', value: 88 },
      { name: 'COMBAT PACING', nameCn: '战斗节奏编排', value: 90 },
      { name: 'PERF BUDGET', nameCn: '性能预算控制', value: 86 },
    ],
    stack: ['Blockout Metrics', 'Unreal Engine 5', 'Blender', 'Houdini Scatter', 'Nanite / Lumen', 'Occlusion Volumes', 'Pacing Graph', 'Heatmap Telemetry', 'Playtest Loop', 'Level Scripting'],
    stats: [
      { k: 'LEVELS', v: '74', sub: 'shipped' },
      { k: 'PLAYTESTS', v: '480', sub: 'sessions' },
      { k: 'AVG CLEAR', v: '6m12s', sub: 'target 6m' },
      { k: 'DRAWCALL', v: '−34%', sub: 'after pass' },
    ],
    missions: [
      {
        code: 'M-D1',
        year: '2026',
        name: 'SILENT-TUTOR',
        nameCn: '无文字教学关',
        desc: '完全依靠体量、光斑与声音引导完成 7 个核心机制教学，全程零 UI 提示、零文字说明。',
        impact: '新手通关率 ×2.3',
        tags: ['ONBOARDING', 'GUIDANCE', 'LIGHT'],
      },
      {
        code: 'M-D2',
        year: '2024',
        name: 'PACING-GRAPH',
        nameCn: '节奏曲线工具',
        desc: '把遭遇强度、视野开合与资源投放画成同一张曲线，节奏问题在编辑器里就能被看见。',
        impact: '中段弃游率 −41%',
        tags: ['TOOLING', 'PACING', 'UX'],
      },
      {
        code: 'M-D3',
        year: '2022',
        name: 'BUDGET-PASS',
        nameCn: '性能预算重构',
        desc: '重划遮挡体、合并材质槽并把装饰物改为实例化散布，在不牺牲密度的前提下压回 60fps 预算。',
        impact: 'Draw Call −34%',
        tags: ['OPTIMIZE', 'OCCLUSION', 'LOD'],
      },
    ],
    logs: [
      'load  blockout/sector_07 ........ 214 brushes',
      'check metrics::jump_reach ....... 100% pass',
      'bake  lighting preview .......... 41s',
      'test  session#480 clear 6m12s ... on target',
    ],
    meta: [
      { k: 'VOLUME', v: '214 BRUSH' },
      { k: 'BUDGET', v: '60 FPS' },
      { k: 'PASS', v: 'BLOCKOUT B' },
    ],
  },
];

export const CAREERS = RAW.map((c, i) => ({
  ...c,
  rgb: hexToRgb(c.color),
  spark: series(1000 + i * 37, 26, 0.18, 0.98),
  matrix: series(7000 + i * 91, 60, 0.05, 1),
  overall: Math.round(c.gauges.reduce((a, g) => a + g.value, 0) / c.gauges.length),
}));

export const CAREER_MAP = CAREERS.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

/** Idle / boot theme — desaturated steel, so the first career hover reads as a jump. */
export const NEUTRAL = {
  id: 'neutral',
  color: '#7c8ea6',
  rgb: hexToRgb('#7c8ea6'),
};

export const ALL_MISSIONS = CAREERS.flatMap((c) =>
  c.missions.map((m) => ({ ...m, careerId: c.id, color: c.color, careerLabel: c.label, careerCode: c.code })),
).sort((a, b) => Number(b.year) - Number(a.year) || a.code.localeCompare(b.code));

export const SECTIONS = [
  { id: 'identity', label: 'IDENTITY', labelCn: '身份' },
  { id: 'classes', label: 'CLASSES', labelCn: '职业' },
  { id: 'viewport', label: 'LIVE 3D', labelCn: '视窗' },
  { id: 'matrix', label: 'SKILL MATRIX', labelCn: '技能库' },
  { id: 'oplog', label: 'OPS LOG', labelCn: '作战日志' },
];
