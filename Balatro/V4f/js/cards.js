// cards.js — 卡牌 DOM 渲染（扑克牌/Joker/消耗品/补充包/Boss）+ 描述文本解析
(function () {
  'use strict';
  const BD = window.BD;
  const P = window.B.poker;

  // ---------- 描述文本标记解析 ----------
  // {C:red} {C:red,s:1.1} {s:0.8} {X:mult,C:white} {V:1} {T:tag} #1# {} {E:1} {S:0.8}
  const COLORS = {
    red: '#fe5f55', mult: '#fe5f55', x_mult: '#fe5f55', Xmult: '#fe5f55',
    blue: '#009dff', chips: '#009dff',
    money: '#f3b958', gold: '#eac058',
    attention: '#ff9a00', important: '#ff9a00', orange: '#fda200', filter: '#ff9a00',
    green: '#4bc292', chance: '#4bc292',
    purple: '#b26cbb', tarot: '#a782d1',
    planet: '#13afce', spectral: '#4584fa',
    white: '#ffffff', grey: '#8a9ba8', inactive: '#6b7d82',
    dark_edition: '#000000', edition: '#4ca893',
    hearts: '#fe5f55', diamonds: '#fe5f55', spades: '#9db4c0', clubs: '#4bc292',
    common: '#009dff', uncommon: '#4bc292', rare: '#fe5f55', legendary: '#b26cbb',
    buffoon: '#646eb7', booster: '#646eb7', joker: '#708b91', enhanced: '#8389dd',
    voucher: '#fd682b', yellow: '#f3b958', black: '#000', green2: '#56a887'
  };

  function renderText(textArr, vars) {
    // vars: 数组或函数
    const getVar = (i) => {
      if (typeof vars === 'function') return vars(i);
      return vars ? vars[i - 1] : '';
    };
    let html = '';
    for (const line of textArr) {
      let s = line;
      // 先处理变量 #n#
      s = s.replace(/#(\d+)#/g, (m, n) => String(getVar(parseInt(n)) ?? m));
      // 解析标记
      let out = '', i = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === '{') {
          const close = s.indexOf('}', i);
          if (close < 0) { out += s.slice(i); break; }
          const tag = s.slice(i + 1, close);
          const inner = s.slice(close + 1);
          // 找到对应的结束 {}（简单处理：下一个 { 前的 {）—— Balatro 标记无嵌套，找下一个 '{}'
          const endIdx = s.indexOf('{}', close + 1);
          if (endIdx < 0) { out += inner; i = close + 1; continue; }
          const content = s.slice(close + 1, endIdx);
          const parts = tag.split(',');
          let cls = '', style = '';
          for (const part of parts) {
            if (!part) continue;
            const [k, v] = part.split(':');
            if (k === 'C' && v) { cls += ' c-' + v.toLowerCase(); }
            else if (k === 's' || k === 'S') { style += 'font-size:' + (parseFloat(v) * 100) + '%;'; }
          }
          const color = tag.match(/C:(\w+)/);
          if (color && COLORS[color[1].toLowerCase()]) {
            cls = ' c-' + color[1].toLowerCase();
          }
          out += '<span class="mk' + cls + '" style="' + style + '">' + escapeHtml(content) + '</span>';
          i = endIdx + 2;
        } else if (c === '#' && /\d/.test(s[i + 1] || '')) {
          const m = s.slice(i).match(/^#(\d+)#/);
          if (m) { out += escapeHtml(String(getVar(parseInt(m[1])) ?? m[0])); i += m[0].length; }
          else { out += c; i++; }
        } else {
          out += escapeHtml(c);
          i++;
        }
      }
      html += out;
    }
    return html;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- 扑克牌 ----------
  // 8BitDeck.png: 13列×4行, 142×190 格, 行序 [Hearts, Clubs, Diamonds, Spades], 列序 [2..10,J,Q,K,A]
  const CARD_IMG = 'assets/cards.png';
  const SUIT_ROW = { H: 0, C: 1, D: 2, S: 3 };
  const RANK_COL = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, J: 9, Q: 10, K: 11, A: 12 };

  // 增强图标位置（enhancers.png 14×10 格 71×95）
  const ENH_ICON = {
    bonus: { x: 1, y: 1 }, mult: { x: 2, y: 1 }, wild: { x: 3, y: 1 },
    glass: { x: 5, y: 1 }, steel: { x: 6, y: 1 }, stone: { x: 5, y: 0 },
    gold: { x: 6, y: 0 }, lucky: { x: 4, y: 1 }
  };

  function cardBackEl(w, h) {
    const d = document.createElement('div');
    d.className = 'pcard';
    const face = document.createElement('div');
    face.className = 'pcard-face';
    face.style.backgroundImage = 'url(' + CARD_IMG + ')';
    // 背面：8BitDeck 没有背面，用 CSS 图案
    face.style.background = 'linear-gradient(135deg,#2a3a4e,#1d2a38)';
    face.style.backgroundImage = 'url(assets/cards.png)';
    face.style.backgroundPosition = '-1278px -570px'; // 最后一个格（黑桃A右下角外）
    face.style.backgroundSize = (1846 * w / 142) + 'px ' + (760 * h / 190) + 'px';
    d.appendChild(face);
    return d;
  }

  // 创建扑克牌元素。card: {rank,suit,enhancement,edition,seal,debuffed,faceDown}
  function playingCardEl(card, opts) {
    opts = opts || {};
    const w = opts.w || 116, h = opts.h || 155;
    const d = document.createElement('div');
    d.className = 'pcard';
    if (card.enhancement) d.classList.add('enh-' + card.enhancement);
    if (card.edition) d.classList.add('ed-' + card.edition);
    if (card.debuffed) d.classList.add('debuffed');
    if (opts.faceDown) d.classList.add('face-down');

    const face = document.createElement('div');
    face.className = 'pcard-face';
    face.style.backgroundImage = 'url(' + CARD_IMG + ')';
    const row = SUIT_ROW[card.suit];
    const col = RANK_COL[card.rank];
    face.style.backgroundSize = (1846 * w / 142) + 'px ' + (760 * h / 190) + 'px';
    face.style.backgroundPosition = (-col * w) + 'px ' + (-row * h) + 'px';
    d.appendChild(face);

    // 增强/版本覆盖层
    if (card.enhancement || card.edition || card.seal || card.debuffed) {
      const ov = document.createElement('div');
      ov.className = 'pcard-overlay';
      d.appendChild(ov);
    }
    // 增强角标（石头牌不显示点数角标）
    if (card.enhancement && ENH_ICON[card.enhancement]) {
      const icon = document.createElement('div');
      icon.className = 'pcard-enh';
      const p = ENH_ICON[card.enhancement];
      icon.style.backgroundImage = 'url(assets/enhancers.png)';
      icon.style.backgroundSize = (994 * w / 142 * 0.55) + 'px ' + (950 * h / 190 * 0.55) + 'px';
      icon.style.backgroundPosition = (-p.x * w * 0.55) + 'px ' + (-p.y * h * 0.55) + 'px';
      d.appendChild(icon);
    }
    // 蜡封
    if (card.seal) {
      const seal = document.createElement('div');
      seal.className = 'pcard-seal seal-' + card.seal;
      d.appendChild(seal);
    }
    // 点数字符（石头牌显示 50 筹码标记）
    if (card.enhancement === 'stone') {
      const t = document.createElement('div');
      t.className = 'pcard-stone-mark';
      t.textContent = '+50';
      d.appendChild(t);
    }
    // 背面（The Mark boss / 未翻开）
    if (opts.faceDown) {
      const back = document.createElement('div');
      back.className = 'pcard-back';
      back.style.background = 'repeating-linear-gradient(45deg,#374244,#374244 6px,#2c363c 6px,#2c363c 12px)';
      d.appendChild(back);
    }
    return d;
  }

  // ---------- Joker 卡 ----------
  // jokers.png: 10×16 格 71×95
  function jokerEl(jd, opts) {
    opts = opts || {};
    const w = opts.w || 128, h = opts.h || 171;
    const d = document.createElement('div');
    d.className = 'jcard';
    if (jd.rarity) d.classList.add('rar-' + jd.rarity);
    if (opts.edition) d.classList.add('ed-' + opts.edition);
    if (opts.debuffed) d.classList.add('jdebuffed');
    if (opts.negative) d.classList.add('ed-negative');

    const art = document.createElement('div');
    art.className = 'jcard-art';
    art.style.backgroundImage = 'url(assets/jokers.png)';
    art.style.backgroundSize = (710 * w / 71) + 'px ' + (1520 * h / 95) + 'px';
    art.style.backgroundPosition = (-(jd.pos.x) * w) + 'px ' + (-(jd.pos.y) * h) + 'px';
    d.appendChild(art);

    const name = document.createElement('div');
    name.className = 'jcard-name';
    name.textContent = jd.name;
    d.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'jcard-desc';
    desc.innerHTML = renderText(jd.text || [], opts.vars || null);
    d.appendChild(desc);

    // 版本标签
    if (opts.edition) {
      const et = document.createElement('div');
      et.className = 'jcard-edition';
      const names = { foil: '箔片', holographic: '全息', polychrome: '多彩', negative: '负片' };
      et.textContent = names[opts.edition] || opts.edition;
      d.appendChild(et);
    }
    // 永恒/租赁/易碎
    if (opts.eternal) d.classList.add('j-eternal');
    if (opts.rental) d.classList.add('j-rental');
    if (opts.perishable) d.classList.add('j-perishable');
    return d;
  }

  // ---------- 消耗品卡（塔罗/星球/幻灵） ----------
  // tarots.png: 10×6 格 71×95
  function consumableEl(cd, opts) {
    opts = opts || {};
    const w = opts.w || 128, h = opts.h || 171;
    const d = document.createElement('div');
    const setClass = cd.set === 'Planet' ? 'set-planet' : cd.set === 'Spectral' ? 'set-spectral' : 'set-tarot';
    d.className = 'jcard ' + setClass;
    if (opts.edition) d.classList.add('ed-' + opts.edition);

    const art = document.createElement('div');
    art.className = 'jcard-art';
    art.style.backgroundImage = 'url(assets/tarots.png)';
    art.style.backgroundSize = (710 * w / 71) + 'px ' + (570 * h / 95) + 'px';
    art.style.backgroundPosition = (-(cd.pos.x) * w) + 'px ' + (-(cd.pos.y) * h) + 'px';
    d.appendChild(art);

    const name = document.createElement('div');
    name.className = 'jcard-name';
    name.textContent = cd.name;
    d.appendChild(name);

    const desc = document.createElement('div');
    desc.className = 'jcard-desc';
    desc.innerHTML = renderText(cd.text || [], opts.vars || null);
    d.appendChild(desc);
    return d;
  }

  // ---------- 补充包 ----------
  function boosterEl(pd, opts) {
    opts = opts || {};
    const w = opts.w || 128, h = opts.h || 171;
    const d = document.createElement('div');
    d.className = 'jcard booster';
    const art = document.createElement('div');
    art.className = 'jcard-art';
    art.style.backgroundImage = 'url(assets/boosters.png)';
    art.style.backgroundSize = (568 * w / 71) + 'px ' + (1710 * h / 95) + 'px';
    art.style.backgroundPosition = (-(pd.pos.x) * w) + 'px ' + (-(pd.pos.y) * h) + 'px';
    d.appendChild(art);
    const name = document.createElement('div');
    name.className = 'jcard-name';
    name.textContent = pd.name;
    d.appendChild(name);
    const desc = document.createElement('div');
    desc.className = 'jcard-desc';
    const kindCN = { Arcana: '塔罗', Celestial: '天体', Spectral: '幻灵', Standard: '标准', Buffoon: '小丑' };
    desc.innerHTML = '选择 ' + (pd.choose || 1) + ' 张' + (kindCN[pd.kind] || pd.kind) + '牌';
    d.appendChild(desc);
    return d;
  }

  // ---------- Boss 盲注牌（动画） ----------
  function blindEl(bd, opts) {
    opts = opts || {};
    const w = opts.w || 120, h = opts.h || 120;
    const d = document.createElement('div');
    d.className = 'blind-card';
    if (bd.boss) d.classList.add('blind-boss');
    const art = document.createElement('div');
    art.className = 'blind-art';
    // 34×34 格，动画 21 帧
    art.style.backgroundImage = 'url(assets/blinds.png)';
    const scale = w / 34;
    art.style.backgroundSize = (1428 * scale) + 'px ' + (2108 * scale) + 'px';
    const py = bd.pos.y;
    if (bd.boss) {
      art.style.backgroundPosition = '0px ' + (-py * w) + 'px';
      art.style.animation = 'blindAnim ' + (1.2 + (bd.pos.y % 5) * 0.15) + 's steps(21) infinite';
      art.style.setProperty('--blind-x', '0px');
      // 用 background-position-x 动画
      const style = document.createElement('style');
      const animName = 'blindAnim' + bd.pos.y;
      style.textContent = '@keyframes ' + animName + '{from{background-position-x:0px}to{background-position-x:' + (-21 * w) + 'px}}';
      document.head.appendChild(style);
      art.style.animation = animName + ' ' + (1.2 + (bd.pos.y % 5) * 0.15) + 's steps(21) infinite';
    } else {
      art.style.backgroundPosition = '0px ' + (-py * w) + 'px';
    }
    d.appendChild(art);
    return d;
  }

  // ---------- 标签 ----------
  function tagEl(td, opts) {
    opts = opts || {};
    const size = opts.size || 56;
    const d = document.createElement('div');
    d.className = 'tag-el';
    d.style.width = size + 'px';
    d.style.height = size + 'px';
    d.style.backgroundImage = 'url(assets/tags.png)';
    const scale = size / 17;
    d.style.backgroundSize = (204 * scale) + 'px ' + (170 * scale) + 'px';
    d.style.backgroundPosition = (-td.pos.x * size) + 'px ' + (-td.pos.y * size) + 'px';
    return d;
  }

  // 筹码/倍率徽章（HUD 圆形）
  function hudChipEl() { return document.createElement('div'); }

  window.B.cards = {
    renderText, escapeHtml, playingCardEl, cardBackEl, jokerEl, consumableEl,
    boosterEl, blindEl, tagEl, COLORS
  };
})();
