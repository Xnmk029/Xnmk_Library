/**
 * Vehicle Assembly - Phase 1 Task 1.3
 * Binds 3D mesh model onto physics node tree, aligns mounting/steering pivot points
 */
import * as THREE from 'three';
import { PhysicsNode, PhysicsBeam, RigidBodyChassis, SoftBodyTire, PhysicsWorld, Vec3 } from './physics.js';
import { JBeamParser } from './jbeam-parser.js';

export class Vehicle {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.physicsWorld = new PhysicsWorld(-9.81);
        this.chassisBody = null;
        this.tires = { FL: null, FR: null, RL: null, RR: null };
        this.meshes = {};
        this.wheelMeshes = { FL: null, FR: null, RL: null, RR: null };

        // Vehicle state
        this.speed = 0;
        this.rpm = 800;
        this.gear = 0; // 0=N, 1-6 forward, -1 reverse
        this.throttle = 0;
        this.brake = 0;
        this.handbrake = 0;
        this.steer = 0;
        this.engineOn = true;

        // Drivetrain params (2.0L turbo, ~1300kg car)
        this.gearRatios = [-3.2, 0, 3.6, 2.4, 1.7, 1.3, 1.0, 0.8];
        this.finalDrive = 3.7;
        this.engineInertia = 0.25;
        this.maxRPM = 7500;
        this.idleRPM = 800;
        this.engineTorqueCurve = this._buildTorqueCurve();
        this.vehicleMass = 1300; // kg reference for force calculations

        // Suspension telemetry
        this.suspensionTravel = { FL: 0, FR: 0, RL: 0, RR: 0 };
        this.suspensionDamping = { FL: 0, FR: 0, RL: 0, RR: 0 };

