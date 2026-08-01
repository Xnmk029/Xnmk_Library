/**
 * Low-Poly 美式现代肌肉车模型
 * 风格参考: Dodge Challenger / Chevrolet Camaro / Ford Mustang
 * 特征: 长车头、短车尾、宽体、肌肉线条、引擎盖进气口
 */
import * as THREE from 'three';

export class MuscleCar {
    constructor(scene) {
        this.scene = scene;
        this.carGroup = new THREE.Group();
        this.carGroup.name = 'muscle-car';
        scene.add(this.carGroup);

        // 车轮引用 (用于旋转动画)
        this.wheels = [];
        this.frontWheels = [];
        this.exhaustGlow = [];

        this._buildCar();
    }

    _buildCar() {
        const bodyColor = 0x1a1a2e;    // 深蓝色金属漆
        const accentColor = 0xcc0000;   // 红色条纹
        const chromeColor = 0xcccccc;
        const glassColor = 0x1a3a5a;
        const tireColor = 0x1a1a1a;
        const rimColor = 0x888888;

        // === 主车身 (低多边形) ===
        this._buildBody(bodyColor, accentColor);
        // === 座舱/玻璃 ===
        this._buildCabin(glassColor);
        // === 引擎盖进气口 ===
        this._buildHoodScoop(bodyColor);
        // === 前保险杠/格栅 ===
        this._buildFrontEnd(chromeColor);
        // === 后部 (尾灯/扰流板) ===
        this._buildRearEnd(accentColor);
        // === 车轮 ===
        this._buildWheels(tireColor, rimColor);
        // === 排气管 ===
        this._buildExhaust(chromeColor);
        // === 赛车条纹 ===
        this._buildRacingStripes(accentColor);
    }

