import * as THREE from "three/webgpu";
import type { PoolMaterials } from "./materials";

const CHUNK_SIZE = 18;
const ACTIVE_RADIUS = 2;
const MAX_CHUNKS = (ACTIVE_RADIUS * 2 + 1) ** 2;

type Edge = "north" | "south" | "east" | "west";

function hash2(x: number, z: number, salt = 0) {
  let h = Math.imul(x ^ salt, 0x27d4eb2d) ^ Math.imul(z + salt, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

function random01(x: number, z: number, salt = 0) {
  return hash2(x, z, salt) / 0xffffffff;
}

function sharedEdgeOpen(cx: number, cz: number, edge: Edge) {
  if (edge === "east") return random01(cx, cz, 101) > 0.28;
  if (edge === "west") return random01(cx - 1, cz, 101) > 0.28;
  if (edge === "south") return random01(cx, cz, 211) > 0.28;
  return random01(cx, cz - 1, 211) > 0.28;
}

function setMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  position: [number, number, number],
  scale: [number, number, number],
  rotationY = 0,
) {
  const dummy = setMatrix._dummy;
  dummy.position.set(...position);
  dummy.rotation.set(0, rotationY, 0);
  dummy.scale.set(...scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}
setMatrix._dummy = new THREE.Object3D();

export class ProceduralWorld {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly floor: THREE.InstancedMesh;
  private readonly ceiling: THREE.InstancedMesh;
  private readonly walls: THREE.InstancedMesh;
  private readonly water: THREE.InstancedMesh;
  private readonly columns: THREE.InstancedMesh;
  private readonly lights: THREE.InstancedMesh;
  private readonly steps: THREE.InstancedMesh;
  private readonly rails: THREE.InstancedMesh;
  private readonly areaLights: THREE.RectAreaLight[] = [];
  private currentChunkX = Number.NaN;
  private currentChunkZ = Number.NaN;
  private readonly blockers: Array<{ x: number; z: number; radius: number }> = [];

  constructor(scene: THREE.Scene, materials: PoolMaterials) {
    this.scene = scene;
    this.root.name = "procedural-poolrooms";
    scene.add(this.root);

    const box = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(1, 1, 12, 12);
    const rail = new THREE.CylinderGeometry(0.055, 0.055, 1, 10);

    this.floor = new THREE.InstancedMesh(box, materials.floor, MAX_CHUNKS);
    this.ceiling = new THREE.InstancedMesh(box, materials.concrete, MAX_CHUNKS);
    this.walls = new THREE.InstancedMesh(box, materials.wall, MAX_CHUNKS * 4);
    this.water = new THREE.InstancedMesh(plane, materials.water, MAX_CHUNKS);
    this.columns = new THREE.InstancedMesh(box, materials.wall, MAX_CHUNKS * 5);
    this.lights = new THREE.InstancedMesh(box, materials.emissive, MAX_CHUNKS * 2);
    this.steps = new THREE.InstancedMesh(box, materials.floor, MAX_CHUNKS * 6);
    this.rails = new THREE.InstancedMesh(rail, materials.metal, MAX_CHUNKS * 8);

    this.water.renderOrder = 2;
    this.water.frustumCulled = false;
    this.lights.frustumCulled = false;
    [
      this.floor,
      this.ceiling,
      this.walls,
      this.water,
      this.columns,
      this.lights,
      this.steps,
      this.rails,
    ].forEach((mesh) => {
      mesh.castShadow = false;
      mesh.receiveShadow = mesh !== this.lights;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
    });

    for (let i = 0; i < 8; i += 1) {
      const light = new THREE.RectAreaLight(0xb9efe5, 21, 5.5, 1.4);
      light.rotation.x = -Math.PI / 2;
      scene.add(light);
      this.areaLights.push(light);
    }
  }

  update(position: THREE.Vector3) {
    const cx = Math.floor((position.x + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    const cz = Math.floor((position.z + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    if (cx === this.currentChunkX && cz === this.currentChunkZ) return;
    this.currentChunkX = cx;
    this.currentChunkZ = cz;
    this.rebuild(cx, cz);
  }

  private rebuild(centerX: number, centerZ: number) {
    let floorCount = 0;
    let ceilingCount = 0;
    let wallCount = 0;
    let waterCount = 0;
    let columnCount = 0;
    let lightCount = 0;
    let stepCount = 0;
    let railCount = 0;
    this.blockers.length = 0;
    const lightPositions: THREE.Vector3[] = [];

    for (let dz = -ACTIVE_RADIUS; dz <= ACTIVE_RADIUS; dz += 1) {
      for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const x = cx * CHUNK_SIZE;
        const z = cz * CHUNK_SIZE;
        const deep = random01(cx, cz, 19) > 0.68;
        const basinY = deep ? -1.55 : -0.32;

        setMatrix(this.floor, floorCount++, [x, basinY - 0.18, z], [CHUNK_SIZE, 0.36, CHUNK_SIZE]);
        setMatrix(this.ceiling, ceilingCount++, [x, 4.15, z], [CHUNK_SIZE, 0.28, CHUNK_SIZE]);
        setMatrix(this.water, waterCount++, [x, 0.02, z], [CHUNK_SIZE, CHUNK_SIZE, 1], 0);

        const wallY = 2;
        const addWall = (edge: Edge) => {
          if (sharedEdgeOpen(cx, cz, edge)) return;
          if (edge === "north") {
            setMatrix(this.walls, wallCount++, [x, wallY, z - CHUNK_SIZE / 2], [CHUNK_SIZE, 4.1, 0.34]);
          } else if (edge === "south") {
            setMatrix(this.walls, wallCount++, [x, wallY, z + CHUNK_SIZE / 2], [CHUNK_SIZE, 4.1, 0.34]);
          } else if (edge === "west") {
            setMatrix(this.walls, wallCount++, [x - CHUNK_SIZE / 2, wallY, z], [0.34, 4.1, CHUNK_SIZE]);
          } else {
            setMatrix(this.walls, wallCount++, [x + CHUNK_SIZE / 2, wallY, z], [0.34, 4.1, CHUNK_SIZE]);
          }
        };
        addWall("north");
        addWall("south");
        addWall("east");
        addWall("west");

        const columnAmount = 1 + (hash2(cx, cz, 42) % 4);
        for (let i = 0; i < columnAmount; i += 1) {
          const px = x + (random01(cx, cz, 300 + i * 2) - 0.5) * 11;
          const pz = z + (random01(cx, cz, 301 + i * 2) - 0.5) * 11;
          const width = i % 3 === 0 ? 1.25 : 0.82;
          setMatrix(this.columns, columnCount++, [px, 2, pz], [width, 4.1, width]);
          this.blockers.push({ x: px, z: pz, radius: width * 0.72 });
        }

        const panelX = x + (random01(cx, cz, 501) - 0.5) * 5;
        const panelZ = z + (random01(cx, cz, 502) - 0.5) * 5;
        setMatrix(this.lights, lightCount++, [panelX, 3.97, panelZ], [5.5, 0.05, 1.4]);
        lightPositions.push(new THREE.Vector3(panelX, 3.88, panelZ));

        if (deep && random01(cx, cz, 601) > 0.45) {
          const direction = random01(cx, cz, 602) > 0.5 ? 1 : -1;
          for (let i = 0; i < 5; i += 1) {
            setMatrix(
              this.steps,
              stepCount++,
              [x + direction * (5.2 - i * 0.72), -0.12 - i * 0.2, z + 4.8],
              [1.5, 0.22, 3.1],
            );
          }
          for (const side of [-1, 1]) {
            setMatrix(this.rails, railCount++, [x + direction * 5.6, 0.95, z + 4.8 + side * 1.35], [1, 2.1, 1]);
            setMatrix(this.rails, railCount++, [x + direction * 2.8, 0.72, z + 4.8 + side * 1.35], [1, 1.6, 1]);
          }
        }
      }
    }

    this.floor.count = floorCount;
    this.ceiling.count = ceilingCount;
    this.walls.count = wallCount;
    this.water.count = waterCount;
    this.columns.count = columnCount;
    this.lights.count = lightCount;
    this.steps.count = stepCount;
    this.rails.count = railCount;

    [
      this.floor,
      this.ceiling,
      this.walls,
      this.water,
      this.columns,
      this.lights,
      this.steps,
      this.rails,
    ].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });

    lightPositions
      .sort((a, b) => a.distanceToSquared(new THREE.Vector3(centerX * CHUNK_SIZE, 0, centerZ * CHUNK_SIZE)) -
        b.distanceToSquared(new THREE.Vector3(centerX * CHUNK_SIZE, 0, centerZ * CHUNK_SIZE)))
      .slice(0, this.areaLights.length)
      .forEach((position, i) => {
        this.areaLights[i].position.copy(position);
        this.areaLights[i].visible = true;
      });
  }

  canMove(from: THREE.Vector3, to: THREE.Vector3) {
    const radius = 0.34;
    for (const blocker of this.blockers) {
      const dx = to.x - blocker.x;
      const dz = to.z - blocker.z;
      if (dx * dx + dz * dz < (blocker.radius + radius) ** 2) return false;
    }

    const fromX = Math.floor((from.x + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    const fromZ = Math.floor((from.z + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    const toX = Math.floor((to.x + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    const toZ = Math.floor((to.z + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    if (toX > fromX && !sharedEdgeOpen(fromX, fromZ, "east")) return false;
    if (toX < fromX && !sharedEdgeOpen(fromX, fromZ, "west")) return false;
    if (toZ > fromZ && !sharedEdgeOpen(fromX, fromZ, "south")) return false;
    if (toZ < fromZ && !sharedEdgeOpen(fromX, fromZ, "north")) return false;
    return true;
  }

  dispose() {
    this.scene.remove(this.root);
    this.areaLights.forEach((light) => this.scene.remove(light));
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}
