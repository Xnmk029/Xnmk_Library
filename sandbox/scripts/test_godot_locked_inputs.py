"""Locked continuation inputs; engineering fixtures only, no model calls."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import godot_profile as gp
import sandbox_lib
from sandbox_lib import dump_json, sha256_file, snapshot_dir


class LockedGodotInputs(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.repo = root / "repo"
        self.project = self.repo / "task"
        self.work = root / "work"
        self.harness = root / "harness"
        for p in [self.project / "inputs", self.work, self.harness]:
            p.mkdir(parents=True)
        formal = self.project / "PROJECT_PROMPT.md"
        formal.write_text("Fixture", encoding="utf-8")
        archive = self.project / "inputs/STARTER.zip"
        archive.write_bytes(b"locked-fixture")
        self.locked = {archive.name: {"sha256": sha256_file(archive), "size": archive.stat().st_size}}
        dump_json(self.project / "PROMPT_REGISTRY.json", {"schemaVersion": 1, "dispatchPrompt": formal.name,
            "sha256": sha256_file(formal), "inputFiles": ["inputs/STARTER.zip"]})
        self.config = {"profile": gp.PROFILE, "benchmark_id": "fixture", "engine_version": "4.5.1.stable",
            "renderer": "forward_plus", "input_payload": "prompt_and_locked_archives", "locked_inputs": self.locked}
        dump_json(self.project / gp.REGISTRATION, self.config)
        for src, dest in [(formal, self.work / "PROMPT.md"), (archive, self.work / archive.name)]:
            dest.write_bytes(src.read_bytes())
        for module in [gp, sandbox_lib]:
            patcher = patch.object(module, "ROOT", self.repo)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.meta = dict(gp.payload(self.project), workdir=str(self.work), project_rel="task", prompt_sha256=sha256_file(formal))
        dump_json(self.harness / "snapshot.json", snapshot_dir(self.work))

    def checks(self):
        return {key: status for key, status, _ in gp.integrity(self.meta, self.harness)}

    def test_archive_immutable_but_extracted_sources_editable(self):
        p = self.work / "game/main.gd"
        p.parent.mkdir()
        p.write_text("editable", encoding="utf-8")
        self.assertEqual(self.checks()["H2"], "PASS")
        p.write_text("revised", encoding="utf-8")
        self.assertEqual(self.checks()["H2"], "PASS")
        (self.work / "STARTER.zip").write_bytes(b"tampered")
        self.assertEqual(self.checks()["H2"], "FAIL")

    def test_missing_archive_rejected(self):
        (self.work / "STARTER.zip").unlink()
        self.assertEqual(self.checks()["H2"], "FAIL")

    def test_formal_archive_tamper_rejected(self):
        (self.project / "inputs/STARTER.zip").write_bytes(b"changed")
        self.assertEqual(self.checks()["H2"], "FAIL")

    def test_duplicate_staged_name_rejected(self):
        (self.project / "other").mkdir()
        (self.project / "other/STARTER.zip").write_bytes(b"duplicate")
        registry = self.project / "PROMPT_REGISTRY.json"
        import json
        data = json.loads(registry.read_text(encoding="utf-8"))
        data["inputFiles"].append("other/STARTER.zip")
        dump_json(registry, data)
        with self.assertRaises(RuntimeError):
            gp.payload(self.project)

    def test_prompt_only_cannot_add_inputs(self):
        self.config["input_payload"] = "prompt_only"
        dump_json(self.project / gp.REGISTRATION, self.config)
        with self.assertRaises(RuntimeError):
            gp.payload(self.project)

    def test_extra_initial_snapshot_rejected(self):
        (self.work / "unexpected.txt").write_text("extra")
        dump_json(self.harness / "snapshot.json", snapshot_dir(self.work))
        self.assertEqual(self.checks()["H2"], "FAIL")


if __name__ == "__main__":
    unittest.main(verbosity=2)
