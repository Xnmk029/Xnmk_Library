import * as THREE from 'three';

export function buildDamScene(solver) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141414);

  const tank = solver.tank;
  const group = new THREE.Group();
  scene.add(group);

  // tank wireframe edges
  const edgeGeo = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(tank.x, tank.y, tank.z)
  );
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4b5560 });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.set(tank.x / 2, tank.y / 2, tank.z / 2);
  scene.add(edges);

  // faint wall panels (left / right / back / floor tint)
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x27303b,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(tank.x, tank.y), panelMat);
  back.position.set(tank.x / 2, tank.y / 2, 0);
  scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(tank.z, tank.y), panelMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(0, tank.y / 2, tank.z / 2);
  scene.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(tank.z, tank.y), panelMat);
  right.rotation.y = Math.PI / 2;
  right.position.set(tank.x, tank.y / 2, tank.z / 2);
  scene.add(right);

  // grid baseline
  const grid = new THREE.GridHelper(tank.x, 12, 0x39434d, 0x252b31);
  grid.position.set(tank.x / 2, 0.002, tank.z / 2);
  scene.add(grid);

  // axes
  const axisMat = new THREE.LineBasicMaterial({ color: 0x5b6670 });
  const axisX = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(tank.x + 0.12, 0, 0)
  ]);
  const axisY = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, tank.y + 0.12, 0)
  ]);
  const axisZ = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, tank.z + 0.12)
  ]);
  const axes = new THREE.Group();
  axes.add(new THREE.Line(axisX, axisMat));
  axes.add(new THREE.Line(axisY, axisMat));
  axes.add(new THREE.Line(axisZ, axisMat));
  axes.add(_label('X', tank.x + 0.2, -0.02, -0.02, 0x6d7a85));
  axes.add(_label('Y', -0.08, tank.y + 0.2, -0.02, 0x6d7a85));
  axes.add(_label('Z', -0.08, -0.02, tank.z + 0.18, 0x6d7a85));
  scene.add(axes);

  // rulers
  const rulers = new THREE.Group();
  _buildRulers(rulers, tank);
  scene.add(rulers);

  // gate line (removed at T=0)
  const gateGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(solver.gateX, 0.02, tank.z / 2 - 0.18),
    new THREE.Vector3(solver.gateX, 0.58, tank.z / 2 - 0.18)
  ]);
  const gateLine = new THREE.Line(gateGeo, new THREE.LineDashedMaterial({
    color: 0xb8863b,
    dashSize: 0.025,
    gapSize: 0.018,
    transparent: true,
    opacity: 0.9
  }));
  gateLine.computeLineDistances();
  const gate = new THREE.Group();
  gate.add(gateLine);
  gate.add(_label('GATE', solver.gateX + 0.02, 0.64, tank.z / 2 - 0.18, 0xb8863b, 0.2));
  scene.add(gate);

  // water level probe S1
  const probe = new THREE.Group();
  const probeX = 0.08;
  const probeGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(probeX, 0, tank.z / 2),
    new THREE.Vector3(probeX, 0.62, tank.z / 2)
  ]);
  const probeLine = new THREE.Line(probeGeo, new THREE.LineDashedMaterial({
    color: 0x5b6a75,
    dashSize: 0.015,
    gapSize: 0.01,
    transparent: true,
    opacity: 0.75
  }));
  probeLine.computeLineDistances();
  probe.add(probeLine);
  const markerGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x4db6d0 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  probe.add(marker);
  probe.userData.marker = marker;
  probe.add(_label('S1', probeX, 0.68, tank.z / 2, 0x6f7a84, 0.18));
  scene.add(probe);

  // particles
  const n = solver.count;
  const posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  const mat = new THREE.PointsMaterial({
    size: solver.spacing * 1.18,
    sizeAttenuation: true,
    vertexColors: true,
    depthWrite: true
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
  camera.position.set(1.45, 1.05, 1.55);

  return {
    scene,
    camera,
    points,
    posAttr,
    colAttr,
    gate,
    probe,
    rulers,
    axes,
    grid,
    controlsTarget: new THREE.Vector3(tank.x / 2, 0.3, tank.z / 2),
    cameraHome: camera.position.clone()
  };
}

function _buildRulers(group, tank) {
  const tickMat = new THREE.LineBasicMaterial({ color: 0x47515b });
  const pos = [];
  // x ruler along front-bottom edge
  for (let x = 0; x <= tank.x + 1e-6; x += 0.05) {
    const big = Math.abs(x % 0.1) < 1e-6;
    const len = big ? 0.018 : 0.009;
    pos.push(x, 0, 0, x, len, 0);
    if (big) group.add(_label(x.toFixed(1), x, -0.035, -0.01, 0x5b6670, 0.14));
  }
  // y ruler along left-back edge
  for (let y = 0; y <= tank.y + 1e-6; y += 0.05) {
    const big = Math.abs(y % 0.1) < 1e-6;
    const len = big ? 0.018 : 0.009;
    pos.push(0, y, 0, len, y, 0);
    if (big) group.add(_label(y.toFixed(1), -0.055, y, -0.01, 0x5b6670, 0.14));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  group.add(new THREE.LineSegments(geo, tickMat));
}

const _c0 = new THREE.Color(0x2b5c78);
const _c1 = new THREE.Color(0x4fb0c9);
const _c2 = new THREE.Color(0xcfeef2);
const _c3 = new THREE.Color(0xe0b163);
const _tmp = new THREE.Color();

export function updateParticleColors(colAttr, solver, mode) {
  const n = solver.count;
  const speed = solver.speed;
  const press = solver.press;
  const vmax = Math.max(solver.maxSpeed, 0.4);
  const pmin = solver.pMin;
  const pmax = Math.max(solver.pMax, pmin + 100);
  for (let i = 0; i < n; i++) {
    let t;
    if (mode === 'pressure') {
      t = (press[i] - pmin) / (pmax - pmin);
      t = Math.min(1, Math.max(0, t));
      if (t < 0.62) {
        _tmp.lerpColors(_c0, _c1, t / 0.62);
      } else if (t < 0.85) {
        _tmp.lerpColors(_c1, _c2, (t - 0.62) / 0.23);
      } else {
        _tmp.lerpColors(_c2, _c3, Math.min(1, (t - 0.85) / 0.15));
      }
    } else {
      t = Math.min(1, speed[i] / vmax);
      if (t < 0.55) {
        _tmp.lerpColors(_c0, _c1, t / 0.55);
      } else if (t < 0.85) {
        _tmp.lerpColors(_c1, _c2, (t - 0.55) / 0.3);
      } else {
        _tmp.lerpColors(_c2, _c3, Math.min(1, (t - 0.85) / 0.15));
      }
    }
    colAttr.array[i * 3] = _tmp.r;
    colAttr.array[i * 3 + 1] = _tmp.g;
    colAttr.array[i * 3 + 2] = _tmp.b;
  }
  colAttr.needsUpdate = true;
}

export function updateDamScene(vis, solver, state) {
  const pos = solver.pos;
  vis.posAttr.array.set(pos);
  vis.posAttr.needsUpdate = true;
  updateParticleColors(vis.colAttr, solver, state.colorMode);
  vis.gate.visible = solver.time < 0;
  vis.probe.userData.marker.position.set(0.08, Math.max(0.01, solver.waterLevel), solver.tank.z / 2);
  vis.grid.visible = state.showGrid;
  vis.rulers.visible = state.showRulers;
  vis.axes.visible = state.showAxes;
  vis.probe.visible = state.showProbe;
}

function _label(text, x, y, z, color, scale = 0.24) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.font = '24px Consolas, monospace';
  ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale * (48 / 256), 1);
  return sprite;
}
