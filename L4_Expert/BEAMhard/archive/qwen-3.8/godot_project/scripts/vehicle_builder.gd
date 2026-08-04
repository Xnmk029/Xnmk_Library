## vehicle_builder.gd — JBeam → Godot 4 节点树构建器
## 任务 1.2: 车身刚体转译 + 轮胎软体解耦
## 任务 1.3: 网格绑定、挂载点/枢轴点对齐
## 严格 Godot 4.x GDScript
class_name VehicleBuilder
extends RefCounted

## 构建结果
class BuildResult:
	var root: Node3D = null
	var body_rigidbody: RigidBody3D = null
	var wheel_nodes: Array = []  # Array of WheelAssembly
	var node_map: Dictionary = {}  # node_id → Vector3 (Godot coords)
	var errors: Array = []

class WheelAssembly:
	var wheel_name: String = ""
	var hub_rigidbody: RigidBody3D = null
	var softbody: SoftBody3D = null
	var collision_shape: CollisionShape3D = null
	var physics_material: PhysicsMaterial = null
	var pivot_point: Vector3 = Vector3.ZERO
	var steering_axis: Vector3 = Vector3.UP
	var is_front: bool = false
	var is_left: bool = false
	var radius: float = 0.305
	var width: float = 0.205

## 从解析结果构建完整车辆节点树
static func build_vehicle(parts: Array) -> BuildResult:
	var result := BuildResult.new()
	result.root = Node3D.new()
	result.root.name = "CCF_Vehicle"

	# 1. 收集所有节点坐标（合并所有 part）
	var all_nodes: Dictionary = {}  # id → NodeData
	var all_beams: Array = []
	var all_flexbodies: Array = []
	var all_wheels: Array = []
	var engine_data: Dictionary = {}
	var gearbox_data: Dictionary = {}

	for part in parts:
		var p = part  # JBeamParser.ParsedPart
		for nd in p.nodes:
			all_nodes[nd.id] = nd
			result.node_map[nd.id] = nd.pos
		all_beams.append_array(p.beams)
		all_flexbodies.append_array(p.flexbodies)
		all_wheels.append_array(p.pressure_wheels)
		if not p.engine_data.is_empty():
			engine_data = p.engine_data
		if not p.gearbox_data.is_empty():
			gearbox_data = p.gearbox_data

	# 2. 构建车身刚体
	result.body_rigidbody = _build_body_rigidbody(all_nodes, all_beams, result)
	result.root.add_child(result.body_rigidbody)

	# 3. 构建轮胎软体组件
	var wheel_configs := _identify_wheel_positions(all_nodes, all_wheels)
	for wc in wheel_configs:
		var assembly := _build_wheel_assembly(wc, all_nodes, result)
		if assembly != null:
			result.wheel_nodes.append(assembly)
			result.root.add_child(assembly.hub_rigidbody)

	# 4. 构建悬挂约束（Generic6DOFJoint3D）
	_build_suspension_joints(result, all_nodes)

	# 5. 绑定网格（MeshInstance3D 占位 + 挂载点标记）
	_bind_meshes(result, all_flexbodies, all_nodes)

	return result

## 构建车身 RigidBody3D + 凸包碰撞体
static func _build_body_rigidbody(
	all_nodes: Dictionary, all_beams: Array, result: BuildResult
) -> RigidBody3D:
	var body := RigidBody3D.new()
	body.name = "BodyRigidBody"
	body.mass = _calculate_body_mass(all_nodes)
	body.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	body.center_of_mass = _calculate_com(all_nodes)
	# 惯性张量（简化为包围盒估算）
	var aabb := _calculate_aabb(all_nodes)
	body.inertia = _estimate_inertia(body.mass, aabb)
	# 物理材质：车身金属
	var body_mat := PhysicsMaterial.new()
	body_mat.friction = 0.5
	body_mat.bounce = 0.1
	body.physics_material_override = body_mat

	# 碰撞体：凸包（从车身节点生成）
	var col := CollisionShape3D.new()
	col.name = "BodyCollision"
	var hull := _generate_convex_hull(all_nodes)
	var shape := ConvexPolygonShape3D.new()
	shape.points = hull
	col.shape = shape
	body.add_child(col)

	# 附加碰撞体：底盘平板（补充底部碰撞）
	var floor_col := CollisionShape3D.new()
	floor_col.name = "FloorCollision"
	var floor_shape := BoxShape3D.new()
	var floor_size := Vector3(
		aabb.size.x * 0.85,
		0.08,
		aabb.size.z * 0.9
	)
	floor_shape.size = floor_size
	floor_col.shape = floor_shape
	floor_col.position = Vector3(0, aabb.position.y + 0.04, aabb.position.z + aabb.size.z * 0.5)
	body.add_child(floor_col)

	return body

