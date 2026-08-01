// DDS texture decoder (DXT1/DXT3/DXT5/BGRA8) + minimal PNG encoder.
// Pure Node.js, no external deps. Used by the offline asset converter.
'use strict';
const zlib = require('zlib');

function readU32(b, o) { return b.readUInt32LE(o); }
function readU16(b, o) { return b.readUInt16LE(o); }

function decodeDDS(buf) {
  if (buf.length < 128 || buf.toString('ascii', 0, 4) !== 'DDS ') {
    throw new Error('Not a DDS file');
  }
  const height = readU32(buf, 12);
  const width = readU32(buf, 16);
  const pitch = readU32(buf, 20);
  const fourCC = buf.toString('ascii', 84, 88);
  const mipCount = Math.max(1, readU32(buf, 28));
  let headerSize = 128;
  let format = fourCC;
  if (fourCC === 'DX10') {
    const dxgi = readU32(buf, 128);
    if (dxgi === 97 || dxgi === 98 || dxgi === 99) format = 'BC7';
    else if (dxgi === 80 || dxgi === 81) format = 'BC5';   // BC5_UNORM(_SRGB)
    else if (dxgi === 79 || dxgi === 82) format = 'BC4';
    else if (dxgi === 77 || dxgi === 78) format = 'DXT5';  // BC3
    else if (dxgi === 74 || dxgi === 75) format = 'DXT3';  // BC2
    else if (dxgi === 71 || dxgi === 72) format = 'DXT1';  // BC1
    else if (dxgi === 28 || dxgi === 29 || dxgi === 87) format = 'R8G8B8A8';
    else format = 'UNKNOWN' + dxgi;
    headerSize = 148;
  }
  let off = headerSize;
  const mips = [];
  let w = width, h = height;
  for (let m = 0; m < mipCount; m++) {
    const size = blockSize(w, h, format);
    if (off + size > buf.length) break;
    mips.push({ w, h, data: buf.subarray(off, off + size) });
    off += size;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return { width, height, format, mips };
}

function blockSize(w, h, format) {
  if (format === 'DXT1' || format === 'BC1' || format === 'BC4') {
    return Math.max(1, ((w + 3) >> 2)) * Math.max(1, ((h + 3) >> 2)) * 8;
  }
  if (format === 'DXT3' || format === 'DXT5' || format === 'BC5' || format === 'BC7' || format === 'BC6H') {
    return Math.max(1, ((w + 3) >> 2)) * Math.max(1, ((h + 3) >> 2)) * 16;
  }
  if (format === 'R8G8B8A8' || format === 'BGRA8' || format === 'UNORM') {
    return w * h * 4;
  }
  if (format.startsWith('UNKNOWN')) return w * h * 4; // fallback guess
  return w * h * 4;
}

function expandColor565(v) {
  return [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31];
}

// ---------------------------------------------------------------------------
// BC7 (BPTC) decoder — ported from bcdec.h (MIT / public domain, Sergii Kudlai)
// ---------------------------------------------------------------------------
class BC7Bitstream {
  constructor(buf) {
    this.low = buf.readBigUInt64LE(0);
    this.high = buf.readBigUInt64LE(8);
  }
  read(n) {
    const mask = (1n << BigInt(n)) - 1n;
    const bits = Number(this.low & mask);
    this.low >>= BigInt(n);
    this.low |= (this.high & mask) << BigInt(64 - n);
    this.high >>= BigInt(n);
    return bits;
  }
  readBit() { return this.read(1); }
}

const BC7_PARTITION_2 = [
  [[128, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 129]],
  [[128, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 129]],
  [[128, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 129]],
  [[128, 0, 0, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 1, 129]],
  [[128, 0, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 1], [0, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 0, 1, 129]],
  [[128, 0, 1, 1], [0, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 129]],
  [[128, 0, 0, 1], [0, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 129]],
  [[128, 0, 0, 0], [1, 0, 0, 0], [1, 1, 1, 0], [1, 1, 1, 129]],
  [[128, 1, 129, 1], [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [129, 0, 0, 0], [1, 1, 1, 0]],
  [[128, 1, 129, 1], [0, 0, 1, 1], [0, 0, 0, 1], [0, 0, 0, 0]],
  [[128, 0, 129, 1], [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  [[128, 0, 0, 0], [1, 0, 0, 0], [129, 1, 0, 0], [1, 1, 1, 0]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [129, 0, 0, 0], [1, 1, 0, 0]],
  [[128, 1, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 0, 129]],
  [[128, 0, 129, 1], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0]],
  [[128, 0, 0, 0], [1, 0, 0, 0], [129, 0, 0, 0], [1, 1, 0, 0]],
  [[128, 1, 129, 0], [0, 1, 1, 0], [0, 1, 1, 0], [0, 1, 1, 0]],
  [[128, 0, 129, 1], [0, 1, 1, 0], [0, 1, 1, 0], [1, 1, 0, 0]],
  [[128, 0, 0, 1], [0, 1, 1, 1], [129, 1, 1, 0], [1, 0, 0, 0]],
  [[128, 0, 0, 0], [1, 1, 1, 1], [129, 1, 1, 1], [0, 0, 0, 0]],
  [[128, 1, 129, 1], [0, 0, 0, 1], [1, 0, 0, 0], [1, 1, 1, 0]],
  [[128, 0, 129, 1], [1, 0, 0, 1], [1, 0, 0, 1], [1, 1, 0, 0]],
  [[128, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 129]],
  [[128, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [1, 1, 1, 129]],
  [[128, 1, 0, 1], [1, 0, 129, 0], [0, 1, 0, 1], [1, 0, 1, 0]],
  [[128, 0, 1, 1], [0, 0, 1, 1], [129, 1, 0, 0], [1, 1, 0, 0]],
  [[128, 0, 129, 1], [1, 1, 0, 0], [0, 0, 1, 1], [1, 1, 0, 0]],
  [[128, 1, 0, 1], [0, 1, 0, 1], [129, 0, 1, 0], [1, 0, 1, 0]],
  [[128, 1, 1, 0], [1, 0, 0, 1], [0, 1, 1, 0], [1, 0, 0, 129]],
  [[128, 1, 0, 1], [1, 0, 1, 0], [1, 0, 1, 0], [0, 1, 0, 129]],
  [[128, 1, 129, 1], [0, 0, 1, 1], [1, 1, 0, 0], [1, 1, 1, 0]],
  [[128, 0, 0, 1], [0, 0, 1, 1], [129, 1, 0, 0], [1, 0, 0, 0]],
  [[128, 0, 129, 1], [0, 0, 1, 0], [0, 1, 0, 0], [1, 1, 0, 0]],
  [[128, 0, 129, 1], [1, 0, 1, 1], [1, 1, 0, 1], [1, 1, 0, 0]],
  [[128, 1, 129, 0], [1, 0, 0, 1], [1, 0, 0, 1], [0, 1, 1, 0]],
  [[128, 0, 1, 1], [1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 129]],
  [[128, 1, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1], [1, 0, 0, 129]],
  [[128, 0, 0, 0], [0, 1, 129, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
  [[128, 1, 0, 0], [1, 1, 129, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  [[128, 0, 129, 0], [0, 1, 1, 1], [0, 0, 1, 0], [0, 0, 0, 0]],
  [[128, 0, 0, 0], [0, 0, 129, 0], [0, 1, 1, 1], [0, 0, 1, 0]],
  [[128, 0, 0, 0], [0, 1, 0, 0], [129, 1, 1, 0], [0, 1, 0, 0]],
  [[128, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 1], [0, 0, 1, 129]],
  [[128, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 129]],
  [[128, 1, 129, 0], [0, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 0]],
  [[128, 0, 129, 1], [1, 0, 0, 1], [1, 1, 0, 0], [0, 1, 1, 0]],
  [[128, 1, 1, 0], [1, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 129]],
  [[128, 1, 1, 0], [0, 0, 1, 1], [0, 0, 1, 1], [1, 0, 0, 129]],
  [[128, 1, 1, 1], [1, 1, 1, 0], [1, 0, 0, 0], [0, 0, 0, 129]],
  [[128, 0, 0, 1], [1, 0, 0, 0], [1, 1, 1, 0], [0, 1, 1, 129]],
  [[128, 0, 0, 0], [1, 1, 1, 1], [0, 0, 1, 1], [0, 0, 1, 129]],
  [[128, 0, 129, 1], [0, 0, 1, 1], [1, 1, 1, 1], [0, 0, 0, 0]],
  [[128, 0, 129, 0], [0, 0, 1, 0], [1, 1, 1, 0], [1, 1, 1, 0]],
  [[128, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 1], [0, 1, 1, 129]]
];

const BC7_PARTITION_3 = [
  [[128, 0, 1, 129], [0, 0, 1, 1], [0, 2, 2, 1], [2, 2, 2, 130]],
  [[128, 0, 0, 129], [0, 0, 1, 1], [130, 2, 1, 1], [2, 2, 2, 1]],
  [[128, 0, 0, 0], [2, 0, 0, 1], [130, 2, 1, 1], [2, 2, 1, 129]],
  [[128, 2, 2, 130], [0, 0, 2, 2], [0, 0, 1, 1], [0, 1, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [129, 1, 2, 2], [1, 1, 2, 130]],
  [[128, 0, 1, 129], [0, 0, 1, 1], [0, 0, 2, 2], [0, 0, 2, 130]],
  [[128, 0, 2, 130], [0, 0, 2, 2], [1, 1, 1, 1], [1, 1, 1, 129]],
  [[128, 0, 1, 1], [0, 0, 1, 1], [130, 2, 1, 1], [2, 2, 1, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [129, 1, 1, 1], [2, 2, 2, 130]],
  [[128, 0, 0, 0], [1, 1, 1, 1], [129, 1, 1, 1], [2, 2, 2, 130]],
  [[128, 0, 0, 0], [1, 1, 129, 1], [2, 2, 2, 2], [2, 2, 2, 130]],
  [[128, 0, 1, 2], [0, 0, 129, 2], [0, 0, 1, 2], [0, 0, 1, 130]],
  [[128, 1, 1, 2], [0, 1, 129, 2], [0, 1, 1, 2], [0, 1, 1, 130]],
  [[128, 1, 2, 2], [0, 129, 2, 2], [0, 1, 2, 2], [0, 1, 2, 130]],
  [[128, 0, 1, 129], [0, 1, 1, 2], [1, 1, 2, 2], [1, 2, 2, 130]],
  [[128, 0, 1, 129], [2, 0, 0, 1], [130, 2, 0, 0], [2, 2, 2, 0]],
  [[128, 0, 0, 129], [0, 0, 1, 1], [0, 1, 1, 2], [1, 1, 2, 130]],
  [[128, 1, 1, 129], [0, 0, 1, 1], [130, 0, 0, 1], [2, 2, 0, 0]],
  [[128, 0, 0, 0], [1, 1, 2, 2], [129, 1, 2, 2], [1, 1, 2, 130]],
  [[128, 0, 2, 130], [0, 0, 2, 2], [0, 0, 2, 2], [1, 1, 1, 129]],
  [[128, 1, 1, 129], [0, 1, 1, 1], [0, 2, 2, 2], [0, 2, 2, 130]],
  [[128, 0, 0, 129], [0, 0, 0, 1], [130, 2, 2, 1], [2, 2, 2, 1]],
  [[128, 0, 0, 0], [0, 0, 129, 1], [0, 1, 2, 2], [0, 1, 2, 130]],
  [[128, 0, 0, 0], [1, 1, 0, 0], [130, 2, 129, 0], [2, 2, 1, 0]],
  [[128, 1, 2, 130], [0, 129, 2, 2], [0, 0, 1, 1], [0, 0, 0, 0]],
  [[128, 0, 1, 2], [0, 0, 1, 2], [129, 1, 2, 2], [2, 2, 2, 130]],
  [[128, 1, 1, 0], [1, 2, 130, 1], [129, 2, 2, 1], [0, 1, 1, 0]],
  [[128, 0, 0, 0], [0, 1, 129, 0], [1, 2, 130, 1], [1, 2, 2, 1]],
  [[128, 0, 2, 2], [1, 1, 0, 2], [129, 1, 0, 2], [0, 0, 2, 130]],
  [[128, 1, 1, 0], [0, 129, 1, 0], [2, 0, 0, 2], [2, 2, 2, 130]],
  [[128, 0, 1, 1], [0, 1, 2, 2], [0, 1, 130, 2], [0, 0, 1, 129]],
  [[128, 0, 0, 0], [2, 0, 0, 0], [130, 2, 1, 1], [2, 2, 2, 129]],
  [[128, 0, 0, 0], [0, 0, 0, 2], [129, 1, 2, 2], [1, 2, 2, 130]],
  [[128, 2, 2, 130], [0, 0, 2, 2], [0, 0, 1, 2], [0, 0, 1, 129]],
  [[128, 0, 1, 129], [0, 0, 1, 2], [0, 0, 2, 2], [0, 2, 2, 130]],
  [[128, 1, 2, 0], [0, 129, 2, 0], [0, 1, 130, 0], [0, 1, 2, 0]],
  [[128, 0, 0, 0], [1, 1, 129, 1], [2, 2, 130, 2], [0, 0, 0, 0]],
  [[128, 1, 2, 0], [1, 2, 0, 1], [130, 0, 129, 2], [0, 1, 2, 0]],
  [[128, 1, 2, 0], [2, 0, 1, 2], [129, 130, 0, 1], [0, 1, 2, 0]],
  [[128, 0, 1, 1], [2, 2, 0, 0], [1, 1, 130, 2], [0, 0, 1, 129]],
  [[128, 0, 1, 1], [1, 1, 130, 2], [2, 2, 0, 0], [0, 0, 1, 129]],
  [[128, 1, 0, 129], [0, 1, 0, 1], [2, 2, 2, 2], [2, 2, 2, 130]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [130, 1, 2, 1], [2, 1, 2, 129]],
  [[128, 0, 2, 2], [1, 129, 2, 2], [0, 0, 2, 2], [1, 1, 2, 130]],
  [[128, 0, 2, 130], [0, 0, 1, 1], [0, 0, 2, 2], [0, 0, 1, 129]],
  [[128, 2, 2, 0], [1, 2, 130, 1], [0, 2, 2, 0], [1, 2, 2, 129]],
  [[128, 1, 0, 1], [2, 2, 130, 2], [2, 2, 2, 2], [0, 1, 0, 129]],
  [[128, 0, 0, 0], [2, 1, 2, 1], [130, 1, 2, 1], [2, 1, 2, 129]],
  [[128, 1, 0, 129], [0, 1, 0, 1], [0, 1, 0, 1], [2, 2, 2, 130]],
  [[128, 2, 2, 130], [0, 1, 1, 1], [0, 2, 2, 2], [0, 1, 1, 129]],
  [[128, 0, 0, 2], [1, 129, 1, 2], [0, 0, 0, 2], [1, 1, 1, 130]],
  [[128, 0, 0, 0], [2, 129, 1, 2], [2, 1, 1, 2], [2, 1, 1, 130]],
  [[128, 2, 2, 2], [0, 129, 1, 1], [0, 1, 1, 1], [0, 2, 2, 130]],
  [[128, 0, 0, 2], [1, 1, 1, 2], [129, 1, 1, 2], [0, 0, 0, 130]],
  [[128, 1, 1, 0], [0, 129, 1, 0], [0, 1, 1, 0], [2, 2, 2, 130]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [2, 1, 129, 2], [2, 1, 1, 130]],
  [[128, 1, 1, 0], [0, 129, 1, 0], [2, 2, 2, 2], [2, 2, 2, 130]],
  [[128, 0, 2, 2], [0, 0, 1, 1], [0, 0, 129, 1], [0, 0, 2, 130]],
  [[128, 0, 2, 2], [1, 1, 2, 2], [129, 1, 2, 2], [0, 0, 2, 130]],
  [[128, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [2, 129, 1, 130]],
  [[128, 0, 0, 130], [0, 0, 0, 1], [0, 0, 0, 2], [0, 0, 0, 129]],
  [[128, 2, 2, 2], [1, 2, 2, 2], [0, 2, 2, 2], [129, 2, 2, 130]],
  [[128, 1, 0, 129], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 130]],
  [[128, 1, 1, 129], [2, 0, 1, 1], [130, 2, 0, 1], [2, 2, 2, 0]]
];

const BC7_WEIGHTS = {
  2: [0, 21, 43, 64],
  3: [0, 9, 18, 27, 37, 46, 55, 64],
  4: [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64]
};
const BC7_MODE_HAS_PBITS = 0b11001011; // modes 0,1,3,6,7
const BC7_BITS = [[4, 6, 5, 7, 5, 7, 7, 5], [0, 0, 0, 0, 6, 8, 7, 5]];

function bc7Interpolate(a, b, weights, index) {
  const w = weights[index];
  return (a * (64 - w) + b * w + 32) >> 6;
}

function decodeBlockBC7(src, o, out, d, stride) {
  const bs = new BC7Bitstream(src.subarray(o, o + 16));
  let mode = 0;
  while (mode < 8 && bs.readBit() === 0) mode++;
  if (mode >= 8) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const di = d + y * stride + x * 4;
        out[di] = out[di + 1] = out[di + 2] = out[di + 3] = 0;
      }
    }
    return;
  }
  let numPartitions = 1;
  let partition = 0;
  let rotation = 0;
  let indexSelectionBit = 0;
  if (mode === 0 || mode === 1 || mode === 2 || mode === 3 || mode === 7) {
    numPartitions = (mode === 0 || mode === 2) ? 3 : 2;
    partition = bs.read(mode === 0 ? 4 : 6);
  }
  const numEndpoints = numPartitions * 2;
  if (mode === 4 || mode === 5) {
    rotation = bs.read(2);
    if (mode === 4) indexSelectionBit = bs.readBit();
  }
  const endpoints = [];
  for (let i = 0; i < numEndpoints; i++) endpoints.push([0, 0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < numEndpoints; j++) endpoints[j][i] = bs.read(BC7_BITS[0][mode]);
  }
  if (BC7_BITS[1][mode] > 0) {
    for (let j = 0; j < numEndpoints; j++) endpoints[j][3] = bs.read(BC7_BITS[1][mode]);
  }
  if (mode === 0 || mode === 1 || mode === 3 || mode === 6 || mode === 7) {
    for (let i = 0; i < numEndpoints; i++) {
      for (let j = 0; j < 4; j++) endpoints[i][j] <<= 1;
    }
    if (mode === 1) {
      const p0 = bs.readBit(), p1 = bs.readBit();
      for (let k = 0; k < 3; k++) {
        endpoints[0][k] |= p0; endpoints[1][k] |= p0;
        endpoints[2][k] |= p1; endpoints[3][k] |= p1;
      }
    } else if (BC7_MODE_HAS_PBITS & (1 << mode)) {
      for (let i = 0; i < numEndpoints; i++) {
        const pb = bs.readBit();
        for (let k = 0; k < 4; k++) endpoints[i][k] |= pb;
      }
    }
  }
  for (let i = 0; i < numEndpoints; i++) {
    const jc = BC7_BITS[0][mode] + ((BC7_MODE_HAS_PBITS >> mode) & 1);
    for (let k = 0; k < 3; k++) {
      endpoints[i][k] = (endpoints[i][k] << (8 - jc)) | (endpoints[i][k] >> jc);
    }
    const ja = BC7_BITS[1][mode] + ((BC7_MODE_HAS_PBITS >> mode) & 1);
    endpoints[i][3] = (endpoints[i][3] << (8 - ja)) | (endpoints[i][3] >> ja);
  }
  if (!BC7_BITS[1][mode]) {
    for (let j = 0; j < numEndpoints; j++) endpoints[j][3] = 0xFF;
  }
  let indexBits = (mode === 0 || mode === 1) ? 3 : (mode === 6 ? 4 : 2);
  const indexBits2 = mode === 4 ? 3 : (mode === 5 ? 2 : 0);
  const weights = BC7_WEIGHTS[indexBits];
  const weights2 = indexBits2 === 2 ? BC7_WEIGHTS[2] : BC7_WEIGHTS[3];
  const indices = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      let ps = (numPartitions === 1) ? ((x || y) ? 0 : 128)
        : (numPartitions === 2 ? BC7_PARTITION_2 : BC7_PARTITION_3)[partition][y][x];
      let ib = (mode === 0 || mode === 1) ? 3 : (mode === 6 ? 4 : 2);
      if (ps & 0x80) ib--;
      indices[y][x] = bs.read(ib);
    }
  }
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      let ps = (numPartitions === 1) ? ((x || y) ? 0 : 128)
        : (numPartitions === 2 ? BC7_PARTITION_2 : BC7_PARTITION_3)[partition][y][x];
      ps &= 3;
      const idx = indices[y][x];
      let r, g, b, a;
      if (!indexBits2) {
        r = bc7Interpolate(endpoints[ps * 2][0], endpoints[ps * 2 + 1][0], weights, idx);
        g = bc7Interpolate(endpoints[ps * 2][1], endpoints[ps * 2 + 1][1], weights, idx);
        b = bc7Interpolate(endpoints[ps * 2][2], endpoints[ps * 2 + 1][2], weights, idx);
        a = bc7Interpolate(endpoints[ps * 2][3], endpoints[ps * 2 + 1][3], weights, idx);
      } else {
        const idx2 = bs.read((x || y) ? indexBits2 : (indexBits2 - 1));
        if (!indexSelectionBit) {
          r = bc7Interpolate(endpoints[ps * 2][0], endpoints[ps * 2 + 1][0], weights, idx);
          g = bc7Interpolate(endpoints[ps * 2][1], endpoints[ps * 2 + 1][1], weights, idx);
          b = bc7Interpolate(endpoints[ps * 2][2], endpoints[ps * 2 + 1][2], weights, idx);
          a = bc7Interpolate(endpoints[ps * 2][3], endpoints[ps * 2 + 1][3], weights2, idx2);
        } else {
          r = bc7Interpolate(endpoints[ps * 2][0], endpoints[ps * 2 + 1][0], weights2, idx2);
          g = bc7Interpolate(endpoints[ps * 2][1], endpoints[ps * 2 + 1][1], weights2, idx2);
          b = bc7Interpolate(endpoints[ps * 2][2], endpoints[ps * 2 + 1][2], weights2, idx2);
          a = bc7Interpolate(endpoints[ps * 2][3], endpoints[ps * 2 + 1][3], weights, idx);
        }
      }
      if (rotation === 1) { const t = a; a = r; r = t; }
      else if (rotation === 2) { const t = a; a = g; g = t; }
      else if (rotation === 3) { const t = a; a = b; b = t; }
      const di = d + y * stride + x * 4;
      out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a;
    }
  }
}

function decodeBlockDXT1(src, o, out, d, stride) {
  const c0 = src.readUInt16LE(o);
  const c1 = src.readUInt16LE(o + 2);
  const bits = src.readUInt32LE(o + 4);
  const col0 = expandColor565(c0);
  const col1 = expandColor565(c1);
  const pal = [col0, col1];
  if (c0 > c1) {
    pal.push([(2 * col0[0] + col1[0]) / 3, (2 * col0[1] + col1[1]) / 3, (2 * col0[2] + col1[2]) / 3]);
    pal.push([(col0[0] + 2 * col1[0]) / 3, (col0[1] + 2 * col1[1]) / 3, (col0[2] + 2 * col1[2]) / 3]);
  } else {
    pal.push([(col0[0] + col1[0]) / 2, (col0[1] + col1[1]) / 2, (col0[2] + col1[2]) / 2]);
    pal.push([0, 0, 0]);
  }
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const idx = (bits >> (2 * (y * 4 + x))) & 3;
      const c = pal[idx];
      const di = d + y * stride + x * 4;
      out[di] = c[0]; out[di + 1] = c[1]; out[di + 2] = c[2];
      out[di + 3] = (c0 > c1 || idx < 3) ? 255 : 0;
    }
  }
}

function decodeBlockDXT3(src, o, out, d, stride) {
  // alpha 4bpp
  const alphaBits = src.readBigUInt64LE(BigInt(o));
  decodeBlockDXT1(src, o + 8, out, d, stride);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const shift = (y * 4 + x) * 4;
      const a = Number((alphaBits >> BigInt(shift)) & 0xFn) * 17;
      out[d + y * stride + x * 4 + 3] = a;
    }
  }
}

