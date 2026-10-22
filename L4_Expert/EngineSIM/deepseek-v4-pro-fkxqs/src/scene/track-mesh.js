/**
 * Track meshes built from the pure `TrackLayout` geometry.
 *
 * Nothing here decides where the track *is* - it only turns the centreline
 * samples into asphalt, kerbs, white lines, run-off, barriers and scenery. That
 * separation is why the physics and the renderer can never disagree about the
 * shape of the circuit.
 *
 * World mapping: physics (x, y) -> world (x, height, -y).
 */

import * as THREE from "three";
import { Xorshift32 } from "../audio/dsp/random.js";
import {
  createAsphaltRoughnessTexture,
  createAsphaltTexture,
  createBoardTexture,
  createCheckerTexture,
  createConcreteTexture,
  createGravelTexture,
  createKerbTexture,
  createMarkerTexture,
} from "./textures.js";

/** Physics plane -> world space. */
export function toWorld(x, y, height = 0) {
  return new THREE.Vector3(x, height, -y);
}

/**
 * Build a closed ribbon between two lateral offsets from the centreline.
 * @param {import('../track/track-layout.js').TrackLayout} layout
 * @param {(sample:object, index:number) => [number, number]} offsets returns [innerOffset, outerOffset]
 * @param {object} [options]
 */
