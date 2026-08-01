/**
 * Proving Ground Construction - Phase 3
 * Tasks 3.1, 3.2, 3.3: WebGL environment, procedural test tracks, vehicle control
 */
import * as THREE from 'three';

export class ProvingGround {
    constructor(scene) {
        this.scene = scene;
        this.groundMeshes = [];
        this.zones = {};
        this.waterMesh = null;
        this.waterTime = 0;
    }

    /**
     * Task 3.1: Build HDR lighting environment and skybox
     */
    buildEnvironment(renderer) {
        // Gradient sky
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0055aa) },
                bottomColor: { value: new THREE.Color(0xaaccee) },
                offset: { value: 20 },
                exponent: { value: 0.5 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // HDR-style lighting
        const hemiLight = new THREE.HemisphereLight(0x88aacc, 0x444422, 0.8);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
        sunLight.position.set(50, 80, -30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(2048, 2048);
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -60;
        sunLight.shadow.camera.right = 60;
        sunLight.shadow.camera.top = 60;
        sunLight.shadow.camera.bottom = -60;
        this.scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-30, 20, 40);
        this.scene.add(fillLight);

        // Tone mapping
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    /**
     * Task 3.2: Build complete proving ground with test zones
     */
    build() {
        this._buildBaseGround();
        this._buildSuspensionTestZone();
        this._buildSteeringTestZone();
        this._buildWadingTestZone();
        this._buildBarriers();
        this._buildMarkings();
    }

    _buildBaseGround() {
        // Main asphalt ground plane
        const groundGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x333338,
            roughness: 0.9,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.groundMeshes.push(ground);

        // Grass surrounding
        const grassGeo = new THREE.PlaneGeometry(600, 600);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 1.0 });
        const grass = new THREE.Mesh(grassGeo, grassMat);
        grass.rotation.x = -Math.PI / 2;
        grass.position.y = -0.02;
        grass.receiveShadow = true;
        this.scene.add(grass);
    }

    /**
     * Suspension Test Zone: Belgian Cobblestone + Asymmetric Bumps
     */
    _buildSuspensionTestZone() {
        const zoneGroup = new THREE.Group();
        zoneGroup.position.set(-40, 0, -30);

        // Belgian cobblestone section (procedural bumpy surface)
        const cobbleWidth = 8, cobbleLength = 30;
        const cobbleGeo = new THREE.PlaneGeometry(cobbleWidth, cobbleLength, 40, 150);
        const positions = cobbleGeo.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            // Cobblestone pattern: rounded bumps in grid
            const cx = Math.sin(x * 8) * Math.cos(y * 6) * 0.03;
            const cy = Math.sin(x * 12 + 1.5) * Math.sin(y * 10) * 0.02;
            const noise = (Math.random() - 0.5) * 0.015;
            positions.setZ(i, cx + cy + noise);
        }
        cobbleGeo.computeVertexNormals();
        const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.95, metalness: 0.0 });
        const cobble = new THREE.Mesh(cobbleGeo, cobbleMat);
        cobble.rotation.x = -Math.PI / 2;
        cobble.position.y = 0.01;
        cobble.receiveShadow = true;
        zoneGroup.add(cobble);

        // Asymmetric bumps (speed bumps of varying heights)
        for (let i = 0; i < 6; i++) {
            const bumpH = 0.05 + i * 0.03;
            const bumpGeo = new THREE.BoxGeometry(6, bumpH, 0.6);
            const bumpMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.7 });
            const bump = new THREE.Mesh(bumpGeo, bumpMat);
            bump.position.set(i % 2 === 0 ? -1 : 1, bumpH / 2, -12 + i * 5);
            bump.castShadow = true;
            bump.receiveShadow = true;
            zoneGroup.add(bump);
        }

        // Zone label
        this._addZoneLabel(zoneGroup, 'SUSPENSION TEST', 0, 0.5, -16);
        this.scene.add(zoneGroup);
        this.zones.suspension = zoneGroup;
    }

    /**
     * Steering Test Zone: Slalom + High-banked curve
     */
    _buildSteeringTestZone() {
        const zoneGroup = new THREE.Group();
        zoneGroup.position.set(0, 0, 20);

        // Slalom cones
        for (let i = 0; i < 10; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const coneGeo = new THREE.ConeGeometry(0.15, 0.6, 8);
            const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5 });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(side * 2.5, 0.3, i * 6);
            cone.castShadow = true;
            zoneGroup.add(cone);
        }

        // High-banked curved road
        const curveRadius = 20;
        const bankAngle = 0.35; // ~20 degrees
        const curveSegments = 32;
        const curveShape = new THREE.Shape();
        curveShape.moveTo(-4, 0);
        curveShape.lineTo(4, 0);
        curveShape.lineTo(4, 0.15);
        curveShape.lineTo(-4, 0.15);
        curveShape.closePath();

        const curvePath = new THREE.CatmullRomCurve3([]);
        for (let i = 0; i <= curveSegments; i++) {
            const angle = (i / curveSegments) * Math.PI * 0.75;
            curvePath.points.push(new THREE.Vector3(
                Math.cos(angle) * curveRadius + 40,
                Math.sin(bankAngle) * (i / curveSegments) * 2,
                Math.sin(angle) * curveRadius
            ));
        }

        const bankGeo = new THREE.TubeGeometry(curvePath, 48, 4, 8, false);
        const bankMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.85 });
        const bank = new THREE.Mesh(bankGeo, bankMat);
        bank.scale.y = 0.05;
        bank.receiveShadow = true;
        zoneGroup.add(bank);

        this._addZoneLabel(zoneGroup, 'STEERING TEST', 0, 0.5, -3);
        this.scene.add(zoneGroup);
        this.zones.steering = zoneGroup;
    }

    /**
     * Wading Test Zone: Deep water pool with fluid simulation
     */
    _buildWadingTestZone() {
        const zoneGroup = new THREE.Group();
        zoneGroup.position.set(40, 0, -30);

        // Pool walls
        const poolW = 12, poolL = 20, poolD = 0.8;
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });

        const wallGeo1 = new THREE.BoxGeometry(poolW + 0.4, poolD, 0.2);
        const wall1 = new THREE.Mesh(wallGeo1, wallMat);
        wall1.position.set(0, poolD / 2, -poolL / 2);
        zoneGroup.add(wall1);
        const wall2 = wall1.clone();
        wall2.position.z = poolL / 2;
        zoneGroup.add(wall2);

        const wallGeo2 = new THREE.BoxGeometry(0.2, poolD, poolL);
        const wall3 = new THREE.Mesh(wallGeo2, wallMat);
        wall3.position.set(-poolW / 2, poolD / 2, 0);
        zoneGroup.add(wall3);
        const wall4 = wall3.clone();
        wall4.position.x = poolW / 2;
        zoneGroup.add(wall4);

        // Water surface (animated)
        const waterGeo = new THREE.PlaneGeometry(poolW, poolL, 32, 32);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x1a5577,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.3
        });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.y = poolD * 0.7;
        zoneGroup.add(this.waterMesh);

        // Pool floor
        const floorGeo = new THREE.PlaneGeometry(poolW, poolL);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 1.0 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.01;
        zoneGroup.add(floor);

        this._addZoneLabel(zoneGroup, 'WADING TEST', 0, 1.0, -poolL / 2 - 1);
        this.scene.add(zoneGroup);
        this.zones.wading = zoneGroup;
    }

    _buildBarriers() {
        const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
        const barrierGeo = new THREE.BoxGeometry(0.3, 0.8, 3);

        // Perimeter barriers
        for (let i = 0; i < 20; i++) {
            const b = new THREE.Mesh(barrierGeo, barrierMat);
            b.position.set(-60 + i * 6.3, 0.4, -70);
            b.castShadow = true;
            this.scene.add(b);
            const b2 = b.clone();
            b2.position.z = 70;
            this.scene.add(b2);
        }
    }

    _buildMarkings() {
        // Center line markings
        const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < 30; i++) {
            const markGeo = new THREE.PlaneGeometry(0.15, 2);
            const mark = new THREE.Mesh(markGeo, markMat);
            mark.rotation.x = -Math.PI / 2;
            mark.position.set(0, 0.005, -60 + i * 4);
            this.scene.add(mark);
        }
    }

    _addZoneLabel(parent, text, x, y, z) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 42);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(x, y + 2, z);
        sprite.scale.set(8, 1, 1);
        parent.add(sprite);
    }

    /**
     * Animate water surface
     */
    updateWater(dt) {
        if (!this.waterMesh) return;
        this.waterTime += dt;
        const positions = this.waterMesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const wave = Math.sin(x * 2 + this.waterTime * 3) * 0.02 +
                         Math.cos(y * 1.5 + this.waterTime * 2) * 0.015;
            positions.setZ(i, wave);
        }
        positions.needsUpdate = true;
        this.waterMesh.geometry.computeVertexNormals();
    }

    /**
     * Get water drag and buoyancy for vehicle in wading zone
     */
    getWaterForces(vehiclePos) {
        const zone = this.zones.wading;
        if (!zone) return { drag: 0, buoyancy: 0 };
        const local = vehiclePos.clone().sub(zone.position);
        if (Math.abs(local.x) < 6 && Math.abs(local.z) < 10 && vehiclePos.y < 0.6) {
            const depth = 0.6 - vehiclePos.y;
            return {
                drag: depth * 2.5,
                buoyancy: depth * 1.2
            };
        }
        return { drag: 0, buoyancy: 0 };
    }
}