function decodeBlockDXT5(src, o, out, d, stride) {
  const a0 = src[o], a1 = src[o + 1];
  const alphaBits = src.readBigUInt64LE(BigInt(o)) >> 16n;
  const pal = [a0, a1];
  if (a0 > a1) {
    for (let i = 0; i < 6; i++) pal.push((((6 - i) * a0 + (i + 1) * a1) / 7) | 0);
  } else {
    for (let i = 0; i < 4; i++) pal.push((((4 - i) * a0 + (i + 1) * a1) / 5) | 0);
    pal.push(0, 255);
  }
  decodeBlockDXT1(src, o + 8, out, d, stride);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const idx = Number((alphaBits >> BigInt((y * 4 + x) * 3)) & 7n);
      out[d + y * stride + x * 4 + 3] = pal[idx];
    }
  }
}

function decodeDDSMip(dds, mip) {
  const { w, h, data } = mip;
  const format = dds.format;
  const out = Buffer.alloc(w * h * 4);
  if (format === 'DXT1') {
    for (let by = 0; by < h; by += 4) {
      for (let bx = 0; bx < w; bx += 4) {
        const blkIdx = (by / 4) * Math.max(1, w / 4) + bx / 4;
        decodeBlockDXT1(data, blkIdx * 8, out, by * w * 4 + bx * 4, w * 4);
      }
    }
  } else if (format === 'DXT3') {
    for (let by = 0; by < h; by += 4) {
      for (let bx = 0; bx < w; bx += 4) {
        const blkIdx = (by / 4) * Math.max(1, w / 4) + bx / 4;
        decodeBlockDXT3(data, blkIdx * 16, out, by * w * 4 + bx * 4, w * 4);
      }
    }
  } else if (format === 'DXT5') {
    for (let by = 0; by < h; by += 4) {
      for (let bx = 0; bx < w; bx += 4) {
        const blkIdx = (by / 4) * Math.max(1, w / 4) + bx / 4;
        decodeBlockDXT5(data, blkIdx * 16, out, by * w * 4 + bx * 4, w * 4);
      }
    }
  } else if (format === 'BC7') {
    for (let by = 0; by < h; by += 4) {
      for (let bx = 0; bx < w; bx += 4) {
        const blkIdx = (by / 4) * Math.max(1, w / 4) + bx / 4;
        decodeBlockBC7(data, blkIdx * 16, out, by * w * 4 + bx * 4, w * 4);
      }
    }
  } else if (format === 'R8G8B8A8') {
    data.copy(out, 0, 0, Math.min(data.length, w * h * 4));
  } else {
    // Unsupported (BC4/BC5/BC6H): solid magenta placeholder so missing maps are visible.
    for (let i = 0; i < out.length; i += 4) { out[i] = 255; out[i + 1] = 0; out[i + 2] = 255; out[i + 3] = 255; }
  }
  return out;
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(rgba, width, height) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// Downscale nearest by averaging 2x2 boxes repeatedly.
function downscaleRGBA(rgba, w, h, scale) {
  let cur = rgba, cw = w, ch = h;
  for (let s = 0; s < scale && cw > 1 && ch > 1; s++) {
    const nw = Math.max(1, cw >> 1), nh = Math.max(1, ch >> 1);
    const next = Buffer.alloc(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const samples = [];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(cw - 1, x * 2 + dx), sy = Math.min(ch - 1, y * 2 + dy);
            samples.push(cur.subarray((sy * cw + sx) * 4, (sy * cw + sx) * 4 + 4));
          }
        }
        const o = (y * nw + x) * 4;
        for (let c = 0; c < 4; c++) {
          next[o + c] = Math.round(samples.reduce((s, p) => s + p[c], 0) / samples.length);
        }
      }
    }
    cur = next; cw = nw; ch = nh;
  }
  return { rgba: cur, width: cw, height: ch };
}

// Decode a DDS file to a PNG at <= maxDim (picks closest mip, then downscales).
function ddsToPNG(buf, maxDim) {
  const dds = decodeDDS(buf);
  let best = 0;
  for (let m = 0; m < dds.mips.length; m++) {
    const mw = Math.max(dds.mips[m].w, dds.mips[m].h);
    if (mw > maxDim && m + 1 < dds.mips.length) best = m + 1; else if (mw <= maxDim) { best = m; break; }
  }
  const mip = dds.mips[best];
  let rgba = decodeDDSMip(dds, mip);
  let { w: width, h: height } = mip;
  let scale = 0;
  while (Math.max(width, height) > maxDim) { width >>= 1; height = Math.max(1, height >> 1); scale++; }
  if (scale > 0) {
    const r = downscaleRGBA(rgba, mip.w, mip.h, scale);
    rgba = r.rgba; width = r.width; height = r.height;
  }
  return { png: encodePNG(rgba, width, height), width, height, format: dds.format };
}

module.exports = { decodeDDS, decodeDDSMip, ddsToPNG, encodePNG };
