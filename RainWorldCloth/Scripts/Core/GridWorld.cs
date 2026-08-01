using UnityEngine;

/// <summary>
/// 网格世界 —— 基于二维布尔数组的静态地形系统。
/// 
/// 【设计思路】
/// 不使用 Unity 的 Tilemap/Collider2D，而是用最原始的 bool[,] 数组
/// 描述地形。每个格子要么是实心（solid），要么是空气（empty）。
/// 碰撞检测通过"圆 vs AABB"算法实现：
///   将每个 PhysicsNode 视为一个圆，将每个实心格子视为一个 AABB，
///   求圆心到 AABB 的最近点，若距离 < 半径则发生碰撞。
/// 
/// 坐标系约定：
///   格子 (cx, cy) 占据世界空间 [cx*cellSize, (cx+1)*cellSize] × [cy*cellSize, (cy+1)*cellSize]
///   即格子 (0,0) 的左下角在世界原点。
/// </summary>
public class GridWorld
{
    /// <summary>地形数据：true = 实心阻挡，false = 可通行空气</summary>
    public bool[,] solidMap;

    /// <summary>每个格子的世界尺寸（正方形边长）</summary>
    public float cellSize;

    /// <summary>地图宽度（格子数）</summary>
    public int Width => solidMap.GetLength(0);

    /// <summary>地图高度（格子数）</summary>
    public int Height => solidMap.GetLength(1);

    // ═══════════════════════════════════════════
    //  构造
    // ═══════════════════════════════════════════

    public GridWorld(int width, int height, float cellSize = 1f)
    {
        this.solidMap = new bool[width, height];
        this.cellSize = cellSize;
    }

    // ═══════════════════════════════════════════
    //  查询接口
    // ═══════════════════════════════════════════

    /// <summary>
    /// 查询格子 (cx, cy) 是否为实心。
    /// 越界坐标视为实心（防止生物走出地图边界）。
    /// </summary>
    public bool IsSolid(int cx, int cy)
    {
        if (cx < 0 || cx >= Width || cy < 0 || cy >= Height)
            return true; // 边界外视为墙壁
        return solidMap[cx, cy];
    }

    /// <summary>
    /// 查询世界坐标 (wx, wy) 处的格子是否为实心。
    /// </summary>
    public bool IsSolidAtWorld(float wx, float wy)
    {
        int cx = Mathf.FloorToInt(wx / cellSize);
        int cy = Mathf.FloorToInt(wy / cellSize);
        return IsSolid(cx, cy);
    }

    /// <summary>
    /// 世界坐标 → 格子坐标
    /// </summary>
    public Vector2Int WorldToGrid(Vector2 worldPos)
    {
        return new Vector2Int(
            Mathf.FloorToInt(worldPos.x / cellSize),
            Mathf.FloorToInt(worldPos.y / cellSize)
        );
    }

    /// <summary>
    /// 格子坐标 → 该格子中心的世界坐标
    /// </summary>
    public Vector2 GridToWorldCenter(int cx, int cy)
    {
        return new Vector2(
            (cx + 0.5f) * cellSize,
            (cy + 0.5f) * cellSize
        );
    }

    // ═══════════════════════════════════════════
    //  碰撞解析（核心）
    // ═══════════════════════════════════════════

