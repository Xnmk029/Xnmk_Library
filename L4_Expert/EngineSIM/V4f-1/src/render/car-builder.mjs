// 车模装载与挂载：OBJ/MTL 异步加载 → MTL 材质升级 → 车轮 pivot（转向+滚动）。
// 失败自动回退程序化车身。

const WHEEL_R = 0.352;
const FRONT_AXLE = 1.473;
const REAR_AXLE = -1.473;
const TRACK = 1.62;

export async function loadCar(THREE, baseUrl) {
  try {
    const mtl = await fetchText(baseUrl + 'assets/models/sports-car2/SportsCar2.mtl');
    const obj = await fetchText(baseUrl + 'assets/models/sports-car2/SportsCar2.obj');
    const mtlLoader = new THREE.MTLLoader();
    const materials = mtlLoader.parse(mtl).materials;
    const objLoader = new THREE.OBJLoader();
    const loaded = objLoader.parse(obj);
    return buildFromLoaded(THREE, loaded, materials);
  } catch (err) {
    console.warn('[car] 模型加载失败，使用程序化回退：', err && err.message);
    return buildFallback(THREE);
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

function buildFromLoaded(THREE, loaded, materials) {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const wheels = { fl: null, fr: null, rl: null, rr: null };
  for (const mesh of loaded.children) {
    const matName = mesh.material.userData.objMat || mesh.material.name;
    const mat = materials[matName];
    if (mat) {
      const m = mat.clone();
      m.name = mat.name;
      mesh.material = m;
    }
    const groupName = mesh.userData.group || mesh.name;
    if (groupName.startsWith('wheel_')) {
      const key = groupName.slice(6).toLowerCase(); // FL/FR/RL/RR
      const side = key.startsWith('F') ? 1 : -1;
      const lateral = key.endsWith('L') ? -TRACK / 2 : TRACK / 2;
      const axle = side > 0 ? FRONT_AXLE : REAR_AXLE;
      const steerPivot = new THREE.Group();
      steerPivot.name = 'steer_' + key;
      steerPivot.position.set(lateral, WHEEL_R, axle);
      const spinPivot = new THREE.Group();
      spinPivot.name = 'spin_' + key;
      steerPivot.add(spinPivot);
      spinPivot.add(mesh);
      mesh.position.set(0, 0, 0);
      root.add(steerPivot);
      wheels[key.toLowerCase()] = { steerPivot, spinPivot, mesh };
    } else {
      bodyGroup.add(mesh);
    }
  }
  root.userData.wheels = wheels;
  root.userData.bodyGroup = bodyGroup;
  root.userData.loaded = true;
  return root;
}

function buildFallback(THREE) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.55, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x8a1410, roughness: 0.25, metalness: 0.55 })
  );
  body.position.y = 0.72;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.45, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 })
  );
  cabin.position.set(0, 1.08, -0.15);
  const bodyGroup = new THREE.Group();
  bodyGroup.add(body, cabin);
  root.add(bodyGroup);
  const wheels = {};
  for (const key of ['fl', 'fr', 'rl', 'rr']) {
    const side = key.startsWith('f') ? 1 : -1;
    const lateral = key.endsWith('l') ? -TRACK / 2 : TRACK / 2;
    const axle = side > 0 ? FRONT_AXLE : REAR_AXLE;
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.28, 18),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 })
    );
    tire.rotation.z = Math.PI / 2;
    const steerPivot = new THREE.Group();
    steerPivot.position.set(lateral, WHEEL_R, axle);
    const spinPivot = new THREE.Group();
    steerPivot.add(spinPivot);
    spinPivot.add(tire);
    root.add(steerPivot);
    wheels[key] = { steerPivot, spinPivot, mesh: tire };
  }
  root.userData.wheels = wheels;
  root.userData.bodyGroup = bodyGroup;
  root.userData.loaded = false;
  return root;
}
