"""Native Blender infrastructure fixtures. No model calls or mouse answers."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import blender_profile as bp
import collect_run
import prepare_run
import review_run
from sandbox_lib import RUNS, dump_json, load_meta, snapshot_dir


class NativeBlenderTests(unittest.TestCase):
    def test_bottle_specific_dimensions_and_closed_liquid_volume(self):
        with contextlib.redirect_stdout(io.StringIO()):
            result = prepare_run.prepare("NativeWorkflowBench/BlenderCola550", "engineering-cola-fixture")
        meta = result["meta"]
        harness = RUNS / meta["model"] / meta["run_id"]
        meta["engineering_fixture"] = True
        dump_json(harness / "meta.json", meta)
        wd = Path(meta["workdir"])
        script = harness / "build-unscored-volume-box.py"
        script.write_text("""import bpy,sys
from mathutils import Vector
cube=bpy.data.objects['Cube'];cube.name='ENGINEERING_BOX_NOT_COLA'
cube.dimensions=(.068,.068,.240);cube.location.z=.120
group=bpy.data.collections.new('PRODUCT');bpy.context.scene.collection.children.link(group)
for old in list(cube.users_collection):old.objects.unlink(cube)
group.objects.link(cube)
bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,.120))
liquid=bpy.context.object;liquid.name='Cola_Liquid';liquid.dimensions=(.05,.05,.22)
for old in list(liquid.users_collection):old.objects.unlink(liquid)
group.objects.link(liquid)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
camera=bpy.context.scene.camera;camera.location=(.4,-.6,.35)
camera.rotation_euler=(Vector((0,0,.12))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
""", encoding="utf-8")
        process = subprocess.run([meta["engine_executable"], "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python", str(script), "--", str(wd / meta["main_file"])], capture_output=True, timeout=60, **bp.hidden_process())
        self.assertEqual(process.returncode, 0, process.stderr.decode(errors="replace"))
        self.assertEqual(self.validate(harness), 0)
        probe = json.loads((harness / "BLENDER_VALIDATION.json").read_text())["probe"]
        self.assertEqual(probe["expected_xyz_mm"], [68, 68, 240])
        self.assertTrue(probe["dimensions_within_3_percent"])
        self.assertTrue(probe["liquid_volume_check"]["closed_mesh"])
        self.assertAlmostEqual(probe["liquid_volume_check"]["measured_ml"], 550, places=2)
        self.assertTrue(probe["liquid_volume_check"]["within_tolerance"])
        self.assertEqual(self.review(harness)["verdict"], "PASS_WITH_WARNINGS")
        change = harness / "open-unscored-liquid.py"
        change.write_text("import bpy,bmesh,sys\nbpy.ops.wm.open_mainfile(filepath=sys.argv[-1])\nm=bpy.data.objects['Cola_Liquid'].data\nb=bmesh.new();b.from_mesh(m);b.faces.ensure_lookup_table();bmesh.ops.delete(b,geom=[b.faces[0]],context='FACES');b.to_mesh(m);b.free()\nbpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])\n",encoding="utf-8")
        subprocess.run([meta["engine_executable"], "--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python", str(change), "--", str(wd / meta["main_file"])], check=True, capture_output=True, timeout=60, **bp.hidden_process())
        self.assertEqual(self.validate(harness), 0)
        reviewed = self.review(harness)
        self.assertEqual(reviewed["verdict"], "FAIL")
        self.assertTrue(any(c["id"] == "B3" and c["status"] == "FAIL" for c in reviewed["review_checks"]))

    def test_text_only_payload_and_initial_integrity(self):
        with contextlib.redirect_stdout(io.StringIO()):
            result = prepare_run.prepare("NativeWorkflowBench/BlenderMXMaster3STextOnly", "engineering-blender-text-fixture")
        meta = result["meta"]
        harness = RUNS / meta["model"] / meta["run_id"]
        meta["engineering_fixture"] = True
        dump_json(harness / "meta.json", meta)
        wd = Path(meta["workdir"])
        self.assertEqual(set(snapshot_dir(wd)), {"PROMPT.md"})
        self.assertEqual(meta["input_files"], {})
        self.assertFalse(any(status == "FAIL" for _, status, _ in bp.integrity(meta, harness)))

    def test_text_only_rejects_assets_and_reference_mode_stays_strict(self):
        with tempfile.TemporaryDirectory() as td:
            project = Path(td)
            for mode, inputs in [("prompt_only", {"references/x.png": {}}), ("prompt_and_locked_references", {}), ("unknown", {})]:
                dump_json(project / "BENCH_PROFILE.json", {"profile": bp.PROFILE, "input_payload": mode, "input_files": inputs})
                with self.assertRaises(RuntimeError):
                    bp.payload(project)

    def prepare(self):
        with contextlib.redirect_stdout(io.StringIO()):
            result = prepare_run.prepare("NativeWorkflowBench/BlenderMXMaster3S", "engineering-blender-fixture")
        meta = result["meta"]
        harness = RUNS / meta["model"] / meta["run_id"]
        meta["engineering_fixture"] = True
        dump_json(harness / "meta.json", meta)
        return harness, Path(meta["workdir"])

    def build(self, harness, wd):
        script = harness / "build-unscored-box.py"
        script.write_text("""import bpy, sys
from mathutils import Vector
cube=bpy.data.objects['Cube']
cube.name='ENGINEERING_BOX_NOT_MOUSE'
cube.dimensions=(.0843,.1249,.051)
group=bpy.data.collections.new('PRODUCT')
bpy.context.scene.collection.children.link(group)
for old in list(cube.users_collection): old.objects.unlink(cube)
group.objects.link(cube)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1.0
scene.camera.location=(.22,-.30,.20)
scene.camera.rotation_euler=(Vector((0,0,0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=sys.argv[-1])
""", encoding="utf-8")
        env = os.environ.copy()
        cfg = harness / "fixture-config"
        cfg.mkdir()
        env["BLENDER_USER_CONFIG"] = str(cfg)
        process = subprocess.run([load_meta(harness)["engine_executable"], "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(script), "--", str(wd / "MX_Master_3S.blend")], cwd=wd, env=env, capture_output=True, timeout=60, **bp.hidden_process())
        self.assertEqual(process.returncode, 0, process.stderr.decode(errors="replace"))
        for name in ("materials", "components"):
            (wd / name).mkdir()
            (wd / name / "common.bin").write_bytes(b"\x00UNSCORED_BINARY\xff")

    def validate(self, harness):
        with contextlib.redirect_stdout(io.StringIO()):
            return bp.validate(harness, timeout=90)

    def review(self, harness):
        with contextlib.redirect_stdout(io.StringIO()):
            review_run.review(harness, strict=True)
        return load_meta(harness)

    def collect(self, harness, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return collect_run.collect(harness, **kwargs)

    def test_01_locked_payload_no_reference_answer(self):
        harness, wd = self.prepare()
        meta = load_meta(harness)
        self.assertEqual(meta["profile"], bp.PROFILE)
        self.assertEqual(set(snapshot_dir(wd)), {"PROMPT.md", *meta["input_files"]})
        self.assertEqual(len(meta["input_files"]), 14)
        self.assertFalse((wd / "README.md").exists())
        self.assertFalse((wd / "reports").exists())
        self.assertFalse(list(wd.rglob("*.blend")))
        self.assertFalse(any(status == "FAIL" for _, status, _ in bp.integrity(meta, harness)))

    def test_02_reference_mutation_invalid_and_force_refused(self):
        harness, wd = self.prepare()
        image = wd / "references/official/graphite_top.png"
        image.write_bytes(image.read_bytes() + b"CHANGED")
        self.assertEqual(self.review(harness)["verdict"], "INVALID")
        self.assertEqual(self.collect(harness, force=True), 3)

    def test_03_missing_main_is_retained_failure(self):
        harness, wd = self.prepare()
        self.assertEqual(self.validate(harness), 1)
        self.assertEqual(self.review(harness)["verdict"], "FAIL")
        self.assertEqual(self.collect(harness), 0)
        archive = Path(load_meta(harness)["collected_to"])
        self.assertTrue((archive / "submission/references/official/graphite_bottom.png").is_file())
        self.assertEqual(json.loads((archive / "archive.json").read_text())["verdict"], "FAIL")

    def test_04_native_open_render_binary_roundtrip(self):
        harness, wd = self.prepare()
        self.build(harness, wd)
        before = bp.files(wd)
        self.assertEqual(self.validate(harness), 0)
        self.assertEqual(bp.files(wd), before)
        report = json.loads((harness / "BLENDER_VALIDATION.json").read_text())
        self.assertEqual(report["probe"]["blender"], "4.0.1")
        self.assertTrue(report["probe"]["dimensions_within_3_percent"])
        self.assertTrue(report["probe"]["renderer"])
        self.assertIsNone(report["visual_score"])
        self.assertEqual(self.review(harness)["verdict"], "PASS_WITH_WARNINGS")
        self.assertEqual(self.collect(harness, with_review=True), 0)
        archive = Path(load_meta(harness)["collected_to"])
        self.assertEqual(bp.files(archive / "submission"), before)
        self.assertTrue((archive / "submission/materials/common.bin").is_file())
        self.assertTrue((archive / "submission/components/common.bin").is_file())
        self.assertTrue(json.loads((archive / "archive.json").read_text())["engineering_fixture"])
        self.assertEqual(self.collect(harness, overwrite=True, force=True), 3)

    def test_05_stale_runtime_and_submission_refused(self):
        harness, wd = self.prepare()
        self.build(harness, wd)
        self.assertEqual(self.validate(harness), 0)
        self.review(harness)
        report = harness / "BLENDER_VALIDATION.json"
        original = report.read_bytes()
        report.write_bytes(original + b"\n")
        self.assertEqual(self.collect(harness, force=True), 3)
        report.write_bytes(original)
        (wd / "after-review.bin").write_bytes(b"UNREVIEWED")
        self.assertEqual(self.collect(harness, force=True), 3)

    def test_06_absolute_unpacked_reference_is_not_portable(self):
        harness, wd = self.prepare()
        self.build(harness, wd)
        script = harness / "add-external-reference.py"
        script.write_text("import bpy,sys\nbpy.ops.wm.open_mainfile(filepath=sys.argv[-2])\nimage=bpy.data.images.load(sys.argv[-1])\nimage.use_fake_user=True\nbpy.ops.wm.save_as_mainfile(filepath=sys.argv[-2])\n", encoding="utf-8")
        process = subprocess.run([load_meta(harness)["engine_executable"], "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(script), "--", str(wd / "MX_Master_3S.blend"), str(wd / "references/official/graphite_top.png")], capture_output=True, timeout=60, **bp.hidden_process())
        self.assertEqual(process.returncode, 0)
        self.assertEqual(self.validate(harness), 1)
        report = json.loads((harness / "BLENDER_VALIDATION.json").read_text())
        self.assertTrue(any(r["issue"] == "outside_project" for r in report["probe"]["missing_resources"]))


if __name__ == "__main__":
    unittest.main()
