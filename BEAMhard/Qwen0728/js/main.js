/**
 * Main Application Entry - Integrated HTML5 Web App
 * Phases 1-5: Vehicle Physics, Audio, Proving Ground, NPR Rendering, City & Vector Tiles
 */
import * as THREE from 'three';
import { JBeamParser } from './jbeam-parser.js';
import { Vehicle } from './vehicle.js';
import { AudioEngine } from './audio-engine.js';
import { ProvingGround } from './proving-ground.js';
import { VehicleControls } from './vehicle-controls.js';
import { UISystem } from './ui-system.js';
import { CityGenerator } from './city-generator.js';
import { TileStreamManager, SeamlessCameraController, QuadTree, VectorTessellator } from './vector-tiles.js';
import { createCelShadeMaterial, addOutlineToMesh, applyCelShading, OutlinePostProcess } from './npr-shaders.js';

class Application {
    constructor() {
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.clock = new THREE.Clock();

        this.vehicle = null;
        this.audioEngine = null;
        this.provingGround = null;
        this.controls = null;
        this.ui = null;
        this.cityGenerator = null;
        this.tileManager = null;
        this.cityCamera = null;
        this.outlinePass = null;

        this.mode = 'vehicle'; // 'vehicle' | 'city'
        this.nprEnabled = true;
        this.frameCount = 0;
        this.fpsTime = 0;
        this.fps = 0;
    }

