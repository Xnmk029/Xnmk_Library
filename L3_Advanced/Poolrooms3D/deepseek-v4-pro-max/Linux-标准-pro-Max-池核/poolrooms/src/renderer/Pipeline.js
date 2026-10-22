// Pipeline: the whole frame, hand-rolled for control over the Lumen-ish look.
//
//   1. G-buffer prepass      -> view normal + roughness + albedo + metalness + depth (MRT)
//   2. forward opaque pass   -> HDR colour (IBL from the baked HDRI, sun with soft shadows, caustics)
//   3. copy                  -> opaque colour for water refraction
//   4. water pass            -> drawn into the HDR buffer, depth-tested against the opaque pass
//   5. copy                  -> scene colour with water, source for screen-space lighting
//   6. SSGI/SSR (half res)   -> indirect diffuse + AO + reflections
//   7. volumetric fog (half) -> in-scatter + transmittance with shadow-mapped shafts
//   8. resolve               -> composite indirect, reflections, fog, underwater absorption
//   9. TAA                   -> reprojected accumulation (also denoises 6 and 7)
//  10. bloom                 -> mip chain
//  11. final                 -> ACES tonemap + grade + grain + sRGB, straight to the canvas

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import {
  FS_VERT,
  FS_VERT_GLSL3,
  COPY_FRAG,
  SSGI_FRAG,
  FOG_FRAG,
  RESOLVE_FRAG,
  TAA_FRAG,
  BLOOM_PREFILTER_FRAG,
  BLOOM_DOWN_FRAG,
  BLOOM_UP_FRAG,
  FINAL_FRAG,
} from './PostShaders.js';

// 8-point Halton (2,3) sequence for TAA jitter.
const HALTON = [
  [0.5, 0.333333],
  [0.25, 0.666667],
  [0.75, 0.111111],
  [0.125, 0.444444],
  [0.625, 0.777778],
  [0.375, 0.222222],
  [0.875, 0.555556],
  [0.0625, 0.888889],
].map(([x, y]) => [x - 0.5, y - 0.5]);

const BLOOM_LEVELS = 5;

export class Pipeline {
  constructor({ renderer, scene, camera, cfg, sky, water, streamer }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cfg = cfg;
    this.sky = sky;
    this.water = water;
    this.streamer = streamer;

    this.width = 1;
    this.height = 1;
    this.frame = 0;
    this.historyValid = false;

    this.prevViewProj = new THREE.Matrix4();
    this.curViewProj = new THREE.Matrix4();
    this.invViewProj = new THREE.Matrix4();
    this.baseProjection = new THREE.Matrix4();

    // Live-tunable look knobs (exercised by tools/calibrate.mjs).
    this.giScale = 1.15;
    this.aoStrength = 0.9;
    this.ssrScale = 0.9;
    this.fogSunScale = 0.5;
    this.bloomStrength = 0.11;
    // Debug switches used by the performance probes.
    this.skipPrepass = false;
    this.skipWater = false;
    this.skipResolve = false;

    this.ambient = {
      up: new THREE.Vector3(0.35, 0.45, 0.6),
      horizon: new THREE.Vector3(0.3, 0.36, 0.42),
      down: new THREE.Vector3(0.14, 0.15, 0.16),
    };

    this._makeMaterials();
    this.targets = {};
    this.bloomMips = [];
  }

  // ---- setup -----------------------------------------------------------------------------------

