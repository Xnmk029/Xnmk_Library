/**
 * 3D DOUBLE WISHBONE SUSPENSION SIMULATOR
 * Dual-Engine: Three.js WebGL + Standalone Pure-JS 3D Perspective Canvas Engine Fallback
 */

// --- PURE JS VECTOR 3 CLASS (Safe against missing THREE namespace) ---
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  clone() { return new Vec3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  distanceTo(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
  length() { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
  lengthSq() { return this.x*this.x + this.y*this.y + this.z*this.z; }
  normalize() {
    const l = this.length();
    if (l > 1e-6) { this.x /= l; this.y /= l; this.z /= l; }
    return this;
  }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
}

function mirrorX(v) {
  return new Vec3(-v.x, v.y, v.z);
}

// --- GLOBAL APP STATE ---
const state = {
  travel: 0.0,       // Suspension travel in mm (-100 to +100)
  steer: 0.0,        // Steering rack displacement in mm (-40 to +40)
  roll: 0.0,         // Body roll in degrees (-15 to +15)
  
  loopBounce: false, // Auto bounce toggle
  loopSteer: false,  // Auto steer toggle
  
  showSolid: true,
  showNodes: true,
  showKingpin: true,
  showWheelTrans: false,
  showVectors: false,
  
  camMode: 'ISO',
  
  historyLength: 100,
  camberHistory: [],
  toeHistory: [],
  travelHistory: []
};

// --- GEOMETRIC REFERENCE PARAMETERS ---
let GEOM, GEOM_L, REST, nodesR, nodesL;

function initGeometryData() {
  GEOM = {
    U_f_R: new Vec3(0.35, 0.25, 0.15),
    U_r_R: new Vec3(0.35, 0.25, -0.15),
    L_f_R: new Vec3(0.25, -0.10, 0.20),
    L_r_R: new Vec3(0.25, -0.10, -0.20),
    S_u_R: new Vec3(0.38, 0.35, 0.0),
    Rack_Center_R: new Vec3(0.30, -0.08, -0.12),

    UBJ_R_ref: new Vec3(0.60, 0.20, -0.01),
    LBJ_R_ref: new Vec3(0.65, -0.15, 0.03),
    Hub_R_ref: new Vec3(0.70, 0.0, 0.0),
    Steer_R_ref: new Vec3(0.63, -0.08, -0.12),
    S_l_R_ref: new Vec3(0.45, -0.12, 0.0)
  };

  GEOM_L = {
    U_f_L: mirrorX(GEOM.U_f_R),
    U_r_L: mirrorX(GEOM.U_r_R),
    L_f_L: mirrorX(GEOM.L_f_R),
    L_r_L: mirrorX(GEOM.L_r_R),
    S_u_L: mirrorX(GEOM.S_u_R),
    Rack_Center_L: mirrorX(GEOM.Rack_Center_R),
    
    UBJ_L_ref: mirrorX(GEOM.UBJ_R_ref),
    LBJ_L_ref: mirrorX(GEOM.LBJ_R_ref),
    Hub_L_ref: mirrorX(GEOM.Hub_R_ref),
    Steer_L_ref: mirrorX(GEOM.Steer_R_ref),
    S_l_L_ref: mirrorX(GEOM.S_l_R_ref)
  };

  REST = {
    d_UBJ_Uf: GEOM.UBJ_R_ref.distanceTo(GEOM.U_f_R),
    d_UBJ_Ur: GEOM.UBJ_R_ref.distanceTo(GEOM.U_r_R),
    d_LBJ_Lf: GEOM.LBJ_R_ref.distanceTo(GEOM.L_f_R),
    d_LBJ_Lr: GEOM.LBJ_R_ref.distanceTo(GEOM.L_r_R),
    d_UBJ_LBJ: GEOM.UBJ_R_ref.distanceTo(GEOM.LBJ_R_ref),
    d_UBJ_Hub: GEOM.UBJ_R_ref.distanceTo(GEOM.Hub_R_ref),
    d_UBJ_Steer: GEOM.UBJ_R_ref.distanceTo(GEOM.Steer_R_ref),
    d_LBJ_Hub: GEOM.LBJ_R_ref.distanceTo(GEOM.Hub_R_ref),
    d_LBJ_Steer: GEOM.LBJ_R_ref.distanceTo(GEOM.Steer_R_ref),
    d_Hub_Steer: GEOM.Hub_R_ref.distanceTo(GEOM.Steer_R_ref),
    d_SL_Lf: GEOM.S_l_R_ref.distanceTo(GEOM.L_f_R),
    d_SL_Lr: GEOM.S_l_R_ref.distanceTo(GEOM.L_r_R),
    d_SL_LBJ: GEOM.S_l_R_ref.distanceTo(GEOM.LBJ_R_ref),
    d_Steer_Rack: GEOM.Steer_R_ref.distanceTo(GEOM.Rack_Center_R)
  };

  nodesR = {
    UBJ: GEOM.UBJ_R_ref.clone(),
    LBJ: GEOM.LBJ_R_ref.clone(),
    Hub: GEOM.Hub_R_ref.clone(),
    Steer: GEOM.Steer_R_ref.clone(),
    S_l: GEOM.S_l_R_ref.clone(),
    Rack: GEOM.Rack_Center_R.clone()
  };

  nodesL = {
    UBJ: GEOM_L.UBJ_L_ref.clone(),
    LBJ: GEOM_L.LBJ_L_ref.clone(),
    Hub: GEOM_L.Hub_L_ref.clone(),
    Steer: GEOM_L.Steer_L_ref.clone(),
    S_l: GEOM_L.S_l_L_ref.clone(),
    Rack: GEOM_L.Rack_Center_L.clone()
  };
}

initGeometryData();

// KINGPIN PATH TRAJECTORY HISTORY
const pathHistoryR = [];
const pathHistoryL = [];
const MAX_PATH_PTS = 120;

// INVERSE MASS CONSTANTS FOR PBD
const W_FREE = { x: 1, y: 1, z: 1 };
const W_FIXED = { x: 0, y: 0, z: 0 };
const W_HUB_DRIVEN = { x: 1, y: 0, z: 1 };

function projectConstraint(A, B, targetDist, wA, wB) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dz = B.z - A.z;
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
  if (len < 1e-6) return;
  
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  
  const S = (nx*nx * (wA.x + wB.x)) + (ny*ny * (wA.y + wB.y)) + (nz*nz * (wA.z + wB.z));
  if (S < 1e-6) return;
  
  const factor = (len - targetDist) / S;
  
  A.x += wA.x * nx * factor;
  A.y += wA.y * ny * factor;
  A.z += wA.z * nz * factor;
  
  B.x -= wB.x * nx * factor;
  B.y -= wB.y * ny * factor;
  B.z -= wB.z * nz * factor;
}

function solveSide(nodes, geomFixed, isRight, travelVal, steerVal) {
  nodes.Rack.copy(geomFixed.Rack_Center);
  nodes.Rack.x += steerVal;

  const targetHubY = (isRight ? GEOM.Hub_R_ref.y : GEOM_L.Hub_L_ref.y) + travelVal;
  nodes.Hub.y = targetHubY;

  for (let iter = 0; iter < 50; iter++) {
    projectConstraint(nodes.UBJ, geomFixed.U_f, REST.d_UBJ_Uf, W_FREE, W_FIXED);
    projectConstraint(nodes.UBJ, geomFixed.U_r, REST.d_UBJ_Ur, W_FREE, W_FIXED);
    projectConstraint(nodes.LBJ, geomFixed.L_f, REST.d_LBJ_Lf, W_FREE, W_FIXED);
    projectConstraint(nodes.LBJ, geomFixed.L_r, REST.d_LBJ_Lr, W_FREE, W_FIXED);
    projectConstraint(nodes.S_l, geomFixed.L_f, REST.d_SL_Lf, W_FREE, W_FIXED);
    projectConstraint(nodes.S_l, geomFixed.L_r, REST.d_SL_Lr, W_FREE, W_FIXED);
    projectConstraint(nodes.S_l, nodes.LBJ, REST.d_SL_LBJ, W_FREE, W_FREE);

    projectConstraint(nodes.UBJ, nodes.LBJ, REST.d_UBJ_LBJ, W_FREE, W_FREE);
    projectConstraint(nodes.UBJ, nodes.Hub, REST.d_UBJ_Hub, W_FREE, W_HUB_DRIVEN);
    projectConstraint(nodes.LBJ, nodes.Hub, REST.d_LBJ_Hub, W_FREE, W_HUB_DRIVEN);
    projectConstraint(nodes.UBJ, nodes.Steer, REST.d_UBJ_Steer, W_FREE, W_FREE);
    projectConstraint(nodes.LBJ, nodes.Steer, REST.d_LBJ_Steer, W_FREE, W_FREE);
    projectConstraint(nodes.Hub, nodes.Steer, REST.d_Hub_Steer, W_HUB_DRIVEN, W_FREE);
    
    projectConstraint(nodes.Steer, nodes.Rack, REST.d_Steer_Rack, W_FREE, W_FIXED);
    nodes.Hub.y = targetHubY;
  }
}

function solveFullKinematics() {
  const travelMeters = state.travel / 1000.0;
  const steerMeters = state.steer / 1000.0;
  const rollRad = (state.roll * Math.PI) / 180.0;
  const trackHalf = 0.70;
  const rollOffset = Math.sin(rollRad) * trackHalf;
  
  const travelR = travelMeters + rollOffset;
  const travelL = travelMeters - rollOffset;
  
  solveSide(nodesR, {
    U_f: GEOM.U_f_R, U_r: GEOM.U_r_R,
    L_f: GEOM.L_f_R, L_r: GEOM.L_r_R,
    Rack_Center: GEOM.Rack_Center_R
  }, true, travelR, steerMeters);
  
  solveSide(nodesL, {
    U_f: GEOM_L.U_f_L, U_r: GEOM_L.U_r_L,
    L_f: GEOM_L.L_f_L, L_r: GEOM_L.L_r_L,
    Rack_Center: GEOM_L.Rack_Center_L
  }, false, travelL, steerMeters);
  
  pathHistoryR.push(nodesR.Hub.clone());
  if (pathHistoryR.length > MAX_PATH_PTS) pathHistoryR.shift();

  pathHistoryL.push(nodesL.Hub.clone());
  if (pathHistoryL.length > MAX_PATH_PTS) pathHistoryL.shift();
}

function computeTelemetry(nodes, isRight) {
  const K = nodes.UBJ.clone().sub(nodes.LBJ).normalize();
  const Y_local = K.clone();
  const Hub_LBJ = nodes.Hub.clone().sub(nodes.LBJ);
  
  let Z_local, X_local;
  if (isRight) {
    Z_local = Hub_LBJ.clone().cross(Y_local);
  } else {
    Z_local = Y_local.clone().cross(Hub_LBJ);
  }

  if (Z_local.lengthSq() < 1e-6) {
    Z_local = new Vec3(0, 0, 1);
  } else {
    Z_local.normalize();
  }

  if (isRight) {
    X_local = Y_local.clone().cross(Z_local);
  } else {
    X_local = Z_local.clone().cross(Y_local);
  }
  if (X_local.lengthSq() < 1e-6) {
    X_local = new Vec3(1, 0, 0);
  } else {
    X_local.normalize();
  }
  
  let camber;
  if (isRight) {
    camber = -Math.atan2(X_local.y, X_local.x) * (180 / Math.PI);
  } else {
    camber = Math.atan2(X_local.y, Math.abs(X_local.x)) * (180 / Math.PI);
  }
  
  let toe;
  if (isRight) {
    toe = -Math.atan2(Z_local.x, Z_local.z) * (180 / Math.PI);
  } else {
    toe = Math.atan2(Z_local.x, Z_local.z) * (180 / Math.PI);
  }
  
  const caster = -Math.atan2(K.z, K.y) * (180 / Math.PI);
  
  let kpi;
  if (isRight) {
    kpi = -Math.atan2(K.x, K.y) * (180 / Math.PI);
  } else {
    kpi = Math.atan2(K.x, K.y) * (180 / Math.PI);
  }
  
  const Su = isRight ? GEOM.S_u_R : GEOM_L.S_u_L;
  const springLen = nodes.S_l.distanceTo(Su) * 1000.0;
  
  return { camber, toe, caster, kpi, springLen, X_local, Y_local, Z_local };
}

// --- RENDERER SELECTION: THREE.JS vs STANDALONE CANVAS 3D ENGINE ---
let activeEngine = null; // 'three' or 'canvas'

// THREE.JS ENGINE STATE
let scene, camera, renderer, controls;
const meshes = { 
  solidCadGroup: null, 
  nodesGroup: null, 
  rigidLinesGroup: null, 
  springGroup: null, 
  kingpinGroup: null, 
  wheelR: null, 
  wheelL: null,
  linesR: null,
  linesL: null,
  nodeDots: null,
  springR: null,
  springL: null,
  kingpinLineR: null,
  kingpinLineL: null,
  trailR: null,
  trailL: null
};

// STANDALONE 3D PERSPECTIVE CANVAS RENDERER STATE
let canvasCtx = null;
let cameraOrbit = { radius: 3.2, theta: 0.6, phi: 1.1, target: new Vec3(0, 0, 0) };

const toVec = (v) => new THREE.Vector3(v.x, v.y, v.z);

function createWheelMesh() {
  const wheelGroup = new THREE.Group();
  
  // Tire Outer Ring
  const tireGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24, 1, true);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15191e,
    roughness: 0.8,
    metalness: 0.2
  });
  const tire = new THREE.Mesh(tireGeom, tireMat);
  tire.rotation.z = Math.PI / 2;
  wheelGroup.add(tire);
  
  // Tire Tread Wireframe overlay
  const treadGeom = new THREE.CylinderGeometry(0.322, 0.322, 0.222, 16, 3, true);
  const treadMat = new THREE.MeshBasicMaterial({ color: 0x2e3e52, wireframe: true });
  const tread = new THREE.Mesh(treadGeom, treadMat);
  tread.rotation.z = Math.PI / 2;
  wheelGroup.add(tread);

  // Wheel Rim Rim Spokes
  const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.20, 5, 1, true);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x8090a0,
    metalness: 0.8,
    roughness: 0.2,
    wireframe: true
  });
  const rim = new THREE.Mesh(rimGeom, rimMat);
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  // Brake Disc
  const discGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16);
  const discMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.8, roughness: 0.3 });
  const disc = new THREE.Mesh(discGeom, discMat);
  disc.rotation.z = Math.PI / 2;
  wheelGroup.add(disc);

  return wheelGroup;
}

