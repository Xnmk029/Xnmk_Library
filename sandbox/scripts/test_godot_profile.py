"""Native Godot infrastructure fixtures; no model inference and no leaderboard score."""
import contextlib
import io
import json
import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import godot_profile as gp
import prepare_run
import review_run
import collect_run
from sandbox_lib import ROOT, RUNS, load_meta, dump_json, discover_projects


class NativeGodotTests(unittest.TestCase):
    def prepare(self):
        with contextlib.redirect_stdout(io.StringIO()):
            prepared = prepare_run.prepare("NativeWorkflowBench/GodotShader", "engineering-godot-fixture")
        meta = prepared["meta"]
        harness = RUNS / meta["model"] / meta["run_id"]
        meta["engineering_fixture"] = True
        dump_json(harness / "meta.json", meta)
        return harness, Path(meta["workdir"])

    def build(self, workdir):
        project = workdir / "game"
        project.mkdir()
        (project / "project.godot").write_text(
            'config_version=5\n[application]\nconfig/name="GodotBenchSameName"\nrun/main_scene="res://main.tscn"\n'
            '[display]\nwindow/size/viewport_width=640\nwindow/size/viewport_height=360\n'
            '[rendering]\nrenderer/rendering_method="forward_plus"\n', encoding="utf-8")
        (project / "main.tscn").write_text(
            '[gd_scene load_steps=3 format=3]\n[ext_resource type="Script" path="res://main.gd" id="1"]\n'
            '[sub_resource type="BoxMesh" id="mesh"]\n[node name="NativeFixture" type="Node3D"]\nscript=ExtResource("1")\n'
            '[node name="Cube" type="MeshInstance3D" parent="."]\nmesh=SubResource("mesh")\n'
            '[node name="Camera" type="Camera3D" parent="."]\nposition=Vector3(0,1,4)\ncurrent=true\n'
            '[node name="Sun" type="DirectionalLight3D" parent="."]\nrotation_degrees=Vector3(-40,20,0)\n', encoding="utf-8")
        (project / "main.gd").write_text('extends Node3D\nfunc _ready():\n    $Camera.look_at(Vector3.ZERO)\n', encoding="utf-8")
        for directory in ["materials", "actors"]:
            (project / directory).mkdir()
            (project / directory / "common.gdshaderinc").write_text(
                'vec3 tint() { return vec3(0.2,0.4,0.3); }\n', encoding="utf-8")
        (project / "data").mkdir()
        (project / "data/custom-dependency.bin").write_bytes(b"\x00\x01NATIVE_BINARY\xff")
        (project / ".godot").mkdir()
        (project / ".godot/generated-cache.bin").write_bytes(b"IGNORE_GENERATED_CACHE")
        return project

    def check(self, harness):
        with contextlib.redirect_stdout(io.StringIO()):
            return gp.validate(harness, timeout=60, frames=60)

    def review(self, harness):
        with contextlib.redirect_stdout(io.StringIO()):
            review_run.review(harness, strict=True)
        return load_meta(harness)

    def collect(self, harness, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return collect_run.collect(harness, **kwargs)

    def test_01_registration_and_bare_payload(self):
        self.assertIn("NativeWorkflowBench/GodotShader", {row["rel"] for row in discover_projects()})
        harness, workdir = self.prepare()
        self.assertEqual({path.name for path in workdir.iterdir()}, {"PROMPT.md"})
        self.assertEqual(load_meta(harness)["profile"], gp.PROFILE)
        self.assertEqual(load_meta(harness)["isolation_verification"], "unverified")

    def test_02_real_gpu_and_complete_roundtrip(self):
        harness, workdir = self.prepare()
        self.build(workdir)
        before = gp.files(workdir)
        self.assertEqual(self.check(harness), 0)
        self.assertEqual(gp.files(workdir), before)
        report = load_meta(harness)
        validation = json.loads((harness / "GODOT_VALIDATION.json").read_text(encoding="utf-8"))
        self.assertEqual(validation["status"], "passed")
        self.assertTrue(Path(validation["validation_dir"], "preview.png").is_file())
        self.assertEqual(validation["probe"]["renderer"], "forward_plus")
        self.assertIsNone(validation["visual_score"])
        reviewed = self.review(harness)
        self.assertEqual(reviewed["verdict"], "PASS")
        self.assertEqual(self.collect(harness, with_review=True), 0)
        destination = Path(load_meta(harness)["collected_to"]) / "submission"
        self.assertEqual(gp.files(destination), before)
        self.assertTrue((destination / "game/materials/common.gdshaderinc").is_file())
        self.assertTrue((destination / "game/actors/common.gdshaderinc").is_file())
        self.assertTrue((destination / "game/data/custom-dependency.bin").is_file())
        self.assertFalse((destination / "game/.godot").exists())
        self.assertEqual(self.collect(harness, overwrite=True, force=True), 3)

    def test_03_same_named_projects_get_distinct_user_data(self):
        paths = []
        for _ in range(2):
            harness, workdir = self.prepare()
            project = self.build(workdir)
            with (project / "project.godot").open("a", encoding="utf-8") as stream:
                stream.write('\n[application]\nconfig/use_custom_user_dir.windows=false\nconfig/custom_user_dir_name.windows="shared"\n')
            self.assertEqual(self.check(harness), 0)
            report = json.loads((harness / "GODOT_VALIDATION.json").read_text(encoding="utf-8"))
            paths.append(report["probe"]["user_data_dir"])
        self.assertNotEqual(paths[0], paths[1])

    def test_04_valid_runtime_failure_is_archived(self):
        harness, workdir = self.prepare()
        project = self.build(workdir)
        (project / "main.gd").write_text('extends Node3D\nfunc broken(:\n', encoding="utf-8")
        self.assertEqual(self.check(harness), 1)
        self.assertEqual(self.review(harness)["verdict"], "FAIL")
        self.assertEqual(self.collect(harness), 0)
        archive = Path(load_meta(harness)["collected_to"])
        self.assertTrue((archive / "submission/game/main.gd").is_file())
        self.assertEqual(json.loads((archive / "archive.json").read_text(encoding="utf-8"))["runtime_status"], "failed")

    def test_05_source_change_after_validation_is_refused(self):
        harness, workdir = self.prepare()
        project = self.build(workdir)
        self.assertEqual(self.check(harness), 0)
        self.review(harness)
        (project / "data/custom-dependency.bin").write_bytes(b"changed")
        self.assertEqual(self.collect(harness, force=True), 3)
        self.assertEqual(self.review(harness)["verdict"], "INVALID")

    def test_06_input_tamper_cannot_be_forced(self):
        harness, workdir = self.prepare()
        self.build(workdir)
        (workdir / "PROMPT.md").write_text("modified", encoding="utf-8")
        self.assertEqual(self.review(harness)["verdict"], "INVALID")
        self.assertEqual(self.collect(harness, force=True), 3)

    def test_07_hardlinks_refused_before_reading(self):
        harness, workdir = self.prepare()
        project = self.build(workdir)
        canary = harness / "external-canary.bin"
        canary.write_bytes(b"CANARY")
        os.link(canary, project / "external-link.bin")
        self.assertEqual(self.review(harness)["verdict"], "INVALID")

    def test_08_no_project_does_not_pass(self):
        harness, workdir = self.prepare()
        (workdir / "README.md").write_text("No native project was delivered.", encoding="utf-8")
        self.assertEqual(self.check(harness), 1)
        self.assertEqual(self.review(harness)["verdict"], "FAIL")

    def test_09_generic_review_performs_gpu_validation(self):
        harness, workdir = self.prepare()
        self.build(workdir)
        self.assertFalse((harness / "GODOT_VALIDATION.json").exists())
        self.assertEqual(self.review(harness)["verdict"], "PASS")
        self.assertTrue((harness / "GODOT_VALIDATION.json").exists())
        self.assertEqual(load_meta(harness)["runtime_validation"], "passed")


if __name__ == "__main__":
    unittest.main(verbosity=2)
