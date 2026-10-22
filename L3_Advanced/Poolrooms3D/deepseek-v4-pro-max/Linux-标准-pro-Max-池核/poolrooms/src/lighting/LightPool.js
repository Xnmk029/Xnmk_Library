// LightPool: a fixed number of real point lights, re-bound每帧 to the nearest chunk light data.
//
// The generator scatters a few fill lights per chunk; with a 5x5 chunk ring that is ~100 lights, and
// a forward renderer evaluates every one of them per fragment. Keeping the *count constant* also
// avoids shader recompiles, so we allocate N once and move them around.

import * as THREE from 'three';

export class LightPool {
  constructor(scene, { count = 6, range = 42 } = {}) {
    this.scene = scene;
    this.range = range;
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      l.visible = true; // stays in the scene so the light count never changes
      scene.add(l);
      this.lights.push(l);
    }
    this._candidates = [];
    this._timer = 0;
  }

  /** Re-bind the pool to the closest lights around the player (throttled; lights are static). */
  update(dt, playerPos, streamer) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 0.25;

    const cands = this._candidates;
    cands.length = 0;
    const r2 = this.range * this.range;
    for (const chunk of streamer.near(playerPos.x, playerPos.z, 2)) {
      for (const l of chunk.lights) {
        const dx = l.pos[0] - playerPos.x;
        const dy = l.pos[1] - playerPos.y;
        const dz = l.pos[2] - playerPos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r2) cands.push({ l, d2 });
      }
    }
    cands.sort((a, b) => a.d2 - b.d2);

    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      const c = cands[i];
      if (!c) {
        light.intensity = 0;
        continue;
      }
      const d = c.l;
      light.position.set(d.pos[0], d.pos[1], d.pos[2]);
      light.color.setRGB(d.color[0], d.color[1], d.color[2]);
      light.distance = d.distance;
      // Fade out at the edge of the pool's range so swaps are never visible.
      const fade = 1.0 - Math.min(1, Math.sqrt(c.d2) / this.range);
      light.intensity = d.intensity * (0.35 + 0.65 * fade);
    }
  }
}
