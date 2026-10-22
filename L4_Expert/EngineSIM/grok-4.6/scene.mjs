/**
 * Three.js world factory. Pass in the THREE namespace so this module stays
 * importable from Node tests that only inspect SCENE_SPEC.
 */

export const SCENE_SPEC = Object.freeze({
  sky: true,
  lighting: true,
  asphalt: true,
  dualColorCurbs: Object.freeze(['#c41e3a', '#f4f0e6']),
  grass: true,
  car: 'low-poly modern American muscle, front-mid V8',
  track: 'rounded-rectangle circuit',
});

export function sampleRoundedRect(width, height, radius, spacing) {
  const pts = [];
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw - 1, hh - 1);

  function push(x, y, heading) {
    const last = pts[pts.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < spacing * 0.45) return;
    pts.push({ x, y, heading });
  }

  const straight = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(len / spacing));
    const h = Math.atan2(dy, dx);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      push(x0 + dx * t, y0 + dy * t, h);
    }
  };

  const arc = (cx, cy, a0, a1) => {
    const da = a1 - a0;
    const len = Math.abs(da) * r;
    const n = Math.max(4, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + da * t;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      push(x, y, a + Math.PI / 2);
    }
  };

  straight(-hw + r, -hh, hw - r, -hh);
  arc(hw - r, -hh + r, -Math.PI / 2, 0);
  straight(hw, -hh + r, hw, hh - r);
  arc(hw - r, hh - r, 0, Math.PI / 2);
  straight(hw - r, hh, -hw + r, hh);
  arc(-hw + r, hh - r, Math.PI / 2, Math.PI);
  straight(-hw, hh - r, -hw, -hh + r);
  arc(-hw + r, -hh + r, Math.PI, Math.PI * 1.5);

  return pts;
}

function makeSkyDome(THREE) {
  const geo = new THREE.SphereGeometry(420, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 zenith = vec3(0.23, 0.48, 0.78);
        vec3 horizon = vec3(0.78, 0.86, 0.94);
        vec3 ground = vec3(0.42, 0.48, 0.38);
        vec3 col = mix(horizon, zenith, clamp(h, 0.0, 1.0));
        col = mix(ground, col, smoothstep(-0.15, 0.08, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function addLighting(scene, THREE) {
  const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x3a3228, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d0, 1.15);
  sun.position.set(60, 90, 30);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88a0c0, 0.28);
  fill.position.set(-40, 20, -50);
  scene.add(fill);
  scene.fog = new THREE.Fog(0x8fb4d2, 80, 320);
}

function addGroundAndTrack(scene, THREE) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x3f6a38, roughness: 0.95 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.05;
  scene.add(grass);

  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x2b2c31,
    roughness: 0.88,
    metalness: 0.04,
  });
  const path = sampleRoundedRect(180, 110, 28, 3.2);
  const halfW = 6.2;
  const road = new THREE.Group();
  const curbA = new THREE.MeshStandardMaterial({ color: 0xc41e3a, roughness: 0.55 });
  const curbB = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.55 });
  const dash = new THREE.MeshStandardMaterial({ color: 0xd8c56a, roughness: 0.6 });

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 0.001;
    const h = Math.atan2(dy, dx);
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(len + 0.15, 0.08, halfW * 2), asphalt);
    slab.position.set(midX, 0.02, midY);
    slab.rotation.y = -h;
    road.add(slab);

    if (i % 3 === 0) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(len * 0.45, 0.09, 0.18), dash);
      line.position.set(midX, 0.07, midY);
      line.rotation.y = -h;
      road.add(line);
    }

    const nx = -Math.sin(h);
    const nz = Math.cos(h);
    const curbMat = i % 2 === 0 ? curbA : curbB;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.16, 0.42), curbMat);
    inner.position.set(midX + nx * halfW, 0.1, midY + nz * halfW);
    inner.rotation.y = -h;
    road.add(inner);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.16, 0.42), curbMat);
    outer.position.set(midX - nx * halfW, 0.1, midY - nz * halfW);
    outer.rotation.y = -h;
    road.add(outer);
  }
  scene.add(road);
  return path;
}

