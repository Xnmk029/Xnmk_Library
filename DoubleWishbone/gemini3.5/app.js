/* CAD Suspension Simulator - Core Application */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Configuration & Constants ---
const SCALE = 1.0; // 1 unit = 1 mm

// Hardcoded Nominal Anchor Points on Chassis (Fixed)
const CHASSIS_A = new THREE.Vector3(150, 100, 100);  // UCA Front
const CHASSIS_B = new THREE.Vector3(150, 100, -100); // UCA Rear
const CHASSIS_C = new THREE.Vector3(120, -100, 120); // LCA Front
const CHASSIS_D = new THREE.Vector3(120, -100, -120);// LCA Rear
const CHASSIS_E = new THREE.Vector3(180, 240, 0);   // Shock Tower Mount

// Local Knuckle Geometry definitions (offsets from P_lower)
// When steering is straight, P_lower is at nominal position
// P_tie is rearward (-Z) and inward (-X) relative to P_lower
const KNUCKLE_TIE_OFFSET = new THREE.Vector3(-20, 30, -80); 

// Global Simulation State
const simState = {
  // Inputs & Manual Control overrides
  travel: 0, // Current travel (mm), goes -60 to +60
  steer: 0,  // Steering wheel input angle (deg), goes -25 to +25
  
  // Parameter Dimensions (Adjustable via Sliders)
  paramUCA: 220,
  paramLCA: 340,
  paramKP: 180,
  paramHub: 65,
  
  // Computed Node Positions
  A: new THREE.Vector3(),
  B: new THREE.Vector3(),
  C: new THREE.Vector3(),
  D: new THREE.Vector3(),
  E: new THREE.Vector3(),
  F: new THREE.Vector3(), // Steering rack inner joint
  G: new THREE.Vector3(), // LCA shock mount joint
  P_upper: new THREE.Vector3(),
  P_lower: new THREE.Vector3(),
  P_tie: new THREE.Vector3(),
  W_c: new THREE.Vector3(),
  
  // Real-time calculated telemetry values
  camber: 0,
  toe: 0,
  caster: 0,
  kpi: 0,
  scrub: 0,
  
  // Solver variables
  target_TieRod: 291.5, // Auto-adjusted on parameter change
  
  // Visual Toggles
  showSolid: true,
  showKingpin: true,
  traceKPPath: true,
  traceWCPath: true,
  showForces: true,
  
  // Sweep states
  activeSweep: 'stop', // 'bump', 'steer', 'dual', 'stop'
  sweepSpeed: 1.0,
  
  // History for trails
  kpPathHistory: [],
  wcPathHistory: []
};

// --- DOM Reference & Telemetry UI Binding ---
const dom = {
  // Numeric labels
  valCamber: document.getElementById('val-camber'),
  valToe: document.getElementById('val-toe'),
  valCaster: document.getElementById('val-caster'),
  valKpi: document.getElementById('val-kpi'),
  valScrub: document.getElementById('val-scrub'),
  valTravel: document.getElementById('val-travel'),
  
  // Controls
  ctrlTravel: document.getElementById('ctrl-travel'),
  lblCtrlTravel: document.getElementById('lbl-ctrl-travel'),
  ctrlSteer: document.getElementById('ctrl-steer'),
  lblCtrlSteer: document.getElementById('lbl-ctrl-steer'),
  
  // Buttons
  btnSweepBump: document.getElementById('btn-sweep-bump'),
  btnSweepSteer: document.getElementById('btn-sweep-steer'),
  btnSweepDual: document.getElementById('btn-sweep-dual'),
  btnSweepStop: document.getElementById('btn-sweep-stop'),
  sweepSpeed: document.getElementById('sweep-speed'),
  lblSweepSpeed: document.getElementById('lbl-sweep-speed'),
  btnClearCharts: document.getElementById('btn-clear-charts'),
  
  // Parameters
  paramUca: document.getElementById('param-uca'),
  lblParamUca: document.getElementById('lbl-param-uca'),
  paramLca: document.getElementById('param-lca'),
  lblParamLca: document.getElementById('lbl-param-lca'),
  paramKp: document.getElementById('param-kp'),
  lblParamKp: document.getElementById('lbl-param-kp'),
  paramHub: document.getElementById('param-hub'),
  lblParamHub: document.getElementById('lbl-param-hub'),
  
  // Toggles
  toggleSolid: document.getElementById('toggle-solid'),
  toggleKingpin: document.getElementById('toggle-kingpin'),
  toggleKpPath: document.getElementById('toggle-kp-path'),
  toggleWcPath: document.getElementById('toggle-wc-path'),
  toggleForces: document.getElementById('toggle-forces'),
  
  // View buttons
  viewIso: document.getElementById('view-iso'),
  viewFront: document.getElementById('view-front'),
  viewTop: document.getElementById('view-top'),
  viewSide: document.getElementById('view-side'),
  
  // Telemetry Canvases
  chartCamber: document.getElementById('chart-camber'),
  chartToe: document.getElementById('chart-toe'),
  chartKpi: document.getElementById('chart-kpi'),
  
  // Stats
  fpsCounter: document.getElementById('fps-counter')
};

// Canvas 2D Rendering Contexts
const ctxCamber = dom.chartCamber.getContext('2d');
const ctxToe = dom.chartToe.getContext('2d');
const ctxKpi = dom.chartKpi.getContext('2d');

