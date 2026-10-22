"""Local, dependency-free human review workstation."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOME = Path(__file__).resolve().parent.parent
PROJECT = HOME.parent.parent
ROUND = PROJECT / 'evaluation/reviews/20260922-astra-xhigh-independent'
RESULTS = ROUND / 'blind_project/results'
LOCK = threading.RLock()

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)

def now():
    return datetime.now(timezone.utc).isoformat()

class Store:
    def __init__(self, root=HOME, batch='main'):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}', batch):
            raise ValueError('审核批次只能使用字母、数字、下划线或短横线')
        self.root, self.batch = Path(root), batch
        self.rubric = read(HOME / 'rubric.json')
        self.items = {}
        seal = read(RESULTS / 'BLIND_REVIEW_COMPLETE.json')
        assert seal['completed'] and seal['candidate_count'] == 29
        sealed = {x['path']: x['sha256'] for x in seal['files']}
        for row in read(ROUND / 'comparison/comparison_index.json'):
            score_path = RESULTS / (row['blind_id'] + '.score.json')
            review_path = RESULTS / (row['blind_id'] + '.review.json')
            for path in (score_path, review_path):
                if digest(path) != sealed[path.name]:
                    raise ValueError(f'第二轮封存校验失败：{path.name}')
            score = read(score_path)
            candidate = Path(score['sources']['candidate']['path'])
            if digest(candidate) != score['sources']['candidate']['sha256']:
                raise ValueError(f'正文校验失败：{row["id"]}')
            self.items[row['id']] = dict(id=row['id'], title=row['title'],
                candidate_path=str(candidate), candidate_sha256=digest(candidate),
                score_path=str(score_path), score_sha256=digest(score_path),
                raw_score=score['score'], status=score['status'])
        if len(self.items) != 29:
            raise ValueError('应有 29 篇文章')
        registry = {'schema_version': 1, 'items': list(self.items.values())}
        registry_path = self.root / 'registry.json'
        if registry_path.exists() and read(registry_path) != registry:
            raise ValueError('文章或基准已变化，请核查 registry.json，不能覆盖旧映射')
        write(registry_path, registry)

    def item(self, sid):
        if sid not in self.items:
            raise ValueError('未知文章编号')
        item = self.items[sid]
        if digest(item['candidate_path']) != item['candidate_sha256'] or digest(item['score_path']) != item['score_sha256']:
            raise ValueError('正文或第二轮评分发生变化，已停止保存')
        return item

    def path(self, sid):
        self.item(sid)
        return self.root / 'reviews' / self.batch / sid / 'review.json'

    def review(self, sid):
        path = self.path(sid)
        if path.exists():
            return read(path)
        return {'sample_id': sid, 'state': 'pending', 'revision': 0, 'reviewer': '',
                'scores': {c['id']: None for c in self.rubric['criteria']},
                'notes': {}, 'comment': '', 'revealed_before_submit': False,
                'identity_visible': False, 'manual_total': None, 'total': None}

    def public_review(self, sid):
        result = self.review(sid).copy()
        if not result['identity_visible']:
            result.pop('baseline', None)
        return result

    def save(self, sid, body, reveal=False):
        with LOCK:
            item = self.item(sid)
            old = self.review(sid)
            if body.get('revision') != old['revision']:
                raise ValueError('此文章已在其他页面更新，请刷新后再修改（避免覆盖）')
            scores = body.get('scores', {})
            keys = {c['id'] for c in self.rubric['criteria']}
            if set(scores) != keys:
                raise ValueError('必须提供四项评分，未评分项请留空')
            for value in scores.values():
                if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 10 or value * 2 != int(value * 2)):
                    raise ValueError('评分范围为 0—10，步进 0.5')
            state = body.get('state', 'draft')
            if state not in ('draft', 'complete'):
                raise ValueError('无效审核状态')
            comment = str(body.get('comment', '')).strip()
            if state == 'complete' and (None in scores.values() or not comment):
                raise ValueError('提交前请完成四项评分并填写总体意见')
            manual = round(sum(scores.values()), 2) if None not in scores.values() else None
            weighted = round(item['raw_score'] * .6, 4)
            result = dict(schema_version=1, rubric_version=self.rubric['version'],
                formula_version='round2x0.6+human40-v1', batch=self.batch, sample_id=sid,
                state=state, revision=old['revision'] + 1,
                reviewer=str(body.get('reviewer', '')).strip(), scores=scores,
                notes={k: str(body.get('notes', {}).get(k, '')) for k in keys}, comment=comment,
                created_at=old.get('created_at', now()), updated_at=now(),
                revealed_before_submit=old['revealed_before_submit'] or (reveal and old['state'] != 'complete'),
                identity_visible=old['identity_visible'] or reveal or state == 'complete',
                candidate_sha256=item['candidate_sha256'],
                baseline=dict(round=2, model=item['title'], raw_score=item['raw_score'], weight=.6,
                    weighted_score=weighted, status=item['status'], source=item['score_path'], sha256=item['score_sha256']),
                manual_total=manual, total=round(weighted + manual, 4) if state == 'complete' else None)
            path = self.path(sid)
            if old['revision']:
                write(path.parent / 'history' / f'{old["revision"]:04d}.json', old)
            write(path, result)
            return {'review': self.public_review(sid), 'saved_path': str(path)}

    def catalog(self):
        rows = []
        for sid, item in self.items.items():
            r = self.review(sid)
            rows.append(dict(id=sid, title=item['title'] if r['identity_visible'] else '匿名作品',
                state=r['state'], total=r['total'], manual_total=r['manual_total'],
                raw_score=item['raw_score'] if r['identity_visible'] else None,
                weighted_score=round(item['raw_score'] * .6, 4) if r['identity_visible'] else None,
                editorial_status=item['status'] if r['identity_visible'] else None))
        return rows

    def export(self):
        with LOCK:
            reviews = [self.review(sid) for sid in self.items]
            ranked = sorted([r for r in reviews if r['state'] == 'complete'], key=lambda r: -r['total'])
            previous, rank = None, 0
            ranking = []
            for i, r in enumerate(ranked, 1):
                if r['total'] != previous:
                    rank = i
                ranking.append({'rank': rank, 'sample_id': r['sample_id'], 'total': r['total']})
                previous = r['total']
            result = dict(schema_version=1, batch=self.batch, exported_at=now(),
                formula='round2_score * 0.6 + sum(human_scores)', complete_count=len(ranked),
                sample_count=len(reviews), ranking=ranking, reviews=reviews)
            path = self.root / 'exports' / self.batch / 'summary.json'
            write(path, result)
            return {'saved_path': str(path), 'complete_count': len(ranked)}

class Handler(BaseHTTPRequestHandler):
    def send(self, obj, status=200, mime='application/json; charset=utf-8'):
        data = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        try:
            path = urlparse(self.path).path
            s = self.server.store
            if path == '/api/catalog':
                return self.send(dict(items=s.catalog(), rubric=s.rubric, batch=s.batch))
            if path.startswith('/api/article/'):
                sid = path.split('/')[-1]
                return self.send(dict(text=Path(s.item(sid)['candidate_path']).read_text(encoding='utf-8-sig'), review=s.public_review(sid)))
            if path in ('/api/reference/prompt', '/api/reference/gold'):
                name = 'PROJECT_PROMPT.md' if path.endswith('prompt') else 'REFERENCE_ANSWER.md'
                return self.send({'text': (ROUND / 'blind_project' / name).read_text(encoding='utf-8-sig')})
            files = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
            if path in files:
                name, mime = files[path]
                return self.send((HOME / 'app' / name).read_bytes(), mime=mime + '; charset=utf-8')
            self.send({'error': 'Not found'}, 404)
        except (ValueError, OSError) as e:
            self.send({'error': str(e)}, 400)

    def do_POST(self):
        try:
            origin = self.headers.get('Origin')
            if origin and urlparse(origin).netloc != self.headers.get('Host'):
                raise ValueError('仅允许本地页面保存')
            if not self.headers.get('Content-Type', '').startswith('application/json'):
                raise ValueError('需要 JSON 请求')
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 1_000_000:
                raise ValueError('请求大小无效')
            body = json.loads(self.rfile.read(size))
            path = urlparse(self.path).path
            if path == '/api/export':
                return self.send(self.server.store.export())
            match = re.fullmatch(r'/api/(save|reveal)/(SC-\d{3})', path)
            if not match:
                return self.send({'error': 'Not found'}, 404)
            self.send(self.server.store.save(match[2], body, reveal=match[1] == 'reveal'))
        except (ValueError, OSError, TypeError, AttributeError) as e:
            self.send({'error': str(e)}, 400)

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8765)
    p.add_argument('--batch', default='main')
    p.add_argument('--data-root', type=Path, default=HOME)
    args = p.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.store = Store(args.data_root, args.batch)
    print(f'http://127.0.0.1:{args.port}  batch={args.batch}', flush=True)
    server.serve_forever()

if __name__ == '__main__':
    main()
