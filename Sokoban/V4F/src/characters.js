// ---------------------------------------------------------------
// 角色：可操控玩家 + 沿路踱步的 NPC
// 两者都会把草地推开（多角色交互位移 uniform）
// ---------------------------------------------------------------
import * as THREE from 'three';
import { terrainHeight, ROAD_CURVE } from './world.js';

const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function makeCharacterMesh({ shirt, pants, skin, hat }) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.6, 4, 10),
    new THREE.MeshToonMaterial({ color: shirt, flatShading: true })
  );
  body.position.y = 0.68;
  group.add(body);
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.38, 0.3, 10),
    new THREE.MeshToonMaterial({ color: pants, flatShading: true })
  );
  legs.position.y = 0.24;
  group.add(legs);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshToonMaterial({ color: skin, flatShading: true })
  );
  head.position.y = 1.26;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.21, 0.24, 8),
    new THREE.MeshToonMaterial({ color: hat, flatShading: true })
  );
  cap.position.y = 1.52;
  group.add(cap);
  return { group, body };
}

export function createPlayer(scene, blobMat) {
  const { group, body } = makeCharacterMesh({
    shirt: 0x4a7fe0, pants: 0xd8d4c8, skin: 0xf2c99a, hat: 0xc9a86a,
  });
  const player = {
    group, body,
    pos: new THREE.Vector3(-95, 0, -50),
    angle: 0.6,
    speed: 6.5,
    radius: 2.4,
    walkPhase: 0,
    moving: false,
  };
  const h = terrainHeight(player.pos.x, player.pos.z);
  player.pos.y = h;

  // 脚下的软阴影
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat.clone());
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(1.7, 1.7, 1);
  blob.material.opacity = 0.38;
  scene.add(blob);
  player.blob = blob;
  player.updateBlob = () => {
    blob.position.set(player.pos.x, player.pos.y + 0.12, player.pos.z);
  };

  player.update = (dt, keys) => {
    let mx = 0, mz = 0;
    if (keys.up) mz -= 1;
    if (keys.down) mz += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    player.moving = moving;
    if (moving) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      const targetAngle = Math.atan2(mx, mz);
      player.angle = lerpAngle(player.angle, targetAngle, 1 - Math.exp(-10 * dt));
      player.pos.x += mx * player.speed * dt;
      player.pos.z += mz * player.speed * dt;
      player.pos.x = THREE.MathUtils.clamp(player.pos.x, -196, 196);
      player.pos.z = THREE.MathUtils.clamp(player.pos.z, -196, 196);
      player.walkPhase += dt * player.speed * 1.15;
    }
    player.pos.y = terrainHeight(player.pos.x, player.pos.z);
    group.position.set(player.pos.x, player.pos.y, player.pos.z);
    group.rotation.y = player.angle;
    // 走路摆动
    const bob = moving ? Math.sin(player.walkPhase) * 0.06 : Math.sin(player.walkPhase * 0.5) * 0.012;
    body.position.y = 0.68 + bob;
    body.rotation.x = moving ? 0.14 : 0;
    player.updateBlob();
  };
  scene.add(group);
  player.update(1 / 60, {});
  return player;
}

export function createNPC(scene, blobMat) {
  const { group, body } = makeCharacterMesh({
    shirt: 0xd95f43, pants: 0x8a7a5f, skin: 0xf2c99a, hat: 0x7a5a3a,
  });
  const npc = {
    group, body,
    pos: new THREE.Vector3(),
    angle: 0,
    radius: 2.2,
    walkPhase: 0,
    t: 0.12,
    speed: 3.1,
    moving: true,
  };
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat.clone());
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(1.55, 1.55, 1);
  scene.add(blob);
  npc.blob = blob;

  const totalLen = ROAD_CURVE.getLength();
  npc.update = (dt, time) => {
    // 沿路往返踱步（三角波）
    npc.t = 0.12 + 0.76 * (0.5 - 0.5 * Math.cos(time * npc.speed / totalLen * Math.PI * 0.9));
    const p = ROAD_CURVE.getPoint(npc.t);
    const tan = ROAD_CURVE.getTangent(npc.t);
    npc.pos.set(p.x, terrainHeight(p.x, p.z), p.z);
    npc.angle = Math.atan2(tan.x, tan.z);
    npc.walkPhase += dt * npc.speed * 1.15;
    group.position.copy(npc.pos);
    group.rotation.y = npc.angle;
    const bob = Math.sin(npc.walkPhase) * 0.05;
    body.position.y = 0.68 + bob;
    body.rotation.x = 0.12;
    blob.position.set(npc.pos.x, npc.pos.y + 0.12, npc.pos.z);
  };
  scene.add(group);
  npc.update(1 / 60, 0);
  return npc;
}
