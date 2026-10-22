import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../harness/runner.mjs';
import {inspectSource} from '../harness/static.mjs';
import {validateFooters} from '../harness/assertions.mjs';
import {makeRecords,sha256} from '../harness/data.mjs';
import {escapeHTML} from '../harness/report.mjs';
test('Original benchmark prompt remains byte-identical to historical input',async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'benchmark.json'),'utf8'));
  assert.equal(sha256(await fs.readFile(path.join(ROOT,'PROJECT_PROMPT.md'))),manifest.originalPromptSha256);
});
test('Case weights sum to 100, identifiers are unique, mandatory lifecycle checks exist',async()=>{
  const cases=JSON.parse(await fs.readFile(path.join(ROOT,'fixtures/cases.json'),'utf8'));
  assert.equal(cases.reduce((n,c)=>n+c.weight,0),100);
  assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
  for(const scenario of ['pair','sub','footer-only','clear','recycle','push','replace-pop','native','literal']) assert(cases.some(c=>c.scenario===scenario));
});
test('Metadata and dependency checks reject broad scope, syntax errors and imports',()=>{
  const good='// ==UserScript==\n// @name Test\n// @namespace test\n// @match https://*.bilibili.com/*\n// @grant none\n// ==/UserScript==\n(()=>{})();';
  assert(inspectSource(good,'answer.user.js').checks.every(c=>c.pass));
  assert(!inspectSource(good.replace('https://*.bilibili.com/*','*://*/*'),'answer.user.js').checks.find(c=>c.id==='C02').pass);
  assert(!inspectSource(good+'\n(', 'answer.user.js').checks.find(c=>c.id==='C01').pass);
  assert(!inspectSource(good+'\nimport("library");','answer.user.js').checks.find(c=>c.id==='C03').pass);
  const flags=inspectSource(good.replace('// @grant none','// @grant none\n// @noframes\n// @license MIT'),'answer.user.js');
  assert.deepEqual(flags.metadata.noframes,['']);
  assert.deepEqual(flags.metadata.license,['MIT']);
  assert.deepEqual(inspectSource(good.replaceAll('\n','\r\n'),'answer.user.js').metadata,inspectSource(good,'answer.user.js').metadata);
  assert(!inspectSource(good.replace('// @name Test','// @name'),'answer.user.js').checks.find(c=>c.id==='C02').pass);
});
test('Independent oracle rejects swapped comments, duplicates and missing-state errors',()=>{
  const rows=makeRecords(42,'D01','pair');
  const good=rows.map(r=>({key:r.key,text:r.reply_control.location,segments:[],buttons:[]}));
  assert(validateFooters(good,rows,'pair').pass);
  const swapped=good.map((row,i)=>({...row,text:good[1-i].text}));
  assert(!validateFooters(swapped,rows,'pair').pass);
  assert(!validateFooters(good.map(r=>({...r,text:r.text+' '+r.text})),rows,'repeat').pass);
  assert(!validateFooters([],rows,'missing').pass);
});
test('Seeds vary actual data; source report escapes payload strings',()=>{
  assert.notDeepEqual(makeRecords(1,'D01','pair'),makeRecords(2,'D01','pair'));
  assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('Gold source bytes and patch inputs match provenance',async()=>{
  const provenance=JSON.parse(await fs.readFile(path.join(ROOT,'gold/provenance.json'),'utf8'));
  assert.equal(sha256(await fs.readFile(path.join(ROOT,'gold/upstream/bilireveal.lite.user.js'))),provenance.upstream.sha256);
  assert.equal(sha256(await fs.readFile(path.join(ROOT,provenance.derivative.file))),provenance.derivative.sha256);
  assert.equal(sha256(await fs.readFile(path.join(ROOT,provenance.derivative.builder))),provenance.derivative.builderSha256);
  assert.equal(sha256(await fs.readFile(path.join(ROOT,provenance.derivative.helper))),provenance.derivative.helperSha256);
});
