import * as THREE from "three";
import { BLOCKS, GRASS, WATER, itemIdByName } from "./blocks";
import { moveEntity, type MoveResult } from "./physics";
import { World } from "./world";

export type MobType = "pig" | "cow" | "sheep" | "chicken" | "zombie" | "creeper";
type FaceName = "px" | "nx" | "py" | "ny" | "pz" | "nz";

// ---------- pixel painting helpers ----------
class PC {
  constructor(public ctx: CanvasRenderingContext2D, public ox: number, public oy: number, public w: number, public h: number, public seed: number) {}
  px(x: number, y: number, c: string) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x, this.oy + y, 1, 1);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  fill(c: string) {
    this.rect(0, 0, this.w, this.h, c);
  }
  noise(pal: string[], density = 1) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const r = hash(x + this.ox, y + this.oy, this.seed);
        if (density < 1 && r > density) continue;
        const r2 = hash(x + this.ox, y + this.oy, this.seed + 1);
        this.px(x, y, pal[Math.floor(r2 * pal.length)]);
      }
  }
  patches(color: string, scale: number, threshold: number) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (vnoise((x + this.ox) / scale, (y + this.oy) / scale, this.seed + 5) > threshold) this.px(x, y, color);
  }
}
function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

interface PartSpec {
  name: string;
  size: [number, number, number];
  pivot: [number, number, number];
  offset: [number, number, number];
  paint: (f: FaceName, c: PC) => void;
  parent?: string;
}
interface MobTypeDef {
  parts: PartSpec[];
  halfW: number;
  height: number;
  health: number;
  speed: number;
  hostile: boolean;
  drops: [string, number, number][];
}

const PIG_SKIN = ["#eda09e", "#f0a9a7", "#f4b3b1", "#f7bab8"];
const COW_BROWN = ["#3f2a1b", "#4a3222", "#553a28", "#5f412d"];
const WOOL = ["#dcdcdc", "#e6e6e6", "#efefef", "#f8f8f8"];
const CHICK = ["#e8e8e8", "#f0f0f0", "#f8f8f8", "#ffffff"];
const ZSKIN = ["#3f7d3c", "#468a43", "#4f974b", "#579f52"];
const CREEP = ["#2b6b1c", "#3a8528", "#489a34", "#5aad43", "#74bd5c", "#8cc86f"];

const skin = (pal: string[]) => (_f: FaceName, c: PC) => c.noise(pal);