// --- Three.js Setup ---
const container = document.querySelector('.viewport-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c0e);

// Camera Setup with fallback dimensions for timing safety
const startWidth = container.clientWidth || 800;
const startHeight = container.clientHeight || 600;
const camera = new THREE.PerspectiveCamera(38, startWidth / startHeight, 10, 5000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas-3d'), antialias: true });
renderer.setSize(startWidth, startHeight, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lights
const ambientLight = new THREE.AmbientLight(0x1a2128, 1.5);
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight1.position.set(600, 800, 300);
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0x00e5ff, 1.2);
dirLight2.position.set(-600, -200, -300);
scene.add(dirLight2);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(300, 0, 0);

// CAD Grid & Axis helpers
const gridHelper = new THREE.GridHelper(1200, 60, 0x242b31, 0x14181b);
gridHelper.position.y = -300; // Place grid at ground level
scene.add(gridHelper);

const axisHelper = new THREE.AxesHelper(100);
axisHelper.position.set(0, -299, 0); // slightly above grid
scene.add(axisHelper);

// --- Visual Object Pool (meshes representing suspension parts) ---
const meshes = {};

function initMeshes() {
  // Materials
  const matChassis = new THREE.MeshLambertMaterial({ color: 0x5a636c });
  const matLInkRigid = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.3, metalness: 0.8 });
  const matKnuckle = new THREE.MeshStandardMaterial({ color: 0x2e3b43, roughness: 0.5, metalness: 0.5 });
  const matWheel = new THREE.MeshStandardMaterial({ color: 0x1c2024, transparent: true, opacity: 0.4, wireframe: false });
  const matWheelSpindle = new THREE.MeshStandardMaterial({ color: 0x90a4ae });
  const matForce = new THREE.MeshBasicMaterial({ color: 0xff8f00 });
  const matSpring = new THREE.LineBasicMaterial({ color: 0xff8f00, linewidth: 2 });
  
  // Nodes (Small spheres for joints)
  const nodeGeo = new THREE.SphereGeometry(6, 12, 12);
  const nodesToCreate = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'UPL', 'LPL', 'TPL'];
  nodesToCreate.forEach(name => {
    const mesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: name.length > 1 ? 0x00e5ff : 0x78909c }));
    scene.add(mesh);
    meshes['node_' + name] = mesh;
  });
  
  // Chassis structure line visualizers
  const lineMat = new THREE.LineBasicMaterial({ color: 0x242b31 });
  const chassisPoints = [
    CHASSIS_A, CHASSIS_B,
    CHASSIS_C, CHASSIS_D,
    CHASSIS_A, CHASSIS_C,
    CHASSIS_B, CHASSIS_D,
    CHASSIS_A, CHASSIS_E,
    CHASSIS_C, CHASSIS_E
  ];
  const chassisLineGeo = new THREE.BufferGeometry().setFromPoints(chassisPoints);
  const chassisLines = new THREE.LineSegments(chassisLineGeo, lineMat);
  scene.add(chassisLines);

  // Link cylinders
  meshes.uca_front = createTubeMesh(matLInkRigid);
  meshes.uca_rear = createTubeMesh(matLInkRigid);
  meshes.lca_front = createTubeMesh(matLInkRigid);
  meshes.lca_rear = createTubeMesh(matLInkRigid);
  meshes.tie_rod = createTubeMesh(matLInkRigid);
  meshes.shock_body = createTubeMesh(matChassis);
  meshes.shock_shaft = createTubeMesh(matWheelSpindle);
  
  // Add links to scene
  scene.add(meshes.uca_front);
  scene.add(meshes.uca_rear);
  scene.add(meshes.lca_front);
  scene.add(meshes.lca_rear);
  scene.add(meshes.tie_rod);
  scene.add(meshes.shock_body);
  scene.add(meshes.shock_shaft);

  // Dynamic spring line
  const springGeo = new THREE.BufferGeometry();
  meshes.spring = new THREE.Line(springGeo, matSpring);
  scene.add(meshes.spring);

  // Solid Knuckle components
  meshes.knuckleGroup = new THREE.Group();
  
  const spindleGeo = new THREE.CylinderGeometry(12, 12, 60, 16);
  spindleGeo.rotateZ(Math.PI / 2);
  const spindleMesh = new THREE.Mesh(spindleGeo, matWheelSpindle);
  meshes.knuckleGroup.add(spindleMesh);
  
  // Upright structural cylinders
  meshes.upright_v = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 12), matKnuckle);
  meshes.upright_t = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 12), matKnuckle);
  meshes.knuckleGroup.add(meshes.upright_v);
  meshes.knuckleGroup.add(meshes.upright_t);
  
  scene.add(meshes.knuckleGroup);

  // Wheel Mesh
  const wheelGeo = new THREE.CylinderGeometry(300, 300, 200, 32, 1);
  wheelGeo.rotateZ(Math.PI / 2); // Axis lies along X-axis
  meshes.wheel = new THREE.Mesh(wheelGeo, matWheel);
  
  // Wheel wire outline for rotation tracking
  const wheelWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(wheelGeo),
    new THREE.LineBasicMaterial({ color: 0x37474f, transparent: true, opacity: 0.6 })
  );
  meshes.wheel.add(wheelWire);
  
  // Camber/Toe indicator crosshairs on the wheel
  const wheelCross = new THREE.Group();
  const crossMat = new THREE.LineBasicMaterial({ color: 0x00e5ff });
  const crossLine1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(101, -300, 0), new THREE.Vector3(101, 300, 0)]), crossMat);
  const crossLine2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(101, 0, -300), new THREE.Vector3(101, 0, 300)]), crossMat);
  wheelCross.add(crossLine1);
  wheelCross.add(crossLine2);
  meshes.wheel.add(wheelCross);
  
  scene.add(meshes.wheel);

  // Kingpin axis visual helper
  // NOTE: do NOT call computeLineDistances() here — the geometry is empty and
  // three r185 throws (reads attributes.position.count). Distances are recomputed
  // in updateSimulation() after the points are set.
  const kpLineGeo = new THREE.BufferGeometry();
  meshes.kpLine = new THREE.Line(kpLineGeo, new THREE.LineDashedMaterial({ color: 0xff8f00, dashSize: 10, gapSize: 5 }));
  scene.add(meshes.kpLine);
  
  // Kingpin ground intersection dot
  meshes.kpGroundPoint = new THREE.Mesh(new THREE.RingGeometry(1, 10, 4), new THREE.MeshBasicMaterial({ color: 0xff8f00, side: THREE.DoubleSide }));
  meshes.kpGroundPoint.rotateX(Math.PI / 2);
  meshes.kpGroundPoint.position.y = -298.5; // flush on grid
  scene.add(meshes.kpGroundPoint);

  // Force vector arrow
  meshes.forceArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 50, 0xff8f00, 15, 8);
  scene.add(meshes.forceArrow);

  // Paths
  const trailMatKP = new THREE.LineBasicMaterial({ color: 0xff8f00, transparent: true, opacity: 0.7 });
  meshes.trailKP = new THREE.Line(new THREE.BufferGeometry(), trailMatKP);
  scene.add(meshes.trailKP);

  const trailMatWC = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 });
  meshes.trailWC = new THREE.Line(new THREE.BufferGeometry(), trailMatWC);
  scene.add(meshes.trailWC);
}