function updateSpringGeometry(lineMesh, startPt, endPt) {
  const dir = new Vec3().copy(endPt).sub(startPt);
  const len = dir.length();
  if (len < 0.01) return;
  const turns = 10;
  const radius = 0.045;
  const numPts = 120;
  
  const points = [];
  const axisY = dir.clone().normalize();
  
  // Find perpendicular axes for helix
  let axisX = new Vec3(1, 0, 0).cross(axisY);
  if (axisX.lengthSq() < 0.01) axisX = new Vec3(0, 0, 1).cross(axisY);
  axisX.normalize();
  const axisZ = axisY.clone().cross(axisX).normalize();
  
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const angle = t * turns * Math.PI * 2;
    const pos = new Vec3().copy(startPt).addScaledVector(axisY, t * len);
    pos.addScaledVector(axisX, Math.cos(angle) * radius);
    pos.addScaledVector(axisZ, Math.sin(angle) * radius);
    points.push(new THREE.Vector3(pos.x, pos.y, pos.z));
  }
  
  lineMesh.geometry.setFromPoints(points);
}

function initThreeEngine() {
  const container3D = document.getElementById('viewport-container');
  const canvas = document.getElementById('canvas-3d');
  
  let w = container3D.clientWidth || (window.innerWidth - 660);
  let h = container3D.clientHeight || (window.innerHeight - 60);
  if (w <= 0 || isNaN(w)) w = 800;
  if (h <= 0 || isNaN(h)) h = 600;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d10);
  scene.fog = new THREE.FogExp2(0x0a0d10, 0.15);
  
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(1.8, 1.2, 2.2);
  camera.lookAt(0, 0, 0);
  
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (typeof THREE.OrbitControls === 'function') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
  }

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight1 = new THREE.DirectionalLight(0x00e5ff, 1.2);
  dirLight1.position.set(5, 10, 7);
  scene.add(dirLight1);
  const dirLight2 = new THREE.DirectionalLight(0xff5500, 0.8);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);

  const gridHelper = new THREE.GridHelper(4, 40, 0x00e5ff, 0x1b2735);
  gridHelper.position.y = -0.35;
  scene.add(gridHelper);

  meshes.nodesGroup = new THREE.Group();
  meshes.rigidLinesGroup = new THREE.Group();
  meshes.solidCadGroup = new THREE.Group();
  meshes.springGroup = new THREE.Group();
  meshes.kingpinGroup = new THREE.Group();

  scene.add(meshes.nodesGroup);
  scene.add(meshes.rigidLinesGroup);
  scene.add(meshes.solidCadGroup);
  scene.add(meshes.springGroup);
  scene.add(meshes.kingpinGroup);

  // Subframe Chassis Frame representation
  const sfMat = new THREE.LineBasicMaterial({ color: 0x24374e });
  const sfPoints = [
    toVec(GEOM.U_f_R), toVec(GEOM_L.U_f_L),
    toVec(GEOM.U_r_R), toVec(GEOM_L.U_r_L),
    toVec(GEOM.L_f_R), toVec(GEOM_L.L_f_L),
    toVec(GEOM.L_r_R), toVec(GEOM_L.L_r_L),
    toVec(GEOM.U_f_R), toVec(GEOM.U_r_R),
    toVec(GEOM_L.U_f_L), toVec(GEOM_L.U_r_L)
  ];
  const sfGeom = new THREE.BufferGeometry().setFromPoints(sfPoints);
  const sfLine = new THREE.LineSegments(sfGeom, sfMat);
  scene.add(sfLine);

  // Nodes Dots
  const createDot = (c) => new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), new THREE.MeshBasicMaterial({ color: c }));
  meshes.nodeDots = {
    UBJ_R: createDot(0x00ff66), LBJ_R: createDot(0x00ff66), Hub_R: createDot(0x00e5ff), Steer_R: createDot(0xffcc00),
    UBJ_L: createDot(0x00ff66), LBJ_L: createDot(0x00ff66), Hub_L: createDot(0x00e5ff), Steer_L: createDot(0xffcc00)
  };
  Object.values(meshes.nodeDots).forEach(d => meshes.nodesGroup.add(d));

  // Rigid A-Arms & Links
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
  meshes.linesR = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  meshes.linesL = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  meshes.rigidLinesGroup.add(meshes.linesR);
  meshes.rigidLinesGroup.add(meshes.linesL);

  // Deformable coilovers (helical lines)
  const springMat = new THREE.LineBasicMaterial({ color: 0xff5500 });
  meshes.springR = new THREE.Line(new THREE.BufferGeometry(), springMat);
  meshes.springL = new THREE.Line(new THREE.BufferGeometry(), springMat);
  meshes.springGroup.add(meshes.springR);
  meshes.springGroup.add(meshes.springL);

  // Wheels & Rim spokes
  meshes.wheelR = createWheelMesh();
  meshes.wheelL = createWheelMesh();
  meshes.solidCadGroup.add(meshes.wheelR);
  meshes.solidCadGroup.add(meshes.wheelL);

  // Kingpin Dashed Axis lines
  const kpMat = new THREE.LineDashedMaterial({ color: 0xffcc00, dashSize: 0.05, gapSize: 0.03 });
  meshes.kingpinLineR = new THREE.Line(new THREE.BufferGeometry(), kpMat);
  meshes.kingpinLineL = new THREE.Line(new THREE.BufferGeometry(), kpMat);
  meshes.kingpinGroup.add(meshes.kingpinLineR);
  meshes.kingpinGroup.add(meshes.kingpinLineL);

  // Motion path trails
  const trailMat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
  meshes.trailR = new THREE.Line(new THREE.BufferGeometry(), trailMat);
  meshes.trailL = new THREE.Line(new THREE.BufferGeometry(), trailMat);
  meshes.kingpinGroup.add(meshes.trailR);
  meshes.kingpinGroup.add(meshes.trailL);

  activeEngine = 'three';
}

