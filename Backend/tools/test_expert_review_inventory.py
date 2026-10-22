import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'sandbox/scripts'))
from review_run import observed_integrity_checks


class RepositoryInventoryIntegrity(unittest.TestCase):
    def test_scoped_inventory_preserves_immutable_input_checks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            wd, harness = root / 'workdir', root / 'harness'
            wd.mkdir()
            harness.mkdir()
            (wd / 'PROMPT.md').write_text('public task', encoding='utf-8')
            (wd / 'starter.tar').write_bytes(b'public source')

            def inventory(folder):
                return {f.name: dict(size=f.stat().st_size, sha256=hashlib.sha256(f.read_bytes()).hexdigest())
                        for f in folder.iterdir() if f.is_file() and f.suffix != '.wal'}

            (harness / 'snapshot.json').write_text(json.dumps(inventory(wd)), encoding='utf-8')
            (wd / 'engine.wal').write_bytes(b'non-source runtime state')
            rows = observed_integrity_checks({}, wd, harness, None, inventory)
            self.assertEqual(next(r[1] for r in rows if r[0] == 'H2'), 'PASS')
            (wd / 'PROMPT.md').write_text('changed task', encoding='utf-8')
            rows = observed_integrity_checks({}, wd, harness, None, inventory)
            self.assertEqual(next(r[1] for r in rows if r[0] == 'H2'), 'FAIL')


if __name__ == '__main__':
    unittest.main()