const MOBS: Record<MobType, MobTypeDef> = {
  pig: {
    halfW: 0.45, height: 0.9, health: 10, speed: 1.6, hostile: false, drops: [["porkchop", 1, 3]],
    parts: [
      { name: "body", size: [10, 8, 16], pivot: [0, 13, 0], offset: [-5, -4, -8], paint: skin(PIG_SKIN) },
      { name: "head", size: [8, 8, 8], pivot: [0, 12, -6], offset: [-4, -4, -8], paint: (f, c) => {
        c.noise(PIG_SKIN);
        if (f === "nz") { c.px(1, 5, "#ffffff"); c.px(2, 5, "#1a1a2e"); c.px(6, 5, "#ffffff"); c.px(5, 5, "#1a1a2e"); }
      } },
      { name: "snout", size: [4, 3, 1], pivot: [0, 0, 0], offset: [-2, -3, -9], parent: "head", paint: (f, c) => {
        c.fill("#e28a8a");
        if (f === "nz") { c.px(1, 1, "#b85a5a"); c.px(2, 1, "#b85a5a"); }
      } },
      { name: "leg0", size: [4, 6, 4], pivot: [-3, 6, 5], offset: [-2, -6, -2], paint: skin(PIG_SKIN) },
      { name: "leg1", size: [4, 6, 4], pivot: [3, 6, 5], offset: [-2, -6, -2], paint: skin(PIG_SKIN) },
      { name: "leg2", size: [4, 6, 4], pivot: [-3, 6, -5], offset: [-2, -6, -2], paint: skin(PIG_SKIN) },
      { name: "leg3", size: [4, 6, 4], pivot: [3, 6, -5], offset: [-2, -6, -2], paint: skin(PIG_SKIN) },
    ],
  },
  cow: {
    halfW: 0.45, height: 1.4, health: 10, speed: 1.5, hostile: false, drops: [["beef", 1, 3], ["leather", 0, 2]],
    parts: [
      { name: "body", size: [12, 10, 18], pivot: [0, 17, 0], offset: [-6, -5, -9], paint: (f, c) => { c.noise(COW_BROWN); c.patches("#e9e4dd", 3, 0.6); if (f === "ny") c.rect(4, 10, 4, 6, "#e6b6b6"); } },
      { name: "udder", size: [4, 6, 1], pivot: [0, 0, 0], offset: [-2, -6, 3], parent: "body", paint: (_f, c) => c.fill("#e6b6b6") },
      { name: "head", size: [8, 8, 6], pivot: [0, 20, -8], offset: [-4, -4, -6], paint: (f, c) => {
        c.noise(COW_BROWN);
        if (f === "nz") {
          c.rect(3, 0, 2, 4, "#e9e4dd"); c.rect(2, 1, 4, 2, "#e9e4dd");
          c.px(1, 4, "#ffffff"); c.px(2, 4, "#161616"); c.px(6, 4, "#ffffff"); c.px(5, 4, "#161616");
          c.rect(2, 6, 4, 2, "#a89b91"); c.px(2, 7, "#8c7f75"); c.px(5, 7, "#8c7f75");
        }
      } },
      { name: "horn0", size: [1, 3, 1], pivot: [0, 0, 0], offset: [-5, 2, -3], parent: "head", paint: (_f, c) => c.fill("#d8d3c8") },
      { name: "horn1", size: [1, 3, 1], pivot: [0, 0, 0], offset: [4, 2, -3], parent: "head", paint: (_f, c) => c.fill("#d8d3c8") },
      { name: "leg0", size: [4, 12, 4], pivot: [-4, 12, 6], offset: [-2, -12, -2], paint: skin(COW_BROWN) },
      { name: "leg1", size: [4, 12, 4], pivot: [4, 12, 6], offset: [-2, -12, -2], paint: skin(COW_BROWN) },
      { name: "leg2", size: [4, 12, 4], pivot: [-4, 12, -6], offset: [-2, -12, -2], paint: skin(COW_BROWN) },
      { name: "leg3", size: [4, 12, 4], pivot: [4, 12, -6], offset: [-2, -12, -2], paint: skin(COW_BROWN) },
    ],
  },
  sheep: {
    halfW: 0.45, height: 1.3, health: 8, speed: 1.4, hostile: false, drops: [["white_wool", 1, 1], ["mutton", 1, 2]],
    parts: [
      { name: "body", size: [11, 9, 19], pivot: [0, 15, 0], offset: [-5.5, -4.5, -9.5], paint: (_f, c) => { c.noise(WOOL); c.patches("#cfcfcf", 2, 0.66); } },
      { name: "head", size: [7, 7, 8], pivot: [0, 18, -8], offset: [-3.5, -3.5, -8], paint: (f, c) => {
        c.noise(WOOL);
        if (f === "nz") { c.rect(1, 2, 5, 5, "#d9cfc2"); c.px(1, 3, "#161616"); c.px(5, 3, "#161616"); c.rect(2, 5, 3, 1, "#c9b9a8"); }
      } },
      { name: "leg0", size: [4, 12, 4], pivot: [-3, 12, 5], offset: [-2, -12, -2], paint: (_f, c) => { c.fill("#d9cfc2"); c.rect(0, 0, 4, 5, "#ececec"); } },
      { name: "leg1", size: [4, 12, 4], pivot: [3, 12, 5], offset: [-2, -12, -2], paint: (_f, c) => { c.fill("#d9cfc2"); c.rect(0, 0, 4, 5, "#ececec"); } },
      { name: "leg2", size: [4, 12, 4], pivot: [-3, 12, -5], offset: [-2, -12, -2], paint: (_f, c) => { c.fill("#d9cfc2"); c.rect(0, 0, 4, 5, "#ececec"); } },
      { name: "leg3", size: [4, 12, 4], pivot: [3, 12, -5], offset: [-2, -12, -2], paint: (_f, c) => { c.fill("#d9cfc2"); c.rect(0, 0, 4, 5, "#ececec"); } },
    ],
  },
  chicken: {
    halfW: 0.2, height: 0.7, health: 4, speed: 1.4, hostile: false, drops: [["chicken", 1, 1], ["feather", 0, 2]],
    parts: [
      { name: "body", size: [6, 6, 8], pivot: [0, 8, 0], offset: [-3, -3, -4], paint: skin(CHICK) },
      { name: "head", size: [4, 6, 3], pivot: [0, 9, -4], offset: [-2, 0, -3], paint: (f, c) => {
        c.noise(CHICK);
        if (f === "nz") { c.px(0, 2, "#161616"); c.px(3, 2, "#161616"); }
      } },
      { name: "beak", size: [4, 2, 2], pivot: [0, 0, 0], offset: [-2, 2, -5], parent: "head", paint: (_f, c) => c.fill("#e8a020") },
      { name: "wattle", size: [2, 2, 2], pivot: [0, 0, 0], offset: [-1, 0, -4], parent: "head", paint: (_f, c) => c.fill("#c8281e") },
      { name: "wing0", size: [1, 4, 6], pivot: [-3, 11, 0], offset: [-1, -4, -3], paint: skin(CHICK) },
      { name: "wing1", size: [1, 4, 6], pivot: [3, 11, 0], offset: [0, -4, -3], paint: skin(CHICK) },
      { name: "leg0", size: [3, 5, 3], pivot: [-2, 5, 1], offset: [-1, -5, -2], paint: (_f, c) => c.fill("#e8a020") },
      { name: "leg1", size: [3, 5, 3], pivot: [2, 5, 1], offset: [-1, -5, -2], paint: (_f, c) => c.fill("#e8a020") },
    ],
  },
  zombie: {
    halfW: 0.3, height: 1.95, health: 20, speed: 2.6, hostile: true, drops: [["rotten_flesh", 0, 2]],
    parts: [
      { name: "head", size: [8, 8, 8], pivot: [0, 24, 0], offset: [-4, 0, -4], paint: (f, c) => {
        c.noise(ZSKIN);
        if (f === "nz") { c.px(2, 4, "#101018"); c.px(5, 4, "#101018"); c.rect(3, 6, 2, 1, "#2a4a28"); c.rect(2, 7, 4, 1, "#2f5a2c"); }
        if (f === "py") c.noise(["#2f5f2c", "#376b33", "#3f7a3a"]);
      } },
      { name: "body", size: [8, 12, 4], pivot: [0, 24, 0], offset: [-4, -12, -2], paint: (f, c) => {
        c.noise(["#2f8f8f", "#35a0a0", "#3aabab"]);
        c.rect(0, 8, 8, 4, "#4a3f8f"); c.rect(0, 11, 8, 1, "#3d3478");
        if (f === "nz") { c.rect(2, 1, 4, 1, "#2a7a7a"); c.rect(3, 2, 2, 1, "#2a7a7a"); }
      } },
      { name: "arm0", size: [4, 12, 4], pivot: [-5, 22, 0], offset: [-3, -10, -2], paint: skin(ZSKIN) },
      { name: "arm1", size: [4, 12, 4], pivot: [5, 22, 0], offset: [-1, -10, -2], paint: skin(ZSKIN) },
      { name: "leg0", size: [4, 12, 4], pivot: [-2, 12, 0], offset: [-2, -12, -2], paint: (_f, c) => { c.noise(["#4a3f8f", "#463b86"]); c.rect(0, 10, 4, 2, "#3a3a3a"); } },
      { name: "leg1", size: [4, 12, 4], pivot: [2, 12, 0], offset: [-2, -12, -2], paint: (_f, c) => { c.noise(["#4a3f8f", "#463b86"]); c.rect(0, 10, 4, 2, "#3a3a3a"); } },
    ],
  },
  creeper: {
    halfW: 0.3, height: 1.7, health: 20, speed: 2.4, hostile: true, drops: [["gunpowder", 0, 2]],
    parts: [
      { name: "head", size: [8, 8, 8], pivot: [0, 18, 0], offset: [-4, 0, -4], paint: (f, c) => {
        c.noise(CREEP);
        if (f === "nz") {
          const rows = ["........", "........", ".XX..XX.", ".XX..XX.", "...XX...", "..XXXX..", "..XXXX..", "..X..X.."];
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (rows[y][x] === "X") c.px(x, y, "#0b0f0b");
        }
      } },
      { name: "body", size: [8, 12, 4], pivot: [0, 18, 0], offset: [-4, -12, -2], paint: skin(CREEP) },
      { name: "leg0", size: [4, 6, 4], pivot: [-2, 6, 4], offset: [-2, -6, -2], paint: skin(CREEP) },
      { name: "leg1", size: [4, 6, 4], pivot: [2, 6, 4], offset: [-2, -6, -2], paint: skin(CREEP) },
      { name: "leg2", size: [4, 6, 4], pivot: [-2, 6, -4], offset: [-2, -6, -2], paint: skin(CREEP) },
      { name: "leg3", size: [4, 6, 4], pivot: [2, 6, -4], offset: [-2, -6, -2], paint: skin(CREEP) },
    ],
  },
};

