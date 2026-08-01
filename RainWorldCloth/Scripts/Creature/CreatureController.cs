using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 生物控制器 —— 多节点软体生物的身体构造、输入处理与程序化运动。
/// 
/// 【身体拓扑】（类似《雨世界》蛞蝓猫的简化版）
/// 
///   [头部] ──弹簧── [胸部] ──弹簧── [臀部]
///     │                │                │
///   (碰撞)          (碰撞)          (碰撞)
///                                    │
///                              [尾1]─[尾2]─[尾3]─[尾4]─[尾5]
///                             (无碰撞，质量递减，物理甩动)
/// 
///   胸部两侧各挂载一条 IK 腿（共 2 条），臀部两侧各一条（共 2 条），
///   合计 4 条程序化腿。
/// 
/// 【运动原则】
///   严禁直接修改节点坐标！所有运动必须通过：
///     - AddForce()：施加持续力（行走）
///     - ApplyImpulse()：施加瞬时冲量（跳跃）
///   让 Verlet 物理系统自然演算出运动轨迹。
/// </summary>
[DefaultExecutionOrder(-10)] // 在 VerletSolver(0) 之前执行，确保力先施加再积分
public class CreatureController : MonoBehaviour
{
    // ═══════════════════════════════════════════
    //  Inspector 可调参数
    // ═══════════════════════════════════════════

    [Header("身体构造")]
    [Tooltip("躯干节点间距")]
    public float spineSegmentLength = 0.55f;
    [Tooltip("尾巴节点数量")]
    [Range(3, 8)]
    public int tailNodeCount = 5;
    [Tooltip("尾巴首节点间距")]
    public float tailSegmentLength = 0.35f;

    [Header("运动参数")]
    [Tooltip("水平移动力（牛顿）。越大跑得越快。")]
    public float moveForce = 45f;
    [Tooltip("空中水平控制力（通常比地面小，模拟惯性）")]
    public float airControlForce = 12f;
    [Tooltip("跳跃冲量（N·s）。作用于躯干所有节点。")]
    public float jumpImpulse = 8f;
    [Tooltip("最大水平速度限制（世界单位/帧）")]
    public float maxHorizontalSpeed = 0.18f;
    [Tooltip("地面摩擦附加系数（叠加在节点自身摩擦之上）")]
    public float groundDrag = 0.06f;

    [Header("IK 腿部")]
    [Tooltip("是否启用 IK 腿")]
    public bool enableLegs = true;
    [Tooltip("上腿长度")]
    public float upperLegLength = 0.5f;
    [Tooltip("下腿长度")]
    public float lowerLegLength = 0.5f;

    [Header("引用")]
    public VerletSolver solver;
    public GridWorld gridWorld;

    // ═══════════════════════════════════════════
    //  身体节点引用
    // ═══════════════════════════════════════════

    /// <summary>头部节点 —— 运动的主要施力点</summary>
    public VerletNode headNode { get; private set; }
    /// <summary>胸部节点 —— 运动的主要施力点 + 前腿附着</summary>
    public VerletNode chestNode { get; private set; }
    /// <summary>臀部节点 —— 后腿附着 + 触地检测</summary>
    public VerletNode hipNode { get; private set; }
    /// <summary>尾巴节点链（质量递减）</summary>
    public List<VerletNode> tailNodes { get; private set; } = new List<VerletNode>();

    /// <summary>所有躯干节点（头+胸+臀），用于跳跃冲量分配</summary>
    private List<VerletNode> torsoNodes = new List<VerletNode>();

    // ═══════════════════════════════════════════
    //  IK 腿部
    // ═══════════════════════════════════════════

    /// <summary>前腿（左/右），附着在胸部节点</summary>
    private IKLeg frontLegL, frontLegR;
    /// <summary>后腿（左/右），附着在臀部节点</summary>
    private IKLeg backLegL, backLegR;

    // ═══════════════════════════════════════════
    //  运行时状态
    // ═══════════════════════════════════════════

    /// <summary>当前朝向：+1 = 右，-1 = 左</summary>
    public float Facing { get; private set; } = 1f;

    /// <summary>是否触地（任一躯干节点接触地面）</summary>
    public bool IsGrounded { get; private set; }

