/**
 * 场景环境模块
 * - 程序化天空盒 (渐变天空+云层)
 * - 太阳光照 + 环境光
 * - 辅助场景元素 (树木、看台、广告牌等)
 * - 雾效
 */
import * as THREE from 'three';

export class SceneEnvironment {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.time = 0;

        this._setupLighting();
        this._setupSkybox();
        this._setupFog();
        this._setupScenery();
    }

    /**
     * 光照设置
     */
    _setupLighting() {
        // 主方向光 (太阳)
        this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.8);
        this.sunLight.position.set(50, 80, -30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 250;
        this.sunLight.shadow.camera.left = -120;
        this.sunLight.shadow.camera.right = 120;
        this.sunLight.shadow.camera.top = 120;
        this.sunLight.shadow.camera.bottom = -120;
        this.sunLight.shadow.bias = -0.001;
        this.scene.add(this.sunLight);

        // 环境光 (天空散射)
        const ambientLight = new THREE.AmbientLight(0x87ceeb, 0.4);
        this.scene.add(ambientLight);

        // 半球光 (天空/地面颜色过渡)
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d7a3d, 0.5);
        this.scene.add(hemiLight);

        // 补光 (防止阴影过暗)
        const fillLight = new THREE.DirectionalLight(0xffeedd, 0.3);
        fillLight.position.set(-30, 20, 50);
        this.scene.add(fillLight);
    }

    /**
     * 程序化天空盒
     */
    _setupSkybox() {
        // 使用大型球体作为天空穹顶
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0055aa) },
                midColor: { value: new THREE.Color(0x88bbee) },
                bottomColor: { value: new THREE.Color(0xddeeff) },
                sunPosition: { value: new THREE.Vector3(50, 80, -30) },
                sunColor: { value: new THREE.Color(0xffffcc) },
                offset: { value: 20 },
                exponent: { value: 0.5 },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 bottomColor;
                uniform vec3 sunPosition;
                uniform vec3 sunColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 dir = normalize(vWorldPosition);
                    float h = dir.y;

                    // 天空渐变
                    vec3 color;
                    if (h > 0.0) {
                        float t = pow(h, exponent);
                        color = mix(midColor, topColor, t);
                    } else {
                        color = mix(midColor, bottomColor, -h * 2.0);
                    }

                    // 太阳光晕
                    vec3 sunDir = normalize(sunPosition);
                    float sunDot = max(dot(dir, sunDir), 0.0);
                    float sunDisc = pow(sunDot, 800.0) * 2.0;
                    float sunGlow = pow(sunDot, 8.0) * 0.4;
                    color += sunColor * (sunDisc + sunGlow);

                    // 地平线附近的暖色
                    float horizonGlow = pow(1.0 - abs(h), 8.0) * 0.3;
                    color += vec3(1.0, 0.8, 0.5) * horizonGlow;

                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.name = 'sky';
        this.scene.add(sky);

        // 云层 (简单的平面粒子)
        this._createClouds();
    }

    /**
     * 简单云层
     */
    _createClouds() {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
        });

        for (let i = 0; i < 20; i++) {
            const size = 20 + Math.random() * 40;
            const cloudGeo = new THREE.PlaneGeometry(size, size * 0.4);
            const cloud = new THREE.Mesh(cloudGeo, cloudMat.clone());
            cloud.material.opacity = 0.3 + Math.random() * 0.3;

            const angle = Math.random() * Math.PI * 2;
            const radius = 100 + Math.random() * 200;
            cloud.position.set(
                Math.cos(angle) * radius,
                60 + Math.random() * 40,
                Math.sin(angle) * radius
            );
            cloud.rotation.x = -Math.PI / 2;
            cloud.rotation.z = Math.random() * Math.PI;
            cloudGroup.add(cloud);
        }

        cloudGroup.name = 'clouds';
        this.scene.add(cloudGroup);
        this.clouds = cloudGroup;
    }

    /**
     * 雾效
     */
    _setupFog() {
        this.scene.fog = new THREE.FogExp2(0xaaccee, 0.002);
    }

    /**
     * 场景装饰元素
     */
    _setupScenery() {
        this._createTrees();
        this._createGrandstand();
        this._createLightPoles();
        this._createTireStacks();
    }

    /**
     * Low-poly树木
     */
    _createTrees() {
        const treePositions = [];
        // 在赛道外围随机放置树木
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 110 + Math.random() * 60;
            treePositions.push({
                x: Math.cos(angle) * radius,
                z: Math.sin(angle) * radius,
                scale: 0.8 + Math.random() * 0.6,
            });
        }

        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x5c3d1e,
            roughness: 0.9,
            flatShading: true,
        });
        const leafMat = new THREE.MeshStandardMaterial({
            color: 0x2d6b2d,
            roughness: 0.8,
            flatShading: true,
        });
        const leafMat2 = new THREE.MeshStandardMaterial({
            color: 0x3d8b3d,
            roughness: 0.8,
            flatShading: true,
        });

        for (const tp of treePositions) {
            const tree = new THREE.Group();

            // 树干
            const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 2;
            trunk.castShadow = true;
            tree.add(trunk);

            // 树冠 (多层锥体)
            const mat = Math.random() > 0.5 ? leafMat : leafMat2;
            for (let j = 0; j < 3; j++) {
                const coneGeo = new THREE.ConeGeometry(3 - j * 0.7, 3, 6);
                const cone = new THREE.Mesh(coneGeo, mat);
                cone.position.y = 4.5 + j * 1.8;
                cone.castShadow = true;
                tree.add(cone);
            }

            tree.position.set(tp.x, 0, tp.z);
            tree.scale.setScalar(tp.scale);
            this.scene.add(tree);
        }
    }

    /**
     * 看台
     */
    _createGrandstand() {
        const standGroup = new THREE.Group();
        const concreteMat = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 0.9,
            flatShading: true,
        });
        const seatMat = new THREE.MeshStandardMaterial({
            color: 0x2244aa,
            roughness: 0.7,
            flatShading: true,
        });

        // 看台结构 (阶梯式)
        for (let row = 0; row < 6; row++) {
            const stepGeo = new THREE.BoxGeometry(30, 1, 3);
            const step = new THREE.Mesh(stepGeo, row % 2 === 0 ? concreteMat : seatMat);
            step.position.set(0, row * 1.2 + 0.6, row * 2.5);
            step.castShadow = true;
            step.receiveShadow = true;
            standGroup.add(step);
        }

        // 顶棚
        const roofGeo = new THREE.BoxGeometry(32, 0.3, 18);
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5,
            metalness: 0.5,
            flatShading: true,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(0, 9, 7);
        roof.castShadow = true;
        standGroup.add(roof);

        // 支撑柱
        for (const x of [-14, 0, 14]) {
            const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 9, 6);
            const pillar = new THREE.Mesh(pillarGeo, concreteMat);
            pillar.position.set(x, 4.5, 14);
            standGroup.add(pillar);
        }

        standGroup.position.set(0, 0, -105);
        this.scene.add(standGroup);
    }

    /**
     * 路灯/照明灯
     */
    _createLightPoles() {
        const poleMat = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.5,
            metalness: 0.7,
            flatShading: true,
        });

        const positions = [
            { x: -50, z: -90 }, { x: 50, z: -90 },
            { x: -105, z: 0 }, { x: 105, z: 0 },
            { x: -50, z: 85 }, { x: 50, z: 85 },
        ];

        for (const pos of positions) {
            const pole = new THREE.Group();

            // 灯柱
            const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 12, 6);
            const poleMesh = new THREE.Mesh(poleGeo, poleMat);
            poleMesh.position.y = 6;
            poleMesh.castShadow = true;
            pole.add(poleMesh);

            // 灯头
            const headGeo = new THREE.BoxGeometry(1.5, 0.3, 0.8);
            const headMat = new THREE.MeshStandardMaterial({
                color: 0xffffee,
                emissive: 0xffffaa,
                emissiveIntensity: 0.3,
                flatShading: true,
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 12;
            pole.add(head);

            pole.position.set(pos.x, 0, pos.z);
            this.scene.add(pole);
        }
    }

    /**
     * 轮胎堆 (赛道边装饰)
     */
    _createTireStacks() {
        const tireMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.95,
            flatShading: true,
        });

        const stackPositions = [
            { x: 95, z: -50 }, { x: -95, z: 30 },
            { x: 60, z: 55 }, { x: -70, z: -65 },
        ];

        for (const sp of stackPositions) {
            const stack = new THREE.Group();
            // 3-4层轮胎
            for (let layer = 0; layer < 3 + Math.floor(Math.random() * 2); layer++) {
                const count = 3 - layer;
                for (let i = 0; i < count; i++) {
                    const tireGeo = new THREE.TorusGeometry(0.4, 0.2, 6, 8);
                    const tire = new THREE.Mesh(tireGeo, tireMat);
                    tire.position.set(
                        (i - (count - 1) / 2) * 0.9,
                        layer * 0.45 + 0.3,
                        0
                    );
                    tire.rotation.x = Math.PI / 2;
                    tire.castShadow = true;
                    stack.add(tire);
                }
            }
            stack.position.set(sp.x, 0, sp.z);
            stack.rotation.y = Math.random() * Math.PI;
            this.scene.add(stack);
        }
    }

    /**
     * 每帧更新 (云层漂移等)
     */
    update(dt) {
        this.time += dt;

        // 云层缓慢漂移
        if (this.clouds) {
            this.clouds.rotation.y += dt * 0.002;
        }
    }

    /**
     * 更新阴影相机跟随车辆
     */
    updateShadowCamera(targetX, targetZ) {
        this.sunLight.position.set(targetX + 50, 80, targetZ - 30);
        this.sunLight.target.position.set(targetX, 0, targetZ);
        this.sunLight.target.updateMatrixWorld();
    }
}
