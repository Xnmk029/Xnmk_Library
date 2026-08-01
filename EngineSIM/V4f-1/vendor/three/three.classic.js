/*!
 * V4f 自研 THREE 兼容精简层（经典脚本，零外部依赖）。
 * 提供本项目渲染代码所需的 THREE 子集：数学库、场景图、几何体、材质、
 * 光照（环境/半球/平行光+阴影贴图）、雾、ACES 色调映射与 WebGL 渲染器。
 * 这不是 Three.js 本体；接口命名保持兼容以便未来无缝替换。
 */
(function (root) {
  'use strict';

  var THREE = root.THREE || {};

  // ---------------- 数学 ----------------
  function Vector2(x, y) { this.x = x || 0; this.y = y || 0; }
  Vector2.prototype.set = function (x, y) { this.x = x; this.y = y; return this; };
  Vector2.prototype.clone = function () { return new Vector2(this.x, this.y); };
  Vector2.prototype.copy = function (v) { this.x = v.x; this.y = v.y; return this; };
  Vector2.prototype.distanceTo = function (v) { return Math.hypot(this.x - v.x, this.y - v.y); };

  function Vector3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
  Vector3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
  Vector3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
  Vector3.prototype.clone = function () { return new Vector3(this.x, this.y, this.z); };
  Vector3.prototype.add = function (v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; };
  Vector3.prototype.addScaledVector = function (v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; };
  Vector3.prototype.sub = function (v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; };
  Vector3.prototype.subVectors = function (a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; };
  Vector3.prototype.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
  Vector3.prototype.divideScalar = function (s) { return this.multiplyScalar(1 / s); };
  Vector3.prototype.negate = function () { return this.multiplyScalar(-1); };
  Vector3.prototype.length = function () { return Math.hypot(this.x, this.y, this.z); };
  Vector3.prototype.lengthSq = function () { return this.x * this.x + this.y * this.y + this.z * this.z; };
  Vector3.prototype.normalize = function () { const l = this.length(); if (l > 1e-12) this.divideScalar(l); return this; };
  Vector3.prototype.dot = function (v) { return this.x * v.x + this.y * v.y + this.z * v.z; };
  Vector3.prototype.cross = function (v) { return this.crossVectors(this, v); };
  Vector3.prototype.crossVectors = function (a, b) {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    this.x = x; this.y = y; this.z = z; return this;
  };
  Vector3.prototype.lerp = function (v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; };
  Vector3.prototype.applyMatrix4 = function (m) {
    const e = m.elements, x = this.x, y = this.y, z = this.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15] || 1);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  };
  Vector3.prototype.applyQuaternion = function (q) {
    const x = this.x, y = this.y, z = this.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  };
  Vector3.prototype.setFromMatrixPosition = function (m) {
    const e = m.elements;
    this.x = e[12]; this.y = e[13]; this.z = e[14];
    return this;
  };
  Vector3.prototype.setFromMatrixColumn = function (m, i) {
    const e = m.elements;
    this.x = e[i * 4]; this.y = e[i * 4 + 1]; this.z = e[i * 4 + 2];
    return this;
  };
  Vector3.prototype.transformDirection = function (m) {
    const e = m.elements, x = this.x, y = this.y, z = this.z;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  };
  Vector3.prototype.setFromSpherical = function (s) {
    const sinPhi = Math.sin(s.phi);
    this.x = s.radius * sinPhi * Math.sin(s.theta);
    this.y = s.radius * Math.cos(s.phi);
    this.z = s.radius * sinPhi * Math.cos(s.theta);
    return this;
  };
  Vector3.prototype.angleTo = function (v) {
    const d = this.dot(v) / (this.length() * v.length());
    return Math.acos(Math.max(-1, Math.min(1, d)));
  };
  Vector3.ZERO = new Vector3(0, 0, 0);

  function Quaternion(x, y, z, w) { this.x = x || 0; this.y = y || 0; this.z = z || 0; this.w = w === undefined ? 1 : w; }
  Quaternion.prototype.set = function (x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; };
  Quaternion.prototype.copy = function (q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; };
  Quaternion.prototype.clone = function () { return new Quaternion(this.x, this.y, this.z, this.w); };
  Quaternion.prototype.setFromAxisAngle = function (axis, angle) {
    const h = angle / 2, s = Math.sin(h);
    this.x = axis.x * s; this.y = axis.y * s; this.z = axis.z * s; this.w = Math.cos(h);
    return this;
  };
  Quaternion.prototype.setFromEuler = function (euler) {
    const cx = Math.cos(euler.x / 2), cy = Math.cos(euler.y / 2), cz = Math.cos(euler.z / 2);
    const sx = Math.sin(euler.x / 2), sy = Math.sin(euler.y / 2), sz = Math.sin(euler.z / 2);
    const order = euler.order || 'XYZ';
    if (order === 'XYZ') {
      this.x = sx * cy * cz + cx * sy * sz; this.y = cx * sy * cz - sx * cy * sz;
      this.z = cx * cy * sz + sx * sy * cz; this.w = cx * cy * cz - sx * sy * sz;
    } else if (order === 'YXZ') {
      this.x = sx * cy * cz + cx * sy * sz; this.y = cx * sy * cz - sx * cy * sz;
      this.z = cx * cy * sz - sx * sy * cz; this.w = cx * cy * cz + sx * sy * sz;
    } else { // YZX
      this.x = sx * cy * cz + cx * sy * sz; this.y = cx * sy * cz + sx * cy * sz;
      this.z = cx * cy * sz - sx * sy * cz; this.w = cx * cy * cz - sx * sy * sz;
    }
    return this;
  };
  Quaternion.prototype.multiply = function (q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  };
  Quaternion.prototype.multiplyQuaternions = function (a, b) {
    const ax = a.x, ay = a.y, az = a.z, aw = a.w;
    const bx = b.x, by = b.y, bz = b.z, bw = b.w;
    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  };
  Quaternion.prototype.slerp = function (qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);
    let x = this.x, y = this.y, z = this.z, w = this.w;
    let cosHalfTheta = w * qb.w + x * qb.x + y * qb.y + z * qb.z;
    if (cosHalfTheta < 0) { this.w = -qb.w; this.x = -qb.x; this.y = -qb.y; this.z = -qb.z; cosHalfTheta = -cosHalfTheta; }
    else { this.copy(qb); }
    if (cosHalfTheta >= 1) return this;
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
    if (sinHalfTheta < 1e-6) { this.w = 0.5 * (w + this.w); this.x = 0.5 * (x + this.x); this.y = 0.5 * (y + this.y); this.z = 0.5 * (z + this.z); return this; }
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    this.w = w * ratioA + this.w * ratioB;
    this.x = x * ratioA + this.x * ratioB;
    this.y = y * ratioA + this.y * ratioB;
    this.z = z * ratioA + this.z * ratioB;
    return this;
  };
  Quaternion.prototype.normalize = function () {
    const l = Math.hypot(this.x, this.y, this.z, this.w);
    if (l > 1e-12) { this.x /= l; this.y /= l; this.z /= l; this.w /= l; }
    return this;
  };

  function Euler(x, y, z, order) { this.x = x || 0; this.y = y || 0; this.z = z || 0; this.order = order || 'XYZ'; }
  Euler.prototype.set = function (x, y, z, order) { this.x = x; this.y = y; this.z = z; if (order) this.order = order; return this; };
  Euler.prototype.copy = function (e) { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; };
  Euler.prototype.clone = function () { return new Euler(this.x, this.y, this.z, this.order); };

  function Matrix4() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  Matrix4.prototype.identity = function () {
    const e = this.elements;
    e[0] = 1; e[1] = 0; e[2] = 0; e[3] = 0;
    e[4] = 0; e[5] = 1; e[6] = 0; e[7] = 0;
    e[8] = 0; e[9] = 0; e[10] = 1; e[11] = 0;
    e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
    return this;
  };
  Matrix4.prototype.copy = function (m) { for (let i = 0; i < 16; i++) this.elements[i] = m.elements[i]; return this; };
  Matrix4.prototype.clone = function () { return new Matrix4().copy(this); };
  Matrix4.prototype.set = function (n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const e = this.elements;
    e[0] = n11; e[4] = n12; e[8] = n13; e[12] = n14;
    e[1] = n21; e[5] = n22; e[9] = n23; e[13] = n24;
    e[2] = n31; e[6] = n32; e[10] = n33; e[14] = n34;
    e[3] = n41; e[7] = n42; e[11] = n43; e[15] = n44;
    return this;
  };
  Matrix4.prototype.makePerspective = function (fov, aspect, near, far) {
    const f = 1 / Math.tan(fov * Math.PI / 360), nf = 1 / (near - far);
    return this.set(f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, 2 * far * near * nf, 0, 0, -1, 0);
  };
  Matrix4.prototype.makeOrthographic = function (l, r, t, b, n, f) {
    return this.set(2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0,
      -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1);
  };
  Matrix4.prototype.compose = function (pos, quat, scale) {
    const e = this.elements;
    const x = quat.x, y = quat.y, z = quat.z, w = quat.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    e[0] = (1 - (yy + zz)) * sx; e[4] = (xy - wz) * sy; e[8] = (xz + wy) * sz;
    e[1] = (xy + wz) * sx; e[5] = (1 - (xx + zz)) * sy; e[9] = (yz - wx) * sz;
    e[2] = (xz - wy) * sx; e[6] = (yz + wx) * sy; e[10] = (1 - (xx + yy)) * sz;
    e[12] = pos.x; e[13] = pos.y; e[14] = pos.z; e[15] = 1;
    return this;
  };
  Matrix4.prototype.multiplyMatrices = function (a, b) {
    const ae = a.elements, be = b.elements, e = this.elements;
    for (let i = 0; i < 4; i++) {
      const ai0 = ae[i], ai1 = ae[i + 4], ai2 = ae[i + 8], ai3 = ae[i + 12];
      e[i] = ai0 * be[0] + ai1 * be[1] + ai2 * be[2] + ai3 * be[3];
      e[i + 4] = ai0 * be[4] + ai1 * be[5] + ai2 * be[6] + ai3 * be[7];
      e[i + 8] = ai0 * be[8] + ai1 * be[9] + ai2 * be[10] + ai3 * be[11];
      e[i + 12] = ai0 * be[12] + ai1 * be[13] + ai2 * be[14] + ai3 * be[15];
    }
    return this;
  };
  Matrix4.prototype.multiply = function (m) { return this.multiplyMatrices(this, m); };
  Matrix4.prototype.invert = function () {
    const e = this.elements;
    const n11 = e[0], n21 = e[1], n31 = e[2], n41 = e[3];
    const n12 = e[4], n22 = e[5], n32 = e[6], n42 = e[7];
    const n13 = e[8], n23 = e[9], n33 = e[10], n43 = e[11];
    const n14 = e[12], n24 = e[13], n34 = e[14], n44 = e[15];
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) return this.identity();
    const detInv = 1 / det;
    const m = new Array(16);
    m[0] = t11 * detInv; m[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    m[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    m[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    m[4] = t12 * detInv; m[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    m[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    m[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    m[8] = t13 * detInv; m[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    m[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    m[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    m[12] = t14 * detInv; m[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    m[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    m[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    for (let i = 0; i < 16; i++) this.elements[i] = m[i];
    return this;
  };
  Matrix4.prototype.lookAt = function (eye, target, up) {
    const z = new Vector3().subVectors(eye, target).normalize();
    const x = new Vector3().crossVectors(up, z).normalize();
    const y = new Vector3().crossVectors(z, x);
    return this.set(x.x, y.x, z.x, 0, x.y, y.y, z.y, 0, x.z, y.z, z.z, 0, -x.dot(eye), -y.dot(eye), -z.dot(eye), 1);
  };

  function Color(r, g, b) {
    if (typeof r === 'number') { this.r = r; this.g = g; this.b = b; }
    else { this.set(r || 0xffffff); }
  }
  Color.prototype.set = function (value) {
    if (typeof value === 'number') {
      this.r = ((value >> 16) & 255) / 255;
      this.g = ((value >> 8) & 255) / 255;
      this.b = (value & 255) / 255;
    } else if (typeof value === 'string') {
      const n = parseInt(value.replace('#', ''), 16);
      this.set(n);
    } else if (value && value.r !== undefined) { this.copy(value); }
    return this;
  };
  Color.prototype.copy = function (c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; };
  Color.prototype.clone = function () { return new Color(this.r, this.g, this.b); };
  Color.prototype.multiplyScalar = function (s) { this.r *= s; this.g *= s; this.b *= s; return this; };
  Color.prototype.lerp = function (c, t) {
    this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t;
    return this;
  };

  const MathUtils = {
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    damp: (x, y, lambda, dt) => MathUtils.lerp(x, y, 1 - Math.exp(-lambda * dt)),
    degToRad: (d) => d * Math.PI / 180,
    radToDeg: (r) => r * 180 / Math.PI,
    wrapAngle: (a) => { let w = a % (Math.PI * 2); if (w > Math.PI) w -= Math.PI * 2; if (w < -Math.PI) w += Math.PI * 2; return w; }
  };

  // ---------------- 场景图 ----------------
  let objectId = 0;
  function Object3D() {
    this.id = ++objectId;
    this.name = '';
    this.parent = null;
    this.children = [];
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.scale = new Vector3(1, 1, 1);
    this.rotation = new Euler();
    this.up = new Vector3(0, 1, 0);
    this.matrix = new Matrix4();
    this.matrixWorld = new Matrix4();
    this.matrixAutoUpdate = true;
    this.visible = true;
    this.userData = {};
    this.castShadow = false;
    this.receiveShadow = false;
  }
  Object3D.prototype.add = function (child) {
    if (child.parent) child.parent.remove(child);
    child.parent = this;
    this.children.push(child);
    return this;
  };
  Object3D.prototype.remove = function (child) {
    const i = this.children.indexOf(child);
    if (i >= 0) { this.children.splice(i, 1); child.parent = null; }
    return this;
  };
  Object3D.prototype.updateMatrix = function () {
    this.quaternion.setFromEuler(this.rotation);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  };
  Object3D.prototype.updateMatrixWorld = function (force) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.parent === null) this.matrixWorld.copy(this.matrix);
    else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    for (let i = 0; i < this.children.length; i++) this.children[i].updateMatrixWorld(force);
  };
  Object3D.prototype.traverse = function (cb) {
    cb(this);
    for (let i = 0; i < this.children.length; i++) this.children[i].traverse(cb);
  };
  Object3D.prototype.getWorldPosition = function (target) {
    if (!target) target = new Vector3();
    this.updateMatrixWorld();
    return target.setFromMatrixPosition(this.matrixWorld);
  };
  Object3D.prototype.getWorldQuaternion = function (target) {
    if (!target) target = new Quaternion();
    this.updateMatrixWorld();
    const te = this.matrixWorld.elements;
    const t = te[0] + te[5] + te[10];
    if (t > 0) {
      const s = 0.5 / Math.sqrt(t + 1);
      target.w = 0.25 / s; target.x = (te[6] - te[9]) * s; target.y = (te[8] - te[2]) * s; target.z = (te[1] - te[4]) * s;
    } else {
      target.set(0, 0, 0, 1);
    }
    return target.normalize();
  };
  Object3D.prototype.lookAt = function (target) {
    this.updateMatrixWorld();
    const eye = new Vector3().setFromMatrixPosition(this.matrixWorld);
    const m = new Matrix4().lookAt(eye, target instanceof Vector3 ? target : target.position, this.up);
    this.quaternion.setFromRotationMatrix ? this.quaternion.setFromRotationMatrix(m) : this.quaternionFromMatrix(m);
  };
  Object3D.prototype.quaternionFromMatrix = function (m) {
    const e = m.elements;
    const t = e[0] + e[5] + e[10];
    if (t > 0) {
      const s = 0.5 / Math.sqrt(t + 1);
      this.quaternion.w = 0.25 / s; this.quaternion.x = (e[6] - e[9]) * s;
      this.quaternion.y = (e[8] - e[2]) * s; this.quaternion.z = (e[1] - e[4]) * s;
    } else if (e[0] > e[5] && e[0] > e[10]) {
      const s = 2 * Math.sqrt(1 + e[0] - e[5] - e[10]);
      this.quaternion.w = (e[6] - e[9]) / s; this.quaternion.x = 0.25 * s;
      this.quaternion.y = (e[1] + e[4]) / s; this.quaternion.z = (e[8] + e[2]) / s;
    } else if (e[5] > e[10]) {
      const s = 2 * Math.sqrt(1 + e[5] - e[0] - e[10]);
      this.quaternion.w = (e[8] - e[2]) / s; this.quaternion.x = (e[1] + e[4]) / s;
      this.quaternion.y = 0.25 * s; this.quaternion.z = (e[6] + e[9]) / s;
    } else {
      const s = 2 * Math.sqrt(1 + e[10] - e[0] - e[5]);
      this.quaternion.w = (e[1] - e[4]) / s; this.quaternion.x = (e[8] + e[2]) / s;
      this.quaternion.y = (e[6] + e[9]) / s; this.quaternion.z = 0.25 * s;
    }
    this.quaternion.normalize();
  };
  Object3D.prototype.rotateY = function (a) {
    this.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a));
    return this;
  };
  Object3D.prototype.rotateX = function (a) {
    this.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), a));
    return this;
  };
  Object3D.prototype.rotateZ = function (a) {
    this.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), a));
    return this;
  };

  function Group() { Object3D.call(this); }
  Group.prototype = Object.create(Object3D.prototype);
  Group.prototype.constructor = Group;

  function Scene() { Object3D.call(this); this.fog = null; this.background = null; }
  Scene.prototype = Object.create(Object3D.prototype);
  Scene.prototype.constructor = Scene;

  function Mesh(geometry, material) {
    Object3D.call(this);
    this.geometry = geometry || new BufferGeometry();
    this.material = material || new MeshBasicMaterial();
    this.frustumCulled = true;
  }
  Mesh.prototype = Object.create(Object3D.prototype);
  Mesh.prototype.constructor = Mesh;

  // ---------------- 几何 ----------------
  function BufferGeometry() {
    this.attributes = {};
    this.index = null;
    this.boundingSphere = null;
  }
  BufferGeometry.prototype.setAttribute = function (name, attr) { this.attributes[name] = attr; return this; };
  BufferGeometry.prototype.setIndex = function (arr) { this.index = arr; return this; };
  BufferGeometry.prototype.getAttribute = function (name) { return this.attributes[name]; };
  BufferGeometry.prototype.computeVertexNormals = function () {
    const pos = this.attributes.position;
    if (!pos) return;
    const norm = new Float32Array(pos.array.length);
    const idx = this.index ? Array.from(this.index.array || this.index) : null;
    const tris = idx || Array.from({ length: pos.count }, (_, i) => i);
    const v = [];
    for (let i = 0; i < pos.count; i++) v.push(new Vector3(pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2]));
    for (let i = 0; i + 2 < tris.length; i += 3) {
      const a = v[tris[i]], b = v[tris[i + 1]], c = v[tris[i + 2]];
      const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
      norm[tris[i] * 3] += n.x; norm[tris[i] * 3 + 1] += n.y; norm[tris[i] * 3 + 2] += n.z;
      norm[tris[i + 1] * 3] += n.x; norm[tris[i + 1] * 3 + 1] += n.y; norm[tris[i + 1] * 3 + 2] += n.z;
      norm[tris[i + 2] * 3] += n.x; norm[tris[i + 2] * 3 + 1] += n.y; norm[tris[i + 2] * 3 + 2] += n.z;
    }
    for (let i = 0; i < pos.count; i++) {
      const l = Math.hypot(norm[i * 3], norm[i * 3 + 1], norm[i * 3 + 2]) || 1;
      norm[i * 3] /= l; norm[i * 3 + 1] /= l; norm[i * 3 + 2] /= l;
    }
    this.setAttribute('normal', new BufferAttribute(norm, 3));
    return this;
  };
  BufferGeometry.prototype.computeBoundingSphere = function () {
    const pos = this.attributes.position;
    if (!pos) return;
    let cx = 0, cy = 0, cz = 0, n = pos.count;
    for (let i = 0; i < n; i++) { cx += pos.array[i * 3]; cy += pos.array[i * 3 + 1]; cz += pos.array[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    let r = 0;
    for (let i = 0; i < n; i++) {
      const dx = pos.array[i * 3] - cx, dy = pos.array[i * 3 + 1] - cy, dz = pos.array[i * 3 + 2] - cz;
      r = Math.max(r, Math.hypot(dx, dy, dz));
    }
    this.boundingSphere = { center: new Vector3(cx, cy, cz), radius: r };
  };
  BufferGeometry.prototype.translate = function (x, y, z) {
    const pos = this.attributes.position;
    for (let i = 0; i < pos.count; i++) { pos.array[i * 3] += x; pos.array[i * 3 + 1] += y; pos.array[i * 3 + 2] += z; }
    return this;
  };

  function BufferAttribute(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; }
  BufferAttribute.prototype.setXYZ = function (i, x, y, z) { this.array[i * 3] = x; this.array[i * 3 + 1] = y; this.array[i * 3 + 2] = z; };

  function buildBox(w, h, d) {
    const p = [], n = [], u = [], idx = [];
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const faces = [
      { c: [0, 0, 1], verts: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]] },
      { c: [0, 0, -1], verts: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]] },
      { c: [1, 0, 0], verts: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]] },
      { c: [-1, 0, 0], verts: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]] },
      { c: [0, 1, 0], verts: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]] },
      { c: [0, -1, 0], verts: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]] }
    ];
    let base = 0;
    for (const f of faces) {
      const vi = [base, base + 1, base + 2, base + 3];
      idx.push(vi[0], vi[1], vi[2], vi[0], vi[2], vi[3]);
      for (const v of f.verts) { p.push(v[0], v[1], v[2]); n.push(f.c[0], f.c[1], f.c[2]); }
      for (let i = 0; i < 4; i++) u.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0);
      base += 4;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(n), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(u), 2));
    g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }
  function BoxGeometry(w, h, d) { return buildBox(w || 1, h || 1, d || 1); }

  function buildCylinder(radiusTop, radiusBottom, height, radialSegments, openEnded) {
    radialSegments = radialSegments || 16;
    const p = [], n = [], u = [], idx = [];
    const hh = height / 2;
    for (let i = 0; i <= radialSegments; i++) {
      const a = i / radialSegments * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      p.push(ca * radiusTop, hh, sa * radiusTop, ca * radiusBottom, -hh, sa * radiusBottom);
      n.push(ca, 0, sa, ca, 0, sa);
      u.push(i / radialSegments, 1, i / radialSegments, 0);
    }
    const base = 0;
    for (let i = 0; i < radialSegments; i++) {
      idx.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
    }
    if (!openEnded && radiusBottom > 0) {
      let capBase = p.length / 3;
      p.push(0, -hh, 0); n.push(0, -1, 0); u.push(0.5, 0.5);
      for (let i = 0; i <= radialSegments; i++) {
        const a = i / radialSegments * Math.PI * 2;
        p.push(Math.cos(a) * radiusBottom, -hh, Math.sin(a) * radiusBottom);
        n.push(0, -1, 0); u.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
      }
      for (let i = 0; i < radialSegments; i++) idx.push(capBase, capBase + i + 1, capBase + i + 2);
      capBase = p.length / 3;
      p.push(0, hh, 0); n.push(0, 1, 0); u.push(0.5, 0.5);
      for (let i = 0; i <= radialSegments; i++) {
        const a = i / radialSegments * Math.PI * 2;
        p.push(Math.cos(a) * radiusTop, hh, -Math.sin(a) * radiusTop);
        n.push(0, 1, 0); u.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
      }
      for (let i = 0; i < radialSegments; i++) idx.push(capBase, capBase + i + 2, capBase + i + 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(n), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(u), 2));
    g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }
  function CylinderGeometry(rt, rb, h, seg) { return buildCylinder(rt, rb, h, seg, false); }

  function buildSphere(r, ws, hs) {
    ws = ws || 16; hs = hs || 12;
    const p = [], n = [], u = [], idx = [];
    for (let y = 0; y <= hs; y++) {
      const v = y / hs, phi = v * Math.PI;
      for (let x = 0; x <= ws; x++) {
        const uu = x / ws, theta = uu * Math.PI * 2;
        const sx = Math.sin(phi) * Math.cos(theta), sy = Math.cos(phi), sz = Math.sin(phi) * Math.sin(theta);
        p.push(sx * r, sy * r, sz * r); n.push(sx, sy, sz); u.push(uu, v);
      }
    }
    for (let y = 0; y < hs; y++) {
      for (let x = 0; x < ws; x++) {
        const a = y * (ws + 1) + x, b = a + ws + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(n), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(u), 2));
    g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }
  function SphereGeometry(r) { return buildSphere(r || 1, 24, 16); }

  function PlaneGeometry(w, h) {
    const g = new BufferGeometry();
    const hw = w / 2, hh = h / 2;
    g.setAttribute('position', new BufferAttribute(new Float32Array([-hw, 0, -hh, hw, 0, -hh, hw, 0, hh, -hw, 0, hh]), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex(new BufferAttribute(new Uint32Array([0, 1, 2, 0, 2, 3]), 1));
    return g;
  }

  // ---------------- 材质 ----------------
  function Material() {
    this.color = new Color(0xffffff);
    this.transparent = false;
    this.opacity = 1;
    this.side = 0; // 0=FrontSide
    this.map = null;
    this.vertexColors = false;
    this.name = '';
  }
  function MeshBasicMaterial(opts) {
    Material.call(this);
    const color = opts && opts.color !== undefined ? new Color(opts.color) : this.color;
    Object.assign(this, opts);
    this.color = color;
  }
  MeshBasicMaterial.prototype = Object.create(Material.prototype);
  MeshBasicMaterial.prototype.constructor = MeshBasicMaterial;
  MeshBasicMaterial.prototype.clone = function () { return new MeshBasicMaterial(this); };
  function MeshLambertMaterial(opts) {
    Material.call(this);
    this.emissive = new Color(0); this.emissiveIntensity = 1;
    const color = opts && opts.color !== undefined ? new Color(opts.color) : this.color;
    const emissive = opts && opts.emissive !== undefined ? new Color(opts.emissive) : this.emissive;
    Object.assign(this, opts);
    this.color = color;
    this.emissive = emissive;
  }
  MeshLambertMaterial.prototype = Object.create(Material.prototype);
  MeshLambertMaterial.prototype.constructor = MeshLambertMaterial;
  MeshLambertMaterial.prototype.clone = function () { return new MeshLambertMaterial(this); };
  function MeshStandardMaterial(opts) {
    Material.call(this);
    this.roughness = 0.6; this.metalness = 0.0;
    this.emissive = new Color(0); this.emissiveIntensity = 1;
    this.flatShading = false;
    const color = opts && opts.color !== undefined ? new Color(opts.color) : this.color;
    const emissive = opts && opts.emissive !== undefined ? new Color(opts.emissive) : this.emissive;
    Object.assign(this, opts);
    this.color = color;
    this.emissive = emissive;
  }
  MeshStandardMaterial.prototype = Object.create(Material.prototype);
  MeshStandardMaterial.prototype.constructor = MeshStandardMaterial;
  MeshStandardMaterial.prototype.clone = function () { return new MeshStandardMaterial(this); };
  function MeshPhongMaterial(opts) { return new MeshStandardMaterial({ ...opts, metalness: 0.2, roughness: 0.4 }); }
  MeshPhongMaterial.prototype = Object.create(MeshStandardMaterial.prototype);

  // ---------------- 光照 / 雾 / 纹理 ----------------
  function Light(color, intensity) { Object3D.call(this); this.color = new Color(color === undefined ? 0xffffff : color); this.intensity = intensity === undefined ? 1 : intensity; }
  Light.prototype = Object.create(Object3D.prototype);
  Light.prototype.constructor = Light;
  function AmbientLight(c, i) { Light.call(this, c, i); }
  AmbientLight.prototype = Object.create(Light.prototype);
  function HemisphereLight(sky, ground, i) { Light.call(this, 0xffffff, i === undefined ? 1 : i); this.skyColor = new Color(sky === undefined ? 0xffffff : sky); this.groundColor = new Color(ground === undefined ? 0x444444 : ground); }
  HemisphereLight.prototype = Object.create(Light.prototype);
  function DirectionalLight(c, i) { Light.call(this, c, i); this.target = new Object3D(); this.shadow = { mapSize: { width: 1024, height: 1024 }, camera: { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 }, bias: -0.001 }; }
  DirectionalLight.prototype = Object.create(Light.prototype);
  function Fog(color, near, far) { this.color = new Color(color === undefined ? 0xffffff : color); this.near = near === undefined ? 1 : near; this.far = far === undefined ? 1000 : far; }
  function Texture(image) { this.image = image; this.needsUpdate = true; }
  function CanvasTexture(canvas) { Texture.call(this, canvas); }
  CanvasTexture.prototype = Object.create(Texture.prototype);

  // ---------------- 相机 ----------------
  function PerspectiveCamera(fov, aspect, near, far) {
    Object3D.call(this);
    this.fov = fov !== undefined ? fov : 60;
    this.aspect = aspect || 1;
    this.near = near !== undefined ? near : 0.1;
    this.far = far !== undefined ? far : 1000;
    this.projectionMatrix = new Matrix4();
    this.updateProjectionMatrix();
  }
  PerspectiveCamera.prototype = Object.create(Object3D.prototype);
  PerspectiveCamera.prototype.constructor = PerspectiveCamera;
  PerspectiveCamera.prototype.updateProjectionMatrix = function () {
    this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
  };

  // ---------------- WebGL 渲染器 ----------------
  const VERT_SRC = `
    attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aUv;
    uniform mat4 uProj, uView, uModel, uNorm;
    varying vec3 vNormal; varying vec3 vWorld; varying vec2 vUv;
    void main() {
      vNormal = normalize((uNorm * vec4(aNorm, 0.0)).xyz);
      vec4 wp = uModel * vec4(aPos, 1.0);
      vWorld = wp.xyz;
      vUv = aUv;
      gl_Position = uProj * uView * wp;
    }`;
  const FRAG_SRC = `
    precision mediump float;
    varying vec3 vNormal; varying vec3 vWorld; varying vec2 vUv;
    uniform vec3 uColor; uniform vec3 uEmissive; uniform float uEmissiveIntensity;
    uniform float uRoughness; uniform float uMetalness;
    uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunIntensity;
    uniform vec3 uAmbient; uniform vec3 uSky; uniform vec3 uGround;
    uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
    uniform bool uUseMap; uniform sampler2D uMap;
    uniform bool uShadow; uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uShadowBias;
    uniform float uOpacity; uniform float uToneMapExposure;
    float aces(float x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 albedo = uColor;
      if (uUseMap) albedo *= texture2D(uMap, vUv).rgb;
      vec3 N = normalize(vNormal);
      if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(uCamPos - vWorld);
      vec3 L = normalize(-uSunDir);
      float ndl = max(dot(N, L), 0.0);
      vec3 H = normalize(L + V);
      float ndh = max(dot(N, H), 0.0);
      float spec = pow(ndh, mix(64.0, 4.0, uRoughness)) * (1.0 - uMetalness * 0.7);
      vec3 diff = albedo * ndl;
      // 简易半球环境（金属/漆面不发黑）
      float hemi = 0.5 + 0.5 * N.y;
      vec3 env = mix(uGround, uSky, hemi) * (0.35 + 0.65 * albedo);
      // 金属：环境反射着色
      vec3 R = reflect(-V, N);
      float envSpec = pow(max(R.y, 0.0), 8.0);
      env += uSky * envSpec * uMetalness;
      vec3 color = (diff * uSunColor * uSunIntensity + env * uAmbient) * (1.0 - uMetalness) + albedo * spec * uSunColor * uSunIntensity * 0.6 + albedo * uMetalness * env * 1.2;
      color += uEmissive * uEmissiveIntensity;
      if (uShadow) {
        vec4 sp = uShadowMatrix * vec4(vWorld, 1.0);
        vec3 ndc = sp.xyz / sp.w;
        vec2 uv = ndc.xy * 0.5 + 0.5;
        if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0 && ndc.z <= 1.0) {
          float d = texture2D(uShadowMap, uv).r;
          if (ndc.z - uShadowBias > d) color *= 0.45;
        }
      }
      float dist = length(uCamPos - vWorld);
      float fog = smoothstep(uFogNear, uFogFar, dist);
      color = mix(color, uFogColor, fog);
      color *= uToneMapExposure;
      color = vec3(aces(color.r), aces(color.g), aces(color.b));
      gl_FragColor = vec4(color, uOpacity);
    }`;
  const DEPTH_VERT = `
    attribute vec3 aPos;
    uniform mat4 uProj, uView, uModel;
    void main() { gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;
  const DEPTH_FRAG = `
    precision mediump float;
    void main() { gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0); }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }
  function makeProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link error');
    return p;
  }
  function getUniforms(gl, p) {
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return u;
  }

  function WebGLRenderer(opts) {
    opts = opts || {};
    this.canvas = opts.canvas || document.createElement('canvas');
    const attrs = { alpha: false, antialias: !!opts.antialias, depth: true, stencil: false, powerPreference: 'high-performance' };
    this.gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
    if (!this.gl) throw new Error('WebGL 不可用');
    this.domElement = this.canvas;
    this.pixelRatio = 1;
    this.width = 0; this.height = 0;
    this.autoClear = true;
    this.shadowMap = { enabled: true, needsUpdate: true };
    this.toneMapping = 1; // ACESFilmicToneMapping
    this.toneMappingExposure = 1.0;
    this._program = makeProgram(this.gl, VERT_SRC, FRAG_SRC);
    this._depthProgram = makeProgram(this.gl, DEPTH_VERT, DEPTH_FRAG);
    this._u = getUniforms(this.gl, this._program);
    this._du = getUniforms(this.gl, this._depthProgram);
    this._vaoCache = new Map();
    this._textures = new Map();
    this._shadowFBO = null;
    this._shadowTex = null;
    this._clearColor = new Float32Array([0, 0, 0, 1]);
    this._scratchV3 = new Vector3();
  }
  WebGLRenderer.prototype.setPixelRatio = function (r) { this.pixelRatio = r; this.setSize(this.width || this.canvas.width, this.height || this.canvas.height); };
  WebGLRenderer.prototype.setSize = function (w, h, updateStyle) {
    this.width = w; this.height = h;
    this.canvas.width = Math.floor(w * this.pixelRatio);
    this.canvas.height = Math.floor(h * this.pixelRatio);
    if (updateStyle !== false) {
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };
  WebGLRenderer.prototype.setClearColor = function (color, alpha) {
    const c = new Color(color);
    this._clearColor[0] = c.r; this._clearColor[1] = c.g; this._clearColor[2] = c.b; this._clearColor[3] = alpha === undefined ? 1 : alpha;
  };
  WebGLRenderer.prototype._setupTexture = function (tex) {
    let t = this._textures.get(tex);
    if (!t) {
      t = this.gl.createTexture();
      this._textures.set(tex, t);
      this.gl.bindTexture(this.gl.TEXTURE_2D, t);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    } else {
      this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    }
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, tex.image || tex);
    this.gl.generateMipmap(this.gl.TEXTURE_2D);
    return t;
  };
  WebGLRenderer.prototype._setupVAO = function (geo) {
    const gl = this.gl;
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const uv = geo.attributes.uv;
    let vao = this._vaoCache.get(geo);
    if (!vao) {
      vao = {};
      vao.vbo = gl.createBuffer();
      vao.ibo = gl.createBuffer();
      vao.count = geo.index ? geo.index.count : geo.attributes.position.count;
      vao.stride = (pos.itemSize + (norm ? 3 : 0) + (uv ? 2 : 0)) * 4;
      this._vaoCache.set(geo, vao);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo);
    const stride = (pos.itemSize + (norm ? 3 : 0) + (uv ? 2 : 0)) * 4;
    const arr = new Float32Array(pos.count * (pos.itemSize + (norm ? 3 : 0) + (uv ? 2 : 0)));
    for (let i = 0; i < pos.count; i++) {
      let o = 0;
      arr[i * (stride / 4) + o++] = pos.array[i * 3];
      arr[i * (stride / 4) + o++] = pos.array[i * 3 + 1];
      arr[i * (stride / 4) + o++] = pos.array[i * 3 + 2];
      if (norm) { arr[i * (stride / 4) + o++] = norm.array[i * 3]; arr[i * (stride / 4) + o++] = norm.array[i * 3 + 1]; arr[i * (stride / 4) + o++] = norm.array[i * 3 + 2]; }
      if (uv) { arr[i * (stride / 4) + o++] = uv.array[i * 2]; arr[i * (stride / 4) + o++] = uv.array[i * 2 + 1]; }
    }
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    if (geo.index) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.index.array instanceof Uint32Array ? geo.index.array : new Uint32Array(geo.index.array), gl.STATIC_DRAW);
    }
    const aPos = gl.getAttribLocation(this._program, 'aPos');
    const aNorm = gl.getAttribLocation(this._program, 'aNorm');
    const aUv = gl.getAttribLocation(this._program, 'aUv');
    let off = 0;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, off); off += 12;
    if (norm >= 0) { gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, off); off += 12; }
    if (uv >= 0) { gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, off); }
    return vao;
  };
  WebGLRenderer.prototype._setupDepthVAO = function (geo) {
    const gl = this.gl;
    let vao = this._vaoCache.get(geo);
    if (!vao) {
      vao = this._setupVAO(geo);
      this._vaoCache.set(geo, vao);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.ibo);
    const stride = vao.stride;
    const aPos = gl.getAttribLocation(this._depthProgram, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, vao.stride || 12, 0);
    return vao;
  };
  WebGLRenderer.prototype._ensureShadow = function () {
    const gl = this.gl;
    if (this._shadowFBO) return;
    const size = this.shadowMap.mapSize ? this.shadowMap.mapSize.width : 1024;
    this._shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this._shadowFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this._shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._shadowSize = size;
  };
  WebGLRenderer.prototype._renderShadow = function (scene, sun) {
    if (!this.shadowMap.enabled || !sun) return null;
    const gl = this.gl;
    this._ensureShadow();
    const size = this._shadowSize;
    const cam = sun.shadow.camera;
    const lightPos = sun.position;
    const targetPos = sun.target ? sun.target.position : new Vector3();
    const view = new Matrix4().lookAt(lightPos, targetPos, new Vector3(0, 1, 0));
    const proj = new Matrix4().makeOrthographic(cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowFBO);
    gl.viewport(0, 0, size, size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this._depthProgram);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    scene.traverse((obj) => {
      if (!(obj instanceof Mesh) || !obj.visible || !obj.castShadow) return;
      this._setupDepthVAO(obj.geometry);
      gl.uniformMatrix4fv(this._du.uProj, false, proj.elements);
      gl.uniformMatrix4fv(this._du.uView, false, view.elements);
      gl.uniformMatrix4fv(this._du.uModel, false, obj.matrixWorld.elements);
      if (obj.geometry.index) gl.drawElements(gl.TRIANGLES, obj.geometry.index.count, gl.UNSIGNED_INT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, obj.geometry.attributes.position.count);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // 阴影矩阵
    const bias = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    return bias.multiply(proj).multiply(view);
  };
  WebGLRenderer.prototype.render = function (scene, camera) {
    const gl = this.gl;
    const u = this._u;
    let sun = null;
    scene.traverse((o) => { if (!sun && o instanceof DirectionalLight) sun = o; });
    const shadowMatrix = this._renderShadow(scene, sun);
    camera.updateMatrixWorld();
    const view = new Matrix4().copy(camera.matrixWorld).invert();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(this._clearColor[0], this._clearColor[1], this._clearColor[2], this._clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this._program);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.uniformMatrix4fv(u.uProj, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(u.uView, false, view.elements);

    // 光照
    let ambient = new Color(0x222222), sky = new Color(0x8899bb), ground = new Color(0x334422), sunColor = new Color(0xffffff), sunIntensity = 1;
    scene.traverse((o) => {
      if (o instanceof AmbientLight) ambient.copy(o.color).multiplyScalar(o.intensity);
      else if (o instanceof HemisphereLight) { sky.copy(o.skyColor).multiplyScalar(o.intensity); ground.copy(o.groundColor).multiplyScalar(o.intensity); }
      else if (o instanceof DirectionalLight) { sunColor.copy(o.color); sunIntensity = o.intensity; }
    });
    const sunDir = sun ? new Vector3().copy(sun.position).normalize() : new Vector3(0.3, 1, 0.2).normalize();
    gl.uniform3f(u.uAmbient, ambient.r, ambient.g, ambient.b);
    gl.uniform3f(u.uSky, sky.r, sky.g, sky.b);
    gl.uniform3f(u.uGround, ground.r, ground.g, ground.b);
    gl.uniform3f(u.uSunDir, sunDir.x, sunDir.y, sunDir.z);
    gl.uniform3f(u.uSunColor, sunColor.r, sunColor.g, sunColor.b);
    gl.uniform1f(u.uSunIntensity, sunIntensity);
    gl.uniform1f(u.uToneMapExposure, this.toneMappingExposure);
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    gl.uniform3f(u.uCamPos, camPos.x, camPos.y, camPos.z);
    const fog = scene.fog;
    const fogColor = fog ? fog.color : new Color(0);
    gl.uniform3f(u.uFogColor, fogColor.r, fogColor.g, fogColor.b);
    gl.uniform1f(u.uFogNear, fog ? fog.near : 1000);
    gl.uniform1f(u.uFogFar, fog ? fog.far : 2000);
    gl.uniform1i(u.uShadow, shadowMatrix ? 1 : 0);
    if (shadowMatrix) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this._shadowTex);
      gl.uniform1i(u.uShadowMap, 1);
      gl.uniformMatrix4fv(u.uShadowMatrix, false, shadowMatrix.elements);
      gl.uniform1f(u.uShadowBias, sun ? sun.shadow.bias : -0.001);
    }

    // 收集可见网格（透明排序）
    const meshes = [];
    scene.traverse((o) => {
      if (o instanceof Mesh && o.visible && o.geometry && o.geometry.attributes.position) {
        meshes.push(o);
      }
    });
    meshes.sort((a, b) => {
      const at = a.material.transparent, bt = b.material.transparent;
      if (at !== bt) return at ? 1 : -1;
      const da = a.matrixWorld.elements[12] - camPos.x, db = b.matrixWorld.elements[12] - camPos.x;
      const dda = da * da, ddb = db * db;
      return ddb - dda;
    });
    for (const mesh of meshes) {
      const mat = mesh.material;
      gl.uniformMatrix4fv(u.uModel, false, mesh.matrixWorld.elements);
      const n = new Matrix4().copy(mesh.matrixWorld).invert();
      // 法线矩阵（转置）：3x3 取主元
      const ne = n.elements;
      const nm3 = [ne[0], ne[1], ne[2], ne[4], ne[5], ne[6], ne[8], ne[9], ne[10], 0, 0, 0, 0, 0, 0, 1];
      gl.uniformMatrix4fv(u.uNorm, false, nm3);
      gl.uniform3f(u.uColor, mat.color.r, mat.color.g, mat.color.b);
      const em = mat.emissive || new Color(0);
      gl.uniform3f(u.uEmissive, em.r, em.g, em.b);
      gl.uniform1f(u.uEmissiveIntensity, mat.emissiveIntensity || 1);
      gl.uniform1f(u.uRoughness, mat.roughness || 0.6);
      gl.uniform1f(u.uMetalness, mat.metalness || 0);
      gl.uniform1f(u.uOpacity, mat.transparent ? mat.opacity : 1);
      const hasMap = !!mat.map;
      gl.uniform1i(u.uUseMap, hasMap ? 1 : 0);
      if (hasMap) {
        gl.activeTexture(gl.TEXTURE0);
        this._setupTexture(mat.map);
        gl.uniform1i(u.uMap, 0);
      }
      if (mat.transparent) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      else gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      const vao = this._setupVAO(mesh.geometry);
      gl.bindBuffer(gl.ARRAY_BUFFER, vao.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.ibo);
      const aPos = gl.getAttribLocation(this._program, 'aPos');
      const aNorm = gl.getAttribLocation(this._program, 'aNorm');
      const aUv = gl.getAttribLocation(this._program, 'aUv');
      const pos = mesh.geometry.attributes.position, norm = mesh.geometry.attributes.normal, uv = mesh.geometry.attributes.uv;
      const stride = (pos.itemSize + (norm ? 3 : 0) + (uv ? 2 : 0)) * 4;
      let off = 0;
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, off); off += 12;
      if (norm) { gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, off); off += 12; }
      if (uv) { gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, off); }
      if (mesh.geometry.index) gl.drawElements(gl.TRIANGLES, mesh.geometry.index.count, gl.UNSIGNED_INT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, pos.count);
    }
    gl.disable(gl.BLEND);
  };
  WebGLRenderer.prototype.dispose = function () { };

  // 导出
  THREE.Vector2 = Vector2; THREE.Vector3 = Vector3; THREE.Quaternion = Quaternion; THREE.Euler = Euler;
  THREE.Matrix4 = Matrix4; THREE.Color = Color; THREE.MathUtils = MathUtils;
  THREE.Object3D = Object3D; THREE.Group = Group; THREE.Scene = Scene; THREE.Mesh = Mesh;
  THREE.BufferGeometry = BufferGeometry; THREE.BufferAttribute = BufferAttribute;
  THREE.BoxGeometry = BoxGeometry; THREE.CylinderGeometry = CylinderGeometry;
  THREE.SphereGeometry = SphereGeometry; THREE.PlaneGeometry = PlaneGeometry;
  THREE.Material = Material; THREE.MeshBasicMaterial = MeshBasicMaterial;
  THREE.MeshLambertMaterial = MeshLambertMaterial; THREE.MeshStandardMaterial = MeshStandardMaterial;
  THREE.MeshPhongMaterial = MeshPhongMaterial;
  THREE.Light = Light; THREE.AmbientLight = AmbientLight; THREE.HemisphereLight = HemisphereLight;
  THREE.DirectionalLight = DirectionalLight; THREE.Fog = Fog;
  THREE.Texture = Texture; THREE.CanvasTexture = CanvasTexture;
  THREE.PerspectiveCamera = PerspectiveCamera; THREE.WebGLRenderer = WebGLRenderer;
  THREE.ACESFilmicToneMapping = 1;

  root.THREE = THREE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
