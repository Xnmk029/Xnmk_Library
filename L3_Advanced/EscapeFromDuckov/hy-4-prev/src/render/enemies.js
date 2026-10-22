// 敌人实例化渲染：本体 + 装备各一个 InstancedMesh，上百只丧鸭也只有个位数 draw call。
// 描边孪生体共享 instanceMatrix 对象，所以描边不产生任何额外上传。
import * as THREE from 'three';
import { duckGeometries } from '../gfx/geo/duck.js';
import { toon } from '../gfx/materials/toon.js';
import { InstancePool } from './instancing.js';
import { LAYER_CHAR } from './camera.js';
import { STATE } from '../entities/enemy.js';

const _c = new THREE.Color();

export class EnemyView {
  constructor(scene, max = 320) {
    this.scene = scene;
    this.max = max;
    const G = duckGeometries();
    // 角色层：在调色之后绘制，因此鸭子始终保持高饱和固有色
    this.mat = toon({ vertexColors: true }, { flash: true });
    const arg = { outline: true, layer: LAYER_CHAR };
    this.pools = {
      body: new InstancePool(G.body.clone(), this.mat, max, arg).addTo(scene),
      helmet: new InstancePool(G.helmet.clone(), this.mat, max, arg).addTo(scene),
      vest: new InstancePool(G.vest.clone(), this.mat, max, arg).addTo(scene),
      backpack: new InstancePool(G.backpack.clone(), this.mat, max, arg).addTo(scene),
      pauldron: new InstancePool(G.pauldron.clone(), this.mat, max, arg).addTo(scene),
    };
    this.drawn = 0;
    this.corpseDrawn = 0;
  }

  /**
   * @param {Array} enemies 敌人列表（含 seen/hidden 由 vision 写入）
   * @param {Array} corpses 尸体列表
   */
  update(enemies, corpses, alpha, dt, time, thermal) {
    for (const k in this.pools) this.pools[k].begin();
    let drawn = 0;
    for (const e of enemies) {
      // 盲区剔除：与迷雾同源，看不见的模型根本不进实例列表（防作弊式）
      if (e.hidden && !thermal) continue;
      if (thermal && !e.alive) continue;
      if (!e.alive) continue;
      if (drawn >= this.max) break;

      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      const sc = e.scale ?? 1;
      // 走动摆动：无骨骼，靠缩放与倾斜做卡通律动
      const bob = Math.sin(e.bob * 3) * (e.moving ? 0.05 : 0.012);
      const lean = e.moving ? Math.min(0.18, e.speed * 0.035) : 0;
      const crouch = e.state === STATE.ATTACK ? 0.88 : 1;

      const flash = e.flash ?? 0;
      // 狂暴搜刮者前摇：整只鸭子转成刺眼的红 —— 这是让你翻滚的信号，不是装饰
      const charge = e.telegraph > 0 ? 0.6 + 0.4 * Math.sin(time * 30) : 0;
      const tint = charge > 0 ? 0xff5a3a : (e.def?.tint ?? 0xffffff);
      const st = { fow: 0, flash: Math.max(flash, charge * 0.85), outline: 1, color: tint };

      this.pools.body.push(x, bob * sc, z, e.facing,
        sc, sc * (1 + bob * 0.5) * crouch, sc, st);
      for (const k of e.def?.equip || []) {
        this.pools[k]?.push(x, bob * sc, z, e.facing,
          sc, sc * (1 + bob * 0.5) * crouch, sc, st);
      }
      drawn++;
    }
    // 尸体：压扁的鸭子躺在地上，随腐烂变暗
    let cd = 0;
    for (const c of corpses || []) {
      if (c.hidden) continue;
      const t = 0.62 + 0.38 * (1 - (c.rot ?? 0));
      if (this.pools.body.push(c.x, 0.06, c.z, c.rotY ?? 0, 1, 0.28, 1.15, {
        fow: 0, flash: 0, outline: 1, color: _c.setRGB(t * 0.72, t * 0.68, t * 0.58).getHex(),
      }) >= 0) cd++;
    }
    for (const k in this.pools) this.pools[k].commit();
    this.drawn = drawn;
    this.corpseDrawn = cd;
  }
}
