using UnityEngine;

/// <summary>
/// 原型启动器 —— 一键搭建整个测试场景。
/// 
/// 【职责】
///   1. 创建 GridWorld 测试关卡
///   2. 创建 VerletSolver 物理求解器
///   3. 创建 CreatureController 并初始化生物
///   4. 相机平滑跟随
///   5. 绘制网格地形的 Gizmos
///   6. 提供运行时调试信息（OnGUI）
/// 
/// 【使用方法】
///   在 Unity 中创建空场景，将此脚本挂到一个空 GameObject 上，
///   点击 Play 即可看到完整的物理生物原型。
///   无需手动创建任何其他对象。
/// </summary>
[DefaultExecutionOrder(10)] // 在物理求解之后执行（相机跟随）
public class PrototypeBootstrap : MonoBehaviour
{
    // ═══════════════════════════════════════════
    //  Inspector 参数
    // ═══════════════════════════════════════════

    [Header("关卡设置")]
    [Tooltip("地图宽度（格子数）")]
    public int mapWidth = 60;
    [Tooltip("地图高度（格子数）")]
    public int mapHeight = 30;
    [Tooltip("格子尺寸（世界单位）")]
    public float cellSize = 1f;

    [Header("生物出生点")]
    public Vector2 spawnPosition = new Vector2(5f, 8f);

    [Header("相机设置")]
    [Tooltip("相机跟随平滑速度")]
    public float cameraSmoothSpeed = 4f;
    [Tooltip("相机正交尺寸")]
    public float cameraOrthoSize = 8f;
    [Tooltip("相机 Z 轴偏移")]
    public float cameraZOffset = -10f;

    [Header("物理参数")]
    [Tooltip("约束迭代次数")]
    [Range(1, 15)]
    public int constraintIterations = 5;
    [Tooltip("全局阻尼")]
    [Range(0f, 0.3f)]
    public float globalDamping = 0.02f;
    [Tooltip("重力加速度")]
    public Vector2 gravity = new Vector2(0f, -25f);

    [Header("调试")]
    [Tooltip("是否绘制网格 Gizmos")]
    public bool drawGridGizmos = true;
    [Tooltip("是否显示运行时调试 UI")]
    public bool showDebugUI = true;

    // ═══════════════════════════════════════════
    //  运行时引用
    // ═══════════════════════════════════════════

    private GridWorld gridWorld;
    private VerletSolver solver;
    private CreatureController creature;
    private Camera mainCamera;

    // ═══════════════════════════════════════════
    //  初始化
    // ═══════════════════════════════════════════

    private void Awake()
    {
        // ── 1. 创建网格世界 ──
        gridWorld = GridWorld.CreateTestLevel(mapWidth, mapHeight, cellSize);
        Debug.Log($"[PrototypeBootstrap] 地图已生成: {mapWidth}×{mapHeight}, 格子尺寸={cellSize}");

        // ── 2. 创建物理求解器 ──
        GameObject solverObj = new GameObject("VerletSolver");
        solverObj.transform.SetParent(transform);
        solver = solverObj.AddComponent<VerletSolver>();
        solver.gridWorld = gridWorld;
        solver.constraintIterations = constraintIterations;
        solver.globalDamping = globalDamping;
        solver.gravity = gravity;

        // ── 3. 创建生物 ──
        GameObject creatureObj = new GameObject("Creature");
        creatureObj.transform.SetParent(transform);
        creature = creatureObj.AddComponent<CreatureController>();
        creature.Initialize(spawnPosition, solver, gridWorld);

        Debug.Log($"[PrototypeBootstrap] 生物已生成于 {spawnPosition}");

        // ── 4. 设置相机 ──
        SetupCamera();

        // ── 5. 固定时间步长（确保物理稳定性）──
        // 50Hz 是 Verlet 物理的常用频率，dt = 0.02s
        Time.fixedDeltaTime = 0.02f;
    }

    /// <summary>
    /// 配置主相机：正交投影 + 初始位置对准生物。
    /// </summary>
    private void SetupCamera()
    {
        mainCamera = Camera.main;
        if (mainCamera == null)
        {
            // 场景中没有相机，创建一个
            GameObject camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            mainCamera = camObj.AddComponent<Camera>();
        }

        mainCamera.orthographic = true;
        mainCamera.orthographicSize = cameraOrthoSize;
        mainCamera.backgroundColor = new Color(0.08f, 0.09f, 0.12f); // 深色背景
        mainCamera.transform.position = new Vector3(
            spawnPosition.x, spawnPosition.y, cameraZOffset
        );

        // 清除默认的天空盒（使用纯色背景）
        mainCamera.clearFlags = CameraClearFlags.SolidColor;
    }

    // ═══════════════════════════════════════════
    //  相机跟随（LateUpdate，在物理之后）
    // ═══════════════════════════════════════════

