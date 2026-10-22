/**
 * Procedural textures.
 *
 * Everything is generated on a canvas at load time: no binary assets, no
 * network fetches, and the look is reproducible from source. Each generator is
 * deterministic (seeded), so two runs produce the same track.
 */

import * as THREE from "three";
import { Xorshift32 } from "../audio/dsp/random.js";

function createCanvas(size, height = size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  return canvas;
}

function finish(canvas, { repeatX = 1, repeatY = 1, colorSpace = THREE.SRGBColorSpace, anisotropy = 4 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Coarse asphalt: dark aggregate with lighter chips and faint wear lanes. */
export function createAsphaltTexture(size = 512) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = new Xorshift32(0x4a51d0f);
  ctx.fillStyle = "#2b2d31";
  ctx.fillRect(0, 0, size, size);
  // aggregate speckle
  for (let i = 0; i < size * size * 0.35; i++) {
    const x = rng.nextUnit() * size;
    const y = rng.nextUnit() * size;
    const shade = 26 + rng.nextUnit() * 46;
    ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 3})`;
    ctx.fillRect(x, y, 1 + rng.nextUnit() * 1.6, 1 + rng.nextUnit() * 1.6);
  }
  // lighter chips
  for (let i = 0; i < 900; i++) {
    const x = rng.nextUnit() * size;
    const y = rng.nextUnit() * size;
    const shade = 82 + rng.nextUnit() * 40;
    ctx.fillStyle = `rgba(${shade},${shade},${shade + 4},0.55)`;
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + rng.nextUnit() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // rubber laid down in the driving line
  const gradient = ctx.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.42, "rgba(10,10,12,0.35)");
  gradient.addColorStop(0.58, "rgba(10,10,12,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return finish(canvas, { repeatX: 1, repeatY: 1, anisotropy: 8 });
}

/** Roughness map for asphalt so the sun does not turn it into a mirror. */
export function createAsphaltRoughnessTexture(size = 256) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = new Xorshift32(0x9f2b1c3);
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.25; i++) {
    const shade = 150 + rng.nextUnit() * 90;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.6)`;
    ctx.fillRect(rng.nextUnit() * size, rng.nextUnit() * size, 2, 2);
  }
  return finish(canvas, { colorSpace: THREE.NoColorSpace });
}

/** Red/white kerb stripes, running along the strip's length. */
export function createKerbTexture(size = 256) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#d8383a" : "#f2f2f2";
    ctx.fillRect(0, (i * size) / stripes, size, size / stripes);
  }
  // grime and tyre marks on the kerb
  const rng = new Xorshift32(0x77c1a2b);
  ctx.fillStyle = "rgba(30,28,26,0.22)";
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(rng.nextUnit() * size, rng.nextUnit() * size, rng.nextUnit() * 22, rng.nextUnit() * 4);
  }
  return finish(canvas, { anisotropy: 8 });
}

/** Mown grass with cut stripes and dry patches. */
export function createGrassTexture(size = 512) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = new Xorshift32(0x1c9a7f3);
  ctx.fillStyle = "#3f6b32";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0, (i * size) / 8, size, size / 16);
  }
  for (let i = 0; i < size * size * 0.18; i++) {
    const shade = 40 + rng.nextUnit() * 70;
    ctx.fillStyle = `rgba(${shade * 0.7},${shade},${shade * 0.5},0.5)`;
    ctx.fillRect(rng.nextUnit() * size, rng.nextUnit() * size, 1.5, 1.5);
  }
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = "rgba(122,116,64,0.22)";
    ctx.beginPath();
    ctx.ellipse(rng.nextUnit() * size, rng.nextUnit() * size, 12 + rng.nextUnit() * 40, 8 + rng.nextUnit() * 24, rng.nextUnit() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, { repeatX: 60, repeatY: 60, anisotropy: 8 });
}

/** Gravel trap. */
export function createGravelTexture(size = 256) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = new Xorshift32(0x5ad10c7);
  ctx.fillStyle = "#a89b86";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.3; i++) {
    const shade = 130 + rng.nextUnit() * 80;
    ctx.fillStyle = `rgba(${shade},${shade - 8},${shade - 26},0.75)`;
    ctx.beginPath();
    ctx.arc(rng.nextUnit() * size, rng.nextUnit() * size, 0.8 + rng.nextUnit() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(canvas, { repeatX: 12, repeatY: 12 });
}

/** Weathered concrete for walls, pit buildings and grandstand structure. */
export function createConcreteTexture(size = 256) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const rng = new Xorshift32(0x3d7f21b);
  ctx.fillStyle = "#b9b6ae";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.12; i++) {
    const shade = 150 + rng.nextUnit() * 70;
    ctx.fillStyle = `rgba(${shade},${shade - 2},${shade - 8},0.35)`;
    ctx.fillRect(rng.nextUnit() * size, rng.nextUnit() * size, 2, 2);
  }
  ctx.strokeStyle = "rgba(90,88,84,0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = (i * size) / 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  return finish(canvas, { repeatX: 4, repeatY: 2 });
}

/** Black-and-white chequer for the start/finish line. */
export function createCheckerTexture(size = 128, squares = 8) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const step = size / squares;
  for (let x = 0; x < squares; x++) {
    for (let y = 0; y < squares; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f4f4f4" : "#1a1a1c";
      ctx.fillRect(x * step, y * step, step, step);
    }
  }
  return finish(canvas);
}

/**
 * Trackside sponsor board.
 * @param {string} label
 * @param {string} background
 * @param {string} foreground
 */
export function createBoardTexture(label, background = "#1d3f8f", foreground = "#f5f5f5") {
  const canvas = createCanvas(512, 128);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, 512, 34);
  ctx.fillStyle = foreground;
  ctx.font = "bold 62px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 70);
  return finish(canvas, { repeatX: 1, repeatY: 1 });
}

/** Braking distance marker board (e.g. "100"). */
export function createMarkerTexture(text) {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#1b1b1b";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.fillStyle = "#1b1b1b";
  ctx.font = "bold 74px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 70);
  return finish(canvas);
}
