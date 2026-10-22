// Moodle 系统（PZ 的状态指示）：把一堆连续量压成 0~4 级图标 + 说明。
// 它们不只是显示 —— panic / endurance / pain 会真实改写武器与移动属性。
import { MOODLE, NEEDS } from '../../data/balance.js';
import { painTier } from './injury.js';

export const MOODLE_LIST = [
  { id: 'hungry', icon: '🍖', label: '饥饿', tip: ['不饿', '有点饿', '饥饿', '很饿', '饿极了'] },
  { id: 'thirsty', icon: '💧', label: '口渴', tip: ['不渴', '有点渴', '口渴', '很渴', '脱水'] },
  { id: 'tired', icon: '😪', label: '疲惫', tip: ['精神', '略倦', '困倦', '很困', '精疲力尽'] },
  { id: 'bored', icon: '😐', label: '无聊', tip: ['专注', '有点闷', '无聊', '很无聊', '极度无聊'] },
  { id: 'stress', icon: '😰', label: '压力', tip: ['平静', '不安', '紧张', '焦虑', '崩溃边缘'] },
  { id: 'panic', icon: '😱', label: '恐慌', tip: ['镇定', '紧张', '恐慌', '极度恐慌', '失控'] },
  { id: 'pain', icon: '🤕', label: '疼痛', tip: ['无痛', '轻微痛', '疼痛', '剧痛', '痛不欲生'] },
  { id: 'bleeding', icon: '🩸', label: '流血', tip: ['无出血', '少量出血', '出血', '大量出血', '失血休克'] },
  { id: 'sick', icon: '🤢', label: '恶心', tip: ['正常', '反胃', '恶心', '想吐', '呕吐不止'] },
  { id: 'fever', icon: '🤒', label: '发热', tip: ['体温正常', '微热', '发热', '高烧', '危重高热'] },
  { id: 'infected', icon: '🦠', label: '伤口感染', tip: ['无感染', '疑似感染', '伤口感染', '感染加重', '败血症'] },
  { id: 'knox', icon: '☣️', label: '克诺克斯', tip: ['健康', '反胃', '焦虑发热', '高烧不退', '濒死'] },
  { id: 'wet', icon: '💦', label: '潮湿', tip: ['干燥', '有点湿', '湿透', '湿漉漉', '落汤鸭'] },
  { id: 'cold', icon: '🥶', label: '寒冷', tip: ['温暖', '微凉', '冷', '很冷', '刺骨'] },
  { id: 'hot', icon: '🥵', label: '炎热', tip: ['舒适', '微热', '热', '很热', '中暑'] },
  { id: 'heavy', icon: '🎒', label: '负重', tip: ['轻便', '略沉', '负重', '超重', '严重超重'] },
  { id: 'endurance', icon: '🫁', label: '体力', tip: ['充沛', '喘气', '疲劳', '力竭', '脱力'] },
  { id: 'exertion', icon: '😮‍💨', label: '剧烈运动', tip: ['平稳', '微喘', '喘气', '上气不接下气', '虚脱'] },
  { id: 'drunk', icon: '🍺', label: '醉酒', tip: ['清醒', '微醺', '醉了', '大醉', '烂醉'] },
  { id: 'recovery', icon: '💚', label: '缓回血', tip: ['无', '缓慢恢复', '恢复中', '快速恢复', '极速恢复'] },
  { id: 'loadBoost', icon: '💪', label: '负重针', tip: ['无', '生效中', '生效中', '生效中', '强效中'] },
  { id: 'beta', icon: '🫀', label: 'β 阻滞', tip: ['无', '镇定', '镇定', '镇定', '完全镇定'] },
  { id: 'zeds', icon: '👀', label: '被注视', tip: ['无人', '有动静', '被盯上', '被包围', '尸潮'] },
  { id: 'injured', icon: '🩹', label: '负伤', tip: ['完好', '擦伤', '受伤', '重伤', '濒死'] },
];

const tierOf = (v, thresholds) => {
  let lvl = 0;
  for (let i = 0; i < thresholds.length; i++) if (v >= thresholds[i]) lvl = i;
  return lvl;
};

/**
 * 由完整状态算出所有 moodle 等级。
 * state: { needs, body, endurance, loadRatio, drunk, visibleZombies, recovery, loadBoost, temp, wet, exertion }
 */
