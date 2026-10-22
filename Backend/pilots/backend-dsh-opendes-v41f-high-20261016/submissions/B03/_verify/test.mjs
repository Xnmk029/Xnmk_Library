/**
 * 端到端验证：只读性、真实 SHA-256、跳过统计、链接不跟随、持久化、并发合并、错误响应。
 * 用法：node _verify/test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const ROOT = path.join(here, 'root');
const OUTSIDE = path.join(here, 'outside');
const DATA = path.join(here, 'data');
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;

const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));

let pass = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name + (detail ? ` -> ${detail}` : ''));
    console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`);
  }
}

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) {
        out.set(path.relative(dir, p), 'link');
      } else if (st.isDirectory()) {
        // junction 在 Windows 上 lstat 报目录，需要 readlink 才能发现
        let target = null;
        try { target = fs.readlinkSync(p); } catch { target = null; }
        if (target !== null) out.set(path.relative(dir, p), 'junction:' + target);
        else walk(p);
      } else if (st.isFile()) {
        out.set(path.relative(dir, p), `${st.size}:${st.mtimeMs}:${sha(fs.readFileSync(p))}`);
      } else {
        out.set(path.relative(dir, p), 'other');
      }
    }
  };
  walk(dir);
  return out;
}

function diffSnapshots(a, b) {
  const changed = [];
  for (const [k, v] of a) if (b.get(k) !== v) changed.push(k);
  for (const k of b.keys()) if (!a.has(k)) changed.push(k);
  return changed;
}

async function req(pathname, options) {
  const res = await fetch(BASE + pathname, Object.assign({ cache: 'no-store' }, options));
  const textBody = await res.text();
  let json = null;
  try { json = JSON.parse(textBody); } catch { /* 非 JSON */ }
  return { status: res.status, json, text: textBody, headers: res.headers };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealthy(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await req('/health');
      if (r.status === 200 && r.json && r.json.ok === true) return true;
    } catch { /* 还没起来 */ }
    await sleep(150);
  }
  return false;
}

const SERVER_LOG = path.join(here, 'server.log');

function startServer() {
  // 沙箱内不能用管道捕获子进程输出（EPERM），改用文件描述符重定向
  const logFd = fs.openSync(SERVER_LOG, 'a');
  const child = spawn(process.execPath, [
    path.join(appDir, 'server.js'),
    '--port', String(PORT),
    '--data', DATA,
    '--root', ROOT,
  ], { cwd: appDir, stdio: ['ignore', logFd, logFd] });
  child.once('exit', () => { try { fs.closeSync(logFd); } catch { /* 已关闭 */ } });
  return child;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGKILL');
  await new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(resolve, 4000);
  });
}

function norm(p) {
  return p.split(/[\\/]/).join('/');
}