function createTubeMesh(material) {
  const geom = new THREE.CylinderGeometry(6, 6, 1, 12);
  geom.rotateX(Math.PI / 2); // Align axis to Z
  return new THREE.Mesh(geom, material);
}

function updateTubePosition(mesh, p1, p2, radius = 6) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  mesh.scale.set(radius / 6, radius / 6, len);
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.lookAt(p2);
}

// --- Position Based Dynamics (PBD) Constraint Solver ---

function projectDistance(p1, p2, targetDist, w1, w2) {
  const dir = new THREE.Vector3().subVectors(p1, p2);
  const len = dir.length();
  if (len < 1e-6) return;
  const diff = len - targetDist;
  const correction = dir.normalize().multiplyScalar(diff / (w1 + w2));
  if (w1 > 0) p1.addScaledVector(correction, -w1);
  if (w2 > 0) p2.addScaledVector(correction, w2);
}

// Solves the spatial constraints for the wishbones, knuckle, and steering rack
// Returns the fully solved positions and calculated angles
function solveKinematics(steerVal, travelVal, paramUCA, paramLCA, paramKP, paramHub, targetTieRod) {
  // Inputs
  const A = CHASSIS_A.clone();
  const B = CHASSIS_B.clone();
  const C = CHASSIS_C.clone();
  const D = CHASSIS_D.clone();
  const E = CHASSIS_E.clone();
  
  // Steering rack point F shifts laterally (along X) with steerVal input
  // Nominally, F is at (140, -50, -80)
  // SteerVal moves steering gear laterally
  const F = new THREE.Vector3(140 - steerVal * 1.5, -50, -80);
  
  // Rigid link target lengths
  const target_UCA = paramUCA;
  const target_LCA = paramLCA;
  const target_KP = paramKP;
  
  // Knuckle structural triangle edges
  const kp_len = target_KP;
  const tie_rel = KNUCKLE_TIE_OFFSET.clone();
  const target_L_PL_TPL = tie_rel.length(); 
  const target_L_PU_TPL = new THREE.Vector3(0, kp_len, 0).sub(tie_rel).length();
  
  // Initialize dynamic node guesses (warm-start from previous state or default)
  // Lower Ball Joint (P_lower) nominal coordinates: (120 + LCA_length, -100, 0)
  const P_lower = new THREE.Vector3(120 + target_LCA, -100 + travelVal, 0);
  // Upper Ball Joint (P_upper) nominal coordinates: (150 + UCA_length, 100, 0)
  const P_upper = new THREE.Vector3(150 + target_UCA, 100 + travelVal, 0);
  // Tie rod knuckle ball joint (P_tie)
  const P_tie = new THREE.Vector3().copy(P_lower).add(tie_rel);

  // Run constraint projections
  const solverIterations = 20;
  for (let iter = 0; iter < solverIterations; iter++) {
    // Kinematic Driving Constraint: force vertical suspension height
    P_lower.y = -100 + travelVal;
    
    // 1. LCA constraints: |P_lower - C| = target_LCA, |P_lower - D| = target_LCA
    projectDistance(P_lower, C, target_LCA, 1.0, 0.0);
    projectDistance(P_lower, D, target_LCA, 1.0, 0.0);
    
    // Maintain vertical driving height
    P_lower.y = -100 + travelVal;

    // 2. UCA constraints: |P_upper - A| = target_UCA, |P_upper - B| = target_UCA
    projectDistance(P_upper, A, target_UCA, 1.0, 0.0);
    projectDistance(P_upper, B, target_UCA, 1.0, 0.0);
    
    // 3. Tie-rod constraint: |P_tie - F| = targetTieRod
    projectDistance(P_tie, F, targetTieRod, 1.0, 0.0);
    
    // 4. Knuckle structural triangle rigidity
    // P_upper <-> P_lower = kp_len
    projectDistance(P_upper, P_lower, kp_len, 0.5, 0.5);
    // P_lower <-> P_tie = target_L_PL_TPL
    projectDistance(P_lower, P_tie, target_L_PL_TPL, 0.5, 0.5);
    // P_upper <-> P_tie = target_L_PU_TPL
    projectDistance(P_upper, P_tie, target_L_PU_TPL, 0.5, 0.5);
  }

  // --- Wheel Center & Rotation Solver ---
  // Kingpin Unit Vector (Up)
  const K = new THREE.Vector3().subVectors(P_upper, P_lower).normalize();
  // Longitudinal vector pointing rearward from P_lower to P_tie
  const v = new THREE.Vector3().subVectors(P_tie, P_lower);
  // Orthogonalize v with respect to K to find clean longitudinal direction
  const R_long = new THREE.Vector3().copy(v).addScaledVector(K, -v.dot(K)).normalize();
  // Spindle direction (pointing outward, to the right, along X-axis)
  const S_lat = new THREE.Vector3().crossVectors(R_long, K).normalize();
  
  // Wheel center hub position (offset along spindle from knuckle midpoint)
  const P_mid = new THREE.Vector3().addVectors(P_upper, P_lower).multiplyScalar(0.5);
  const W_c = new THREE.Vector3().copy(P_mid).addScaledVector(S_lat, paramHub);
  
  // --- Kinematic Telemetry Formulas ---
  // Wheel rotation coordinate frame
  const K_prime = new THREE.Vector3().crossVectors(S_lat, R_long).normalize(); // orthogonal up vector of wheel
  
  // 1. Camber: tilt of vertical axis in frontal plane
  const camber = Math.atan2(K_prime.x, K_prime.y) * (180 / Math.PI);
  
  // 2. Toe-in: angle of longitudinal axis in horizontal plane
  // R_long points backward. So -R_long is forward.
  // Standard toe-in is positive (top-down view shows front tilting inboard).
  // For right side wheel, toe-in tilts front towards the left (-X).
  // So -R_long.x < 0 means toe-in (R_long.x > 0)
  const toe = Math.atan2(R_long.x, -R_long.z) * (180 / Math.PI);
  
  // 3. Caster: tilt of kingpin axis in side view (Y-Z plane). Tilted backward is positive
  const caster = Math.atan2(-K.z, K.y) * (180 / Math.PI);
  
  // 4. KPI: tilt of kingpin axis in front view (X-Y plane). Tilted inward is positive
  const kpi = Math.atan2(-K.x, K.y) * (180 / Math.PI);
  
  // 5. Scrub Radius: intersection of kingpin line with ground Y_ground = -300 mm
  const Y_ground = -300;
  const t = (Y_ground - P_lower.y) / K.y;
  const P_ground = new THREE.Vector3().copy(P_lower).addScaledVector(K, t);
  const scrub = W_c.x - P_ground.x;
  
  // Shock Mount on LCA (midpoint/fractional position)
  const G = new THREE.Vector3().addScaledVector(C, 0.25).addScaledVector(D, 0.25).addScaledVector(P_lower, 0.5);

  return {
    A, B, C, D, E, F, G,
    P_upper, P_lower, P_tie, W_c,
    K, K_prime, R_long, S_lat,
    camber, toe, caster, kpi, scrub
  };
}

