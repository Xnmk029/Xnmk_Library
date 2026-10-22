/**
 * Hud.js — 零依赖 HUD（Infinite Liminal Poolcore）
 * 自建 DOM + 一次性注入 CSS，不 import 任何模块。
 * 风格：半透明玻璃感深青色面板 / 等宽字体 / 右上性能面板 / 左下操作提示 / 中心细十字 / 点击开始遮罩。
 */

const STYLE_ID = 'liminal-poolcore-hud-style';

/** 性能面板行定义：[stats 字段名, 显示标签] */
const STAT_ROWS = [
  ['fps', 'FPS'], ['ms', 'FRAME'], ['drawCalls', 'DRAW'], ['triangles', 'TRIS'],
  ['instances', 'INST'], ['chunks', 'CHUNKS'], ['quality', 'QUALITY'],
  ['viewDistance', 'VIEW'], ['position', 'POS'], ['seed', 'SEED'],
  ['underwater', 'ENV'], ['effects', 'FX'],
];

/** effects 开关的显示缩写 */
const FX_KEYS = [['ao', 'AO'], ['rays', 'RAYS'], ['reflection', 'REFL'], ['shadows', 'SHDW']];

const DEFAULT_KEY_HELP = [
  'WASD — 移动 / MOVE',
  'SHIFT — 加速 / SPRINT',
  'SPACE — 上浮·跳跃 / ASCEND',
  'CTRL — 下潜 / DESCEND',
  'F — 手电 / LIGHT',
  'Q E — 画质切换 / QUALITY',
  'ESC — 释放鼠标 / RELEASE',
];

const CSS = `
.lp-hud{position:fixed;inset:0;z-index:40;pointer-events:none;user-select:none;
 font-family:ui-monospace,"Cascadia Mono","SFMono-Regular",Consolas,"Liberation Mono",monospace;
 font-size:12px;line-height:1.45;color:#cdeef0;-webkit-font-smoothing:antialiased}
.lp-hud *{box-sizing:border-box;margin:0}
.lp-panel{background:linear-gradient(180deg,rgba(9,32,38,.62),rgba(6,20,26,.74));
 border:1px solid rgba(126,232,236,.20);border-radius:6px;padding:8px 10px;
 box-shadow:0 8px 28px rgba(0,0,0,.45),inset 0 0 22px rgba(74,214,222,.06);
 backdrop-filter:blur(7px) saturate(120%);-webkit-backdrop-filter:blur(7px) saturate(120%);
 transition:border-color .5s,box-shadow .5s}
.lp-title{position:absolute;top:14px;left:16px;font-size:11px;letter-spacing:.18em;
 text-transform:uppercase;color:#9fe4e8;text-shadow:0 0 12px rgba(74,214,222,.45)}
.lp-stats{position:absolute;top:12px;right:16px;min-width:210px}
.lp-row{display:flex;justify-content:space-between;gap:16px;white-space:nowrap}
.lp-k{color:rgba(160,220,224,.52);letter-spacing:.09em}
.lp-v{color:#e8ffff;font-variant-numeric:tabular-nums}
.lp-help{position:absolute;left:16px;bottom:16px;max-width:270px}
.lp-help>div{color:rgba(198,238,240,.76);letter-spacing:.04em}
.lp-cross{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;
 opacity:.85;transition:opacity .25s}
.lp-cross.is-hidden{opacity:0}
.lp-cross::before,.lp-cross::after{content:"";position:absolute;background:rgba(216,255,255,.88);
 box-shadow:0 0 6px rgba(74,214,222,.9)}
.lp-cross::before{left:50%;top:0;width:1px;height:100%;transform:translateX(-.5px)}
.lp-cross::after{top:50%;left:0;height:1px;width:100%;transform:translateY(-.5px)}
.lp-msg{position:absolute;left:50%;top:61%;transform:translate(-50%,10px);opacity:0;
 text-align:center;letter-spacing:.08em;transition:opacity .35s,transform .35s}
.lp-msg.is-show{opacity:1;transform:translate(-50%,0)}
.lp-load{position:absolute;left:50%;bottom:60px;width:320px;margin-left:-160px;display:none}
.lp-load.is-show{display:block}
.lp-load-text{text-align:center;letter-spacing:.10em;color:rgba(200,240,244,.82)}
.lp-bar{height:4px;margin-top:7px;border-radius:3px;background:rgba(120,220,226,.14);overflow:hidden}
.lp-bar>i{display:block;height:100%;width:0%;transition:width .18s linear;
 background:linear-gradient(90deg,#3fd3dd,#b9fbff);box-shadow:0 0 12px rgba(74,214,222,.8)}
.lp-overlay{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;
 justify-content:center;gap:14px;text-align:center;pointer-events:auto;cursor:pointer;
 background:radial-gradient(120% 80% at 50% 40%,rgba(9,42,50,.55),rgba(2,10,14,.9));
 backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.lp-overlay.is-show{display:flex}
.lp-overlay-title{font-size:22px;letter-spacing:.34em;color:#d7feff;
 text-shadow:0 0 26px rgba(74,214,222,.5)}
.lp-overlay-sub{color:rgba(190,236,240,.68);letter-spacing:.14em;font-size:11px}
.lp-hint{letter-spacing:.2em;color:#a9f0f6;animation:lp-pulse 1.9s ease-in-out infinite}
@keyframes lp-pulse{0%,100%{opacity:.4}50%{opacity:1}}
.lp-glow{position:absolute;inset:0;opacity:0;transition:opacity .6s;
 box-shadow:inset 0 0 150px 24px rgba(38,190,205,.26),inset 0 0 44px rgba(120,255,255,.12)}
.lp-hud.is-underwater .lp-glow{opacity:1}
.lp-hud.is-underwater .lp-panel{border-color:rgba(90,240,255,.34);
 box-shadow:0 8px 28px rgba(0,0,0,.5),inset 0 0 30px rgba(60,220,235,.16)}
`;

