import { Builder, M, RX, RY, RZ, T } from "./geom.js";
import { MAT } from "./materials.js";
import {
  add,
  basisBetween,
  cross,
  dot,
  len,
  mat4FromBasis,
  mul,
  norm,
  sub,
  v3,
} from "./math.js";
import { addSoldier, commanderPose, driverPose, gunnerPose } from "./crew.js";

export const VARIANT_BIT = { vt4: 1, a1: 2, pk: 4 };
const ALL = 7;
const SHOW = 1 | 2;
const BASIC_RWS = 1 | 4;

export const LAYOUT = {
  trackX: 1.36,
  deckY: 1.22,
  turretZ: 0.14,
  belly: 0.43,
  trunnion: [0, 0.42, 0.84],
  barrel: 5.74,
  wheelY: 0.36,
  wheelR: 0.3,
  wheelZ: [-1.98, -1.12, -0.26, 0.6, 1.46, 2.32],
  sprocket: { z: -2.9, y: 0.37, r: 0.32 },
  idler: { z: 3.06, y: 0.39, r: 0.27 },
  rearZ: -3.38,
  noseZ: 3.5,
};

const TAU = Math.PI * 2;

function tubeBetween(b, a, c, r, mat, segs = 8) {
  const h = len(sub(c, a));
  if (h < 1e-4) return;
  b.set(mat);
  b.cylinder(r, r, h, segs, basisBetween(a, c), false);
}

function slopePlate(b, rearZ, rearY, frontZ, frontY, width, thick, x = 0) {
  const dz = frontZ - rearZ;
  const dy = frontY - rearY;
  const length = Math.hypot(dz, dy) || 0.001;
  const pitch = Math.atan2(-dy, dz);
  const cz = (rearZ + frontZ) / 2;
  const cy = (rearY + frontY) / 2;
  b.box(width, thick, length, M(T(x, cy, cz), RX(pitch)));
  return { pitch, cx: x, cy, cz, length };
}

function loopPoints(side) {
  const x = side * LAYOUT.trackX;
  const s = LAYOUT.sprocket;
  const id = LAYOUT.idler;
  const pts = [];
  const pushArc = (cz, cy, r, a0, a1, steps) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(v3(x, cy + Math.sin(a) * r, cz + Math.cos(a) * r));
    }
  };
  const bottomN = 16;
  for (let i = 0; i <= bottomN; i++) {
    const t = i / bottomN;
    const z = id.z + (s.z - id.z) * t;
    const y = id.y - id.r + (s.y - s.r - (id.y - id.r)) * t;
    pts.push(v3(x, y, z));
  }
  pushArc(s.z, s.y, s.r, -Math.PI / 2, -Math.PI * 1.5, 12);
  const topN = 18;
  for (let i = 0; i <= topN; i++) {
    const t = i / topN;
    const z = s.z + (id.z - s.z) * t;
    let y = s.y + s.r + (id.y + id.r - (s.y + s.r)) * t;
    y -= Math.sin(t * Math.PI) * 0.028;
    pts.push(v3(x, y, z));
  }
  pushArc(id.z, id.y, id.r, Math.PI / 2, -Math.PI / 2, 10);
  const clean = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (len(sub(pts[i], clean[clean.length - 1])) > 1e-4) clean.push(pts[i]);
  }
  if (len(sub(clean[0], clean[clean.length - 1])) < 1e-3) clean.pop();
  return clean;
}

function pathLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length; i++) L += len(sub(pts[(i + 1) % pts.length], pts[i]));
  return L;
}

function samplePath(pts, dist) {
  const n = pts.length;
  let total = 0;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const L = len(sub(pts[(i + 1) % n], pts[i]));
    seg.push(L);
    total += L;
  }
  let d = ((dist % total) + total) % total;
  for (let i = 0; i < n; i++) {
    if (d <= seg[i] || i === n - 1) {
      const t = seg[i] > 1e-6 ? d / seg[i] : 0;
      const a = pts[i];
      const c = pts[(i + 1) % n];
      return add(a, mul(sub(c, a), Math.min(t, 1)));
    }
    d -= seg[i];
  }
  return pts[0];
}

function linkMatrix(pts, dist, total) {
  const p = samplePath(pts, dist);
  const ahead = samplePath(pts, dist + 0.05);
  let tangent = norm(sub(ahead, p));
  if (len(tangent) < 1e-4) tangent = v3(0, 0, 1);
  const center = v3(p[0], 0.5, 0.1);
  let inward = v3(0, -tangent[2], tangent[1]);
  if (dot(inward, sub(center, p)) < 0) inward = mul(inward, -1);
  inward = norm(inward);
  let side = norm(cross(inward, tangent));
  let tang = norm(cross(side, inward));
  if (dot(tang, tangent) < 0) {
    side = mul(side, -1);
    tang = norm(cross(side, inward));
  }
  return mat4FromBasis(side, inward, tang, p);
}

