using UnityEngine;

/// <summary>
/// 弹簧距离约束 —— 连接两个 VerletNode，维持它们之间的目标距离。
/// 
/// 【核心原理】距离约束松弛法（Distance Constraint Relaxation）：
///   每帧检查两节点实际距离与目标距离（restLength）的偏差，
///   然后按质量加权比例将两节点"拉回"或"推开"。
/// 
/// 数学推导：
///   delta = nodeB.pos - nodeA.pos          // 方向向量
///   dist  = |delta|                         // 实际距离
///   diff  = (dist - restLength) / dist      // 归一化偏差（正值=拉伸，负值=压缩）
///   
///   质量加权修正（轻的节点移动多，重的节点移动少）：
///   totalMass = massA + massB
///   nodeA.pos += delta * diff * stiffness * (massB / totalMass)
///   nodeB.pos -= delta * diff * stiffness * (massA / totalMass)
/// 
/// 当 stiffness = 1 且迭代次数足够时，约束被完全满足（刚性杆）；
/// stiffness < 1 时表现为弹性弹簧，多次迭代逐步收敛。
/// </summary>
[System.Serializable]
public class SpringConstraint
{
    /// <summary>约束的 A 端节点</summary>
    public VerletNode nodeA;

    /// <summary>约束的 B 端节点</summary>
    public VerletNode nodeB;

    /// <summary>
    /// 目标静止长度（世界单位）。
    /// 两节点在无外力时倾向于保持此距离。
    /// </summary>
    public float restLength;

    /// <summary>
    /// 刚度系数 [0, 1]。
    ///   1.0 = 完全刚性（单次迭代即满足，如骨骼）
    ///   0.3 = 柔软弹性（如肌肉、尾巴）
    /// 注意：实际刚度还受 Solver 迭代次数影响，
    /// 低迭代 + 低刚度 = 非常柔软，高迭代 + 高刚度 = 接近刚性。
    /// </summary>
    [Range(0f, 1f)]
    public float stiffness = 0.8f;

    /// <summary>
    /// 最大拉伸比例限制。防止极端情况下约束被拉断。
    /// 例如 2.0 表示最大允许拉伸到 restLength 的 2 倍。
    /// 设为 0 表示不限制。
    /// </summary>
    public float maxStretchRatio = 3f;

    /// <summary>调试用：上一帧的实际长度（Gizmos 绘制张力颜色用）</summary>
    [System.NonSerialized] public float currentLength;

    /// <summary>调试用：上一帧的张力比 = currentLength / restLength</summary>
    [System.NonSerialized] public float tensionRatio = 1f;

    // ═══════════════════════════════════════════
    //  构造
    // ═══════════════════════════════════════════

    /// <summary>
    /// 创建弹簧约束。restLength 默认取两节点当前距离。
    /// </summary>
    public SpringConstraint(VerletNode nodeA, VerletNode nodeB, float stiffness = 0.8f)
    {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.restLength = Vector2.Distance(nodeA.position, nodeB.position);
        this.stiffness = stiffness;
        this.currentLength = this.restLength;
    }

    /// <summary>
    /// 创建弹簧约束，手动指定静止长度（可预拉伸/预压缩）。
    /// </summary>
    public SpringConstraint(VerletNode nodeA, VerletNode nodeB, float restLength, float stiffness)
    {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.restLength = Mathf.Max(restLength, 0.001f);
        this.stiffness = stiffness;
        this.currentLength = this.restLength;
    }

    // ═══════════════════════════════════════════
    //  约束求解（每迭代步调用一次）
    // ═══════════════════════════════════════════

    /// <summary>
    /// 执行一次距离约束松弛。
    /// 由 VerletSolver 在每个迭代步中调用。
    /// </summary>
    public void Satisfy()
    {
        // 1. 计算方向向量与实际距离
        Vector2 delta = nodeB.position - nodeA.position;
        float dist = delta.magnitude;

        // 记录调试数据
        currentLength = dist;

        // 防止除零：两节点完全重合时给一个微小随机偏移
        if (dist < 0.0001f)
        {
            delta = Random.insideUnitCircle.normalized * 0.001f;
            dist = 0.001f;
        }

        // 2. 拉伸限制：超过最大比例时，强制将距离钳制回来
        float effectiveRestLength = restLength;
        if (maxStretchRatio > 0f && dist > restLength * maxStretchRatio)
        {
            effectiveRestLength = dist - (dist - restLength * maxStretchRatio);
        }

        // 3. 计算归一化偏差
        //    diff > 0：实际距离 > 目标 → 需要拉近
        //    diff < 0：实际距离 < 目标 → 需要推开
        float diff = (dist - effectiveRestLength) / dist;

        // 4. 质量加权分配
        //    核心思想：动量守恒。轻节点应该移动更多，重节点移动更少。
        //    权重 = 对方质量 / 总质量
        float totalMass = nodeA.mass + nodeB.mass;
        float weightA = nodeA.pinned ? 0f : nodeB.mass / totalMass;
        float weightB = nodeB.pinned ? 0f : nodeA.mass / totalMass;

        // 如果两端都钉死，跳过
        if (weightA + weightB < 0.0001f) return;

        // 5. 应用修正
        //    stiffness 控制每次迭代修正的比例：
        //    stiffness=1 → 一步到位（刚性），stiffness=0.3 → 缓慢收敛（弹性）
        Vector2 correction = delta * diff * stiffness;

        nodeA.position += correction * weightA;
        nodeB.position -= correction * weightB;

        // 6. 更新张力比（调试用）
        tensionRatio = dist / restLength;
    }
}
