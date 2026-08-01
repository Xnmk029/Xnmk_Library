## jbeam_parser.gd — BeamNG JBeam 结构解析器
## 任务 1.1: 解包 .jbeam 文件，提取节点/梁/网格/轮胎定义
## 严格 Godot 4.x GDScript，无 C# 语法混入
class_name JBeamParser
extends RefCounted

## BeamNG 坐标系 → Godot 坐标系映射
## BeamNG: X=右, Y=前(负方向为车头), Z=上
## Godot:  X=右, Y=上, Z=后(负方向为车头)
## 转换: godot(x, y, z) = beamng(x, z, -y)
static func beamng_to_godot(bx: float, by: float, bz: float) -> Vector3:
	return Vector3(bx, bz, -by)

## 解析结果数据结构
class ParsedPart:
	var part_name: String = ""
	var information: Dictionary = {}
	var slot_type: String = ""
	var nodes: Array = []        # Array of NodeData
	var beams: Array = []        # Array of BeamData
	var torsionbars: Array = []  # Array of TorsionBarData
	var flexbodies: Array = []   # Array of FlexBodyData
	var pressure_wheels: Array = [] # Array of PressureWheelData
	var ref_nodes: Dictionary = {}
	var camera_chase: Dictionary = {}
	var variables: Array = []
	var slots: Array = []
	var controllers: Array = []
	var powertrain: Array = []
	var engine_data: Dictionary = {}
	var gearbox_data: Dictionary = {}

class NodeData:
	var id: String = ""
	var pos: Vector3 = Vector3.ZERO  # 已转换为 Godot 坐标
	var pos_beamng: Vector3 = Vector3.ZERO  # 原始 BeamNG 坐标
	var weight: float = 5.0
	var friction_coef: float = 0.5
	var collision: bool = true
	var self_collision: bool = true
	var groups: Array = []
	var node_material: String = ""
	var tag: String = ""
	var chem_energy: float = 0.0

class BeamData:
	var id1: String = ""
	var id2: String = ""
	var spring: float = 100000.0
	var damp: float = 100.0
	var deform: float = 10000.0
	var strength: float = 999999.0  # FLT_MAX 等效
	var precompression: float = 1.0
	var beam_type: String = "NORMAL"
	var long_bound: float = 1.0
	var short_bound: float = 1.0
	var break_group: String = ""
	var deform_group: String = ""
	var optional: bool = false
	var name: String = ""
	var bound_zone: float = 0.0
	var limit_spring: float = 0.0
	var limit_damp: float = 0.0

class TorsionBarData:
	var id1: String = ""
	var id2: String = ""
	var id3: String = ""
	var id4: String = ""
	var spring: float = 100000.0
	var damp: float = 5.0
	var deform: float = 6000.0
	var strength: float = 100000.0

class FlexBodyData:
	var mesh_name: String = ""
	var groups: Array = []
	var non_flex_materials: Array = []
	var offset_pos: Vector3 = Vector3.ZERO
	var offset_rot: Vector3 = Vector3.ZERO
	var offset_scale: Vector3 = Vector3.ONE

class PressureWheelData:
	var name: String = ""
	var hub_group: String = ""
	var group: String = ""
	var node1: String = ""
	var node2: String = ""
	var node_s: String = ""
	var node_arm: String = ""
	var wheel_dir: String = ""
	var radius: float = 0.305
	var tire_width: float = 0.205
	var node_weight: float = 0.16
	var friction_coef: float = 1.0
	var sliding_friction_coef: float = 1.0
	var pressure_psi: float = 30.0
	var drag_coef: float = 5.0
	var has_tire: bool = true
	var side_beam_spring: float = 24900.0
	var side_beam_damp: float = 15.0
	var tread_beam_spring: float = 261000.0
	var tread_beam_damp: float = 65.0
	var periphery_beam_spring: float = 181000.0
	var periphery_beam_damp: float = 35.0
	var no_load_coef: float = 1.52
	var load_sensitivity_slope: float = 0.00018
	var full_load_coef: float = 0.5
	var softness_coef: float = 0.7