function updateThreeScene() {
  const teleR = computeTelemetry(nodesR, true);
  const teleL = computeTelemetry(nodesL, false);

  // 1. Update node dots
  meshes.nodeDots.UBJ_R.position.copy(nodesR.UBJ);
  meshes.nodeDots.LBJ_R.position.copy(nodesR.LBJ);
  meshes.nodeDots.Hub_R.position.copy(nodesR.Hub);
  meshes.nodeDots.Steer_R.position.copy(nodesR.Steer);

  meshes.nodeDots.UBJ_L.position.copy(nodesL.UBJ);
  meshes.nodeDots.LBJ_L.position.copy(nodesL.LBJ);
  meshes.nodeDots.Hub_L.position.copy(nodesL.Hub);
  meshes.nodeDots.Steer_L.position.copy(nodesL.Steer);

  // 2. Update line geometry
  const getPts = (n, g) => [
    toVec(g.U_f), toVec(n.UBJ), toVec(g.U_r), toVec(n.UBJ),
    toVec(g.L_f), toVec(n.LBJ), toVec(g.L_r), toVec(n.LBJ),
    toVec(n.UBJ), toVec(n.LBJ), toVec(n.LBJ), toVec(n.Hub),
    toVec(n.UBJ), toVec(n.Hub), toVec(n.Steer), toVec(n.Hub),
    toVec(n.Steer), toVec(n.Rack)
  ];

  meshes.linesR.geometry.setFromPoints(getPts(nodesR, { U_f: GEOM.U_f_R, U_r: GEOM.U_r_R, L_f: GEOM.L_f_R, L_r: GEOM.L_r_R }));
  meshes.linesL.geometry.setFromPoints(getPts(nodesL, { U_f: GEOM_L.U_f_L, U_r: GEOM_L.U_r_L, L_f: GEOM_L.L_f_L, L_r: GEOM_L.L_r_L }));

  // 3. Update helical springs
  updateSpringGeometry(meshes.springR, GEOM.S_u_R, nodesR.S_l);
  updateSpringGeometry(meshes.springL, GEOM_L.S_u_L, nodesL.S_l);

  // 4. Update wheel transformations
  const matR = new THREE.Matrix4().makeBasis(toVec(teleR.X_local), toVec(teleR.Y_local), toVec(teleR.Z_local));
  meshes.wheelR.position.copy(nodesR.Hub);
  meshes.wheelR.quaternion.setFromRotationMatrix(matR);

  const matL = new THREE.Matrix4().makeBasis(toVec(teleL.X_local), toVec(teleL.Y_local), toVec(teleL.Z_local));
  meshes.wheelL.position.copy(nodesL.Hub);
  meshes.wheelL.quaternion.setFromRotationMatrix(matL);

  // 5. Update Kingpin dashed laser axes
  const extKpR_top = nodesR.UBJ.clone().addScaledVector(teleR.Y_local, 0.15);
  const extKpR_bot = nodesR.LBJ.clone().addScaledVector(teleR.Y_local, -0.15);
  meshes.kingpinLineR.geometry.setFromPoints([toVec(extKpR_top), toVec(extKpR_bot)]);
  meshes.kingpinLineR.computeLineDistances();

  const extKpL_top = nodesL.UBJ.clone().addScaledVector(teleL.Y_local, 0.15);
  const extKpL_bot = nodesL.LBJ.clone().addScaledVector(teleL.Y_local, -0.15);
  meshes.kingpinLineL.geometry.setFromPoints([toVec(extKpL_top), toVec(extKpL_bot)]);
  meshes.kingpinLineL.computeLineDistances();

  // 6. Update motion trails
  meshes.trailR.geometry.setFromPoints(pathHistoryR.map(v => toVec(v)));
  meshes.trailL.geometry.setFromPoints(pathHistoryL.map(v => toVec(v)));

  // 7. Layer visibility toggles
  meshes.solidCadGroup.visible = state.showSolid;
  meshes.nodesGroup.visible = state.showNodes;
  meshes.rigidLinesGroup.visible = state.showNodes;
  meshes.kingpinGroup.visible = state.showKingpin;
  meshes.springGroup.visible = state.showNodes;

  // Wheel Transparency
  meshes.wheelR.children.forEach(child => {
    if (child.material) {
      child.material.transparent = state.showWheelTrans;
      child.material.opacity = state.showWheelTrans ? 0.3 : 1.0;
    }
  });
  meshes.wheelL.children.forEach(child => {
    if (child.material) {
      child.material.transparent = state.showWheelTrans;
      child.material.opacity = state.showWheelTrans ? 0.3 : 1.0;
    }
  });

  if (controls && controls.update) controls.update();
  renderer.render(scene, camera);

  return { teleR, teleL };
}