function buildLink(b, shoeL) {
  const shoeW = 0.4;
  b.set(MAT.TRACK);
  b.box(shoeW, 0.032, shoeL * 0.9);
  b.box(0.03, 0.055, shoeL * 0.38, T(0, 0.038, 0));
  b.box(0.05, 0.038, shoeL * 0.5, T(shoeW * 0.46, 0.012, 0));
  b.box(0.05, 0.038, shoeL * 0.5, T(-shoeW * 0.46, 0.012, 0));
  b.cylinder(0.011, 0.011, shoeW + 0.08, 6, M(T(0, 0.012, shoeL * 0.36), RZ(-Math.PI / 2)));
  b.cylinder(0.011, 0.011, shoeW + 0.08, 6, M(T(0, 0.012, -shoeL * 0.36), RZ(-Math.PI / 2)));
  b.set(MAT.RUBBER_PAD);
  b.box(shoeW * 0.72, 0.016, shoeL * 0.62, T(0, -0.022, 0));
}

function buildWheel(b) {
  for (const side of [-1, 1]) {
    const x = side * 0.065;
    b.set(MAT.RUBBER);
    b.cylinder(0.3, 0.3, 0.05, 22, M(T(x, 0, 0), RZ(-Math.PI / 2)));
    b.set(MAT.STEEL_DARK);
    b.cylinder(0.15, 0.15, 0.062, 14, M(T(x, 0, 0), RZ(-Math.PI / 2)));
    b.set(MAT.STEEL);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      b.cylinder(
        0.016,
        0.016,
        0.03,
        6,
        M(T(x + side * 0.036, Math.sin(a) * 0.09, Math.cos(a) * 0.09), RZ(-Math.PI / 2))
      );
    }
  }
  b.set(MAT.STEEL_DARK);
  b.cylinder(0.035, 0.035, 0.22, 8, RZ(-Math.PI / 2));
}

function buildSprocket(b) {
  b.set(MAT.STEEL_DARK);
  b.cylinder(0.2, 0.2, 0.16, 16, RZ(-Math.PI / 2));
  b.set(MAT.STEEL);
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * TAU;
    b.box(0.14, 0.055, 0.07, T(0, Math.sin(a) * 0.3, Math.cos(a) * 0.3));
  }
  b.cylinder(0.07, 0.07, 0.22, 10, RZ(-Math.PI / 2));
}

function buildIdler(b) {
  b.set(MAT.STEEL_DARK);
  b.cylinder(0.27, 0.27, 0.12, 18, RZ(-Math.PI / 2));
  b.set(MAT.STEEL);
  b.cylinder(0.08, 0.08, 0.18, 10, RZ(-Math.PI / 2));
}

function buildRoller(b) {
  b.set(MAT.RUBBER);
  b.cylinder(0.065, 0.065, 0.1, 12, RZ(-Math.PI / 2));
  b.set(MAT.STEEL);
  b.cylinder(0.025, 0.025, 0.14, 8, RZ(-Math.PI / 2));
}

function buildFan(b) {
  b.set(MAT.STEEL_DARK, { interior: true });
  b.cylinder(0.07, 0.07, 0.06, 12);
  b.torus(0.32, 0.02, 14, 6);
  b.set(MAT.ALUM);
  for (let i = 0; i < 7; i++) {
    b.box(0.26, 0.01, 0.07, M(RY((i / 7) * TAU), T(0.15, 0.02, 0)));
  }
}

function smokeBank(b, origin, dir, n) {
  for (let i = 0; i < n; i++) {
    const along = (i - (n - 1) / 2) * 0.075;
    const base = v3(origin[0] + along * 0.15, origin[1], origin[2] + along);
    const tip = add(base, dir);
    tubeBetween(b, base, tip, 0.032, MAT.PAINT_DARK, 7);
    b.set(MAT.STEEL_DARK);
    b.sphere(0.03, T(tip[0], tip[1], tip[2]), 8, 6);
  }
}

function basicRws(b) {
  b.cylinder(0.1, 0.12, 0.08, 12, T(0.42, 0.78, -0.05));
  b.set(MAT.PAINT_DARK);
  b.box(0.22, 0.16, 0.34, T(0.42, 0.92, -0.02));
  b.set(MAT.STEEL_DARK);
  b.cylinder(0.018, 0.014, 0.72, 8, M(T(0.42, 0.96, 0.42), RX(Math.PI / 2)));
  b.box(0.16, 0.14, 0.22, T(0.58, 0.9, -0.08));
  b.set(MAT.OPTIC);
  b.box(0.06, 0.05, 0.04, T(0.42, 1.02, 0.16));
}

function heavyRws(b) {
  b.cylinder(0.14, 0.16, 0.1, 12, T(0.28, 0.8, -0.2));
  b.set(MAT.PAINT_DARK);
  b.box(0.46, 0.28, 0.52, T(0.28, 1.02, -0.16));
  b.box(0.4, 0.18, 0.16, M(T(0.28, 1.02, 0.16), RX(-0.15)));
  b.set(MAT.STEEL);
  b.cylinder(0.022, 0.016, 0.9, 8, M(T(0.28, 1.08, 0.55), RX(Math.PI / 2)));
  b.box(0.28, 0.2, 0.34, T(0.52, 1.0, -0.28));
  b.set(MAT.OPTIC);
  b.sphere(0.06, T(0.28, 1.2, 0.02), 10, 8);
  b.box(0.08, 0.05, 0.05, T(0.28, 1.16, 0.22));
}

