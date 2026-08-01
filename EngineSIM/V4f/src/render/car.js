/**
 * Low-poly modern American muscle car.
 *
 * The body is a lofted hull: ten cross-sections down the length of the car,
 * each a closed ring of ten points, stitched into quads. That is far easier to
 * shape than pushing individual vertices around -- widen the rear haunch by
 * editing one number -- and it comes out at about 200 triangles, which is
 * genuinely low-poly rather than "low-poly styled".
 *
 * Local axes match the vehicle model: +Z forward, +X left, +Y up. So
 * `mesh.rotation.y = vehicle.yaw` and `mesh.position` = (vehicle.x, _,
 * vehicle.z) with no conversion anywhere.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bake a list of transformed geometries into one buffer.
 *
 * The car is made of a few dozen boxes and cylinders. Left as individual
 * meshes that is a few dozen draw calls for one car; merged by material it is
 * seven. Nothing here animates independently, so there is no reason to keep
 * them separate.
 *
 * @param {{geo:THREE.BufferGeometry, pos?:number[], rot?:number[]}[]} parts
 */
function bake(parts) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const geos = parts.map((p) => {
    const g = p.geo.clone();
    e.set(...(p.rot || [0, 0, 0]));
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), q, one);
    g.applyMatrix4(m);
    // Drop attributes the merge does not need to agree on.
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    return g;
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Cross-sections from rear bumper to nose tip.
 *
 * w1 = sill half-width, w2 = body half-width, w3 = greenhouse half-width,
 * y0 = floor, y1 = lower crease, y2 = beltline, y3 = shoulder, y4 = roof.
 */
const STATIONS = [
  { z: -2.48, w1: 0.70, w2: 0.84, w3: 0.54, y0: 0.34, y1: 0.54, y2: 0.90, y3: 1.02, y4: 1.05 },
  { z: -2.12, w1: 0.80, w2: 0.95, w3: 0.62, y0: 0.26, y1: 0.51, y2: 0.94, y3: 1.12, y4: 1.16 },
  { z: -1.52, w1: 0.86, w2: 0.99, w3: 0.71, y0: 0.23, y1: 0.49, y2: 0.96, y3: 1.28, y4: 1.37 },
  { z: -0.84, w1: 0.84, w2: 0.97, w3: 0.75, y0: 0.22, y1: 0.48, y2: 0.95, y3: 1.35, y4: 1.46 },
  { z: 0.02, w1: 0.83, w2: 0.95, w3: 0.73, y0: 0.22, y1: 0.47, y2: 0.94, y3: 1.37, y4: 1.48 },
  { z: 0.78, w1: 0.83, w2: 0.95, w3: 0.66, y0: 0.23, y1: 0.47, y2: 0.92, y3: 1.30, y4: 1.40 },
  { z: 1.32, w1: 0.81, w2: 0.94, w3: 0.62, y0: 0.24, y1: 0.47, y2: 0.90, y3: 0.95, y4: 0.97 },
  { z: 2.06, w1: 0.79, w2: 0.93, w3: 0.60, y0: 0.25, y1: 0.47, y2: 0.87, y3: 0.90, y4: 0.92 },
  // The nose stays blunt rather than tapering to a point. Two reasons: a
  // modern American muscle car really does have a near-vertical fascia, and a
  // pointed nose leaves nowhere to mount a grille -- put one at z = 2.47 on a
  // hull that tapers to nothing by 2.56 and it ends up buried inside the body.
  { z: 2.42, w1: 0.74, w2: 0.89, w3: 0.58, y0: 0.26, y1: 0.47, y2: 0.85, y3: 0.88, y4: 0.90 },
  { z: 2.52, w1: 0.72, w2: 0.86, w3: 0.56, y0: 0.27, y1: 0.47, y2: 0.83, y3: 0.86, y4: 0.87 },
];

/** Ten points around one cross-section, counter-clockwise seen from ahead. */
function ring(st) {
  return [
    [0, st.y0],
    [st.w1, st.y0],
    [st.w2, st.y1],
    [st.w2, st.y2],
    [st.w3, st.y3],
    [0, st.y4],
    [-st.w3, st.y3],
    [-st.w2, st.y2],
    [-st.w2, st.y1],
    [-st.w1, st.y0],
  ];
}

