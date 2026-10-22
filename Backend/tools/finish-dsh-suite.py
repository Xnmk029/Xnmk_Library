"""Observe terminal DSH trials, independently verify, review and archive each once."""
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'sandbox/scripts'))
from review_run import review
from sandbox_lib import DELIVERABLE_EXTS, DELIVERABLE_SKIP, scan_forbidden_imports, now_iso
from time_policy import timing_score

NODE = 'C:/Program Files/nodejs/node.exe'
SKIP = {'node_modules','.git','.npm-cache','.cache','__pycache__','.venv'}
RUNTIME = {'.exe','.db','.sqlite','.wal','.snap','.tmp','.log','.zstd'}
LABEL = sys.argv[1] if len(sys.argv)>1 else 'backend-dsh-opendes-v41f-high-20261016'
OUT = ROOT/'Backend/pilots'/LABEL
SUITE = ROOT/'sandbox/runs'/LABEL/('suite-'+LABEL+'.json')

def read(p):
    for attempt in range(5):
        try:return json.loads(Path(p).read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            if attempt==4:raise
            time.sleep(0.02)
def write(p,obj): Path(p).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def source_inventory(wd):
    result={}
    for parent,dirs,files in os.walk(wd):
        dirs[:]=[n for n in dirs if n not in SKIP and not n.startswith('raftexample-') and not (Path(parent)/n).is_symlink()]
        for name in files:
            f=Path(parent)/name
            if f.is_symlink() or f.suffix in RUNTIME or name.endswith(('-wal','-shm')) or f.stat().st_size>8*1024*1024: continue
            result[f.relative_to(wd).as_posix()]={'sha256':sha(f),'size':f.stat().st_size}
    return result

def deliverables(wd,skip_extra):
    return [n for n in source_inventory(wd) if n not in skip_extra and Path(n).name not in DELIVERABLE_SKIP
            and not any(p.startswith('.') for p in Path(n).parts)
            and Path(n).suffix.lower() in set(DELIVERABLE_EXTS)|{'.cjs','.go','.mod','.sum','.py','.ps1','.sh'}]

def source_review(h,task):
    transcript=h/'transcript.txt'
    transcript.write_text('\n'.join((h/n).read_text(encoding='utf-8',errors='replace') for n in ['stdout.log','stderr.log'] if (h/n).is_file()),encoding='utf-8')
    review(h,strict=False,transcript_path=transcript,inventory_fn=source_inventory,deliverable_fn=deliverables)
    meta=read(h/'meta.json')
    failures=[r for r in meta['review_checks'] if r['status']=='FAIL']
    # Correct only demonstrable third-party/source-scanner false positives.
    if failures and all(r['id']=='D4' for r in failures) and task['level']=='L4':
        wd=Path(meta['workdir']); upstream=read(ROOT/task['project']/'UPSTREAM.json')['sourceFiles']
        third=[];authored=[]
        for rel in meta['deliverables']:
            f=wd/rel
            if f.suffix.lower() not in {'.html','.htm','.js','.mjs','.css','.json','.md','.svg'}: continue
            body=f.read_text(encoding='utf-8',errors='replace')
            if 'placeholder_tokens' not in scan_forbidden_imports(body): continue
            inner=rel.removeprefix('repo/')
            if inner in upstream and sha(f)==upstream[inner]: third.append(rel);continue
            headings=list(re.finditer(r'(?m)^// ([\w@./-]+\.(?:js|cjs|mjs))\r?$',body))
            tokens=list(re.finditer(r'TODO(?!\w)|FIXME|XXX\b|未实现|占位符',body,re.I))
            origins=[next((x.group(1) for x in reversed(headings) if x.start()<t.start()),'') for t in tokens]
            if tokens and all(o.startswith('node_modules/') and (wd/'repo'/o).is_file() for o in origins):third.append(rel);continue
            authored.append(rel)
        if third and not authored:
            shutil.copyfile(h/'REVIEW.md',h/'REVIEW.machine.md');write(h/'meta.machine.json',meta)
            meta['machine_verdict']=meta['verdict'];meta['verdict']='PASS_WITH_WARNINGS'
            meta['review_override']={'correctedCheck':'D4','at':now_iso(),'reason':'Only byte-identical upstream or explicitly sourced installed-dependency sections matched generic placeholder scan. Functional correctness remains independently measured.','thirdPartyHitFiles':third}
            with (h/'REVIEW.md').open('a',encoding='utf-8') as f:f.write('\nD4 来源复核：仅字节未变的上游源码或带来源段落的已安装第三方依赖命中；保留原机器审阅，不替代功能验收。\n')
    meta['review_inventory_scope']='Source and small assets; installed dependencies, binary/runtime DB/WAL/snapshot and >8MiB excluded. Immutable public inputs remain fully checked. OS isolation unverified.'
    write(h/'meta.json',meta)

def correct_runtime_html_review(h,gates):
    """A generated/served HTML interface need not be a static source .html file."""
    meta=read(h/'meta.json');failures=[r for r in meta.get('review_checks',[]) if r['status']=='FAIL']
    if not failures or not all(r['id']=='D1' for r in failures):return meta
    score_file=h/'BASELINE.json'
    if not score_file.exists():return meta
    score=read(score_file)
    ui_pass=any(c['pass'] and (c['id']=='ui' or c['id'].startswith('html-')) for c in score['checks'])
    prompt=(Path(meta['workdir'])/'PROMPT.md').read_text(encoding='utf-8')
    if not ui_pass or re.search(r'交付[^\n]{0,25}(?:index|answer)\.html',prompt):return meta
    if not (h/'REVIEW.machine.md').exists():shutil.copyfile(h/'REVIEW.md',h/'REVIEW.machine.md');write(h/'meta.machine.json',meta)
    meta['machine_verdict']=meta['verdict'];meta['verdict']='PASS_WITH_WARNINGS'
    meta['review_override']={'correctedCheck':'D1','reason':'Task permits generated/served HTML; independent real-browser UI check passed. No static .html filename is required by this prompt.','evidence':'BASELINE.json','at':now_iso()}
    write(h/'meta.json',meta)
    with (h/'REVIEW.md').open('a',encoding='utf-8') as f:f.write('\nD1 运行证据复核：题面允许服务端生成/命令输出 HTML，未指定必须交付静态 HTML 文件。独立浏览器检查已通过，纠正文件形态误报；保留原机器审阅。\n')
    return meta

def archive(h,task):
    meta=read(h/'meta.json');wd=Path(meta['workdir']);snapshot=source_inventory(wd)
    ex=read(h/'execution.json')
    dest=OUT/'submissions'/(task['id']+'-final' if ex.get('resumed_session') else task['id'])
    if dest.exists():dest=OUT/'submissions'/(task['id']+'-'+meta['run_id'])
    if dest.exists():raise RuntimeError('Refuse archive overwrite')
    if meta['verdict']=='INVALID':return None
    dest.mkdir(parents=True)
    inputs={'PROMPT.md',*[x if isinstance(x,str) else x['path'] for x in meta.get('input_files',[])]}
    retained={}
    for rel,info in snapshot.items():
        if rel in inputs or rel=='starter.tar':continue
        f=dest/rel;f.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(wd/rel,f)
        assert sha(f)==info['sha256'];retained[rel]=info['sha256']
    if task.get('input'):
        before={}
        with tarfile.open(ROOT/task['input']['file']) as tf:
            for member in tf.getmembers():
                if member.isfile():before[member.name]=tf.extractfile(member).read()
        diff=[]
        for name in sorted(set(before)|set(retained)):
            old=before.get(name,b'');f=dest/name;new=f.read_bytes() if f.is_file() else b''
            if old==new:continue
            try:diff.extend(difflib.unified_diff(old.decode('utf-8-sig').splitlines(True),new.decode('utf-8-sig').splitlines(True),fromfile='a/'+name,tofile='b/'+name))
            except UnicodeDecodeError:diff.append('Binary differs: '+name+'\n')
        (dest/'changes.patch').write_text(''.join(diff),encoding='utf-8')
    assert source_inventory(wd)==snapshot,'Submission changed during archive'
    write(dest/'SNAPSHOT.json',{'kind':'measured-model-submission-not-reference','taskId':task['id'],'runId':meta['run_id'],'sourceWorkdir':str(wd),'promptSha256':meta['prompt_sha256'],'files':retained,'sourceInventory':snapshot,'generation':read(h/'execution.json'),'staticVerdict':meta['verdict'],'note':'Preserve source paths. Failed and timeout samples retained as evidence, not reference answers. Dependencies and runtime state excluded.'})
    return dest.relative_to(ROOT).as_posix()

def run(args,log,timeout=1000):
    env={k:v for k,v in os.environ.items() if not re.search(r'API_KEY|TOKEN|SECRET|CREDENTIAL|PASSWORD',k,re.I)}
    env.update(PYTHONUTF8='1',GOPROXY='https://goproxy.cn,direct',GOSUMDB='sum.golang.google.cn',GOTOOLCHAIN='local')
    with log.open('w',encoding='utf-8') as f:
        r=subprocess.run(args,cwd=ROOT,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=timeout)
    if r.returncode!=0:print('verification tool nonzero:',log,r.returncode,flush=True)

def results():
    plan=read(OUT/'PLAN.json');rows=[]
    suite=read(SUITE)
    for t in plan['tasks']:
        entry=next(e for e in reversed(suite['runs']) if e['project']==Path(t['project']).name)
        h=Path(entry['harness']);done=h/'DSH-COMPLETE.json'
        if done.exists():
            row=read(done)
            if plan.get('timePolicy')=='penalty-no-deadline' and row.get('generationStatus')=='timeout':
                row={**row,'status':'awaiting-continuation','generationStatus':'initial-cutoff-awaiting-continuation',
                     'resultScope':'Historical cutoff snapshot; not a final soft-policy result.',
                     'timePenaltyPoints':None,'functionalScore':None,'scoreAfterTimePenalty':None}
        elif (h/'execution.live.json').exists():
            live=read(h/'execution.live.json')
            seconds=live.get('elapsed_before_segment',0)+(datetime.now().astimezone()-datetime.fromisoformat(live['clock_started_at'])).total_seconds()
            timing=timing_score(seconds,live['soft_budget_seconds'])
            row={'id':t['id'],'name':t['name'],'level':t['level'],'status':'running','generationStatus':'running',
                 'generationSeconds':timing['elapsed_seconds'],'timePenaltyPoints':timing['time_penalty_points'],
                 'overtimeSeconds':timing['overtime_seconds'],'timingIsProvisional':True,
                 'interruptedByPriorPolicy':bool(live.get('resumed_session'))}
        else:row={'id':t['id'],'name':t['name'],'level':t['level'],'status':'pending'}
        rows.append(row)
    report={'label':LABEL,'createdAt':now_iso(),'requested':{'provider':'opendes','model':'deepseek-v4.1-flash','effort':'high'},'isolationVerification':'unverified','scope':'Current uninterrupted trials under soft timing policy. Historical forced cutoffs/resume infrastructure errors remain separate. Finite independent verification, no formal ranking or human visual quality score.','historicalRetests':plan.get('retests',[]),'runs':rows}
    write(OUT/'RESULTS.json',report)
    lines=['# DSH / OpenDesign / DeepSeek V4.1 Flash / high 实测','',
           '按用户修正，L1–L3 600 秒、L4 1800 秒仅为计分阈值；超过阈值持续运行，不自动终止，也不因超时直接判功能失败。并发 2，每题独立会话。原硬截止中断的 B01/B03 尝试原会话恢复时遇到 DSH 自身格式错误（未进入模型调用），已保留全部中断/错误证据，并安排全新独立会话重测；表中使用各题最新试次，旧记录不混入新成绩。','',
           '时间扣分（百分制）：min(10, 10 × max(0, 累计生成秒数 / 阈值 − 1))，即每超出阈值 10% 扣 1 分，最多扣 10 分。功能验收分与时间扣分分列；完整验收后计算 max(0, 功能分 − 时间扣分)。BLOCKED 或验收覆盖不完整时不计算总分。生成时间累计各运行段，不计人工中断间隔、排队和独立验收时间；运行中扣分为暂计。','',
           '| 题号 | 题目 | 生成状态 | 累计生成用时 | 独立验收 | 时间扣分 | 扣时后分数 | 静态审阅 |','|---|---|---|---:|---|---:|---:|---|']
    for r in rows:
        seconds=r.get('generationSeconds');elapsed='—' if seconds is None else f'{seconds:.1f}s'
        gates='；'.join(f"{g['passed']}/{g['total']} PASS"+(f"，{g.get('blocked',0)} BLOCKED" if g.get('blocked') else '') for g in r.get('gates',[])) or '待验收'
        penalty=r.get('timePenaltyPoints');score=r.get('scoreAfterTimePenalty')
        lines.append(f"| {r['id']} | {r['name']} | {r.get('generationStatus',r['status'])} | {elapsed} | {gates} | {penalty if penalty is not None else '—'} | {score if score is not None else '—'} | {r.get('reviewVerdict','—')} |")
    lines+=['','配置证据见 [CONFIG.json](CONFIG.json)，机读记录和证据路径见 [RESULTS.json](RESULTS.json)。每题原始日志、provider response model、usage、输入完整性与代码快照均单独保存。','',
            '静态审阅通过不代表功能通过；BLOCKED 表示前置能力不满足，未作为独立通过或失败。外部工作目录不证明操作系统访问隔离，isolation 保持 unverified。初始硬截止报告冻结在 REPORT.initial-hard-stop.md；各题初始日志、评分及审阅保存在 attempts/initial-hard-cutoff，初始源码归档不覆盖。续跑不是无中断完成时间，不能直接混入无中断排名。不因单次超时自动替换题目。','']
    for r in rows:
        if r.get('failures'):
            lines.append(f"- {r['id']}："+'；'.join(r['failures']))
    (OUT/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    return rows

def finish(entry,task):
    h=Path(entry['harness']);meta=read(h/'meta.json');wd=Path(meta['workdir'])
    if not (h/'provider_evidence.json').exists():run([NODE,str(ROOT/'Backend/tools/dsh-evidence.mjs'),str(h)],h/'provider-extraction.log',120)
    if not meta.get('verdict'):source_review(h,task)
    gates=[]
    if task['level']!='L4':
        if not (h/'BASELINE.json').exists():run([NODE,str(ROOT/'Backend/tools/evaluate.mjs'),LABEL,'--only='+entry['project']],h/'independent-evaluation.log',600)
        if (h/'BASELINE.json').exists():
            score=read(h/'BASELINE.json');gates.append({'name':'basic','passed':score['passed'],'total':score['total'],'blocked':0,'evidence':(h/'BASELINE.json').relative_to(ROOT).as_posix(),'failures':[c['id']+': '+str(c.get('detail',''))[:250] for c in score['checks'] if not c['pass']]})
    elif (wd/'repo').is_dir():
        for name,tool,flags in [('regression','expert-evaluate.mjs',['--extended'] if task['name']=='RaftTxnWorkbench' else ['--epoch-v2']),('v2','expert-v2-evaluate.mjs',[])]:
            target=OUT/'verification'/task['id']/name;target.parent.mkdir(parents=True,exist_ok=True)
            if not target.exists():run([NODE,str(ROOT/'Backend/tools'/tool),task['name'],str(wd/'repo'),str(target),*flags],h/('verify-'+name+'.log'),1000)
            if (target/'CHECKS.json').exists():
                score=read(target/'CHECKS.json');gates.append({'name':name,'passed':score['passed'],'total':score['total'],'blocked':score.get('blocked',0),'evidence':(target/'CHECKS.json').relative_to(ROOT).as_posix(),'failures':[(c.get('id') or c.get('name'))+': '+str(c.get('error',''))[:250] for c in score['checks'] if c.get('status')=='FAIL' or c.get('pass') is False]})
    meta=correct_runtime_html_review(h,gates);ex=read(h/'execution.json')
    archive_path=archive(h,task)
    failures=[f for g in gates for f in g['failures']]
    if not gates:failures.append('No executable submission/evaluation evidence')
    complete=ex['status']=='completed' and meta['verdict'] in {'PASS','PASS_WITH_WARNINGS'} and len(gates)==(2 if task['level']=='L4' else 1) and all(g['passed']==g['total'] and not g['blocked'] for g in gates)
    threshold=ex.get('soft_budget_seconds') or (1800 if task['level']=='L4' else 600)
    timing=timing_score(ex['elapsed_seconds'],threshold)
    coverage=len(gates)==(2 if task['level']=='L4' else 1) and all(g['total'] and not g['blocked'] for g in gates)
    functional=round(100*sum(g['passed'] for g in gates)/sum(g['total'] for g in gates),3) if coverage and meta['verdict']!='INVALID' else None
    adjusted=round(max(0,functional-timing['time_penalty_points']),3) if functional is not None else None
    record={'id':task['id'],'name':task['name'],'level':task['level'],'status':'verified-complete' if complete else 'measured-incomplete','generationStatus':ex['status'],'generationSeconds':ex['elapsed_seconds'],'softBudgetSeconds':threshold,'timePolicy':ex.get('time_policy'),'overtimeSeconds':timing['overtime_seconds'],'timePenaltyPoints':timing['time_penalty_points'],'functionalScore':functional,'scoreAfterTimePenalty':adjusted,'interruptedByPriorPolicy':bool(ex.get('resumed_session')),'actualModel':ex.get('actual_model'),'usage':ex.get('usage'),'priorSegmentUsage':[p.get('usage') for p in ex.get('prior_segments',[])],'reviewVerdict':meta['verdict'],'gates':gates,'failures':failures,'sourceBundle':archive_path,'harness':h.relative_to(ROOT).as_posix(),'promptSha256':meta['prompt_sha256'],'isolationVerification':'unverified'}
    write(h/'DSH-COMPLETE.json',record);print(task['id'],record['status'],ex['elapsed_seconds'],flush=True)

def main():
    bank=read(OUT/'BANK.snapshot.json');tasks={Path(t['dispatchProject']).name:t for t in bank['tasks'] if t['status']=='active'}
    while True:
        suite=read(SUITE);pending=0
        for entry in suite['runs']:
            h=Path(entry['harness'])
            if (h/'DSH-COMPLETE.json').exists():
                record=read(h/'DSH-COMPLETE.json');meta=correct_runtime_html_review(h,record.get('gates',[]))
                if record['reviewVerdict']!=meta['verdict']:
                    record['reviewVerdict']=meta['verdict'];record['staticReviewCorrection']=meta.get('review_override')
                    if record['generationStatus']=='completed' and record.get('functionalScore')==100 and meta['verdict'] in {'PASS','PASS_WITH_WARNINGS'}:record['status']='verified-complete'
                    write(h/'DSH-COMPLETE.json',record)
                continue
            if not (h/'execution.json').exists():pending+=1;continue
            finish(entry,tasks[entry['project']]);results()
        results()
        if not pending or '--watch' not in sys.argv:break
        time.sleep(5)

if __name__=='__main__':main()
