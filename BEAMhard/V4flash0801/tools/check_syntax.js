/* syntax check all ES modules with node */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(path.join(ROOT, '..', 'js'));
let bad = 0;
for (const f of files) {
  try {
    execSync(`node --input-type=module --check < "${f}"`, { shell: 'cmd.exe', stdio: 'pipe' });
    console.log('OK  ', path.relative(path.join(ROOT, '..'), f));
  } catch (e) {
    bad++;
    console.log('FAIL', path.relative(path.join(ROOT, '..'), f));
    console.log(String(e.stderr).split('\n').slice(0, 6).join('\n'));
  }
}
console.log(bad === 0 ? 'ALL OK' : bad + ' FAILED');
process.exit(bad ? 1 : 0);
