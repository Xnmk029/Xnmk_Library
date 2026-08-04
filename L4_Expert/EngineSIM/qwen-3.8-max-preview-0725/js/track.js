/**
 * 赛道生成模块
 * - 程序化柏油路面贴图
 * - 双色路肩 (红白/蓝白)
 * - 赛道标线
 * - 起跑线
 */
import * as THREE from 'three';

export class TrackGenerator {
    constructor(scene) {
        this.scene = scene;
        this.trackGroup = new THREE.Group();
        this.trackGroup.name = 'track';
        scene.add(this.trackGroup);

        // 赛道参数
        this.roadWidth = 14;        // 路面宽度 (m)
        this.curbWidth = 1.2;      // 路肩宽度 (m)
        this.segments = 200;        // 赛道细分数
    }

    /**
     * 生成完整赛道
     */
    generate() {
        const centerline = this._createTrackSpline();
        this._buildRoadSurface(centerline);
        this._buildCurbs(centerline);
        this._buildTrackMarkings(centerline);
        this._buildStartLine(centerline);
        this._buildBarriers(centerline);
        this._buildGround();
        return centerline;
    }

    /**
     * 创建赛道中心线样条 (椭圆形带变曲率弯道)
     */
    _createTrackSpline() {
        // 定义赛道控制点 (一个有趣的赛道布局)
        const points = [
            new THREE.Vector3(0, 0, -80),
            new THREE.Vector3(50, 0, -75),
            new THREE.Vector3(85, 0, -50),
            new THREE.Vector3(95, 0, -15),
            new THREE.Vector3(85, 0, 20),
            new THREE.Vector3(60, 0, 45),
            new THREE.Vector3(30, 0, 55),
            new THREE.Vector3(0, 0, 70),
            new THREE.Vector3(-35, 0, 75),
            new THREE.Vector3(-70, 0, 60),
            new THREE.Vector3(-90, 0, 30),
            new THREE.Vector3(-95, 0, -5),
            new THREE.Vector3(-85, 0, -40),
            new THREE.Vector3(-60, 0, -65),
            new THREE.Vector3(-30, 0, -78),
        ];

        const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
        return curve;
    }

