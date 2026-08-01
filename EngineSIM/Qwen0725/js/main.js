/**
 * V8 Engine Simulator - 主程序
 * 整合: Three.js场景 + 引擎声音 + 车辆物理 + 输入控制
 */
import * as THREE from 'three';
import { EngineSoundSimulator } from './engine-sound.js';
import { VehiclePhysics } from './vehicle-physics.js';
import { TrackGenerator } from './track.js';
import { MuscleCar } from './car-model.js';
import { SceneEnvironment } from './scene-env.js';

class EngineSimApp {
    constructor() {
        this.clock = new THREE.Clock();
        this.keys = {};
        this.cameraMode = 0; // 0=追踪, 1=引擎盖, 2=俯视
        this.cameraModes = ['chase', 'hood', 'top'];
        this.paused = false;

        // 输入状态
        this.input = {
            throttle: 0,
            brake: 0,
            steering: 0,
            handbrake: false,
            gearUp: false,
            gearDown: false,
        };

        this._init();
    }

    async _init() {
        this._updateLoading('初始化渲染器...');

        // === Three.js 基础设置 ===
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            65, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera.position.set(0, 5, 10);

        this._updateLoading('生成赛道...');
        await this._sleep(50);

        // === 赛道 ===
        this.track = new TrackGenerator(this.scene);
        this.trackCurve = this.track.generate();

        this._updateLoading('构建车辆模型...');
        await this._sleep(50);

        // === 车辆模型 ===
        this.car = new MuscleCar(this.scene);

        // === 场景环境 ===
        this.environment = new SceneEnvironment(this.scene, this.renderer);

        this._updateLoading('初始化物理引擎...');
        await this._sleep(50);

        // === 车辆物理 ===
        this.physics = new VehiclePhysics();
        // 将车辆放置在起跑线
        const startPoint = this.trackCurve.getPointAt(0);
        const startTangent = this.trackCurve.getTangentAt(0);
        const startHeading = Math.atan2(startTangent.x, startTangent.z);
        this.physics.reset(startPoint.x, startPoint.z, startHeading);
        this.physics.state.gear = 1; // 1挡起步

        this._updateLoading('初始化音频引擎...');
        await this._sleep(50);

        // === 引擎声音 ===
        this.engineSound = new EngineSoundSimulator();

        // === 输入绑定 ===
        this._bindInput();

        // === 窗口resize ===
        window.addEventListener('resize', () => this._onResize());

        // 隐藏加载画面
        this._updateLoading('就绪! 点击任意位置启动引擎');
        await this._sleep(300);
        document.getElementById('loading-screen').classList.add('fade-out');
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 1000);

        // 等待用户交互后初始化音频 (浏览器策略)
        this.audioReady = false;
        const initAudio = async () => {
            if (!this.audioReady) {
                await this.engineSound.init();
                this.engineSound.setEngineOn(true);
                this.audioReady = true;
            }
        };
        window.addEventListener('click', initAudio, { once: false });
        window.addEventListener('keydown', initAudio, { once: false });