    _buildBody(color, accent) {
        // 主车身 - 使用多个box组合出肌肉车轮廓
        const bodyMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.3,
            metalness: 0.7,
            flatShading: true,  // Low-poly风格
        });

        // 下部车身 (宽体)
        const lowerBody = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.5, 4.8),
            bodyMat
        );
        lowerBody.position.y = 0.45;
        lowerBody.castShadow = true;
        this.carGroup.add(lowerBody);

        // 上部车身 (略窄, 带倾斜)
        const upperGeo = new THREE.BoxGeometry(1.85, 0.45, 4.4);
        // 修改顶点使其前端略窄 (肌肉车特征)
        const upperBody = new THREE.Mesh(upperGeo, bodyMat);
        upperBody.position.y = 0.85;
        upperBody.position.z = -0.1;
        upperBody.castShadow = true;
        this.carGroup.add(upperBody);

        // 前引擎盖 (长而平坦, 略微倾斜)
        const hoodGeo = new THREE.BoxGeometry(1.8, 0.12, 1.8);
        const hood = new THREE.Mesh(hoodGeo, bodyMat);
        hood.position.set(0, 0.95, -1.3);
        hood.rotation.x = -0.03;
        hood.castShadow = true;
        this.carGroup.add(hood);

        // 后行李箱盖
        const trunkGeo = new THREE.BoxGeometry(1.75, 0.12, 1.2);
        const trunk = new THREE.Mesh(trunkGeo, bodyMat);
        trunk.position.set(0, 0.92, 1.6);
        trunk.rotation.x = 0.02;
        trunk.castShadow = true;
        this.carGroup.add(trunk);

        // 前翼子板隆起 (肌肉车特征)
        for (const side of [-1, 1]) {
            const fenderGeo = new THREE.BoxGeometry(0.25, 0.3, 1.6);
            const fender = new THREE.Mesh(fenderGeo, bodyMat);
            fender.position.set(side * 0.95, 0.6, -1.0);
            fender.castShadow = true;
            this.carGroup.add(fender);
        }

        // 后翼子板 (更宽 - 宽体效果)
        for (const side of [-1, 1]) {
            const rearFenderGeo = new THREE.BoxGeometry(0.3, 0.35, 1.4);
            const rearFender = new THREE.Mesh(rearFenderGeo, bodyMat);
            rearFender.position.set(side * 1.0, 0.58, 1.2);
            rearFender.castShadow = true;
            this.carGroup.add(rearFender);
        }

        // 侧裙
        for (const side of [-1, 1]) {
            const skirtGeo = new THREE.BoxGeometry(0.08, 0.15, 3.8);
            const skirtMat = new THREE.MeshStandardMaterial({
                color: 0x111111, roughness: 0.8, flatShading: true
            });
            const skirt = new THREE.Mesh(skirtGeo, skirtMat);
            skirt.position.set(side * 1.02, 0.22, 0);
            this.carGroup.add(skirt);
        }
    }

    _buildCabin(glassColor) {
        const glassMat = new THREE.MeshStandardMaterial({
            color: glassColor,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.7,
            flatShading: true,
        });

        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            metalness: 0.3,
            flatShading: true,
        });

        // 挡风玻璃 (倾斜)
        const windshieldGeo = new THREE.BoxGeometry(1.5, 0.55, 0.06);
        const windshield = new THREE.Mesh(windshieldGeo, glassMat);
        windshield.position.set(0, 1.2, -0.55);
        windshield.rotation.x = -0.45;
        this.carGroup.add(windshield);

        // 后窗
        const rearWindowGeo = new THREE.BoxGeometry(1.4, 0.45, 0.06);
        const rearWindow = new THREE.Mesh(rearWindowGeo, glassMat);
        rearWindow.position.set(0, 1.15, 0.85);
        rearWindow.rotation.x = 0.5;
        this.carGroup.add(rearWindow);

        // 侧窗
        for (const side of [-1, 1]) {
            const sideWindowGeo = new THREE.BoxGeometry(0.05, 0.35, 1.1);
            const sideWindow = new THREE.Mesh(sideWindowGeo, glassMat);
            sideWindow.position.set(side * 0.9, 1.15, 0.1);
            this.carGroup.add(sideWindow);
        }

        // 车顶
        const roofGeo = new THREE.BoxGeometry(1.6, 0.08, 1.4);
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.3,
            metalness: 0.7,
            flatShading: true,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 1.38, 0.1);
        roof.castShadow = true;
        this.carGroup.add(roof);

        // A柱/C柱
        for (const side of [-1, 1]) {
            const pillarGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
            // A柱
            const aPillar = new THREE.Mesh(pillarGeo, frameMat);
            aPillar.position.set(side * 0.82, 1.15, -0.5);
            aPillar.rotation.x = -0.4;
            this.carGroup.add(aPillar);
            // C柱
            const cPillar = new THREE.Mesh(pillarGeo, frameMat);
            cPillar.position.set(side * 0.78, 1.12, 0.75);
            cPillar.rotation.x = 0.45;
            this.carGroup.add(cPillar);
        }
    }

    _buildHoodScoop(color) {
        // 引擎盖进气口 (Shaker Hood风格)
        const scoopMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.6,
            metalness: 0.4,
            flatShading: true,
        });

        const scoopGeo = new THREE.BoxGeometry(0.5, 0.15, 0.6);
        const scoop = new THREE.Mesh(scoopGeo, scoopMat);
        scoop.position.set(0, 1.05, -1.2);
        scoop.castShadow = true;
        this.carGroup.add(scoop);

        // 进气口开口
        const openingGeo = new THREE.BoxGeometry(0.4, 0.1, 0.08);
        const openingMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const opening = new THREE.Mesh(openingGeo, openingMat);
        opening.position.set(0, 1.05, -0.92);
        this.carGroup.add(opening);
    }

    _buildFrontEnd(chromeColor) {
        const chromeMat = new THREE.MeshStandardMaterial({
            color: chromeColor,
            roughness: 0.2,
            metalness: 0.9,
            flatShading: true,
        });

        // 前格栅 (肌肉车标志性大嘴)
        const grilleGeo = new THREE.BoxGeometry(1.4, 0.3, 0.08);
        const grilleMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.8,
            metalness: 0.2,
            flatShading: true,
        });
        const grille = new THREE.Mesh(grilleGeo, grilleMat);
        grille.position.set(0, 0.5, -2.42);
        this.carGroup.add(grille);

        // 格栅镀铬边框
        const grilleFrame = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.35, 0.05),
            chromeMat
        );
        grilleFrame.position.set(0, 0.5, -2.44);
        this.carGroup.add(grilleFrame);

        // 前大灯 (方形 - 现代肌肉车风格)
        for (const side of [-1, 1]) {
            const headlightGeo = new THREE.BoxGeometry(0.35, 0.15, 0.06);
            const headlightMat = new THREE.MeshStandardMaterial({
                color: 0xffffee,
                emissive: 0xffffcc,
                emissiveIntensity: 0.5,
                roughness: 0.1,
                flatShading: true,
            });
            const headlight = new THREE.Mesh(headlightGeo, headlightMat);
            headlight.position.set(side * 0.7, 0.6, -2.42);
            this.carGroup.add(headlight);
        }

        // 前保险杠
        const bumperGeo = new THREE.BoxGeometry(2.0, 0.2, 0.15);
        const bumperMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.7,
            flatShading: true,
        });
        const bumper = new THREE.Mesh(bumperGeo, bumperMat);
        bumper.position.set(0, 0.3, -2.4);
        this.carGroup.add(bumper);

        // 前 splitter
        const splitterGeo = new THREE.BoxGeometry(1.8, 0.04, 0.3);
        const splitter = new THREE.Mesh(splitterGeo, bumperMat);
        splitter.position.set(0, 0.18, -2.5);
        this.carGroup.add(splitter);
    }

    _buildRearEnd(accentColor) {
        // 尾灯 (贯穿式 - 现代肌肉车)
        const tailMat = new THREE.MeshStandardMaterial({
            color: 0xcc0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            flatShading: true,
        });

        const tailGeo = new THREE.BoxGeometry(1.6, 0.12, 0.06);
        const taillight = new THREE.Mesh(tailGeo, tailMat);
        taillight.position.set(0, 0.7, 2.42);
        this.carGroup.add(taillight);

        // 后扰流板 (鸭尾式)
        const spoilerMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.3,
            metalness: 0.7,
            flatShading: true,
        });
        const spoilerGeo = new THREE.BoxGeometry(1.7, 0.06, 0.35);
        const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
        spoiler.position.set(0, 1.0, 2.2);
        spoiler.rotation.x = -0.08;
        spoiler.castShadow = true;
        this.carGroup.add(spoiler);

        // 后保险杠
        const rearBumperGeo = new THREE.BoxGeometry(2.0, 0.2, 0.12);
        const rearBumperMat = new THREE.MeshStandardMaterial({
            color: 0x222222, roughness: 0.7, flatShading: true
        });
        const rearBumper = new THREE.Mesh(rearBumperGeo, rearBumperMat);
        rearBumper.position.set(0, 0.3, 2.4);
        this.carGroup.add(rearBumper);

        // 后扩散器
        const diffuserGeo = new THREE.BoxGeometry(1.4, 0.12, 0.2);
        const diffuserMat = new THREE.MeshStandardMaterial({
            color: 0x111111, roughness: 0.9, flatShading: true
        });
        const diffuser = new THREE.Mesh(diffuserGeo, diffuserMat);
        diffuser.position.set(0, 0.18, 2.45);
        this.carGroup.add(diffuser);
    }

    _buildWheels(tireColor, rimColor) {
        const wheelPositions = [
            { x: -0.85, y: 0.34, z: -1.4, front: true },   // FL
            { x: 0.85, y: 0.34, z: -1.4, front: true },    // FR
            { x: -0.9, y: 0.34, z: 1.3, front: false },    // RL
            { x: 0.9, y: 0.34, z: 1.3, front: false },     // RR
        ];

        for (const wp of wheelPositions) {
            const wheelGroup = new THREE.Group();

            // 轮胎 (低多边形圆柱)
            const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12);
            const tireMat = new THREE.MeshStandardMaterial({
                color: tireColor,
                roughness: 0.9,
                metalness: 0.0,
                flatShading: true,
            });
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            wheelGroup.add(tire);

            // 轮毂 (五辐式)
            const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 5);
            const rimMat = new THREE.MeshStandardMaterial({
                color: rimColor,
                roughness: 0.3,
                metalness: 0.8,
                flatShading: true,
            });
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.z = Math.PI / 2;
            wheelGroup.add(rim);

            // 刹车盘
            const brakeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 8);
            const brakeMat = new THREE.MeshStandardMaterial({
                color: 0x444444,
                roughness: 0.5,
                metalness: 0.6,
                flatShading: true,
            });
            const brake = new THREE.Mesh(brakeGeo, brakeMat);
            brake.rotation.z = Math.PI / 2;
            wheelGroup.add(brake);

            wheelGroup.position.set(wp.x, wp.y, wp.z);
            this.carGroup.add(wheelGroup);
            this.wheels.push(wheelGroup);
            if (wp.front) this.frontWheels.push(wheelGroup);
        }
    }

    _buildExhaust(chromeColor) {
        // 双出排气 (每侧两根 - 共四出)
        const exhaustMat = new THREE.MeshStandardMaterial({
            color: chromeColor,
            roughness: 0.2,
            metalness: 0.9,
            flatShading: true,
        });

        for (const side of [-0.4, 0.4]) {
            for (const offset of [-0.12, 0.12]) {
                const pipeGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.25, 8);
                const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
                pipe.rotation.x = Math.PI / 2;
                pipe.position.set(side + offset, 0.22, 2.55);
                this.carGroup.add(pipe);

                // 排气口发光 (引擎运行时)
                const glowGeo = new THREE.CircleGeometry(0.04, 8);
                const glowMat = new THREE.MeshBasicMaterial({
                    color: 0xff4400,
                    transparent: true,
                    opacity: 0,
                });
                const glow = new THREE.Mesh(glowGeo, glowMat);
                glow.position.set(side + offset, 0.22, 2.68);
                this.carGroup.add(glow);
                this.exhaustGlow.push(glow);
            }
        }
    }

    _buildRacingStripes(accentColor) {
        // 双赛车条纹 (引擎盖+车顶+行李箱)
        const stripeMat = new THREE.MeshStandardMaterial({
            color: accentColor,
            roughness: 0.4,
            metalness: 0.5,
            flatShading: true,
        });

        for (const offset of [-0.2, 0.2]) {
            // 引擎盖条纹
            const hoodStripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.01, 1.8),
                stripeMat
            );
            hoodStripe.position.set(offset, 1.02, -1.3);
            this.carGroup.add(hoodStripe);

            // 车顶条纹
            const roofStripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.01, 1.4),
                stripeMat
            );
            roofStripe.position.set(offset, 1.43, 0.1);
            this.carGroup.add(roofStripe);

            // 行李箱条纹
            const trunkStripe = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.01, 1.2),
                stripeMat
            );
            trunkStripe.position.set(offset, 0.99, 1.6);
            this.carGroup.add(trunkStripe);
        }
    }

    /**
     * 更新车辆位置和动画
     */
    update(physicsState) {
        const { x, y, heading, vx, steering, rpm, throttle } = physicsState;

        // 位置更新 (Three.js坐标系: x右, y上, z前→后)
        this.carGroup.position.set(x, 0, y);
        this.carGroup.rotation.y = -heading + Math.PI / 2;

        // 车轮旋转
        const wheelRotation = vx * 0.1; // 简化
        for (const wheel of this.wheels) {
            wheel.children[0].rotation.x += wheelRotation;
            wheel.children[1].rotation.x += wheelRotation;
        }

        // 前轮转向
        for (const fw of this.frontWheels) {
            fw.rotation.y = steering;
        }

        // 排气发光 (高油门高转速)
        const exhaustIntensity = Math.max(0, (rpm - 3000) / 4200) * throttle;
        for (const glow of this.exhaustGlow) {
            glow.material.opacity = exhaustIntensity * 0.8;
        }

        // 车身侧倾 (视觉反馈)
        const lateralG = physicsState.yawRate * vx * 0.01;
        this.carGroup.rotation.z = -lateralG * 0.5;

        // 加速/制动俯仰
        const pitch = (throttle * 0.01 - physicsState.brake * 0.015);
        this.carGroup.rotation.x = pitch;
    }

    /**
     * 获取车辆前方位置 (用于摄像机)
     */
    getForwardVector() {
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.carGroup.quaternion);
        return forward;
    }
}
