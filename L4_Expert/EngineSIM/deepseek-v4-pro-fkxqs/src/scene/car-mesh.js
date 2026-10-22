/**
 * Low-poly modern American muscle car, built entirely from primitives.
 *
 * Local frame: +X is forward, +Y is up, +Z is the car's right-hand side, which
 * matches the mapping used everywhere else (world = (x, h, -y), rotation.y =
 * physics heading).
 *
 * The mesh exposes the moving parts the simulation drives: four wheels (steer +
 * spin), brake lights, reverse lights and a small amount of body roll/pitch so
 * the car visibly loads up under braking and cornering.
 */

import * as THREE from "three";

const BODY_COLOUR = 0x9c1f24;

/**
 * @param {object} car geometry from `MUSCLE_CAR`
 */
export function createCarMesh(car) {
  const group = new THREE.Group();
  group.name = "car";

  const body = new THREE.Group();
  body.name = "body";
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({
    color: BODY_COLOUR,
    roughness: 0.32,
    metalness: 0.55,
    envMapIntensity: 1.1,
  });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.55, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0a1018,
    roughness: 0.08,
    metalness: 0.6,
    transparent: true,
    opacity: 0.72,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.22, metalness: 0.95 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101012, roughness: 0.92 });
  const headlight = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, emissive: 0xfff2cc, emissiveIntensity: 0.6, roughness: 0.25 });
  const tailLight = new THREE.MeshStandardMaterial({ color: 0x3a0708, emissive: 0xff2a1a, emissiveIntensity: 0.25, roughness: 0.35 });
  const reverseLight = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });

  const length = 4.92;
  const width = 1.94;
  const wheelbase = car.wheelbaseM;
  const frontOverhang = (length - wheelbase) * 0.46;
  const noseX = car.frontAxleToCgM + frontOverhang;
  const tailX = -(wheelbase - car.frontAxleToCgM) - (length - wheelbase) * 0.54;

  // ---- lower body (sills to shoulder line)
  const lower = new THREE.Mesh(new THREE.BoxGeometry(length, 0.62, width), paint);
  lower.position.set((noseX + tailX) / 2, 0.55, 0);
  lower.castShadow = true;
  body.add(lower);

  // ---- shoulders / haunches: slightly narrower, taller block
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(length * 0.94, 0.42, width * 0.98), paint);
  shoulder.position.set((noseX + tailX) / 2 - 0.05, 0.98, 0);
  shoulder.castShadow = true;
  body.add(shoulder);

  // ---- bonnet wedge and nose
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.2, width * 0.9), paint);
  bonnet.position.set(noseX - 0.95, 1.12, 0);
  bonnet.castShadow = true;
  body.add(bonnet);

  const noseShape = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, width * 0.96), paint);
  noseShape.position.set(noseX - 0.22, 0.72, 0);
  noseShape.castShadow = true;
  body.add(noseShape);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, width * 0.62), darkTrim);
  grille.position.set(noseX - 0.02, 0.74, 0);
  body.add(grille);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, width * 0.94), darkTrim);
  splitter.position.set(noseX - 0.18, 0.34, 0);
  body.add(splitter);

  // ---- hood scoop (this is a muscle car)
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.62), paint);
  scoop.position.set(noseX - 1.15, 1.28, 0);
  scoop.castShadow = true;
  body.add(scoop);
  const scoopMouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.5), darkTrim);
  scoopMouth.position.set(noseX - 0.7, 1.28, 0);
  body.add(scoopMouth);

  // ---- cabin: greenhouse with a fast rear screen
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, width * 0.84), paint);
  cabin.position.set(-0.05, 1.5, 0);
  cabin.castShadow = true;
  body.add(cabin);

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, width * 0.78), glass);
  windscreen.position.set(1.02, 1.5, 0);
  windscreen.rotation.z = -0.42;
  body.add(windscreen);

  const rearScreen = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, width * 0.76), glass);
  rearScreen.position.set(-1.12, 1.5, 0);
  rearScreen.rotation.z = 0.5;
  body.add(rearScreen);

  for (const side of [1, -1]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 0.06), glass);
    sideGlass.position.set(-0.05, 1.52, side * width * 0.42);
    body.add(sideGlass);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.34), darkTrim);
    mirror.position.set(0.92, 1.42, side * (width * 0.5 + 0.06));
    body.add(mirror);
  }

  // ---- rear deck, spoiler, diffuser and quad tips
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.16, width * 0.92), paint);
  deck.position.set(tailX + 0.62, 1.16, 0);
  deck.castShadow = true;
  body.add(deck);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, width * 0.88), darkTrim);
  spoiler.position.set(tailX + 0.2, 1.3, 0);
  spoiler.castShadow = true;
  body.add(spoiler);
  for (const side of [1, -1]) {
    const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), darkTrim);
    stanchion.position.set(tailX + 0.26, 1.22, side * width * 0.34);
    body.add(stanchion);
  }

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, width * 0.9), darkTrim);
  diffuser.position.set(tailX + 0.12, 0.42, 0);
  body.add(diffuser);

  const exhaustTips = [];
  for (const side of [1, -1]) {
    for (const inner of [0.22, 0.42]) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.22, 12), chrome);
      tip.rotation.z = Math.PI / 2;
      tip.position.set(tailX + 0.02, 0.44, side * (0.3 + inner));
      body.add(tip);
      exhaustTips.push(tip);
    }
  }

  // ---- lights
  const brakeLights = [];
  const reverseLights = [];
  for (const side of [1, -1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.52), tailLight.clone());
    lamp.position.set(tailX + 0.02, 0.86, side * 0.52);
    body.add(lamp);
    brakeLights.push(lamp);

    const reverse = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.16), reverseLight.clone());
    reverse.position.set(tailX + 0.02, 0.66, side * 0.28);
    body.add(reverse);
    reverseLights.push(reverse);

    const front = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.46), headlight);
    front.position.set(noseX - 0.06, 0.86, side * 0.56);
    body.add(front);
  }

  // ---- wheels
  const halfTrack = car.trackWidthM / 2;
  const wheelPositions = [
    { name: "frontLeft", x: car.frontAxleToCgM, z: -halfTrack, steered: true },
    { name: "frontRight", x: car.frontAxleToCgM, z: halfTrack, steered: true },
    { name: "rearLeft", x: -(car.wheelbaseM - car.frontAxleToCgM), z: -halfTrack, steered: false },
    { name: "rearRight", x: -(car.wheelbaseM - car.frontAxleToCgM), z: halfTrack, steered: false },
  ];
  const tyreGeometry = new THREE.CylinderGeometry(car.wheelRadiusM, car.wheelRadiusM, 0.31, 22);
  tyreGeometry.rotateX(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(car.wheelRadiusM * 0.62, car.wheelRadiusM * 0.62, 0.33, 16);
  rimGeometry.rotateX(Math.PI / 2);
  const spokeGeometry = new THREE.BoxGeometry(car.wheelRadiusM * 1.15, 0.05, 0.06);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.28, metalness: 0.9 });
  const discMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.4, metalness: 0.7 });

  const wheels = {};
  for (const spec of wheelPositions) {
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, car.wheelRadiusM, spec.z);
    group.add(pivot);

    const spin = new THREE.Group();
    pivot.add(spin);

    const tyre = new THREE.Mesh(tyreGeometry, rubber);
    tyre.castShadow = true;
    spin.add(tyre);

    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    spin.add(rim);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(spokeGeometry, rimMaterial);
      spoke.rotation.z = (i / 5) * Math.PI;
      spoke.position.z = spec.z > 0 ? 0.02 : -0.02;
      spin.add(spoke);
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(car.wheelRadiusM * 0.7, car.wheelRadiusM * 0.7, 0.04, 16), discMaterial);
    disc.rotation.x = Math.PI / 2;
    pivot.add(disc);

    // Arch over the wheel so the body does not look hollow.
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.42), paint);
    arch.position.set(spec.x, car.wheelRadiusM + 0.42, spec.z * 1.02);
    body.add(arch);

    wheels[spec.name] = { pivot, spin, steered: spec.steered };
  }

  return {
    group,
    body,
    wheels,
    brakeLights,
    reverseLights,
    exhaustTips,
    materials: { paint, glass, tailLight, reverseLight },
    /**
     * Push a telemetry snapshot into the mesh.
     * @param {object} telemetry
     * @param {number} dt
     */
    update(telemetry, dt) {
      const spin = (telemetry.wheelSpeedRpm / 60) * 2 * Math.PI * dt;
      for (const name of Object.keys(wheels)) {
        const wheel = wheels[name];
        if (wheel.steered) wheel.pivot.rotation.y = telemetry.steerAngleRad;
        wheel.spin.rotation.z -= spin;
      }
      // Body attitude: pitch under acceleration/braking, roll in corners.
      const targetPitch = THREE.MathUtils.clamp(-telemetry.longitudinalG * 0.022, -0.05, 0.05);
      const targetRoll = THREE.MathUtils.clamp(telemetry.lateralG * 0.028, -0.07, 0.07);
      body.rotation.z += (targetPitch - body.rotation.z) * Math.min(1, dt * 6);
      body.rotation.x += (targetRoll - body.rotation.x) * Math.min(1, dt * 6);
      const squat = THREE.MathUtils.clamp(-Math.abs(telemetry.longitudinalG) * 0.012, -0.03, 0);
      body.position.y += (squat - body.position.y) * Math.min(1, dt * 5);

      const braking = telemetry.brake > 0.02 || telemetry.overrun > 0.3;
      for (const lamp of brakeLights) {
        lamp.material.emissiveIntensity = braking ? 2.4 : 0.25;
      }
      const reversing = telemetry.gearLabel === "R" && telemetry.throttle > 0.02;
      for (const lamp of reverseLights) {
        lamp.material.emissiveIntensity = reversing ? 1.6 : 0;
      }
    },
  };
}
