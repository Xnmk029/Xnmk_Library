"""Continue development in a writable CLI fork when the app holds the old writer.

This is an explicitly resumed development segment, not a new clean benchmark.
Original verdicts/logs remain intact. No automatic retry or forced collection.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import time
import tomllib
import uuid
from pathlib import Path

from godot_profile import hidden_process
from sandbox_lib import dump_json, load_json, load_meta, now_iso


def run(h: Path, adapter: Path, parent: str):
    h=h.resolve();meta=load_meta(h);work=Path(meta['workdir'])
    spec=load_json(adapter)
    argv=[s.replace('{workdir}',str(work)).replace('{harness}',str(h)) for s in spec['argv']]
    argv[0]=os.environ.get('CODEX_CLI_PATH',argv[0])
    assert argv[-1]=='-' and spec['requested_model']=='gpt-6.1-sol' and spec['requested_effort']=='xhigh'
    argv=argv[:-1]+['fork',parent,'-']
    config=tomllib.loads((Path.home()/'.codex/config.toml').read_text(encoding='utf-8'))
    for section in ['plugins','mcp_servers']:
        for name in config.get(section,{}):argv[1:1]=['-c',section+'.'+json.dumps(name)+'.enabled=false']
    folder=h/'continuations'/(time.strftime('%Y%m%d-%H%M%S')+'-fork-'+uuid.uuid4().hex[:6]);folder.mkdir(parents=True)
    prompt='继续完成当前工作目录 PROMPT.md 中的任务与验证。'
    (folder/'followup.txt').write_text(prompt,encoding='utf-8')
    record={'status':'starting','started_at':now_iso(),'parent_thread_id':parent,'thread_id':None,
            'requested_model':'gpt-6.1-sol','requested_effort':'xhigh','workdir':str(work),
            'access_path':'native-cli-fork-continuation','fresh_session':False,'user_authorized_resume':True,
            'reason':'Original app session holds an active writer and resumed as read-only. CLI fork preserves history with workspace-write policy.',
            'attempt_dir':str(folder),'wall_seconds':14400,'automatic_retries':0,
            'benchmark_note':'Additional development continuation; existing original verdict and imported candidate archive remain intact.',
            'isolation_verification':'unverified','argv':argv}
    start=time.monotonic()
    with (folder/'stdout.log').open('wb') as out,(folder/'stderr.log').open('wb') as err:
        proc=subprocess.Popen(argv,cwd=work,stdin=subprocess.PIPE,stdout=out,stderr=err,**hidden_process())
        record.update(pid=proc.pid,status='running')
        proc.stdin.write(prompt.encode('utf-8'));proc.stdin.close()
        for _ in range(20):
            text=(folder/'stdout.log').read_text(encoding='utf-8',errors='replace')
            match=re.search(r'"type":"thread.started","thread_id":"([^"]+)"',text)
            if match:record['thread_id']=match.group(1);break
            if proc.poll() is not None:break
            time.sleep(1)
        dump_json(folder/'execution.json',record);dump_json(h/'CONTINUATION_STATE.json',record)
        dump_json(h/'OBSERVED_STATUS.json',{'status':'running' if proc.poll() is None else 'launch_error','observed_at':now_iso(),
                   'thread_id':record['thread_id'],'parent_thread_id':parent,'attempt_dir':str(folder)})
        meta.update(execution_status='continuation_running',continuation_dir=str(folder),continuation_thread_id=record['thread_id'])
        dump_json(h/'meta.json',meta)
        print(json.dumps(record,ensure_ascii=False),flush=True)
        try:
            proc.wait(timeout=max(1,14400-(time.monotonic()-start)))
            record.update(status='completed' if proc.returncode==0 else 'process_error',exit_code=proc.returncode)
        except subprocess.TimeoutExpired:
            subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],capture_output=True,**hidden_process());proc.wait(timeout=15)
            record.update(status='timeout',exit_code=proc.returncode)
    record.update(finished_at=now_iso(),elapsed_seconds=round(time.monotonic()-start,3))
    dump_json(folder/'execution.json',record);dump_json(h/'CONTINUATION_STATE.json',record)
    dump_json(h/'CONTINUATION_RESULT.json',record)
    print(json.dumps({'status':record['status'],'thread_id':record['thread_id'],'attempt_dir':str(folder)},ensure_ascii=False),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run',type=Path,required=True)
    p.add_argument('--adapter',type=Path,required=True);p.add_argument('--parent',required=True)
    a=p.parse_args();run(a.run,a.adapter,a.parent)