  _makeMaterials() {
    const quad = (frag, uniforms, glsl3 = false) => {
      const mat = glsl3
        ? new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms,
            vertexShader: FS_VERT_GLSL3,
            fragmentShader: frag,
            depthTest: false,
            depthWrite: false,
          })
        : new THREE.ShaderMaterial({
            uniforms,
            vertexShader: FS_VERT,
            fragmentShader: frag,
            depthTest: false,
            depthWrite: false,
          });
      return new FullScreenQuad(mat);
    };

    this.copyQuad = quad(COPY_FRAG, { tSrc: { value: null } });

    this.ssgiQuad = quad(
      SSGI_FRAG,
      {
        tColor: { value: null },
        tNormalRough: { value: null },
        tAlbedoMetal: { value: null },
        tDepth: { value: null },
        uProj: { value: new THREE.Matrix4() },
        uInvProj: { value: new THREE.Matrix4() },
        uViewInv: { value: new THREE.Matrix4() },
        uRes: { value: new THREE.Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 200 },
        uFrame: { value: 0 },
        uRays: { value: 4 },
        uSteps: { value: 10 },
        uSsrSteps: { value: 24 },
        uRadius: { value: 6.0 },
        uAmbUp: { value: new THREE.Vector3() },
        uAmbHorizon: { value: new THREE.Vector3() },
        uAmbDown: { value: new THREE.Vector3() },
        uGiScale: { value: 1.0 },
      },
      true,
    );

    this.fogQuad = quad(FOG_FRAG, {
      tDepth: { value: null },
      tShadow: { value: null },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uInvProj: { value: new THREE.Matrix4() },
      uViewInv: { value: new THREE.Matrix4() },
      uCameraPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Vector3() },
      uAmbUp: { value: new THREE.Vector3() },
      uAmbHorizon: { value: new THREE.Vector3() },
      uAmbDown: { value: new THREE.Vector3() },
      uNear: { value: 0.1 },
      uFar: { value: 200 },
      uTime: { value: 0 },
      uFrame: { value: 0 },
      uSteps: { value: 24 },
      uDensity: { value: 0.02 },
      uHeightFalloff: { value: 0.08 },
      uMistY: { value: 0.2 },
      uAnisotropy: { value: 0.7 },
      uUnderwater: { value: 0 },
      uMaxDist: { value: 110 },
      uRes: { value: new THREE.Vector2() },
    });

    this.resolveQuad = quad(RESOLVE_FRAG, {
      tScene: { value: null },
      tGi: { value: null },
      tSsr: { value: null },
      tFog: { value: null },
      tAlbedoMetal: { value: null },
      tNormalRough: { value: null },
      tDepth: { value: null },
      tDepthAll: { value: null },
      uInvProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2() },
      uHalfRes: { value: new THREE.Vector2() },
      uNear: { value: 0.1 },
      uFar: { value: 200 },
      uTapSpread: { value: 1.7 },
      uAo: { value: 0.85 },
      uGi: { value: 1.0 },
      uSsr: { value: 1.0 },
      uFogOn: { value: 1 },
      uUnderwater: { value: 0 },
      // Clean pool water: ~20 m visibility, red absorbed first (calibrated in tools/calibrate.mjs --plan uw).
      uWaterAbsorb: { value: new THREE.Vector3(0.085, 0.048, 0.042) },
      uWaterScatter: { value: new THREE.Vector3(0.09, 0.2, 0.22) },
      uWaterSurfaceY: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
    });

    this.taaQuad = quad(TAA_FRAG, {
      tCurrent: { value: null },
      tHistory: { value: null },
      tDepth: { value: null },
      uInvViewProj: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2() },
      uBlend: { value: 0.9 },
      uValid: { value: 0 },
    });

    this.bloomPreQuad = quad(BLOOM_PREFILTER_FRAG, {
      tSrc: { value: null },
      uThreshold: { value: 1.05 },
      uSoftKnee: { value: 0.6 },
    });
    this.bloomDownQuad = quad(BLOOM_DOWN_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });
    this.bloomUpQuad = quad(BLOOM_UP_FRAG, {
      tSrc: { value: null },
      tPrev: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1.0 },
    });

    this.finalQuad = quad(FINAL_FRAG, {
      tScene: { value: null },
      tBloom: { value: null },
      uRes: { value: new THREE.Vector2() },
      uExposure: { value: 1.0 },
      uBloom: { value: 0.06 },
      uTime: { value: 0 },
      uUnderwater: { value: 0 },
      uGrain: { value: 0.016 },
      uVignette: { value: 0.34 },
      uCa: { value: 0.0016 },
      uContrast: { value: 1.04 },
      uSaturation: { value: 1.06 },
    });
  }

  setSize(width, height) {
    width = Math.max(2, Math.floor(width));
    height = Math.max(2, Math.floor(height));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.historyValid = false;

    this._disposeTargets();

    const hdr = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: THREE.NoColorSpace,
    };

    const depthTex = () => {
      const t = new THREE.DepthTexture(width, height);
      t.type = THREE.UnsignedIntType;
      t.format = THREE.DepthFormat;
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      return t;
    };

    // G-buffer: two HDR attachments + depth.
    const gRT = new THREE.WebGLRenderTarget(width, height, {
      ...hdr,
      count: 2,
      depthBuffer: true,
      depthTexture: depthTex(),
    });
    gRT.textures[0].name = 'gNormalRough';
    gRT.textures[1].name = 'gAlbedoMetal';

    const hdrRT = new THREE.WebGLRenderTarget(width, height, {
      ...hdr,
      depthBuffer: true,
      depthTexture: depthTex(),
    });

    const halfW = Math.max(2, Math.floor(width * this.cfg.quality.ssgiScale));
    const halfH = Math.max(2, Math.floor(height * this.cfg.quality.ssgiScale));
    const fogW = Math.max(2, Math.floor(width * this.cfg.quality.fogScale));
    const fogH = Math.max(2, Math.floor(height * this.cfg.quality.fogScale));

    this.targets = {
      gRT,
      hdrRT,
      sceneA: new THREE.WebGLRenderTarget(width, height, hdr),
      // Screen-space lighting samples colour at its own (half) resolution: one less full-res blit,
      // and much better cache behaviour inside the ray march.
      colorHalf: new THREE.WebGLRenderTarget(
        Math.max(2, Math.floor(width * this.cfg.quality.ssgiScale)),
        Math.max(2, Math.floor(height * this.cfg.quality.ssgiScale)),
        hdr,
      ),
      ssgi: new THREE.WebGLRenderTarget(halfW, halfH, { ...hdr, count: 2 }),
      fog: new THREE.WebGLRenderTarget(fogW, fogH, hdr),
      taaA: new THREE.WebGLRenderTarget(width, height, hdr),
      taaB: new THREE.WebGLRenderTarget(width, height, hdr),
      bloom: new THREE.WebGLRenderTarget(Math.max(2, width >> 1), Math.max(2, height >> 1), hdr),
    };

    this.bloomMips = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const w = Math.max(2, width >> (i + 1));
      const h = Math.max(2, height >> (i + 1));
      this.bloomMips.push({
        down: new THREE.WebGLRenderTarget(w, h, hdr),
        up: new THREE.WebGLRenderTarget(w, h, hdr),
        w,
        h,
      });
    }

    this.halfSize = new THREE.Vector2(halfW, halfH);
    this.fogSize = new THREE.Vector2(fogW, fogH);
  }

  _disposeTargets() {
    for (const t of Object.values(this.targets || {})) t?.dispose?.();
    for (const m of this.bloomMips) {
      m.down.dispose();
      m.up.dispose();
    }
    this.bloomMips = [];
    this.targets = {};
  }

  /** Rebuild the resolution-dependent targets after a quality change. */
  refreshQuality() {
    const w = this.width;
    const h = this.height;
    this.width = 0;
    this.height = 0;
    this.setSize(w, h);
  }

  // ---- per-frame -------------------------------------------------------------------------------

  _blit(srcTex, dstRT) {
    this.copyQuad.material.uniforms.tSrc.value = srcTex;
    this.renderer.setRenderTarget(dstRT);
    this.copyQuad.render(this.renderer);
  }

  render(dt, elapsed, player) {
    const r = this.renderer;
    const cam = this.camera;
    const cfg = this.cfg;
    const q = cfg.quality;
    const t = this.targets;
    if (!t.gRT) return;

    this.frame++;
    const submerged = player?.submerged ? 1 : 0;

    // ---- camera matrices (+ TAA jitter) --------------------------------------------------------
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    this.baseProjection.copy(cam.projectionMatrix);
    const unjitteredVP = new THREE.Matrix4().multiplyMatrices(this.baseProjection, cam.matrixWorldInverse);

    if (q.taa) {
      const [jx, jy] = HALTON[this.frame % HALTON.length];
      cam.projectionMatrix.elements[8] += (jx * 2) / this.width;
      cam.projectionMatrix.elements[9] += (jy * 2) / this.height;
    }
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this.curViewProj.copy(unjitteredVP);
    this.invViewProj.copy(this.curViewProj).invert();

    // ---- 1. G-buffer prepass ------------------------------------------------------------------
    if (!this.skipPrepass) {
    const prevBg = this.scene.background;
    this.scene.background = null;
    this.streamer.setMaterialMode('gbuf');
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(t.gRT);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(this.scene, cam);
    this.streamer.setMaterialMode('std');
    this.scene.background = prevBg;
    }

    // ---- 2. forward opaque --------------------------------------------------------------------
    r.setRenderTarget(t.hdrRT);
    r.clear(true, true, false);
    r.render(this.scene, cam);

    // ---- 3./4. water (refracts the opaque copy, depth-tested against it) ----------------------
    this._blit(t.hdrRT.texture, t.sceneA);
    this.water.setBuffers(t.sceneA.texture, t.gRT.depthTexture, this.width, this.height);
    this.water.update(elapsed, submerged);
    r.autoClear = false;
    r.setRenderTarget(t.hdrRT);
    r.render(this.water.scene, cam);
    r.autoClear = true;

    // ---- 5. scene colour with water, downsampled for the screen-space passes -------------------
    this._blit(t.hdrRT.texture, t.colorHalf);

    // ---- 6. SSGI / SSR ------------------------------------------------------------------------
    if (q.ssgi || q.ssr) {
      const u = this.ssgiQuad.material.uniforms;
      u.tColor.value = t.colorHalf.texture;
      u.tNormalRough.value = t.gRT.textures[0];
      u.tAlbedoMetal.value = t.gRT.textures[1];
      u.tDepth.value = t.gRT.depthTexture;
      u.uProj.value.copy(cam.projectionMatrix);
      u.uInvProj.value.copy(cam.projectionMatrixInverse);
      u.uViewInv.value.copy(cam.matrixWorld);
      u.uRes.value.copy(this.halfSize);
      u.uNear.value = cam.near;
      u.uFar.value = cam.far;
      u.uFrame.value = this.frame % 64;
      u.uRays.value = q.ssgi ? q.ssgiRays : 0;
      u.uSteps.value = q.ssgiSteps;
      u.uSsrSteps.value = q.ssr ? q.ssrSteps : 0;
      u.uRadius.value = 7.0;
      u.uAmbUp.value.copy(this.ambient.up);
      u.uAmbHorizon.value.copy(this.ambient.horizon);
      u.uAmbDown.value.copy(this.ambient.down);
      u.uGiScale.value = this.giScale;
      r.setRenderTarget(t.ssgi);
      r.clear(true, false, false);
      this.ssgiQuad.render(r);
    }

    // ---- 7. volumetric fog --------------------------------------------------------------------
    if (q.fog) {
      const u = this.fogQuad.material.uniforms;
      const sun = this.sky.sun;
      u.tDepth.value = t.hdrRT.depthTexture;
      u.tShadow.value = sun.shadow.map ? sun.shadow.map.texture : null;
      u.uShadowMatrix.value.copy(sun.shadow.matrix);
      u.uInvProj.value.copy(cam.projectionMatrixInverse);
      u.uViewInv.value.copy(cam.matrixWorld);
      u.uCameraPos.value.copy(cam.position);
      u.uSunDir.value.copy(this.sky.sunDir);
      u.uSunColor.value.set(
        sun.color.r * cfg.sunIntensity * this.fogSunScale,
        sun.color.g * cfg.sunIntensity * this.fogSunScale,
        sun.color.b * cfg.sunIntensity * this.fogSunScale,
      );
      u.uAmbUp.value.copy(this.ambient.up);
      u.uAmbHorizon.value.copy(this.ambient.horizon);
      u.uAmbDown.value.copy(this.ambient.down);
      u.uNear.value = cam.near;
      u.uFar.value = cam.far;
      u.uTime.value = elapsed;
      u.uFrame.value = this.frame % 64;
      u.uSteps.value = q.fogSteps;
      u.uDensity.value = submerged ? cfg.fogDensity * 2.6 : cfg.fogDensity;
      u.uHeightFalloff.value = cfg.fogHeightFalloff;
      u.uMistY.value = submerged ? 40.0 : 0.4;
      u.uAnisotropy.value = cfg.fogAnisotropy;
      u.uUnderwater.value = submerged;
      u.uMaxDist.value = submerged ? 38.0 : 120.0;
      u.uRes.value.copy(this.fogSize);
      r.setRenderTarget(t.fog);
      this.fogQuad.render(r);
    }

    // ---- 8. resolve ---------------------------------------------------------------------------
    {
      const u = this.resolveQuad.material.uniforms;
      u.tScene.value = t.hdrRT.texture;
      u.tGi.value = t.ssgi.textures[0];
      u.tSsr.value = t.ssgi.textures[1];
      u.tFog.value = t.fog.texture;
      u.tAlbedoMetal.value = t.gRT.textures[1];
      u.tNormalRough.value = t.gRT.textures[0];
      u.tDepth.value = t.gRT.depthTexture;
      u.tDepthAll.value = t.hdrRT.depthTexture;
      u.uInvProj.value.copy(cam.projectionMatrixInverse);
      u.uRes.value.set(this.width, this.height);
      u.uHalfRes.value.copy(this.halfSize);
      u.uTapSpread.value = 1.7;
      u.uNear.value = cam.near;
      u.uFar.value = cam.far;
      u.uAo.value = q.ssgi ? this.aoStrength : 0.0;
      u.uGi.value = q.ssgi ? 1.0 : 0.0;
      u.uSsr.value = q.ssr ? this.ssrScale : 0.0;
      u.uFogOn.value = q.fog ? 1 : 0;
      u.uUnderwater.value = submerged;
      u.uWaterSurfaceY.value = player?.waterSurface ?? 0;
      u.uCameraPos.value.copy(cam.position);
      r.setRenderTarget(t.sceneA);
      this.resolveQuad.render(r);
    }

    // ---- 9. TAA -------------------------------------------------------------------------------
    let lit = t.sceneA.texture;
    if (q.taa) {
      const history = this.frame % 2 === 0 ? t.taaA : t.taaB;
      const out = this.frame % 2 === 0 ? t.taaB : t.taaA;
      const u = this.taaQuad.material.uniforms;
      u.tCurrent.value = t.sceneA.texture;
      u.tHistory.value = history.texture;
      u.tDepth.value = t.hdrRT.depthTexture;
      u.uInvViewProj.value.copy(this.invViewProj);
      u.uPrevViewProj.value.copy(this.prevViewProj);
      u.uRes.value.set(this.width, this.height);
      u.uBlend.value = 0.88;
      u.uValid.value = this.historyValid ? 1 : 0;
      r.setRenderTarget(out);
      this.taaQuad.render(r);
      lit = out.texture;
      this.historyValid = true;
    }

    // ---- 10. bloom ----------------------------------------------------------------------------
    if (q.bloom) {
      const pre = this.bloomMips[0];
      this.bloomPreQuad.material.uniforms.tSrc.value = lit;
      r.setRenderTarget(pre.down);
      this.bloomPreQuad.render(r);

      for (let i = 1; i < this.bloomMips.length; i++) {
        const src = this.bloomMips[i - 1];
        const dst = this.bloomMips[i];
        this.bloomDownQuad.material.uniforms.tSrc.value = src.down.texture;
        this.bloomDownQuad.material.uniforms.uTexel.value.set(1 / src.w, 1 / src.h);
        r.setRenderTarget(dst.down);
        this.bloomDownQuad.render(r);
      }

      const last = this.bloomMips.length - 1;
      this._blit(this.bloomMips[last].down.texture, this.bloomMips[last].up);
      for (let i = last - 1; i >= 0; i--) {
        const coarse = this.bloomMips[i + 1];
        const dst = this.bloomMips[i];
        this.bloomUpQuad.material.uniforms.tSrc.value = coarse.up.texture;
        this.bloomUpQuad.material.uniforms.tPrev.value = dst.down.texture;
        this.bloomUpQuad.material.uniforms.uTexel.value.set(1 / dst.w, 1 / dst.h);
        this.bloomUpQuad.material.uniforms.uRadius.value = 1.15;
        r.setRenderTarget(dst.up);
        this.bloomUpQuad.render(r);
      }
    }

    // ---- 11. final ----------------------------------------------------------------------------
    {
      const u = this.finalQuad.material.uniforms;
      u.tScene.value = lit;
      u.tBloom.value = q.bloom ? this.bloomMips[0].up.texture : null;
      u.uRes.value.set(this.width, this.height);
      // Eyes/cameras adapt when you go under: lift exposure so the pool interior reads.
      u.uExposure.value = cfg.exposure * (submerged ? 1.45 : 1.0);
      u.uBloom.value = q.bloom ? this.bloomStrength * (submerged ? 1.8 : 1.0) : 0.0;
      u.uTime.value = elapsed;
      u.uUnderwater.value = submerged;
      u.uGrain.value = 0.015;
      u.uVignette.value = 0.32;
      u.uCa.value = 0.0018;
      u.uContrast.value = 1.03;
      u.uSaturation.value = submerged ? 0.92 : 1.07;
      r.setRenderTarget(null);
      this.finalQuad.render(r);
    }

    this.prevViewProj.copy(unjitteredVP);
    cam.projectionMatrix.copy(this.baseProjection);
    cam.projectionMatrixInverse.copy(this.baseProjection).invert();
  }

  /** Read back a region of an HDR target and decode the half floats (calibration only). */
  readHDR(which = 'hdrRT', region = 0.5) {
    const rt = this.targets[which];
    if (!rt) return null;
    const w = Math.max(1, Math.floor(this.width * region));
    const h = Math.max(1, Math.floor(this.height * region));
    const x = Math.floor((this.width - w) / 2);
    const y = Math.floor((this.height - h) / 2);
    const buf = new Uint16Array(w * h * 4);
    try {
      this.renderer.readRenderTargetPixels(rt, x, y, w, h, buf);
    } catch (e) {
      return { error: String(e) };
    }
    const half = (u) => {
      const s = (u & 0x8000) >> 15;
      const e = (u & 0x7c00) >> 10;
      const f = u & 0x03ff;
      let v;
      if (e === 0) v = Math.pow(2, -14) * (f / 1024);
      else if (e === 0x1f) v = f ? NaN : Infinity;
      else v = Math.pow(2, e - 15) * (1 + f / 1024);
      return s ? -v : v;
    };
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let mx = 0;
    const lums = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = half(buf[i * 4]);
      const g = half(buf[i * 4 + 1]);
      const b = half(buf[i * 4 + 2]);
      sr += r;
      sg += g;
      sb += b;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lums[i] = l;
      if (l > mx) mx = l;
    }
    const sorted = Array.from(lums).sort((a, b) => a - b);
    const n = sorted.length;
    const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      target: which,
      meanRGB: [r3(sr / n), r3(sg / n), r3(sb / n)],
      lumaMean: r3(sorted.reduce((a, b) => a + b, 0) / n),
      lumaP05: r3(q(0.05)),
      lumaP50: r3(q(0.5)),
      lumaP95: r3(q(0.95)),
      lumaMax: r3(mx),
    };
  }

  dispose() {
    this._disposeTargets();
    for (const key of [
      'copyQuad', 'ssgiQuad', 'fogQuad', 'resolveQuad', 'taaQuad',
      'bloomPreQuad', 'bloomDownQuad', 'bloomUpQuad', 'finalQuad',
    ]) {
      this[key]?.material?.dispose();
      this[key]?.dispose();
    }
  }
}
