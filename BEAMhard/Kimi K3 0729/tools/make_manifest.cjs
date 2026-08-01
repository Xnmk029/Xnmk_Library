// Generates vehicles/manifest.json — a flat list of every asset file (browsers cannot list directories).
const fs = require('fs');
const path = require('path');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})('vehicles');
files.sort();
fs.writeFileSync('vehicles/manifest.json', JSON.stringify(files));
console.log('manifest entries:', files.length);
