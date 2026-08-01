/**
 * Web Audio Engine Acoustic Simulation - Phase 2
 * Tasks 2.1, 2.2, 2.3: Engine sound synthesis, parameter integration, 3D spatial audio
 */
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.engineNodes = {};
        this.spatialPanner = null;
        this.initialized = false;
        this.running = false;

        // Engine acoustic parameters (4-cylinder inline, turbo)
        this.cylinders = 4;
        this.firingOrder = [1, 3, 4, 2];
        this.exhaustManifoldLength = 0.45; // meters
        this.boreStroke = { bore: 0.086, stroke: 0.086 };
        this.idleRPM = 800;
        this.maxRPM = 7500;

        // Synth state
        this.currentRPM = 800;
        this.throttle = 0;
        this.load = 0;
    }

    /**
     * Initialize Web Audio API context and build audio graph
     */
    async init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') await this.ctx.resume();

            // Master bus
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.6;
            this.masterGain.connect(this.ctx.destination);

            // 3D Spatial panner (Task 2.3)
            this.spatialPanner = this.ctx.createPanner();
            this.spatialPanner.panningModel = 'HRTF';
            this.spatialPanner.distanceModel = 'inverse';
            this.spatialPanner.refDistance = 2;
            this.spatialPanner.maxDistance = 50;
            this.spatialPanner.rolloffFactor = 1.2;
            this.spatialPanner.connect(this.masterGain);

            // Engine sound bus
            this._buildEngineSynth();

            // Environment ambience
            this._buildEnvironmentBus();

            this.initialized = true;
            return true;
        } catch (e) {
            console.warn('Audio init failed:', e);
            return false;
        }
    }

    /**
     * Task 2.2: Build engine acoustic synthesizer
     * Synthesizes engine sound based on cylinder count, firing order, exhaust manifold, gear ratios
     */
    _buildEngineSynth() {
        const engineBus = this.ctx.createGain();
        engineBus.gain.value = 0.5;
        engineBus.connect(this.spatialPanner);

        // Primary firing pulse oscillator (fundamental frequency = RPM/60 * cylinders/2 for 4-stroke)
        const firingOsc = this.ctx.createOscillator();
        firingOsc.type = 'sawtooth';
        firingOsc.frequency.value = this._rpmToFiringFreq(this.idleRPM);
        const firingGain = this.ctx.createGain();
        firingGain.gain.value = 0.3;
        firingOsc.connect(firingGain);

        // Exhaust resonance (based on manifold length)
        const exhaustResFreq = 343 / (4 * this.exhaustManifoldLength); // quarter-wave resonance
        const exhaustFilter = this.ctx.createBiquadFilter();
        exhaustFilter.type = 'bandpass';
        exhaustFilter.frequency.value = exhaustResFreq;
        exhaustFilter.Q.value = 3.0;
        firingGain.connect(exhaustFilter);

        // Second harmonic (V-engine character)
        const harmonicOsc = this.ctx.createOscillator();
        harmonicOsc.type = 'square';
        harmonicOsc.frequency.value = this._rpmToFiringFreq(this.idleRPM) * 2;
        const harmonicGain = this.ctx.createGain();
        harmonicGain.gain.value = 0.12;
        harmonicOsc.connect(harmonicGain);

        // Intake noise (turbo whistle)
        const turboOsc = this.ctx.createOscillator();
        turboOsc.type = 'sine';
        turboOsc.frequency.value = 800;
        const turboGain = this.ctx.createGain();
        turboGain.gain.value = 0.0;
        const turboFilter = this.ctx.createBiquadFilter();
        turboFilter.type = 'highpass';
        turboFilter.frequency.value = 2000;
        turboOsc.connect(turboFilter);
        turboFilter.connect(turboGain);

        // Low-pass for exhaust rumble
        const exhaustLP = this.ctx.createBiquadFilter();
        exhaustLP.type = 'lowpass';
        exhaustLP.frequency.value = 400;
        exhaustLP.Q.value = 1.0;

        // Sub-bass rumble oscillator
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.value = 30;
        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.15;
        subOsc.connect(subGain);

        // Distortion waveshaper for exhaust crackle
        const waveshaper = this.ctx.createWaveShaper();
        waveshaper.curve = this._makeDistortionCurve(50);
        waveshaper.oversample = '4x';

        // Connect graph
        exhaustFilter.connect(waveshaper);
        waveshaper.connect(exhaustLP);
        exhaustLP.connect(engineBus);
        harmonicGain.connect(engineBus);
        turboGain.connect(engineBus);
        subGain.connect(engineBus);

        // Start oscillators
        firingOsc.start();
        harmonicOsc.start();
        turboOsc.start();
        subOsc.start();

        this.engineNodes = {
            firingOsc, firingGain, harmonicOsc, harmonicGain,
            turboOsc, turboGain, turboFilter,
            exhaustFilter, exhaustLP, subOsc, subGain,
            waveshaper, engineBus
        };
    }

    /**
     * Task 2.3: Environment ambience bus with spatial audio
     */
    _buildEnvironmentBus() {
        // Wind noise (filtered white noise)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = noiseBuffer;
        this.windSource.loop = true;

        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 400;
        windFilter.Q.value = 0.5;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.02;

        this.windSource.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.masterGain);
        this.windSource.start();

        // Tire noise
        this.tireSource = this.ctx.createBufferSource();
        this.tireSource.buffer = noiseBuffer;
        this.tireSource.loop = true;

        const tireFilter = this.ctx.createBiquadFilter();
        tireFilter.type = 'lowpass';
        tireFilter.frequency.value = 800;

        this.tireGain = this.ctx.createGain();
        this.tireGain.gain.value = 0.0;

        this.tireSource.connect(tireFilter);
        tireFilter.connect(this.tireGain);
        this.tireGain.connect(this.spatialPanner);
        this.tireSource.start();
    }

    /**
     * Update engine sound based on RPM, throttle, load (called every frame)
     */
    update(rpm, throttle, load, speed, vehiclePos, listenerPos) {
        if (!this.initialized || !this.ctx) return;

        this.currentRPM = rpm;
        this.throttle = throttle;
        this.load = load;

        const t = this.ctx.currentTime;
        const firingFreq = this._rpmToFiringFreq(rpm);

        // Update firing frequency
        this.engineNodes.firingOsc.frequency.setTargetAtTime(firingFreq, t, 0.02);
        this.engineNodes.harmonicOsc.frequency.setTargetAtTime(firingFreq * 2, t, 0.02);
        this.engineNodes.subOsc.frequency.setTargetAtTime(firingFreq * 0.25, t, 0.03);

        // Throttle affects volume and brightness
        const vol = 0.15 + throttle * 0.4 + (rpm / this.maxRPM) * 0.2;
        this.engineNodes.firingGain.gain.setTargetAtTime(vol * 0.4, t, 0.05);
        this.engineNodes.harmonicGain.gain.setTargetAtTime(vol * 0.15, t, 0.05);
        this.engineNodes.subGain.gain.setTargetAtTime(0.1 + throttle * 0.15, t, 0.05);

        // Exhaust filter opens with RPM
        const exhaustFreq = 200 + (rpm / this.maxRPM) * 2000 + throttle * 500;
        this.engineNodes.exhaustFilter.frequency.setTargetAtTime(exhaustFreq, t, 0.05);
        this.engineNodes.exhaustLP.frequency.setTargetAtTime(300 + (rpm / this.maxRPM) * 3000, t, 0.05);

        // Turbo whistle (spools with throttle and RPM)
        const turboFreq = 1000 + (rpm / this.maxRPM) * 4000 + throttle * 2000;
        this.engineNodes.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.1);
        this.engineNodes.turboGain.gain.setTargetAtTime(throttle * 0.06 * (rpm / this.maxRPM), t, 0.1);

        // Wind noise scales with speed
        const windVol = Math.min(speed / 200, 1) * 0.08;
        this.windGain.gain.setTargetAtTime(windVol, t, 0.1);

        // Tire noise
        const tireVol = Math.min(speed / 100, 1) * 0.05;
        this.tireGain.gain.setTargetAtTime(tireVol, t, 0.1);

        // 3D spatial positioning (Task 2.3)
        if (vehiclePos && this.spatialPanner) {
            this.spatialPanner.positionX.setTargetAtTime(vehiclePos.x, t, 0.05);
            this.spatialPanner.positionY.setTargetAtTime(vehiclePos.y, t, 0.05);
            this.spatialPanner.positionZ.setTargetAtTime(vehiclePos.z, t, 0.05);
        }
        if (listenerPos && this.ctx.listener) {
            const l = this.ctx.listener;
            if (l.positionX) {
                l.positionX.setTargetAtTime(listenerPos.x, t, 0.05);
                l.positionY.setTargetAtTime(listenerPos.y, t, 0.05);
                l.positionZ.setTargetAtTime(listenerPos.z, t, 0.05);
            }
        }
    }

    /**
     * Convert RPM to firing frequency for 4-stroke engine
     * Firing freq = (RPM / 60) * (cylinders / 2)
     */
    _rpmToFiringFreq(rpm) {
        return (rpm / 60) * (this.cylinders / 2);
    }

    _makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
        }
        return curve;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    dispose() {
        if (this.ctx) this.ctx.close();
    }
}
