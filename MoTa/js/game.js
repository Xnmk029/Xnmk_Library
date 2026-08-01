/**
 * 魔塔 (Magic Tower) - Core Game Engine
 */

class MagicTowerGame {
  constructor() {
    this.player = {
      hp: 1000,
      atk: 10,
      def: 10,
      gold: 0,
      keys: { yellow: 1, blue: 1, red: 1 },
      currentFloor: 0,
      r: 10,
      c: 5,
      hasManual: false,
      hasFlyer: false,
      talkedOldMan: false
    };

    this.visitedFloors = new Set([0]);
    this.maps = JSON.parse(JSON.stringify(MAPS)); // Deep clone maps data

    this.mapWrapperEl = document.getElementById('map-wrapper');
    this.mapGridEl = document.getElementById('map-grid');
    this.hitFlashEl = document.getElementById('hit-flash');
    this.floatingContainerEl = document.getElementById('floating-container');
    this.actionLogEl = document.getElementById('action-log');
    this.fadeOverlayEl = document.getElementById('fade-overlay');

    this.isTransitioning = false;

    this.initUI();
    this.bindEvents();
    this.render();
    this.log("欢迎来到《魔塔》！使用 WASD 或方向键移动，撞击门、宝石或怪物。");
  }

  initUI() {
    // Render empty 11x11 grid tiles once
    this.mapGridEl.innerHTML = '';
    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 11; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile floor';
        tile.dataset.r = r;
        tile.dataset.c = c;
        tile.addEventListener('click', () => this.handleTileClick(r, c));
        this.mapGridEl.appendChild(tile);
      }
    }
  }

  bindEvents() {
    // Keyboard input listener
    window.addEventListener('keydown', (e) => {
      // Ignore key events if modal is open
      if (document.querySelector('.modal-overlay.active')) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          this.movePlayer(-1, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          this.movePlayer(1, 0);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          this.movePlayer(0, -1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          this.movePlayer(0, 1);
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          this.openMonsterManual();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          this.openTeleporter();
          break;
      }
    });

    // On-screen D-Pad buttons
    document.getElementById('btn-up').addEventListener('click', () => this.movePlayer(-1, 0));
    document.getElementById('btn-down').addEventListener('click', () => this.movePlayer(1, 0));
    document.getElementById('btn-left').addEventListener('click', () => this.movePlayer(0, -1));
    document.getElementById('btn-right').addEventListener('click', () => this.movePlayer(0, 1));

    // Toolbar buttons
    document.getElementById('btn-manual').addEventListener('click', () => this.openMonsterManual());
    document.getElementById('btn-teleport').addEventListener('click', () => this.openTeleporter());
    document.getElementById('btn-save').addEventListener('click', () => this.saveGame());
    document.getElementById('btn-load').addEventListener('click', () => this.loadGame());
    document.getElementById('btn-reset').addEventListener('click', () => this.resetGame());
    document.getElementById('btn-sound').addEventListener('click', (e) => {
      const isMuted = audio.toggleMute();
      e.currentTarget.textContent = isMuted ? '🔇 静音' : '🔊 音效';
      this.toast(isMuted ? '音效已关闭' : '音效已开启');
    });

    // Modal Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });
  }

  // Calculate battle preview deterministic result
  calcBattle(monster) {
    const pDmgPerTurn = Math.max(0, this.player.atk - monster.def);
    const mDmgPerTurn = Math.max(0, monster.atk - this.player.def);

    if (pDmgPerTurn <= 0) {
      return { canWin: false, reason: '无法破防', turns: Infinity, damage: Infinity };
    }

    const turns = Math.ceil(monster.hp / pDmgPerTurn);
    const totalDamage = (turns - 1) * mDmgPerTurn;

    if (totalDamage >= this.player.hp) {
      return { canWin: false, reason: '生命值不足', turns, damage: totalDamage };
    }

    return { canWin: true, turns, damage: totalDamage };
  }

  movePlayer(dr, dc) {
    if (this.isTransitioning) return;

    const curMap = this.maps[this.player.currentFloor];
    const targetR = this.player.r + dr;
    const targetC = this.player.c + dc;

    // Out of bounds check
    if (targetR < 0 || targetR >= 11 || targetC < 0 || targetC >= 11) return;

    const targetCell = curMap.grid[targetR][targetC];

    // Handle Collision & Interaction
    if (targetCell === 1) {
      // Wall
      return;
    } else if (targetCell === 0) {
      // Empty floor - move
      this.player.r = targetR;
      this.player.c = targetC;
      audio.playMove();
      this.render();
    } else if (targetCell === 2) {
      // Stair Up
      this.changeFloor(this.player.currentFloor + 1, 'up');
    } else if (targetCell === 3) {
      // Stair Down
      this.changeFloor(this.player.currentFloor - 1, 'down');
    } else if (targetCell >= 10 && targetCell <= 12) {
      // Doors (10: Yellow, 11: Blue, 12: Red)
      this.handleDoor(targetR, targetC, targetCell);
    } else if (targetCell === 13) {
      // Iron Gate
      audio.playWarning();
      this.toast("机关封锁：请先打败本层的魔塔大魔王！", "warning");
    } else if (ITEMS[targetCell]) {
      // Pick up item
      this.handleItem(targetR, targetC, targetCell);
    } else if (typeof targetCell === 'string' && MONSTERS[targetCell]) {
      // Battle Monster
      this.handleBattle(targetR, targetC, targetCell);
    } else if (targetCell === 90) {
      // Merchant NPC
      this.openMerchantShop();
    } else if (targetCell === 91) {
      // Wise Old Man NPC
      this.handleWiseOldMan();
    } else if (targetCell === 92) {
      // Princess (Victory!)
      this.handleVictory();
    }
  }

  handleTileClick(r, c) {
    if (this.isTransitioning) return;
    const dr = r - this.player.r;
    const dc = c - this.player.c;
    // Allow single orthogonal adjacent click step
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      this.movePlayer(dr, dc);
    }
  }

  handleDoor(r, c, doorType) {
    let keyColor = '';
    let keyName = '';

    if (doorType === 10) { keyColor = 'yellow'; keyName = '黄钥匙'; }
    else if (doorType === 11) { keyColor = 'blue'; keyName = '蓝钥匙'; }
    else if (doorType === 12) { keyColor = 'red'; keyName = '红钥匙'; }

    if (this.player.keys[keyColor] > 0) {
      this.player.keys[keyColor]--;
      this.maps[this.player.currentFloor].grid[r][c] = 0;
      audio.playDoor();
      this.log(`消耗 1 把${keyName}，打开了${keyName.replace('钥匙', '门')}。`, "info");
      this.render();
    } else {
      audio.playWarning();
      this.toast(`缺乏${keyName}，无法开门！`, "warning");
    }
  }

  handleItem(r, c, itemId) {
    const item = ITEMS[itemId];
    this.maps[this.player.currentFloor].grid[r][c] = 0;

    let floatText = '';
    let floatClass = '';

    if (item.type === 'key') {
      this.player.keys[item.keyType] += item.count;
      floatText = `+${item.count} ${item.name}`;
      floatClass = 'item-gain';
      this.log(`捡到 ${item.name} x${item.count}`, "success");
    } else if (item.type === 'buff') {
      this.player[item.stat] += item.value;
      floatText = item.text;
      floatClass = item.stat === 'hp' ? 'hp-gain' : (item.stat === 'atk' ? 'atk-gain' : 'def-gain');
      this.log(`获得 ${item.name}：${item.text}`, "success");
    } else if (item.type === 'gear') {
      this.player[item.stat] += item.value;
      floatText = item.text;
      floatClass = item.stat === 'atk' ? 'atk-gain' : 'def-gain';
      this.log(`装备神器 ${item.name}！${item.text}`, "success");
    } else if (item.type === 'special') {
      this.player[item.itemKey] = true;
      floatText = item.text;
      floatClass = 'item-gain';
      this.log(`${item.text}`, "success");
      this.toast(`获得道具：${item.name}！`);
    }

    audio.playItem();
    this.createFloatingText(r, c, floatText, floatClass);

    // Step player into item position
    this.player.r = r;
    this.player.c = c;
    this.render();
  }

  handleBattle(r, c, monsterId) {
    const monster = MONSTERS[monsterId];
    const battleResult = this.calcBattle(monster);

    if (!battleResult.canWin) {
      audio.playWarning();
      if (battleResult.reason === '无法破防') {
        this.toast(`无法破防！你的攻击力 (${this.player.atk}) ≤ 怪物防御力 (${monster.def})`, "warning");
        this.log(`试图攻击 [${monster.name}]，但无法对其造成伤害！`, "warning");
      } else {
        this.toast(`生命值不足！击败 [${monster.name}] 需扣血 ${battleResult.damage}，当前生命值 ${this.player.hp}`, "warning");
        this.log(`生命值不足以战胜 [${monster.name}]（需要 ${battleResult.damage} HP）`, "warning");
      }
      return;
    }

    // Battle execution!
    this.player.hp -= battleResult.damage;
    this.player.gold += monster.gold;
    this.maps[this.player.currentFloor].grid[r][c] = 0;

    // Visual & Sound Feedback
    audio.playHit();
    this.triggerShakeAndFlash();

    if (battleResult.damage > 0) {
      this.createFloatingText(r, c, `-${battleResult.damage} HP`, 'hp-loss');
    }
    this.createFloatingText(r, c, `+${monster.gold} 金币`, 'gold-gain');

    this.log(`击败 [${monster.name}]，损失 ${battleResult.damage} HP，获得 ${monster.gold} 金币！`, "battle");

    // Special Boss defeated logic (M199 on Floor 6)
    if (monsterId === 'M199') {
      this.log("🎉 魔塔大魔王已被消灭！铁门已解锁！快去拯救公主！", "success");
      this.maps[5].grid[2][5] = 0; // Clear iron gate
      audio.playVictory();
    }

    // Step player into monster position
    this.player.r = r;
    this.player.c = c;
    this.render();
  }

  changeFloor(targetFloorIndex, direction) {
    if (targetFloorIndex < 0 || targetFloorIndex >= MAPS.length) return;

    this.isTransitioning = true;
    audio.playStair();
    this.fadeOverlayEl.classList.add('active');

    setTimeout(() => {
      this.player.currentFloor = targetFloorIndex;
      this.visitedFloors.add(targetFloorIndex);

      const targetMap = this.maps[targetFloorIndex];
      // Position player at default stair start location
      if (direction === 'up') {
        this.player.r = targetMap.playerStart.r;
        this.player.c = targetMap.playerStart.c;
      } else {
        // Find stair up position on the lower floor
        let stairUpPos = { r: 0, c: 5 };
        for (let r = 0; r < 11; r++) {
          for (let c = 0; c < 11; c++) {
            if (targetMap.grid[r][c] === 2) stairUpPos = { r, c };
          }
        }
        this.player.r = stairUpPos.r;
        this.player.c = stairUpPos.c;
      }

      this.render();
      this.log(`到达 ${targetMap.floorName}`, "info");

      setTimeout(() => {
        this.fadeOverlayEl.classList.remove('active');
        this.isTransitioning = false;
      }, 150);
    }, 250);
  }

  openMerchantShop() {
    audio.playShop();
    const modal = document.getElementById('shop-modal');
    modal.classList.add('active');

    const updateShopText = () => {
      document.getElementById('shop-gold-display').textContent = this.player.gold;
    };
    updateShopText();

    const buy = (cost, action) => {
      if (this.player.gold >= cost) {
        this.player.gold -= cost;
        action();
        audio.playItem();
        updateShopText();
        this.render();
      } else {
        audio.playWarning();
        this.toast("金币不足！", "warning");
      }
    };

    document.getElementById('buy-hp').onclick = () => buy(20, () => {
      this.player.hp += 200;
      this.log("在商店购买了 +200 生命值", "success");
    });
    document.getElementById('buy-atk').onclick = () => buy(20, () => {
      this.player.atk += 4;
      this.log("在商店购买了 +4 攻击力", "success");
    });
    document.getElementById('buy-def').onclick = () => buy(20, () => {
      this.player.def += 4;
      this.log("在商店购买了 +4 防御力", "success");
    });
    document.getElementById('buy-key').onclick = () => buy(20, () => {
      this.player.keys.yellow += 1;
      this.log("在商店购买了 +1 黄钥匙", "success");
    });
  }

  handleWiseOldMan() {
    audio.playDoor();
    if (!this.player.talkedOldMan) {
      this.player.talkedOldMan = true;
      this.player.keys.yellow += 2;
      this.player.keys.blue += 1;
      this.log("智者：勇敢的勇士！战斗是严密的数学计算，善用 [G] 图鉴！送你 1 蓝钥匙 2 黄钥匙！", "success");
      this.toast("智者赠送：黄钥匙 x2, 蓝钥匙 x1！");
    } else {
      this.toast("智者：祝你一路顺风，打败魔王！");
    }
    this.render();
  }

  handleVictory() {
    audio.playVictory();
    const modal = document.getElementById('victory-modal');
    modal.classList.add('active');
    document.getElementById('final-stats').innerHTML = `
      <p>恭喜通关！最终结算：</p>
      <p>❤️ 剩余生命：<b>${this.player.hp}</b></p>
      <p>⚔️ 攻击力：<b>${this.player.atk}</b> | 🛡️ 防御力：<b>${this.player.def}</b></p>
      <p>💰 剩余金币：<b>${this.player.gold}</b></p>
    `;
  }

  openMonsterManual() {
    if (!this.player.hasManual) {
      audio.playWarning();
      this.toast("尚未获得【魔物图鉴】！请先在第3层寻找图鉴书。", "warning");
      return;
    }

    audio.playDoor();
    const modal = document.getElementById('manual-modal');
    modal.classList.add('active');

    const container = document.getElementById('manual-monster-list');
    container.innerHTML = '';

    const curGrid = this.maps[this.player.currentFloor].grid;
    const monsterMap = new Map();

    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 11; c++) {
        const val = curGrid[r][c];
        if (typeof val === 'string' && MONSTERS[val]) {
          monsterMap.set(val, MONSTERS[val]);
        }
      }
    }

    if (monsterMap.size === 0) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">当前楼层没有怪物。</div>';
      return;
    }

    monsterMap.forEach((monster) => {
      const result = this.calcBattle(monster);
      const card = document.createElement('div');
      card.className = 'monster-card';

      let damageBadgeHtml = '';
      if (!result.canWin) {
        damageBadgeHtml = `<span class="monster-damage-badge impossible">${result.reason}</span>`;
      } else if (result.damage === 0) {
        damageBadgeHtml = `<span class="monster-damage-badge zero">无伤 0</span>`;
      } else if (result.damage < 200) {
        damageBadgeHtml = `<span class="monster-damage-badge normal">-${result.damage} HP</span>`;
      } else {
        damageBadgeHtml = `<span class="monster-damage-badge danger">-${result.damage} HP</span>`;
      }

      card.innerHTML = `
        <div class="monster-card-left">
          <div class="monster-icon">${monster.icon}</div>
          <div class="monster-stats">
            <div class="monster-name">${monster.name}</div>
            <div class="monster-substats">
              <span>❤️ ${monster.hp}</span>
              <span>⚔️ ${monster.atk}</span>
              <span>🛡️ ${monster.def}</span>
              <span>💰 ${monster.gold}</span>
            </div>
          </div>
        </div>
        <div>${damageBadgeHtml}</div>
      `;
      container.appendChild(card);
    });
  }

  openTeleporter() {
    if (!this.player.hasFlyer) {
      audio.playWarning();
      this.toast("尚未获得【楼层跳跃器】！请在第5层寻找道具。", "warning");
      return;
    }

    audio.playDoor();
    const modal = document.getElementById('teleport-modal');
    modal.classList.add('active');

    const grid = document.getElementById('teleport-grid');
    grid.innerHTML = '';

    MAPS.forEach((mapData, idx) => {
      const isVisited = this.visitedFloors.has(idx);
      const btn = document.createElement('button');
      btn.className = `btn ${idx === this.player.currentFloor ? 'btn-primary' : ''}`;
      btn.disabled = !isVisited;
      btn.textContent = `第 ${idx + 1} 层`;

      if (isVisited) {
        btn.onclick = () => {
          modal.classList.remove('active');
          this.changeFloor(idx, 'up');
        };
      }
      grid.appendChild(btn);
    });
  }

  triggerShakeAndFlash() {
    this.mapWrapperEl.classList.remove('shake-anim');
    void this.mapWrapperEl.offsetWidth; // Trigger reflow
    this.mapWrapperEl.classList.add('shake-anim');

    this.hitFlashEl.classList.remove('active');
    void this.hitFlashEl.offsetWidth;
    this.hitFlashEl.classList.add('active');
  }

  createFloatingText(r, c, text, typeClass) {
    const floatEl = document.createElement('div');
    floatEl.className = `floating-text ${typeClass}`;
    floatEl.textContent = text;

    // Calculate grid pixel location
    const topPx = r * 42 + 8;
    const leftPx = c * 42 + 5;
    floatEl.style.top = `${topPx}px`;
    floatEl.style.left = `${leftPx}px`;

    this.floatingContainerEl.appendChild(floatEl);

    setTimeout(() => {
      if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
    }, 800);
  }

  log(msg, type = "info") {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString().slice(0, 5)}] ${msg}`;
    this.actionLogEl.appendChild(entry);
    this.actionLogEl.scrollTop = this.actionLogEl.scrollHeight;
  }

  toast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    toastEl.textContent = msg;
    container.appendChild(toastEl);
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 2500);
  }

  saveGame() {
    const saveData = {
      player: this.player,
      visitedFloors: Array.from(this.visitedFloors),
      maps: this.maps
    };
    localStorage.setItem('magic_tower_save', JSON.stringify(saveData));
    audio.playItem();
    this.toast("游戏进度已保存！");
    this.log("存档成功。", "success");
  }

  loadGame() {
    const raw = localStorage.getItem('magic_tower_save');
    if (!raw) {
      audio.playWarning();
      this.toast("未发现任何存档记录！", "warning");
      return;
    }
    try {
      const data = JSON.parse(raw);
      this.player = data.player;
      this.visitedFloors = new Set(data.visitedFloors);
      this.maps = data.maps;

      audio.playDoor();
      this.render();
      this.toast("读档成功！");
      this.log("已恢复存档数据。", "success");
    } catch (e) {
      this.toast("读取存档数据出错", "warning");
    }
  }

  resetGame() {
    if (confirm("确定要重新开始游戏吗？进度将重置。")) {
      location.reload();
    }
  }

  render() {
    const curMap = this.maps[this.player.currentFloor];

    // Render Stats
    document.getElementById('val-floor').textContent = `F${this.player.currentFloor + 1}`;
    document.getElementById('val-hp').textContent = this.player.hp;
    document.getElementById('val-atk').textContent = this.player.atk;
    document.getElementById('val-def').textContent = this.player.def;
    document.getElementById('val-gold').textContent = this.player.gold;

    document.getElementById('key-yellow-count').textContent = this.player.keys.yellow;
    document.getElementById('key-blue-count').textContent = this.player.keys.blue;
    document.getElementById('key-red-count').textContent = this.player.keys.red;

    // Render Grid Tiles
    const tiles = this.mapGridEl.children;
    let idx = 0;

    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 11; c++) {
        const tile = tiles[idx++];
        tile.className = 'tile';
        tile.innerHTML = '';

        // Is Player here?
        if (r === this.player.r && c === this.player.c) {
          tile.classList.add('floor');
          tile.innerHTML = '🧙‍♂️';
          continue;
        }

        const cell = curMap.grid[r][c];

        if (cell === 0) {
          tile.classList.add('floor');
        } else if (cell === 1) {
          tile.classList.add('wall');
        } else if (cell === 2) {
          tile.classList.add('floor', 'stair');
          tile.innerHTML = '🆙';
        } else if (cell === 3) {
          tile.classList.add('floor', 'stair');
          tile.innerHTML = '🔽';
        } else if (cell === 10) {
          tile.classList.add('door-yellow');
          tile.innerHTML = '🚪';
        } else if (cell === 11) {
          tile.classList.add('door-blue');
          tile.innerHTML = '🚪';
        } else if (cell === 12) {
          tile.classList.add('door-red');
          tile.innerHTML = '🚪';
        } else if (cell === 13) {
          tile.classList.add('door-gate');
          tile.innerHTML = '🔒';
        } else if (ITEMS[cell]) {
          const item = ITEMS[cell];
          tile.classList.add('floor');
          tile.innerHTML = item.icon;
        } else if (typeof cell === 'string' && MONSTERS[cell]) {
          const monster = MONSTERS[cell];
          tile.classList.add('floor');
          tile.innerHTML = monster.icon;

          // Render damage preview badge if manual obtained or always subtle
          const battle = this.calcBattle(monster);
          const badge = document.createElement('div');
          badge.className = 'tile-damage-preview';

          if (!battle.canWin) {
            badge.classList.add('impossible');
            badge.textContent = battle.reason === '无法破防' ? '无防' : '危';
          } else if (battle.damage === 0) {
            badge.classList.add('zero');
            badge.textContent = '0';
          } else if (battle.damage < 200) {
            badge.classList.add('normal');
            badge.textContent = battle.damage;
          } else {
            badge.classList.add('danger');
            badge.textContent = battle.damage;
          }
          tile.appendChild(badge);

        } else if (cell === 90) {
          tile.classList.add('floor');
          tile.innerHTML = '👵';
        } else if (cell === 91) {
          tile.classList.add('floor');
          tile.innerHTML = '🧙‍♂️';
        } else if (cell === 92) {
          tile.classList.add('floor');
          tile.innerHTML = '👸';
        }
      }
    }
  }
}

// Instantiate game after DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new MagicTowerGame();
});