## 计算车身总质量（所有节点权重之和，排除轮胎节点）
static func _calculate_body_mass(all_nodes: Dictionary) -> float:
	var total: float = 0.0
	for id in all_nodes:
		var nd = all_nodes[id]
		# 排除轮胎相关节点（以 w/tire 开头的组）
		var is_wheel := false
		for g in nd.groups:
			var gs: String = str(g).to_lower()
			if gs.contains("wheel") or gs.contains("tire") or gs.contains("hub"):
				is_wheel = true
				break
		if not is_wheel:
			total += nd.weight
	# 缩放因子（JBeam scaleNodeWeight = 0.8）
	return total * 0.8

## 计算质心
static func _calculate_com(all_nodes: Dictionary) -> Vector3:
	var weighted_sum := Vector3.ZERO
	var total_mass: float = 0.0
	for id in all_nodes:
		var nd = all_nodes[id]
		weighted_sum += nd.pos * nd.weight
		total_mass += nd.weight
	if total_mass > 0.0:
		return weighted_sum / total_mass
	return Vector3.ZERO

## 计算包围盒
static func _calculate_aabb(all_nodes: Dictionary) -> AABB:
	if all_nodes.is_empty():
		return AABB()
	var first = true
	var min_v := Vector3.INF
	var max_v := Vector3(-INF, -INF, -INF)
	for id in all_nodes:
		var nd = all_nodes[id]
		if first:
			min_v = nd.pos
			max_v = nd.pos
			first = false
		else:
			min_v = min_v.min(nd.pos)
			max_v = max_v.max(nd.pos)
	return AABB(min_v, max_v - min_v)

## 估算惯性张量（实心长方体近似）
static func _estimate_inertia(mass: float, aabb: AABB) -> Vector3:
	var w := aabb.size.x
	var h := aabb.size.y
	var d := aabb.size.z
	var ix := mass / 12.0 * (h * h + d * d)
	var iy := mass / 12.0 * (w * w + d * d)
	var iz := mass / 12.0 * (w * w + h * h)
	return Vector3(ix, iy, iz)

## 生成凸包点集（简化：取所有碰撞节点坐标）
static func _generate_convex_hull(all_nodes: Dictionary) -> PackedVector3Array:
	var points := PackedVector3Array()
	for id in all_nodes:
		var nd = all_nodes[id]
		if nd.collision:
			points.append(nd.pos)
	return points

## 识别轮位（从前/后悬挂节点推断）
class WheelConfig:
	var position: Vector3 = Vector3.ZERO
	var is_front: bool = false
	var is_left: bool = false
	var radius: float = 0.305
	var width: float = 0.205
	var hub_node_ids: Array = []
	var steering_node_ids: Array = []
	var pressure_wheel_data = null

