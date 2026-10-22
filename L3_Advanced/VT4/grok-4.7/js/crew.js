import { M, T } from "./geom.js";
import { MAT } from "./materials.js";
import { basisBetween, len, sub, v3 } from "./math.js";

function limb(b, a, c, r0, r1, mat) {
  const h = len(sub(c, a));
  if (h < 1e-4) return;
  b.set(mat);
  b.cylinder(r0, r1, h, 10, basisBetween(v3(a[0], a[1], a[2]), v3(c[0], c[1], c[2])));
}

function joint(b, p, r, mat) {
  b.set(mat);
  b.sphere(r, T(p[0], p[1], p[2]), 10, 8);
}

export function addSoldier(b, pose) {
  const cloth = MAT.CLOTH;
  const helm = MAT.HELMET;
  const skin = MAT.SKIN;
  const boot = MAT.RUBBER;
  const J = pose.j;

  b.set(cloth);
  limb(b, J.hips, J.chest, 0.13, 0.15, cloth);
  limb(b, J.chest, J.neck, 0.1, 0.07, cloth);
  limb(b, J.lSho, J.lElb, 0.055, 0.048, cloth);
  limb(b, J.lElb, J.lHand, 0.046, 0.038, cloth);
  limb(b, J.rSho, J.rElb, 0.055, 0.048, cloth);
  limb(b, J.rElb, J.rHand, 0.046, 0.038, cloth);
  limb(b, J.lHip, J.lKnee, 0.07, 0.058, cloth);
  limb(b, J.lKnee, J.lFoot, 0.055, 0.045, cloth);
  limb(b, J.rHip, J.rKnee, 0.07, 0.058, cloth);
  limb(b, J.rKnee, J.rFoot, 0.055, 0.045, cloth);

  joint(b, J.hips, 0.09, cloth);
  joint(b, J.chest, 0.11, cloth);
  joint(b, J.lSho, 0.05, cloth);
  joint(b, J.rSho, 0.05, cloth);
  joint(b, J.lElb, 0.04, cloth);
  joint(b, J.rElb, 0.04, cloth);
  joint(b, J.lKnee, 0.05, cloth);
  joint(b, J.rKnee, 0.05, cloth);

  b.set(boot);
  b.box(0.07, 0.045, 0.14, T(J.lFoot[0], J.lFoot[1] - 0.01, J.lFoot[2] + 0.03));
  b.box(0.07, 0.045, 0.14, T(J.rFoot[0], J.rFoot[1] - 0.01, J.rFoot[2] + 0.03));

  b.set(skin);
  b.sphere(0.075, T(J.head[0], J.head[1], J.head[2]), 12, 10);
  joint(b, J.lHand, 0.032, skin);
  joint(b, J.rHand, 0.032, skin);

  b.set(helm);
  b.sphere(0.098, T(J.head[0], J.head[1] + 0.02, J.head[2]), 14, 10);
  b.box(0.15, 0.035, 0.16, T(J.head[0], J.head[1] - 0.02, J.head[2]));
  b.cylinder(0.012, 0.008, 0.14, 6, M(T(J.head[0] + pose.mic, J.head[1] - 0.02, J.head[2] + 0.08), T(0, 0, 0)));
  b.set(MAT.STEEL_DARK);
  b.box(0.07, 0.04, 0.045, T(J.head[0] + pose.mic, J.head[1] + 0.02, J.head[2] + 0.09));
  b.set(MAT.OPTIC);
  b.box(0.055, 0.022, 0.02, T(J.head[0], J.head[1] + 0.015, J.head[2] + 0.09));

  b.set(cloth);
  b.box(0.22, 0.2, 0.14, T(J.chest[0], J.chest[1] - 0.02, J.chest[2]));
  b.set(MAT.STEEL_DARK);
  b.box(0.1, 0.08, 0.05, T(J.chest[0], J.chest[1] + 0.02, J.chest[2] + 0.07));
}

export function driverPose() {
  return {
    mic: 0.08,
    j: {
      hips: [0, 0.58, 2.28],
      chest: [0, 0.84, 2.36],
      neck: [0, 1.0, 2.4],
      head: [0, 1.08, 2.44],
      lSho: [-0.18, 0.9, 2.34],
      lElb: [-0.16, 0.78, 2.58],
      lHand: [-0.1, 0.84, 2.74],
      rSho: [0.18, 0.9, 2.34],
      rElb: [0.16, 0.78, 2.58],
      rHand: [0.1, 0.84, 2.74],
      lHip: [-0.1, 0.56, 2.3],
      lKnee: [-0.12, 0.52, 2.58],
      lFoot: [-0.1, 0.48, 2.78],
      rHip: [0.1, 0.56, 2.3],
      rKnee: [0.12, 0.52, 2.58],
      rFoot: [0.1, 0.48, 2.78],
    },
  };
}

export function gunnerPose() {
  return {
    mic: -0.08,
    j: {
      hips: [-0.36, 0.06, 0.05],
      chest: [-0.34, 0.32, 0.16],
      neck: [-0.32, 0.46, 0.22],
      head: [-0.3, 0.54, 0.26],
      lSho: [-0.48, 0.34, 0.14],
      lElb: [-0.5, 0.24, 0.32],
      lHand: [-0.42, 0.28, 0.46],
      rSho: [-0.2, 0.34, 0.16],
      rElb: [-0.16, 0.24, 0.34],
      rHand: [-0.12, 0.3, 0.48],
      lHip: [-0.44, 0.05, 0.08],
      lKnee: [-0.46, 0.02, 0.32],
      lFoot: [-0.44, -0.02, 0.5],
      rHip: [-0.26, 0.05, 0.1],
      rKnee: [-0.22, 0.02, 0.34],
      rFoot: [-0.2, -0.02, 0.52],
    },
  };
}

export function commanderPose() {
  return {
    mic: 0.09,
    j: {
      hips: [0.34, 0.08, -0.08],
      chest: [0.32, 0.36, 0.0],
      neck: [0.3, 0.52, 0.06],
      head: [0.28, 0.6, 0.1],
      lSho: [0.18, 0.38, 0.0],
      lElb: [0.12, 0.28, 0.16],
      lHand: [0.1, 0.34, 0.28],
      rSho: [0.48, 0.38, -0.02],
      rElb: [0.5, 0.3, 0.14],
      rHand: [0.42, 0.38, 0.26],
      lHip: [0.24, 0.06, -0.04],
      lKnee: [0.2, 0.02, 0.2],
      lFoot: [0.18, -0.02, 0.4],
      rHip: [0.44, 0.06, -0.06],
      rKnee: [0.46, 0.02, 0.18],
      rFoot: [0.44, -0.02, 0.38],
    },
  };
}
