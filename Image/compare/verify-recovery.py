from pathlib import Path
from PIL import Image
import json, hashlib, urllib.request, urllib.parse

root=Path(__file__).resolve().parent
data=json.loads((root/'catalog.js').read_text(encoding='utf-8').removeprefix('window.IMAGE_CATALOG = ').strip().removesuffix(';'))
links=set();images=set()
def walk(v):
    if isinstance(v,dict):
        for k,x in v.items():
            if k in ['url','meta','prompt','statement'] and isinstance(x,str):
                links.add(x)
                if k=='url':images.add(x)
            else:walk(x)
    elif isinstance(v,list):
        for x in v:walk(x)
walk(data['tasks'])
errors=[]
for link in sorted(links):
    path=root/link
    if not path.is_file(): errors.append('Missing: '+link);continue
    if link in images:
        try:
            with Image.open(path) as im: im.load()
        except Exception as e:errors.append(str(e))
    url=urllib.parse.urljoin('http://127.0.0.1:8771/compare/',urllib.parse.quote(link,safe='/'))
    try:
        with urllib.request.urlopen(urllib.request.Request(url,method='HEAD')) as response:
            if response.status!=200:errors.append('HTTP: '+link)
    except Exception as e:errors.append(str(e))
source=root.parents[1]/'暂存/image25-quality-test-20260911'
study=root.parent/'QualityStudy20260911'
verified=0
for task in ['i2i-precise','i2i-open','t2i-poster']:
    for variant in ['sunburst-max','sunburst-low','flare-max','flare-low','flare-auto','codex-imagegen']:
        a=source/task/variant/'result.png';b=study/task/variant/'result.png'
        if hashlib.sha256(a.read_bytes()).digest()!=hashlib.sha256(b.read_bytes()).digest():errors.append('Hash mismatch: '+str(b))
        else:verified+=1
print(json.dumps({'groups':len(data['tasks']),'results':sum(len(f['variants']) for t in data['tasks'] for f in t['frames']),'imageAssets':len(images),'httpAssets':len(links),'verifiedAPICopies':verified,'errors':errors},ensure_ascii=False))
raise SystemExit(bool(errors))
