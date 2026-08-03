// FPV Blade-Momentum Physics Validation v2
const RHO = 1.225; // air density kg/m3
const SQRT2 = Math.sqrt(2);

function computePhysics(build) {
  const armLen = build.wheelbase * 1e-3 * 0.5 / SQRT2;
  const D = build.propDiameter * 0.0254;
  const P = build.propPitch * 0.0254;
  const ratio = P / D;

  // Actual FPV prop data: 3-blade 5x4.3 APC triblade ~ Ct0=0.13, 5x3.6 ~ Ct0=0.10
  // Cp0 scales with Ct0 * P/D ratio * efficiency factor
  const Ct0 = Math.max(0.04, Math.min(0.16, 0.06 + 0.30 * ratio));
  const Cp0 = Math.max(0.005, Ct0 * ratio * 0.48 + 0.004);

  // Motor electrical model: real internal resistance depends on stator volume and KV
  // 2207 2400KV motor: typical Rm ~ 35-60 mOhm
  const statorVol = (build.motorStator / 23) ** 2;
  const Rm = 0.025 + 0.025 * statorVol + 0.0003 / (Math.max(1, build.motorKv / 2000) ** 0.5); // ohms
  const Ke = 60 / (2 * Math.PI * build.motorKv);
  const Kt = Ke;

  // Battery
  const cellOCV = 4.15;
  const Vbat_nominal = build.batteryCells * cellOCV;
  const Rcell = 0.004 + 0.18 / (build.batteryMah * build.batteryC);
  const Rbat = build.batteryCells * Rcell + 0.008;

  // Solve steady state: Kt*(Vbat - Ke*w)/Rm = Cp * rho * (w/2pi)^2 * D^5
  const a_coef = Cp0 * RHO * D ** 5 / (4 * Math.PI * Math.PI);
  const b_coef = Kt * Ke / Rm;
  const c_coef = Kt * Vbat_nominal / Rm;
  const discrim = b_coef * b_coef + 4 * a_coef * c_coef;
  const omega = discrim > 0 ? (-b_coef + Math.sqrt(discrim)) / (2 * a_coef) : 0;
  const rpm = omega * 30 / Math.PI;
  const noloadRpm = Vbat_nominal * build.motorKv;
  const loadedFraction = noloadRpm > 0 ? rpm / noloadRpm : 0;

  // Thrust
  const Tm = Ct0 * RHO * (omega / (2 * Math.PI)) ** 2 * D ** 4;
  const totalThrust = 4 * Tm;

  // Current
  const backEMF = Ke * omega;
  const Im = Math.max(0, (Vbat_nominal - backEMF) / Rm);
  const P_in = Vbat_nominal * Im;
  const P_out = Cp0 * RHO * (omega / (2 * Math.PI)) ** 3 * D ** 5;
  const totalI = 4 * Im;

  // Mass: realistic AUW for 5" ~ 580-700g
  // Frame: 5"(220mm) ~ 110g, scales roughly as wheelbase^2
  const frameMass = 0.018 + 0.0005 * build.wheelbase + 0.0000018 * build.wheelbase * build.wheelbase;
  
  // Motor: 2207 ~ 32g
  const motorMass = 0.015 + 0.0006 * build.motorStator * build.motorStator;
  
  // Prop: tri-blade ~ 3.5g for 5", scales with D^2
  const propMass = 0.0005 + 0.0012 * build.propDiameter * build.propDiameter;
  
  // Battery: 4S 1500 ~ 190g
  const batMass = 0.020 + build.batteryMah * 0.001 * build.batteryCells * 0.032;
  
  const camMass = build.camWeight * 0.001;
  const totalMass = frameMass + 4 * (motorMass + propMass) + batMass + camMass;

  // Inertia: motor+prop point masses at arm endpoints
  const motorArmMass = motorMass + propMass;
  const I_roll_raw = 4 * motorArmMass * armLen * armLen;
  const I_pitch_raw = I_roll_raw;
  const I_yaw_raw = 8 * motorArmMass * armLen * armLen; // yaw moment ~ 2x roll from diagonal config
  
  // Add frame + battery central mass
  const I_central = (frameMass + batMass) * 0.02 * 0.02;
  const I_roll = (I_roll_raw + I_central) * 1.5;
  const I_pitch = (I_pitch_raw + I_central + camMass * 0.04 * 0.04) * 1.5;
  const I_yaw = (I_yaw_raw + (frameMass + batMass) * 0.035 * 0.035) * 1.5;

  // Torque authority
  const maxRollTorque = 2 * Tm * armLen;
  const maxAngAccel = maxRollTorque / I_roll;

  // Hover
  const hoverThrustNeeded = totalMass * 9.81 / 4;
  const hoverOmega = Math.sqrt(hoverThrustNeeded / (Ct0 * RHO * D ** 4)) * 2 * Math.PI;
  const hoverThr = omega > 0 ? hoverOmega / omega : 1;

  // Drag: Cd*A where A ~ wheelbase area
  const dragArea = 0.010 * (build.wheelbase / 220) ** 2;
  const Cdrag = 0.5 * RHO * dragArea * 1.1;

  return {
    armLen, D, P, ratio, Ct0, Cp0, Rm: Rm * 1000, Ke, Kt,
    Vbat: Vbat_nominal, Rbat: Rbat * 1000,
    omega, rpm, noloadRpm, loadedFraction,
    Tm, totalThrust, TWR: totalThrust / (totalMass * 9.81),
    Im, totalI, P_in,
    frameMass, motorMass, propMass, batMass, camMass, totalMass,
    I_roll, I_pitch, I_yaw,
    maxRollTorque, maxAngAccelDeg: maxAngAccel * 180 / Math.PI,
    hoverThr: hoverThr ** 2 * 100, Cdrag
  };
}

