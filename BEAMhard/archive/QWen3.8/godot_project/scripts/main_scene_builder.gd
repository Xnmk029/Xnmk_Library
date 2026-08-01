## main_scene_builder.gd — 主场景构建器（EditorScript / 运行时入口）
## 整合 JBeam 解析 → 车辆构建 → 场景组装
## 可作为 @tool 编辑器脚本或运行时 _ready 入口
@tool
extends Node3D

## Mod 文件路径（相对于项目根目录）
const MOD_BASE_PATH := "res://mod_data/thw_ccf2/"
const JBEAM_DIR := MOD_BASE_PATH + "vehicles/ccf/jbeams/"
const TIRE_JBEAM := MOD_BASE_PATH + "vehicles/common/tires/16x8_ccf/tires_16x8_sport.jbeam"

## 构建状态
var build_result: VehicleBuilder.BuildResult = null
var is_built: bool = false

func _ready() -> void:
	if Engine.is_editor_hint():
		return
	_build_from_jbeam()

## 主构建流程
func _build_from_jbeam() -> void:
	print("[VehiclePipeline] 开始 JBeam → Godot 转换管线...")

	# 阶段 1.1: 解析 JBeam
	var parts: Array = []
	# 解析车身
	var body_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_body.jbeam")
	parts.append_array(body_parts)
	# 解析前悬挂
	var susp_f_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_suspension_F.jbeam")
	parts.append_array(susp_f_parts)
	# 解析后悬挂
	var susp_r_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_suspension_R.jbeam")
	parts.append_array(susp_r_parts)
	# 解析引擎
	var engine_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_engines.jbeam")
	parts.append_array(engine_parts)
	# 解析变速箱
	var trans_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_transmission.jbeam")
	parts.append_array(trans_parts)
	# 解析发动机支架
	var mounts_parts := JBeamParser.parse_file(JBEAM_DIR + "ccf_enginemounts.jbeam")
	parts.append_array(mounts_parts)
	# 解析轮胎
	var tire_parts := JBeamParser.parse_file(TIRE_JBEAM)
	parts.append_array(tire_parts)

	print(JBeamParser.get_summary(parts))

	# 阶段 1.2 + 1.3: 构建车辆节点树
	build_result = VehicleBuilder.build_vehicle(parts)
	if build_result == null:
		push_error("[VehiclePipeline] 构建失败")
		return

	# 将构建结果添加为子节点
	add_child(build_result.root)

	# 附加控制脚本
	var controller_script := load("res://scripts/vehicle_controller.gd")
	if controller_script:
		build_result.root.set_script(controller_script)

	is_built = true
	print("[VehiclePipeline] 构建完成: %d 个轮毂, %d 个挂载点" % [
		build_result.wheel_nodes.size(),
		_count_mount_points()
	])
	# 验证输出
	_validate_build()

## 构建验证
func _validate_build() -> void:
	print("[Validation] === 物理拓扑一致性检查 ===")
	# 检查车身刚体
	if build_result.body_rigidbody:
		var mass: float = build_result.body_rigidbody.mass
		print("[Validation] 车身质量: %.1f kg" % mass)
		print("[Validation] 质心: %s" % str(build_result.body_rigidbody.center_of_mass))
		var col_count: int = 0
		for child in build_result.body_rigidbody.get_children():
			if child is CollisionShape3D:
				col_count += 1
		print("[Validation] 碰撞体数量: %d" % col_count)
	# 检查轮胎
	for assembly in build_result.wheel_nodes:
		var wa = assembly  # VehicleBuilder.WheelAssembly
		print("[Validation] 轮胎 %s: pos=%s, R=%.3fm, W=%.3fm" % [
			wa.wheel_name, str(wa.pivot_point).substr(0, 20), wa.radius, wa.width])
		if wa.physics_material:
			print("[Validation]   摩擦系数: %.2f, rough: %s" % [
				wa.physics_material.friction, str(wa.physics_material.rough)])
		if wa.softbody:
			print("[Validation]   SoftBody3D: mass=%.1f, stiffness=%.2f" % [
				wa.softbody.total_mass, wa.softbody.linear_stiffness])
	# 检查挂载点
	var mounts := build_result.root.get_node_or_null("MountingPoints")
	if mounts:
		print("[Validation] 挂载点总数: %d" % mounts.get_child_count())
	# 坐标系验证
	print("[Validation] 坐标系: BeamNG(X右,Y前负,Z上) → Godot(X右,Y上,Z后负)")
	print("[Validation] 示例: BeamNG(0.6794, -1.1993, 0.19668) → Godot%s" % str(
		JBeamParser.beamng_to_godot(0.6794, -1.1993, 0.19668)))

## 统计挂载点
func _count_mount_points() -> int:
	if build_result == null:
		return 0
	var mounts := build_result.root.get_node_or_null("MountingPoints")
	if mounts:
		return mounts.get_child_count()
	return 0

## 导出节点树结构（调试）
func dump_tree(node: Node = null, indent: int = 0) -> void:
	if node == null:
		node = self
	var prefix := "  ".repeat(indent)
	print("%s[%s] %s" % [prefix, node.get_class(), node.name])
	for child in node.get_children():
		dump_tree(child, indent + 1)
