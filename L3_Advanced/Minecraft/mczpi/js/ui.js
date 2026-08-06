/* UI：标题、暂停菜单、热键栏、准星、F3 调试、提示 */
(function () {
  'use strict';

  class UI {
    constructor(hotbarIds) {
      this.slot = 0;
      this.debugVisible = false;
      this.hotbarIds = hotbarIds;
      this.el = {
        title: document.getElementById('title-screen'),
        pause: document.getElementById('pause-screen'),
        hud: document.getElementById('hud'),
        hotbar: document.getElementById('hotbar'),
        itemName: document.getElementById('item-name'),
        debug: document.getElementById('debug'),
        toast: document.getElementById('toast'),
        crosshair: document.getElementById('crosshair'),
        btnStart: document.getElementById('btn-start'),
        btnNew: document.getElementById('btn-new'),
        seedInput: document.getElementById('seed-input'),
        btnResume: document.getElementById('btn-resume'),
        btnSaveExit: document.getElementById('btn-save-exit'),
        btnReset: document.getElementById('btn-reset'),
        glError: document.getElementById('gl-error')
      };
      this.onStart = null; this.onNew = null; this.onResume = null;
      this.onSaveExit = null; this.onReset = null;
      this._toastTimer = null;

      // 热键栏图标
      const defs = window.Blocks.DEFS;
      this.slots = [];
      for (let i = 0; i < hotbarIds.length; i++) {
        const div = document.createElement('div');
        div.className = 'slot';
        const c = document.createElement('canvas');
        c.width = c.height = 40;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const texId = defs[hotbarIds[i]].tex[4];
        g.drawImage(window.Tex.T[window.Tex.ORDER[texId]], 0, 0, 16, 16, 2, 2, 36, 36);
        div.appendChild(c);
        this.el.hotbar.appendChild(div);
        this.slots.push(div);
      }

      this.el.btnStart.addEventListener('click', () => this.onStart && this.onStart(this.el.seedInput.value));
      this.el.btnNew.addEventListener('click', () => this.onNew && this.onNew());
      this.el.btnResume.addEventListener('click', () => this.onResume && this.onResume());
      this.el.btnSaveExit.addEventListener('click', () => this.onSaveExit && this.onSaveExit());
      this.el.btnReset.addEventListener('click', () => {
        if (confirm('确定要重置世界吗？所有存档将被删除。')) this.onReset && this.onReset();
      });
      this.el.seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.onStart && this.onStart(this.el.seedInput.value); });
    }

    showTitle(hasSave, seedText) {
      this.el.title.classList.remove('hidden');
      this.el.btnStart.textContent = hasSave ? '▶ 继续游戏' : '▶ 开始游戏';
      this.el.seedInput.value = hasSave ? String(seedText) : '';
      this.el.seedInput.placeholder = hasSave ? '留空使用存档种子' : '留空=随机种子';
    }
    hideTitle() { this.el.title.classList.add('hidden'); }

    showPause() { if (!this.el.pause.classList.contains('hidden')) return; this.el.pause.classList.remove('hidden'); }
    hidePause() { this.el.pause.classList.add('hidden'); }

    showHUD(v) { this.el.hud.classList.toggle('hidden', !v); }

    setSlot(i) {
      this.slot = i;
      for (let k = 0; k < this.slots.length; k++) this.slots[k].classList.toggle('selected', k === i);
      const id = this.hotbarIds[i];
      this.el.itemName.textContent = window.Blocks.DEFS[id].name;
    }

    updateDebug(text) { this.el.debug.textContent = text; }
    toggleDebug() {
      this.debugVisible = !this.debugVisible;
      this.el.debug.classList.toggle('hidden', !this.debugVisible);
    }

    toast(msg, ms) {
      const t = this.el.toast;
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 3000);
    }

    showGLError(msg) {
      this.el.glError.classList.remove('hidden');
      this.el.glError.textContent = msg;
    }
  }

  window.UI = UI;
})();
