"""Windows, local-only backup. No source deletion, pruning, or link traversal.

The control CLI does only root/volume/idle checks; `run` alone enumerates data.
Chunked, prefix-verified stream copies retain partial files on an idle pause.
An expiring lease requires a fresh Codex list_threads observation every 30 s.
"""
import argparse
import ctypes as C
from ctypes import wintypes as W
import datetime as dt
import hashlib
import json
import msvcrt
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import subprocess
import sys
import threading
import time
import traceback
import uuid

HERE = Path(__file__).resolve().parent
K = C.WinDLL('kernel32', use_last_error=True)
U = C.WinDLL('user32', use_last_error=True)
CALLBACK = C.WINFUNCTYPE(W.DWORD, C.c_longlong, C.c_longlong, C.c_longlong,
                         C.c_longlong, W.DWORD, W.DWORD, W.HANDLE, W.HANDLE, W.LPVOID)
K.CopyFileExW.argtypes = [W.LPCWSTR, W.LPCWSTR, CALLBACK, W.LPVOID, C.POINTER(W.BOOL), W.DWORD]
K.CopyFileExW.restype = W.BOOL
K.GetVolumeNameForVolumeMountPointW.argtypes = [W.LPCWSTR, W.LPWSTR, W.DWORD]
K.GetVolumeNameForVolumeMountPointW.restype = W.BOOL
K.SetFileAttributesW.argtypes = [W.LPCWSTR, W.DWORD]
K.SetFileAttributesW.restype = W.BOOL
K.GetTickCount64.restype = C.c_ulonglong
class StreamData(C.Structure):
    _fields_ = [('size', C.c_longlong), ('name', W.WCHAR * 296)]
K.FindFirstStreamW.argtypes = [W.LPCWSTR, W.INT, C.POINTER(StreamData), W.DWORD]
K.FindFirstStreamW.restype = W.HANDLE
K.FindNextStreamW.argtypes = [W.HANDLE, C.POINTER(StreamData)]
K.FindNextStreamW.restype = W.BOOL
K.FindClose.argtypes = [W.HANDLE]


def streams(path):
    data = StreamData()
    handle = K.FindFirstStreamW(extended(path), 0, C.byref(data), 0)
    if handle == W.HANDLE(-1).value:
        raise C.WinError(C.get_last_error())
    result = {}
    try:
        while True:
            result[data.name] = data.size
            if not K.FindNextStreamW(handle, C.byref(data)):
                if C.get_last_error() != 38:  # ERROR_HANDLE_EOF
                    raise C.WinError(C.get_last_error())
                break
    finally:
        K.FindClose(handle)
    return result


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def extended(path):
    p = os.path.abspath(path)
    return p if p.startswith('\\\\?\\') else '\\\\?\\' + p


def inside(path, root):
    return os.path.commonpath([os.path.abspath(path), os.path.abspath(root)]).lower() == os.path.abspath(root).lower() if Path(path).drive.lower() == Path(root).drive.lower() else False


def no_links(path):
    p = Path(path).absolute()
    for part in reversed([p, *p.parents]):
        if os.path.lexists(part) and os.lstat(part).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise RuntimeError(f'Reparse point in ordinary path: {part}')


def volume(path):
    buf = C.create_unicode_buffer(1024)
    if not K.GetVolumeNameForVolumeMountPointW(str(Path(path).anchor), buf, len(buf)):
        raise C.WinError(C.get_last_error())
    return buf.value


def signature(path):
    s = os.lstat(extended(path))
    # atime is deliberately omitted because verification itself reads files.
    result = dict(size=s.st_size, mtime_ns=s.st_mtime_ns, ctime_ns=s.st_ctime_ns,
                  inode=s.st_ino, device=s.st_dev, attributes=s.st_file_attributes)
    if stat.S_ISREG(s.st_mode) and not s.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
        result['stream_sizes'] = streams(path)
    return result


def input_idle():
    class Info(C.Structure):
        _fields_ = [('size', W.UINT), ('tick', W.DWORD)]
    info = Info(C.sizeof(Info), 0)
    if not U.GetLastInputInfo(C.byref(info)):
        raise C.WinError(C.get_last_error())
    return ((K.GetTickCount64() - info.tick) & 0xffffffff) / 1000


class Pause(Exception):
    pass


class SourceChanged(Exception):
    pass


