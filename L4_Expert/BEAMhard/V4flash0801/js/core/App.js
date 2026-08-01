/**
 * core/App.js — application bootstrap & main loop
 */
import * as THREE from 'three';
import { CFG } from '../config.js';
import { AssetManager } from '../assets/AssetManager.js';
import { VehicleVisual } from '../assets/VehicleVisual.js';
import { VehiclePhysics } from '../physics/Vehicle.js';
import { Ground } from '../physics/Ground.js';
import { EngineAudio } from '../audio/EngineAudio.js';
import { ProvingGround } from '../world/ProvingGround.js';
import { City } from '../world/City.js';
import { TileSystem } from '../world/Tiles.js';
import { PostFX } from '../render/PostFX.js';
import { makeToonSky, makeToonMaterial } from '../render/Toon.js';
import { HUD } from '../ui/HUD.js';
import { POIOverlay } from '../ui/POIOverlay.js';
import { Telemetry } from '../ui/Telemetry.js';
import { CameraRig } from '../ui/CameraRig.js';
import { Input } from '../input/Input.js';

export class App {
  constructor() {
    this.loaderBar = document.getElementById('loaderBar');
    this.loaderText = document.getElementById('loaderText');
    this.loaderDetail = document.getElementById('loaderDetail');
    this.time = 0;
    this.physicsAcc = 0;
    this.fixedDt = 1 / 120;
    this.teleSampleAcc = 0;
    this.ready = false;
    this.nprEnabled = true;
    this.paused = false;
    window.__beamglLog = (m) => this.telemetry.log('[assets] ' + m);
  }

  setLoader(pct, text, detail) {
    this.loaderBar.style.width = Math.round(pct * 100) + '%';
    if (text) this.loaderText.textContent = text;
    if (detail) this.loaderDetail.textContent = detail;
  }

