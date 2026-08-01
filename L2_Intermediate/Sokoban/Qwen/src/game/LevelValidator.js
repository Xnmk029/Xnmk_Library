// ============================================
// 推箱子关卡验证器
// 使用反向BFS + PDB启发式检测死锁
// 确保所有关卡可解
// ============================================

// 方向: 上右下左
const DIRS = [
  { dx: 0, dy: -1 }, // 上
  { dx: 1, dy: 0 },  // 右
  { dx: 0, dy: 1 },  // 下
  { dx: -1, dy: 0 }, // 左
];

// ============================================
// 关卡状态编码 (用于哈希)
// ============================================
function encodeState(playerPos, boxes) {
  const sortedBoxes = [...boxes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
  return `${playerPos.x},${playerPos.y}|${sortedBoxes.map(b => `${b.x},${b.y}`).join(';')}`;
}

// ============================================
// 简单死锁检测
// ============================================

// 检测角落死锁: 箱子在非目标角落
function isCornerDeadlock(x, y, walls, targets, width, height) {
  // 如果箱子在目标上，不是死锁
  if (targets.some(t => t.x === x && t.y === y)) return false;
  
  const isWall = (wx, wy) => {
    if (wx < 0 || wy < 0 || wx >= width || wy >= height) return true;
    return walls.some(w => w.x === wx && w.y === wy);
  };
  
  // 检查四个角落
  const wallUp = isWall(x, y - 1);
  const wallDown = isWall(x, y + 1);
  const wallLeft = isWall(x - 1, y);
  const wallRight = isWall(x + 1, y);
  
  // 角落死锁
  if ((wallUp && wallLeft) || (wallUp && wallRight) ||
      (wallDown && wallLeft) || (wallDown && wallRight)) {
    return true;
  }
  
  return false;
}

// 检测墙边死锁: 箱子沿墙排列但墙上无目标
function isWallLineDeadlock(x, y, walls, targets, width, height) {
  if (targets.some(t => t.x === x && t.y === y)) return false;
  
  const isWall = (wx, wy) => {
    if (wx < 0 || wy < 0 || wx >= width || wy >= height) return true;
    return walls.some(w => w.x === wx && w.y === wy);
  };
  
  const hasTargetOnLine = (startX, startY, dx, dy) => {
    let cx = startX, cy = startY;
    while (!isWall(cx, cy)) {
      if (targets.some(t => t.x === cx && t.y === cy)) return true;
      cx += dx;
      cy += dy;
    }
    return false;
  };
  
  // 水平墙边
  if (isWall(x, y - 1) || isWall(x, y + 1)) {
    if (!hasTargetOnLine(x, y, -1, 0) && !hasTargetOnLine(x, y, 1, 0)) {
      return true;
    }
  }
  
  // 垂直墙边
  if (isWall(x - 1, y) || isWall(x + 1, y)) {
    if (!hasTargetOnLine(x, y, 0, -1) && !hasTargetOnLine(x, y, 0, 1)) {
      return true;
    }
  }
  
  return false;
}

// ============================================
// 正向BFS求解器 (验证可解性)
// ============================================
export function isSolvable(levelData) {
  const { walls, targets, boxes, player, width, height } = levelData;
  
  const isWall = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    return walls.some(w => w.x === x && w.y === y);
  };
  
  const isTarget = (x, y) => targets.some(t => t.x === x && t.y === y);
  
  // 检查初始状态是否有简单死锁
  for (const box of boxes) {
    if (isCornerDeadlock(box.x, box.y, walls, targets, width, height)) {
      return false;
    }
  }
  
  // BFS搜索
  const visited = new Set();
  const queue = [];
  
  const initialState = encodeState(player, boxes.map(b => ({ x: b.x, y: b.y })));
  visited.add(initialState);
  queue.push({ player: { ...player }, boxes: boxes.map(b => ({ x: b.x, y: b.y })) });
  
  const maxIterations = 500000; // 防止无限循环
  let iterations = 0;
  
  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const state = queue.shift();
    
    // 检查是否胜利
    const allOnTarget = state.boxes.every(b => isTarget(b.x, b.y));
    if (allOnTarget) return true;
    
    // 尝试四个方向
    for (const dir of DIRS) {
      const newPlayerX = state.player.x + dir.dx;
      const newPlayerY = state.player.y + dir.dy;
      
      // 检查玩家移动是否有效
      if (isWall(newPlayerX, newPlayerY)) continue;
      
      const boxIndex = state.boxes.findIndex(b => b.x === newPlayerX && b.y === newPlayerY);
      
      let newBoxes = state.boxes.map(b => ({ ...b }));
      
      if (boxIndex !== -1) {
        // 推箱子
        const newBoxX = newPlayerX + dir.dx;
        const newBoxY = newPlayerY + dir.dy;
        
        // 检查箱子目标位置
        if (isWall(newBoxX, newBoxY)) continue;
        if (state.boxes.some(b => b.x === newBoxX && b.y === newBoxY)) continue;
        
        // 检查死锁
        if (isCornerDeadlock(newBoxX, newBoxY, walls, targets, width, height)) continue;
        
        newBoxes[boxIndex] = { x: newBoxX, y: newBoxY };
      }
      
      const newState = encodeState({ x: newPlayerX, y: newPlayerY }, newBoxes);
      
      if (!visited.has(newState)) {
        visited.add(newState);
        queue.push({ player: { x: newPlayerX, y: newPlayerY }, boxes: newBoxes });
      }
    }
  }
  
  return false;
}

