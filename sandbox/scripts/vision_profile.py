"""Opt-in deterministic evaluator for the registered PairedVision release.

Only this machine module reads the registered gold. It returns scores, never gold.
An external working directory is an observation, NOT a filesystem access boundary.
"""
from __future__ import annotations
import importlib.util
import json
import re
import shutil
import stat
from pathlib import Path
from sandbox_lib import ROOT, dump_json, load_json, load_meta, now_iso, sha256_file, snapshot_dir, scan_transcript

RELEASE = ROOT / 'Vision/PairedVision/v1'
PROFILE = 'bare-vision-v1'


def safe_slug(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,79}', value) or value.endswith('.'):
        raise RuntimeError('model must be a simple ASCII slug, 1..80 characters')
    if value.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *[f'COM{i}' for i in range(1,10)], *[f'LPT{i}' for i in range(1,10)]}:
        raise RuntimeError('reserved Windows model slug')


def no_links(path):
    """Reject symlinks, junctions/reparse points and file hardlinks before reading."""
    for p in [path, *path.parents]:
        if p.exists() or p.is_symlink():
            s = p.lstat()
            if stat.S_ISLNK(s.st_mode) or getattr(s, 'st_file_attributes', 0) & 1024:
                raise RuntimeError(f'linked/reparse path: {p.name}')
    if path.is_file() and path.stat().st_nlink > 1:
        raise RuntimeError(f'hardlinked file: {path.name}')


def safe_tree(path):
    no_links(path)
    if not path.is_dir():
        raise RuntimeError('workspace missing')
    for p in path.iterdir():
        no_links(p)
        if p.is_dir():
            safe_tree(p)


def lock():
    no_links(RELEASE / 'LOCK.json')
    d = load_json(RELEASE / 'LOCK.json')
    if d.get('suite') != 'PairedVision-v1' or d.get('profile') != PROFILE:
        raise RuntimeError('release identity mismatch')
    for name, expected in d['sha256'].items():
        p = RELEASE / name
        if not p.resolve().is_relative_to(RELEASE.resolve()):
            raise RuntimeError('release path escape')
        no_links(p)
        if not p.is_file() or sha256_file(p) != expected:
            raise RuntimeError(f'release hash mismatch: {name}')
    return d


def registered(project):
    return project.resolve().parent == (RELEASE / 'public').resolve()


def payload(project):
    if not registered(project):
        return None
    d = lock()
    q = project.name.removeprefix('PV1-')
    c = d['cases'].get(q)
    if c is None or (RELEASE / c['project']).resolve() != project.resolve():
        raise RuntimeError('unregistered vision case')
    if any(Path(n).name != n or (n != 'PROJECT_PROMPT.md' and not re.fullmatch(r'stem_\d+\.png', n)) for n in c['files']):
        raise RuntimeError('invalid public file whitelist')
    return {'profile': PROFILE, 'case': q, 'release_sha256': sha256_file(RELEASE / 'LOCK.json'),
            'files': c['files'], 'isolation_verification': 'unverified',
            'review_scope': 'registered_machine_scorer_only', 'execution_profile': 'agent-tools'}


def stage(project, workdir, profile):
    for name in profile['files']:
        if name != 'PROJECT_PROMPT.md':
            shutil.copyfile(project / name, workdir / name)


def strict_json(text):
    def pairs(items):
        d = {}
        for k, v in items:
            if k in d:
                raise ValueError('duplicate JSON key')
            d[k] = v
        return d
    def constant(x):
        raise ValueError('non-finite JSON number')
    return json.loads(text, object_pairs_hook=pairs, parse_constant=constant)