    /// <summary>
    /// 对单个节点执行圆-AABB碰撞检测与解析。
    /// 
    /// 算法流程：
    ///   1. 根据节点位置和半径，确定需要检查的格子范围（3×3 邻域通常足够）
    ///   2. 对每个实心格子，计算圆心到该格子 AABB 的最近点
    ///   3. 若 距离 < 半径，则发生穿透：
    ///      a. 计算穿透深度和碰撞法线
    ///      b. 沿法线推出节点（位置修正）
    ///      c. 分解速度为法向/切向分量，对切向施加摩擦衰减
    /// </summary>
    /// <param name="node">待检测的物理节点</param>
    /// <returns>是否发生了碰撞</returns>
    public bool ResolveNodeCollision(VerletNode node)
    {
        if (!node.collidesWithWorld || node.radius <= 0f)
            return false;

        bool anyCollision = false;
        float r = node.radius;
        Vector2 pos = node.position;

        // 1. 确定需要检查的格子范围
        //    以节点位置为中心，向外扩展一个半径的距离
        int minCX = Mathf.FloorToInt((pos.x - r) / cellSize);
        int maxCX = Mathf.FloorToInt((pos.x + r) / cellSize);
        int minCY = Mathf.FloorToInt((pos.y - r) / cellSize);
        int maxCY = Mathf.FloorToInt((pos.y + r) / cellSize);

        for (int cx = minCX; cx <= maxCX; cx++)
        {
            for (int cy = minCY; cy <= maxCY; cy++)
            {
                if (!IsSolid(cx, cy)) continue;

                // 2. 计算该格子的 AABB 边界
                float left   = cx * cellSize;
                float bottom = cy * cellSize;
                float right  = left + cellSize;
                float top    = bottom + cellSize;

                // 3. 求圆心到 AABB 的最近点
                //    将圆心坐标钳制到 AABB 范围内即得最近点
                float closestX = Mathf.Clamp(pos.x, left, right);
                float closestY = Mathf.Clamp(pos.y, bottom, top);

                float dx = pos.x - closestX;
                float dy = pos.y - closestY;
                float distSq = dx * dx + dy * dy;

                // 4. 距离 >= 半径 → 无碰撞，跳过
                if (distSq >= r * r) continue;

                // ═══ 发生碰撞 ═══
                anyCollision = true;
                float dist = Mathf.Sqrt(distSq);

                Vector2 normal;
                float penetration;

                if (dist < 0.0001f)
                {
                    // 特殊情况：圆心在 AABB 内部（完全穿透）
                    // 此时无法用"最近点"求法线，改为找最近的边推出
                    float dLeft   = pos.x - left;
                    float dRight  = right - pos.x;
                    float dBottom = pos.y - bottom;
                    float dTop    = top - pos.y;
                    float minD    = Mathf.Min(dLeft, dRight, dBottom, dTop);

                    // 沿最短距离方向推出，穿透深度 = 到边距离 + 半径
                    if (minD == dLeft)        { normal = Vector2.left;  penetration = dLeft + r; }
                    else if (minD == dRight)  { normal = Vector2.right; penetration = dRight + r; }
                    else if (minD == dBottom) { normal = Vector2.down;  penetration = dBottom + r; }
                    else                      { normal = Vector2.up;    penetration = dTop + r; }
                }
                else
                {
                    // 正常情况：圆心在 AABB 外部
                    // 法线 = 从最近点指向圆心的归一化方向
                    normal = new Vector2(dx, dy) / dist;
                    penetration = r - dist;
                }

                // 5. 位置修正：沿法线推出穿透深度
                node.position += normal * penetration;

                // 6. 速度修正（摩擦模型）
                //    将速度分解为法向分量（垂直于表面）和切向分量（平行于表面）
                //    法向分量：完全吸收（不弹跳，restitution = 0）
                //    切向分量：乘以 (1 - friction) 衰减
                Vector2 velocity = node.position - node.oldPosition;
                float vn = Vector2.Dot(velocity, normal);

                // 只在节点"撞向"表面时处理（vn < 0 表示速度方向与法线相反）
                if (vn < 0f)
                {
                    Vector2 normalVelocity  = normal * vn;           // 法向速度分量
                    Vector2 tangentVelocity = velocity - normalVelocity; // 切向速度分量

                    // 移除法向速度（不弹跳），衰减切向速度（摩擦）
                    node.oldPosition = node.position - tangentVelocity * (1f - node.friction);
                }

                // 7. 更新触地状态
                //    法线 Y 分量 > 0.5 表示表面大致朝上 → 判定为"地面"
                if (normal.y > 0.5f)
                {
                    node.isGrounded = true;
                    node.groundNormal = normal;
                }
            }
        }

        return anyCollision;
    }

    // ═══════════════════════════════════════════
    //  射线查询（用于 IK 腿部寻找落脚点）
    // ═══════════════════════════════════════════

