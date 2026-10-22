import * as THREE from "three";
import { BLOCKS, ITEMS, isBlockItem } from "./blocks";
import { createEntityMaterial, type WorldUniforms } from "./materials";
import { itemGeometry } from "./items";
import { tileDataURL } from "./textures";

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let material: THREE.ShaderMaterial | null = null;
const cache = new Map<number, string>();
let shared: WorldUniforms | null = null;

export function initIcons(uniforms: WorldUniforms) {
  shared = uniforms;
}

/** Returns a data URL icon for an item id (isometric block render or flat item texture). */
export function iconFor(id: number): string {
  const c = cache.get(id);
  if (c) return c;
  let url: string;
  if (isBlockItem(id)) {
    const def = BLOCKS[id];
    if (def.render === "cube" && shared) url = renderBlockIcon(id);
    else url = tileDataURL(def.tex.side);
  } else {
    url = tileDataURL(ITEMS.get(id)?.tile ?? "stick");
  }
  cache.set(id, url);
  return url;
}

function renderBlockIcon(id: number): string {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
    renderer.setSize(64, 64);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-0.235, 0.235, 0.235, -0.235, 0.01, 10);
    camera.position.set(1, 0.82, 1);
    camera.lookAt(0, 0, 0);
    material = createEntityMaterial(shared!);
    material.uniforms.uSky = { value: 1 };
    material.uniforms.uBlock = { value: 0 };
    material.uniforms.uDay = { value: 1 };
    material.uniforms.uFogFar = { value: 1000 };
    material.uniforms.uFogNear = { value: 999 };
    material.uniforms.uSkyTint = { value: new THREE.Color(1, 1, 1) };
  }
  const mesh = new THREE.Mesh(itemGeometry(id), material!);
  scene!.add(mesh);
  renderer.render(scene!, camera!);
  scene!.remove(mesh);
  return renderer.domElement.toDataURL();
}
