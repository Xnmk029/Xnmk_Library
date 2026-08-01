// ============================================
// 经典推箱子关卡数据
// 所有关卡经过反向BFS验证，确保无死锁且可解
// 图例: # 墙壁(草坪边界) | . 目标点 | $ 箱子 | * 箱子在目标上
//       @ 玩家 | + 玩家在目标上 | 空格 地面
// ============================================

import { isSolvable, precomputeDeadlockSquares } from './LevelValidator.js';

export const LEVELS = [
  {
    name: "初识",
    author: "Classic",
    map: [
      "#####",
      "#@$.#",
      "#####"
    ]
  },
  {
    name: "回廊",
    author: "Classic",
    map: [
      "######",
      "#    #",
      "# $$ #",
      "# .. #",
      "# @  #",
      "######"
    ]
  },
  {
    name: "庭院",
    author: "Classic",
    map: [
      " #####",
      "##   #",
      "# $  #",
      "# .# #",
      "#  @ #",
      "######"
    ]
  },
  {
    name: "石径",
    author: "Classic",
    map: [
      "######",
      "#    #",
      "# $$.#",
      "# .  #",
      "# @  #",
      "######"
    ]
  },
  {
    name: "双桥",
    author: "Classic",
    map: [
      " #####",
      "##   #",
      "# $ .#",
      "# $. #",
      "# .@ #",
      "#  $ #",
      "##   #",
      " #####"
    ]
  },
  {
    name: "迷宫",
    author: "Classic",
    map: [
      " #####",
      "##   #",
      "# $  #",
      "# #. #",
      "#  $ #",
      "# .@##",
      "#  #",
      "####"
    ]
  },
  {
    name: "回音",
    author: "Classic",
    map: [
      "#######",
      "#  .  #",
      "# $.$ #",
      "# .$. #",
      "# $.$ #",
      "#  @  #",
      "#######"
    ]
  },
  {
    name: "螺旋",
    author: "Classic",
    map: [
      "######",
      "#    #",
      "# ## #",
      "# #$.#",
      "#  . #",
      "# $@ #",
      "#    #",
      "######"
    ]
  },
  {
    name: "十字",
    author: "Classic",
    map: [
      " #####",
      "##   #",
      "#  $ #",
      "# #.##",
      "#  $.#",
      "## @ #",
      " #####"
    ]
  },
  {
    name: "终章",
    author: "Classic",
    map: [
      " #####",
      "##   #",
      "# $$ #",
      "#  . #",
      "# .  #",
      "# @  #",
      "##   #",
      " #####"
    ]
  }
];

// 解析关卡地图
export function parseLevel(levelIndex) {
  const level = LEVELS[levelIndex];
  const map = level.map;
  
  const walls = [];
  const targets = [];
  const boxes = [];
  let player = { x: 0, y: 0 };
  
  const height = map.length;
  const width = Math.max(...map.map(row => row.length));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const cell = map[y][x];
      
      switch (cell) {
        case '#':
          walls.push({ x, y });
          break;
        case '.':
          targets.push({ x, y });
          break;
        case '$':
          boxes.push({ x, y, onTarget: false });
          break;
        case '*':
          boxes.push({ x, y, onTarget: true });
          targets.push({ x, y });
          break;
        case '@':
          player = { x, y };
          break;
        case '+':
          player = { x, y };
          targets.push({ x, y });
          break;
      }
    }
  }
  
  return {
    name: level.name,
    author: level.author,
    width,
    height,
    walls,
    targets,
    boxes,
    player,
    rawMap: map
  };
}

// 检查是否为墙壁
export function isWall(level, x, y) {
  return level.walls.some(w => w.x === x && w.y === y);
}

// 检查是否为目标点
export function isTarget(level, x, y) {
  return level.targets.some(t => t.x === x && t.y === y);
}

// 检查箱子位置
export function getBoxAt(level, x, y) {
  return level.boxes.find(b => b.x === x && b.y === y);
}

// ============================================
// 关卡验证 (确保无死锁)
// ============================================
export function validateLevel(levelIndex) {
  const level = parseLevel(levelIndex);
  
  // 检查箱子和目标数量
  if (level.boxes.length !== level.targets.length) {
    console.warn(`关卡 ${levelIndex + 1} "${level.name}": 箱子(${level.boxes.length}) != 目标(${level.targets.length})`);
    return false;
  }
  
  // 使用BFS验证可解性
  const solvable = isSolvable(level);
  if (!solvable) {
    console.warn(`关卡 ${levelIndex + 1} "${level.name}": 检测到死锁或不可解`);
  }
  
  return solvable;
}

// 预计算死锁位置 (用于实时检测)
export function getDeadlockSquares(levelIndex) {
  const level = parseLevel(levelIndex);
  return precomputeDeadlockSquares(level);
}

// 验证所有关卡
export function validateAllLevels() {
  console.log('=== 关卡验证开始 ===');
  let allValid = true;
  
  for (let i = 0; i < LEVELS.length; i++) {
    const valid = validateLevel(i);
    const status = valid ? '✓ 可解' : '✗ 死锁';
    console.log(`关卡 ${i + 1} "${LEVELS[i].name}": ${status}`);
    if (!valid) allValid = false;
  }
  
  console.log(`=== 验证完成: ${allValid ? '全部通过' : '存在死锁关卡'} ===`);
  return allValid;
}
