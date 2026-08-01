// Minimal linear algebra for the WebGL engine (no external deps).
'use strict';

const M = {
  EPS: 1e-9,

  v3(x, y, z) { return [x, y, z]; },
  v3len(a) { return Math.hypot(a[0], a[1], a[2]); },
  v3norm(a, out) {
    out = out || [0, 0, 0];
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l;
    return out;
  },
  v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  v3cross(a, b, out) {
    out = out || [0, 0, 0];
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
    return out;
  },
  v3sub(a, b, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
    return out;
  },
  v3add(a, b, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
    return out;
  },
  v3scale(a, s, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
    return out;
  },
  v3lerp(a, b, t, out) {
    out = out || [0, 0, 0];
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  },
  v3copy(a, out) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; },

  m4() { return new Float32Array(16); },
  m4id(out) {
    out = out || M.m4();
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },
  m4mul(a, b, out) {
    out = out || M.m4();
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  },
  m4mulV4(m, v, out) {
    out = out || [0, 0, 0, 0];
    const x = v[0], y = v[1], z = v[2], w = v[3] !== undefined ? v[3] : 1;
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
  },
  m4translate(out, x, y, z) {
    out[12] = out[0] * x + out[4] * y + out[8] * z + out[12];
    out[13] = out[1] * x + out[5] * y + out[9] * z + out[13];
    out[14] = out[2] * x + out[6] * y + out[10] * z + out[14];
    out[15] = out[3] * x + out[7] * y + out[11] * z + out[15];
    return out;
  },
  m4perspective(fovy, aspect, near, far, out) {
    out = out || M.m4();
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  },
  m4ortho(l, r, b, t, near, far, out) {
    out = out || M.m4();
    out.fill(0);
    out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (far - near);
    out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(far + near) / (far - near);
    out[15] = 1;
    return out;
  },
  m4lookAt(eye, target, up, out) {
    out = out || M.m4();
    const z = M.v3norm(M.v3sub(eye, target), [0, 0, 0]);
    const x = M.v3norm(M.v3cross(up, z), [0, 0, 0]);
    const y = M.v3cross(z, x, [0, 0, 0]);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -M.v3dot(x, eye); out[13] = -M.v3dot(y, eye); out[14] = -M.v3dot(z, eye); out[15] = 1;
    return out;
  },
  m4inv(src, out) {
    out = out || M.m4();
    const a = src;
    const b = out;
    const d00 = a[0] * a[5] - a[1] * a[4];
    const d01 = a[0] * a[6] - a[2] * a[4];
    const d02 = a[0] * a[7] - a[3] * a[4];
    const d03 = a[1] * a[6] - a[2] * a[5];
    const d04 = a[1] * a[7] - a[3] * a[5];
    const d05 = a[2] * a[7] - a[3] * a[6];
    const d06 = a[8] * a[13] - a[9] * a[12];
    const d07 = a[8] * a[14] - a[10] * a[12];
    const d08 = a[8] * a[15] - a[11] * a[12];
    const d09 = a[9] * a[14] - a[10] * a[13];
    const d10 = a[9] * a[15] - a[11] * a[13];
    const d11 = a[10] * a[15] - a[11] * a[14];
    let det = d00 * d11 - d01 * d10 + d02 * d09 + d03 * d08 - d04 * d07 + d05 * d06;
    if (!det) return M.m4id(out);
    det = 1 / det;
    b[0] = (a[5] * d11 - a[6] * d10 + a[7] * d09) * det;
    b[1] = (-a[1] * d11 + a[2] * d10 - a[3] * d09) * det;
    b[2] = (a[13] * d05 - a[14] * d04 + a[15] * d03) * det;
    b[3] = (-a[9] * d05 + a[10] * d04 - a[11] * d03) * det;
    b[4] = (-a[4] * d11 + a[6] * d08 - a[7] * d07) * det;
    b[5] = (a[0] * d11 - a[2] * d08 + a[3] * d07) * det;
    b[6] = (-a[12] * d05 + a[14] * d02 - a[15] * d01) * det;
    b[7] = (a[8] * d05 - a[10] * d02 + a[11] * d01) * det;
    b[8] = (a[4] * d10 - a[5] * d08 + a[7] * d06) * det;
    b[9] = (-a[0] * d10 + a[1] * d08 - a[3] * d06) * det;
    b[10] = (a[12] * d04 - a[13] * d02 + a[15] * d00) * det;
    b[11] = (-a[8] * d04 + a[9] * d02 - a[11] * d00) * det;
    b[12] = (-a[4] * d09 + a[5] * d07 - a[6] * d06) * det;
    b[13] = (a[0] * d09 - a[1] * d07 + a[2] * d06) * det;
    b[14] = (-a[12] * d03 + a[13] * d01 - a[14] * d00) * det;
    b[15] = (a[8] * d03 - a[9] * d01 + a[10] * d00) * det;
    return out;
  },
  m4transpose(src, out) {
    out = out || M.m4();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) out[i * 4 + j] = src[j * 4 + i];
    }
    return out;
  },
  m4fromQuat(q, out) {
    out = out || M.m4();
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    out[0] = 1 - (yy + zz); out[1] = xy + wz; out[2] = xz - wy; out[3] = 0;
    out[4] = xy - wz; out[5] = 1 - (xx + zz); out[6] = yz + wx; out[7] = 0;
    out[8] = xz + wy; out[9] = yz - wx; out[10] = 1 - (xx + yy); out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
  },

  quat() { return [0, 0, 0, 1]; },
  quatMul(a, b, out) {
    out = out || M.quat();
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[0] = aw * bx + ax * bw + ay * bz - az * by;
    out[1] = aw * by + ay * bw + az * bx - ax * bz;
    out[2] = aw * bz + az * bw + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
  },
  quatFromAxisAngle(axis, angle, out) {
    out = out || M.quat();
    const s = Math.sin(angle / 2);
    out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s; out[3] = Math.cos(angle / 2);
    return out;
  },
  quatFromEulerYXZ(yaw, pitch, roll, out) {
    out = out || M.quat();
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
    out[0] = sr * cp * cy - cr * sp * sy;
    out[1] = cr * sp * cy + sr * cp * sy;
    out[2] = cr * cp * sy - sr * sp * cy;
    out[3] = cr * cp * cy + sr * sp * sy;
    return out;
  },
  quatRotate(q, axis, angle, out) {
    return M.quatMul(M.quatFromAxisAngle(axis, angle, M.quat()), q, out);
  },
  quatConj(q, out) {
    out = out || M.quat();
    out[0] = -q[0]; out[1] = -q[1]; out[2] = -q[2]; out[3] = q[3];
    return out;
  },
  quatTransform(q, v, out) {
    out = out || [0, 0, 0];
    const x = v[0], y = v[1], z = v[2];
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
  },
  quatNlerp(a, b, t, out) {
    out = out || M.quat();
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let b2 = b;
    if (dot < 0) { dot = -dot; b2 = [-b[0], -b[1], -b[2], -b[3]]; }
    out[0] = a[0] + (b2[0] - a[0]) * t;
    out[1] = a[1] + (b2[1] - a[1]) * t;
    out[2] = a[2] + (b2[2] - a[2]) * t;
    out[3] = a[3] + (b2[3] - a[3]) * t;
    const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l; out[3] /= l;
    return out;
  },
  quatFromBasis(xAxis, yAxis, zAxis, out) {
    // rotation matrix -> quat (robust)
    out = out || M.quat();
    const m = M.m4();
    m[0] = xAxis[0]; m[1] = yAxis[0]; m[2] = zAxis[0];
    m[4] = xAxis[1]; m[5] = yAxis[1]; m[6] = zAxis[1];
    m[8] = xAxis[2]; m[9] = yAxis[2]; m[10] = zAxis[2];
    m[15] = 1;
    const tr = m[0] + m[5] + m[10];
    if (tr > 0) {
      let s = Math.sqrt(tr + 1) * 2;
      out[3] = 0.25 * s;
      out[0] = (m[6] - m[9]) / s;
      out[1] = (m[8] - m[2]) / s;
      out[2] = (m[1] - m[4]) / s;
    } else if (m[0] > m[5] && m[0] > m[10]) {
      let s = Math.sqrt(1 + m[0] - m[5] - m[10]) * 2;
      out[3] = (m[6] - m[9]) / s;
      out[0] = 0.25 * s;
      out[1] = (m[1] + m[4]) / s;
      out[2] = (m[8] + m[2]) / s;
    } else if (m[5] > m[10]) {
      let s = Math.sqrt(1 + m[5] - m[0] - m[10]) * 2;
      out[3] = (m[8] - m[2]) / s;
      out[0] = (m[1] + m[4]) / s;
      out[1] = 0.25 * s;
      out[2] = (m[6] + m[9]) / s;
    } else {
      let s = Math.sqrt(1 + m[10] - m[0] - m[5]) * 2;
      out[3] = (m[1] - m[4]) / s;
      out[0] = (m[8] + m[2]) / s;
      out[1] = (m[6] + m[9]) / s;
      out[2] = 0.25 * s;
    }
    const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l; out[3] /= l;
    return out;
  }
};

if (typeof globalThis !== 'undefined') globalThis.M = M;
if (typeof module !== 'undefined' && module.exports) module.exports = M;
