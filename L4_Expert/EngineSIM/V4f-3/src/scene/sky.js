// ============================================================================
// sky.js — 程序化天空：渐变天穹 + 太阳圆盘 + 雾（低开销，无外部贴图）
// ============================================================================
import * as THREE from 'three'

export function createSky(scene) {
  // 渐变天穹（顶部深蓝 → 地平线暖白）
  const geo = new THREE.SphereGeometry(900, 24, 16)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a5aa8) },
      midColor: { value: new THREE.Color(0x8fc4e8) },
      bottomColor: { value: new THREE.Color(0xf2e8d0) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.0 ? mix(midColor, topColor, pow(h, 0.55))
                         : mix(midColor, bottomColor, pow(clamp(-h * 2.0, 0.0, 1.0), 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`
  })
  const dome = new THREE.Mesh(geo, mat)
  dome.renderOrder = -1
  scene.add(dome)

  // 太阳圆盘 + 光晕
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false, depthWrite: false })
  )
  sun.position.set(360, 260, -620)
  sun.lookAt(0, 0, 0)
  scene.add(sun)

  // 主光（带阴影）+ 环境光
  const sunLight = new THREE.DirectionalLight(0xfff1d8, 2.2)
  sunLight.position.set(220, 320, -140)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.near = 20
  sunLight.shadow.camera.far = 900
  sunLight.shadow.camera.left = -80
  sunLight.shadow.camera.right = 80
  sunLight.shadow.camera.top = 80
  sunLight.shadow.camera.bottom = -80
  scene.add(sunLight)

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.75)
  scene.add(hemi)
  const amb = new THREE.AmbientLight(0x33415c, 0.5)
  scene.add(amb)

  // 雾
  scene.fog = new THREE.Fog(0xd9e4ee, 260, 1200)

  return { sunLight, hemi }
}