function radarPanel(b, m) {
  b.set(MAT.APS);
  b.box(0.34, 0.22, 0.04, m);
  b.set(MAT.RADAR);
  b.box(0.28, 0.16, 0.015, M(m, T(0, 0, 0.03)));
}

function apsPod(b, m) {
  b.set(MAT.APS);
  b.box(0.22, 0.16, 0.2, m);
  b.set(MAT.STEEL_DARK);
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * 0.08 - 0.04;
    const oy = Math.floor(i / 2) * 0.07 - 0.03;
    b.cylinder(0.02, 0.018, 0.2, 7, M(m, T(ox, oy, 0.12), RX(0.55)));
  }
}

export function createVehicle() {
  const hull = new Builder();
  const turret = new Builder();
  const gun = new Builder();

  buildHullShell(hull);
  buildHullVariants(hull);
  buildRunningArms(hull);
  buildPowerpack(hull);
  buildFighting(hull);
  buildDriverStation(hull);
  hull.range(
    { mat: MAT.CLOTH, system: "crew", space: "hull", interior: true, explode: [0, 0.7, 1.1] },
    (b) => addSoldier(b, driverPose())
  );

  buildTurretShell(turret);
  buildTurretVariants(turret);
  turret.range(
    { mat: MAT.CLOTH, system: "crew", space: "turret", interior: true, explode: [0, 1.35, 0] },
    (b) => {
      addSoldier(b, gunnerPose());
      addSoldier(b, commanderPose());
    }
  );

  buildGun(gun);

  const rightLoop = loopPoints(1);
  const leftLoop = loopPoints(-1);
  const total = pathLength(rightLoop);
  const linkCount = Math.max(72, Math.round(total / 0.168));
  const spacing = total / linkCount;
  const link = new Builder();
  buildLink(link, spacing * 0.92);
  const wheel = new Builder();
  buildWheel(wheel);
  const sprocket = new Builder();
  buildSprocket(sprocket);
  const idler = new Builder();
  buildIdler(idler);
  const roller = new Builder();
  buildRoller(roller);
  const fan = new Builder();
  buildFan(fan);

  const buffers = [
    pack("hull", hull),
    pack("turret", turret),
    pack("gun", gun),
    pack("wheel", wheel),
    pack("sprocket", sprocket),
    pack("idler", idler),
    pack("roller", roller),
    pack("link", link),
    pack("fan", fan),
  ];

  return {
    buffers,
    gear: {
      linkCount,
      spacing,
      total,
      left: leftLoop,
      right: rightLoop,
      linkMatrix: (side, dist) => linkMatrix(side < 0 ? leftLoop : rightLoop, dist, total),
      fans: [
        [ -0.34, 1.08, -2.55 ],
        [ 0.34, 1.08, -2.55 ],
      ],
    },
    labels: LABELS,
  };
}

function pack(id, builder) {
  return { id, data: builder.data(), ranges: builder.ranges, vertexCount: builder.vertexCount };
}

function buildHullShell(b) {
  const meta = { system: "hull", space: "hull", variants: ALL, explode: [0, 0, 0] };
  b.range({ ...meta, mat: MAT.PAINT }, (g) => {
    g.box(2.04, 0.78, 5.15, T(0, 0.82, -0.15));
    g.box(1.7, 0.1, 4.6, T(0, 0.48, -0.2));
    g.box(3.05, 0.1, 4.3, T(0, 1.2, -0.35));
    g.box(0.42, 0.55, 4.4, T(1.48, 0.9, -0.25));
    g.box(0.42, 0.55, 4.4, T(-1.48, 0.9, -0.25));
    slopePlate(g, -2.55, 1.24, -3.36, 0.95, 2.0, 0.08);
    g.box(2.0, 0.7, 0.1, T(0, 0.78, -3.32));
    g.box(0.55, 0.32, 0.46, T(1.18, 0.48, -2.72));
    g.box(0.55, 0.32, 0.46, T(-1.18, 0.48, -2.72));
  });
  b.range({ ...meta, mat: MAT.PAINT_DARK, system: "hull" }, (g) => {
    g.cylinder(0.32, 0.32, 0.12, 14, T(0, 1.3, 2.42));
    g.box(0.5, 0.08, 0.5, T(0, 1.36, 2.42));
    for (const x of [-0.16, 0, 0.16]) {
      g.set(MAT.GLASS);
      g.box(0.08, 0.06, 0.1, M(T(x, 1.38, 2.66), RX(-0.5)));
    }
    g.set(MAT.PAINT_DARK);
    g.box(0.34, 0.06, 0.34, T(-0.72, 1.28, 0.55));
    g.box(0.34, 0.06, 0.34, T(0.72, 1.28, -0.85));
    g.set(MAT.STEEL);
    for (const x of [-0.55, 0.55]) {
      g.box(0.16, 0.08, 0.2, T(x, 0.5, 3.22));
    }
    g.set(MAT.OPTIC);
    g.box(0.1, 0.08, 0.06, T(1.42, 1.05, 2.55));
    g.box(0.1, 0.08, 0.06, T(-1.42, 1.05, 2.55));
    g.set(MAT.WARN);
    g.box(0.12, 0.08, 0.05, T(1.35, 0.95, -3.2));
    g.box(0.08, 0.08, 0.05, T(-1.35, 0.95, -3.2));
  });
  b.range({ ...meta, mat: MAT.STEEL_DARK, system: "hull" }, (g) => {
    g.cylinder(0.012, 0.008, 1.15, 6, T(-1.05, 1.85, -1.15));
    g.cylinder(0.01, 0.006, 0.85, 6, M(T(1.15, 1.7, -0.85), RZ(0.15)));
    g.set(MAT.EXHAUST);
    g.cylinder(0.08, 0.09, 0.28, 10, M(T(-1.22, 0.78, -2.65), RZ(Math.PI / 2)));
    g.set(MAT.PAINT);
    g.box(0.22, 0.04, 0.7, T(1.25, 1.26, 1.5));
    g.box(0.08, 0.04, 0.35, M(T(-1.22, 1.27, 0.4), RY(0.4)));
  });
}