function buildRibbon(layout, offsets, { height = 0, uvScale = 0.08, closed = true, indices = null } = {}) {
  const samples = indices ? indices.map((i) => layout.samples[i]) : layout.samples;
  const count = samples.length;
  const vertexCount = count * 2;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const triangles = [];
  let runningLength = 0;
  for (let i = 0; i < count; i++) {
    const sample = samples[i];
    const [inner, outer] = offsets(sample, i);
    const ax = sample.x + sample.normalX * inner;
    const ay = sample.y + sample.normalY * inner;
    const bx = sample.x + sample.normalX * outer;
    const by = sample.y + sample.normalY * outer;
    positions[i * 6 + 0] = ax;
    positions[i * 6 + 1] = height;
    positions[i * 6 + 2] = -ay;
    positions[i * 6 + 3] = bx;
    positions[i * 6 + 4] = height;
    positions[i * 6 + 5] = -by;
    normals[i * 6 + 1] = 1;
    normals[i * 6 + 4] = 1;
    if (i > 0) {
      const previous = samples[i - 1];
      runningLength += Math.hypot(sample.x - previous.x, sample.y - previous.y);
    }
    const v = runningLength * uvScale;
    uvs[i * 4 + 0] = 0;
    uvs[i * 4 + 1] = v;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = v;
  }
  const segments = closed ? count : count - 1;
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % count;
    const a = i * 2;
    const b = i * 2 + 1;
    const c = next * 2;
    const d = next * 2 + 1;
    triangles.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build the full circuit: road, kerbs, lines, run-off, barriers and scenery.
 * @param {import('../track/track-layout.js').TrackLayout} layout
 */
export function createTrackMeshes(layout) {
  const group = new THREE.Group();
  group.name = "track";
  const stats = { drawables: 0 };

  // ---------------------------------------------------------------- asphalt
  const asphaltMap = createAsphaltTexture();
  asphaltMap.repeat.set(1, 1);
  const asphaltRoughness = createAsphaltRoughnessTexture();
  const asphaltMaterial = new THREE.MeshStandardMaterial({
    map: asphaltMap,
    roughnessMap: asphaltRoughness,
    roughness: 0.92,
    metalness: 0.02,
    color: 0xdedede,
  });
  const road = new THREE.Mesh(
    buildRibbon(layout, (sample) => [sample.halfWidth, -sample.halfWidth], { height: 0.02, uvScale: 0.055 }),
    asphaltMaterial,
  );
  road.receiveShadow = true;
  road.name = "road";
  group.add(road);
  stats.drawables++;

  // ------------------------------------------------------------------ apron
  const apronMaterial = new THREE.MeshStandardMaterial({ color: 0x53565c, roughness: 0.95 });
  for (const side of [1, -1]) {
    const apron = new THREE.Mesh(
      buildRibbon(
        layout,
        (sample) => [
          side * (sample.halfWidth + layout.kerbWidthM),
          side * (sample.halfWidth + layout.kerbWidthM + layout.apronWidthM),
        ],
        { height: 0.012, uvScale: 0.05 },
      ),
      apronMaterial,
    );
    apron.receiveShadow = true;
    group.add(apron);
    stats.drawables++;
  }

  // ------------------------------------------------------------ white lines
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f3f3, roughness: 0.65 });
  for (const side of [1, -1]) {
    const line = new THREE.Mesh(
      buildRibbon(layout, (sample) => [side * (sample.halfWidth - 0.02), side * (sample.halfWidth - 0.16)], {
        height: 0.028,
        uvScale: 0.2,
      }),
      lineMaterial,
    );
    group.add(line);
    stats.drawables++;
  }

  // ------------------------------------------------------------------ kerbs
  const kerbMaterial = new THREE.MeshStandardMaterial({ map: createKerbTexture(), roughness: 0.72 });
  const runs = layout.kerbRuns();
  for (const run of runs) {
    const indices = [];
    const total = layout.samples.length;
    let index = run.from;
    for (let step = 0; step < run.length + 1; step++) {
      indices.push(index % total);
      index++;
    }
    for (const side of [1, -1]) {
      const kerb = new THREE.Mesh(
        buildRibbon(
          layout,
          (sample) => [side * sample.halfWidth, side * (sample.halfWidth + layout.kerbWidthM)],
          { height: 0.055, uvScale: 0.5, closed: false, indices },
        ),
        kerbMaterial,
      );
      kerb.receiveShadow = true;
      group.add(kerb);
      stats.drawables++;
    }
  }

  // ---------------------------------------------------------- gravel traps
  const gravelMaterial = new THREE.MeshStandardMaterial({ map: createGravelTexture(), roughness: 1 });
  const gravelRuns = runs.filter((run) => run.length > 24);
  for (const run of gravelRuns) {
    const indices = [];
    const total = layout.samples.length;
    let index = (run.from - 6 + total) % total;
    for (let step = 0; step < run.length + 12; step++) {
      indices.push(index % total);
      index++;
    }
    const sampleCurvature = layout.samples[run.from].curvature;
    const side = sampleCurvature > 0 ? -1 : 1; // outside of the corner
    const gravel = new THREE.Mesh(
      buildRibbon(
        layout,
        (sample) => [
          side * (sample.halfWidth + layout.kerbWidthM + layout.apronWidthM),
          side * (sample.halfWidth + layout.kerbWidthM + layout.apronWidthM + 12),
        ],
        { height: 0.008, uvScale: 0.05, closed: false, indices },
      ),
      gravelMaterial,
    );
    gravel.receiveShadow = true;
    group.add(gravel);
    stats.drawables++;
  }

  // ------------------------------------------------------- start/finish line
  const startPoint = layout.sampleAtDistance(layout.startLineDistanceM);
  const startGeometry = new THREE.PlaneGeometry(startPoint.halfWidth * 2, 1.6);
  startGeometry.rotateX(-Math.PI / 2);
  const startLine = new THREE.Mesh(
    startGeometry,
    new THREE.MeshStandardMaterial({ map: createCheckerTexture(), roughness: 0.6 }),
  );
  startLine.position.copy(toWorld(startPoint.x, startPoint.y, 0.032));
  startLine.rotation.y = startPoint.heading;
  group.add(startLine);
  stats.drawables++;

  // ----------------------------------------------------------- start gantry
  const gantry = createGantry(startPoint);
  group.add(gantry);
  stats.drawables += 4;

  // --------------------------------------------------------------- barriers
  const barriers = createBarriers(layout);
  group.add(barriers.group);
  stats.drawables += barriers.drawables;

  // ------------------------------------------------- grandstand + pit block
  const buildings = createTrackside(layout);
  group.add(buildings.group);
  stats.drawables += buildings.drawables;

  // ---------------------------------------------------------- marker boards
  const markers = createMarkerBoards(layout);
  group.add(markers);
  stats.drawables += 6;

  return { group, stats, runs };
}

