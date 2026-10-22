import * as THREE from "three";
import { BLOCKS, ITEMS, LAVA, WATER, faceTexture, isBlockItem, isSolid } from "./blocks";
import { createEntityMaterial, type WorldUniforms } from "./materials";
import { moveEntity, type MoveResult } from "./physics";
import { Player } from "./player";
import { tileLayer } from "./textures";
import { World } from "./world";

const geoCache = new Map<number, THREE.BufferGeometry>();

/** Geometry for an item: block cube (0.25) or flat sprite quad. */
export function itemGeometry(id: number): THREE.BufferGeometry {
  let g = geoCache.get(id);
  if (g) return g;
  const pos: number[] = [], uv: number[] = [], layer: number[] = [], shade: number[] = [], index: number[] = [];
  let n = 0;
  const quad = (pts: number[][], uvs: number[][], l: number, sh: number) => {
    for (let i = 0; i < 4; i++) { pos.push(...pts[i]); uv.push(...uvs[i]); layer.push(l); shade.push(sh); }
    index.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
  };
  const def = isBlockItem(id) ? BLOCKS[id] : null;
  if (def && def.render === "cube") {
    const s = 0.125;
    const F = [
      { c: [[s, -s, -s], [s, s, -s], [s, s, s], [s, -s, s]], uv: [[1, 0], [1, 1], [0, 1], [0, 0]], f: 0, sh: 0.6 },
      { c: [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], f: 1, sh: 0.6 },
      { c: [[-s, s, -s], [-s, s, s], [s, s, s], [s, s, -s]], uv: [[0, 1], [0, 0], [1, 0], [1, 1]], f: 2, sh: 1 },
      { c: [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], f: 3, sh: 0.5 },
      { c: [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]], uv: [[0, 0], [1, 0], [1, 1], [0, 1]], f: 4, sh: 0.8 },
      { c: [[-s, -s, -s], [-s, s, -s], [s, s, -s], [s, -s, -s]], uv: [[1, 0], [1, 1], [0, 1], [0, 0]], f: 5, sh: 0.8 },
    ];
    for (const f of F) quad(f.c, f.uv, tileLayer(faceTexture(def, f.f)), f.sh);
  } else {
    const tile = def ? def.tex.side : ITEMS.get(id)?.tile ?? "stick";
    const l = tileLayer(tile);
    const s = 0.2;
    quad([[-s, -s, 0], [s, -s, 0], [s, s, 0], [-s, s, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]], l, 1);
    quad([[-s, -s, 0.01], [-s, s, 0.01], [s, s, 0.01], [s, -s, 0.01]], [[0, 0], [0, 1], [1, 1], [1, 0]], l, 1);
  }
  g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aLayer", new THREE.Float32BufferAttribute(layer, 1));
  g.setAttribute("aShade", new THREE.Float32BufferAttribute(shade, 1));
  g.setIndex(index);
  geoCache.set(id, g);
  return g;
}

export class DroppedItem {
  pos: THREE.Vector3;
  vel = new THREE.Vector3();
  age = 0;
  pickupDelay: number;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  res: MoveResult = { onGround: false, hitWall: false, inWater: false, inLava: false, headInWater: false };
  dead = false;
  constructor(public id: number, public count: number, x: number, y: number, z: number, shared: WorldUniforms, delay = 0.5) {
    this.pos = new THREE.Vector3(x, y, z);
    this.pickupDelay = delay;
    this.mat = createEntityMaterial(shared);
    this.mesh = new THREE.Mesh(itemGeometry(id), this.mat);
    this.mesh.frustumCulled = false;
  }
}

export class ItemManager {
  items: DroppedItem[] = [];
  group = new THREE.Group();
  constructor(private world: World, private shared: WorldUniforms, scene: THREE.Scene) {
    scene.add(this.group);
  }
  spawn(id: number, count: number, x: number, y: number, z: number, vel?: THREE.Vector3, delay = 0.5) {
    const it = new DroppedItem(id, count, x, y, z, this.shared, delay);
    if (vel) it.vel.copy(vel);
    else it.vel.set((Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3);
    this.items.push(it);
    this.group.add(it.mesh);
    return it;
  }
  spawnBlockDrop(id: number, count: number, bx: number, by: number, bz: number) {
    this.spawn(id, count, bx + 0.5 + (Math.random() - 0.5) * 0.4, by + 0.4, bz + 0.5 + (Math.random() - 0.5) * 0.4);
  }
  update(dt: number, player: Player, onPickup: (id: number, count: number) => number, day: number) {
    const pp = player.pos;
    for (const it of this.items) {
      it.age += dt;
      if (it.pickupDelay > 0) it.pickupDelay -= dt;
      if (it.age > 300) it.dead = true;
      // physics
      if (it.res.inWater) it.vel.y += (1.0 - it.vel.y) * Math.min(1, dt * 4);
      else it.vel.y -= 32 * dt * 0.6;
      if (it.vel.y < -40) it.vel.y = -40;
      const fr = it.res.onGround ? Math.pow(0.02, dt) : Math.pow(0.5, dt);
      it.vel.x *= fr; it.vel.z *= fr;
      // if stuck inside a solid block, push up
      const bx = Math.floor(it.pos.x), by = Math.floor(it.pos.y), bz = Math.floor(it.pos.z);
      if (isSolid(this.world.getBlock(bx, by, bz))) it.pos.y = by + 1.001;
      moveEntity(this.world, it.pos, 0.125, 0.25, it.vel, dt, it.res);
      if (it.res.inLava || this.world.getBlock(bx, by, bz) === LAVA) it.dead = true;
      // pickup
      if (it.pickupDelay <= 0) {
        const dx = it.pos.x - pp.x, dy = it.pos.y - (pp.y + 0.9), dz = it.pos.z - pp.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1.6 * 1.6) {
          // magnet
          const d = Math.sqrt(d2) || 1;
          it.vel.x -= (dx / d) * 12 * dt; it.vel.z -= (dz / d) * 12 * dt; it.vel.y -= (dy / d) * 12 * dt;
        }
        if (d2 < 0.9 * 0.9 || (Math.abs(dx) < 0.8 && Math.abs(dz) < 0.8 && dy > -1.2 && dy < 1.2)) {
          const left = onPickup(it.id, it.count);
          if (left <= 0) it.dead = true;
          else it.count = left;
        }
      }
      // visuals
      const bob = Math.sin(it.age * 2.2) * 0.07 + 0.2;
      it.mesh.position.set(it.pos.x, it.pos.y + bob, it.pos.z);
      it.mesh.rotation.y = it.age * 1.6;
      const ly = Math.floor(it.pos.y + 0.2);
      const packed = this.world.getLightPacked(bx, ly, bz);
      it.mat.uniforms.uSky.value = (packed >> 4) / 15;
      it.mat.uniforms.uBlock.value = (packed & 15) / 15;
      // sprites face the player
      if (!(isBlockItem(it.id) && BLOCKS[it.id].render === "cube")) it.mesh.rotation.y = Math.atan2(pp.x - it.pos.x, pp.z - it.pos.z);
    }
    // merge same stacks
    for (let i = 0; i < this.items.length; i++) {
      const a = this.items[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.items.length; j++) {
        const b = this.items[j];
        if (b.dead || b.id !== a.id) continue;
        if (a.pos.distanceToSquared(b.pos) < 0.6 * 0.6 && a.count + b.count <= 64) {
          a.count += b.count;
          b.dead = true;
        }
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.dead) {
        this.group.remove(it.mesh);
        it.mat.dispose();
        this.items.splice(i, 1);
      }
    }
    void day;
    void WATER;
  }
}
