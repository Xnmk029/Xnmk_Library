// 程序化天空：4 时段预设（黎明/白天/黄昏/夜晚），驱动半球光、太阳光、雾与清屏色。

export const SKY_PRESETS = [
  {
    id: 'dawn', name: '黎明',
    sky: 0xf2a06a, ground: 0x3a2a22, fog: 0xdd9271,
    sun: 0xffc78a, sunDir: [-0.55, 0.18, -0.35], sunIntensity: 0.75,
    ambient: 0.45, hemi: 0.85, fogNear: 60, fogFar: 260
  },
  {
    id: 'day', name: '白天',
    sky: 0x7fb2e5, ground: 0x3c4a35, fog: 0xa8c6e0,
    sun: 0xfff2d8, sunDir: [0.35, 0.85, -0.35], sunIntensity: 1.25,
    ambient: 0.55, hemi: 1.0, fogNear: 90, fogFar: 380
  },
  {
    id: 'dusk', name: '黄昏',
    sky: 0xc96a4a, ground: 0x2c2320, fog: 0xb8705a,
    sun: 0xff9a5c, sunDir: [0.7, 0.12, -0.2], sunIntensity: 0.85,
    ambient: 0.38, hemi: 0.75, fogNear: 55, fogFar: 250
  },
  {
    id: 'night', name: '夜晚',
    sky: 0x0c1428, ground: 0x10151d, fog: 0x0c1428,
    sun: 0x9fb4d8, sunDir: [-0.4, 0.55, 0.3], sunIntensity: 0.18,
    ambient: 0.28, hemi: 0.35, fogNear: 50, fogFar: 240
  }
];

export function applySky(THREE, scene, id) {
  const p = SKY_PRESETS.find((s) => s.id === id) || SKY_PRESETS[1];
  scene.traverse((o) => {
    if (o instanceof THREE.HemisphereLight) {
      o.skyColor.set(p.sky); o.groundColor.set(p.ground); o.intensity = p.hemi;
    } else if (o instanceof THREE.DirectionalLight) {
      o.color.set(p.sun); o.intensity = p.sunIntensity;
      o.position.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).multiplyScalar(100);
      o.target.position.set(0, 0, 0);
    } else if (o instanceof THREE.AmbientLight) {
      o.color.set(p.sky).multiplyScalar(p.ambient);
    }
  });
  scene.fog.color.set(p.fog);
  scene.fog.near = p.fogNear;
  scene.fog.far = p.fogFar;
  if (scene.userData.renderer) {
    scene.userData.renderer.setClearColor(p.sky);
  }
  return p;
}
