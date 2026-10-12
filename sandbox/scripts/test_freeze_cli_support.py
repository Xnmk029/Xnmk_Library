import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from freeze_cli_support import freeze


class FreezeTests(unittest.TestCase):
    def test_pins_before_dispatch_and_refuses_changed_support_or_started_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            harness = root / 'case'
            harness.mkdir()
            support = root / 'guard.mjs'
            support.write_text('original', encoding='utf-8')
            suite = root / 'SUITE.json'
            suite.write_text(json.dumps({'runs': [{'harness': str(harness)}]}), encoding='utf-8')
            with contextlib.redirect_stdout(io.StringIO()):
                freeze(suite, [support])
            pinned = suite.read_bytes()
            self.assertEqual(len(json.loads(pinned)['adapter_files']), 1)
            support.write_text('changed', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'already pinned'):
                freeze(suite, [support])
            self.assertEqual(suite.read_bytes(), pinned)
            (harness / 'started.json').write_text('{}', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'after dispatch'):
                freeze(suite, [support])
            self.assertEqual(suite.read_bytes(), pinned)


if __name__ == '__main__':
    unittest.main()