/** @private Start/finish gantry with a banner across the road. */
function createGantry(startPoint) {
  const gantry = new THREE.Group();
  gantry.name = "gantry";
  const concrete = new THREE.MeshStandardMaterial({ map: createConcreteTexture(), roughness: 0.85 });
  const postGeometry = new THREE.BoxGeometry(0.9, 8.5, 0.9);
  const span = startPoint.halfWidth * 2 + 3.4;
  for (const side of [1, -1]) {
    const post = new THREE.Mesh(postGeometry, concrete);
    post.castShadow = true;
    post.position.copy(
      toWorld(
        startPoint.x - Math.sin(startPoint.heading) * side * (startPoint.halfWidth + 1.6),
        startPoint.y + Math.cos(startPoint.heading) * side * (startPoint.halfWidth + 1.6),
        4.25,
      ),
    );
    gantry.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 1.9, 0.8), concrete);
  beam.position.copy(toWorld(startPoint.x, startPoint.y, 8.1));
  beam.rotation.y = startPoint.heading;
  beam.castShadow = true;
  gantry.add(beam);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 0.92, 1.5),
    new THREE.MeshStandardMaterial({
      map: createBoardTexture("CEDAR RIDGE", "#101828", "#f7c948"),
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  banner.position.copy(toWorld(startPoint.x, startPoint.y, 8.1));
  banner.rotation.y = startPoint.heading + Math.PI / 2;
  gantry.add(banner);
  return gantry;
}

/** @private Tyre stacks and armco at the outside of every kerbed corner. */
function createBarriers(layout) {
  const group = new THREE.Group();
  group.name = "barriers";
  const rng = new Xorshift32(0x2f7a91b);
  const tyreGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10);
  const tyreMaterial = new THREE.MeshStandardMaterial({ color: 0x171719, roughness: 0.95 });
  const positions = [];
  const barrierPanels = [];

  for (const run of layout.kerbRuns()) {
    const total = layout.samples.length;
    const outside = layout.samples[run.from].curvature > 0 ? -1 : 1;
    for (let step = -4; step < run.length + 8; step += 3) {
      const sample = layout.samples[(run.from + step + total) % total];
      const offset = outside * (sample.halfWidth + layout.kerbWidthM + layout.apronWidthM + 13.5);
      const x = sample.x + sample.normalX * offset;
      const y = sample.y + sample.normalY * offset;
      barrierPanels.push({ x, y, heading: sample.heading });
      const stackHeight = 2 + Math.floor(rng.nextUnit() * 2);
      for (let level = 0; level < stackHeight; level++) {
        positions.push({ x, y, height: 0.14 + level * 0.24, rotation: rng.nextUnit() * Math.PI });
      }
    }
  }

  const tyres = new THREE.InstancedMesh(tyreGeometry, tyreMaterial, positions.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  positions.forEach((tyre, index) => {
    quaternion.setFromAxisAngle(axis, tyre.rotation);
    matrix.compose(toWorld(tyre.x, tyre.y, tyre.height), quaternion, one);
    tyres.setMatrixAt(index, matrix);
  });
  tyres.castShadow = true;
  tyres.instanceMatrix.needsUpdate = true;
  group.add(tyres);

  // Armco-style panels behind the tyres.
  const panelGeometry = new THREE.BoxGeometry(3.2, 0.75, 0.16);
  const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5, metalness: 0.35 });
  const panels = new THREE.InstancedMesh(panelGeometry, panelMaterial, barrierPanels.length);
  barrierPanels.forEach((panel, index) => {
    quaternion.setFromAxisAngle(axis, panel.heading);
    matrix.compose(toWorld(panel.x, panel.y, 0.62), quaternion, one);
    panels.setMatrixAt(index, matrix);
  });
  panels.castShadow = true;
  panels.instanceMatrix.needsUpdate = true;
  group.add(panels);

  return { group, drawables: 2, tyreCount: positions.length, panelCount: barrierPanels.length };
}

