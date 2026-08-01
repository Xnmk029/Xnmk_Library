using UnityEngine;

/// <summary>
/// 两骨骼逆向运动学腿部 —— 程序化步态的核心组件。
/// 
/// 【设计思路】
/// 每条腿由三段组成：髋关节（附着在躯干节点上）→ 膝关节 → 脚掌。
/// 脚掌的目标位置通过射线检测地面获得，当躯干移动导致脚掌偏离
/// "理想落脚点"超过阈值时，触发一次"迈步"动画，将脚掌平滑地
/// 移动到新的落脚点。
/// 
/// 【两骨骼 IK 数学原理】
/// 已知：髋关节位置 A，脚掌目标位置 B，上腿长度 L1，下腿长度 L2
/// 求：膝关节位置 K
/// 
/// 解法（余弦定理）：
///   d = |B - A|                           // 髋到脚的距离
///   d = clamp(d, |L1-L2|+ε, L1+L2-ε)    // 钳制到可达范围
///   
///   cos(α) = (L1² + d² - L2²) / (2·L1·d)  // 余弦定理求髋关节处夹角 α
///   α = acos(cos(α))
///   
///   将 (B-A) 方向旋转 ±α 得到上腿方向，
///   K = A + 上腿方向 × L1
/// 
/// 旋转方向由 poleDirection（极向量）决定，控制膝盖朝哪个方向弯曲。
/// </summary>
[System.Serializable]
public class IKLeg
{
    // ═══════════════════════════════════════════
    //  配置参数
    // ═══════════════════════════════════════════

    /// <summary>上腿（髋→膝）长度</summary>
    public float upperLegLength = 0.6f;

    /// <summary>下腿（膝→脚）长度</summary>
    public float lowerLegLength = 0.6f;

    /// <summary>
    /// 迈步触发阈值：当脚掌当前位置与理想落脚点的距离超过此值时，触发迈步。
    /// 值越小 → 步频越高（小碎步），值越大 → 步频越低（大步）
    /// </summary>
    public float stepThreshold = 0.8f;

    /// <summary>迈步动画持续时间（秒）</summary>
    public float stepDuration = 0.12f;

    /// <summary>迈步时脚掌抬起的高度（世界单位）</summary>
    public float stepHeight = 0.3f;

    /// <summary>
    /// 膝盖弯曲方向（极向量）。
    /// 对于侧视图的腿，通常设为朝前 (1,0) 或朝后 (-1,0)。
    /// </summary>
    public Vector2 poleDirection = Vector2.right;

    /// <summary>脚掌在躯干正下方的偏移量（用于调整站姿宽度）</summary>
    public Vector2 footOffset = Vector2.zero;

    // ═══════════════════════════════════════════
    //  运行时状态
    // ═══════════════════════════════════════════

    /// <summary>当前脚掌世界位置（IK 求解的终点）</summary>
    public Vector2 footPosition { get; private set; }

    /// <summary>当前膝关节世界位置（IK 求解的中间点）</summary>
    public Vector2 kneePosition { get; private set; }

    /// <summary>上一次落脚的目标位置</summary>
    private Vector2 lastFootTarget;

    /// <summary>迈步动画的起始脚掌位置</summary>
    private Vector2 stepStartPos;

    /// <summary>迈步动画的目标脚掌位置</summary>
    private Vector2 stepEndPos;

    /// <summary>迈步动画计时器 [0, stepDuration]</summary>
    private float stepTimer = -1f; // -1 表示未在迈步

    /// <summary>是否正在迈步</summary>
    public bool IsStepping => stepTimer >= 0f;

    /// <summary>该腿是否已初始化（第一次需要特殊处理）</summary>
    private bool initialized = false;

    // ═══════════════════════════════════════════
    //  主更新（每帧由 CreatureController 调用）
    // ═══════════════════════════════════════════

    /// <summary>
    /// 更新腿部 IK。
    /// </summary>
    /// <param name="hipPos">髋关节世界位置（来自躯干节点）</param>
    /// <param name="bodyVelocity">躯干速度（用于预测落脚点）</param>
    /// <param name="grid">网格世界（射线检测用）</param>
    /// <param name="dt">时间步长</param>
    /// <param name="facing">朝向：+1 = 右，-1 = 左</param>
    public void UpdateLeg(Vector2 hipPos, Vector2 bodyVelocity, GridWorld grid, float dt, float facing)
    {
        // 1. 计算"理想落脚点"：髋关节正下方 + 速度预测 + 偏移
        //    速度预测让脚落在身体前方，产生自然的步态前倾
        Vector2 idealFootPos = hipPos
            + Vector2.down * (upperLegLength + lowerLegLength) * 0.85f // 略小于腿全长，保持微屈
            + bodyVelocity * 0.15f                                      // 速度预测
            + new Vector2(footOffset.x * facing, footOffset.y);         // 站姿偏移

        // 2. 射线检测地面：从理想落脚点上方往下打射线，找到实际地面
        Vector2 rayOrigin = idealFootPos + Vector2.up * 2f;
        Vector2 hitPoint;
        Vector2 hitNormal;

        Vector2 groundFootPos;
        if (grid != null && grid.Raycast(rayOrigin, Vector2.down, 4f, out hitPoint, out hitNormal))
        {
            // 命中地面：脚掌放在命中点上方一小段距离（避免穿地）
            groundFootPos = hitPoint + hitNormal * 0.05f;
        }
        else
        {
            // 未命中（悬空）：脚掌收回到腿自然下垂位置
            groundFootPos = hipPos + Vector2.down * (upperLegLength + lowerLegLength) * 0.7f;
        }

        // 3. 初始化：第一次直接放置脚掌，不播放迈步动画
        if (!initialized)
        {
            footPosition = groundFootPos;
            lastFootTarget = groundFootPos;
            initialized = true;
        }

        // 4. 迈步判定：脚掌偏离理想位置超过阈值 且 当前未在迈步
        float distToIdeal = Vector2.Distance(footPosition, groundFootPos);
        if (!IsStepping && distToIdeal > stepThreshold)
        {
            // 触发迈步
            stepStartPos = footPosition;
            // 目标点 = 理想落脚点 + 少量速度预测（让脚落得更远一点）
            stepEndPos = groundFootPos + bodyVelocity * 0.08f;
            stepTimer = 0f;
        }

        // 5. 迈步动画：沿抛物线插值脚掌位置
        if (IsStepping)
        {
            stepTimer += dt;
            float t = Mathf.Clamp01(stepTimer / stepDuration);

            // 水平方向：线性插值
            Vector2 horizontalPos = Vector2.Lerp(stepStartPos, stepEndPos, t);

            // 垂直方向：抛物线抬脚（sin 曲线，t=0.5 时最高）
            float lift = Mathf.Sin(t * Mathf.PI) * stepHeight;

            footPosition = horizontalPos + Vector2.up * lift;

            // 迈步完成
            if (t >= 1f)
            {
                stepTimer = -1f;
                footPosition = stepEndPos;
                lastFootTarget = stepEndPos;
            }
        }

        // 6. 求解两骨骼 IK：根据髋关节和脚掌位置计算膝关节
        SolveTwoBoneIK(hipPos, footPosition, facing);
    }