class Lock:
    def __init__(self, path):
        self.path = path

    def __enter__(self):
        self.f = open(self.path, 'a+b')
        try:
            if os.fstat(self.f.fileno()).st_size == 0:
                self.f.write(b'0')
                self.f.flush()
            self.f.seek(0)
            msvcrt.locking(self.f.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            self.f.close()
            raise Pause('worker_already_running')
        return self

    def __exit__(self, *args):
        self.f.seek(0)
        msvcrt.locking(self.f.fileno(), msvcrt.LK_UNLCK, 1)
        self.f.close()


def validate(plan):
    if not plan['setup_complete'] or read(plan['setup_report'])['setup_status'] != 'complete':
        raise RuntimeError('Godot setup not complete')
    dest = Path(plan['destination'])
    no_links(dest)
    if volume(dest).lower() != plan['expected_volume_id'].lower():
        raise RuntimeError('Destination volume identity mismatch')
    records = []
    for src in plan['sources']:
        p = Path(src['path'])
        no_links(p)
        if not p.is_dir():
            raise RuntimeError(f'Source missing: {p}')
        if inside(dest, p) or inside(p, dest) or inside(plan['state_directory'], p):
            raise RuntimeError('Destination/control overlaps source')
        if volume(p).lower() != src['expected_volume_id'].lower():
            raise RuntimeError(f'Source volume identity mismatch: {p}')
        if os.lstat(p).st_ino != src['expected_root_inode']:
            raise RuntimeError(f'Source root identity mismatch: {p}')
        rel = Path(src['destination_relative'])
        if rel.is_absolute() or '..' in rel.parts:
            raise RuntimeError('Unsafe destination mapping')
        records.append({'path': str(p), 'volume': volume(p), 'exists': True})
    no_links(plan['state_directory'])
    return {'observed_at_utc': now(), 'sources': records,
            'destination_volume': volume(dest), 'free_bytes': shutil.disk_usage(dest.anchor).free}


def idle_probe(plan):
    cmd = [plan['powershell_executable'], '-NoProfile', '-NonInteractive', '-File',
           str(HERE / 'check_idle.ps1'), '-MinimumIdleMinutes', str(plan['idle_minutes']),
           '-MaxCpuPercent', str(plan['max_cpu_percent']),
           '-MaxGpuPercent', str(plan['max_gpu_percent_when_available'])]
    r = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='replace',
                       timeout=25, creationflags=subprocess.CREATE_NO_WINDOW)
    if r.returncode:
        raise RuntimeError('Idle probe failed: ' + r.stderr[-2000:])
    return json.loads(r.stdout.strip().lstrip('\ufeff'))


def thread_check(plan, snapshot):
    observed = read(snapshot)
    age = time.time() - observed['observed_unix']
    if not 0 <= age <= 45:
        raise RuntimeError('list_threads observation missing or stale (>45 seconds)')
    data = observed['result']
    if data.get('unavailableHosts') or data.get('unavailableSources'):
        raise RuntimeError('Incomplete list_threads observation')
    busy = []
    for t in data.get('pinnedThreads', []) + data.get('threads', []):
        if t['id'] == plan['task_thread_id']:
            continue
        relevant = (t.get('projectId') == plan['project_id'] or
                    'benchmark' in (t.get('cwd', '') + ' ' + t.get('title', '')).lower() or
                    'bench' in t.get('title', '').lower())
        if relevant and t.get('status') not in ('idle', 'notLoaded', 'systemError', 'completed', 'interrupted'):
            busy.append({k: t.get(k) for k in ('id', 'title', 'status', 'cwd')})
    return busy


class Guard:
    def __init__(self, plan, control):
        self.plan, self.control = plan, control
        self.stop = threading.Event()
        self.reason = None
        self.last_probe = 0
        self.last_lease = 0
        self.lease = {}
        self.probe()
        self.thread = threading.Thread(target=self.monitor, daemon=True)
        self.thread.start()

    def probe(self):
        try:
            validate(self.plan)
            result = idle_probe(self.plan)
            write(self.control / 'last_idle_check.json', result)
            self.last_probe = time.monotonic()
            if not result['ready']:
                self.reason = ','.join(result['reasons'])
        except Exception as e:
            self.reason = 'idle_probe_error: ' + str(e)

    def monitor(self):
        while not self.stop.wait(10):
            self.probe()
            if self.reason:
                break

    def tick(self):
        if self.reason:
            raise Pause(self.reason)
        if time.monotonic() - self.last_probe > 40:
            raise Pause('idle_probe_stale')
        if input_idle() < self.plan['idle_minutes'] * 60:
            raise Pause('recent_user_input')
        if time.monotonic() - self.last_lease > 0.5:
            self.lease = read(self.control / 'lease.json')
            self.last_lease = time.monotonic()
        if not self.lease.get('ready') or time.time() > self.lease['expires_unix']:
            raise Pause('thread_lease_expired_or_busy')
        if (self.control / 'pause.request').exists():
            raise Pause('pause_requested')