    /// <summary>
    /// 从 origin 沿 direction 步进式射线检测，返回第一个实心格子的表面命中点。
    /// 非物理射线，仅用于 IK 落脚点探测，精度足够且零开销。
    /// </summary>
    /// <param name="origin">射线起点（世界坐标）</param>
    /// <param name="direction">射线方向（需归一化）</param>
    /// <param name="maxDistance">最大检测距离</param>
    /// <param name="hitPoint">命中点（输出）</param>
    /// <param name="hitNormal">命中表面法线（输出）</param>
    /// <returns>是否命中实心格子</returns>
    public bool Raycast(Vector2 origin, Vector2 direction, float maxDistance,
                        out Vector2 hitPoint, out Vector2 hitNormal)
    {
        hitPoint = origin;
        hitNormal = Vector2.up;

        float step = cellSize * 0.25f; // 步进精度：1/4 格子
        int maxSteps = Mathf.CeilToInt(maxDistance / step);
        Vector2 prev = origin;

        for (int i = 1; i <= maxSteps; i++)
        {
            Vector2 current = origin + direction * (step * i);
            Vector2Int cell = WorldToGrid(current);

            if (IsSolid(cell.x, cell.y))
            {
                // 命中！用前一步的位置作为命中点（在实心格子表面外侧）
                hitPoint = prev;

                // 估算表面法线：从命中格子中心指向命中点的方向
                Vector2 cellCenter = GridToWorldCenter(cell.x, cell.y);
                Vector2 toHit = hitPoint - cellCenter;

                // 取主方向作为法线（网格表面法线必为四个基本方向之一）
                if (Mathf.Abs(toHit.x) > Mathf.Abs(toHit.y))
                    hitNormal = new Vector2(Mathf.Sign(toHit.x), 0f);
                else
                    hitNormal = new Vector2(0f, Mathf.Sign(toHit.y));

                return true;
            }

            prev = current;
        }

        return false;
    }

    // ═══════════════════════════════════════════
    //  地图编辑工具
    // ═══════════════════════════════════════════

    /// <summary>设置单个格子</summary>
    public void SetCell(int cx, int cy, bool solid)
    {
        if (cx >= 0 && cx < Width && cy >= 0 && cy < Height)
            solidMap[cx, cy] = solid;
    }

    /// <summary>填充矩形区域</summary>
    public void FillRect(int x0, int y0, int x1, int y1, bool solid)
    {
        for (int x = Mathf.Max(0, x0); x <= Mathf.Min(Width - 1, x1); x++)
            for (int y = Mathf.Max(0, y0); y <= Mathf.Min(Height - 1, y1); y++)
                solidMap[x, y] = solid;
    }

    /// <summary>
    /// 生成一个用于测试的关卡：
    /// 底部实心地面 + 左右墙壁 + 若干平台 + 一个凹坑
    /// </summary>
    public static GridWorld CreateTestLevel(int width = 60, int height = 30, float cellSize = 1f)
    {
        GridWorld world = new GridWorld(width, height, cellSize);

        // 底部地面（3格厚）
        world.FillRect(0, 0, width - 1, 2, true);

        // 左右墙壁
        world.FillRect(0, 0, 1, height - 1, true);
        world.FillRect(width - 2, 0, width - 1, height - 1, true);

        // 中间平台（不同高度，测试跳跃）
        world.FillRect(10, 8, 18, 8, true);   // 低平台
        world.FillRect(22, 12, 30, 12, true);  // 中平台
        world.FillRect(35, 16, 42, 16, true);  // 高平台
        world.FillRect(15, 20, 22, 20, true);  // 最高平台

        // 凹坑（挖掉底部地面，测试掉落）
        world.FillRect(26, 0, 30, 2, false);

        // 凹坑底部（防止掉出地图）
        world.FillRect(25, -1, 31, -1, true); // 越界格子自动视为实心，此行仅为示意

        // 一些柱子（测试绕行）
        world.FillRect(45, 3, 46, 10, true);
        world.FillRect(50, 3, 51, 14, true);

        return world;
    }
}
