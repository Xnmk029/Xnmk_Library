
/* ============================================================================
   低多边形动态自行车传动展示台
   ----------------------------------------------------------------------------
   架构总览：
   1) 传动解算器 (2D 切线几何)：由「有效飞轮半径 rc + 导轮位置 gp」解出
      连续闭合链条中心线路径（牙盘弧 → 上直线 → 导轮 S 弯 → 张力轮 U 弯 → 飞轮弧）。
   2) 链条实例化：136 节 InstancedMesh 沿弧长均布，相位 sOffset 随链速推进，
      牙盘/飞轮/导轮角速度 = 链速 ÷ 半径 → 全系统严格同步。
   3) 换挡：state.gear 唯一数据源 → 目标值指数插值（半径/导轮x/链平面z 连续变化）
      → 链条平滑爬坡换挡，后拨水平移动，HUD 同帧一致。
   4) NPR 渲染：MeshToonMaterial(4级梯度图) 赛璐璐分区 + 反壳法线外推墨线 +
      可选像素化后期(RT+Nearest) + 海报化背景。
   ========================================================================= */

async function boot(){

const THREE = await import('three');
const { OrbitControls }   = await import('three/addons/controls/OrbitControls.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');

/* ============================== 基础工具 ============================== */
const TAU = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ang = (dx, dy) => Math.atan2(dy, dx);
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

/* ============================== 配置 ============================== */
const CFG = {
  ringTeeth : 46,
  ringPos   : { x: 2.55, y: 1.12 },     // 牙盘中心（BB 五通）
  ringR     : 1.02,                      // 牙盘节圆半径
  cogX : -2.6, cogY : 1.12,             // 飞轮轴心
  cogs : [28, 24, 21, 18, 16, 14, 12],  // 齿数（index 0 = 最大 = 1 挡）
  cogK : 0.0185,                         // 齿数→半径系数
  gpY  : 0.42,  gpR : 0.10,              // 导轮(上/导向轮)高度与半径
  tpOff: { x:-0.26, y:-0.28 },           // 张力轮相对导向轮的刚性偏移（拨尾）
  tpR  : 0.10,
  gpBase: 0.45, gpStep: 0.09,            // 导轮 x = cogX + base + step*gearIdx（换挡水平移动）
  zSpread: 0.05,                          // 飞轮片轴向间距
  nLinks: 136,                            // 链条节数（固定）
  omegaMax: 4.2,                          // 电机角速度 rad/s（≈40 RPM）
};
const cogR  = i => CFG.cogs[i] * CFG.cogK;                 // 飞轮节圆半径
const cogZ  = i => -CFG.zSpread * 3 + i * CFG.zSpread;     // 飞轮片 z（小片朝外侧+）
const gpX   = g => CFG.cogX + CFG.gpBase + CFG.gpStep * g; // 导轮目标 x
const RING  = CFG.ringPos;

/* ============================== 渲染器 / 场景 ============================== */
const stage = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
} catch(e) { throw new Error('WebGL 初始化失败：' + e.message); }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 0.1, 120);
camera.position.set(6.2, 3.6, 8.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.2, 0.95, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 2.4; controls.maxDistance = 24;
controls.maxPolarAngle = 1.53;

/* 环境反射（供亚克力高光使用） */
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}

