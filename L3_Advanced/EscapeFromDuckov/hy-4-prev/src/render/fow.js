// 视线迷雾（文档 §3.1）：正交俯视下"世界空间 ≈ 屏幕空间"，
// 所以一张贴在头顶的蒙版 plane 就等价于全屏后期，且天然随相机缩放、无需重建世界坐标。
// 盲区实体不在这里处理 —— 由 vision.update() 直接剔除渲染，见 SceneView.updateDynamic。
import * as THREE from 'three';
import { LAYER_WORLD } from './camera.js';
import { RENDER } from '../data/balance.js';

export class FogOfWar {
  constructor(scene, world, opts = {}) {
    this.world = world;
    this.size = opts.size || RENDER.fowCanvasSize;
    this.exploredSize = opts.exploredSize || RENDER.fowExploredSize;
    this.alpha = opts.alpha ?? RENDER.fowAlpha;
    this.uploadHz = RENDER.fowUploadHz;
    this.enabled = true;

    // 动态视野层：整张地图，玩家移动时才重绘（配合哈希门控，站着不动零上传）
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    // 已探索层：低分辨率、世界空间、持久累积
    this.expCanvas = document.createElement('canvas');
    this.expCanvas.width = this.expCanvas.height = this.exploredSize;
    this.expCtx = this.expCanvas.getContext('2d');
    this.expCtx.clearRect(0, 0, this.exploredSize, this.exploredSize);

    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;

    const geo = new THREE.PlaneGeometry(world.w, world.h);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      map: this.tex, transparent: true, depthTest: false, depthWrite: false,
    });
    this.plane = new THREE.Mesh(geo, this.mat);
    this.plane.position.set(world.minX + world.w / 2, 7.2, world.minZ + world.h / 2);
    this.plane.renderOrder = 900;
    this.plane.frustumCulled = false;
    this.plane.layers.set(LAYER_WORLD);
    this.plane.name = 'fow';
    scene.add(this.plane);

    this._lastHash = -1;
    this._acc = 0;
    this._dirty = true;
    this.redraws = 0;
    this.redraw(0, 0, null, 0, 1);
  }

  /**
   * 世界坐标 → 贴图像素。
   * 方向推导：PlaneGeometry 的 uv.y=0 在局部 y=-h/2，rotateX(-90°) 后落在世界 z 最大侧；
   * 而 three 的 flipY 让 uv.y=0 采样到画布最后一行。两者抵消后 —— 画布 y 随世界 z 递增。
   * （第一版把这里写反了，结果视野孔被镜像到地图另一侧，整个画面都是雾。）
   */
  _u(x) { return ((x - this.world.minX) / this.world.w) * this.size; }
  _v(z) { return ((z - this.world.minZ) / this.world.h) * this.size; }
  /** 世界坐标 → 探索层像素 */
  _eu(x) { return ((x - this.world.minX) / this.world.w) * this.exploredSize; }
  _ev(z) { return ((z - this.world.minZ) / this.world.h) * this.exploredSize; }

  /** 每帧调用：内部按 上传频率 + 多边形指纹 双闸门决定是否重绘 */
  update(px, pz, poly, polyCount, range, hash, dt) {
    if (!this.enabled) return;
    this._acc += dt;
    const due = this._acc >= 1 / this.uploadHz;
    if (!due || (hash === this._lastHash && !this._dirty)) return;
    this._acc = 0;
    this._lastHash = hash;
    this._dirty = false;
    this.redraw(px, pz, poly, polyCount, range);
  }

  redraw(px, pz, poly, polyCount, range) {
    const S = this.size, c = this.ctx;
    this.redraws++;

    // 1) 铺满阴影蒙版
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, S, S);
    c.fillStyle = `rgba(7,10,16,${this.alpha})`;
    c.fillRect(0, 0, S, S);

    // 2) 已探索区域减淡（不再全黑，但依然看不清细节）
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 0.62;
    c.drawImage(this.expCanvas, 0, 0, S, S);
    c.globalAlpha = 1;

    if (poly && polyCount > 2) {
      // 3) 当前视野整个抠掉：三层递减缩放做出柔化半影
      const cx = this._u(px), cy = this._v(pz);
      const rp = (range / this.world.w) * S;
      for (let layer = 0; layer < 3; layer++) {
        const k = 1 - layer * 0.045;
        c.globalAlpha = layer === 0 ? 1 : layer === 1 ? 0.5 : 0.22;
        c.beginPath();
        for (let i = 0; i < polyCount; i++) {
          const ux = this._u(poly[i * 2]), uz = this._v(poly[i * 2 + 1]);
          const x = cx + (ux - cx) * k, y = cy + (uz - cy) * k;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath();
        c.fillStyle = '#fff';
        c.fill();
      }
      // 4) 视距边缘做径向淡出，避免"视野尽头是一堵硬边"
      c.globalAlpha = 1;
      c.save();
      c.beginPath();
      for (let i = 0; i < polyCount; i++) {
        const x = this._u(poly[i * 2]), y = this._v(poly[i * 2 + 1]);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.clip();
      const g = c.createRadialGradient(cx, cy, rp * 0.55, cx, cy, rp);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.55)');
      c.fillStyle = g;
      c.fillRect(cx - rp, cy - rp, rp * 2, rp * 2);
      c.restore();

      // 5) 把本次视野累积进"已探索"记忆层
      const e = this.expCtx;
      e.globalCompositeOperation = 'source-over';
      e.globalAlpha = 0.55;
      e.fillStyle = '#fff';
      e.beginPath();
      for (let i = 0; i < polyCount; i++) {
        const x = this._eu(poly[i * 2]), y = this._ev(poly[i * 2 + 1]);
        if (i === 0) e.moveTo(x, y); else e.lineTo(x, y);
      }
      e.closePath();
      e.fill();
      e.globalAlpha = 1;
    }

    c.globalCompositeOperation = 'source-over';
    this.tex.needsUpdate = true;
  }

  setEnabled(on) { this.enabled = on; this.plane.visible = on; }

  dispose() {
    this.plane.parent?.remove(this.plane);
    this.plane.geometry.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}