    /// <summary>跳跃缓冲计时器（允许在离地后短时间内仍可跳跃，即"土狼时间"）</summary>
    private float coyoteTimer = 0f;
    private const float COYOTE_TIME = 0.1f; // 100ms 土狼时间

    /// <summary>跳跃输入缓冲（允许在落地前按跳跃键，落地后自动跳）</summary>
    private float jumpBufferTimer = 0f;
    private const float JUMP_BUFFER_TIME = 0.12f;

    // ═══════════════════════════════════════════
    //  初始化
    // ═══════════════════════════════════════════

    /// <summary>
    /// 构建生物身体。由 PrototypeBootstrap 在创建时调用。
    /// </summary>
    /// <param name="spawnPos">出生位置（世界坐标）</param>
    /// <param name="solver">物理求解器引用</param>
    /// <param name="grid">网格世界引用</param>
    public void Initialize(Vector2 spawnPos, VerletSolver solver, GridWorld grid)
    {
        this.solver = solver;
        this.gridWorld = grid;

        BuildBody(spawnPos);
        BuildConstraints();
        BuildLegs();
    }

    /// <summary>
    /// 构造躯干和尾巴节点。
    /// 
    /// 布局（从左到右）：
    ///   头部 → 胸部 → 臀部 → 尾1 → 尾2 → ... → 尾N
    /// 
    /// 质量分布：
    ///   胸部最重（1.5），是身体的"重心"，提供惯性；
    ///   头部和臀部次之（1.0/1.2）；
    ///   尾巴质量从头到尾递减（0.4→0.08），产生鞭梢效应。
    /// </summary>
    private void BuildBody(Vector2 spawnPos)
    {
        float y = spawnPos.y;
        float x = spawnPos.x;

        // ── 躯干三节点 ──
        // 头部：较轻，碰撞半径小，是主要"导向"节点
        headNode = solver.AddNode(new Vector2(x, y + spineSegmentLength), mass: 1.0f, radius: 0.22f);
        headNode.friction = 0.3f;

        // 胸部：最重，碰撞半径最大，是身体的"锚"
        chestNode = solver.AddNode(new Vector2(x, y), mass: 1.5f, radius: 0.28f);
        chestNode.friction = 0.5f;

        // 臀部：中等重量，后腿附着点
        hipNode = solver.AddNode(new Vector2(x, y - spineSegmentLength), mass: 1.2f, radius: 0.24f);
        hipNode.friction = 0.5f;

        torsoNodes.Add(headNode);
        torsoNodes.Add(chestNode);
        torsoNodes.Add(hipNode);

        // ── 尾巴节点链 ──
        // 质量递减 → 末端更轻 → 甩动更灵活（鞭梢效应）
        // 碰撞关闭 → 尾巴可以穿过地形（简化处理，避免尾巴卡墙）
        for (int i = 0; i < tailNodeCount; i++)
        {
            float t = (float)i / (tailNodeCount - 1); // 0→1 归一化位置

            // 质量从 0.4 递减到 0.08
            float mass = Mathf.Lerp(0.4f, 0.08f, t);

            // 碰撞半径从 0.12 递减到 0.04
            float radius = Mathf.Lerp(0.12f, 0.04f, t);

            // 位置：从臀部向下延伸
            Vector2 tailPos = new Vector2(x, y - spineSegmentLength - tailSegmentLength * (i + 1));

            VerletNode tailNode = solver.AddNode(tailPos, mass, radius);
            tailNode.friction = 0.2f;
            tailNode.gravityScale = Mathf.Lerp(0.8f, 0.3f, t); // 尾巴末端更"飘"
            tailNode.collidesWithWorld = false; // 尾巴不碰撞（简化）

            tailNodes.Add(tailNode);
        }
    }

