"""Separate, observable Agent-CLI evaluation of frozen r6 inputs; no human claims.

All input preparation happens here. Workdirs contain only public inputs.
No automatic retry, no replacement of answers, no writes to frozen evidence.
"""
from __future__ import annotations
import argparse, contextlib, io, json, os, re, shutil, subprocess, sys, time
from collections import defaultdict
from pathlib import Path
from sandbox_lib import ROOT, RUNS, RUNS_ROOT, build_dispatch_text, snapshot_dir, sha256_file, now_iso, scan_transcript
from vision_profile import safe_slug, no_links

ITERATION = ROOT / 'Vision/iteration/20260921'
sys.path.insert(0, str(ITERATION))
from integrity import verify
from grade import parse, strict

PROFILE = 'iteration-r6-agent-cli-v1'


def read(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))


def write(p, data):
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def prepare(adapter, batch, probe=False):
    safe_slug(batch)
    spec = read(adapter)
    manifest = ITERATION/'holdout/holdout-v2-r6/SUITE.json'
    suite = verify(manifest)
    base = RUNS / batch
    if base.exists():
        raise ValueError('refuse overwriting batch')
    base.mkdir(parents=True)
    entries = []
    cases = [{'id':'PROBE', 'family':'probe'}] if probe else suite['cases']
    for case in cases:
        case_id = case['id']
        wd, h = RUNS_ROOT/batch/case_id, base/case_id
        no_links(wd)
        if wd.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError('workdir inside repository')
        wd.mkdir(parents=True, exist_ok=False)
        h.mkdir()
        if probe:
            from PIL import Image, ImageDraw, ImageFont
            im=Image.new('RGB',(640,360),'white');draw=ImageDraw.Draw(im)
            draw.text((165,15),'7318',font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',95),fill='black')
            draw.rectangle((55,155,245,325),fill=(255,0,0));draw.ellipse((380,150,560,330),fill=(0,0,255))
            im.save(wd/'stem_01.png')
            (wd/'PROMPT.md').write_text('Read stem_01.png. Return JSON with the four-digit code at the top, the color of the left shape, and the type of the right shape: {"code":"digits", "left_color":"English lowercase color", "right_shape":"English lowercase shape"}.\n',encoding='utf-8')
        else:
            shutil.copyfile(case['prompt'], wd/'PROMPT.md')
            for i, image in enumerate(case['images'],1):
                shutil.copyfile(image, wd/f'stem_{i:02d}{Path(image).suffix}')
        snap = snapshot_dir(wd)
        write(h/'snapshot.json', snap)
        meta = {'profile':PROFILE, 'case':case_id, 'family':case['family'], 'workdir':str(wd),
                'dispatch':build_dispatch_text(case_id,wd), 'inputs':snap}
        write(h/'meta.json',meta)
        entries.append({'case':case_id,'family':case['family'],'workdir':str(wd),'harness':str(h)})
    plan = {'profile':PROFILE,'batch':batch,'probe':probe,'created_utc':now_iso(),
            'probe_gold':{'code':'7318','left_color':'red','right_shape':'circle'} if probe else None,
            'adapter':str(adapter.resolve()),'adapter_sha256':sha256_file(adapter),
            'source_manifest':str(manifest),'source_manifest_sha256':sha256_file(manifest),
            'runs':entries,'execution_profile':'agent-tools-file-image-only',
            'human_review':'deferred_by_user','isolation_verification':'unverified',
            'retry_policy':'no automatic retry; preserve every attempt',
            'comparison':'Separate from visual-only-api scores; not human-readability evidence.'}
    plan['adapter_files']={str(Path(arg).resolve()):sha256_file(Path(arg)) for arg in spec['argv'] if len(arg)<250 and Path(arg).is_absolute() and Path(arg).is_file()}
    write(base/'SUITE.json',plan)
    print(str(base/'SUITE.json'),flush=True)
    return base/'SUITE.json'


def events(path):
    out=[]
    for line in path.read_text(encoding='utf-8',errors='replace').splitlines():
        try:
            obj=json.loads(line)
            if isinstance(obj,dict):out.append(obj)
        except ValueError:pass
    return out


def evidence(h, cli):
    es=events(h/'stdout.log')
    info={'session_id':None,'actual_model':None,'usage':None,'finish_reason':None,
          'final_text':None,'image_tool_observed':False,
          'source':{'file':'stdout.log','sha256':sha256_file(h/'stdout.log')}}
    models=set();usage=[]
    for e in es:
        if e.get('session_id'):info['session_id']=e['session_id']
        if cli=='codebuddy':
            m=e.get('message') or {}
            if e.get('type')=='assistant':
                if m.get('model'):models.add(m['model'])
                if m.get('usage'):usage.append(m['usage'])
                for c in m.get('content',[]):
                    if c.get('type')=='tool_use' and c.get('name')=='Read' and str(c.get('input',{}).get('file_path','')).lower().endswith(('.png','.jpg','.jpeg')):
                        info['image_tool_observed']=True
            if e.get('type')=='result':
                info['finish_reason']=e.get('subtype');info['final_text']=e.get('result')
                if e.get('usage'):info['usage']=e['usage']
        else:
            # DSH JSONL schema is recorded verbatim; expand only observed fields.
            if e.get('type')=='session' and e.get('sessionId'):info['session_id']=e['sessionId']
            if e.get('type') in ('result','final'):
                info['final_text']=e.get('text') or e.get('message')
                info['finish_reason']=e.get('status')
            if e.get('type')=='status' and e.get('phase')=='step_end' and e.get('usage'):usage.append(e['usage'])
            if e.get('type')=='status' and e.get('phase')=='turn_end':info['finish_reason']=(e.get('reason') or {}).get('kind')
            if e.get('type') in ('tool_call','tool_start') and (e.get('name') or e.get('tool'))=='read_image':
                info['image_tool_observed']=True
    if cli=='dsh' and info['session_id']:
        raw=h/'dsh_session.jsonl.zstd';decoded=h/'dsh_session.jsonl'
        if not raw.exists():
            hits=list((Path.home()/'.dsh/sessions').glob('*/'+info['session_id']+'/session.v4.jsonl.zstd'))
            if len(hits)==1:shutil.copyfile(hits[0],raw)
        if raw.exists() and not decoded.exists():
            script="const fs=require('fs'),z=require('node:zlib');let b=fs.readFileSync(process.argv[1]),off=0,parts=[];while(off<b.length){const r=z.zstdDecompressSync(b.subarray(off),{info:true});if(!r.engine.bytesWritten)throw Error('no frame progress');off+=r.engine.bytesWritten;parts.push(r.buffer);}fs.writeFileSync(process.argv[2],Buffer.concat(parts));"
            subprocess.run(['C:/Program Files/nodejs/node.exe','-e',script,str(raw),str(decoded)],check=True,capture_output=True)
        if decoded.exists():
            for e in events(decoded):
                if e.get('type')=='assistant/message':
                    for chunk in e.get('data',{}).get('stream',[]):
                        model=chunk.get('chunk',{}).get('replayState',{}).get('response',{}).get('model')
                        if model:models.add(model)
            info['session_trace']={'compressed_sha256':sha256_file(raw),'decoded_sha256':sha256_file(decoded)}
    if models:info['actual_model']=sorted(models)
    if info['usage'] is None and usage:info['usage']={'per_message':usage,'aggregation':'not deduplicated; do not sum blindly'}
    write(h/'provider_evidence.json',info)
    return info


def execute(manifest):
    suite=read(manifest);adapter=Path(suite['adapter']);spec=read(adapter)
    if sha256_file(adapter)!=suite['adapter_sha256']:raise ValueError('adapter changed after prepare')
    for path,digest in suite.get('adapter_files',{}).items():
        if sha256_file(Path(path))!=digest:raise ValueError('adapter support file changed')
    if not spec.get('fresh_session') or spec.get('prompt_via')!='stdin':raise ValueError('fresh stdin adapter required')
    verify(suite['source_manifest'])
    if sha256_file(Path(suite['source_manifest']))!=suite['source_manifest_sha256']:raise ValueError('manifest changed')
    consecutive_failures=0
    for run in suite['runs']:
        h,wd=Path(run['harness']),Path(run['workdir'])
        if (h/'execution.json').exists():continue
        if (h/'started.json').exists():raise ValueError('started run needs terminal-process audit, never blindly restart')
        no_links(wd)
        if snapshot_dir(wd)!=read(h/'snapshot.json'):raise ValueError('input modified before dispatch')
        meta=read(h/'meta.json');start=time.monotonic()
        rec={'cli':spec['cli'],'version':spec['version'],'requested_model':spec['requested_model'],
             'requested_effort':spec.get('requested_effort'),'wall_seconds':spec['wall_seconds'],
             'max_output_tokens':spec.get('max_output_tokens'),'started_utc':now_iso(),
             'runner_sha256':sha256_file(Path(__file__)),'adapter_sha256':sha256_file(adapter),
             'isolation_verification':'unverified'}
        with (h/'stdout.log').open('wb') as so,(h/'stderr.log').open('wb') as se:
            try:
                proc=subprocess.Popen(spec['argv'],cwd=wd,stdin=subprocess.PIPE,stdout=so,stderr=se,shell=False)
                write(h/'started.json',{**rec,'pid':proc.pid})
                print(json.dumps({'case':run['case'],'status':'started','pid':proc.pid}),flush=True)
                try:
                    proc.communicate(meta['dispatch'].encode('utf-8'),timeout=spec['wall_seconds'])
                    rec.update(status='completed' if proc.returncode==0 else 'process_error',exit_code=proc.returncode)
                except subprocess.TimeoutExpired:
                    subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],capture_output=True)
                    proc.wait(timeout=20)
                    rec.update(status='timeout',exit_code=proc.returncode)
            except OSError as exc:
                rec.update(status='launch_error',error=str(exc),exit_code=None)
        rec.update(elapsed_seconds=round(time.monotonic()-start,3),finished_utc=now_iso())
        rec['stdout_sha256']=sha256_file(h/'stdout.log');rec['stderr_sha256']=sha256_file(h/'stderr.log')
        write(h/'execution.json',rec);write(h/'after.json',snapshot_dir(wd));evidence(h,spec['cli'])
        print(json.dumps({'case':run['case'],'status':rec['status'],'seconds':rec['elapsed_seconds']}),flush=True)
        logs=(h/'stderr.log').read_text(encoding='utf-8',errors='replace')+'\n'+(h/'stdout.log').read_text(encoding='utf-8',errors='replace')
        fatal=bool(re.search(r'(?i)(invalid[_ ]api[_ ]key|insufficient[_ ]quota|unauthorized|authentication[_ ]error|quota exceeded|credits? exhausted)',logs))
        consecutive_failures=0 if rec['status']=='completed' else consecutive_failures+1
        if fatal or consecutive_failures>=2:
            write(Path(manifest).parent/'STOP.json',{'after_case':run['case'],'fatal_auth_or_quota':fatal,'consecutive_process_failures':consecutive_failures,'utc':now_iso()})
            break
    summarize(manifest)


