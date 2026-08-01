import * as THREE from "three/webgpu";
import { float, metalness, mrt, normalView, output, pass, roughness, vec2, vec3, vec4 } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { film } from "three/addons/tsl/display/FilmNode.js";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { RectAreaLightTexturesLib } from "three/addons/lights/RectAreaLightTexturesLib.js";
import { FootstepAudio } from "./audio";
import { createPoolMaterials, type PoolMaterials } from "./materials";
import { FirstPersonController } from "./player";
import { ProceduralWorld } from "./world";

type StatusCallback = (message: string) => void;

export class PoolroomsApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly onStatus: StatusCallback;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 72);
  private readonly timer = new THREE.Timer();
  private readonly audio = new FootstepAudio();
  private renderer: THREE.WebGPURenderer | null = null;
  private pipeline: THREE.RenderPipeline | null = null;
  private materials: PoolMaterials | null = null;
  private world: ProceduralWorld | null = null;
  private player: FirstPersonController | null = null;
  private frame = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, onStatus: StatusCallback) {
    this.canvas = canvas;
    this.onStatus = onStatus;
  }

  async init() {
    this.onStatus("requesting WebGPU rendering context");
    const renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: true,
      samples: 4,
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    await renderer.init();
    if (this.disposed) {
      renderer.dispose();
      return;
    }
    this.renderer = renderer;
    this.timer.connect(document);

    this.scene.background = new THREE.Color(0x061310);
    this.scene.fog = new THREE.FogExp2(0x183f3a, 0.042);
    this.scene.add(new THREE.AmbientLight(0x6d9a91, 0.48));
    THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());

    this.materials = createPoolMaterials();
    this.world = new ProceduralWorld(this.scene, this.materials);
    this.player = new FirstPersonController(
      this.canvas,
      this.camera,
      this.world,
      () => this.audio.play(),
    );
    this.world.update(this.camera.position);
    this.configurePipeline(renderer);
    this.onResize();
    window.addEventListener("resize", this.onResize);
    this.onStatus("simulation stable");
    renderer.setAnimationLoop(this.animate);
  }

  private configurePipeline(renderer: THREE.WebGPURenderer) {
    this.onStatus("assembling ssr · gtao · bloom · lo-fi matrix");
    const scenePass = pass(this.scene, this.camera);
    scenePass.setMRT(mrt({
      output,
      normal: normalView,
      roughness,
      metalness,
    }));

    const colorPass = scenePass.getTextureNode("output");
    const normalPass = scenePass.getTextureNode("normal");
    const roughnessPass = scenePass.getTextureNode("roughness");
    const metalnessPass = scenePass.getTextureNode("metalness");
    const depthPass = scenePass.getTextureNode("depth");

    // GTAO/SSR expect a sampleable MRT texture at runtime. Their current
    // declaration files incorrectly narrow this argument to a vec3 node.
    const gtao = ao(depthPass, normalPass as never, this.camera);
    gtao.resolutionScale = 0.5;
    gtao.radius.value = 0.72;
    gtao.thickness.value = 1.2;
    const aoTexture = gtao.getTextureNode();

    const reflections = ssr(colorPass, depthPass, normalPass as never, {
      camera: this.camera,
      roughnessNode: roughnessPass.r,
      metalnessNode: metalnessPass.r,
      reflectNonMetals: true,
      binaryRefine: false,
    });
    reflections.resolutionScale = 0.5;
    reflections.quality.value = 0.34;
    reflections.maxDistance.value = 13;
    reflections.thickness.value = 0.18;

    const occlusion = vec4(vec3(aoTexture.r.mul(0.38).add(0.62)), 1);
    const enclosedLight = colorPass.mul(occlusion).add(reflections.mul(0.32));
    const glow = bloom(enclosedLight, 0.46, 0.72, 1.05);
    const optical = chromaticAberration(
      enclosedLight.add(glow),
      float(0.0018),
      vec2(0.5, 0.5),
      float(1.003),
    );
    const recorded = film(optical, float(0.055));

    const pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputNode = recorded;
    this.pipeline = pipeline;
  }

  enter() {
    this.audio.resume();
    this.player?.enter();
  }

  private readonly animate = () => {
    if (this.disposed || !this.renderer || !this.pipeline || !this.player || !this.world) return;
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.player.update(delta);
    this.world.update(this.camera.position);
    this.pipeline.render();

    this.frame += 1;
    if (this.frame % 90 === 0) {
      const targetRatio = this.renderer.getPixelRatio();
      if (delta > 1 / 48 && targetRatio > 1) {
        this.renderer.setPixelRatio(Math.max(1, targetRatio - 0.1));
        this.renderer.setSize(innerWidth, innerHeight);
      }
    }
  };

  private readonly onResize = () => {
    if (!this.renderer) return;
    const width = innerWidth;
    const height = innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  dispose() {
    this.disposed = true;
    window.removeEventListener("resize", this.onResize);
    this.renderer?.setAnimationLoop(null);
    this.player?.dispose();
    this.world?.dispose();
    this.materials?.dispose();
    this.audio.dispose();
    this.timer.dispose();
    this.pipeline?.dispose();
    this.renderer?.dispose();
  }
}
