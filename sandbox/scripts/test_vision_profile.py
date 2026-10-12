"""Engineering fixtures only; no model inference and no benchmark leaderboard entries."""
import contextlib
import io
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prepare_run
import review_run
import collect_run
import vision_profile as vp
import vision_suite
from sandbox_lib import ROOT, RUNS, load_meta, dump_json, discover_projects, sha256_file


class VisionTests(unittest.TestCase):
    def prepare(self, q='DF08B'):
        with contextlib.redirect_stdout(io.StringIO()):
            r = prepare_run.prepare('PV1-' + q, 'engineering-vision-fixture')
        m = r['meta']; h = RUNS / m['model'] / m['run_id']
        m['engineering_fixture'] = True
        dump_json(h / 'meta.json', m)
        return h, Path(m['workdir'])

    def gold(self, wd, q='DF08B'):
        (wd / 'answer.json').write_bytes((vp.RELEASE / 'private/evaluator' / (q + '_gold.json')).read_bytes())

    def result(self, h):
        with contextlib.redirect_stdout(io.StringIO()):
            review_run.review(h, strict=True)
        return json.loads((h / 'SCORE.json').read_text(encoding='utf-8'))

    def test_01_all_eight_roundtrip(self):
        names = {r['name'] for r in discover_projects()}
        for q, c in vp.lock()['cases'].items():
            self.assertIn('PV1-' + q, names)
            h, wd = self.prepare(q)
            self.assertEqual({p.name for p in wd.iterdir()}, {'PROMPT.md'} | set(c['files'][1:]))
            self.gold(wd, q)
            result = self.result(h)
            self.assertEqual(result['score']['score'], 1)
            self.assertEqual(result['isolation_verification'], 'unverified')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(collect_run.collect(h), 0)
            self.assertTrue((Path(load_meta(h)['collected_to']) / 'answer.json').is_file())

    def test_02_wrong_answer_collectable(self):
        h, wd = self.prepare()
        (wd / 'answer.json').write_text('{"display":"wrong"}', encoding='utf-8')
        r = self.result(h)
        self.assertEqual(r['score']['score'], 0)
        self.assertEqual(r['verdict'], 'PASS_WITH_WARNINGS')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(collect_run.collect(h, dry_run=True), 0)

    def test_03_invalid_delivery(self):
        for text in [None, '{}', '{"display":7}', '{"display":NaN}', '{"display":"a","display":"b"}', '```json\n{}\n```']:
            h, wd = self.prepare()
            if text is not None: (wd / 'answer.json').write_text(text, encoding='utf-8')
            self.assertEqual(self.result(h)['verdict'], 'FAIL')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(collect_run.collect(h, force=True), 3)

    def test_04_input_tamper(self):
        for target in ['PROMPT.md', 'stem_01.png']:
            h, wd = self.prepare(); self.gold(wd)
            (wd / target).write_bytes(b'tampered')
            self.assertEqual(self.result(h)['verdict'], 'INVALID')

    def test_05_missing_input(self):
        h, wd = self.prepare(); self.gold(wd)
        (wd / 'stem_01.png').rename(wd / 'renamed.png')
        self.assertEqual(self.result(h)['verdict'], 'INVALID')

    def test_06_stale_collect(self):
        h, wd = self.prepare(); self.gold(wd); self.result(h)
        (wd / 'answer.json').write_text('{"display":"wrong"}', encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(collect_run.collect(h, force=True), 3)

    def test_07_transcript_leak(self):
        h, wd = self.prepare(); self.gold(wd)
        trace = h / 'trace.txt'; trace.write_text('read F:/benchmark/Vision/private', encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(review_run.review(h, strict=True, transcript_path=trace), 1)
        self.assertEqual(load_meta(h)['verdict'], 'INVALID')

    def test_08_links_and_state(self):
        h, wd = self.prepare()
        source = h / 'fixture-answer.json'; source.write_text('{"display":"x"}', encoding='utf-8')
        os.link(source, wd / 'answer.json')
        self.assertEqual(self.result(h)['verdict'], 'INVALID')
        h, wd = self.prepare(); self.gold(wd)
        (wd / '.git').mkdir()
        self.assertEqual(self.result(h)['verdict'], 'INVALID')

    def test_09_path_and_version(self):
        for slug in ['../escape', 'a/b', 'a\\b', 'CON', 'a:', 'x.']:
            with self.assertRaises(RuntimeError): prepare_run.prepare('PV1-DF08B', slug)
        with patch.object(prepare_run, 'RUNS_ROOT', ROOT / 'sandbox/forbidden-workspace'):
            with self.assertRaises(RuntimeError): prepare_run.prepare('PV1-DF08B', 'fixture')
        h, wd = self.prepare(); self.gold(wd)
        m = load_meta(h); m['release_sha256'] = 'bad'; dump_json(h / 'meta.json', m)
        self.assertEqual(self.result(h)['verdict'], 'INVALID')

    def test_10_generic_stays_bare(self):
        generic = next(r for r in discover_projects() if r['level'] != 'Vision/PairedVision/v1/public')
        with contextlib.redirect_stdout(io.StringIO()):
            m = prepare_run.prepare(generic['rel'], 'engineering-vision-fixture')['meta']
        self.assertNotIn('profile', m)
        self.assertEqual([p.name for p in Path(m['workdir']).iterdir()], ['PROMPT.md'])

    def test_11_timeout_is_not_zero(self):
        h, wd = self.prepare(); self.gold(wd)
        m = load_meta(h); m['execution_status'] = 'timeout'; dump_json(h / 'meta.json', m)
        r = self.result(h)
        self.assertEqual(r['verdict'], 'FAIL'); self.assertIsNone(r['score'])

    def test_12_suite_runner_fixture(self):
        # Exercises CLI stdin/cwd and run lifecycle with a fake adapter, clearly labeled.
        with contextlib.redirect_stdout(io.StringIO()):
            manifest = vision_suite.prepare_suite('engineering-vision-fixture')
        suite = json.loads(manifest.read_text(encoding='utf-8'))
        for run in suite['runs']:
            h = Path(run['harness']); m = load_meta(h); m['engineering_fixture'] = True; dump_json(h / 'meta.json', m)
        self.assertEqual(len({r['workdir'] for r in suite['runs']}), 8)
        adapter = manifest.with_name(manifest.stem + '-fixture-adapter.json')
        script = "import pathlib,sys; p=sys.stdin.read(); assert len(p.splitlines())==2; pathlib.Path('answer.json').write_text('{}',encoding='utf-8')"
        dump_json(adapter, {'argv': [sys.executable, '-c', script], 'fresh_session': True, 'prompt_via': 'stdin', 'wall_seconds': 10, 'requested_model': 'ENGINEERING_FIXTURE_NO_MODEL'})
        with contextlib.redirect_stdout(io.StringIO()):
            vision_suite.execute(manifest, adapter)
            evidence = Path(suite['runs'][0]['harness']) / 'provider_evidence.json'
            source = evidence.parent / 'stdout.log'
            dump_json(evidence, {'actual_model': 'ENGINEERING_FIXTURE_NO_MODEL', 'usage': None,
                                 'finish_reason': None, 'source': {'file': 'stdout.log', 'sha256': sha256_file(source)}})
            results = vision_suite.finalize(manifest)
        self.assertEqual(len(results), 8)
        self.assertTrue(all(r['execution']['status'] == 'completed' and r['verdict'] == 'FAIL' for r in results))
        self.assertEqual(results[0]['provider_evidence']['actual_model'], 'ENGINEERING_FIXTURE_NO_MODEL')
        dump_json(evidence, {'source': {'file': 'stdout.log', 'sha256': 'bad'}})
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            vision_suite.finalize(manifest)

    @unittest.skipUnless(os.name == 'nt', 'Windows junction check')
    def test_13_junction_rejected_before_walk(self):
        h, wd = self.prepare(); self.gold(wd)
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(wd / 'linked'), str(h)], check=True, capture_output=True)
        self.assertEqual(self.result(h)['verdict'], 'INVALID')

    def test_14_release_hash_mismatch(self):
        original = vp.load_json
        def altered(path):
            data = original(path)
            if path.name == 'LOCK.json':
                key = next(iter(data['sha256'])); data['sha256'][key] = 'bad'
            return data
        with patch.object(vp, 'load_json', side_effect=altered):
            with self.assertRaises(RuntimeError): vp.lock()

    def test_15_api_prepare_and_review(self):
        import dispatch_api
        r = dispatch_api.api_prepare({'project': 'PV1-DF08B', 'model': 'engineering-vision-fixture'})
        self.assertTrue(r['ok'])
        h, wd = Path(r['harness']), Path(r['workdir'])
        self.assertEqual(load_meta(h)['run_id'], r['run_id'])
        self.gold(wd)
        result = dispatch_api.api_review({'run': str(h)})
        self.assertEqual(result['verdict'], 'PASS_WITH_WARNINGS')
        self.assertTrue(dispatch_api.api_collect({'run': str(h), 'dry_run': True})['ok'])


if __name__ == '__main__':
    program = unittest.main(verbosity=2, exit=False)
    r = program.result
    report = ROOT / 'Vision/PairedVision/reports/ENGINEERING_QA.json'
    report.parent.mkdir(exist_ok=True)
    dump_json(report, {'status': 'PASS' if r.wasSuccessful() else 'FAIL',
                      'tests': r.testsRun, 'failures': len(r.failures), 'errors': len(r.errors),
                      'skipped': len(r.skipped), 'real_model_calls': 0,
                      'test_script_sha256': sha256_file(Path(__file__)),
                      'scope': 'Fixture-only pipeline, integrity, scoring, collection, CLI adapter and dispatch API regression'})
    sys.exit(0 if r.wasSuccessful() else 1)