        // Wheel positions (from JBeam data)
        this.wheelBase = 2.4;
        this.trackWidth = 1.36;
        this.wheelRadius = 0.31;
        this.wheelWidth = 0.22;
    }

    _buildTorqueCurve() {
        // Torque (Nm) at various RPM points for a 2.0L turbo 4-cylinder
        return [
            { rpm: 800, torque: 120 },
            { rpm: 1500, torque: 200 },
            { rpm: 2000, torque: 280 },
            { rpm: 2500, torque: 340 },
            { rpm: 3000, torque: 380 },
            { rpm: 3500, torque: 400 },
            { rpm: 4000, torque: 410 },
            { rpm: 4500, torque: 405 },
            { rpm: 5000, torque: 390 },
            { rpm: 5500, torque: 370 },
            { rpm: 6000, torque: 340 },
            { rpm: 6500, torque: 300 },
            { rpm: 7000, torque: 250 },
            { rpm: 7500, torque: 180 }
        ];
    }

    getTorqueAtRPM(rpm) {
        const curve = this.engineTorqueCurve;
        if (rpm <= curve[0].rpm) return curve[0].torque;
        if (rpm >= curve[curve.length - 1].rpm) return curve[curve.length - 1].torque;
        for (let i = 0; i < curve.length - 1; i++) {
            if (rpm >= curve[i].rpm && rpm <= curve[i + 1].rpm) {
                const t = (rpm - curve[i].rpm) / (curve[i + 1].rpm - curve[i].rpm);
                return curve[i].torque + t * (curve[i + 1].torque - curve[i].torque);
            }
        }
        return 200;
    }

    /**
     * Build vehicle from parsed JBeam data
     */
    buildFromJBeam(parsedData) {
        // Create chassis rigid body from nodes/beams
        const chassisNodes = [];
        const nodeMap = new Map();

        // Scale factor: JBeam nodeWeight ~4.5 per node, real car ~1300kg total
        // With ~24 nodes, scale = 1300 / (24 * avg_weight)
        const totalRawMass = parsedData.nodes.reduce((s, n) => s + (n.weight || 5), 0);
        const massScale = totalRawMass > 0 ? 1300 / totalRawMass : 1;

        for (const nd of parsedData.nodes) {
            const scaledWeight = (nd.weight || 5) * massScale;
            const pNode = new PhysicsNode(nd.id, nd.pos, scaledWeight, nd.friction);
            pNode.collides = nd.collision;
            pNode.group = Array.isArray(nd.group) ? nd.group.join(',') : String(nd.group);
            chassisNodes.push(pNode);
            nodeMap.set(nd.id, pNode);
        }

        const chassisBeams = [];
        for (const bm of parsedData.beams) {
            const n1 = nodeMap.get(bm.id1);
            const n2 = nodeMap.get(bm.id2);
            if (n1 && n2) {
                const strength = bm.strength === 'FLT_MAX' ? 999999999 : (typeof bm.strength === 'string' ? 999999999 : bm.strength);
                chassisBeams.push(new PhysicsBeam(n1, n2, bm.spring, bm.damp, bm.deform, strength));
            }
        }

        this.chassisBody = new RigidBodyChassis(chassisNodes, chassisBeams);
        this.physicsWorld.setChassis(this.chassisBody);
        this.physicsWorld.addGroundPlane(0);

        // Create tires at wheel positions
        const wheelPositions = {
            FL: [this.trackWidth / 2, this.wheelRadius, -this.wheelBase / 2],
            FR: [-this.trackWidth / 2, this.wheelRadius, -this.wheelBase / 2],
            RL: [this.trackWidth / 2, this.wheelRadius, this.wheelBase / 2],
            RR: [-this.trackWidth / 2, this.wheelRadius, this.wheelBase / 2]
        };

        for (const [key, pos] of Object.entries(wheelPositions)) {
            const tire = new SoftBodyTire(pos, this.wheelRadius, this.wheelWidth, 12);
            tire.springRate = 45000;  // N/m per corner (sport suspension)
            tire.dampRate = 6000;     // N*s/m
            tire.maxSuspensionTravel = 0.10; // 100mm travel
            this.tires[key] = tire;
            this.physicsWorld.addTire(tire);
        }

        return this;
    }

    /**
     * Build procedural vehicle mesh (used when DAE loading isn't available)
     */
    buildProceduralMesh() {
        // Main body
        const bodyGeo = new THREE.BoxGeometry(1.7, 0.5, 4.2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.6, roughness: 0.3 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 0.45, 0);
        bodyMesh.castShadow = true;
        this.group.add(bodyMesh);
        this.meshes.body = bodyMesh;

        // Cabin
        const cabinGeo = new THREE.BoxGeometry(1.4, 0.45, 2.0);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.7 });
        const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
        cabinMesh.position.set(0, 0.85, 0.2);
        cabinMesh.castShadow = true;
        this.group.add(cabinMesh);

        // Hood slope
        const hoodGeo = new THREE.BoxGeometry(1.6, 0.15, 1.2);
        const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
        hoodMesh.position.set(0, 0.65, -1.3);
        hoodMesh.rotation.x = -0.08;
        this.group.add(hoodMesh);

        // Trunk
        const trunkGeo = new THREE.BoxGeometry(1.5, 0.2, 0.8);
        const trunkMesh = new THREE.Mesh(trunkGeo, bodyMat);
        trunkMesh.position.set(0, 0.6, 1.7);
        this.group.add(trunkMesh);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(this.wheelRadius, this.wheelRadius, this.wheelWidth, 24);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.1, roughness: 0.9 });
        const rimGeo = new THREE.CylinderGeometry(this.wheelRadius * 0.6, this.wheelRadius * 0.6, this.wheelWidth + 0.01, 12);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });

        const wheelPositions = {
            FL: [this.trackWidth / 2, this.wheelRadius, -this.wheelBase / 2],
            FR: [-this.trackWidth / 2, this.wheelRadius, -this.wheelBase / 2],
            RL: [this.trackWidth / 2, this.wheelRadius, this.wheelBase / 2],
            RR: [-this.trackWidth / 2, this.wheelRadius, this.wheelBase / 2]
        };

        for (const [key, pos] of Object.entries(wheelPositions)) {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeo, wheelMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.z = Math.PI / 2;
            wheelGroup.add(tire);
            wheelGroup.add(rim);
            wheelGroup.position.set(pos[0], pos[1], pos[2]);
            this.group.add(wheelGroup);
            this.wheelMeshes[key] = wheelGroup;
        }

        // Headlights
        const hlGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 0.5 });
        const hlL = new THREE.Mesh(hlGeo, hlMat);
        hlL.position.set(0.55, 0.45, -2.1);
        const hlR = new THREE.Mesh(hlGeo, hlMat);
        hlR.position.set(-0.55, 0.45, -2.1);
        this.group.add(hlL, hlR);

        // Tail lights
        const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
        const tlL = new THREE.Mesh(hlGeo, tlMat);
        tlL.position.set(0.6, 0.5, 2.1);
        const tlR = new THREE.Mesh(hlGeo, tlMat);
        tlR.position.set(-0.6, 0.5, 2.1);
        this.group.add(tlL, tlR);

        this.group.position.set(0, 0.5, 0);
        return this;
    }

    /**
     * Update vehicle physics and visuals
     */
    update(dt, input) {
        this.throttle = input.throttle;
        this.brake = input.brake;
        this.handbrake = input.handbrake;
        this.steer += (input.steer - this.steer) * Math.min(dt * 8, 1);

        // Engine simulation
        this._updateEngine(dt);

        // Drivetrain
        const driveTorque = this._computeDriveTorque();

        // Update tire physics
        const steerAngle = this.steer * 0.5;
        for (const [key, tire] of Object.entries(this.tires)) {
            const isFront = key.startsWith('F');
            const isDrive = true; // AWD
            const torque = isDrive ? driveTorque * 0.25 : 0;
            const brakeT = this.brake * 3000 + (this.handbrake && !isFront ? 4000 : 0);
            const steer = isFront ? steerAngle : 0;
            const groundH = 0;
            tire.update(dt, groundH, this.chassisBody ? this.chassisBody.velocity : new Vec3(), steer, torque, brakeT);
            this.suspensionTravel[key] = tire.suspensionTravel * 1000; // mm
        }

        // Update chassis physics
        if (this.chassisBody) {
            // Apply drive forces (scaled for realistic acceleration)
            const forward = this.chassisBody.getForwardDir();
            const totalTraction = driveTorque / this.wheelRadius;
            // Apply force to all chassis nodes evenly
            const forcePerNode = totalTraction * 0.008 / Math.max(this.chassisBody.nodes.length, 1);
            for (const node of this.chassisBody.nodes) {
                node.applyForce(forward.scale(forcePerNode));
            }

            // Steering force (speed-sensitive, applied to front nodes)
            const steerF = this.steer * this.speed * 0.1;
            for (const node of this.chassisBody.nodes) {
                if (node.pos.z < 0) { // front nodes
                    node.applyForce(new Vec3(steerF, 0, 0));
                }
            }

            // Braking (realistic deceleration)
            if (this.brake > 0 || this.handbrake > 0) {
                const brakeDecel = this.brake * 12 + this.handbrake * 8;
                for (const node of this.chassisBody.nodes) {
                    const bf = node.vel.normalize().scale(-brakeDecel * node.mass * 0.05);
                    node.applyForce(bf);
                }
            }

            // Aerodynamic drag + rolling resistance
            for (const node of this.chassisBody.nodes) {
                const speed = node.vel.length();
                const dragF = node.vel.scale(-0.3 * speed * 0.01);
                const rollF = node.vel.scale(-8 * 0.01);
                node.applyForce(dragF.add(rollF));
            }

            this.physicsWorld.step(dt);

            // Update chassis velocity from COM
            const newCom = this.chassisBody._computeCOM();
            const comDelta = newCom.sub(this.chassisBody.position);
            this.chassisBody.velocity = comDelta.scale(1 / Math.max(dt, 0.001));
            this.chassisBody.position = newCom;

            const rawSpeed = this.chassisBody.velocity.length();
            this.speed = isNaN(rawSpeed) ? 0 : rawSpeed * 3.6; // km/h

            // Update visual group
            this.group.position.set(
                this.chassisBody.position.x,
                Math.max(this.chassisBody.position.y, 0.3),
                this.chassisBody.position.z
            );
        }

        // Update wheel visuals
        this._updateWheelVisuals(dt);
    }

    _updateEngine(dt) {
        if (!this.engineOn) { this.rpm = 0; return; }

        const gearRatio = this.gearRatios[this.gear + 1] || 1;
        const targetRPM = this.gear === 0 ?
            this.idleRPM + this.throttle * 2000 :
            Math.abs(this.speed / 3.6) / this.wheelRadius *
            gearRatio * this.finalDrive * 60 / (2 * Math.PI);

        const clampedTarget = Math.max(this.idleRPM, Math.min(isNaN(targetRPM) ? this.idleRPM : targetRPM, this.maxRPM));
        this.rpm += (clampedTarget - this.rpm) * Math.min(dt * (this.throttle > 0 ? 6 : 3), 1);
        this.rpm = Math.max(this.idleRPM, Math.min(this.rpm, this.maxRPM));
        if (isNaN(this.rpm)) this.rpm = this.idleRPM;

        // Auto transmission
        if (this.gear > 0) {
            if (this.rpm > 6800 && this.gear < 6) this.gear++;
            else if (this.rpm < 2000 && this.gear > 1) this.gear--;
        }
    }

    _computeDriveTorque() {
        if (this.gear === 0) return 0;
        const engineTorque = this.getTorqueAtRPM(this.rpm) * this.throttle;
        const gearRatio = this.gearRatios[this.gear + 1] || 1;
        return engineTorque * gearRatio * this.finalDrive;
    }

    _updateWheelVisuals(dt) {
        const rotSpeed = this.speed / 3.6 / this.wheelRadius;
        for (const [key, mesh] of Object.entries(this.wheelMeshes)) {
            if (!mesh) continue;
            mesh.children[0].rotation.x += rotSpeed * dt;
            mesh.children[1].rotation.x += rotSpeed * dt;
            if (key.startsWith('F')) {
                mesh.rotation.y = this.steer * 0.5;
            }
            // Suspension visual
            const travel = this.suspensionTravel[key] / 1000;
            mesh.position.y = this.wheelRadius - travel * 0.5;
        }
    }

    getPosition() {
        return this.group.position.clone();
    }

    getHeading() {
        return this.chassisBody ? this.chassisBody.orientation.y : 0;
    }

    reset(pos) {
        if (this.chassisBody) {
            this.chassisBody.position = new Vec3(pos.x, pos.y, pos.z);
            this.chassisBody.velocity = new Vec3();
            this.chassisBody.angularVel = new Vec3();
        }
        this.speed = 0;
        this.rpm = this.idleRPM;
        this.gear = 0;
        this.group.position.set(pos.x, pos.y, pos.z);
    }
}