static func _identify_wheel_positions(all_nodes: Dictionary, wheels: Array) -> Array:
	var configs: Array = []
	# CCF 轮位定义（从 JBeam 节点提取）
	# 前左: fh1l(0.6794, -1.1993, 0.19668) → hub中心约 fh5l(0.65532, -1.1006, 0.28525)
	# 前右: fh1r(-0.6794, -1.1993, 0.19668) → fh5r(-0.65532, -1.1006, 0.28525)
	# 后左: rh1l(0.6794, 1.1204, 0.19668)
	# 后右: rh1r(-0.6794, 1.1204, 0.19668)
	var wheel_defs := [
		{"name": "FL", "hub_ids": ["fh5l", "fh1l", "fh4l", "fw2l"], "front": true, "left": true},
		{"name": "FR", "hub_ids": ["fh5r", "fh1r", "fh4r", "fw2r"], "front": true, "left": false},
		{"name": "RL", "hub_ids": ["rh1l", "rh4l", "rw2l", "rh5l"], "front": false, "left": true},
		{"name": "RR", "hub_ids": ["rh1r", "rh4r", "rw2r", "rh5r"], "front": false, "left": false},
	]
	# 轮胎参数（从 pressureWheels 或默认值）
	var tire_radius: float = 0.305
	var tire_width: float = 0.205
	if not wheels.is_empty():
		tire_radius = wheels[0].radius
		tire_width = wheels[0].tire_width

	for wd in wheel_defs:
		var wc := WheelConfig.new()
		wc.is_front = wd["front"]
		wc.is_left = wd["left"]
		wc.radius = tire_radius
		wc.width = tire_width
		wc.hub_node_ids = wd["hub_ids"]
		# 计算轮心位置（hub 节点均值）
		var sum := Vector3.ZERO
		var count := 0
		for nid in wd["hub_ids"]:
			if all_nodes.has(nid):
				sum += all_nodes[nid].pos
				count += 1
		if count > 0:
			wc.position = sum / float(count)
		else:
			# 回退：使用已知坐标
			match wd["name"]:
				"FL": wc.position = JBeamParser.beamng_to_godot(0.65532, -1.1006, 0.28525)
				"FR": wc.position = JBeamParser.beamng_to_godot(-0.65532, -1.1006, 0.28525)
				"RL": wc.position = JBeamParser.beamng_to_godot(0.6794, 1.1204, 0.291)
				"RR": wc.position = JBeamParser.beamng_to_godot(-0.6794, 1.1204, 0.291)
		# 关联 pressureWheel 数据
		if not wheels.is_empty():
			wc.pressure_wheel_data = wheels[0]
		configs.append(wc)
	return configs

## 构建单个轮胎组件（SoftBody3D + RigidBody3D hub）
static func _build_wheel_assembly(
	wc: WheelConfig, all_nodes: Dictionary, result: BuildResult
) -> WheelAssembly:
	var assembly := WheelAssembly.new()
	assembly.wheel_name = ("FL" if wc.is_front else "RL") if wc.is_left else ("FR" if wc.is_front else "RR")
	assembly.is_front = wc.is_front
	assembly.is_left = wc.is_left
	assembly.radius = wc.radius
	assembly.width = wc.width
	assembly.pivot_point = wc.position

	# --- Hub RigidBody3D（轮毂刚体，承载物理交互）---
	var hub := RigidBody3D.new()
	hub.name = "WheelHub_" + assembly.wheel_name
	hub.position = wc.position
	hub.mass = 12.0  # 轮毂+制动盘约12kg
	hub.can_sleep = false
	# 轮毂碰撞（圆柱体）
	var hub_col := CollisionShape3D.new()
	hub_col.name = "HubCollision"
	var cyl_shape := CylinderShape3D.new()
	cyl_shape.radius = wc.radius * 0.6
	cyl_shape.height = wc.width * 0.5
	hub_col.shape = cyl_shape
	# 圆柱体默认 Y 轴对齐，需旋转使轴线朝 X（横向）
	hub_col.rotation_degrees = Vector3(0, 0, 90)
	hub.add_child(hub_col)
	assembly.hub_rigidbody = hub

	# --- SoftBody3D 轮胎（高摩擦物理材质）---
	var soft := SoftBody3D.new()
	soft.name = "TireSoftBody_" + assembly.wheel_name
	# 物理材质：friction >= 1.2, rough = true
	var tire_mat := PhysicsMaterial.new()
	tire_mat.friction = 1.4  # 高摩擦系数（橡胶对沥青）
	tire_mat.rough = true
	tire_mat.bounce = 0.05
	soft.physics_material_override = tire_mat
	assembly.physics_material = tire_mat
	# 生成轮胎环形网格
	var tire_mesh := _generate_tire_mesh(wc.radius, wc.width, 24, 12)
	soft.mesh = tire_mesh
	soft.position = wc.position
	# SoftBody 参数
	soft.total_mass = 9.0  # 轮胎约9kg
	soft.linear_stiffness = 0.8
	soft.pressure_coefficient = 1.0
	soft.damping_coefficient = 0.05
	soft.drag_coefficient = 0.02
	hub.add_child(soft)
	assembly.softbody = soft

	# --- 轮胎碰撞体（ torus 近似为多段圆柱）---
	var tire_col := CollisionShape3D.new()
	tire_col.name = "TireCollision"
	var tire_shape := CylinderShape3D.new()
	tire_shape.radius = wc.radius
	tire_shape.height = wc.width
	tire_col.shape = tire_shape
	tire_col.rotation_degrees = Vector3(0, 0, 90)  # 轴线朝X
	hub.add_child(tire_col)
	assembly.collision_shape = tire_col

	# --- 转向枢轴点标记（前轮）---
	if wc.is_front:
		# 转向枢轴：从 fw2 (tie rod end) 到 fh4 (upper ball joint) 的连线
		# 即 KPI 轴线
		var pivot_marker := Marker3D.new()
		pivot_marker.name = "SteeringPivot"
		# 转向轴线方向（上球铰→下球铰，近似垂直偏KPI角）
		assembly.steering_axis = Vector3(0, 1, 0).normalized()
		pivot_marker.position = Vector3.ZERO
		hub.add_child(pivot_marker)

	return assembly