def copy_file(src, dst, guard):
    """Resume each NTFS data stream only after comparing its saved prefix.

    Partials live in a version-owned metadata folder, never in the source tree.
    A changed source signature gets a different partial; old evidence remains.
    """
    guard.tick()
    no_links(src)
    no_links(dst)
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    before = signature(src)
    if before['attributes'] & stat.FILE_ATTRIBUTE_ENCRYPTED:
        raise RuntimeError(f'EFS-encrypted file needs certificate-preserving backup handling: {src}')
    source_streams = streams(src)
    scratch = Path(getattr(guard, 'scratch', dst.parent / '.copy-progress'))
    no_links(scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256((str(dst) + json.dumps(before, sort_keys=True)).encode()).hexdigest()
    partial = scratch / (key + '.partial')
    if partial.exists():
        K.SetFileAttributesW(extended(partial), 128)
    else:
        partial.touch(exist_ok=False)
    write(scratch / (key + '.json'), {'source': str(src), 'destination': str(dst),
                                    'source_signature': before, 'streams': source_streams})
    for name, size in source_streams.items():
        suffix = '' if name == '::$DATA' else name
        source_stream = extended(src) + suffix
        target_stream = extended(partial) + suffix
        mode = 'r+b' if name in streams(partial) else 'w+b'
        with open(source_stream, 'rb') as sf, open(target_stream, mode) as df:
            try:
                df.seek(0, 2)
                offset = df.tell()
                if offset > size:
                    df.truncate(0)
                    offset = 0
                sf.seek(0)
                df.seek(0)
                checked = 0
                while checked < offset:
                    guard.tick()
                    n = min(4 * 1024 * 1024, offset - checked)
                    sb, db = sf.read(n), df.read(n)
                    if len(sb) != n or sb != db:
                        # Only this incomplete destination stream is reset.
                        sf.seek(0)
                        df.seek(0)
                        df.truncate(0)
                        break
                    checked += n
                while True:
                    guard.tick()
                    data = sf.read(4 * 1024 * 1024)
                    if not data:
                        break
                    df.write(data)
            finally:
                df.flush()
                os.fsync(df.fileno())
        if os.stat(target_stream).st_size != size:
            raise SourceChanged('stream size changed: ' + str(src))
    if signature(src) != before or streams(src) != source_streams:
        raise SourceChanged(str(src))
    guard.tick()
    shutil.copystat(src, partial)
    if not K.SetFileAttributesW(extended(partial), (before['attributes'] & (1 | 2 | 4 | 32 | 8192)) or 128):
        raise C.WinError(C.get_last_error())
    if dst.exists():
        attrs = os.lstat(dst).st_file_attributes
        if not K.SetFileAttributesW(extended(dst), (attrs & ~3) or 128):
            raise C.WinError(C.get_last_error())
    # File-only atomic rename within the unfinished version. Neither path is
    # a source path and no recursive move/delete is ever performed.
    os.replace(extended(partial), extended(dst))
    guard.tick()


def digest(path, guard):
    no_links(path)
    h = hashlib.sha256()
    with open(extended(path), 'rb') as f:
        while True:
            guard.tick()
            b = f.read(4 * 1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def alternate_hashes(path, guard):
    result = {}
    for name, size in streams(path).items():
        if name == '::$DATA':
            continue
        h = hashlib.sha256()
        with open(extended(path) + name, 'rb') as f:
            while True:
                guard.tick()
                block = f.read(4 * 1024 * 1024)
                if not block:
                    break
                h.update(block)
        result[name] = {'bytes': size, 'sha256': h.hexdigest()}
    return result


class Worker:
    def __init__(self, plan):
        self.plan = plan
        self.control = Path(plan['state_directory'])
        self.status_path = self.control / 'status.json'
        self.state = read(self.status_path)
        self.guard = None
        self.db = None

    def event(self, kind, **fields):
        record = {'at_utc': now(), 'event': kind, **fields}
        with (self.control / 'events.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')

    def save(self, **fields):
        self.state.update(fields, updated_at_utc=now())
        write(self.status_path, self.state)

    def paths(self, name, rel):
        src = next(s for s in self.plan['sources'] if s['name'] == name)
        return Path(src['path']) / rel, self.version / src['destination_relative'] / rel

    def scan(self, scan_id):
        db = self.db
        if not db.execute('SELECT 1 FROM scans WHERE id=?', (scan_id,)).fetchone():
            with db:
                db.execute('INSERT INTO scans VALUES (?,0)', (scan_id,))
                db.executemany('INSERT INTO queue VALUES (?,?,?)',
                               [(scan_id, s['name'], '') for s in self.plan['sources']])
        while row := db.execute('SELECT source,rel FROM queue WHERE scan=? LIMIT 1', (scan_id,)).fetchone():
            self.guard.tick()
            name, rel = row
            path, _ = self.paths(name, rel)
            no_links(path)
            with db:
                db.execute('INSERT OR REPLACE INTO entries VALUES (?,?,?,?,?)',
                           (scan_id, name, rel, 'directory', json.dumps(signature(path), sort_keys=True)))
                with os.scandir(extended(path)) as entries:
                    for entry in entries:
                        self.guard.tick()
                        child_rel = str(Path(rel) / entry.name)
                        meta = signature(entry.path)
                        if meta['attributes'] & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                            st = os.lstat(entry.path)
                            if st.st_reparse_tag not in (stat.IO_REPARSE_TAG_SYMLINK, stat.IO_REPARSE_TAG_MOUNT_POINT):
                                raise RuntimeError(f'Unsupported reparse tag {st.st_reparse_tag}: {entry.path}')
                            meta['target'] = os.readlink(entry.path)
                            meta['reparse_tag'] = st.st_reparse_tag
                            target = os.path.abspath(os.path.join(path, meta['target']))
                            target = target.removeprefix('\\\\?\\')
                            meta['external'] = not any(inside(target, s['path']) for s in self.plan['sources'])
                            kind = 'link'
                        elif entry.is_dir(follow_symlinks=False):
                            db.execute('INSERT OR IGNORE INTO queue VALUES (?,?,?)', (scan_id, name, child_rel))
                            continue
                        elif entry.is_file(follow_symlinks=False):
                            kind = 'file'
                        else:
                            raise RuntimeError(f'Unsupported filesystem item: {entry.path}')
                        db.execute('INSERT OR REPLACE INTO entries VALUES (?,?,?,?,?)',
                                   (scan_id, name, child_rel, kind, json.dumps(meta, sort_keys=True)))
                db.execute('DELETE FROM queue WHERE scan=? AND source=? AND rel=?', (scan_id, name, rel))
        with db:
            db.execute('UPDATE scans SET done=1 WHERE id=?', (scan_id,))

    def same_scan(self, a, b):
        q = 'SELECT source,rel,kind,meta FROM entries WHERE scan=? EXCEPT SELECT source,rel,kind,meta FROM entries WHERE scan=? LIMIT 1'
        return not self.db.execute(q, (a, b)).fetchone() and not self.db.execute(q, (b, a)).fetchone()

    def retry(self, label, fn):
        for attempt in range(1, 4):
            try:
                return fn()
            except (Pause, SourceChanged):
                raise
            except Exception as e:
                self.event('operation_failed', operation=label, attempt=attempt, error=repr(e))
                if attempt == 3:
                    raise
                self.event('retry', operation=label, next_attempt=attempt + 1)
                for _ in range(20):
                    self.guard.tick()
                    time.sleep(.1)

    def backup_files(self, scan_id):
        db = self.db
        for name, rel, kind, raw in db.execute('SELECT source,rel,kind,meta FROM entries WHERE scan=? ORDER BY source,rel', (scan_id,)):
            self.guard.tick()
            src, dst = self.paths(name, rel)
            meta = json.loads(raw)
            if kind == 'directory':
                no_links(dst)
                dst.mkdir(parents=True, exist_ok=True)
                continue
            if kind == 'link':
                continue  # Link identity and target are preserved in the manifest.
            if signature(src) != meta:
                raise SourceChanged(str(src))
            record = db.execute('SELECT meta,sha256,dest_meta FROM verified WHERE source=? AND rel=?', (name, rel)).fetchone()
            if record and record[0] == raw and dst.is_file():
                if json.dumps(signature(dst), sort_keys=True) == record[2]:
                    continue
                self.event('destination_changed', source=name, relative=rel)

            def transfer():
                self.event('copy_started', source=name, relative=rel, pid=os.getpid())
                copy_file(src, dst, self.guard)
                self.event('copy_finished', source=name, relative=rel, result=0)
                before = signature(src)
                if before != meta:
                    raise SourceChanged(str(src))
                sh = digest(src, self.guard)
                dh = digest(dst, self.guard)
                if signature(src) != before:
                    raise SourceChanged(str(src))
                if dst.stat().st_size != meta['size'] or sh != dh:
                    raise RuntimeError(f'Hash/size mismatch: {src}')
                return sh

            h = self.retry('copy_verify:' + str(src), transfer)
            with db:
                db.execute('INSERT OR REPLACE INTO verified VALUES (?,?,?,?,?,?)',
                           (name, rel, raw, h, now(), json.dumps(signature(dst), sort_keys=True)))
            if time.monotonic() - self.last_status > 5:
                self.save(current_file=str(src), verified_files=db.execute('SELECT COUNT(*) FROM verified').fetchone()[0])
                self.last_status = time.monotonic()

    def finalize(self, scan_id):
        # Final destination read catches corruption after the initial copy, and
        # final source hashes establish matching bytes, not just metadata.
        manifest = self.version / 'manifest.jsonl'
        total = count = links = 0
        samples = {}
        with manifest.open('w', encoding='utf-8') as out:
            for name, rel, kind, raw in self.db.execute('SELECT source,rel,kind,meta FROM entries WHERE scan=? ORDER BY source,rel', (scan_id,)):
                self.guard.tick()
                meta = json.loads(raw)
                src, dst = self.paths(name, rel)
                item = dict(source=name, relative=rel, kind=kind, metadata=meta,
                            backup_relative=str(dst.relative_to(self.version)))
                if kind == 'file':
                    if signature(src) != meta:
                        raise SourceChanged(str(src))
                    destination_meta = json.dumps(signature(dst), sort_keys=True)
                    cached = self.db.execute('SELECT sha256,at FROM final_hashes WHERE round=? AND source=? AND rel=? AND meta=? AND dest_meta=?',
                                             (self.state['round'], name, rel, raw, destination_meta)).fetchone()
                    if cached:
                        sh = dh = cached[0]
                        verified_at = cached[1]
                    else:
                        sh = self.retry('final_source_hash:' + str(src), lambda: digest(src, self.guard))
                        dh = self.retry('final_destination_hash:' + str(dst), lambda: digest(dst, self.guard))
                        verified_at = now()
                    if signature(src) != meta:
                        raise SourceChanged(str(src))
                    if sh != dh or dst.stat().st_size != meta['size']:
                        raise RuntimeError(f'Final verification mismatch: {src}')
                    source_ads = alternate_hashes(src, self.guard)
                    destination_ads = alternate_hashes(dst, self.guard)
                    if signature(src) != meta:
                        raise SourceChanged(str(src))
                    if source_ads != destination_ads:
                        raise RuntimeError(f'Alternate stream verification mismatch: {src}')
                    with self.db:
                        self.db.execute('INSERT OR REPLACE INTO final_hashes VALUES (?,?,?,?,?,?,?)',
                                        (self.state['round'], name, rel, raw, destination_meta, sh, verified_at))
                    item.update(sha256=sh, destination_sha256=dh, alternate_streams=source_ads, verified_at_utc=verified_at)
                    total += sum(meta['stream_sizes'].values())
                    count += 1
                    if name not in samples or (meta['size'] > 0 and (samples[name][0] == 0 or meta['size'] < samples[name][0])):
                        samples[name] = (meta['size'], dst, sh)
                elif kind == 'link':
                    links += 1
                out.write(json.dumps(item, ensure_ascii=False) + '\n')
        # A fresh, resumable full inventory after all hashes must still match.
        final_id = self.state.get('final_scan_id')
        completed = self.db.execute('SELECT done FROM scans WHERE id=?', (final_id,)).fetchone() if final_id else None
        if not final_id or (completed and completed[0]):
            final_id = str(uuid.uuid4())
            self.save(final_scan_id=final_id)
        self.scan(final_id)
        if not self.same_scan(scan_id, final_id):
            raise SourceChanged('source changed during final hashes')
        recovery = []
        for name, (_, source, h) in samples.items():
            dest = self.version / 'recovery-checks' / name / source.name
            copy_file(source, dest, self.guard)
            if digest(dest, self.guard) != h:
                raise RuntimeError('Recovery readback mismatch: ' + name)
            recovery.append({'source': name, 'restored_file': str(dest.relative_to(self.version)), 'sha256': h, 'passed': True})
        self.guard.tick()
        validate(self.plan)
        write(self.version / 'recovery-checks.json', recovery)
        write(self.version / 'source-map.json', self.plan['sources'])
        shutil.copy2(HERE / 'RESTORE.md', self.version / 'RESTORE.md')
        shutil.copy2(HERE / 'restore_backup.py', self.version / 'restore_backup.py')
        shutil.copy2(self.control / 'events.jsonl', self.version / 'events.jsonl')
        self.db.commit()
        self.db.close()
        self.db = None
        shutil.copy2(self.control / 'inventory.sqlite3', self.version / 'inventory.sqlite3')
        manifest_sha = digest(manifest, self.guard)
        report = dict(status='complete', completed_at_utc=now(), files=count, bytes=total,
                      links=links, manifest_sha256=manifest_sha, all_regular_files_verified=True,
                      unresolved_omissions=[], recovery_readback=recovery,
                      external_link_targets_copied=False, atomic_snapshot=False,
                      consistency='Two stable inventories before copy; per-file before/after metadata and SHA-256; full final source and destination hashes, followed by unchanged inventory. No VSS snapshot.',
                      restore_policy='Use manifest only; older removed source paths may remain as unreferenced files in an interrupted version.')
        # Exclusive creation protects completed versions even after a crash.
        with (self.version / 'COMPLETE.json').open('x', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        self.save(**report, phase='complete', worker_pid=None, version_directory=str(self.version))
        self.event('complete', files=count, bytes=total)

    def run(self):
        with Lock(self.control / 'worker.lock'):
            self.state = read(self.status_path)
            if self.state['status'] == 'complete':
                return
            validation = validate(self.plan)
            self.guard = Guard(self.plan, self.control)
            try:
                self.guard.tick()
                fingerprint = hashlib.sha256(json.dumps(self.plan, sort_keys=True).encode()).hexdigest()
                if self.state.get('plan_sha256') not in (None, fingerprint):
                    raise RuntimeError('Plan changed after backup began; inspect before continuing')
                if not self.state.get('version_directory'):
                    version = Path(self.plan['destination']) / (dt.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8])
                    version.mkdir(parents=True, exist_ok=False)
                    self.save(version_directory=str(version), plan_sha256=fingerprint, round=1, phase='scan_a')
                    write(version / 'execution-plan.json', self.plan)
                self.version = Path(self.state['version_directory'])
                self.guard.scratch = self.version / '.copy-progress'
                if not inside(self.version, self.plan['destination']) or self.version == Path(self.plan['destination']):
                    raise RuntimeError('Unsafe version path')
                no_links(self.version)
                if (self.version / 'COMPLETE.json').exists():
                    self.save(**read(self.version / 'COMPLETE.json'), worker_pid=None)
                    return
                self.save(status='running', worker_pid=os.getpid(), validation=validation)
                self.event('worker_started', pid=os.getpid(), phase=self.state['phase'])
                self.db = sqlite3.connect(self.control / 'inventory.sqlite3')
                self.db.executescript('''
                    CREATE TABLE IF NOT EXISTS scans(id TEXT PRIMARY KEY,done INTEGER);
                    CREATE TABLE IF NOT EXISTS queue(scan TEXT,source TEXT,rel TEXT,PRIMARY KEY(scan,source,rel));
                    CREATE TABLE IF NOT EXISTS entries(scan TEXT,source TEXT,rel TEXT,kind TEXT,meta TEXT,PRIMARY KEY(scan,source,rel));
                    CREATE TABLE IF NOT EXISTS verified(source TEXT,rel TEXT,meta TEXT,sha256 TEXT,at TEXT,dest_meta TEXT,PRIMARY KEY(source,rel));
                    CREATE TABLE IF NOT EXISTS final_hashes(round INTEGER,source TEXT,rel TEXT,meta TEXT,dest_meta TEXT,sha256 TEXT,at TEXT,PRIMARY KEY(round,source,rel));
                ''')
                self.last_status = time.monotonic()
                while True:
                    n = self.state.get('round', 1)
                    a, b = f'{n}-a', f'{n}-b'
                    try:
                        if self.state['phase'] == 'scan_a':
                            self.scan(a)
                            self.save(phase='scan_b')
                        if self.state['phase'] == 'scan_b':
                            for _ in range(100):
                                self.guard.tick()
                                time.sleep(.1)
                            self.scan(b)
                            if not self.same_scan(a, b):
                                raise SourceChanged('source not stable before copying')
                            size = count = 0
                            for (raw,) in self.db.execute("SELECT meta FROM entries WHERE scan=? AND kind='file'", (b,)):
                                self.guard.tick()
                                size += sum(json.loads(raw)['stream_sizes'].values())
                                count += 1
                            # Full source size + reserve is conservative even on resume.
                            if shutil.disk_usage(self.version).free < size * 1.05 + 1024**3:
                                raise RuntimeError(f'Insufficient free space; required conservative budget {int(size*1.05+1024**3)}')
                            self.save(phase='copy', total_bytes=size, total_files=count)
                        if self.state['phase'] == 'copy':
                            self.backup_files(b)
                            self.save(phase='verify')
                        if self.state['phase'] == 'verify':
                            self.finalize(b)
                            break
                    except SourceChanged as e:
                        self.event('source_changed', round=n, detail=str(e))
                        self.save(round=n + 1, phase='scan_a', final_scan_id=None)
                        # Pause until the next eligible idle window. Never complete
                        # using a manifest known to have changed.
                        raise Pause('source_changed_rescan_required')
            except Pause as e:
                self.event('paused', reason=str(e))
                self.save(status='waiting_for_idle', pause_reason=str(e), worker_pid=None)
            except Exception as e:
                self.event('failed', error=repr(e), traceback=traceback.format_exc())
                self.save(status='failed', error=repr(e), worker_pid=None)
                raise
            finally:
                self.guard.stop.set()
                if self.db:
                    self.db.close()


def control(plan, action, snapshot=None):
    root = Path(plan['state_directory'])
    root.mkdir(parents=True, exist_ok=True)
    status = root / 'status.json'
    if action == 'status':
        return read(status)
    if action == 'pause':
        write(root / 'lease.json', {'ready': False, 'expires_unix': 0})
        return {'pause_requested': True}
    validation = validate(plan)
    busy = thread_check(plan, snapshot)
    idle = idle_probe(plan)
    ready = idle['ready'] and not busy
    check = dict(observed_at_utc=now(), ready=ready, active_threads=busy, idle=idle, validation=validation)
    write(root / 'last_check.json', check)
    state = read(status) if status.exists() else dict(status='waiting_for_idle', phase='not_started', version_directory=None)
    if action == 'initialize':
        if state.get('version_directory'):
            raise RuntimeError('Initialization cannot reset an existing version')
        write(root / 'execution-plan.json', plan)
        write(root / 'first_check.json', check)
        state.update(status='waiting_for_idle', initialized_at_utc=now(), first_run_no_scan_or_copy=True)
        write(status, state)
        write(root / 'lease.json', {'ready': False, 'expires_unix': 0})
        return state
    if state['status'] in ('complete', 'failed'):
        return state  # failures require inspection, not blind repeating
    write(root / 'lease.json', {'ready': ready, 'expires_unix': time.time() + 75 if ready else 0,
                               'observed_at_utc': now(), 'task_thread_id': plan['task_thread_id']})
    if ready:
        return {'ready': True, 'status': state['status'], 'launch_allowed': True}
    return {'ready': False, 'status': state['status'], 'launch_allowed': False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['initialize', 'tick', 'status', 'pause', 'run'])
    p.add_argument('--plan', default=str(HERE / 'backup_plan.json'))
    p.add_argument('--threads-snapshot')
    args = p.parse_args()
    plan = read(args.plan)
    if args.action == 'run':
        worker = Worker(plan)
        try:
            worker.run()
        except Pause:
            pass  # another worker holds the OS lock
        except Exception as e:
            if worker.state.get('status') != 'failed':
                worker.event('startup_failed', error=repr(e), traceback=traceback.format_exc())
                worker.save(status='failed', error=repr(e), worker_pid=None)
            raise
    else:
        print(json.dumps(control(plan, args.action, args.threads_snapshot), ensure_ascii=False))


if __name__ == '__main__':
    main()