const builds = [
  { name: '5寸花飞',  wb: 220, kv: 2400, st: 23, cells: 4, mah: 1500, cRate: 95, cam: 30, pd: 5.1, pp: 3.6 },
  { name: '5寸竞速',  wb: 210, kv: 2750, st: 22, cells: 6, mah: 1300, cRate: 120,cam: 25, pd: 5.1, pp: 4.3 },
  { name: '7寸远航',  wb: 280, kv: 1300, st: 28, cells: 6, mah: 2200, cRate: 95, cam: 45, pd: 7.0, pp: 4.0 },
  { name: '3寸牙签',  wb: 135, kv: 4500, st: 14, cells: 3, mah: 850, cRate: 90, cam: 12, pd: 3.0, pp: 2.5 },
  { name: '2寸whoop',  wb: 75,  kv: 19000,st: 8,  cells: 1, mah: 450, cRate: 75, cam: 4,  pd: 1.6, pp: 1.2 },
];

console.log('=== FPV Blade-Momentum Physics Validation v2 ===\n');

for (const b of builds) {
  const p = computePhysics({
    wheelbase: b.wb, motorKv: b.kv, motorStator: b.st,
    batteryCells: b.cells, batteryMah: b.mah, batteryC: b.cRate,
    camWeight: b.cam, propDiameter: b.pd, propPitch: b.pp
  });
  console.log(`--- ${b.name} (${b.wb}mm ${b.cells}S ${b.kv}KV) ---`);
  console.log(`  桨: ${b.pd}x${b.pp} P/D=${p.ratio.toFixed(2)} | Ct0=${p.Ct0.toFixed(4)} Cp0=${p.Cp0.toFixed(4)}`);
  console.log(`  电机 Rm=${p.Rm.toFixed(1)}mΩ | 电池 ${b.cells}S Rbat=${p.Rbat.toFixed(1)}mΩ`);
  console.log(`  空载RPM ${p.noloadRpm.toFixed(0)} | 带载RPM ${p.rpm.toFixed(0)} (${(p.loadedFraction*100).toFixed(0)}%)`);
  console.log(`  单电机: 推力 ${p.Tm.toFixed(2)}N (${(p.Tm/9.81*1000).toFixed(0)}g) | 电流 ${p.Im.toFixed(1)}A | 输入功率 ${p.P_in.toFixed(0)}W`);
  console.log(`  总推力 ${p.totalThrust.toFixed(1)}N | TWR ${p.TWR.toFixed(1)}:1`);
  console.log(`  质量: 总${(p.totalMass*1000).toFixed(0)}g 机架${(p.frameMass*1000).toFixed(0)}g 电机${(p.motorMass*1000).toFixed(1)}gx4 桨${(p.propMass*1000).toFixed(1)}gx4 电池${(p.batMass*1000).toFixed(0)}g 相机${(p.camMass*1000).toFixed(0)}g`);
  console.log(`  惯量(×1e3): roll=${(p.I_roll*1e3).toFixed(3)} pitch=${(p.I_pitch*1e3).toFixed(3)} yaw=${(p.I_yaw*1e3).toFixed(3)} kg·m²`);
  console.log(`  臂长 ${(p.armLen*1000).toFixed(0)}mm | 最大滚转力矩 ${p.maxRollTorque.toFixed(3)}N·m | 角加速 ${p.maxAngAccelDeg.toFixed(0)}°/s²`);
  console.log(`  悬停油门估算 ${p.hoverThr.toFixed(1)}% | 阻力Cd ${p.Cdrag.toFixed(5)}`);
  console.log();
}
