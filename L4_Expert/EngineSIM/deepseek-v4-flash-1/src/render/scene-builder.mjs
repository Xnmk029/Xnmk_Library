// 场景构建：闭合样条赛道（柏油/双色路肩/砾石/草地）、程序化纹理、
// 动态阴影跟随、雾与天空同色。
import { Track, TRACK_HALF_WIDTH, CURB_HALF_WIDTH, GRAVEL_HALF_WIDTH } from '../track/track.mjs';

function makeCanvasTexture(THREE, kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  if (kind === 'asphalt') {
    g.fillStyle = '#3a3d40';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      const v = 40 + Math.random() * 60;
      g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    g.fillStyle = 'rgba(20,20,22,0.55)';
    for (let i = 0; i < 12; i++) {
      g.fillRect(0, Math.random() * 256, 256, 1 + Math.random() * 2);
    }
  } else if (kind === 'curb') {
    for (let x = 0; x < 8; x++) {
      g.fillStyle = x % 2 === 0 ? '#d43b3b' : '#e8e8e8';
      g.fillRect(x * 32, 0, 32, 256);
    }
  } else if (kind === 'gravel') {
    g.fillStyle = '#6b5d4c';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120,105,85,0.8)' : 'rgba(70,60,48,0.8)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
  } else {
    g.fillStyle = '#3f7a35';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(70,120,50,0.7)' : 'rgba(45,90,38,0.7)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 3 + Math.random() * 5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = 1000; // RepeatWrapping
  return tex;
}

function ribbon(THREE, track, halfW, y, uvScale, tex, materialOpts) {
  const N = 300;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const s = track.sample(i / N);
    const nx = -s.dz, nz = s.dx;
    pos.push(s.x - nx * halfW, y, s.z - nz * halfW, s.x + nx * halfW, y, s.z + nz * halfW);
    uv.push(i / N * uvScale, 0, i / N * uvScale, 1);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, ...materialOpts });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildScene(THREE) {
  const track = new Track();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa8c6e0, 90, 380);
  scene.userData.track = track;

  const hemi = new THREE.HemisphereLight(0x7fb2e5, 0x3c4a35, 1.0);
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
  sun.castShadow = true;
  sun.position.set(35, 85, -35);
  scene.add(hemi, amb, sun, sun.target);

  // 草地
  const grassTex = makeCanvasTexture(THREE, 'grass');
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // 砾石带
  scene.add(ribbon(THREE, track, GRAVEL_HALF_WIDTH, 0.015, 30, makeCanvasTexture(THREE, 'gravel'),
    { color: 0x9a8c78 }));
  // 柏油路
  scene.add(ribbon(THREE, track, TRACK_HALF_WIDTH, 0.03, 45, makeCanvasTexture(THREE, 'asphalt'),
    { color: 0xbfc2c5 }));
  // 双色路肩（左右两条）
  const curbTex = makeCanvasTexture(THREE, 'curb');
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.85 });
  for (const side of [-1, 1]) {
    const N = 300;
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const s = track.sample(i / N);
      const nx = -s.dz, nz = s.dx;
      const w0 = side > 0 ? TRACK_HALF_WIDTH : -TRACK_HALF_WIDTH;
      const w1 = side > 0 ? CURB_HALF_WIDTH : -CURB_HALF_WIDTH;
      pos.push(s.x + nx * w0, 0.035, s.z + nz * w0, s.x + nx * w1, 0.035, s.z + nz * w1);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Array.from({ length: (N + 1) * 2 }, (_, i) => (i % 2 === 0 ? i / 2 / N * 60 : 0))), 2));
    geo.computeVertexNormals();
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    const curb = new THREE.Mesh(geo, curbMat);
    curb.receiveShadow = true;
    scene.add(curb);
  }
  return scene;
}
