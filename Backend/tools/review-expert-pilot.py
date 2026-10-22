"""Run the standard reviewer; retain evidence when dependency scans misfire."""
import json
import os
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'sandbox/scripts'))
sys.path.insert(0, str(ROOT / 'sandbox/adapters'))
from review_run import review
from sandbox_lib import now_iso, scan_forbidden_imports, DELIVERABLE_EXTS, DELIVERABLE_SKIP
from extract_provider_evidence import extract

label = sys.argv[1] if len(sys.argv) > 1 else 'backend-expert-open-20261016'
suite = json.loads((ROOT / 'sandbox/runs' / label / ('suite-' + label + '.json')).read_text(encoding='utf-8'))


def source_inventory(wd):
    result = {}
    for parent, dirs, files in os.walk(wd):
        dirs[:] = [n for n in dirs if n not in {'node_modules', '.npm-cache', '.cache', '__pycache__'} and not n.startswith('raftexample-')]
        for name in files:
            f = Path(parent) / name
            if f.suffix in {'.exe', '.wal', '.snap', '.db', '.sqlite', '.tmp'} or f.stat().st_size > 8 * 1024 * 1024:
                continue
            result[f.relative_to(wd).as_posix()] = dict(sha256=hashlib.sha256(f.read_bytes()).hexdigest(), size=f.stat().st_size)
    return result


def source_deliverables(wd, skip_extra):
    return [n for n in source_inventory(wd) if n not in skip_extra and Path(n).name not in DELIVERABLE_SKIP
            and not any(p.startswith('.') for p in Path(n).parts)
            and Path(n).suffix.lower() in set(DELIVERABLE_EXTS) | {'.cjs', '.mod', '.sum'}]


for run in suite['runs']:
    h = Path(run['harness'])
    if not (h / 'execution.json').is_file():
        raise RuntimeError('Generation still running')
    transcript = h / 'transcript.txt'
    transcript.write_text('\n'.join((h / n).read_text(encoding='utf-8', errors='replace') for n in ('stdout.log', 'stderr.log') if (h / n).is_file()), encoding='utf-8')
    old_meta = json.loads((h / 'meta.json').read_text(encoding='utf-8'))
    if old_meta.get('verdict') and not (h / 'meta.before-path-fix.json').exists():
        (h / 'meta.before-path-fix.json').write_bytes((h / 'meta.json').read_bytes())
        (h / 'REVIEW.before-path-fix.md').write_bytes((h / 'REVIEW.md').read_bytes())
    review(h, strict=False, transcript_path=transcript, inventory_fn=source_inventory, deliverable_fn=source_deliverables)
    evidence, error = extract(h)
    if error:
        print('Provider evidence unavailable:', error)
    meta_file = h / 'meta.json'
    meta = json.loads(meta_file.read_text(encoding='utf-8'))
    meta['review_inventory_scope'] = 'repository source, public inputs and small artifacts; installed dependencies, WAL/DB/snapshot runtime state and files over 8 MiB excluded. Immutable PROMPT.md and starter.tar fully checked. OS isolation unverified.'
    meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Never relax observed integrity failures, including actual repository path reads.
    failures = [r for r in meta.get('review_checks', []) if r['status'] == 'FAIL']
    if failures and all(r['id'] == 'D4' for r in failures):
        wd = Path(run['workdir'])
        upstream = json.loads((ROOT / 'L4_Expert' / run['project'] / 'UPSTREAM.json').read_text(encoding='utf-8'))
        authored_hits = []
        third_party_hits = []
        for rel in meta.get('deliverables', []):
            f = wd / rel
            if f.suffix.lower() not in {'.html', '.htm', '.js', '.mjs', '.css', '.json', '.md', '.svg'}:
                continue
            body = f.read_text(encoding='utf-8', errors='replace')
            if 'placeholder_tokens' not in scan_forbidden_imports(body):
                continue
            parts = Path(rel).parts
            inner = Path(*parts[1:]).as_posix() if parts and parts[0] == 'repo' else rel
            # esbuild preserves upstream TODO comments in a generated browser
            # bundle. Only waive matches located inside explicit dependency
            # source sections; authored sections remain subject to D4.
            if inner == 'demo/bundle.js':
                headings = list(re.finditer(r'(?m)^// ([\w@./-]+\.(?:js|cjs|mjs))\r?$', body))
                tokens = list(re.finditer(r'TODO(?!\w)|FIXME|XXX\b|未实现|占位符', body, re.I))
                origins = [next((x.group(1) for x in reversed(headings) if x.start() < token.start()), '') for token in tokens]
                if tokens and all(origin.startswith('node_modules/') and (wd / 'repo' / origin).is_file() for origin in origins):
                    third_party_hits.append(rel + ' (bundled dependency sections: ' + ', '.join(sorted(set(origins))) + ')')
                    continue
            if 'node_modules' in parts or inner in upstream['sourceFiles']:
                # Only waive an upstream source hit if its exact bytes still match.
                import hashlib
                digest = hashlib.sha256(f.read_bytes()).hexdigest()
                if 'node_modules' in parts or digest == upstream['sourceFiles'].get(inner):
                    third_party_hits.append(rel)
                    continue
            authored_hits.append(rel)
        if third_party_hits and not authored_hits:
            (h / 'REVIEW.machine.md').write_bytes((h / 'REVIEW.md').read_bytes())
            (h / 'meta.machine.json').write_bytes(meta_file.read_bytes())
            verdict = 'PASS_WITH_WARNINGS' if any(r['status'] == 'WARN' for r in meta['review_checks']) else 'PASS'
            meta['machine_verdict'] = meta['verdict']
            meta['verdict'] = verdict
            meta['review_override'] = dict(correctedCheck='D4', correctedAt=now_iso(),
                reason='Generic scanner matched installed third-party code or byte-identical upstream source, not authored placeholders. Original machine review retained; functional completion comes only from independent checks.',
                thirdPartyHitFiles=third_party_hits, authoredHitFiles=authored_hits)
            meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            with (h / 'REVIEW.md').open('a', encoding='utf-8') as out:
                out.write('\n## D4 来源复核\n\n第三方依赖/字节未变的上游源码触发泛化占位符扫描；未发现自写文件占位符命中。保留 REVIEW.machine.md 和 meta.machine.json，静态复核修正为 ' + verdict + '。不放宽 H 系列完整性，也不替代独立功能验收。\n')
    print(run['project'], meta['verdict'], evidence['actual_model'] if evidence else None)