// ---------- model building (texture packing + geometry) ----------
interface BuiltPart {
  spec: PartSpec;
  geom: THREE.BufferGeometry;
}
interface BuiltType {
  texture: THREE.CanvasTexture;
  parts: BuiltPart[];
}
const builtCache = new Map<MobType, BuiltType>();
const FACE_ORDER: FaceName[] = ["px", "nx", "py", "ny", "pz", "nz"];
const FACE_SHADE: Record<FaceName, number> = { px: 0.6, nx: 0.6, py: 1, ny: 0.5, pz: 0.8, nz: 0.8 };

function buildType(type: MobType): BuiltType {
  const cached = builtCache.get(type);
  if (cached) return cached;
  const def = MOBS[type];
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let cx = 0, cy = 0, rowH = 0;
  let seed = 1;
  const parts: BuiltPart[] = [];
  for (const spec of def.parts) {
    const [w, h, d] = spec.size;
    const geom = new THREE.BoxGeometry(w / 16, h / 16, d / 16);
    geom.translate((spec.offset[0] + w / 2) / 16, (spec.offset[1] + h / 2) / 16, (spec.offset[2] + d / 2) / 16);
    const uv = geom.getAttribute("uv") as THREE.BufferAttribute;
    const colors = new Float32Array(24 * 3);
    FACE_ORDER.forEach((face, fi) => {
      const fw = face === "px" || face === "nx" ? d : w;
      const fh = face === "py" || face === "ny" ? d : h;
      const cw = Math.ceil(fw), ch = Math.ceil(fh);
      if (cx + cw + 1 > size) { cx = 0; cy += rowH + 1; rowH = 0; }
      const pc = new PC(ctx, cx, cy, cw, ch, seed++);
      spec.paint(face, pc);
      const u0 = cx / size, u1 = (cx + cw) / size, v0 = 1 - cy / size, v1 = 1 - (cy + ch) / size;
      const base = fi * 4;
      uv.setXY(base, u0, v0); uv.setXY(base + 1, u1, v0); uv.setXY(base + 2, u0, v1); uv.setXY(base + 3, u1, v1);
      const sh = FACE_SHADE[face];
      for (let k = 0; k < 4; k++) { colors[(base + k) * 3] = sh; colors[(base + k) * 3 + 1] = sh; colors[(base + k) * 3 + 2] = sh; }
      cx += cw + 1;
      rowH = Math.max(rowH, ch);
    });
    uv.needsUpdate = true;
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push({ spec, geom });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const built = { texture, parts };
  builtCache.set(type, built);
  return built;
}

type MobState = "idle" | "wander" | "chase" | "flee" | "fuse";

export class Mob {
  pos: THREE.Vector3;
  vel = new THREE.Vector3();
  yaw = Math.random() * Math.PI * 2;
  headYaw = 0;
  headPitch = 0;
  state: MobState = "idle";
  timer = 1 + Math.random() * 3;
  targetYaw = this.yaw;
  walk = 0;
  walkAmount = 0;
  health: number;
  hurt = 0;
  dead = false;
  deathTimer = 0;
  attackCd = 0;
  fuse = 0;
  eggTimer = 300 + Math.random() * 300;
  group = new THREE.Group();
  parts = new Map<string, THREE.Mesh>();
  mat: THREE.MeshBasicMaterial;
  res: MoveResult = { onGround: false, hitWall: false, inWater: false, inLava: false, headInWater: false };
  def: MobTypeDef;
  age = 0;
  constructor(public type: MobType, x: number, y: number, z: number) {
    this.def = MOBS[type];
    this.health = this.def.health;
    this.pos = new THREE.Vector3(x, y, z);
    const built = buildType(type);
    this.mat = new THREE.MeshBasicMaterial({ map: built.texture, vertexColors: true, fog: true });
    for (const p of built.parts) {
      const mesh = new THREE.Mesh(p.geom, this.mat);
      mesh.position.set(p.spec.pivot[0] / 16, p.spec.pivot[1] / 16, p.spec.pivot[2] / 16);
      this.parts.set(p.spec.name, mesh);
      if (p.spec.parent) this.parts.get(p.spec.parent)!.add(mesh);
      else this.group.add(mesh);
    }
    if (type === "zombie") {
      this.parts.get("arm0")!.rotation.x = Math.PI / 2;
      this.parts.get("arm1")!.rotation.x = Math.PI / 2;
    }
  }

  get halfW() { return this.def.halfW; }
  get height() { return this.def.height; }

  damage(amount: number, fromX: number, fromZ: number) {
    if (this.dead) return;
    this.health -= amount;
    this.hurt = 0.4;
    let dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    this.vel.x += dx * 7; this.vel.z += dz * 7; this.vel.y = 5;
    if (!this.def.hostile) { this.state = "flee"; this.timer = 4; this.targetYaw = Math.atan2(-dx, -dz) + Math.PI; }
    if (this.health <= 0) { this.dead = true; this.deathTimer = 0; }
  }

  update(dt: number, world: World, playerPos: THREE.Vector3, day: number, events: MobEvents) {
    this.age += dt;
    if (this.hurt > 0) this.hurt -= dt;
    if (this.dead) {
      this.deathTimer += dt;
      this.group.rotation.z = Math.min(Math.PI / 2, this.deathTimer * 4);
      this.vel.set(0, this.vel.y - 32 * dt, 0);
      moveEntity(world, this.pos, this.halfW, this.height, this.vel, dt, this.res);
      this.group.position.copy(this.pos);
      return this.deathTimer > 1.0;
    }
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z, dy = playerPos.y - this.pos.y;
    const distP = Math.hypot(dx, dz, dy);
    this.timer -= dt;
    const yawTo = Math.atan2(-dx, -dz);

    // ---- AI ----
    if (this.def.hostile) {
      if (this.type === "creeper" && this.state === "fuse") {
        this.fuse += dt;
        if (distP > 7) { this.state = "chase"; this.fuse = 0; }
        else if (this.fuse >= 1.5) { events.explode(this.pos.x, this.pos.y + 0.5, this.pos.z, 3); this.dead = true; return true; }
      } else if (distP < 18 && (this.type !== "zombie" || true)) {
        this.state = "chase";
        this.targetYaw = yawTo;
        if (this.type === "creeper" && distP < 3) { this.state = "fuse"; this.fuse = 0; }
        if (this.type === "zombie" && distP < 1.6 && this.attackCd <= 0 && Math.abs(dy) < 2) {
          this.attackCd = 1.0;
          events.attackPlayer(3, this.pos.x, this.pos.z);
        }
      } else if (this.state === "chase") { this.state = "idle"; this.timer = 1; }
      if (this.attackCd > 0) this.attackCd -= dt;
      // zombies burn in daylight
      if (this.type === "zombie" && day > 0.75) {
        const sky = world.getSky(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.5), Math.floor(this.pos.z));
        if (sky >= 14 && Math.floor(this.age * 2) !== Math.floor((this.age - dt) * 2)) this.damage(1, this.pos.x + 0.01, this.pos.z);
      }
    }
    if (this.state !== "chase" && this.state !== "fuse") {
      if (this.timer <= 0) {
        if (this.state === "wander" || this.state === "flee") { this.state = "idle"; this.timer = 1.5 + Math.random() * 4; }
        else { this.state = "wander"; this.timer = 1.5 + Math.random() * 3; this.targetYaw = Math.random() * Math.PI * 2; }
      }
    }
    // head look
    if (distP < 7 && !this.def.hostile) {
      let rel = yawTo - this.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      this.headYaw += (Math.max(-1.1, Math.min(1.1, rel)) - this.headYaw) * Math.min(1, dt * 5);
      this.headPitch += (Math.atan2(dy - this.height * 0.6, Math.hypot(dx, dz)) * 0.6 - this.headPitch) * Math.min(1, dt * 5);
    } else {
      this.headYaw *= Math.pow(0.1, dt);
      this.headPitch *= Math.pow(0.1, dt);
    }

    // ---- movement ----
    let moving = this.state === "wander" || this.state === "chase" || this.state === "flee";
    if (this.state === "fuse") moving = false;
    let rel = this.targetYaw - this.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.yaw += rel * Math.min(1, dt * 6);
    const speed = this.def.speed * (this.state === "flee" ? 1.6 : this.state === "chase" ? 1.15 : 1);
    if (moving) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, dt * 8);
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, dt * 8);
      if (this.res.hitWall && this.res.onGround) this.vel.y = 8.4;
      // avoid walking off cliffs (passive) : check block ahead
      if (!this.def.hostile) {
        const ax = Math.floor(this.pos.x + fx * 0.8), az = Math.floor(this.pos.z + fz * 0.8), ay = Math.floor(this.pos.y);
        let drop = 0;
        while (drop < 4 && !BLOCKS[world.getBlock(ax, ay - 1 - drop, az)].solid && world.getBlock(ax, ay - 1 - drop, az) !== WATER) drop++;
        if (drop >= 4) { this.targetYaw = this.yaw + Math.PI * (0.6 + Math.random() * 0.8); }
      }
    } else {
      this.vel.x *= Math.pow(0.01, dt);
      this.vel.z *= Math.pow(0.01, dt);
    }
    if (this.res.inWater) {
      this.vel.y += (1.2 - this.vel.y) * Math.min(1, dt * 3);
      if (this.res.hitWall) this.vel.y = 5.5;
    } else {
      this.vel.y -= 32 * dt;
      if (this.type === "chicken" && this.vel.y < -1.6) this.vel.y = -1.6;
    }
    moveEntity(world, this.pos, this.halfW, this.height, this.vel, dt, this.res);
    if (this.res.inLava) this.damage(4 * dt + 0.5, this.pos.x + 0.1, this.pos.z);

    if (this.type === "chicken") {
      this.eggTimer -= dt;
      if (this.eggTimer <= 0) { this.eggTimer = 300 + Math.random() * 300; events.dropItem(itemIdByName("egg"), 1, this.pos.x, this.pos.y + 0.3, this.pos.z); }
    }

    // ---- animation ----
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.walkAmount += (Math.min(1, hs / 1.5) - this.walkAmount) * Math.min(1, dt * 8);
    this.walk += hs * dt * 3.2;
    const swing = Math.sin(this.walk) * 0.9 * this.walkAmount;
    const legs = ["leg0", "leg1", "leg2", "leg3"];
    legs.forEach((n, i) => {
      const m = this.parts.get(n);
      if (m) m.rotation.x = i === 0 || i === 3 ? swing : -swing;
    });
    const head = this.parts.get("head");
    if (head) { head.rotation.y = this.headYaw; head.rotation.x = this.headPitch; }
    if (this.type === "zombie") {
      const a0 = this.parts.get("arm0")!, a1 = this.parts.get("arm1")!;
      a0.rotation.x = Math.PI / 2 + Math.sin(this.age * 2) * 0.08;
      a1.rotation.x = Math.PI / 2 - Math.sin(this.age * 2) * 0.08;
      a0.rotation.z = 0.05 + Math.cos(this.walk) * 0.15 * this.walkAmount;
      a1.rotation.z = -0.05 - Math.cos(this.walk) * 0.15 * this.walkAmount;
      if (head) head.rotation.y = this.state === "chase" ? 0 : this.headYaw;
    }
    if (this.type === "chicken") {
      const flap = this.res.onGround ? 0 : Math.sin(this.age * 25) * 0.9;
      this.parts.get("wing0")!.rotation.z = -flap;
      this.parts.get("wing1")!.rotation.z = flap;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    if (this.type === "creeper" && this.state === "fuse") {
      const s = 1 + this.fuse * 0.35;
      this.group.scale.set(s, s, s);
    } else this.group.scale.set(1, 1, 1);

    // lighting tint
    const bx = Math.floor(this.pos.x), by = Math.floor(this.pos.y + 0.5), bz = Math.floor(this.pos.z);
    const packed = world.getLightPacked(bx, by, bz);
    const bright = (l: number) => l / (4 - 3 * l);
    const b = Math.max(bright(Math.min(1, ((packed >> 4) / 15) * day)), bright((packed & 15) / 15), 0.04);
    let r = b, g = b, bl = b;
    if (this.hurt > 0) { r = Math.min(1, b + 0.6); g *= 0.4; bl *= 0.4; }
    if (this.type === "creeper" && this.state === "fuse" && Math.sin(this.fuse * 18) > 0) { r = Math.min(1, r + 0.8); g = Math.min(1, g + 0.8); bl = Math.min(1, bl + 0.8); }
    this.mat.color.setRGB(r, g, bl);
    return false;
  }
}

