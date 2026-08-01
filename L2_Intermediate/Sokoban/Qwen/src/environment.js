import * as THREE from 'three';

// ============================================
// 程序化天空 (卡通/像素风格)
// ============================================
export function createEnvironment(renderer, scene) {
  const skyGeometry = new THREE.SphereGeometry(350, 32, 32);
  
  const skyVertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const skyFragmentShader = /* glsl */ `
    uniform vec3 uTopColor;
    uniform vec3 uMiddleColor;
    uniform vec3 uBottomColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDirection;
    varying vec3 vWorldPosition;
    
    void main() {
      vec3 direction = normalize(vWorldPosition);
      float y = direction.y;
      
      // 天空渐变 (色阶化)
      vec3 color;
      if (y > 0.3) {
        color = mix(uMiddleColor, uTopColor, smoothstep(0.3, 0.9, y));
      } else if (y > 0.0) {
        color = mix(uBottomColor, uMiddleColor, smoothstep(0.0, 0.3, y));
      } else {
        color = uBottomColor;
      }
      
      // 太阳光晕
      float sunDot = max(0.0, dot(direction, normalize(uSunDirection)));
      float sunDisc = smoothstep(0.997, 0.999, sunDot);
      float sunGlow = pow(sunDot, 64.0) * 0.4;
      float sunHalo = pow(sunDot, 8.0) * 0.15;
      
      color += uSunColor * (sunDisc * 2.0 + sunGlow + sunHalo);
      
      // 地平线雾霭
      float horizonFactor = 1.0 - abs(y);
      horizonFactor = pow(horizonFactor, 6.0);
      color = mix(color, uMiddleColor * 1.1, horizonFactor * 0.4);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
  
  const skyMaterial = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: {
      uTopColor: { value: new THREE.Color('#2a5a8f') },
      uMiddleColor: { value: new THREE.Color('#7ab8e0') },
      uBottomColor: { value: new THREE.Color('#a8d8a8') },
      uSunColor: { value: new THREE.Color('#fff8e0') },
      uSunDirection: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.name = 'sky';
  scene.add(sky);
  
  // 环境贴图
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  
  const envScene = new THREE.Scene();
  const envSky = sky.clone();
  envScene.add(envSky);
  
  const envLight = new THREE.AmbientLight(0xffffff, 1);
  envScene.add(envLight);
  
  const renderTarget = pmremGenerator.fromScene(envScene, 0, 0.1, 1000);
  scene.environment = renderTarget.texture;
  
  pmremGenerator.dispose();
  
  return { sky, skyMaterial };
}

// ============================================
// 迷雾效果
// ============================================
export function createFog(scene) {
  // 指数雾 - 自然距离衰减
  scene.fog = new THREE.FogExp2(0x9dc8b0, 0.010);
}

// ============================================
// 地面薄雾
// ============================================
export function createGroundFog() {
  const fogGroup = new THREE.Group();
  fogGroup.name = 'groundFog';
  
  const fogTexture = createFogTexture();
  
  for (let i = 0; i < 6; i++) {
    const fogGeometry = new THREE.PlaneGeometry(50, 50);
    const fogMaterial = new THREE.MeshBasicMaterial({
      map: fogTexture,
      transparent: true,
      opacity: 0.08 - i * 0.008,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: 0xd0e8d8,
    });
    
    const fogPlane = new THREE.Mesh(fogGeometry, fogMaterial);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.3 + i * 0.25;
    fogPlane.position.x = (Math.random() - 0.5) * 15;
    fogPlane.position.z = (Math.random() - 0.5) * 15;
    
    fogGroup.add(fogPlane);
  }
  
  return fogGroup;
}

function createFogTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ============================================
// 太阳
// ============================================
export function createSun() {
  const sunGroup = new THREE.Group();
  
  const sunGeometry = new THREE.CircleGeometry(6, 16);
  const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff8e0,
    fog: false,
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(80, 100, 50);
  sun.lookAt(0, 0, 0);
  sunGroup.add(sun);
  
  const glowGeometry = new THREE.CircleGeometry(14, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffeebb,
    transparent: true,
    opacity: 0.25,
    fog: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.copy(sun.position);
  glow.lookAt(0, 0, 0);
  sunGroup.add(glow);
  
  return sunGroup;
}