def evaluate(meta, harness, transcript_path=None):
    result = {'profile': PROFILE, 'case': meta.get('case'), 'verdict': 'INVALID',
              'isolation_verification': 'unverified', 'score': None,
              'note': 'External cwd and transcript scanning do not prove OS access isolation.'}
    try:
        p = payload(ROOT / meta['project_rel'])
        if not p or p['case'] != meta.get('case') or p['release_sha256'] != meta.get('release_sha256'):
            raise RuntimeError('release/run identity mismatch')
        wd = Path(meta['workdir'])
        safe_tree(wd)
        if wd.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError('workspace is inside repository')
        d = lock()
        case = d['cases'][p['case']]
        expected = {}
        for name in p['files']:
            dest = 'PROMPT.md' if name == 'PROJECT_PROMPT.md' else name
            expected[dest] = d['sha256'][case['project'] + '/' + name]
        before = load_json(harness / 'snapshot.json')
        after = snapshot_dir(wd)
        if set(before) != set(expected):
            raise RuntimeError('prepare snapshot payload mismatch')
        for name, digest in expected.items():
            if name not in after or sha256_file(wd / name) != digest or before[name] != after[name]:
                raise RuntimeError(f'input missing or changed: {name}')
        from sandbox_lib import FORBIDDEN_DIR_NAMES, AGENT_STATE_NAMES
        for item in wd.rglob('*'):
            if item.name in FORBIDDEN_DIR_NAMES | AGENT_STATE_NAMES:
                raise RuntimeError(f'forbidden workspace item: {item.name}')
        result['workspace_snapshot'] = after
        result['transcript'] = None
        if transcript_path is not None:
            tp = Path(transcript_path)
            no_links(tp)
            text = tp.read_text(encoding='utf-8', errors='replace')
            result['transcript'] = {'path': str(tp.resolve()), 'sha256': sha256_file(tp)}
            if scan_transcript(text):
                raise RuntimeError('transcript contains repository leakage tokens')
        answer = wd / 'answer.json'
        result['verdict'] = 'FAIL'
        if meta.get('execution_status') not in {None, 'completed'}:
            result['reason'] = 'execution did not complete: ' + meta['execution_status']
            return result
        if not answer.is_file():
            result['reason'] = 'missing answer.json'
            return result
        result['answer_sha256'] = sha256_file(answer)
        try:
            obj = strict_json(answer.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError, RecursionError):
            result['reason'] = 'invalid strict JSON (fences, duplicate keys, NaN rejected)'
            return result
        spec = importlib.util.spec_from_file_location('paired_vision_frozen_score', RELEASE / 'private/score.py')
        scorer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(scorer)
        try:
            result['score'] = scorer.score(p['case'], obj)
        except (OverflowError, RecursionError):
            result['reason'] = 'answer exceeds supported numeric or nesting bounds'
            return result
        if not result['score']['valid_schema']:
            result['reason'] = 'invalid answer schema'
            return result
        result['verdict'] = 'PASS_WITH_WARNINGS'
        result['reason'] = 'scorable answer; correctness is score, isolation remains unverified'
        return result
    except (OSError, ValueError, KeyError, RuntimeError) as e:
        result['verdict'] = 'INVALID'
        result['reason'] = str(e)
        return result


def review(harness, strict=False, transcript_path=None):
    meta = load_meta(harness)
    r = evaluate(meta, harness, transcript_path)
    dump_json(harness / 'SCORE.json', r)
    (harness / 'REVIEW.md').write_text('# PairedVision machine review\n\n```json\n' + json.dumps(r, ensure_ascii=False, indent=2) + '\n```\n', encoding='utf-8')
    meta.update(status='reviewed', verdict=r['verdict'], reviewed_at=now_iso(),
                score=r['score'], isolation_verification=r['isolation_verification'],
                score_report_sha256=sha256_file(harness / 'SCORE.json'))
    dump_json(harness / 'meta.json', meta)
    print(json.dumps({'verdict': r['verdict'], 'score': r['score'], 'reason': r.get('reason')}, ensure_ascii=False))
    return int(strict and r['verdict'] not in {'PASS', 'PASS_WITH_WARNINGS'})


def collect(harness, dry_run=False, **_):
    meta = load_meta(harness)
    report = harness / 'SCORE.json'
    if meta.get('verdict') not in {'PASS', 'PASS_WITH_WARNINGS'} or not report.is_file():
        print('ERROR: missing successful review; --force cannot bypass vision integrity')
        return 3
    if sha256_file(report) != meta.get('score_report_sha256'):
        print('ERROR: score report changed since review')
        return 3
    old = load_json(report)
    tp = (old.get('transcript') or {}).get('path')
    current = evaluate(meta, harness, tp)
    if current != old:
        print('ERROR: review is stale; inputs, outputs, release or transcript changed')
        return 3
    safe_slug(meta['model'])
    safe_slug(meta['run_id'])
    dest = RELEASE.parent / 'results' / meta['model'] / meta['run_id']
    no_links(dest)
    if dest.exists():
        print('ERROR: archive already exists; never overwrite run evidence')
        return 3
    if not dry_run:
        dest.mkdir(parents=True)
        for name in ('SCORE.json', 'REVIEW.md', 'meta.json', 'snapshot.json'):
            shutil.copyfile(harness / name, dest / name)
        shutil.copyfile(Path(meta['workdir']) / 'answer.json', dest / 'answer.json')
        meta.update(status='collected', collected_to=str(dest))
        dump_json(harness / 'meta.json', meta)
    print('collect vision ->', dest)
    return 0