## 生成轮胎环形网格（程序化 torus）
static func _generate_tire_mesh(
	radius: float, width: float, segments_radial: int, segments_tube: int
) -> ArrayMesh:
	var mesh := ArrayMesh.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tube_radius: float = width * 0.5
	for i in range(segments_radial):
		var theta: float = TAU * float(i) / float(segments_radial)
		var theta_next: float = TAU * float(i + 1) / float(segments_radial)
		for j in range(segments_tube):
			var phi: float = TAU * float(j) / float(segments_tube)
			var phi_next: float = TAU * float(j + 1) / float(segments_tube)
			# 四个顶点
			var p00 := _torus_point(radius, tube_radius, theta, phi)
			var p10 := _torus_point(radius, tube_radius, theta_next, phi)
			var p11 := _torus_point(radius, tube_radius, theta_next, phi_next)
			var p01 := _torus_point(radius, tube_radius, theta, phi_next)
			# 法线
			var n00 := _torus_normal(radius, theta, phi)
			var n10 := _torus_normal(radius, theta_next, phi)
			var n11 := _torus_normal(radius, theta_next, phi_next)
			var n01 := _torus_normal(radius, theta, phi_next)
			# UV
			var u0: float = float(i) / float(segments_radial)
			var u1: float = float(i + 1) / float(segments_radial)
			var v0: float = float(j) / float(segments_tube)
			var v1: float = float(j + 1) / float(segments_tube)
			# 三角形 1
			st.set_normal(n00)
			st.set_uv(Vector2(u0, v0))
			st.add_vertex(p00)
			st.set_normal(n10)
			st.set_uv(Vector2(u1, v0))
			st.add_vertex(p10)
			st.set_normal(n11)
			st.set_uv(Vector2(u1, v1))
			st.add_vertex(p11)
			# 三角形 2
			st.set_normal(n00)
			st.set_uv(Vector2(u0, v0))
			st.add_vertex(p00)
			st.set_normal(n11)
			st.set_uv(Vector2(u1, v1))
			st.add_vertex(p11)
			st.set_normal(n01)
			st.set_uv(Vector2(u0, v1))
			st.add_vertex(p01)
	st.commit(mesh)
	return mesh