function buildHull(stations) {
  const rings = stations.map(ring);
  const R = rings[0].length;
  const pos = [];
  const idx = [];

  for (const [i, r] of rings.entries()) {
    for (const [x, y] of r) pos.push(x, y, stations[i].z);
  }

  // Stitch adjacent stations.
  for (let i = 0; i < rings.length - 1; i++) {
    const a = i * R;
    const b = (i + 1) * R;
    for (let k = 0; k < R; k++) {
      const k2 = (k + 1) % R;
      idx.push(a + k, b + k, a + k2);
      idx.push(a + k2, b + k, b + k2);
    }
  }

  // Cap the two ends with a fan through the ring centre.
  const capCentre = (ringIndex, z, flip) => {
    const c = pos.length / 3;
    let sy = 0;
    for (const [, y] of rings[ringIndex]) sy += y;
    pos.push(0, sy / R, z);
    const base = ringIndex * R;
    for (let k = 0; k < R; k++) {
      const k2 = (k + 1) % R;
      if (flip) idx.push(c, base + k2, base + k);
      else idx.push(c, base + k, base + k2);
    }
  };
  capCentre(0, stations[0].z, false);
  capCentre(rings.length - 1, stations[stations.length - 1].z, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/**
 * One wheel: tyre, and a single baked rim assembly (barrel, five spokes, hub,
 * brake disc). Three meshes per corner instead of ten.
 *
 * The caliper is returned separately because it is bolted to the upright and
 * must not spin with the wheel.
 */
function buildWheel(radius, width, mats, outboard) {
  const g = new THREE.Group();

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16, 1), mats.tyre);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);

  // `outboard` is +1 for the left-hand wheels and -1 for the right, and every
  // lateral offset below is multiplied by it. Without that the spokes, disc
  // and caliper all face inboard on one side of the car, where nobody can see
  // them -- the right-hand wheels come out as plain black discs.
  const rimR = radius * 0.66;
  const spokeGeo = box(0.05, rimR * 0.92, 0.05);
  const parts = [
    {
      geo: new THREE.CylinderGeometry(rimR, rimR, width * 0.94, 16, 1),
      rot: [0, 0, Math.PI / 2],
    },
    {
      geo: new THREE.CylinderGeometry(rimR * 0.3, rimR * 0.3, width * 1.02, 10),
      rot: [0, 0, Math.PI / 2],
    },
    {
      geo: new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, 0.03, 14),
      pos: [-outboard * width * 0.12, 0, 0],
      rot: [0, 0, Math.PI / 2],
    },
  ];
  // Spokes: a bar offset from the centre, rotated about the wheel axis, five
  // times round to make a star.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const y = rimR * 0.46;
    parts.push({
      geo: spokeGeo,
      pos: [outboard * width * 0.4, Math.cos(a) * y, Math.sin(a) * y],
      rot: [a, 0, 0],
    });
  }
  const rim = new THREE.Mesh(bake(parts), mats.rim);
  for (const p of parts) p.geo.dispose();
  g.add(rim);

  const caliper = new THREE.Mesh(box(0.05, 0.16, 0.1), mats.caliper);
  caliper.position.set(-outboard * width * 0.12, radius * 0.42, -radius * 0.18);

  return { spin: g, static: caliper };
}

export const CAR_COLORS = {
  sublime: 0x8ac81e,
  torred: 0xc41230,
  octane: 0x2b4a8f,
  triple: 0xf2f2f2,
  pitchBlack: 0x121316,
  sinamon: 0x7a3a1d,
};

/**
 * The procedural cabin: dashboard and steering wheel, enough to make the
 * cockpit camera read as a driver's seat rather than a bug. Shared between
 * the procedural body and downloaded external models, both of which hide
 * their shell in cockpit view.
 */
