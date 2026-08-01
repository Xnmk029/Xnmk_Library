// main.js — 启动
(function () {
  'use strict';
  window.addEventListener('DOMContentLoaded', () => {
    // 先解锁音频（首次交互时）
    document.addEventListener('pointerdown', () => window.B.sfx.unlock(), { once: true });
    window.B.ui.init();
    // 缩放适配
    fitScale();
    window.addEventListener('resize', fitScale);
  });

  function fitScale() {
    const app = document.getElementById('app');
    if (!app) return;
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    app.style.transform = 'scale(' + scale + ')';
    app.style.transformOrigin = 'top left';
    document.body.style.width = (1600 * scale) + 'px';
    document.body.style.height = (900 * scale) + 'px';
  }
})();
