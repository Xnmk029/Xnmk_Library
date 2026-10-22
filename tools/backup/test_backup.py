"""Small isolated fixtures only; never enumerates the real workspace sources."""
import json
import os
from pathlib import Path
import stat
import threading
import time
import unittest
from unittest import mock
import uuid
import backup_worker as b
import restore_backup as restore

ROOT = Path('F:/benchmark-backup-state/tests') / uuid.uuid4().hex


class Ready:
    def __init__(self, *args):
        self.stop = threading.Event()

    def tick(self):
        pass


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / self._testMethodName
        self.root.mkdir(parents=True)
        self.src = self.root / 'source'
        self.src.mkdir()
        (self.src / '.git').mkdir()
        (self.src / '.git' / 'untracked-中文.txt').write_bytes(b'git ignored and hidden fixture\x00\xff')
        with open(str(self.src / '.git' / 'untracked-中文.txt') + ':fixture-stream', 'wb') as f:
            f.write(b'alternate NTFS stream fixture')
        (self.src / 'empty-directory').mkdir()
        (self.src / 'readonly.txt').write_bytes(b'read only fixture')
        b.K.SetFileAttributesW(str(self.src / 'readonly.txt'), 3)
        self.plan = b.read(b.HERE / 'backup_plan.json')
        self.plan.update(destination=str(self.root/'destination'), state_directory=str(self.root/'control'),
                         expected_volume_id=b.volume(self.root),
                         sources=[dict(path=str(self.src), name='fixture', destination_relative='sources/fixture',
                                       expected_volume_id=b.volume(self.src), expected_root_inode=os.lstat(self.src).st_ino)])
        Path(self.plan['state_directory']).mkdir()
        b.write(Path(self.plan['state_directory'])/'status.json', dict(status='waiting_for_idle',phase='not_started',version_directory=None))

    def worker(self, cls=b.Worker):
        w = cls(self.plan)
        with mock.patch.object(b, 'Guard', Ready), mock.patch.object(b.time, 'sleep', lambda _: None):
            w.run()
        return w

    def test_complete_restore_hidden_unicode_and_no_overwrite(self):
        w = self.worker()
        self.assertEqual(w.state['status'], 'complete')
        report = restore.restore(w.version, self.root/'restored')
        self.assertEqual(report['verified_files'], 2)
        self.assertEqual((self.root/'restored/sources/fixture/.git/untracked-中文.txt').read_bytes(),
                         (self.src/'.git/untracked-中文.txt').read_bytes())
        self.assertTrue((self.root/'restored/sources/fixture/empty-directory').is_dir())
        with open(str(self.root/'restored/sources/fixture/.git/untracked-中文.txt') + ':fixture-stream', 'rb') as f:
            self.assertEqual(f.read(), b'alternate NTFS stream fixture')
        marker = (w.version/'COMPLETE.json').read_bytes()
        self.worker()
        self.assertEqual(marker, (w.version/'COMPLETE.json').read_bytes())
        with self.assertRaises(FileExistsError):
            restore.restore(w.version, self.root/'restored')

    def test_restartable_copy_stop_then_resume(self):
        src = self.src/'large.dat'
        with src.open('wb') as f:
            for _ in range(32):
                f.write(os.urandom(1024*1024))
        dst = self.root/'partial.dat'
        class Stop(Ready):
            calls = 0
            def tick(self):
                self.calls += 1
                if self.calls >= 3:
                    raise b.Pause('fixture_user_returned')
        with self.assertRaises(b.Pause):
            b.copy_file(src, dst, Stop())
        partials = list((dst.parent/'.copy-progress').glob('*.partial'))
        self.assertEqual(len(partials), 1, 'Pause must retain a partial copy')
        self.assertGreater(partials[0].stat().st_size, 0)
        self.assertLess(partials[0].stat().st_size, src.stat().st_size)
        b.copy_file(src, dst, Ready())
        self.assertEqual(b.digest(src, Ready()), b.digest(dst, Ready()))

    def test_source_change_pauses_and_rescans(self):
        class Changed(b.Worker):
            def backup_files(self, scan):
                (Path(self.plan['sources'][0]['path'])/'new.dat').write_bytes(b'changed')
                raise b.SourceChanged('fixture_change')
        w = self.worker(Changed)
        self.assertEqual(w.state['status'], 'waiting_for_idle')
        self.assertEqual(w.state['round'], 2)
        self.assertFalse((w.version/'COMPLETE.json').exists())
        resumed = self.worker()
        self.assertEqual(resumed.state['status'], 'complete')
        self.assertEqual(resumed.state['files'], 3)

    def test_destination_corruption_never_completes(self):
        class Corrupt(b.Worker):
            def finalize(self, scan):
                (self.version/'sources/fixture/.git/untracked-中文.txt').write_bytes(b'corrupted')
                return super().finalize(scan)
        with self.assertRaisesRegex(RuntimeError, 'verification mismatch'):
            self.worker(Corrupt)
        state = b.read(Path(self.plan['state_directory'])/'status.json')
        self.assertEqual(state['status'], 'failed')
        self.assertFalse((Path(state['version_directory'])/'COMPLETE.json').exists())

    def test_external_link_manifest_no_recursion(self):
        target = self.root/'external'
        target.mkdir()
        (target/'do-not-copy.txt').write_text('external')
        os.symlink(target, self.src/'external-link', target_is_directory=True)
        w = self.worker()
        manifest = [json.loads(l) for l in (w.version/'manifest.jsonl').read_text(encoding='utf-8').splitlines()]
        link = next(x for x in manifest if x['kind'] == 'link')
        self.assertTrue(link['metadata']['external'])
        self.assertEqual(w.state['files'], 2)
        self.assertFalse((w.version/'sources/fixture/external-link').exists())

    def test_expired_lease_and_duplicate_lock(self):
        root = Path(self.plan['state_directory'])
        b.write(root/'lease.json', {'ready':True,'expires_unix':0})
        guard = b.Guard.__new__(b.Guard)
        guard.plan, guard.control = self.plan, root
        guard.reason = None
        guard.last_probe = time.monotonic()
        guard.last_lease = 0
        with mock.patch.object(b, 'input_idle', lambda: 9999):
            with self.assertRaisesRegex(b.Pause, 'lease'):
                guard.tick()
        with b.Lock(root/'worker.lock'):
            with self.assertRaises(b.Pause):
                with b.Lock(root/'worker.lock'):
                    pass

    def test_wrong_volume_and_stale_threads_rejected(self):
        self.plan['expected_volume_id'] = 'wrong'
        with self.assertRaisesRegex(RuntimeError, 'volume'):
            b.validate(self.plan)
        snapshot = self.root/'threads.json'
        b.write(snapshot, {'observed_unix':0,'result':{}})
        with self.assertRaisesRegex(RuntimeError, 'stale'):
            b.thread_check(self.plan, snapshot)

    def test_initialize_never_scans_or_launches_even_when_idle(self):
        snapshot = self.root/'threads.json'
        b.write(snapshot, {'observed_unix':time.time(), 'result': {'threads':[], 'pinnedThreads':[]}})
        with mock.patch.object(b, 'idle_probe', lambda _: {'ready':True,'reasons':[]}):
            state = b.control(self.plan, 'initialize', snapshot)
        self.assertEqual(state['status'], 'waiting_for_idle')
        self.assertIsNone(state['version_directory'])
        self.assertFalse(Path(self.plan['destination']).exists())
        self.assertFalse((Path(self.plan['state_directory'])/'inventory.sqlite3').exists())
        b.write(snapshot, {'observed_unix':time.time(), 'result': {'threads':[
            {'id':self.plan['task_thread_id'],'status':'active','projectId':self.plan['project_id']},
            {'id':'another-thread','status':'active','projectId':self.plan['project_id']}], 'pinnedThreads':[]}})
        self.assertEqual([x['id'] for x in b.thread_check(self.plan,snapshot)], ['another-thread'])


if __name__ == '__main__':
    print('Fixture evidence retained at:', ROOT, flush=True)
    unittest.main(verbosity=2)