    /// <summary>
    /// 构造弹簧约束网络。
    /// 
    /// 约束拓扑：
    ///   主链：头─胸─臀─尾1─尾2─...─尾N（高刚度，维持脊椎形态）
    ///   辅助：头─臀（低刚度，防止身体对折）
    ///   尾巴：相邻尾巴节点（低刚度，柔软甩动）
    /// </summary>
    private void BuildConstraints()
    {
        // ── 主脊椎链（高刚度 0.7~0.9）──
        solver.AddConstraint(headNode, chestNode, spineSegmentLength, stiffness: 0.85f);
        solver.AddConstraint(chestNode, hipNode, spineSegmentLength, stiffness: 0.85f);

        // ── 辅助约束：头─臀（防止身体对折成 U 形）──
        // 静止长度 = 两段脊椎的 80%，允许一定弯曲但不过度
        float headHipRest = spineSegmentLength * 2f * 0.8f;
        solver.AddConstraint(headNode, hipNode, headHipRest, stiffness: 0.3f);

        // ── 尾巴链（低刚度 0.3~0.5，柔软）──
        VerletNode prev = hipNode;
        for (int i = 0; i < tailNodes.Count; i++)
        {
            // 尾巴刚度从 0.5 递减到 0.2（末端更柔软）
            float t = (float)i / Mathf.Max(1, tailNodes.Count - 1);
            float stiffness = Mathf.Lerp(0.5f, 0.2f, t);

            solver.AddConstraint(prev, tailNodes[i], tailSegmentLength, stiffness);
            prev = tailNodes[i];
        }
    }

    /// <summary>
    /// 构造 IK 腿部。
    /// 前腿附着在胸部两侧，后腿附着在臀部两侧。
    /// </summary>
    private void BuildLegs()
    {
        if (!enableLegs) return;

        // 前腿（胸部）
        frontLegL = CreateLeg(new Vector2(-0.15f, 0f), Vector2.left);
        frontLegR = CreateLeg(new Vector2(0.15f, 0f), Vector2.right);

        // 后腿（臀部）
        backLegL = CreateLeg(new Vector2(-0.15f, 0f), Vector2.left);
        backLegR = CreateLeg(new Vector2(0.15f, 0f), Vector2.right);
    }

    private IKLeg CreateLeg(Vector2 footOffset, Vector2 poleDir)
    {
        return new IKLeg
        {
            upperLegLength = upperLegLength,
            lowerLegLength = lowerLegLength,
            stepThreshold = 0.7f,
            stepDuration = 0.1f,
            stepHeight = 0.25f,
            footOffset = footOffset,
            poleDirection = poleDir
        };
    }

    // ═══════════════════════════════════════════
    //  输入处理与运动逻辑（每帧调用）
    // ═══════════════════════════════════════════

    private void Update()
    {
        // ── 读取输入 ──
        float inputX = Input.GetAxisRaw("Horizontal"); // -1, 0, +1
        bool jumpPressed = Input.GetButtonDown("Jump");  // 按下瞬间

        // ── 更新朝向 ──
        if (inputX > 0.1f) Facing = 1f;
        else if (inputX < -0.1f) Facing = -1f;

        // ── 土狼时间计时器 ──
        // 离地后仍允许短暂跳跃，提升操作手感
        if (IsGrounded)
            coyoteTimer = COYOTE_TIME;
        else
            coyoteTimer -= Time.deltaTime;

        // ── 跳跃输入缓冲 ──
        // 落地前按跳跃，落地后自动执行跳跃
        if (jumpPressed)
            jumpBufferTimer = JUMP_BUFFER_TIME;
        else
            jumpBufferTimer -= Time.deltaTime;

        // ── 保存输入供 FixedUpdate 使用 ──
        cachedInputX = inputX;
        cachedJumpPressed = jumpBufferTimer > 0f && coyoteTimer > 0f;
    }

    // 缓存的输入（Update → FixedUpdate 传递）
    private float cachedInputX;
    private bool cachedJumpPressed;

    /// <summary>
    /// 物理帧：施加运动力。
    /// 在 VerletSolver.FixedUpdate 之前执行（DefaultExecutionOrder = -10）。
    /// </summary>
    private void FixedUpdate()
    {
        if (solver == null) return;

        float dt = Time.fixedDeltaTime;

        // ── 触地检测 ──
        // 任一躯干节点触地即视为"着地"
        IsGrounded = headNode.isGrounded || chestNode.isGrounded || hipNode.isGrounded;

        // ── 水平移动 ──
        ApplyHorizontalMovement(dt);

        // ── 跳跃 ──
        ApplyJump();

        // ── 地面阻力 ──
        ApplyGroundDrag();

        // ── 速度限制 ──
        ClampHorizontalSpeed();

        // ── 更新 IK 腿 ──
        if (enableLegs)
        {
            UpdateLegs(dt);
        }
    }