## 主解析入口：从文件路径加载并解析 .jbeam
static func parse_file(file_path: String) -> Array:
	var file := FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		push_error("JBeamParser: 无法打开文件 " + file_path)
		return []
	var raw_text := file.get_as_text()
	file.close()
	return parse_text(raw_text)

## 从文本解析（支持多 part 文件）
static func parse_text(raw_text: String) -> Array:
	var clean := _strip_comments(raw_text)
	var json := JSON.new()
	var err := json.parse(clean)
	if err != OK:
		push_error("JBeamParser: JSON 解析失败 @ line %d: %s" % [json.get_error_line(), json.get_error_message()])
		return []
	var root: Dictionary = json.data
	var results: Array = []
	for part_name in root.keys():
		var part_data: Dictionary = root[part_name]
		if part_data is Dictionary:
			var parsed := _parse_part(part_name, part_data)
			results.append(parsed)
	return results

## 剥离 // 行注释和 /* */ 块注释（JBeam 非标准 JSON）
static func _strip_comments(text: String) -> String:
	var result := ""
	var i := 0
	var len := text.length()
	var in_string := false
	var escape_next := false
	while i < len:
		var ch := text[i]
		if escape_next:
			result += ch
			escape_next = false
			i += 1
			continue
		if ch == "\\" and in_string:
			result += ch
			escape_next = true
			i += 1
			continue
		if ch == "\"":
			in_string = !in_string
			result += ch
			i += 1
			continue
		if not in_string:
			# 行注释
			if ch == "/" and i + 1 < len and text[i + 1] == "/":
				while i < len and text[i] != "\n":
					i += 1
				continue
			# 块注释
			if ch == "/" and i + 1 < len and text[i + 1] == "*":
				i += 2
				while i + 1 < len and not (text[i] == "*" and text[i + 1] == "/"):
					i += 1
				i += 2
				continue
		result += ch
		i += 1
	# 修复尾逗号 (trailing comma before } or ])
	result = _fix_trailing_commas(result)
	return result

## 修复 JSON 尾逗号
static func _fix_trailing_commas(text: String) -> String:
	var result := ""
	var i := 0
	var len := text.length()
	var in_string := false
	var escape_next := false
	while i < len:
		var ch := text[i]
		if escape_next:
			result += ch
			escape_next = false
			i += 1
			continue
		if ch == "\\" and in_string:
			result += ch
			escape_next = true
			i += 1
			continue
		if ch == "\"":
			in_string = !in_string
			result += ch
			i += 1
			continue
		if not in_string and ch == ",":
			# 前瞻：跳过空白后若为 } 或 ] 则吃掉逗号
			var j := i + 1
			while j < len and (text[j] == " " or text[j] == "\t" or text[j] == "\n" or text[j] == "\r"):
				j += 1
			if j < len and (text[j] == "}" or text[j] == "]"):
				i += 1
				continue
		result += ch
		i += 1
	return result

## 解析单个 part
static func _parse_part(part_name: String, data: Dictionary) -> ParsedPart:
	var part := ParsedPart.new()
	part.part_name = part_name
	if data.has("information"):
		part.information = data["information"]
	if data.has("slotType"):
		part.slot_type = data["slotType"]
	if data.has("slots"):
		part.slots = data["slots"]
	if data.has("variables"):
		part.variables = data["variables"]
	if data.has("refNodes"):
		part.ref_nodes = _parse_ref_nodes(data["refNodes"])
	if data.has("cameraChase"):
		part.camera_chase = data["cameraChase"]
	if data.has("controller"):
		part.controllers = data["controller"]
	if data.has("powertrain"):
		part.powertrain = data["powertrain"]
	# 引擎数据
	if data.has("mainEngine"):
		part.engine_data = data["mainEngine"]
	if data.has("gearbox"):
		part.gearbox_data = data["gearbox"]
	# 解析节点
	if data.has("nodes"):
		part.nodes = _parse_nodes(data["nodes"])
	# 解析梁
	if data.has("beams"):
		part.beams = _parse_beams(data["beams"])
	# 解析扭转杆
	if data.has("torsionbars"):
		part.torsionbars = _parse_torsionbars(data["torsionbars"])
	# 解析柔体网格
	if data.has("flexbodies"):
		part.flexbodies = _parse_flexbodies(data["flexbodies"])
	# 解析压力轮胎
	if data.has("pressureWheels"):
		part.pressure_wheels = _parse_pressure_wheels(data["pressureWheels"])
	return part

