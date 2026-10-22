import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "sandbox/scripts"))
from sandbox_lib import ROOT, scan_transcript


class TranscriptPathSignals(unittest.TestCase):
    def test_staging_prose_is_not_a_repository_path(self):
        self.assertEqual(scan_transcript("先备份和暂存源内容，再执行同步。"), [])
        trace = json.dumps({"text": "通过暂存支持交换，不能留下暂存文件。"}, ensure_ascii=False)
        self.assertEqual(scan_transcript(trace), [])

    def test_reserved_folder_paths_still_trigger(self):
        for text in (r"..\暂存\answer.js", "暂存/answer.js", './暂存'):
            with self.subTest(text=text):
                self.assertIn("暂存", scan_transcript(text))

    def test_repository_and_level_paths_still_trigger(self):
        self.assertIn(str(ROOT), scan_transcript(str(ROOT / "README.md")))
        self.assertIn("L1_Basic/", scan_transcript("L1_Basic/BilibiliUserscript/PROJECT_PROMPT.md"))

    def test_sibling_prefix_is_not_repository_access(self):
        for suffix in ('-tools/go/bin/go.exe', '-backup/state.json', '2/README.md', '.log'):
            for root in (str(ROOT), ROOT.as_posix()):
                text = root + suffix
                with self.subTest(text=text):
                    self.assertNotIn(str(ROOT), scan_transcript(text))
                    self.assertNotIn(str(ROOT), scan_transcript(json.dumps({'output': text})))

    def test_exact_root_and_child_boundaries_still_trigger(self):
        for text in (str(ROOT), 'cwd: "' + str(ROOT) + '"', str(ROOT) + '\\README.md',
                     ROOT.as_posix() + '/Backend/BANK.json', 'cwd: ' + str(ROOT) + '\n'):
            with self.subTest(text=text):
                self.assertIn(str(ROOT), scan_transcript(text))
        self.assertIn(str(ROOT), scan_transcript(json.dumps({'cwd': str(ROOT)})))

    def test_revision_identifiers_are_not_vision_paths(self):
        for text in ('modRevision\\": 1', 'revision\\nnext', 'latestRevision/file.json'):
            for trace in (text, json.dumps({'command': text})):
                with self.subTest(trace=trace):
                    self.assertNotIn('Vision\\', scan_transcript(trace))
                    self.assertNotIn('Vision/', scan_transcript(trace))
        for text in ('./Vision/file.json', '..\\Vision\\file.json', 'Vision/file.json'):
            with self.subTest(text=text):
                self.assertTrue(any(t in scan_transcript(text) for t in ('Vision/', 'Vision\\')))


if __name__ == "__main__":
    unittest.main()
