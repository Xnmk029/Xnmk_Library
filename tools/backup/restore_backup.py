"""Verify a completed backup, or restore manifest files into a NEW directory.

No original source access is needed. Link targets are preserved as a manifest;
links are intentionally not activated during restore. See RESTORE.md.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import ctypes as C
from ctypes import wintypes as W

K = C.WinDLL('kernel32', use_last_error=True)
K.CopyFileW.argtypes = [W.LPCWSTR, W.LPCWSTR, W.BOOL]
K.CopyFileW.restype = W.BOOL


def winpath(path):
    return '\\\\?\\' + os.path.abspath(path)


def verify_streams(path, row):
    for name, evidence in row.get('alternate_streams', {}).items():
        stream = str(path) + name
        if os.stat(stream).st_size != evidence['bytes'] or sha(stream) != evidence['sha256']:
            raise ValueError('Alternate stream mismatch: ' + stream)


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def safe(root, relative):
    rel = Path(relative)
    if rel.is_absolute() or '..' in rel.parts:
        raise ValueError('Unsafe manifest path: ' + relative)
    path = root / rel
    for parent in [path, *path.parents]:
        if os.path.lexists(parent) and os.lstat(parent).st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError('Unexpected reparse point: ' + str(parent))
        if parent == root:
            break
    return path


def restore(version, destination=None):
    version = Path(version).resolve()
    report = json.loads((version / 'COMPLETE.json').read_text(encoding='utf-8'))
    manifest = version / 'manifest.jsonl'
    if sha(manifest) != report['manifest_sha256']:
        raise ValueError('Manifest hash mismatch')
    if destination:
        destination = Path(destination).absolute()
        if destination.exists():
            raise FileExistsError('Restore destination must not exist')
        if version == destination or version in destination.parents or destination in version.parents:
            raise ValueError('Restore must not overlap backup')
        safe(destination.parent, destination.name)
        destination.mkdir(parents=True, exist_ok=False)
    links, count, size = [], 0, 0
    with manifest.open(encoding='utf-8') as f:
        for line in f:
            row = json.loads(line)
            source = safe(version, row['backup_relative'])
            target = safe(destination, row['backup_relative']) if destination else None
            if row['kind'] == 'file':
                if source.stat().st_size != row['metadata']['size'] or sha(source) != row['sha256']:
                    raise ValueError('Backup file mismatch: ' + str(source))
                verify_streams(source, row)
                if target:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if not K.CopyFileW(winpath(source), winpath(target), True):
                        raise C.WinError(C.get_last_error())
                    if sha(target) != row['sha256']:
                        raise ValueError('Restore hash mismatch: ' + str(target))
                    verify_streams(target, row)
                count += 1
                size += row['metadata']['size'] + sum(x['bytes'] for x in row.get('alternate_streams', {}).values())
            elif row['kind'] == 'directory' and target:
                target.mkdir(parents=True, exist_ok=True)
            elif row['kind'] == 'link':
                links.append(row)
    if count != report['files'] or size != report['bytes']:
        raise ValueError('Manifest totals disagree with completion report')
    if destination:
        (destination / 'restore-links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'verified_files': count, 'bytes': size, 'links_preserved_in_manifest': len(links), 'restored_to': str(destination) if destination else None}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('version')
    parser.add_argument('--restore-to')
    args = parser.parse_args()
    print(json.dumps(restore(args.version, args.restore_to), ensure_ascii=False))
