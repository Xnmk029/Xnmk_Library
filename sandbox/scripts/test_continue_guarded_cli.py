import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import continue_guarded_cli as queue


class QueueTests(unittest.TestCase):
    def test_pending_or_started_is_not_terminal(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            case = base / 'case'
            case.mkdir()
            (base / 'SUITE.json').write_text(json.dumps({'runs': [{'harness': str(case)}]}))
            with patch.object(queue, 'SOURCE', base):
                self.assertFalse(queue.source_terminal())
                (case / 'started.json').write_text('{}')
                self.assertFalse(queue.source_terminal())
                (case / 'execution.json').write_text('{"status":"timeout"}')
                self.assertTrue(queue.source_terminal())

    def test_explicit_executor_stop_releases_slot(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / 'SUITE.json').write_text(json.dumps({'runs': [{'harness': str(base/'unstarted')}]}))
            with patch.object(queue, 'SOURCE', base):
                self.assertFalse(queue.source_terminal())
                (base / 'STOP.json').write_text('{}')
                self.assertTrue(queue.source_terminal())


if __name__ == '__main__':
    unittest.main()