function buildHullVariants(b) {
  const std = { system: "era", space: "hull", variants: SHOW, highlight: false, explode: [0, 0.35, 0.45] };
  b.range({ ...std, mat: MAT.PAINT }, (g) => {
    const plate = slopePlate(g, 2.05, 1.2, 3.46, 0.66, 2.02, 0.08);
    g.set(MAT.ERA);
    const cols = 5;
    const rows = 3;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const lx = (ix - (cols - 1) / 2) * 0.36;
        const lz = (iy - (rows - 1) / 2) * 0.36;
        g.box(0.32, 0.085, 0.3, M(T(plate.cx, plate.cy, plate.cz), RX(plate.pitch), T(lx, 0.09, lz)));
      }
    }
    slopePlate(g, 3.05, 0.46, 3.5, 0.64, 1.9, 0.07);
    g.set(MAT.PAINT);
    g.box(0.85, 0.06, 0.7, M(T(1.15, 0.95, 2.85), RX(0.25), RZ(0.15)));
    g.box(0.85, 0.06, 0.7, M(T(-1.15, 0.95, 2.85), RX(0.25), RZ(-0.15)));
  });

  b.range({ ...std, mat: MAT.PAINT_DARK, system: "hull", variants: SHOW, explode: [0.2, 0, 0] }, (g) => {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = -1.7 + i * 1.15;
        g.box(0.06, 0.52, 1.02, T(side * 1.7, 0.78, z));
      }
      g.set(MAT.ERA);
      for (let i = 0; i < 3; i++) {
        g.box(0.07, 0.22, 0.42, T(side * 1.74, 0.95, 1.15 + i * 0.5));
      }
      g.set(MAT.PAINT_DARK);
    }
  });

  b.range({ ...std, mat: MAT.STEEL_DARK, system: "hull", variants: SHOW, highlight: false, explode: [0, 0.2, -0.4] }, (g) => {
    for (let i = 0; i < 7; i++) {
      g.box(1.15, 0.025, 0.55, T(0, 1.34, -1.15 - i * 0.28));
      g.set(MAT.STEEL);
      g.box(1.05, 0.012, 0.02, T(0, 1.36, -1.15 - i * 0.28));
      g.set(MAT.STEEL_DARK);
    }
  });

  const pk = { system: "era", space: "hull", variants: VARIANT_BIT.pk, highlight: true, explode: [0, 0.4, 0.6] };
  b.range({ ...pk, mat: MAT.PAINT }, (g) => {
    const left = slopePlate(g, 2.15, 1.16, 3.42, 0.78, 0.85, 0.09, -0.55);
    const right = slopePlate(g, 2.15, 1.16, 3.42, 0.78, 0.85, 0.09, 0.55);
    g.set(MAT.PAINT_DARK);
    g.box(0.28, 0.16, 1.35, M(T(0, 0.98, 2.85), RX(0.42)));
    slopePlate(g, 3.15, 0.48, 3.58, 0.78, 1.7, 0.08);
    g.set(MAT.ERA);
    for (const plate of [left, right]) {
      for (let iy = 0; iy < 3; iy++) {
        for (let ix = 0; ix < 2; ix++) {
          g.box(0.3, 0.09, 0.26, M(T(plate.cx, plate.cy, plate.cz), RX(plate.pitch), T((ix - 0.5) * 0.38, 0.1, (iy - 1) * 0.4)));
        }
      }
    }
  });
  b.range({ ...pk, mat: MAT.PAINT_DARK, system: "hull", explode: [0.35, 0, 0.2] }, (g) => {
    for (const side of [-1, 1]) {
      g.box(0.7, 0.08, 0.9, M(T(side * 1.25, 0.82, 3.05), RX(0.35), RZ(side * 0.35)));
      for (let i = 0; i < 6; i++) {
        const z = -1.85 + i * 0.85;
        const h = i === 5 ? 0.62 : 0.48;
        g.box(0.055, h, 0.62, T(side * 1.72, 0.72 + (i === 5 ? 0.05 : 0), z));
      }
    }
  });
  b.range({ ...pk, mat: MAT.ALUM, system: "hull", explode: [0, 0.25, -0.5] }, (g) => {
    for (let i = 0; i < 14; i++) {
      g.box(0.025, 0.12, 0.7, T(-0.55 + i * 0.085, 1.38, -2.35));
    }
    g.set(MAT.STEEL_DARK);
    g.box(1.35, 0.03, 0.85, T(0, 1.32, -2.35));
  });
}

