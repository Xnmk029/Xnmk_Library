/**
 * Sky, sun, light and terrain - the "somewhere real" part of the scene.
 *
 * A late-afternoon sun low enough to throw long shadows down the main straight,
 * a physical sky, exponential haze, rolling hills outside the circuit and a few
 * hundred instanced trees. All of it is built from code and costs a handful of
 * draw calls.
 */

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Xorshift32 } from "../audio/dsp/random.js";
import { createGrassTexture } from "./textures.js";

/** Late-afternoon lighting preset. */
export const AFTERNOON = Object.freeze({
  sunElevationDeg: 16,
  sunAzimuthDeg: 132,
  turbidity: 4.2,
  rayleigh: 2.1,
  mieCoefficient: 0.006,
  mieDirectionalG: 0.82,
  sunIntensity: 3.1,
  ambientIntensity: 0.55,
  fogDensity: 0.00085,
  fogColor: 0xa9c4d8,
});

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} [preset]
 */
export function createEnvironment(scene, renderer, preset = AFTERNOON) {
  const sky = new Sky();
  sky.scale.setScalar(60000);
  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = preset.turbidity;
  uniforms.rayleigh.value = preset.rayleigh;
  uniforms.mieCoefficient.value = preset.mieCoefficient;
  uniforms.mieDirectionalG.value = preset.mieDirectionalG;

  const phi = THREE.MathUtils.degToRad(90 - preset.sunElevationDeg);
  const theta = THREE.MathUtils.degToRad(preset.sunAzimuthDeg);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  uniforms.sunPosition.value.copy(sunPosition);
  scene.add(sky);

  scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);

  const sun = new THREE.DirectionalLight(0xfff1dd, preset.sunIntensity);
  sun.position.copy(sunPosition).multiplyScalar(600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 900;
  const shadowExtent = 190;
  sun.shadow.camera.left = -shadowExtent;
  sun.shadow.camera.right = shadowExtent;
  sun.shadow.camera.top = shadowExtent;
  sun.shadow.camera.bottom = -shadowExtent;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.9;
  scene.add(sun);
  scene.add(sun.target);

  const hemisphere = new THREE.HemisphereLight(0xbcd8f2, 0x4a5a3c, preset.ambientIntensity);
  scene.add(hemisphere);

  // A cheap environment map so the car's paint and glass have something to
  // reflect: a tiny render of the sky into a cube target.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  skyScene.add(sky.clone());
  const skyTarget = pmrem.fromScene(skyScene, 0.04);
  scene.environment = skyTarget.texture;
  scene.environmentIntensity = 0.65;
  pmrem.dispose();

  return {
    sky,
    sun,
    hemisphere,
    sunPosition,
    /** Keep the shadow frustum centred on the car. */
    followTarget(position) {
      sun.position.copy(sunPosition).multiplyScalar(420).add(position);
      sun.target.position.copy(position);
      sun.target.updateMatrixWorld();
    },
    dispose() {
      skyTarget.dispose();
    },
  };
}

/**
 * Terrain: a large displaced plane that stays flat near the circuit and rolls
 * into hills further out, plus instanced trees in the safe zones.
 *
 * @param {import('../track/track-layout.js').TrackLayout} layout
 * @param {object} [options]
 */
export function createTerrain(layout, { size = 2600, segments = 180, hillHeight = 34, flatMarginM = 34 } = {}) {
  const group = new THREE.Group();
  group.name = "terrain";

  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const rng = new Xorshift32(0x2ba71c5);
  const phaseA = rng.nextUnit() * 10;
  const phaseB = rng.nextUnit() * 10;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    // Physics coordinates are (x, y) with world z = -y.
    const near = layout.nearest(x, -z);
    const distanceFromTrack = Math.max(0, Math.abs(near.lateral) - near.halfWidth - flatMarginM);
    const blend = Math.min(1, distanceFromTrack / 240);
    const rolling =
      Math.sin(x * 0.0031 + phaseA) * Math.cos(z * 0.0027 + phaseB) * 0.62 +
      Math.sin(x * 0.0091 + phaseB * 2) * Math.cos(z * 0.0073 + phaseA) * 0.26 +
      Math.sin(x * 0.021) * Math.cos(z * 0.019) * 0.12;
    position.setY(i, rolling * hillHeight * blend * blend);
  }
  geometry.computeVertexNormals();

  const grass = createGrassTexture();
  const material = new THREE.MeshStandardMaterial({
    map: grass,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);

  // ---- trees, only where they cannot be hit
  const trunkGeometry = new THREE.CylinderGeometry(0.28, 0.42, 3.4, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4d3b2a, roughness: 0.9 });
  const canopyGeometry = new THREE.ConeGeometry(3.1, 8.6, 7);
  const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5a2c, roughness: 0.85 });

  const candidates = [];
  const treeRng = new Xorshift32(0x51f3a9d);
  for (let attempt = 0; attempt < 4200 && candidates.length < 420; attempt++) {
    const x = (treeRng.nextUnit() - 0.5) * size * 0.86;
    const z = (treeRng.nextUnit() - 0.5) * size * 0.86;
    const near = layout.nearest(x, -z);
    const clearance = Math.abs(near.lateral) - near.halfWidth;
    if (clearance < 42 || clearance > 620) continue;
    const y = sampleTerrainHeight(geometry, size, segments, x, z);
    candidates.push({ x, y, z, scale: 0.75 + treeRng.nextUnit() * 0.85, rotation: treeRng.nextUnit() * Math.PI * 2 });
  }

  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, candidates.length);
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, candidates.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const translation = new THREE.Vector3();
  candidates.forEach((tree, index) => {
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
    scale.set(tree.scale, tree.scale, tree.scale);
    translation.set(tree.x, tree.y + 1.7 * tree.scale, tree.z);
    matrix.compose(translation, quaternion, scale);
    trunks.setMatrixAt(index, matrix);
    translation.set(tree.x, tree.y + (3.4 + 4.3) * tree.scale, tree.z);
    matrix.compose(translation, quaternion, scale);
    canopies.setMatrixAt(index, matrix);
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies);

  return { group, ground, treeCount: candidates.length };
}

/** @private Bilinear sample of the displaced terrain plane. */
function sampleTerrainHeight(geometry, size, segments, x, z) {
  const half = size / 2;
  const u = Math.min(segments, Math.max(0, Math.round(((x + half) / size) * segments)));
  const v = Math.min(segments, Math.max(0, Math.round(((z + half) / size) * segments)));
  const index = v * (segments + 1) + u;
  return geometry.attributes.position.getY(index) ?? 0;
}