function sortPaths(list) {
  return [...list].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortedDeepEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function groupKey(g) {
  return norm(g.paths[0]);
}

async function main() {
  fs.rmSync(DATA, { recursive: true, force: true });

  console.log('\n== 1. 启动服务（数据目录不存在，应被创建）==');
  // 先记录根目录快照，稍后验证只读性
  const before = snapshot(ROOT);
  const outsideBefore = snapshot(OUTSIDE);
  const dataExisted = fs.existsSync(DATA);

  let child = startServer();
  const healthy = await waitHealthy();
  check('GET /health 返回 {"ok":true}', healthy);
  check('启动前数据目录不存在', !dataExisted);
  check('启动后数据目录已创建', fs.existsSync(DATA));

  console.log('\n== 2. GET / 提供操作界面 ==');
  {
    const r = await req('/');
    check('GET / 返回 200', r.status === 200, `status=${r.status}`);
    check('GET / 是 HTML', /text\/html/.test(r.headers.get('content-type') || ''));
    check('页面含启动扫描入口', /\/api\/scan/.test(r.text));
    check('页面含结果接口', /\/api\/result/.test(r.text));
  }

  console.log('\n== 3. 未扫描时 GET /api/result ==');
  {
    const r = await req('/api/result');
    check('未扫描返回非 2xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
    check('错误体为 {"error":...}', r.json && typeof r.json.error === 'string', r.text);
  }

  console.log('\n== 4. POST /api/scan 完整扫描 ==');
  let scanResult = null;
  {
    const r = await req('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    check('POST /api/scan 返回 200', r.status === 200, `status=${r.status} body=${r.text}`);
    scanResult = r.json;
    check('响应含 groups/scanned/skipped', scanResult &&
      Array.isArray(scanResult.groups) &&
      Number.isInteger(scanResult.scanned) &&
      Number.isInteger(scanResult.skipped),
      r.text);

    check('scanned 为成功读取数 11', scanResult.scanned === manifest.expectedScanned, `scanned=${scanResult.scanned}`);
    check('skipped 为 1（仅 9 MiB 超限文件）', scanResult.skipped === manifest.expectedSkipped, `skipped=${scanResult.skipped}`);

    const gotKeys = scanResult.groups.map(groupKey);
    const wantKeys = manifest.expectedGroups.map(groupKey);
    check('重复分组数量为 3', scanResult.groups.length === 3, JSON.stringify(gotKeys));
    check('分组按首个路径字典序排序', JSON.stringify(gotKeys) === JSON.stringify([...gotKeys].sort()),
      JSON.stringify(gotKeys));
    check('分组集合与预期一致（同名不同内容不成组）', sortedDeepEqual(gotKeys, wantKeys),
      `got=${JSON.stringify(gotKeys)} want=${JSON.stringify(wantKeys)}`);

    for (const want of manifest.expectedGroups) {
      const got = scanResult.groups.find((g) => groupKey(g) === groupKey(want));
      const label = want.paths[0];
      if (!got) { check(`分组 ${label} 存在`, false); continue; }
      check(`分组 ${label} 的 SHA-256 为真实摘要`, got.sha256 === want.sha256, got.sha256);
      check(`分组 ${label} 的 size 正确`, got.size === want.size, `got=${got.size} want=${want.size}`);
      const sorted = [...got.paths].sort();
      check(`分组 ${label} 路径按字典序排序`, JSON.stringify(got.paths) === JSON.stringify(sorted),
        JSON.stringify(got.paths));
      check(`分组 ${label} 路径相对根目录`, got.paths.every((p) => !path.isAbsolute(p)), JSON.stringify(got.paths));
    }

    const emptyGroup = scanResult.groups.find((g) => g.size === 0);
    check('零字节文件成组', !!emptyGroup && emptyGroup.paths.length === 2, JSON.stringify(emptyGroup));
    check('零字节组摘要为空文件 SHA-256', emptyGroup && emptyGroup.sha256 === sha(Buffer.alloc(0)));

    const sameSize = scanResult.groups.find((g) => g.paths.some((p) => norm(p).includes('同大小不同内容')));
    check('同大小不同内容不成组', !sameSize,
      sameSize ? JSON.stringify(sameSize.paths) : '');

    const cnGroup = scanResult.groups.find((g) => g.paths.some((p) => p.includes('中文名')));
    check('中文文件名路径原样返回', !!cnGroup && cnGroup.paths.some((p) => p.includes('重复的文档.txt')),
      JSON.stringify(cnGroup && cnGroup.paths));

    const outsideLeak = scanResult.groups.some((g) => g.paths.some((p) => norm(p).includes('..')));
    check('结果中无根外路径', !outsideLeak, JSON.stringify(scanResult.groups));

    const junctionLeak = scanResult.groups.some((g) => g.paths.some((p) => norm(p).includes('Junction') || norm(p).includes('链接')));
    check('未跟随 junction / 链接', !junctionLeak, JSON.stringify(scanResult.groups));

    const bigLeak = scanResult.groups.some((g) => g.paths.some((p) => norm(p).includes('超限')));
    check('超限文件未进入分组', !bigLeak);
  }

  console.log('\n== 4b. 只读性：扫描不触碰被扫描目录 ==');
  {
    const after = snapshot(ROOT);
    const changed = diffSnapshots(before, after);
    check('根目录内容与修改时间未被扫描改动', changed.length === 0, changed.join(', '));
    const outsideAfter = snapshot(OUTSIDE);
    check('根外目录未被触碰', diffSnapshots(outsideBefore, outsideAfter).length === 0);
  }

  console.log('\n== 5. GET /api/result 返回完整结果 ==');
  {
    const r = await req('/api/result');
    check('GET /api/result 返回 200', r.status === 200, `status=${r.status}`);
    check('groups 与扫描结果一致', JSON.stringify(r.json.groups) === JSON.stringify(scanResult.groups));
    check('scanned/skipped 一致', r.json.scanned === scanResult.scanned && r.json.skipped === scanResult.skipped);
    check('含 finishedAt 时间戳', typeof r.json.finishedAt === 'string' && !Number.isNaN(Date.parse(r.json.finishedAt)),
      String(r.json.finishedAt));
  }

  console.log('\n== 6. 进度接口 GET /api/scan ==');
  {
    const r = await req('/api/scan');
    check('GET /api/scan 返回 200', r.status === 200, `status=${r.status}`);
    check('running 为 false（扫描已结束）', r.json && r.json.running === false, r.text);
    check('phase 为 idle', r.json && r.json.phase === 'idle', String(r.json && r.json.phase));
    check('上报根目录', r.json && typeof r.json.root === 'string' && r.json.root.length > 0);
    check('groupCount 与实际分组数一致', r.json && r.json.groupCount === scanResult.groups.length);
  }

  console.log('\n== 7. 并发扫描请求合并到同一运行 ==');
  {
    // 让根目录下临时多出一个较大的文件，使扫描耗时足以并发
    const bigTmp = path.join(ROOT, '临时大文件.bin');
    fs.writeFileSync(bigTmp, Buffer.alloc(6 * 1024 * 1024, 3));
    const t0 = Date.now();
    const [a, b, c] = await Promise.all([
      req('/api/scan', { method: 'POST', body: '{}' }),
      req('/api/scan', { method: 'POST', body: '{}' }),
      req('/api/scan', { method: 'POST', body: '{}' }),
    ]);
    const elapsed = Date.now() - t0;
    check('三个并发请求全部 200 或 409',
      [a, b, c].every((r) => r.status === 200 || r.status === 409),
      [a.status, b.status, c.status].join(','));
    const okOnes = [a, b, c].filter((r) => r.status === 200);
    check('至少一个请求成功', okOnes.length >= 1, String(okOnes.length));
    check('成功响应的结果完全相同（合并到同一运行）',
      okOnes.every((r) => JSON.stringify(r.json.groups) === JSON.stringify(okOnes[0].json.groups) &&
        r.json.scanned === okOnes[0].json.scanned && r.json.skipped === okOnes[0].json.skipped));
    check('没有出现半份结果（groups/scanned/skipped 齐全）',
      okOnes.every((r) => Array.isArray(r.json.groups) && Number.isInteger(r.json.scanned) && Number.isInteger(r.json.skipped)));
    console.log(`  info  三次并发耗时 ${elapsed} ms，状态 ${[a.status, b.status, c.status].join('/')}`);

    const after = await req('/api/result');
    check('并发后 GET /api/result 仍为完整结果',
      after.status === 200 && Array.isArray(after.json.groups) && Number.isInteger(after.json.scanned));

    fs.rmSync(bigTmp, { force: true });
    const r2 = await req('/api/scan', { method: 'POST', body: '{}' });
    check('删除临时文件后再次扫描得到原结果',
      r2.status === 200 && JSON.stringify(r2.json.groups.map(groupKey)) === JSON.stringify(manifest.expectedGroups.map(groupKey)),
      JSON.stringify(r2.json.groups.map(groupKey)));
  }

  console.log('\n== 8. 内容修改后再次扫描结果更新 ==');
  {
    const target = path.join(ROOT, '不同名相同内容', '二.txt');
    const original = fs.readFileSync(target);
    fs.writeFileSync(target, '内容被改掉了，不再重复\n');
    const r = await req('/api/scan', { method: 'POST', body: '{}' });
    const dupGroupGone = !r.json.groups.some((g) => g.paths.some((p) => p.includes('不同名相同内容')));
    check('修改后该重复组消失', dupGroupGone, JSON.stringify(r.json.groups.map(groupKey)));

    fs.writeFileSync(target, original);
    const r3 = await req('/api/scan', { method: 'POST', body: '{}' });
    check('还原后重复组恢复且摘要不变',
      r3.json.groups.some((g) => g.sha256 === manifest.expectedGroups[0].sha256 &&
        JSON.stringify(g.paths) === JSON.stringify(manifest.expectedGroups[0].paths)));
  }

  console.log('\n== 9. 根外路径不可读取 ==');
  {
    const r = await req('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: OUTSIDE }),
    });
    check('请求指定 root 被拒绝', r.status === 400, `status=${r.status} body=${r.text}`);
    check('拒绝原因以 {"error":...} 返回', r.json && typeof r.json.error === 'string', r.text);

    const r2 = await req('/api/scan', {
      method: 'POST',
      body: JSON.stringify({ path: '../outside/厂外机密.txt' }),
    });
    check('请求指定 path 被拒绝', r2.status === 400 && r2.json && typeof r2.json.error === 'string', r2.text);

    const r3 = await req('/api/scan', { method: 'POST', body: '{not json' });
    check('非法 JSON 请求体被拒绝', r3.status === 400 && r3.json && typeof r3.json.error === 'string', r3.text);

    const r4 = await req('/api/result');
    check('拒绝后结果未被破坏',
      r4.status === 200 && r4.json.scanned === manifest.expectedScanned &&
      sortedDeepEqual(r4.json.groups.map(groupKey), manifest.expectedGroups.map(groupKey)),
      r4.text);
  }

  console.log('\n== 10. 错误与边界响应 ==');
  {
    const r404 = await req('/api/nope');
    check('未知路径返回 404 + error', r404.status === 404 && r404.json && typeof r404.json.error === 'string');

    const rMethod = await req('/api/result', { method: 'POST', body: '{}' });
    check('不支持的方法返回 405 或 404（非 2xx）', rMethod.status >= 400 && !!rMethod.json.error, `status=${rMethod.status}`);

    const rHealth = await req('/health');
    check('GET /health 仍为 {"ok":true}', rHealth.status === 200 && rHealth.json.ok === true);
  }

  console.log('\n== 11. 重启后保留上次结果 ==');
  {
    await stopServer(child);
    child = startServer();
    const ok = await waitHealthy();
    check('重启后服务可用', ok);

    const r = await req('/api/result');
    check('重启后 GET /api/result 返回 200', r.status === 200, `status=${r.status} body=${r.text}`);
    check('重启后结果与重启前一致',
      r.json && JSON.stringify(r.json.groups) === JSON.stringify(scanResult.groups) &&
      r.json.scanned === scanResult.scanned && r.json.skipped === scanResult.skipped,
      r.text);

    const s = await req('/api/scan');
    check('重启后状态显示已有历史结果', s.json.finishedAt !== null && s.json.groupCount === scanResult.groups.length,
      JSON.stringify(s.json));
  }

  console.log('\n== 12. 只监听 127.0.0.1 ==');
  {
    const s = await req('/api/scan');
    check('根目录固定为 --root 指定目录', norm(s.json.root) === norm(ROOT), s.json.root);

    const { networkInterfaces } = await import('node:os');
    const external = [];
    for (const list of Object.values(networkInterfaces())) {
      for (const ni of list || []) {
        if (ni.family === 'IPv4' && !ni.internal) external.push(ni.address);
      }
    }
    let reachable = null;
    for (const ip of external) {
      try {
        const ctl = AbortSignal.timeout(1500);
        const res = await fetch(`http://${ip}:${PORT}/health`, { signal: ctl });
        reachable = `${ip}:${res.status}`;
        break;
      } catch { /* 不可达，符合预期 */ }
    }
    check('外部网卡地址不可访问（只绑定回环）', reachable === null,
      reachable ? `可访问 ${reachable}` : '');
    if (external.length === 0) console.log('  info  未发现外部 IPv4 网卡，跳过实际探测');
  }

  await stopServer(child);

  console.log(`\n===== 结果：${pass} 项通过，${failures.length} 项失败 =====`);
  for (const f of failures) console.log('  FAILED: ' + f);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('测试脚本异常：', err);
  process.exitCode = 1;
});