function buildRunningArms(b) {
  b.range({ mat: MAT.STEEL_DARK, system: "running", space: "hull", variants: ALL, shadow: true }, (g) => {
    for (const z of LAYOUT.wheelZ) {
      for (const side of [-1, 1]) {
        tubeBetween(g, v3(side * 1.02, 0.62, z), v3(side * 1.28, LAYOUT.wheelY, z), 0.04, MAT.STEEL_DARK, 7);
      }
    }
    for (const z of [LAYOUT.wheelZ[0], LAYOUT.wheelZ[1], LAYOUT.wheelZ[5]]) {
      for (const side of [-1, 1]) {
        tubeBetween(g, v3(side * 1.0, 0.95, z - 0.25), v3(side * 1.24, LAYOUT.wheelY + 0.05, z), 0.025, MAT.STEEL, 6);
      }
    }
    tubeBetween(g, v3(1.05, 0.7, 2.7), v3(1.3, LAYOUT.idler.y, LAYOUT.idler.z), 0.045, MAT.STEEL_DARK, 7);
    tubeBetween(g, v3(-1.05, 0.7, 2.7), v3(-1.3, LAYOUT.idler.y, LAYOUT.idler.z), 0.045, MAT.STEEL_DARK, 7);
  });
}

function buildPowerpack(b) {
  const meta = { system: "power", space: "hull", interior: true, variants: ALL, explode: [0, 0.45, -1.25] };
  b.range({ ...meta, mat: MAT.ENGINE }, (g) => {
    g.box(0.62, 0.4, 1.25, T(0, 0.78, -2.35));
    g.box(0.7, 0.22, 1.15, T(0, 0.62, -2.35));
    for (const bank of [-1, 1]) {
      g.set(MAT.ALUM);
      g.box(0.16, 0.1, 1.05, M(T(bank * 0.28, 1.02, -2.35), RZ(bank * -0.7)));
      for (let i = 0; i < 6; i++) {
        const z = -2.78 + i * 0.18;
        tubeBetween(
          g,
          v3(bank * 0.12, 0.9, z),
          v3(bank * 0.42, 1.12, z),
          0.055,
          MAT.ENGINE,
          8
        );
      }
    }
    g.set(MAT.STEEL);
    g.box(0.68, 0.46, 0.58, T(0, 0.74, -1.58));
    g.cylinder(0.12, 0.16, 0.2, 10, M(T(0, 0.74, -1.25), RX(Math.PI / 2)));
    for (const side of [-1, 1]) {
      g.set(MAT.EXHAUST);
      g.torus(0.1, 0.04, 10, 6, M(T(side * 0.34, 0.95, -2.95), RZ(side * 0.6)));
      g.cylinder(0.05, 0.05, 0.2, 8, M(T(side * 0.48, 1.02, -2.95), RZ(Math.PI / 2)));
      g.set(MAT.ALUM);
      g.box(0.12, 0.45, 0.7, T(side * 0.62, 0.95, -2.4));
      for (let f = 0; f < 8; f++) {
        g.box(0.01, 0.4, 0.62, T(side * 0.66, 0.95, -2.68 + f * 0.08));
      }
    }
    tubeBetween(g, v3(-0.4, 0.98, -2.9), v3(-1.05, 0.8, -2.65), 0.045, MAT.EXHAUST, 7);
    tubeBetween(g, v3(0.15, 0.7, -1.45), v3(0.85, 0.48, -2.7), 0.04, MAT.STEEL_DARK, 7);
    tubeBetween(g, v3(-0.15, 0.7, -1.45), v3(-0.85, 0.48, -2.7), 0.04, MAT.STEEL_DARK, 7);
    g.set(MAT.WARN);
    g.box(0.7, 0.55, 0.04, T(0, 0.85, -1.35));
    g.set(MAT.STEEL_DARK);
    for (const z of LAYOUT.wheelZ) {
      g.cylinder(0.035, 0.035, 1.7, 8, M(T(0, 0.55, z), RZ(Math.PI / 2)));
    }
  });
}