export function computeMoodles(st) {
  const m = {};
  const n = st.needs || {};
  m.hungry = tierOf(n.hunger ?? 0, MOODLE.thresholds.hungry.t);
  m.thirsty = tierOf(n.thirst ?? 0, MOODLE.thresholds.thirsty.t);
  m.tired = tierOf(n.fatigue ?? 0, MOODLE.thresholds.tired.t);
  m.bored = tierOf(n.boredom ?? 0, MOODLE.thresholds.bored.t);
  m.stress = tierOf(n.stress ?? 0, MOODLE.thresholds.stress.t);
  m.drunk = tierOf(n.drunk ?? 0, [0, 15, 35, 60, 85]);

  const body = st.body;
  if (body) {
    m.pain = painTier(body);
    const s = st.summary || {};
    const bp = s.bloodPct ?? 1;
    m.bleeding = s.bleeding ? (bp < 0.55 ? 4 : bp < 0.75 ? 3 : s.bleedRate > 4 ? 2 : 1) : 0;
    m.infected = body.infected ? Math.min(4, 1 + Math.floor((body.infectionTimer || 0) / 40)) : 0;
    m.knox = body.knox > 0 ? Math.min(4, 1 + Math.floor(body.knox * 4)) : 0;
    m.sick = Math.max(m.knox >= 2 ? 2 : 0, m.infected >= 2 ? 2 : 0, (n.foodPoisoning ? 3 : 0));
    m.fever = Math.max(
      (body.knox > 0.35 ? Math.min(4, 1 + Math.floor(body.knox * 3)) : 0),
      (body.infected ? 2 : 0),
      (n.cold ? 1 : 0)
    );
    m.injured = tierOf(100 - (st.totalPct ?? 1) * 100, [0, 12, 30, 55, 80]);
  }

  m.endurance = tierOf((st.endurance ?? 0) * 100, [25, 50, 75, 90, 97]);
  m.exertion = tierOf((st.exertion ?? 0) * 100, [15, 40, 65, 85, 95]);
  m.heavy = tierOf((st.loadRatio ?? 0) * 100, [85, 100, 125, 150, 175]);
  m.panic = tierOf(st.panic ?? 0, MOODLE.thresholds.panic.t);
  m.zeds = tierOf(st.visibleZombies ?? 0, [1, 3, 6, 12, 20]);
  m.wet = tierOf((st.wet ?? 0) * 100, [10, 30, 55, 80, 95]);
  m.cold = (st.temp ?? 37) < 34.5 ? Math.min(4, 1 + Math.floor((34.5 - st.temp) / 2)) : 0;
  m.hot = (st.temp ?? 37) > 38.2 ? Math.min(4, 1 + Math.floor((st.temp - 38.2) / 1.2)) : 0;
  m.recovery = st.recovery > 0 ? 3 : (st.regen > 0 ? 2 : 0);
  m.loadBoost = st.loadBoost > 0 ? 3 : 0;
  m.beta = st.beta > 0 ? 3 : 0;
  return m;
}

/** 恐慌累积：每见一只 +3%，持续可见 +0.5%/游戏分钟，恢复 1.75%/秒 */
export function updatePanic(panic, visibleZombies, dtSeconds, gameMinutes, traits = {}) {
  if (traits.veteran) return 0;
  let p = panic;
  if (visibleZombies > 0) {
    p += visibleZombies * (MOODLE.thresholds.panic.gainPerZombie / 10);
    p += MOODLE.thresholds.panic.gainPerMinute * gameMinutes * visibleZombies * 0.2;
  }
  p -= MOODLE.thresholds.panic.recoverPerSec * dtSeconds * (visibleZombies ? 0.35 : 1);
  const mul = traits.brave ? MOODLE.panicAccuracy.braveMul : traits.cowardly ? MOODLE.panicAccuracy.cowardlyMul : 1;
  return Math.max(0, Math.min(100, p * (visibleZombies ? mul : 1)));
}

/** 需求增长（每游戏小时） */
export function updateNeeds(n, hours, ctx = {}) {
  n.hunger = Math.min(100, (n.hunger ?? 0) + NEEDS.hungerPerHour * hours * (ctx.hearty ? 1.5 : ctx.lightEater ? 0.75 : 1));
  n.thirst = Math.min(100, (n.thirst ?? 0) + NEEDS.thirstPerHour * hours * (ctx.exerting ? 1.6 : 1));
  const sleeping = !!ctx.sleeping;
  n.fatigue = sleeping
    ? Math.max(0, (n.fatigue ?? 0) - NEEDS.fatigueRecoverPerHourSleep * hours)
    : Math.min(100, (n.fatigue ?? 0) + NEEDS.fatiguePerHourAwake * hours);
  n.boredom = Math.min(100, (n.boredom ?? 0) + NEEDS.boredomPerHourIndoors * hours * (ctx.indoors ? 1 : 0.35));
  n.stress = Math.max(0, Math.min(100,
    (n.stress ?? 0) + (ctx.stressGain ?? 0) - NEEDS.stressDecayPerHour * hours));
  if (n.drunk) n.drunk = Math.max(0, n.drunk - 9 * hours);
  return n;
}

/** 体重与营养：卡路里盈余 → 增重，赤字 → 减重 */
export function updateWeight(n, hours, ctx = {}) {
  const w = n.weight ?? NEEDS.weight.default;
  const cal = ctx.calories ?? 0;
  let nw = w;
  const gainThreshold = NEEDS.weight.gainThreshold + (w - NEEDS.weight.default) * 40;
  const loseThreshold = (w - 70) * NEEDS.weight.loseThresholdBase;
  if (cal > 0 && cal > gainThreshold) nw += 0.000039 * (cal / 4000) * hours * 3600;
  else if (cal < 0 && -cal > Math.max(0, loseThreshold)) nw -= 0.0000085 * (Math.abs(cal) / 2500) * hours * 3600;
  n.weight = Math.max(NEEDS.weight.min - 10, Math.min(NEEDS.weight.max + 15, nw));
  return n.weight;
}
