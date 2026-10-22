export function v3(x = 0, y = 0, z = 0) {
  return new Float32Array([x, y, z]);
}

export function add(a, b) {
  return v3(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
}

export function sub(a, b) {
  return v3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function mul(a, s) {
  return v3(a[0] * s, a[1] * s, a[2] * s);
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
  return v3(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  );
}

export function len(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function norm(a) {
  const l = len(a) || 1;
  return v3(a[0] / l, a[1] / l, a[2] / l);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smooth01(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

export function mat4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function mat4MulMany(first, ...rest) {
  let m = first;
  for (const n of rest) m = mat4Mul(m, n);
  return m;
}

export function mat4Translate(x, y, z) {
  const m = mat4();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function mat4RotateX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function mat4RotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function mat4RotateZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export function mat4FromBasis(x, y, z, p) {
  const m = mat4();
  m[0] = x[0];
  m[1] = x[1];
  m[2] = x[2];
  m[4] = y[0];
  m[5] = y[1];
  m[6] = y[2];
  m[8] = z[0];
  m[9] = z[1];
  m[10] = z[2];
  m[12] = p[0];
  m[13] = p[1];
  m[14] = p[2];
  return m;
}

export function mat4TransformPoint(m, x, y, z) {
  return v3(
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  );
}

export function mat4TransformDir(m, x, y, z) {
  return v3(
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z
  );
}

export function mat4InvertRigid(m) {
  const o = mat4();
  o[0] = m[0];
  o[1] = m[4];
  o[2] = m[8];
  o[4] = m[1];
  o[5] = m[5];
  o[6] = m[9];
  o[8] = m[2];
  o[9] = m[6];
  o[10] = m[10];
  const tx = m[12];
  const ty = m[13];
  const tz = m[14];
  o[12] = -(o[0] * tx + o[4] * ty + o[8] * tz);
  o[13] = -(o[1] * tx + o[5] * ty + o[9] * tz);
  o[14] = -(o[2] * tx + o[6] * ty + o[10] * tz);
  return o;
}

export function mat4Normal(model) {
  const m = mat4();
  m[0] = model[0];
  m[1] = model[1];
  m[2] = model[2];
  m[4] = model[4];
  m[5] = model[5];
  m[6] = model[6];
  m[8] = model[8];
  m[9] = model[9];
  m[10] = model[10];
  return m;
}

export function lookAt(eye, target, up) {
  const z = norm(sub(eye, target));
  let x = cross(up, z);
  if (len(x) < 1e-5) x = cross(v3(0, 0, 1), z);
  x = norm(x);
  const y = cross(z, x);
  const m = mat4();
  m[0] = x[0];
  m[1] = y[0];
  m[2] = z[0];
  m[4] = x[1];
  m[5] = y[1];
  m[6] = z[1];
  m[8] = x[2];
  m[9] = y[2];
  m[10] = z[2];
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  return m;
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1;
  m[14] = (near * far) / (near - far);
  return m;
}

export function frustum(l, r, b, t, n, f) {
  const m = new Float32Array(16);
  m[0] = (2 * n) / (r - l);
  m[5] = (2 * n) / (t - b);
  m[8] = (r + l) / (r - l);
  m[9] = (t + b) / (t - b);
  m[10] = f / (n - f);
  m[11] = -1;
  m[14] = (n * f) / (n - f);
  return m;
}

export function ortho(left, right, bottom, top, near, far) {
  const m = new Float32Array(16);
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = 1 / (near - far);
  m[12] = (right + left) / (left - right);
  m[13] = (top + bottom) / (bottom - top);
  m[14] = near / (near - far);
  m[15] = 1;
  return m;
}

export function mat4ApplyPoint(m, p) {
  return mat4TransformPoint(m, p[0], p[1], p[2]);
}

export function basisBetween(a, b) {
  const y = norm(sub(b, a));
  const hint = Math.abs(y[1]) < 0.92 ? v3(0, 1, 0) : v3(1, 0, 0);
  const x = norm(cross(hint, y));
  const z = cross(x, y);
  const mid = mul(add(a, b), 0.5);
  return mat4FromBasis(x, y, z, mid);
}

export function deg(d) {
  return (d * Math.PI) / 180;
}
