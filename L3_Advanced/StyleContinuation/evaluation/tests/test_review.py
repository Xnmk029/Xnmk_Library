import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / "tools" / "review.py"
SPEC = importlib.util.spec_from_file_location("review", TOOL)
review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review)


class ReviewWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.rubric = review.load_json(review.EVAL / "rubric.json")
        self.analysis = review.analyze("绿灯亮了，侯天一慢慢向前开。" * 3)
        self.document = {
            "rubric_version": self.rubric["version"], "sample_id": "fixture",
            "reviewer": "tester", "review_stage": "single-review", "reviewed_at": "2026-09-22",
            "read_full_text": True, "issues": [], "unresolved": [],
            "hook_ledger": [{"id": "H01", "status": "完整"}],
            "scan_adjudications": [{"signal_id": s["id"], "decision": "exception",
                                     "reason": "仅为建议字数提示", "issue_ids": []}
                                    for s in self.analysis["signals"]],
            "criteria": {c["id"]: {"rating": 4, "reason": "算术夹具，非真实文学评分",
                                    "evidence": [{"paragraph": 1, "quote": "绿灯亮了"}], "issue_ids": []}
                         for c in self.rubric["criteria"]}}

    def add_issue(self, severity="Minor", hard=False):
        self.document["issues"].append({"id": "I01", "primary_criterion": "A2",
            "severity": severity, "confidence": "high", "status": "confirmed",
            "hard_rule_violation": hard, "reason": "测试汇总规则",
            "evidence": [{"paragraph": 1, "quote": "绿灯亮了"}]})
        self.document["criteria"]["A2"].update(rating=3, issue_ids=["I01"])

    def score(self):
        return review.calculate(self.document, self.rubric, self.analysis)

    def test_weight_total_and_full_score(self):
        self.assertEqual(self.score()["score"], 100)
        self.assertEqual(self.score()["status"], "READY")

    def test_hard_rule_keeps_raw_score_but_requires_revision(self):
        self.add_issue(hard=True)
        result = self.score()
        self.assertEqual(result["score"], 99)
        self.assertEqual(result["status"], "REVISE")

    def test_critical_overrides_high_score(self):
        self.add_issue(severity="Critical")
        self.assertEqual(self.score()["status"], "REWORK")

    def test_unresolved_prevents_public_score(self):
        self.document["unresolved"] = ["车型尚未核实"]
        self.assertIsNone(self.score()["score"])
        self.assertEqual(self.score()["status"], "PENDING")

    def test_missing_rating_does_not_become_zero(self):
        self.document["criteria"]["F1"]["rating"] = None
        self.assertIsNone(self.score()["score"])

    def test_invalid_quote_is_rejected(self):
        self.document["criteria"]["F1"]["evidence"][0]["quote"] = "原文不存在"
        with self.assertRaisesRegex(ValueError, "引文"):
            self.score()

    def test_same_issue_cannot_deduct_twice(self):
        self.add_issue()
        self.document["criteria"]["F2"].update(rating=3, issue_ids=["I01"])
        with self.assertRaisesRegex(ValueError, "跨项重复"):
            self.score()

    def test_bool_not_accepted_as_rating(self):
        self.document["criteria"]["A1"]["rating"] = True
        with self.assertRaisesRegex(ValueError, "整数"):
            self.score()

    def test_note_cannot_deduct(self):
        self.add_issue(severity="Note")
        with self.assertRaisesRegex(ValueError, "Note"):
            self.score()

    def test_scans_are_signals_not_verdicts(self):
        result = review.analyze("“不是吧哥。”\r\n\r\n“嗡……”\r\n\r\n不是胆怯，而是没必要。")
        codes = {s["code"] for s in result["signals"]}
        self.assertIn("NEGATIVE_OPENING", codes)
        self.assertIn("NOT_BUT", codes)
        self.assertTrue(all(s["automatic_verdict"] is None for s in result["signals"]))
        self.assertEqual(result["stats"]["paragraphs"], 3)

    def test_paragraph_boundaries_and_line_offsets(self):
        result = review.paragraphs("\r\n甲\r\n乙\r\n\r\n丙\r\n")
        self.assertEqual(result[0]["text"], "甲乙")
        self.assertEqual(result[0]["start_line"], 2)
        self.assertEqual(result[1]["start_line"], 5)
        self.assertEqual(review.analyze("甲" * 151)["stats"]["paragraphs_gt150"], 1)

    def test_init_output_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "review.json"
            review.save_json(path, {"original": True}, exclusive=True)
            with self.assertRaises(FileExistsError):
                review.save_json(path, {}, exclusive=True)
            self.assertTrue(review.load_json(path)["original"])

    def test_changed_candidate_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            candidate = Path(temp) / "answer.md"
            candidate.write_text("绿灯亮了。", encoding="utf-8")
            document = review.make_review(candidate, "tester", "test")
            path = Path(temp) / "review.json"
            review.save_json(path, document)
            candidate.write_text("正文已经改变。", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "哈希已变"):
                review.score_file(path)

    def test_unreviewed_template_stays_pending(self):
        document = copy.deepcopy(self.document)
        document["read_full_text"] = False
        document["scan_adjudications"][0]["decision"] = None
        result = review.calculate(document, self.rubric, self.analysis)
        self.assertEqual(result["status"], "PENDING")
        self.assertIsNone(result["score"])


if __name__ == "__main__":
    unittest.main()
