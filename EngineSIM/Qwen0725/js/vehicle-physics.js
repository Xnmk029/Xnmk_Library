/**
 * 双轴单轨车辆物理模型 (Bicycle Model)
 * 轮胎摩擦: 简化Pacejka魔术公式
 * 
 * 模型说明:
 * - 将四轮车辆简化为前后两个等效轮胎(单轨)
 * - 前轴代表两个前轮的合力, 后轴代表两个后轮的合力
 * - 使用简化Pacejka公式计算轮胎侧向力/纵向力
 */

export class VehiclePhysics {
    constructor() {
        // === 车辆参数 (美式肌肉车 - 类似Camaro/Mustang) ===
        this.params = {
            mass: 1700,              // 整备质量 (kg)
            wheelbase: 2.85,         // 轴距 (m)
            lf: 1.35,               // 前轴到质心距离 (m)
            lr: 1.50,               // 后轴到质心距离 (m)
            trackWidth: 1.62,        // 轮距 (m)
            inertiaZ: 2800,          // 横摆转动惯量 (kg·m²)
            dragCoeff: 0.35,         // 空气阻力系数 Cd
            frontalArea: 2.3,        // 迎风面积 (m²)
            airDensity: 1.225,       // 空气密度 (kg/m³)
            rollingResist: 0.015,    // 滚动阻力系数
            wheelRadius: 0.34,       // 轮胎半径 (m)

            // 轮胎参数 (简化Pacejka)
            tireMu: 1.1,            // 峰值摩擦系数 (柏油路面)
            tireStiffnessF: 12.0,   // 前轮侧偏刚度 (×10000 N/rad)
            tireStiffnessR: 14.0,   // 后轮侧偏刚度 (×10000 N/rad)
            tirePeakSlip: 0.08,     // 峰值侧偏角 (rad)
            tireLongMu: 1.2,        // 纵向峰值摩擦

            // 引擎/传动
            engineTorquePeak: 620,   // 峰值扭矩 (N·m) @ 4600RPM
            enginePowerPeak: 343000, // 峰值功率 (W) ~460HP
            gearRatios: [-3.2, 0, 3.5, 2.4, 1.7, 1.3, 1.0, 0.8], // R,N,1-6
            finalDrive: 3.73,        // 主减速比
            transmissionEff: 0.92,   // 传动效率
            clutchEngageSpeed: 0.3,  // 离合器接合速度
        };

        // === 车辆状态 ===
        this.state = {
            // 位置与姿态
            x: 0, y: 0,            // 世界坐标 (m)
            heading: 0,             // 航向角 (rad)

            // 速度
            vx: 0,                  // 纵向速度 (m/s) (车身坐标系)
            vy: 0,                  // 侧向速度 (m/s)
            yawRate: 0,             // 横摆角速度 (rad/s)

            // 车轮
            wheelSpeedFL: 0,
            wheelSpeedFR: 0,
            wheelSpeedRL: 0,
            wheelSpeedRR: 0,

            // 传动
            rpm: 800,
            gear: 0,                // 0=N, 1-6前进, -1倒车
            throttle: 0,
            brake: 0,
            steering: 0,            // 方向盘角度 (rad)
            handbrake: false,

            // 轮胎状态
            slipAngleF: 0,
            slipAngleR: 0,
            slipRatioF: 0,
            slipRatioR: 0,
            lateralForceF: 0,
            lateralForceR: 0,
            longForceF: 0,
            longForceR: 0,

            // 引擎
            engineOn: true,
            engineTorque: 0,
        };

        this.maxSteering = 0.55;    // 最大前轮转角 (rad)
        this.steeringSpeed = 2.5;   // 转向速度 (rad/s)
        this.steeringReturn = 4.0;  // 转向回正速度
    }

    /**
     * 简化Pacejka魔术公式 - 计算轮胎力
     * F = D * sin(C * atan(B*slip - E*(B*slip - atan(B*slip))))
     * 简化为: F = mu * Fz * sin(C * atan(B * slip))
     */
    pacejkaForce(slip, Fz, mu, stiffness) {
        const B = stiffness / (mu * Fz + 1);   // 刚度因子
        const C = 1.65;                         // 形状因子
        const D = mu * Fz;                      // 峰值力
        const force = D * Math.sin(C * Math.atan(B * slip));
        return force;
    }

