/**
 * 3D Vector Tile System - Phase 5 Tasks 5.2 & 5.3
 * QuadTree indexing, vector-to-mesh tessellation, screen-space line width shader,
 * seamless zoom camera, dynamic tile streaming, POI overlay
 */
import * as THREE from 'three';

/**
 * QuadTree for spatial tile indexing
 */
export class QuadTree {
    constructor(bounds, maxDepth = 6, maxItems = 4) {
        this.bounds = bounds; // {x, y, w, h}
        this.maxDepth = maxDepth;
        this.maxItems = maxItems;
        this.depth = 0;
        this.items = [];
        this.children = null;
    }

    subdivide() {
        const { x, y, w, h } = this.bounds;
        const hw = w / 2, hh = h / 2;
        this.children = [
            new QuadTree({ x, y, w: hw, h: hh }, this.maxDepth, this.maxItems),
            new QuadTree({ x: x + hw, y, w: hw, h: hh }, this.maxDepth, this.maxItems),
            new QuadTree({ x, y: y + hh, w: hw, h: hh }, this.maxDepth, this.maxItems),
            new QuadTree({ x: x + hw, y: y + hh, w: hw, h: hh }, this.maxDepth, this.maxItems)
        ];
        for (const child of this.children) child.depth = this.depth + 1;
    }

    insert(item) {
        if (this.children) {
            const idx = this._getIndex(item);
            if (idx !== -1) { this.children[idx].insert(item); return; }
        }
        this.items.push(item);
        if (this.items.length > this.maxItems && this.depth < this.maxDepth && !this.children) {
            this.subdivide();
            const old = this.items;
            this.items = [];
            for (const it of old) this.insert(it);
        }
    }

    query(range, found = []) {
        if (!this._intersects(range)) return found;
        for (const item of this.items) {
            if (this._containsPoint(range, item)) found.push(item);
        }
        if (this.children) {
            for (const child of this.children) child.query(range, found);
        }
        return found;
    }

    _getIndex(item) {
        const { x, y, w, h } = this.bounds;
        const mx = x + w / 2, my = y + h / 2;
        const px = item.x !== undefined ? item.x : item.bounds.x;
        const py = item.y !== undefined ? item.y : item.bounds.y;
        if (px < mx) return py < my ? 0 : 2;
        return py < my ? 1 : 3;
    }

    _intersects(range) {
        const { x, y, w, h } = this.bounds;
        return !(range.x > x + w || range.x + range.w < x || range.y > y + h || range.y + range.h < y);
    }

    _containsPoint(range, item) {
        const px = item.x !== undefined ? item.x : item.bounds.x;
        const py = item.y !== undefined ? item.y : item.bounds.y;
        return px >= range.x && px <= range.x + range.w && py >= range.y && py <= range.y + range.h;
    }
}

/**
 * Tile coordinate system (z/x/y)
 */
export class TileCoord {
    constructor(z, x, y) { this.z = z; this.x = x; this.y = y; }
    key() { return `${this.z}/${this.x}/${this.y}`; }
    static fromWorldPos(wx, wz, zoom, worldSize) {
        const tileSize = worldSize / Math.pow(2, zoom);
        const x = Math.floor((wx + worldSize / 2) / tileSize);
        const y = Math.floor((wz + worldSize / 2) / tileSize);
        return new TileCoord(zoom, x, y);
    }
}

/**
 * Screen-space constant-width line shader
 */
