"""Real short-lived children verify thresholds do not kill or mix trial evidence."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parent))
import cli_suite
from sandbox_lib import snapshot_dir
from time_policy import timing_score

class TimingTests(unittest.TestCase):
    def test_threshold_boundary_and_cap(self):
        self.assertEqual(timing_score(600,600)['time_penalty_points'],0)
        self.assertEqual(timing_score(660,600)['time_penalty_points'],1)
        self.assertEqual(timing_score(900,600)['time_penalty_points'],5)
        self.assertEqual(timing_score(1200,600)['time_penalty_points'],10)
        self.assertEqual(timing_score(100000,600)['time_penalty_points'],10)
        for bad in [float('nan'),float('inf'),-1]:
            with self.assertRaises(ValueError):timing_score(bad,600)
        with self.assertRaises(ValueError):timing_score(1,0)

    def fixture(self,base):
        wd=base/'workdir';h=base/'harness';wd.mkdir();h.mkdir()
        (wd/'PROMPT.md').write_text('public task',encoding='utf-8')
        meta={'project':'example','workdir':str(wd),'model':'test','run_id':'test','prompt_sha256':cli_suite.sha256_file(wd/'PROMPT.md'),'protocol_version':'2.0'}
        cli_suite.dump_json(h/'meta.json',meta);cli_suite.dump_json(h/'snapshot.json',snapshot_dir(wd))
        adapter=base/'adapter.json'
        spec={'argv':[sys.executable,'-c',"import sys,time;sys.stdin.read();time.sleep(1.15);open('answer.txt','w').write('finished')"],
              'fresh_session':True,'prompt_via':'stdin','wall_seconds':1,'soft_seconds':1,'time_policy':'penalty-no-deadline'}
        cli_suite.dump_json(adapter,spec)
        return wd,h,adapter,spec

    def test_soft_threshold_allows_actual_child_to_finish(self):
        with tempfile.TemporaryDirectory() as temp:
            wd,h,adapter,_=self.fixture(Path(temp))
            with patch.object(cli_suite,'run_dirs',return_value=[h]),patch.object(cli_suite,'record_suite',return_value=h/'suite.json'):
                cli_suite.execute('test',adapter,jobs=1)
            ex=json.loads((h/'execution.json').read_text())
            self.assertEqual(ex['status'],'completed');self.assertIsNone(ex['wall_seconds'])
            self.assertGreater(ex['elapsed_seconds'],1);self.assertGreater(ex['time_penalty_points'],0)
            self.assertEqual((wd/'answer.txt').read_text(),'finished')

    @unittest.skipUnless(os.name=='nt','Windows live-process takeover')
    def test_existing_hard_policy_remains_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            wd,h,adapter,spec=self.fixture(Path(temp))
            spec.pop('time_policy');spec['argv'][-1]=spec['argv'][-1].replace('sleep(1.15)','sleep(30)');cli_suite.dump_json(adapter,spec)
            with patch.object(cli_suite,'run_dirs',return_value=[h]),patch.object(cli_suite,'record_suite',return_value=h/'suite.json'):
                cli_suite.execute('test',adapter,jobs=1)
            ex=json.loads((h/'execution.json').read_text())
            self.assertEqual(ex['status'],'timeout');self.assertEqual(ex['wall_seconds'],1)
            self.assertFalse((wd/'answer.txt').exists())

    @unittest.skipUnless(os.name=='nt','Windows live-process takeover')
    def test_adopt_keeps_the_same_process_past_threshold(self):
        with tempfile.TemporaryDirectory() as temp:
            wd,h,adapter,_=self.fixture(Path(temp))
            p=subprocess.Popen([sys.executable,'-c',"import time;time.sleep(1.2);open('answer.txt','w').write('same process')"],cwd=wd)
            try:
                with patch.object(cli_suite,'run_dirs',return_value=[h]):cli_suite.adopt('test',adapter,[p.pid])
                self.assertEqual(p.wait(),0)
                ex=json.loads((h/'execution.json').read_text())
                self.assertEqual(ex['pid'],p.pid);self.assertEqual(ex['status'],'completed')
                self.assertGreater(ex['time_penalty_points'],0)
                self.assertEqual((wd/'answer.txt').read_text(),'same process')
            finally:
                if p.poll() is None:p.kill();p.wait()

    def test_resume_preserves_cutoff_and_uses_original_session(self):
        with tempfile.TemporaryDirectory() as temp:
            base=Path(temp);wd,h,adapter,spec=self.fixture(base)
            previous={'status':'timeout','elapsed_seconds':1.1,'started_at':'2026-10-16T00:00:00+00:00','session_id':'session-test'}
            cli_suite.dump_json(h/'execution.json',previous)
            cli_suite.dump_json(h/'provider_evidence.json',{'sessionId':'session-test'})
            (h/'stdout.log').write_text('original cutoff log')
            (h/'DSH-COMPLETE.json').write_text('{"old":true}')
            script=base/'fake-cli.py'
            script.write_text("import sys,json\na=sys.argv\nassert a[a.index('--session-id')+1]=='session-test'\nsys.stdin.read()\nopen('answer.txt','w').write('continued')\n",encoding='utf-8')
            spec['argv']=[sys.executable,str(script),'--json','-'];cli_suite.dump_json(adapter,spec)
            with patch.object(cli_suite,'run_dirs',return_value=[h]):cli_suite.resume_timeouts('test',adapter,jobs=1)
            ex=json.loads((h/'execution.json').read_text())
            self.assertEqual(ex['status'],'completed');self.assertEqual(ex['resumed_session'],'session-test')
            self.assertFalse(ex['fresh_session']);self.assertGreaterEqual(ex['elapsed_seconds'],1.1)
            self.assertEqual((h/'attempts/initial-hard-cutoff/stdout.log').read_text(),'original cutoff log')
            self.assertTrue((h/'attempts/initial-hard-cutoff/DSH-COMPLETE.json').exists())
            self.assertEqual((wd/'PROMPT.md').read_text(),'public task')
            self.assertEqual((wd/'answer.txt').read_text(),'continued')

if __name__=='__main__':unittest.main()