// Auto-align tie rod length so that toe is exactly 0.00 at travel = 0 and steer = 0
function autoAlignTieRod() {
  // Solve geometry with a dummy tie-rod length at travel=0, steer=0
  // To find the alignment point of P_tie at zero toe:
  const target_LCA = simState.paramLCA;
  const target_UCA = simState.paramUCA;
  const target_KP = simState.paramKP;
  
  // Step 1: Solve wishbone pivots only (P_lower and P_upper)
  const A = CHASSIS_A.clone();
  const B = CHASSIS_B.clone();
  const C = CHASSIS_C.clone();
  const D = CHASSIS_D.clone();
  
  const P_lower = new THREE.Vector3(120 + target_LCA, -100, 0);
  const P_upper = new THREE.Vector3(150 + target_UCA, 100, 0);
  
  const iterations = 30;
  for (let i = 0; i < iterations; i++) {
    P_lower.y = -100;
    projectDistance(P_lower, C, target_LCA, 1.0, 0.0);
    projectDistance(P_lower, D, target_LCA, 1.0, 0.0);
    P_lower.y = -100;
    
    projectDistance(P_upper, A, target_UCA, 1.0, 0.0);
    projectDistance(P_upper, B, target_UCA, 1.0, 0.0);
    
    projectDistance(P_upper, P_lower, target_KP, 0.5, 0.5);
  }
  
  // Step 2: Form aligned knuckle frame where Toe is 0.0
  const K = new THREE.Vector3().subVectors(P_upper, P_lower).normalize();
  const R_long_aligned = new THREE.Vector3(0, 0, -1); // strictly backward (0 toe)
  // Project to ensure orthgonality with K
  R_long_aligned.addScaledVector(K, -R_long_aligned.dot(K)).normalize();
  const S_lat_aligned = new THREE.Vector3().crossVectors(R_long_aligned, K).normalize();
  
  // Step 3: Compute aligned P_tie position
  const P_tie_aligned = new THREE.Vector3()
    .copy(P_lower)
    .addScaledVector(K, KNUCKLE_TIE_OFFSET.y)
    .addScaledVector(R_long_aligned, -KNUCKLE_TIE_OFFSET.z) // tie offset z is negative in constant
    .addScaledVector(S_lat_aligned, KNUCKLE_TIE_OFFSET.x);
    
  // Step 4: Measure distance from steering rack inner pivot F(steer=0) to aligned P_tie
  const F_aligned = new THREE.Vector3(140, -50, -80);
  simState.target_TieRod = P_tie_aligned.distanceTo(F_aligned);
}

