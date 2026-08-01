export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }
  static add(a, b) { return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
  static sub(a, b) { return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
  static mul(a, s) { return new Vec3(a.x * s, a.y * s, a.z * s); }
  static dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  static cross(a, b) {
    return new Vec3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }
  static normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return len > 0 ? Vec3.mul(v, 1 / len) : new Vec3();
  }
  static length(v) { return Math.sqrt(Vec3.dot(v, v)); }
  toArray() { return [this.x, this.y, this.z]; }
}

export class Camera {
  constructor() {
    this.pos = new Vec3(0, 0, 4);
    this.target = new Vec3(0, 0, 0);
    this.up = new Vec3(0, 1, 0);
    this.fov = Math.PI / 4;
    this.update();
  }

  update() {
    this.dir = Vec3.normalize(Vec3.sub(this.target, this.pos));
    this.right = Vec3.normalize(Vec3.cross(this.dir, this.up));
    this.camUp = Vec3.normalize(Vec3.cross(this.right, this.dir));
  }

  setPosition(x, y, z) {
    this.pos = new Vec3(x, y, z);
    this.update();
  }

  setTarget(x, y, z) {
    this.target = new Vec3(x, y, z);
    this.update();
  }

  rotate(yaw, pitch) {
    const radius = Vec3.length(Vec3.sub(this.pos, this.target));
    const theta = Math.atan2(this.pos.z - this.target.z, this.pos.x - this.target.x) + yaw;
    const phi = Math.asin((this.pos.y - this.target.y) / radius) + pitch;
    const clampedPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));
    this.pos.x = this.target.x + radius * Math.cos(clampedPhi) * Math.cos(theta);
    this.pos.y = this.target.y + radius * Math.sin(clampedPhi);
    this.pos.z = this.target.z + radius * Math.cos(clampedPhi) * Math.sin(theta);
    this.update();
  }
}

export class Stats {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.frameTimes = [];
  }

  update() {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastTime;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  getSamplesPerSecond(samplesPerFrame) {
    const avgFrameTime = this.getAverageFrameTime();
    if (avgFrameTime === 0) return 0;
    return Math.round((samplesPerFrame * 1000) / avgFrameTime);
  }
}

export function computeConvergence(pixels, width, height, threshold = 0.01) {
  if (pixels.length === 0) return 0;
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(width / 64));
  for (let i = 0; i < pixels.length; i += 4 * step) {
    sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
    count += 3;
  }
  const avg = sum / count;
  return Math.min(1.0, avg / 2.0);
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
