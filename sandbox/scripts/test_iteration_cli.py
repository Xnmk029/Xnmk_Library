"""Offline regression tests; synthetic fixtures never counted as model evidence."""
import contextlib, io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import iteration_cli as cli


class Contract(unittest.TestCase):
    def test_answer_selection_never_picks_best_scoring_candidate(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            (p/'a.json').write_text('{"v":1}');(p/'b.json').write_text('{"v":2}')
            with self.assertRaises(ValueError):cli.answer(p,p,{})
            (p/'answer.json').write_text('{"v":9}')
            answer,source=cli.answer(p,p,{})
            self.assertEqual(answer,{'v':9});self.assertEqual(source['file'],'answer.json')
            (p/'answer.json').write_text('{"v":1,"v":2}')
            with self.assertRaises(ValueError):cli.answer(p,p,{})

    def test_final_response_accepts_only_complete_json_or_one_fence(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)
            self.assertEqual(cli.answer(p,p,{'final_text':'```json\n{"v":1}\n```'})[0],{'v':1})
            for text in ('{"v":1} plus explanation','guess {"v":1}','{"v":NaN}'):
                with self.subTest(text=text),self.assertRaises(ValueError):cli.answer(p,p,{'final_text':text})

    def test_codebuddy_identity_comes_from_assistant_envelope(self):
        with tempfile.TemporaryDirectory() as d:
            h=Path(d)
            cli.write(h/'stdout.log',{'type':'system','model':'claimed-only'})
            self.assertIsNone(cli.evidence(h,'codebuddy')['actual_model'])
            (h/'stdout.log').write_text(json.dumps({'type':'assistant','message':{'model':'returned-m','content':[]}})+'\n'+json.dumps({'type':'result','subtype':'success','usage':{'input_tokens':7},'result':'{}'}))
            e=cli.evidence(h,'codebuddy')
            self.assertEqual(e['actual_model'],['returned-m']);self.assertEqual(e['usage'],{'input_tokens':7})

    def test_full_denominator_and_raw_hash_guard(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);runs=[];cases=[]
            for i,(family,value) in enumerate([('A',1),('A',0),('B',0)]):
                wd=root/f'w{i}';wd.mkdir();h=root/f'h{i}';h.mkdir()
                (wd/'PROMPT.md').write_text('synthetic fixture');cli.write(h/'snapshot.json',cli.snapshot_dir(wd))
                cli.write(wd/'answer.json',{'v':value});cli.write(h/'after.json',cli.snapshot_dir(wd))
                (h/'stdout.log').write_text('');(h/'stderr.log').write_text('')
                cli.write(h/'execution.json',{'cli':'codebuddy','status':'completed','stdout_sha256':cli.sha256_file(h/'stdout.log'),'stderr_sha256':cli.sha256_file(h/'stderr.log')})
                gold=root/f'g{i}.json';cli.write(gold,{'answer':{'v':1}})
                runs.append({'case':str(i),'family':family,'workdir':str(wd),'harness':str(h)})
                cases.append({'id':str(i),'gold':str(gold)})
            suite=root/'SUITE.json';cli.write(suite,{'batch':'fixture','source_manifest':'unused','probe':False,'runs':runs})
            with patch.object(cli,'verify',return_value={'cases':cases}),contextlib.redirect_stdout(io.StringIO()):
                result=cli.summarize(suite)
                self.assertEqual(result['macro_score'],25)
                (root/'h2/stdout.log').write_text('changed')
                result=cli.summarize(suite)
                self.assertFalse(result['complete']);self.assertIsNone(result['macro_score'])
                self.assertEqual(result['rows'][2]['status'],'integrity_invalid')
            # Completed output cannot be silently replaced before grading.
            (root/'w0/answer.json').write_text('{"v":0}')
            with patch.object(cli,'verify',return_value={'cases':cases}),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cli.summarize(suite)['rows'][0]['status'],'integrity_invalid')


if __name__=='__main__':unittest.main()