// Run dynamic calculations and apply values to WebGL meshes & DOM
function updateSimulation() {
  const result = solveKinematics(
    simState.steer,
    simState.travel,
    simState.paramUCA,
    simState.paramLCA,
    simState.paramKP,
    simState.paramHub,
    simState.target_TieRod
  );
  
  // Write positions to state
  simState.A.copy(result.A);
  simState.B.copy(result.B);
  simState.C.copy(result.C);
  simState.D.copy(result.D);
  simState.E.copy(result.E);
  simState.F.copy(result.F);
  simState.G.copy(result.G);
  simState.P_upper.copy(result.P_upper);
  simState.P_lower.copy(result.P_lower);
  simState.P_tie.copy(result.P_tie);
  simState.W_c.copy(result.W_c);
  
  // Telemetry write
  simState.camber = result.camber;
  simState.toe = result.toe;
  simState.caster = result.caster;
  simState.kpi = result.kpi;
  simState.scrub = result.scrub;
  
  // Update DOM Telemetry Panel
  dom.valCamber.textContent = simState.camber.toFixed(2);
  dom.valToe.textContent = simState.toe.toFixed(2);
  dom.valCaster.textContent = simState.caster.toFixed(2);
  dom.valKpi.textContent = simState.kpi.toFixed(2);
  dom.valScrub.textContent = simState.scrub.toFixed(1);
  dom.valTravel.textContent = simState.travel.toFixed(0);
  
  // Warning coloring for extreme telemetry parameters
  colorTelemetryWarning(dom.valCamber, Math.abs(simState.camber) > 3.0);
  colorTelemetryWarning(dom.valToe, Math.abs(simState.toe) > 1.0);
  
  // --- Update WebGL Meshes ---
  // Joint Nodes
  meshes.node_A.position.copy(simState.A);
  meshes.node_B.position.copy(simState.B);
  meshes.node_C.position.copy(simState.C);
  meshes.node_D.position.copy(simState.D);
  meshes.node_E.position.copy(simState.E);
  meshes.node_F.position.copy(simState.F);
  meshes.node_G.position.copy(simState.G);
  meshes.node_UPL.position.copy(simState.P_upper);
  meshes.node_LPL.position.copy(simState.P_lower);
  meshes.node_TPL.position.copy(simState.P_tie);
  
  // Linkages Tubes
  updateTubePosition(meshes.uca_front, simState.A, simState.P_upper, 5);
  updateTubePosition(meshes.uca_rear, simState.B, simState.P_upper, 5);
  updateTubePosition(meshes.lca_front, simState.C, simState.P_lower, 8);
  updateTubePosition(meshes.lca_rear, simState.D, simState.P_lower, 8);
  updateTubePosition(meshes.tie_rod, simState.F, simState.P_tie, 4);
  
  // Coilover (Shock Body & Shaft)
  const shockMid = new THREE.Vector3().addVectors(simState.E, simState.G).multiplyScalar(0.5);
  updateTubePosition(meshes.shock_body, simState.E, shockMid, 14);
  updateTubePosition(meshes.shock_shaft, shockMid, simState.G, 8);
  
  // Dynamic Spring Helix points
  updateSpringHelix();
  
  // Solid Knuckle and Spindle
  if (simState.showSolid) {
    meshes.knuckleGroup.visible = true;
    
    // Positions group center to P_lower and rotates it to align with knuckle frame
    meshes.knuckleGroup.position.copy(simState.P_lower);
    
    // Knuckle Orientation Matrix
    const rotMat = new THREE.Matrix4().makeBasis(result.S_lat, result.K_prime, result.R_long.clone().negate());
    meshes.knuckleGroup.rotation.setFromRotationMatrix(rotMat);
    
    // Scale upright column to span exact distance from P_lower to P_upper
    const kpDist = simState.P_lower.distanceTo(simState.P_upper);
    meshes.upright_v.scale.set(1, kpDist, 1);
    meshes.upright_v.position.set(0, kpDist / 2, 0); // local offset
    
    // Scale steering arm column
    const armDist = KNUCKLE_TIE_OFFSET.length();
    meshes.upright_t.scale.set(1, armDist, 1);
    // Align upright_t pointing towards local TPL
    meshes.upright_t.position.copy(KNUCKLE_TIE_OFFSET).multiplyScalar(0.5);
    meshes.upright_t.lookAt(new THREE.Vector3().copy(simState.P_lower).add(result.R_long.clone().multiplyScalar(100))); // align
  } else {
    meshes.knuckleGroup.visible = false;
  }
  
  // Wheel Mesh Transform
  meshes.wheel.position.copy(simState.W_c);
  const wheelRot = new THREE.Matrix4().makeBasis(result.S_lat, result.K_prime, result.R_long.clone().negate());
  meshes.wheel.rotation.setFromRotationMatrix(wheelRot);
  
  // Kingpin helper line (extends from spindle center line through ball joints down to ground grid)
  if (simState.showKingpin) {
    meshes.kpLine.visible = true;
    meshes.kpGroundPoint.visible = true;
    
    const kpTop = new THREE.Vector3().copy(simState.P_lower).addScaledVector(result.K, 240);
    const Y_ground = -300;
    const t_ground = (Y_ground - simState.P_lower.y) / result.K.y;
    const kpBot = new THREE.Vector3().copy(simState.P_lower).addScaledVector(result.K, t_ground);
    
    meshes.kpLine.geometry.setFromPoints([kpTop, kpBot]);
    meshes.kpLine.geometry.computeBoundingBox();
    meshes.kpLine.geometry.computeBoundingSphere();
    meshes.kpLine.computeLineDistances();
    
    meshes.kpGroundPoint.position.copy(kpBot);
    meshes.kpGroundPoint.position.y = -298.5; // sit flat
  } else {
    meshes.kpLine.visible = false;
    meshes.kpGroundPoint.visible = false;
  }
  
  // Force vectors (shows compression/extension of spring)
  if (simState.showForces) {
    meshes.forceArrow.visible = true;
    meshes.forceArrow.position.copy(simState.G);
    
    // Compute spring force vector (pointing from G along shock axis)
    const springDir = new THREE.Vector3().subVectors(simState.E, simState.G);
    const currentLen = springDir.length();
    springDir.normalize();
    
    const nominalLen = 370.0;
    const stiffness = 8.0; // N/mm dummy stiffness
    const compression = nominalLen - currentLen; // positive for compression
    
    // Set arrow length based on force magnitude
    const forceMag = Math.max(-500, Math.min(500, compression * stiffness));
    meshes.forceArrow.setLength(Math.abs(forceMag) * 0.15 + 10, 10, 5);
    meshes.forceArrow.setDirection(forceMag >= 0 ? springDir : springDir.clone().negate());
    meshes.forceArrow.setColor(new THREE.Color(forceMag >= 0 ? 0xff8f00 : 0x00e5ff));
  } else {
    meshes.forceArrow.visible = false;
  }
  
  // --- Trail Recorders ---
  recordTrails(result);
}