## 解析 refNodes
static func _parse_ref_nodes(arr: Array) -> Dictionary:
	var result := {}
	if arr.size() >= 2:
		var headers: Array = arr[0]
		var values: Array = arr[1]
		for idx in range(mini(headers.size(), values.size())):
			var key: String = str(headers[idx]).replace(":", "")
			result[key] = values[idx]
	return result

## 解析节点数组
static func _parse_nodes(arr: Array) -> Array:
	var nodes: Array = []
	if arr.is_empty():
		return nodes
	# 第一行为表头 ["id", "posX", "posY", "posZ"]
	var header_idx := 0
	# 状态变量（由 {} 行内联设置覆盖）
	var cur_weight: float = 5.0
	var cur_friction: float = 0.5
	var cur_collision: bool = true
	var cur_self_collision: bool = true
	var cur_group: Array = []
	var cur_material: String = ""
	for i in range(arr.size()):
		var row = arr[i]
		if row is Dictionary:
			# 内联属性覆盖
			if row.has("nodeWeight"):
				cur_weight = float(row["nodeWeight"])
			if row.has("frictionCoef"):
				cur_friction = float(row["frictionCoef"])
			if row.has("collision"):
				cur_collision = bool(row["collision"])
			if row.has("selfCollision"):
				cur_self_collision = bool(row["selfCollision"])
			if row.has("group"):
				var g = row["group"]
				if g is Array:
					cur_group = g
				elif g is String:
					cur_group = [g] if g != "" else []
				else:
					cur_group = []
			if row.has("nodeMaterial"):
				cur_material = str(row["nodeMaterial"])
			continue
		if row is Array and row.size() >= 4:
			# 跳过表头行
			if row[0] is String and str(row[0]).contains("id") and str(row[1]).contains("pos"):
				continue
			var nd := NodeData.new()
			nd.id = str(row[0])
			nd.pos_beamng = Vector3(float(row[1]), float(row[2]), float(row[3]))
			nd.pos = beamng_to_godot(nd.pos_beamng.x, nd.pos_beamng.y, nd.pos_beamng.z)
			nd.weight = cur_weight
			nd.friction_coef = cur_friction
			nd.collision = cur_collision
			nd.self_collision = cur_self_collision
			nd.groups = cur_group.duplicate()
			nd.node_material = cur_material
			# 第5个元素可能为内联字典（per-node 覆盖）
			if row.size() >= 5 and row[4] is Dictionary:
				var extra: Dictionary = row[4]
				if extra.has("group"):
					var g = extra["group"]
					if g is Array:
						nd.groups = g
					elif g is String:
						nd.groups = [g] if g != "" else []
				if extra.has("collision"):
					nd.collision = bool(extra["collision"])
				if extra.has("selfCollision"):
					nd.self_collision = bool(extra["selfCollision"])
				if extra.has("tag"):
					nd.tag = str(extra["tag"])
				if extra.has("chemEnergy"):
					nd.chem_energy = float(extra["chemEnergy"]) if extra["chemEnergy"] != false else 0.0
			nodes.append(nd)
	return nodes

