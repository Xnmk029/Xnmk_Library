extends SceneTree

var output_path = ""
var report_path = ""
var capture_frames = 90
var elapsed_frames = 0
var initialized = false
var frame_intervals: Array[float] = []

func _initialize() -> void:
    for arg in OS.get_cmdline_user_args():
        if arg.begins_with("--bench-output="):
            output_path = arg.trim_prefix("--bench-output=")
        elif arg.begins_with("--bench-report="):
            report_path = arg.trim_prefix("--bench-report=")
        elif arg.begins_with("--bench-frames="):
            capture_frames = int(arg.trim_prefix("--bench-frames="))
    _load_main.call_deferred()

func _load_main() -> void:
    var main_path = str(ProjectSettings.get_setting("application/run/main_scene", ""))
    var main_resource = load(main_path)
    if not main_resource is PackedScene:
        push_error("BENCH: main_scene is missing or not a PackedScene")
        quit(2)
        return
    var scene = main_resource.instantiate()
    root.add_child(scene)
    current_scene = scene
    initialized = true

func _process(delta: float) -> bool:
    if not initialized:
        return false
    elapsed_frames += 1
    if elapsed_frames > 30:
        frame_intervals.append(delta * 1000.0)
    if elapsed_frames == capture_frames:
        _finish.call_deferred()
    return false

func _count_nodes(node: Node, counts: Dictionary) -> void:
    var kind = node.get_class()
    counts[kind] = int(counts.get(kind, 0)) + 1
    for child in node.get_children():
        _count_nodes(child, counts)

func _finish() -> void:
    await RenderingServer.frame_post_draw
    var screenshot = root.get_texture().get_image()
    var error = screenshot.save_png(output_path)
    var counts = {}
    _count_nodes(root, counts)
    var data = {
        "probe": "native-godot-boot-v1",
        "engine": Engine.get_version_info(),
        "renderer": RenderingServer.get_current_rendering_method(),
        "adapter": RenderingServer.get_video_adapter_name(),
        "user_data_dir": OS.get_user_data_dir(),
        "temp_dir": OS.get_environment("TEMP"),
        "tmp_dir": OS.get_environment("TMP"),
        "frames": elapsed_frames,
        "root_viewport": [root.size.x, root.size.y],
        "screenshot_saved": error == OK,
        "node_classes": counts,
        "frame_interval_ms": frame_intervals,
        "engine_max_fps": Engine.max_fps,
        "gpu_time_measured": false,
        "visual_score": null,
        "requirements_verified": false
    }
    var file = FileAccess.open(report_path, FileAccess.WRITE)
    if file == null:
        push_error("BENCH: cannot write runtime report")
        quit(3)
        return
    file.store_string(JSON.stringify(data, "  "))
    print("BENCH_GPU_BOOT_COMPLETE ", report_path)
    quit(0 if error == OK else 3)
