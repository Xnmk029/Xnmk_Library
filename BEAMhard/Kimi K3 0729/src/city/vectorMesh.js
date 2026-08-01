/**
 * vectorMesh.js — convert city vector data (roads / buildings / props) into 3D meshes.
 *
 * All builders take THREE as a parameter and return meshes/geometries with
 * local coordinates equal to world coordinates (no transform applied) so the
 * caller can merge or group them freely.
 *
 * Pure-JS tessellation helpers (ribbon triangulation, footprint extrusion)
 * are also exported three-free for Node testing.
 */

/* ------------------------------------------------------ pure tessellation -- */

/**
 * Triangulate a polyline into a flat ribbon of given width (2D, XZ plane).
 * Miter joins with a clamp; bevel fallback on sharp turns.
 * @param {number[][]} points [[x,z],...]
 * @param {number} width full ribbon width (meters)
 * @returns {{positions:number[], indices:number[]}} flat arrays, y=0, 2 verts per input point
 */
export function ribbonTriangles(points, width) {
  const hw = width * 0.5;
  const n = points.length;
  const positions = [];
  const indices = [];
  if (n < 2) return { positions, indices };

  // per-point averaged direction
  const dirs = [];
  for (let i = 0; i < n; i++) {
    let dx = 0, dz = 0;
    if (i > 0) { dx += points[i][0] - points[i - 1][0]; dz += points[i][1] - points[i - 1][1]; }
    if (i < n - 1) { dx += points[i + 1][0] - points[i][0]; dz += points[i + 1][1] - points[i][1]; }
    const L = Math.hypot(dx, dz) || 1;
    dirs.push([dx / L, dz / L]);
  }
  for (let i = 0; i < n; i++) {
    const [dx, dz] = dirs[i];
    // normal to direction
    let nx = -dz, nz = dx;
    // miter clamp: shorten offset on sharp corners
    let scale = 1;
    if (i > 0 && i < n - 1) {
      const [pdx, pdz] = dirs[i - 1];
      const dot = dx * pdx + dz * pdz;
      const miter = Math.sqrt(Math.max(0.05, (1 + dot) / 2));
      scale = 1 / miter;
      scale = Math.min(scale, 2.2);
    }
    const [x, z] = points[i];
    positions.push(x + nx * hw * scale, 0, z + nz * hw * scale);
    positions.push(x - nx * hw * scale, 0, z - nz * hw * scale);
    if (i > 0) {
      const a = (i - 1) * 2, b = (i - 1) * 2 + 1, c = i * 2, d = i * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, indices };
}

/**
 * Extrude a CCW footprint polygon to a height (Y-up). Flat roof, vertical walls.
 * Roof is fan-triangulated (footprints from cityGen are convex rectangles).
 * @param {number[][]} footprint closed CCW [[x,z],...] (last point may repeat the first; tolerated)
 * @param {number} height meters
 * @returns {{positions:number[], normals:number[], indices:number[]}}
 */
export function extrudeTriangles(footprint, height) {
  let pts = footprint.slice();
  if (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) pts = pts.slice(0, -1);
  }
  const n = pts.length;
  const positions = [];
  const normals = [];
  const indices = [];

  // Ensure CCW in XZ when viewed from +Y: positive signed area with (x,z) treated as (x,y)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n];
    area += x0 * z1 - x1 * z0;
  }
  if (area < 0) pts.reverse();

  // roof: centroid fan
  let cx = 0, cz = 0;
  for (const [x, z] of pts) { cx += x; cz += z; }
  cx /= n; cz /= n;
  const roofBase = 0;
  positions.push(cx, height, cz);
  normals.push(0, 1, 0);
  for (const [x, z] of pts) { positions.push(x, height, z); normals.push(0, 1, 0); }
  for (let i = 0; i < n; i++) {
    indices.push(roofBase, roofBase + 1 + i, roofBase + 1 + ((i + 1) % n));
  }
  // walls: quads, outward normals
  const wallBase = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n];
    const ex = x1 - x0, ez = z1 - z0;
    const L = Math.hypot(ex, ez) || 1;
    // outward normal for CCW polygon (viewed from +Y): (ez, -ex)... verify with sign:
    // for CCW square (0,0)->(1,0)->(1,1)->(0,1) in XZ, edge 0 dir=(1,0); outward is -Z => (ez,-ex) = (0,-1). correct.
    const nx = ez / L, nz = -ex / L;
    positions.push(x0, 0, z0, x1, 0, z1, x1, height, z1, x0, height, z0);
    for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
    const b = wallBase + i * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { positions, normals, indices };
}

/* -------------------------------------------------------------- materials -- */

const DISTRICT_TINTS = {
  downtown: { base: 0x8fa3b8, vary: 0.18 }, // cool gray-blue
  midtown: { base: 0xa89e93, vary: 0.15 },  // warm gray
  suburb: { base: 0xc7b9a8, vary: 0.22 },   // pastel
};

/** Cheap emissive-window canvas texture (shared). Returns null without a DOM. */
let _windowTex = null;
function windowTexture(THREE) {
  if (_windowTex || typeof document === 'undefined') return _windowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#202226'; g.fillRect(0, 0, 64, 64);
  for (let y = 4; y < 60; y += 8) {
    for (let x = 4; x < 60; x += 8) {
      const lit = Math.random() < 0.24;
      g.fillStyle = lit ? '#ffd98a' : '#3a3f47';
      g.fillRect(x, y, 5, 5);
    }
  }
  _windowTex = new THREE.CanvasTexture(c);
  _windowTex.wrapS = _windowTex.wrapT = THREE.RepeatWrapping;
  _windowTex.repeat.set(2, 2);
  return _windowTex;
}