/** @private Grandstand, pit building and sponsor boards along the main straight. */
function createTrackside(layout) {
  const group = new THREE.Group();
  group.name = "trackside";
  const concrete = new THREE.MeshStandardMaterial({ map: createConcreteTexture(), roughness: 0.88 });
  let drawables = 0;

  const straight = layout.sampleAtDistance(layout.startLineDistanceM + 40);
  const leftOf = (sample, offset, height = 0) =>
    toWorld(sample.x + Math.cos(sample.heading + Math.PI / 2) * offset, sample.y + Math.sin(sample.heading + Math.PI / 2) * offset, height);

  // Grandstand: stepped seating deck plus a roof.
  const stand = new THREE.Group();
  for (let row = 0; row < 7; row++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(78, 1.2, 2.4), concrete);
    step.position.set(0, 0.6 + row * 1.05, -row * 2.2);
    step.castShadow = true;
    step.receiveShadow = true;
    stand.add(step);
    const seats = new THREE.Mesh(
      new THREE.BoxGeometry(76, 0.5, 1.5),
      new THREE.MeshStandardMaterial({ color: row % 2 === 0 ? 0x2b6cb0 : 0xe2e8f0, roughness: 0.7 }),
    );
    seats.position.set(0, 1.35 + row * 1.05, -row * 2.2 + 0.3);
    stand.add(seats);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, 18), concrete);
  roof.position.set(0, 10.4, -7);
  roof.castShadow = true;
  stand.add(roof);
  for (const x of [-38, 0, 38]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 10, 0.7), concrete);
    pillar.position.set(x, 5, -15.5);
    stand.add(pillar);
  }
  stand.position.copy(leftOf(straight, 26, 0));
  stand.rotation.y = straight.heading + Math.PI;
  group.add(stand);
  drawables += 18;

  // Pit building on the other side.
  const pit = new THREE.Group();
  const pitBody = new THREE.Mesh(new THREE.BoxGeometry(96, 7.5, 13), concrete);
  pitBody.position.set(0, 3.75, 0);
  pitBody.castShadow = true;
  pitBody.receiveShadow = true;
  pit.add(pitBody);
  const pitRoof = new THREE.Mesh(new THREE.BoxGeometry(100, 0.6, 15), new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.8 }));
  pitRoof.position.set(0, 7.7, 0);
  pit.add(pitRoof);
  for (let i = 0; i < 6; i++) {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0e1620, roughness: 0.16, metalness: 0.5 }),
    );
    glass.position.set(-40 + i * 16, 5.6, 6.7);
    pit.add(glass);
  }
  pit.position.copy(leftOf(straight, -30, 0));
  pit.rotation.y = straight.heading;
  group.add(pit);
  drawables += 8;

  // Sponsor boards along the straight, both sides.
  const labels = [
    ["CROSS-PLANE", "#1d3f8f"],
    ["V8 POWER", "#8f1d2f"],
    ["EQUAL LENGTH", "#14532d"],
    ["ORDER 4", "#1f2937"],
    ["FIRING 1-8-4-3", "#7c2d12"],
    ["REVERB", "#312e81"],
  ];
  labels.forEach(([label, colour], index) => {
    const sample = layout.sampleAtDistance(layout.startLineDistanceM - 150 + index * 52);
    for (const side of [1, -1]) {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 2.2),
        new THREE.MeshStandardMaterial({ map: createBoardTexture(label, colour), roughness: 0.75, side: THREE.DoubleSide }),
      );
      const offset = side * (sample.halfWidth + layout.kerbWidthM + layout.apronWidthM + 4.5);
      board.position.copy(toWorld(sample.x + sample.normalX * offset, sample.y + sample.normalY * offset, 1.2));
      board.rotation.y = sample.heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      group.add(board);
      drawables++;
    }
  });

  return { group, drawables };
}

/** @private 300/200/100 m braking boards before the two hardest corners. */
function createMarkerBoards(layout) {
  const group = new THREE.Group();
  group.name = "markers";
  // Find the two tightest corners and put boards before them.
  const corners = layout
    .kerbRuns()
    .map((run) => ({ run, curvature: Math.abs(layout.samples[run.from].curvature) }))
    .sort((a, b) => b.curvature - a.curvature)
    .slice(0, 2);
  for (const corner of corners) {
    const cornerDistance = layout.samples[corner.run.from].distance;
    for (const distance of [100, 200, 300]) {
      const sample = layout.sampleAtDistance(cornerDistance - distance);
      const offset = -(sample.halfWidth + layout.kerbWidthM + layout.apronWidthM + 1.8);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshStandardMaterial({ map: createMarkerTexture(String(distance)), side: THREE.DoubleSide, roughness: 0.8 }),
      );
      board.position.copy(toWorld(sample.x + sample.normalX * offset, sample.y + sample.normalY * offset, 1.1));
      board.rotation.y = sample.heading + Math.PI / 2;
      group.add(board);
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.1, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }),
      );
      post.position.copy(toWorld(sample.x + sample.normalX * offset, sample.y + sample.normalY * offset, 0.55));
      group.add(post);
    }
  }
  return group;
}
