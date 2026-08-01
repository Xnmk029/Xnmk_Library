import * as THREE from "three/webgpu";
import type { ProceduralWorld } from "./world";

export class FirstPersonController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: ProceduralWorld;
  private readonly onFootstep: () => void;
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private bobPhase = 0;
  private stepDistance = 0;
  private enabled = false;
  private fallbackEnabled = false;
  private readonly onKeyDown = (event: KeyboardEvent) => this.keys.add(event.code);
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onMouseMove = (event: MouseEvent) => {
    const pointerLocked = document.pointerLockElement === this.canvas;
    const draggingFallback = this.fallbackEnabled && (event.buttons & 1) === 1;
    if (!pointerLocked && !draggingFallback) return;
    this.yaw -= event.movementX * 0.00155;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.00135, -1.18, 1.18);
  };
  private readonly onPointerLock = () => {
    this.enabled = document.pointerLockElement === this.canvas || this.fallbackEnabled;
  };

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    world: ProceduralWorld,
    onFootstep: () => void,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.world = world;
    this.onFootstep = onFootstep;
    camera.position.set(0, 1.7, 2.5);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    canvas.addEventListener("click", this.requestLock);
  }

  private readonly requestLock = () => {
    this.canvas.focus();
    this.fallbackEnabled = true;
    this.enabled = true;

    try {
      const request = this.canvas.requestPointerLock();
      if (request) {
        void request.catch(() => {
          // Embedded previews can deny pointer lock. Keep keyboard movement
          // active and use click-drag mouse look without surfacing an error.
          this.enabled = true;
        });
      }
    } catch {
      this.enabled = true;
    }
  };

  enter() {
    this.requestLock();
  }

  update(delta: number) {
    const forwardInput = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const rightInput = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const inputLength = Math.hypot(forwardInput, rightInput);
    const isMoving = this.enabled && inputLength > 0;

    if (isMoving) {
      const normalizedForward = forwardInput / inputLength;
      const normalizedRight = rightInput / inputLength;
      const speed = 1.28;
      const distance = speed * Math.min(delta, 0.05);
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const movement = forward.multiplyScalar(normalizedForward)
        .add(right.multiplyScalar(normalizedRight))
        .multiplyScalar(distance);
      const candidate = this.camera.position.clone().add(movement);
      candidate.y = 1.7;

      if (this.world.canMove(this.camera.position, candidate)) {
        this.camera.position.copy(candidate);
        this.stepDistance += distance;
        this.bobPhase += distance * 7.2;
        if (this.stepDistance > 0.92) {
          this.stepDistance = 0;
          this.onFootstep();
        }
      }
    } else {
      this.bobPhase += delta * 0.55;
    }

    const bob = isMoving
      ? Math.sin(this.bobPhase) * 0.012 + Math.sin(this.bobPhase * 2) * 0.004
      : Math.sin(this.bobPhase) * 0.002;
    this.camera.position.y = 1.7 + bob;
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + (isMoving ? Math.sin(this.bobPhase) * 0.0015 : 0);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    this.canvas.removeEventListener("click", this.requestLock);
  }
}