    /**
     * 引擎扭矩曲线 (简化)
     */
    getEngineTorque(rpm, throttle) {
        if (rpm < 800) rpm = 800;
        if (rpm > 7200) rpm = 7200;

        const p = this.params;
        // 简化的扭矩曲线: 低转高扭, 中转峰值, 高转衰减
        const rpmNorm = rpm / 7200;
        let torqueCurve;

        if (rpmNorm < 0.2) {
            torqueCurve = 0.7 + rpmNorm * 1.5; // 低转扭矩上升
        } else if (rpmNorm < 0.64) {
            torqueCurve = 1.0;                   // 平台区 (峰值扭矩)
        } else {
            torqueCurve = 1.0 - (rpmNorm - 0.64) * 0.8; // 高转衰减
        }

        // 限流器
        if (rpm > 6800) {
            torqueCurve *= Math.max(0, 1 - (rpm - 6800) / 400);
        }

        return p.engineTorquePeak * torqueCurve * throttle;
    }

    /**
     * 主物理更新
     * @param {number} dt - 时间步长 (秒)
     * @param {object} input - {throttle, brake, steering, handbrake, gearUp, gearDown}
     */
    update(dt, input) {
        const s = this.state;
        const p = this.params;

        // 限制dt防止物理爆炸
        dt = Math.min(dt, 0.02);

        // === 1. 输入处理 ===
        s.throttle = input.throttle;
        s.brake = input.brake;
        s.handbrake = input.handbrake;

        // 转向处理 (带速度感应)
        const speedFactor = 1.0 / (1.0 + Math.abs(s.vx) * 0.02);
        const targetSteer = input.steering * this.maxSteering * speedFactor;

        if (Math.abs(targetSteer) > Math.abs(s.steering)) {
            s.steering += Math.sign(targetSteer - s.steering) *
                Math.min(Math.abs(targetSteer - s.steering), this.steeringSpeed * dt);
        } else {
            s.steering += Math.sign(targetSteer - s.steering) *
                Math.min(Math.abs(targetSteer - s.steering), this.steeringReturn * dt);
        }

        // 换挡
        if (input.gearUp && s.gear < 6) {
            s.gear++;
        }
        if (input.gearDown && s.gear > -1) {
            s.gear--;
        }

        // === 2. 引擎/传动计算 ===
        this._updateDrivetrain(dt);

        // === 3. 轮胎力计算 (双轴单轨模型核心) ===
        this._updateTireForces(dt);

        // === 4. 车辆动力学积分 ===
        this._updateDynamics(dt);

        // === 5. 位置更新 ===
        s.x += (s.vx * Math.cos(s.heading) - s.vy * Math.sin(s.heading)) * dt;
        s.y += (s.vx * Math.sin(s.heading) + s.vy * Math.cos(s.heading)) * dt;
        s.heading += s.yawRate * dt;

        // 归一化航向角
        while (s.heading > Math.PI) s.heading -= 2 * Math.PI;
        while (s.heading < -Math.PI) s.heading += 2 * Math.PI;
    }

    /**
     * 传动系统更新
     */
    _updateDrivetrain(dt) {
        const s = this.state;
        const p = this.params;

        if (s.gear === 0) {
            // 空挡 - 引擎自由旋转
            const targetRPM = 800 + s.throttle * 4000;
            s.rpm += (targetRPM - s.rpm) * 3.0 * dt;
            s.engineTorque = 0;
            return;
        }

        const gearRatio = p.gearRatios[s.gear + 1]; // +1 因为数组包含R和N
        const totalRatio = gearRatio * p.finalDrive;

        // 由车速反算引擎RPM
        const wheelRPM = Math.abs(s.vx) / (2 * Math.PI * p.wheelRadius) * 60;
        const engineRPMFromWheel = wheelRPM * totalRatio;

        if (Math.abs(s.vx) < 1.0 && s.gear > 0) {
            // 低速/起步 - 离合器滑摩
            s.rpm += (800 + s.throttle * 3000 - s.rpm) * 2.0 * dt;
            s.rpm = Math.max(s.rpm, engineRPMFromWheel * p.clutchEngageSpeed);
        } else {
            // 正常行驶 - 刚性连接
            s.rpm = Math.max(800, engineRPMFromWheel);
        }

        s.rpm = Math.min(s.rpm, 7200);

        // 引擎扭矩
        s.engineTorque = this.getEngineTorque(s.rpm, s.throttle);

        // 传递到车轮的驱动力
        const driveForce = s.engineTorque * totalRatio * p.transmissionEff / p.wheelRadius;
        s.longForceF = s.gear !== 0 ? driveForce * 0.45 : 0; // 前驱分配(肌肉车偏后驱)
        s.longForceR = s.gear !== 0 ? driveForce * 0.55 : 0;
    }

    /**
     * 轮胎力计算 - 双轴单轨模型核心
     */
    _updateTireForces(dt) {
        const s = this.state;
        const p = this.params;

        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);