// Generate spiral geometry representing coilover spring
function updateSpringHelix() {
  const points = [];
  const start = simState.E;
  const end = simState.G;
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const u = dir.clone().normalize();
  
  // Find perpendicular coordinate vectors to form circular coils
  let v = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(v)) > 0.9) v.set(0, 1, 0);
  const w = new THREE.Vector3().crossVectors(u, v).normalize();
  v.crossVectors(w, u).normalize();
  
  const radius = 22; // mm
  const coils = 12;
  const resolution = 160;
  
  for (let i = 0; i <= resolution; i++) {
    const t = i / resolution;
    const angle = t * coils * Math.PI * 2;
    const r_cos = Math.cos(angle) * radius;
    const r_sin = Math.sin(angle) * radius;
    const pt = new THREE.Vector3()
      .copy(start)
      .addScaledVector(u, t * len)
      .addScaledVector(v, r_cos)
      .addScaledVector(w, r_sin);
    points.push(pt);
  }
  
  meshes.spring.geometry.setFromPoints(points);
  meshes.spring.geometry.computeBoundingBox();
  meshes.spring.geometry.computeBoundingSphere();
}

// Draw warning colors on DOM indicators if values are out of engineering limits
function colorTelemetryWarning(element, condition) {
  if (condition) {
    element.style.color = 'var(--color-red)';
  } else {
    element.style.color = 'var(--color-cyan)';
  }
}

// Record historical positions to build trailing paths
function recordTrails(res) {
  // Kingpin Ground Intersection Point
  const Y_ground = -300;
  const t_ground = (Y_ground - simState.P_lower.y) / res.K.y;
  const kpBot = new THREE.Vector3().copy(simState.P_lower).addScaledVector(res.K, t_ground);
  
  // Add to path buffers
  if (simState.traceKPPath) {
    simState.kpPathHistory.push(kpBot);
    if (simState.kpPathHistory.length > 500) simState.kpPathHistory.shift();
    meshes.trailKP.visible = true;
    meshes.trailKP.geometry.setFromPoints(simState.kpPathHistory);
    meshes.trailKP.geometry.computeBoundingSphere();
  } else {
    meshes.trailKP.visible = false;
  }

  if (simState.traceWCPath) {
    simState.wcPathHistory.push(simState.W_c.clone());
    if (simState.wcPathHistory.length > 500) simState.wcPathHistory.shift();
    meshes.trailWC.visible = true;
    meshes.trailWC.geometry.setFromPoints(simState.wcPathHistory);
    meshes.trailWC.geometry.computeBoundingSphere();
  } else {
    meshes.trailWC.visible = false;
  }
}

// Clear visual trace lines
function clearTrails() {
  simState.kpPathHistory = [];
  simState.wcPathHistory = [];
  meshes.trailKP.geometry.setFromPoints([]);
  meshes.trailWC.geometry.setFromPoints([]);
}

// --- Live Telemetry Curve Plotter ---
// Background solver pre-computes kinematic curves to plot full suspension travel chart lines

let cachedSweepData = null;

