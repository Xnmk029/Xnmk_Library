## vehicle_controller.gd — 车辆驱动控制脚本
## 挂载于车辆根节点，管理引擎/变速箱/转向/制动输入
## 严格 Godot 4.x GDScript
class_name VehicleController
extends Node3D

## 引擎参数（从 JBeam ccf_engines.jbeam 提取）
@export_group("Engine")
@export var idle_rpm: float = 950.0
@export var max_rpm: float = 10200.0
@export var rev_limiter_rpm: float = 9800.0
@export var engine_inertia: float = 0.11
@export var engine_friction: float = 11.5
@export var engine_brake_torque: float = 38.0
@export var max_torque: float = 272.0  # Nm @ 5500rpm

## 变速箱参数（从 JBeam ccf_transmission.jbeam 提取）
@export_group("Transmission")
@export var gear_ratios: Array[float] = [-3.21, 0.0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97]
@export var final_drive_ratio: float = 3.91
@export var clutch_engage_rpm: float = 2500.0

## 轮胎参数（从 JBeam tires_16x8_sport.jbeam 提取）
@export_group("Tires")
@export var tire_radius: float = 0.305
@export var tire_width: float = 0.205
@export var tire_friction_static: float = 1.4
@export var tire_friction_dynamic: float = 1.0

## 转向参数
@export_group("Steering")
@export var max_steer_angle: float = 35.0  # 度
@export var steer_speed: float = 4.0  # 度/秒 输入速率
@export var steer_return_speed: float = 6.0

## 制动参数
@export_group("Brakes")
@export var brake_torque_front: float = 3200.0  # Nm
@export var brake_torque_rear: float = 2400.0
@export var brake_bias: float = 0.62  # 前制动比例

## 运行时状态
var current_rpm: float = 0.0
var current_gear: int = 1  # 0=N, 1-6=前进, -1=倒
var throttle_input: float = 0.0
var brake_input: float = 0.0
var clutch_input: float = 0.0  # 0=接合, 1=分离
var steer_input: float = 0.0  # -1 ~ +1
var current_steer_angle: float = 0.0
var vehicle_speed: float = 0.0  # m/s
var is_engine_running: bool = false

## 节点引用
@onready var body: RigidBody3D = $BodyRigidBody
var wheel_hubs: Array[RigidBody3D] = []
var wheel_joints: Array[Generic6DOFJoint3D] = []

## 扭矩曲线插值表 [rpm, torque]
var torque_curve: Array[Vector2] = [
	Vector2(0, 0), Vector2(500, 107), Vector2(1000, 172),
	Vector2(2000, 207), Vector2(3000, 226), Vector2(4000, 234),
	Vector2(4500, 235), Vector2(4977, 236), Vector2(5326, 266),
	Vector2(5500, 272), Vector2(6000, 263), Vector2(6500, 249),
	Vector2(7000, 235), Vector2(7500, 216), Vector2(8000, 173),
	Vector2(9000, 143), Vector2(10000, 123), Vector2(11000, 103),
	Vector2(12000, 83),
]

func _ready() -> void:
	# 收集轮毂和关节引用
	for child in get_children():
		if child is RigidBody3D and child.name.begins_with("WheelHub_"):
			wheel_hubs.append(child)
		if child is Generic6DOFJoint3D:
			wheel_joints.append(child)
	# 启动引擎
	start_engine()

func _physics_process(delta: float) -> void:
	_read_input(delta)
	_update_engine(delta)
	_apply_drivetrain(delta)
	_apply_steering(delta)
	_apply_brakes(delta)
	_update_speed()

## 读取键盘/手柄输入
func _read_input(delta: float) -> void:
	# 油门
	if Input.is_action_pressed("throttle"):
		throttle_input = move_toward(throttle_input, 1.0, delta * 3.0)
	else:
		throttle_input = move_toward(throttle_input, 0.0, delta * 5.0)
	# 制动
	if Input.is_action_pressed("brake"):
		brake_input = move_toward(brake_input, 1.0, delta * 4.0)
	else:
		brake_input = move_toward(brake_input, 0.0, delta * 6.0)
	# 离合
	clutch_input = 1.0 if Input.is_action_pressed("clutch") else 0.0
	# 转向
	var steer_target: float = 0.0
	if Input.is_action_pressed("steer_left"):
		steer_target = -1.0
	elif Input.is_action_pressed("steer_right"):
		steer_target = 1.0
	if steer_target != 0.0:
		steer_input = move_toward(steer_input, steer_target, delta * steer_speed)
	else:
		steer_input = move_toward(steer_input, 0.0, delta * steer_return_speed)
	# 换挡
	if Input.is_action_just_pressed("shift_up"):
		shift_up()
	if Input.is_action_just_pressed("shift_down"):
		shift_down()

