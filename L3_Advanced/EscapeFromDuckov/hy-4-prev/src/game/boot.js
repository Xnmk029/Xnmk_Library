// 装配流水线：从"生成世界"到"编译着色器"，把一局游戏所需的一切拼起来。
// 单独成文件，是为了让 main.js 只负责主循环，而不是塞满构造代码。
import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { warmTextures } from '../gfx/textures/proc.js';
import { CameraRig } from '../render/camera.js';
import { Renderer } from '../render/renderer.js';
import { Lights } from '../render/lights.js';
import { SceneView } from '../render/scene.js';
import { FogOfWar } from '../render/fow.js';
import { EnemyView } from '../render/enemies.js';
import { Flashlight } from '../render/flashlight.js';
import { Tracers } from '../render/tracers.js';
import { Particles } from '../render/particles.js';
import { HeatSources } from '../render/heat.js';
import { PlayerView } from '../render/entities.js';
import { World } from '../systems/world.js';
import { Vision } from '../systems/vision.js';
import { Pathfinder } from '../systems/pathfind.js';
import { Combat } from '../systems/combat.js';
import { Weather } from '../systems/weather.js';
import { Director } from '../systems/director.js';
import { Hideout } from '../systems/hideout.js';
import { Health } from '../systems/health.js';
import { Inventory } from '../systems/inventory.js';
import { Input } from '../core/input.js';
import { Player } from '../entities/player.js';
import { spawnEnemies, Corpse } from '../entities/enemy.js';
import { Hud } from '../ui/hud.js';
import { Panels } from '../ui/panels.js';
import { wireEvents } from './actions.js';
import { load as loadSave, restore } from '../core/save.js';

const $ = (id) => document.getElementById(id);

/** 开局携带：够用但不宽裕，逼玩家进图搜刮 */
const STARTING_KIT = [
  ['bandage', 2], ['painkillers', 1], ['canned_food', 1],
  ['water_bottle', 1], ['ammo_9mm', 3], ['scrap', 1], ['m9', 1], ['knife', 1],
];

export function bootGame(game, params) {
  const prog = (p, label) => {
    const bar = $('loadBar')?.firstElementChild;
    if (bar) bar.style.width = `${p}%`;
    const l = document.querySelector('#loading .l');
    if (l && label) l.firstChild.textContent = label;
  };

  prog(8, '生成程序化贴图');
  warmTextures();

  prog(22, '生成地图');
  game.buildWorld(params.get('map') || 'zone0');

  prog(40, '搭建渲染管线');
  game.scene = new THREE.Scene();
  // 注意：场景不能设 background Color —— three 会因为 forceClear 在【每一个】RenderPass 里清屏，
  // 把前一个 pass 的结果抹掉（角色层会覆盖掉世界层）。底色交给 renderer 的 clear color。
  // 正交俯视相机的视空间深度恒在 50~62，雾必须按此设定，
  // 否则默认的近雾会把屏幕上下拉出明显的亮度梯度（实测过）。
  game.scene.fog = new THREE.Fog(0x121a22, 48, 125);
  game.rig = new CameraRig(window.innerWidth, window.innerHeight);
  game.renderer = new Renderer(game.host, game.rig);
  game.lights = new Lights(game.scene);
  game.view = new SceneView(game.scene, game.world);
  game.vision = new Vision(game.world);
  game.fow = new FogOfWar(game.scene, game.world);
  game.pathfinder = new Pathfinder(game.world);
  game.enemyView = new EnemyView(game.scene, 320);
  game.flashlight = new Flashlight(game.scene);
  game.tracers = new Tracers(game.scene);
  game.particles = new Particles(game.scene);
  game.heat = new HeatSources(game.scene);

  // ---- 战局实体 ----
  prog(55, '布置敌人');
  game.rng = new Rng(game.world.def.seed ^ 0x5f3a);
  game.enemies = spawnEnemies(game.world, game.rng, game.world.playerSpawn, 16);
  game.corpses = [];
  game.tracked = game.enemies;
  game.combat = new Combat(game);
  game.damageNumbers = [];
  game.weaponInstances = new Map();     // 必须在 syncEquipped 之前：武器实例挂在背包物品上
  game.CorpseCls = Corpse;
  game.reserveAmmo = { '9mm_1': 45 };
  game.skills = {}; game.traits = {}; game.moodleTiers = {};

  // ---- 角色、UI、背包 ----
  game.player = new Player(game.world.playerSpawn);
  game.player.world = game.world;
  game.playerView = new PlayerView(game.scene, { helmet: true, vest: true, backpack: true });
  game.input = new Input(window);
  game.rig.snapTo(game.player.x, game.player.z);
  game.health = new Health(game);
  game.hud = new Hud(game);
  game.panels = new Panels(game);

  game.inventory = new Inventory(8, 6);
  game.inventory.addItem('backpack_m', 1);
  game.inventory.equip([...game.inventory.grid.items.values()][0].uid);
  for (const [id, n] of STARTING_KIT) game.inventory.addItem(id, n);
  for (const it of [...game.inventory.grid.items.values()]) {
    if (it.id === 'm9' || it.id === 'knife') game.inventory.equip(it.uid);
  }
  game.inventory.recalc();
  game.syncEquipped();
  if (game.equipped) game.equipped.mag = game.equipped.magSize;

  // ---- 世界系统（存档优先）----
  game.weather = new Weather(game, game.rng);
  game.director = new Director(game);
  const saved = loadSave();
  game.hideout = new Hideout(game, saved?.data?.hideout ?? null);
  if (saved?.data) { restore(game, saved.data); game.hasSave = true; }
  if (game.hideout.level('medstation') > 0) game.hideout.supplyBeforeRaid();
  wireEvents(game);

  prog(80, '编译着色器');
  game.fxOn = params.get('fx') !== '0';
  game.renderer.buildComposer(game.scene, { msaa: params.get('msaa') === '0' ? 0 : 4 });
  game.renderer.setPostFx(game.fxOn);
  if (params.get('shadows') === '0') game.renderer.renderer.shadowMap.enabled = false;
  game.renderer.compile(game.scene);

  prog(95, '接线主循环');
  return game;
}