/* 海报化竖直渐变背景（量化为色带） */
function makeBandBackground(){
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 512;
  const g = cv.getContext('2d');
  const stops = ['#a8d8e0','#c8e4dd','#eaf0da','#fff3df','#ffeccd','#ffdcb8'];
  const n = stops.length - 1;
  for(let i=0;i<n;i++){ g.fillStyle = stops[i]; g.fillRect(0, Math.floor(i*cv.height/n), cv.width, Math.ceil(cv.height/n)+1); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
scene.background = makeBandBackground();

/* ============================== 灯光 ============================== */
scene.add(new THREE.HemisphereLight(0xfff4e0, 0xffd9ad, 0.85));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(5, 8, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -7; keyLight.shadow.camera.right = 7;
keyLight.shadow.camera.top  =  7; keyLight.shadow.camera.bottom = -3;
keyLight.shadow.camera.near = 1;  keyLight.shadow.camera.far = 24;
keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xcfe8ff, 0.32);
fillLight.position.set(-6, 4, -4);
scene.add(fillLight);

/* ============================== 材质工厂 ============================== */
/* 4 级赛璐璐梯度图 */
const gradData = new Uint8Array([120,120,120,255, 178,178,178,255, 224,224,224,255, 255,255,255,255]);
const gradTex = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
gradTex.magFilter = THREE.NearestFilter; gradTex.minFilter = THREE.NearestFilter;
gradTex.needsUpdate = true;

const toon = (hex, opt={}) => new THREE.MeshToonMaterial(Object.assign({ color:hex, gradientMap:gradTex }, opt));

const M = {
  ring    : toon(0xff7a3c),                    // 牙盘（阳极橙）
  cogA    : toon(0x8698b0),                    // 飞轮偶数片
  cogB    : toon(0x6d7d94),                    // 飞轮奇数片
  crank   : toon(0x3c414d),                    // 曲柄
  pedal   : toon(0x2c2f36),
  chainOut: toon(0x30343f),                    // 链条外链板
  chainIn : toon(0x9aa4b5),                    // 内链滚子
  derBody : toon(0x55607a),                    // 后拨主体
  derCage : toon(0x48536b),
  pulley  : toon(0xbfcadb),
  axle    : toon(0x8d97ab),
  wood    : toon(0xe2a868),
  woodDark: toon(0xc98f4f),
  cream   : toon(0xf5e6cd),
  teal    : toon(0x2ec4b6),
  coffee  : toon(0x6b4a32),
  ink     : toon(0x241f2e),
};

/* 墨线反壳材质（法线外推 BackSide），按粗细缓存 */
const _outlineCache = {};
function outlineMat(th){
  if(!_outlineCache[th]){
    _outlineCache[th] = new THREE.ShaderMaterial({
      uniforms:{ th:{ value: th } },
      vertexShader:`uniform float th;
        void main(){
          vec3 p = position + normal * th;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader:`void main(){ gl_FragColor = vec4(0.135, 0.115, 0.165, 1.0); }`,
      side: THREE.BackSide
    });
  }
  return _outlineCache[th];
}
const _outlinedGeoms = new Set();
function addOutline(mesh, th = 0.02){
  if(_outlinedGeoms.has(mesh.uuid)) return;
  _outlinedGeoms.add(mesh.uuid);
  const o = new THREE.Mesh(mesh.geometry, outlineMat(th));
  o.renderOrder = 1;
  mesh.add(o);
}
window.__outlineMats = Object.values; // 占位引用避免压缩器误判（实际通过遍历场景切换）

/* 描边总开关：切换所有反壳材质 visible */
function setOutlines(on){
  scene.traverse(o => {
    if(o.isMesh && o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide){
      o.visible = on ? (o.userData.baseVisible !== false) : false;
      if(on) o.userData.baseVisible = true;
    }
  });
  outlinesOn = on;
}
let outlinesOn = true;

/* ============================== 几何工具 ============================== */
/* 直齿轮廓（梯形齿），Extrude 出低多边形齿片 */
function toothedDiscGeo(teeth, rRoot, rTip, depth, holeR, spiderHoles){
  const shape = new THREE.Shape();
  const tau = TAU / teeth;
  for(let i=0;i<teeth;i++){
    const a = i * tau;
    const a0=a, a1=a+tau*0.34, a2=a+tau*0.44, a3=a+tau*0.70, a4=a+tau*0.80;
    if(i===0) shape.moveTo(Math.cos(a0)*rRoot, Math.sin(a0)*rRoot);
    else      shape.lineTo(Math.cos(a0)*rRoot, Math.sin(a0)*rRoot);
    shape.lineTo(Math.cos(a1)*rRoot, Math.sin(a1)*rRoot);
    shape.lineTo(Math.cos(a2)*rTip , Math.sin(a2)*rTip );
    shape.lineTo(Math.cos(a3)*rTip , Math.sin(a3)*rTip );
    shape.lineTo(Math.cos(a4)*rRoot, Math.sin(a4)*rRoot);
  }
  shape.closePath();
  if(holeR > 0){
    const h = new THREE.Path(); h.absarc(0, 0, holeR, 0, TAU, true); shape.holes.push(h);
  }
  if(spiderHoles){ // 牙盘镂空辐板孔
    for(let k=0;k<5;k++){
      const a = k/5*TAU + TAU/10;
      const h = new THREE.Path();
      h.absarc(Math.cos(a)*0.55, Math.sin(a)*0.55, 0.155, 0, TAU, true);
      shape.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:1 });
  geo.translate(0, 0, -depth/2);
  geo.computeVertexNormals();
  return geo;
}
const box = (w,h,d) => new THREE.BoxGeometry(w,h,d);
const cyl = (rt,rb,h,seg=14) => new THREE.CylinderGeometry(rt,rb,h,seg);

function shadow(mesh, cast=true, receive=false){
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}

/* ============================== 静态环境：工作台 / 背景 ============================== */
{
  const envGroup = new THREE.Group(); scene.add(envGroup);

  /* 图形化太阳圆盘（海报感背景元素） */
  const sunMat = new THREE.MeshBasicMaterial({ color:0xffcf9c });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(2.5, 44), sunMat);
  sun.position.set(-1.4, 3.6, -5.2); envGroup.add(sun);
  const sunRing = new THREE.Mesh(new THREE.RingGeometry(2.68, 2.76, 44),
    new THREE.MeshBasicMaterial({ color:0xf0b183 }));
  sunRing.position.copy(sun.position); envGroup.add(sunRing);

  /* 半调网点墙 */
  const dcv = document.createElement('canvas'); dcv.width = dcv.height = 96;
  const dg = dcv.getContext('2d');
  dg.fillStyle = 'rgba(214,160,110,0.30)';
  dg.beginPath(); dg.arc(48,48,7,0,TAU); dg.fill();
  const dotTex = new THREE.CanvasTexture(dcv);
  dotTex.wrapS = dotTex.wrapT = THREE.RepeatWrapping; dotTex.repeat.set(14, 6);
  const dots = new THREE.Mesh(new THREE.PlaneGeometry(20, 9),
    new THREE.MeshBasicMaterial({ map:dotTex, transparent:true, depthWrite:false }));
  dots.position.set(0, 3.1, -5.0); envGroup.add(dots);

  /* 工作台 */
  const top = shadow(new THREE.Mesh(box(12.4, 0.24, 5.0), M.wood), false, true);
  top.position.set(0, -0.12, 0.3); top.receiveShadow = true; envGroup.add(top);
  addOutline(top, 0.022);
  const apron = new THREE.Mesh(box(11.6, 0.34, 0.16), M.woodDark);
  apron.position.set(0, -0.40, 2.72); envGroup.add(apron);
  for(const [lx,lz] of [[-5.4,-1.7],[5.4,-1.7],[-5.4,2.2],[5.4,2.2]]){
    const leg = new THREE.Mesh(box(0.24, 2.2, 0.24), M.woodDark);
    leg.position.set(lx, -1.34, lz); envGroup.add(leg);
  }

  /* 小道具：马克杯 / 螺丝刀 / 螺栓 —— 提供尺度感 */
  const mug = new THREE.Group();
  const mugB = shadow(new THREE.Mesh(cyl(0.155,0.145,0.28,18), M.teal), true, false);
  mugB.position.y = 0.14; mug.add(mugB);
  addOutline(mugB, 0.014);
  const handle = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.026, 8, 18), M.teal), true, false);
  handle.position.set(0.175, 0.15, 0); mug.add(handle);
  const cof = new THREE.Mesh(new THREE.CircleGeometry(0.128, 18), M.coffee);
  cof.rotation.x = -Math.PI/2; cof.position.y = 0.245; mug.add(cof);
  mug.position.set(3.75, 0, 1.65); envGroup.add(mug);

  const driver = new THREE.Group();
  const shaft = shadow(new THREE.Mesh(cyl(0.018,0.018,0.5,10), M.axle), true, false);
  shaft.rotation.z = Math.PI/2; shaft.position.x = -0.28; driver.add(shaft);
  const grip = shadow(new THREE.Mesh(cyl(0.048,0.042,0.17,12), M.ring), true, false);
  grip.rotation.z = Math.PI/2; grip.position.x = 0.06; driver.add(grip);
  addOutline(grip, 0.012);
  driver.position.set(-3.9, 0.045, 1.5); driver.rotation.y = -0.5; envGroup.add(driver);

  for(const [bx,bz] of [[-2.9, 1.9],[3.1, -1.4]]){
    const bolt = shadow(new THREE.Mesh(cyl(0.05,0.05,0.045,6), M.derBody), true, false);
    bolt.position.set(bx, 0.023, bz); envGroup.add(bolt);
  }
}

/* ============================== 亚克力展示支架 ============================== */
{
  const stand = new THREE.Group(); scene.add(stand);
  const acrylic = new THREE.MeshPhysicalMaterial({
    color:0xd8ecff, transparent:true, opacity:0.22,
    roughness:0.06, metalness:0, clearcoat:1, clearcoatRoughness:0.08,
    envMapIntensity:1.5, depthWrite:false
  });

  function plate(w, h, d){
    const m = new THREE.Mesh(box(w,h,d), acrylic);
    m.renderOrder = 10;                       // 半透明最后绘制
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box(w,h,d)),
      new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.6 }));
    edges.renderOrder = 11; m.add(edges);
    return m;
  }
  /* 底座 slab */
  const base = plate(6.4, 0.07, 1.38); base.position.set(-0.03, 0.035, 0); stand.add(base);
  /* 前后两块立板（夹持 BB 与后轴位置，避开链平面 ±0.2） */
  for(const px of [RING.x, CFG.cogX]){
    const p = plate(1.06, 1.78, 0.035);
    p.position.set(px, 0.96, 0); stand.add(p);
  }
  /* 立板前后加强筋（三角肋） */
  const gussetShape = new THREE.Shape();
  gussetShape.moveTo(0,0); gussetShape.lineTo(0.5,0); gussetShape.lineTo(0,0.62); gussetShape.closePath();
  const gusGeo = new THREE.ExtrudeGeometry(gussetShape, { depth:0.03, bevelEnabled:false });
  for(const px of [RING.x, CFG.cogX]) for(const zs of [-0.66, 0.66]){
    const g = new THREE.Mesh(gusGeo, acrylic);
    g.rotation.y = Math.PI/2; g.scale.set(zs>0?1:-1, 1, 1);
    g.position.set(px - 0.03*(zs>0?1:-1)*0, 0.07, zs + (zs>0?-0.03:0.03)*0);
    g.position.z = zs; g.scale.x = zs>0 ? 1 : 1;
    /* 用镜像摆放：正面朝外 */
    g.rotation.y = zs>0 ? -Math.PI/2 : Math.PI/2;
    g.position.x = px + (zs>0 ? 0.53 : -0.53);
    g.renderOrder = 10; stand.add(g);
  }
  /* 铭牌（CanvasTexture 文字贴片） */
  const pcv = document.createElement('canvas'); pcv.width = 512; pcv.height = 150;
  const pg = pcv.getContext('2d');
  pg.fillStyle = '#fff6e7'; pg.fillRect(0,0,512,150);
  pg.strokeStyle = '#241f2e'; pg.lineWidth = 10; pg.strokeRect(7,7,498,136);
  pg.fillStyle = '#241f2e'; pg.textAlign = 'center';
  pg.font = '700 44px Consolas, monospace';
  pg.fillText('LOW-POLY DRIVETRAIN', 256, 64);
  pg.font = '600 30px Consolas, monospace'; pg.fillStyle = '#c05f22';
  pg.fillText('46T × 12–28T · 7-SPEED · NPR', 256, 116);
  const plaqueTex = new THREE.CanvasTexture(pcv); plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.44),
    new THREE.MeshBasicMaterial({ map:plaqueTex }));
  plaque.position.set((RING.x+CFG.cogX)/2, 1.62, 0.585); stand.add(plaque);
  const plaqueBack = plaque.clone(); plaqueBack.rotation.y = Math.PI;
  plaqueBack.position.z = -0.585; stand.add(plaqueBack);
}

/* ============================== 传动主体 ============================== */
const drivetrain = new THREE.Group(); scene.add(drivetrain);

/* ---- 五通轴 & 轴承座（静态） ---- */
{
  const bb = new THREE.Group(); bb.position.set(RING.x, RING.y, 0); drivetrain.add(bb);
  const shaft = shadow(new THREE.Mesh(cyl(0.05, 0.05, 1.24, 12), M.axle), true, false);
  shaft.rotation.x = Math.PI/2; bb.add(shaft);
  for(const zs of [-0.56, 0.56]){
    const bear = shadow(new THREE.Mesh(cyl(0.15, 0.15, 0.07, 18), M.derBody), true, false);
    bear.rotation.x = Math.PI/2; bear.position.z = zs; bb.add(bear);
    addOutline(bear, 0.012);
  }
}
/* ---- 后轴 & 桶轴（静态） ---- */
{
  const hub = new THREE.Group(); hub.position.set(CFG.cogX, CFG.cogY, 0); drivetrain.add(hub);
  const shaft = shadow(new THREE.Mesh(cyl(0.045, 0.045, 1.24, 12), M.axle), true, false);
  shaft.rotation.x = Math.PI/2; hub.add(shaft);
  for(const zs of [-0.33, 0.33]){
    const cone = shadow(new THREE.Mesh(cyl(0.09, 0.09, 0.06, 16), M.derBody), true, false);
    cone.rotation.x = Math.PI/2; cone.position.z = zs; hub.add(cone);
  }
}

/* ---- 牙盘 + 曲柄（旋转体） ---- */
const crankGroup = new THREE.Group();
crankGroup.position.set(RING.x, RING.y, 0);
drivetrain.add(crankGroup);
{
  const ringGeo = toothedDiscGeo(CFG.ringTeeth, 0.985, 1.045, 0.34, 0.12, true);
  const ringMesh = shadow(new THREE.Mesh(ringGeo, M.ring), true, false);
  crankGroup.add(ringMesh);
  addOutline(ringMesh, 0.02);
  /* 盘片装饰铆钉 */
  for(let k=0;k<5;k++){
    const a = k/5*TAU;
    const rivet = new THREE.Mesh(cyl(0.035,0.035,0.38,10), M.chainIn);
    rivet.rotation.x = Math.PI/2;
    rivet.position.set(Math.cos(a)*0.55, Math.sin(a)*0.55, 0);
    crankGroup.add(rivet);
  }
  /* 右曲柄（z+） */
  const armR = new THREE.Mesh(box(0.72, 0.14, 0.06), M.crank);
  armR.position.set(0.31, 0, 0.245); shadow(armR, true, false); crankGroup.add(armR);
  addOutline(armR, 0.014);
  /* 左曲柄（z−，相位相反） */
  const armL = new THREE.Mesh(box(0.72, 0.14, 0.06), M.crank);
  armL.position.set(-0.31, 0, -0.245); shadow(armL, true, false); crankGroup.add(armL);
  addOutline(armL, 0.014);
}
/* 脚踏（反向自转保持水平）——挂在曲柄组下，逐帧抵消旋转 */
const pedalR = new THREE.Group(), pedalL = new THREE.Group();
{
  for(const [pg, sx, pz] of [[pedalR, 1, 0.315], [pedalL, -1, -0.315]]){
    const spindle = new THREE.Mesh(cyl(0.022,0.022,0.1,10), M.axle);
    spindle.rotation.x = Math.PI/2; spindle.position.z = pz - Math.sign(pz)*0.05;
    pg.add(spindle);
    const body = shadow(new THREE.Mesh(box(0.30, 0.045, 0.14), M.pedal), true, false);
    body.position.z = pz; pg.add(body);
    addOutline(body, 0.012);
    for(const px of [-0.11, 0.11]){ // 脚踏钉
      const pin = new THREE.Mesh(cyl(0.012,0.012,0.055,6), M.chainIn);
      pin.position.set(px, 0.03, pz); pg.add(pin);
    }
    pg.position.set(sx * 0.64, 0, 0);
    crankGroup.add(pg);
  }
}

/* ---- 飞轮组（旋转体，共享花鼓转速） ---- */
const cassetteGroup = new THREE.Group();
cassetteGroup.position.set(CFG.cogX, CFG.cogY, 0);
drivetrain.add(cassetteGroup);
const cogMeshes = [];
{
  /* 棘轮体（花鼓） */
  const freehub = shadow(new THREE.Mesh(cyl(0.088, 0.088, 0.42, 14), M.derBody), true, false);
  freehub.rotation.x = Math.PI/2; cassetteGroup.add(freehub);
  const lock = shadow(new THREE.Mesh(cyl(0.062, 0.062, 0.03, 12), M.axle), true, false);
  lock.rotation.x = Math.PI/2; lock.position.z = 0.225; cassetteGroup.add(lock);

  for(let i=0;i<CFG.cogs.length;i++){
    const r = cogR(i), T = CFG.cogs[i];
    const geo = toothedDiscGeo(T, r-0.016, r+0.022, 0.046, 0.075, false);
    const mesh = shadow(new THREE.Mesh(geo, i%2===0 ? M.cogA : M.cogB), true, false);
    mesh.position.z = cogZ(i);
    cassetteGroup.add(mesh); cogMeshes.push(mesh);
    addOutline(mesh, 0.009);
  }
}

/* ---- 后拨链器（位置逐帧更新：导轮水平移动） ---- */
const derailleur = new THREE.Group();       // 锚点 = 导轮(GP)
drivetrain.add(derailleur);
const cageOff = CFG.tpOff;
let pulleyTop, pulleyBot;
{
  /* 拨尾板（连接导向轮与张力轮的笼板） */
  const cageLen = Math.hypot(cageOff.x, cageOff.y);
  const cageAng = ang(cageOff.x, cageOff.y);
  for(const cz of [-0.052, 0.052]){
    const plate = shadow(new THREE.Mesh(box(0.09, cageLen + 0.10, 0.012), M.derCage), true, false);
    plate.position.set(cageOff.x/2, cageOff.y/2, cz);
    plate.rotation.z = cageAng + Math.PI/2;
    derailleur.add(plate);
    addOutline(plate, 0.008);
  }
  /* 平行四边形连杆（装饰性） */
  for(const lz of [-0.085, 0.085]){
    const link = shadow(new THREE.Mesh(box(0.045, 0.27, 0.012), M.derBody), true, false);
    link.position.set(-0.015, -0.10, lz);
    link.rotation.z = 0.42;
    derailleur.add(link);
  }
  /* 主结点（knuckle） */
  const knuckle = shadow(new THREE.Mesh(box(0.17, 0.13, 0.11), M.derBody), true, false);
  knuckle.position.set(0.01, 0.045, 0.115); derailleur.add(knuckle);
  addOutline(knuckle, 0.010);
  const bTab = shadow(new THREE.Mesh(box(0.06, 0.16, 0.03), M.derBody), true, false);
  bTab.position.set(0.055, 0.16, 0.115); bTab.rotation.z = -0.5; derailleur.add(bTab);

  /* 双导轮（11T 齿形，可见齿距） */
  const pGeo = toothedDiscGeo(11, 0.082, 0.104, 0.085, 0.028, false);
  pulleyTop = shadow(new THREE.Mesh(pGeo, M.pulley), true, false);
  derailleur.add(pulleyTop); addOutline(pulleyTop, 0.007);
  pulleyBot = shadow(new THREE.Mesh(pGeo, M.pulley), true, false);
  pulleyBot.position.set(cageOff.x, cageOff.y, 0);
  derailleur.add(pulleyBot); addOutline(pulleyBot, 0.007);
  for(const p of [pulleyTop, pulleyBot]){
    const cap = new THREE.Mesh(cyl(0.028, 0.028, 0.11, 10), M.chainIn);
    cap.rotation.x = Math.PI/2; p.add(cap);
  }
}
/* 变速器吊架：从后轴到 knuckle 的支撑板（逐帧伸缩对位） */
const hangerPlate = new THREE.Mesh(box(1, 0.05, 0.028), M.derCage);
hangerPlate.castShadow = true; drivetrain.add(hangerPlate);
addOutline(hangerPlate, 0.009);
const axleClamp = shadow(new THREE.Mesh(cyl(0.075, 0.075, 0.09, 14), M.derBody), true, false);
axleClamp.rotation.x = Math.PI/2; drivetrain.add(axleClamp);

/* ============================== 链条系统 ============================== */
/* --- 2D 切线解算 --- */
function extTan(ax, ay, ra, bx, by, rb, pref){   // 外公切线：两侧同号法向
  const dx=bx-ax, dy=by-ay, d=Math.hypot(dx,dy)||1e-9;
  const ux=dx/d, uy=dy/d, px=-uy, py=ux;
  const s=clamp((rb-ra)/d, -1, 1), c=Math.sqrt(Math.max(0, 1-s*s));
  const m1={x:c*px+s*ux, y:c*py+s*uy}, m2={x:-c*px+s*ux, y:-c*py+s*uy};
  const m = pref(m1,m2) ? m1 : m2;
  return { ax2:ax+ra*m.x, ay2:ay+ra*m.y, bx2:bx+rb*m.x, by2:by+rb*m.y };
}
function intTan(ax, ay, ra, bx, by, rb, pref){   // 内公切线：两圆异侧
  const dx=bx-ax, dy=by-ay, d=Math.hypot(dx,dy)||1e-9;
  const ux=dx/d, uy=dy/d, px=-uy, py=ux;
  const s=clamp((ra+rb)/d, -1, 1), c=Math.sqrt(Math.max(0, 1-s*s));
  const m1={x:c*px+s*ux, y:c*py+s*uy}, m2={x:-c*px+s*ux, y:-c*py+s*uy};
  const m = pref(m1,m2) ? m1 : m2;
  return { ax2:ax+ra*m.x, ay2:ay+ra*m.y, bx2:bx-rb*m.x, by2:by-rb*m.y };
}

/* 路径折线容器（预分配，零 GC） */
const MAXPTS = 2048;
const P = { xs:new Float64Array(MAXPTS), ys:new Float64Array(MAXPTS),
            cs:new Float64Array(MAXPTS), n:0, total:0 };
function pPush(x, y){
  if(P.n > 0){
    const dx=x-P.xs[P.n-1], dy=y-P.ys[P.n-1];
    if(dx*dx+dy*dy < 1e-12) return;
  }
  P.xs[P.n]=x; P.ys[P.n]=y; P.n++;
}
function pArc(cx, cy, r, a0, a1, dir){
  const sweep = dir>0 ? mod(a1-a0, TAU) : mod(a0-a1, TAU);
  const steps = Math.max(2, Math.ceil(sweep/0.06));
  for(let k=1;k<=steps;k++){
    const a = a0 + dir*sweep*k/steps;
    pPush(cx + r*Math.cos(a), cy + r*Math.sin(a));
  }
}
/* 核心解算：输入有效状态 {rc, gpx}，输出闭合链条中心线 */
function solvePath(rc, gpx){
  P.n = 0;
  const gp = { x:gpx, y:CFG.gpY };
  const tp = { x:gpx+cageOff.x, y:CFG.gpY+cageOff.y };

  /* ① 飞轮顶切点 → 牙盘顶切点（上拉紧边） */
  const tA = extTan(CFG.cogX, CFG.cogY, rc, RING.x, RING.y, CFG.ringR, m=>m.y>0);
  pPush(tA.ax2, tA.ay2); pPush(tA.bx2, tA.by2);

  /* ② 牙盘绕前弧（顺时针 ~180°）到底部切点 */
  const tB = intTan(RING.x, RING.y, CFG.ringR, gp.x, gp.y, CFG.gpR, m=>m.y<0);
  pArc(RING.x, RING.y, CFG.ringR,
       ang(tA.bx2-RING.x, tA.by2-RING.y),
       ang(tB.ax2-RING.x, tB.ay2-RING.y), -1);

  /* ③ 回程松弛边：牙盘底 → 导轮顶部（内公切线，链搭在导轮上方） */
  pPush(tB.bx2, tB.by2);

  /* ④ 导轮 S 弯（逆时针小弧：顶→后上） */
  const tC = extTan(gp.x, gp.y, CFG.gpR, tp.x, tp.y, CFG.tpR, m=>m.x<0);
  pArc(gp.x, gp.y, CFG.gpR,
       ang(tB.bx2-gp.x, tB.by2-gp.y),
       ang(tC.ax2-gp.x, tC.ay2-gp.y), +1);

  /* ⑤ 笼桥：导向轮背 → 张力轮背 */
  pPush(tC.bx2, tC.by2);

  /* ⑥ 张力轮 U 弯（逆时针大弧：后上→底→前下） */
  const tD = extTan(tp.x, tp.y, CFG.tpR, CFG.cogX, CFG.cogY, rc, m=>m.y<0);
  pArc(tp.x, tp.y, CFG.tpR,
       ang(tC.bx2-tp.x, tC.by2-tp.y),
       ang(tD.ax2-tp.x, tD.ay2-tp.y), +1);

  /* ⑦ 张力轮 → 飞轮啮入边 */
  pPush(tD.bx2, tD.by2);

  /* ⑧ 飞轮包角弧（顺时针经底部与背部 → 回到顶切点，闭合） */
  pArc(CFG.cogX, CFG.cogY, rc,
       ang(tD.bx2-CFG.cogX, tD.by2-CFG.cogY),
       ang(tA.ax2-CFG.cogX, tA.ay2-CFG.cogY), -1);

  /* 闭合并累积弧长 */
  pPush(P.xs[0], P.ys[0]);
  P.cs[0]=0;
  for(let i=1;i<P.n;i++){
    const dx=P.xs[i]-P.xs[i-1], dy=P.ys[i]-P.ys[i-1];
    P.cs[i]=P.cs[i-1]+Math.hypot(dx,dy);
  }
  P.total = P.cs[P.n-1];
}
/* 弧长取点：返回位置与切线角 */
function pathSample(s, out){
  s = mod(s, P.total);
  let lo=0, hi=P.n-1;
  while(lo<hi){ const mid=(lo+hi)>>1; if(P.cs[mid]<=s) lo=mid+1; else hi=mid; }
  const i = Math.max(1, lo);
  const seg = P.cs[i]-P.cs[i-1] || 1e-9;
  const t = (s-P.cs[i-1])/seg;
  out.x = lerp(P.xs[i-1], P.xs[i], t);
  out.y = lerp(P.ys[i-1], P.ys[i], t);
  out.a = ang(P.xs[i]-P.xs[i-1], P.ys[i]-P.ys[i-1]);
}

/* --- 链条实例化网格 --- */
const linkOuterGeo = mergeGeometries([
  box(0.115, 0.054, 0.013).translate(0, 0,  0.019),
  box(0.115, 0.054, 0.013).translate(0, 0, -0.019),
]);
const linkInnerGeo = mergeGeometries([
  box(0.075, 0.038, 0.030),
  cyl(0.027, 0.027, 0.048, 10).rotateX(Math.PI/2),
]);
const chainOuter = new THREE.InstancedMesh(linkOuterGeo, M.chainOut, CFG.nLinks);
const chainInner = new THREE.InstancedMesh(linkInnerGeo, M.chainIn, CFG.nLinks);
chainOuter.frustumCulled = false; chainInner.frustumCulled = false;
chainOuter.castShadow = true; chainInner.castShadow = true;
drivetrain.add(chainOuter, chainInner);

const _dummy = new THREE.Object3D();
const _samp  = { x:0, y:0, a:0 };
function updateChainInstances(cz){
  const L = P.total, N = CFG.nLinks;
  for(let i=0;i<N;i++){
    pathSample(i*L/N + state.sOffset, _samp);
    _dummy.position.set(_samp.x, _samp.y, cz);
    _dummy.rotation.set(0, 0, _samp.a);
    _dummy.updateMatrix();
    if(i%2===0) chainOuter.setMatrixAt(i, _dummy.matrix);
    else        chainInner.setMatrixAt(i, _dummy.matrix);
  }
  chainOuter.instanceMatrix.needsUpdate = true;
  chainInner.instanceMatrix.needsUpdate = true;
}

/* ============================== 状态机 ============================== */
const state = {
  motor   : false,
  omega   : 0,          // 当前曲柄角速度（平滑趋近目标）
  gear    : 2,          // 显示挡位 = gear+1（初始 Gear: 3/7）
  cur     : null,       // 有效混合参数 {rc, gpx, cz}
  sOffset : 0,          // 链条相位
  camTween: null,
  hudT    : 0,
};
function gearTargets(g){
  return { rc: cogR(g), gpx: gpX(g), cz: cogZ(g) };
}
state.cur = Object.assign({}, gearTargets(state.gear));   // 无跳变初始化

function setMotor(on){
  state.motor = on;
  audioSetHum(on);
  btnMotor.textContent = on ? '❚❚ 停止电机' : '▶ 启动电机';
  btnMotor.classList.toggle('run', on);
}
function shift(dir){
  const ng = clamp(state.gear + dir, 0, CFG.cogs.length-1);
  if(ng === state.gear) return;
  state.gear = ng;
  audioTick(dir);
  refreshHUD();
}
function resetAll(){
  setMotor(false);
  state.gear = 2;
  refreshHUD();
  goCam(0);
}

/* ============================== 相机预设 ============================== */
const CAM_PRESETS = [
  { pos:[ 6.2, 3.6,  8.6], tar:[-0.2, 0.95, 0] },   // 全景
  { pos:[ 0.3, 1.55, 10.4], tar:[ 0.0, 1.05, 0] },  // 传动侧面正交感
  { pos:[ 6.6, 2.0,  3.4], tar:[ 2.55, 1.05, 0] },  // 牙盘特写
  { pos:[-6.1, 1.6,  3.2], tar:[-2.6, 0.95, 0] },   // 飞轮特写
  { pos:[ 0.4, 9.4,  3.0], tar:[ 0.0, 0.60, 0] },   // 俯瞰
];
function goCam(i){
  const p = CAM_PRESETS[i];
  state.camTween = {
    t:0, dur:0.9,
    fp: camera.position.clone(), tp: new THREE.Vector3(...p.pos),
    ft: controls.target.clone(), tt: new THREE.Vector3(...p.tar),
  };
  controls.enabled = false;
}
renderer.domElement.addEventListener('pointerdown', () => {
  if(state.camTween){ state.camTween = null; controls.enabled = true; }
});

/* ============================== 音效（可关，懒加载） ============================== */
const audio = { ctx:null, hum:null, humGain:null, enabled:false };
function audioInit(){
  if(audio.ctx) return;
  try {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.humGain = audio.ctx.createGain(); audio.humGain.gain.value = 0;
    audio.humGain.connect(audio.ctx.destination);
    audio.hum = audio.ctx.createOscillator();
    audio.hum.type = 'sawtooth'; audio.hum.frequency.value = 58;
    const lp = audio.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    audio.hum.connect(lp); lp.connect(audio.humGain);
    audio.hum.start();
  } catch(e){ audio.ctx = null; }
}
function audioSetHum(on){
  if(!audio.enabled || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  audio.humGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.25);
}
function audioTick(dir){
  if(!audio.enabled || !audio.ctx) return;
  try {
    const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
    o.type = 'square'; o.frequency.value = dir > 0 ? 1500 : 1050;
    g.gain.value = 0.06;
    g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + 0.06);
    o.connect(g); g.connect(audio.ctx.destination);
    o.start(); o.stop(audio.ctx.currentTime + 0.07);
  } catch(e){}
}

/* ============================== UI 绑定 ============================== */
const $ = id => document.getElementById(id);
const btnMotor = $('btnMotor');
btnMotor.addEventListener('click', () => setMotor(!state.motor));
$('btnUp').addEventListener('click', () => shift(+1));
$('btnDown').addEventListener('click', () => shift(-1));
$('btnReset').addEventListener('click', resetAll);
document.querySelectorAll('[data-cam]').forEach(b =>
  b.addEventListener('click', () => goCam(+b.dataset.cam)));
$('btnOutline').addEventListener('click', e => {
  setOutlines(!outlinesOn);
  e.currentTarget.classList.toggle('off', !outlinesOn);
});
$('btnPixel').addEventListener('click', e => {
  post.pixelate = !post.pixelate;
  e.currentTarget.classList.toggle('off', !post.pixelate);
});
$('btnSound').addEventListener('click', e => {
  audio.enabled = !audio.enabled;
  if(audio.enabled){ audioInit(); audioSetHum(state.motor); }
  else if(audio.ctx){ audio.humGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05); }
  e.currentTarget.classList.toggle('off', !audio.enabled);
  e.currentTarget.textContent = audio.enabled ? '🔊 声音' : '🔇 声音';
});
addEventListener('keydown', ev => {
  if(ev.code === 'Space'){ ev.preventDefault(); setMotor(!state.motor); }
  else if(ev.code === 'ArrowUp'){ ev.preventDefault(); shift(+1); }
  else if(ev.code === 'ArrowDown'){ ev.preventDefault(); shift(-1); }
  else if(ev.code === 'KeyR') resetAll();
  else if(/^Digit[1-5]$/.test(ev.code)) goCam(+ev.code.slice(5)-1);
});

/* 挡位条 */
const gearCells = [];
{
  const bar = $('gearBar');
  const names = ['爬坡','轻松','中间','过渡','巡航','竞速','冲刺'];
  CFG.cogs.forEach((T, i) => {
    const c = document.createElement('div');
    c.className = 'cell';
    c.innerHTML = `<b>${T}T</b><i>${names[i]}</i>`;
    c.addEventListener('click', () => { shift(i - state.gear); });
    bar.appendChild(c); gearCells.push(c);
  });
}
const GEAR_NAMES = ['爬坡挡','轻松挡','中间挡','过渡挡','巡航挡','竞速挡','冲刺挡'];
function refreshHUD(){
  const g = state.gear, T = CFG.cogs[g], ratio = CFG.ringTeeth / T;
  $('gearBig').innerHTML = `Gear: ${g+1}/${CFG.cogs.length} <small id="gearName">· ${GEAR_NAMES[g]}</small>`;
  $('spCog').textContent   = `${T} T`;
  $('spRatio').textContent = ratio.toFixed(2);
  $('rlCog').textContent   = T;
  $('rlRatio').textContent = ratio.toFixed(2);
  gearCells.forEach((c,i) => c.classList.toggle('on', i===g));
}
refreshHUD();

/* ============================== 像素化后期管线 ============================== */
const post = {
  pixelate:false, rt:null, rtW:0, rtH:0,
  scene:new THREE.Scene(),
  cam:new THREE.OrthographicCamera(-1,1,1,-1,0,1),
};
{
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2),
    new THREE.MeshBasicMaterial({ depthTest:false, depthWrite:false }));
  post.scene.add(quad);
  post.quad = quad;
}
function ensureRT(w, h){
  w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
  if(post.rt && post.rtW === w && post.rtH === h) return;
  if(post.rt) post.rt.dispose();
  post.rt = new THREE.WebGLRenderTarget(w, h, {
    magFilter:THREE.NearestFilter, minFilter:THREE.NearestFilter });
  post.rt.texture.colorSpace = THREE.SRGBColorSpace;
  post.quad.material.map = post.rt.texture;
  post.rtW = w; post.rtH = h;
}

/* ============================== 尺寸自适应 ============================== */
function onResize(){
  const w = innerWidth, h = innerHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);

/* ============================== 主循环 ============================== */
const clock = new THREE.Clock();
const easeIO = t => t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const tgt = gearTargets(state.gear);

  /* --- 参数平滑（换挡插值：飞轮半径 / 导轮水平位置 / 链平面 z） --- */
  const K = 7;
  state.cur.rc  = damp(state.cur.rc , tgt.rc , K, dt);
  state.cur.gpx = damp(state.cur.gpx, tgt.gpx, K, dt);
  state.cur.cz  = damp(state.cur.cz , tgt.cz , K, dt);

  /* --- 电机加减速 --- */
  state.omega = damp(state.omega, state.motor ? CFG.omegaMax : 0, 1.7, dt);
  const v = state.omega * CFG.ringR;                 // 链速（单位/s）

  /* --- 传动同步旋转 --- */
  crankGroup.rotation.z -= state.omega * dt;                        // 牙盘+曲柄 CW
  cassetteGroup.rotation.z -= (v / state.cur.rc) * dt;              // 飞轮随链
  pulleyTop.rotation.z += (v / CFG.gpR) * dt;                       // 导轮 CCW
  pulleyBot.rotation.z += (v / CFG.tpR) * dt;                       // 张力轮 CCW
  pedalR.rotation.z = -crankGroup.rotation.z;                       // 脚踏保持水平
  pedalL.rotation.z = -crankGroup.rotation.z;
  if(audio.enabled && audio.ctx && audio.hum)
    audio.hum.frequency.setTargetAtTime(50 + state.omega*9, audio.ctx.currentTime, 0.1);

  /* --- 后拨锚定 & 吊架对位 --- */
  derailleur.position.set(state.cur.gpx, CFG.gpY, state.cur.cz);
  {
    const ax = CFG.cogX, ay = CFG.cogY;
    const kx = state.cur.gpx + 0.01, ky = CFG.gpY + 0.16;
    const dx = kx-ax, dy = ky-ay, len = Math.hypot(dx, dy);
    hangerPlate.scale.x = len;
    hangerPlate.position.set((ax+kx)/2, (ay+ky)/2, state.cur.cz + 0.135);
    hangerPlate.rotation.z = ang(dx, dy);
    axleClamp.position.set(ax, ay, state.cur.cz + 0.135);
  }

  /* --- 链条：解算路径 → 实例化排布 --- */
  solvePath(state.cur.rc, state.cur.gpx);
  state.sOffset = mod(state.sOffset + v*dt, P.total || 1);
  updateChainInstances(state.cur.cz);

  /* --- 相机补间 --- */
  if(state.camTween){
    const tw = state.camTween;
    tw.t += dt;
    const t = clamp(tw.t/tw.dur, 0, 1), e = easeIO(t);
    camera.position.lerpVectors(tw.fp, tw.tp, e);
    controls.target.lerpVectors(tw.ft, tw.tt, e);
    if(t >= 1){ state.camTween = null; controls.enabled = true; }
  }
  controls.update();

  /* --- HUD 节流刷新 --- */
  state.hudT += dt;
  if(state.hudT > 0.15){
    state.hudT = 0;
    const cadence = state.omega * 60 / TAU;
    const wheelRPM = cadence * (CFG.ringTeeth / CFG.cogs[state.gear]);
    const kmh = wheelRPM * Math.PI * 0.7 * 60 / 1000;
    $('spCad').textContent = `${cadence.toFixed(0)} RPM`;
    $('spSpd').textContent = `${kmh.toFixed(1)} km/h`;
  }

  /* --- 渲染（直出 / 像素化 RT 两路） --- */
  if(post.pixelate){
    ensureRT(innerWidth/3.2, innerHeight/3.2);
    renderer.setRenderTarget(post.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.cam);
  } else {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
}

/* ============================== 启动 ============================== */
solvePath(state.cur.rc, state.cur.gpx);
updateChainInstances(state.cur.cz);
animate();

const loaderEl = document.getElementById('loader');
loaderEl.classList.add('hide');
setTimeout(() => loaderEl.remove(), 600);

} /* boot end */

boot().catch(err => {
  console.error(err);
  const f = document.getElementById('fatal');
  f.classList.add('show');
  f.innerHTML = `<b>⚠ 加载失败：</b>${err.message}<br>
    本页面需要联网加载 Three.js CDN（jsdelivr）。请检查网络后刷新重试。`;
  const l = document.getElementById('loader');
  if(l) l.classList.add('hide');
});