/** CSS 只注入一次（id 去重，重复构造不重复注入） */
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}

/** 建节点小工具 */
function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** 整数 */
const fInt = (v) => (isNum(v) ? String(Math.round(v)) : '—');
/** 千分位 */
const fKilo = (v) => (isNum(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—');
/** 定点小数 */
const fFix = (v, d) => (isNum(v) ? v.toFixed(d) : '—');
/** 任意值转显示串 */
const fAny = (v) => (v == null || v === '' ? '—' : String(v));

/** 只在文本变化时写 textContent，避免无意义的 DOM 写入 */
function put(node, text) {
  if (node && node._lpText !== text) {
    node._lpText = text;
    node.textContent = text;
  }
}

export class Hud {
  /**
   * @param {HTMLElement} [container]
   * @param {{title?:string}} [options]
   */
  constructor(container = document.body, options = {}) {
    injectStyle();

    this.container = container || document.body;
    this.options = { title: 'INFINITE LIMINAL POOLCORE', ...(options || {}) };
    this._disposed = false;
    this._messageTimer = 0;
    this._onStart = null;
    this._values = Object.create(null);

    const root = el('div', 'lp-hud', this.container);
    this.root = root;

    el('div', 'lp-glow', root);                                  // 水下青色边缘光
    this._titleNode = el('div', 'lp-title', root, this.options.title);

    // 右上性能面板：行节点一次建好，之后只改 textContent
    const stats = el('div', 'lp-panel lp-stats', root);
    for (let i = 0; i < STAT_ROWS.length; i++) {
      const row = el('div', 'lp-row', stats);
      el('span', 'lp-k', row, STAT_ROWS[i][1]);
      this._values[STAT_ROWS[i][0]] = el('span', 'lp-v', row, '—');
    }

    this._helpNode = el('div', 'lp-panel lp-help', root);         // 左下操作提示
    this.setKeyHelp(DEFAULT_KEY_HELP);

    this._crossNode = el('div', 'lp-cross', root);                // 中心十字准星
    this._msgNode = el('div', 'lp-msg lp-panel', root);           // 中部下方提示

    const load = el('div', 'lp-load', root);                      // 加载进度
    this._loadNode = load;
    this._loadText = el('div', 'lp-load-text', load, 'LOADING');
    this._loadFill = el('i', null, el('div', 'lp-bar', load));

    const overlay = el('div', 'lp-overlay', root);                // 点击开始遮罩
    this._overlayNode = overlay;
    el('div', 'lp-overlay-title', overlay, this.options.title);
    el('div', 'lp-overlay-sub', overlay, '程序化无限边缘空间池核 · WEBGL2');
    el('div', 'lp-hint', overlay, '[ 点击开始 · CLICK TO ENTER ]');
    this._overlayHandler = (event) => {
      event.preventDefault();
      const cb = this._onStart;
      this.hideStartOverlay();
      if (typeof cb === 'function') cb();
    };
    overlay.addEventListener('click', this._overlayHandler);
  }

  /**
   * 更新性能面板；所有字段缺失均容错，绝不抛错。
   * @param {object} stats
   */
  setStats(stats) {
    if (this._disposed || !stats || typeof stats !== 'object') return this;
    const v = this._values;

    put(v.fps, fInt(stats.fps));
    put(v.ms, isNum(stats.ms) ? `${fFix(stats.ms, 1)} ms` : '—');
    put(v.drawCalls, fInt(stats.drawCalls));
    put(v.triangles, fKilo(stats.triangles));
    put(v.instances, fKilo(stats.instances));

    const chunks = stats.chunks && typeof stats.chunks === 'object' ? stats.chunks : null;
    put(v.chunks, chunks ? `${fInt(chunks.loaded)}/${fInt(chunks.pending)}/${fInt(chunks.built)}` : '—');

    put(v.quality, fAny(stats.quality));
    put(v.viewDistance, isNum(stats.viewDistance) ? `${fInt(stats.viewDistance)} m` : fAny(stats.viewDistance));

    const p = stats.position && typeof stats.position === 'object' ? stats.position : null;
    put(v.position, p ? `${fFix(p.x, 1)} ${fFix(p.y, 1)} ${fFix(p.z, 1)}` : '—');

    put(v.seed, fAny(stats.seed));

    if (stats.underwater !== undefined) {
      const underwater = !!stats.underwater;
      put(v.underwater, underwater ? 'SUBMERGED' : 'SURFACE');
      this.root.classList.toggle('is-underwater', underwater);   // 水下青色边缘光
    }

    const fx = stats.effects && typeof stats.effects === 'object' ? stats.effects : null;
    if (fx) {
      const on = [];
      for (let i = 0; i < FX_KEYS.length; i++) if (fx[FX_KEYS[i][0]]) on.push(FX_KEYS[i][1]);
      put(v.effects, on.length ? on.join(' ') : 'OFF');
    } else {
      put(v.effects, '—');
    }
    return this;
  }

  /** 屏幕中部下方浮现一条提示，ms 后淡出 */
  setMessage(text, ms = 2000) {
    if (this._disposed) return this;
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = 0;
    }
    put(this._msgNode, text == null ? '' : String(text));
    if (text == null || text === '') {
      this._msgNode.classList.remove('is-show');
      return this;
    }
    this._msgNode.classList.add('is-show');
    if (isNum(ms) && ms > 0) {
      this._messageTimer = setTimeout(() => {
        this._messageTimer = 0;
        if (!this._disposed) this._msgNode.classList.remove('is-show');
      }, ms);
    }
    return this;
  }

  /** 加载进度条；ratio >= 1 自动隐藏 */
  setLoading(ratio, text) {
    if (this._disposed) return this;
    const value = isNum(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    if (text != null) put(this._loadText, String(text));
    this._loadFill.style.width = `${(value * 100).toFixed(1)}%`;
    this._loadNode.classList.toggle('is-show', value < 1);
    return this;
  }

  /** 显示"点击开始"遮罩，点击后隐藏并回调 */
  showStartOverlay(onStart) {
    if (this._disposed) return this;
    this._onStart = typeof onStart === 'function' ? onStart : null;
    this._overlayNode.classList.add('is-show');
    return this;
  }

  hideStartOverlay() {
    if (this._disposed) return this;
    this._overlayNode.classList.remove('is-show');
    this._onStart = null;
    return this;
  }

  /** @param {string[]} lines 操作提示（非每帧调用，重建 DOM 无妨） */
  setKeyHelp(lines) {
    if (this._disposed) return this;
    const list = Array.isArray(lines) ? lines : [];
    this._helpNode.textContent = '';
    this._helpNode.style.display = list.length ? '' : 'none';
    for (let i = 0; i < list.length; i++) el('div', null, this._helpNode, String(list[i]));
    return this;
  }

  setCrosshair(visible) {
    if (this._disposed) return this;
    this._crossNode.classList.toggle('is-hidden', !visible);
    return this;
  }

  /** 卸载 DOM 与定时器（共享的 <style> 保留给可能存在的其它实例） */
  dispose() {
    if (this._disposed) return this;
    this._disposed = true;
    if (this._messageTimer) clearTimeout(this._messageTimer);
    this._messageTimer = 0;
    this._onStart = null;
    if (this._overlayNode && this._overlayHandler) {
      this._overlayNode.removeEventListener('click', this._overlayHandler);
    }
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
    this._values = Object.create(null);
    return this;
  }
}

export default Hud;