function buildFighting(b) {
  const meta = { system: "fight", space: "hull", interior: true, variants: ALL, explode: [0, 0.2, 0] };
  b.range({ ...meta, mat: MAT.INTERIOR }, (g) => {
    g.cylinder(0.78, 0.78, 0.08, 20, T(0, 0.7, LAYOUT.turretZ));
    g.torus(0.72, 0.04, 16, 6, T(0, 0.78, LAYOUT.turretZ));
    g.set(MAT.STEEL_DARK);
    g.cylinder(0.18, 0.18, 0.35, 10, T(0, 0.62, LAYOUT.turretZ));
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const dir = v3(Math.cos(a), 0, Math.sin(a));
      const base = v3(dir[0] * 0.28, 0.6, LAYOUT.turretZ + dir[2] * 0.28);
      const tip = add(base, mul(dir, 0.48));
      tubeBetween(g, base, tip, 0.026, i % 2 ? MAT.STEEL_DARK : MAT.EXHAUST, 7);
      const chargeA = v3(base[0], 0.68, base[2]);
      const chargeB = v3(tip[0], 0.68, tip[2]);
      tubeBetween(g, chargeA, add(chargeA, mul(dir, 0.28)), 0.03, MAT.BRASS, 7);
      g.set(MAT.STEEL);
      g.box(0.08, 0.02, 0.16, T((base[0] + tip[0]) / 2, 0.55, (base[2] + tip[2]) / 2));
      void chargeB;
    }
    g.set(MAT.STEEL_DARK);
    for (let i = 0; i < 8; i++) {
      const z = 0.9 + (i % 4) * 0.22;
      const x = i < 4 ? -0.78 : 0.78;
      tubeBetween(g, v3(x, 0.6, z), v3(x + (i < 4 ? -0.15 : 0.15), 0.6, z), 0.025, MAT.STEEL_DARK, 6);
      g.set(MAT.BRASS);
      g.cylinder(0.028, 0.028, 0.18, 6, M(T(x, 0.68, z), RZ(Math.PI / 2)));
    }
    g.set(MAT.STEEL_DARK);
    g.tube(
      [v3(-0.2, 0.85, 0.55), v3(-0.55, 1.05, 0.2), v3(-0.4, 1.12, -0.3)],
      0.012,
      5
    );
    g.tube(
      [v3(0.25, 0.8, 0.4), v3(0.6, 1.02, 0.1), v3(0.45, 1.1, -0.45)],
      0.012,
      5
    );
  });
}

function buildDriverStation(b) {
  const meta = { system: "driver", space: "hull", interior: true, variants: ALL, explode: [0, 0.55, 1.35] };
  b.range({ ...meta, mat: MAT.INTERIOR }, (g) => {
    g.box(0.42, 0.08, 0.42, T(0, 0.52, 2.25));
    g.box(0.12, 0.28, 0.12, T(0, 0.66, 2.12));
    g.set(MAT.STEEL_DARK);
    g.cylinder(0.025, 0.025, 0.35, 8, M(T(0, 0.88, 2.55), RX(Math.PI / 2)));
    g.set(MAT.STEEL);
    g.torus(0.14, 0.016, 14, 6, M(T(0, 0.9, 2.78), RX(Math.PI / 2)));
    g.cylinder(0.015, 0.015, 0.28, 6, M(T(0, 0.9, 2.78), RZ(Math.PI / 2)));
    g.set(MAT.DISPLAY);
    g.box(0.22, 0.14, 0.03, T(0, 1.0, 3.02));
    g.box(0.14, 0.1, 0.03, T(-0.28, 0.96, 2.98));
    g.box(0.14, 0.1, 0.03, T(0.28, 0.96, 2.98));
    g.set(MAT.STEEL_DARK);
    g.box(0.08, 0.03, 0.12, T(-0.1, 0.5, 2.85));
    g.box(0.08, 0.03, 0.12, T(0.1, 0.5, 2.85));
    g.box(0.1, 0.04, 0.08, T(0.28, 0.52, 2.7));
    for (const x of [-0.16, 0, 0.16]) {
      tubeBetween(g, v3(x, 1.22, 2.62), v3(x, 1.05, 2.78), 0.03, MAT.STEEL_DARK, 6);
    }
    g.set(MAT.GLASS);
    g.box(0.34, 0.04, 0.12, T(0, 1.18, 2.7));
  });
}

