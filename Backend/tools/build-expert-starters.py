"""Freeze licensed upstream source subsets; never includes graders or answers."""
import hashlib
import json
import shutil
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def dump(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def prepare():
    definitions = [
        ('RaftTxnWorkbench', 'etcd-v3.5.17', 'https://github.com/etcd-io/etcd',
         '507c0de87bd5034e3de4ab76ebf96b54dae0cd52', 'v3.5.17', 'Apache-2.0'),
        ('DurableCollab', 'y-websocket-v2.1.0', 'https://github.com/yjs/y-websocket',
         '7c3408a33fc52bd5001d2ff80b38624961402614', 'v2.1.0', 'MIT'),
    ]
    for name, directory, url, commit, tag, license_id in definitions:
        project = ROOT / 'L4_Expert' / name
        stage = ROOT / 'Backend' / '.cache' / name
        repo = stage / 'repo'
        repo.mkdir(parents=True, exist_ok=True)
        upstream = ROOT / 'Backend' / 'upstream' / directory
        actual = subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip()
        if actual != commit:
            raise RuntimeError(f'Upstream commit mismatch: {name}')
        if name == 'RaftTxnWorkbench':
            source = upstream / 'contrib' / 'raftexample'
            files = list(source.iterdir())
            for f in files:
                if f.is_file():
                    shutil.copyfile(f, repo / f.name)
            shutil.copyfile(upstream / 'LICENSE', repo / 'LICENSE')
            (repo / 'go.mod').write_text('module backendbench/rafttxn\n\ngo 1.23.0\n\nrequire (\n'
                '\tgo.etcd.io/etcd/client/pkg/v3 v3.5.17\n'
                '\tgo.etcd.io/etcd/raft/v3 v3.5.17\n'
                '\tgo.etcd.io/etcd/server/v3 v3.5.17\n'
                '\tgo.uber.org/zap v1.17.0\n)\n', encoding='utf-8')
            hashes = {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in files if f.is_file()}
            hashes['LICENSE'] = hashlib.sha256((upstream / 'LICENSE').read_bytes()).hexdigest()
            adaptation = 'Unmodified contrib/raftexample sources and tests; standalone go.mod/go.sum replace monorepo-local module replacements. No behavior changes.'
        else:
            files = [f for f in upstream.rglob('*') if f.is_file() and '.git' not in f.relative_to(upstream).parts and f.suffix != '.log']
            for f in files:
                target = repo / f.relative_to(upstream)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(f, target)
            hashes = {f.relative_to(upstream).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
            adaptation = 'Unmodified upstream source and lockfile. Install with npm ci --ignore-scripts; native optional LevelDB is not needed for the task.'
            package = json.loads((repo / 'package.json').read_text(encoding='utf-8'))
            package['dependencies']['lib0'] = '0.2.99'
            package['devDependencies']['typescript'] = '4.9.5'
            dump(repo / 'package.json', package)
        project.mkdir(parents=True, exist_ok=True)
        dump(project / 'UPSTREAM.json', dict(url=url, commit=commit, tag=tag, license=license_id,
             retrievedAt='2026-10-16', sourceFiles=hashes, adaptation=adaptation))
        shutil.copyfile(project / 'UPSTREAM.json', repo / 'UPSTREAM.json')
        print(name, repo)


def freeze():
    for name in ('RaftTxnWorkbench', 'DurableCollab'):
        project = ROOT / 'L4_Expert' / name
        repo = ROOT / 'Backend' / '.cache' / name / 'repo'
        target = project / 'starter.tar'
        provenance = json.loads((project / 'UPSTREAM.json').read_text(encoding='utf-8'))
        if name == 'DurableCollab':
            provenance['adaptation'] = 'Upstream business source unchanged. Baseline toolchain pins lib0=0.2.99 and typescript=4.9.5 in package.json/package-lock.json so npm test passes on Node 24. Native optional LevelDB install scripts are skipped.'
        dump(project / 'UPSTREAM.json', provenance)
        shutil.copyfile(project / 'UPSTREAM.json', repo / 'UPSTREAM.json')
        source_paths = set(json.loads((project / 'UPSTREAM.json').read_text(encoding='utf-8'))['sourceFiles'])
        def eligible(f):
            rel = f.relative_to(repo).as_posix()
            return f.is_file() and (rel in source_paths or rel in ('UPSTREAM.json', 'go.mod', 'go.sum'))
        with tarfile.open(target, 'w', format=tarfile.USTAR_FORMAT) as tf:
            for f in sorted(repo.rglob('*')):
                if not eligible(f):
                    continue
                info = tf.gettarinfo(str(f), 'repo/' + f.relative_to(repo).as_posix())
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                with f.open('rb') as stream:
                    tf.addfile(info, stream)
        dump(project / 'STARTER_LOCK.json', dict(schemaVersion=1, file='starter.tar',
             sha256=hashlib.sha256(target.read_bytes()).hexdigest(), bytes=target.stat().st_size,
             files={f.relative_to(repo).as_posix(): hashlib.sha256(f.read_bytes()).hexdigest()
                    for f in sorted(repo.rglob('*')) if eligible(f)}))
        prompt = project / 'PROJECT_PROMPT.md'
        dump(project / 'PROMPT_REGISTRY.json', dict(schemaVersion=1, dispatchPrompt='PROJECT_PROMPT.md',
             sha256=hashlib.sha256(prompt.read_bytes()).hexdigest(),
             inputFiles=['starter.tar'], registeredAt='2026-10-16',
             note='Frozen public upstream starter only. Graders, prior submissions and reference patches are not inputs. Starter hash is independently checked against STARTER_LOCK.json before prepare.'))
        print(name, target.stat().st_size)


if __name__ == '__main__':
    import sys
    (freeze if '--freeze' in sys.argv else prepare)()
