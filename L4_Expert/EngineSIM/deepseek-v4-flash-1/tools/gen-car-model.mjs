// 程序化生成 SportsCar2 风格双门轿跑 OBJ/MTL（本项目自建模型，物理尺寸：
// 轴距 2.946m、轮距 1.62m、轮径 0.352m；车头 +Z）。来源：自建程序化模型，无需许可。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'models', 'sports-car2');

const WB = 2.946, TRACK = 1.62, WHEEL_R = 0.352, WHEEL_W = 0.28;
const FRONT_AXLE = WB / 2, REAR_AXLE = -WB / 2;

class MeshBuilder {
  constructor() { this.v = []; this.vn = []; this.vt = []; this.faces = []; }
  addVertex(x, y, z) { this.v.push(x, y, z); return this.v.length / 3 - 1; }
  quad(a, b, c, d) { this.faces.push([a, b, c], [a, c, d]); }
  tri(a, b, c) { this.faces.push([a, b, c]); }
  // 沿截面环放样
  loft(sections, closed = true, flip = false) {
    const rings = sections.map((sec) => sec.map((p) => this.addVertex(p[0], p[1], p[2])));
    for (let s = 0; s + 1 < rings.length; s++) {
      const n = rings[s].length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = rings[s][i], b = rings[s][j], c = rings[s + 1][j], d = rings[s + 1][i];
        if (flip) this.quad(a, d, c, b); else this.quad(a, b, c, d);
      }
    }
    if (closed) {
      const n = rings[0].length;
      const cap = this.addVertex(rings[0][0][0], rings[0][0][1], rings[0][0][2]); // 占位（实际用首环顶点）
      void cap;
    }
  }
  computeNormals() {
    this.vn = new Array(this.v.length).fill(0);
    for (const f of this.faces) {
      const [a, b, c] = f;
      const ax = this.v[a * 3], ay = this.v[a * 3 + 1], az = this.v[a * 3 + 2];
      const bx = this.v[b * 3], by = this.v[b * 3 + 1], bz = this.v[b * 3 + 2];
      const cx = this.v[c * 3], cy = this.v[c * 3 + 1], cz = this.v[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const wx = cx - ax, wy = cy - ay, wz = cz - az;
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.vn[a * 3] += nx; this.vn[a * 3 + 1] += ny; this.vn[a * 3 + 2] += nz;
      this.vn[b * 3] += nx; this.vn[b * 3 + 1] += ny; this.vn[b * 3 + 2] += nz;
      this.vn[c * 3] += nx; this.vn[c * 3 + 1] += ny; this.vn[c * 3 + 2] += nz;
    }
    for (let i = 0; i < this.vn.length; i += 3) {
      const l = Math.hypot(this.vn[i], this.vn[i + 1], this.vn[i + 2]) || 1;
      this.vn[i] /= l; this.vn[i + 1] /= l; this.vn[i + 2] /= l;
    }
  }
  toObj(group, mat, offset) {
    this.computeNormals();
    let out = `g ${group}\nusemtl ${mat}\n`;
    for (let i = 0; i < this.v.length; i += 3) out += `v ${fmt(this.v[i])} ${fmt(this.v[i + 1])} ${fmt(this.v[i + 2])}\n`;
    for (let i = 0; i < this.vn.length; i += 3) out += `vn ${fmt(this.vn[i])} ${fmt(this.vn[i + 1])} ${fmt(this.vn[i + 2])}\n`;
    const base = (offset || 0) + 1;
    for (const f of this.faces) out += `f ${f[0] + base}//${f[0] + base} ${f[1] + base}//${f[1] + base} ${f[2] + base}//${f[2] + base}\n`;
    return out;
  }
}

function fmt(x) {
  const s = x.toFixed(4);
  return s.replace(/\.?0+$/, '');
}

function circle(radius, y, z, count, ry) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    pts.push([Math.cos(a) * radius, ry, Math.sin(a) * radius]);
  }
  return pts;
}

