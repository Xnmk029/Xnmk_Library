// 全屏/覆盖层界面：帮助、阵亡、撤离结算、结局、Toast。
// 从 main.js 拆出来，避免主文件膨胀成没人敢改的巨石。
import { FACILITIES, QUESTS, NPC } from '../systems/hideout.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HIDEOUT_META = { FACILITIES, QUESTS, NPC };

export function toast(msg, kind = '') {
  const host = $('toast');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function overlayWin(title, bodyHtml, footHtml = '', onClose) {
  const ov = $('overlay');
  ov.classList.add('on');
  $('overlayHost').innerHTML = `<div class="win" style="width:min(560px,92vw)">
    <h3>${esc(title)} <span class="x">×</span></h3>
    <div class="body">${bodyHtml}</div>
    ${footHtml ? `<div class="foot">${footHtml}</div>` : ''}
  </div>`;
  const close = () => { ov.classList.remove('on'); $('overlayHost').innerHTML = ''; onClose?.(); };
  $('overlayHost').querySelector('.x').onclick = close;
  return { close, host: $('overlayHost') };
}

function overlayClose() {
  $('overlay').classList.remove('on');
  $('overlayHost').innerHTML = '';
}

export function showHelp() {
  const { host } = overlayWin('操作说明', $('menuTip').innerHTML,
    '<button class="btn" id="closeHelp">关闭</button>');
  $('closeHelp').onclick = () => {
    $('overlay').classList.remove('on');
    host.innerHTML = '';
  };
}

export function showDeath(game, source, knox) {
  const { host } = overlayWin('阵亡', `
    <p style="color:var(--blood);margin-bottom:10px">
      ${knox ? '克诺克斯病毒发作 —— 无药可医。' : `你被 ${esc(source?.def?.name ?? '敌人')} 击倒。`}
    </p>
    <p style="color:var(--dim)">按鸭科夫规则：背包与装备全部丢失，仅保留近战武器槽与保险箱内的物品。</p>
    <p style="color:var(--dim);margin-top:8px">
      击杀 ${game.kills || 0} · 存活 ${game.day} 天 · 搜刮 ${game.searched || 0} 个容器
    </p>`, '<button class="btn primary" id="btnRespawn">返回主菜单</button>');
  $('btnRespawn').onclick = () => location.reload();
}

/** 撤离成功结算。onHideout 回调负责打开藏身处（而不是粗暴刷新页面） */
export function showExtract(game, lootValue, onHideout) {
  const { host } = overlayWin('撤离成功', `
    <p style="color:var(--ok);margin-bottom:10px">你带着战利品离开了 ${esc(game.mapDef.name)}。</p>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:11px">
      <span class="k">带出物资价值</span><b>${Math.round(lootValue)} 现金</b>
      <span class="k">击杀</span><b>${game.kills || 0}</b>
      <span class="k">存活</span><b>第 ${game.day} 天</b>
      <span class="k">身体状态</span><b>${Math.round(game.health.totalPct * 100)}%</b>
    </div>`,
    `<button class="btn" id="btnAgain">再次出击</button>
     <button class="btn primary" id="btnBack">进入藏身处</button>`);
  $('btnBack').onclick = () => { overlayClose(); onHideout?.() ?? location.reload(); };
  $('btnAgain').onclick = () => location.reload();
}

/**
 * 藏身处：设施升级 / NPC 任务 / 局外仓库 / 出击准备。
 * 这是"搜打撤"循环的另一端 —— 带回来的物资必须有去处，否则搜刮就没有意义。
 */
export function showHideout(game, onStartRaid) {
  const { FACILITIES: H_FACILITIES, QUESTS: H_QUESTS, NPC: H_NPC } = HIDEOUT_META;
  const h = game.hideout;

  const facCard = (id) => {
    const f = H_FACILITIES[id];
    const lv = h.level(id);
    const next = lv < f.max ? f.cost(lv + 1) : null;
    const afford = next ? Object.keys(next).every((k) => h.count(k) >= next[k]) : false;
    const costHtml = next
      ? Object.entries(next).map(([k, n]) => `<span class="cv ${h.count(k) >= n ? 'ok' : 'no'}">${k} ${h.count(k)}/${n}</span>`).join(' ')
      : '<span class="cv ok">已满级</span>';
    return `<div class="fac">
      <div class="hd"><b>${f.icon} ${f.name}</b><span class="lv">Lv.${lv}/${f.max}</span></div>
      <div class="ds">${esc(f.desc)}</div>
      <div class="ef">当前：${lv > 0 ? esc(f.effect(lv)) : '未建造'}</div>
      <div class="ct">${costHtml}</div>
      ${next ? `<button class="btn up" data-up="${id}" ${afford ? '' : 'disabled'}>升级</button>` : ''}
    </div>`;
  };

  const questRow = (q) => {
    const st = h.quests[q.id] || { done: false, progress: {} };
    const npc = H_NPC[q.npc];
    const prog = q.goal.item
      ? `(${Math.min(h.count(q.goal.item.id), q.goal.item.n)}/${q.goal.item.n})`
      : `(${st.progress?.search ?? 0}/${q.goal.search ?? 0} 搜刮)`;
    return `<div class="quest ${st.done ? 'done' : ''}">
      <b>${npc?.icon ?? '❓'} ${esc(q.name)}</b>
      <span>${st.done ? '已完成' : esc(prog)}</span>
      <div class="qs">${esc(q.text)}</div>
    </div>`;
  };

  const { host } = overlayWin(`藏身处 · 第 ${game.day} 天`, `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:2;min-width:280px">
        <h4 style="color:var(--dim);font-size:11px;letter-spacing:.1em;margin-bottom:8px">设施</h4>
        <div class="facGrid">${Object.keys(H_FACILITIES).map(facCard).join('')}</div>
        <h4 style="color:var(--dim);font-size:11px;letter-spacing:.1em;margin:14px 0 8px">NPC 任务</h4>
        ${H_QUESTS.map(questRow).join('')}
      </div>
      <div style="flex:1;min-width:200px">
        <h4 style="color:var(--dim);font-size:11px;letter-spacing:.1em;margin-bottom:8px">仓库（${h.stash.length} 类）</h4>
        <div class="stash">
          ${h.stash.length
    ? h.stash.slice(0, 40).map((s) => `<div><span>${esc(s.id)}</span><b>×${s.n}</b></div>`).join('')
    : '<div style="color:var(--dim)">空空如也 —— 先去零号区搜刮吧</div>'}
        </div>
        <div style="margin-top:12px;color:var(--dim)">现金 <b style="color:var(--txt)">${h.cash}</b></div>
      </div>
    </div>`,
    `<span style="margin-right:auto;color:var(--dim);align-self:center">医疗站会在出击前自动补给</span>
     <button class="btn" id="hRefresh">刷新</button>
     <button class="btn primary" id="hRaid">出击</button>`);

  host.querySelectorAll('[data-up]').forEach((el) => {
    el.onclick = () => {
      const r = h.upgrade(el.dataset.up);
      game.toast?.(r.ok ? `${el.dataset.up} 升至 Lv.${r.level}` : r.reason, r.ok ? 'good' : 'bad');
      showHideout(game, onStartRaid);
    };
  });
  $('hRefresh').onclick = () => { h.checkQuests(); showHideout(game, onStartRaid); };
  $('hRaid').onclick = () => {
    h.checkQuests();
    h.supplyBeforeRaid();
    overlayClose();
    onStartRaid?.();
  };
  return host;
}

/** 多结局（文档 §2.4） */
export const ENDINGS = {
  escape: {
    title: '结局 · 飞向星海',
    text: '飞船引擎点亮，鸭科夫在舷窗外迅速缩小。你活下来了 —— 仅此一次，也已足够。',
  },
  perfect: {
    title: '结局 · 完美撤离',
    text: '神秘飞船图纸在手，飞船扩展出额外的舱室。你不只是逃了出来，还带走了它们的秘密。',
  },
  sacrifice: {
    title: '结局 · 关闭防空导弹',
    text: '你返回控制塔手动关闭了防空导弹。追兵的火光在身后熄灭，代价是再也没有回头路。',
  },
  zombified: {
    title: '结局 · 它们之中的一个',
    text: '病毒走完了全程。你站起来的时候，已经不再是自己了。',
  },
};

export function showEnding(key) {
  const e = ENDINGS[key] || ENDINGS.escape;
  overlayWin(e.title, `<p style="line-height:1.9;color:var(--txt)">${esc(e.text)}</p>`,
    '<button class="btn primary" id="btnEnd">重新开始</button>');
  $('btnEnd').onclick = () => location.reload();
}