/* ---------------------------------------------------------------- exports -- */

/**
 * Build a flat triangulated road ribbon mesh along the road's points.
 * Also returns centerline/edge polylines (y-lifted) for the screen-space line
 * shader — the caller turns them into markings with buildLineStripGeometry.
 *
 * @param {typeof import('../../lib/three.module.js')} THREE
 * @param {{points:number[][], width:number, lanes:number, klass:string}} road
 * @param {number} [y=0.05] lift above ground plane
 * @returns {{mesh: THREE.Mesh, centerlineGeom: {center:number[][][], edges:number[][][]}}}
 */
export function buildRoadRibbon(THREE, road, y = 0.05) {
  const { positions, indices } = ribbonTriangles(road.points, road.width);
  const geom = new THREE.BufferGeometry();
  const lifted = positions.slice();
  for (let i = 1; i < lifted.length; i += 3) lifted[i] = y;
  geom.setAttribute('position', new THREE.Float32BufferAttribute(lifted, 3));
  const normals = new Float32Array(lifted.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();

  const colors = { arterial: 0x33363c, collector: 0x3a3d44, local: 0x41444b };
  const mat = new THREE.MeshLambertMaterial({ color: colors[road.klass] || 0x3a3d44 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;

  // marking polylines (lifted a bit more to avoid z-fighting with the ribbon)
  const my = y + 0.03;
  const lift = (pts, offset) => {
    // offset polyline perpendicular for edge lines
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      let dx = 0, dz = 0;
      if (i > 0) { dx += pts[i][0] - pts[i - 1][0]; dz += pts[i][1] - pts[i - 1][1]; }
      if (i < pts.length - 1) { dx += pts[i + 1][0] - pts[i][0]; dz += pts[i + 1][1] - pts[i][1]; }
      const L = Math.hypot(dx, dz) || 1;
      out.push([pts[i][0] + (-dz / L) * offset, my, pts[i][1] + (dx / L) * offset]);
    }
    return out;
  };
  const edgeOff = road.width * 0.5 - 0.4;
  const centerlineGeom = {
    center: [lift(road.points, 0)],          // dashed centerline
    edges: [lift(road.points, edgeOff), lift(road.points, -edgeOff)], // solid edge lines
  };
  return { mesh, centerlineGeom };
}

/**
 * Extrude a building footprint to its height with a flat roof.
 * Tinted by district (downtown cool gray-blue / midtown warm gray / suburb pastel)
 * with a per-building deterministic variation from its id.
 * @param {typeof import('../../lib/three.module.js')} THREE
 * @param {{id:number, footprint:number[][], height:number, district:string}} b
 * @returns {THREE.Mesh}
 */
export function extrudeBuilding(THREE, b) {
  const { positions, normals, indices } = extrudeTriangles(b.footprint, b.height);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  geom.computeBoundingSphere();

  const tint = DISTRICT_TINTS[b.district] || DISTRICT_TINTS.midtown;
  const c = new THREE.Color(tint.base);
  // deterministic per-building variation
  const v = (((b.id * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
  c.offsetHSL(0, 0, v * tint.vary * 0.5);
  const mat = new THREE.MeshLambertMaterial({ color: c });
  const tex = windowTexture(THREE);
  if (tex && b.district !== 'suburb') { mat.emissive = new THREE.Color(0x665533); mat.emissiveMap = tex; mat.emissiveIntensity = 0.6; }
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = b.height > 30;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build an InstancedMesh for a prop set.
 * kind 'streetlight': dark pole (8 m) with a small head box at the top.
 * kind 'signal': pole (5.5 m) with a 3-lamp signal box.
 * @param {typeof import('../../lib/three.module.js')} THREE
 * @param {Array<{x:number, z:number}>} props
 * @param {'streetlight'|'signal'} kind
 * @returns {THREE.InstancedMesh}
 */
export function buildPropMeshes(THREE, props, kind) {
  // merged unit geometry: pole + head, built manually (no addons)
  const parts = [];
  const addBox = (w, h, d, cx, cy, cz) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(cx, cy, cz);
    parts.push(g);
  };
  let color;
  if (kind === 'streetlight') {
    addBox(0.18, 8, 0.18, 0, 4, 0);        // pole
    addBox(1.4, 0.22, 0.4, 0.6, 7.9, 0);   // head arm
    color = 0x2c2f33;
  } else {
    addBox(0.22, 5.5, 0.22, 0, 2.75, 0);   // pole
    addBox(0.5, 1.4, 0.35, 0, 6.0, 0);     // signal box
    color = 0x222428;
  }
  const geom = mergeGeoms(THREE, parts);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.InstancedMesh(geom, mat, Math.max(1, props.length));
  const m = new THREE.Matrix4();
  for (let i = 0; i < props.length; i++) {
    m.makeTranslation(props[i].x, 0, props[i].z);
    mesh.setMatrixAt(i, m);
  }
  mesh.count = props.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.frustumCulled = true;
  geom.computeBoundingSphere();
  return mesh;
}

/** Minimal geometry merge (positions/normals/uv optional, indexed) — replaces BufferGeometryUtils for our box parts. */
function mergeGeoms(THREE, geoms) {
  const pos = [], norm = [], uv = [], idx = [];
  let base = 0;
  for (const g of geoms) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) norm.push(n.getX(i), n.getY(i), n.getZ(i));
      if (u) uv.push(u.getX(i), u.getY(i));
    }
    const gi = g.getIndex();
    if (gi) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