export function buildInterior() {
  const group = new THREE.Group();
  group.visible = false;

  const driverX = 0.36; // left-hand drive; +X is the car's left
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.8 });
  const dash = new THREE.Mesh(bake([
    { geo: box(1.5, 0.16, 0.46), pos: [0, 0.90, 0.72] }, // dash top
    { geo: box(1.5, 0.30, 0.10), pos: [0, 0.74, 0.94] }, // fascia
    { geo: box(0.44, 0.10, 0.30), pos: [driverX, 0.99, 0.66] }, // binnacle hood
  ]), dashMat);
  group.add(dash);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(driverX, 0.86, 0.44);
  // Raked back toward the driver, like a real column.
  steeringWheel.rotation.x = -0.35;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.021, 8, 20), rimMat);
  steeringWheel.add(rim);
  const spokes = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    spokes.push({
      geo: box(0.035, 0.17, 0.022),
      pos: [Math.cos(a + Math.PI / 2) * 0.085, Math.sin(a + Math.PI / 2) * 0.085, 0],
      rot: [0, 0, a],
    });
  }
  spokes.push({ geo: new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10), pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] });
  steeringWheel.add(new THREE.Mesh(bake(spokes), rimMat));
  for (const s of spokes) s.geo.dispose();
  group.add(steeringWheel);

  return { group, steeringWheel };
}

