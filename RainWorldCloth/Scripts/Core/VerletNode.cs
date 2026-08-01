using UnityEngine;

/// <summary>
/// Verlet 物理节点 —— 整个物理系统的最小单元。
/// 
/// 【核心原理】Verlet 积分不显式存储速度，而是通过"当前位置"与"上一帧位置"的差值
/// 隐式表达速度：velocity ≈ position - oldPosition。
/// 这样做的好处是：
///   1. 天然稳定 —— 约束求解时直接修正位置，不会引入速度爆炸；
///   2. 实现简单 —— 无需维护独立的加速度/速度状态机；
///   3. 时间可逆 —— 交换 position 和 oldPosition 即可"倒放"。
/// 
/// 本类不继承 MonoBehaviour，是纯数据对象，由 VerletSolver 统一调度。
/// </summary>
[System.Serializable]
public class VerletNode
{
    // ═══════════════════════════════════════════
    //  核心运动学状态
    // ═══════════════════════════════════════════

    /// <summary>当前世界坐标位置 x(t)</summary>
    public Vector2 position;

    /// <summary>上一物理帧位置 x(t-dt)，与 position 的差值即隐式速度</summary>
    public Vector2 oldPosition;

    // ═══════════════════════════════════════════
    //  物理属性
    // ═══════════════════════════════════════════

    /// <summary>
    /// 质量（kg）。影响：
    ///   - 力的加速度响应：a = F / mass
    ///   - 约束求解时的质量加权分配：轻节点被推得多，重节点被推得少
    /// </summary>
    public float mass = 1f;

    /// <summary>
    /// 碰撞半径（世界单位）。用于圆-AABB碰撞检测。
    /// 设为 0 表示该节点不参与世界碰撞。
    /// </summary>
    public float radius = 0.25f;

    /// <summary>
    /// 表面摩擦系数 [0, 1]。
    /// 碰撞解析时，切向速度乘以 (1 - friction) 衰减：
    ///   0 = 完全光滑（冰面），1 = 完全粗糙（瞬间停止切向滑动）
    /// </summary>
    public float friction = 0.4f;

    /// <summary>
    /// 重力乘数。1 = 标准重力，0 = 失重，负值 = 反重力。
    /// 尾巴末端节点可设为较小值使其更"飘"。
    /// </summary>
    public float gravityScale = 1f;

    // ═══════════════════════════════════════════
    //  控制标志
    // ═══════════════════════════════════════════

    /// <summary>是否钉死（不参与积分和约束修正）。用于锚定点。</summary>
    public bool pinned = false;

    /// <summary>是否参与世界碰撞检测。尾巴末端节点可关闭以节省性能。</summary>
    public bool collidesWithWorld = true;

    // ═══════════════════════════════════════════
    //  运行时状态（由 Solver 每帧写入）
    // ═══════════════════════════════════════════

    /// <summary>本帧是否接触地面（碰撞法线朝上时置 true）</summary>
    [System.NonSerialized] public bool isGrounded = false;

    /// <summary>最近一次碰撞的表面法线（用于斜坡运动、墙面攀爬等扩展）</summary>
    [System.NonSerialized] public Vector2 groundNormal = Vector2.up;

    /// <summary>
    /// 累积外力缓冲。每帧由外部调用 AddForce() 写入，
    /// Solver 积分时读取并清零。单位：牛顿（N）。
    /// </summary>
    [System.NonSerialized] public Vector2 accumulatedForce = Vector2.zero;

    // ═══════════════════════════════════════════
    //  构造
    // ═══════════════════════════════════════════

    public VerletNode(Vector2 initialPosition, float mass = 1f, float radius = 0.25f)
    {
        this.position = initialPosition;
        this.oldPosition = initialPosition; // 初始速度为零
        this.mass = Mathf.Max(mass, 0.01f); // 防止除零
        this.radius = radius;
    }

    // ═══════════════════════════════════════════
    //  力学接口
    // ═══════════════════════════════════════════

    /// <summary>
    /// 隐式速度 = position - oldPosition。
    /// 注意：这是"每帧位移"，真实速度需除以 dt。
    /// 但在 Verlet 框架内，直接用位移量做运算更自然。
    /// </summary>
    public Vector2 Velocity => position - oldPosition;

    /// <summary>
    /// 施加持续力（每帧调用）。力会累积到 accumulatedForce，
    /// 在 Solver 积分阶段统一处理：a = F/m, Δx = a * dt²。
    /// </summary>
    public void AddForce(Vector2 force)
    {
        if (pinned) return;
        accumulatedForce += force;
    }

    /// <summary>
    /// 施加瞬时冲量（如跳跃）。
    /// 冲量 J 直接改变速度：Δv = J / m。
    /// 在 Verlet 中，修改 oldPosition 即可注入速度：
    ///   oldPosition -= Δv  →  velocity = pos - (old - Δv) = velocity + Δv
    /// </summary>
    public void ApplyImpulse(Vector2 impulse)
    {
        if (pinned) return;
        oldPosition -= impulse / mass;
    }

    /// <summary>
    /// 直接设定速度（覆盖式）。用于特殊控制逻辑。
    /// </summary>
    public void SetVelocity(Vector2 velocity)
    {
        oldPosition = position - velocity;
    }
}
