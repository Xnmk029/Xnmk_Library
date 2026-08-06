/* 天空：昼夜循环、渐变天穹、太阳/月亮/星光、云层、光照 */
(function () {
  'use strict';
  const { mulberry32 } = window.Noise;

  function smoothstep(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function mix(c1, c2, t) { return c1.clone().lerp(c2, t); }
  function hex(c) { return '#' + c.getHexString(); }

  const DAY_TOP = new THREE.Color(0x6FA8F5), DAY_HOR = new THREE.Color(0xC9E4FA);
  const SET_TOP = new THREE.Color(0x3D4A7D), SET_HOR = new THREE.Color(0xF08A4E);
  const NIGHT_TOP = new THREE.Color(0x0A1124), NIGHT_HOR = new THREE.Color(0x253050);
  const WHITE = new THREE.Color(0xFFFFFF), CLOUD_NIGHT = new THREE.Color(0x2A3452);

  class Sky {
    constructor(scene) {
      this.scene = scene;
      this.hours = 8;

      // 渐变天穹
      const gc = document.createElement('canvas');
      gc.width = 8; gc.height = 256;
      this.gradCanvas = gc;
      this.gradTex = new THREE.CanvasTexture(gc);
      this.gradTex.magFilter = THREE.LinearFilter;
      this.gradTex.minFilter = THREE.LinearFilter;
      this.dome = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16),
        new THREE.MeshBasicMaterial({ map: this.gradTex, side: THREE.BackSide, fog: false, depthWrite: false }));
      this.dome.renderOrder = -10;
      this.dome.frustumCulled = false;
      scene.add(this.dome);

      // 太阳 / 月亮
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFF3C4, fog: false, depthWrite: false, side: THREE.DoubleSide });
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xE9EFF8, fog: false, depthWrite: false, side: THREE.DoubleSide });
      this.sun = new THREE.Mesh(new THREE.CircleGeometry(26, 24), sunMat);
      this.moon = new THREE.Mesh(new THREE.CircleGeometry(15, 24), moonMat);
      scene.add(this.sun); scene.add(this.moon);

      // 光晕
      const g2 = document.createElement('canvas');
      g2.width = g2.height = 64;
      const gg = g2.getContext('2d');
      const gr = gg.createRadialGradient(32, 32, 4, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,244,200,0.9)');
      gr.addColorStop(1, 'rgba(255,244,200,0)');
      gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64);
      const glowTex = new THREE.CanvasTexture(g2);
      this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 }));
      this.glow.scale.set(160, 160, 1);
      this.glow.renderOrder = -5;
      scene.add(this.glow);

      // 星空
      const N = 700;
      const sp = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = Math.random() * 1.45;
        sp[i * 3] = 450 * Math.cos(el) * Math.cos(a);
        sp[i * 3 + 1] = 450 * Math.sin(el);
        sp[i * 3 + 2] = 450 * Math.cos(el) * Math.sin(a);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
        color: 0xFFFFFF, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false
      }));
      this.stars.frustumCulled = false;
      scene.add(this.stars);

      // 云层
      const cc = document.createElement('canvas');
      cc.width = cc.height = 512;
      const cg = cc.getContext('2d');
      const cr = mulberry32(42);
      for (let i = 0; i < 90; i++) {
        const x = cr() * 512, y = cr() * 512;
        const w = 30 + cr() * 70, h = 12 + cr() * 26;
        cg.fillStyle = 'rgba(255,255,255,0.85)';
        cg.beginPath();
        cg.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        cg.fill();
      }
      const ctex = new THREE.CanvasTexture(cc);
      ctex.wrapS = ctex.wrapT = THREE.RepeatWrapping;
      ctex.repeat.set(3, 3);
      this.cloudMat = new THREE.MeshBasicMaterial({ map: ctex, transparent: true, opacity: 0.8, fog: true, depthWrite: false, color: 0xFFFFFF });
      this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), this.cloudMat);
      this.clouds.position.y = 115;
      this.clouds.renderOrder = 2;
      this.clouds.frustumCulled = false;
      scene.add(this.clouds);

      // 光照
      this.hemi = new THREE.HemisphereLight(0xBFD9FF, 0x8A7A5A, 0.5);
      this.sunLight = new THREE.DirectionalLight(0xFFF3D8, 1.0);
      this.moonLight = new THREE.DirectionalLight(0x9FB4E8, 0.3);
      scene.add(this.hemi); scene.add(this.sunLight); scene.add(this.moonLight);

      this.fogColor = new THREE.Color(0xC9E4FA);
      scene.fog = new THREE.Fog(this.fogColor, 40, 150);
      this._last = [-1, -1, -1, -1, -1, -1];
      this._tmp = new THREE.Vector3();
    }

    setTime(h) { this.hours = ((h % 24) + 24) % 24; }

    update(dt) {
      this.hours = (this.hours + dt * 24 / 1200) % 24;
      const t = this.hours / 24;
      const ang = (t - 0.25) * Math.PI * 2;
      const sdx = Math.cos(ang), sdy = Math.sin(ang), sdz = 0.35;
      const sl = Math.hypot(sdx, sdy, sdz);
      const ex = sdx / sl, ey = sdy / sl, ez = sdz / sl;

      const dayF = smoothstep(-0.18, 0.16, ey);
      const nightF = 1 - dayF;
      const tw = Math.max(0, 1 - Math.abs(ey + 0.03) * 3.5);

      const top = mix(mix(DAY_TOP, SET_TOP, tw), NIGHT_TOP, nightF * (1 - tw));
      const hor = mix(mix(DAY_HOR, SET_HOR, tw), NIGHT_HOR, nightF * (1 - tw));

      const rc = [top.r, top.g, top.b, hor.r, hor.g, hor.b].map(v => (v * 255) | 0);
      if (rc.some((v, i) => v !== this._last[i])) {
        this._last = rc;
        const g = this.gradCanvas.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 256);
        const mid = mix(top, hor, 0.45);
        const low = mix(top, hor, 0.85);
        grad.addColorStop(0, hex(top));
        grad.addColorStop(0.4, hex(mid));
        grad.addColorStop(0.75, hex(low));
        grad.addColorStop(1, hex(hor));
        g.fillStyle = grad;
        g.fillRect(0, 0, 8, 256);
        this.gradTex.needsUpdate = true;
        this.fogColor.copy(hor);
        this.scene.fog.color.copy(hor);
      }

      this.stars.material.opacity = nightF * 0.95;
      this.cloudMat.color.copy(mix(WHITE, CLOUD_NIGHT, nightF));

      // 太阳 / 月亮
      this.sun.position.set(ex * 400, ey * 400, ez * 400);
      this.moon.position.set(-ex * 400, -ey * 400, -ez * 400);
      this.sun.visible = ey > -0.12;
      this.moon.visible = -ey > -0.12;
      this.glow.position.copy(this.sun.position);
      this.glow.material.opacity = Math.max(0, Math.min(1, (ey + 0.1) * 3));

      // 光照
      this.sunLight.position.set(ex * 120, ey * 120, ez * 120);
      this.sunLight.intensity = dayF * 1.05 + tw * 0.45;
      this.sunLight.color.copy(mix(new THREE.Color(0xFFF3D8), new THREE.Color(0xFF8A45), tw));
      this.moonLight.position.set(-ex * 40, -ey * 40, -ez * 40);
      this.moonLight.intensity = nightF * 0.2;
      this.hemi.intensity = 0.08 + dayF * 0.55 + tw * 0.1;
      this.hemi.color.copy(mix(new THREE.Color(0xBFD9FF), new THREE.Color(0x16233F), nightF));
      this.hemi.groundColor.copy(mix(new THREE.Color(0x8A7A5A), new THREE.Color(0x0B1020), nightF));

      // 云漂移
      this.clouds.position.x += dt * 1.8;
      if (this.clouds.position.x > 900) this.clouds.position.x -= 1800;
    }
  }

  window.Sky = Sky;
})();
