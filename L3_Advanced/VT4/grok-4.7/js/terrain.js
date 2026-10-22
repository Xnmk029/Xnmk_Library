import { Builder, T } from "./geom.js";
import { MAT } from "./materials.js";
import { clamp, lerp, smooth01, v3 } from "./math.js";

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function terrainHeight(x, z) {
  let h = 0;
  let amp = 0.18;
  let freq = 0.055;
  for (let i = 0; i < 5; i++) {
    h += amp * (noise(x * freq + 2.2, z * freq - 1.4) * 2 - 1);
    amp *= 0.5;
    freq *= 2.07;
  }
  h += (noise(x * 1.8, z * 1.8) * 2 - 1) * 0.01;
  const pad =
    smooth01(1.2 - Math.abs(x)) * smooth01(4.0 - Math.abs(z + 0.1));
  h *= 1 - pad * 0.95;
  for (const sx of [-1.36, 1.36]) {
    const dx = x - sx;
    const along =
      smooth01((z + 3.7) / 0.45) * smooth01((4.5 - z) / 0.55);
    const groove = Math.exp(-(dx * dx) / 0.05);
    h -= groove * 0.04 * along;
    h += Math.sin(z * 46 + sx * 3) * groove * 0.005 * along;
  }
  return h;
}

export function buildGround() {
  const b = new Builder();
  const size = 64;
  const div = 150;
  const step = size / div;
  const half = size / 2;
  b.range({ mat: MAT.GROUND, system: "ground", space: "world", shadow: true }, () => {
    for (let iz = 0; iz < div; iz++) {
      for (let ix = 0; ix < div; ix++) {
        const x0 = -half + ix * step;
        const z0 = -half + iz * step;
        const x1 = x0 + step;
        const z1 = z0 + step;
        b.quad(
          v3(x0, terrainHeight(x0, z0), z0),
          v3(x1, terrainHeight(x1, z0), z0),
          v3(x1, terrainHeight(x1, z1), z1),
          v3(x0, terrainHeight(x0, z1), z1)
        );
      }
    }
  });

  b.range({ mat: MAT.STEEL_DARK, system: "ground", space: "world", shadow: true }, () => {
    let seed = 17;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed & 0x7fffffff) / 2147483647;
    };
    for (let i = 0; i < 42; i++) {
      const x = (rnd() * 2 - 1) * 18;
      const z = (rnd() * 2 - 1) * 18;
      if (Math.abs(x) < 2.4 && z > -4.2 && z < 7.2) continue;
      const y = terrainHeight(x, z);
      const s = 0.05 + rnd() * 0.16;
      b.set(rnd() > 0.5 ? MAT.STEEL_DARK : MAT.EXHAUST);
      b.box(s, s * (0.45 + rnd() * 0.5), s * (0.7 + rnd()), T(x, y + s * 0.2, z));
    }
  });

  return { data: b.data(), ranges: b.ranges, vertexCount: b.vertexCount };
}

export function createDust(count = 2800) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const kind = i < count * 0.62 ? 0 : 1;
    parts.push(resetParticle(kind, Math.random() * 8));
  }
  return {
    parts,
    update(dt, intensity, drift) {
      const spd = drift ? 1 : 0.25;
      for (const p of parts) {
        p.life -= dt * spd;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy += dt * (p.kind === 1 ? 0.35 : 0.05);
        if (p.life <= 0 || p.y > 3.2) Object.assign(p, resetParticle(p.kind, 0));
        p.alpha = intensity * (p.kind === 1 ? 0.32 : 0.14) * Math.sin(clamp(p.life, 0, 1) * Math.PI);
      }
    },
  };
}

function resetParticle(kind, life) {
  if (kind === 1) {
    const side = Math.random() > 0.5 ? 1 : -1;
    return {
      kind,
      x: side * (1.15 + Math.random() * 0.55),
      y: 0.08 + Math.random() * 0.2,
      z: -3.2 + Math.random() * 6.4,
      vx: side * (0.15 + Math.random() * 0.45),
      vy: 0.25 + Math.random() * 0.8,
      vz: -0.2 + Math.random() * 0.5,
      size: 0.018 + Math.random() * 0.04,
      life: life || 0.6 + Math.random() * 1.6,
      alpha: 0,
    };
  }
  return {
    kind,
    x: (Math.random() * 2 - 1) * 14,
    y: 0.3 + Math.random() * 3.2,
    z: (Math.random() * 2 - 1) * 16,
    vx: -0.15 + Math.random() * 0.3,
    vy: -0.05 + Math.random() * 0.08,
    vz: -0.1 + Math.random() * 0.2,
    size: 0.012 + Math.random() * 0.03,
    life: life || 2 + Math.random() * 6,
    alpha: 0,
  };
}

export function dustBuffer(dust) {
  const data = new Float32Array(dust.parts.length * 6);
  dust.parts.forEach((p, i) => {
    data[i * 6] = p.x;
    data[i * 6 + 1] = p.y;
    data[i * 6 + 2] = p.z;
    data[i * 6 + 3] = p.size;
    data[i * 6 + 4] = p.alpha;
    data[i * 6 + 5] = p.kind;
  });
  return data;
}