static func _torus_point(major_r: float, minor_r: float, theta: float, phi: float) -> Vector3:
	# 轮胎轴线朝 X（横向），所以 torus 在 YZ 平面旋转
	var x: float = minor_r * cos(phi)
	var y: float = (major_r + minor_r * sin(phi)) * cos(theta)
	var z: float = (major_r + minor_r * sin(phi)) * sin(theta)
	return Vector3(x, y, z)

static func _torus_normal(major_r: float, theta: float, phi: float) -> Vector3:
	var nx: float = cos(phi)
	var ny: float = sin(phi) * cos(theta)
	var nz: float = sin(phi) * sin(theta)
	return Vector3(nx, ny, nz).normalized()

## 构建悬挂约束（Generic6DOFJoint3D 连接车身与轮毂）
static func _build_suspension_joints(result: BuildResult, all_nodes: Dictionary) -> void:
	for assembly in result.wheel_nodes:
		var joint := Generic6DOFJoint3D.new()
		joint.name = "SuspensionJoint_" + assembly.wheel_name
		# 关节位置：轮毂中心
		joint.position = assembly.pivot_point
		# 连接 body A（车身）和 body B（轮毂）
		joint.node_a = result.body_rigidbody.get_path()
		joint.node_b = assembly.hub_rigidbody.get_path()
		# 悬挂行程约束
		# Y 轴（上下）：允许弹簧行程 ±0.12m
		joint.set_param_y(Generic6DOFJoint3D.PARAM_LINEAR_LOWER_LIMIT, -0.12)
		joint.set_param_y(Generic6DOFJoint3D.PARAM_LINEAR_UPPER_LIMIT, 0.08)
		joint.set_param_y(Generic6DOFJoint3D.PARAM_LINEAR_SPRING_STIFFNESS, 35000.0)
		joint.set_param_y(Generic6DOFJoint3D.PARAM_LINEAR_SPRING_DAMPING, 4500.0)
		joint.set_param_y(Generic6DOFJoint3D.PARAM_LINEAR_SPRING_EQUILIBRIUM_POINT, -0.02)
		joint.set_flag_y(Generic6DOFJoint3D.FLAG_ENABLE_LINEAR_LIMIT, true)
		joint.set_flag_y(Generic6DOFJoint3D.FLAG_ENABLE_LINEAR_SPRING, true)
		# X 轴（横向）：锁定
		joint.set_param_x(Generic6DOFJoint3D.PARAM_LINEAR_LOWER_LIMIT, 0.0)
		joint.set_param_x(Generic6DOFJoint3D.PARAM_LINEAR_UPPER_LIMIT, 0.0)
		joint.set_flag_x(Generic6DOFJoint3D.FLAG_ENABLE_LINEAR_LIMIT, true)
		# Z 轴（纵向）：锁定
		joint.set_param_z(Generic6DOFJoint3D.PARAM_LINEAR_LOWER_LIMIT, 0.0)
		joint.set_param_z(Generic6DOFJoint3D.PARAM_LINEAR_UPPER_LIMIT, 0.0)
		joint.set_flag_z(Generic6DOFJoint3D.FLAG_ENABLE_LINEAR_LIMIT, true)
		# 旋转：允许绕 X 轴自由旋转（车轮转动）
		joint.set_flag_x(Generic6DOFJoint3D.FLAG_ENABLE_ANGULAR_LIMIT, false)
		# 绕 Y 轴（转向）：前轮允许 ±35°，后轮锁定
		if assembly.is_front:
			joint.set_param_y(Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, deg_to_rad(-35.0))
			joint.set_param_y(Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, deg_to_rad(35.0))
			joint.set_flag_y(Generic6DOFJoint3D.FLAG_ENABLE_ANGULAR_LIMIT, true)
		else:
			joint.set_param_y(Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, 0.0)
			joint.set_param_y(Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, 0.0)
			joint.set_flag_y(Generic6DOFJoint3D.FLAG_ENABLE_ANGULAR_LIMIT, true)
		# 绕 Z 轴：锁定（外倾角由初始几何决定）
		joint.set_param_z(Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, deg_to_rad(-2.0))
		joint.set_param_z(Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, deg_to_rad(2.0))
		joint.set_flag_z(Generic6DOFJoint3D.FLAG_ENABLE_ANGULAR_LIMIT, true)
		result.root.add_child(joint)