    /// <summary>
    /// 水平移动：向胸部和头部施加定向力。
    /// 
    /// 【为什么是"力"而不是"速度"？】
    /// 直接设速度会让生物瞬间达到最大速度，失去"重量感"。
    /// 施加力 → 加速度 → 速度逐渐累积 → 产生惯性感和起步/停止的过渡。
    /// 
    /// 地面移动力 > 空中控制力：
    /// 地面有摩擦力提供反作用力，所以能施加更大的力；
    /// 空中没有支撑，只能"扭动"身体微调方向。
    /// </summary>
    private void ApplyHorizontalMovement(float dt)
    {
        if (Mathf.Abs(cachedInputX) < 0.01f) return;

        float force = IsGrounded ? moveForce : airControlForce;
        Vector2 moveDir = Vector2.right * cachedInputX;

        // 主要施力点：胸部（身体重心）
        chestNode.AddForce(moveDir * force);

        // 辅助施力：头部（让身体前倾，产生"探路"姿态）
        // 头部受力略小，避免过度前倾
        headNode.AddForce(moveDir * force * 0.6f);

        // 空中时臀部也施加少量力（防止身体在空中旋转失控）
        if (!IsGrounded)
        {
            hipNode.AddForce(moveDir * force * 0.3f);
        }
    }

    /// <summary>
    /// 跳跃：向躯干所有节点施加向上的瞬时冲量。
    /// 
    /// 冲量分配：
    ///   胸部 100%（主跳力），头部 85%（略少，避免头部飞太快），
    ///   臀部 70%（最少，让身体有"收腿"的感觉）。
    ///   这种不均匀分配让跳跃姿态更自然，而非刚体平移。
    /// </summary>
    private void ApplyJump()
    {
        if (!cachedJumpPressed) return;

        // 消耗跳跃缓冲和土狼时间
        jumpBufferTimer = 0f;
        coyoteTimer = 0f;

        Vector2 jumpDir = Vector2.up;

        // 按质量加权施加冲量，确保各节点获得相近的速度增量
        // 但故意让头部少一点、臀部少一点，产生"蜷缩起跳"的姿态
        chestNode.ApplyImpulse(jumpDir * jumpImpulse);
        headNode.ApplyImpulse(jumpDir * jumpImpulse * 0.85f);
        hipNode.ApplyImpulse(jumpDir * jumpImpulse * 0.70f);
    }

    /// <summary>
    /// 地面阻力：触地时额外衰减水平速度。
    /// 
    /// 在 Verlet 中，衰减速度 = 将 oldPosition 向 position 靠近。
    /// 只衰减水平分量，保留垂直分量（不影响重力下落）。
    /// </summary>
    private void ApplyGroundDrag()
    {
        if (!IsGrounded) return;

        foreach (var node in torsoNodes)
        {
            Vector2 vel = node.Velocity;
            // 只衰减水平速度
            float horizontalVel = vel.x;
            float dampedHorizontal = horizontalVel * (1f - groundDrag);
            node.oldPosition = new Vector2(
                node.position.x - dampedHorizontal,
                node.oldPosition.y // 保持垂直速度不变
            );
        }
    }

    /// <summary>
    /// 水平速度限制：防止加速到不合理的速度。
    /// 在 Verlet 中，限制速度 = 钳制 (position - oldPosition) 的水平分量。
    /// </summary>
    private void ClampHorizontalSpeed()
    {
        foreach (var node in torsoNodes)
        {
            Vector2 vel = node.Velocity;
            float clampedX = Mathf.Clamp(vel.x, -maxHorizontalSpeed, maxHorizontalSpeed);
            if (Mathf.Abs(clampedX - vel.x) > 0.0001f)
            {
                node.oldPosition = new Vector2(
                    node.position.x - clampedX,
                    node.oldPosition.y
                );
            }
        }
    }