// --- STANDALONE 3D PERSPECTIVE CANVAS ENGINE ---
function initCanvas3DEngine() {
  const canvas = document.getElementById('canvas-3d');
  const container = document.getElementById('viewport-container');
  canvasCtx = canvas.getContext('2d');

  function resize() {
    canvas.width = container.clientWidth || (window.innerWidth - 660);
    canvas.height = container.clientHeight || (window.innerHeight - 60);
  }
  resize();
  window.addEventListener('resize', resize);

  let isDrag = false;
  let prevPos = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => { isDrag = true; prevPos = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mouseup', () => { isDrag = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDrag) return;
    const dx = e.clientX - prevPos.x;
    const dy = e.clientY - prevPos.y;
    cameraOrbit.theta -= dx * 0.005;
    cameraOrbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraOrbit.phi - dy * 0.005));
    prevPos = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('wheel', (e) => {
    cameraOrbit.radius = Math.max(1.0, Math.min(8.0, cameraOrbit.radius + e.deltaY * 0.002));
  });

  activeEngine = 'canvas';
}

function project3D(v, w, h) {
  const cx = cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.cos(cameraOrbit.theta);
  const cy = cameraOrbit.radius * Math.cos(cameraOrbit.phi);
  const cz = cameraOrbit.radius * Math.sin(cameraOrbit.phi) * Math.sin(cameraOrbit.theta);
  
  const camPos = new Vec3(cx, cy, cz);
  const forward = new Vec3(0, 0, 0).sub(camPos).normalize();
  
  let right = new Vec3(0, 1, 0).cross(forward);
  if (right.lengthSq() < 1e-5) right = new Vec3(1, 0, 0);
  else right.normalize();
  
  const up = forward.clone().cross(right).normalize();
  
  const rel = v.clone().sub(camPos);
  const z = rel.dot(forward);
  if (z <= 0.05) return null;

  const x = rel.dot(right);
  const y = rel.dot(up);

  const fov = 750;
  return {
    x: w / 2 + (x / z) * fov,
    y: h / 2 - (y / z) * fov,
    z: z
  };
}