  async init() {
    this.setLoader(0.02, 'INITIALIZING WEBGL PIPELINE…', 'renderer / scene / camera');
    // ---- renderer ----
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1b2f5c, 260, 1200);
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 4200);
    this.camera.position.set(0, 6, 8);

    // lights
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
    sun.position.set(180, 260, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 700;
    const S = 90;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    this.scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x54412f, 0.5));

    // toon sky
    makeToonSky(this.scene, { top: CFG.RENDER.skyTop, horizon: CFG.RENDER.skyHorizon, ground: CFG.RENDER.skyGround });

    this.ground = new Ground();
    this.input = new Input();
    this.cameraRig = new CameraRig(this.camera, this.renderer.domElement);
    this.audio = new EngineAudio();
    this.telemetry = new Telemetry();

    // ---- assets (Phase 1) ----
    this.setLoader(0.05, 'PARSING JBEAM STRUCTURES…', 'nodes / beams / wheels / engine curves');
    this.assets = new AssetManager((p) => this.setLoader(0.05 + p * 0.5, 'LOADING VEHICLE ASSETS…', 'collada meshes + converted textures'));
    await this.assets.load();
    this.setLoader(0.62, 'CONVERTING SOFT-BODY → RIGID CHASSIS…', 'mass properties / suspension / drivetrain');

    this.vehicle = new VehiclePhysics(this.assets, this.ground);
    this.vehicle.reset({ x: CFG.WORLD.spawn.x, y: 0.8, z: CFG.WORLD.spawn.z }, CFG.WORLD.spawn.yaw);

    this.vehicleVisual = new VehicleVisual(this.assets, this.scene);
    this.vehicleVisual.build();
    this.setLoader(0.72, 'BUILDING PROVING GROUND…', 'cobblestone / bumps / slalom / banked oval / wading pool');

    // ---- world (Phase 3) ----
    this.pg = new ProvingGround(this.scene, this.ground).build();

    // ---- city + tiles (Phase 5) ----
    this.setLoader(0.82, 'GENERATING PROCEDURAL CITY…', 'road network / blocks / buildings / props');
    await new Promise(r => setTimeout(r, 30));
    this.city = new City();
    this.tiles = new TileSystem(this.scene, this.city, this.camera);

    // ---- post FX (Phase 3/4) ----
    this.post = new PostFX(this.renderer, this.scene, this.camera, {
      bloomThreshold: 0.8,
      bloomStrength: CFG.RENDER.bloomStrength,
      exposure: CFG.RENDER.exposure,
    });

    // ---- UI (Phase 4) ----
    this.hud = new HUD(this.city);
    this.poi = new POIOverlay(document.getElementById('poiLayer'), this.city, this.camera);

    // input routing
    this.bindControls();

    // ---- audio (Phase 2) ----
    const resumeAudio = () => {
      this.audio.init();
      this.audio.setVehicle(this.vehicle);
      this.audio.setCamera(this.camera);
      this.audio.vehicleForward = this.vehicle.forward;
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
    window.addEventListener('pointerdown', resumeAudio);
    window.addEventListener('keydown', resumeAudio);

    window.addEventListener('resize', () => this.onResize());

    // hide loader
    document.getElementById('loader').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('loader').style.display = 'none';
      this.hud.show();
    }, 600);

    this.setLoader(1, 'READY — BEAMGL PROVING GROUND ONLINE', '');
    this.ready = true;
    this.telemetry.log('BEAMGL initialized: vehicle mass=' + this.vehicle.mass.toFixed(0) + 'kg, wheels=' + this.vehicle.wheels.length);
    this.telemetry.log('World: proving ground + procedural city ' + CFG.WORLD.cityExtent * 2 + 'm, quadtree levels 1..' + CFG.WORLD.maxTileLevel);
    this.telemetry.log('Controls: W/S throttle-brake, A/D steer, SPACE handbrake, Q/E gear, C camera, F free, R reset, L lights, 1-6 zones, V validate, T console, G postFX, N NPR, B edge, M map');
    this.hud.notify('BEAMGL ONLINE — 欢迎来到 CCF 试验场', 3000);

    this.renderer.setAnimationLoop(() => this.tick());
  }

  bindControls() {
    const inp = this.input;
    inp.on('keydown', (code) => {
      if (!this.ready) return;
      switch (code) {
        case 'KeyR': this.vehicle.reset({ x: CFG.WORLD.spawn.x, y: 0.8, z: CFG.WORLD.spawn.z }, CFG.WORLD.spawn.yaw); this.telemetry.log('vehicle reset to start pad'); break;
        case 'KeyL': this.vehicleVisual.setLights(!this.vehicleVisual.lightsOn); break;
        case 'Digit1': this.teleportTo(0, 8); break;
        case 'Digit2': this.teleportTo(0, 105); break;
        case 'Digit3': this.teleportTo(0, 190); break;
        case 'Digit4': this.teleportTo(0, 330); break;
        case 'Digit5': this.teleportTo(0, -150); break;
        case 'Digit6': this.teleportTo(-180, -250); break;
        case 'KeyG': this.post.enabled = !this.post.enabled; this.telemetry.log('postFX ' + (this.post.enabled ? 'ON' : 'OFF')); break;
        case 'KeyB': this.post.edgeEnabled = !this.post.edgeEnabled; this.post.enabled = true; this.telemetry.log('edge detection ' + (this.post.edgeEnabled ? 'ON' : 'OFF')); break;
        case 'KeyV': {
          const rows = this.telemetry.validate();
          this.hud.renderValidation(rows);
          this.hud.notify('VALIDATION MATRIX 已更新 — 见左下角面板', 3200);
          break;
        }
        case 'KeyT': document.getElementById('consolePanel').classList.toggle('hidden'); break;
        case 'KeyM': this.toggleBigMap(); break;
        case 'KeyK': this.telemetry.exportCSV(); this.hud.notify('CSV 遥测已导出 (beamgl_telemetry.csv)', 2500); break;
        case 'KeyN': this.toggleNPR(); break;
        case 'Escape':
          if (this.hud.bigmapVisible) this.hud.toggleBigMap();
          else this.paused = !this.paused;
          break;
      }
    });
    window.addEventListener('beamgl:poi-focus', (e) => {
      const { x, z } = e.detail;
      this.cameraRig.mode = 'orbit';
      this.cameraRig.focus(x, z, 260);
      this.telemetry.log(`POI focus -> (${x}, ${z})`);
    });
    window.addEventListener('beamgl:map-teleport', (e) => {
      const { x, z } = e.detail;
      this.teleportTo(x, z);
      this.hud.toggleBigMap();
      this.telemetry.log(`map teleport -> (${x.toFixed(0)}, ${z.toFixed(0)})`);
      this.hud.notify('已传送', 1800);
    });
  }

  toggleBigMap() {
    this.hud.toggleBigMap();
  }

  toggleNPR() {
    this.nprEnabled = !this.nprEnabled;
    this.vehicleVisual.outlineGroup.visible = this.nprEnabled;
    this.telemetry.log('NPR stylization ' + (this.nprEnabled ? 'ON' : 'OFF'));
  }

  teleportTo(x, z) {
    this.vehicle.reset({ x, y: 0.8, z }, 0);
    this.cameraRig.focus(x, z, 9);
    this.telemetry.log(`teleport -> (${x}, ${z})`);
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.post) this.post.resize(w, h);
  }

  /** main loop */
  tick() {
    const now = performance.now() / 1000;
    const dt = this.time ? now - this.time : 0.016;
    this.time = now;
    if (this.paused) return;

    // inputs
    this.input.poll();
    const inp = this.input;
    const v = this.vehicle;
    if (inp.gearUp && !inp.gearDown) { v.drivetrain.shiftUp(); }
    if (inp.gearDown && !inp.gearUp) { v.drivetrain.shiftDown(); }
    v.input.throttle = inp.throttle;
    v.input.brake = inp.brake;
    v.input.handbrake = inp.handbrake;
    // speed-sensitive steering (ackermann applied inside physics)
    const steerMax = CFG.VEHICLE.SUSP.maxSteer * Math.max(0.45, 1 - v.speed * 0.014);
    v.input.steer = inp.steer * steerMax;

    // physics (fixed substeps, real-time regardless of render rate)
    this.physicsAcc += dt;
    const h = this.fixedDt;
    let guard = 0;
    while (this.physicsAcc >= h && guard++ < 400) {
      v.step(h);
      this.physicsAcc -= h;
    }
    if (guard >= 400) this.physicsAcc = 0;
    // cone props
    this.pg.update(dt, v, this.time);

    // camera
    this.cameraRig.update(dt, v, inp);
    // shadow follows vehicle
    this.sun.position.set(v.body.pos.x + 180, 260, v.body.pos.z + 140);
    this.sun.target.position.copy(v.body.pos);
    this.sun.target.updateMatrixWorld();
    this.sun.shadow.camera.updateProjectionMatrix();

    // visual sync
    this.vehicleVisual.update(v, dt);
    this.audio.vehicleForward = v.forward;

    // audio
    if (this.audio.started) {
      const tele = v.telemetry();
      this.audio.update(dt, tele);
      for (const s of v.splashEvents) {
        this.audio.splash(s.x, s.y, s.z, s.strength);
      }
      v.splashEvents.length = 0;
    }

    // camera shake on hard impacts
    if (v.collisionEvents.length) {
      for (const ev of v.collisionEvents) this.cameraRig.addShake(ev.strength * 0.5);
      v.collisionEvents.length = 0;
    }

    // telemetry sampling (30 Hz)
    this.teleSampleAcc += dt;
    if (this.teleSampleAcc >= 1 / CFG.TELE.sampleHz) {
      this.teleSampleAcc = 0;
      const tele = v.telemetry();
      this.telemetry.sample(tele);
    }

    // tiles streaming
    const camDist = this.cameraRig.distance;
    const viewLevel = THREE.MathUtils.clamp(Math.round(3.4 - Math.log2(camDist / 90)), 1, CFG.WORLD.maxTileLevel);
    this.tiles.update({ x: v.body.pos.x, z: v.body.pos.z }, viewLevel);
    this.tiles.updateViewport(new THREE.Vector2(window.innerWidth, window.innerHeight), this.camera.fov * Math.PI / 180);

    // HUD
    const teleNow = v.telemetry();
    this.hud.update(teleNow, 0, dt, this.time);
    this.hud.updateBigMap(teleNow);
    this.hud.setStatus(this.paused ? 'PAUSED' : 'DRIVING');
    // zone detection for HUD
    const zone = this.telemetry.zoneAt(teleNow.x, teleNow.z);
    const zoneName = CFG.ZONES.find(z => z.id === zone);
    if (zoneName) {
      this.hud.setZone(zoneName.name, zone !== 'city' && zone !== 'start');
    }

    // POI overlay
    this.poi.update(viewLevel, this.cameraRig.mode === 'hood');

    // water depth status
    if (teleNow.waterDepth > 0.3) {
      this.hud.notify(`⚠ 涉水深度 ${teleNow.waterDepth.toFixed(2)}m ${teleNow.waterDepth > 1.4 ? '— 危险!' : '— 正常'}`);
    }

    // render
    this.post.render(this.time);
  }
}
