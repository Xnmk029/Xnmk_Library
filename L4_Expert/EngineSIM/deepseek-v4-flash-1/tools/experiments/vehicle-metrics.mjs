// 车辆关键指标复现脚本（对应 PROJECT_PROMPT 第 4 节验收）。
import { Vehicle } from '../../src/sim/vehicle.mjs';
import { pathToFileURL } from 'node:url';

const DT = 1 / 240;

export function launchTest(tcOn, seconds = 12) {
  const v = new Vehicle();
  v.tcOn = tcOn;
  v.autoShift = true;
  let t100 = -1;
  let peakSlip = 0;
  let peakSlipSteady = 0;
  let maxRpm = 0;
  for (let i = 0; i < seconds / DT; i++) {
    v.step(DT, { steer: 0, throttle: 1, brake: 0 });
    const s = Math.max(Math.abs(v.tires[2].slip), Math.abs(v.tires[3].slip));
    peakSlip = Math.max(peakSlip, s);
    if (v.time > 0.2) peakSlipSteady = Math.max(peakSlipSteady, s);
    maxRpm = Math.max(maxRpm, v.rpm);
    if (t100 < 0 && v.vx >= 27.78) t100 = v.time;
    if (t100 > 0 && v.time > t100 + 1) break;
  }
  return { t100, peakSlip, peakSlipSteady, maxRpm, gear: v.drivetrain.gear, speed: v.speedKmh, rpm: v.rpm };
}

export function brakingTest() {
  const v = new Vehicle();
  v.vx = 27.78;
  for (let i = 0; i < 4; i++) v.tires[i].omega = v.vx / v.spec.wheelRadius;
  let dist = 0;
  let peakDecel = 0;
  while (v.vx > 0.3 && v.time < 15) {
    v.step(DT, { steer: 0, throttle: 0, brake: 1 });
    dist += Math.abs(v.vx) * DT;
    peakDecel = Math.max(peakDecel, -v.ax);
  }
  return { dist, peakDecel, time: v.time };
}

export function corneringTest() {
  const v = new Vehicle();
  // 恒定半径 77m ≈ 100km/h 1.0g 弯（向心加速度用 vx·r 测量）
  const R = 77;
  const steer = 0.25; // 中量转向：让辅助限幅生效（100km/h 时 cap≈2.4°）
  v.vx = 25;
  for (let i = 0; i < 4; i++) v.tires[i].omega = v.vx / v.spec.wheelRadius;
  let peakG = 0;
  let peakFrontSlip = 0;
  let maxVy = 0;
  for (let i = 0; i < 10 / DT; i++) {
    const t = v.time;
    const throttle = Math.max(0, Math.min(0.6, 0.13 + (27.78 - v.vx) * 0.10));
    v.step(DT, { steer, throttle, brake: 0 });
    peakG = Math.max(peakG, Math.abs(v.vx * v.r) / 9.81);
    maxVy = Math.max(maxVy, Math.abs(v.vy));
    peakFrontSlip = Math.max(peakFrontSlip,
      Math.abs(v.tires[0].alphaEff) * 180 / Math.PI,
      Math.abs(v.tires[1].alphaEff) * 180 / Math.PI);
  }
  return { peakG, peakFrontSlip, speed: v.speedKmh, maxVy, yawRate: v.yawRateDeg };
}

export function straightTest() {
  const v = new Vehicle();
  v.vx = 27.78;
  for (let i = 0; i < 4; i++) v.tires[i].omega = v.vx / v.spec.wheelRadius;
  for (let i = 0; i < 5 / DT; i++) {
    const throttle = Math.max(0, Math.min(0.6, 0.12 + (27.78 - v.vx) * 0.08));
    v.step(DT, { steer: 0, throttle, brake: 0 });
  }
  return { drift: Math.abs(v.y), yawDeg: v.yaw * 180 / Math.PI, speed: v.speedKmh, vy: v.vy };
}