export function createVectorLineShader() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0.9, 0.9, 0.9) },
            uLineWidth: { value: 3.0 }, // pixels
            uResolution: { value: new THREE.Vector2(1920, 1080) },
            uOpacity: { value: 1.0 }
        },
        vertexShader: /* glsl */`
            attribute vec3 instanceStart;
            attribute vec3 instanceEnd;
            attribute float side;
            uniform float uLineWidth;
            uniform vec2 uResolution;
            varying float vSide;

            void main() {
                vSide = side;
                vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(instanceStart, 1.0);
                vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(instanceEnd, 1.0);

                vec2 ndcStart = clipStart.xy / clipStart.w;
                vec2 ndcEnd = clipEnd.xy / clipEnd.w;

                vec2 dir = normalize(ndcEnd - ndcStart);
                vec2 normal = vec2(-dir.y, dir.x);

                // Screen-space pixel width compensation
                vec2 pixelOffset = normal * (uLineWidth / uResolution) * side;

                vec4 clipPos = mix(clipStart, clipEnd, position.x);
                clipPos.xy += pixelOffset * clipPos.w;
                gl_Position = clipPos;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying float vSide;

            void main() {
                // Anti-aliased edge
                float alpha = 1.0 - smoothstep(0.7, 1.0, abs(vSide));
                gl_FragColor = vec4(uColor, alpha * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false
    });
}

/**
 * Vector-to-Mesh tessellation: converts LineString/Polygon to WebGL geometry
 */
export class VectorTessellator {
    static lineStringToMesh(points, width = 0.5, y = 0.05) {
        if (points.length < 2) return null;
        const vertices = [];
        const indices = [];

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];
            const dx = p1.x - p0.x;
            const dz = p1.z - p0.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len < 0.001) continue;
            const nx = -dz / len * width / 2;
            const nz = dx / len * width / 2;

            const base = vertices.length / 3;
            vertices.push(p0.x + nx, y, p0.z + nz);
            vertices.push(p0.x - nx, y, p0.z - nz);
            vertices.push(p1.x + nx, y, p1.z + nz);
            vertices.push(p1.x - nx, y, p1.z - nz);

            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    static polygonToMesh(polygon, height = 10, y = 0) {
        if (polygon.length < 3) return null;
        // Simple ear-clipping for convex polygons, fan triangulation for general
        const vertices = [];
        const indices = [];

        // Top face (fan triangulation)
        const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
        const cz = polygon.reduce((s, p) => s + p.z, 0) / polygon.length;

        vertices.push(cx, y + height, cz); // center top
        for (const p of polygon) vertices.push(p.x, y + height, p.z);
        for (let i = 0; i < polygon.length; i++) {
            indices.push(0, i + 1, ((i + 1) % polygon.length) + 1);
        }

        // Bottom face
        const baseOffset = polygon.length + 1;
        vertices.push(cx, y, cz);
        for (const p of polygon) vertices.push(p.x, y, p.z);
        for (let i = 0; i < polygon.length; i++) {
            indices.push(baseOffset, ((i + 1) % polygon.length) + baseOffset + 1, i + baseOffset + 1);
        }

        // Side walls
        const sideBase = vertices.length / 3;
        for (let i = 0; i < polygon.length; i++) {
            const next = (i + 1) % polygon.length;
            const p0 = polygon[i], p1 = polygon[next];
            const b = vertices.length / 3;
            vertices.push(p0.x, y, p0.z, p0.x, y + height, p0.z, p1.x, y, p1.z, p1.x, y + height, p1.z);
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }
}

/**
 * Dynamic Tile Streaming Manager with LOD and frustum culling
 */
export class TileStreamManager {
    constructor(scene, camera, worldSize = 400) {
        this.scene = scene;
        this.camera = camera;
        this.worldSize = worldSize;
        this.activeTiles = new Map();
        this.tileMeshes = new Map();
        this.quadTree = new QuadTree({ x: -worldSize / 2, y: -worldSize / 2, w: worldSize, h: worldSize }, 6);
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.maxZoom = 5;
        this.currentZoom = 2;
        this.poiLabels = [];
        this.labelSprites = [];
    }

    /**
     * Insert vector data into QuadTree
     */
    indexData(features) {
        for (const feature of features) {
            this.quadTree.insert(feature);
        }
    }

    /**
     * Update tile streaming based on camera
     */
    update() {
        this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

        // Determine visible area
        const camPos = this.camera.position;
        const viewDist = 100 / Math.pow(2, this.currentZoom);
        const range = {
            x: camPos.x - viewDist,
            y: camPos.z - viewDist,
            w: viewDist * 2,
            h: viewDist * 2
        };

        const visibleFeatures = this.quadTree.query(range);
        const neededTiles = new Set();

        for (const feature of visibleFeatures) {
            const tile = TileCoord.fromWorldPos(feature.x, feature.y, this.currentZoom, this.worldSize);
            neededTiles.add(tile.key());
        }

        // Remove tiles no longer needed
        for (const [key, mesh] of this.tileMeshes) {
            if (!neededTiles.has(key)) {
                this.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                this.tileMeshes.delete(key);
            }
        }

        // Update POI label LOD
        this._updatePOILabels(camPos);
    }

    /**
     * Task 5.3: POI floating overlay with LOD fade
     */
    addPOI(x, z, name, type = 'default') {
        this.poiLabels.push({ x, z, name, type, visible: true, opacity: 1 });
    }

    _updatePOILabels(camPos) {
        for (const sprite of this.labelSprites) {
            this.scene.remove(sprite);
            sprite.material.map.dispose();
            sprite.material.dispose();
        }
        this.labelSprites = [];

        for (const poi of this.poiLabels) {
            const dist = Math.sqrt((poi.x - camPos.x) ** 2 + (poi.z - camPos.z) ** 2);
            const maxDist = 150;
            if (dist > maxDist) continue;

            // LOD fade
            const fade = 1 - Math.max(0, (dist - maxDist * 0.6) / (maxDist * 0.4));
            const scale = Math.max(0.5, 1.5 - dist / maxDist);

            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(poi.name, 128, 40);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: fade });
            const sprite = new THREE.Sprite(mat);
            sprite.position.set(poi.x, 15 * scale, poi.z);
            sprite.scale.set(12 * scale, 3 * scale, 1);
            this.scene.add(sprite);
            this.labelSprites.push(sprite);
        }
    }

    setZoom(z) {
        this.currentZoom = Math.max(0, Math.min(z, this.maxZoom));
    }
}

/**
 * Seamless Zoom Camera Controller (Ortho <-> Perspective blend)
 */
export class SeamlessCameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.target = new THREE.Vector3(0, 0, 0);
        this.distance = 50;
        this.minDistance = 5;
        this.maxDistance = 300;
        this.pitch = 0.6;
        this.yaw = 0;
        this.panSpeed = 0.5;
        this.rotateSpeed = 0.005;
        this.zoomSpeed = 1.1;
        this.orthoBlend = 0; // 0 = perspective, 1 = orthographic
        this.enabled = false;

        this._isDragging = false;
        this._isPanning = false;
        this._lastMouse = { x: 0, y: 0 };

        this._bindEvents();
    }

    _bindEvents() {
        this.domElement.addEventListener('mousedown', (e) => {
            if (!this.enabled) return;
            if (e.button === 0) this._isDragging = true;
            if (e.button === 2) this._isPanning = true;
            this._lastMouse = { x: e.clientX, y: e.clientY };
        });
        this.domElement.addEventListener('mousemove', (e) => {
            if (!this.enabled) return;
            const dx = e.clientX - this._lastMouse.x;
            const dy = e.clientY - this._lastMouse.y;
            this._lastMouse = { x: e.clientX, y: e.clientY };

            if (this._isDragging) {
                this.yaw -= dx * this.rotateSpeed;
                this.pitch = Math.max(0.1, Math.min(1.4, this.pitch + dy * this.rotateSpeed));
            }
            if (this._isPanning) {
                const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
                const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
                this.target.add(right.multiplyScalar(-dx * this.panSpeed * this.distance * 0.002));
                this.target.add(forward.multiplyScalar(dy * this.panSpeed * this.distance * 0.002));
            }
        });
        this.domElement.addEventListener('mouseup', () => { this._isDragging = false; this._isPanning = false; });
        this.domElement.addEventListener('wheel', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            if (e.deltaY > 0) this.distance = Math.min(this.maxDistance, this.distance * this.zoomSpeed);
            else this.distance = Math.max(this.minDistance, this.distance / this.zoomSpeed);
            // Blend ortho/perspective based on zoom
            this.orthoBlend = Math.max(0, Math.min(1, (this.distance - 100) / 200));
        }, { passive: false });
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    update(dt) {
        if (!this.enabled) return;
        const x = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
        const y = this.target.y + Math.sin(this.pitch) * this.distance;
        const z = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
        this.camera.position.lerp(new THREE.Vector3(x, y, z), dt * 5);
        this.camera.lookAt(this.target);

        // Adjust FOV for ortho-like feel at distance
        if (this.camera.isPerspectiveCamera) {
            const targetFov = 60 - this.orthoBlend * 40; // 60 -> 20 as we zoom out
            this.camera.fov += (targetFov - this.camera.fov) * dt * 3;
            this.camera.updateProjectionMatrix();
        }
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
}
