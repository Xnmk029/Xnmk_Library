/**
 * main.js — entry point
 */
import { App } from './core/App.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App();
    window.__BEAMGL = app;
    await app.init();
  } catch (e) {
    console.error('[BEAMGL] FATAL:', e);
    const detail = document.getElementById('loaderDetail');
    if (detail) {
      detail.textContent = '初始化失败: ' + e.message;
      detail.style.color = '#ff2e4d';
    }
  }
});