## 解析梁数组
static func _parse_beams(arr: Array) -> Array:
	var beams: Array = []
	if arr.is_empty():
		return beams
	# 状态变量
	var cur_spring: float = 100000.0
	var cur_damp: float = 100.0
	var cur_deform: float = 10000.0
	var cur_strength: float = 999999.0
	var cur_precomp: float = 1.0
	var cur_type: String = "NORMAL"
	var cur_long_bound: float = 1.0
	var cur_short_bound: float = 1.0
	var cur_break_group: String = ""
	var cur_deform_group: String = ""
	var cur_optional: bool = false
	var cur_bound_zone: float = 0.0
	var cur_limit_spring: float = 0.0
	var cur_limit_damp: float = 0.0
	for i in range(arr.size()):
		var row = arr[i]
		if row is Dictionary:
			if row.has("beamSpring"):
				cur_spring = _to_float(row["beamSpring"])
			if row.has("beamDamp"):
				cur_damp = _to_float(row["beamDamp"])
			if row.has("beamDeform"):
				cur_deform = _to_float(row["beamDeform"])
			if row.has("beamStrength"):
				var s = row["beamStrength"]
				cur_strength = 999999.0 if str(s) == "FLT_MAX" else _to_float(s)
			if row.has("beamPrecompression"):
				cur_precomp = _to_float(row["beamPrecompression"])
			if row.has("beamType"):
				cur_type = str(row["beamType"]).replace("|", "")
			if row.has("beamLongBound"):
				cur_long_bound = _to_float(row["beamLongBound"])
			if row.has("beamShortBound"):
				cur_short_bound = _to_float(row["beamShortBound"])
			if row.has("breakGroup"):
				cur_break_group = str(row["breakGroup"]) if row["breakGroup"] != "" else ""
			if row.has("deformGroup"):
				cur_deform_group = str(row["deformGroup"]) if row["deformGroup"] != "" else ""
			if row.has("optional"):
				cur_optional = bool(row["optional"])
			if row.has("boundZone"):
				cur_bound_zone = _to_float(row["boundZone"]) if row["boundZone"] != "" else 0.0
			if row.has("beamLimitSpring"):
				cur_limit_spring = _to_float(row["beamLimitSpring"])
			if row.has("beamLimitDamp"):
				cur_limit_damp = _to_float(row["beamLimitDamp"])
			continue
		if row is Array and row.size() >= 2:
			# 跳过表头
			if row[0] is String and str(row[0]).contains("id1"):
				continue
			var bd := BeamData.new()
			bd.id1 = str(row[0])
			bd.id2 = str(row[1])
			bd.spring = cur_spring
			bd.damp = cur_damp
			bd.deform = cur_deform
			bd.strength = cur_strength
			bd.precompression = cur_precomp
			bd.beam_type = cur_type
			bd.long_bound = cur_long_bound
			bd.short_bound = cur_short_bound
			bd.break_group = cur_break_group
			bd.deform_group = cur_deform_group
			bd.optional = cur_optional
			bd.bound_zone = cur_bound_zone
			bd.limit_spring = cur_limit_spring
			bd.limit_damp = cur_limit_damp
			# 第3个元素可能为 per-beam 字典
			if row.size() >= 3 and row[2] is Dictionary:
				var extra: Dictionary = row[2]
				if extra.has("beamStrength"):
					var s = extra["beamStrength"]
					bd.strength = 999999.0 if str(s) == "FLT_MAX" else _to_float(s)
				if extra.has("name"):
					bd.name = str(extra["name"])
				if extra.has("boundZone"):
					bd.bound_zone = _to_float(extra["boundZone"])
			beams.append(bd)
	return beams

## 解析扭转杆
static func _parse_torsionbars(arr: Array) -> Array:
	var bars: Array = []
	var cur_spring: float = 100000.0
	var cur_damp: float = 5.0
	var cur_deform: float = 6000.0
	var cur_strength: float = 100000.0
	for i in range(arr.size()):
		var row = arr[i]
		if row is Dictionary:
			if row.has("spring"):
				cur_spring = _to_float(row["spring"])
			if row.has("damp"):
				cur_damp = _to_float(row["damp"])
			if row.has("deform"):
				cur_deform = _to_float(row["deform"])
			if row.has("strength"):
				cur_strength = _to_float(row["strength"])
			continue
		if row is Array and row.size() >= 4:
			if row[0] is String and str(row[0]).contains("id1"):
				continue
			var tb := TorsionBarData.new()
			tb.id1 = str(row[0])
			tb.id2 = str(row[1])
			tb.id3 = str(row[2])
			tb.id4 = str(row[3])
			tb.spring = cur_spring
			tb.damp = cur_damp
			tb.deform = cur_deform
			tb.strength = cur_strength
			bars.append(tb)
	return bars