// ---------- 车身 ----------
function buildBody() {
  const b = new MeshBuilder();
  const H = 0.68; // 底盘高度（轮轴中心）
  // 车身剖面（x 从前到后）：[宽半, 高(相对地面), z]
  const sections = [
    [0.72, 0.52, 2.20], [0.82, 0.55, 2.05], [0.92, 0.62, 1.80], [0.97, 0.70, 1.47],
    [0.97, 0.78, 1.10], [0.95, 0.86, 0.70], [0.92, 0.93, 0.30], [0.90, 0.97, -0.10],
    [0.90, 0.97, -0.55], [0.93, 0.92, -0.95], [0.96, 0.84, -1.35], [0.94, 0.72, -1.70],
    [0.86, 0.62, -2.05], [0.72, 0.56, -2.28]
  ];
  const rings = [];
  for (const [hw, h, z] of sections) {
    const ring = [];
    const top = H + h;
    const bot = H - 0.10;
    ring.push([-hw, top, z]);
    ring.push([-hw * 0.92, top - 0.02, z]);
    ring.push([-hw * 0.55, top - h * 0.35, z]);
    ring.push([-hw * 0.35, bot, z]);
    ring.push([hw * 0.35, bot, z]);
    ring.push([hw * 0.55, top - h * 0.35, z]);
    ring.push([hw * 0.92, top - 0.02, z]);
    ring.push([hw, top, z]);
    rings.push(ring.map((p) => [p[0], p[1], p[2]]));
  }
  // 手工放样：每段四边
  for (let s = 0; s + 1 < rings.length; s++) {
    const A = rings[s], B = rings[s + 1];
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      b.quad(
        b.addVertex(A[i][0], A[i][1], A[i][2]),
        b.addVertex(A[j][0], A[j][1], A[j][2]),
        b.addVertex(B[j][0], B[j][1], B[j][2]),
        b.addVertex(B[i][0], B[i][1], B[i][2])
      );
    }
  }
  // 车头封口（面向 +Z）
  const f0 = rings[0];
  b.quad(f0[0], f0[7], f0[6], f0[1]);
  b.quad(f0[1], f0[6], f0[5], f0[2]);
  b.quad(f0[2], f0[5], f0[4], f0[3]);
  // 车尾封口（面向 -Z）
  const rear = rings[rings.length - 1];
  b.quad(rear[7], rear[0], rear[1], rear[6]);
  b.quad(rear[1], rear[2], rear[5], rear[6]);
  b.quad(rear[2], rear[3], rear[4], rear[5]);
  return b;
}

function buildGlass() {
  const b = new MeshBuilder();
  // 座舱玻璃（内缩）
  const rings = [
    [[-0.62, 1.12, 0.62], [-0.40, 1.28, 0.42], [0.40, 1.28, 0.42], [0.62, 1.12, 0.62]],
    [[-0.60, 1.12, -0.20], [-0.38, 1.27, -0.20], [0.38, 1.27, -0.20], [0.60, 1.12, -0.20]],
    [[-0.60, 1.05, -0.85], [-0.36, 1.15, -0.85], [0.36, 1.15, -0.85], [0.60, 1.05, -0.85]]
  ].map((r) => r.map((p) => b.addVertex(p[0], p[1], p[2])));
  for (let s = 0; s + 1 < rings.length; s++) {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      b.quad(rings[s][i], rings[s][j], rings[s + 1][j], rings[s + 1][i]);
    }
  }
  // 前挡风下沿封底（近似）
  b.quad(rings[0][0], rings[0][1], rings[0][2], rings[0][3]);
  return b;
}

