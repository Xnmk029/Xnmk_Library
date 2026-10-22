'use strict';

/*
 * VT-4 WebGPU Studio
 * A self-contained, asset-free procedural vehicle visualizer.
 * No external 3D models, textures, fonts, or runtime network requests.
 */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (v) => v - Math.floor(v);
const hash1 = (n) => fract(Math.sin(n * 12.9898) * 43758.5453);
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function debounce(fn, delay = 120) {
  let handle = 0;
  return (...args) => {
    clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delay);
  };
}

const V3 = {
  create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  clone: (a) => new Float32Array(a),
  set: (out, x, y, z) => { out[0] = x; out[1] = y; out[2] = z; return out; },
  add: (out, a, b) => { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; },
  sub: (out, a, b) => { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
  scale: (out, a, s) => { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; },
  mad: (out, a, b, s) => { out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s; return out; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (out, a, b) => {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  normalize: (out, a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l;
    return out;
  },
  distance: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  transformPoint: (out, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  },
  transformDirection: (out, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
  },
};

const M4 = {
  create() {
    const out = new Float32Array(16);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },
  identity(out) {
    out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; return out;
  },
  copy(out, a) { out.set(a); return out; },
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  },
  translation(out, x, y, z) {
    M4.identity(out); out[12] = x; out[13] = y; out[14] = z; return out;
  },
  scaling(out, x, y, z) {
    out.fill(0); out[0] = x; out[5] = y; out[10] = z; out[15] = 1; return out;
  },
  rotationX(out, r) {
    const c = Math.cos(r), s = Math.sin(r);
    M4.identity(out); out[5] = c; out[6] = s; out[9] = -s; out[10] = c; return out;
  },
  rotationY(out, r) {
    const c = Math.cos(r), s = Math.sin(r);
    M4.identity(out); out[0] = c; out[2] = -s; out[8] = s; out[10] = c; return out;
  },
  rotationZ(out, r) {
    const c = Math.cos(r), s = Math.sin(r);
    M4.identity(out); out[0] = c; out[1] = s; out[4] = -s; out[5] = c; return out;
  },
  fromTRS(out, pos = [0,0,0], rot = [0,0,0], scale = [1,1,1]) {
    const sx = Math.sin(rot[0]), cx = Math.cos(rot[0]);
    const sy = Math.sin(rot[1]), cy = Math.cos(rot[1]);
    const sz = Math.sin(rot[2]), cz = Math.cos(rot[2]);
    const m00 = cy * cz;
    const m01 = sx * sy * cz + cx * sz;
    const m02 = -cx * sy * cz + sx * sz;
    const m10 = -cy * sz;
    const m11 = -sx * sy * sz + cx * cz;
    const m12 = cx * sy * sz + sx * cz;
    const m20 = sy;
    const m21 = -sx * cy;
    const m22 = cx * cy;
    out[0] = m00 * scale[0]; out[1] = m01 * scale[0]; out[2] = m02 * scale[0]; out[3] = 0;
    out[4] = m10 * scale[1]; out[5] = m11 * scale[1]; out[6] = m12 * scale[1]; out[7] = 0;
    out[8] = m20 * scale[2]; out[9] = m21 * scale[2]; out[10] = m22 * scale[2]; out[11] = 0;
    out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
    return out;
  },
  transpose(out, a) {
    if (out === a) {
      let t;
      t = a[1]; a[1] = a[4]; a[4] = t;
      t = a[2]; a[2] = a[8]; a[8] = t;
      t = a[3]; a[3] = a[12]; a[12] = t;
      t = a[6]; a[6] = a[9]; a[9] = t;
      t = a[7]; a[7] = a[13]; a[13] = t;
      t = a[11]; a[11] = a[14]; a[14] = t;
    } else {
      out[0] = a[0]; out[1] = a[4]; out[2] = a[8]; out[3] = a[12];
      out[4] = a[1]; out[5] = a[5]; out[6] = a[9]; out[7] = a[13];
      out[8] = a[2]; out[9] = a[6]; out[10] = a[10]; out[11] = a[14];
      out[12] = a[3]; out[13] = a[7]; out[14] = a[11]; out[15] = a[15];
    }
    return out;
  },
  invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
  lookAtRH(out, eye, center, up = [0,1,0]) {
    const z = V3.create(); V3.sub(z, eye, center); V3.normalize(z, z);
    const x = V3.create(); V3.cross(x, up, z); V3.normalize(x, x);
    const y = V3.create(); V3.cross(y, z, x);
    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -V3.dot(x, eye); out[13] = -V3.dot(y, eye); out[14] = -V3.dot(z, eye); out[15] = 1;
    return out;
  },
  perspectiveZO(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[11] = -1;
    out[10] = far / (near - far);
    out[14] = (far * near) / (near - far);
    return out;
  },
  perspectiveOffCenterZO(out, left, right, bottom, top, near, far) {
    out.fill(0);
    out[0] = (2 * near) / (right - left);
    out[5] = (2 * near) / (top - bottom);
    out[8] = (right + left) / (right - left);
    out[9] = (top + bottom) / (top - bottom);
    out[10] = far / (near - far);
    out[11] = -1;
    out[14] = (far * near) / (near - far);
    return out;
  },
  normalFromModel(out, model) {
    if (!M4.invert(out, model)) return M4.identity(out);
    return M4.transpose(out, out);
  },
};

function composeTRS(pos = [0,0,0], rot = [0,0,0], scale = [1,1,1]) {
  const out = M4.create();
  return M4.fromTRS(out, pos, rot, scale);
}

function matrixFromYToDirection(start, end, radius = 1) {
  const dir = V3.create(); V3.sub(dir, end, start);
  const length = V3.len(dir); V3.normalize(dir, dir);
  let tangent = V3.create(1,0,0);
  if (Math.abs(V3.dot(tangent, dir)) > 0.95) tangent = V3.create(0,0,1);
  const z = V3.create(); V3.cross(z, tangent, dir); V3.normalize(z, z);
  const x = V3.create(); V3.cross(x, dir, z); V3.normalize(x, x);
  const mid = V3.create((start[0] + end[0]) * .5, (start[1] + end[1]) * .5, (start[2] + end[2]) * .5);
  const out = M4.create();
  out[0] = x[0] * radius; out[1] = x[1] * radius; out[2] = x[2] * radius; out[3] = 0;
  out[4] = dir[0] * length; out[5] = dir[1] * length; out[6] = dir[2] * length; out[7] = 0;
  out[8] = z[0] * radius; out[9] = z[1] * radius; out[10] = z[2] * radius; out[11] = 0;
  out[12] = mid[0]; out[13] = mid[1]; out[14] = mid[2]; out[15] = 1;
  return out;
}

function faceNormal(a, b, c) {
  const ab = V3.create(); const ac = V3.create(); const n = V3.create();
  V3.sub(ab, b, a); V3.sub(ac, c, a); V3.cross(n, ab, ac); V3.normalize(n, n); return n;
}

function geometryFromFaces(points, faces) {
  const vertices = [];
  const indices = [];
  let idx = 0;
  for (const face of faces) {
    const normal = faceNormal(points[face[0]], points[face[1]], points[face[2]]);
    const uvs = face.length === 4 ? [[0,0],[1,0],[1,1],[0,1]] : face.map((_, i) => [i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
    const base = idx;
    face.forEach((pi, i) => {
      const p = points[pi]; const uv = uvs[i];
      vertices.push(p[0], p[1], p[2], normal[0], normal[1], normal[2], uv[0], uv[1]);
      idx++;
    });
    if (face.length === 4) indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else indices.push(base, base + 1, base + 2);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function makeBoxGeometry() {
  const p = [
    [-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],
    [-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],
  ];
  return geometryFromFaces(p, [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]);
}

function makeWedgeGeometry(frontTop = 0.33, rearTop = 0.46) {
  const p = [
    [-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],
    [-frontTop,.5,-.42],[frontTop,.5,-.42],[rearTop,.5,.42],[-rearTop,.5,.42],
  ];
  return geometryFromFaces(p, [[0,1,2,3],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2],[4,7,6,5]]);
}

function makeCylinderGeometry(segments = 24, radiusTop = .5, radiusBottom = .5) {
  const vertices = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * TAU;
    const c = Math.cos(t), s = Math.sin(t);
    const slope = radiusBottom - radiusTop;
    const n = V3.create(c, slope, s); V3.normalize(n, n);
    vertices.push(radiusBottom * c, -.5, radiusBottom * s, n[0], n[1], n[2], i / segments, 0);
    vertices.push(radiusTop * c, .5, radiusTop * s, n[0], n[1], n[2], i / segments, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a,c,b,b,c,d);
  }
  const bottomCenter = vertices.length / 8;
  vertices.push(0,-.5,0,0,-1,0,.5,.5);
  const topCenter = bottomCenter + 1;
  vertices.push(0,.5,0,0,1,0,.5,.5);
  const bottomStart = vertices.length / 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * TAU, c = Math.cos(t), s = Math.sin(t);
    vertices.push(radiusBottom*c,-.5,radiusBottom*s,0,-1,0,c*.5+.5,s*.5+.5);
    vertices.push(radiusTop*c,.5,radiusTop*s,0,1,0,c*.5+.5,s*.5+.5);
  }
  for (let i = 0; i < segments; i++) {
    const a = bottomStart + i*2, b = a+2;
    indices.push(bottomCenter,b,a);
    const ta = a+1, tb=b+1;
    indices.push(topCenter,ta,tb);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function makeSphereGeometry(segments = 20, rings = 12) {
  const vertices = [];
  const indices = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * TAU;
      const st = Math.sin(theta), ct = Math.cos(theta);
      const px = sp * ct, py = cp, pz = sp * st;
      vertices.push(px*.5, py*.5, pz*.5, px, py, pz, u, v);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y*(segments+1)+x, b=a+segments+1;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

function makeTorusGeometry(segments = 28, tubeSegments = 10, major = .5, minor = .15) {
  const vertices = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments * TAU;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= tubeSegments; j++) {
      const v = j / tubeSegments * TAU;
      const cv = Math.cos(v), sv = Math.sin(v);
      const r = major + minor * cv;
      const x = r * cu, y = minor * sv, z = r * su;
      const nx = cv * cu, ny = sv, nz = cv * su;
      vertices.push(x,y,z,nx,ny,nz,i/segments,j/tubeSegments);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < tubeSegments; j++) {
      const a = i*(tubeSegments+1)+j;
      const b = (i+1)*(tubeSegments+1)+j;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  }
  return { vertices:new Float32Array(vertices), indices:new Uint32Array(indices) };
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  const a = hash2(ix,iy), b=hash2(ix+1,iy), c=hash2(ix,iy+1), d=hash2(ix+1,iy+1);
  return lerp(lerp(a,b,ux),lerp(c,d,ux),uy);
}

function fbm2D(x,y) {
  let sum=0, amp=.5, freq=1;
  for(let i=0;i<5;i++){ sum += valueNoise2D(x*freq,y*freq)*amp; freq*=2.03; amp*=.48; }
  return sum;
}

function groundHeight(x,z) {
  const dunes = (fbm2D(x*.055,z*.055)-.5)*.7 + (fbm2D(x*.22+9,z*.22-4)-.5)*.12;
  const leftTrack = Math.exp(-Math.pow((x+1.55)/.24,2));
  const rightTrack = Math.exp(-Math.pow((x-1.55)/.24,2));
  const trackExtent = smoothstep(13,10,Math.abs(z));
  const cleats = .018*Math.sin(z*16) * (leftTrack+rightTrack);
  return dunes - .085*(leftTrack+rightTrack)*trackExtent + cleats;
}

function makeGroundGeometry(size = 56, segments = 112) {
  const vertices=[]; const indices=[];
  const eps=.08;
  for(let iz=0; iz<=segments; iz++){
    const z=(iz/segments-.5)*size;
    for(let ix=0; ix<=segments; ix++){
      const x=(ix/segments-.5)*size;
      const y=groundHeight(x,z);
      const dx=groundHeight(x+eps,z)-groundHeight(x-eps,z);
      const dz=groundHeight(x,z+eps)-groundHeight(x,z-eps);
      const n=V3.create(-dx,2*eps,-dz); V3.normalize(n,n);
      vertices.push(x,y,z,n[0],n[1],n[2],ix/segments,iz/segments);
    }
  }
  for(let z=0;z<segments;z++){
    for(let x=0;x<segments;x++){
      const a=z*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
  }
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}

function makeQuadGeometry() {
  return {
    vertices: new Float32Array([
      -.5,-.5,0, 0,0,1, 0,1,
       .5,-.5,0, 0,0,1, 1,1,
       .5, .5,0, 0,0,1, 1,0,
      -.5, .5,0, 0,0,1, 0,0,
    ]),
    indices:new Uint32Array([0,1,2,0,2,3]),
  };
}

function computeGeometryRadius(data) {
  let r2=0;
  for(let i=0;i<data.vertices.length;i+=8){
    const x=data.vertices[i],y=data.vertices[i+1],z=data.vertices[i+2];
    r2=Math.max(r2,x*x+y*y+z*z);
  }
  return Math.sqrt(r2);
}


const MAIN_SHADER = /* wgsl */`
struct Globals {
  viewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  lightViewProj: mat4x4<f32>,
  cameraPosTime: vec4<f32>,
  sunDirIntensity: vec4<f32>,
  sunColor: vec4<f32>,
  envTop: vec4<f32>,
  envHorizon: vec4<f32>,
  envGround: vec4<f32>,
  pointPos0: vec4<f32>,
  pointColor0: vec4<f32>,
  pointPos1: vec4<f32>,
  pointColor1: vec4<f32>,
  pointPos2: vec4<f32>,
  pointColor2: vec4<f32>,
  renderParams: vec4<f32>,
};

struct InstanceData {
  model: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  tint: vec4<f32>,
  flags: vec4<f32>,
};

struct MaterialData {
  baseColor: vec4<f32>,
  emissive: vec4<f32>,
  surface: vec4<f32>,
};

@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var shadowTexture: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(1) @binding(0) var<storage, read> instances: array<InstanceData>;
@group(2) @binding(0) var<uniform> material: MaterialData;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) tint: vec4<f32>,
  @location(4) flags: vec4<f32>,
  @location(5) lightClip: vec4<f32>,
};

@vertex
fn vsMain(input: VertexInput) -> VertexOutput {
  let inst = instances[input.instanceIndex];
  let world = inst.model * vec4<f32>(input.position, 1.0);
  var output: VertexOutput;
  output.position = globals.viewProj * world;
  output.worldPos = world.xyz;
  output.worldNormal = normalize((inst.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  output.tint = inst.tint;
  output.flags = inst.flags;
  output.lightClip = globals.lightViewProj * world;
  return output;
}

fn hash31(p: vec3<f32>) -> f32 {
  let q = fract(p * 0.1031);
  let d = dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z + d);
}

fn distributionGGX(nDotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = nDotH * nDotH * (a2 - 1.0) + 1.0;
  return a2 / max(3.14159265 * denom * denom, 0.0001);
}

fn geometrySchlickGGX(nDotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.0001);
}

fn geometrySmith(nDotV: f32, nDotL: f32, roughness: f32) -> f32 {
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

fn fresnelSchlick(cosTheta: f32, f0: vec3<f32>) -> vec3<f32> {
  return f0 + (vec3<f32>(1.0) - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn shadowFactor(lightClip: vec4<f32>, normal: vec3<f32>, lightDir: vec3<f32>) -> f32 {
  let ndc = lightClip.xyz / lightClip.w;
  let uv = vec2<f32>(ndc.x * 0.5 + 0.5, -ndc.y * 0.5 + 0.5);
  let inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0 && ndc.z >= 0.0 && ndc.z <= 1.0;
  let dims = vec2<f32>(textureDimensions(shadowTexture));
  let texel = 1.0 / dims;
  let safeUv = clamp(uv, texel * 1.5, vec2<f32>(1.0) - texel * 1.5);
  let bias = max(0.00045 * (1.0 - dot(normal, lightDir)), 0.00008);
  var sum = 0.0;
  for (var x = -1; x <= 1; x = x + 1) {
    for (var y = -1; y <= 1; y = y + 1) {
      let offset = vec2<f32>(f32(x), f32(y)) * texel;
      sum += textureSampleCompareLevel(shadowTexture, shadowSampler, safeUv + offset, ndc.z - bias);
    }
  }
  return select(1.0, mix(0.28, 1.0, sum / 9.0), inside);
}

fn lightContribution(
  baseColor: vec3<f32>, metallic: f32, roughness: f32,
  n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, radiance: vec3<f32>
) -> vec3<f32> {
  let h = normalize(v + l);
  let nDotL = max(dot(n, l), 0.0);
  let nDotV = max(dot(n, v), 0.001);
  let nDotH = max(dot(n, h), 0.0);
  let hDotV = max(dot(h, v), 0.0);
  let f0 = mix(vec3<f32>(0.04), baseColor, metallic);
  let f = fresnelSchlick(hDotV, f0);
  let d = distributionGGX(nDotH, roughness);
  let g = geometrySmith(nDotV, nDotL, roughness);
  let specular = (d * g * f) / max(4.0 * nDotV * nDotL, 0.001);
  let kd = (vec3<f32>(1.0) - f) * (1.0 - metallic);
  let diffuse = kd * baseColor / 3.14159265;
  return (diffuse + specular) * radiance * nDotL;
}

struct FragmentOutput {
  @location(0) color: vec4<f32>,
  @location(1) normalDepth: vec4<f32>,
};

@fragment
fn fsMain(input: VertexOutput) -> FragmentOutput {
  var baseColor = material.baseColor.rgb * input.tint.rgb;
  var roughness = clamp(material.surface.y, 0.055, 1.0);
  let metallic = clamp(material.surface.x, 0.0, 1.0);
  let ao = material.surface.z;
  let kind = material.surface.w;
  let micro = hash31(floor(input.worldPos * 19.0));

  if (kind > 0.5 && kind < 1.5) {
    let sandBands = 0.5 + 0.5 * sin(input.worldPos.x * 0.31 + sin(input.worldPos.z * 0.17));
    let grit = smoothstep(0.82, 1.0, micro);
    baseColor *= 0.84 + 0.16 * sandBands;
    baseColor += vec3<f32>(0.12, 0.08, 0.035) * grit;
    roughness = 0.94;
  } else if (kind > 4.5 && kind < 5.5) {
    let wear = smoothstep(0.83, 1.0, micro) * 0.12;
    baseColor = mix(baseColor, vec3<f32>(0.19, 0.18, 0.14), wear);
  } else if (kind > 5.5 && kind < 6.5) {
    baseColor *= 0.72 + 0.28 * micro;
    roughness = 0.86;
  }

  let n = normalize(input.worldNormal);
  let v = normalize(globals.cameraPosTime.xyz - input.worldPos);
  let sunL = normalize(-globals.sunDirIntensity.xyz);
  let sunShadow = shadowFactor(input.lightClip, n, sunL);
  var lit = lightContribution(baseColor, metallic, roughness, n, v, sunL, globals.sunColor.rgb * globals.sunDirIntensity.w) * sunShadow;

  let pointPositions = array<vec4<f32>, 3>(globals.pointPos0, globals.pointPos1, globals.pointPos2);
  let pointColors = array<vec4<f32>, 3>(globals.pointColor0, globals.pointColor1, globals.pointColor2);
  for (var i = 0; i < 3; i = i + 1) {
    let toLight = pointPositions[i].xyz - input.worldPos;
    let dist = length(toLight);
    let l = toLight / max(dist, 0.001);
    let radius = max(pointPositions[i].w, 0.1);
    let attenuation = pow(clamp(1.0 - dist / radius, 0.0, 1.0), 2.0) / (1.0 + 0.08 * dist * dist);
    lit += lightContribution(baseColor, metallic, roughness, n, v, l, pointColors[i].rgb * pointColors[i].w * attenuation);
  }

  let hemi = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
  let skyAmbient = mix(globals.envGround.rgb, globals.envTop.rgb, hemi);
  let fresnelAmbient = fresnelSchlick(max(dot(n,v),0.0), mix(vec3<f32>(0.04), baseColor, metallic));
  let ambientDiffuse = baseColor * skyAmbient * (0.18 + 0.24 * ao) * (1.0 - metallic);
  let ambientSpec = skyAmbient * fresnelAmbient * (0.12 + 0.28 * (1.0 - roughness));
  let edgeDust = smoothstep(0.68, 0.98, 1.0 - abs(n.y)) * smoothstep(0.7, 1.0, micro) * 0.035;
  var color = lit + ambientDiffuse + ambientSpec + edgeDust * vec3<f32>(0.7,0.48,0.23);
  color += material.emissive.rgb * material.emissive.w;
  color += input.flags.y * vec3<f32>(0.08, 1.45, 1.6);
  color += input.flags.z * vec3<f32>(1.65, 0.65, 0.12) * (0.55 + 0.45 * sin(globals.cameraPosTime.w * 4.0));

  let viewPos = globals.view * vec4<f32>(input.worldPos, 1.0);
  let linearDepth = max(-viewPos.z, 0.001);
  var output: FragmentOutput;
  let alpha = clamp(material.baseColor.a * input.tint.a * input.flags.x, 0.0, 1.0);
  output.color = vec4<f32>(color, alpha);
  output.normalDepth = vec4<f32>(n * 0.5 + 0.5, linearDepth);
  return output;
}
`;

const SHADOW_SHADER = /* wgsl */`
struct Globals {
  viewProj: mat4x4<f32>, view: mat4x4<f32>, invViewProj: mat4x4<f32>, lightViewProj: mat4x4<f32>,
  cameraPosTime: vec4<f32>, sunDirIntensity: vec4<f32>, sunColor: vec4<f32>, envTop: vec4<f32>,
  envHorizon: vec4<f32>, envGround: vec4<f32>, pointPos0: vec4<f32>, pointColor0: vec4<f32>,
  pointPos1: vec4<f32>, pointColor1: vec4<f32>, pointPos2: vec4<f32>, pointColor2: vec4<f32>, renderParams: vec4<f32>,
};
struct InstanceData { model: mat4x4<f32>, normalMatrix: mat4x4<f32>, tint: vec4<f32>, flags: vec4<f32>, };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(1) @binding(0) var<storage, read> instances: array<InstanceData>;
struct VertexInput { @location(0) position: vec3<f32>, @builtin(instance_index) instanceIndex: u32, };
@vertex fn vsShadow(input: VertexInput) -> @builtin(position) vec4<f32> {
  return globals.lightViewProj * instances[input.instanceIndex].model * vec4<f32>(input.position, 1.0);
}
`;

const FULLSCREEN_VERTEX = /* wgsl */`
struct FullscreenOut { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, };
@vertex fn vsFullscreen(@builtin(vertex_index) index: u32) -> FullscreenOut {
  var positions = array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  let p = positions[index];
  var o: FullscreenOut;
  o.position = vec4<f32>(p,0.0,1.0);
  o.uv = vec2<f32>(p.x*0.5+0.5, 1.0-(p.y*0.5+0.5));
  return o;
}
`;

const ACCUM_SHADER = /* wgsl */`${FULLSCREEN_VERTEX}
struct AccumParams { sampleCount: f32, resetFlag: f32, pad0: f32, pad1: f32, };
@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var previousTexture: texture_2d<f32>;
@group(0) @binding(2) var currentTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: AccumParams;
@fragment fn fsAccum(input: FullscreenOut) -> @location(0) vec4<f32> {
  let current = textureSampleLevel(currentTexture, linearSampler, input.uv, 0.0);
  if (params.resetFlag > 0.5 || params.sampleCount <= 1.0) { return current; }
  let previous = textureSampleLevel(previousTexture, linearSampler, input.uv, 0.0);
  return previous + (current - previous) / params.sampleCount;
}
`;

const POST_SHADER = /* wgsl */`${FULLSCREEN_VERTEX}
struct PostParams {
  invViewProj: mat4x4<f32>,
  cameraPos: vec4<f32>,
  resolution: vec4<f32>,
  lens: vec4<f32>,
  tone: vec4<f32>,
  envTop: vec4<f32>,
  envHorizon: vec4<f32>,
  envGround: vec4<f32>,
  sunScreen: vec4<f32>,
  effects: vec4<f32>,
};
@group(0) @binding(0) var linearSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;
@group(0) @binding(2) var gbufferTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: PostParams;

fn luminance(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126,0.7152,0.0722)); }
fn aces(x: vec3<f32>) -> vec3<f32> {
  let a=2.51; let b=0.03; let c=2.43; let d=0.59; let e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), vec3<f32>(0.0), vec3<f32>(1.0));
}
fn skyColor(uv: vec2<f32>) -> vec3<f32> {
  let ndc = vec2<f32>(uv.x*2.0-1.0, 1.0-uv.y*2.0);
  var world = params.invViewProj * vec4<f32>(ndc, 1.0, 1.0);
  world /= world.w;
  let dir = normalize(world.xyz - params.cameraPos.xyz);
  let h = smoothstep(-0.18, 0.72, dir.y);
  var sky = mix(params.envHorizon.rgb, params.envTop.rgb, h);
  let groundMix = 1.0 - smoothstep(-0.42, 0.08, dir.y);
  sky = mix(sky, params.envGround.rgb * 0.46, groundMix);
  let sunDir = normalize(params.sunScreen.xyz);
  let sunDisk = pow(max(dot(dir, -sunDir), 0.0), 950.0) * params.sunScreen.w;
  sky += vec3<f32>(1.0,0.83,0.58) * sunDisk;
  return sky;
}
fn sampleDoF(uv: vec2<f32>, depth: f32) -> vec3<f32> {
  let focus = params.lens.z;
  let aperture = params.lens.w;
  let coc = clamp(abs(depth-focus) / max(depth,0.1) * aperture * 0.75, 0.0, 8.0);
  let px = params.resolution.zw * coc;
  if (coc < 0.35 || params.effects.y < 0.5) { return textureSampleLevel(colorTexture, linearSampler, uv, 0.0).rgb; }
  var sum = textureSampleLevel(colorTexture, linearSampler, uv, 0.0).rgb * 2.0;
  var weight = 2.0;
  let dirs = array<vec2<f32>,12>(
    vec2<f32>(1.0,0.0),vec2<f32>(0.866,0.5),vec2<f32>(0.5,0.866),vec2<f32>(0.0,1.0),
    vec2<f32>(-0.5,0.866),vec2<f32>(-0.866,0.5),vec2<f32>(-1.0,0.0),vec2<f32>(-0.866,-0.5),
    vec2<f32>(-0.5,-0.866),vec2<f32>(0.0,-1.0),vec2<f32>(0.5,-0.866),vec2<f32>(0.866,-0.5)
  );
  for(var i=0;i<12;i=i+1){
    let r = select(0.48, 1.0, (i % 2) == 0);
    sum += textureSampleLevel(colorTexture, linearSampler, uv + dirs[i]*px*r, 0.0).rgb;
    weight += 1.0;
  }
  return sum / weight;
}
fn approximateAO(uv: vec2<f32>, depth: f32, normal: vec3<f32>) -> f32 {
  if (params.effects.x < 0.01) { return 1.0; }
  let px = params.resolution.zw * (2.0 + clamp(depth*0.05,0.0,4.0));
  let offsets = array<vec2<f32>,8>(
    vec2<f32>(1.0,0.0),vec2<f32>(-1.0,0.0),vec2<f32>(0.0,1.0),vec2<f32>(0.0,-1.0),
    vec2<f32>(0.707,0.707),vec2<f32>(-0.707,0.707),vec2<f32>(0.707,-0.707),vec2<f32>(-0.707,-0.707)
  );
  var occ=0.0;
  for(var i=0;i<8;i=i+1){
    let g=textureSampleLevel(gbufferTexture,linearSampler,uv+offsets[i]*px,0.0);
    let delta=depth-g.a;
    let rangeWeight=1.0-smoothstep(0.0,1.4,abs(delta));
    occ += select(0.0, rangeWeight, g.a>0.0 && delta>0.025);
  }
  let normalBias=0.72+0.28*abs(normal.y);
  return clamp(1.0-(occ/8.0)*params.effects.x*normalBias,0.42,1.0);
}
@fragment fn fsPost(input: FullscreenOut) -> @location(0) vec4<f32> {
  let g = textureSampleLevel(gbufferTexture, linearSampler, input.uv, 0.0);
  var color: vec3<f32>;
  if (g.a <= 0.0001) {
    color = skyColor(input.uv);
  } else {
    let normal = normalize(g.rgb*2.0-1.0);
    color = sampleDoF(input.uv, g.a);
    color *= approximateAO(input.uv,g.a,normal);
  }
  color *= exp2(params.tone.x);
  if (params.tone.z < 0.5) { color = clamp(color,vec3<f32>(0.0),vec3<f32>(1.0)); }
  else if (params.tone.z < 1.5) { color = color/(vec3<f32>(1.0)+color); }
  else { color = aces(color); }
  color = pow(max(color,vec3<f32>(0.0)), vec3<f32>(1.0/max(params.tone.y,0.01)));
  let vignette = pow(clamp(16.0*input.uv.x*input.uv.y*(1.0-input.uv.x)*(1.0-input.uv.y),0.0,1.0),0.16);
  color *= mix(0.72,1.0,vignette);
  let grain = fract(sin(dot(input.uv*params.resolution.xy+params.cameraPos.ww,vec2<f32>(12.9898,78.233)))*43758.5453)-0.5;
  color += grain * params.effects.z / 255.0;
  color = pow(clamp(color,vec3<f32>(0.0),vec3<f32>(1.0)),vec3<f32>(1.0/2.2));
  return vec4<f32>(color,1.0);
}
`;

const PARTICLE_COMPUTE_SHADER = /* wgsl */`
struct Particle { positionLife: vec4<f32>, velocityMaxLife: vec4<f32>, };
struct ParticleParams { dt: f32, time: f32, intensity: f32, wind: f32, };
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: ParticleParams;
fn hash(v:u32)->f32 { var x=v; x=((x>>16u)^x)*0x45d9f3bu; x=((x>>16u)^x)*0x45d9f3bu; x=(x>>16u)^x; return f32(x)/4294967295.0; }
@compute @workgroup_size(64)
fn csMain(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x;
  if(i>=arrayLength(&particles)){return;}
  var p=particles[i];
  var life=p.positionLife.w-params.dt;
  if(life<=0.0){
    let seed=i+u32(params.time*41.0);
    let r0=hash(seed*17u+3u); let r1=hash(seed*31u+7u); let r2=hash(seed*47u+11u); let r3=hash(seed*71u+13u);
    let track=select(0.0,1.0,(i%5u)==0u || (i%7u)==0u);
    let side=select(-1.0,1.0,(i%2u)==0u);
    let ambientPos=vec3<f32>((r0-0.5)*26.0,0.15+r1*5.5,(r2-0.5)*24.0);
    let trackPos=vec3<f32>(side*(1.55+r0*0.38),(0.08+r1*0.38),(r2-0.5)*7.2);
    let pos=mix(ambientPos,trackPos,track);
    let ambientVel=vec3<f32>((r1-0.5)*0.05,0.018+r2*0.035,(r3-0.5)*0.05);
    let trackVel=vec3<f32>(side*(0.18+r1*0.24),0.18+r2*0.32,(r3-0.5)*0.25);
    let maxLife=mix(7.0+r3*8.0,1.2+r3*2.4,track);
    p.positionLife=vec4<f32>(pos,maxLife);
    p.velocityMaxLife=vec4<f32>(mix(ambientVel,trackVel,track),maxLife);
    life=maxLife;
  } else {
    var velocity=p.velocityMaxLife.xyz;
    velocity.x += params.wind*params.dt*0.015;
    velocity.y += 0.006*params.dt;
    velocity *= pow(0.992,params.dt*60.0);
    let nextPosition=p.positionLife.xyz+velocity*params.dt;
    p.positionLife=vec4<f32>(nextPosition,life);
    p.velocityMaxLife=vec4<f32>(velocity,p.velocityMaxLife.w);
  }
  particles[i]=p;
}
`;

const PARTICLE_RENDER_SHADER = /* wgsl */`
struct Globals {
  viewProj: mat4x4<f32>, view: mat4x4<f32>, invViewProj: mat4x4<f32>, lightViewProj: mat4x4<f32>,
  cameraPosTime: vec4<f32>, sunDirIntensity: vec4<f32>, sunColor: vec4<f32>, envTop: vec4<f32>,
  envHorizon: vec4<f32>, envGround: vec4<f32>, pointPos0: vec4<f32>, pointColor0: vec4<f32>,
  pointPos1: vec4<f32>, pointColor1: vec4<f32>, pointPos2: vec4<f32>, pointColor2: vec4<f32>, renderParams: vec4<f32>,
};
struct Particle { positionLife: vec4<f32>, velocityMaxLife: vec4<f32>, };
struct ParticleParams { right: vec4<f32>, up: vec4<f32>, intensity: f32, size: f32, pad0: f32, pad1: f32, };
@group(0) @binding(0) var<uniform> globals: Globals;
@group(1) @binding(0) var<storage, read> particles: array<Particle>;
@group(1) @binding(1) var<uniform> params: ParticleParams;
struct Out { @builtin(position) position:vec4<f32>, @location(0) uv:vec2<f32>, @location(1) alpha:f32, @location(2) tint:vec3<f32>, };
@vertex fn vsParticle(@builtin(vertex_index) vertexIndex:u32,@builtin(instance_index) instanceIndex:u32)->Out{
  let corners=array<vec2<f32>,6>(vec2<f32>(-1.0,-1.0),vec2<f32>(1.0,-1.0),vec2<f32>(1.0,1.0),vec2<f32>(-1.0,-1.0),vec2<f32>(1.0,1.0),vec2<f32>(-1.0,1.0));
  let p=particles[instanceIndex];
  let lifeRatio=clamp(p.positionLife.w/max(p.velocityMaxLife.w,0.001),0.0,1.0);
  let corner=corners[vertexIndex];
  let size=params.size*(0.45+0.9*(1.0-lifeRatio));
  let world=p.positionLife.xyz+(params.right.xyz*corner.x+params.up.xyz*corner.y)*size;
  var o:Out; o.position=globals.viewProj*vec4<f32>(world,1.0); o.uv=corner*0.5+0.5;
  o.alpha=params.intensity*4.0*lifeRatio*(1.0-lifeRatio+0.08);
  o.tint=mix(vec3<f32>(0.50,0.39,0.25),vec3<f32>(0.82,0.67,0.43),lifeRatio);
  return o;
}
@fragment fn fsParticle(input:Out)->@location(0) vec4<f32>{
  let d=length(input.uv-vec2<f32>(0.5));
  let a=(1.0-smoothstep(0.08,0.5,d))*input.alpha;
  return vec4<f32>(input.tint,a);
}
`;

class GpuGeometry {
  constructor(device, name, data) {
    this.name = name;
    this.indexCount = data.indices.length;
    this.radius = computeGeometryRadius(data);
    this.vertexBuffer = device.createBuffer({
      label: `${name}-vertices`, size: Math.ceil(data.vertices.byteLength / 4) * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(data.vertices);
    this.vertexBuffer.unmap();
    this.indexBuffer = device.createBuffer({
      label: `${name}-indices`, size: Math.ceil(data.indices.byteLength / 4) * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(this.indexBuffer.getMappedRange()).set(data.indices);
    this.indexBuffer.unmap();
  }
}

class RenderBatch {
  constructor(renderer, name, geometry, material, options = {}) {
    this.renderer = renderer;
    this.name = name;
    this.geometry = geometry;
    this.material = material;
    this.isTransparent = Boolean(options.transparent || material.baseColor[3] < 0.995);
    this.castShadow = options.castShadow !== false;
    this.instances = [];
    this.visibleInstances = [];
    this.capacity = 0;
    this.instanceBuffer = null;
    this.instanceBindGroup = null;
    this.materialBuffer = renderer.device.createBuffer({
      label: `${name}-material`, size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.materialBindGroup = renderer.device.createBindGroup({
      label: `${name}-material-bg`, layout: renderer.materialLayout,
      entries: [{ binding: 0, resource: { buffer: this.materialBuffer } }],
    });
    this.writeMaterial();
  }
  writeMaterial() {
    const data = new Float32Array(12);
    data.set(this.material.baseColor, 0);
    data.set(this.material.emissive || [0,0,0,0], 4);
    data.set([this.material.metallic ?? .1, this.material.roughness ?? .7, this.material.ao ?? 1, this.material.kind ?? 0], 8);
    this.renderer.device.queue.writeBuffer(this.materialBuffer, 0, data);
  }
  ensureCapacity(count) {
    if (count <= this.capacity) return;
    this.capacity = Math.max(8, 2 ** Math.ceil(Math.log2(count)));
    this.instanceBuffer?.destroy();
    this.instanceBuffer = this.renderer.device.createBuffer({
      label: `${this.name}-instances`, size: this.capacity * 160,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.instanceBindGroup = this.renderer.device.createBindGroup({
      label: `${this.name}-instance-bg`, layout: this.renderer.instanceLayout,
      entries: [{ binding: 0, resource: { buffer: this.instanceBuffer } }],
    });
  }
  update(instanceRecords) {
    this.visibleInstances = instanceRecords;
    this.ensureCapacity(instanceRecords.length);
    if (!instanceRecords.length) return;
    const packed = new Float32Array(instanceRecords.length * 40);
    instanceRecords.forEach((record, i) => {
      const offset = i * 40;
      packed.set(record.modelMatrix, offset);
      packed.set(record.normalMatrix, offset + 16);
      packed.set(record.tint, offset + 32);
      packed.set(record.meta, offset + 36);
    });
    this.renderer.device.queue.writeBuffer(this.instanceBuffer, 0, packed);
  }
}

class WebGPURenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = null;
    this.adapter = null;
    this.device = null;
    this.format = null;
    this.width = 1;
    this.height = 1;
    this.renderScale = 1;
    this.geometries = new Map();
    this.batches = [];
    this.sampleCount = 0;
    this.accumRead = 0;
    this.shadowDirty = true;
    this.stats = { drawCalls: 0, instances: 0 };
    this.particleCount = 4096;
    this._postBindGroups = [];
    this._accumBindGroups = [];
  }

  async init(onStep = () => {}) {
    if (!navigator.gpu) throw new Error('navigator.gpu 不存在；浏览器未启用 WebGPU。');
    onStep('请求高性能 GPU 适配器…');
    this.adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!this.adapter) throw new Error('未找到可用 WebGPU 适配器。');
    onStep('创建 WebGPU Device 与命令队列…');
    this.device = await this.adapter.requestDevice();
    this.device.addEventListener('uncapturederror', (event) => {
      console.error('WebGPU uncaptured error:', event.error);
      window.dispatchEvent(new CustomEvent('vt4-gpu-error', { detail: event.error }));
    });
    this.device.lost.then((info) => {
      console.error('WebGPU device lost:', info);
      window.dispatchEvent(new CustomEvent('vt4-device-lost', { detail: info }));
    });
    this.context = this.canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    onStep('编译 PBR、阴影、累积与粒子着色器…');
    this.device.pushErrorScope('validation');
    this.createLayouts();
    this.createPipelines();
    this.createGlobalResources();
    this.createShadowResources();
    this.createParticleResources();
    this.resize(1, 1, 1, true);
    const validationError = await this.device.popErrorScope();
    if (validationError) throw new Error(`WebGPU 管线验证失败：${validationError.message}`);
    onStep('WebGPU 管线就绪');
  }

  createLayouts() {
    const d = this.device;
    this.globalLayout = d.createBindGroupLayout({
      label: 'global-layout', entries: [
        { binding:0, visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT, buffer:{ type:'uniform' } },
        { binding:1, visibility:GPUShaderStage.FRAGMENT, texture:{ sampleType:'depth' } },
        { binding:2, visibility:GPUShaderStage.FRAGMENT, sampler:{ type:'comparison' } },
      ],
    });
    this.instanceLayout = d.createBindGroupLayout({
      label:'instance-layout', entries:[
        { binding:0, visibility:GPUShaderStage.VERTEX, buffer:{ type:'read-only-storage' } },
      ],
    });
    this.shadowGlobalLayout = d.createBindGroupLayout({
      label:'shadow-global-layout', entries:[
        { binding:0, visibility:GPUShaderStage.VERTEX, buffer:{ type:'uniform' } },
      ],
    });
    this.materialLayout = d.createBindGroupLayout({
      label:'material-layout', entries:[
        { binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{ type:'uniform' } },
      ],
    });
    this.accumLayout = d.createBindGroupLayout({
      label:'accum-layout', entries:[
        {binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
        {binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},
        {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},
        {binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
      ],
    });
    this.postLayout = d.createBindGroupLayout({
      label:'post-layout', entries:[
        {binding:0,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
        {binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},
        {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'float'}},
        {binding:3,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
      ],
    });
    this.particleComputeLayout = d.createBindGroupLayout({
      label:'particle-compute-layout', entries:[
        {binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},
        {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},
      ],
    });
    this.particleRenderLayout = d.createBindGroupLayout({
      label:'particle-render-layout', entries:[
        {binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},
        {binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:'uniform'}},
      ],
    });
  }

  createPipelines() {
    const d=this.device;
    const mainModule=d.createShaderModule({label:'main-shader',code:MAIN_SHADER});
    const shadowModule=d.createShaderModule({label:'shadow-shader',code:SHADOW_SHADER});
    const vertexBuffers=[{arrayStride:32,attributes:[
      {shaderLocation:0,offset:0,format:'float32x3'},
      {shaderLocation:1,offset:12,format:'float32x3'},
      {shaderLocation:2,offset:24,format:'float32x2'},
    ]}];
    const mainLayout=d.createPipelineLayout({bindGroupLayouts:[this.globalLayout,this.instanceLayout,this.materialLayout]});
    this.opaquePipeline=d.createRenderPipeline({
      label:'opaque-pbr-pipeline',layout:mainLayout,
      vertex:{module:mainModule,entryPoint:'vsMain',buffers:vertexBuffers},
      fragment:{module:mainModule,entryPoint:'fsMain',targets:[{format:'rgba16float'},{format:'rgba16float'}]},
      primitive:{topology:'triangle-list',cullMode:'none'},
      depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},
    });
    this.transparentPipeline=d.createRenderPipeline({
      label:'transparent-pbr-pipeline',layout:mainLayout,
      vertex:{module:mainModule,entryPoint:'vsMain',buffers:vertexBuffers},
      fragment:{module:mainModule,entryPoint:'fsMain',targets:[
        {format:'rgba16float',blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}},
        {format:'rgba16float',writeMask:0},
      ]},
      primitive:{topology:'triangle-list',cullMode:'none'},
      depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'},
    });
    this.shadowPipeline=d.createRenderPipeline({
      label:'shadow-pipeline',layout:d.createPipelineLayout({bindGroupLayouts:[this.shadowGlobalLayout,this.instanceLayout]}),
      vertex:{module:shadowModule,entryPoint:'vsShadow',buffers:vertexBuffers},
      primitive:{topology:'triangle-list',cullMode:'none'},
      depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'},
    });
    const accumModule=d.createShaderModule({label:'accum-shader',code:ACCUM_SHADER});
    this.accumPipeline=d.createRenderPipeline({
      label:'accum-pipeline',layout:d.createPipelineLayout({bindGroupLayouts:[this.accumLayout]}),
      vertex:{module:accumModule,entryPoint:'vsFullscreen'},
      fragment:{module:accumModule,entryPoint:'fsAccum',targets:[{format:'rgba16float'}]},
      primitive:{topology:'triangle-list'},
    });
    const postModule=d.createShaderModule({label:'post-shader',code:POST_SHADER});
    this.postPipeline=d.createRenderPipeline({
      label:'post-pipeline',layout:d.createPipelineLayout({bindGroupLayouts:[this.postLayout]}),
      vertex:{module:postModule,entryPoint:'vsFullscreen'},
      fragment:{module:postModule,entryPoint:'fsPost',targets:[{format:this.format}]},
      primitive:{topology:'triangle-list'},
    });
    const pcModule=d.createShaderModule({label:'particle-compute',code:PARTICLE_COMPUTE_SHADER});
    this.particleComputePipeline=d.createComputePipeline({
      label:'particle-compute-pipeline',layout:d.createPipelineLayout({bindGroupLayouts:[this.particleComputeLayout]}),
      compute:{module:pcModule,entryPoint:'csMain'},
    });
    const prModule=d.createShaderModule({label:'particle-render',code:PARTICLE_RENDER_SHADER});
    this.particleRenderPipeline=d.createRenderPipeline({
      label:'particle-render-pipeline',layout:d.createPipelineLayout({bindGroupLayouts:[this.globalLayout,this.particleRenderLayout]}),
      vertex:{module:prModule,entryPoint:'vsParticle'},
      fragment:{module:prModule,entryPoint:'fsParticle',targets:[
        {format:'rgba16float',blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha',operation:'add'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}}},
        {format:'rgba16float',writeMask:0},
      ]},
      primitive:{topology:'triangle-list'},
      depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'less-equal'},
    });
  }

  createGlobalResources() {
    const d=this.device;
    this.globalBuffer=d.createBuffer({label:'global-buffer',size:464,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.shadowGlobalBindGroup=d.createBindGroup({
      label:'shadow-global-bind-group',layout:this.shadowGlobalLayout,
      entries:[{binding:0,resource:{buffer:this.globalBuffer}}],
    });
    this.linearSampler=d.createSampler({magFilter:'linear',minFilter:'linear',mipmapFilter:'linear'});
    this.accumParamsBuffer=d.createBuffer({label:'accum-params',size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.postParamsBuffer=d.createBuffer({label:'post-params',size:224,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  }

  createShadowResources() {
    const d=this.device;
    this.shadowSize=Math.min(1536,d.limits.maxTextureDimension2D);
    this.shadowTexture=d.createTexture({
      label:'shadow-map',size:[this.shadowSize,this.shadowSize],format:'depth32float',
      usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,
    });
    this.shadowSampler=d.createSampler({compare:'less',magFilter:'linear',minFilter:'linear'});
    this.globalBindGroup=d.createBindGroup({
      label:'global-bind-group',layout:this.globalLayout,entries:[
        {binding:0,resource:{buffer:this.globalBuffer}},
        {binding:1,resource:this.shadowTexture.createView()},
        {binding:2,resource:this.shadowSampler},
      ],
    });
  }

  createParticleResources() {
    const d=this.device;
    this.particleBuffer=d.createBuffer({
      label:'particles',size:this.particleCount*32,
      usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST,
    });
    const seedData=new Float32Array(this.particleCount*8);
    for(let i=0;i<this.particleCount;i++){
      seedData[i*8+0]=(hash1(i*3.1)-.5)*20;
      seedData[i*8+1]=hash1(i*7.7)*4+.1;
      seedData[i*8+2]=(hash1(i*5.3)-.5)*20;
      seedData[i*8+3]=-hash1(i*9.1)*8;
      seedData[i*8+4]=(hash1(i*2.4)-.5)*.05;
      seedData[i*8+5]=.02+hash1(i*4.8)*.04;
      seedData[i*8+6]=(hash1(i*8.2)-.5)*.05;
      seedData[i*8+7]=5+hash1(i*11.7)*8;
    }
    d.queue.writeBuffer(this.particleBuffer,0,seedData);
    this.particleComputeParams=d.createBuffer({label:'particle-compute-params',size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.particleRenderParams=d.createBuffer({label:'particle-render-params',size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.particleComputeBindGroup=d.createBindGroup({
      layout:this.particleComputeLayout,entries:[
        {binding:0,resource:{buffer:this.particleBuffer}},
        {binding:1,resource:{buffer:this.particleComputeParams}},
      ],
    });
    this.particleRenderBindGroup=d.createBindGroup({
      layout:this.particleRenderLayout,entries:[
        {binding:0,resource:{buffer:this.particleBuffer}},
        {binding:1,resource:{buffer:this.particleRenderParams}},
      ],
    });
  }

  createGeometry(name,data){
    const geo=new GpuGeometry(this.device,name,data); this.geometries.set(name,geo); return geo;
  }
  createBatch(name,geometry,material,options={}){
    const batch=new RenderBatch(this,name,geometry,material,options); this.batches.push(batch); return batch;
  }

  resize(cssWidth,cssHeight,dpr=window.devicePixelRatio||1,force=false){
    const maxDim=this.device.limits.maxTextureDimension2D;
    const w=clamp(Math.floor(cssWidth*dpr*this.renderScale),1,maxDim);
    const h=clamp(Math.floor(cssHeight*dpr*this.renderScale),1,maxDim);
    if(!force&&w===this.width&&h===this.height)return false;
    this.width=w; this.height=h; this.canvas.width=w; this.canvas.height=h;
    for(const tex of [this.colorTexture,this.gbufferTexture,this.depthTexture,this.accumTextures?.[0],this.accumTextures?.[1],this.captureTexture]) tex?.destroy();
    const d=this.device;
    this.colorTexture=d.createTexture({label:'hdr-color',size:[w,h],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});
    this.gbufferTexture=d.createTexture({label:'normal-depth',size:[w,h],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    this.depthTexture=d.createTexture({label:'scene-depth',size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
    this.accumTextures=[0,1].map(i=>d.createTexture({label:`accum-${i}`,size:[w,h],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}));
    this.captureTexture=d.createTexture({
      label:'export-capture',size:[w,h],format:this.format,
      usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC,
    });
    this._accumBindGroups=[0,1].map((writeIndex)=>{
      const readIndex=1-writeIndex;
      return d.createBindGroup({layout:this.accumLayout,entries:[
        {binding:0,resource:this.linearSampler},
        {binding:1,resource:this.accumTextures[readIndex].createView()},
        {binding:2,resource:this.colorTexture.createView()},
        {binding:3,resource:{buffer:this.accumParamsBuffer}},
      ]});
    });
    this._postBindGroups=[
      d.createBindGroup({layout:this.postLayout,entries:[
        {binding:0,resource:this.linearSampler},{binding:1,resource:this.colorTexture.createView()},
        {binding:2,resource:this.gbufferTexture.createView()},{binding:3,resource:{buffer:this.postParamsBuffer}},
      ]}),
      ...this.accumTextures.map(tex=>d.createBindGroup({layout:this.postLayout,entries:[
        {binding:0,resource:this.linearSampler},{binding:1,resource:tex.createView()},
        {binding:2,resource:this.gbufferTexture.createView()},{binding:3,resource:{buffer:this.postParamsBuffer}},
      ]})),
    ];
    this.resetAccumulation();
    return true;
  }

  async readCaptureRGBA(){
    const bytesPerPixel=4;
    const unpaddedBytesPerRow=this.width*bytesPerPixel;
    const bytesPerRow=Math.ceil(unpaddedBytesPerRow/256)*256;
    const buffer=this.device.createBuffer({
      label:'export-readback',size:bytesPerRow*this.height,
      usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,
    });
    const encoder=this.device.createCommandEncoder({label:'export-readback-encoder'});
    encoder.copyTextureToBuffer(
      {texture:this.captureTexture},
      {buffer,bytesPerRow,rowsPerImage:this.height},
      {width:this.width,height:this.height,depthOrArrayLayers:1},
    );
    this.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const mapped=new Uint8Array(buffer.getMappedRange());
    const rgba=new Uint8ClampedArray(this.width*this.height*4);
    const bgra=this.format.startsWith('bgra');
    for(let y=0;y<this.height;y++){
      const sourceOffset=y*bytesPerRow;
      const targetOffset=y*unpaddedBytesPerRow;
      if(!bgra){
        rgba.set(mapped.subarray(sourceOffset,sourceOffset+unpaddedBytesPerRow),targetOffset);
      }else{
        for(let x=0;x<this.width;x++){
          const s=sourceOffset+x*4,d=targetOffset+x*4;
          rgba[d]=mapped[s+2];rgba[d+1]=mapped[s+1];rgba[d+2]=mapped[s];rgba[d+3]=mapped[s+3];
        }
      }
    }
    buffer.unmap();buffer.destroy();
    return rgba;
  }

  resetAccumulation(){ this.sampleCount=0; this.accumRead=0; }

  writeGlobals(frame){
    const data=new Float32Array(116);
    data.set(frame.viewProj,0); data.set(frame.view,16); data.set(frame.invViewProj,32); data.set(frame.lightViewProj,48);
    data.set([frame.cameraPos[0],frame.cameraPos[1],frame.cameraPos[2],frame.time],64);
    data.set([frame.sunDir[0],frame.sunDir[1],frame.sunDir[2],frame.sunIntensity],68);
    data.set([...frame.sunColor,1],72);
    data.set([...frame.env.top,1],76); data.set([...frame.env.horizon,1],80); data.set([...frame.env.ground,1],84);
    const points=frame.pointLights;
    data.set([...points[0].position,points[0].radius],88); data.set([...points[0].color,points[0].intensity],92);
    data.set([...points[1].position,points[1].radius],96); data.set([...points[1].color,points[1].intensity],100);
    data.set([...points[2].position,points[2].radius],104); data.set([...points[2].color,points[2].intensity],108);
    data.set([frame.xray?1:0,frame.environmentIndex||0,0,0],112);
    this.device.queue.writeBuffer(this.globalBuffer,0,data);
  }

  writePostParams(frame){
    const data=new Float32Array(56);
    data.set(frame.invViewProj,0);
    data.set([frame.cameraPos[0],frame.cameraPos[1],frame.cameraPos[2],frame.time],16);
    data.set([this.width,this.height,1/this.width,1/this.height],20);
    data.set([frame.near,frame.far,frame.focusDistance,frame.apertureStrength],24);
    const toneType=frame.toneMapping==='linear'?0:frame.toneMapping==='reinhard'?1:2;
    data.set([frame.exposure,frame.contrast,toneType,0],28);
    data.set([...frame.env.top,1],32); data.set([...frame.env.horizon,1],36); data.set([...frame.env.ground,1],40);
    data.set([frame.sunDir[0],frame.sunDir[1],frame.sunDir[2],frame.env.sunDisk||1],44);
    data.set([frame.aoIntensity,frame.dofEnabled?1:0,frame.grain||0,frame.accumulating?1:0],48);
    this.device.queue.writeBuffer(this.postParamsBuffer,0,data);
  }

  updateParticles(encoder,frame){
    const computeData=new Float32Array([Math.min(frame.dt,.05),frame.time,frame.dustIntensity,frame.env.wind||0]);
    this.device.queue.writeBuffer(this.particleComputeParams,0,computeData);
    const renderData=new Float32Array(12);
    renderData.set([...frame.cameraRight,0],0); renderData.set([...frame.cameraUp,0],4);
    renderData.set([frame.dustIntensity,.16,0,0],8);
    this.device.queue.writeBuffer(this.particleRenderParams,0,renderData);
    const pass=encoder.beginComputePass({label:'particle-compute-pass'});
    pass.setPipeline(this.particleComputePipeline); pass.setBindGroup(0,this.particleComputeBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.particleCount/64)); pass.end();
  }

  renderShadow(encoder){
    if(!this.shadowDirty)return;
    const pass=encoder.beginRenderPass({label:'shadow-pass',colorAttachments:[],depthStencilAttachment:{
      view:this.shadowTexture.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store',
    }});
    pass.setPipeline(this.shadowPipeline); pass.setBindGroup(0,this.shadowGlobalBindGroup);
    for(const batch of this.batches){
      if(!batch.castShadow||!batch.visibleInstances.length)continue;
      pass.setBindGroup(1,batch.instanceBindGroup);
      pass.setVertexBuffer(0,batch.geometry.vertexBuffer); pass.setIndexBuffer(batch.geometry.indexBuffer,'uint32');
      pass.drawIndexed(batch.geometry.indexCount,batch.visibleInstances.length);
    }
    pass.end(); this.shadowDirty=false;
  }

  drawBatches(pass,batches,pipeline){
    pass.setPipeline(pipeline); pass.setBindGroup(0,this.globalBindGroup);
    for(const batch of batches){
      if(!batch.visibleInstances.length)continue;
      pass.setBindGroup(1,batch.instanceBindGroup); pass.setBindGroup(2,batch.materialBindGroup);
      pass.setVertexBuffer(0,batch.geometry.vertexBuffer); pass.setIndexBuffer(batch.geometry.indexBuffer,'uint32');
      pass.drawIndexed(batch.geometry.indexCount,batch.visibleInstances.length);
      this.stats.drawCalls++; this.stats.instances+=batch.visibleInstances.length;
    }
  }

  render(frame,{accumulate=false,particles=true,capture=false}={}){
    this.writeGlobals(frame); this.writePostParams({...frame,accumulating:accumulate});
    const encoder=this.device.createCommandEncoder({label:'frame-encoder'});
    if(particles)this.updateParticles(encoder,frame);
    this.renderShadow(encoder);
    const pass=encoder.beginRenderPass({label:'scene-pass',colorAttachments:[
      {view:this.colorTexture.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store'},
      {view:this.gbufferTexture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'},
    ],depthStencilAttachment:{view:this.depthTexture.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
    this.stats.drawCalls=0; this.stats.instances=0;
    const opaque=this.batches.filter(b=>!b.isTransparent);
    const transparent=this.batches.filter(b=>b.isTransparent);
    this.drawBatches(pass,opaque,this.opaquePipeline);
    this.drawBatches(pass,transparent,this.transparentPipeline);
    if(particles&&frame.dustIntensity>0.001){
      pass.setPipeline(this.particleRenderPipeline); pass.setBindGroup(0,this.globalBindGroup); pass.setBindGroup(1,this.particleRenderBindGroup);
      pass.draw(6,this.particleCount); this.stats.drawCalls++;
    }
    pass.end();

    let postSourceIndex=0;
    if(accumulate){
      const writeIndex=1-this.accumRead;
      const nextSample=this.sampleCount+1;
      this.device.queue.writeBuffer(this.accumParamsBuffer,0,new Float32Array([nextSample,nextSample===1?1:0,0,0]));
      const aPass=encoder.beginRenderPass({label:'accumulation-pass',colorAttachments:[{
        view:this.accumTextures[writeIndex].createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store',
      }]});
      aPass.setPipeline(this.accumPipeline); aPass.setBindGroup(0,this._accumBindGroups[writeIndex]); aPass.draw(3); aPass.end();
      this.accumRead=writeIndex; this.sampleCount=nextSample; postSourceIndex=1+this.accumRead;
    } else {
      this.sampleCount=0; postSourceIndex=0;
    }

    const swapView=(capture?this.captureTexture:this.context.getCurrentTexture()).createView();
    const pPass=encoder.beginRenderPass({label:'post-pass',colorAttachments:[{
      view:swapView,clearValue:{r:0,g:0,b:0,a:1},loadOp:'clear',storeOp:'store',
    }]});
    pPass.setPipeline(this.postPipeline); pPass.setBindGroup(0,this._postBindGroups[postSourceIndex]); pPass.draw(3); pPass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}


class SceneNode {
  constructor(name, parent = null, position = [0,0,0], rotation = [0,0,0], scale = [1,1,1]) {
    this.name=name; this.parent=parent; this.position=[...position]; this.rotation=[...rotation]; this.scale=[...scale];
    this.localMatrix=M4.create(); this.worldMatrix=M4.create(); this.children=[];
    if(parent)parent.children.push(this);
  }
  update(parentWorld=null){
    M4.fromTRS(this.localMatrix,this.position,this.rotation,this.scale);
    if(parentWorld)M4.multiply(this.worldMatrix,parentWorld,this.localMatrix); else M4.copy(this.worldMatrix,this.localMatrix);
    for(const child of this.children)child.update(this.worldMatrix);
  }
}

const MATERIALS = {
  armor: {baseColor:[1,1,1,1],emissive:[0,0,0,0],metallic:.13,roughness:.68,ao:.95,kind:5},
  armorMatte: {baseColor:[1,1,1,1],emissive:[0,0,0,0],metallic:.08,roughness:.82,ao:.95,kind:5},
  steel: {baseColor:[.32,.34,.34,1],emissive:[0,0,0,0],metallic:.72,roughness:.42,ao:.9,kind:0},
  darkSteel: {baseColor:[.16,.18,.18,1],emissive:[0,0,0,0],metallic:.66,roughness:.52,ao:.86,kind:0},
  track: {baseColor:[.21,.205,.18,1],emissive:[0,0,0,0],metallic:.55,roughness:.68,ao:.86,kind:0},
  rubber: {baseColor:[.075,.082,.078,1],emissive:[0,0,0,0],metallic:.02,roughness:.92,ao:.8,kind:6},
  glass: {baseColor:[.12,.28,.32,.72],emissive:[.04,.38,.48,.8],metallic:.25,roughness:.13,ao:1,kind:2},
  glassDark: {baseColor:[.035,.095,.11,.78],emissive:[.02,.18,.23,.65],metallic:.25,roughness:.16,ao:1,kind:2},
  interior: {baseColor:[.39,.47,.35,1],emissive:[0,0,0,0],metallic:.12,roughness:.78,ao:.9,kind:0},
  machinery: {baseColor:[.23,.27,.25,1],emissive:[0,0,0,0],metallic:.45,roughness:.56,ao:.88,kind:0},
  engine: {baseColor:[.19,.27,.22,1],emissive:[0,0,0,0],metallic:.35,roughness:.62,ao:.9,kind:0},
  copper: {baseColor:[.47,.23,.10,1],emissive:[0,0,0,0],metallic:.68,roughness:.35,ao:.9,kind:0},
  ammo: {baseColor:[.42,.28,.12,1],emissive:[0,0,0,0],metallic:.48,roughness:.45,ao:.9,kind:0},
  ammoTip: {baseColor:[.15,.18,.12,1],emissive:[0,0,0,0],metallic:.35,roughness:.62,ao:.9,kind:0},
  screen: {baseColor:[.04,.12,.14,.94],emissive:[.05,.75,.85,1.25],metallic:.1,roughness:.18,ao:1,kind:2},
  light: {baseColor:[.7,.65,.46,.9],emissive:[1,.74,.28,2.2],metallic:.05,roughness:.2,ao:1,kind:2},
  redLight: {baseColor:[.45,.05,.025,.9],emissive:[1,.08,.03,1.8],metallic:.05,roughness:.2,ao:1,kind:2},
  uniform: {baseColor:[.24,.31,.22,1],emissive:[0,0,0,0],metallic:.02,roughness:.93,ao:.95,kind:0},
  helmet: {baseColor:[.13,.17,.14,1],emissive:[0,0,0,0],metallic:.08,roughness:.82,ao:.95,kind:0},
  skin: {baseColor:[.50,.34,.25,1],emissive:[0,0,0,0],metallic:.0,roughness:.96,ao:1,kind:0},
  sand: {baseColor:[.58,.43,.25,1],emissive:[0,0,0,0],metallic:.0,roughness:.98,ao:1,kind:1},
  cable: {baseColor:[.055,.06,.055,1],emissive:[0,0,0,0],metallic:.08,roughness:.88,ao:.85,kind:6},
  whiteMark: {baseColor:[.77,.77,.69,1],emissive:[0,0,0,0],metallic:.02,roughness:.82,ao:1,kind:0},
};

const VARIANT_DATA = {
  standard: {
    label:'VT-4 / STANDARD DEFENCE EXPO', short:'VT-4', confidence:'公开影像稳定可见',
    palette:{primary:[.55,.49,.33,1],secondary:[.30,.36,.26,1],dark:[.15,.18,.14,1],accent:[.67,.56,.36,1]},
    differences:[
      ['FY 系列反应装甲基准布局','首上与炮塔正侧面采用模块化 ERA 的公开展会外观近似。'],
      ['基础型遥控武器站','车长位置上方的轻型 12.7 mm 级 RWS，以公开外观比例重构。'],
      ['标准周视镜与告警器','保留基础全景观瞄和常规光电/告警组件。'],
    ],
  },
  a1: {
    label:'VT-4A1 / APS & UAV UPGRADE', short:'VT-4A1', confidence:'展会报道支持；局部机理推定',
    palette:{primary:[.66,.58,.40,1],secondary:[.36,.43,.30,1],dark:[.18,.20,.15,1],accent:[.76,.66,.44,1]},
    differences:[
      ['四向毫米波雷达阵列','炮塔周向设置 APS 探测面板；阵列尺寸与安装角按展会照片近似。'],
      ['硬杀伤拦截器组件','炮塔两侧布置拦截弹发射组件，用于表达公开报道中的主动防护升级。'],
      ['重型遥控武器站','扩大基座、光电组件与防护罩体量。'],
      ['车载无人机发射管','炮塔顶部设置筒式无人机协同模块；内部机构概念化。'],
      ['顶部附加防护与 LWR','以模块化顶甲和激光告警接收器表达攻顶威胁适配。'],
    ],
  },
  p: {
    label:'VT-4P / HAIDER PHOTO-BASED APPROX.', short:'VT-4P', confidence:'服役照片支持；命名与细节为近似',
    palette:{primary:[.26,.31,.25,1],secondary:[.42,.25,.17,1],dark:[.10,.13,.12,1],accent:[.49,.46,.35,1]},
    differences:[
      ['炮塔侧面混合 ERA 排布','用不同尺寸、倾角与间隙的模块表达巴方车辆公开照片中的侧面特征。'],
      ['首上附加装甲外形调整','改变首上 ERA 模块轮廓及中央分缝。'],
      ['定制裙板与前挡泥板','采用分段裙板、加宽前挡泥板和不同紧固节奏。'],
      ['尾部散热格栅布局','以更密集的矩形格栅和边框表达巴方版本照片差异。'],
    ],
  },
};

class VT4Model {
  constructor(renderer){
    this.renderer=renderer;
    this.root=new SceneNode('vehicle-root');
    this.hullNode=new SceneNode('hull',this.root);
    this.turretNode=new SceneNode('turret',this.root,[0,2.05,-.30]);
    this.gunPivotNode=new SceneNode('gun-pivot',this.turretNode,[0,.32,-1.42]);
    this.crewNodes={};
    this.parts=[];
    this.batchCache=new Map();
    this.variant='standard';
    this.xrayMode='off';
    this.shellAlpha=.18;
    this.explode=0;
    this.diffHighlight=true;
    this.layerVisibility={armor:true,mobility:true,firepower:true,interior:true,crew:true,effects:true};
    this.selectedPart=null;
    this.geometry={};
    this.codeCounter=1;
    this._tmpWorld=M4.create(); this._tmpNormal=M4.create(); this._tmpTranslation=M4.create();
    this.build();
  }

  build(){
    const r=this.renderer;
    this.geometry.box=r.createGeometry('box',makeBoxGeometry());
    this.geometry.wedge=r.createGeometry('wedge',makeWedgeGeometry());
    this.geometry.cylinder=r.createGeometry('cylinder-24',makeCylinderGeometry(24));
    this.geometry.cylinder12=r.createGeometry('cylinder-12',makeCylinderGeometry(12));
    this.geometry.cone=r.createGeometry('cone-20',makeCylinderGeometry(20,0,.5));
    this.geometry.sphere=r.createGeometry('sphere',makeSphereGeometry(20,12));
    this.geometry.torus=r.createGeometry('torus',makeTorusGeometry(30,10,.38,.12));
    this.geometry.ground=r.createGeometry('ground',makeGroundGeometry());
    this.geometry.quad=r.createGeometry('quad',makeQuadGeometry());
    this.buildGround();
    this.buildHull();
    this.buildMobility();
    this.buildTurretAndGun();
    this.buildVariants();
    this.buildInterior();
    this.buildCrew();
    this.root.update();
    this.updateBatches(true);
  }

  getBatch(geoName,materialName,options={}){
    const key=[geoName,materialName,options.shell?'shell':'solid',options.transparent?'transparent':'opaque',options.castShadow===false?'noShadow':'shadow'].join('|');
    if(this.batchCache.has(key))return this.batchCache.get(key);
    const batch=this.renderer.createBatch(key,this.geometry[geoName],structuredClone(MATERIALS[materialName]),options);
    batch.shell=Boolean(options.shell); batch.baseTransparent=Boolean(options.transparent||MATERIALS[materialName].baseColor[3]<.995);
    this.batchCache.set(key,batch); return batch;
  }

  addPart(opts){
    const {
      name,geo='box',material='armor',node=this.root,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],matrix=null,
      tint=[1,1,1,1],paletteRole=null,layer='armor',variants=['standard','a1','p'],shell=false,side='center',
      explode=[0,0,0],confidence='high',system='车体结构',description='',specs={},selectable=true,diff=false,
      transparent=false,castShadow=true,focusRadius=null,
    }=opts;
    const batch=this.getBatch(geo,material,{shell,transparent,castShadow});
    const part={
      id:`part-${this.parts.length+1}`,code:`VT4-${String(this.codeCounter++).padStart(3,'0')}`,name,batch,node,
      localMatrix:matrix?new Float32Array(matrix):composeTRS(pos,rot,scale),tint:new Float32Array(tint),paletteRole,
      layer,variants:new Set(variants),shell,side,explode:new Float32Array(explode),confidence,system,description,specs,
      selectable,diff,focusRadius,worldMatrix:M4.create(),normalMatrix:M4.create(),worldCenter:V3.create(),worldRadius:1,
    };
    this.parts.push(part); batch.instances.push(part); return part;
  }

  addTube(opts){
    const matrix=matrixFromYToDirection(opts.start,opts.end,opts.radius||.04);
    return this.addPart({...opts,geo:opts.geo||'cylinder12',matrix,scale:undefined,pos:undefined,rot:undefined});
  }

  buildGround(){
    this.addPart({name:'程序化沙砾地面',geo:'ground',material:'sand',layer:'effects',selectable:false,castShadow:false,description:'由分形噪声、履带凹槽与周期性履齿压痕共同生成。'});
  }

  buildHull(){
    const shell={shell:true,layer:'armor',system:'车体与防护'};
    this.addPart({...shell,name:'下车体焊接壳体',geo:'box',pos:[0,.83,.05],scale:[3.12,.92,6.35],paletteRole:'dark',explode:[0,-.45,0],description:'承载悬挂与舱室的下车体体量；外形按公开照片比例化重构。',specs:{布局:'前驾驶 / 中战斗 / 后动力',置信:'外观高，内部隔舱示意'}});
    this.addPart({...shell,name:'上车体复合装甲壳',geo:'wedge',pos:[0,1.43,-.38],scale:[3.24,.82,5.55],paletteRole:'primary',explode:[0,.55,0],description:'首上至动力舱盖的程序化楔形壳体。'});
    this.addPart({...shell,name:'首上倾斜装甲基板',geo:'wedge',pos:[0,1.70,-2.55],rot:[-.08,0,0],scale:[3.28,.42,1.52],paletteRole:'primary',explode:[0,.5,-.7],description:'支撑前部附加装甲与 ERA 模块的倾斜基板。'});
    this.addPart({...shell,name:'动力舱顶甲',geo:'box',pos:[0,1.77,2.23],scale:[3.08,.22,1.72],paletteRole:'primary',explode:[0,.75,.55],description:'后置动力舱顶部检修盖与冷却开口区域。'});
    for(const side of [-1,1]){
      const sideName=side<0?'左':'右';
      this.addPart({...shell,name:`${sideName}侧翼子板`,geo:'box',pos:[side*1.68,1.35,-.05],scale:[.20,.14,6.28],paletteRole:'secondary',side:side<0?'left':'right',explode:[side*.9,.15,0],description:'沿履带上方布置的翼子板与储物支撑。'});
      this.addPart({...shell,name:`${sideName}前挡泥板基体`,geo:'box',pos:[side*1.63,1.16,-3.08],rot:[.15,0,side*.08],scale:[.58,.10,.72],paletteRole:'primary',side:side<0?'left':'right',explode:[side*.8,.1,-.5],description:'覆盖诱导轮上方的前挡泥板。'});
    }
    this.addPart({...shell,name:'车首下防浪/附加板',geo:'box',pos:[0,1.17,-3.23],rot:[-.22,0,0],scale:[2.05,.12,.54],paletteRole:'secondary',explode:[0,.25,-.8],description:'车首下部可见附加板件的简化表达。'});
    for(const x of [-1.22,1.22]){
      this.addPart({name:'前照灯防护座',geo:'box',material:'darkSteel',pos:[x,1.63,-3.05],scale:[.30,.22,.20],layer:'armor',shell:true,side:x<0?'left':'right',explode:[Math.sign(x)*.7,.25,-.5],system:'车体附件',description:'前照灯与防护框安装座。'});
      this.addPart({name:'前照灯',geo:'cylinder12',material:'light',pos:[x,1.64,-3.16],rot:[Math.PI/2,0,0],scale:[.14,.08,.14],layer:'armor',side:x<0?'left':'right',explode:[Math.sign(x)*.75,.25,-.55],system:'车体附件',description:'可发光的程序化灯体。',transparent:true});
    }
    for(const x of [-.9,.9]){
      this.addPart({name:'车首牵引环',geo:'torus',material:'steel',pos:[x,.87,-3.31],rot:[Math.PI/2,0,0],scale:[.34,.34,.34],layer:'armor',shell:true,explode:[Math.sign(x)*.3,-.25,-.8],system:'车体附件',description:'车首牵引环，按照片比例近似。'});
    }
    for(let i=0;i<5;i++){
      this.addPart({name:'驾驶员潜望镜组',geo:'box',material:'glassDark',pos:[(i-2)*.18,1.92,-2.24],rot:[-.12,0,0],scale:[.13,.11,.22],layer:'armor',shell:true,explode:[(i-2)*.08,.7,-.45],system:'驾驶观察',description:'驾驶员舱口前方的潜望镜窗口组。',transparent:true});
    }
    this.addPart({...shell,name:'驾驶员舱盖',geo:'box',pos:[0,1.88,-2.03],rot:[-.08,0,0],scale:[.86,.10,.78],paletteRole:'secondary',explode:[0,1.15,-.5],system:'驾驶舱',description:'前部中央驾驶员舱盖。'});
  }

  buildMobility(){
    const zWheels=[-2.35,-1.42,-.48,.47,1.42,2.35];
    for(const side of [-1,1]){
      const sideLabel=side<0?'左':'右';
      for(let i=0;i<zWheels.length;i++){
        const z=zWheels[i];
        this.addPart({name:`${sideLabel}侧第 ${i+1} 负重轮橡胶圈`,geo:'cylinder',material:'rubber',pos:[side*1.48,.69,z],rot:[0,0,Math.PI/2],scale:[1.05,.34,1.05],layer:'mobility',side:side<0?'left':'right',explode:[side*1.25,-.2,(z/3)*.25],system:'悬挂与行走',description:'六对大直径负重轮之一。',specs:{数量:'每侧 6 个',悬挂:'扭杆式架构示意'}});
        this.addPart({name:`${sideLabel}侧第 ${i+1} 负重轮轮毂`,geo:'cylinder',material:'steel',pos:[side*1.50,.69,z],rot:[0,0,Math.PI/2],scale:[.66,.39,.66],tint:[.55,.53,.43,1],layer:'mobility',side:side<0?'left':'right',explode:[side*1.28,-.2,(z/3)*.25],system:'悬挂与行走',description:'负重轮金属轮毂。'});
        this.addPart({name:`${sideLabel}侧扭杆摇臂 ${i+1}`,geo:'box',material:'darkSteel',pos:[side*1.21,.66,z+.12],rot:[0,0,side*.12],scale:[.42,.10,.13],layer:'mobility',side:side<0?'left':'right',explode:[side*.9,-.25,(z/3)*.22],system:'悬挂与行走',confidence:'medium',description:'扭杆悬挂摇臂的可视化近似。'});
      }
      for(const [name,z,y,r] of [['诱导轮',-2.92,.78,.88],['主动轮',2.92,.78,.90]]){
        this.addPart({name:`${sideLabel}侧${name}橡胶圈`,geo:'cylinder',material:'rubber',pos:[side*1.48,y,z],rot:[0,0,Math.PI/2],scale:[r,.36,r],layer:'mobility',side:side<0?'left':'right',explode:[side*1.3,-.15,Math.sign(z)*.35],system:'悬挂与行走',description:`${name}外缘与轮体。`});
        this.addPart({name:`${sideLabel}侧${name}轮毂`,geo:'cylinder12',material:'steel',pos:[side*1.50,y,z],rot:[0,0,Math.PI/2],scale:[r*.58,.40,r*.58],tint:[.48,.46,.37,1],layer:'mobility',side:side<0?'left':'right',explode:[side*1.32,-.15,Math.sign(z)*.35],system:'悬挂与行走',description:`${name}金属轮毂与齿圈简化。`});
      }
      for(const z of [-1.55,0,1.55]){
        this.addPart({name:`${sideLabel}侧托带轮`,geo:'cylinder12',material:'rubber',pos:[side*1.45,1.30,z],rot:[0,0,Math.PI/2],scale:[.38,.26,.38],layer:'mobility',side:side<0?'left':'right',explode:[side*1.15,.25,z*.08],system:'悬挂与行走',description:'上支履带托带轮。'});
      }
      this.buildTrack(side);
    }
    this.buildSkirts('standard',['standard','a1']);
    this.buildSkirts('p',['p']);
  }

  buildTrack(side){
    const sideName=side<0?'左':'右';
    const points=[];
    const topN=23,arcN=11,bottomN=23;
    for(let i=0;i<topN;i++){
      const t=i/(topN-1); points.push({y:1.40,z:lerp(2.67,-2.67,t),dy:0,dz:-1});
    }
    for(let i=1;i<=arcN;i++){
      const a=lerp(Math.PI/2,Math.PI*1.5,i/arcN); points.push({y:.81+.59*Math.sin(a),z:-2.67+.59*Math.cos(a),dy:.59*Math.cos(a),dz:-.59*Math.sin(a)});
    }
    for(let i=1;i<bottomN;i++){
      const t=i/(bottomN-1); points.push({y:.22,z:lerp(-2.67,2.67,t),dy:0,dz:1});
    }
    for(let i=1;i<=arcN;i++){
      const a=lerp(Math.PI*1.5,Math.PI*2.5,i/arcN); points.push({y:.81+.59*Math.sin(a),z:2.67+.59*Math.cos(a),dy:.59*Math.cos(a),dz:-.59*Math.sin(a)});
    }
    points.forEach((p,i)=>{
      const angle=Math.atan2(-p.dy,p.dz);
      this.addPart({name:`${sideName}侧双销履带板 ${i+1}`,geo:'box',material:'track',pos:[side*1.72,p.y,p.z],rot:[angle,0,0],scale:[.49,.12,.30],layer:'mobility',side:side<0?'left':'right',explode:[side*1.55,(p.y-.8)*.7,p.z*.05],system:'履带系统',description:'程序化生成的双销履带板与橡胶/金属接地面比例近似。',selectable:i%6===0});
      this.addPart({name:`${sideName}侧履齿 ${i+1}`,geo:'box',material:'darkSteel',pos:[side*1.94,p.y,p.z],rot:[angle,0,0],scale:[.07,.16,.24],layer:'mobility',side:side<0?'left':'right',explode:[side*1.7,(p.y-.8)*.7,p.z*.05],system:'履带系统',description:'外侧履齿与连接结构。',selectable:false});
    });
  }

  buildSkirts(type,variants){
    for(const side of [-1,1]){
      const sideName=side<0?'左':'右';
      if(type==='standard'){
        for(let i=0;i<6;i++){
          const z=-2.45+i*.98;
          this.addPart({name:`${sideName}侧标准裙板 ${i+1}`,geo:'box',material:'armorMatte',pos:[side*1.86,1.16,z],scale:[.10,.72,.88],paletteRole:i%3===1?'secondary':'primary',layer:'armor',variants,shell:true,side:side<0?'left':'right',explode:[side*1.5,(i%2)*.08,z*.06],system:'侧面防护',description:'标准版本分段裙板，覆盖上部履带。'});
        }
      }else{
        for(let i=0;i<7;i++){
          const z=-2.58+i*.84;
          this.addPart({name:`${sideName}侧巴方定制裙板 ${i+1}`,geo:'box',material:'armorMatte',pos:[side*1.88,1.14,z],rot:[0,0,side*(i===0?.08:0)],scale:[.11,i===0?.80:.68,.73],paletteRole:i%3===1?'secondary':i%3===2?'dark':'primary',layer:'armor',variants,shell:true,side:side<0?'left':'right',explode:[side*1.55,(i%2)*.08,z*.06],system:'侧面防护',description:'依据巴方车辆公开照片重构的分段节奏与前段挡泥板体量。',diff:true});
        }
      }
    }
  }

  buildTurretAndGun(){
    const shell={shell:true,layer:'armor',system:'炮塔与防护',node:this.turretNode};
    this.addPart({...shell,name:'炮塔座圈外罩',geo:'cylinder',pos:[0,-.12,0],scale:[2.30,.28,2.30],paletteRole:'dark',explode:[0,.45,0],description:'炮塔座圈与旋转接口外部轮廓。'});
    this.addPart({...shell,name:'复合装甲炮塔主体',geo:'wedge',pos:[0,.35,.05],scale:[2.75,.92,3.05],paletteRole:'primary',explode:[0,1.05,0],description:'焊接复合装甲炮塔的低矮楔形体量，按公开影像轮廓近似。',specs:{乘员:'车长、炮长',武器:'125 mm 滑膛炮'}});
    for(const side of [-1,1]){
      const sn=side<0?'左':'右';
      this.addPart({...shell,name:`${sn}炮塔楔形装甲颊`,geo:'wedge',pos:[side*.96,.22,-.70],rot:[0,side*.13,side*.04],scale:[.78,.66,1.35],paletteRole:'secondary',side:side<0?'left':'right',explode:[side*.95,.75,-.35],description:'主炮两侧楔形复合装甲颊部。'});
      this.addPart({...shell,name:`${sn}炮塔侧壁`,geo:'box',pos:[side*1.35,.29,.34],rot:[0,side*.08,0],scale:[.22,.72,1.92],paletteRole:'primary',side:side<0?'left':'right',explode:[side*1.25,.65,.12],description:'炮塔侧面装甲基板与设备安装面。'});
    }
    this.addPart({...shell,name:'炮塔尾舱',geo:'box',pos:[0,.30,1.56],scale:[2.35,.67,.72],paletteRole:'dark',explode:[0,.8,1.0],description:'炮塔尾部储物/电子设备舱体量近似。'});
    this.addPart({...shell,name:'炮塔顶部装甲板',geo:'box',pos:[0,.87,.14],scale:[2.20,.12,2.20],paletteRole:'primary',explode:[0,1.45,.1],description:'舱口、观瞄与武器站的安装顶板。'});

    this.addPart({name:'主炮防盾',geo:'cylinder',material:'armor',node:this.gunPivotNode,pos:[0,0,.05],rot:[Math.PI/2,0,0],scale:[.66,.30,.66],paletteRole:'dark',layer:'firepower',shell:true,explode:[0,.75,-.6],system:'主武器',description:'主炮摇架外部防盾与密封区。'});
    const barrelSegments=[
      {name:'主炮根部套筒',z:-.43,len:.86,r:.25,mat:'darkSteel'},
      {name:'125 mm 滑膛炮身管',z:-2.55,len:4.05,r:.105,mat:'steel'},
      {name:'炮口加强环',z:-4.62,len:.28,r:.16,mat:'darkSteel'},
    ];
    barrelSegments.forEach(s=>this.addPart({name:s.name,geo:'cylinder',material:s.mat,node:this.gunPivotNode,pos:[0,0,s.z],rot:[-Math.PI/2,0,0],scale:[s.r,s.len,s.r],layer:'firepower',explode:[0,.95,-1.2-Math.abs(s.z)*.12],system:'主武器',description:s.name==='125 mm 滑膛炮身管'?'外贸型 VT-4 的 125 mm 级滑膛主炮身管；不包含制造级膛线、药室或弹道数据。':'主炮外部套筒构件。',specs:s.name.includes('125')?{口径:'125 mm 级（公开资料）',类型:'滑膛炮'}:{}}));
    this.addPart({name:'炮口内腔',geo:'cylinder12',material:'darkSteel',node:this.gunPivotNode,pos:[0,0,-4.79],rot:[-Math.PI/2,0,0],scale:[.075,.035,.075],layer:'firepower',explode:[0,.95,-1.75],system:'主武器',description:'仅用于视觉表达的黑色炮口内腔。'});
    this.addPart({name:'抽烟装置外壳',geo:'cylinder',material:'armor',node:this.gunPivotNode,pos:[0,0,-2.40],rot:[-Math.PI/2,0,0],scale:[.19,.72,.19],paletteRole:'secondary',layer:'firepower',explode:[0,1.0,-1.45],system:'主武器',description:'炮身中段抽烟装置外形。'});
    this.addPart({name:'炮口基准装置',geo:'box',material:'darkSteel',node:this.gunPivotNode,pos:[.13,.13,-4.55],scale:[.12,.10,.18],layer:'firepower',explode:[.1,1.0,-1.7],system:'火控系统',description:'炮口基准/校正装置的外形化表达。'});

    this.addPart({name:'车长周视镜基座',geo:'cylinder',material:'armor',node:this.turretNode,pos:[.68,1.03,.15],scale:[.50,.22,.50],paletteRole:'dark',layer:'firepower',shell:true,explode:[.35,1.75,.05],system:'观瞄与火控',description:'车长全景周视镜旋转基座。'});
    this.addPart({name:'车长全景周视镜',geo:'box',material:'armor',node:this.turretNode,pos:[.68,1.30,.12],scale:[.43,.44,.42],paletteRole:'primary',layer:'firepower',shell:true,explode:[.35,2.0,.05],system:'观瞄与火控',description:'具备 360° 观察能力的车长周视镜外形近似。'});
    for(const side of [-1,1]){
      this.addPart({name:'车长周视镜光学窗',geo:'box',material:'glassDark',node:this.turretNode,pos:[.68+side*.18,1.31,-.105],scale:[.14,.20,.035],layer:'firepower',transparent:true,explode:[.35+side*.15,2.0,-.08],system:'观瞄与火控',description:'全景周视镜光电窗口。'});
    }
    this.addPart({name:'炮长主瞄准镜护罩',geo:'box',material:'armor',node:this.turretNode,pos:[-.67,.83,-1.02],rot:[-.08,0,0],scale:[.52,.46,.42],paletteRole:'secondary',layer:'firepower',shell:true,explode:[-.35,1.45,-.6],system:'观瞄与火控',description:'炮长昼夜综合瞄准镜护罩。'});
    this.addPart({name:'炮长瞄准镜窗口',geo:'box',material:'glassDark',node:this.turretNode,pos:[-.67,.83,-1.245],scale:[.34,.24,.045],layer:'firepower',transparent:true,explode:[-.35,1.45,-.75],system:'观瞄与火控',description:'炮长瞄准镜光电窗口。'});

    for(const side of [-1,1]){
      const sn=side<0?'左':'右';
      for(let i=0;i<6;i++){
        const z=-.34+i*.13;
        const x=side*(1.42+.025*i);
        const y=.66+i*.035;
        this.addPart({name:`${sn}侧烟幕弹发射器 ${i+1}`,geo:'cylinder12',material:'darkSteel',node:this.turretNode,pos:[x,y,z],rot:[.62,0,side*.38],scale:[.075,.28,.075],layer:'firepower',side:side<0?'left':'right',explode:[side*1.35,1.0,-.15+i*.04],system:'防护与干扰',description:'炮塔侧面烟幕弹发射管。',selectable:i===0});
      }
    }
    for(const [x,name] of [[-.65,'炮长舱盖'],[.55,'车长舱盖']]){
      this.addPart({...shell,name,geo:'cylinder',pos:[x,1.00,.24],scale:[.53,.10,.53],paletteRole:'secondary',explode:[x*.35,1.85,.16],description:`${name}外盖。`});
    }
    this.buildTurretBasketExternal();
  }

  buildTurretBasketExternal(){
    const n=this.turretNode;
    const variants=['standard','a1','p'];
    for(const side of [-1,1]){
      const x=side*1.55;
      this.addTube({name:'炮塔侧储物篮上栏杆',material:'darkSteel',node:n,start:[x,.58,.55],end:[x,.58,1.75],radius:.025,layer:'armor',variants,side:side<0?'left':'right',explode:[side*1.5,.8,.7],system:'炮塔附件',description:'炮塔尾部储物篮栏杆。'});
      this.addTube({name:'炮塔侧储物篮下栏杆',material:'darkSteel',node:n,start:[x,.18,.55],end:[x,.18,1.75],radius:.025,layer:'armor',variants,side:side<0?'left':'right',explode:[side*1.5,.6,.7],system:'炮塔附件',description:'炮塔尾部储物篮栏杆。',selectable:false});
      for(let i=0;i<5;i++){
        const z=.55+i*.30;
        this.addTube({name:'炮塔储物篮竖杆',material:'darkSteel',node:n,start:[x,.18,z],end:[x,.58,z],radius:.018,layer:'armor',variants,side:side<0?'left':'right',explode:[side*1.5,.7,.7],system:'炮塔附件',description:'储物篮支撑。',selectable:false});
      }
    }
    for(let i=0;i<7;i++){
      const x=-1.5+i*.5;
      this.addTube({name:'炮塔尾篮横向支撑',material:'darkSteel',node:n,start:[x,.18,1.82],end:[x,.58,1.82],radius:.018,layer:'armor',variants,explode:[0,.7,1.25],system:'炮塔附件',description:'尾部储物篮支撑。',selectable:false});
    }
  }

  buildVariants(){
    this.buildStandardEra();
    this.buildPVariant();
    this.buildA1Variant();
    this.buildRWS('standard',['standard','p']);
    this.buildRWS('a1',['a1']);
  }

  buildStandardEra(){
    const variants=['standard','a1'];
    for(let row=0;row<2;row++){
      for(let col=0;col<5;col++){
        const x=(col-2)*.58;
        const z=-2.76+row*.42;
        this.addPart({name:`首上 FY 系列 ERA ${row*5+col+1}`,geo:'box',material:'armorMatte',pos:[x,1.91+row*.03,z],rot:[-.20,0,0],scale:[.52,.18,.34],paletteRole:(col+row)%4===1?'secondary':'primary',layer:'armor',variants,shell:true,explode:[x*.22,.75,-.9-row*.08],system:'反应装甲',description:'标准防务展版本首上模块化反应装甲的照片对照近似。',diff:true,selectable:row===0&&col===2});
      }
    }
    for(const side of [-1,1]){
      for(let row=0;row<2;row++){
        for(let col=0;col<3;col++){
          const x=side*(.70+col*.33);
          const z=-.83+row*.42+col*.035;
          this.addPart({name:`炮塔${side<0?'左':'右'}颊标准 ERA ${row*3+col+1}`,geo:'box',material:'armorMatte',node:this.turretNode,pos:[x,.52+row*.28,z],rot:[0,side*.18,side*.035],scale:[.28,.24,.38],paletteRole:(row+col)%3===1?'secondary':'primary',layer:'armor',variants,shell:true,side:side<0?'left':'right',explode:[side*(1.0+col*.12),.85+row*.15,-.45],system:'反应装甲',description:'炮塔正侧面标准 ERA 模块。',diff:true,selectable:row===0&&col===0});
        }
      }
    }
    for(const side of [-1,1]){
      for(let i=0;i<4;i++){
        this.addPart({name:`炮塔${side<0?'左':'右'}侧 ERA ${i+1}`,geo:'box',material:'armorMatte',node:this.turretNode,pos:[side*1.50,.42,-.25+i*.38],rot:[0,side*.06,0],scale:[.12,.44,.32],paletteRole:i%3===1?'secondary':'primary',layer:'armor',variants,shell:true,side:side<0?'left':'right',explode:[side*1.45,.7,-.2+i*.12],system:'反应装甲',description:'炮塔侧面附加反应装甲模块。',selectable:false});
      }
    }
  }

  buildPVariant(){
    const variants=['p'];
    for(let row=0;row<2;row++){
      const cols=row===0?6:5;
      for(let col=0;col<cols;col++){
        const x=(col-(cols-1)/2)*.50;
        const z=-2.77+row*.41;
        this.addPart({name:`巴方首上定制 ERA ${row*6+col+1}`,geo:'box',material:'armorMatte',pos:[x,1.91+row*.035,z],rot:[-.20,0,(col%2?1:-1)*.012],scale:[.44,.19,.33],paletteRole:(col+row)%3===1?'secondary':(col+row)%3===2?'dark':'primary',layer:'armor',variants,shell:true,explode:[x*.25,.76,-.92-row*.08],system:'反应装甲',description:'巴基斯坦车辆公开照片中首上模块轮廓与分缝的近似重构。',diff:true,selectable:row===0&&col===2});
      }
    }
    for(const side of [-1,1]){
      const modules=[
        {x:1.47,y:.72,z:-.90,s:[.14,.31,.42],ry:.08},
        {x:1.50,y:.70,z:-.42,s:[.14,.27,.38],ry:.04},
        {x:1.52,y:.66,z:.02,s:[.14,.23,.36],ry:-.02},
        {x:1.53,y:.60,z:.43,s:[.14,.20,.32],ry:-.06},
      ];
      modules.forEach((m,i)=>this.addPart({name:`巴方炮塔${side<0?'左':'右'}侧混合 ERA ${i+1}`,geo:'box',material:'armorMatte',node:this.turretNode,pos:[side*m.x,m.y,m.z],rot:[0,side*m.ry,side*(i%2?.03:-.02)],scale:m.s,paletteRole:i%3===1?'secondary':i%3===2?'dark':'primary',layer:'armor',variants,shell:true,side:side<0?'left':'right',explode:[side*(1.5+i*.08),.72+i*.08,m.z*.25],system:'反应装甲',confidence:'medium',description:'以不同尺寸、倾角与间隙表达 FY-4/FY-2 混合排布的用户指定特征；精确型号与装药不可由公开照片确认。',diff:true,selectable:i===0}));
    }
    for(let side=-1;side<=1;side+=2){
      for(let row=0;row<3;row++){
        this.addPart({name:'巴方尾部散热格栅',geo:'box',material:'darkSteel',pos:[side*.86+side*row*.35,1.52,3.21],scale:[.28,.52,.08],layer:'armor',variants,shell:true,explode:[side*.45,.45,1.15],system:'动力舱外部',description:'巴方版本尾部格栅的密集分段近似。',diff:true,selectable:row===0});
      }
    }
  }

  buildA1Variant(){
    const variants=['a1'];
    const radarConfigs=[
      {p:[-1.48,.78,-.72],r:[0,-.20,0],side:'left',label:'左前'},
      {p:[1.48,.78,-.72],r:[0,.20,0],side:'right',label:'右前'},
      {p:[-1.48,.74,.82],r:[0,.22,0],side:'left',label:'左后'},
      {p:[1.48,.74,.82],r:[0,-.22,0],side:'right',label:'右后'},
    ];
    radarConfigs.forEach((c,i)=>{
      this.addPart({name:`VT-4A1 ${c.label}毫米波雷达面板`,geo:'box',material:'darkSteel',node:this.turretNode,pos:c.p,rot:c.r,scale:[.11,.42,.34],layer:'firepower',variants,shell:true,side:c.side,explode:[Math.sign(c.p[0])*1.7,1.15,c.p[2]*.5],system:'主动防护系统',description:'展会公开外观中可见的周向 APS 探测面板；内部频段与电子架构未建模。',diff:true,selectable:i===0});
      this.addPart({name:'APS 雷达天线罩',geo:'box',material:'glassDark',node:this.turretNode,pos:[c.p[0]+Math.sign(c.p[0])*.065,c.p[1],c.p[2]],rot:c.r,scale:[.035,.30,.24],layer:'firepower',variants,transparent:true,side:c.side,explode:[Math.sign(c.p[0])*1.78,1.15,c.p[2]*.5],system:'主动防护系统',description:'雷达面板外部天线罩。',diff:true,selectable:false});
    });
    for(const side of [-1,1]){
      for(let i=0;i<2;i++){
        this.addPart({name:`${side<0?'左':'右'}侧 APS 拦截器 ${i+1}`,geo:'cylinder12',material:'darkSteel',node:this.turretNode,pos:[side*1.34,1.10,.28+i*.34],rot:[.62,0,side*.38],scale:[.12,.42,.12],layer:'firepower',variants,side:side<0?'left':'right',explode:[side*1.65,1.65,.3+i*.15],system:'主动防护系统',description:'用于表达硬杀伤主动防护的拦截器发射组件；不含拦截算法、装药或性能数据。',diff:true,selectable:i===0});
      }
    }
    for(const p of [[-1.05,1.18,-.62],[1.05,1.18,-.62],[-1.02,1.18,.72],[1.02,1.18,.72]]){
      this.addPart({name:'激光告警接收器',geo:'sphere',material:'glassDark',node:this.turretNode,pos:p,scale:[.20,.14,.20],layer:'firepower',variants,transparent:true,explode:[Math.sign(p[0])*1.25,1.85,p[2]*.3],system:'告警与软杀伤',description:'炮塔顶部周向激光告警接收器外形。',diff:true,selectable:false});
    }
    this.addPart({name:'车载无人机发射管',geo:'cylinder',material:'armor',node:this.turretNode,pos:[-.05,1.31,.72],rot:[0,0,Math.PI/2],scale:[.23,.72,.23],paletteRole:'dark',layer:'firepower',variants,explode:[0,2.05,.75],system:'无人机协同',confidence:'medium',description:'根据展会报道中的无人机协同能力，以筒式模块表达；发射/回收内部机构为概念化。',diff:true});
    this.addPart({name:'无人机发射管端盖',geo:'cylinder12',material:'darkSteel',node:this.turretNode,pos:[-.78,1.31,.72],rot:[0,0,Math.PI/2],scale:[.25,.06,.25],layer:'firepower',variants,explode:[-.55,2.05,.75],system:'无人机协同',description:'筒式无人机模块端盖。',diff:true,selectable:false});
    for(let x=-.72;x<=.72;x+=.48){
      for(let z=-.20;z<=.75;z+=.48){
        this.addPart({name:'VT-4A1 顶部附加装甲块',geo:'box',material:'armorMatte',node:this.turretNode,pos:[x,1.02,z],scale:[.42,.10,.42],paletteRole:(Math.round((x+z)*10)%2)?'secondary':'primary',layer:'armor',variants,shell:true,explode:[x*.35,1.8,z*.35],system:'顶部防护',description:'用于表达顶部防护增强的模块化装甲块；具体防护等级不作推断。',diff:true,selectable:false});
      }
    }
  }

  buildRWS(type,variants){
    const n=this.turretNode;
    if(type==='standard'){
      this.addPart({name:'基础型遥控武器站基座',geo:'cylinder',material:'armor',node:n,pos:[.05,1.05,.78],scale:[.42,.18,.42],paletteRole:'dark',layer:'firepower',variants,shell:true,explode:[.05,1.8,.75],system:'遥控武器站',description:'标准轻型 RWS 回转基座。',diff:true});
      this.addPart({name:'基础型 RWS 武器箱',geo:'box',material:'armor',node:n,pos:[.05,1.30,.77],scale:[.34,.28,.55],paletteRole:'primary',layer:'firepower',variants,shell:true,explode:[.05,2.0,.75],system:'遥控武器站',description:'遥控武器站主机与俯仰架外罩。',diff:true});
      this.addPart({name:'RWS 12.7 mm 级机枪',geo:'cylinder12',material:'darkSteel',node:n,pos:[.05,1.36,.24],rot:[-Math.PI/2,0,0],scale:[.055,.92,.055],layer:'firepower',variants,explode:[.05,2.05,.15],system:'遥控武器站',description:'仅表达外部枪管比例，不含内部武器结构。',diff:true});
    } else {
      this.addPart({name:'VT-4A1 重型 RWS 基座',geo:'cylinder',material:'armor',node:n,pos:[.05,1.07,.78],scale:[.55,.22,.55],paletteRole:'dark',layer:'firepower',variants,shell:true,explode:[.05,1.85,.75],system:'遥控武器站',description:'A1 展示构型的加大型 RWS 基座近似。',diff:true});
      this.addPart({name:'VT-4A1 重型 RWS 防护罩',geo:'wedge',material:'armor',node:n,pos:[.05,1.38,.76],scale:[.56,.45,.74],paletteRole:'primary',layer:'firepower',variants,shell:true,explode:[.05,2.12,.75],system:'遥控武器站',description:'扩大防护罩与传感器组件的重型 RWS 外形。',diff:true});
      this.addPart({name:'VT-4A1 RWS 光电球',geo:'sphere',material:'glassDark',node:n,pos:[.38,1.40,.50],scale:[.24,.24,.24],layer:'firepower',variants,transparent:true,explode:[.35,2.14,.55],system:'遥控武器站',description:'武器站独立光电传感器。',diff:true});
      this.addPart({name:'VT-4A1 RWS 机枪管',geo:'cylinder12',material:'darkSteel',node:n,pos:[-.04,1.44,.10],rot:[-Math.PI/2,0,0],scale:[.065,1.22,.065],layer:'firepower',variants,explode:[-.04,2.18,.05],system:'遥控武器站',description:'加长的 12.7 mm 级机枪外形。',diff:true});
    }
  }

  buildInterior(){
    this.buildPowerpack();
    this.buildFightingCompartment();
    this.buildDriverCompartment();
  }

  buildPowerpack(){
    const layer='interior', system='动力舱', explodeBase=[0,.4,1.35];
    this.addPart({name:'1300 马力级柴油机主缸体（示意）',geo:'box',material:'engine',pos:[0,1.05,2.05],scale:[1.65,.72,1.22],layer,explode:explodeBase,system,confidence:'concept',description:'按用户要求表达水冷涡轮增压柴油动力包；外壳与附件为教学性程序化重构，不代表厂家真实零件 CAD。',specs:{功率标注:'1300 hp 级（版本公开资料存在 1200/1300 hp 差异）',冷却:'水冷 / 涡轮增压架构示意'}});
    for(const side of [-1,1]){
      for(let i=0;i<6;i++){
        const z=1.62+i*.17;
        this.addPart({name:`V12 ${side<0?'左':'右'}列气缸盖 ${i+1}`,geo:'box',material:'machinery',pos:[side*.52,1.46,z],rot:[0,0,side*.16],scale:[.34,.25,.14],layer,explode:[side*.35,.75,1.45+(i-2.5)*.03],system,confidence:'concept',description:'V 型 12 缸动力包的气缸盖节奏示意。',selectable:i===0});
      }
      this.addPart({name:`${side<0?'左':'右'}侧进气歧管`,geo:'cylinder12',material:'darkSteel',pos:[side*.78,1.40,2.03],rot:[Math.PI/2,0,0],scale:[.17,.82,.17],layer,explode:[side*.62,.8,1.5],system,confidence:'concept',description:'涡轮增压柴油机进气歧管示意。'});
      this.addPart({name:`${side<0?'左':'右'}侧涡轮增压器`,geo:'cylinder',material:'steel',pos:[side*.86,1.22,2.50],rot:[0,0,Math.PI/2],scale:[.44,.30,.44],layer,explode:[side*.72,.55,1.75],system,confidence:'concept',description:'双侧涡轮增压器外壳示意。'});
      this.addPart({name:`${side<0?'左':'右'}侧排气总管`,geo:'cylinder12',material:'copper',pos:[side*.92,1.13,2.02],rot:[Math.PI/2,0,0],scale:[.09,.92,.09],layer,explode:[side*.76,.48,1.5],system,confidence:'concept',description:'高温排气总管与隔热色调示意。'});
    }
    this.addPart({name:'综合液力传动箱',geo:'wedge',material:'machinery',pos:[0,.96,2.92],rot:[0,Math.PI,0],scale:[1.78,.78,.72],layer,explode:[0,.28,2.05],system,confidence:'concept',description:'后置综合液力机械传动箱体量示意。',specs:{类型:'自动/液力机械传动架构示意',位置:'发动机后方'}});
    for(const side of [-1,1]){
      this.addPart({name:'终传动输出轴',geo:'cylinder12',material:'steel',pos:[side*1.16,.77,2.95],rot:[0,0,Math.PI/2],scale:[.16,.58,.16],layer,explode:[side*.65,.05,2.1],system,confidence:'concept',description:'向两侧主动轮传递动力的输出轴示意。'});
    }
    for(let i=0;i<3;i++){
      const x=(i-1)*.73;
      this.addPart({name:`冷却风扇组 ${i+1}`,geo:'cylinder',material:'darkSteel',pos:[x,1.66,2.43],scale:[.58,.13,.58],layer,explode:[x*.3,1.15,1.72],system,confidence:'concept',description:'动力舱顶部轴流冷却风扇。'});
      for(let b=0;b<6;b++){
        const a=b/6*TAU;
        this.addPart({name:'冷却风扇叶片',geo:'box',material:'steel',pos:[x+Math.cos(a)*.23,1.75,2.43+Math.sin(a)*.23],rot:[0,-a,.25],scale:[.12,.035,.38],layer,explode:[x*.3,1.2,1.72],system,confidence:'concept',description:'冷却风扇叶片。',selectable:false});
      }
    }
    this.addTube({name:'左侧排气管路',material:'copper',start:[-.90,1.30,2.48],end:[-1.28,1.55,3.05],radius:.075,layer,explode:[-.72,.7,2.1],system,confidence:'concept',description:'涡轮后排气管路示意。'});
    this.addTube({name:'右侧排气管路',material:'copper',start:[.90,1.30,2.48],end:[1.28,1.55,3.05],radius:.075,layer,explode:[.72,.7,2.1],system,confidence:'concept',description:'涡轮后排气管路示意。'});
    this.addPart({name:'动力舱防火隔板',geo:'box',material:'interior',pos:[0,1.13,1.28],scale:[2.82,1.36,.08],layer,explode:[0,.4,.8],system,confidence:'concept',description:'战斗舱与动力舱之间的防火隔板位置示意。'});
    for(let i=0;i<5;i++){
      const x=-1.18+i*.59;
      this.addPart({name:'后部散热百叶',geo:'box',material:'darkSteel',pos:[x,1.48,3.18],scale:[.48,.06,.14],rot:[.20,0,0],layer:'armor',shell:true,explode:[x*.2,.55,1.2],system:'动力舱外部',description:'车尾散热百叶外形。',variants:['standard','a1'],selectable:i===0});
    }
  }

  buildFightingCompartment(){
    const layer='interior', system='战斗舱';
    this.addPart({name:'吊篮转台上环',geo:'torus',material:'machinery',pos:[0,1.43,-.20],rot:[Math.PI/2,0,0],scale:[1.50,1.50,1.50],layer,explode:[0,.55,-.05],system,confidence:'concept',description:'随炮塔旋转的吊篮式战斗舱上环。'});
    this.addPart({name:'吊篮转台地板',geo:'cylinder',material:'interior',pos:[0,.83,-.20],scale:[1.38,.12,1.38],layer,explode:[0,-.2,-.05],system,confidence:'concept',description:'炮塔吊篮地板与乘员脚部空间示意。'});
    for(let i=0;i<6;i++){
      const a=i/6*TAU;
      const x=Math.cos(a)*1.28,z=-.20+Math.sin(a)*1.28;
      this.addTube({name:'吊篮垂直支撑',material:'machinery',start:[x,.84,z],end:[x,1.46,z],radius:.025,layer,explode:[x*.25,.15,z*.15],system,confidence:'concept',description:'吊篮转台垂直框架。',selectable:false});
    }
    this.addPart({name:'盘式自动装弹机弹盘',geo:'cylinder',material:'machinery',pos:[0,.55,-.12],scale:[1.26,.18,1.26],layer,explode:[0,-.65,-.1],system:'自动装弹机',confidence:'concept',description:'车体底部盘式自动装弹机的外形化重构。',specs:{形式:'盘式/转盘式示意',弹位:'以 18 个可视弹位表达，不等同实装数量'}});
    this.addPart({name:'自动装弹机中心驱动',geo:'cylinder',material:'darkSteel',pos:[0,.72,-.12],scale:[.42,.30,.42],layer,explode:[0,-.45,-.1],system:'自动装弹机',confidence:'concept',description:'弹盘中心回转驱动单元。'});
    for(let i=0;i<18;i++){
      const a=i/18*TAU;
      const start=[Math.cos(a)*.58,.61,-.12+Math.sin(a)*.58];
      const end=[Math.cos(a)*1.13,.61,-.12+Math.sin(a)*1.13];
      const bodyMatrix=matrixFromYToDirection(start,end,.07);
      this.addPart({name:`自动装弹机弹药位 ${i+1}`,geo:'cylinder12',material:'ammo',matrix:bodyMatrix,layer,explode:[Math.cos(a)*.55,-.75,Math.sin(a)*.55],system:'弹药与自动装填',confidence:'concept',description:'分装式弹药/弹丸位置的教学性表达，不包含真实弹种尺寸与装药结构。',selectable:i%4===0});
      const tipStart=end;
      const tipEnd=[Math.cos(a)*1.25,.61,-.12+Math.sin(a)*1.25];
      this.addPart({name:'自动装弹机弹丸头部',geo:'cone',material:'ammoTip',matrix:matrixFromYToDirection(tipStart,tipEnd,.075),layer,explode:[Math.cos(a)*.62,-.75,Math.sin(a)*.62],system:'弹药与自动装填',confidence:'concept',description:'弹丸头部轮廓示意。',selectable:false});
    }
    this.addPart({name:'输弹机升降架',geo:'box',material:'machinery',pos:[-.72,1.02,-.80],rot:[-.22,0,-.05],scale:[.20,1.05,.25],layer,explode:[-.55,.2,-.55],system:'自动装弹机',confidence:'concept',description:'从弹盘向炮尾输送弹药的升降/转接机构示意。'});
    this.addPart({name:'输弹托盘',geo:'box',material:'steel',pos:[-.55,1.37,-.95],rot:[-.16,0,0],scale:[.18,.12,.86],layer,explode:[-.42,.45,-.72],system:'自动装弹机',confidence:'concept',description:'输弹托盘与导轨。'});
    this.addPart({name:'液压推弹杆',geo:'cylinder12',material:'steel',pos:[-.55,1.40,-.50],rot:[-Math.PI/2,0,0],scale:[.055,.86,.055],layer,explode:[-.42,.48,-.38],system:'自动装弹机',confidence:'concept',description:'向炮膛方向推送弹药的推弹机构示意。'});

    this.addPart({name:'炮尾炮闩体',geo:'box',material:'steel',node:this.gunPivotNode,pos:[0,0,.58],scale:[.58,.56,.82],layer,explode:[0,.55,.3],system:'炮尾与后坐系统',confidence:'concept',description:'炮尾、炮闩与装填接口的体量化重构。'});
    this.addPart({name:'炮闩楔块',geo:'box',material:'darkSteel',node:this.gunPivotNode,pos:[0,-.02,.93],scale:[.36,.40,.16],layer,explode:[0,.5,.48],system:'炮尾与后坐系统',confidence:'concept',description:'楔式炮闩外形示意。'});
    for(const side of [-1,1]){
      this.addPart({name:`${side<0?'左':'右'}驻退复进筒`,geo:'cylinder12',material:'machinery',node:this.gunPivotNode,pos:[side*.32,.19,.30],rot:[-Math.PI/2,0,0],scale:[.085,.82,.085],layer,explode:[side*.28,.7,.15],system:'炮尾与后坐系统',confidence:'concept',description:'驻退机/复进机的并列液压筒示意。'});
    }
    this.addPart({name:'炮塔方位驱动箱',geo:'box',material:'machinery',pos:[1.05,1.12,.25],scale:[.35,.46,.42],layer,explode:[.8,.25,.18],system:'炮塔驱动',confidence:'concept',description:'炮塔回转电液驱动单元示意。'});
    this.addPart({name:'火控计算机机柜',geo:'box',material:'machinery',pos:[-1.02,1.20,.55],scale:[.38,.72,.42],layer,explode:[-.8,.35,.42],system:'观瞄与火控',confidence:'concept',description:'综合火控电子机柜位置示意。'});
    for(const x of [-.75,.72]){
      this.addPart({name:x<0?'炮长座椅':'车长座椅',geo:'box',material:'interior',pos:[x,1.05,-.05],rot:[-.08,0,0],scale:[.46,.18,.48],layer,explode:[x*.7,.12,-.02],system:'乘员战位',confidence:'medium',description:'炮塔内乘员座椅与吊篮安装位置。'});
      this.addPart({name:'座椅靠背',geo:'box',material:'interior',pos:[x,1.35,.14],rot:[-.12,0,0],scale:[.46,.62,.16],layer,explode:[x*.7,.32,.12],system:'乘员战位',confidence:'medium',description:'乘员座椅靠背。',selectable:false});
    }
    this.addPart({name:'炮长综合显示器',geo:'box',material:'screen',pos:[-.70,1.48,-.58],rot:[-.12,0,0],scale:[.36,.26,.05],layer,transparent:true,explode:[-.55,.55,-.45],system:'乘员战位',confidence:'concept',description:'炮长数字显示与瞄准界面面板示意。'});
    this.addPart({name:'车长综合显示器',geo:'box',material:'screen',pos:[.70,1.48,-.50],rot:[-.12,0,0],scale:[.36,.26,.05],layer,transparent:true,explode:[.55,.55,-.38],system:'乘员战位',confidence:'concept',description:'车长综合态势显示面板示意。'});
  }

  buildDriverCompartment(){
    const layer='interior', system='驾驶舱';
    this.addPart({name:'驾驶员座椅坐垫',geo:'box',material:'interior',pos:[0,.72,-2.08],rot:[-.10,0,0],scale:[.52,.18,.55],layer,explode:[0,-.15,-.75],system,confidence:'medium',description:'车体前部中央驾驶员座椅。'});
    this.addPart({name:'驾驶员座椅靠背',geo:'box',material:'interior',pos:[0,1.02,-1.80],rot:[-.17,0,0],scale:[.52,.68,.17],layer,explode:[0,.05,-.62],system,confidence:'medium',description:'驾驶员座椅靠背。'});
    this.addPart({name:'方向盘式驾驶操纵器',geo:'torus',material:'darkSteel',pos:[0,1.25,-2.48],rot:[Math.PI/2,0,0],scale:[.46,.46,.46],layer,explode:[0,.35,-.95],system,confidence:'concept',description:'按用户要求设置的方向盘式驾驶操纵器；真实具体操纵件可能因批次而异。'});
    this.addPart({name:'方向盘中心轮毂',geo:'cylinder12',material:'darkSteel',pos:[0,1.25,-2.48],rot:[Math.PI/2,0,0],scale:[.13,.10,.13],layer,explode:[0,.35,-.95],system,confidence:'concept',description:'驾驶操纵器中心轮毂。',selectable:false});
    for(let i=0;i<3;i++){
      const x=(i-1)*.40;
      this.addPart({name:`驾驶员数字显示面板 ${i+1}`,geo:'box',material:'screen',pos:[x,1.43,-2.61],rot:[-.22,0,0],scale:[.32,.22,.045],layer,transparent:true,explode:[x*.2,.55,-1.0],system,confidence:'concept',description:'综合数字驾驶显示、车辆状态与告警界面示意。',selectable:i===1});
    }
    this.addPart({name:'驾驶台主体',geo:'wedge',material:'machinery',pos:[0,1.24,-2.55],rot:[-.06,0,0],scale:[1.45,.48,.48],layer,explode:[0,.3,-.95],system,confidence:'concept',description:'驾驶员综合仪表台与电子设备安装体。'});
    for(const side of [-1,1]){
      this.addPart({name:`${side<0?'左':'右'}侧驾驶踏板`,geo:'box',material:'darkSteel',pos:[side*.36,.47,-2.52],rot:[-.25,0,0],scale:[.24,.06,.32],layer,explode:[side*.22,-.35,-.95],system,confidence:'concept',description:'驾驶员脚踏操纵件示意。'});
      this.addPart({name:`${side<0?'左':'右'}侧蓄电池/电子箱`,geo:'box',material:'machinery',pos:[side*.92,.75,-2.05],scale:[.48,.52,.62],layer,explode:[side*.72,-.1,-.72],system,confidence:'concept',description:'驾驶舱两侧设备箱位置示意。'});
    }
    for(let i=0;i<5;i++){
      this.addTube({name:'驾驶舱线束',material:'cable',start:[-.72+i*.30,.95,-2.10],end:[-.62+i*.25,1.32,-2.55],radius:.018,layer,explode:[(i-2)*.12,.12,-.82],system,confidence:'concept',description:'驾驶台与车体设备之间的线束走向示意。',selectable:false});
    }
    this.addPart({name:'驾驶舱后隔板',geo:'box',material:'interior',pos:[0,1.05,-1.25],scale:[2.72,1.38,.07],layer,explode:[0,.15,-.38],system,confidence:'concept',description:'驾驶舱与战斗舱前部空间的隔板位置示意。'});
  }

  buildCrew(){
    this.crewNodes.driver=new SceneNode('driver-rig',this.root,[0,.55,-2.05],[0,0,0]);
    this.crewNodes.gunner=new SceneNode('gunner-rig',this.turretNode,[-.64,-.97,-.03],[0,0,0]);
    this.crewNodes.commander=new SceneNode('commander-rig',this.turretNode,[.64,-.94,.02],[0,0,0]);
    this.buildCrewRig(this.crewNodes.driver,'驾驶员',{torso:[0,.63,.04],head:[0,1.18,-.09],seatFacing:-1,armTarget:[0,.68,-.52],legSpread:.20,roleTint:[.88,.96,.84,1]});
    this.buildCrewRig(this.crewNodes.gunner,'炮长',{torso:[0,.70,0],head:[0,1.25,-.12],seatFacing:-1,armTarget:[-.05,.82,-.48],legSpread:.18,roleTint:[.78,.90,.76,1]});
    this.buildCrewRig(this.crewNodes.commander,'车长',{torso:[0,.74,.02],head:[0,1.31,-.06],seatFacing:-1,armTarget:[.02,.88,-.42],legSpread:.18,roleTint:[.92,.88,.70,1]});
  }

  buildCrewRig(node,role,cfg){
    const layer='crew', system=`${role}战位`, confidence=role==='驾驶员'?'medium':'concept';
    const torso=cfg.torso, head=cfg.head;
    this.addPart({name:`${role}躯干`,geo:'wedge',material:'uniform',node,pos:torso,rot:[-.05,0,0],scale:[.43,.58,.30],tint:cfg.roleTint,layer,explode:[Math.sign(node.position[0])*.5,.35,node.position[2]*.12],system,confidence,description:`${role}基础人体比例与坐姿骨架。`});
    this.addPart({name:`${role}骨盆`,geo:'box',material:'uniform',node,pos:[torso[0],torso[1]-.35,torso[2]+.05],scale:[.42,.22,.30],tint:cfg.roleTint,layer,explode:[Math.sign(node.position[0])*.5,.15,node.position[2]*.12],system,confidence,description:'坐姿骨盆与装具轮廓。'});
    this.addPart({name:`${role}头部`,geo:'sphere',material:'skin',node,pos:head,scale:[.30,.36,.30],layer,explode:[Math.sign(node.position[0])*.55,.65,node.position[2]*.12],system,confidence,description:'程序化基础头部比例。'});
    this.addPart({name:`${role}坦克乘员头盔`,geo:'sphere',material:'helmet',node,pos:[head[0],head[1]+.035,head[2]],scale:[.36,.34,.36],layer,explode:[Math.sign(node.position[0])*.58,.72,node.position[2]*.12],system,confidence,description:'现代化坦克乘员防护/通信头盔外形。'});
    this.addPart({name:`${role}头盔耳罩`,geo:'cylinder12',material:'helmet',node,pos:[head[0]-.20,head[1],head[2]],rot:[0,0,Math.PI/2],scale:[.15,.09,.15],layer,explode:[-.12+Math.sign(node.position[0])*.58,.70,node.position[2]*.12],system,confidence,description:'头盔通信耳罩。',selectable:false});
    this.addPart({name:`${role}头盔耳罩`,geo:'cylinder12',material:'helmet',node,pos:[head[0]+.20,head[1],head[2]],rot:[0,0,Math.PI/2],scale:[.15,.09,.15],layer,explode:[.12+Math.sign(node.position[0])*.58,.70,node.position[2]*.12],system,confidence,description:'头盔通信耳罩。',selectable:false});
    const shoulders=[[-.24,torso[1]+.16,torso[2]],[.24,torso[1]+.16,torso[2]]];
    shoulders.forEach((s,i)=>{
      const side=i===0?-1:1;
      const elbow=[side*.28,torso[1]-.03,torso[2]-.27];
      const hand=[cfg.armTarget[0]+side*.12,cfg.armTarget[1],cfg.armTarget[2]];
      this.addPart({name:`${role}${side<0?'左':'右'}上臂`,geo:'cylinder12',material:'uniform',node,matrix:matrixFromYToDirection(s,elbow,.10),tint:cfg.roleTint,layer,explode:[side*.2+Math.sign(node.position[0])*.48,.35,node.position[2]*.12],system,confidence,description:'乘员骨架上臂。',selectable:false});
      this.addPart({name:`${role}${side<0?'左':'右'}前臂`,geo:'cylinder12',material:'uniform',node,matrix:matrixFromYToDirection(elbow,hand,.085),tint:cfg.roleTint,layer,explode:[side*.25+Math.sign(node.position[0])*.48,.30,node.position[2]*.14],system,confidence,description:'伸向操纵器/显示器的前臂。',selectable:false});
      this.addPart({name:`${role}${side<0?'左':'右'}手`,geo:'sphere',material:'skin',node,pos:hand,scale:[.14,.12,.16],layer,explode:[side*.28+Math.sign(node.position[0])*.48,.28,node.position[2]*.14],system,confidence,description:'手部轮廓。',selectable:false});
    });
    for(const side of [-1,1]){
      const hip=[side*cfg.legSpread,torso[1]-.40,torso[2]+.05];
      const knee=[side*(cfg.legSpread+.06),torso[1]-.68,torso[2]-.35];
      const foot=[side*(cfg.legSpread+.05),torso[1]-.78,torso[2]-.68];
      this.addPart({name:`${role}${side<0?'左':'右'}大腿`,geo:'cylinder12',material:'uniform',node,matrix:matrixFromYToDirection(hip,knee,.13),tint:cfg.roleTint,layer,explode:[side*.25+Math.sign(node.position[0])*.45,-.08,node.position[2]*.16],system,confidence,description:'坐姿大腿骨架。',selectable:false});
      this.addPart({name:`${role}${side<0?'左':'右'}小腿`,geo:'cylinder12',material:'uniform',node,matrix:matrixFromYToDirection(knee,foot,.105),tint:cfg.roleTint,layer,explode:[side*.28+Math.sign(node.position[0])*.45,-.22,node.position[2]*.18],system,confidence,description:'坐姿小腿骨架。',selectable:false});
      this.addPart({name:`${role}${side<0?'左':'右'}靴`,geo:'box',material:'helmet',node,pos:[foot[0],foot[1],foot[2]-.08],scale:[.20,.14,.34],layer,explode:[side*.3+Math.sign(node.position[0])*.45,-.25,node.position[2]*.19],system,confidence,description:'乘员作战靴。',selectable:false});
    }
    this.addPart({name:`${role}胸前装具`,geo:'box',material:'helmet',node,pos:[0,torso[1]+.02,torso[2]-.18],scale:[.34,.32,.08],layer,explode:[Math.sign(node.position[0])*.5,.38,node.position[2]*.12],system,confidence,description:'胸前通信与安全装具轮廓。'});
  }

  setVariant(variant){
    if(!VARIANT_DATA[variant])return;
    this.variant=variant; this.updateBatches(true);
  }
  setXray(mode,alpha=this.shellAlpha){ this.xrayMode=mode; this.shellAlpha=alpha; this.updateBatches(true); }
  setExplode(value){ this.explode=clamp(value,0,1); this.updateBatches(true); }
  setTurret(yawDeg){ this.turretNode.rotation[1]=yawDeg*DEG; this.updateBatches(true); }
  setGun(elevDeg){ this.gunPivotNode.rotation[0]=elevDeg*DEG; this.updateBatches(true); }
  setLayer(layer,visible){ this.layerVisibility[layer]=visible; this.updateBatches(true); }
  setSelected(part){ this.selectedPart=part||null; this.updateBatches(false); }

  isVisible(part){
    if(!part.variants.has(this.variant))return false;
    if(!this.layerVisibility[part.layer])return false;
    if(this.xrayMode==='cutaway' && part.side==='left' && (part.shell || part.layer==='mobility'))return false;
    return true;
  }

  paletteTint(part){
    if(!part.paletteRole)return part.tint;
    return new Float32Array(VARIANT_DATA[this.variant].palette[part.paletteRole]||part.tint);
  }

  updateBatches(markShadow=false){
    this.root.update();
    const grouped=new Map();
    for(const batch of this.renderer.batches)grouped.set(batch,[]);
    const trans=M4.create(); const world=M4.create();
    for(const part of this.parts){
      if(!this.isVisible(part))continue;
      M4.multiply(world,part.node.worldMatrix,part.localMatrix);
      if(this.explode>0.0001){
        M4.translation(trans,part.explode[0]*this.explode,part.explode[1]*this.explode,part.explode[2]*this.explode);
        M4.multiply(part.worldMatrix,trans,world);
      } else M4.copy(part.worldMatrix,world);
      M4.normalFromModel(part.normalMatrix,part.worldMatrix);
      const center=V3.create(0,0,0); V3.transformPoint(part.worldCenter,center,part.worldMatrix);
      const sx=Math.hypot(part.worldMatrix[0],part.worldMatrix[1],part.worldMatrix[2]);
      const sy=Math.hypot(part.worldMatrix[4],part.worldMatrix[5],part.worldMatrix[6]);
      const sz=Math.hypot(part.worldMatrix[8],part.worldMatrix[9],part.worldMatrix[10]);
      part.worldRadius=part.focusRadius||part.batch.geometry.radius*Math.max(sx,sy,sz);
      let alpha=1;
      if(this.xrayMode==='xray'&&part.shell)alpha=this.shellAlpha;
      const selected=this.selectedPart===part?1:0;
      const highlighted=this.diffHighlight&&part.diff&&part.variants.has(this.variant)?1:0;
      grouped.get(part.batch).push({modelMatrix:part.worldMatrix,normalMatrix:part.normalMatrix,tint:this.paletteTint(part),meta:new Float32Array([alpha,selected,highlighted,0]),part});
    }
    for(const [batch,records] of grouped){
      batch.isTransparent=batch.baseTransparent||(batch.shell&&this.xrayMode==='xray');
      batch.update(records);
    }
    if(markShadow)this.renderer.shadowDirty=true;
  }

  pick(rayOrigin,rayDir){
    let best=null,bestT=Infinity;
    for(const part of this.parts){
      if(!part.selectable||!this.isVisible(part))continue;
      const oc=V3.create(); V3.sub(oc,rayOrigin,part.worldCenter);
      const b=V3.dot(oc,rayDir); const c=V3.dot(oc,oc)-part.worldRadius*part.worldRadius;
      const disc=b*b-c;
      if(disc<0)continue;
      const t=-b-Math.sqrt(disc);
      if(t>0&&t<bestT){bestT=t;best=part;}
    }
    return best;
  }

  getBounds(filter=()=>true){
    const min=V3.create(Infinity,Infinity,Infinity),max=V3.create(-Infinity,-Infinity,-Infinity);
    let found=false;
    for(const p of this.parts){
      if(!this.isVisible(p)||!filter(p))continue; found=true;
      const r=p.worldRadius,c=p.worldCenter;
      min[0]=Math.min(min[0],c[0]-r);min[1]=Math.min(min[1],c[1]-r);min[2]=Math.min(min[2],c[2]-r);
      max[0]=Math.max(max[0],c[0]+r);max[1]=Math.max(max[1],c[1]+r);max[2]=Math.max(max[2],c[2]+r);
    }
    if(!found)return {center:V3.create(0,1,0),radius:4};
    const center=V3.create((min[0]+max[0])*.5,(min[1]+max[1])*.5,(min[2]+max[2])*.5);
    return {center,radius:Math.max(V3.distance(center,min),1)};
  }

  getSystemBounds(systemKey){
    const predicates={
      driver:p=>p.system.includes('驾驶'),
      fighting:p=>['战斗舱','自动装弹机','弹药与自动装填','炮尾与后坐系统','乘员战位','炮塔驱动','观瞄与火控'].some(s=>p.system.includes(s)),
      power:p=>p.system.includes('动力舱'),
    };
    return this.getBounds(predicates[systemKey]||(()=>true));
  }
}


M4.orthographicZO = function(out,left,right,bottom,top,near,far){
  out.fill(0);
  out[0]=2/(right-left); out[5]=2/(top-bottom); out[10]=1/(near-far);
  out[12]=(left+right)/(left-right); out[13]=(top+bottom)/(bottom-top); out[14]=near/(near-far); out[15]=1;
  return out;
};

function halton(index,base){
  let f=1,r=0,i=index;
  while(i>0){f/=base;r+=f*(i%base);i=Math.floor(i/base);} return r;
}

class CameraController {
  constructor(canvas,onInteraction,onPick){
    this.canvas=canvas; this.onInteraction=onInteraction; this.onPick=onPick;
    this.mode='orbit'; this.target=V3.create(0,1.25,-.15); this.yaw=2.42; this.pitch=.28; this.distance=11.5;
    this.position=V3.create(); this.freePosition=V3.create(7,4,-9); this.freeYaw=-.65; this.freePitch=-.10;
    this.focalLength=50; this.fStop=5.6; this.focusDistance=10; this.near=.08; this.far=120;
    this.keys=new Set(); this.drag=null; this.lastPointer=[0,0]; this.pointerTravel=0;
    this.view=M4.create();this.proj=M4.create();this.viewProj=M4.create();this.invViewProj=M4.create();
    this.right=V3.create(1,0,0);this.up=V3.create(0,1,0);this.forward=V3.create(0,0,-1);
    this.animation=null;
    this.bindEvents();
    this.updatePose();
  }

  bindEvents(){
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{
      this.canvas.setPointerCapture(e.pointerId);
      this.drag={id:e.pointerId,button:e.button,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY};
      this.pointerTravel=0; this.onInteraction('pointer');
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!this.drag||this.drag.id!==e.pointerId)return;
      const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
      this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;this.pointerTravel+=Math.hypot(dx,dy);
      if(this.mode==='orbit'){
        if(this.drag.button===2||e.shiftKey){
          const panScale=this.distance*.0015;
          V3.mad(this.target,this.target,this.right,-dx*panScale);
          V3.mad(this.target,this.target,this.up,dy*panScale);
        }else{
          this.yaw-=dx*.006; this.pitch=clamp(this.pitch-dy*.0055,-1.2,1.35);
        }
      }else{
        this.freeYaw-=dx*.0055; this.freePitch=clamp(this.freePitch-dy*.005,-1.48,1.48);
      }
      this.animation=null; this.updatePose(); this.onInteraction('camera');
    });
    this.canvas.addEventListener('pointerup',e=>{
      if(this.drag&&this.drag.id===e.pointerId){
        const click=this.pointerTravel<5&&this.drag.button===0;
        this.drag=null;
        if(click)this.onPick(e.clientX,e.clientY);
      }
    });
    this.canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      if(this.mode==='orbit')this.distance=clamp(this.distance*Math.exp(e.deltaY*.001),2.2,42);
      else V3.mad(this.freePosition,this.freePosition,this.forward,-e.deltaY*.003);
      this.animation=null;this.updatePose();this.onInteraction('camera');
    },{passive:false});
    window.addEventListener('keydown',e=>{
      if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
  }

  setMode(mode){
    if(mode===this.mode)return;
    if(mode==='free'){
      this.freePosition.set(this.position);
      const f=this.forward;
      this.freeYaw=Math.atan2(f[0],f[2]);
      this.freePitch=Math.asin(clamp(f[1],-1,1));
    }else{
      this.target=V3.create(0,1.25,-.15);
      const d=V3.create();V3.sub(d,this.position,this.target);this.distance=V3.len(d);
      this.yaw=Math.atan2(d[0],d[2]);this.pitch=Math.asin(clamp(d[1]/this.distance,-1,1));
    }
    this.mode=mode;this.updatePose();this.onInteraction('camera-mode');
  }

  setPreset(name){
    const presets={
      hero:{target:[0,1.25,-.15],yaw:2.42,pitch:.28,distance:11.5},
      front:{target:[0,1.35,-.55],yaw:Math.PI,pitch:.13,distance:12.2},
      side:{target:[0,1.30,-.10],yaw:Math.PI/2,pitch:.11,distance:12.0},
      top:{target:[0,0.95,-.10],yaw:2.45,pitch:1.22,distance:13.4},
    };
    const p=presets[name]||presets.hero;this.animateTo(p.target,p.distance,p.yaw,p.pitch);
  }

  animateTo(target,distance,yaw=this.yaw,pitch=this.pitch,duration=.7){
    if(this.mode!=='orbit')this.setMode('orbit');
    this.animation={start:performance.now()/1000,duration,fromTarget:V3.clone(this.target),toTarget:V3.create(...target),fromDistance:this.distance,toDistance:distance,fromYaw:this.yaw,toYaw:yaw,fromPitch:this.pitch,toPitch:pitch};
    this.onInteraction('camera-animation');
  }

  focusBounds(bounds,direction=null){
    const fov=this.verticalFov();
    const distance=clamp(bounds.radius/Math.tan(fov*.5)*.72,2.5,28);
    const yaw=direction?.yaw??this.yaw; const pitch=direction?.pitch??clamp(this.pitch,.08,.55);
    this.animateTo(bounds.center,distance,yaw,pitch,.8);
  }

  verticalFov(){
    const sensorHeight=24;
    return 2*Math.atan(sensorHeight/(2*this.focalLength));
  }

  update(dt){
    let moving=false;
    if(this.animation){
      const now=performance.now()/1000;
      const t=clamp((now-this.animation.start)/this.animation.duration,0,1);
      const e=t*t*(3-2*t),a=this.animation;
      for(let i=0;i<3;i++)this.target[i]=lerp(a.fromTarget[i],a.toTarget[i],e);
      this.distance=lerp(a.fromDistance,a.toDistance,e);this.yaw=lerp(a.fromYaw,a.toYaw,e);this.pitch=lerp(a.fromPitch,a.toPitch,e);
      moving=true;if(t>=1)this.animation=null;
    }
    if(this.mode==='free'&&this.keys.size){
      const speed=(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?9:3.8)*dt;
      const planarRight=this.right;
      if(this.keys.has('KeyW'))V3.mad(this.freePosition,this.freePosition,this.forward,speed);
      if(this.keys.has('KeyS'))V3.mad(this.freePosition,this.freePosition,this.forward,-speed);
      if(this.keys.has('KeyD'))V3.mad(this.freePosition,this.freePosition,planarRight,speed);
      if(this.keys.has('KeyA'))V3.mad(this.freePosition,this.freePosition,planarRight,-speed);
      if(this.keys.has('KeyE'))this.freePosition[1]+=speed;
      if(this.keys.has('KeyQ'))this.freePosition[1]-=speed;
      moving=true;
    }
    if(moving){this.updatePose();this.onInteraction('camera-motion');}
    return moving;
  }

  updatePose(){
    if(this.mode==='orbit'){
      const cp=Math.cos(this.pitch);
      this.position[0]=this.target[0]+this.distance*cp*Math.sin(this.yaw);
      this.position[1]=this.target[1]+this.distance*Math.sin(this.pitch);
      this.position[2]=this.target[2]+this.distance*cp*Math.cos(this.yaw);
      V3.sub(this.forward,this.target,this.position);V3.normalize(this.forward,this.forward);
    }else{
      this.position.set(this.freePosition);
      this.forward[0]=Math.sin(this.freeYaw)*Math.cos(this.freePitch);
      this.forward[1]=Math.sin(this.freePitch);
      this.forward[2]=Math.cos(this.freeYaw)*Math.cos(this.freePitch);
      V3.normalize(this.forward,this.forward);
      V3.add(this.target,this.position,this.forward);
    }
    V3.cross(this.right,this.forward,[0,1,0]);V3.normalize(this.right,this.right);
    V3.cross(this.up,this.right,this.forward);V3.normalize(this.up,this.up);
  }

  getMatrices(width,height,sampleIndex=0,tile=null){
    this.updatePose();
    const jitterX=sampleIndex>0?halton(sampleIndex,2)-.5:0;
    const jitterY=sampleIndex>0?halton(sampleIndex,3)-.5:0;
    M4.lookAtRH(this.view,this.position,this.target,[0,1,0]);
    const fov=this.verticalFov();
    if(tile){
      const fullAspect=tile.fullWidth/tile.fullHeight;
      const top=Math.tan(fov/2)*this.near,bottom=-top,right=top*fullAspect,left=-right;
      const fullW=right-left,fullH=top-bottom;
      const l=left+fullW*(tile.x/tile.fullWidth)+jitterX*fullW/tile.fullWidth;
      const r=left+fullW*((tile.x+tile.width)/tile.fullWidth)+jitterX*fullW/tile.fullWidth;
      const t=top-fullH*(tile.y/tile.fullHeight)-jitterY*fullH/tile.fullHeight;
      const b=top-fullH*((tile.y+tile.height)/tile.fullHeight)-jitterY*fullH/tile.fullHeight;
      M4.perspectiveOffCenterZO(this.proj,l,r,b,t,this.near,this.far);
    }else{
      M4.perspectiveZO(this.proj,fov,width/height,this.near,this.far);
      this.proj[8]+=jitterX*2/width;
      this.proj[9]-=jitterY*2/height;
    }
    M4.multiply(this.viewProj,this.proj,this.view);
    M4.invert(this.invViewProj,this.viewProj);
    return {view:this.view,proj:this.proj,viewProj:this.viewProj,invViewProj:this.invViewProj,cameraPos:this.position,cameraRight:this.right,cameraUp:this.up};
  }

  makeRay(clientX,clientY,rect){
    const x=(clientX-rect.left)/rect.width*2-1;
    const y=1-(clientY-rect.top)/rect.height*2;
    const far=V3.create();
    const p=[x,y,1];V3.transformPoint(far,p,this.invViewProj);
    const dir=V3.create();V3.sub(dir,far,this.position);V3.normalize(dir,dir);
    return {origin:V3.clone(this.position),dir};
  }
}

const ENVIRONMENTS={
  desert:{
    top:[.12,.32,.52],horizon:[.58,.68,.66],ground:[.37,.23,.12],sunDir:[.46,-1,.28],sunColor:[1.0,.83,.58],sunIntensity:6.2,sunDisk:1.25,wind:.8,
    points:[
      {position:[-7,7,-5],radius:18,color:[1,.72,.45],intensity:7},
      {position:[7,4,2],radius:14,color:[.45,.67,1],intensity:3.2},
      {position:[0,2,8],radius:12,color:[1,.40,.18],intensity:1.2},
    ],
  },
  overcast:{
    top:[.28,.34,.39],horizon:[.48,.53,.54],ground:[.25,.29,.27],sunDir:[-.28,-1,.40],sunColor:[.72,.80,.86],sunIntensity:2.6,sunDisk:.16,wind:.35,
    points:[
      {position:[-6,6,-4],radius:19,color:[.66,.78,.92],intensity:4.5},
      {position:[8,3,-1],radius:18,color:[.72,.77,.80],intensity:3.5},
      {position:[0,4,8],radius:16,color:[.55,.63,.68],intensity:2.4},
    ],
  },
  studio:{
    top:[.018,.027,.038],horizon:[.055,.072,.083],ground:[.024,.028,.030],sunDir:[.20,-1,-.30],sunColor:[.56,.69,.78],sunIntensity:1.1,sunDisk:0,wind:0,
    points:[
      {position:[-5,7,-6],radius:17,color:[.80,.94,1],intensity:19},
      {position:[6,4,-2],radius:15,color:[1,.69,.42],intensity:11},
      {position:[0,3,7],radius:14,color:[.30,.55,1],intensity:8},
    ],
  },
};

class VT4App {
  constructor(){
    this.canvas=$('#gpuCanvas');this.loading=$('#loadingOverlay');this.loadingStep=$('#loadingStep');
    this.renderer=new WebGPURenderer(this.canvas);this.model=null;this.camera=null;
    this.activeTab='assembly';this.renderMode='preview';this.environmentName='desert';this.maxSamples=128;
    this.exposure=0;this.contrast=1.05;this.toneMapping='aces';this.dustIntensity=.45;this.aoIntensity=.72;
    this.lastInteraction=performance.now();this.lastTime=performance.now();this.accumulationClock=0;this.exporting=false;
    this.dirty=true;this.fpsFrames=0;this.fpsTime=performance.now();this.lastFps=0;this.toastTimer=0;
    this.autoExplode=null;
  }

  async init(){
    try{
      await this.renderer.init(step=>this.loadingStep.textContent=step);
      this.loadingStep.textContent='构建 VT-4 程序化装配体…';await nextFrame();
      this.model=new VT4Model(this.renderer);
      this.camera=new CameraController(this.canvas,()=>this.markInteraction(),(x,y)=>this.pickAt(x,y));
      this.bindUI();this.setupResize();this.updateVariantUI();this.updateInspector(null);
      const info=this.renderer.adapter.info||{};
      $('#telemetryBackend').textContent=info.description||info.device||'WebGPU';
      $('#backendLabel').textContent='WEBGPU';
      $('#footerState').textContent='READY';$('#footerDetail').textContent='原生 WebGPU 渲染管线已启动';
      this.loading.classList.add('done');
      setTimeout(()=>this.loading.remove(),500);
      window.addEventListener('vt4-device-lost',e=>this.showFatal('WebGPU Device 已丢失',e.detail?.message||'请刷新页面重新初始化。'));
      window.addEventListener('vt4-gpu-error',e=>{
        document.documentElement.dataset.vt4RuntimeError=String(e.detail?.message||e.detail||'Unknown WebGPU error');
      });
      this.renderer.shadowDirty=true;
      const smokeTest=new URLSearchParams(location.search).get('smoke')==='1';
      if(smokeTest){
        this.renderer.device.pushErrorScope('validation');
        const frame=this.makeFrame(0,false,0,null);
        this.renderer.render(frame,{accumulate:false,particles:true});
        await this.renderer.device.queue.onSubmittedWorkDone();
        const frameError=await this.renderer.device.popErrorScope();
        if(frameError)throw new Error(`首帧验证失败：${frameError.message}`);
        document.documentElement.dataset.vt4Status='ready';
        document.documentElement.dataset.vt4Instances=String(this.renderer.stats.instances);
        document.documentElement.dataset.vt4DrawCalls=String(this.renderer.stats.drawCalls);
        $('#footerDetail').textContent=`SMOKE PASS · ${this.renderer.stats.instances} instances`;
      }else{
        requestAnimationFrame(t=>this.loop(t));
      }
    }catch(error){
      console.error(error);document.documentElement.dataset.vt4Status='error';
      document.documentElement.dataset.vt4Error=String(error?.message||error);
      this.showFatal('WebGPU 初始化失败',error.stack||String(error));
    }
  }

  showFatal(message,details=''){
    $('#unsupported').classList.remove('hidden');$('#fatalMessage').textContent=message;$('#fatalDetails').textContent=details;
  }

  bindUI(){
    $$('.tab-button').forEach(btn=>btn.addEventListener('click',()=>this.setTab(btn.dataset.tab)));
    $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{
      $$('[data-view]').forEach(b=>b.classList.toggle('active',b===btn));this.camera.setPreset(btn.dataset.view);this.markInteraction();
    }));
    const explode=$('#explodeRange');explode.addEventListener('input',()=>{
      this.autoExplode=null;const v=+explode.value/100;$('#explodeValue').textContent=`${explode.value}%`;this.model.setExplode(v);this.markInteraction();
    });
    $('#explodeAuto').addEventListener('click',()=>{
      this.autoExplode={start:performance.now(),from:this.model.explode,to:this.model.explode>.5?0:1,duration:1100};this.markInteraction();
    });
    $('#resetAssembly').addEventListener('click',()=>{
      explode.value=0;$('#explodeValue').textContent='0%';$('#turretRange').value=0;$('#turretValue').textContent='0°';$('#gunRange').value=0;$('#gunValue').textContent='0°';
      this.model.setExplode(0);this.model.setTurret(0);this.model.setGun(0);this.camera.setPreset('hero');this.markInteraction();
    });
    $('#turretRange').addEventListener('input',e=>{const v=+e.target.value;$('#turretValue').textContent=`${v}°`;this.model.setTurret(v);this.markInteraction();});
    $('#gunRange').addEventListener('input',e=>{const v=+e.target.value;$('#gunValue').textContent=`${v.toFixed(1)}°`;this.model.setGun(v);this.markInteraction();});
    $$('[data-layer]').forEach(input=>input.addEventListener('change',()=>{this.model.setLayer(input.dataset.layer,input.checked);this.markInteraction();}));

    $$('.variant-card').forEach(btn=>btn.addEventListener('click',()=>this.setVariant(btn.dataset.variant)));
    $('#diffHighlight').addEventListener('change',e=>{this.model.diffHighlight=e.target.checked;this.model.updateBatches(false);this.markInteraction();});
    $$('[data-xray]').forEach(btn=>btn.addEventListener('click',()=>{
      $$('[data-xray]').forEach(b=>b.classList.toggle('active',b===btn));this.model.setXray(btn.dataset.xray,+$('#shellAlphaRange').value/100);this.markInteraction();
    }));
    $('#shellAlphaRange').addEventListener('input',e=>{const a=+e.target.value/100;$('#shellAlphaValue').textContent=`${e.target.value}%`;this.model.shellAlpha=a;if(this.model.xrayMode==='xray')this.model.setXray('xray',a);this.markInteraction();});

    $$('[data-render-mode]').forEach(btn=>btn.addEventListener('click',()=>{
      $$('[data-render-mode]').forEach(b=>b.classList.toggle('active',b===btn));this.renderMode=btn.dataset.renderMode;this.markInteraction();
    }));
    $('#maxSamplesRange').addEventListener('input',e=>{this.maxSamples=+e.target.value;$('#maxSamplesValue').textContent=e.target.value;this.renderer.resetAccumulation();this.dirty=true;});
    $$('[data-environment]').forEach(btn=>btn.addEventListener('click',()=>{
      $$('[data-environment]').forEach(b=>b.classList.toggle('active',b===btn));this.environmentName=btn.dataset.environment;this.renderer.shadowDirty=true;this.markInteraction();
    }));
    $('#dustRange').addEventListener('input',e=>{this.dustIntensity=+e.target.value/100;$('#dustValue').textContent=`${e.target.value}%`;this.markInteraction();});
    $$('[data-camera-mode]').forEach(btn=>btn.addEventListener('click',()=>{
      $$('[data-camera-mode]').forEach(b=>b.classList.toggle('active',b===btn));this.camera.setMode(btn.dataset.cameraMode);this.markInteraction();
    }));
    $('#focalRange').addEventListener('input',e=>{this.camera.focalLength=+e.target.value;$('#focalValue').textContent=`${e.target.value} mm`;this.markInteraction();});
    $('#apertureRange').addEventListener('input',e=>{this.camera.fStop=+e.target.value/10;$('#apertureValue').textContent=`f/${this.camera.fStop.toFixed(1)}`;this.markInteraction();});
    $('#focusRange').addEventListener('input',e=>{this.camera.focusDistance=+e.target.value;$('#focusValue').textContent=`${(+e.target.value).toFixed(1)} m`;this.markInteraction();});
    $('#exposureRange').addEventListener('input',e=>{this.exposure=+e.target.value/10;$('#exposureValue').textContent=`${this.exposure>=0?'+':''}${this.exposure.toFixed(1)} EV`;this.markInteraction();});
    $('#contrastRange').addEventListener('input',e=>{this.contrast=+e.target.value/100;$('#contrastValue').textContent=this.contrast.toFixed(2);this.markInteraction();});
    $('#toneMappingSelect').addEventListener('change',e=>{this.toneMapping=e.target.value;this.markInteraction();});
    $('#exportButton').addEventListener('click',()=>this.exportImage());

    $('#clearSelection').addEventListener('click',()=>{this.model.setSelected(null);this.updateInspector(null);this.markInteraction();});
    $('#focusSelection').addEventListener('click',()=>{if(this.model.selectedPart)this.camera.focusBounds({center:this.model.selectedPart.worldCenter,radius:Math.max(this.model.selectedPart.worldRadius,1.0)});});
    $$('[data-focus-system]').forEach(btn=>btn.addEventListener('click',()=>{this.camera.focusBounds(this.model.getSystemBounds(btn.dataset.focusSystem));this.markInteraction();}));
  }

  setTab(tab){
    this.activeTab=tab;
    $$('.tab-button').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
    $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab));
    const labels={assembly:'ASSEMBLY INSPECTION',research:'VARIANT & INTERIOR FORENSICS',studio:'PROFESSIONAL RENDER STUDIO'};
    $('#viewHud').textContent=labels[tab];
    this.markInteraction();
  }

  setVariant(variant){
    this.model.setVariant(variant);
    $$('.variant-card').forEach(b=>b.classList.toggle('active',b.dataset.variant===variant));
    this.updateVariantUI();
    if($('#autoFocusDiff').checked){
      const direction=variant==='a1'?{yaw:2.30,pitch:.34}:variant==='p'?{yaw:1.72,pitch:.20}:{yaw:2.42,pitch:.28};
      this.camera.focusBounds(this.model.getBounds(p=>p.diff&&p.variants.has(variant)),direction);
    }
    this.model.setSelected(null);this.updateInspector(null);this.markInteraction();
  }

  updateVariantUI(){
    const data=VARIANT_DATA[this.model.variant];
    $('#variantHud').textContent=data.label;$('#variantConfidence').textContent=data.confidence;
    $('#variantDiffList').innerHTML=data.differences.map(([title,desc])=>`<div class="diff-item"><b>${title}</b><span>${desc}</span></div>`).join('');
  }

  setupResize(){
    const resize=()=>{
      const rect=this.canvas.getBoundingClientRect();
      this.renderer.resize(rect.width,rect.height,window.devicePixelRatio||1,true);this.dirty=true;
      $('#resolutionLabel').textContent=`${this.renderer.width}×${this.renderer.height}`;
    };
    this.resizeObserver=new ResizeObserver(debounce(resize,80));this.resizeObserver.observe(this.canvas);resize();
  }

  markInteraction(){
    this.lastInteraction=performance.now();this.renderer.resetAccumulation();this.dirty=true;
  }

  updateAutoExplode(now){
    if(!this.autoExplode)return;
    const t=clamp((now-this.autoExplode.start)/this.autoExplode.duration,0,1);const e=t*t*(3-2*t);
    const v=lerp(this.autoExplode.from,this.autoExplode.to,e);this.model.setExplode(v);
    $('#explodeRange').value=Math.round(v*100);$('#explodeValue').textContent=`${Math.round(v*100)}%`;
    this.lastInteraction=now;this.dirty=true;if(t>=1)this.autoExplode=null;
  }

  computeLightMatrix(env){
    const center=[0,1.0,0];
    const lightPos=[center[0]-env.sunDir[0]*18,center[1]-env.sunDir[1]*18,center[2]-env.sunDir[2]*18];
    const view=M4.create(),proj=M4.create(),out=M4.create();
    M4.lookAtRH(view,lightPos,center,[0,1,0]);M4.orthographicZO(proj,-8.5,8.5,-7.0,8.5,.1,45);M4.multiply(out,proj,view);return out;
  }

  makeFrame(dt,accumulate,sampleIndex=0,tile=null){
    const env=ENVIRONMENTS[this.environmentName];
    const matrices=this.camera.getMatrices(this.renderer.width,this.renderer.height,sampleIndex,tile);
    const time=accumulate?this.accumulationClock:performance.now()/1000;
    return {...matrices,lightViewProj:this.computeLightMatrix(env),time,dt:accumulate?0:dt,env,environmentIndex:Object.keys(ENVIRONMENTS).indexOf(this.environmentName),sunDir:env.sunDir,sunColor:env.sunColor,sunIntensity:env.sunIntensity,pointLights:env.points,xray:this.model.xrayMode==='xray',near:this.camera.near,far:this.camera.far,focusDistance:this.camera.focusDistance,apertureStrength:clamp((11/this.camera.fStop)*1.7,0,8),exposure:this.exposure,contrast:this.contrast,toneMapping:this.toneMapping,aoIntensity:this.aoIntensity,dofEnabled:this.camera.fStop<13,dustIntensity:this.model.layerVisibility.effects?this.dustIntensity:0,grain:accumulate?.18:.45};
  }

  pickAt(clientX,clientY){
    const rect=this.canvas.getBoundingClientRect();const ray=this.camera.makeRay(clientX,clientY,rect);const part=this.model.pick(ray.origin,ray.dir);
    this.model.setSelected(part);this.updateInspector(part);this.markInteraction();
    if(part)this.toast(`${part.name} · ${part.system}`);
  }

  updateInspector(part){
    $('#selectionEmpty').classList.toggle('hidden',Boolean(part));$('#selectionContent').classList.toggle('hidden',!part);
    if(!part)return;
    $('#selectionCode').textContent=part.code;$('#selectionName').textContent=part.name;$('#selectionSystem').textContent=part.system;
    const labels={high:'公开影像高置信',medium:'同系结构推定',concept:'概念化内构'};
    const chip=$('#selectionConfidence');chip.textContent=labels[part.confidence]||labels.high;chip.className=`confidence-chip ${part.confidence}`;
    $('#selectionDescription').textContent=part.description||'程序化部件。';
    const variantText=part.variants.size===3?'全改型共用':[...part.variants].map(v=>VARIANT_DATA[v].short).join(' / ');
    const specs={适用构型:variantText,系统层级:part.layer,...part.specs};
    $('#selectionSpecs').innerHTML=Object.entries(specs).map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  toast(message){
    const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
  }

  updateTelemetry(accumulating){
    $('#drawCallLabel').textContent=this.renderer.stats.drawCalls;$('#instanceLabel').textContent=this.renderer.stats.instances;
    $('#sampleLabel').textContent=accumulating?this.renderer.sampleCount:1;
    $('#accumulationState').textContent=accumulating?'ACTIVE':'OFF';
    $('#sampleProgress').style.width=`${clamp(this.renderer.sampleCount/this.maxSamples*100,0,100)}%`;
    $('#resolutionLabel').textContent=`${this.renderer.width}×${this.renderer.height}`;
  }

  updateFps(now){
    this.fpsFrames++;
    if(now-this.fpsTime>=500){this.lastFps=Math.round(this.fpsFrames*1000/(now-this.fpsTime));this.fpsFrames=0;this.fpsTime=now;$('#fpsLabel').textContent=this.lastFps;}
  }

  async exportImage(){
    if(this.exporting)return;
    this.exporting=true;const button=$('#exportButton'),status=$('#exportStatus');button.disabled=true;button.textContent='正在准备分块渲染…';
    const [fullWidth,fullHeight]=$('input[name="exportSize"]:checked').value.split('x').map(Number);
    const tileSize=2048,cols=Math.ceil(fullWidth/tileSize),rows=Math.ceil(fullHeight/tileSize);
    const samples=fullWidth>=7000?8:16;
    const output=document.createElement('canvas');output.width=fullWidth;output.height=fullHeight;const ctx=output.getContext('2d',{alpha:false});
    const oldScale=this.renderer.renderScale;const rect=this.canvas.getBoundingClientRect();
    try{
      this.renderer.renderScale=1;this.accumulationClock=performance.now()/1000;
      let completed=0;const total=cols*rows;
      for(let row=0;row<rows;row++){
        for(let col=0;col<cols;col++){
          const x=col*tileSize,y=row*tileSize,w=Math.min(tileSize,fullWidth-x),h=Math.min(tileSize,fullHeight-y);
          status.textContent=`分块 ${completed+1}/${total} · ${w}×${h} · ${samples} 次累积采样`;
          button.textContent=`渲染分块 ${completed+1} / ${total}`;
          this.renderer.resize(w,h,1,true);this.renderer.resetAccumulation();
          const tile={x,y,width:w,height:h,fullWidth,fullHeight};
          for(let s=1;s<=samples;s++){
            const frame=this.makeFrame(0,true,s,tile);
            this.renderer.render(frame,{accumulate:true,particles:true,capture:s===samples});
            if(s%4===0)await nextFrame();
          }
          await this.renderer.device.queue.onSubmittedWorkDone();
          const pixels=await this.renderer.readCaptureRGBA();
          ctx.putImageData(new ImageData(pixels,w,h),x,y);completed++;
        }
      }
      status.textContent='编码无损 PNG…';button.textContent='正在编码 PNG';
      const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('PNG 编码失败')),'image/png'));
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`VT4_${this.model.variant}_${fullWidth}x${fullHeight}_${new Date().toISOString().slice(0,10)}.png`;a.click();
      setTimeout(()=>URL.revokeObjectURL(url),2000);status.textContent=`已导出 ${fullWidth}×${fullHeight} 无损 PNG（${samples} samples/tile）。`;this.toast('大画幅 PNG 导出完成');
    }catch(error){console.error(error);status.textContent=`导出失败：${error.message}`;this.toast('导出失败，请尝试 4K 或降低浏览器显存占用');
    }finally{
      this.renderer.renderScale=oldScale;this.renderer.resize(rect.width,rect.height,window.devicePixelRatio||1,true);this.renderer.resetAccumulation();
      button.disabled=false;button.textContent='开始分块累积并导出';this.exporting=false;this.markInteraction();
    }
  }

  loop(now){
    if(this.exporting){requestAnimationFrame(t=>this.loop(t));return;}
    const dt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;
    this.updateAutoExplode(now);this.camera.update(dt);
    const idle=now-this.lastInteraction>360;
    const accumulating=this.renderMode==='accumulate'&&idle;
    const desiredScale=accumulating?1:(this.renderMode==='accumulate'?.68:.84);
    if(Math.abs(this.renderer.renderScale-desiredScale)>.01){
      this.renderer.renderScale=desiredScale;const rect=this.canvas.getBoundingClientRect();this.renderer.resize(rect.width,rect.height,window.devicePixelRatio||1,true);this.dirty=true;
    }
    let shouldRender=this.renderMode==='preview'||!accumulating||this.renderer.sampleCount<this.maxSamples||this.dirty;
    if(shouldRender){
      if(accumulating&&this.renderer.sampleCount===0)this.accumulationClock=performance.now()/1000;
      const sampleIndex=accumulating?this.renderer.sampleCount+1:0;
      const frame=this.makeFrame(dt,accumulating,sampleIndex,null);
      this.renderer.render(frame,{accumulate:accumulating,particles:true});this.dirty=false;
    }
    this.updateTelemetry(accumulating);this.updateFps(now);
    $('#footerDetail').textContent=accumulating?`静止累积 ${this.renderer.sampleCount}/${this.maxSamples}`:`${VARIANT_DATA[this.model.variant].short} · ${this.activeTab}`;
    requestAnimationFrame(t=>this.loop(t));
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const app=new VT4App();window.vt4App=app;app.init();
});