        // 前后轴垂直载荷 (静态 + 载荷转移)
        const g = 9.81;
        const FzTotal = p.mass * g;

        // 纵向加速度引起的载荷转移
        const ax = (s.longForceF + s.longForceR - this._getDragForce() - this._getRollingResist()) / p.mass;
        const loadTransferLong = p.mass * ax * 0.3 / p.wheelbase; // 简化重心高度0.3m

        const FzF = FzTotal * (p.lr / p.wheelbase) - loadTransferLong;
        const FzR = FzTotal * (p.lf / p.wheelbase) + loadTransferLong;

        // === 侧偏角计算 ===
        if (speed > 0.5) {
            // 前轮侧偏角
            s.slipAngleF = Math.atan2(s.vy + p.lf * s.yawRate, Math.abs(s.vx)) - s.steering;
            // 后轮侧偏角
            s.slipAngleR = Math.atan2(s.vy - p.lr * s.yawRate, Math.abs(s.vx));
        } else {
            s.slipAngleF = 0;
            s.slipAngleR = 0;
        }

        // === Pacejka侧向力 ===
        const muF = p.tireMu * (s.handbrake ? 0.6 : 1.0); // 手刹降低后轮摩擦
        s.lateralForceF = -this.pacejkaForce(
            s.slipAngleF, FzF, p.tireMu, p.tireStiffnessF * 10000
        );
        s.lateralForceR = -this.pacejkaForce(
            s.slipAngleR, FzR, muF, p.tireStiffnessR * 10000
        );

        // === 纵向力 (制动) ===
        const brakeForce = s.brake * p.tireLongMu * FzTotal * 0.5;
        const handbrakeForce = s.handbrake ? p.tireLongMu * FzR * 0.7 : 0;

        s.longForceF -= brakeForce * (FzF / FzTotal) * Math.sign(s.vx);
        s.longForceR -= (brakeForce * (FzR / FzTotal) + handbrakeForce) * Math.sign(s.vx);

        // 纵向滑移率
        if (speed > 0.5) {
            s.slipRatioF = (s.longForceF) / (FzF * p.tireLongMu + 1);
            s.slipRatioR = (s.longForceR) / (FzR * p.tireLongMu + 1);
        }
    }

    /**
     * 车辆动力学积分 (牛顿-欧拉方程)
     */
    _updateDynamics(dt) {
        const s = this.state;
        const p = this.params;

        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);

        // 空气阻力
        const dragForce = this._getDragForce();
        // 滚动阻力
        const rollResist = this._getRollingResist();

        // === 纵向动力学 ===
        const FxTotal = s.longForceF + s.longForceR - dragForce - rollResist;
        const ax = FxTotal / p.mass + s.vy * s.yawRate; // 含科氏力项
        s.vx += ax * dt;

        // 防止反向 (无倒车动力时)
        if (s.gear === 0 && s.vx < 0) s.vx = Math.min(0, s.vx + 2 * dt);

        // === 侧向动力学 ===
        const FyTotal = s.lateralForceF * Math.cos(s.steering) + s.lateralForceR;
        const ay = FyTotal / p.mass - s.vx * s.yawRate; // 含科氏力项
        s.vy += ay * dt;

        // === 横摆动力学 ===
        const Mz = p.lf * s.lateralForceF * Math.cos(s.steering) - p.lr * s.lateralForceR;
        const yawAcc = Mz / p.inertiaZ;
        s.yawRate += yawAcc * dt;

        // 低速阻尼 (防止静止时抖动)
        if (speed < 0.3) {
            s.vy *= 0.9;
            s.yawRate *= 0.9;
        }

        // 横摆角速度限制
        s.yawRate = Math.max(-3.0, Math.min(3.0, s.yawRate));
    }

    _getDragForce() {
        const p = this.params;
        const s = this.state;
        return 0.5 * p.airDensity * p.dragCoeff * p.frontalArea * s.vx * Math.abs(s.vx);
    }

    _getRollingResist() {
        const p = this.params;
        const s = this.state;
        return p.rollingResist * p.mass * 9.81 * Math.sign(s.vx);
    }

    /**
     * 获取速度 (km/h)
     */
    getSpeedKmh() {
        return Math.abs(this.state.vx) * 3.6;
    }

    /**
     * 重置车辆
     */
    reset(x = 0, y = 0, heading = 0) {
        const s = this.state;
        s.x = x;
        s.y = y;
        s.heading = heading;
        s.vx = 0;
        s.vy = 0;
        s.yawRate = 0;
        s.rpm = 800;
        s.gear = 0;
        s.steering = 0;
        s.throttle = 0;
        s.brake = 0;
    }
}