    // ═══════════════════════════════════════════
    //  两骨骼 IK 求解器
    // ═══════════════════════════════════════════

    /// <summary>
    /// 两骨骼 IK 核心算法。
    /// 
    /// 已知：A（髋关节），B（脚掌），L1（上腿），L2（下腿）
    /// 求：K（膝关节）
    /// 
    /// 步骤：
    ///   1. 计算 A→B 距离 d，钳制到 [|L1-L2|, L1+L2] 可达范围
    ///   2. 余弦定理求髋关节处夹角 α：cos(α) = (L1²+d²-L2²) / (2·L1·d)
    ///   3. 将 A→B 方向旋转 α 得到上腿方向
    ///   4. K = A + 上腿方向 × L1
    /// </summary>
    private void SolveTwoBoneIK(Vector2 hipPos, Vector2 footPos, float facing)
    {
        Vector2 toFoot = footPos - hipPos;
        float d = toFoot.magnitude;

        // 可达范围钳制：
        //   最小距离 = |L1 - L2| + ε（两腿几乎折叠）
        //   最大距离 = L1 + L2 - ε（两腿几乎伸直）
        float minReach = Mathf.Abs(upperLegLength - lowerLegLength) + 0.01f;
        float maxReach = upperLegLength + lowerLegLength - 0.01f;
        d = Mathf.Clamp(d, minReach, maxReach);

        // 余弦定理求髋关节处夹角 α
        // cos(α) = (L1² + d² - L2²) / (2 × L1 × d)
        float cosAlpha = (upperLegLength * upperLegLength + d * d - lowerLegLength * lowerLegLength)
                       / (2f * upperLegLength * d);
        // 数值安全钳制（浮点误差可能导致略超出 [-1,1]）
        cosAlpha = Mathf.Clamp(cosAlpha, -1f, 1f);
        float alpha = Mathf.Acos(cosAlpha);

        // A→B 方向的角度
        float baseAngle = Mathf.Atan2(toFoot.y, toFoot.x);

        // 膝盖弯曲方向：根据朝向和极向量决定旋转正负
        // 面朝右时膝盖向前（逆时针旋转），面朝左时膝盖向后（顺时针旋转）
        float bendSign = (poleDirection.x * facing >= 0f) ? 1f : -1f;

        // 上腿方向 = A→B 方向旋转 α
        float upperAngle = baseAngle + alpha * bendSign;
        Vector2 upperDir = new Vector2(Mathf.Cos(upperAngle), Mathf.Sin(upperAngle));

        // 膝关节位置
        kneePosition = hipPos + upperDir * upperLegLength;

        // 如果脚掌超出可达范围，将脚掌拉回到最大可达距离
        // （防止 IK 求解失败时脚掌"飞"出去）
        float actualDist = Vector2.Distance(hipPos, footPos);
        if (actualDist > maxReach)
        {
            footPosition = hipPos + toFoot.normalized * maxReach;
        }
    }

    // ═══════════════════════════════════════════
    //  Gizmos 调试绘制
    // ═══════════════════════════════════════════

    /// <summary>
    /// 绘制腿部骨骼。由 CreatureController 的 OnDrawGizmos 调用。
    /// </summary>
    public void DrawGizmos(Vector2 hipPos, Color boneColor, Color jointColor)
    {
        // 上腿：髋 → 膝
        Gizmos.color = boneColor;
        Gizmos.DrawLine(hipPos, kneePosition);

        // 下腿：膝 → 脚
        Gizmos.DrawLine(kneePosition, footPosition);

        // 膝关节
        Gizmos.color = jointColor;
        Gizmos.DrawSphere(kneePosition, 0.06f);

        // 脚掌（稍大，方便观察）
        Gizmos.DrawSphere(footPosition, 0.08f);

        // 髋关节
        Gizmos.DrawSphere(hipPos, 0.07f);
    }
}