function precomputeSweepCurves() {
  const sweepData = {
    travels: [],
    cambers: [],
    toes: [],
    kpis: []
  };
  
  // Sweep travel from -60 mm to +60 mm at 2mm resolution
  for (let t = -60; t <= 60; t += 2) {
    const res = solveKinematics(
      simState.steer, // computed at current steering rack displacement
      t,
      simState.paramUCA,
      simState.paramLCA,
      simState.paramKP,
      simState.paramHub,
      simState.target_TieRod
    );
    sweepData.travels.push(t);
    sweepData.cambers.push(res.camber);
    sweepData.toes.push(res.toe);
    sweepData.kpis.push(res.kpi);
  }
  
  cachedSweepData = sweepData;
  drawTelemetryCharts();
}

function drawTelemetryCharts() {
  if (!cachedSweepData) return;
  
  // Draw Camber vs Travel
  drawSingleChart(ctxCamber, dom.chartCamber, cachedSweepData.travels, cachedSweepData.cambers, simState.camber, -5.0, 5.0, 'deg');
  // Draw Toe vs Travel
  drawSingleChart(ctxToe, dom.chartToe, cachedSweepData.travels, cachedSweepData.toes, simState.toe, -2.0, 2.0, 'deg');
  // Draw KPI vs Travel
  drawSingleChart(ctxKpi, dom.chartKpi, cachedSweepData.travels, cachedSweepData.kpis, simState.kpi, 6.0, 14.0, 'deg');
}

function drawSingleChart(ctx, canvas, xData, yData, currentVal, minY, maxY, unit) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  
  // Match logical pixels to layout dimensions
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  
  ctx.clearRect(0, 0, w, h);
  
  // Background grids
  ctx.strokeStyle = '#1e242a';
  ctx.lineWidth = 1;
  
  const verticalGridCount = 6;
  const horizontalGridCount = 4;
  
  // Vertical Grid Lines (Travel)
  for (let i = 0; i <= verticalGridCount; i++) {
    const x = (i / verticalGridCount) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  
  // Horizontal Grid Lines (Value)
  for (let i = 0; i <= horizontalGridCount; i++) {
    const y = (i / horizontalGridCount) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  
  // Map coordinates function
  // Travel ranges -60 to +60 mm
  const mapX = (travelVal) => {
    return ((travelVal + 60) / 120) * w;
  };
  
  const mapY = (yVal) => {
    const pct = (yVal - minY) / (maxY - minY);
    return h - pct * h; // invert Y for screen space
  };
  
  // Draw zero level line (if within range)
  if (minY < 0 && maxY > 0) {
    ctx.strokeStyle = '#2d373f';
    ctx.beginPath();
    ctx.moveTo(0, mapY(0));
    ctx.lineTo(w, mapY(0));
    ctx.stroke();
  }
  
  // Plot curves
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < xData.length; i++) {
    const cx = mapX(xData[i]);
    const cy = mapY(yData[i]);
    if (i === 0) {
      ctx.moveTo(cx, cy);
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
  
  // Draw vertical marker indicating current travel position
  const curX = mapX(simState.travel);
  ctx.strokeStyle = '#ff8f00';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(curX, 0);
  ctx.lineTo(curX, h);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw dot marking current point on curve
  ctx.fillStyle = '#ff8f00';
  ctx.beginPath();
  ctx.arc(curX, mapY(currentVal), 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Value label overlays
  ctx.fillStyle = '#6f7881';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillText(maxY.toFixed(1) + unit, 4, 10);
  ctx.fillText(minY.toFixed(1) + unit, 4, h - 4);
}

// --- Dynamic Input Events & User Interface Handles ---

function setupInputListeners() {
  // Manual Sliders
  dom.ctrlTravel.addEventListener('input', (e) => {
    simState.travel = parseFloat(e.target.value);
    dom.lblCtrlTravel.textContent = simState.travel.toFixed(0);
    updateSimulation();
  });
  
  dom.ctrlSteer.addEventListener('input', (e) => {
    simState.steer = parseFloat(e.target.value);
    dom.lblCtrlSteer.textContent = simState.steer.toFixed(0);
    // Steering rack adjustments change sweep charts because curves change with steering angle
    precomputeSweepCurves();
    updateSimulation();
  });

  // Structural Parameters
  dom.paramUca.addEventListener('input', (e) => {
    simState.paramUCA = parseInt(e.target.value);
    dom.lblParamUca.textContent = simState.paramUCA;
    autoAlignTieRod();
    precomputeSweepCurves();
    updateSimulation();
  });

  dom.paramLca.addEventListener('input', (e) => {
    simState.paramLCA = parseInt(e.target.value);
    dom.lblParamLca.textContent = simState.paramLCA;
    autoAlignTieRod();
    precomputeSweepCurves();
    updateSimulation();
  });

  dom.paramKp.addEventListener('input', (e) => {
    simState.paramKP = parseInt(e.target.value);
    dom.lblParamKp.textContent = simState.paramKP;
    autoAlignTieRod();
    precomputeSweepCurves();
    updateSimulation();
  });

  dom.paramHub.addEventListener('input', (e) => {
    simState.paramHub = parseInt(e.target.value);
    dom.lblParamHub.textContent = simState.paramHub;
    autoAlignTieRod();
    precomputeSweepCurves();
    updateSimulation();
  });

  // Cycle speed slider
  dom.sweepSpeed.addEventListener('input', (e) => {
    simState.sweepSpeed = parseFloat(e.target.value);
    dom.lblSweepSpeed.textContent = simState.sweepSpeed.toFixed(1);
  });

  // Automation Button triggers
  const setSweepMode = (mode) => {
    simState.activeSweep = mode;
    
    dom.btnSweepBump.classList.remove('active');
    dom.btnSweepSteer.classList.remove('active');
    dom.btnSweepDual.classList.remove('active');
    dom.btnSweepStop.classList.remove('active');
    
    if (mode === 'bump') dom.btnSweepBump.classList.add('active');
    else if (mode === 'steer') dom.btnSweepSteer.classList.add('active');
    else if (mode === 'dual') dom.btnSweepDual.classList.add('active');
    else dom.btnSweepStop.classList.add('active');
    
    // Clear trails when starting a new automated cycle to keep trace paths clean
    clearTrails();
  };

  dom.btnSweepBump.addEventListener('click', () => setSweepMode('bump'));
  dom.btnSweepSteer.addEventListener('click', () => setSweepMode('steer'));
  dom.btnSweepDual.addEventListener('click', () => setSweepMode('dual'));
  dom.btnSweepStop.addEventListener('click', () => setSweepMode('stop'));
  dom.btnClearCharts.addEventListener('click', () => {
    clearTrails();
  });

  // Checkbox Toggles
  dom.toggleSolid.addEventListener('change', (e) => {
    simState.showSolid = e.target.checked;
    updateSimulation();
  });
  
  dom.toggleKingpin.addEventListener('change', (e) => {
    simState.showKingpin = e.target.checked;
    updateSimulation();
  });
  
  dom.toggleKpPath.addEventListener('change', (e) => {
    simState.traceKPPath = e.target.checked;
    if (!e.target.checked) meshes.trailKP.geometry.setFromPoints([]);
    updateSimulation();
  });

  dom.toggleWcPath.addEventListener('change', (e) => {
    simState.traceWCPath = e.target.checked;
    if (!e.target.checked) meshes.trailWC.geometry.setFromPoints([]);
    updateSimulation();
  });

  dom.toggleForces.addEventListener('change', (e) => {
    simState.showForces = e.target.checked;
    updateSimulation();
  });

  // View presets
  dom.viewIso.addEventListener('click', () => {
    camera.position.set(450, 250, 500);
    controls.target.set(300, 0, 0);
  });
  dom.viewFront.addEventListener('click', () => {
    camera.position.set(300, 0, 800);
    controls.target.set(300, 0, 0);
  });
  dom.viewTop.addEventListener('click', () => {
    camera.position.set(300, 800, 0);
    controls.target.set(300, 0, 0);
  });
  dom.viewSide.addEventListener('click', () => {
    camera.position.set(900, 0, 0);
    controls.target.set(300, 0, 0);
  });
}

// Window resizing
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  precomputeSweepCurves();
});

// Dynamically resizes WebGL drawing buffer to match container layout width and height
function resizeRendererToDisplaySize() {
  const canvas = renderer.domElement;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;
  
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    precomputeSweepCurves();
  }
}

