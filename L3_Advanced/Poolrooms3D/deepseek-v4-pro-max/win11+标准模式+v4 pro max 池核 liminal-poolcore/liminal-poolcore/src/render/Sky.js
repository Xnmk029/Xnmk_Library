/**
 * render/Sky.js — 光照 / 级联阴影（CSM）/ 环境光 / 雾
 * ===========================================================================
 * ▍级联阴影贴图（CSM）
 *   直接使用 three 官方 addon `three/addons/csm/CSM.js`：它把一个方向光拆成 N 级
 *   级联，每级一张阴影图覆盖视锥的一段（practical 分割），并通过全局覆写
 *   ShaderChunk.lights_fragment_begin 让片元按视深选择级联。
 *   注意两点（本项目已处理）：
 *     · csm.setupMaterial(material) 会**覆写** material.onBeforeCompile，
 *       所以必须先 setupMaterial、再叠加我们自己的 shader 注入（见 Materials.js）。
 *     · 若 addon 缺失（离线/裁剪构建），自动降级为"单级联 + 视锥拟合 + 纹素吸附"
 *       的方向光阴影（ShadowDirector），避免整个应用崩掉。
 *
 * ▍环境光
 *   用程序化生成的等距圆柱天光图经 PMREM 卷积成 IBL，给瓷砖/金属提供柔和的
 *   室内反射（池核那种"到处都是漫反射白光"的观感）。
 */

import * as THREE from 'three';
import { RENDER, WORLD } from '../config.js';

/**
 * 降级方案：单级联方向光阴影。
 * 把正交阴影相机每帧拟合到"相机前方 shadowDistance 范围"，并做纹素吸附避免抖动。
 */
class ShadowDirector {
  constructor(light, { distance = 110, mapSize = 2048 }) {
    this.light = light;
    this.distance = distance;
    light.castShadow = true;
    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.045;
    const cam = light.shadow.camera;
    cam.near = 0.5;
    cam.far = 400;
    this._center = new THREE.Vector3();
  }
  update(camera) {
    const d = this.distance;
    const cam = this.light.shadow.camera;
    // 阴影区域中心放在相机前方 40% 处
    this._center.copy(camera.getWorldDirection(_v3)).multiplyScalar(d * 0.4).add(camera.position);
    // 纹素吸附：把中心量化到阴影贴图的纹素网格，消除移动时的阴影抖动
    const texel = (d * 2) / this.light.shadow.mapSize.x;
    this._center.x = Math.round(this._center.x / texel) * texel;
    this._center.z = Math.round(this._center.z / texel) * texel;
    cam.left = -d; cam.right = d; cam.top = d; cam.bottom = -d;
    cam.updateProjectionMatrix();
    this.light.position.copy(this._center).addScaledVector(_sun, -160);
    this.light.target.position.copy(this._center);
    this.light.target.updateMatrixWorld();
    this.light.updateMatrixWorld();
  }
  setQuality(q) {
    this.distance = q.shadowDistance;
    if (this.light.shadow.mapSize.x !== q.shadowMapSize) {
      this.light.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.light.shadow.map?.dispose();
      this.light.shadow.map = null;
    }
    this.light.castShadow = q.shadows;
  }
  dispose() {}
}

/**
 * 创建全套光照。**异步**：CSM addon 用动态 import 以便优雅降级。
 * @returns {Promise<object>}
 */
