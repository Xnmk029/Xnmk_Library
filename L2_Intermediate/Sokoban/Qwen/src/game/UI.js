// ============================================
// 独立游戏风格 UI 系统
// 设计原则：泥土色系、像素感、无emoji、无毛玻璃、无蓝紫渐变
// ============================================

export class GameUI {
  constructor() {
    this.container = null;
    this.callbacks = {};
    this.currentScreen = null;
  }
  
  init() {
    this.createStyles();
    this.container = document.createElement('div');
    this.container.id = 'game-ui';
    document.body.appendChild(this.container);
  }
  
  createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
      
      #game-ui {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
        font-family: 'Press Start 2P', 'Courier New', monospace;
      }
      
      #game-ui * {
        pointer-events: auto;
      }
      
      /* 主菜单 */
      .menu-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, 
          rgba(42, 74, 42, 0.3) 0%, 
          rgba(26, 42, 26, 0.6) 100%);
      }
      
      .game-title {
        font-size: 2.5rem;
        color: #e8d8a0;
        text-shadow: 
          4px 4px 0 #5a4a2a,
          -2px -2px 0 #8a7a5a;
        margin-bottom: 0.5rem;
        letter-spacing: 0.1em;
      }
      
      .game-subtitle {
        font-size: 0.7rem;
        color: #a8c8a0;
        margin-bottom: 3rem;
        letter-spacing: 0.3em;
      }
      
      .menu-btn {
        display: block;
        width: 280px;
        padding: 16px 24px;
        margin: 8px 0;
        font-family: inherit;
        font-size: 0.75rem;
        color: #3a2a1a;
        background: linear-gradient(180deg, #d4c4a0 0%, #b8a880 100%);
        border: 3px solid #8a7a5a;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        box-shadow: 0 4px 0 #6a5a3a;
      }
      
      .menu-btn:hover {
        background: linear-gradient(180deg, #e4d4b0 0%, #c8b890 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 0 #6a5a3a;
      }
      
      .menu-btn:active {
        transform: translateY(2px);
        box-shadow: 0 2px 0 #6a5a3a;
      }
      
      .menu-btn.primary {
        background: linear-gradient(180deg, #7ab648 0%, #5a9a30 100%);
        border-color: #4a7a28;
        color: #1a3a1a;
        box-shadow: 0 4px 0 #3a6a20;
      }
      
      .menu-btn.primary:hover {
        background: linear-gradient(180deg, #8ac658 0%, #6aaa40 100%);
      }
      
      /* 关卡选择 */
      .level-select {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(26, 42, 26, 0.85);
      }
      
      .level-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin: 2rem 0;
      }
      
      .level-btn {
        width: 64px;
        height: 64px;
        font-family: inherit;
        font-size: 1rem;
        color: #3a2a1a;
        background: linear-gradient(180deg, #d4c4a0 0%, #b8a880 100%);
        border: 3px solid #8a7a5a;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 3px 0 #6a5a3a;
      }
      
      .level-btn:hover {
        background: linear-gradient(180deg, #7ab648 0%, #5a9a30 100%);
        transform: translateY(-2px);
      }
      
      .level-btn.locked {
        background: #6a6a5a;
        color: #4a4a3a;
        cursor: not-allowed;
        box-shadow: none;
      }
      
      .level-btn.completed {
        background: linear-gradient(180deg, #90c860 0%, #70a840 100%);
        border-color: #5a8a30;
      }
      
      /* 游戏 HUD */
      .game-hud {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .hud-left {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .hud-level {
        font-size: 0.8rem;
        color: #e8d8a0;
        text-shadow: 2px 2px 0 #3a2a1a;
      }
      
      .hud-stats {
        font-size: 0.6rem;
        color: #a8c8a0;
        text-shadow: 1px 1px 0 #2a3a2a;
      }
      
      .hud-right {
        display: flex;
        gap: 8px;
      }
      
      .hud-btn {
        width: 40px;
        height: 40px;
        font-family: inherit;
        font-size: 0.7rem;
        color: #3a2a1a;
        background: linear-gradient(180deg, #d4c4a0 0%, #b8a880 100%);
        border: 2px solid #8a7a5a;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: 0 3px 0 #6a5a3a;
        transition: all 0.1s ease;
      }
      
      .hud-btn:hover {
        background: linear-gradient(180deg, #e4d4b0 0%, #c8b890 100%);
      }
      
      .hud-btn:active {
        transform: translateY(2px);
        box-shadow: 0 1px 0 #6a5a3a;
      }
      
      /* 过关画面 */
      .complete-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(26, 42, 26, 0.9);
        animation: fadeIn 0.5s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .complete-title {
        font-size: 1.5rem;
        color: #90ee90;
        text-shadow: 3px 3px 0 #2a5a2a;
        margin-bottom: 1rem;
      }
      
      .complete-stats {
        font-size: 0.65rem;
        color: #c8d8c0;
        margin-bottom: 2rem;
        text-align: center;
        line-height: 2;
      }
      
      /* 暂停画面 */
      .pause-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(26, 42, 26, 0.85);
      }
      
      .pause-title {
        font-size: 1.2rem;
        color: #e8d8a0;
        margin-bottom: 2rem;
      }
      
      /* 控制提示 */
      .controls-hint {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.55rem;
        color: #8a9a8a;
        text-align: center;
        line-height: 1.8;
      }
      
      .key-hint {
        display: inline-block;
        padding: 2px 6px;
        background: #4a5a4a;
        border: 1px solid #6a7a6a;
        border-radius: 3px;
        margin: 0 2px;
      }
      
      /* 移动端控制 */
      .mobile-controls {
        position: absolute;
        bottom: 30px;
        right: 30px;
        display: none;
      }
      
      @media (max-width: 768px) {
        .mobile-controls {
          display: grid;
          grid-template-columns: repeat(3, 50px);
          grid-template-rows: repeat(3, 50px);
          gap: 4px;
        }
        
        .controls-hint {
          display: none;
        }
      }
      
      .d-pad-btn {
        font-family: inherit;
        font-size: 1rem;
        color: #3a2a1a;
        background: linear-gradient(180deg, #d4c4a0 0%, #b8a880 100%);
        border: 2px solid #8a7a5a;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: 0 3px 0 #6a5a3a;
      }
      
      .d-pad-btn:active {
        transform: translateY(2px);
        box-shadow: 0 1px 0 #6a5a3a;
      }
      
      .d-pad-up { grid-column: 2; grid-row: 1; }
      .d-pad-left { grid-column: 1; grid-row: 2; }
      .d-pad-right { grid-column: 3; grid-row: 2; }
      .d-pad-down { grid-column: 2; grid-row: 3; }
    `;
    document.head.appendChild(style);
  }
  
  // 显示主菜单
  showMenu() {
    this.currentScreen = 'menu';
    this.container.innerHTML = `
      <div class="menu-screen">
        <h1 class="game-title">WHALE BOX</h1>
        <p class="game-subtitle">A SOKOBAN TALE</p>
        <button class="menu-btn primary" data-action="start">START GAME</button>
        <button class="menu-btn" data-action="levels">LEVEL SELECT</button>
        <button class="menu-btn" data-action="about">ABOUT</button>
        <div class="controls-hint">
          <span class="key-hint">W</span><span class="key-hint">A</span><span class="key-hint">S</span><span class="key-hint">D</span> or Arrow Keys to Move
        </div>
      </div>
    `;
    this.bindEvents();
  }
  
  // 显示关卡选择
  showLevelSelect(unlockedLevel = 0, completedLevels = []) {
    this.currentScreen = 'levels';
    let buttons = '';
    
    for (let i = 0; i < 10; i++) {
      const isLocked = i > unlockedLevel;
      const isCompleted = completedLevels.includes(i);
      const className = isLocked ? 'locked' : (isCompleted ? 'completed' : '');
      buttons += `<button class="level-btn ${className}" data-level="${i}" ${isLocked ? 'disabled' : ''}>${i + 1}</button>`;
    }
    
    this.container.innerHTML = `
      <div class="level-select">
        <h2 class="game-title" style="font-size: 1.2rem;">SELECT LEVEL</h2>
        <div class="level-grid">${buttons}</div>
        <button class="menu-btn" data-action="back">BACK</button>
      </div>
    `;
    this.bindEvents();
  }
  
  // 显示游戏 HUD
  showHUD(levelInfo) {
    this.currentScreen = 'hud';
    this.container.innerHTML = `
      <div class="game-hud">
        <div class="hud-left">
          <div class="hud-level">LV.${levelInfo.index + 1} ${levelInfo.name}</div>
          <div class="hud-stats">MOVES: <span id="move-count">${levelInfo.moves}</span> | PUSHES: <span id="push-count">${levelInfo.pushes}</span></div>
        </div>
        <div class="hud-right">
          <button class="hud-btn" data-action="reset" title="Reset">R</button>
          <button class="hud-btn" data-action="pause" title="Pause">II</button>
        </div>
      </div>
      <div class="controls-hint">
        <span class="key-hint">WASD</span> Move | <span class="key-hint">R</span> Reset | <span class="key-hint">ESC</span> Pause
      </div>
      <div class="mobile-controls">
        <button class="d-pad-btn d-pad-up" data-dir="up">^</button>
        <button class="d-pad-btn d-pad-left" data-dir="left"><</button>
        <button class="d-pad-btn d-pad-right" data-dir="right">></button>
        <button class="d-pad-btn d-pad-down" data-dir="down">v</button>
      </div>
    `;
    this.bindEvents();
  }
  
  // 更新 HUD 统计
  updateStats(moves, pushes) {
    const moveEl = document.getElementById('move-count');
    const pushEl = document.getElementById('push-count');
    if (moveEl) moveEl.textContent = moves;
    if (pushEl) pushEl.textContent = pushes;
  }
  
  // 显示过关画面
  showLevelComplete(levelInfo) {
    this.currentScreen = 'complete';
    this.container.innerHTML = `
      <div class="complete-screen">
        <h2 class="complete-title">LEVEL CLEAR!</h2>
        <div class="complete-stats">
          LEVEL ${levelInfo.index + 1}: ${levelInfo.name}<br>
          MOVES: ${levelInfo.moves}<br>
          PUSHES: ${levelInfo.pushes}
        </div>
        <button class="menu-btn primary" data-action="next">NEXT LEVEL</button>
        <button class="menu-btn" data-action="replay">REPLAY</button>
        <button class="menu-btn" data-action="levels">LEVEL SELECT</button>
      </div>
    `;
    this.bindEvents();
  }
  
  // 显示暂停画面
  showPause() {
    this.currentScreen = 'pause';
    this.container.innerHTML = `
      <div class="pause-screen">
        <h2 class="pause-title">PAUSED</h2>
        <button class="menu-btn primary" data-action="resume">RESUME</button>
        <button class="menu-btn" data-action="reset">RESTART</button>
        <button class="menu-btn" data-action="levels">LEVEL SELECT</button>
        <button class="menu-btn" data-action="menu">MAIN MENU</button>
      </div>
    `;
    this.bindEvents();
  }
  
  // 绑定事件
  bindEvents() {
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (this.callbacks[action]) {
          this.callbacks[action]();
        }
      });
    });
    
    this.container.querySelectorAll('[data-level]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const level = parseInt(e.target.dataset.level);
        if (this.callbacks.selectLevel) {
          this.callbacks.selectLevel(level);
        }
      });
    });
    
    this.container.querySelectorAll('[data-dir]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dir = e.target.dataset.dir;
        if (this.callbacks.move) {
          this.callbacks.move(dir);
        }
      });
    });
  }
  
  // 设置回调
  on(action, callback) {
    this.callbacks[action] = callback;
  }
  
  // 隐藏 UI
  hide() {
    this.container.innerHTML = '';
  }
}