// --- Main Animation & Render Loop ---
let lastTime = 0;
let frameCount = 0;
let fpsTimer = 0;

function animate(timestamp) {
  requestAnimationFrame(animate);
  
  // Enforce container resizing checks
  resizeRendererToDisplaySize();
  
  const dt = (timestamp - lastTime) / 1000.0;
  lastTime = timestamp;
  
  // Calculate FPS status overlay
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1.0) {
    dom.fpsCounter.textContent = Math.round(frameCount / fpsTimer);
    frameCount = 0;
    fpsTimer = 0;
  }
  
  // Automated Sweeps update
  const timeSecs = timestamp / 1000.0;
  const speed = simState.sweepSpeed;
  
  if (simState.activeSweep === 'bump') {
    simState.travel = 55 * Math.sin(timeSecs * 1.5 * speed);
    dom.ctrlTravel.value = simState.travel;
    dom.lblCtrlTravel.textContent = simState.travel.toFixed(0);
    updateSimulation();
  } else if (simState.activeSweep === 'steer') {
    simState.steer = 22 * Math.sin(timeSecs * 1.2 * speed);
    dom.ctrlSteer.value = simState.steer;
    dom.lblCtrlSteer.textContent = simState.steer.toFixed(0);
    precomputeSweepCurves();
    updateSimulation();
  } else if (simState.activeSweep === 'dual') {
    simState.travel = 55 * Math.sin(timeSecs * 1.5 * speed);
    simState.steer = 22 * Math.sin(timeSecs * 0.8 * speed);
    
    dom.ctrlTravel.value = simState.travel;
    dom.lblCtrlTravel.textContent = simState.travel.toFixed(0);
    dom.ctrlSteer.value = simState.steer;
    dom.lblCtrlSteer.textContent = simState.steer.toFixed(0);
    
    precomputeSweepCurves();
    updateSimulation();
  }
  
  // Update controls and orbit camera
  controls.update();
  
  // Redraw HUD lines and charts
  drawTelemetryCharts();
  
  // WebGL Render call
  renderer.render(scene, camera);
}

// --- Initialization Entry Point ---
function init() {
  // Set default camera positioning
  camera.position.set(450, 250, 500);
  controls.update();

  initMeshes();
  setupInputListeners();
  
  // Perform initial kinematics alignment & telemetry curve rendering
  autoAlignTieRod();
  precomputeSweepCurves();
  updateSimulation();
  
  // Start loop
  requestAnimationFrame(animate);
}

init();