export class Car {
  /**
   * @param {object} opts
   * @param {number} opts.color          body colour
   * @param {number} opts.wheelRadius    must match the physics model
   * @param {number} opts.wheelbase
   * @param {number} opts.trackWidth
   */
  constructor(opts = {}) {
    const wheelRadius = opts.wheelRadius ?? 0.352;
    const wheelbase = opts.wheelbase ?? 2.946;
    const trackWidth = opts.trackWidth ?? 1.62;
    const bodyColor = opts.color ?? CAR_COLORS.sublime;

    this.wheelRadius = wheelRadius;
    this.group = new THREE.Group();
    this.group.name = 'car';

    // The hull is modelled with its floor near y = 0; lift the whole body so
    // the wheels sit on the ground.
    this.body = new THREE.Group();
    this.group.add(this.body);

    const mats = {
      // Car paint is a pigmented dielectric under clearcoat, not a metal.
      // Cranking metalness up to get "shiny" is a common shortcut and it
      // backfires: a metal reflects the environment instead of being lit, so
      // it goes black unless there is an env map, and even with one it loses
      // its colour.
      paint: new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.32,
        metalness: 0.1,
        envMapIntensity: 1.15,
        flatShading: true,
      }),
      trim: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x121a22,
        roughness: 0.06,
        metalness: 0,
        envMapIntensity: 1.6,
        transparent: true,
        opacity: 0.72,
      }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.18, metalness: 0.95 }),
      tyre: new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.92, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.35, metalness: 0.85 }),
      caliper: new THREE.MeshStandardMaterial({ color: 0xb4231f, roughness: 0.45, metalness: 0.3 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.35, metalness: 0.3 }),
      tail: new THREE.MeshStandardMaterial({
        color: 0x260306,
        emissive: 0xd8140c,
        emissiveIntensity: 0.12,
        roughness: 0.3,
      }),
      head: new THREE.MeshStandardMaterial({
        color: 0x9aa6b4,
        emissive: 0xfff2d0,
        emissiveIntensity: 0.18,
        roughness: 0.12,
        metalness: 0.25,
        envMapIntensity: 1.4,
      }),
    };
    this.mats = mats;

    // --- hull -----------------------------------------------------------
    const hull = new THREE.Mesh(buildHull(STATIONS), mats.paint);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.body.add(hull);
    /** Everything that makes up the visible shell, hidden in cockpit view. */
    this.shell = [hull];

    // --- everything else, grouped by material and baked ------------------
    // Declared as data so the whole car is one readable table, then merged
    // into one mesh per material.
    const parts = { glass: [], trim: [], stripe: [], chrome: [], head: [], tail: [] };

    // Greenhouse. Panels laid onto the hull rather than holes cut through it:
    // at this poly count a flush dark panel reads as glass perfectly well.
    //
    // Each panel's size and rake is derived from the two STATIONS it spans, so
    // it sits ON the surface. Eyeballing these leaves the screens poking
    // through the roof, which is exactly what the first version did.
    parts.glass.push(
      // Windscreen: cowl (z 1.32, y 0.97) up to the roof front (z 0.78, y 1.40).
      { geo: box(1.16, 0.69, 0.04), pos: [0, 1.185, 1.05], rot: [-0.90, 0, 0] },
      // Rear screen: roof rear (z -1.52, y 1.37) down to the deck (z -2.12, y 1.16).
      { geo: box(1.14, 0.60, 0.04), pos: [0, 1.27, -1.82], rot: [1.23, 0, 0] }
    );
    for (const s of [1, -1]) {
      // Side glass spans the beltline (y 0.94) to the shoulder (y 1.36), and
      // leans inward as it rises -- the tumblehome the hull already has.
      parts.glass.push({
        geo: box(0.04, 0.45, 2.0),
        pos: [s * 0.845, 1.15, -0.35],
        rot: [0, 0, s * 0.483],
      });
    }

    // Front-end furniture sits just proud of the z = 2.52 fascia, and is kept
    // inside that station's half-width (0.86) so nothing pokes through a fender.
    parts.trim.push(
      { geo: box(1.26, 0.26, 0.07), pos: [0, 0.66, 2.54] }, // grille
      { geo: box(1.40, 0.14, 0.08), pos: [0, 0.40, 2.53] }, // lower intake
      { geo: box(1.62, 0.055, 0.30), pos: [0, 0.25, 2.44] }, // front splitter
      { geo: box(1.64, 0.08, 0.28), pos: [0, 0.42, -2.42] }, // rear valance
      { geo: box(0.62, 0.10, 0.78), pos: [0, 0.94, 1.72] }, // hood scoop
      { geo: box(1.58, 0.05, 0.26), pos: [0, 1.09, -2.22] } // deck lip spoiler
    );
    for (const s of [1, -1]) {
      parts.trim.push({ geo: box(0.20, 0.08, 0.09), pos: [s * 1.0, 1.00, 0.60] }); // mirrors
      parts.head.push({ geo: box(0.34, 0.14, 0.06), pos: [s * 0.55, 0.79, 2.545] });
      // Hood stripes, over the hood only, tilted to follow it as it falls
      // away toward the nose. A flat stripe sinks into the sheet metal at the
      // front and floats above it at the cowl.
      parts.stripe.push({
        geo: box(0.2, 0.012, 1.12),
        pos: [s * 0.17, 0.925, 1.87],
        rot: [0.0997, 0, 0],
      });
    }

    // Full-width tail light bar, the modern-muscle signature.
    parts.tail.push({ geo: box(1.52, 0.12, 0.06), pos: [0, 0.94, -2.52] });

    // Quad exhaust tips -- two per bank, matching the audio model's true dual
    // system. Left pair is bank A, right pair is bank B.
    const tipGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.14, 10, 1, true);
    for (const s of [1, -1]) {
      for (const o of [0.13, -0.13]) {
        parts.chrome.push({
          geo: tipGeo,
          pos: [s * (0.52 + o), 0.34, -2.52],
          rot: [Math.PI / 2, 0, 0],
        });
      }
    }

    for (const [key, list] of Object.entries(parts)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(bake(list), mats[key]);
      m.castShadow = true;
      this.body.add(m);
      this.shell.push(m);
      for (const p of list) p.geo.dispose();
    }

    // --- wheels -----------------------------------------------------------
    const a = wheelbase * 0.48; // front axle, from the body origin
    const b = wheelbase * 0.52;
    this.wheels = [];
    const halfTrack = trackWidth / 2;
    for (const [name, z, isFront] of [
      ['FL', a, true],
      ['FR', a, true],
      ['RL', -b, false],
      ['RR', -b, false],
    ]) {
      const side = name.endsWith('L') ? 1 : -1;
      // Rear tyres are wider, as they should be on something like this.
      const w = isFront ? 0.28 : 0.33;
      const built = buildWheel(wheelRadius, w, mats, side);
      // A steering pivot at the hub so steer rotation happens about the
      // kingpin axis; the spin group nested inside it turns about the wheel
      // axis. Nesting them this way means steering and rolling compose
      // correctly instead of fighting over one Euler triple.
      const pivot = new THREE.Group();
      pivot.position.set(side * halfTrack, wheelRadius, z);
      pivot.add(built.spin);
      pivot.add(built.static);
      this.group.add(pivot);
      this.wheels.push({ name, pivot, spin: built.spin, isFront, side, restY: wheelRadius });
    }

    // --- interior --------------------------------------------------------
    // A lofted shell has no cabin and no window openings, so a camera at
    // driver height just sees the inside of the paint. The cockpit view
    // therefore hides the body and shows this instead: a dashboard and a
    // steering wheel, which is enough to make the view read as a cockpit
    // rather than as a bug. External models reuse the same cabin.
    const built = buildInterior();
    this.interior = built.group;
    this.steeringWheel = built.steeringWheel;
    this.body.add(this.interior);

    // Body sits on the suspension; wheels are attached to the outer group so
    // roll and pitch move the shell, not the contact patches.
    this.bodyRestY = 0;
    this.body.position.y = this.bodyRestY;

    // Smoothed visual state.
    this._roll = 0;
    this._pitch = 0;
    this._heave = 0;
    this._steerVis = 0;
    this._wheelAngle = 0;
  }

  /**
   * Swap between the exterior shell and the cockpit interior.
   *
   * The shell is hidden rather than the whole car, so the wheels stay visible
   * in the driver's peripheral vision -- which is most of what makes an
   * interior view feel like one.
   */
  setInteriorView(on) {
    for (const m of this.shell) m.visible = !on;
    this.interior.visible = on;
  }

  /**
   * @param {object} t  vehicle telemetry (see Vehicle#telemetry)
   * @param {number} dt seconds
   * @param {number} brake 0..1, for the brake lights
   */
  update(t, dt, brake = 0) {
    updateCarRig(this, t, dt, brake);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.mats)) m.dispose();
  }
}

