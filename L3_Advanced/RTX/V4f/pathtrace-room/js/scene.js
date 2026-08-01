// 场景定义：解析图元 + 材质，打包为 WebGL 场景纹理数据

const P_SPHERE = 1;
const P_BOX = 2;
const P_QUAD = 3;
const P_PLANE = 4;

function makePrims(n) { return new Float32Array(n * 16); }
function makeMats(n) { return new Float32Array(n * 16); }

function addPrim(buf, i, type, mat, a, b, c) {
  const o = i * 16;
  buf[o] = type;
  buf[o + 1] = mat;
  if (a) buf.set(a, o + 4);
  if (b) buf.set(b, o + 8);
  if (c) buf.set(c, o + 12);
}

function addMat(buf, i, m) {
  const o = i * 16;
  const em = m.emission || [0, 0, 0];
  buf[o] = (m.albedo || [1, 1, 1])[0];
  buf[o + 1] = (m.albedo || [1, 1, 1])[1];
  buf[o + 2] = (m.albedo || [1, 1, 1])[2];
  buf[o + 3] = m.roughness ?? 0.8;
  buf[o + 4] = em[0];
  buf[o + 5] = em[1];
  buf[o + 6] = em[2];
  buf[o + 7] = m.metallic ?? 0;
  buf[o + 8] = m.ior ?? 1.5;
  buf[o + 9] = m.transmission ?? 0;
}

function buildClassic() {
  const prims = makePrims(11);
  const mats = makeMats(10);
  addMat(mats, 0, { albedo: [0.78, 0.78, 0.80], roughness: 0.9 });
  addMat(mats, 1, { albedo: [0.62, 0.10, 0.08], roughness: 0.85 });
  addMat(mats, 2, { albedo: [0.08, 0.45, 0.42], roughness: 0.85 });
  addMat(mats, 3, { albedo: [0.72, 0.64, 0.55], roughness: 0.82 });
  addMat(mats, 4, { emission: [16, 14, 12] });
  addMat(mats, 5, { emission: [6, 8, 10] });
  addMat(mats, 6, { albedo: [0.93, 0.92, 0.90], roughness: 0.05, metallic: 1 });
  addMat(mats, 7, { albedo: [0.97, 0.98, 1.0], roughness: 0.02, ior: 1.5, transmission: 1 });
  addMat(mats, 8, { albedo: [0.95, 0.45, 0.25], roughness: 0.12 });
  addMat(mats, 9, { albedo: [0.25, 0.50, 0.82], roughness: 0.85 });

  addPrim(prims, 0, P_PLANE, 3, [0, 1, 0, -1.6]);
  addPrim(prims, 1, P_PLANE, 0, [0, -1, 0, -1.8]);
  addPrim(prims, 2, P_PLANE, 0, [0, 0, 1, -3.0]);
  addPrim(prims, 3, P_PLANE, 1, [1, 0, 0, -2.8]);
  addPrim(prims, 4, P_PLANE, 2, [-1, 0, 0, -2.8]);
  addPrim(prims, 5, P_QUAD, 4, [0, 1.795, 0, 1.05], [1, 0, 0, 1.05], [0, 0, 1, 0]);
  addPrim(prims, 6, P_QUAD, 5, [-1.0, 0.1, -2.985, 0.85], [1, 0, 0, 0.85], [0, 1, 0, 0]);
  addPrim(prims, 7, P_SPHERE, 6, [-1.05, -1.10, -0.9, 0.5]);
  addPrim(prims, 8, P_SPHERE, 7, [0.95, -0.95, -1.35, 0.65]);
  addPrim(prims, 9, P_BOX, 8, [0.30, -1.18, 0.25, 0.45], [0.42, 0.45, 0.35, 0]);
  addPrim(prims, 10, P_BOX, 9, [-0.55, -1.30, 0.85, 0.30], [0.30, 0.30, -0.5, 0]);

  return {
    prims, materials: mats, lights: [5, 6],
    envTop: [0.02, 0.025, 0.035], envBottom: [0.008, 0.009, 0.012], envIntensity: 1.0,
    camera: { target: [0, 0.05, 0.1], yaw: 0, pitch: 0.18, dist: 5.6, fov: 55 },
  };
}