## 绑定网格（任务 1.3）
## 将 .dae 网格引用绑定至节点树，设置挂载点
static func _bind_meshes(result: BuildResult, flexbodies: Array, all_nodes: Dictionary) -> void:
	# 车身网格挂载
	var body_mesh_holder := Node3D.new()
	body_mesh_holder.name = "BodyMeshes"
	result.body_rigidbody.add_child(body_mesh_holder)
	for fb in flexbodies:
		var mesh_inst := MeshInstance3D.new()
		mesh_inst.name = "Mesh_" + fb.mesh_name
		# 网格文件路径（.dae 需导入为 .res/.tres）
		mesh_inst.set_meta("source_dae", fb.mesh_name + ".dae")
		mesh_inst.set_meta("flex_groups", fb.groups)
		# 应用偏移变换
		mesh_inst.position = fb.offset_pos
		mesh_inst.rotation_degrees = fb.offset_rot
		mesh_inst.scale = fb.offset_scale
		body_mesh_holder.add_child(mesh_inst)

	# 轮胎网格挂载
	for assembly in result.wheel_nodes:
		var tire_mesh_holder := Node3D.new()
		tire_mesh_holder.name = "TireMesh_" + assembly.wheel_name
		assembly.hub_rigidbody.add_child(tire_mesh_holder)
		# 轮胎 .dae 引用
		var tire_inst := MeshInstance3D.new()
		tire_inst.name = "TireMeshInstance"
		tire_inst.set_meta("source_dae", "ccftires.dae")
		tire_inst.set_meta("wheel_position", assembly.wheel_name)
		tire_mesh_holder.add_child(tire_inst)

	# 挂载点标记（Mounting Points）
	_build_mount_points(result, all_nodes)

## 构建挂载点标记（转向枢轴、悬挂球铰、发动机吊点等）
static func _build_mount_points(result: BuildResult, all_nodes: Dictionary) -> void:
	var mounts := Node3D.new()
	mounts.name = "MountingPoints"
	result.root.add_child(mounts)
	# 关键挂载点定义
	var mount_defs := {
		# 前悬挂球铰
		"BallJoint_FL_Upper": "fh4l",
		"BallJoint_FL_Lower": "fh1l",
		"BallJoint_FR_Upper": "fh4r",
		"BallJoint_FR_Lower": "fh1r",
		# 后悬挂球铰
		"BallJoint_RL_Upper": "rh4l",
		"BallJoint_RL_Lower": "rh1l",
		"BallJoint_RR_Upper": "rh4r",
		"BallJoint_RR_Lower": "rh1r",
		# 转向拉杆端
		"TieRod_FL": "fw2l",
		"TieRod_FR": "fw2r",
		# 减震器塔顶
		"ShockTop_FL": "fs1l",
		"ShockTop_FR": "fs1r",
		"ShockTop_RL": "rs1l",
		"ShockTop_RR": "rs1r",
		# 减震器底部
		"ShockBottom_FL": "fh2l",
		"ShockBottom_FR": "fh2r",
		"ShockBottom_RL": "rh2l",
		"ShockBottom_RR": "rh2r",
		# 发动机吊点
		"EngineMount_L": "e1l",
		"EngineMount_R": "e1r",
		# 变速箱
		"Transmission": "tra1",
		# 转向机
		"SteeringRack_L": "fx5l",
		"SteeringRack_R": "fx5r",
	}
	for mount_name in mount_defs:
		var node_id: String = mount_defs[mount_name]
		if all_nodes.has(node_id):
			var marker := Marker3D.new()
			marker.name = mount_name
			marker.position = all_nodes[node_id].pos
			marker.set_meta("beamng_node_id", node_id)
			mounts.add_child(marker)
