## validation_matrix.gd — 阶段 1 物理转译验证矩阵
## 输出诊断日志：节点映射、坐标系一致性、物理参数校验
## 严格 Godot 4.x GDScript
class_name ValidationMatrix
extends RefCounted

## 验证结果条目
class ValidationEntry:
	var category: String = ""
	var test_name: String = ""
	var expected: String = ""
	var actual: String = ""
	var passed: bool = false
	var severity: String = "INFO"  # INFO / WARN / FAIL

## 执行完整验证
static func run_validation(build_result: VehicleBuilder.BuildResult) -> Array:
	var entries: Array = []

	# === 1. 坐标系映射验证 ===
	entries.append(_validate_coordinate_transform())

	# === 2. 车身刚体参数验证 ===
	entries.append_array(_validate_body_rigidbody(build_result))

	# === 3. 轮胎软体参数验证 ===
	entries.append_array(_validate_tire_softbodies(build_result))

	# === 4. 悬挂关节验证 ===
	entries.append_array(_validate_suspension_joints(build_result))

	# === 5. 挂载点对齐验证 ===
	entries.append_array(_validate_mount_points(build_result))

	# === 6. 节点索引完整性 ===
	entries.append(_validate_node_index_integrity(build_result))

	return entries

## 坐标系转换验证
static func _validate_coordinate_transform() -> ValidationEntry:
	var entry := ValidationEntry.new()
	entry.category = "坐标系"
	entry.test_name = "BeamNG→Godot 笛卡尔映射"
	# 已知参考点: BeamNG fh5l(0.6794, -1.1993, 0.19668)
	var beamng_ref := Vector3(0.6794, -1.1993, 0.19668)
	var godot_expected := Vector3(0.6794, 0.19668, 1.1993)
	var godot_actual := JBeamParser.beamng_to_godot(beamng_ref.x, beamng_ref.y, beamng_ref.z)
	entry.expected = "Godot(0.6794, 0.19668, 1.1993)"
	entry.actual = "Godot(%.5f, %.5f, %.5f)" % [godot_actual.x, godot_actual.y, godot_actual.z]
	entry.passed = godot_actual.distance_to(godot_expected) < 0.0001
	entry.severity = "FAIL" if not entry.passed else "INFO"
	return entry

## 车身刚体验证
static func _validate_body_rigidbody(result: VehicleBuilder.BuildResult) -> Array:
	var entries: Array = []
	if result.body_rigidbody == null:
		var e := ValidationEntry.new()
		e.category = "车身刚体"
		e.test_name = "RigidBody3D 存在性"
		e.expected = "非 null"
		e.actual = "null"
		e.passed = false
		e.severity = "FAIL"
		entries.append(e)
		return entries

	# 质量范围检查（CCF 约 1000-1200kg）
	var mass_entry := ValidationEntry.new()
	mass_entry.category = "车身刚体"
	mass_entry.test_name = "总质量范围 [900, 1400] kg"
	mass_entry.expected = "900 ≤ mass ≤ 1400"
	mass_entry.actual = "%.1f kg" % result.body_rigidbody.mass
	mass_entry.passed = result.body_rigidbody.mass >= 900.0 and result.body_rigidbody.mass <= 1400.0
	mass_entry.severity = "WARN" if not mass_entry.passed else "INFO"
	entries.append(mass_entry)

	# 质心位置检查（应在车辆几何中心附近）
	var com_entry := ValidationEntry.new()
	com_entry.category = "车身刚体"
	com_entry.test_name = "质心 Y 高度 [0.2, 0.7] m"
	com_entry.expected = "0.2 ≤ com.y ≤ 0.7"
	com_entry.actual = "com = %s" % str(result.body_rigidbody.center_of_mass)
	var com_y: float = result.body_rigidbody.center_of_mass.y
	com_entry.passed = com_y >= 0.2 and com_y <= 0.7
	com_entry.severity = "WARN" if not com_entry.passed else "INFO"
	entries.append(com_entry)

	# 碰撞体存在性
	var col_count := 0
	for child in result.body_rigidbody.get_children():
		if child is CollisionShape3D:
			col_count += 1
	var col_entry := ValidationEntry.new()
	col_entry.category = "车身刚体"
	col_entry.test_name = "碰撞体数量 ≥ 1"
	col_entry.expected = "≥ 1"
	col_entry.actual = str(col_count)
	col_entry.passed = col_count >= 1
	col_entry.severity = "FAIL" if not col_entry.passed else "INFO"
	entries.append(col_entry)

	return entries

