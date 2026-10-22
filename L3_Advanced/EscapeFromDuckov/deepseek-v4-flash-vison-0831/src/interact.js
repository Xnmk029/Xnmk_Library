import { clamp, dist2 } from './util.js';
import { ITEMS } from './items.js';
import { HALF } from './world.js';

// ================= 环境交互：门窗/路障/容器/水源/农业/睡眠/发电机 =================
export class Interact {
  constructor(game) {
    this.game = game;
    this.action = null; // {label, t, total, onDone, cancelOnMove}
    this.target = null;
    this.targetType = null;
  }
  update(dt) {
    const g = this.game, p = g.player;
    // 探测附近交互目标
    this.target = null; this.targetType = null;
    const wall = g.world.findWallInteract(p.x, p.z, 1.9);
    if (wall) { this.target = wall; this.targetType = wall.type; }
    else {
      const c = g.world.nearestContainer(p.x, p.z, 1.8);
      if (c) { this.target = c; this.targetType = c.type; }
    }
    // 农田
    if (!this.target) {
      const cx = Math.floor(p.x), cz = Math.floor(p.z);
      for (let dx = -1; dx <= 1 && !this.target; dx++) for (let dz = -1; dz <= 1; dz++) {
        const plot = g.world.farmPlots.get((cx + dx) + ',' + (cz + dz));
        if (plot) { this.target = { ...plot, x: cx + dx + 0.5, z: cz + dz + 0.5, plotKey: (cx + dx) + ',' + (cz + dz) }; this.targetType = 'plot'; }
      }
    }
    // 井
    if (!this.target && g.world.well && dist2(p.x, p.z, g.world.well.x, g.world.well.z) < 2.2) {
      this.target = { x: g.world.well.x, z: g.world.well.z, type: 'well' }; this.targetType = 'well';
    }
    // 车辆（撤离）
    if (!this.target && g.world.car && dist2(p.x, p.z, g.world.car.x, g.world.car.z) < 2.6) {
      this.target = { x: g.world.car.x, z: g.world.car.z, type: 'car' }; this.targetType = 'car';
    }
    // 发电机（加油站）
    if (!this.target && g.world.gasStation && dist2(p.x, p.z, g.world.gasStation.x, g.world.gasStation.z) < 2.4) {
      this.target = { x: g.world.gasStation.x, z: g.world.gasStation.z, type: 'genstation' }; this.targetType = 'genstation';
    }
    // 篝火
    if (!this.target) {
      for (const f of g.world.fires.values()) {
        if (dist2(p.x, p.z, f.x, f.z) < 2.2) { this.target = { ...f, type: 'fire' }; this.targetType = 'fire'; break; }
      }
    }
    // 床（睡觉）
    if (!this.target) {
      const b = g.world.buildingOf[g.world.idx(Math.floor(p.x), Math.floor(p.z))];
      if (b >= 0) {
        const bd = g.world.buildings[b];
        if (bd) {
          // 在建筑内且有床的房间 → 可睡
          this.target = { x: (bd.x0 + bd.x1) / 2 + 0.5, z: (bd.z0 + bd.z1) / 2 + 0.5, type: 'sleep' };
          this.targetType = 'sleep';
        }
      }
    }
    // 动作进度
    if (this.action) {
      if (this.action.cancelOnMove !== false && p.moving) { this.cancel(); }
      else {
        this.action.t -= dt;
        if (this.action.t <= 0) {
          const fn = this.action.onDone;
          this.action = null;
          if (fn) fn();
        }
      }
    }
    g.ui.updatePrompt();
  }
  cancel() { this.action = null; this.game.ui.updatePrompt(); }
  promptText() {
    const g = this.game;
    if (this.action) return { label: this.action.label + '…', progress: 1 - this.action.t / this.action.total };
    if (!this.target) return null;
    switch (this.targetType) {
      case 'door': return { label: (this.target.open ? '关闭' : '打开') + '门 ' + (this.target.locked ? '（已锁）' : ''), key: 'E' };
      case 'window': return { label: (this.target.smashed ? (this.target.open ? '关闭' : '打开') + '破窗（翻越）' : (this.target.open ? '关闭窗户' : '打开窗户')), key: 'E' };
      case 'fridge': case 'counter': case 'shelf': case 'wardrobe': case 'gunrack': case 'corpse': return { label: '搜刮 ' + this.target.name, key: 'E' };
      case 'plot': return { label: this.target.planted ? (this.target.water < 0.3 ? '浇水' : '收获？未成熟') : '播种', key: 'E' };
      case 'well': return { label: '取水', key: 'E' };
      case 'car': return { label: '检查撤离车辆', key: 'E' };
      case 'genstation': return { label: '发电机（加油站）', key: 'E' };
      case 'fire': return { label: this.target.lit ? '熄灭篝火' : '点燃篝火', key: 'E' };
      case 'sleep': return { label: '睡觉', key: 'E' };
    }
    return null;
  }
  // 主交互（E）
  main() {
    const g = this.game, p = g.player;
    if (this.action) return;
    if (!this.target) return;
    switch (this.targetType) {
      case 'door': this.doorAction(this.target); break;
      case 'window': this.windowAction(this.target); break;
      case 'fridge': case 'counter': case 'shelf': case 'wardrobe': case 'gunrack': case 'corpse':
        this.searchContainer(this.target); break;
      case 'plot': this.plotAction(this.target); break;
      case 'well': this.wellAction(); break;
      case 'car': this.carAction(); break;
      case 'genstation': this.genAction(); break;
      case 'fire': this.fireAction(this.target); break;
      case 'sleep': this.sleepAction(); break;
    }
  }
  doorAction(w) {
    const g = this.game, p = g.player;
    if (w.locked) {
      if (w.requires) {
        const card = p.findItem(w.requires);
        if (card) { w.locked = false; g.toast('🔓 使用 ' + card.item.name + ' 打开了门', 'good'); p.takeItem(card, 1); }
        else { g.toast('🔒 需要 ' + (w.requires === 'keycard_blue' ? '蓝色门禁卡' : '红色门禁卡'), 'warn'); }
      } else if (p.hasTool('crowbar')) {
        this.start('撬锁中', 4, () => { w.locked = false; g.audio.door(); g.toast('🔓 撬开了门', 'good'); g.player.stats.addXp('maintenance', 2); });
      } else { g.toast('🔒 门锁着，需要撬棍或钥匙', 'warn'); }
      return;
    }
    if (w.barricade > 0) { g.toast('🚧 门被木板封住了', 'warn'); return; }
    w.open = !w.open;
    g.audio.door();
    if (!w.open) g.events.emit('noise', { x: w.x, z: w.z, r: 5, type: 'door' });
  }
  windowAction(w) {
    const g = this.game;
    if (w.barricade > 0) { g.toast('🚧 窗户被木板封住了', 'warn'); return; }
    if (!w.smashed) {
      w.open = !w.open;
      g.audio.door();
      return;
    }
    // 翻越破窗
    const p = g.player;
    const to = this.windowInsidePos(w);
    this.start('翻越窗户', 1.6, () => {
      p.x = to.x; p.z = to.z;
      g.audio.roll();
      if (p.stats.pain > 50 && Math.random() < 0.3) {
        p.stats.damagePart('handL', 6, 'glass');
        p.stats.parts.handL.glass = true;
        g.toast('🩸 被碎玻璃划伤', 'warn');
      }
    }, false);
    g.events.emit('noise', { x: w.x, z: w.z, r: 6, type: 'vault' });
  }
  windowInsidePos(w) {
    const g = this.game;
    // 沿墙法向两侧尝试
    const cands = [
      { x: w.cx + w.nx * 0.95, z: w.cz + w.nz * 0.95 },
      { x: w.cx - w.nx * 0.95, z: w.cz - w.nz * 0.95 },
    ];
    for (const c of cands) if (g.world.circleFree(c.x, c.z, 0.3)) return c;
    return { x: w.cx, z: w.cz };
  }
  searchContainer(c) {
    const g = this.game;
    if (!c.searched && !c.rolled) g.loot.fillContainer(c);
    c.searched = true;
    this.start('搜刮中', clamp(2.8 - g.player.stats.skills.foraging.lvl * 0.1, 1.2, 2.8), () => {
      g.ui.openContainer(c);
    }, false);
  }
  plotAction(plot) {
    const g = this.game, p = g.player;
    const real = g.world.farmPlots.get(plot.plotKey);
    if (!real) return;
    if (!real.planted) {
      if (!p.hasTool('seed') || !p.hasTool('trowel')) { g.toast('需要种子和小铲', 'warn'); return; }
      this.start('播种', 3, () => {
        p.consumeToolItem('seed', 1);
        real.planted = true; real.growth = 0;
        g.toast('🌱 播种完成');
        g.stats.addXp('farming', 4);
      }, false);
    } else if (real.water < 0.3) {
      if (!p.hasTool('watering')) { g.toast('需要洒水壶', 'warn'); return; }
      this.start('浇水', 2, () => {
        real.water = 1;
        g.toast('💧 浇水完成');
        g.stats.addXp('farming', 1.5);
      }, false);
    } else if (real.growth >= 1) {
      this.start('收获', 2.5, () => {
        const n = 2 + Math.floor(g.player.stats.skills.farming.lvl / 2 + Math.random() * 2);
        g.player.giveItem(Math.random() < 0.5 ? 'apple' : 'banana', n);
        real.planted = false; real.growth = 0;
        g.toast('🧺 收获 ' + n + ' 个蔬果', 'good');
        g.stats.addXp('farming', 8);
      }, false);
    }
  }
  wellAction() {
    const g = this.game, p = g.player;
    if (!p.hasTool('bucket')) { g.toast('需要水桶', 'warn'); return; }
    this.start('取水', 2, () => {
      p.giveItem('water_bottle', 1);
      g.toast('💧 打满了水');
    }, false);
  }
  carAction() {
    const g = this.game;
    g.ui.openCarPanel();
  }
  genAction() {
    const g = this.game;
    g.ui.openGeneratorPanel();
  }
  fireAction(f) {
    const g = this.game, p = g.player;
    if (f.lit) {
      f.lit = false;
      g.toast('🔥 篝火熄灭了');
    } else {
      if (!p.hasTool('lighter')) { g.toast('需要打火机或火柴', 'warn'); return; }
      this.start('点火', 2, () => {
        f.lit = true; f.fuel = Math.max(f.fuel, 1);
        g.toast('🔥 篝火燃起来了', 'good');
        g.events.emit('noise', { x: f.x, z: f.z, r: 4, type: 'fire' });
      }, false);
    }
  }
  sleepAction() {
    const g = this.game, p = g.player;
    const zs = g.zombies.nearbyThreat();
    if (zs > 0) { g.toast('😨 附近有丧尸，无法入睡！', 'warn'); return; }
    // 睡觉：快进 6 小时
    g.ui.openSleepPanel();
  }
  start(label, seconds, onDone, cancelOnMove = true) {
    this.action = { label, t: seconds, total: seconds, onDone, cancelOnMove };
    this.game.ui.updatePrompt();
  }
  // 右键菜单动作
  ctxActions() {
    const g = this.game, p = g.player;
    const acts = [];
    if (!this.target) return acts;
    const w = this.target;
    if (this.targetType === 'door' || this.targetType === 'window') {
      if (w.type === 'door') {
        if (w.locked) {
          if (w.requires) acts.push({ name: '用门禁卡开门', fn: () => { const card = p.findItem(w.requires); if (card) { w.locked = false; p.takeItem(card, 1); g.toast('🔓 打开了', 'good'); } else g.toast('没有 ' + w.requires, 'warn'); } });
          if (p.hasTool('crowbar')) acts.push({ name: '撬锁', fn: () => this.doorAction(w) });
        } else {
          acts.push({ name: w.open ? '关门' : '开门', fn: () => this.doorAction(w) });
        }
        acts.push({ name: '砸门', fn: () => this.bashWall(w) });
      } else {
        acts.push({ name: w.smashed ? (w.open ? '关闭破窗' : '打开破窗（翻越）') : (w.open ? '关窗' : '开窗'), fn: () => this.windowAction(w) });
        acts.push({ name: '打碎玻璃', fn: () => this.smashWindow(w) });
        if (!w.curtain) acts.push({ name: '挂上床单窗帘', fn: () => this.addCurtain(w) });
      }
      if (w.barricade < 4 && p.hasTool('bkit') && p.hasTool('hammer')) acts.push({ name: '安装加固板', fn: () => this.barricade(w) });
      if (w.barricade > 0 && p.hasTool('crowbar')) acts.push({ name: '拆除加固板', fn: () => this.unbarricade(w) });
    }
    if (this.targetType === 'fire') {
      acts.push({ name: this.target.lit ? '熄灭' : '点燃', fn: () => this.fireAction(this.target) });
      if (this.target.lit) acts.push({ name: '烹饪生食', fn: () => g.ui.openCookPanel(this.target) });
    }
    if (this.targetType === 'car') acts.push({ name: '检查车辆', fn: () => g.ui.openCarPanel() });
    if (this.targetType === 'well') acts.push({ name: '取水', fn: () => this.wellAction() });
    return acts;
  }
  bashWall(w) {
    const g = this.game, p = g.player;
    this.start('砸门', 4, () => {
      w.hp -= 20 + p.stats.strength * 4;
      g.audio.door();
      g.events.emit('noise', { x: w.x, z: w.z, r: 10, type: 'bash' });
      if (w.hp <= 0) { w.type = 'hole'; w.smashed = true; g.toast('🚪 门被砸开了', 'good'); }
    });
  }
  smashWindow(w) {
    const g = this.game;
    w.smashed = true; w.open = true;
    g.audio.windowSmash();
    g.renderer.updateWindowVisual(w);
    g.events.emit('noise', { x: w.x, z: w.z, r: 12, type: 'smash' });
    g.player.stats.damagePart('handL', 3, 'glass');
  }
  addCurtain(w) {
    const g = this.game, p = g.player;
    if (!p.hasTool('sheet')) { g.toast('需要床单', 'warn'); return; }
    p.consumeToolItem('sheet', 1);
    w.curtain = true;
    g.renderer.updateWindowVisual(w);
    g.toast('🧺 挂上了窗帘');
  }
  barricade(w) {
    const g = this.game, p = g.player;
    this.start('加固中', 3 + (4 - w.barricade), () => {
      w.barricade++;
      p.consumeToolItem('bkit', 1);
      g.renderer.updateBarricadeVisual(w);
      g.audio.click();
      g.toast('🪵 加固完成 (' + w.barricade + '/4)');
      g.stats.addXp('carpentry', 6);
    });
  }
  unbarricade(w) {
    const g = this.game;
    this.start('拆除中', 3, () => {
      w.barricade--;
      g.renderer.updateBarricadeVisual(w);
      g.toast('拆下了一块木板');
    });
  }
}
