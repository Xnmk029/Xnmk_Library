/** Minimal 16-bit PCM WAV writer (offline renders for subjective listening). */

import { writeFileSync } from "node:fs";

/**
 * @param {string} path
 * @param {Float32Array} left
 * @param {Float32Array} right
 * @param {number} sampleRate
 */
export function writeStereoWav(path, left, right, sampleRate) {
  const frames = Math.min(left.length, right.length);
  const dataBytes = frames * 4;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    buffer.writeInt16LE(toPcm(left[i]), offset);
    buffer.writeInt16LE(toPcm(right[i]), offset + 2);
    offset += 4;
  }
  writeFileSync(path, buffer);
  return { path, frames, seconds: frames / sampleRate, bytes: buffer.length };
}

function toPcm(x) {
  const v = Number.isFinite(x) ? x : 0;
  const clamped = v > 1 ? 1 : v < -1 ? -1 : v;
  return Math.round(clamped * 32767);
}