function buildTurretShell(b) {
  const meta = { system: "turret", space: "turret", variants: ALL, explode: [0, 1.05, 0] };
  b.range({ ...meta, mat: MAT.PAINT }, (g) => {
    g.box(2.15, 0.62, 2.15, T(0, 0.38, -0.15));
    g.box(1.15, 0.58, 1.25, M(T(0.62, 0.4, 0.72), RY(0.48)));
    g.box(1.15, 0.58, 1.25, M(T(-0.62, 0.4, 0.72), RY(-0.48)));
    g.box(1.7, 0.08, 2.35, T(0, 0.72, -0.1));
    g.box(1.55, 0.42, 0.7, T(0, 0.36, -1.25));
    g.cylinder(0.72, 0.78, 0.12, 18, T(0, 0.08, 0));
    g.set(MAT.PAINT_DARK);
    g.cylinder(0.28, 0.3, 0.08, 12, T(-0.38, 0.78, 0.15));
    g.cylinder(0.26, 0.28, 0.08, 12, T(0.4, 0.78, -0.02));
    g.box(0.36, 0.06, 0.36, T(-0.38, 0.84, 0.15));
    g.box(0.34, 0.06, 0.34, T(0.4, 0.84, -0.02));
  });
  b.range({ ...meta, mat: MAT.STEEL_DARK }, (g) => {
    g.cylinder(0.1, 0.13, 0.22, 10, T(0.48, 0.9, 0.42));
    g.set(MAT.OPTIC);
    g.box(0.16, 0.1, 0.18, T(0.48, 1.08, 0.42));
    g.box(0.12, 0.06, 0.02, T(0.48, 1.08, 0.52));
    g.set(MAT.PAINT_DARK);
    g.box(0.22, 0.16, 0.4, T(-0.42, 0.86, 0.72));
    g.set(MAT.GLASS);
    g.box(0.12, 0.08, 0.02, T(-0.42, 0.88, 0.93));
    g.set(MAT.STEEL);
    for (let i = 0; i < 5; i++) {
      g.box(1.35, 0.025, 0.025, T(0, 0.35 + i * 0.08, -1.62));
      g.box(0.025, 0.4, 0.025, T(-0.6 + i * 0.3, 0.5, -1.62));
    }
    g.set(MAT.PAINT_DARK);
    g.box(0.08, 0.35, 0.7, T(0.95, 0.45, -1.15));
    g.box(0.7, 0.08, 0.08, T(0.55, 0.62, -1.15));
    g.box(0.08, 0.35, 0.7, T(-0.95, 0.45, -1.15));
    g.cylinder(0.012, 0.006, 0.95, 5, T(-0.85, 1.25, -0.95));
    g.cylinder(0.01, 0.005, 0.7, 5, T(0.9, 1.15, -0.7));
  });
  b.range({ ...meta, mat: MAT.ERA, system: "era", explode: [0, 0.35, 0.85] }, (g) => {
    for (const side of [-1, 1]) {
      for (let iy = 0; iy < 3; iy++) {
        for (let ix = 0; ix < 2; ix++) {
          const y = 0.28 + iy * 0.18;
          const z = 0.45 + ix * 0.32;
          g.box(0.3, 0.16, 0.085, M(T(side * 0.72, y, z), RY(side * 0.5), T(0, 0, 0.55)));
        }
      }
    }
  });
  b.range({ ...meta, mat: MAT.ERA, system: "era", variants: SHOW, explode: [0.85, 0.1, 0] }, (g) => {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        g.box(0.08, 0.18, 0.3, M(T(side * 1.12, 0.48, -0.55 + i * 0.32), RZ(side * -0.12)));
      }
    }
  });
  b.range({ ...meta, mat: MAT.PAINT_DARK, variants: BASIC_RWS, explode: [0.15, 0.85, 0] }, (g) => {
    basicRws(g);
    smokeBank(g, v3(0.95, 0.55, 0.85), v3(0.28, 0.18, 0.12), 6);
    smokeBank(g, v3(-0.95, 0.55, 0.85), v3(-0.28, 0.18, 0.12), 6);
  });
}

function buildTurretVariants(b) {
  const a1 = { system: "turret", space: "turret", variants: VARIANT_BIT.a1, highlight: true, explode: [0, 1.25, 0] };
  b.range({ ...a1, mat: MAT.PAINT_DARK }, (g) => {
    heavyRws(g);
    g.set(MAT.PAINT);
    g.box(1.55, 0.06, 1.7, T(0, 0.8, -0.05));
    g.box(0.78, 0.2, 0.26, M(T(0, 0.96, -1.05), RX(-0.35)));
    g.set(MAT.STEEL_DARK);
    g.box(0.7, 0.015, 0.22, M(T(0, 1.05, -1.02), RX(-0.35)));
  });
  b.range({ ...a1, mat: MAT.APS, explode: [0.4, 0.4, 0] }, (g) => {
    radarPanel(g, M(T(1.2, 0.55, 0.35), RY(Math.PI / 2)));
    radarPanel(g, M(T(-1.2, 0.55, 0.35), RY(-Math.PI / 2)));
    radarPanel(g, M(T(0.85, 0.58, 1.15), RY(0.6)));
    radarPanel(g, M(T(-0.85, 0.58, 1.15), RY(-0.6)));
    apsPod(g, M(T(1.05, 0.85, 0.85), RZ(-0.4)));
    apsPod(g, M(T(-1.05, 0.85, 0.85), RZ(0.4)));
    apsPod(g, M(T(1.0, 0.78, -0.85), RZ(-0.2), RY(2.4)));
    apsPod(g, M(T(-1.0, 0.78, -0.85), RZ(0.2), RY(-2.4)));
    g.set(MAT.OPTIC);
    for (const p of [
      [1.0, 0.9, 0.9],
      [-1.0, 0.9, 0.9],
      [1.0, 0.9, -0.9],
      [-1.0, 0.9, -0.9],
    ]) {
      g.cylinder(0.035, 0.03, 0.06, 8, T(p[0], p[1], p[2]));
      g.set(MAT.GLASS);
      g.sphere(0.028, T(p[0], p[1] + 0.04, p[2]), 8, 6);
      g.set(MAT.OPTIC);
    }
    smokeBank(g, v3(0.9, 0.5, -0.4), v3(0.22, 0.2, -0.18), 5);
    smokeBank(g, v3(-0.9, 0.5, -0.4), v3(-0.22, 0.2, -0.18), 5);
  });

  const pk = { system: "era", space: "turret", variants: VARIANT_BIT.pk, highlight: true, explode: [1.0, 0.15, 0] };
  b.range({ ...pk, mat: MAT.ERA }, (g) => {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        g.box(0.09, 0.16, 0.28, M(T(side * 1.16, 0.58, -0.7 + i * 0.36), RZ(side * -0.28)));
      }
      g.set(MAT.ERA2);
      for (let i = 0; i < 4; i++) {
        g.box(0.07, 0.12, 0.2, M(T(side * 1.2, 0.34, -0.45 + i * 0.42), RZ(side * -0.52)));
      }
      g.set(MAT.ERA);
    }
  });
}