function wheel(THREE, x, z) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  );
  tire.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10),
    new THREE.MeshStandardMaterial({ color: 0xc9c4b8, metalness: 0.7, roughness: 0.3 })
  );
  rim.rotation.z = Math.PI / 2;
  g.add(tire);
  g.add(rim);
  g.position.set(x, 0.34, z);
  return g;
}

export function createMuscleCar(THREE) {
  const car = new THREE.Group();
  car.name = 'muscleCar';

  const paint = new THREE.MeshStandardMaterial({
    color: 0xb53a12,
    metalness: 0.45,
    roughness: 0.38,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x223344,
    roughness: 0.15,
    metalness: 0.3,
    transparent: true,
    opacity: 0.72,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.85, roughness: 0.22 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.55, 0.55, 1.95), paint);
  body.position.set(0.05, 0.62, 0);
  car.add(body);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 1.7), paint);
  hood.position.set(1.22, 0.94, 0);
  car.add(hood);

  const bulge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), dark);
  bulge.position.set(0.85, 1.04, 0);
  bulge.name = 'engineBay';
  car.add(bulge);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 1.55), paint);
  cabin.position.set(-0.55, 1.12, 0);
  car.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 1.35), paint);
  roof.position.set(-0.7, 1.42, 0);
  car.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 1.4), glass);
  windshield.position.set(0.22, 1.18, 0);
  windshield.rotation.z = -0.35;
  car.add(windshield);

  const grill = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 1.15), dark);
  grill.position.set(2.32, 0.58, 0);
  car.add(grill);

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c8,
    emissive: 0xffe7a0,
    emissiveIntensity: 0.55,
  });
  const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampMat);
  l1.position.set(2.3, 0.62, 0.55);
  const l2 = l1.clone();
  l2.position.z = -0.55;
  car.add(l1);
  car.add(l2);

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xaa0000,
    emissiveIntensity: 0.4,
  });
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.45), tailMat);
  t1.position.set(-2.22, 0.7, 0.55);
  const t2 = t1.clone();
  t2.position.z = -0.55;
  car.add(t1);
  car.add(t2);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.9), chrome);
  bumperF.position.set(2.38, 0.38, 0);
  const bumperR = bumperF.clone();
  bumperR.position.x = -2.28;
  car.add(bumperF);
  car.add(bumperR);

  const exMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.35 });
  const e1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), exMat);
  e1.rotation.z = Math.PI / 2;
  e1.position.set(-2.35, 0.28, 0.32);
  const e2 = e1.clone();
  e2.position.z = -0.32;
  car.add(e1);
  car.add(e2);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 1.5), dark);
  spoiler.position.set(-2.05, 1.05, 0);
  car.add(spoiler);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.02, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })
  );
  stripe.position.set(0.05, 0.91, 0);
  car.add(stripe);

  const wheels = [
    wheel(THREE, 1.38, 0.88),
    wheel(THREE, 1.38, -0.88),
    wheel(THREE, -1.42, 0.88),
    wheel(THREE, -1.42, -0.88),
  ];
  wheels.forEach((w) => car.add(w));
  car.userData.wheels = wheels;

  car.position.y = 0;
  return car;
}

export function createWorld(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7eafd4);
  scene.add(makeSkyDome(THREE));
  addLighting(scene, THREE);
  const path = addGroundAndTrack(scene, THREE);
  const car = createMuscleCar(THREE);
  if (path.length) {
    car.position.set(path[0].x, 0, path[0].y);
    car.rotation.y = -path[0].heading;
  }
  scene.add(car);
  return { scene, car, path, spec: SCENE_SPEC };
}

export function placeCar(car, state) {
  car.position.set(state.x, 0, state.y);
  car.rotation.y = -state.yaw;
  const wheels = car.userData.wheels;
  if (wheels) {
    const spin = (state.speedMs / 0.335) * 0.016;
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x -= spin;
    }
    const steer = (state.steer || 0) * 0.42;
    wheels[0].rotation.y = -steer;
    wheels[1].rotation.y = -steer;
  }
}