    /// <summary>
    /// 更新所有 IK 腿。
    /// 前腿以胸部为髋，后腿以臀部为髋。
    /// </summary>
    private void UpdateLegs(float dt)
    {
        Vector2 bodyVel = chestNode.Velocity;

        // 前腿（胸部两侧）
        frontLegL.UpdateLeg(chestNode.position, bodyVel, gridWorld, dt, Facing);
        frontLegR.UpdateLeg(chestNode.position, bodyVel, gridWorld, dt, Facing);

        // 后腿（臀部两侧）
        backLegL.UpdateLeg(hipNode.position, bodyVel, gridWorld, dt, Facing);
        backLegR.UpdateLeg(hipNode.position, bodyVel, gridWorld, dt, Facing);
    }

    // ═══════════════════════════════════════════
    //  公共查询接口
    // ═══════════════════════════════════════════

    /// <summary>获取生物中心位置（胸部节点位置，用于相机跟随）</summary>
    public Vector2 CenterPosition => chestNode != null ? chestNode.position : Vector2.zero;

    /// <summary>获取生物整体速度（胸部节点速度）</summary>
    public Vector2 BodyVelocity => chestNode != null ? chestNode.Velocity : Vector2.zero;

    // ═══════════════════════════════════════════
    //  Gizmos 调试绘制
    // ═══════════════════════════════════════════

    private void OnDrawGizmos()
    {
        if (headNode == null) return;

        // ── 躯干节点（带标签颜色）──
        // 头部：红色
        Gizmos.color = new Color(1f, 0.3f, 0.2f);
        Gizmos.DrawSphere(headNode.position, headNode.radius + 0.03f);

        // 胸部：橙色
        Gizmos.color = new Color(1f, 0.65f, 0.1f);
        Gizmos.DrawSphere(chestNode.position, chestNode.radius + 0.03f);

        // 臀部：黄色
        Gizmos.color = new Color(1f, 0.95f, 0.2f);
        Gizmos.DrawSphere(hipNode.position, hipNode.radius + 0.03f);

        // ── 尾巴节点（蓝色渐变）──
        for (int i = 0; i < tailNodes.Count; i++)
        {
            float t = (float)i / Mathf.Max(1, tailNodes.Count - 1);
            Gizmos.color = Color.Lerp(
                new Color(0.3f, 0.6f, 1f),   // 亮蓝（靠近臀部）
                new Color(0.15f, 0.25f, 0.6f), // 深蓝（尾巴末端）
                t
            );
            Gizmos.DrawSphere(tailNodes[i].position, tailNodes[i].radius + 0.02f);
        }

        // ── 朝向指示器（从头部伸出的短线）──
        Gizmos.color = Color.white;
        Vector2 facingDir = new Vector2(Facing, 0f) * 0.4f;
        Gizmos.DrawLine(headNode.position, headNode.position + facingDir);

        // ── 触地指示（触地节点下方画小三角）──
        foreach (var node in torsoNodes)
        {
            if (node.isGrounded)
            {
                Gizmos.color = Color.green;
                Vector2 p = node.position - Vector2.up * (node.radius + 0.1f);
                Gizmos.DrawLine(p, p + new Vector2(-0.08f, -0.12f));
                Gizmos.DrawLine(p, p + new Vector2(0.08f, -0.12f));
                Gizmos.DrawLine(p + new Vector2(-0.08f, -0.12f), p + new Vector2(0.08f, -0.12f));
            }
        }

        // ── IK 腿部 ──
        if (enableLegs && frontLegL != null)
        {
            Color boneColor = new Color(0.8f, 0.8f, 0.9f, 0.9f);
            Color jointColor = new Color(1f, 0.5f, 0.3f);

            // 前腿
            frontLegL.DrawGizmos(chestNode.position, boneColor, jointColor);
            frontLegR.DrawGizmos(chestNode.position, boneColor, jointColor);

            // 后腿
            backLegL.DrawGizmos(hipNode.position, boneColor, jointColor);
            backLegR.DrawGizmos(hipNode.position, boneColor, jointColor);
        }

        // ── 状态文字（仅在 Scene 视图显示）──
        #if UNITY_EDITOR
        if (chestNode != null)
        {
            string status = IsGrounded ? "GROUNDED" : "AIRBORNE";
            UnityEditor.Handles.Label(
                chestNode.position + Vector2.up * 0.6f,
                $"[{status}]  Facing: {(Facing > 0 ? "→" : "←")}"
            );
        }
        #endif
    }
}
