"""Controlled host Blender inspection; edits only a disposable scene copy."""
import bpy
import json
import math
from mathutils import Vector
from pathlib import Path
import sys

args = sys.argv[sys.argv.index("--") + 1:]
main, report, screenshot = map(Path, args[:3])
spec = json.loads(Path(args[3]).read_text(encoding="utf-8")) if len(args) > 3 else {}
expected = spec.get("expected_xyz_mm", [84.3, 124.9, 51.0])
assert len(expected) == 3 and all(math.isfinite(x) and x > 0 for x in expected), "Invalid dimension specification"
bpy.ops.wm.open_mainfile(filepath=str(main), load_ui=False, use_scripts=False)
scene = bpy.context.scene
group = bpy.data.collections.get("PRODUCT")
objects = list(group.all_objects) if group else [o for o in scene.objects if o.type in {"MESH", "CURVE", "FONT", "SURFACE"}]
deps = bpy.context.evaluated_depsgraph_get()
points = []
for obj in objects:
    if obj.type in {"MESH", "CURVE", "FONT", "SURFACE"}:
        evaluated = obj.evaluated_get(deps)
        points.extend(evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
assert points, "No product geometry found"
assert all(math.isfinite(v) for p in points for v in p), "Non-finite product coordinates"
low = [min(p[i] for p in points) for i in range(3)]
high = [max(p[i] for p in points) for i in range(3)]
factor = scene.unit_settings.scale_length * 1000
dimensions = [(high[i] - low[i]) * factor for i in range(3)]
liquid_check = None
if spec.get("liquid_volume"):
    from collections import Counter
    target = spec["liquid_volume"]
    liquid = bpy.data.objects.get(target["object_name"])
    liquid_check = dict(object_name=target["object_name"], target_ml=target["target_ml"], tolerance_fraction=target["tolerance_fraction"], closed_mesh=False, measured_ml=None, within_tolerance=False)
    if liquid and liquid.type == "MESH":
        evaluated = liquid.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        vertices = [evaluated.matrix_world @ v.co for v in mesh.vertices]
        edge_uses = Counter(tuple(sorted(edge)) for polygon in mesh.polygons for edge in polygon.edge_keys)
        closed = bool(mesh.polygons) and all(edge_uses[tuple(sorted(edge.vertices))] == 2 for edge in mesh.edges)
        signed_volume = sum(vertices[t.vertices[0]].dot(vertices[t.vertices[1]].cross(vertices[t.vertices[2]])) / 6 for t in mesh.loop_triangles)
        ml = abs(signed_volume) * scene.unit_settings.scale_length ** 3 * 1_000_000
        liquid_check.update(closed_mesh=closed, measured_ml=ml, within_tolerance=math.isfinite(ml) and abs(ml / target["target_ml"] - 1) <= target["tolerance_fraction"])
        evaluated.to_mesh_clear()
missing = []
def check_resource(kind, name, path):
    if not path.is_file():
        missing.append({"type": kind, "name": name, "path": str(path), "issue": "missing"})
    elif not path.resolve().is_relative_to(main.parent.resolve()):
        missing.append({"type": kind, "name": name, "path": str(path), "issue": "outside_project"})

for image in bpy.data.images:
    if image.source == "FILE" and image.filepath and not image.packed_file:
        path = Path(bpy.path.abspath(image.filepath))
        check_resource("image", image.name, path)
for library in bpy.data.libraries:
    path = Path(bpy.path.abspath(library.filepath))
    check_resource("library", library.name, path)
for font in bpy.data.fonts:
    if font.filepath and font.filepath != "<builtin>" and not font.packed_file:
        path = Path(bpy.path.abspath(font.filepath))
        check_resource("font", font.name, path)
assert scene.camera, "Saved active scene has no camera"
original_engine = scene.render.engine
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 16
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(screenshot)
bpy.ops.render.render(write_still=True)
import gpu
data = dict(blender=bpy.app.version_string, build_hash=bpy.app.build_hash.decode(),
            has_product_collection=group is not None, product_objects=len(objects),
            meshes=sum(o.type == "MESH" for o in objects),
            vertices=sum(len(o.data.vertices) for o in objects if o.type == "MESH"),
            polygons=sum(len(o.data.polygons) for o in objects if o.type == "MESH"),
            materials=len(bpy.data.materials), units=scene.unit_settings.system,
            unit_scale=scene.unit_settings.scale_length, dimensions_xyz_mm=dimensions,
            dimension_scope="PRODUCT collection; all geometric scene objects if missing",
            expected_xyz_mm=expected,
            dimensions_within_3_percent=all(abs(a / b - 1) <= .03 for a, b in zip(dimensions, expected)),
            liquid_volume_check=liquid_check,
            missing_resources=missing, original_engine=original_engine,
            inspection_engine=scene.render.engine, renderer=gpu.platform.renderer_get(),
            camera=scene.camera.name, screenshot_saved=screenshot.is_file(),
            note="Controlled Eevee preview of saved camera, not a visual score or performance benchmark")
report.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(data, ensure_ascii=False))
