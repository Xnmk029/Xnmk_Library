// Bundles the multi-file app into a single out-of-the-box HTML file.
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, (m, href) => {
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return '<style>\n' + css + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  return '<script>\n' + js + '\n</script>';
});

const out = path.join(root, 'ccf2_webgl_standalone.html');
fs.writeFileSync(out, html);
const size = (fs.statSync(out).size / 1048576).toFixed(2);
console.log('Standalone bundle written:', out, '(' + size + ' MB)');
