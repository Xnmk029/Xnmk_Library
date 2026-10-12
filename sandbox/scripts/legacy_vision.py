"""Exploratory bare profile for catalogued legacy Vision questions.

Scope: Vision/catalog/BANK.json records with a located prompt and gold that are
NOT PairedVision (MusicTheory/Geometry/RealScene legacy, AnimeID, Iteration).
Legacy PROJECT_PROMPT.md files are maintainer documents (gold paths, grading
notes, sometimes the answer itself); only the single ```text block is shipped.
Workdir names use opaque case ids because several bank ids name the answer.

Only this module reads gold. Reports carry match status, never gold values.
Free-text matching is heuristic: misses are pending_human, not wrong.
An external working directory is an observation, NOT an access boundary.

  python sandbox/scripts/legacy_vision.py prepare  --model <slug> [--tracks Geometry,RealScene]
  python sandbox/scripts/legacy_vision.py finalize --suite <manifest> --transcripts <dir> [--collect]
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sandbox_lib import (  # noqa: E402
    AGENT_STATE_NAMES, FORBIDDEN_DIR_NAMES, PROMPT_FILE, PROTOCOL_VERSION, ROOT, RUNS, RUNS_ROOT,
    build_dispatch_text, dump_json, list_deliverables, load_json, load_meta, now_iso,
    scan_transcript, sha256_file, snapshot_dir, ts_slug,
)
from vision_profile import no_links, safe_slug, safe_tree, strict_json  # noqa: E402

PROFILE = 'legacy-vision-explore-v1'
VISION = ROOT / 'Vision'
BANK = VISION / 'catalog/BANK.json'
ARCHIVE = VISION / 'LegacyVisionExplore/results'
TRACK_ORDER = ('Geometry', 'RealScene', 'MusicTheory', 'AnimeID', 'Iteration')
SELECT = {
    ('MusicTheory', 'legacy_review_required'), ('Geometry', 'legacy_review_required'),
    ('RealScene', 'legacy_review_required'), ('AnimeID', 'legacy_review_required'),
    ('Iteration', 'development_measured'), ('Iteration', 'holdout_incomplete'),
}
TEXT_BLOCK = re.compile(r'```text\r?\n(.*?)\r?\n```', re.S)


def opaque(bank_id):
    return 'LV-' + hashlib.sha256(bank_id.encode('utf-8')).hexdigest()[:10]


def asset_path(a):
    return a if isinstance(a, str) else a['path']


def prompt_text(rec):
    src = VISION / rec['prompt']
    raw = src.read_text(encoding='utf-8')
    if rec['track'] == 'Iteration':
        return raw.strip() + '\n', src
    blocks = TEXT_BLOCK.findall(raw)
    if len(blocks) != 1:
        raise RuntimeError(f'expected one text block: {rec["id"]}')
    return blocks[0].strip() + '\n', src


def cases(tracks=None):
    bank = load_json(BANK)
    out = []
    for rec in bank['records']:
        if (rec['track'], rec['status']) not in SELECT or not rec.get('prompt') or not rec.get('gold_reference'):
            continue
        if tracks and rec['track'] not in tracks:
            continue
        out.append(rec)
    out.sort(key=lambda r: (TRACK_ORDER.index(r['track']), r['id']))
    return out


def prepare_one(rec, model):
    case = opaque(rec['id'])
    text, src = prompt_text(rec)
    run_id = f'{ts_slug()}-{case}'
    workdir, harness = RUNS_ROOT / model / run_id, RUNS / model / run_id
    no_links(workdir)
    no_links(harness)
    if workdir.resolve().is_relative_to(ROOT.resolve()):
        raise RuntimeError('workdir must be outside repository')
    workdir.mkdir(parents=True, exist_ok=False)
    harness.mkdir(parents=True, exist_ok=False)
    (workdir / PROMPT_FILE).write_text(text, encoding='utf-8')
    inputs = {PROMPT_FILE: sha256_file(workdir / PROMPT_FILE)}
    for i, a in enumerate(rec['assets'], 1):
        p = VISION / asset_path(a)
        no_links(p)
        name = f'stem_{i:02d}{p.suffix.lower()}'
        shutil.copyfile(p, workdir / name)
        inputs[name] = sha256_file(p)
    meta = {
        'run_id': run_id, 'model': model, 'project': case, 'case': case,
        'bank_id': rec['id'], 'track': rec['track'], 'bank_status': rec['status'],
        'created_at': now_iso(), 'protocol_version': PROTOCOL_VERSION, 'mode': 'bare',
        'profile': PROFILE, 'execution_profile': 'agent-tools',
        'prompt_sha256': inputs[PROMPT_FILE], 'prompt_source': rec['prompt'],
        'prompt_source_sha256': sha256_file(src), 'inputs': inputs,
        'gold_reference': rec['gold_reference'], 'gold_sha256': sha256_file(VISION / rec['gold_reference']),
        'workdir': str(workdir), 'isolation': 'external-empty-dir+observation',
        'isolation_verification': 'unverified', 'review_scope': 'profile_machine_scorer_only',
        'status': 'prepared',
    }
    dump_json(harness / 'meta.json', meta)
    dump_json(harness / 'snapshot.json', snapshot_dir(workdir))
    return {'case': case, 'bank_id': rec['id'], 'track': rec['track'], 'run_id': run_id,
            'workdir': str(workdir), 'harness': str(harness), 'dispatch': build_dispatch_text(case, workdir)}


def prepare_suite(model, tracks=None):
    safe_slug(model)
    recs = cases(tracks)
    if not recs:
        raise RuntimeError('no cases selected')
    runs = [prepare_one(r, model) for r in recs]
    out = RUNS / model / f'legacy-suite-{ts_slug()}.json'
    dump_json(out, {'suite': PROFILE, 'bank_sha256': sha256_file(BANK), 'created_at': now_iso(),
                    'model_slug': model, 'status': 'prepared', 'fresh_context_per_case': True,
                    'track_order': list(TRACK_ORDER), 'runs': runs})
    out.with_suffix('.md').write_text('# 派发清单（仅编排方可读）\n\n' + '\n\n'.join(
        f'## {r["case"]}\n\n```text\n{r["dispatch"]}\n```' for r in runs) + '\n', encoding='utf-8')
    print(f'prepared {len(runs)} cases')
    print('SUITE_MANIFEST=' + str(out))
    return out


# --- scoring (only place gold is read) ---------------------------------------

PUNCT = re.compile(r'[\s*_`"\'“”‘’（）()\[\]【】{}<>《》,，。:：;；!！?？、|#~\-—–·]+')


def norm(s):
    return PUNCT.sub('', unicodedata.normalize('NFKC', str(s)).lower())


def extract_letter(text):
    t = unicodedata.normalize('NFKC', text)
    m = re.search(r'(?:答案|正确答案|选项|应选|选择|answer)\s*(?:是|为|应为|:|：)?\s*[*\s]*[\(（\[]?\s*([A-Da-d])(?![A-Za-z])', t, re.I)
    if m:
        return m.group(1).upper()
    for line in t.splitlines():
        s = line.strip().strip('*#>` ').strip()
        if not s:
            continue
        m = re.match(r'^[\(（\[]?([A-D])(?:[\)）\]\.．、:：\s]|$)', s)
        return m.group(1) if m else None
    return None


def numbers(text):
    return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', unicodedata.normalize('NFKC', text))]


def part_hit(entry, text, ntext):
    for cand in [entry.get('expect'), *(entry.get('accept') or [])]:
        if cand and norm(cand) and norm(cand) in ntext:
            return True
    tol = entry.get('tolerance')
    if tol is not None:
        try:
            e = float(entry.get('expect'))
        except (TypeError, ValueError):
            return False
        return any(abs(x - e) <= tol * max(1.0, abs(e)) for x in numbers(text))
    return False


def score_legacy(gold, text):
    ntext = norm(text)
    parts = gold['gold']
    if len(parts) == 1 and 'answer_letter' in parts[0]:
        got = extract_letter(text)
        if got is None:
            return {'method': 'choice_letter', 'status': 'pending_human', 'points': None, 'max': 1,
                    'note': 'no unambiguous option letter found'}
        ok = got == parts[0]['answer_letter'].strip().upper()
        return {'method': 'choice_letter', 'status': 'auto_correct' if ok else 'auto_incorrect',
                'points': int(ok), 'max': 1, 'extracted': got}
    marks = []
    for i, e in enumerate(parts):
        if 'answer_text' in e and 'expect' not in e:
            e = {**e, 'expect': e['answer_text']}
        hit = part_hit(e, text, ntext)
        marks.append({'part': i + 1, 'status': 'auto_hit' if hit else 'pending_human',
                      'bonus_hit': any(norm(b) in ntext for b in e.get('bonus_accept') or []) or None})
    hits = sum(m['status'] == 'auto_hit' for m in marks)
    return {'method': 'accept_substring_heuristic',
            'status': 'auto_hit_all' if hits == len(marks) else 'pending_human',
            'points': hits, 'max': len(marks), 'parts': marks,
            'note': 'substring hits are provisional; misses need human grading, not zero'}


def score_miku(item, text):
    head = norm(text)[:40]
    if not head:
        return {'method': 'yes_no', 'status': 'pending_human', 'points': None, 'max': 1}
    if re.search(r'不是|并非|否|^no|isnot', head):
        said = False
    elif re.search(r'^是|^yes|是初音|ismiku|hatsune', head):
        said = True
    else:
        return {'method': 'yes_no', 'status': 'pending_human', 'points': None, 'max': 1}
    ok = said == bool(item['miku'])
    return {'method': 'yes_no', 'status': 'auto_correct' if ok else 'auto_incorrect', 'points': int(ok), 'max': 1,
            'extracted': said}


def score_bangdream(item, text):
    ntext = norm(text)
    slug_parts = [p for p in re.split(r'[_\-\s]+', item.get('slug') or '') if p]
    hit = (norm(item['character']) in ntext) or (slug_parts and all(norm(p) in ntext for p in slug_parts))
    return {'method': 'name_substring_heuristic', 'status': 'auto_hit_all' if hit else 'pending_human',
            'points': int(hit), 'max': 1,
            'note': 'name/romaji substring; alternate spellings need human grading'}


def find_json(files):
    for p in sorted(files, key=lambda p: (p.name.lower() != 'answer.json', p.name)):
        text = p.read_text(encoding='utf-8', errors='replace')
        try:
            obj = strict_json(text)
            if isinstance(obj, dict):
                return obj, p.name
        except ValueError:
            pass
        dec = json.JSONDecoder()
        for m in re.finditer(r'\{', text):
            try:
                obj, _ = dec.raw_decode(text[m.start():])
                if isinstance(obj, dict):
                    return obj, p.name
            except ValueError:
                continue
    return None, None


def strict_fields(gold, answer):
    marks, invalid, wrong = [], [], []
    def walk(g, a, path):
        if type(g) is not type(a):
            invalid.append(path); return
        if isinstance(g, dict):
            if set(g) != set(a):
                invalid.append(path); return
            for k, v in g.items():
                walk(v, a[k], f'{path}.{k}')
        elif isinstance(g, list):
            if len(g) != len(a):
                invalid.append(path); return
            for i, (v, w) in enumerate(zip(g, a)):
                walk(v, w, f'{path}[{i}]')
        else:
            marks.append(g == a)
            if g != a:
                wrong.append(path)
    walk(gold, answer, '$')
    if invalid:
        return {'method': 'strict_json_fields', 'status': 'invalid_schema', 'points': None,
                'max': None, 'invalid_paths': invalid}
    return {'method': 'strict_json_fields', 'status': 'auto_correct' if all(marks) else 'auto_partial',
            'points': sum(marks), 'max': len(marks), 'wrong_paths': wrong}


def score(meta, workdir, deliverables):
    gold_path = VISION / meta['gold_reference']
    no_links(gold_path)
    if sha256_file(gold_path) != meta['gold_sha256']:
        raise RuntimeError('gold changed since prepare')
    gold = load_json(gold_path)
    files = [workdir / d for d in deliverables]
    text = '\n'.join(p.read_text(encoding='utf-8', errors='replace')[:200_000] for p in files)
    track = meta['track']
    if track == 'Iteration':
        obj, src = find_json(files)
        if obj is None:
            return {'method': 'strict_json_fields', 'status': 'no_json', 'points': None, 'max': None}
        r = strict_fields(gold['answer'], obj)
        r['json_source'] = src
        return r
    if track == 'AnimeID':
        key = meta['bank_id'].rsplit('/', 1)[-1]
        item = gold['items'][key]
        return score_miku(item, text) if 'miku' in item else score_bangdream(item, text)
    return score_legacy(gold, text)


# --- review / collect ----------------------------------------------------------

def evaluate(meta, harness, transcript_path=None):
    r = {'profile': PROFILE, 'case': meta.get('case'), 'track': meta.get('track'), 'verdict': 'INVALID',
         'isolation_verification': 'unverified', 'score': None,
         'note': 'Exploratory profile. External cwd and transcript scan do not prove OS isolation.'}
    try:
        wd = Path(meta['workdir'])
        safe_tree(wd)
        if wd.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError('workspace is inside repository')
        before, after = load_json(harness / 'snapshot.json'), snapshot_dir(wd)
        if set(before) != set(meta['inputs']):
            raise RuntimeError('prepare snapshot payload mismatch')
        for name, digest in meta['inputs'].items():
            if name not in after or after[name]['sha256'] != digest or before[name] != after[name]:
                raise RuntimeError(f'input missing or changed: {name}')
        for item in wd.rglob('*'):
            if item.name in FORBIDDEN_DIR_NAMES:
                raise RuntimeError(f'forbidden workspace item: {item.name}')
        r['agent_state_items'] = sorted({i.name for i in wd.rglob('*') if i.name in AGENT_STATE_NAMES}) or None
        r['workspace_snapshot'] = after
        r['transcript'] = None
        if transcript_path is not None:
            tp = Path(transcript_path)
            no_links(tp)
            r['transcript'] = {'path': str(tp.resolve()), 'sha256': sha256_file(tp)}
            hits = scan_transcript(tp.read_text(encoding='utf-8', errors='replace'))
            if hits:
                raise RuntimeError('transcript contains repository leakage tokens: ' + ', '.join(hits))
        inputs = set(meta['inputs'])
        deliverables = [d for d in list_deliverables(wd) if d not in inputs]
        r['deliverables'] = deliverables
        r['verdict'] = 'FAIL'
        if not deliverables:
            r['reason'] = 'missing deliverable'
            return r
        r['score'] = score(meta, wd, deliverables)
        if r['score']['status'] in {'no_json', 'invalid_schema'}:
            r['reason'] = 'no scorable JSON answer'
            return r
        r['verdict'] = 'PASS_WITH_WARNINGS'
        r['reason'] = 'deliverable scored; isolation unverified; heuristic statuses need human confirmation'
        return r
    except (OSError, ValueError, KeyError, RuntimeError) as e:
        r['verdict'] = 'INVALID'
        r['reason'] = str(e)
        return r


def review(harness, strict=False, transcript_path=None):
    meta = load_meta(harness)
    r = evaluate(meta, harness, transcript_path)
    dump_json(harness / 'SCORE.json', r)
    (harness / 'REVIEW.md').write_text('# Legacy Vision exploratory review\n\n```json\n'
                                       + json.dumps(r, ensure_ascii=False, indent=2) + '\n```\n', encoding='utf-8')
    meta.update(status='reviewed', verdict=r['verdict'], reviewed_at=now_iso(), score=r['score'],
                isolation_verification=r['isolation_verification'],
                score_report_sha256=sha256_file(harness / 'SCORE.json'))
    dump_json(harness / 'meta.json', meta)
    print(json.dumps({'case': r['case'], 'verdict': r['verdict'], 'status': (r['score'] or {}).get('status'),
                      'reason': r.get('reason')}, ensure_ascii=False))
    return int(strict and r['verdict'] not in {'PASS', 'PASS_WITH_WARNINGS'})


def collect(harness, dry_run=False, **_):
    meta = load_meta(harness)
    report = harness / 'SCORE.json'
    if meta.get('verdict') not in {'PASS', 'PASS_WITH_WARNINGS'} or not report.is_file():
        print('ERROR: missing successful review; --force cannot bypass this profile')
        return 3
    if sha256_file(report) != meta.get('score_report_sha256'):
        print('ERROR: score report changed since review')
        return 3
    old = load_json(report)
    if evaluate(meta, harness, (old.get('transcript') or {}).get('path')) != old:
        print('ERROR: review is stale; inputs, outputs, gold or transcript changed')
        return 3
    dest = ARCHIVE / meta['model'] / meta['run_id']
    no_links(dest)
    if dest.exists():
        print('ERROR: archive already exists; never overwrite run evidence')
        return 3
    if not dry_run:
        dest.mkdir(parents=True)
        for name in ('SCORE.json', 'REVIEW.md', 'meta.json', 'snapshot.json'):
            shutil.copyfile(harness / name, dest / name)
        wd = Path(meta['workdir'])
        for d in old['deliverables']:
            target = dest / 'answer' / d
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(wd / d, target)
        meta.update(status='collected', collected_to=str(dest))
        dump_json(harness / 'meta.json', meta)
    print('collect legacy vision ->', dest)
    return 0


def match_transcripts(runs, tdir):
    """Map run_id -> transcript whose text mentions that run's unique workdir id."""
    found = {}
    if not tdir:
        return found
    for p in sorted(Path(tdir).glob('*.jsonl')):
        text = p.read_text(encoding='utf-8', errors='replace')
        for r in runs:
            if r['run_id'] in text:
                found.setdefault(r['run_id'], []).append(p)
    return found