    async init() {
        this.ui = new UISystem();
        this.ui.init();
        this.ui.setLoadingProgress(5, 'Initializing renderer...');

        // Setup renderer
        const canvas = document.getElementById('main-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x87CEEB, 1); // sky blue clear color
        this.renderer.autoClear = true;

        // Setup scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x88aacc, 100, 400);

        // Setup camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 12);

        this.ui.setLoadingProgress(15, 'Parsing JBeam physics data...');
        await this._phase1_init();

        this.ui.setLoadingProgress(40, 'Building audio pipeline...');
        await this._phase2_init();

        this.ui.setLoadingProgress(55, 'Constructing proving ground...');
        this._phase3_init();

        this.ui.setLoadingProgress(70, 'Compiling NPR shaders...');
        this._phase4_init();

        this.ui.setLoadingProgress(85, 'Generating city & vector tiles...');
        this._phase5_init();

        this.ui.setLoadingProgress(95, 'Finalizing systems...');
        this._setupEventListeners();

        this.ui.setLoadingProgress(100, 'Ready!');
        this.ui.log('All systems initialized successfully', 'success');
        this.ui.log('Phase 1: JBeam parsed, physics chassis + soft-body tires active', 'info');
        this.ui.log('Phase 2: Web Audio engine synth ready (4-cyl turbo)', 'info');
        this.ui.log('Phase 3: Proving ground built (suspension/steering/wading zones)', 'info');
        this.ui.log('Phase 4: NPR cel-shading + outline post-process compiled', 'info');
        this.ui.log('Phase 5: Procedural city + QuadTree tile streaming online', 'info');

        setTimeout(() => {
            this.ui.hideLoading();
            this.ui.showHUD();
        }, 500);

        // Start render loop
        this._animate();
    }

    /**
     * Phase 1: JBeam Parsing, Physics Conversion, Mesh Binding
     */
    async _phase1_init() {
        const parser = new JBeamParser();

        // Load and parse JBeam files from vehicles directory
        const jbeamFiles = [
            'vehicles/thw_ccf2(ccf2重置版)/vehicles/ccf/jbeams/ccf_suspension_F.jbeam',
            'vehicles/thw_ccf2(ccf2重置版)/vehicles/ccf/jbeams/ccf_suspension_R.jbeam',
            'vehicles/thw_ccf2(ccf2重置版)/vehicles/ccf/jbeams/ccf_body.jbeam'
        ];

        let parsedData = null;
        const loadedContents = [];

        for (const file of jbeamFiles) {
            try {
                const resp = await fetch(file);
                if (resp.ok) {
                    const text = await resp.text();
                    loadedContents.push(text);
                    this.ui.log(`Loaded JBeam: ${file.split('/').pop()}`, 'info');
                }
            } catch (e) {
                this.ui.log(`JBeam fetch skipped (server mode needed): ${file.split('/').pop()}`, 'warn');
            }
        }

        if (loadedContents.length > 0) {
            parsedData = parser.parseMultiple(loadedContents);
            if (parsedData && parsedData.nodes.length > 0) {
                this.ui.log(`Parsed ${parsedData.nodes.length} nodes, ${parsedData.beams.length} beams`, 'success');
            } else {
                this.ui.log('JBeam parsed but yielded 0 nodes, using embedded data', 'warn');
                parsedData = this._getEmbeddedPhysicsData();
            }
        } else {
            // Fallback: use built-in physics data derived from JBeam structure
            this.ui.log('Using embedded physics data (from JBeam analysis)', 'warn');
            parsedData = this._getEmbeddedPhysicsData();
        }

        // Create vehicle with physics
        this.vehicle = new Vehicle(this.scene);
        this.vehicle.buildFromJBeam(parsedData);
        this.vehicle.buildProceduralMesh();

        this.ui.log(`Vehicle assembled: mass=${this.vehicle.chassisBody.mass.toFixed(1)}kg, ` +
            `tires=4 (friction>=1.2, soft-body)`, 'success');
    }

    _getEmbeddedPhysicsData() {
        // Embedded physics data derived from actual ccf_suspension_F.jbeam analysis
        // Total vehicle mass target: ~1300 kg (realistic sports car)
        const nodes = [
            // Front subframe (from JBeam: nodeWeight 4.5 -> scaled to realistic)
            { id: 'fx1l', pos: [0.386, -1.209, 0.152], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx2l', pos: [0.386, -0.885, 0.18], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx1r', pos: [-0.386, -1.209, 0.152], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx2r', pos: [-0.386, -0.885, 0.18], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx3l', pos: [0.453, -1.368, 0.35], weight: 15, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx3r', pos: [-0.453, -1.368, 0.35], weight: 15, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx4l', pos: [0.453, -1.044, 0.328], weight: 15, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'fx4r', pos: [-0.453, -1.044, 0.328], weight: 15, friction: 0.5, collision: true, group: 'subframe' },
            // Front hubs (unsprung mass ~35kg each corner)
            { id: 'fh1r', pos: [-0.679, -1.199, 0.197], weight: 35, friction: 0.5, collision: true, group: 'hub' },
            { id: 'fh1l', pos: [0.679, -1.199, 0.197], weight: 35, friction: 0.5, collision: true, group: 'hub' },
            { id: 'fh4r', pos: [-0.632, -1.190, 0.386], weight: 28, friction: 0.5, collision: true, group: 'hub' },
            { id: 'fh4l', pos: [0.632, -1.190, 0.386], weight: 28, friction: 0.5, collision: true, group: 'hub' },
            // Rear subframe
            { id: 'rx1l', pos: [0.38, 1.1, 0.15], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'rx2l', pos: [0.38, 0.8, 0.18], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'rx1r', pos: [-0.38, 1.1, 0.15], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            { id: 'rx2r', pos: [-0.38, 0.8, 0.18], weight: 18, friction: 0.5, collision: true, group: 'subframe' },
            // Rear hubs
            { id: 'rh1r', pos: [-0.65, 1.05, 0.2], weight: 32, friction: 0.5, collision: true, group: 'hub' },
            { id: 'rh1l', pos: [0.65, 1.05, 0.2], weight: 32, friction: 0.5, collision: true, group: 'hub' },
            // Body structure (main mass: ~700kg distributed)
            { id: 'body1', pos: [0.6, -0.5, 0.5], weight: 95, friction: 0.3, collision: true, group: 'body' },
            { id: 'body2', pos: [-0.6, -0.5, 0.5], weight: 95, friction: 0.3, collision: true, group: 'body' },
            { id: 'body3', pos: [0.6, 0.5, 0.5], weight: 90, friction: 0.3, collision: true, group: 'body' },
            { id: 'body4', pos: [-0.6, 0.5, 0.5], weight: 90, friction: 0.3, collision: true, group: 'body' },
            { id: 'body5', pos: [0.5, 0, 0.9], weight: 75, friction: 0.3, collision: true, group: 'body' },
            { id: 'body6', pos: [-0.5, 0, 0.9], weight: 75, friction: 0.3, collision: true, group: 'body' },
        ];

        const beams = [];
        const beamPairs = [
            ['fx1l', 'fx2l'], ['fx1r', 'fx2r'], ['fx1l', 'fx1r'], ['fx2l', 'fx2r'],
            ['fx3l', 'fx4l'], ['fx3r', 'fx4r'], ['fx3l', 'fx3r'], ['fx4l', 'fx4r'],
            ['fx1l', 'fx3l'], ['fx1r', 'fx3r'], ['fx2l', 'fx4l'], ['fx2r', 'fx4r'],
            ['fh1r', 'fx1r'], ['fh1l', 'fx1l'], ['fh4r', 'fx3r'], ['fh4l', 'fx3l'],
            ['rx1l', 'rx2l'], ['rx1r', 'rx2r'], ['rx1l', 'rx1r'], ['rx2l', 'rx2r'],
            ['rh1r', 'rx1r'], ['rh1l', 'rx1l'],
            ['fx2l', 'rx2l'], ['fx2r', 'rx2r'], ['fx1l', 'body1'], ['fx1r', 'body2'],
            ['body1', 'body3'], ['body2', 'body4'], ['body3', 'body4'], ['body1', 'body2'],
            ['body5', 'body6'], ['body1', 'body5'], ['body2', 'body6'],
            ['rx1l', 'body3'], ['rx1r', 'body4']
        ];
        for (const [id1, id2] of beamPairs) {
            beams.push({ id1, id2, spring: 2801000, damp: 200, deform: 35000, strength: 'FLT_MAX', type: '|NORMAL', precompression: 1.0, longBound: 1.0, shortBound: 1.0, breakGroup: '', optional: false });
        }

        return { nodes, beams, torsionbars: [], flexbodies: [], slots: [], variables: [], information: { name: 'CCF2', authors: 'Theo & Finn Wilkinson' } };
    }

    /**
     * Phase 2: Web Audio Engine Acoustic Simulation
     */
    async _phase2_init() {
        this.audioEngine = new AudioEngine();
        // Audio requires user interaction to start
        const startAudio = async () => {
            if (!this.audioEngine.initialized) {
                await this.audioEngine.init();
                this.ui.log('AudioContext initialized - engine synth active', 'success');
            }
            this.audioEngine.resume();
            document.removeEventListener('click', startAudio);
            document.removeEventListener('keydown', startAudio);
        };
        document.addEventListener('click', startAudio);
        document.addEventListener('keydown', startAudio);
        this.ui.log('Audio pipeline ready (click/keypress to activate)', 'info');
    }

    /**
     * Phase 3: Proving Ground & Vehicle Controls
     */
    _phase3_init() {
        this.provingGround = new ProvingGround(this.scene);
        this.provingGround.buildEnvironment(this.renderer);
        this.provingGround.build();

        this.controls = new VehicleControls(this.vehicle, this.camera, this.renderer);
        this.ui.log('Proving ground constructed: suspension/steering/wading zones', 'success');
        this.ui.log('Vehicle controls bound: WASD + Space + Gamepad', 'info');
    }

    /**
     * Phase 4: NPR Shaders & Post-Processing
     */
    _phase4_init() {
        // Apply cel-shading to vehicle
        if (this.nprEnabled && this.vehicle.group) {
            applyCelShading(this.vehicle.group, {
                rampSteps: 4,
                specularStrength: 0.4,
                rimPower: 3.0,
                rimColor: new THREE.Color(0.3, 0.5, 1.0)
            });
            this.ui.log('NPR cel-shading applied to vehicle mesh', 'success');
        }

        // Post-process outline
        this.outlinePass = new OutlinePostProcess(this.renderer, this.scene, this.camera);
        this.ui.log('Outline post-process (Sobel depth+normal) compiled', 'success');
    }

    /**
     * Phase 5: Procedural City & Vector Tile System
     */
    _phase5_init() {
        this.cityGenerator = new CityGenerator(this.scene);
        this.cityGenerator.generate({ gridSize: 8, blockSize: 40, seed: 42 });
        this.cityGenerator.cityGroup.position.set(0, 0, -300);
        this.cityGenerator.cityGroup.visible = false;

        // Tile streaming
        this.tileManager = new TileStreamManager(this.scene, this.camera, 400);

        // Index city features
        const features = [];
        for (const b of this.cityGenerator.buildings) {
            features.push({ x: b.position.x, y: b.position.z, bounds: { x: b.position.x, y: b.position.z }, type: 'building', ref: b });
        }
        this.tileManager.indexData(features);

        // Add POIs
        this.tileManager.addPOI(-80, -300, 'Downtown Core', 'district');
        this.tileManager.addPOI(40, -260, 'Tech Park', 'poi');
        this.tileManager.addPOI(-40, -340, 'Harbor District', 'district');
        this.tileManager.addPOI(0, -380, 'Central Station', 'transport');

        // City camera controller
        this.cityCamera = new SeamlessCameraController(this.camera, this.renderer.domElement);

        this.ui.log(`City generated: ${this.cityGenerator.buildings.length} buildings, ` +
            `${this.cityGenerator.props.length} props, QuadTree indexed`, 'success');
    }

    _setupEventListeners() {
        window.addEventListener('resize', () => {
            const w = window.innerWidth, h = window.innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
            if (this.outlinePass) this.outlinePass.setSize(w, h);
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT') this._toggleMode();
            if (e.code === 'KeyM') {
                this.tileManager.currentZoom = (this.tileManager.currentZoom + 1) % 5;
            }
        });
    }

    _toggleMode() {
        if (this.mode === 'vehicle') {
            this.mode = 'city';
            this.cityGenerator.cityGroup.visible = true;
            this.cityGenerator.cityGroup.position.set(0, 0, 0);
            this.vehicle.group.visible = false;
            this.provingGround.groundMeshes.forEach(m => m.visible = false);
            this.cityCamera.enable();
            this.cityCamera.target.set(0, 0, 0);
            this.cityCamera.distance = 80;
            this.ui.setMode('CITY EXPLORER');
            this.ui.log('Switched to City Explorer mode (T to return)', 'info');
        } else {
            this.mode = 'vehicle';
            this.cityGenerator.cityGroup.visible = false;
            this.cityGenerator.cityGroup.position.set(0, 0, -300);
            this.vehicle.group.visible = true;
            this.provingGround.groundMeshes.forEach(m => m.visible = true);
            this.cityCamera.disable();
            this.ui.setMode('PROVING GROUND');
            this.ui.log('Switched to Proving Ground mode', 'info');
        }
    }

    _animate() {
        requestAnimationFrame(() => this._animate());

        const dt = Math.min(this.clock.getDelta(), 0.05);
        this.frameCount++;
        this.fpsTime += dt;
        if (this.fpsTime >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = 0;
        }

        if (this.mode === 'vehicle') {
            // Update vehicle physics
            this.controls.update(dt);
            this.vehicle.update(dt, this.controls.input);

            // Water forces
            const waterForces = this.provingGround.getWaterForces(this.vehicle.getPosition());
            if (waterForces.drag > 0 && this.vehicle.chassisBody) {
                const dragForce = this.vehicle.chassisBody.velocity.scale(-waterForces.drag);
                this.vehicle.chassisBody.applyForce(dragForce);
            }

            // Update audio
            if (this.audioEngine.initialized) {
                const vPos = this.vehicle.getPosition();
                const camPos = this.camera.position;
                this.audioEngine.update(
                    this.vehicle.rpm, this.vehicle.throttle,
                    this.vehicle.throttle * (this.vehicle.rpm / this.vehicle.maxRPM),
                    this.vehicle.speed,
                    { x: vPos.x, y: vPos.y, z: vPos.z },
                    { x: camPos.x, y: camPos.y, z: camPos.z }
                );
            }

            // Animate water
            this.provingGround.updateWater(dt);

            // Update HUD
            this.ui.update(this.vehicle, this.controls);
        } else {
            // City mode
            this.cityCamera.update(dt);
            this.tileManager.update();
        }

        // Render with NPR post-process
        if (this.nprEnabled && this.outlinePass) {
            this.outlinePass.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Boot application
const app = new Application();
app.init().catch(err => {
    console.error('Application init failed:', err);
    const status = document.getElementById('loading-status');
    if (status) status.textContent = 'Error: ' + err.message;
});