function renderCanvas3DScene() {
  if (!canvasCtx) return;
  const ctx = canvasCtx;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Background Gradient
  const grad = ctx.createRadialGradient(w/2, h/2, 50, w/2, h/2, Math.max(w, h));
  grad.addColorStop(0, '#121820');
  grad.addColorStop(1, '#080a0c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 1. Ground Grid
  ctx.strokeStyle = '#1b2735';
  ctx.lineWidth = 1;
  for (let x = -2; x <= 2; x += 0.2) {
    const p1 = project3D(new Vec3(x, -0.35, -2), w, h);
    const p2 = project3D(new Vec3(x, -0.35, 2), w, h);
    if (p1 && p2) {
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }
  for (let z = -2; z <= 2; z += 0.2) {
    const p1 = project3D(new Vec3(-2, -0.35, z), w, h);
    const p2 = project3D(new Vec3(2, -0.35, z), w, h);
    if (p1 && p2) {
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }

  const teleR = computeTelemetry(nodesR, true);
  const teleL = computeTelemetry(nodesL, false);

  // Helper function to draw lines
  function drawLine3D(v1, v2, color, width = 2, dash = []) {
    const p1 = project3D(v1, w, h);
    const p2 = project3D(v2, w, h);
    if (p1 && p2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Helper function to draw nodes
  function drawDot3D(v, color, radius = 5) {
    const p = project3D(v, w, h);
    if (p) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, radius * (3.5 / p.z)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Subframe Chassis Framework
  const sfColor = '#24374e';
  drawLine3D(GEOM.U_f_R, GEOM_L.U_f_L, sfColor);
  drawLine3D(GEOM.U_r_R, GEOM_L.U_r_L, sfColor);
  drawLine3D(GEOM.L_f_R, GEOM_L.L_f_L, sfColor);
  drawLine3D(GEOM.L_r_R, GEOM_L.L_r_L, sfColor);
  drawLine3D(GEOM.U_f_R, GEOM.U_r_R, sfColor);
  drawLine3D(GEOM_L.U_f_L, GEOM_L.U_r_L, sfColor);

  // 3. Wishbones Framework
  if (state.showNodes) {
    const lineCol = '#00e5ff';
    // Right Side
    drawLine3D(GEOM.U_f_R, nodesR.UBJ, lineCol, 2);
    drawLine3D(GEOM.U_r_R, nodesR.UBJ, lineCol, 2);
    drawLine3D(GEOM.L_f_R, nodesR.LBJ, lineCol, 2);
    drawLine3D(GEOM.L_r_R, nodesR.LBJ, lineCol, 2);
    drawLine3D(nodesR.UBJ, nodesR.LBJ, lineCol, 2);
    drawLine3D(nodesR.LBJ, nodesR.Hub, lineCol, 2);
    drawLine3D(nodesR.UBJ, nodesR.Hub, lineCol, 2);
    drawLine3D(nodesR.Steer, nodesR.Hub, lineCol, 2);
    drawLine3D(nodesR.Steer, nodesR.Rack, lineCol, 2);

    // Left Side
    drawLine3D(GEOM_L.U_f_L, nodesL.UBJ, lineCol, 2);
    drawLine3D(GEOM_L.U_r_L, nodesL.UBJ, lineCol, 2);
    drawLine3D(GEOM_L.L_f_L, nodesL.LBJ, lineCol, 2);
    drawLine3D(GEOM_L.L_r_L, nodesL.LBJ, lineCol, 2);
    drawLine3D(nodesL.UBJ, nodesL.LBJ, lineCol, 2);
    drawLine3D(nodesL.LBJ, nodesL.Hub, lineCol, 2);
    drawLine3D(nodesL.UBJ, nodesL.Hub, lineCol, 2);
    drawLine3D(nodesL.Steer, nodesL.Hub, lineCol, 2);
    drawLine3D(nodesL.Steer, nodesL.Rack, lineCol, 2);
  }

  // 4. Steering Rack Bar
  drawLine3D(nodesR.Rack, nodesL.Rack, '#ffcc00', 3);

  // 5. Deformable Springs
  function drawSpring(start, end) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    const turns = 10;
    const numPts = 60;
    let prev = project3D(start, w, h);

    for (let i = 1; i <= numPts; i++) {
      const t = i / numPts;
      const angle = t * turns * Math.PI * 2;
      const p = start.clone().addScaledVector(dir, t);
      p.x += Math.cos(angle) * 0.04;
      p.z += Math.sin(angle) * 0.04;
      const proj = project3D(p, w, h);
      if (prev && proj) {
        ctx.strokeStyle = '#ff5500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();
      }
      prev = proj;
    }
  }
  drawSpring(GEOM.S_u_R, nodesR.S_l);
  drawSpring(GEOM_L.S_u_L, nodesL.S_l);

  // 6. Kingpin Lasers
  if (state.showKingpin) {
    const extR_top = nodesR.UBJ.clone().addScaledVector(teleR.Y_local, 0.15);
    const extR_bot = nodesR.LBJ.clone().addScaledVector(teleR.Y_local, -0.15);
    drawLine3D(extR_top, extR_bot, '#ffcc00', 2, [5, 5]);

    const extL_top = nodesL.UBJ.clone().addScaledVector(teleL.Y_local, 0.15);
    const extL_bot = nodesL.LBJ.clone().addScaledVector(teleL.Y_local, -0.15);
    drawLine3D(extL_top, extL_bot, '#ffcc00', 2, [5, 5]);
  }

  // 7. Wheels & Tires
  if (state.showSolid) {
    function drawWheel(hub, tele) {
      const rad = 0.32;
      const width = 0.22;
      const hubProj = project3D(hub, w, h);
      if (!hubProj) return;

      const scale = Math.max(0.4, 3.5 / hubProj.z);

      ctx.save();
      ctx.translate(hubProj.x, hubProj.y);

      // Tire Outer Circle
      ctx.strokeStyle = '#8090a0';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, 32 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Rim Spokes
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 32 * scale, Math.sin(a) * 32 * scale);
        ctx.stroke();
      }

      ctx.restore();
    }
    drawWheel(nodesR.Hub, teleR);
    drawWheel(nodesL.Hub, teleL);
  }

  // 8. Dynamic Nodes
  if (state.showNodes) {
    drawDot3D(nodesR.UBJ, '#00ff66', 6);
    drawDot3D(nodesR.LBJ, '#00ff66', 6);
    drawDot3D(nodesR.Hub, '#00e5ff', 7);
    drawDot3D(nodesR.Steer, '#ffcc00', 6);

    drawDot3D(nodesL.UBJ, '#00ff66', 6);
    drawDot3D(nodesL.LBJ, '#00ff66', 6);
    drawDot3D(nodesL.Hub, '#00e5ff', 7);
    drawDot3D(nodesL.Steer, '#ffcc00', 6);
  }

  return { teleR, teleL };
}

// --- 2D CANVAS STRIP CHARTS ---
function initCanvasCharts() {
  const canvasCamber = document.getElementById('chart-camber');
  const canvasToe = document.getElementById('chart-toe');
  if (canvasCamber && canvasToe) {
    canvasCamber.width = canvasCamber.clientWidth || 300;
    canvasCamber.height = canvasCamber.clientHeight || 80;
    canvasToe.width = canvasToe.clientWidth || 300;
    canvasToe.height = canvasToe.clientHeight || 80;
  }
}

function renderChart(canvasId, historyData, minVal, maxVal, unit, colorStr) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#1b2735';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
  ctx.moveTo(0, h/4); ctx.lineTo(w, h/4);
  ctx.moveTo(0, 3*h/4); ctx.lineTo(w, 3*h/4);
  ctx.stroke();

  if (historyData.length < 2) return;

  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 2;
  ctx.beginPath();

  const step = w / (state.historyLength - 1);
  for (let i = 0; i < historyData.length; i++) {
    const val = historyData[i];
    const norm = (val - minVal) / (maxVal - minVal);
    const y = h - Math.max(0, Math.min(1, norm)) * h;
    const x = i * step;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  const lastVal = historyData[historyData.length - 1];
  ctx.fillStyle = colorStr;
  ctx.font = '10px Consolas, monospace';
  ctx.fillText(`${lastVal.toFixed(2)}${unit}`, w - 48, 14);
}

function updateDOM(teleR) {
  document.getElementById('tel-camber').innerHTML = `${teleR.camber.toFixed(2)}<span class="card-unit">°</span>`;
  document.getElementById('tel-toe').innerHTML = `${teleR.toe.toFixed(2)}<span class="card-unit">°</span>`;
  document.getElementById('tel-caster').innerHTML = `${teleR.caster.toFixed(2)}<span class="card-unit">°</span>`;
  document.getElementById('tel-kpi').innerHTML = `${teleR.kpi.toFixed(2)}<span class="card-unit">°</span>`;
  document.getElementById('tel-spring').innerHTML = `${teleR.springLen.toFixed(0)}<span class="card-unit">mm</span>`;
  document.getElementById('tel-steer-ang').innerHTML = `${(-teleR.toe).toFixed(2)}<span class="card-unit">°</span>`;

  document.getElementById('node-ubj-x').innerText = (nodesR.UBJ.x * 1000).toFixed(1);
  document.getElementById('node-ubj-y').innerText = (nodesR.UBJ.y * 1000).toFixed(1);
  document.getElementById('node-ubj-z').innerText = (nodesR.UBJ.z * 1000).toFixed(1);

  document.getElementById('node-lbj-x').innerText = (nodesR.LBJ.x * 1000).toFixed(1);
  document.getElementById('node-lbj-y').innerText = (nodesR.LBJ.y * 1000).toFixed(1);
  document.getElementById('node-lbj-z').innerText = (nodesR.LBJ.z * 1000).toFixed(1);

  document.getElementById('node-hub-x').innerText = (nodesR.Hub.x * 1000).toFixed(1);
  document.getElementById('node-hub-y').innerText = (nodesR.Hub.y * 1000).toFixed(1);
  document.getElementById('node-hub-z').innerText = (nodesR.Hub.z * 1000).toFixed(1);

  document.getElementById('node-str-x').innerText = (nodesR.Steer.x * 1000).toFixed(1);
  document.getElementById('node-str-y').innerText = (nodesR.Steer.y * 1000).toFixed(1);
  document.getElementById('node-str-z').innerText = (nodesR.Steer.z * 1000).toFixed(1);

  state.camberHistory.push(teleR.camber);
  if (state.camberHistory.length > state.historyLength) state.camberHistory.shift();

  state.toeHistory.push(teleR.toe);
  if (state.toeHistory.length > state.historyLength) state.toeHistory.shift();

  renderChart('chart-camber', state.camberHistory, -3.0, 1.0, '°', '#00e5ff');
  renderChart('chart-toe', state.toeHistory, -5.0, 5.0, '°', '#ffcc00');
}

function setupEvents() {
  const inputTravel = document.getElementById('input-travel');
  const inputSteer = document.getElementById('input-steer');
  const inputRoll = document.getElementById('input-roll');

  inputTravel.addEventListener('input', (e) => {
    state.travel = parseFloat(e.target.value);
    document.getElementById('val-travel').innerText = `${state.travel.toFixed(1)} mm`;
  });

  inputSteer.addEventListener('input', (e) => {
    state.steer = parseFloat(e.target.value);
    document.getElementById('val-steer').innerText = `${state.steer.toFixed(1)} mm`;
  });

  inputRoll.addEventListener('input', (e) => {
    state.roll = parseFloat(e.target.value);
    document.getElementById('val-roll').innerText = `${state.roll.toFixed(1)}°`;
  });

  document.getElementById('btn-loop-bounce').addEventListener('click', (e) => {
    state.loopBounce = !state.loopBounce;
    e.target.classList.toggle('active', state.loopBounce);
  });

  document.getElementById('btn-loop-steer').addEventListener('click', (e) => {
    state.loopSteer = !state.loopSteer;
    e.target.classList.toggle('active', state.loopSteer);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state.travel = 0; state.steer = 0; state.roll = 0;
    state.loopBounce = false; state.loopSteer = false;

    inputTravel.value = 0; inputSteer.value = 0; inputRoll.value = 0;
    document.getElementById('val-travel').innerText = '0.0 mm';
    document.getElementById('val-steer').innerText = '0.0 mm';
    document.getElementById('val-roll').innerText = '0.0°';

    document.getElementById('btn-loop-bounce').classList.remove('active');
    document.getElementById('btn-loop-steer').classList.remove('active');
  });

  document.getElementById('chk-solid').addEventListener('change', (e) => state.showSolid = e.target.checked);
  document.getElementById('chk-nodes').addEventListener('change', (e) => state.showNodes = e.target.checked);
  document.getElementById('chk-kingpin').addEventListener('change', (e) => state.showKingpin = e.target.checked);
  document.getElementById('chk-wheel-trans').addEventListener('change', (e) => state.showWheelTrans = e.target.checked);

  const camBtns = {
    'btn-cam-iso': { pos: [1.8, 1.2, 2.2], orb: { radius: 3.2, theta: 0.6, phi: 1.1 }, tag: 'VIEW: ISO 3D' },
    'btn-cam-front': { pos: [0, 0, 3.2], orb: { radius: 3.2, theta: Math.PI/2, phi: Math.PI/2 }, tag: 'VIEW: FRONT 2D' },
    'btn-cam-side': { pos: [3.2, 0, 0], orb: { radius: 3.2, theta: 0, phi: Math.PI/2 }, tag: 'VIEW: SIDE 2D' },
    'btn-cam-top': { pos: [0, 3.2, 0.001], orb: { radius: 3.2, theta: 0, phi: 0.001 }, tag: 'VIEW: TOP 2D' }
  };

  Object.entries(camBtns).forEach(([btnId, cfg]) => {
    document.getElementById(btnId).addEventListener('click', (e) => {
      Object.keys(camBtns).forEach(id => document.getElementById(id).classList.remove('active'));
      e.target.classList.add('active');

      if (activeEngine === 'three' && camera && controls) {
        camera.position.set(...cfg.pos);
        controls.target.set(0, 0, 0);
        controls.update();
      } else {
        cameraOrbit.radius = cfg.orb.radius;
        cameraOrbit.theta = cfg.orb.theta;
        cameraOrbit.phi = cfg.orb.phi;
      }
      document.getElementById('hud-cam-mode').innerText = cfg.tag;
    });
  });
}

// --- MAIN ANIMATION LOOP ---
let timeSec = 0;
let lastTime = performance.now();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000.0, 0.1);
  lastTime = now;
  timeSec += dt;

  frameCount++;
  if (frameCount % 15 === 0) {
    const fps = dt > 0 ? Math.round(1 / dt) : 60;
    document.getElementById('hdr-fps').innerText = fps;
    document.getElementById('ft-time').innerText = (dt * 1000).toFixed(1);
  }

  if (state.loopBounce) {
    state.travel = Math.sin(timeSec * 3.0) * 80.0;
    document.getElementById('input-travel').value = state.travel;
    document.getElementById('val-travel').innerText = `${state.travel.toFixed(1)} mm`;
  }

  if (state.loopSteer) {
    state.steer = Math.sin(timeSec * 2.0) * 35.0;
    document.getElementById('input-steer').value = state.steer;
    document.getElementById('val-steer').innerText = `${state.steer.toFixed(1)} mm`;
  }

  solveFullKinematics();

  let res;
  if (activeEngine === 'three') {
    res = updateThreeScene();
  } else {
    res = renderCanvas3DScene();
  }

  if (res && res.teleR) {
    updateDOM(res.teleR);
  }
}

// --- EXPORTED INITIALIZATION ENTRY POINT ---
window.startDoubleWishboneApp = function() {
  if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
    try {
      initThreeEngine();
    } catch (e) {
      console.warn("Three.js init failed, falling back to Standalone Canvas 3D Engine", e);
      initCanvas3DEngine();
    }
  } else {
    initCanvas3DEngine();
  }

  initCanvasCharts();
  setupEvents();
  animate();
};

// startDoubleWishboneApp will be called by index.html's loader script.

