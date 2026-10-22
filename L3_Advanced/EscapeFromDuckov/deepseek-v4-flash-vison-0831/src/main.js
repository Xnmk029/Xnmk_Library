import * as THREE from 'three';
window.THREE = THREE;
import { Game } from './game.js';
import { UI } from './ui.js';
import { Menu } from './menu.js';

const game = new Game();
window.__game = game;
game.ui = new UI(game);
game.menu = new Menu(game);
game.ui.menu = game.menu;
game.input = null;

// 动态导入输入（避免循环依赖）
import('./input.js').then(m => {
  game.input = new m.Input(game);
  game.menu.showMain();
});