## 解析柔体网格
static func _parse_flexbodies(arr: Array) -> Array:
	var bodies: Array = []
	for i in range(arr.size()):
		var row = arr[i]
		if row is Dictionary:
			continue  # 跳过属性行
		if row is Array and row.size() >= 2:
			if row[0] is String and str(row[0]) == "mesh":
				continue  # 表头
			var fb := FlexBodyData.new()
			fb.mesh_name = str(row[0])
			# groups 在 row[1]
			if row[1] is Array:
				fb.groups = row[1]
			# row[2] 可能为 nonFlexMaterials
			if row.size() >= 3 and row[2] is Array:
				fb.non_flex_materials = row[2]
			# row[3] 或更后可能为变换字典
			for k in range(3, row.size()):
				if row[k] is Dictionary:
					var t: Dictionary = row[k]
					if t.has("pos"):
						var p: Dictionary = t["pos"]
						fb.offset_pos = beamng_to_godot(
							float(p.get("x", 0)), float(p.get("y", 0)), float(p.get("z", 0)))
					if t.has("rot"):
						var r: Dictionary = t["rot"]
						fb.offset_rot = Vector3(
							float(r.get("x", 0)), float(r.get("y", 0)), float(r.get("z", 0)))
					if t.has("scale"):
						var s: Dictionary = t["scale"]
						fb.offset_scale = Vector3(
							float(s.get("x", 1)), float(s.get("y", 1)), float(s.get("z", 1)))
			bodies.append(fb)
	return bodies

## 解析压力轮胎
static func _parse_pressure_wheels(arr: Array) -> Array:
	var wheels: Array = []
	# 累积属性字典
	var props := {}
	for i in range(arr.size()):
		var row = arr[i]
		if row is Dictionary:
			props.merge(row, true)
			continue
		if row is Array:
			# 表头行或数据行
			if row.size() >= 1 and row[0] is String and str(row[0]) == "name":
				continue  # 表头
			# 数据行：每个数组定义一个轮位
			var pw := PressureWheelData.new()
			if row.size() >= 1:
				pw.name = str(row[0])
			if row.size() >= 2:
				pw.hub_group = str(row[1])
			if row.size() >= 3:
				pw.group = str(row[2])
			if row.size() >= 4:
				pw.node1 = str(row[3])
			if row.size() >= 5:
				pw.node2 = str(row[4])
			if row.size() >= 6:
				pw.node_s = str(row[5])
			if row.size() >= 7:
				pw.node_arm = str(row[6])
			if row.size() >= 8:
				pw.wheel_dir = str(row[7])
			# 从累积属性填充
			pw.radius = float(props.get("radius", 0.305))
			pw.tire_width = float(props.get("tireWidth", 0.205))
			pw.node_weight = float(props.get("nodeWeight", 0.16))
			pw.friction_coef = float(props.get("frictionCoef", 1.0))
			pw.sliding_friction_coef = float(props.get("slidingFrictionCoef", 1.0))
			pw.pressure_psi = _to_float(props.get("pressurePSI", 30.0))
			pw.drag_coef = float(props.get("dragCoef", 5.0))
			pw.has_tire = bool(props.get("hasTire", true))
			pw.side_beam_spring = _to_float(props.get("wheelSideBeamSpring", 24900.0))
			pw.side_beam_damp = float(props.get("wheelSideBeamDamp", 15.0))
			pw.tread_beam_spring = float(props.get("wheelTreadBeamSpring", 261000.0))
			pw.tread_beam_damp = float(props.get("wheelTreadBeamDamp", 65.0))
			pw.periphery_beam_spring = float(props.get("wheelPeripheryBeamSpring", 181000.0))
			pw.periphery_beam_damp = float(props.get("wheelPeripheryBeamDamp", 35.0))
			pw.no_load_coef = float(props.get("noLoadCoef", 1.52))
			pw.load_sensitivity_slope = float(props.get("loadSensitivitySlope", 0.00018))
			pw.full_load_coef = float(props.get("fullLoadCoef", 0.5))
			pw.softness_coef = float(props.get("softnessCoef", 0.7))
			wheels.append(pw)
	# 若无数据行但有属性（单轮定义），生成默认
	if wheels.is_empty() and not props.is_empty():
		var pw := PressureWheelData.new()
		pw.radius = float(props.get("radius", 0.305))
		pw.tire_width = float(props.get("tireWidth", 0.205))
		pw.node_weight = float(props.get("nodeWeight", 0.16))
		pw.friction_coef = float(props.get("frictionCoef", 1.0))
		pw.sliding_friction_coef = float(props.get("slidingFrictionCoef", 1.0))
		pw.pressure_psi = _to_float(props.get("pressurePSI", 30.0))
		pw.drag_coef = float(props.get("dragCoef", 5.0))
		pw.has_tire = bool(props.get("hasTire", true))
		pw.side_beam_spring = _to_float(props.get("wheelSideBeamSpring", 24900.0))
		pw.side_beam_damp = float(props.get("wheelSideBeamDamp", 15.0))
		pw.tread_beam_spring = float(props.get("wheelTreadBeamSpring", 261000.0))
		pw.tread_beam_damp = float(props.get("wheelTreadBeamDamp", 65.0))
		pw.periphery_beam_spring = float(props.get("wheelPeripheryBeamSpring", 181000.0))
		pw.periphery_beam_damp = float(props.get("wheelPeripheryBeamDamp", 35.0))
		pw.no_load_coef = float(props.get("noLoadCoef", 1.52))
		pw.load_sensitivity_slope = float(props.get("loadSensitivitySlope", 0.00018))
		pw.full_load_coef = float(props.get("fullLoadCoef", 0.5))
		pw.softness_coef = float(props.get("softnessCoef", 0.7))
		wheels.append(pw)
	return wheels