export interface MobEvents {
  explode: (x: number, y: number, z: number, radius: number) => void;
  attackPlayer: (dmg: number, fromX: number, fromZ: number) => void;
  dropItem: (id: number, count: number, x: number, y: number, z: number) => void;
}

export class MobManager {
  mobs: Mob[] = [];
  group = new THREE.Group();
  constructor(private world: World, scene: THREE.Scene, private events: MobEvents) {
    scene.add(this.group);
  }
  spawn(type: MobType, x: number, y: number, z: number) {
    const m = new Mob(type, x, y, z);
    this.mobs.push(m);
    this.group.add(m.group);
    return m;
  }
  count(hostile: boolean) {
    let n = 0;
    for (const m of this.mobs) if (m.def.hostile === hostile && !m.dead) n++;
    return n;
  }
  update(dt: number, playerPos: THREE.Vector3, day: number) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const d = m.pos.distanceTo(playerPos);
      if (d > 90 || (m.def.hostile && d > 60 && Math.random() < dt * 0.05)) { this.remove(i); continue; }
      if (d > 48) continue; // frozen when far
      if (!this.world.hasChunkAt(Math.floor(m.pos.x), Math.floor(m.pos.z))) continue;
      const remove = m.update(dt, this.world, playerPos, day, this.events);
      if (remove) {
        if (m.health <= 0) {
          for (const [name, min, max] of m.def.drops) {
            const n = min + Math.floor(Math.random() * (max - min + 1));
            if (n > 0) this.events.dropItem(itemIdByName(name), n, m.pos.x, m.pos.y + 0.5, m.pos.z);
          }
        }
        this.remove(i);
      }
    }
  }
  private remove(i: number) {
    const m = this.mobs[i];
    this.group.remove(m.group);
    m.mat.dispose();
    this.mobs.splice(i, 1);
  }
  /** try spawning passive animals on grass in a chunk */
  spawnAnimalsInChunk(cx: number, cz: number, rng: () => number) {
    if (rng() > 0.4) return;
    const types: MobType[] = ["pig", "cow", "sheep", "chicken", "sheep", "pig"];
    const type = types[Math.floor(rng() * types.length)];
    const n = 2 + Math.floor(rng() * 3);
    const bx = cx * 16 + 2 + Math.floor(rng() * 12), bz = cz * 16 + 2 + Math.floor(rng() * 12);
    for (let i = 0; i < n; i++) {
      const x = bx + Math.floor(rng() * 5) - 2, z = bz + Math.floor(rng() * 5) - 2;
      const c = this.world.getChunk(x >> 4, z >> 4);
      if (!c) continue;
      const h = c.height[(x & 15) * 16 + (z & 15)];
      const ground = this.world.getBlock(x, h - 1, z);
      if (ground !== GRASS) continue;
      if (this.world.getBlock(x, h, z) !== 0 && !BLOCKS[this.world.getBlock(x, h, z)].replaceable) continue;
      this.spawn(type, x + 0.5, h, z + 0.5);
    }
  }
}
