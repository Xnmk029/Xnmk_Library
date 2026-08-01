/**
 * Vehicle Controls - Phase 3 Task 3.3
 * Keyboard/Gamepad input, camera control, telemetry streaming
 */
import * as THREE from 'three';

export class VehicleControls {
    constructor(vehicle, camera, renderer) {
        this.vehicle = vehicle;
        this.camera = camera;
        this.renderer = renderer;

        // Input state
        this.keys = {};
        this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
        this.gamepadIndex = null;

        // Camera modes
        this.cameraMode = 0; // 0=chase, 1=hood, 2=orbit, 3=top
        this.cameraModes = ['chase', 'hood', 'orbit', 'top'];
        this.orbitAngle = 0;
        this.orbitPitch = 0.3;
        this.orbitDist = 12;
        this.cameraSmooth = new THREE.Vector3();
        this.lookTarget = new THREE.Vector3();

        // Telemetry buffer
        this.telemetryBuffer = [];
        this.telemetryInterval = 0;
        this.telemetryRate = 0.05; // 20Hz sampling

        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyC') this.cameraMode = (this.cameraMode + 1) % this.cameraModes.length;
            if (e.code === 'KeyR') this.vehicle.reset({ x: 0, y: 0.5, z: 0 });
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        // Gamepad polling
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepadIndex = e.gamepad.index;
            console.log('Gamepad connected:', e.gamepad.id);
        });
        window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
    }

    update(dt) {
        this._pollInput(dt);
        this._updateCamera(dt);
        this._sampleTelemetry(dt);
    }

    _pollInput(dt) {
        // Keyboard input
        let throttle = 0, brake = 0, steer = 0, handbrake = 0;

        if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) brake = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer = 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) steer = -1;
        if (this.keys['Space']) handbrake = 1;

        // Gamepad input
        if (this.gamepadIndex !== null) {
            const gp = navigator.getGamepads()[this.gamepadIndex];
            if (gp) {
                const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
                const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
                const lx = gp.axes[0] || 0;
                if (rt > 0.05) throttle = rt;
                if (lt > 0.05) brake = lt;
                if (Math.abs(lx) > 0.1) steer = -lx;
                if (gp.buttons[0] && gp.buttons[0].pressed) handbrake = 1;
            }
        }

        // Smooth steering
        this.input.throttle = throttle;
        this.input.brake = brake;
        this.input.handbrake = handbrake;
        this.input.steer += (steer - this.input.steer) * Math.min(dt * 5, 1);

        // Gear control
        if (this.keys['KeyW'] && this.vehicle.gear === 0) this.vehicle.gear = 1;
        if (this.keys['KeyS'] && this.vehicle.gear === 0) this.vehicle.gear = -1;
        if (this.keys['KeyN']) this.vehicle.gear = 0;
    }

    _updateCamera(dt) {
        const vPos = this.vehicle.getPosition();
        const speed = this.vehicle.speed;
        const heading = this.vehicle.getHeading();

        switch (this.cameraModes[this.cameraMode]) {
            case 'chase': {
                const dist = 8 + speed * 0.02;
                const height = 3 + speed * 0.005;
                const targetX = vPos.x + Math.sin(heading) * dist;
                const targetZ = vPos.z + Math.cos(heading) * dist;
                const targetY = vPos.y + height;
                this.cameraSmooth.lerp(new THREE.Vector3(targetX, targetY, targetZ), dt * 3);
                this.camera.position.copy(this.cameraSmooth);
                this.lookTarget.lerp(new THREE.Vector3(vPos.x, vPos.y + 1, vPos.z), dt * 5);
                this.camera.lookAt(this.lookTarget);
                break;
            }
            case 'hood': {
                const offsetX = Math.sin(heading) * -0.5;
                const offsetZ = Math.cos(heading) * -0.5;
                this.camera.position.set(vPos.x + offsetX, vPos.y + 1.2, vPos.z + offsetZ);
                this.camera.lookAt(vPos.x + Math.sin(heading) * -10, vPos.y + 0.8, vPos.z + Math.cos(heading) * -10);
                break;
            }
            case 'orbit': {
                this.orbitAngle += dt * 0.3;
                const ox = vPos.x + Math.cos(this.orbitAngle) * this.orbitDist;
                const oz = vPos.z + Math.sin(this.orbitAngle) * this.orbitDist;
                const oy = vPos.y + this.orbitDist * this.orbitPitch + 2;
                this.cameraSmooth.lerp(new THREE.Vector3(ox, oy, oz), dt * 4);
                this.camera.position.copy(this.cameraSmooth);
                this.camera.lookAt(vPos.x, vPos.y + 0.5, vPos.z);
                break;
            }
            case 'top': {
                this.camera.position.set(vPos.x, vPos.y + 30, vPos.z + 0.1);
                this.camera.lookAt(vPos.x, vPos.y, vPos.z);
                break;
            }
        }
    }

    _sampleTelemetry(dt) {
        this.telemetryInterval += dt;
        if (this.telemetryInterval >= this.telemetryRate) {
            this.telemetryInterval = 0;
            const sample = {
                time: performance.now() / 1000,
                speed: this.vehicle.speed,
                rpm: this.vehicle.rpm,
                gear: this.vehicle.gear,
                throttle: this.input.throttle,
                brake: this.input.brake,
                steer: this.input.steer,
                suspension: { ...this.vehicle.suspensionTravel },
                position: {
                    x: this.vehicle.getPosition().x,
                    y: this.vehicle.getPosition().y,
                    z: this.vehicle.getPosition().z
                }
            };
            this.telemetryBuffer.push(sample);
            if (this.telemetryBuffer.length > 1000) this.telemetryBuffer.shift();
        }
    }

    getTelemetry() {
        return this.telemetryBuffer;
    }

    getLatestSample() {
        return this.telemetryBuffer.length > 0 ? this.telemetryBuffer[this.telemetryBuffer.length - 1] : null;
    }

    dispose() {
        window.removeEventListener('keydown', this._bindEvents);
        window.removeEventListener('keyup', this._bindEvents);
    }
}