## 轮胎软体验证
static func _validate_tire_softbodies(result: VehicleBuilder.BuildResult) -> Array:
	var entries: Array = []
	# 轮胎数量
	var count_entry := ValidationEntry.new()
	count_entry.category = "轮胎"
	count_entry.test_name = "轮胎组件数量 = 4"
	count_entry.expected = "4"
	count_entry.actual = str(result.wheel_nodes.size())
	count_entry.passed = result.wheel_nodes.size() == 4
	count_entry.severity = "FAIL" if not count_entry.passed else "INFO"
	entries.append(count_entry)

	for assembly in result.wheel_nodes:
		var wa = assembly
		# 摩擦系数 ≥ 1.2
		var fric_entry := ValidationEntry.new()
		fric_entry.category = "轮胎"
		fric_entry.test_name = "%s 摩擦系数 ≥ 1.2" % wa.wheel_name
		fric_entry.expected = "friction ≥ 1.2"
		if wa.physics_material:
			fric_entry.actual = "friction = %.2f" % wa.physics_material.friction
			fric_entry.passed = wa.physics_material.friction >= 1.2
		else:
			fric_entry.actual = "PhysicsMaterial 缺失"
			fric_entry.passed = false
		fric_entry.severity = "FAIL" if not fric_entry.passed else "INFO"
		entries.append(fric_entry)

		# rough = true
		var rough_entry := ValidationEntry.new()
		rough_entry.category = "轮胎"
		rough_entry.test_name = "%s rough = true" % wa.wheel_name
		rough_entry.expected = "true"
		if wa.physics_material:
			rough_entry.actual = str(wa.physics_material.rough)
			rough_entry.passed = wa.physics_material.rough
		else:
			rough_entry.actual = "PhysicsMaterial 缺失"
			rough_entry.passed = false
		rough_entry.severity = "FAIL" if not rough_entry.passed else "INFO"
		entries.append(rough_entry)

		# SoftBody3D 存在性
		var sb_entry := ValidationEntry.new()
		sb_entry.category = "轮胎"
		sb_entry.test_name = "%s SoftBody3D 存在" % wa.wheel_name
		sb_entry.expected = "非 null"
		sb_entry.actual = "存在" if wa.softbody != null else "null"
		sb_entry.passed = wa.softbody != null
		sb_entry.severity = "FAIL" if not sb_entry.passed else "INFO"
		entries.append(sb_entry)

		# 轮胎半径
		var radius_entry := ValidationEntry.new()
		radius_entry.category = "轮胎"
		radius_entry.test_name = "%s 半径 = 0.305m (225/45R16)" % wa.wheel_name
		radius_entry.expected = "0.305"
		radius_entry.actual = "%.3f" % wa.radius
		radius_entry.passed = absf(wa.radius - 0.305) < 0.001
		radius_entry.severity = "WARN" if not radius_entry.passed else "INFO"
		entries.append(radius_entry)

	return entries

## 悬挂关节验证
static func _validate_suspension_joints(result: VehicleBuilder.BuildResult) -> Array:
	var entries: Array = []
	var joint_count := 0
	for child in result.root.get_children():
		if child is Generic6DOFJoint3D:
			joint_count += 1
	var j_entry := ValidationEntry.new()
	j_entry.category = "悬挂"
	j_entry.test_name = "Generic6DOFJoint3D 数量 = 4"
	j_entry.expected = "4"
	j_entry.actual = str(joint_count)
	j_entry.passed = joint_count == 4
	j_entry.severity = "FAIL" if not j_entry.passed else "INFO"
	entries.append(j_entry)
	return entries

