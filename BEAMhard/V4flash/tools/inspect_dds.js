'use strict';
const fs = require('fs');
const path = require('path');
const { decodeDDS, ddsToPNG } = require('./dds_png.js');
const files = [
  path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'ccf', 'textures', 'ccf_main_b.color.dds'),
  path.join(__dirname, '..', 'vehicles', 'thw_ccf2(ccf2重置版)', 'vehicles', 'ccf', 'textures', 'ccf_mechanical_b.color.dds')
];
for (const f of files) {
  const buf = fs.readFileSync(f);
  console.log(path.basename(f), 'size', buf.length);
  console.log(' magic', buf.toString('ascii', 0, 4), 'h', buf.readUInt32LE(12), 'w', buf.readUInt32LE(16), 'pitch', buf.readUInt32LE(20), 'mips', buf.readUInt32LE(28), 'fourCC', buf.toString('ascii', 84, 88));
  try {
    const dds = decodeDDS(buf);
    console.log(' decoded:', dds.format, 'mips', dds.mips.length, dds.mips.map(m => m.w + 'x' + m.h).join(','));
    let r;
    try { r = ddsToPNG(buf, 512); } catch (e) { console.log(' ddsToPNG error:', e.stack); continue; }
    const out = path.join(__dirname, '..', 'tools', path.basename(f).replace(/\.dds$/i, '_preview.png'));
    fs.writeFileSync(out, r.png);
    console.log(' preview written:', out, r.width + 'x' + r.height);
  } catch (e) { console.log(' decode error:', e.message); }
}
