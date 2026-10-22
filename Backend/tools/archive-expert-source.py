"""Archive immutable expert pilot source and a reviewable diff against its starter."""
import difflib
import hashlib
import json
import shutil
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP = {'node_modules', '.git', '.npm-cache', '.cache', '__pycache__', 'tmp', '.venv'}
EXT = {'.go', '.mod', '.sum', '.js', '.cjs', '.mjs', '.ts', '.json', '.html', '.css', '.md', '.txt', '.sql', '.svg', '.png', '.jpg', '.webp', '.ps1', '.sh', '.py', '.yaml', '.yml'}


def archive(run):
    h = Path(run['harness'])
    meta = json.loads((h / 'meta.json').read_text(encoding='utf-8'))
    execution = json.loads((h / 'execution.json').read_text(encoding='utf-8'))
    if not meta.get('verdict'):
        raise RuntimeError('Review must precede source archive')
    if execution['status'] not in {'completed', 'timeout', 'process_error'}:
        raise RuntimeError('No measured terminal generation')
    source = Path(run['workdir']) / 'repo'
    dest = ROOT / 'Backend' / 'pilots' / '20261016' / 'submissions' / run['project']
    if dest.exists():
        raise RuntimeError('Will not overwrite source archive')
    dest.mkdir(parents=True)
    hashes = {}
    for file in sorted(source.rglob('*')):
        rel = file.relative_to(source)
        if not file.is_file() or any(p in SKIP for p in rel.parts):
            continue
        if file.suffix.lower() not in EXT and file.name not in {'LICENSE', 'Procfile', '.gitignore'}:
            continue
        if file.name.endswith('.log') or file.stat().st_size > 4_000_000:
            continue
        target = dest / 'repo' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
        hashes[rel.as_posix()] = hashlib.sha256(file.read_bytes()).hexdigest()
    project = ROOT / 'L4_Expert' / run['project']
    before = {}
    with tarfile.open(project / 'starter.tar') as tf:
        for member in tf.getmembers():
            if member.isfile() and member.name.startswith('repo/'):
                before[member.name[5:]] = tf.extractfile(member).read()
    diff = []
    for name in sorted(set(before) | set(hashes)):
        old = before.get(name, b'')
        file = dest / 'repo' / name
        new = file.read_bytes() if file.is_file() else b''
        if old == new:
            continue
        try:
            diff.extend(difflib.unified_diff(old.decode('utf-8-sig').splitlines(True), new.decode('utf-8-sig').splitlines(True), fromfile='a/' + name, tofile='b/' + name))
        except UnicodeDecodeError:
            diff.append('Binary files differ: ' + name + '\n')
    (dest / 'changes.patch').write_text(''.join(diff), encoding='utf-8')
    manifest = dict(kind='pilot-submission-not-reference', project=run['project'],
                    runId=run['run_id'], sourceWorkdir=run['workdir'], promptSha256=meta['prompt_sha256'],
                    sourceFiles=hashes, generation=execution, reviewVerdict=meta['verdict'],
                    functionalEvidence='Backend/pilots/20261016/' + run['project'] + '/CHECKS.json')
    (dest / 'SNAPSHOT.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (dest / 'PILOT-NOTE.md').write_text('# 试测交付，非参考解\n\n保留完整相对源码路径与对比补丁。模型会话结束不代表核心功能全部通过；请结合 CHECKS.json、原始日志和新 L4 报告阅读。失败样本同样保留，未做人工补全。\n', encoding='utf-8')
    print(run['project'], len(hashes), meta['verdict'])


if __name__ == '__main__':
    suite = json.loads((ROOT / 'sandbox/runs/backend-expert-open-20261016/suite-backend-expert-open-20261016.json').read_text(encoding='utf-8'))
    for run in suite['runs']:
        archive(run)
