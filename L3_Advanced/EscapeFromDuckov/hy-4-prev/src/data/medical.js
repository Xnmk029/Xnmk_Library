// 医疗物资（文档 §6.2）。use 决定由 injury.js 的哪条分支处理。
export const MEDICAL = {
  bandage: {
    id: 'bandage', name: '绷带', icon: '🩹', use: 'bandage', time: 1.8, sterile: false,
    firstAid: 0, weight: 0.05, value: 12,
    desc: '止血。会随汗水与尘土变脏 —— 3 天不换必感染。',
  },
  bandage_sterile: {
    id: 'bandage_sterile', name: '无菌绷带', icon: '🩹', use: 'bandage', time: 2.0, sterile: true,
    firstAid: 0, weight: 0.06, value: 34,
    desc: '感染概率大幅低于普通绷带。',
  },
  disinfectant: {
    id: 'disinfectant', name: '消毒剂', icon: '🧴', use: 'disinfect', time: 2.2,
    firstAid: 0, weight: 0.12, value: 28,
    desc: '清创。包扎前使用可把感染概率压到四分之一。',
  },
  suture_kit: {
    id: 'suture_kit', name: '缝合包', icon: '🪡', use: 'stitch', time: 5.0,
    firstAid: 2, weight: 0.1, value: 60,
    desc: '缝合深度伤口。不缝的话要一个月才能长好，期间一直出血。',
  },
  splint: {
    id: 'splint', name: '夹板', icon: '🦴', use: 'splint', time: 4.0,
    firstAid: 1, weight: 0.3, value: 40,
    desc: '固定骨折。此后需保持 2~3 周，期间腿部不能受力。',
  },
  surgery_kit: {
    id: 'surgery_kit', name: '手术包', icon: '🔪', use: 'surgery', time: 8.0,
    firstAid: 4, weight: 0.6, value: 220,
    desc: '取出滞留弹头、修复上限损伤。必须静止使用。',
  },
  antibiotics: {
    id: 'antibiotics', name: '抗生素', icon: '💊', use: 'antibiotic', time: 1.2,
    firstAid: 0, weight: 0.04, value: 45,
    desc: '只治细菌感染，对克诺克斯病毒无效。每 6 小时一剂。',
  },
  painkillers: {
    id: 'painkillers', name: '止痛药', icon: '💊', use: 'painkiller', time: 1.0,
    firstAid: 0, weight: 0.03, value: 30,
    desc: '临时压制疼痛：恢复视线与移动力，但不治伤。',
  },
  beta_blockers: {
    id: 'beta_blockers', name: 'β 受体阻滞剂', icon: '💊', use: 'beta', time: 1.0,
    firstAid: 0, weight: 0.03, value: 55,
    desc: '压制恐慌 —— 硬核模式下的救命药。',
  },
  medkit: {
    id: 'medkit', name: '急救箱', icon: '🧰', use: 'heal', time: 5.0, heal: 26,
    firstAid: 0, weight: 0.8, value: 120,
    desc: '高额恢复。使用中必须保持静止，通常得先找掩体。',
  },
  recovery_syringe: {
    id: 'recovery_syringe', name: '恢复针', icon: '💉', use: 'recovery', time: 1.5,
    firstAid: 0, weight: 0.2, value: 260, regenPerSec: 0.9, duration: 45,
    desc: '可以在移动中使用 —— 打带跑战术的核心。提供持续缓回血。',
  },
  load_syringe: {
    id: 'load_syringe', name: '负重针', icon: '💉', use: 'load', time: 1.5,
    firstAid: 0, weight: 0.2, value: 180, carryMul: 1.6, duration: 120,
    desc: '短时间内极大提升负重上限，防止因带出太多物资而跑不动。',
  },
  energy_drink: {
    id: 'energy_drink', name: '能量饮料', icon: '🥤', use: 'drink', time: 1.2,
    firstAid: 0, weight: 0.35, value: 40, fatigue: -22, calories: 110,
    desc: '抗疲劳。含咖啡因，夜里喝会影响睡眠。',
  },
};

/** 使用方式：是否必须静止 */
export const REQUIRES_STILL = new Set(['suture_kit', 'splint', 'surgery_kit', 'medkit']);

export const MEDICAL_BY_ID = MEDICAL;
