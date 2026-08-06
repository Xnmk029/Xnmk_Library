/* 方块注册表：id、名称、六面纹理、物理属性 */
(function () {
  'use strict';
  const idx = (n) => window.Tex.ORDER.indexOf(n);

  const B = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6, LEAVES: 7, PLANKS: 8,
    BEDROCK: 9, WATER: 10, SNOW_GRASS: 11, SNOW: 12, COAL: 13, IRON: 14, GRAVEL: 15, GLASS: 16, BRICK: 17
  };
  const H = 96, SEA = 40;

  const DEFS = [];
  function def(id, name, tex, opts) {
    DEFS[id] = Object.assign({ id, name, solid: true, cull: true, liquid: false, tex }, opts || {});
  }

  const t = { gt: idx('grassTop'), gs: idx('grassSide'), d: idx('dirt'), st: idx('stone'),
    cb: idx('cobble'), sa: idx('sand'), ls: idx('logSide'), lt: idx('logTop'), lv: idx('leaves'),
    pl: idx('planks'), be: idx('bedrock'), wa: idx('water'), sn: idx('snow'), ss: idx('snowSide'),
    co: idx('coal'), ir: idx('iron'), gr: idx('gravel'), gl: idx('glass'), br: idx('brick') };
  const A = [0, 0, 0, 0, 0, 0];

  def(B.AIR, '空气', A, { solid: false, cull: false });
  def(B.GRASS, '草方块', [t.gs, t.gs, t.gt, t.d, t.gs, t.gs]);
  def(B.DIRT, '泥土', [t.d, t.d, t.d, t.d, t.d, t.d]);
  def(B.STONE, '石头', [t.st, t.st, t.st, t.st, t.st, t.st]);
  def(B.COBBLE, '圆石', [t.cb, t.cb, t.cb, t.cb, t.cb, t.cb]);
  def(B.SAND, '沙子', [t.sa, t.sa, t.sa, t.sa, t.sa, t.sa]);
  def(B.LOG, '橡木原木', [t.ls, t.ls, t.lt, t.lt, t.ls, t.ls]);
  def(B.LEAVES, '橡树树叶', [t.lv, t.lv, t.lv, t.lv, t.lv, t.lv], { cull: true });
  def(B.PLANKS, '橡木木板', [t.pl, t.pl, t.pl, t.pl, t.pl, t.pl]);
  def(B.BEDROCK, '基岩', [t.be, t.be, t.be, t.be, t.be, t.be]);
  def(B.WATER, '水', [t.wa, t.wa, t.wa, t.wa, t.wa, t.wa], { solid: false, cull: false, liquid: true });
  def(B.SNOW_GRASS, '积雪草方块', [t.ss, t.ss, t.sn, t.d, t.ss, t.ss]);
  def(B.SNOW, '雪块', [t.sn, t.sn, t.sn, t.sn, t.sn, t.sn]);
  def(B.COAL, '煤矿石', [t.co, t.co, t.co, t.co, t.co, t.co]);
  def(B.IRON, '铁矿石', [t.ir, t.ir, t.ir, t.ir, t.ir, t.ir]);
  def(B.GRAVEL, '沙砾', [t.gr, t.gr, t.gr, t.gr, t.gr, t.gr]);
  def(B.GLASS, '玻璃', [t.gl, t.gl, t.gl, t.gl, t.gl, t.gl], { cull: false });
  def(B.BRICK, '红砖', [t.br, t.br, t.br, t.br, t.br, t.br]);

  const SOLID = (id) => id > 0 && DEFS[id] && DEFS[id].solid;
  const CULL = (id) => id > 0 && DEFS[id] && DEFS[id].cull;

  window.Blocks = { B, DEFS, H, SEA, SOLID, CULL };
})();
