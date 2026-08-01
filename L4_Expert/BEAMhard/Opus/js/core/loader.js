/**
 * loader.js — asset manager for the vehicle lab.
 *
 * Layered virtual file system:
 *   1. overlay  — files extracted in-browser from dropped BeamNG mod .zip
 *                 packages (Task 1.1 front-end unpacker, DecompressionStream)
 *   2. network  — fetch() against the served vehicles/ tree (manifest-indexed)
 *
 * Paths are normalised mod-style: lower-cased, forward slashes, and the
 * "vehicles/..." tail is the canonical key (mod zips carry a wrapper folder).
 */

export class AssetVFS {
  constructor() {
    this.overlay = new Map();        // normPath -> Blob
    this.manifest = null;
    this.manifestPaths = new Set();
    this.pathCache = new Map();      // caseless lookup
    this.onLog = () => {};
  }

  static norm(path) {
    let p = String(path).replaceAll('\\', '/');
    p = p.replace(/^\/+/, '');
    const i = p.toLowerCase().indexOf('vehicles/');
    if (i > 0) p = p.slice(i);
    return p;
  }

  async loadManifest(url = 'vehicles/manifest.json') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    this.manifest = await res.json();
    const all = [
      ...this.manifest.jbeam, ...this.manifest.materials,
      ...this.manifest.meshes.map(m => m.path), ...this.manifest.textures,
    ];
    for (const p of all) {
      this.manifestPaths.add(p);
      this.pathCache.set(p.toLowerCase(), p);
    }
    return this.manifest;
  }

  /** Resolve a requested path to a real key (case-insensitive, ext-swap aware). */
  resolve(path, extSwaps = null) {
    const p = AssetVFS.norm(path);
    const lower = p.toLowerCase();
    if (this.overlay.has(lower)) return { where: 'overlay', key: lower };
    const hit = this.pathCache.get(lower);
    if (hit) return { where: 'net', key: hit };
    if (extSwaps) {
      for (const [from, to] of extSwaps) {
        if (lower.endsWith(from)) {
          const alt = lower.slice(0, -from.length) + to;
          if (this.overlay.has(alt)) return { where: 'overlay', key: alt };
          const netAlt = this.pathCache.get(alt);
          if (netAlt) return { where: 'net', key: netAlt };
        }
      }
    }
    return null;
  }

  async text(path) {
    const r = this.resolve(path);
    if (!r) throw new Error(`asset not found: ${path}`);
    if (r.where === 'overlay') return await this.overlay.get(r.key).text();
    const res = await fetch(encodeURI(r.key));
    if (!res.ok) throw new Error(`fetch ${r.key}: ${res.status}`);
    return await res.text();
  }

  async arrayBuffer(path, extSwaps = null) {
    const r = this.resolve(path, extSwaps);
    if (!r) throw new Error(`asset not found: ${path}`);
    if (r.where === 'overlay') return await this.overlay.get(r.key).arrayBuffer();
    const res = await fetch(encodeURI(r.key));
    if (!res.ok) throw new Error(`fetch ${r.key}: ${res.status}`);
    return await res.arrayBuffer();
  }

  has(path, extSwaps = null) { return this.resolve(path, extSwaps) !== null; }

  listByExt(ext) {
    const out = new Set();
    for (const k of this.overlay.keys()) if (k.endsWith(ext)) out.add(k);
    for (const p of this.manifestPaths) if (p.toLowerCase().endsWith(ext)) out.add(p);
    return [...out];
  }

  /** Ingest a BeamNG mod .zip (or split part) entirely client-side. */
  async ingestZip(fileOrBuffer, name = 'dropped.zip') {
    const buf = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
    const entries = await unzip(buf);
    let count = 0;
    for (const e of entries) {
      if (e.dir) continue;
      const key = AssetVFS.norm(e.name).toLowerCase();
      if (!key.startsWith('vehicles/')) continue;
      this.overlay.set(key, new Blob([e.data]));
      count++;
    }
    this.onLog(`unpacked ${count} files from ${name} into overlay VFS`);
    return count;
  }
}

/* ------------------------------------------------------------------ */
/* Minimal ZIP reader: central directory walk + stored/deflate entries */
/* using the browser-native DecompressionStream('deflate-raw').        */
/* ------------------------------------------------------------------ */
export async function unzip(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  const u8 = new Uint8Array(arrayBuffer);
  // find End Of Central Directory (scan back for PK\x05\x06)
  let eocd = -1;
  for (let i = arrayBuffer.byteLength - 22; i >= Math.max(0, arrayBuffer.byteLength - 22 - 65536); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: EOCD not found');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder();
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = td.decode(u8.subarray(off + 46, off + 46 + nameLen));
    // local header gives the true data offset
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const cdata = u8.subarray(dataStart, dataStart + csize);
    let data;
    if (method === 0) data = cdata.slice();
    else if (method === 8) data = await inflateRaw(cdata);
    else { off += 46 + nameLen + extraLen + cmtLen; continue; }
    out.push({ name, dir: name.endsWith('/'), data });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

export default AssetVFS;