def answer(h, wd, ev):
    files=sorted(p for p in wd.glob('*.json') if p.is_file())
    if (wd/'answer.json') in files:files=[wd/'answer.json']
    if len(files)>1:raise ValueError('multiple JSON outputs without canonical answer.json')
    if files:
        return parse(files[0].read_text(encoding='utf-8-sig')),{'kind':'file','file':files[0].name,'sha256':sha256_file(files[0])}
    text=ev.get('final_text')
    if not isinstance(text,str):raise ValueError('no answer file or final result')
    match=re.fullmatch(r'\s*```(?:json)?\s*\n(.*?)\n```\s*',text,re.S)
    return parse(match[1] if match else text),{'kind':'final_text','source':'stdout.log'}


def summarize(manifest):
    suite=read(manifest);src=verify(suite['source_manifest']);cases={c['id']:c for c in src['cases']};rows=[]
    for run in suite['runs']:
        h,wd=Path(run['harness']),Path(run['workdir']);row={'case':run['case'],'family':run['family'],'status':'pending','score':None}
        if not (h/'execution.json').exists():rows.append(row);continue
        rec=read(h/'execution.json');ev=evidence(h,rec['cli']);row.update(execution=rec,provider=ev)
        row['status']=rec['status']
        before=read(h/'snapshot.json');after=snapshot_dir(wd)
        errors=[]
        if any(after.get(k)!=v for k,v in before.items()):errors.append('public inputs modified')
        if (h/'after.json').exists() and after!=read(h/'after.json'):errors.append('workdir changed after execution')
        for name,key in [('stdout.log','stdout_sha256'),('stderr.log','stderr_sha256')]:
            if sha256_file(h/name)!=rec[key]:errors.append('raw trace changed: '+name)
        trace='\n'.join((h/n).read_text(encoding='utf-8',errors='replace') for n in ('stdout.log','stderr.log'))
        if re.search(r'(?i)F:[/\\]+benchmark|gold_reference|holdout[/\\]+holdout-v2-r6[/\\]+private',trace):errors.append('repository/private path observed in transcript')
        row['integrity_errors']=errors
        if errors:row['status']='integrity_invalid'
        elif rec['status']=='completed':
            try:
                obj,source=answer(h,wd,ev)
                gold=(suite.get('probe_gold') or {'color':'red'}) if suite['probe'] else read(cases[run['case']]['gold'])['answer']
                row['grading']=strict(gold,obj);row['score']=row['grading']['score'];row['answer_source']=source
                row['status']='scored' if row['grading']['valid_schema'] else 'schema_invalid'
            except (ValueError,KeyError,TypeError) as exc:row.update(status='answer_invalid',error=str(exc))
        rows.append(row)
    groups=defaultdict(list)
    for r in rows:groups[r['family']].append(r['score'])
    complete=bool(rows) and all(r['score'] is not None for r in rows)
    result={'profile':PROFILE,'batch':suite['batch'],'probe':suite['probe'],'human_review':'deferred_by_user',
            'complete':complete,'scored_conditions':sum(r['score'] is not None for r in rows),'conditions':len(rows),
            'macro_score':round(100*sum(sum(v)/len(v) for v in groups.values())/len(groups),3) if complete else None,
            'family_scores':{k:round(100*sum(v)/len(v),3) if all(s is not None for s in v) else None for k,v in groups.items()},
            'rows':rows,'limits':'Agent tools and CLI preprocessing differ from visual-only-api. OS isolation unverified. Not human review; no pooled ranking.'}
    write(Path(manifest).parent/'RESULTS.json',result)
    print(json.dumps({k:result[k] for k in ['batch','complete','scored_conditions','conditions','macro_score']}),flush=True)
    return result


if __name__=='__main__':
    ap=argparse.ArgumentParser();sp=ap.add_subparsers(dest='mode',required=True)
    p=sp.add_parser('prepare');p.add_argument('--adapter',type=Path,required=True);p.add_argument('--batch',required=True);p.add_argument('--probe',action='store_true')
    for name in ('execute','summarize'):
        p=sp.add_parser(name);p.add_argument('--suite',type=Path,required=True)
    a=ap.parse_args()
    if a.mode=='prepare':prepare(a.adapter,a.batch,a.probe)
    elif a.mode=='execute':execute(a.suite)
    else:summarize(a.suite)
