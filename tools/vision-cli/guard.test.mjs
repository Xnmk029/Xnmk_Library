import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {guardFor} from './guard.mjs';

test('native file and search tools stay inside the case, including symlinks', () => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vision-guard-fixture-'));
  const root=path.join(temp,'case'), other=path.join(temp,'other');
  fs.mkdirSync(root);fs.mkdirSync(other);
  const check=guardFor(root);
  assert.equal(check({name:'read',arguments:{file_path:'PROMPT.md'}}),undefined);
  assert.equal(check({name:'write',arguments:{file_path:path.join(root,'new','answer.json')}}),undefined);
  assert.equal(check({name:'glob',arguments:{path:root,pattern:'**/*.png'}}),undefined);
  for (const name of ['read','read_image','write','edit']) {
    assert.ok(check({name,arguments:{file_path:'../other/answer.json'}}));
    assert.ok(check({name,arguments:{file_path:other}}));
  }
  assert.ok(check({name:'glob',arguments:{path:temp,pattern:'**/*'}}));
  assert.ok(check({name:'glob',arguments:{pattern:'../**/*'}}));
  assert.ok(check({name:'grep',arguments:{path:temp,pattern:'answer'}}));
  assert.ok(check({name:'bash',arguments:{command:'anything'}}));
  fs.symlinkSync(other,path.join(root,'escape'),'junction');
  assert.ok(check({name:'read',arguments:{file_path:'escape/file.txt'}}));
  // Fixed temp root from mkdtemp; no shell composition or dynamic workspace deletion.
  fs.rmSync(path.join(root,'escape'));
  fs.rmdirSync(root);fs.rmdirSync(other);fs.rmdirSync(temp);
});
