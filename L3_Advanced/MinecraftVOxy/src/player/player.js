// VOXY CRAFT — 玩家（物理 + 视角 + 射线 + 放置/破坏）
import * as THREE from 'three';
import { stepPhysics } from './physics.js';
import { raycastVoxel } from './raycast.js';
import { CONFIG } from '../config.js';
import { BLOCKS, isSolid } from '../data/registry.js';

const isTarget = (id) => id !== 0 && BLOCKS[id] && !BLOCKS[id].liquid;

export class Player {
  constructor(world, camera, controls) {
    this.world = world;
    this.camera = camera;
    this.controls = controls;
    this.state = { x: 0, y: 90, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, flying: true };
    this.eyeHeight = CONFIG.PLAYER.eyeHeight;
    this.reach = CONFIG.PLAYER.reach;
    this.selectedBlock = 1;
    this.target = null;
    this.onEdit = null;   // main.js 注入：重建受影响 chunk

    const g = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({ color: 0x0d0f12, transparent: true, opacity: 0.6 })
    );
    this.highlight.visible = false;

    if (controls) controls.onToggleFly = () => this.toggleFly();
  }

  spawnAt(x, z) {
    const h = this.world.generator ? this.world.generator.terrain.heightAt(x, z) : 60;
    this.state.x = x + 0.5;
    this.state.z = z + 0.5;
    this.state.y = Math.max(h, CONFIG.WORLD_SEA_LEVEL) + 2;
    this.state.vy = 0;
  }

  viewDir() {
    const yaw = this.controls ? this.controls.yaw : this._yaw || 0;
    const pitch = this.controls ? this.controls.pitch : this._pitch || 0;
    return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  }

  // 无指针锁时（测试）直接设定视角
  setLook(yaw, pitch) { this._yaw = yaw; this._pitch = pitch; if (this.controls) { this.controls.yaw = yaw; this.controls.pitch = pitch; } }

  update(dt) {
    const c = this.controls;
    const wish = c ? c.wish() : { mx: 0, mz: 0 };
    const input = {
      mx: wish.mx, mz: wish.mz,
      jump: !!(c && c.keys['Space']),
      descend: !!(c && (c.keys['ShiftLeft'] || c.keys['ShiftRight'])),
    };
    const P = CONFIG.PLAYER;
    stepPhysics((x, y, z) => this.world.getBlock(x, y, z), isSolid, this.state, input, dt, {
      gravity: P.gravity, jumpVel: P.jumpVel, walkSpeed: P.walkSpeed, flySpeed: P.flySpeed,
      hw: P.width / 2, height: P.height,
    });

    const ex = this.state.x, ey = this.state.y + this.eyeHeight, ez = this.state.z;
    this.camera.position.set(ex, ey, ez);
    const d = this.viewDir();
    this.camera.lookAt(ex + d[0], ey + d[1], ez + d[2]);

    this.target = raycastVoxel((x, y, z) => this.world.getBlock(x, y, z), isTarget, ex, ey, ez, d[0], d[1], d[2], this.reach);
    if (this.target.hit) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else this.highlight.visible = false;
  }

  toggleFly() { this.state.flying = !this.state.flying; this.state.vy = 0; }

  breakTarget() {
    if (!this.target || !this.target.hit) return false;
    const { x, y, z } = this.target;
    if (this.world.getBlock(x, y, z) === 0) return false;
    this.world.setBlock(x, y, z, 0);
    if (this.onEdit) this.onEdit(x, y, z);
    return true;
  }

  placeTarget(id = this.selectedBlock) {
    if (!this.target || !this.target.hit) return false;
    const px = this.target.x + this.target.nx;
    const py = this.target.y + this.target.ny;
    const pz = this.target.z + this.target.nz;
    if (this._intersectsPlayer(px, py, pz)) return false;
    this.world.setBlock(px, py, pz, id);
    if (this.onEdit) this.onEdit(px, py, pz);
    return true;
  }

  _intersectsPlayer(bx, by, bz) {
    const hw = CONFIG.PLAYER.width / 2, h = CONFIG.PLAYER.height;
    const s = this.state;
    return (bx + 1 > s.x - hw && bx < s.x + hw &&
            by + 1 > s.y && by < s.y + h &&
            bz + 1 > s.z - hw && bz < s.z + hw);
  }
}
