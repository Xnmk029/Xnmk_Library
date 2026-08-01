/**
 * prepare_assets.js
 * Builds the web-ready asset tree `vehicles_web/` from the extracted mod package:
 *  1. copies .jbeam / .dae / .json files into a sanitized tree (ccf/, common/)
 *  2. invokes tools/convert_dds.py (Pillow) to convert .dds -> .png
 *  3. patches <init_from> texture references inside .dae files so they point
 *     at converted .png files (relative paths)
 *  4. writes manifest.json (texture index + flexbody mesh -> dae index)
 *
 * Run: node tools/prepare_assets.js
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from 'node:child_process';

import { fileURLToPath } from "node:url";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'vehicles');
const DST = path.join(ROOT, 'vehicles_web');

// find the mod root folder (vehicles/thw_ccf2(...)/vehicles)
function findModVehiclesDir() {
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(SRC, e.name, 'vehicles');
    if (fs.existsSync(p)) return p;
  }
  return SRC;
}

function walk(d, ext) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (!ext || p.toLowerCase().endsWith(ext)) out.push(p);
  }
  return out;
}

function normKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function main() {
  const modDir = findModVehiclesDir();
  console.log('Mod vehicles dir:', modDir);

  // ---- 1. copy jbeam + json + dae ----
  const jbeams = walk(modDir, '.jbeam');
  const daes = walk(modDir, '.dae');
  const jsons = walk(modDir, '.json');
  let copied = 0;
  for (const f of [...jbeams, ...jsons]) {
    const rel = path.relative(modDir, f);
    const dst = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f, dst);
    copied++;
  }
  console.log(`Copied ${copied} jbeam/json files`);

  // ---- 2. convert textures ----
  console.log('Converting DDS -> PNG (Pillow)...');
  const py = process.platform === 'win32' ? 'python' : 'python3';
  try {
    const out = execSync(`"${py}" "${path.join(ROOT, 'tools', 'convert_dds.py')}" "${modDir}" "${DST}"`, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(out.trim());
  } catch (e) {
    console.error('Pillow conversion failed:', e.message);
    console.error('Please install Pillow: pip install pillow');
    process.exit(1);
  }

  // ---- 3. patch dae texture refs ----
  const pngIndex = new Map(); // normKey(basename) -> rel path from DST
  for (const p of walk(DST, '.png')) {
    const rel = path.relative(DST, p).replace(/\\/g, '/');
    const base = path.basename(p, '.png');
    const k = normKey(base);
    if (!pngIndex.has(k)) pngIndex.set(k, rel);
  }
  console.log('Converted PNG index size:', pngIndex.size);

  fs.mkdirSync(path.join(DST, 'textures'), { recursive: true });
  const missingPng = path.join(DST, 'textures', '_missing.png');
  if (!fs.existsSync(missingPng)) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64');
    fs.writeFileSync(missingPng, png);
  }

  const unresolved = new Set();
  const meshNameIndex = {}; // normalized mesh name -> dae rel path
  const flexbodyIndex = {}; // flexbody mesh name -> dae rel path

  for (const daePath of daes) {
    const rel = path.relative(modDir, daePath).replace(/\\/g, '/');
    const dstDae = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dstDae), { recursive: true });
    let t = fs.readFileSync(daePath, 'utf8');
    let changed = 0;

    // index every id= / name= attribute (node / geometry / instance names)
    const attrRe = /(?:id|name)="([^"]{3,})"/g;
    let m;
    while ((m = attrRe.exec(t)) !== null) {
      let nm = m[1];
      if (nm.endsWith('-mesh')) nm = nm.slice(0, -5);
      if (/^[a-z0-9_]+$/i.test(nm)) {
        const k = normKey(nm);
        if (!meshNameIndex[k]) meshNameIndex[k] = rel;
      }
    }

    // patch init_from
    t = t.replace(/<init_from>([^<]+)<\/init_from>/g, (all, p) => {
      let name = p.trim().split(/[\\/]/).pop();
      name = decodeURIComponent(name);
      name = name.replace(/^file:\/\//i, '');
      const base = name.replace(/\.(dds|png|tga|jpg|jpeg|bmp)$/i, '');
      let target = pngIndex.get(normKey(base));
      if (!target) target = pngIndex.get(normKey(base.replace(/_png$/, '')));
      if (!target) {
        unresolved.add(p.trim());
        target = 'textures/_missing.png';
      }
      const relDst = path.posix.relative(path.posix.dirname(rel), target);
      changed++;
      return `<init_from>${relDst}</init_from>`;
    });
    fs.writeFileSync(dstDae, t);
    console.log(`patched ${rel} (${changed} texture refs)`);
  }

  // ---- flexbody index ----
  for (const f of jbeams) {
    const rel = path.relative(modDir, f).replace(/\\/g, '/');
    const t = fs.readFileSync(f, 'utf8');
    const re = /"flexbodies":\s*\[([\s\S]*?)\n\s*\],/g;
    let m;
    while ((m = re.exec(t)) !== null) {
      const re2 = /^\s*\[\s*"([^"]+)"\s*,\s*\[/gm;
      let mm;
      while ((mm = re2.exec(m[1])) !== null) {
        const name = mm[1];
        if (!flexbodyIndex[name]) {
          const k = normKey(name);
          const daeRel = meshNameIndex[k] || meshNameIndex[normKey(name.replace(/_[fr]$/i, ''))] || '';
          flexbodyIndex[name] = daeRel;
        }
      }
    }
  }

  // ---- 4. manifest ----
  const textures = [...pngIndex.entries()].map(([k, v]) => ({ k, path: v }));
  const manifest = {
    generated: new Date().toISOString(),
    textureCount: textures.length,
    textures,
    flexbodyIndex,
  };
  fs.writeFileSync(path.join(DST, 'manifest.json'), JSON.stringify(manifest));
  console.log('manifest.json written. flexbody entries:', Object.keys(flexbodyIndex).length);
  console.log('Unresolved texture refs:', unresolved.size);
  console.log('DONE. vehicles_web ready.');
}

main();
