/**
 * config.js — global constants: world layout, zones, physics parameters, build recipe
 * Coordinate system: three.js, Y-up. Vehicle forward = +Z.
 * JBeam -> vehicle-local mapping: (vx, vy, vz) = (-jx, jz + LIFT, -jy)
 */
export const CFG = {

  // --- asset locations (relative to server root) ---
  ASSET_ROOT: 'vehicles_web',
  MANIFEST: 'vehicles_web/manifest.json',

  // --- vehicle (CCF / thw) ---
  VEHICLE: {
    // chassis lift so wheel bottoms rest exactly on ground y=0
    LIFT: 0.0717,
    // wheel centers in vehicle-local coords (from jbeam hub nodeOffsets)
    WHEELS: [
      { id: 'FL', x: -0.52, y: 0.28525, z: 1.1994, steer: true,  driven: false },
      { id: 'FR', x: 0.52,  y: 0.28525, z: 1.1994, steer: true,  driven: false },
      { id: 'RL', x: -0.52, y: 0.291381, z: -1.11919, steer: false, driven: true },
      { id: 'RR', x: 0.52,  y: 0.291381, z: -1.11919, steer: false, driven: true },
    ],
    TIRE_RADIUS: 0.36,
    TIRE_WIDTH: 0.255,
    // suspension (tuned from coilover jbeam: beamSpring 30000 @ MR0.65 -> wheel rate ~12.7kN/m;
    // upgraded to realistic values with progressive bump stops)
    SUSP: {
      kFront: 34000, kRear: 31000,          // N/m wheel-rate
      dampFront: 3300, dampRear: 3000,      // N·s/m (~0.75 critical)
      travel: 0.17,                          // m
      restLen: 0.412,                        // m (static sag ~5cm)
      bumpStopK: 180000, bumpStopDamp: 6000, // end-of-travel
      swayBar: 9000,                         // N·m/rad roll stiffness
      maxSteer: 0.52,                        // rad (30°)
      caster: 0.04,                          // rad
    },
    // engine (from ccf_engines.jbeam: 2.3L F4)
    ENGINE: {
      torqueCurve: [[0,0],[500,107],[1000,172],[2000,207],[3000,226],[4000,234],[4500,235],
        [4977,236],[5326,266],[5500,272],[6000,263],[6500,249],[7000,235],[7500,216],[8000,173],[9000,143],[10000,123],[12000,83]],
      idleRPM: 950, maxRPM: 10200, revLimit: 8200,
      inertia: 0.11, friction: 11.5, engineBrake: 38,
      cylinders: 4, stroke: 4,
    },
    GEARBOX: {
      // gearRatios from ccf_transmission.jbeam (index 0 = reverse, 1 = neutral)
      ratios: [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97],
      finalDrive: 3.07,            // from ccf_differential_R_LSD
      efficiency: 0.93,
      shiftUpRPM: 7000, shiftDownRPM: 2600,
    },
    BRAKES: {
      torque: 1900, handbrake: 2400, frontBias: 0.65,
    },
    // physics material (task 1.2: friction >= 1.2, rough)
    TIRE_MATERIAL: { friction: 1.35, rough: true },
    DRAG: { cdA: 0.62, rollCoef: 0.013, waterDrag: 28 },
    MASS_FALLBACK: 1480,
  },

  // --- world / proving ground layout (X east, Z south; forward +Z) ---
  WORLD: {
    cityExtent: 820,          // city grid half-extent
    tileRootSize: 2048,       // quadtree root tile size (2 * cityExtent ~ full map)
    maxTileLevel: 4,
    // proving ground rect (roads/buildings must avoid it)
    pgRect: { x0: -220, x1: 220, z0: -300, z1: 420 },
    spawn: { x: 0, z: 16, yaw: 0 },   // facing +Z
    waterLevel: 0.35,
  },

  // --- zone definitions (for HUD, telemetry & validation) ---
  ZONES: [
    { id: 'start',   name: '起点 START PAD',        x0: -30, x1: 30,  z0: -20, z1: 60 },
    { id: 'cobble',  name: '比利时石 SUSPENSION // BELGIAN COBBLE', x0: -70, x1: 70, z0: 60, z1: 150 },
    { id: 'bumps',   name: '非对称起伏 ASYMMETRIC BUMPS', x0: -70, x1: 70, z0: 150, z1: 235 },
    { id: 'slalom',  name: '绕桩 SLALOM',            x0: -30, x1: 30,  z0: 235, z1: 420 },
    { id: 'banked',  name: '高速弯 BANKED OVAL',     x0: -170, x1: 170, z0: -280, z1: 20 },
    { id: 'wading',  name: '涉水池 WADING POOL',     x0: -240, x1: -120, z0: -320, z1: -180 },
    { id: 'city',    name: '程序化城市 PROCEDURAL CITY', x0: -820, x1: 820, z0: -820, z1: 820 },
  ],

  // --- build recipe: which parts to assemble (stock configuration) ---
  // file: path under ASSET_ROOT; part: part key in that jbeam file
  BUILD: {
    daeFiles: [
      'ccf/ccfremodel.dae',
      'ccf/ccfoffroadster.dae',
      'common/wheels/ccf_wheel_1_thw/ccf_wheels_thw.dae',
      'common/tires/ccftires.dae',
    ],
    parts: [
      { file: 'ccf/jbeams/ccf_body.jbeam',                part: 'ccf_body' },
      { file: 'ccf/jbeams/ccf_fenders_F.jbeam',           part: 'ccf_wing_L' },
      { file: 'ccf/jbeams/ccf_fenders_F.jbeam',           part: 'ccf_wing_R' },
      { file: 'ccf/jbeams/ccf_bonnet.jbeam',              part: 'ccf_bonnet' },
      { file: 'ccf/jbeams/ccf_bumper_F.jbeam',            part: 'ccf_bumper_F' },
      { file: 'ccf/jbeams/ccf_bumper_R.jbeam',            part: 'ccf_bumper_R' },
      { file: 'ccf/jbeams/ccf_boot.jbeam',                part: 'ccf_boot' },
      { file: 'ccf/jbeams/ccf_doors.jbeam',               part: 'ccf_door_L' },
      { file: 'ccf/jbeams/ccf_doors.jbeam',               part: 'ccf_door_R' },
      { file: 'ccf/jbeams/ccf_headlights.jbeam',          part: 'ccf_headlight_L' },
      { file: 'ccf/jbeams/ccf_headlights.jbeam',          part: 'ccf_headlight_R' },
      { file: 'ccf/jbeams/ccf_rearlights.jbeam',          part: 'ccf_rearlight_L' },
      { file: 'ccf/jbeams/ccf_rearlights.jbeam',          part: 'ccf_rearlight_R' },
      { file: 'ccf/jbeams/ccf_mirrors.jbeam',             part: 'ccf_mirror_L' },
      { file: 'ccf/jbeams/ccf_mirrors.jbeam',             part: 'ccf_mirror_R' },
      { file: 'ccf/jbeams/ccf_glass.jbeam',               part: 'ccf_windscreen' },
      { file: 'ccf/jbeams/ccf_glass.jbeam',               part: 'ccf_doorglass_L' },
      { file: 'ccf/jbeams/ccf_glass.jbeam',               part: 'ccf_doorglass_R' },
      { file: 'ccf/jbeams/ccf_glass.jbeam',               part: 'ccf_quarterglass_L' },
      { file: 'ccf/jbeams/ccf_glass.jbeam',               part: 'ccf_quarterglass_R' },
      { file: 'ccf/jbeams/ccf_hardtop.jbeam',             part: 'ccf_hardtop' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_dashboard_lhd' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_gaugecluster_lhd' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_tachometer_lhd' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_shifter_M_lhd' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_handbrake_lhd' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_stalks_usdm' },
      { file: 'ccf/jbeams/ccf_interior_lhd.jbeam',        part: 'ccf_centraltray_lhd' },
      { file: 'ccf/jbeams/ccf_steeringwheels_lhd.jbeam',  part: 'ccf_steer_lhd' },
      // suspension
      { file: 'ccf/jbeams/ccf_suspension_F.jbeam',        part: 'ccf_suspension_F' },
      { file: 'ccf/jbeams/ccf_suspension_F.jbeam',        part: 'ccf_wheeldata_F' },
      { file: 'ccf/jbeams/ccf_suspension_F.jbeam',        part: 'ccf_coilover_F' },
      { file: 'ccf/jbeams/ccf_suspension_F.jbeam',        part: 'ccf_swaybar_F' },
      { file: 'ccf/jbeams/ccf_suspension_F.jbeam',        part: 'ccf_steering' },
      { file: 'ccf/jbeams/ccf_suspension_R.jbeam',        part: 'ccf_suspension_R' },
      { file: 'ccf/jbeams/ccf_suspension_R.jbeam',        part: 'ccf_wheeldata_R' },
      { file: 'ccf/jbeams/ccf_suspension_R.jbeam',        part: 'ccf_coilover_R' },
      { file: 'ccf/jbeams/ccf_suspension_R.jbeam',        part: 'ccf_swaybar_R' },
      { file: 'ccf/jbeams/ccf_brakes.jbeam',              part: 'ccf_brake_F' },
      { file: 'ccf/jbeams/ccf_brakes.jbeam',              part: 'ccf_brake_R' },
      { file: 'ccf/jbeams/ccf_brakes.jbeam',              part: 'ccf_ABS' },
      // powertrain
      { file: 'ccf/jbeams/ccf_engines.jbeam',             part: 'ccf_engine_f4' },
      { file: 'ccf/jbeams/ccf_transmission.jbeam',        part: 'ccf_transmission_6M' },
      { file: 'ccf/jbeams/ccf_differential_R.jbeam',      part: 'ccf_differential_R_LSD' },
      { file: 'ccf/jbeams/ccf_fueltank.jbeam',            part: 'ccf_fueltank' },
      { file: 'ccf/jbeams/ccf_radiator.jbeam',            part: 'ccf_radiator' },
      { file: 'ccf/jbeams/ccf_engbaycrap.jbeam',          part: 'ccf_engbaycrap' },
      { file: 'ccf/jbeams/ccf_exhaust.jbeam',             part: 'ccf_exhaust' },
    ],
    // extra meshes to bind (referenced by props/group logic, not flexbodies)
    extraMeshes: [
      'ccf_engine', 'ccf_pulley_1', 'ccf_pulley_2', 'ccf_pulley_3',
      'ccf_transmission', 'ccf_differential_R', 'ccf_driveshaft',
      'ccf_halfshaft_RR', 'ccf_halfshaft_RL', 'ccf_battery', 'ccf_ebattery',
      'ccf_steeringrack', 'ccf_tierods_F',
    ],
    wheels: [
      { file: 'common/wheels/ccf_wheel_1_thw/ccf_wheels_thw_F_5.jbeam', part: 'ccf_wheel_4a_15x8_thw_F' },
      { file: 'common/wheels/ccf_wheel_1_thw/ccf_wheels_thw_R_5.jbeam', part: 'ccf_wheel_4a_15x8_thw_R' },
    ],
    tires: [
      { file: 'common/tires/15x9_ccf_6l/tires_F_15x9_offroadster.jbeam', part: 'tire_F_29_10_15_offroadster' },
      { file: 'common/tires/15x9_ccf_6l/tires_R_15x9_offroadster.jbeam', part: 'tire_R_29_10_15_offroadster' },
    ],
  },

  // --- render ---
  RENDER: {
    toonSteps: 3,
    outlineWidth: 0.02,
    bloomStrength: 0.55,
    exposure: 1.05,
    sunDir: [0.45, 0.8, 0.35],
    skyTop: 0x1b2f5c, skyHorizon: 0xffb36b, skyGround: 0x3a2b45,
  },

  // --- telemetry ---
  TELE: { sampleHz: 30, buffer: 1200, },
};

export function zoneByName(id) {
  return CFG.ZONES.find(z => z.id === id);
}