// ============================================
// 反向BFS + PDB启发式 (从目标状态反向搜索)
// ============================================
export function computePDBHeuristic(levelData) {
  const { walls, targets, width, height } = levelData;
  
  const isWall = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true;
    return walls.some(w => w.x === x && w.y === w.y);
  };
  
  // 为每个目标点计算BFS距离图
  const distanceMaps = [];
  
  for (const target of targets) {
    const dist = new Map();
    const queue = [{ x: target.x, y: target.y, d: 0 }];
    dist.set(`${target.x},${target.y}`, 0);
    
    while (queue.length > 0) {
      const { x, y, d } = queue.shift();
      
      for (const dir of DIRS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        const key = `${nx},${ny}`;
        
        if (isWall(nx, ny) || dist.has(key)) continue;
        
        dist.set(key, d + 1);
        queue.push({ x: nx, y: ny, d: d + 1 });
      }
    }
    
    distanceMaps.push(dist);
  }
  
  // PDB启发式: 每个箱子到最近目标的最小距离之和
  return function heuristic(boxes) {
    let total = 0;
    for (const box of boxes) {
      let minDist = Infinity;
      for (const distMap of distanceMaps) {
        const d = distMap.get(`${box.x},${box.y}`);
        if (d !== undefined && d < minDist) {
          minDist = d;
        }
      }
      if (minDist === Infinity) return Infinity; // 不可达
      total += minDist;
    }
    return total;
  };
}

// ============================================
// 验证所有关卡
// ============================================
export function validateAllLevels(LEVELS, parseLevel) {
  const results = [];
  
  for (let i = 0; i < LEVELS.length; i++) {
    const levelData = parseLevel(i);
    
    // 检查箱子和目标数量
    if (levelData.boxes.length !== levelData.targets.length) {
      results.push({
        level: i + 1,
        name: levelData.name,
        valid: false,
        reason: `箱子(${levelData.boxes.length}) != 目标(${levelData.targets.length})`
      });
      continue;
    }
    
    // 检查可解性
    const solvable = isSolvable(levelData);
    
    results.push({
      level: i + 1,
      name: levelData.name,
      valid: solvable,
      reason: solvable ? '可解' : '死锁/不可解'
    });
  }
  
  return results;
}

// ============================================
// 死锁位置预计算 (用于实时检测)
// ============================================
export function precomputeDeadlockSquares(levelData) {
  const { walls, targets, width, height } = levelData;
  const deadlockSquares = new Set();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 跳过墙壁
      if (walls.some(w => w.x === x && w.y === y)) continue;
      
      // 跳过目标
      if (targets.some(t => t.x === x && t.y === y)) continue;
      
      // 检查角落死锁
      if (isCornerDeadlock(x, y, walls, targets, width, height)) {
        deadlockSquares.add(`${x},${y}`);
        continue;
      }
      
      // 检查墙边死锁
      if (isWallLineDeadlock(x, y, walls, targets, width, height)) {
        deadlockSquares.add(`${x},${y}`);
      }
    }
  }
  
  return deadlockSquares;
}
