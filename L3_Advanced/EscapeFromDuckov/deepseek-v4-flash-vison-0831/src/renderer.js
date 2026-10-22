import * as THREE from 'three';
import { clamp, lerp, TAU, RNG } from './util.js';
import { WORLD_SIZE, HALF } from './world.js';

// ================= 渲染管线：赛璐璐光照 + 视锥/记忆遮罩 + 高度雾 + 描边 =================
export const FOV_TEX = 200;
export const CAM_YAW0 = Math.PI / 4;

// 世界坐标 -> FOV 贴图 UV
export const fovUv = (x, z) => ({ u: (x + HALF) / WORLD_SIZE, v: (z + HALF) / WORLD_SIZE });

export function makeToonGradient() {
  const data = new Uint8Array([34, 38, 48, 104, 108, 120, 182, 180, 164, 250, 244, 222]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// 共享 shader chunk（材质注入）
const UNIFORM_CHUNK = /* glsl */`
uniform sampler2D uVisTex;
uniform sampler2D uExplTex;
uniform float uMinVis;
uniform float uFogDensity;
uniform float uDayNight;
uniform float uNightBlue;
uniform vec3 uFogColor;
uniform vec3 uSkyColor;
uniform float uRimPow;
uniform float uRimStrength;
uniform float uFloorShadow;
`;
const FOG_VERTEX_CHUNK = /* glsl */`
#ifdef USE_FOG
varying float vFogDepth;
varying float vWorldY;
varying vec3 vWorldPos;
#endif
`;
const FOG_BEGIN_CHUNK = /* glsl */`
`;
const FOG_WORLDPOS_CHUNK = /* glsl */`
#ifdef USE_FOG
  vec4 wp = modelMatrix * vec4( transformed, 1.0 );
  vWorldPos = wp.xyz;
  vWorldY = wp.y;
  vFogDepth = -mvPosition.z;
#endif
`;
const FOG_FRAG_CHUNK = /* glsl */`
uniform sampler2D uVisTex;
uniform sampler2D uExplTex;
uniform float uMinVis;
uniform float uFogDensity;
uniform float uDayNight;
uniform float uNightBlue;
uniform vec3 uFogColor;
uniform vec3 uSkyColor;
uniform float uRimPow;
uniform float uRimStrength;
uniform float uFloorShadow;
uniform float uDbg;

#ifdef USE_FOG
vec2 fovUvOf(vec3 wp) { return clamp( vec2( (wp.x + 100.0) / 200.0, (wp.z + 100.0) / 200.0 ), 0.001, 0.999 ); }

vec4 zomduckFogAndVis( vec4 col, vec3 wp, float fogDepth, float worldY ) {
  // --- 视锥遮罩（可见性 = uVisTex.r） ---
  vec2 fuv = fovUvOf( wp );
  float vis = texture2D( uVisTex, fuv ).r;
  float expl = texture2D( uExplTex, fuv ).r;
  if ( uDbg > 1.5 ) return vec4( fuv, 0.0, 1.0 );
  if ( uDbg > 0.5 ) return vec4( vec3( vis ), 1.0 );
  float mask = max( vis, expl * 0.55 );
  mask = smoothstep( 0.0, 0.7, mask );
  // 角色类对象保持最低可见度（由 uMinVis 控制）
  float minV = mix( 0.06, uMinVis, step( 0.5, uMinVis ) );
  mask = max( mask, minV );

  // --- 高度雾（鸭科夫式场景纵深消隐） ---
  float f = 1.0 - exp( -pow( fogDepth * uFogDensity, 1.6 ) );
  f = clamp( f, 0.0, 0.94 );
  vec3 fogged = mix( col.rgb, uFogColor, f );

  // --- 夜幕与记忆区冷调 ---
  float veil = 1.0 - mask;
  vec3 dark = mix( uSkyColor * 0.22, vec3( 0.016, 0.024, 0.045 ), uNightBlue );
  float veilMul = 0.66 + uNightBlue * 0.28;
  vec3 outC = mix( fogged, dark, veil * veilMul );
  outC = mix( outC, uFogColor, uNightBlue * 0.1 );

  // --- 地面极暗（用于投影质感） ---
  outC *= mix( 1.0, 0.72, uFloorShadow * clamp( worldY * 4.0, 0.0, 1.0 ) );

  return vec4( outC, col.a );
}
#endif
`;

// 修改雾应用逻辑：仅替换 fog_fragment，保留 output_fragment 的编码流程
const FOG_USAGE = /* glsl */`
#ifdef USE_FOG
  gl_FragColor = zomduckFogAndVis( gl_FragColor, vWorldPos, vFogDepth, vWorldY );
#endif
`;

// 材质工厂：卡通 + 视锥遮罩
export function makeToonMat(game, opts = {}) {
  const color = opts.color !== undefined ? opts.color : (opts.vertexColors ? 0xffffff : 0x9aa0a8);
  const mat = new THREE.MeshLambertMaterial({
    color,
    fog: true,
    transparent: opts.transparent || false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors || false,
    map: opts.map || null,
    alphaTest: opts.alphaTest || 0,
    depthWrite: opts.depthWrite !== false,
    emissive: opts.emissive || 0x000000,
  });
  mat.userData.rimPow = opts.rimPow ?? 2.5;
  mat.userData.rimStrength = opts.rimStrength ?? 0.12;
  mat.userData.minVis = opts.minVis ?? 0.08;
  mat.userData.floorShadow = opts.floorShadow ?? 0;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uVisTex = game.fovUniform.visTex;
    shader.uniforms.uExplTex = game.fovUniform.explTex;
    shader.uniforms.uMinVis = { value: 0.08 };
    shader.uniforms.uFogDensity = { value: 0.0 };
    shader.uniforms.uDayNight = { value: 0.0 };
    shader.uniforms.uNightBlue = { value: 0.0 };
    shader.uniforms.uFogColor = { value: new THREE.Color() };
    shader.uniforms.uSkyColor = { value: new THREE.Color() };
    shader.uniforms.uRimPow = { value: 2.5 };
    shader.uniforms.uRimStrength = { value: 0.12 };
    shader.uniforms.uFloorShadow = { value: 0 };
    shader.uniforms.uDbg = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', FOG_VERTEX_CHUNK)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + FOG_WORLDPOS_CHUNK)
      .replace('#include <fog_vertex>', FOG_BEGIN_CHUNK);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', FOG_FRAG_CHUNK)
      .replace('#include <fog_fragment>', FOG_USAGE);
    mat.userData.shader = shader;
  };
  return mat;
}

// 描边（背面挤出法）
export function makeOutline(obj, color = 0x0d1114, thickness = 1.09) {
  const m = new THREE.Mesh(obj.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: 0.95 }));
  m.scale.setScalar(thickness);
  m.castShadow = false; m.receiveShadow = false;
  obj.userData.outline = m;
  obj.add(m);
  return m;
}

