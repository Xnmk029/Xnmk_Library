import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, 'root');
const OUTSIDE = path.join(here, 'outside');

fs.rmSync(ROOT, { recursive: true, force: true });
fs.rmSync(OUTSIDE, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(OUTSIDE, { recursive: true });

const w = (rel, data) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  return p;
};

// 同名不同内容
w(path.join('同名不同内容', '报告.txt'), '版本 A -> alpha');
w(path.join('同名不同内容', '子目录', '报告.txt'), '版本 B -> beta');

// 不同名相同内容
const dupPayload = Buffer.from('不同名却完全相同的内容 #1\n', 'utf8');
const dup1 = w(path.join('不同名相同内容', '一.txt'), dupPayload);
const dup2 = w(path.join('不同名相同内容', '二.txt'), dupPayload);

// 空文件
const empty1 = w(path.join('空文件', '空一'), '');
const empty2 = w(path.join('空文件', '空二'), '');

// 中文文件名
const cnPayload = Buffer.from('中文内容：重复的文档\n', 'utf8');
const cn1 = w(path.join('中文名', '重复的文档.txt'), cnPayload);
const cn2 = w(path.join('中文名', '副本', '重复的文档.txt'), cnPayload);

// 大小相同但内容不同：绝不能只因大小相同就判重复
w(path.join('同大小不同内容', 'x.bin'), 'AAAA');
w(path.join('同大小不同内容', 'y.bin'), 'BBBB');

// 唯一文件
const uniq = w('唯一文件.txt', '独一无二');

// 超过 8 MiB
const big = w(path.join('超限', 'big.bin'), Buffer.alloc(9 * 1024 * 1024, 7));

// 根外文件 + 符号链接 / junction（不跟随）
const outsideFile = path.join(OUTSIDE, '厂外机密.txt');
fs.writeFileSync(outsideFile, dupPayload);
const outsideDir = path.join(OUTSIDE, '外目录');
fs.mkdirSync(outsideDir, { recursive: true });
const outsideDirFile = path.join(outsideDir, '外目录内的重复内容.txt');
fs.writeFileSync(outsideDirFile, cnPayload);

const linkResults = [];
function tryLink(type, target, linkPath) {
  try {
    fs.symlinkSync(target, linkPath, type);
    linkResults.push(`${type} OK: ${path.basename(linkPath)}`);
  } catch (err) {
    linkResults.push(`${type} FAILED (${err.code}): ${path.basename(linkPath)}`);
  }
}
tryLink('file', outsideFile, path.join(ROOT, '指向根外文件的链接.txt'));
tryLink('junction', outsideDir, path.join(ROOT, '指向根外目录的Junction'));
tryLink('dir', outsideDir, path.join(ROOT, '指向根外目录的目录链接'));

const manifest = {
  root: ROOT,
  expectedScanned: 11,
  expectedSkipped: 1,
  expectedGroups: [
    { sha256: sha(dupPayload), size: dupPayload.length, paths: sortPaths([path.relative(ROOT, dup1), path.relative(ROOT, dup2)]) },
    { sha256: sha(cnPayload), size: cnPayload.length, paths: sortPaths([path.relative(ROOT, cn1), path.relative(ROOT, cn2)]) },
    { sha256: sha(Buffer.alloc(0)), size: 0, paths: sortPaths([path.relative(ROOT, empty1), path.relative(ROOT, empty2)]) },
  ].sort((a, b) => (a.paths[0] < b.paths[0] ? -1 : a.paths[0] > b.paths[0] ? 1 : 0)),
};

function sortPaths(list) {
  return [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

fs.writeFileSync(path.join(here, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('fixtures ready');
console.log(linkResults.join('\n'));
console.log(JSON.stringify(manifest, null, 2));