        // === 开始主循环 ===
        this._animate();
    }

    _bindInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            // 换挡 (单次触发)
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this.input.gearUp = true;
            }
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                this.input.gearDown = true;
                e.preventDefault();
            }

            // 视角切换
            if (e.code === 'KeyC') {
                this.cameraMode = (this.cameraMode + 1) % 3;
            }

            // 重置
            if (e.code === 'KeyR') {
                this._resetVehicle();
            }

            // 点火
            if (e.code === 'KeyI') {
                if (this.audioReady) {
                    const engineOn = !this.physics.state.engineOn;
                    this.physics.state.engineOn = engineOn;
                    this.engineSound.setEngineOn(engineOn);
                }
            }

            e.preventDefault();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // 防止右键菜单
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _processInput() {
        // 油门
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            this.input.throttle = Math.min(1, this.input.throttle + 0.03);
        } else {
            this.input.throttle = Math.max(0, this.input.throttle - 0.05);
        }

        // 刹车
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            this.input.brake = Math.min(1, this.input.brake + 0.04);
        } else {
            this.input.brake = Math.max(0, this.input.brake - 0.06);
        }

        // 转向
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            this.input.steering = Math.max(-1, this.input.steering - 0.06);
        } else if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            this.input.steering = Math.min(1, this.input.steering + 0.06);
        } else {
            // 回正
            this.input.steering *= 0.85;
            if (Math.abs(this.input.steering) < 0.01) this.input.steering = 0;
        }

        // 手刹
        this.input.handbrake = !!this.keys['Space'];
    }

    _resetVehicle() {
        const startPoint = this.trackCurve.getPointAt(0);
        const startTangent = this.trackCurve.getTangentAt(0);
        const startHeading = Math.atan2(startTangent.x, startTangent.z);
        this.physics.reset(startPoint.x, startPoint.z, startHeading);
        this.physics.state.gear = 1;
    }

    _updateCamera(dt) {
        const carPos = this.car.carGroup.position;
        const carForward = this.car.getForwardVector();
        const speed = this.physics.getSpeedKmh();

        let targetPos, lookAt;

        switch (this.cameraMode) {
            case 0: // 追踪摄像机
                const dist = 7 + speed * 0.02;
                const height = 3.0 + speed * 0.005;
                targetPos = new THREE.Vector3(
                    carPos.x - carForward.x * dist,
                    carPos.y + height,
                    carPos.z - carForward.z * dist
                );
                lookAt = new THREE.Vector3(
                    carPos.x + carForward.x * 5,
                    carPos.y + 1,
                    carPos.z + carForward.z * 5
                );
                // 平滑跟随
                this.camera.position.lerp(targetPos, 1 - Math.pow(0.01, dt));
                break;

            case 1: // 引擎盖视角
                targetPos = new THREE.Vector3(
                    carPos.x + carForward.x * 0.5,
                    carPos.y + 1.5,
                    carPos.z + carForward.z * 0.5
                );
                this.camera.position.lerp(targetPos, 1 - Math.pow(0.001, dt));
                lookAt = new THREE.Vector3(
                    carPos.x + carForward.x * 20,
                    carPos.y + 0.5,
                    carPos.z + carForward.z * 20
                );
                break;

            case 2: // 俯视
                targetPos = new THREE.Vector3(carPos.x, carPos.y + 25, carPos.z + 5);
                this.camera.position.lerp(targetPos, 1 - Math.pow(0.01, dt));
                lookAt = carPos.clone();
                break;
        }

        this.camera.lookAt(lookAt);

        // FOV随速度变化 (速度感)
        const targetFOV = 65 + speed * 0.08;
        this.camera.fov += (targetFOV - this.camera.fov) * 0.05;
        this.camera.updateProjectionMatrix();
    }

    _updateHUD() {
        const state = this.physics.state;
        const speed = this.physics.getSpeedKmh();

        // 速度
        document.getElementById('speed-value').textContent = Math.round(speed);

        // RPM
        const rpm = Math.round(state.rpm);
        document.getElementById('rpm-value').textContent = rpm;
        const rpmPercent = (rpm / 7200) * 100;
        const rpmBar = document.getElementById('rpm-bar');
        rpmBar.style.width = rpmPercent + '%';
        rpmBar.style.backgroundColor = rpm > 6800 ? '#ff2222' :
            rpm > 5500 ? '#ffaa00' : '#44ff44';

        // 挡位
        const gearNames = { '-1': 'R', 0: 'N', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' };
        document.getElementById('gear-value').textContent = gearNames[state.gear] || 'N';

        // 油门
        document.getElementById('throttle-bar').style.height =
            (state.throttle * 100) + '%';
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const dt = Math.min(this.clock.getDelta(), 0.05);

        // 输入处理
        this._processInput();

        // 物理更新 (子步进提高稳定性)
        const subSteps = 3;
        const subDt = dt / subSteps;
        for (let i = 0; i < subSteps; i++) {
            this.physics.update(subDt, {
                throttle: this.input.throttle,
                brake: this.input.brake,
                steering: this.input.steering,
                handbrake: this.input.handbrake,
                gearUp: i === 0 ? this.input.gearUp : false,
                gearDown: i === 0 ? this.input.gearDown : false,
            });
        }
        // 重置单次触发输入
        this.input.gearUp = false;
        this.input.gearDown = false;

        // 赛道边界检测
        this._checkTrackBounds();

        // 更新车辆模型
        this.car.update(this.physics.state);

        // 更新引擎声音
        if (this.audioReady && this.physics.state.engineOn) {
            this.engineSound.update(dt, {
                rpm: this.physics.state.rpm,
                throttle: this.physics.state.throttle,
                speed: this.physics.getSpeedKmh(),
                gear: this.physics.state.gear,
            });
        }

        // 更新摄像机
        this._updateCamera(dt);

        // 更新环境
        this.environment.update(dt);
        this.environment.updateShadowCamera(
            this.car.carGroup.position.x,
            this.car.carGroup.position.z
        );

        // 更新HUD
        this._updateHUD();

        // 渲染
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 赛道边界检测 (简化: 距离中心线过远则减速)
     */
    _checkTrackBounds() {
        const carPos = new THREE.Vector2(
            this.physics.state.x,
            this.physics.state.y
        );

        // 采样赛道上最近的点
        let minDist = Infinity;
        for (let t = 0; t < 1; t += 0.01) {
            const p = this.trackCurve.getPointAt(t);
            const dist = carPos.distanceTo(new THREE.Vector2(p.x, p.z));
            if (dist < minDist) minDist = dist;
        }

        const maxDist = this.track.roadWidth / 2 + this.track.curbWidth + 2;
        if (minDist > maxDist) {
            // 超出赛道 - 大幅减速 (草地阻力)
            this.physics.state.vx *= 0.95;
            this.physics.state.vy *= 0.9;
        } else if (minDist > this.track.roadWidth / 2) {
            // 在路肩上 - 轻微减速
            this.physics.state.vx *= 0.995;
        }
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _updateLoading(text) {
        const el = document.getElementById('loading-text');
        if (el) el.textContent = text;
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
    new EngineSimApp();
});