// 100km/h 满舵：前轮峰值滑移（辅助开/关对比，目标 4.46° → 2.24°）
export function fullLockSlipTest(assistOn, seconds = 6) {
  const v = new Vehicle();
  v.assistOn = assistOn;
  v.vx = 27.78;
  for (let i = 0; i < 4; i++) v.tires[i].omega = v.vx / v.spec.wheelRadius;
  let peakFrontSlip = 0;
  let steadyPeakFrontSlip = 0;
  let peakG = 0;
  for (let i = 0; i < seconds / DT; i++) {
    const throttle = Math.max(0, Math.min(0.7, 0.20 + (27.78 - v.vx) * 0.10));
    v.step(DT, { steer: 1, throttle, brake: 0 });
    peakFrontSlip = Math.max(peakFrontSlip,
      Math.abs(v.tires[0].alphaEff) * 180 / Math.PI,
      Math.abs(v.tires[1].alphaEff) * 180 / Math.PI);
    if (v.time > 2.5) {
      steadyPeakFrontSlip = Math.max(steadyPeakFrontSlip,
        Math.abs(v.tires[0].alphaEff) * 180 / Math.PI,
        Math.abs(v.tires[1].alphaEff) * 180 / Math.PI);
    }
    peakG = Math.max(peakG, Math.abs(v.vx * v.r) / 9.81);
  }
  return { peakFrontSlip, steadyPeakFrontSlip, peakG, speed: v.speedKmh };
}

// 80km/h 甩尾救回：稳定直行后给横摆扰动，松手（steer=0），测恢复时间与偏航累积
export function snapOversteerTest(assistOn) {
  const v = new Vehicle();
  v.assistOn = assistOn;
  v.vx = 22.22;
  for (let i = 0; i < 4; i++) v.tires[i].omega = v.vx / v.spec.wheelRadius;
  let yaw0 = 0;
  let disturbed = false;
  let recoveredAt = -1;
  let yawAtRec = 0;
  let peakR = 0;
  for (let i = 0; i < 6 / DT; i++) {
    const t = v.time;
    if (t >= 0.5 && !disturbed) {
      v.r += 1.0; // 横摆扰动（rad/s）
      disturbed = true;
      yaw0 = v.yaw;
    }
    const throttle = Math.max(0, Math.min(0.6, 0.15 + (22.22 - v.vx) * 0.06));
    v.step(DT, { steer: 0, throttle, brake: 0 });
    peakR = Math.max(peakR, Math.abs(v.r));
    if (recoveredAt < 0 && disturbed && Math.abs(v.r) < 0.05) {
      recoveredAt = v.time - 0.5;
      yawAtRec = Math.abs(v.yaw - yaw0);
    }
  }
  const yawAccum = Math.abs(v.yaw - yaw0);
  return { recoveredAt, yawAccum, yawAtRec, peakR, speed: v.speedKmh };
}

export function abuseTest(seconds = 30) {
  const v = new Vehicle();
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let maxYawRate = 0;
  let maxSpeed = 0;
  for (let i = 0; i < seconds / DT; i++) {
    const t = v.time;
    v.step(DT, {
      steer: Math.sin(t * 1.7) * 0.30 + (rnd() - 0.5) * 0.12,
      throttle: Math.abs(Math.sin(t * 0.9)) + rnd() * 0.3,
      brake: rnd() < 0.10 ? 1 : 0,
      handbrake: v.speedKmh < 30 && rnd() < 0.04 ? 1 : 0,
      clutch: rnd() < 0.08 ? 0 : 1,
      gearDelta: rnd() < 0.04 ? (rnd() < 0.5 ? 1 : -1) : 0
    });
    if (!Number.isFinite(v.x) || !Number.isFinite(v.vx) || !Number.isFinite(v.r)) {
      return { nan: true, at: v.time };
    }
    maxYawRate = Math.max(maxYawRate, Math.abs(v.r) * 180 / Math.PI);
    maxSpeed = Math.max(maxSpeed, v.speedKmh);
  }
  return { nan: false, maxYawRate, maxSpeed, x: v.x, y: v.y };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('launch TC on :', launchTest(true));
  console.log('launch TC off:', launchTest(false));
  console.log('braking      :', brakingTest());
  console.log('cornering    :', corneringTest());
  console.log('straight     :', straightTest());
  console.log('full lock no :', fullLockSlipTest(false));
  console.log('full lock as :', fullLockSlipTest(true));
  console.log('snap no      :', snapOversteerTest(false));
  console.log('snap assist  :', snapOversteerTest(true));
  console.log('abuse 30s    :', abuseTest());
}