def finalize(manifest, tdir=None, do_collect=False, only=None):
    suite = load_json(manifest)
    tmap = match_transcripts(suite['runs'], tdir)
    rows = []
    for run in suite['runs']:
        if only and run['track'] not in only:
            continue
        h = Path(run['harness'])
        meta = load_meta(h)
        ts = tmap.get(run['run_id'], [])
        if len(ts) > 1:
            raise RuntimeError(f'ambiguous transcripts for {run["case"]}')
        if not meta.get('collected_to'):
            review(h, transcript_path=ts[0] if ts else None)
            meta = load_meta(h)
            if do_collect and meta['verdict'] in {'PASS', 'PASS_WITH_WARNINGS'}:
                collect(h)
                meta = load_meta(h)
        rows.append({'case': run['case'], 'bank_id': run['bank_id'], 'track': run['track'],
                     'verdict': meta.get('verdict'), 'score': meta.get('score'),
                     'transcript': str(ts[0]) if ts else None, 'collected_to': meta.get('collected_to')})
    dest = manifest.with_name(manifest.stem + '-results.json')
    dump_json(dest, {'suite': suite['suite'], 'model_slug': suite['model_slug'], 'runs': rows,
                     'note': 'Exploratory, isolation unverified. Heuristic statuses are provisional; no pooled ranking.'})
    lines = ['# Legacy Vision exploratory results', '',
             '| 轨道 | 题 | 交付 | 评分方式 | 状态 | 得分 |', '|---|---|---|---|---|---|']
    for r in rows:
        s = r['score'] or {}
        pts = f"{s.get('points')}/{s.get('max')}" if s.get('max') else '—'
        lines.append(f"| {r['track']} | {r['bank_id']} | {r['verdict']} | {s.get('method', '—')} | {s.get('status', '—')} | {pts} |")
    dest.with_suffix('.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('RESULTS=' + str(dest))
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='command', required=True)
    p = sub.add_parser('list'); p.add_argument('--tracks')
    p = sub.add_parser('prepare'); p.add_argument('--model', required=True); p.add_argument('--tracks')
    p = sub.add_parser('finalize'); p.add_argument('--suite', type=Path, required=True)
    p.add_argument('--transcripts'); p.add_argument('--collect', action='store_true'); p.add_argument('--tracks')
    args = ap.parse_args()
    tracks = set(args.tracks.split(',')) if getattr(args, 'tracks', None) else None
    if args.command == 'list':
        recs = cases(tracks)
        for r in recs:
            print(r['track'], opaque(r['id']), r['id'], len(r['assets']), sep='\t')
        print(f'# {len(recs)} cases', file=sys.stderr)
    elif args.command == 'prepare':
        prepare_suite(args.model, tracks)
    else:
        finalize(args.suite, args.transcripts, args.collect, tracks)


if __name__ == '__main__':
    main()
