import * as THREE from 'three';

/*
 * Window 1 placeholder: static F1 wind tunnel wireframe preview.
 * No solver, no animation - geometry preview only.
 */
export function buildWindTunnelScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141414);

  const group = new THREE.Group();
  scene.add(group);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x3d4853 });
  const dimMat = new THREE.LineBasicMaterial({ color: 0x2c333b });

  // tunnel axis along Z, section centered at x=0.6, y=0.38
  const cx = 0.6;
  const cy = 0.38;
  const w = 0.8;
  const hgt = 0.62;
  const z0 = 0.05;
  const z1 = 1.75;
  const rings = 13;
  for (let i = 0; i < rings; i++) {
    const z = z0 + (z1 - z0) * (i / (rings - 1));
    const pts = [
      new THREE.Vector3(cx - w / 2, cy - hgt / 2, z),
      new THREE.Vector3(cx + w / 2, cy - hgt / 2, z),
      new THREE.Vector3(cx + w / 2, cy + hgt / 2, z),
      new THREE.Vector3(cx - w / 2, cy + hgt / 2, z)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts.concat(pts[0]));
    group.add(new THREE.Line(geo, i % 3 === 0 ? lineMat : dimMat));
  }

  // longitudinal edges
  const corners = [
    [cx - w / 2, cy - hgt / 2],
    [cx + w / 2, cy - hgt / 2],
    [cx + w / 2, cy + hgt / 2],
    [cx - w / 2, cy + hgt / 2]
  ];
  for (const [x, y] of corners) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z0),
      new THREE.Vector3(x, y, z1)
    ]);
    group.add(new THREE.Line(geo, lineMat));
  }

  // floor grid
  const grid = new THREE.GridHelper(1.8, 18, 0x2b3138, 0x21262c);
  grid.position.set(cx, 0, (z0 + z1) / 2);
  scene.add(grid);

  // centerline
  const clPts = [
    new THREE.Vector3(cx, 0.002, z0),
    new THREE.Vector3(cx, 0.002, z1)
  ];
  const clGeo = new THREE.BufferGeometry().setFromPoints(clPts);
  const clLine = new THREE.Line(clGeo, new THREE.LineDashedMaterial({
    color: 0x8a6d3b,
    dashSize: 0.04,
    gapSize: 0.03
  }));
  clLine.computeLineDistances();
  scene.add(clLine);

  // section labels
  scene.add(_label('INLET', 0.6, 0.82, z0 + 0.08, 0x4a5560));
  scene.add(_label('TEST SECTION', 0.6, 0.82, 0.9, 0x7fb7d0));
  scene.add(_label('DIFFUSER', 0.6, 0.82, z1 - 0.08, 0x4a5560));

  return { scene, camera: _camera(), controlsTarget: new THREE.Vector3(0.6, 0.35, 0.9) };
}

function _camera() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
  camera.position.set(1.65, 1.15, 2.2);
  return camera;
}

function _label(text, x, y, z, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '26px Consolas, monospace';
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(0.42, 0.0525, 1);
  return sprite;
}
