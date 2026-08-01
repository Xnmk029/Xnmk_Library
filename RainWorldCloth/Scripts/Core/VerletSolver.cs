using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Verlet 物理求解器 —— 整个物理系统的中枢调度器。
/// 
/// 【职责】
///   1. 管理所有 VerletNode 和 SpringConstraint 的生命周期
///   2. 在 FixedUpdate 中执行完整的物理管线：
///      积分 → 约束松弛（多次迭代）→ 碰撞解析
///   3. 提供 Gizmos 调试绘制
/// 
/// 【物理管线详解】
///   Step 1 - Verlet 积分：
///     对每个节点，用 Verlet 公式推进位置：
///       velocity = (position - oldPosition) × damping
///       oldPosition = position
///       position += velocity + (gravity × gravityScale + accumulatedForce / mass) × dt²
///     其中 damping 是全局速度衰减（模拟空气阻力），dt 是固定时间步长。
/// 
///   Step 2 - 约束松弛（迭代 N 次）：
///     对每个弹簧约束执行距离修正。多次迭代使约束系统趋于稳定，
///     迭代次数越多，整体结构越"硬"。典型值：3~8 次。
/// 
///   Step 3 - 碰撞解析：
///     对每个参与碰撞的节点，检测并推出实心格子，同时施加摩擦。
///     碰撞放在约束之后，确保节点最终位置不会穿墙。
/// 
/// 【性能考量】
///   - 纯 CPU 计算，无 GC 分配（避免每帧 new Vector2 等）
///   - 节点数 < 100 时性能完全不是问题
///   - 碰撞检测仅检查节点周围的 3×3 格子邻域
/// </summary>
[DefaultExecutionOrder(0)] // 在 CreatureController(-10) 之后执行
public class VerletSolver : MonoBehaviour
{
    // ═══════════════════════════════════════════
    //  可调参数（Inspector 面板）
    // ═══════════════════════════════════════════

    [Header("求解器参数")]
    [Tooltip("约束松弛迭代次数。越多越硬，但越耗性能。3~8 为宜。")]
    [Range(1, 15)]
    public int constraintIterations = 5;

    [Tooltip("全局速度衰减系数（空气阻力）。0=无阻力，0.05=轻微阻力，0.2=强阻力")]
    [Range(0f, 0.3f)]
    public float globalDamping = 0.02f;

    [Tooltip("重力加速度（世界单位/s²）。默认 -20 比 Unity 默认的 -9.81 更有'重量感'")]
    public Vector2 gravity = new Vector2(0f, -25f);

    [Header("引用")]
    [Tooltip("网格世界。留空则不进行碰撞检测。")]
    public GridWorld gridWorld;

    // ═══════════════════════════════════════════
    //  数据容器
    // ═══════════════════════════════════════════

    /// <summary>所有注册的物理节点</summary>
    private readonly List<VerletNode> nodes = new List<VerletNode>();

    /// <summary>所有注册的弹簧约束</summary>
    private readonly List<SpringConstraint> constraints = new List<SpringConstraint>();

    // ═══════════════════════════════════════════
    //  节点/约束管理接口
    // ═══════════════════════════════════════════

    /// <summary>注册一个物理节点到求解器</summary>
    public VerletNode AddNode(Vector2 position, float mass = 1f, float radius = 0.25f)
    {
        VerletNode node = new VerletNode(position, mass, radius);
        nodes.Add(node);
        return node;
    }

    /// <summary>注册一个已创建的节点（外部构造后加入）</summary>
    public void AddNode(VerletNode node)
    {
        if (!nodes.Contains(node))
            nodes.Add(node);
    }

    /// <summary>注册一个弹簧约束</summary>
    public SpringConstraint AddConstraint(VerletNode a, VerletNode b, float stiffness = 0.8f)
    {
        SpringConstraint c = new SpringConstraint(a, b, stiffness);
        constraints.Add(c);
        return c;
    }

    /// <summary>注册一个指定静止长度的弹簧约束</summary>
    public SpringConstraint AddConstraint(VerletNode a, VerletNode b, float restLength, float stiffness)
    {
        SpringConstraint c = new SpringConstraint(a, b, restLength, stiffness);
        constraints.Add(c);
        return c;
    }

    /// <summary>移除节点及其关联的所有约束</summary>
    public void RemoveNode(VerletNode node)
    {
        nodes.Remove(node);
        constraints.RemoveAll(c => c.nodeA == node || c.nodeB == node);
    }

    /// <summary>获取所有节点（只读访问）</summary>
    public IReadOnlyList<VerletNode> Nodes => nodes;

    /// <summary>获取所有约束（只读访问）</summary>
    public IReadOnlyList<SpringConstraint> Constraints => constraints;

    // ═══════════════════════════════════════════
    //  物理主循环
    // ═══════════════════════════════════════════