## 安全浮点转换（处理 JBeam 表达式字符串如 "$=$tirepressure_F*830"）
static func _to_float(val) -> float:
	if val is float or val is int:
		return float(val)
	if val is String:
		var s: String = val
		if s.begins_with("$"):
			# 表达式：提取默认值（简化处理，取第一个数字）
			var num_str := ""
			for ch in s:
				if ch.is_valid_int() or ch == "." or ch == "-":
					num_str += ch
			if num_str != "":
				return num_str.to_float()
			return 0.0
		return s.to_float()
	return 0.0

## 批量解析目录下所有 .jbeam 文件
static func parse_directory(dir_path: String) -> Array:
	var all_parts: Array = []
	var dir := DirAccess.open(dir_path)
	if dir == null:
		push_error("JBeamParser: 无法打开目录 " + dir_path)
		return all_parts
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if not dir.current_is_dir():
			if file_name.ends_with(".jbeam"):
				var full_path := dir_path.path_join(file_name)
				var parts := parse_file(full_path)
				all_parts.append_array(parts)
		file_name = dir.get_next()
	dir.list_dir_end()
	return all_parts

## 统计信息输出（调试用）
static func get_summary(parts: Array) -> String:
	var total_nodes := 0
	var total_beams := 0
	var total_torsionbars := 0
	var total_flexbodies := 0
	var total_wheels := 0
	for p in parts:
		total_nodes += p.nodes.size()
		total_beams += p.beams.size()
		total_torsionbars += p.torsionbars.size()
		total_flexbodies += p.flexbodies.size()
		total_wheels += p.pressure_wheels.size()
	return "JBeam 解析摘要:\n  Parts: %d\n  Nodes: %d\n  Beams: %d\n  TorsionBars: %d\n  FlexBodies: %d\n  PressureWheels: %d" % [
		parts.size(), total_nodes, total_beams, total_torsionbars, total_flexbodies, total_wheels]