    /**
     * 生成柏油路面贴图 (程序化)
     */
    _createAsphaltTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 基础深灰色
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, 512, 512);

        // 添加沥青颗粒纹理
        for (let i = 0; i < 15000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 2 + 0.5;
            const brightness = Math.floor(Math.random() * 40 + 25);
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.fillRect(x, y, size, size);
        }

        // 添加一些裂缝/修补痕迹
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            let x = Math.random() * 512;
            let y = Math.random() * 512;
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += (Math.random() - 0.5) * 60;
                y += (Math.random() - 0.5) * 60;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // 轮胎磨损痕迹 (赛道中央)
        ctx.fillStyle = 'rgba(15, 15, 15, 0.2)';
        ctx.fillRect(180, 0, 40, 512);
        ctx.fillRect(290, 0, 40, 512);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 40);
        return texture;
    }

    /**
     * 构建路面网格
     */
    _buildRoadSurface(curve) {
        const points = curve.getSpacedPoints(this.segments);
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= this.segments; i++) {
            const t = i / this.segments;
            const point = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t);

            // 法线 (水平垂直于切线)
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            const halfW = this.roadWidth / 2;
            const left = point.clone().add(normal.clone().multiplyScalar(-halfW));
            const right = point.clone().add(normal.clone().multiplyScalar(halfW));

            vertices.push(left.x, 0.01, left.z);
            vertices.push(right.x, 0.01, right.z);

            uvs.push(0, t * 20);
            uvs.push(1, t * 20);

            if (i < this.segments) {
                const base = i * 2;
                indices.push(base, base + 1, base + 2);
                indices.push(base + 1, base + 3, base + 2);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            map: this._createAsphaltTexture(),
            roughness: 0.85,
            metalness: 0.0,
            color: 0x3a3a3a,
        });

        const road = new THREE.Mesh(geometry, material);
        road.receiveShadow = true;
        road.name = 'road-surface';
        this.trackGroup.add(road);
    }

    /**
     * 构建双色路肩 (红白条纹)
     */
    _buildCurbs(curve) {
        const curbTexture = this._createCurbTexture();

        for (const side of [-1, 1]) {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const uvs = [];
            const indices = [];

            for (let i = 0; i <= this.segments; i++) {
                const t = i / this.segments;
                const point = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t);
                const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

                const halfW = this.roadWidth / 2;
                const inner = point.clone().add(
                    normal.clone().multiplyScalar(side * halfW)
                );
                const outer = point.clone().add(
                    normal.clone().multiplyScalar(side * (halfW + this.curbWidth))
                );

                // 路肩略微抬高
                vertices.push(inner.x, 0.02, inner.z);
                vertices.push(outer.x, 0.06, outer.z);

                uvs.push(0, t * 60);
                uvs.push(1, t * 60);

                if (i < this.segments) {
                    const base = i * 2;
                    indices.push(base, base + 1, base + 2);
                    indices.push(base + 1, base + 3, base + 2);
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                map: curbTexture.clone(),
                roughness: 0.7,
                metalness: 0.0,
            });

            const curb = new THREE.Mesh(geometry, material);
            curb.receiveShadow = true;
            curb.name = `curb-${side > 0 ? 'right' : 'left'}`;
            this.trackGroup.add(curb);
        }
    }

    /**
     * 路肩贴图 (红白/蓝白交替)
     */
    _createCurbTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const stripeHeight = 32;
        for (let i = 0; i < 8; i++) {
            // 红白交替 (经典赛道路肩)
            ctx.fillStyle = i % 2 === 0 ? '#cc2222' : '#ffffff';
            ctx.fillRect(0, i * stripeHeight, 64, stripeHeight);
        }

        // 添加磨损
        ctx.fillStyle = 'rgba(80, 80, 80, 0.15)';
        for (let i = 0; i < 200; i++) {
            ctx.fillRect(Math.random() * 64, Math.random() * 256, 3, 3);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    /**
     * 赛道中线/边线标线
     */
    _buildTrackMarkings(curve) {
        // 中心虚线
        const dashLength = 3;
        const gapLength = 4;
        const lineWidth = 0.15;

        const markingGroup = new THREE.Group();
        let distance = 0;
        const totalLength = curve.getLength();

        while (distance < totalLength) {
            const t = distance / totalLength;
            const point = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t);

            const dashGeo = new THREE.PlaneGeometry(lineWidth, dashLength);
            const dashMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.7,
            });
            const dash = new THREE.Mesh(dashGeo, dashMat);
            dash.position.set(point.x, 0.03, point.z);
            dash.rotation.x = -Math.PI / 2;
            dash.rotation.z = Math.atan2(tangent.x, tangent.z);
            markingGroup.add(dash);

            distance += dashLength + gapLength;
        }

        this.trackGroup.add(markingGroup);
    }

    /**
     * 起跑线 (棋盘格)
     */
    _buildStartLine(curve) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const cellSize = 16;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 4; y++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        const point = curve.getPointAt(0);
        const tangent = curve.getTangentAt(0);

        const geo = new THREE.PlaneGeometry(this.roadWidth, 3);
        const mat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.6,
        });
        const startLine = new THREE.Mesh(geo, mat);
        startLine.position.set(point.x, 0.025, point.z);
        startLine.rotation.x = -Math.PI / 2;
        startLine.rotation.z = Math.atan2(tangent.x, tangent.z);
        this.trackGroup.add(startLine);
    }

    /**
     * 赛道护栏/围墙
     */
    _buildBarriers(curve) {
        const barrierOffset = this.roadWidth / 2 + this.curbWidth + 1.5;

        for (const side of [-1, 1]) {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];
            const barrierHeight = 0.8;

            for (let i = 0; i <= this.segments; i++) {
                const t = i / this.segments;
                const point = curve.getPointAt(t);
                const tangent = curve.getTangentAt(t);
                const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

                const pos = point.clone().add(normal.clone().multiplyScalar(side * barrierOffset));

                // 底部和顶部顶点
                vertices.push(pos.x, 0, pos.z);
                vertices.push(pos.x, barrierHeight, pos.z);

                if (i < this.segments) {
                    const base = i * 2;
                    indices.push(base, base + 2, base + 1);
                    indices.push(base + 1, base + 2, base + 3);
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                color: side > 0 ? 0x888888 : 0x999999,
                roughness: 0.9,
                metalness: 0.3,
                side: THREE.DoubleSide,
            });

            const barrier = new THREE.Mesh(geometry, material);
            barrier.castShadow = true;
            barrier.receiveShadow = true;
            this.trackGroup.add(barrier);
        }
    }

    /**
     * 地面 (草地)
     */
    _buildGround() {
        const groundGeo = new THREE.PlaneGeometry(400, 400);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x3d7a3d,
            roughness: 1.0,
            metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.trackGroup.add(ground);
    }

    /**
     * 获取赛道上某点的信息 (用于碰撞/重置)
     */
    getTrackInfo() {
        return {
            roadWidth: this.roadWidth,
            curbWidth: this.curbWidth,
        };
    }
}