## 引擎模拟
func _update_engine(delta: float) -> void:
	if not is_engine_running:
		current_rpm = 0.0
		return
	# 目标 RPM（基于油门和负载）
	var target_rpm: float = idle_rpm + throttle_input * (rev_limiter_rpm - idle_rpm)
	# 离合接合时受传动系统负载影响
	if clutch_input < 0.5 and current_gear != 0:
		var wheel_rpm: float = _get_drive_wheel_rpm()
		var gear_ratio: float = gear_ratios[current_gear + 1] if current_gear > 0 else gear_ratios[0]
		var driven_rpm: float = abs(wheel_rpm) * gear_ratio * final_drive_ratio * 60.0 / TAU
		target_rpm = lerp(target_rpm, driven_rpm, 0.8)
	# 转速限制
	target_rpm = clampf(target_rpm, idle_rpm, rev_limiter_rpm)
	# 惯性响应
	var rpm_rate: float = (target_rpm - current_rpm) / (engine_inertia * 60.0)
	current_rpm += rpm_rate * delta
	current_rpm = clampf(current_rpm, 0.0, max_rpm)
	# 怠速维持
	if current_rpm < idle_rpm and throttle_input < 0.1:
		current_rpm = move_toward(current_rpm, idle_rpm, delta * 2000.0)

## 传动系统力矩施加
func _apply_drivetrain(delta: float) -> void:
	if not is_engine_running or current_gear == 0:
		return
	if clutch_input > 0.8:
		return  # 离合分离
	# 查表获取当前扭矩
	var engine_torque: float = _sample_torque_curve(current_rpm)
	# 油门缩放
	engine_torque *= throttle_input
	# 变速箱放大
	var gear_idx: int = current_gear + 1 if current_gear > 0 else 0
	var ratio: float = gear_ratios[gear_idx]
	var output_torque: float = engine_torque * ratio * final_drive_ratio
	# 施加到驱动轮（后驱 RWD）
	var drive_wheels: Array[RigidBody3D] = []
	for hub in wheel_hubs:
		if hub.name.contains("RL") or hub.name.contains("RR"):
			drive_wheels.append(hub)
	if drive_wheels.is_empty():
		return
	var torque_per_wheel: float = output_torque / float(drive_wheels.size())
	for hub in drive_wheels:
		# 绕 X 轴施加扭矩（车轮旋转轴）
		var torque_vec := Vector3(torque_per_wheel, 0, 0)
		hub.apply_torque_impulse(torque_vec * delta)

## 转向施加
func _apply_steering(delta: float) -> void:
	current_steer_angle = steer_input * max_steer_angle
	# 对前轮关节施加转向角
	for joint in wheel_joints:
		if joint.name.contains("FL") or joint.name.contains("FR"):
			# 设置 Y 轴角度目标
			var target_angle: float = deg_to_rad(current_steer_angle)
			joint.set_param_y(
				Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, target_angle + deg_to_rad(2.0))
			joint.set_param_y(
				Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, target_angle - deg_to_rad(2.0))

## 制动施加
func _apply_brakes(delta: float) -> void:
	if brake_input < 0.01:
		return
	for hub in wheel_hubs:
		var is_front: bool = hub.name.contains("FL") or hub.name.contains("FR")
		var base_torque: float = brake_torque_front if is_front else brake_torque_rear
		var brake_torque: float = base_torque * brake_input
		# 制动力矩方向与旋转方向相反
		var angular_vel: float = hub.angular_velocity.x
		var brake_vec := Vector3(-signf(angular_vel) * brake_torque, 0, 0)
		hub.apply_torque_impulse(brake_vec * delta)

## 更新车速
func _update_speed() -> void:
	if body != null:
		vehicle_speed = body.linear_velocity.length()

## 换挡
func shift_up() -> void:
	if current_gear < 6:
		current_gear += 1

func shift_down() -> void:
	if current_gear > -1:
		current_gear -= 1

## 启动/熄火
func start_engine() -> void:
	is_engine_running = true
	current_rpm = idle_rpm

func stop_engine() -> void:
	is_engine_running = false

## 扭矩曲线线性插值
func _sample_torque_curve(rpm: float) -> float:
	if torque_curve.is_empty():
		return 0.0
	if rpm <= torque_curve[0].x:
		return torque_curve[0].y
	for i in range(torque_curve.size() - 1):
		if rpm >= torque_curve[i].x and rpm <= torque_curve[i + 1].x:
			var t: float = (rpm - torque_curve[i].x) / (torque_curve[i + 1].x - torque_curve[i].x)
			return lerpf(torque_curve[i].y, torque_curve[i + 1].y, t)
	return torque_curve[-1].y

## 获取驱动轮平均转速
func _get_drive_wheel_rpm() -> float:
	var total: float = 0.0
	var count: int = 0
	for hub in wheel_hubs:
		if hub.name.contains("RL") or hub.name.contains("RR"):
			total += hub.angular_velocity.x
			count += 1
	if count > 0:
		return total / float(count)
	return 0.0

## 获取遥测数据（供 HUD / 数据回传）
func get_telemetry() -> Dictionary:
	return {
		"rpm": current_rpm,
		"gear": current_gear,
		"speed_kmh": vehicle_speed * 3.6,
		"throttle": throttle_input,
		"brake": brake_input,
		"clutch": clutch_input,
		"steer_deg": current_steer_angle,
		"engine_running": is_engine_running,
	}
