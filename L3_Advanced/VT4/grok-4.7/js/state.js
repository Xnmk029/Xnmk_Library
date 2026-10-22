export const TABS = [
  { id: "assembly", label: "全车装配检视" },
  { id: "variant", label: "改型与内构考证" },
  { id: "studio", label: "专业渲染工作室" },
];

export function createState() {
  return {
    tab: "assembly",
    variant: "vt4",
    paint: "follow",
    highlight: true,
    viewMode: "solid",
    clipAxis: "x",
    clipPos: 0.15,
    explode: 0,
    show: {
      hull: true,
      turret: true,
      running: true,
      gun: true,
      era: true,
      crew: true,
      power: true,
      fight: true,
      driver: true,
    },
    gunElev: 0.04,
    turretYaw: 0.18,
    autoRotate: false,
    tech: true,
    running: false,
    cameras: {
      assembly: { yaw: 0.72, pitch: 0.3, dist: 13.2, target: [0, 1.15, 0.25] },
      variant: { yaw: 0.55, pitch: 0.48, dist: 11.2, target: [0, 1.15, 0.1] },
      studio: { yaw: 0.98, pitch: 0.2, dist: 15.5, target: [0, 1.05, 0.35] },
    },
    free: { pos: [7.5, 2.4, 9.5], yaw: -2.45, pitch: -0.12, speed: 4.5 },
    keys: new Set(),
    camMode: "orbit",
    focal: 58,
    aperture: 3.2,
    focus: 15,
    autoFocus: true,
    exposure: 0.15,
    tonemap: 0,
    env: "desert",
    dust: 0.4,
    accum: true,
    sppMax: 80,
  };
}

export function paintOf(state) {
  if (state.paint === "sand") return "sand";
  if (state.paint === "tri") return "tri";
  if (state.paint === "olive") return "olive";
  return state.variant === "pk" ? "sand" : "olive";
}

export function effective(state) {
  const paint = paintOf(state);
  const showAll = {
    hull: true,
    turret: true,
    running: true,
    gun: true,
    era: true,
    crew: true,
    power: true,
    fight: true,
    driver: true,
  };
  const common = {
    variant: state.variant,
    variantBit: { vt4: 1, a1: 2, pk: 4 }[state.variant],
    paint,
    sppMax: state.sppMax,
  };
  if (state.tab === "assembly") {
    return {
      ...common,
      show: { ...state.show },
      explode: state.explode,
      turretYaw: state.turretYaw,
      gunElev: state.gunElev,
      xray: false,
      clip: false,
      highlight: false,
      tech: state.tech,
      running: state.running,
      autoRotate: state.autoRotate,
      env: "inspect",
      dust: state.running ? 0.45 : 0.08,
      accum: false,
      dof: false,
      labels: true,
      camera: state.cameras.assembly,
      camMode: "orbit",
      focal: 36,
      aperture: 16,
      focus: state.cameras.assembly.dist,
      autoFocus: true,
      exposure: 0.2,
      tonemap: 0,
    };
  }
  if (state.tab === "variant") {
    return {
      ...common,
      show: showAll,
      explode: 0,
      turretYaw: 0.22,
      gunElev: 0.03,
      xray: state.viewMode === "xray",
      clip: state.viewMode === "cut",
      clipAxis: state.clipAxis,
      clipPos: state.clipPos,
      highlight: state.highlight && state.variant !== "vt4",
      tech: false,
      running: false,
      autoRotate: false,
      env: "overcast",
      dust: state.viewMode === "solid" ? 0.12 : 0,
      accum: false,
      dof: false,
      labels: false,
      camera: state.cameras.variant,
      camMode: "orbit",
      focal: 42,
      aperture: 11,
      focus: state.cameras.variant.dist,
      autoFocus: true,
      exposure: 0.12,
      tonemap: 0,
    };
  }
  return {
    ...common,
    show: showAll,
    explode: 0,
    turretYaw: 0.08,
    gunElev: 0.025,
    xray: false,
    clip: false,
    highlight: false,
    tech: false,
    running: false,
    autoRotate: false,
    env: state.env,
    dust: state.dust,
    accum: state.accum,
    dof: true,
    labels: false,
    camera: state.cameras.studio,
    camMode: state.camMode,
    focal: state.focal,
    aperture: state.aperture,
    focus: state.focus,
    autoFocus: state.autoFocus,
    exposure: state.exposure,
    tonemap: state.tonemap,
  };
}

export const VARIANT_COPY = {
  vt4: {
    title: "VT-4",
    sub: "标准防务展版",
    lead: "基准车。炮塔与首上采用 FY-4 反应装甲，间隙较密；车长周视镜与基础型 12.7 mm 遥控武器站按展车常见布置。",
    points: [
      "首上与炮塔正面、侧面为统一 FY-4 模块，贴合楔形复合装甲外形。",
      "车长独立周视镜位于炮塔右侧顶部，支持猎-歼式瞄准交接。",
      "基础遥控武器站：12.7 mm 机枪、弹箱与小型光电头。",
      "烟幕发射器位于炮塔前侧颊部。",
      "动力舱顶甲板为横向散热槽，侧裙为四块连续裙板。",
    ],
  },
  a1: {
    title: "VT-4 A1",
    sub: "高端主动防御升级版",
    lead: "在基准车上增加硬杀伤主动防御、重型遥控武器站、无人机发射管与顶部附加装甲。高亮区域为相对基准版的改动。",
    points: [
      "炮塔四周毫米波雷达阵面，配合拦截弹发射器组成主动防御。",
      "遥控武器站升级为带防护罩、大型弹箱和光电球的重型站。",
      "炮塔尾部增设车载无人机发射管。",
      "四角激光告警接收器；烟幕发射器后移，为雷达和拦截器让位。",
      "炮塔顶部加装附加装甲，用于增强对攻顶弹药的防护。",
    ],
  },
  pk: {
    title: "VT-4 P",
    sub: "巴基斯坦定制版",
    lead: "按巴方选型可见差异重构：炮塔侧面 FY-4 / FY-2 混合倾角与缝隙、首上箭头形附加装甲、分段裙板、前挡泥板和尾部立式散热格栅。",
    points: [
      "炮塔侧上排 FY-4 倾角较缓、下排 FY-2 更陡，模块之间留出明显缝隙。",
      "首上改为中央脊梁加两侧斜板的箭头形附加装甲，反应装甲随板面布置。",
      "裙板改为六段，前段加高；前挡泥板更外扩、下沿更长。",
      "动力舱顶盖由横槽改为密排立式散热叶片。",
      "涂装默认用沙色，便于和展会橄榄绿基准车对照。",
    ],
  },
};

export const SPEC_ROWS = [
  ["炮口前伸全长", "10.10 m"],
  ["全宽（含裙板）", "3.44 m"],
  ["车高", "2.40 m"],
  ["战斗全重", "52 t"],
  ["乘员", "车长 / 炮长 / 驾驶员"],
  ["主炮", "ZPT-98A 125 mm 滑膛"],
  ["备弹", "38 发，弹盘待发 22 发"],
  ["并列 / 高射", "7.62 mm / 12.7 mm RWS"],
  ["动力", "水冷涡轮增压柴油机"],
  ["公开功率", "VT/E1 1,200 hp（另见 1,300 hp 级推介）"],
  ["传动", "综合液力 / Ch1000B 自动变速"],
  ["悬挂", "扭杆，每侧六对负重轮"],
  ["最大速度", "70 km/h"],
  ["行程", "约 500 km"],
];