function buildWheel() {
  const b = new MeshBuilder();
  const tireR = WHEEL_R, rimR = WHEEL_R * 0.62;
  const y = 0; // 车轮几何居中，位置由场景 pivot 决定
  // 轮胎（圆柱沿 X）
  const seg = 20;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const x0 = Math.cos(a0) * tireR, z0 = Math.sin(a0) * tireR;
    const x1 = Math.cos(a1) * tireR, z1 = Math.sin(a1) * tireR;
    b.quad(
      b.addVertex(y - WHEEL_W / 2, x0, z0), b.addVertex(y - WHEEL_W / 2, x1, z1),
      b.addVertex(y + WHEEL_W / 2, x1, z1), b.addVertex(y + WHEEL_W / 2, x0, z0)
    );
  }
  // 轮辋（扁圆柱）
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const x0 = Math.cos(a0) * rimR, z0 = Math.sin(a0) * rimR;
    const x1 = Math.cos(a1) * rimR, z1 = Math.sin(a1) * rimR;
    b.quad(
      b.addVertex(y - WHEEL_W * 0.22, x0, z0), b.addVertex(y - WHEEL_W * 0.22, x1, z1),
      b.addVertex(y + WHEEL_W * 0.22, x1, z1), b.addVertex(y + WHEEL_W * 0.22, x0, z0)
    );
    b.tri(b.addVertex(y - WHEEL_W * 0.22, 0, 0), b.addVertex(y - WHEEL_W * 0.22, x1, z1), b.addVertex(y - WHEEL_W * 0.22, x0, z0));
    b.tri(b.addVertex(y + WHEEL_W * 0.22, 0, 0), b.addVertex(y + WHEEL_W * 0.22, x0, z0), b.addVertex(y + WHEEL_W * 0.22, x1, z1));
  }
  return b;
}

function buildLamp(z, isTail) {
  const b = new MeshBuilder();
  const w = 0.34, h = 0.13, y = 0.78;
  const d = 0.04;
  b.quad(b.addVertex(-w, y, z), b.addVertex(w, y, z), b.addVertex(w, y + h, z), b.addVertex(-w, y + h, z));
  void d;
  return b;
}

function buildInterior() {
  const b = new MeshBuilder();
  // 仪表台 + 座椅块（简化）
  b.quad(
    b.addVertex(-0.55, 0.72, 0.55), b.addVertex(0.55, 0.72, 0.55),
    b.addVertex(0.55, 0.78, 0.10), b.addVertex(-0.55, 0.78, 0.10)
  );
  b.quad(b.addVertex(-0.30, 0.30, -0.60), b.addVertex(0.30, 0.30, -0.60), b.addVertex(0.30, 0.72, -0.60), b.addVertex(-0.30, 0.72, -0.60));
  return b;
}

const body = buildBody();
const glass = buildGlass();
const wheelFL = buildWheel();
const wheelFR = buildWheel();
const wheelRL = buildWheel();
const wheelRR = buildWheel();
const lampL = buildLamp(2.05, false);
const lampR = buildLamp(2.05, false);
const tailL = buildLamp(-2.15, true);
const tailR = buildLamp(-2.15, true);
const interior = buildInterior();

let obj = '# SportsCar2-style coupe — generated by tools/gen-car-model.mjs (self-made, no license needed)\n';
obj += 'mtllib SportsCar2.mtl\n';
let offset = 0;
const parts = [
  ['body', 'paint', body], ['glass', 'glass', glass],
  ['wheel_FL', 'tire', wheelFL], ['wheel_FR', 'tire', wheelFR],
  ['wheel_RL', 'tire', wheelRL], ['wheel_RR', 'tire', wheelRR],
  ['headlight_L', 'headlight', lampL], ['headlight_R', 'headlight', lampR],
  ['taillight_L', 'taillight', tailL], ['taillight_R', 'taillight', tailR],
  ['interior', 'interior', interior]
];
for (const [g, m, builder] of parts) {
  obj += builder.toObj(g, m, offset);
  offset += builder.v.length / 3;
}

const mtl = `# SportsCar2.mtl — self-made materials
newmtl paint
Kd 0.72 0.08 0.06
Ks 0.9 0.9 0.9
Ns 220
newmtl glass
Kd 0.10 0.12 0.14
d 0.55
newmtl tire
Kd 0.05 0.05 0.05
Ns 8
newmtl headlight
Kd 0.95 0.97 1.0
Ke 0.55 0.60 0.65
newmtl taillight
Kd 0.55 0.04 0.04
Ke 0.85 0.08 0.08
newmtl interior
Kd 0.12 0.12 0.13
Ns 30
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'SportsCar2.obj'), obj);
fs.writeFileSync(path.join(OUT_DIR, 'SportsCar2.mtl'), mtl);
console.log('生成', path.join(OUT_DIR, 'SportsCar2.obj'), (obj.length / 1024).toFixed(1) + 'KB');