/**
 * Shared chassis-visual update for both the procedural and downloaded cars.
 *
 * @param {Car|object} car object exposing group/body/wheels/steeringWheel/
 *                          mats/bodyRestY and smoothed attitude fields
 * @param {object} t         vehicle telemetry
 * @param {number} dt        seconds
 * @param {number} brake     0..1, for the brake lights
 */
export function updateCarRig(car, t, dt, brake = 0) {
  car.group.position.set(t.x, 0, t.z);
  car.group.rotation.y = t.yaw;

  // --- body attitude ---------------------------------------------------
  // Roll into the corner, pitch under braking, squat under power. Targets
  // come straight from the chassis accelerations, then get smoothed with a
  // first-order lag standing in for suspension damping.
  // Sign conventions (three.js, body facing +Z): positive rotation.x tips
  // the nose DOWN, positive rotation.z lifts the LEFT side. Acceleration
  // must squat the rear (nose up, -x), braking must dive (nose down, +x),
  // and a left turn (ay > 0) must roll OUTWARD to the right (left side up,
  // +z). Flipping any of these signs is what makes a car look like it is
  // pitching into the throttle and leaning into the corner.
  const rollTarget = THREE.MathUtils.clamp(t.ay * 0.0075, -0.09, 0.09);
  const pitchTarget = THREE.MathUtils.clamp(-t.ax * 0.0055, -0.055, 0.055);
  const heaveTarget = THREE.MathUtils.clamp(-Math.abs(t.ay) * 0.0012, -0.03, 0);
  const k = 1 - Math.exp(-dt * 9);
  car._roll += (rollTarget - car._roll) * k;
  car._pitch += (pitchTarget - car._pitch) * k;
  car._heave += (heaveTarget - car._heave) * k;

  car.body.rotation.z = car._roll;
  car.body.rotation.x = car._pitch;
  car.body.position.y = car.bodyRestY + car._heave;

  // --- wheels -----------------------------------------------------------
  const ks = 1 - Math.exp(-dt * 16);
  car._steerVis += (t.steer - car._steerVis) * ks;

  // Spin both axles from their own angular velocity, so a locked wheel
  // visibly stops and a spinning rear wheel visibly blurs.
  for (const w of car.wheels) {
    const omega = w.isFront ? t.omegaF : t.omegaR;
    // Positive omega = rolling forward, and positive rotation.x moves the
    // tyre crown toward +Z (the car's nose), which is forward rolling.
    w.spin.rotation.x += omega * dt;
    w.pivot.rotation.y = w.isFront ? car._steerVis : 0;
    // Wheel suspension mirrors the body: under acceleration the front
    // extends and the rear compresses; under a left turn the left side
    // extends and the right side compresses.
    const lift =
      (w.isFront ? t.ax : -t.ax) * 0.0022 + (w.side > 0 ? t.ay : -t.ay) * 0.0016;
    w.pivot.position.y = w.restY + THREE.MathUtils.clamp(lift, -0.035, 0.035);
  }

  // Steering wheel, geared up from the road wheels so a small steer input
  // produces a visible amount of hand movement.
  if (car.interior.visible) {
    car.steeringWheel.rotation.z = -car._steerVis * 3.2;
  }

  // --- lights -----------------------------------------------------------
  car.mats.tail.emissiveIntensity = 0.12 + brake * 2.2;
}