function buildGun(b) {
  const L = LAYOUT.barrel;
  b.range(
    { mat: MAT.STEEL_DARK, system: "gun", space: "gun", variants: ALL, explode: [0, 0.15, 1.15] },
    (g) => {
      g.cylinder(0.09, 0.055, L, 16, M(T(0, 0, L / 2), RX(Math.PI / 2)));
      g.set(MAT.STEEL);
      g.cylinder(0.075, 0.075, 0.55, 14, M(T(0, 0, L * 0.72), RX(Math.PI / 2)));
      for (let i = 1; i <= 6; i++) {
        g.cylinder(0.078, 0.078, 0.04, 12, M(T(0, 0, 0.45 + i * 0.7), RX(Math.PI / 2)));
      }
      g.set(MAT.STEEL_DARK);
      g.cylinder(0.07, 0.09, 0.16, 12, M(T(0, 0, L - 0.02), RX(Math.PI / 2)));
      g.set(MAT.PAINT_DARK);
      g.cylinder(0.02, 0.02, 0.12, 6, T(0, 0.1, L - 0.12));
      g.set(MAT.OPTIC);
      g.box(0.04, 0.04, 0.05, T(0, 0.16, L - 0.08));
      g.set(MAT.PAINT);
      g.cylinder(0.2, 0.16, 0.28, 14, M(T(0, 0, 0.05), RX(Math.PI / 2)));
      g.box(0.36, 0.32, 0.4, T(0, 0, -0.05));
      g.set(MAT.STEEL_DARK);
      g.cylinder(0.012, 0.01, 0.55, 6, M(T(0.14, 0.04, 0.35), RX(Math.PI / 2)));
    }
  );
  b.range(
    { mat: MAT.STEEL, system: "gun", space: "gun", interior: true, variants: ALL, explode: [0, 0.2, -0.35] },
    (g) => {
      g.box(0.28, 0.32, 0.55, T(0, 0.02, -0.45));
      g.box(0.18, 0.16, 0.12, T(0, 0.02, -0.72));
      g.set(MAT.STEEL_DARK);
      g.cylinder(0.045, 0.045, 0.55, 8, M(T(0.12, 0.16, -0.35), RX(Math.PI / 2)));
      g.cylinder(0.045, 0.045, 0.55, 8, M(T(-0.12, 0.16, -0.35), RX(Math.PI / 2)));
      g.box(0.08, 0.08, 0.7, T(0, -0.05, -0.15));
      g.set(MAT.ALUM);
      g.box(0.06, 0.05, 0.35, T(0, 0.08, -0.95));
      g.set(MAT.STEEL_DARK);
      g.tube(
        [v3(0.1, 0.1, -0.7), v3(0.28, 0.2, -0.4), v3(0.22, -0.1, 0.1)],
        0.015,
        5
      );
    }
  );
}

export const LABELS = [
  { text: "ZPT-98A 125 mm 滑膛炮", space: "gun", local: [0.2, 0.28, 4.4], system: "gun" },
  { text: "复合装甲炮塔", space: "turret", local: [1.25, 0.85, -0.2], system: "turret" },
  { text: "FY-4 反应装甲", space: "hull", local: [0.85, 1.35, 2.7], system: "era" },
  { text: "车长周视镜", space: "turret", local: [0.85, 1.2, 0.42], system: "turret" },
  { text: "遥控武器站", space: "turret", local: [0.9, 1.25, -0.05], system: "turret" },
  { text: "双销履带", space: "world", local: [1.85, 0.55, 0.4], system: "running" },
  { text: "六对负重轮", space: "world", local: [-1.9, 0.4, 0.8], system: "running" },
  { text: "动力舱", space: "hull", local: [0.2, 1.7, -2.4], system: "power" },
  { text: "战斗舱 / 弹盘", space: "hull", local: [-1.15, 0.85, 0.2], system: "fight" },
  { text: "驾驶舱", space: "hull", local: [0.15, 1.65, 2.45], system: "driver" },
];
