'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles');
const counts = new Map();
const examples = new Map();
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.dds$/i.test(ent.name)) {
      const fd = fs.openSync(p, 'r');
      const h = Buffer.alloc(128);
      fs.readSync(fd, h, 0, 128, 0);
      fs.closeSync(fd);
      const fourCC = h.toString('ascii', 84, 88);
      let fmt = fourCC;
      if (fourCC === 'DX10') {
        const fd2 = fs.openSync(p, 'r');
        const x = Buffer.alloc(4);
        fs.readSync(fd2, x, 0, 4, 128);
        fs.closeSync(fd2);
        fmt = 'DX10:' + x.readUInt32LE(0);
      }
      counts.set(fmt, (counts.get(fmt) || 0) + 1);
      if (!examples.has(fmt)) examples.set(fmt, path.basename(p));
    }
  }
}
walk(root);
console.log([...counts.entries()].map(([k, v]) => k + ' = ' + v).join('\n'));
console.log('examples:', [...examples.entries()]);
