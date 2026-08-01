import * as THREE from 'three';
import { parseLevel, isWall, isTarget, getBoxAt, LEVELS, getDeadlockSquares } from './levels.js';
import { createWhale, animateWhale } from './Whale.js';
import { createBox, createTargetMarker, createWall, createFloorTile } from './Box.js';

// ============================================
// 游戏状态枚举
// ============================================
export const GameState = {
  MENU: 'menu',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'levelComplete',
  PAUSED: 'paused'
};

// ============================================
// 游戏管理器
// ============================================
export class GameManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    this.state = GameState.MENU;
    this.currentLevel = 0;
    this.levelData = null;
    this.moves = 0;
    this.pushes = 0;
    
    // 游戏对象
    this.whale = null;
    this.boxes = [];
    this.walls = [];
    this.targets = [];
    this.floorTiles = [];
    this.gameGroup = new THREE.Group();
    this.gameGroup.name = 'gameGroup';
    scene.add(this.gameGroup);
    
    // 动画状态
    this.isAnimating = false;
    this.animationQueue = [];
    
    // 玩家位置 (网格坐标)
    this.playerGridPos = { x: 0, y: 0 };
    this.playerTargetPos = new THREE.Vector3();
    
    // 回调
    this.onStateChange = null;
    this.onMove = null;
    this.onLevelComplete = null;
    
    // 时间
    this.clock = new THREE.Clock();
  }
  
  // 加载关卡
  loadLevel(levelIndex) {
    this.clearLevel();
    
    this.currentLevel = levelIndex;
    this.levelData = parseLevel(levelIndex);
    this.moves = 0;
    this.pushes = 0;
    
    const { width, height, walls, targets, boxes, player } = this.levelData;
    
    // 计算偏移使关卡居中
    const offsetX = -width / 2;
    const offsetZ = -height / 2;
    
    // 创建地面
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const worldX = x + offsetX;
        const worldZ = y + offsetZ;
        
        // 检查是否是墙壁位置
        const isWallHere = walls.some(w => w.x === x && w.y === y);
        
        if (!isWallHere) {
          const tile = createFloorTile(false);
          tile.position.set(worldX, 0, worldZ);
          this.gameGroup.add(tile);
          this.floorTiles.push(tile);
        }
      }
    }
    
    // 创建墙壁
    walls.forEach(w => {
      const wall = createWall();
      wall.position.set(w.x + offsetX, 0, w.y + offsetZ);
      this.gameGroup.add(wall);
      this.walls.push(wall);
    });
    
    // 创建目标点
    targets.forEach(t => {
      const target = createTargetMarker();
      target.position.set(t.x + offsetX, 0.05, t.y + offsetZ);
      this.gameGroup.add(target);
      this.targets.push(target);
    });
    
    // 创建箱子
    boxes.forEach(b => {
      const box = createBox(b.onTarget);
      box.position.set(b.x + offsetX, 0.4, b.y + offsetZ);
      box.userData = { gridX: b.x, gridY: b.y, onTarget: b.onTarget };
      this.gameGroup.add(box);
      this.boxes.push(box);
    });
    
    // 创建鲸鱼玩家
    this.whale = createWhale();
    this.playerGridPos = { x: player.x, y: player.y };
    this.whale.position.set(player.x + offsetX, 0.3, player.y + offsetZ);
    this.whale.rotation.y = 0; // 鲸鱼模型默认面朝+X
    this.gameGroup.add(this.whale);
    
    // 调整相机
    this.adjustCamera(width, height);
    
    this.state = GameState.PLAYING;
    if (this.onStateChange) this.onStateChange(this.state);
  }
  
  // 调整相机适应关卡大小 (使关卡占视口55-65%)
  adjustCamera(width, height) {
    const maxSize = Math.max(width, height);
    // frustumSize=35, 可见高度=35/zoom, 目标: maxSize/(35/zoom)≈0.6
    const zoom = Math.min(4.5, Math.max(1.5, 21 / maxSize));
    
    if (this.camera.isOrthographicCamera) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    
    // 更俯视的角度，提升网格可读性
    const camDist = maxSize * 1.0;
    this.camera.position.set(camDist * 0.7, camDist * 1.4, camDist * 0.7);
    this.camera.lookAt(0, 0, 0);
  }
  
  // 清除当前关卡
  clearLevel() {
    while (this.gameGroup.children.length > 0) {
      const child = this.gameGroup.children[0];
      this.gameGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
    
    this.boxes = [];
    this.walls = [];
    this.targets = [];
    this.floorTiles = [];
    this.whale = null;
  }
  
  // 检查是否超出地图边界
  isOutOfBounds(x, y) {
    if (!this.levelData) return true;
    if (x < 0 || y < 0 || x >= this.levelData.width || y >= this.levelData.height) return true;
    // 检查该位置是否在地图字符串中是空格(外部)
    const row = this.levelData.rawMap[y];
    if (!row || x >= row.length) return true;
    // 空格且不在任何已定义元素中 = 外部
    const cell = row[x];
    if (cell === ' ' || cell === undefined) {
      // 检查是否是内部空格(可行走区域)
      // 通过检查是否被墙壁包围来判断
      return !this.isReachableFloor(x, y);
    }
    return false;
  }
  
  // 判断空格是否是可行走的地面
  isReachableFloor(x, y) {
    // 简单判断：如果周围有墙壁，则认为是内部地面
    const { walls } = this.levelData;
    const hasAdjacentWall = walls.some(w => 
      (Math.abs(w.x - x) <= 1 && Math.abs(w.y - y) <= 1)
    );
    return hasAdjacentWall;
  }
  
  // 移动玩家
  movePlayer(dx, dy) {
    if (this.state !== GameState.PLAYING || this.isAnimating) return false;
    
    const newX = this.playerGridPos.x + dx;
    const newY = this.playerGridPos.y + dy;
    
    // 检查边界
    if (this.isOutOfBounds(newX, newY)) return false;
    
    // 检查墙壁
    if (isWall(this.levelData, newX, newY)) return false;
    
    // 检查箱子
    const box = this.boxes.find(b => 
      b.userData.gridX === newX && b.userData.gridY === newY
    );
    
    if (box) {
      // 尝试推箱子
      const boxNewX = newX + dx;
      const boxNewY = newY + dy;
      
      // 检查箱子目标位置
      if (this.isOutOfBounds(boxNewX, boxNewY)) return false;
      if (isWall(this.levelData, boxNewX, boxNewY)) return false;
      
      const anotherBox = this.boxes.find(b => 
        b.userData.gridX === boxNewX && b.userData.gridY === boxNewY
      );
      if (anotherBox) return false;
      
      // 死锁检测: 检查箱子是否被推到死锁位置
      if (this.isDeadlockPosition(boxNewX, boxNewY)) {
        // 允许移动但标记为潜在死锁 (玩家可撤销)
        console.warn(`警告: 箱子被推到死锁位置 (${boxNewX}, ${boxNewY})`);
      }
      
      // 移动箱子
      this.pushes++;
      this.animateBox(box, boxNewX, boxNewY);
    }
    
    // 移动玩家
    this.moves++;
    this.playerGridPos = { x: newX, y: newY };
    this.animateWhaleMove(dx, dy);
    
    if (this.onMove) this.onMove(this.moves, this.pushes);
    
    // 检查胜利
    setTimeout(() => this.checkWin(), 300);
    
    return true;
  }
  
  // 鲸鱼移动动画
  animateWhaleMove(dx, dy) {
    if (!this.whale) return;
    
    const offsetX = -this.levelData.width / 2;
    const offsetZ = -this.levelData.height / 2;
    
    const targetX = this.playerGridPos.x + offsetX;
    const targetZ = this.playerGridPos.y + offsetZ;
    
    // 设置朝向 (鲸鱼模型默认面朝+X)
    if (dx > 0) this.whale.rotation.y = 0;                 // 面朝+X
    else if (dx < 0) this.whale.rotation.y = Math.PI;      // 面朝-X
    else if (dy > 0) this.whale.rotation.y = -Math.PI / 2; // 面朝+Z
    else if (dy < 0) this.whale.rotation.y = Math.PI / 2;  // 面朝-Z
    
    // 简单动画
    this.isAnimating = true;
    const startPos = this.whale.position.clone();
    const endPos = new THREE.Vector3(targetX, 0.3, targetZ);
    const duration = 150;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      
      this.whale.position.lerpVectors(startPos, endPos, eased);
      
      // 跳跃弧线
      this.whale.position.y = 0.3 + Math.sin(t * Math.PI) * 0.15;
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };
    animate();
  }
  
  // 箱子推动动画
  animateBox(box, newX, newY) {
    const offsetX = -this.levelData.width / 2;
    const offsetZ = -this.levelData.height / 2;
    
    const targetX = newX + offsetX;
    const targetZ = newY + offsetZ;
    
    box.userData.gridX = newX;
    box.userData.gridY = newY;
    
    // 检查是否在目标上
    const onTarget = isTarget(this.levelData, newX, newY);
    box.userData.onTarget = onTarget;
    
    // 更新箱子外观
    this.updateBoxAppearance(box, onTarget);
    
    // 动画
    const startPos = box.position.clone();
    const endPos = new THREE.Vector3(targetX, 0.4, targetZ);
    const duration = 150;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      
      box.position.lerpVectors(startPos, endPos, eased);
      
      // 滚动效果
      box.rotation.x += 0.1;
      
      if (t < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }
  
  // 更新箱子外观
  updateBoxAppearance(box, onTarget) {
    // 改变颜色
    box.traverse(child => {
      if (child.isMesh && child.material && child.material.color) {
        if (child.material.color.getHexString() === 'c49a6c' || 
            child.material.color.getHexString() === '7ab648') {
          child.material.color.set(onTarget ? '#7ab648' : '#c49a6c');
        }
      }
    });
  }
  
  // 检查胜利
  checkWin() {
    const allOnTarget = this.boxes.every(box => {
      return isTarget(this.levelData, box.userData.gridX, box.userData.gridY);
    });
    
    if (allOnTarget) {
      this.state = GameState.LEVEL_COMPLETE;
      if (this.onLevelComplete) {
        this.onLevelComplete(this.currentLevel, this.moves, this.pushes);
      }
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }
  
  // 重置关卡
  resetLevel() {
    this.loadLevel(this.currentLevel);
  }
  
  // 下一关
  nextLevel() {
    if (this.currentLevel < LEVELS.length - 1) {
      this.loadLevel(this.currentLevel + 1);
    }
  }
  
  // 更新循环
  update() {
    const time = this.clock.getElapsedTime();
    
    if (this.whale && this.state === GameState.PLAYING) {
      animateWhale(this.whale, time, this.isAnimating);
      
      // 指示环脉冲动画，提升玩家角色辨识度
      const ring = this.whale.getObjectByName('playerRing');
      if (ring) {
        const pulse = 1.0 + Math.sin(time * 4) * 0.12;
        ring.scale.setScalar(pulse);
        ring.material.opacity = 0.7 + Math.sin(time * 3) * 0.2;
      }
    }
  }
  
  // 获取当前关卡信息
  getLevelInfo() {
    return {
      index: this.currentLevel,
      name: this.levelData?.name || '',
      total: LEVELS.length,
      moves: this.moves,
      pushes: this.pushes
    };
  }
  
  // ============================================
  // 死锁检测
  // ============================================
  isDeadlockPosition(x, y) {
    // 如果箱子在目标上，不是死锁
    if (isTarget(this.levelData, x, y)) return false;
    
    const { walls, width, height } = this.levelData;
    
    const isWallAt = (wx, wy) => {
      if (wx < 0 || wy < 0 || wx >= width || wy >= height) return true;
      return walls.some(w => w.x === wx && w.y === wy);
    };
    
    // 角落死锁检测
    const wallUp = isWallAt(x, y - 1);
    const wallDown = isWallAt(x, y + 1);
    const wallLeft = isWallAt(x - 1, y);
    const wallRight = isWallAt(x + 1, y);
    
    if ((wallUp && wallLeft) || (wallUp && wallRight) ||
        (wallDown && wallLeft) || (wallDown && wallRight)) {
      return true;
    }
    
    // 墙边死锁检测 (简化版)
    // 如果箱子贴着墙，且这条墙线上没有目标，则是死锁
    if (wallUp || wallDown) {
      // 水平墙边
      let hasTargetOnLine = false;
      for (let tx = 0; tx < width; tx++) {
        if (!isWallAt(tx, y) && isTarget(this.levelData, tx, y)) {
          hasTargetOnLine = true;
          break;
        }
      }
      if (!hasTargetOnLine) return true;
    }
    
    if (wallLeft || wallRight) {
      // 垂直墙边
      let hasTargetOnLine = false;
      for (let ty = 0; ty < height; ty++) {
        if (!isWallAt(x, ty) && isTarget(this.levelData, x, ty)) {
          hasTargetOnLine = true;
          break;
        }
      }
      if (!hasTargetOnLine) return true;
    }
    
    return false;
  }
}