    private void FixedUpdate()
    {
        float dt = Time.fixedDeltaTime;

        // ── Step 1: Verlet 积分 ──
        // 对每个自由节点，根据上一帧位移推算新位置
        IntegrateNodes(dt);

        // ── Step 2: 约束松弛（多次迭代）──
        // 每次迭代修正所有约束的一部分偏差，
        // 多次迭代后系统趋于平衡
        for (int iter = 0; iter < constraintIterations; iter++)
        {
            for (int i = 0; i < constraints.Count; i++)
            {
                constraints[i].Satisfy();
            }
        }

        // ── Step 3: 碰撞解析 ──
        // 在约束修正之后检测碰撞，确保最终位置不穿墙
        if (gridWorld != null)
        {
            ResolveCollisions();
        }
    }

    /// <summary>
    /// Verlet 积分：推进所有自由节点的位置。
    /// 
    /// 公式推导：
    ///   标准 Verlet:  x(t+dt) = 2·x(t) - x(t-dt) + a(t)·dt²
    ///   等价形式:     x(t+dt) = x(t) + [x(t) - x(t-dt)] + a(t)·dt²
    ///                              ↑ 这就是隐式速度 velocity
    ///   
    ///   加入阻尼:     velocity *= (1 - damping)    // 模拟空气阻力
    ///   加入外力:     a = gravity × gravityScale + accumulatedForce / mass
    /// </summary>
    private void IntegrateNodes(float dt)
    {
        float dtSq = dt * dt; // dt² 预计算

        for (int i = 0; i < nodes.Count; i++)
        {
            VerletNode node = nodes[i];
            if (node.pinned) continue;

            // 1. 计算隐式速度并施加全局阻尼
            //    damping 模拟空气阻力：速度每帧衰减一小部分
            Vector2 velocity = (node.position - node.oldPosition) * (1f - globalDamping);

            // 2. 保存当前位置为"上一帧位置"
            node.oldPosition = node.position;

            // 3. 计算合加速度
            //    重力：全局重力 × 节点重力乘数
            //    外力：累积力 / 质量（牛顿第二定律 F = ma → a = F/m）
            Vector2 acceleration = gravity * node.gravityScale
                                 + node.accumulatedForce / node.mass;

            // 4. Verlet 推进：新位置 = 当前位置 + 速度 + 加速度 × dt²
            node.position += velocity + acceleration * dtSq;

            // 5. 清零外力缓冲（力是每帧重新施加的，不累积跨帧）
            node.accumulatedForce = Vector2.zero;

            // 6. 重置触地标志（碰撞阶段会重新设置）
            node.isGrounded = false;
        }
    }

    /// <summary>
    /// 碰撞解析：对所有参与碰撞的节点执行圆-AABB检测与修正。
    /// </summary>
    private void ResolveCollisions()
    {
        for (int i = 0; i < nodes.Count; i++)
        {
            VerletNode node = nodes[i];
            if (node.pinned || !node.collidesWithWorld) continue;

            gridWorld.ResolveNodeCollision(node);
        }
    }

    // ═══════════════════════════════════════════
    //  Gizmos 调试绘制
    // ═══════════════════════════════════════════

    private void OnDrawGizmos()
    {
        // 绘制所有约束（弹簧）
        // 颜色编码：绿色=松弛，黄色=轻微拉伸，红色=严重拉伸
        if (constraints != null)
        {
            for (int i = 0; i < constraints.Count; i++)
            {
                SpringConstraint c = constraints[i];
                if (c.nodeA == null || c.nodeB == null) continue;

                // 根据张力比选择颜色
                float tension = c.tensionRatio;
                if (tension < 1.05f)
                    Gizmos.color = new Color(0.2f, 0.9f, 0.3f, 0.8f);      // 绿：正常
                else if (tension < 1.3f)
                    Gizmos.color = new Color(0.9f, 0.9f, 0.2f, 0.8f);      // 黄：轻微拉伸
                else
                    Gizmos.color = new Color(0.95f, 0.2f, 0.15f, 0.9f);    // 红：严重拉伸

                Gizmos.DrawLine(c.nodeA.position, c.nodeB.position);
            }
        }

        // 绘制所有节点
        if (nodes != null)
        {
            for (int i = 0; i < nodes.Count; i++)
            {
                VerletNode node = nodes[i];

                // 节点球体：大小 = 碰撞半径，颜色区分状态
                if (node.pinned)
                    Gizmos.color = Color.magenta;           // 品红：钉死节点
                else if (node.isGrounded)
                    Gizmos.color = new Color(0.3f, 1f, 0.5f); // 亮绿：触地
                else
                    Gizmos.color = new Color(0.4f, 0.7f, 1f); // 蓝色：空中

                float drawRadius = Mathf.Max(node.radius, 0.08f);
                Gizmos.DrawSphere(node.position, drawRadius);

                // 绘制速度向量（白色短线）
                Vector2 vel = node.Velocity;
                if (vel.sqrMagnitude > 0.001f)
                {
                    Gizmos.color = Color.white;
                    Gizmos.DrawLine(node.position, node.position + vel * 3f);
                }
            }
        }
    }
}