## 挂载点对齐验证
static func _validate_mount_points(result: VehicleBuilder.BuildResult) -> Array:
	var entries: Array = []
	var mounts := result.root.get_node_or_null("MountingPoints")
	var mp_entry := ValidationEntry.new()
	mp_entry.category = "挂载点"
	mp_entry.test_name = "MountingPoints 节点存在"
	mp_entry.expected = "存在"
	mp_entry.actual = "存在" if mounts != null else "缺失"
	mp_entry.passed = mounts != null
	mp_entry.severity = "FAIL" if not mp_entry.passed else "INFO"
	entries.append(mp_entry)

	if mounts:
		var count := mounts.get_child_count()
		var c_entry := ValidationEntry.new()
		c_entry.category = "挂载点"
		c_entry.test_name = "挂载点数量 ≥ 10"
		c_entry.expected = "≥ 10"
		c_entry.actual = str(count)
		c_entry.passed = count >= 10
		c_entry.severity = "WARN" if not c_entry.passed else "INFO"
		entries.append(c_entry)

		# 验证关键枢轴点坐标（转向拉杆端 fw2l）
		var tie_rod := mounts.get_node_or_null("TieRod_FL")
		if tie_rod:
			var expected_pos := JBeamParser.beamng_to_godot(0.65532, -1.3394, 0.255)
			var tr_entry := ValidationEntry.new()
			tr_entry.category = "挂载点"
			tr_entry.test_name = "TieRod_FL 坐标对齐"
			tr_entry.expected = str(expected_pos)
			tr_entry.actual = str(tie_rod.position)
			tr_entry.passed = tie_rod.position.distance_to(expected_pos) < 0.001
			tr_entry.severity = "FAIL" if not tr_entry.passed else "INFO"
			entries.append(tr_entry)

	return entries

## 节点索引完整性（无漂移）
static func _validate_node_index_integrity(result: VehicleBuilder.BuildResult) -> ValidationEntry:
	var entry := ValidationEntry.new()
	entry.category = "索引完整性"
	entry.test_name = "节点索引无漂移（Node Index Offset = 0）"
	# 验证关键节点 ID 到坐标的映射唯一性
	var critical_nodes := {
		"fh5l": Vector3(0.65532, -1.1006, 0.28525),
		"fh5r": Vector3(-0.65532, -1.1006, 0.28525),
		"rh1l": Vector3(0.6794, 1.1204, 0.19668),
		"rh1r": Vector3(-0.6794, 1.1204, 0.19668),
	}
	var all_match := true
	for node_id in critical_nodes:
		if result.node_map.has(node_id):
			var beamng_pos: Vector3 = critical_nodes[node_id]
			var expected_godot := JBeamParser.beamng_to_godot(beamng_pos.x, beamng_pos.y, beamng_pos.z)
			var actual_godot: Vector3 = result.node_map[node_id]
			if actual_godot.distance_to(expected_godot) > 0.001:
				all_match = false
				break
		else:
			all_match = false
			break
	entry.expected = "所有关键节点映射一致"
	entry.actual = "一致" if all_match else "存在漂移"
	entry.passed = all_match
	entry.severity = "FAIL" if not all_match else "INFO"
	return entry

## 格式化输出诊断日志
static func format_report(entries: Array) -> String:
	var report := ""
	report += "╔══════════════════════════════════════════════════════════╗\n"
	report += "║  BEAMhard 阶段1 验证矩阵 — 物理转译诊断报告          ║\n"
	report += "╠══════════════════════════════════════════════════════════╣\n"
	var pass_count := 0
	var fail_count := 0
	var warn_count := 0
	for e in entries:
		var status: String = "PASS" if e.passed else ("FAIL" if e.severity == "FAIL" else "WARN")
		if e.passed:
			pass_count += 1
		elif e.severity == "FAIL":
			fail_count += 1
		else:
			warn_count += 1
		report += "║ [%s] %s / %s\n" % [status, e.category, e.test_name]
		report += "║        期望: %s\n" % e.expected
		report += "║        实际: %s\n" % e.actual
	report += "╠══════════════════════════════════════════════════════════╣\n"
	report += "║  总计: %d 项 | PASS: %d | WARN: %d | FAIL: %d\n" % [
		entries.size(), pass_count, warn_count, fail_count]
	report += "╚══════════════════════════════════════════════════════════╝\n"
	return report