    private void LateUpdate()
    {
        if (mainCamera == null || creature == null) return;

        // 目标位置：生物中心 + Z 偏移
        Vector3 targetPos = new Vector3(
            creature.CenterPosition.x,
            creature.CenterPosition.y,
            cameraZOffset
        );

        // 平滑跟随（指数衰减插值）
        // 公式：pos = lerp(pos, target, 1 - e^(-speed × dt))
        // 比 Lerp 更帧率无关
        float t = 1f - Mathf.Exp(-cameraSmoothSpeed * Time.deltaTime);
        mainCamera.transform.position = Vector3.Lerp(
            mainCamera.transform.position, targetPos, t
        );
    }

    // ═══════════════════════════════════════════
    //  运行时调试 UI
    // ═══════════════════════════════════════════

    private void OnGUI()
    {
        if (!showDebugUI) return;

        // 左上角显示状态信息
        GUIStyle style = new GUIStyle(GUI.skin.label);
        style.fontSize = 14;
        style.fontStyle = FontStyle.Bold;
        style.normal.textColor = Color.white;

        float y = 10f;
        float lineHeight = 22f;

        GUI.Label(new Rect(10, y, 400, 20), "═══ VERLET CREATURE PROTOTYPE ═══", style);
        y += lineHeight;

        if (creature != null)
        {
            GUI.Label(new Rect(10, y, 400, 20),
                $"Position: ({creature.CenterPosition.x:F2}, {creature.CenterPosition.y:F2})", style);
            y += lineHeight;

            GUI.Label(new Rect(10, y, 400, 20),
                $"Velocity: ({creature.BodyVelocity.x:F4}, {creature.BodyVelocity.y:F4})", style);
            y += lineHeight;

            GUI.Label(new Rect(10, y, 400, 20),
                $"State: {(creature.IsGrounded ? "GROUNDED" : "AIRBORNE")}  |  Facing: {(creature.Facing > 0 ? "RIGHT" : "LEFT")}", style);
            y += lineHeight;
        }

        if (solver != null)
        {
            GUI.Label(new Rect(10, y, 400, 20),
                $"Nodes: {solver.Nodes.Count}  |  Constraints: {solver.Constraints.Count}  |  Iterations: {solver.constraintIterations}", style);
            y += lineHeight;
        }

        GUI.Label(new Rect(10, y, 400, 20),
            $"FPS: {1f / Time.deltaTime:F1}  |  Fixed DT: {Time.fixedDeltaTime:F3}s", style);
        y += lineHeight + 5;

        // 操作提示
        style.normal.textColor = new Color(0.7f, 0.7f, 0.7f);
        style.fontSize = 12;
        GUI.Label(new Rect(10, y, 400, 20), "[A/D or ←/→] Move  |  [Space/W/↑] Jump", style);
    }

    // ═══════════════════════════════════════════
    //  网格地形 Gizmos 绘制
    // ═══════════════════════════════════════════

    private void OnDrawGizmos()
    {
        if (!drawGridGizmos || gridWorld == null) return;

        // 绘制实心格子
        Gizmos.color = new Color(0.25f, 0.28f, 0.35f, 1f); // 深灰蓝

        for (int x = 0; x < gridWorld.Width; x++)
        {
            for (int y = 0; y < gridWorld.Height; y++)
            {
                if (!gridWorld.solidMap[x, y]) continue;

                // 绘制实心方块（略小于格子尺寸，留出缝隙便于观察网格）
                Vector2 center = gridWorld.GridToWorldCenter(x, y);
                float halfSize = cellSize * 0.48f;

                Gizmos.DrawCube(center, new Vector3(halfSize * 2f, halfSize * 2f, 0.1f));
            }
        }

        // 绘制网格线（仅绘制非实心区域的边界，减少视觉噪音）
        Gizmos.color = new Color(0.15f, 0.18f, 0.25f, 0.5f);

        for (int x = 0; x <= gridWorld.Width; x++)
        {
            Gizmos.DrawLine(
                new Vector3(x * cellSize, 0, 0),
                new Vector3(x * cellSize, gridWorld.Height * cellSize, 0)
            );
        }
        for (int y = 0; y <= gridWorld.Height; y++)
        {
            Gizmos.DrawLine(
                new Vector3(0, y * cellSize, 0),
                new Vector3(gridWorld.Width * cellSize, y * cellSize, 0)
            );
        }

        // 绘制出生点标记
        Gizmos.color = Color.cyan;
        Gizmos.DrawWireSphere(spawnPosition, 0.5f);
        Gizmos.DrawLine(spawnPosition - Vector2.up * 0.7f, spawnPosition + Vector2.up * 0.7f);
        Gizmos.DrawLine(spawnPosition - Vector2.right * 0.7f, spawnPosition + Vector2.right * 0.7f);
    }
}