function buildNight() {
  const prims = makePrims(12);
  const mats = makeMats(10);
  addMat(mats, 0, { albedo: [0.24, 0.25, 0.30], roughness: 0.9 });
  addMat(mats, 1, { albedo: [0.16, 0.13, 0.10], roughness: 0.55 });
  addMat(mats, 2, { albedo: [0.30, 0.30, 0.34], roughness: 0.9 });
  addMat(mats, 3, { emission: [10, 8, 5.5] });
  addMat(mats, 4, { emission: [2.4, 3.6, 6.0] });
  addMat(mats, 5, { emission: [1.2, 0.35, 2.4] });
  addMat(mats, 6, { albedo: [0.90, 0.91, 0.95], roughness: 0.04, metallic: 1 });
  addMat(mats, 7, { albedo: [0.97, 0.98, 1.0], roughness: 0.02, ior: 1.5, transmission: 1 });
  addMat(mats, 8, { albedo: [0.15, 0.55, 0.50], roughness: 0.14 });
  addMat(mats, 9, { albedo: [0.75, 0.55, 0.35], roughness: 0.85 });

  addPrim(prims, 0, P_PLANE, 1, [0, 1, 0, -1.6]);
  addPrim(prims, 1, P_PLANE, 2, [0, -1, 0, -1.8]);
  addPrim(prims, 2, P_PLANE, 0, [0, 0, 1, -3.0]);
  addPrim(prims, 3, P_PLANE, 0, [1, 0, 0, -2.8]);
  addPrim(prims, 4, P_PLANE, 0, [-1, 0, 0, -2.8]);
  addPrim(prims, 5, P_QUAD, 3, [0, 1.795, 0, 1.0], [1, 0, 0, 1.0], [0, 0, 1, 0]);
  addPrim(prims, 6, P_QUAD, 4, [-2.785, 0.15, -0.6, 1.0], [0, 0, 1, 0.95], [0, 1, 0, 0]);
  addPrim(prims, 7, P_QUAD, 5, [0.0, 1.1, -2.985, 1.6], [1, 0, 0, 0.06], [0, 1, 0, 0]);
  addPrim(prims, 8, P_SPHERE, 6, [1.05, -1.12, -0.5, 0.48]);
  addPrim(prims, 9, P_SPHERE, 7, [-0.95, -1.02, -1.45, 0.58]);
  addPrim(prims, 10, P_BOX, 8, [-0.30, -1.20, -0.25, 0.38], [0.40, 0.38, 0.55, 0]);
  addPrim(prims, 11, P_BOX, 9, [0.45, -1.28, 0.55, 0.32], [0.32, 0.32, -0.4, 0]);

  return {
    prims, materials: mats, lights: [5, 6, 7],
    envTop: [0.015, 0.02, 0.04], envBottom: [0.005, 0.006, 0.012], envIntensity: 1.4,
    camera: { target: [0, 0.05, 0.2], yaw: 0.35, pitch: 0.15, dist: 5.4, fov: 55 },
  };
}

function buildArena() {
  const prims = makePrims(39);
  const mats = makeMats(9);
  addMat(mats, 0, { albedo: [0.60, 0.58, 0.55], roughness: 0.9 });
  addMat(mats, 1, { albedo: [0.70, 0.70, 0.72], roughness: 0.9 });
  addMat(mats, 2, { emission: [18, 16, 13] });
  addMat(mats, 3, { emission: [5, 7, 9] });
  addMat(mats, 4, { albedo: [0.92, 0.91, 0.88], roughness: 0.05, metallic: 1 });
  addMat(mats, 5, { albedo: [0.97, 0.98, 1.0], roughness: 0.02, ior: 1.5, transmission: 1 });
  addMat(mats, 6, { albedo: [0.95, 0.42, 0.25], roughness: 0.15 });
  addMat(mats, 7, { albedo: [0.20, 0.45, 0.85], roughness: 0.9 });
  addMat(mats, 8, { albedo: [0.12, 0.55, 0.50], roughness: 0.2 });

  addPrim(prims, 0, P_PLANE, 0, [0, 1, 0, -1.6]);
  addPrim(prims, 1, P_PLANE, 1, [0, -1, 0, -1.8]);
  addPrim(prims, 2, P_PLANE, 1, [0, 0, 1, -3.0]);
  addPrim(prims, 3, P_PLANE, 1, [1, 0, 0, -2.8]);
  addPrim(prims, 4, P_PLANE, 1, [-1, 0, 0, -2.8]);
  addPrim(prims, 5, P_QUAD, 2, [0, 1.795, 0, 1.2], [1, 0, 0, 1.2], [0, 0, 1, 0]);
  addPrim(prims, 6, P_QUAD, 3, [0.0, 0.2, -2.985, 0.9], [1, 0, 0, 0.9], [0, 1, 0, 0]);

  const sphereMats = [4, 5, 6, 7, 8];
  let si = 7;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const x = -2.1 + c * 0.84;
      const z = -1.5 + r * 0.8;
      const k = (r * 6 + c) % sphereMats.length;
      addPrim(prims, si++, P_SPHERE, sphereMats[k], [x, -1.38, z, 0.22]);
    }
  }
  addPrim(prims, si++, P_SPHERE, 4, [-1.9, -1.05, -2.2, 0.55]);
  addPrim(prims, si++, P_SPHERE, 5, [1.9, -0.95, -2.35, 0.65]);

  return {
    prims, materials: mats, lights: [5, 6],
    envTop: [0.016, 0.016, 0.02], envBottom: [0.008, 0.008, 0.01], envIntensity: 0.9,
    camera: { target: [0, 0.05, 0.1], yaw: 0, pitch: 0.22, dist: 5.9, fov: 55 },
  };
}

function buildScene(key) {
  if (key === 'night') return buildNight();
  if (key === 'arena') return buildArena();
  return buildClassic();
}