// 更新所有注入材质的动态 uniform
export function updateMatUniforms(mats, fov, env) {
  for (const mat of mats) {
    const sh = mat.userData.shader;
    if (!sh) continue;
    sh.uniforms.uVisTex.value = fov.visTex;
    sh.uniforms.uExplTex.value = fov.explTex;
    sh.uniforms.uMinVis.value = mat.userData.minVis ?? 0.08;
    sh.uniforms.uFogDensity.value = env.fogDensity;
    sh.uniforms.uDayNight.value = env.dayNight;
    sh.uniforms.uNightBlue.value = env.nightBlue;
    sh.uniforms.uFogColor.value.copy(env.fogColor);
    sh.uniforms.uSkyColor.value.copy(env.skyColor);
    sh.uniforms.uRimPow.value = mat.userData.rimPow ?? 2.5;
    sh.uniforms.uRimStrength.value = mat.userData.rimStrength ?? 0.12;
    sh.uniforms.uFloorShadow.value = mat.userData.floorShadow ?? 0;
    sh.uniforms.uDbg.value = mat.userData.dbg ?? 0;
  }
}

// ================= 渲染器主体 =================
export class Renderer {
  constructor(game) {
    this.game = game;
    const canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = null;
    this.mats = [];
    this.postTargets = [];
    this.meshes = { props: [], doors: new Map(), windows: new Map(), roofs: new Map(), barricades: new Map() };
    this.zombieVisuals = new Map();
    this.tmpColor = new THREE.Color();
  }

