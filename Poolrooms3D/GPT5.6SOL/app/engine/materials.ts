import * as THREE from "three/webgpu";
import {
  abs,
  color,
  mix,
  normalLocal,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  time,
  vec3,
} from "three/tsl";

function seededNoise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, random: () => number) => void,
  colorSpace?: THREE.ColorSpace,
) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas is unavailable");
  draw(ctx, seededNoise(0x50_4f_4f_4c));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (colorSpace) texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTileMapSet(repeat: number) {
  const size = 512;
  const cells = 8;
  const cell = size / cells;

  const albedo = canvasTexture(
    size,
    (ctx, random) => {
      ctx.fillStyle = "#b8c8c4";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < cells; y += 1) {
        for (let x = 0; x < cells; x += 1) {
          const damp = Math.floor(random() * 16);
          ctx.fillStyle = `rgb(${190 - damp},${204 - damp},${200 - damp})`;
          ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
          const stain = ctx.createRadialGradient(
            (x + random()) * cell,
            (y + random()) * cell,
            0,
            (x + 0.5) * cell,
            (y + 0.5) * cell,
            cell * 0.7,
          );
          stain.addColorStop(0, "rgba(52,92,85,.11)");
          stain.addColorStop(1, "rgba(52,92,85,0)");
          ctx.fillStyle = stain;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
      ctx.strokeStyle = "#647b77";
      ctx.lineWidth = 4;
      for (let i = 0; i <= cells; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
    },
    THREE.SRGBColorSpace,
  );

  const roughness = canvasTexture(size, (ctx, random) => {
    ctx.fillStyle = "#8a8a8a";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 180; i += 1) {
      const radius = 8 + random() * 48;
      const gradient = ctx.createRadialGradient(
        random() * size,
        random() * size,
        0,
        random() * size,
        random() * size,
        radius,
      );
      gradient.addColorStop(0, `rgba(20,20,20,${0.04 + random() * 0.12})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
  });

  const normal = canvasTexture(size, (ctx) => {
    ctx.fillStyle = "#8080ff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#6f6fff";
    ctx.lineWidth = 5;
    for (let i = 0; i <= cells; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  });

  const ao = canvasTexture(size, (ctx) => {
    ctx.fillStyle = "#ececec";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "#8d8d8d";
    ctx.lineWidth = 7;
    for (let i = 0; i <= cells; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
  });

  [albedo, roughness, normal, ao].forEach((texture) => texture.repeat.set(repeat, repeat));
  return { albedo, roughness, normal, ao };
}

export type PoolMaterials = ReturnType<typeof createPoolMaterials>;

export function createPoolMaterials() {
  const floorMaps = createTileMapSet(24);
  const wallMaps = createTileMapSet(12);

  const causticA = sin(positionWorld.x.mul(1.7).add(positionWorld.z.mul(1.15)).add(time.mul(0.18)));
  const causticB = sin(positionWorld.x.mul(-1.24).add(positionWorld.z.mul(1.9)).sub(time.mul(0.13)));
  const caustic = pow(abs(causticA.add(causticB).mul(0.5)), 10).mul(0.32);

  const makeTileMaterial = (
    maps: ReturnType<typeof createTileMapSet>,
    roughness: number,
  ) => {
    const material = new THREE.MeshStandardNodeMaterial({
      map: maps.albedo,
      roughnessMap: maps.roughness,
      normalMap: maps.normal,
      aoMap: maps.ao,
      roughness,
      metalness: 0.02,
    });
    material.normalScale.set(0.28, 0.28);
    material.emissiveNode = color(0x73bcb0).mul(caustic);
    return material;
  };

  const floor = makeTileMaterial(floorMaps, 0.47);
  const wall = makeTileMaterial(wallMaps, 0.54);

  const water = new THREE.MeshPhysicalNodeMaterial({
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.16,
    thickness: 0.85,
    ior: 1.333,
    side: THREE.DoubleSide,
  });
  const p = positionLocal;
  const waveA = sin(p.x.mul(1.42).add(time.mul(0.17))).mul(0.018);
  const waveB = sin(p.y.mul(1.76).sub(time.mul(0.12))).mul(0.015);
  const waveC = sin(p.x.add(p.y).mul(0.63).add(time.mul(0.08))).mul(0.012);
  water.normalNode = normalLocal.add(vec3(waveA, waveB.add(waveC), 0)).normalize();
  const basinEdge = abs(p.x).max(abs(p.y));
  const depthTint = smoothstep(2.5, 8.2, basinEdge).oneMinus();
  water.colorNode = mix(color(0xbfd7d0), color(0x0a4c48), depthTint);

  const concrete = new THREE.MeshStandardNodeMaterial({
    color: 0x6f807c,
    roughness: 0.92,
    metalness: 0,
  });

  const emissive = new THREE.MeshBasicNodeMaterial({
    color: 0xd8fff7,
    toneMapped: false,
  });

  const metal = new THREE.MeshStandardNodeMaterial({
    color: 0x71837f,
    roughness: 0.24,
    metalness: 0.86,
  });

  return {
    floor,
    wall,
    water,
    concrete,
    emissive,
    metal,
    textures: [...Object.values(floorMaps), ...Object.values(wallMaps)],
    dispose() {
      floor.dispose();
      wall.dispose();
      water.dispose();
      concrete.dispose();
      emissive.dispose();
      metal.dispose();
      this.textures.forEach((texture) => texture.dispose());
    },
  };
}
