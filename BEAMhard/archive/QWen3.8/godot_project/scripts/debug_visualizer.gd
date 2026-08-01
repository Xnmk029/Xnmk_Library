extends Node3D

func _ready() -> void:
	_fix_wheels()
	_color_wheels()
	_transparent_body()
	_mount_spheres()
	_suspension_lines()
	_frame_lines()
	_axes()
	_grid()

func _fix_wheels() -> void:
	var v := get_node_or_null("CCF_Vehicle")
	if not v:
		return
	for c in v.get_children():
		if c.name.begins_with("WheelHub_"):
			var tm := c.get_node_or_null("TireMesh")
			if tm:
				tm.rotation_degrees = Vector3(0, 0, 90)
			var tc := c.get_node_or_null("TireCollision")
			if tc:
				tc.rotation_degrees = Vector3(0, 0, 90)

func _color_wheels() -> void:
	var v := get_node_or_null("CCF_Vehicle")
	if not v:
		return
	for c in v.get_children():
		if c.name.begins_with("WheelHub_"):
			var tm := c.get_node_or_null("TireMesh")
			if tm and tm is MeshInstance3D:
				var m := StandardMaterial3D.new()
				m.albedo_color = Color(0.1, 0.1, 0.12)
				m.roughness = 0.95
				tm.material_override = m

func _transparent_body() -> void:
	var bm := get_node_or_null("CCF_Vehicle/BodyRigidBody/BodyMesh")
	if bm and bm is MeshInstance3D:
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.4, 0.55, 0.75, 0.3)
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.roughness = 0.3
		m.metallic = 0.5
		bm.material_override = m

func _mount_spheres() -> void:
	var mounts := get_node_or_null("CCF_Vehicle/MountingPoints")
	if not mounts:
		return
	var sp := SphereMesh.new()
	sp.radius = 0.06
	sp.height = 0.12
	for mk in mounts.get_children():
		if mk is Marker3D:
			var mi := MeshInstance3D.new()
			mi.mesh = sp
			var m := StandardMaterial3D.new()
			var col := Color.WHITE
			var n: String = mk.name
			if n.begins_with("BallJoint"):
				col = Color(1, 0.15, 0.15)
			elif n.begins_with("TieRod"):
				col = Color(0.1, 1, 0.3)
			elif n.begins_with("ShockTop"):
				col = Color(0.2, 0.5, 1)
			elif n.begins_with("Steering"):
				col = Color(1, 0.9, 0)
			elif n.begins_with("Transmission"):
				col = Color(1, 0.5, 0)
			m.albedo_color = col
			m.emission_enabled = true
			m.emission = col
			m.emission_energy_multiplier = 2.0
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			mi.material_override = m
			mk.add_child(mi)

func _suspension_lines() -> void:
	var v := get_node_or_null("CCF_Vehicle")
	if not v:
		return
	var mounts := v.get_node_or_null("MountingPoints")
	if not mounts:
		return
	var pairs := [
		["ShockTop_FL", "WheelHub_FL", Color(0.3, 0.7, 1)],
		["ShockTop_FR", "WheelHub_FR", Color(0.3, 0.7, 1)],
		["ShockTop_RL", "WheelHub_RL", Color(0.3, 0.7, 1)],
		["ShockTop_RR", "WheelHub_RR", Color(0.3, 0.7, 1)],
		["BallJoint_FL_Upper", "BallJoint_FL_Lower", Color(1, 0.3, 0.3)],
		["BallJoint_FR_Upper", "BallJoint_FR_Lower", Color(1, 0.3, 0.3)],
		["TieRod_FL", "SteeringRack_L", Color(0.2, 1, 0.3)],
		["TieRod_FR", "SteeringRack_R", Color(0.2, 1, 0.3)],
	]
	for p in pairs:
		var a := mounts.get_node_or_null(p[0])
		var b_node := v.get_node_or_null(p[1])
		if not b_node:
			b_node = mounts.get_node_or_null(p[1])
		if a and b_node:
			_cylinder_line(v, a.position, b_node.position, p[2], 0.012)

func _frame_lines() -> void:
	var body := get_node_or_null("CCF_Vehicle/BodyRigidBody")
	if not body:
		return
	var wp := [
		Vector3(0.655, -0.215, 1.1),
		Vector3(-0.655, -0.215, 1.1),
		Vector3(0.679, -0.209, -1.12),
		Vector3(-0.679, -0.209, -1.12),
	]
	var gray := Color(0.55, 0.55, 0.55)
	_cylinder_line(body, wp[0], wp[1], gray, 0.008)
	_cylinder_line(body, wp[2], wp[3], gray, 0.008)
	_cylinder_line(body, wp[0], wp[2], gray, 0.008)
	_cylinder_line(body, wp[1], wp[3], gray, 0.008)

func _axes() -> void:
	var v := get_node_or_null("CCF_Vehicle")
	if not v:
		return
	var o := Vector3(0, 0.02, 0)
	_cylinder_line(v, o, o + Vector3(2, 0, 0), Color(1, 0.2, 0.2), 0.015)
	_cylinder_line(v, o, o + Vector3(0, 2, 0), Color(0.2, 1, 0.2), 0.015)
	_cylinder_line(v, o, o + Vector3(0, 0, 2), Color(0.3, 0.3, 1), 0.015)

func _grid() -> void:
	var g := Node3D.new()
	g.name = "Grid"
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.3, 0.3, 0.35)
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	for i in range(-5, 6):
		var fi := float(i)
		var a := MeshInstance3D.new()
		var im := ImmediateMesh.new()
		im.surface_begin(Mesh.PRIMITIVE_LINES)
		im.surface_add_vertex(Vector3(fi, 0.005, -5))
		im.surface_add_vertex(Vector3(fi, 0.005, 5))
		im.surface_end()
		a.mesh = im
		a.material_override = m
		g.add_child(a)
		var b := MeshInstance3D.new()
		var im2 := ImmediateMesh.new()
		im2.surface_begin(Mesh.PRIMITIVE_LINES)
		im2.surface_add_vertex(Vector3(-5, 0.005, fi))
		im2.surface_add_vertex(Vector3(5, 0.005, fi))
		im2.surface_end()
		b.mesh = im2
		b.material_override = m
		g.add_child(b)
	add_child(g)

func _cylinder_line(parent: Node3D, from: Vector3, to: Vector3, color: Color, radius: float) -> void:
	var d := to - from
	var seg_len := d.length()
	if seg_len < 0.001:
		return
	var mi := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = radius
	cy.bottom_radius = radius
	cy.height = seg_len
	mi.mesh = cy
	mi.position = (from + to) * 0.5
	var dir := d / len
	var y_axis := Vector3.UP
	var dot_val: float = clamp(y_axis.dot(dir), -1.0, 1.0)
	if abs(dot_val) < 0.9999:
		var rot_axis := y_axis.cross(dir).normalized()
		var rot_angle: float = acos(dot_val)
		var q := Quaternion(rot_axis, rot_angle)
		mi.transform.basis = Basis(q)
	elif dot_val < 0:
		mi.rotation_degrees = Vector3(180, 0, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 1.5
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mi.material_override = mat
	parent.add_child(mi)