  init() {
    const game = this.game;
    this.camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.3, 260);
    this.camera.up.set(0, 1, 0);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ---- 光照 ----
    this.sun = new THREE.DirectionalLight(0xffe8c0, 8.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbdd4e8, 0x2a3340, 3.0);
    this.scene.add(this.hemi);
    this.flash = new THREE.SpotLight(0xfff2cc, 60, 26, 0.42, 0.55, 1.4);
    this.flash.castShadow = false;
    this.flash.visible = false;
    this.flash.position.set(0, 1.2, 0);
    this.scene.add(this.flash);
    this.flash.target.position.set(0, 0, -1);
    this.scene.add(this.flash.target);
    // 体积光锥（丁达尔效应）
    const coneGeo = new THREE.CylinderGeometry(0.18, 2.6, 9, 18, 1, true);
    coneGeo.translate(0, 4.5, 0);
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, 4.5);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cc, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.flashCone = new THREE.Mesh(coneGeo, coneMat);
    this.flashCone.visible = false;
    this.flashCone.renderOrder = 500;
    this.scene.add(this.flashCone);
    this.pointLights = [];
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xffb066, 0, 14, 1.7);
      pl.visible = false;
      this.pointLights.push(pl);
      this.scene.add(pl);
    }

    // ---- FOV 数据结构 ----
    this.visData = new Uint8Array(FOV_TEX * FOV_TEX * 4);
    this.explData = new Uint8Array(FOV_TEX * FOV_TEX * 4);
    this.visTex = new THREE.DataTexture(this.visData, FOV_TEX, FOV_TEX, THREE.RGBAFormat);
    this.visTex.magFilter = THREE.NearestFilter; this.visTex.minFilter = THREE.NearestFilter;
    this.visTex.generateMipmaps = false;
    this.visTex.flipY = false;
    this.explTex = new THREE.DataTexture(this.explData, FOV_TEX, FOV_TEX, THREE.RGBAFormat);
    this.explTex.magFilter = THREE.NearestFilter; this.explTex.minFilter = THREE.NearestFilter;
    this.explTex.generateMipmaps = false;
    this.explTex.flipY = false;
    game.fovUniform = {
      visTex: { value: this.visTex },
      explTex: { value: this.explTex },
    };

    // ---- 世界网格 ----
    this.buildGround();
    this.buildWorld();

    // ---- 后处理目标 ----
    const W = () => Math.floor(window.innerWidth * Math.min(window.devicePixelRatio, 2));
    const H = () => Math.floor(window.innerHeight * Math.min(window.devicePixelRatio, 2));
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false, depthTexture: new THREE.DepthTexture(W(), H(), THREE.UnsignedIntType) };
    this.targetA = new THREE.WebGLRenderTarget(W(), H(), opts);
    this.targetB = new THREE.WebGLRenderTarget(W(), H(), { ...opts, depthBuffer: false });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.targetA.setSize(W(), H());
      this.targetB.setSize(W(), H());
      this.postNeedResize = true;
    });
  }

  rebuildWorld() {
    const kill = (obj) => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); }
        }
      });
    };
    kill(this.ground); kill(this.water); kill(this.worldGroup); kill(this.playerGroup);
    this.ground = null; this.water = null; this.worldGroup = null; this.playerGroup = null;
    for (const v of this.zombieVisuals.values()) this.scene.remove(v.g);
    this.zombieVisuals.clear();
    if (this.effects) {
      for (const e of this.effects) {
        if (e.obj) { this.scene.remove(e.obj); }
        if (e.pts) for (const p of e.pts) if (p.m) this.scene.remove(p.m);
      }
      this.effects = [];
    }
    this.meshes.doors.clear(); this.meshes.windows.clear(); this.meshes.roofs.clear(); this.meshes.barricades.clear();
    this.mats = [];
    this.buildGround();
    this.buildWorld();
  }
  resetExplored() {
    this.explData.fill(0);
    this.explTex.needsUpdate = true;
  }
  setCameraFollow(x, z, yaw, pitch, zoom) {
    const d = zoom;
    const px = x + Math.cos(yaw) * Math.cos(pitch) * d;
    const py = Math.sin(pitch) * d;
    const pz = z + Math.sin(yaw) * Math.cos(pitch) * d;
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(x, 0, z);
    this.camera.updateMatrixWorld();
  }

  // ---------- 地面 ----------
  buildGround() {
    const game = this.game;
    const N = WORLD_SIZE;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * N * 18);
    const col = new Float32Array(N * N * 18);
    const nor = new Float32Array(N * N * 18);
    let pi = 0, ci = 0;
    const pal = {
      0: [0x52565a, 0x4c5054, 0x474b4f], // 道路
      1: [0x3e4347, 0x383d41, 0x34393c], // 室内水泥
      2: [0x555f4a, 0x4d5744, 0x47503e], // 泥土
      3: [0x5e6a50, 0x566247, 0x505a43], // 草地
      4: [0x3c5c6a, 0x365664, 0x304e5e], // 水
    };
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const t = game.world.grid[z * N + x];
      const noise = (game.world.noise(x * 0.7 + 5, z * 0.7 + 5) + 1) * 0.5;
      const p = pal[t] || pal[3];
      const c0 = new THREE.Color(p[0]).offsetHSL(0, 0, (noise - 0.5) * 0.05);
      const c1 = new THREE.Color(p[1]).offsetHSL(0, 0, (noise - 0.5) * 0.04);
      const c2 = new THREE.Color(p[2]).offsetHSL(0, 0, (noise - 0.5) * 0.03);
      const cs = [c0, c1, c0, c1, c2, c0];
      const xs = x - HALF, zs = z - HALF;
      const v = [[0, 0], [1, 1], [1, 0], [0, 0], [0, 1], [1, 1]];
      for (let i = 0; i < 6; i++) {
        pos[pi] = xs + v[i][0]; pos[pi + 1] = 0; pos[pi + 2] = zs + v[i][1]; pi += 3;
        col[ci] = cs[i].r; col[ci + 1] = cs[i].g; col[ci + 2] = cs[i].b; ci += 3;
        nor[pi - 3] = 0; nor[pi - 2] = 1; nor[pi - 1] = 0;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const mat = makeToonMat(game, { vertexColors: true, floorShadow: 1, rimStrength: 0.02 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.mats.push(mat);
    // 湖泊微起伏水片
    const lk = game.world.lake;
    const wgeo = new THREE.PlaneGeometry(lk.r * 2, lk.r * 2, 1, 1);
    wgeo.rotateX(-Math.PI / 2);
    const wmat = makeToonMat(game, { color: 0x2c4c5c, transparent: true, opacity: 0.85, rimStrength: 0.3, rimPow: 1.6, minVis: 0.04 });
    this.water = new THREE.Mesh(wgeo, wmat);
    this.water.position.set(lk.x - HALF, 0.06, lk.z - HALF);
    this.scene.add(this.water);
    this.mats.push(wmat);
  }

  // ---------- 世界几何 ----------
  buildWorld() {
    const game = this.game;
    const w = game.world;
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.buildWalls(w);
    this.buildRoofs(w);
    this.buildProps(w);
    this.buildTrees(w);
    this.buildStreetlights(w);
    this.buildCar(game);
  }
  pushBox(parts, x0, y0, z0, x1, y1, z1, c, shade = 1) {
    const V = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    // 每面 [4顶点, 法线, 亮度]（顶点按面外法线的逆时针顺序）
    const F = [
      [[0, 3, 2, 1], [0, -1, 0], 0.62],
      [[4, 6, 5, 7], [0, 1, 0], 1.0],
      [[0, 1, 5, 4], [0, 0, -1], 0.8],
      [[2, 3, 7, 6], [0, 0, 1], 0.8],
      [[1, 2, 6, 5], [1, 0, 0], 0.9],
      [[3, 7, 4, 0], [-1, 0, 0], 0.7],
    ];
    for (const [f, n, l] of F) {
      const cc = new THREE.Color(c).offsetHSL(0, 0, (l * shade - 0.5) * 0.16);
      const tri = [f[0], f[2], f[1], f[0], f[3], f[2]];
      for (const vi of tri) {
        parts.pos.push(V[vi][0], V[vi][1], V[vi][2]);
        parts.col.push(cc.r, cc.g, cc.b);
        parts.nor.push(n[0], n[1], n[2]);
      }
    }
  }
  mergeParts(parts, mat) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(parts.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(parts.col), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(parts.nor), 3));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  buildWalls(w) {
    const game = this.game;
    const parts = { pos: [], col: [], nor: [] };
    const T = 0.14;
    const WALL_H = 2.35, LOW_H = 1.35;
    const wallSeg = (wall) => {
      const horiz = (wall.dir & 5) !== 0;
      let h = (wall.dir === 1 || wall.dir === 2) ? LOW_H : WALL_H;
      if (wall.type === 'fence') h = 1.5;
      const c = wall.type === 'fence' ? 0x6a4c33 : this.wallColorFor(wall);
      const cx = wall.cx - HALF, cz = wall.cz - HALF;
      // 本段上的门窗开口
      const openings = [];
      for (const o of w.wallObjs.values()) {
        if (o === wall || (o.type !== 'door' && o.type !== 'window')) continue;
        const onSeg = horiz ? (Math.abs(o.cz - wall.cz) < 0.001) : (Math.abs(o.cx - wall.cx) < 0.001);
        if (onSeg && horiz) openings.push({ t0: Math.max(0, o.sx0 - wall.sx0 - 0.04), t1: Math.min(1, o.sx1 - wall.sx0 + 0.04) });
        else if (onSeg) openings.push({ t0: Math.max(0, o.sz0 - wall.sz0 - 0.04), t1: Math.min(1, o.sz1 - wall.sz0 + 0.04) });
      }
      openings.sort((a, b) => a.t0 - b.t0);
      const segs = [];
      let cur = 0;
      for (const o of openings) {
        if (o.t0 > cur + 0.001) segs.push([cur, o.t0]);
        cur = Math.max(cur, o.t1);
      }
      if (cur < 1 - 0.001) segs.push([cur, 1]);
      for (const [t0, t1] of segs) {
        const l0 = t0 * (wall.sx1 - wall.sx0), l1 = t1 * (wall.sx1 - wall.sx0);
        if (horiz) {
          this.pushBox(parts, cx + l0, 0, cz - T / 2, cx + l1, h, cz + T / 2, c, 1);
          this.pushBox(parts, cx + l0, 0, cz - T / 2 - 0.005, cx + l1, 0.28, cz + T / 2 + 0.005, 0x3d4042, 0.6);
        } else {
          this.pushBox(parts, cx - T / 2, 0, cz + l0, cx + T / 2, h, cz + l1, c, 1);
          this.pushBox(parts, cx - T / 2 - 0.005, 0, cz + l0, cx + T / 2 + 0.005, 0.28, cz + l1, 0x3d4042, 0.6);
        }
      }
      if (wall.type === 'fence' && horiz) {
        for (let i = 0; i <= 3; i++) this.pushBox(parts, cx + i * 0.33 - 0.05, 1.35, cz - T / 2, cx + i * 0.33 + 0.05, 1.5, cz + T / 2, 0x5a4230, 0.8);
      }
    };
    for (const wall of w.wallObjs.values()) {
      if (wall.type === 'door' || wall.type === 'window') continue;
      wallSeg(wall);
    }
    const mat = makeToonMat(game, { vertexColors: true, rimStrength: 0.05 });
    const mesh = this.mergeParts(parts, mat);
    this.worldGroup.add(mesh);
    this.mats.push(mat);

    // 门窗（动态）
    for (const wall of w.wallObjs.values()) {
      if (wall.type === 'door') this.buildDoor(wall);
      if (wall.type === 'window') this.buildWindow(wall);
    }
  }
  wallColorFor(wall) {
    const b = wall.building;
    if (!b) return 0x4a4f54;
    const t = b.type;
    if (t === 'house' || t === 'farm') return 0x6b6a5e;
    if (t === 'shop' || t === 'gas') return 0x59626a;
    if (t === 'police') return 0x5b6572;
    if (t === 'military') return 0x55604a;
    return 0x4f575c;
  }
  buildDoor(wall) {
    const game = this.game;
    const g = new THREE.Group();
    const x = wall.x - HALF, z = wall.z - HALF;
    const horiz = (wall.dir & 5) !== 0;
    const mat = makeToonMat(game, { color: wall.requires ? 0x7a4a3a : 0x8a6a42, rimStrength: 0.1, minVis: 0.1 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.78), mat);
    door.castShadow = true;
    door.position.set(horiz ? 0 : -0.39, 0.95, horiz ? -0.39 : 0);
    g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), makeToonMat(game, { color: 0xd8c060, minVis: 0.1 }));
    knob.position.set(horiz ? 0.05 : -0.36, 1.0, horiz ? -0.36 : 0.05);
    g.add(knob);
    // 门框
    const frameMat = makeToonMat(game, { color: 0x4a4038, minVis: 0.1 });
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1.05 : 0.1, 2.02, horiz ? 0.1 : 1.05), frameMat);
    f1.position.set(0, 1.01, 0);
    g.add(f1);
    g.position.set(wall.cx - HALF, 0, wall.cz - HALF);
    if (horiz) g.rotation.y = 0; else g.rotation.y = Math.PI / 2;
    if (wall.dir === 4) g.rotation.y = Math.PI / 2;
    if (wall.dir === 8) g.rotation.y = -Math.PI / 2;
    this.worldGroup.add(g);
    this.meshes.doors.set(wall, { g, door, mat, wall, baseRot: g.rotation.y, curOpen: 0 });
    this.mats.push(mat, frameMat);
    this.updateDoorVisual(wall);
  }
  updateDoorVisual(wall) {
    const v = this.meshes.doors.get(wall);
    if (!v) return;
    const target = wall.open ? (wall.dir === 2 || wall.dir === 4 ? -1.75 : 1.75) : 0;
    v.curOpen = lerp(v.curOpen, target, 0.18);
    v.door.rotation.y = v.curOpen;
  }
  buildWindow(wall) {
    const game = this.game;
    const g = new THREE.Group();
    const x = wall.x - HALF, z = wall.z - HALF;
    const horiz = (wall.dir & 5) !== 0;
    const W = 0.06;
    const frameMat = makeToonMat(game, { color: 0x3a4038, minVis: 0.1 });
    const fw = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1.0 : W, 1.05, horiz ? W : 1.0), frameMat);
    fw.position.set(0, 1.35, 0);
    fw.castShadow = true;
    g.add(fw);
    const glassMat = makeToonMat(game, { color: 0x9fc8d8, transparent: true, opacity: 0.42, rimStrength: 0.35, rimPow: 1.8, minVis: 0.1 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.9 : W * 0.4, 0.85, horiz ? W * 0.4 : 0.9), glassMat);
    glass.position.set(0, 1.35, 0);
    g.add(glass);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1.06 : 0.14, 0.07, horiz ? 0.14 : 1.06), makeToonMat(game, { color: 0x4d4a40, minVis: 0.1 }));
    sill.position.set(0, 0.84, 0);
    g.add(sill);
    g.position.set(wall.cx - HALF, 0, wall.cz - HALF);
    if (!horiz) g.rotation.y = Math.PI / 2;
    if (wall.dir === 4) g.rotation.y = Math.PI / 2;
    if (wall.dir === 8) g.rotation.y = -Math.PI / 2;
    this.worldGroup.add(g);
    this.meshes.windows.set(wall, { g, glass, glassMat, frameMat, wall });
    this.mats.push(frameMat, glassMat);
    this.updateWindowVisual(wall);
  }
  updateWindowVisual(wall) {
    const v = this.meshes.windows.get(wall);
    if (!v) return;
    v.glass.visible = !wall.smashed;
    v.glassMat.opacity = wall.smashed ? 0 : 0.42;
    // 床单窗帘
    let c = v.curtain;
    if (wall.curtain && !c) {
      c = new THREE.Mesh(new THREE.BoxGeometry(v.glass.geometry.parameters.width * 0.96, v.glass.geometry.parameters.height * 0.96, 0.05), makeToonMat(this.game, { color: 0xb8b09a, minVis: 0.1 }));
      c.position.copy(v.glass.position);
      v.g.add(c);
      v.curtain = c;
      this.mats.push(c.material);
    }
    if (c) c.visible = wall.curtain && !wall.smashed;
    this.updateBarricadeVisual(wall);
  }
  updateBarricadeVisual(wall) {
    const key = wall;
    let bv = this.meshes.barricades.get(key);
    if (wall.barricade <= 0) {
      if (bv) { bv.g.visible = false; }
      return;
    }
    const v = this.meshes.windows.get(wall) || this.meshes.doors.get(wall);
    if (!v) return;
    if (!bv) {
      const g = new THREE.Group();
      const mat = makeToonMat(this.game, { color: 0x7a5c34, rimStrength: 0.08, minVis: 0.1 });
      const geo = new THREE.BoxGeometry(1.0, 0.14, 0.05);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(geo, mat);
        p.position.set(0, 0.35 + i * 0.28, 0);
        p.rotation.z = (i % 2 ? 1 : -1) * 0.5;
        g.add(p);
      }
      g.position.set(0, 0.95, 0);
      g.userData.base = v.g.position.clone();
      this.worldGroup.add(g);
      bv = { g, mat };
      this.meshes.barricades.set(key, bv);
      this.mats.push(mat);
    }
    bv.g.visible = true;
    bv.g.position.copy(v.g.position);
    bv.g.rotation.y = v.g.rotation.y;
  }
  buildRoofs(w) {
    const game = this.game;
    for (const b of w.buildings) {
      const wd = b.x1 - b.x0 + 1, ht = b.z1 - b.z0 + 1;
      const geo = new THREE.BoxGeometry(wd + 0.25, 0.16, ht + 0.25);
      const mat = makeToonMat(game, { color: 0x3a3f42, rimStrength: 0.06, transparent: true, opacity: 1, minVis: 0.05 });
      const roof = new THREE.Mesh(geo, mat);
      roof.position.set(b.x0 + wd / 2 - HALF, 2.38, b.z0 + ht / 2 - HALF);
      roof.castShadow = true;
      this.worldGroup.add(roof);
      this.meshes.roofs.set(b, { roof, mat, cur: 1 });
      this.mats.push(mat);
      b.roof = roof;
    }
  }
  updateRoofs(playerCell) {
    for (const [b, v] of this.meshes.roofs) {
      const inside = playerCell ? (playerCell.x >= b.x0 && playerCell.x <= b.x1 && playerCell.z >= b.z0 && playerCell.z <= b.z1) : false;
      const target = inside ? 0 : 1;
      v.cur = lerp(v.cur, target, 0.12);
      v.roof.visible = v.cur > 0.03;
      v.mat.opacity = v.cur;
    }
  }

  buildProps(w) {
    const game = this.game;
    const parts = { pos: [], col: [], nor: [] };
    const C = (x, z, type) => {
      switch (type) {
        case 'fridge': this.pushBox(parts, x - 0.35, 0, z - 0.32, x + 0.35, 1.6, z + 0.32, 0x9aa4a8, 1); this.pushBox(parts, x - 0.3, 0.62, z - 0.26, x + 0.3, 0.72, z + 0.26, 0x3a4145, 0.7); this.pushBox(parts, x - 0.3, 1.18, z - 0.26, x + 0.3, 1.3, z + 0.26, 0x3a4145, 0.7); break;
        case 'counter': this.pushBox(parts, x - 0.4, 0, z - 0.3, x + 0.4, 0.95, z + 0.3, 0x6a5c46, 1); this.pushBox(parts, x - 0.42, 0.95, z - 0.32, x + 0.42, 1.0, z + 0.32, 0x7a6c54, 0.8); break;
        case 'shelf': this.pushBox(parts, x - 0.42, 0, z - 0.3, x + 0.42, 1.9, z + 0.3, 0x5c4a34, 1); for (let i = 0; i < 3; i++) this.pushBox(parts, x - 0.38, 0.5 + i * 0.5, z - 0.24, x + 0.38, 0.56 + i * 0.5, z + 0.24, 0x6a5840, 0.8); break;
        case 'wardrobe': this.pushBox(parts, x - 0.38, 0, z - 0.3, x + 0.38, 1.95, z + 0.3, 0x5a5042, 1); this.pushBox(parts, x - 0.3, 0.05, z - 0.14, x + 0.3, 1.8, z + 0.14, 0x4a4036, 0.7); break;
        case 'gunrack': this.pushBox(parts, x - 0.45, 0, z - 0.25, x + 0.45, 1.4, z + 0.25, 0x33403a, 1); this.pushBox(parts, x - 0.4, 1.4, z - 0.18, x + 0.4, 2.0, z + 0.18, 0x3a4742, 0.8); break;
        case 'bed': this.pushBox(parts, x - 0.6, 0, z - 0.95, x + 0.6, 0.45, z + 0.95, 0x8a7a5c, 1); this.pushBox(parts, x - 0.6, 0.4, z - 0.9, x + 0.6, 0.55, z + 0.9, 0xd8d2c0, 0.9); this.pushBox(parts, x - 0.55, 0.52, z + 0.8, x + 0.55, 0.75, z + 0.95, 0xcfc9b6, 0.9); break;
        case 'table': this.pushBox(parts, x - 0.55, 0, z - 0.4, x + 0.55, 0.02, z + 0.4, 0x6a5840, 0.8); this.pushBox(parts, x - 0.6, 0.72, z - 0.45, x + 0.6, 0.78, z + 0.45, 0x7a6848, 0.9); break;
        case 'stove': this.pushBox(parts, x - 0.32, 0, z - 0.3, x + 0.32, 0.92, z + 0.3, 0x55585a, 1); this.pushBox(parts, x - 0.28, 0.92, z - 0.26, x + 0.28, 0.98, z + 0.26, 0x2c2e30, 0.6); break;
        case 'sink': this.pushBox(parts, x - 0.35, 0, z - 0.3, x + 0.35, 0.9, z + 0.3, 0x8a9296, 1); break;
        case 'toilet': this.pushBox(parts, x - 0.22, 0, z - 0.26, x + 0.22, 0.42, z + 0.26, 0xc8ccd0, 0.9); break;
        case 'generator': this.pushBox(parts, x - 0.35, 0, z - 0.4, x + 0.35, 0.7, z + 0.4, 0x5a3a22, 1); break;
        case 'barrel': this.pushBox(parts, x - 0.24, 0, z - 0.24, x + 0.24, 0.85, z + 0.24, 0x4a5a66, 1); break;
        case 'workbench': this.pushBox(parts, x - 0.5, 0, z - 0.35, x + 0.5, 0.9, z + 0.35, 0x5c4a34, 1); break;
      }
    };
    const propLocs = [];
    for (const b of w.buildings) {
      const roomRng = new RNG(b.id * 97 + 13);
      for (const r of b.rooms) {
        for (const c of r.containers) {
          C(c.x - HALF, c.z - HALF, c.type);
        }
        // 依据房间类型摆放家具
        const cx = (r.x0 + r.x1) / 2 + 0.5 - HALF, cz = (r.z0 + r.z1) / 2 + 0.5 - HALF;
        if (r.type === 'living' || r.type === 'shop' || r.type === 'police' || r.type === 'military' || r.type === 'gas') {
          if (roomRng.chance(0.8)) C(cx + (roomRng.range(-1, 1)), cz + (roomRng.range(-1, 1)), roomRng.pick(['table', 'shelf', 'counter']));
        }
        if (r.type === 'house') { C(cx, cz, 'bed'); C(cx + 1.5, cz + 1, 'table'); }
      }
    }
    // 室外：加油站油泵 / 井 / 检查站路障
    if (w.gasStation) { C(w.gasStation.x - HALF, w.gasStation.z - HALF, 'generator'); }
    if (w.well) { C(w.well.x - HALF, w.well.z - HALF, 'barrel'); }
    if (w.checkpoint) { C(w.checkpoint.x - HALF, w.checkpoint.z - HALF, 'barrel'); C(w.checkpoint.x + 1 - HALF, w.checkpoint.z - HALF, 'barrel'); }
    const mat = makeToonMat(game, { vertexColors: true, rimStrength: 0.07 });
    const mesh = this.mergeParts(parts, mat);
    this.worldGroup.add(mesh);
    this.mats.push(mat);
  }
  buildTrees(w) {
    const game = this.game;
    const parts = { pos: [], col: [], nor: [] };
    const cones = [];
    for (const t of w.trees) {
      const x = t.x - HALF, z = t.z - HALF;
      this.pushBox(parts, x - 0.09, 0, z - 0.09, x + 0.09, 1.1 * t.s, z + 0.09, 0x4a3a28, 1);
      cones.push({ x, z, h: (1.4 + 1.6 * t.s) / 2, r: (0.7 + 0.5 * t.s) / 2, y: 0.9 * t.s });
    }
    const mat = makeToonMat(game, { vertexColors: true, rimStrength: 0.05 });
    const trunk = this.mergeParts(parts, mat);
    this.worldGroup.add(trunk);
    this.mats.push(mat);
    // 树冠：锥体（成组，避免描边过多）
    const leafMat = makeToonMat(game, { color: 0x2e4a2a, rimStrength: 0.18, rimPow: 1.8, minVis: 0.06 });
    const leafMat2 = makeToonMat(game, { color: 0x35482c, rimStrength: 0.18, rimPow: 1.8, minVis: 0.06 });
    for (const c of cones) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(c.r * 1.4, c.h * 2, 6), c.h > 1.5 ? leafMat2 : leafMat);
      cone.position.set(c.x, c.y + c.h, c.z);
      cone.castShadow = true;
      this.worldGroup.add(cone);
    }
    this.mats.push(leafMat, leafMat2);
  }
  buildStreetlights(_w) {
    const game = this.game;
    const lights = [];
    for (let i = 0; i < 14; i++) {
      const x = HALF - 40 + i * 7, z = HALF + 20;
      if (x < 6 || x > WORLD_SIZE - 6) continue;
      lights.push({ x, z });
    }
    const parts = { pos: [], col: [], nor: [] };
    for (const l of lights) {
      const x = l.x - HALF, z = l.z - HALF;
      this.pushBox(parts, x - 0.06, 0, z - 0.06, x + 0.06, 4.2, z + 0.06, 0x3c4044, 1);
      this.pushBox(parts, x - 0.3, 4.1, z - 0.08, x + 0.3, 4.3, z + 0.08, 0x3c4044, 0.9);
      this.pushBox(parts, x + 0.2, 4.25, z - 0.16, x + 0.34, 4.4, z + 0.16, 0xd8d0a8, 0.7);
    }
    const mat = makeToonMat(game, { vertexColors: true, rimStrength: 0.04 });
    const mesh = this.mergeParts(parts, mat);
    this.worldGroup.add(mesh);
    this.mats.push(mat);
    this.streetlights = lights;
  }
  buildCar(game) {
    const w = game.world;
    if (!w.car) return;
    const x = w.car.x - HALF, z = w.car.z - HALF;
    const parts = { pos: [], col: [], nor: [] };
    this.pushBox(parts, x - 0.9, 0.1, z - 1.8, x + 0.9, 0.75, z + 1.8, 0x8a4a32, 1);
    this.pushBox(parts, x - 0.75, 0.72, z - 1.1, x + 0.75, 1.25, z + 0.6, 0x7a4230, 0.9);
    this.pushBox(parts, x - 0.75, 0.75, z - 1.25, x + 0.75, 1.2, z - 1.1, 0x2c3038, 0.7);
    this.pushBox(parts, x - 0.8, 0.2, z - 2.0, x + 0.8, 0.55, z - 1.75, 0x1a1c20, 0.6);
    this.pushBox(parts, x - 0.8, 0.2, z + 1.75, x + 0.8, 0.55, z + 2.0, 0x1a1c20, 0.6);
    const mat = makeToonMat(game, { vertexColors: true, rimStrength: 0.1, minVis: 0.06 });
    const mesh = this.mergeParts(parts, mat);
    mesh.rotation.y = -Math.PI / 2;
    this.worldGroup.add(mesh);
    this.mats.push(mat);
    w.car.mesh = mesh;
  }

  // ---------- 角色与丧尸视觉 ----------
  buildPlayerMesh(p) {
    const game = this.game;
    const g = new THREE.Group();
    const duck = makeToonMat(game, { color: 0xffd23e, rimStrength: 0.22, rimPow: 2.2, minVis: 0.92 });
    const beak = makeToonMat(game, { color: 0xff8c1a, rimStrength: 0.2, minVis: 0.92 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), duck);
    body.scale.set(1, 1.05, 1.22);
    body.position.y = 0.52;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), duck);
    head.position.y = 1.06;
    head.castShadow = true;
    g.add(head);
    const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), beak);
    b1.rotation.x = -Math.PI / 2;
    b1.position.set(0, 1.05, 0.32);
    g.add(b1);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), makeToonMat(game, { color: 0x14181c, minVis: 0.92 }));
    eyeL.position.set(-0.1, 1.12, 0.2);
    g.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.1; g.add(eyeR);
    // 翅膀（可动臂）
    const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), duck);
    wingL.position.set(-0.4, 0.62, 0);
    g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.4; g.add(wingR);
    // 脚
    const footGeo = new THREE.BoxGeometry(0.16, 0.1, 0.26);
    const footL = new THREE.Mesh(footGeo, beak);
    footL.position.set(-0.12, 0.06, 0.02);
    g.add(footL);
    const footR = footL.clone(); footR.position.x = 0.12; g.add(footR);
    // 战术背带
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.4, 0.7), makeToonMat(game, { color: 0x4a5440, rimStrength: 0.15, minVis: 0.92 }));
    vest.position.y = 0.52;
    g.add(vest);
    makeOutline(body, 0x0d1114, 1.09);
    makeOutline(head, 0x0d1114, 1.09);
    this.scene.add(g);
    this.playerGroup = g;
    p._v = { g, body, head, wingL, wingR, footL, footR, b1, eyeL, eyeR, vest, duckMat: duck, beakMat: beak };
    this.updatePlayerGear(p);
  }
  updatePlayerGear(p) {
    const v = p._v;
    if (!v) return;
    // 头盔/背包/武器
    if (v.helmet) { v.helmet.visible = false; }
    const headItem = p.equip && p.equip.head;
    if (headItem) {
      if (!v.helmet) {
        v.helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, TAU, 0, Math.PI * 0.62), makeToonMat(this.game, { color: 0x3f4a3c, rimStrength: 0.2, minVis: 0.92 }));
        v.helmet.position.y = 1.1;
        v.g.add(v.helmet);
      }
      v.helmet.visible = true;
    }
    if (v.backpack) v.backpack.visible = false;
    const bag = p.equip && p.equip.back;
    if (bag) {
      if (!v.backpack) {
        v.backpack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.28), makeToonMat(this.game, { color: 0x4a5a3c, rimStrength: 0.15, minVis: 0.92 }));
        v.backpack.position.set(0, 0.62, -0.42);
        v.g.add(v.backpack);
      }
      v.backpack.visible = true;
    }
    this.updatePlayerWeapon(p);
  }
  updatePlayerWeapon(p) {
    const v = p._v;
    if (!v) return;
    if (v.weapon) { v.g.remove(v.weapon); v.weapon = null; }
    const w = p.held && p.held.item ? p.held.item : null;
    if (!w) return;
    const mk = (geo, mat, pos) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(pos[0], pos[1], pos[2]);
      if (pos[3]) m.rotation.set(pos[3], pos[4], pos[5]);
      m.castShadow = true;
      return m;
    };
    const g = new THREE.Group();
    if (w.type === 'gun') {
      const mat = makeToonMat(this.game, { color: 0x22262a, rimStrength: 0.2, minVis: 0.92 });
      g.add(mk(new THREE.BoxGeometry(0.07, 0.1, 0.75), mat, [0.5, 0.62, 0.15]));
      g.add(mk(new THREE.BoxGeometry(0.06, 0.08, 0.2), mat, [0.5, 0.68, 0.25]));
    } else if (w.type === 'melee') {
      const mat = makeToonMat(this.game, { color: 0x7a5a3c, rimStrength: 0.2, minVis: 0.92 });
      if (w.id === 'fire_axe') {
        g.add(mk(new THREE.BoxGeometry(0.06, 0.06, 0.9), mat, [0.55, 0.62, 0.2]));
        g.add(mk(new THREE.BoxGeometry(0.3, 0.05, 0.02), makeToonMat(this.game, { color: 0xb0b8c0, minVis: 0.92 }), [0.55, 0.72, 0.62, 0, 0, 0]));
      } else if (w.id === 'kitchen_knife') {
        g.add(mk(new THREE.BoxGeometry(0.03, 0.05, 0.35), makeToonMat(this.game, { color: 0xc8ccd0, minVis: 0.92 }), [0.55, 0.62, 0.25]));
      } else {
        g.add(mk(new THREE.BoxGeometry(0.07, 0.07, 0.85), mat, [0.55, 0.62, 0.2]));
      }
    }
    v.weapon = g;
    v.g.add(g);
  }
  makeZombieVisual(z) {
    const game = this.game;
    const g = new THREE.Group();
    const tone = z.kind === 'sprinter' ? 0x7f9a72 : z.kind === 'fat' ? 0x8f966a : z.kind === 'crawler' ? 0x77805e : 0x9aa278;
    const mat = makeToonMat(game, { color: tone, rimStrength: 0.16, rimPow: 2.0, minVis: 0.1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 9), mat);
    body.scale.set(1, 1.05, 1.2);
    body.position.y = 0.5;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 9), mat);
    head.position.y = 1.02;
    head.position.z = z.kind === 'crawler' ? 0.1 : 0.02;
    g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), makeToonMat(game, { color: 0x8a7a2a, minVis: 0.1 }));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 1.0, 0.3);
    g.add(beak);
    const eyes = makeToonMat(game, { color: 0xd83828, minVis: 0.3 });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyes);
    eL.position.set(-0.09, 1.08, 0.19);
    g.add(eL);
    const eR = eL.clone(); eR.position.x = 0.09; g.add(eR);
    const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 7), mat);
    wingL.position.set(-0.38, 0.6, 0);
    g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.38; g.add(wingR);
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.24), mat);
    footL.position.set(-0.11, 0.06, 0);
    g.add(footL);
    const footR = footL.clone(); footR.position.x = 0.11; g.add(footR);
    if (z.kind === 'crawler') { g.rotation.x = 0.5; body.position.y = 0.2; head.position.y = 0.5; }
    if (z.kind === 'fat') { body.scale.set(1.35, 1.2, 1.4); head.scale.set(1.2, 1.2, 1.2); }
    makeOutline(body, 0x0a0e10, 1.09);
    makeOutline(head, 0x0a0e10, 1.09);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), makeToonMat(game, { color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, minVis: 0.1 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    this.scene.add(g);
    g.visible = false;
    z._v = { g, body, head, wingL, wingR, footL, footR, beak, eyes, eL, eR, mat, eyesMat: eyes, shadow, anim: Math.random() * 10 };
    return z._v;
  }
  updateZombieVisual(z, dt, now) {
    let v = this.zombieVisuals.get(z);
    if (!v) { v = this.makeZombieVisual(z); this.zombieVisuals.set(z, v); }
    const vis = z.visibleToPlayer && !z.hidden;
    v.g.visible = vis && (z.kind !== 'crawler' || true);
    if (!vis) return;
    v.g.position.set(z.x - HALF, 0, z.z - HALF);
    v.g.rotation.y = z.face;
    v.anim += dt * (z.moving ? 9 : 1.2);
    const bob = z.moving ? Math.abs(Math.sin(v.anim)) * 0.07 : 0;
    v.body.position.y = (z.kind === 'crawler' ? 0.2 : 0.5) + bob;
    v.head.position.y = (z.kind === 'crawler' ? 0.5 : 1.02) + bob * 1.2;
    const sw = Math.sin(v.anim) * (z.moving ? 0.4 : 0.05);
    v.wingL.rotation.x = sw; v.wingR.rotation.x = -sw;
    v.footL.position.z = Math.sin(v.anim) * 0.1;
    v.footR.position.z = -Math.sin(v.anim) * 0.1;
    if (z.charging && now % 0.35 < 0.18) { v.eL.visible = v.eR.visible = true; }
    // 冲刺红光（狂暴搜刮者）
    if (z.kind === 'sprinter' && z.charging) {
      v.mat.emissive.setRGB(0.9, 0.12, 0.08);
    } else v.mat.emissive.setRGB(0, 0, 0);
  }
  removeZombieVisual(z) {
    const v = this.zombieVisuals.get(z);
    if (v) { this.scene.remove(v.g); this.zombieVisuals.delete(z); }
  }

  // ---------- 特效 ----------
  addTracer(x0, z0, y0, x1, z1, y1, color = 0xffc860) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x0, y0, z0, x1, y1, z1]), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false, fog: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 999;
    this.scene.add(line);
    const born = this.game.now;
    this.effects = this.effects || [];
    this.effects.push({ kind: 'line', obj: line, born });
  }
  addMuzzleFlash(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.95, depthTest: false, fog: false });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 5), mat);
    c1.rotation.x = Math.PI / 2;
    const c2 = c1.clone();
    c2.scale.set(0.55, 1.6, 0.55);
    g.add(c1, c2);
    g.position.set(x, y, z);
    g.renderOrder = 999;
    this.scene.add(g);
    const born = this.game.now;
    this.effects = this.effects || [];
    this.effects.push({ kind: 'flash', obj: g, born });
  }
  addFeathers(x, y, z, n = 8, color = 0xd8d8b8) {
    this.effects = this.effects || [];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshBasicMaterial({ color: i % 2 ? color : 0xfff8e0, side: THREE.DoubleSide, transparent: true, fog: false }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const a = Math.random() * TAU, sp = 1.5 + Math.random() * 3;
      pts.push({ m, x, y, z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, born: this.game.now });
    }
    this.effects.push({ kind: 'feathers', pts, born: this.game.now });
  }
  addSplinters(x, y, z, n = 5, color = 0x8a7a5c) {
    this.effects = this.effects || [];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), new THREE.MeshBasicMaterial({ color, transparent: true, fog: false }));
      m.position.set(x, y, z);
      this.scene.add(m);
      const a = Math.random() * TAU;
      pts.push({ m, vx: Math.cos(a) * 2.5, vy: 1 + Math.random() * 1.5, vz: Math.sin(a) * 2.5, born: this.game.now });
    }
    this.effects.push({ kind: 'splinters', pts, born: this.game.now });
  }
  addShell(x, y, z, dir) {
    this.effects = this.effects || [];
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 4), new THREE.MeshBasicMaterial({ color: 0xc8a848, transparent: true, fog: false }));
    m.position.set(x, y, z);
    this.scene.add(m);
    this.effects.push({ kind: 'shell', pts: [{ m, vx: dir.x * 2 + Math.random(), vy: 1.2, vz: dir.z * 2 + Math.random(), born: this.game.now }], born: this.game.now });
  }
  updateEffects(dt) {
    if (!this.effects) return;
    const now = this.game.now;
    const keep = [];
    for (const e of this.effects) {
      const age = now - e.born;
      if (e.kind === 'line' && age > 0.08) { this.scene.remove(e.obj); e.obj.geometry.dispose(); e.obj.material.dispose(); continue; }
      if (e.kind === 'flash' && age > 0.06) { this.scene.remove(e.obj); e.obj.children.forEach(c => c.geometry.dispose()); e.obj.children.forEach(c => c.material.dispose()); continue; }
      if (e.kind === 'feathers' && age > 1.6) { for (const p of e.pts) { this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); } continue; }
      if (e.kind === 'splinters' && age > 0.7) { for (const p of e.pts) { this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); } continue; }
      if (e.kind === 'shell' && age > 1.2) { for (const p of e.pts) { this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); } continue; }
      if (e.kind === 'feathers' || e.kind === 'splinters') {
        for (const p of e.pts) {
          p.vy -= 8 * dt;
          p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
          if (e.kind === 'feathers') { p.rot += p.vr * dt; p.m.rotation.z = p.rot; }
          if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
          p.m.material.opacity = Math.max(0, 1 - age / 1.5);
        }
      }
      if (e.kind === 'shell') {
        for (const p of e.pts) {
          p.vy -= 9 * dt;
          p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
          if (p.m.position.y < 0.03) { p.m.position.y = 0.03; p.vy = 0; p.vx = 0; p.vz = 0; }
        }
      }
      keep.push(e);
    }
    this.effects = keep;
  }

  // ---------- 帧渲染 ----------
  render(dt) {
    const game = this.game;
    this.updateEffects(dt);
    for (const wall of this.meshes.doors.keys()) this.updateDoorVisual(wall);
    this.updateRoofs(game.player ? { x: Math.floor(game.player.x), z: Math.floor(game.player.z) } : null);
    // 材质动态 uniform
    const env = game.env;
    updateMatUniforms(this.mats, game.fovUniform, env);
    // 手电筒
    if (game.player) {
      const p = game.player;
      this.flash.position.set(p.x - HALF, 1.35, p.z - HALF);
      this.flash.target.position.set(p.x - HALF + Math.cos(p.aimAngle) * 12, 0.2, p.z - HALF + Math.sin(p.aimAngle) * 12);
      this.flash.visible = p.flashOn;
      if (this.flashCone) {
        this.flashCone.visible = p.flashOn;
        this.flashCone.position.set(p.x - HALF, 1.35, p.z - HALF);
        this.flashCone.lookAt(this.flash.target.position);
      }
    }
    // 太阳阴影跟随
    if (game.env && this.sun) {
      this.sun.position.set(game.player.x - HALF + 26, 44, game.player.z - HALF + 14);
      this.sun.target.position.set(game.player.x - HALF, 0, game.player.z - HALF);
    }
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    if (game.postfx) game.postfx.render(this);
  }
}