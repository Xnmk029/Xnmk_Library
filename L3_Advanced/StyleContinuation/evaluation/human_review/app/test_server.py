import tempfile
import unittest
from pathlib import Path
from server import Store, read

class ReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.store = Store(Path(cls.tmp.name))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def body(self, sid, values, state='complete'):
        return dict(revision=self.store.review(sid)['revision'], state=state,
                    scores=dict(zip(['engagement','characters','style','payoff'],values)),
                    notes={}, comment='测试数据，不是人工评价', reviewer='test')

    def test_01_mapping_and_blind(self):
        self.assertEqual(len(self.store.items),29)
        self.assertTrue(all(x['raw_score'] is None for x in self.store.catalog()))
        self.assertNotIn('baseline', self.store.public_review('SC-001'))

    def test_02_formula_history_conflict(self):
        body=self.body('SC-001',[8,7,9,8])
        result=self.store.save('SC-001',body)['review']
        self.assertEqual(result['total'],88.4)
        self.assertFalse(result['revealed_before_submit'])
        self.assertEqual(read(self.store.path('SC-001'))['total'],88.4)
        with self.assertRaises(ValueError): self.store.save('SC-001',body)
        self.store.save('SC-001',self.body('SC-001',[8,None,9,8],'draft'))
        self.assertIsNone(self.store.review('SC-001')['total'])
        self.assertTrue((self.store.path('SC-001').parent/'history/0001.json').exists())

    def test_03_boundaries_and_invalid(self):
        self.assertEqual(self.store.save('SC-019',self.body('SC-019',[10]*4))['review']['total'],100)
        self.assertEqual(self.store.save('SC-019',self.body('SC-019',[0]*4))['review']['total'],60)
        for value in [-1,10.5,7.3,True,float('nan'),float('inf')]:
            with self.assertRaises(ValueError): self.store.save('SC-019',self.body('SC-019',[value]*4))
        with self.assertRaises(ValueError): self.store.save('SC-019',self.body('SC-019',[None]*4))

    def test_04_reveal_reload_export(self):
        self.store.save('SC-002',self.body('SC-002',[None]*4,'draft'),reveal=True)
        reopened=Store(Path(self.tmp.name))
        self.assertTrue(reopened.review('SC-002')['revealed_before_submit'])
        exported=read(reopened.export()['saved_path'])
        self.assertEqual(exported['complete_count'],1)
        self.assertEqual(exported['sample_count'],29)
        self.assertEqual(exported['ranking'][0]['sample_id'],'SC-019')

if __name__ == '__main__': unittest.main(verbosity=2)
