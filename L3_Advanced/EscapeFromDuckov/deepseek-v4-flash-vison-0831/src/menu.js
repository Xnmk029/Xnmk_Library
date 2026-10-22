import { PROFESSIONS, TRAITS } from './chardata.js';

// ================= 主菜单 / 建卡 / 暂停 / 死亡 / 胜利 =================
export class Menu {
  constructor(game) {
    this.game = game;
    this.hidden = false;
    this.selected = { prof: 'unemployed', traits: new Set() };
    this.el = document.getElementById('screen');
  }
  points() {
    const prof = PROFESSIONS.find(p => p.id === this.selected.prof);
    let pts = prof.points;
    for (const t of TRAITS) if (this.selected.traits.has(t.id)) pts += t.cost;
    return pts;
  }
  buildCharDef() {
    const prof = PROFESSIONS.find(p => p.id === this.selected.prof);
    const traits = TRAITS.filter(t => this.selected.traits.has(t.id));
    const name = (document.getElementById('cc-name').value.trim() || '无名鸭');
    return {
      name, profId: prof.id, profName: prof.icon + ' ' + prof.name,
      profSkills: prof.skills, startItems: prof.items || [],
      traits,
    };
  }
  showMain() {
    const g = this.game;
    this.el.classList.remove('hidden');
    const hasSave = g.hasSave();
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:520px">
        <div class="title-row">
          <span class="big-duck">🦆</span>
          <div>
            <div class="menu-title">鸭科夫·毁灭工程<span class="en">PROJECT ZOMDUCK</span></div>
          </div>
        </div>
        <div class="menu-sub">《僵尸毁灭工程》的硬核生存 ×《逃离鸭科夫》的废土鸭美学 — 一个轻量但绝不温柔的世界。</div>
        ${hasSave ? '<button class="menu-btn" id="btn-cont">▶ 继续生存（读取存档）</button>' : ''}
        <button class="menu-btn" id="btn-new">🦆 新的幸存者</button>
        <button class="menu-btn" id="btn-settings">⚙ 沙盒设置</button>
        <hr class="menu-hr">
        <div class="menu-note">这是关于你如何死去的游戏。活过三天，修好东边公路的汽车，然后——逃出去。\n操作：WASD 移动 · 鼠标瞄准 · 左键攻击 · 右键菜单 · E 互动 · R 翻滚 · F 手电 · I 背包 · Q/V 旋转视角</div>
      </div>`;
    this.el.querySelector('#btn-new').addEventListener('click', () => this.showCharCreate());
    this.el.querySelector('#btn-settings').addEventListener('click', () => this.showSettings());
    const bc = this.el.querySelector('#btn-cont');
    if (bc) bc.addEventListener('click', () => {
      const data = g.loadSaveData();
      if (data) g.continueSave(data);
      else this.showMain();
    });
  }
  showCharCreate() {
    const g = this.game;
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:900px">
        <div class="title-row"><span class="big-duck">📋</span><div><div class="menu-title">创建幸存者</div><div class="menu-sub">职业与特质将真实地改变你的生存体验。</div></div></div>
        <div class="cc-grid">
          <div>
            <div class="cc-card"><h3>🪪 身份</h3><input id="cc-name" placeholder="幸存者姓名（如：唐老鸭）" maxlength="12"></div>
            <div class="cc-card"><h3>💼 职业（点数 <span id="prof-pts"></span>）</h3><div class="prof-row">
              ${PROFESSIONS.map(p => '<span class="prof ' + (this.selected.prof === p.id ? 'on' : '') + '" data-prof="' + p.id + '" title="' + p.desc + '">' + p.icon + ' ' + p.name + ' (' + (p.points >= 0 ? '+' + p.points : p.points) + ')</span>').join('')}
            </div></div>
            <div class="cc-card"><h3>🧬 特质（点数 <span id="trait-pts"></span>）</h3>
              ${TRAITS.map(t => '<div class="trait ' + (this.selected.traits.has(t.id) ? 'on' : '') + '" data-trait="' + t.id + '"><span class="t-ico">' + t.icon + '</span><div><div class="t-name">' + t.name + '</div><div class="t-desc">' + t.desc + '</div></div><span class="t-cost ' + (t.cost <= 0 ? 'pos' : 'neg') + '">' + (t.cost <= 0 ? '' : '+') + t.cost + '</span></div>').join('')}
            </div>
          </div>
          <div class="cc-card" style="align-self:flex-start">
            <h3>🎯 剩余点数</h3>
            <div class="cc-points" id="cc-points">0</div>
            <div class="menu-note">点数为负无法开始。正点数将折算为初始幸运加成。</div>
            <button class="menu-btn" id="cc-back">返回</button>
          </div>
        </div>
        <div class="cc-foot"><button class="menu-btn" id="cc-start" style="text-align:center;color:#ffd23e;font-size:16px">⚡ 进入末日</button></div>
      </div>`;
    this.refreshPts();
    this.el.querySelector('#cc-name').focus();
    this.el.querySelector('#cc-back').addEventListener('click', () => this.showMain());
    this.el.querySelectorAll('[data-prof]').forEach(el => el.addEventListener('click', () => { this.selected.prof = el.dataset.prof; this.showCharCreate(); }));
    this.el.querySelectorAll('[data-trait]').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.trait;
      if (this.selected.traits.has(id)) this.selected.traits.delete(id);
      else this.selected.traits.add(id);
      this.refreshPts();
      el.classList.toggle('on');
    }));
    const btn = this.el.querySelector('#cc-start');
    const upd = () => {
      const ok = this.points() >= 0;
      btn.disabled = !ok;
      btn.textContent = ok ? '⚡ 进入末日' : '点数不足（剩余 ' + this.points() + '）';
    };
    upd();
    btn.addEventListener('click', () => {
      if (this.points() < 0) return;
      const def = this.buildCharDef();
      if (this.points() > 0) def.luckBonus = this.points();
      this.game.newGame(def);
    });
  }
  refreshPts() {
    const p = this.points();
    const el = this.el.querySelector('#cc-points');
    if (el) el.textContent = p;
    const prof = PROFESSIONS.find(x => x.id === this.selected.prof);
    const pe = this.el.querySelector('#prof-pts');
    if (pe) pe.textContent = prof.points;
  }
  showSettings() {
    const g = this.game;
    const cfg = g.cfg;
    const choice = (key, label, vals, names) => '<div class="set-row"><div><div class="s-label">' + label + '</div></div><div class="set-choice">' + vals.map((v, i) => '<button class="' + (cfg[key] === v ? 'on' : '') + '" data-set="' + key + '" data-val="' + v + '">' + names[i] + '</button>').join('') + '</div></div>';
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:560px">
        <div class="title-row"><span class="big-duck">⚙</span><div><div class="menu-title">沙盒设置</div><div class="menu-sub">末日规则由你决定（进入新游戏时生效）。</div></div></div>
        ${choice('dayLenHours', '每日时长（现实小时）', [0.33, 0.67, 1.5], ['20分钟', '40分钟', '90分钟'])}
        ${choice('zombiePop', '丧尸数量', [0.5, 1.0, 1.6], ['少', '标准', '尸潮'])}
        ${choice('powerShutoff', '断电时间（第几天）', [1, 3, 7, 30], ['第1天', '第3天', '第7天', '永不'])}
        ${choice('waterShutoff', '停水时间（第几天）', [1, 4, 10, 30], ['第1天', '第4天', '第10天', '永不'])}
        ${choice('metaEvents', '元事件（枪声/直升机）', [0, 1], ['关闭', '开启'])}
        <div class="set-row"><div><div class="s-label">音量</div></div><input type="range" min="0" max="1" step="0.05" value="${cfg.volume}" id="vol-slider" style="width:180px"></div>
        <button class="menu-btn" id="set-back">返回</button>
      </div>`;
    this.el.querySelector('#set-back').addEventListener('click', () => this.showMain());
    this.el.querySelector('#vol-slider').addEventListener('input', e => {
      cfg.volume = Number(e.target.value);
      if (g.audio) g.audio.setVolume(cfg.volume);
    });
    this.el.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
      cfg[b.dataset.set] = Number(b.dataset.val);
      this.showSettings();
    }));
  }
  showPause() {
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:460px;text-align:center">
        <div class="title-row" style="justify-content:center"><span class="big-duck">⏸</span><div><div class="menu-title">暂停</div></div></div>
        <div class="menu-sub">“奶爸友好型末日” — 随时停下，去给孩子换尿布。</div>
        <button class="menu-btn" id="pa-resume">▶ 继续生存</button>
        <button class="menu-btn" id="pa-save">💾 保存并继续</button>
        <button class="menu-btn" id="pa-settings">⚙ 设置</button>
        <button class="menu-btn danger" id="pa-quit">🚪 放弃本次生存（回到主菜单）</button>
      </div>`;
    this.el.querySelector('#pa-resume').addEventListener('click', () => { this.game.state = 'playing'; this.el.classList.add('hidden'); });
    this.el.querySelector('#pa-save').addEventListener('click', () => { this.game.save(); this.game.toast('💾 已保存', 'good'); this.game.state = 'playing'; this.el.classList.add('hidden'); });
    this.el.querySelector('#pa-settings').addEventListener('click', () => this.showSettings());
    this.el.querySelector('#pa-quit').addEventListener('click', () => { this.game.state = 'menu'; this.game.running = false; this.game.save(); this.showMain(); });
  }
  showDeath(msg) {
    const g = this.game, p = g.player;
    const st = p ? p.stats : null;
    const days = g.env ? g.env.day : 1;
    const kills = st ? st.kills : 0;
    const quotes = [
      '“这就是你如何死去的。”',
      '“末日不会温柔地对待任何一只鸭子。”',
      '“下一次，记得多带两卷绷带。”',
      '“感染无药可救。你早就知道。”',
      '“鸭科夫不记得你，但公路记得。”',
    ];
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:520px;text-align:center">
        <div class="big-duck" style="font-size:80px;filter:grayscale(1)">💀</div>
        <div class="death-title">你死了</div>
        <div class="death-quote">${msg}<br>${quotes[Math.floor(Math.random() * quotes.length)]}</div>
        <div class="menu-sub" style="line-height:2">
          存活天数：<b style="color:#ffd23e">${days}</b> 天<br>
          击杀感染鸭：<b style="color:#ffd23e">${kills}</b> 只<br>
          ${st && st.knox ? '死因：丧尸病毒 ☠<br>' : ''}生存评分：<b style="color:#ffd23e">${Math.round(days * 100 + kills * 10)}</b>
        </div>
        <button class="menu-btn" id="death-retry">🔄 再试一次（新幸存者）</button>
        <button class="menu-btn" id="death-main">🏠 主菜单</button>
      </div>`;
    this.el.querySelector('#death-retry').addEventListener('click', () => this.showCharCreate());
    this.el.querySelector('#death-main').addEventListener('click', () => this.showMain());
  }
  showWin() {
    const g = this.game;
    const days = g.env.day, kills = g.player.stats.kills;
    this.el.classList.remove('hidden');
    this.el.innerHTML = `
      <div class="menu-box" style="max-width:540px;text-align:center">
        <div class="big-duck" style="font-size:80px">🚀</div>
        <div class="death-title" style="color:#7fd0a0">你逃出去了</div>
        <div class="death-quote">引擎轰鸣，轮胎碾过尸骸。鸭科夫在后视镜里越来越小——你做到了。</div>
        <div class="menu-sub" style="line-height:2">存活 ${days} 天 · 击杀 ${kills} 只感染鸭 · 结局：<b style="color:#7fd0a0">公路逃亡</b></div>
        <button class="menu-btn" id="win-again">🔄 再来一局</button>
        <button class="menu-btn" id="win-main">🏠 主菜单</button>
      </div>`;
    this.el.querySelector('#win-again').addEventListener('click', () => this.showCharCreate());
    this.el.querySelector('#win-main').addEventListener('click', () => this.showMain());
  }
}