export async function createSky({ scene, renderer, camera, textures, quality }) {
  const sunDir = new THREE.Vector3(...RENDER.sunDirection).normalize();
  _sun.copy(sunDir);

  // ── 雾（室内青雾 + 掩盖 chunk 弹入）──
  scene.fog = new THREE.FogExp2(RENDER.fogColor, quality.fogDensity);
  scene.background = new THREE.Color(RENDER.fogColor);

  // ── 环境光 IBL ──
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(textures.skyEquirect);
  scene.environment = envRT.texture;
  // 兜底全局强度（未显式挂 envMap 的材质走这条路）
  if ('environmentIntensity' in scene) scene.environmentIntensity = RENDER.environmentIntensity;
  pmrem.dispose();

  // ── 半球光 + 极弱补光（模拟无处不在的漫反射白光）──
  const hemi = new THREE.HemisphereLight(RENDER.hemiSky, RENDER.hemiGround, RENDER.hemiIntensity);
  hemi.position.set(0, WORLD.ceilingY, 0);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(RENDER.ambientColor, RENDER.ambientIntensity);
  scene.add(ambient);

  // ── 方向光 + 级联阴影 ──
  let csm = null;
  let director = null;
  let sunLight = null;

  try {
    const mod = await import('three/addons/csm/CSM.js');
    const CSM = mod.CSM;
    csm = new CSM({
      camera,
      parent: scene,
      cascades: quality.csmCascades,
      maxFar: quality.shadowDistance,
      mode: 'practical',
      shadowMapSize: quality.shadowMapSize,
      shadowBias: -0.00035,
      lightDirection: sunDir.clone(),
      lightIntensity: RENDER.sunIntensity,
      lightColor: new THREE.Color(RENDER.sunColor),
      lightMargin: 120,
    });
    csm.fade = true;
    for (const l of csm.lights) {
      l.color = new THREE.Color(RENDER.sunColor);
      l.shadow.normalBias = 0.04;
      l.castShadow = quality.shadows;
    }
  } catch (err) {
    console.warn('[Sky] CSM addon 不可用，降级为单级联拟合阴影：', err?.message || err);
    sunLight = new THREE.DirectionalLight(RENDER.sunColor, RENDER.sunIntensity);
    sunLight.position.copy(sunDir).multiplyScalar(-160);
    scene.add(sunLight);
    scene.add(sunLight.target);
    director = new ShadowDirector(sunLight, { distance: quality.shadowDistance, mapSize: quality.shadowMapSize });
  }

  return {
    csm, director, sunLight, hemi, ambient, envMap: envRT.texture, sunDirection: sunDir,

    /** 每帧调用（CSM 需要跟随相机重算级联） */
    update(camera_) {
      if (csm) csm.update();
      if (director) director.update(camera_);
    },

    setQuality(q) {
      scene.fog.density = q.fogDensity;
      if (csm) {
        csm.maxFar = q.shadowDistance;
        // 级联数变化需要重建（defines 改变），这里只调可安全热改的项
        for (const l of csm.lights) {
          l.castShadow = q.shadows;
          if (l.shadow.mapSize.x !== q.shadowMapSize) {
            l.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
            l.shadow.map?.dispose();
            l.shadow.map = null;
          }
        }
        csm.updateFrustums();
      }
      if (director) director.setQuality(q);
    },

    /** 潜入水下：阳光被水面折射衰减 + 偏青 */
    setUnderwater(flag) {
      const lights = csm ? csm.lights : sunLight ? [sunLight] : [];
      for (const l of lights) {
        l.intensity = flag ? RENDER.sunIntensity * 0.45 : RENDER.sunIntensity;
        l.color.set(flag ? 0xbfeaf5 : RENDER.sunColor);
      }
      hemi.intensity = flag ? RENDER.hemiIntensity * 0.7 : RENDER.hemiIntensity;
      scene.fog.color.set(flag ? RENDER.underwaterFogColor : RENDER.fogColor);
      scene.fog.density = flag ? RENDER.underwaterFogDensity : quality.fogDensity;
      scene.background.set(flag ? RENDER.underwaterFogColor : RENDER.fogColor);
    },

    dispose() {
      if (csm) csm.dispose();
      if (director) director.dispose();
      scene.remove(hemi); scene.remove(ambient);
      if (sunLight) { scene.remove(sunLight); scene.remove(sunLight.target); }
      envRT.dispose();
      hemi.dispose?.(); ambient.dispose?.();
    },
  };
}

const _v3 = new THREE.Vector3();
const _sun = new THREE.Vector3();
export default createSky;
