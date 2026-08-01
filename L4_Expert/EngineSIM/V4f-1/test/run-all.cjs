'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./harness.cjs');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.cjs'))
  .sort();

for (const f of files) {
  require(path.join(dir, f));
}

run().then((result) => {
  for (const f of result.failures) {
    console.error(`✗ ${f.name}`);
    console.error(`  ${f.err && f.err.message}`);
  }
  for (const t of require('./harness.cjs').tests) {
    if (!result.failures.some((f) => f.name === t.name)) {
      console.log(`✓ ${t.name}`);
    }
  }
  console.log(`\n${result.passed}/${result.total} tests passed`);
  if (result.failures.length) process.exit(1);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
