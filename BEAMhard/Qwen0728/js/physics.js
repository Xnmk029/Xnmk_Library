/**
 * Physics Engine - Phase 1 Task 1.2
 * Custom Web physics solver: Rigid body chassis + Soft body tires
 * Implements node-beam spring-damper network, collision detection, constraint solver
 */

export class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
    sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
    scale(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    normalize() { const l = this.length(); return l > 1e-8 ? this.scale(1 / l) : new Vec3(); }
    clone() { return new Vec3(this.x, this.y, this.z); }
    distTo(v) { return this.sub(v).length(); }
}

export class PhysicsNode {
    constructor(id, pos, mass = 5.0, friction = 0.5) {
        this.id = id;
        this.pos = new Vec3(pos[0], pos[1], pos[2]);
        this.prevPos = this.pos.clone();
        this.vel = new Vec3();
        this.force = new Vec3();
        this.mass = mass;
        this.invMass = mass > 0 ? 1.0 / mass : 0;
        this.friction = friction;
        this.isStatic = mass <= 0;
        this.collides = true;
        this.group = '';
    }

    applyForce(f) { this.force = this.force.add(f); }

    integrate(dt) {
        if (this.isStatic) return;
        const acc = this.force.scale(this.invMass);
        this.vel = this.vel.add(acc.scale(dt));
        this.vel = this.vel.scale(0.998); // air drag
        // Velocity clamping for stability (max 100 m/s)
        const speed = this.vel.length();
        if (speed > 100) this.vel = this.vel.scale(100 / speed);
        this.prevPos = this.pos.clone();
        this.pos = this.pos.add(this.vel.scale(dt));
        this.force = new Vec3();
    }
}

export class PhysicsBeam {
    constructor(node1, node2, spring, damp, deformLimit, strength) {
        this.node1 = node1;
        this.node2 = node2;
        // Clamp spring to stable range for real-time simulation
        // Critical: dt_sub ~ 0.004s, stability requires spring < mass * (2/dt)^2
        this.spring = Math.min(spring, 50000); // cap at 50k for stability
        this.damp = Math.min(damp, 500); // cap damping
        this.deformLimit = deformLimit;
        this.strength = strength;
        this.restLength = node1.pos.distTo(node2.pos);
        this.broken = false;
        this.deformed = false;
        this.currentLength = this.restLength;
    }

    solve() {
        if (this.broken) return;
        const delta = this.node2.pos.sub(this.node1.pos);
        const dist = delta.length();
        if (dist < 1e-8) return;
        this.currentLength = dist;

        const dir = delta.scale(1.0 / dist);
        const relVel = this.node2.vel.sub(this.node1.vel);
        const velAlongBeam = relVel.dot(dir);

        const displacement = dist - this.restLength;
        const springForce = dir.scale(-this.spring * displacement);
        const dampForce = dir.scale(-this.damp * velAlongBeam);
        const totalForce = springForce.add(dampForce);

        this.node1.applyForce(totalForce.scale(-1));
        this.node2.applyForce(totalForce);

        // Deformation/breaking check
        const strain = Math.abs(displacement) / Math.max(this.restLength, 0.01);
        if (strain > 0.3) {
            this.deformed = true;
            this.restLength += displacement * 0.005; // slow plastic deformation
        }
        if (this.strength < 999999998 && Math.abs(displacement * this.spring) > this.strength) {
            this.broken = true;
        }
    }
}

export class PhysicsMaterial {
    constructor(friction = 1.2, restitution = 0.1, rough = true) {
        this.friction = friction;
        this.restitution = restitution;
        this.rough = rough;
    }
}

export class SoftBodyTire {
    constructor(centerPos, radius, width, segments = 16) {
        this.center = new Vec3(centerPos[0], centerPos[1], centerPos[2]);
        this.radius = radius;
        this.width = width;
        this.segments = segments;
        this.nodes = [];
        this.beams = [];
        this.material = new PhysicsMaterial(1.4, 0.05, true); // High friction tire
        this.angularVel = 0;
        this.steerAngle = 0;
        this.suspensionTravel = 0;
        this.maxSuspensionTravel = 0.12;
        this.springRate = 35000;
        this.dampRate = 4500;
        this.grounded = false;
        this.groundNormal = new Vec3(0, 1, 0);
        this.wheelTorque = 0;
        this.brakeTorque = 0;
        this.lateralSlip = 0;
        this.longitudinalSlip = 0;

        this._buildTireMesh();
    }

    _buildTireMesh() {
        const innerR = this.radius * 0.6;
        const outerR = this.radius;
        const halfW = this.width / 2;

        // Create ring of nodes for tire cross-section
        for (let i = 0; i < this.segments; i++) {
            const angle = (i / this.segments) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            // Outer tread nodes
            this.nodes.push(new PhysicsNode(
                `tire_o${i}`,
                [this.center.x + cos * outerR, this.center.y, this.center.z + sin * outerR],
                1.5, this.material.friction
            ));
            // Inner rim nodes
            this.nodes.push(new PhysicsNode(
                `tire_i${i}`,
                [this.center.x + cos * innerR, this.center.y, this.center.z + sin * innerR],
                2.0, 0.3
            ));
        }

        // Connect with beams (spring-damper network)
        for (let i = 0; i < this.segments; i++) {
            const next = (i + 1) % this.segments;
            const oI = i * 2, iI = i * 2 + 1;
            const oN = next * 2, iN = next * 2 + 1;
            // Circumferential beams
            this.beams.push(new PhysicsBeam(this.nodes[oI], this.nodes[oN], 80000, 800, 50000, 999999999));
            this.beams.push(new PhysicsBeam(this.nodes[iI], this.nodes[iN], 120000, 1000, 60000, 999999999));
            // Radial beams (sidewall)
            this.beams.push(new PhysicsBeam(this.nodes[oI], this.nodes[iI], 60000, 600, 40000, 999999999));
            // Cross bracing
            this.beams.push(new PhysicsBeam(this.nodes[oI], this.nodes[iN], 50000, 500, 35000, 999999999));
        }
    }

    update(dt, groundHeight, vehicleVel, steerInput, driveTorque, brakeForce) {
        this.steerAngle = steerInput * 0.5; // max ~28 degrees
        this.wheelTorque = driveTorque;
        this.brakeTorque = brakeForce;

        // Suspension spring-damper
        const tireBottom = this.center.y - this.radius;
        const penetration = groundHeight - tireBottom;

        if (penetration > 0) {
            this.grounded = true;
            this.suspensionTravel = Math.min(penetration, this.maxSuspensionTravel);
            const springForce = this.springRate * this.suspensionTravel;
            const dampForce = this.dampRate * (-vehicleVel.y);
            const totalUp = springForce + dampForce;
            this.center.y += Math.min(penetration, 0.01);
            // Apply tire deformation
            for (const node of this.nodes) {
                if (node.pos.y < groundHeight + 0.01) {
                    node.pos.y = groundHeight + 0.01;
                    node.vel.y *= -this.material.restitution;
                    // Friction
                    node.vel.x *= (1.0 - this.material.friction * dt * 2);
                    node.vel.z *= (1.0 - this.material.friction * dt * 2);
                }
            }
            // Tire force model (simplified Pacejka)
            this.longitudinalSlip = this.angularVel > 0.1 ? (this.angularVel * this.radius - vehicleVel.length()) / Math.max(vehicleVel.length(), 0.1) : 0;
            const mu = this.material.friction;
            const slipRatio = Math.min(Math.abs(this.longitudinalSlip), 1.0);
            const tractionForce = mu * Math.sin(Math.PI * slipRatio * 0.8) * 4000;
            this.angularVel += (this.wheelTorque - this.brakeTorque * Math.sign(this.angularVel) - tractionForce * this.radius) * dt / (this.mass() * this.radius * this.radius * 0.5);
        } else {
            this.grounded = false;
            this.suspensionTravel = 0;
            this.angularVel += this.wheelTorque * dt / (this.mass() * this.radius * this.radius * 0.5);
        }
        this.angularVel *= 0.998; // rolling resistance

        // Update soft body nodes
        for (const node of this.nodes) node.integrate(dt);
        for (let iter = 0; iter < 3; iter++) {
            for (const beam of this.beams) beam.solve();
        }
    }

    mass() { return this.nodes.reduce((s, n) => s + n.mass, 0); }
    getRotation() { return this.angularVel; }
}

export class RigidBodyChassis {
    constructor(nodes, beams) {
        this.nodes = nodes;
        this.beams = beams;
        this.mass = nodes.reduce((s, n) => s + n.mass, 0);
        if (this.mass <= 0) this.mass = 100; // fallback mass
        this.invMass = 1.0 / this.mass;
        this.position = this._computeCOM();
        this.velocity = new Vec3();
        this.orientation = { x: 0, y: 0, z: 0, w: 1 }; // quaternion
        this.angularVel = new Vec3();
        this.inertia = this._computeInertia();
        this.invInertia = new Vec3(
            this.inertia.x > 0 ? 1 / this.inertia.x : 0,
            this.inertia.y > 0 ? 1 / this.inertia.y : 0,
            this.inertia.z > 0 ? 1 / this.inertia.z : 0
        );
    }

    _computeCOM() {
        let cx = 0, cy = 0, cz = 0, totalMass = 0;
        for (const n of this.nodes) {
            cx += n.pos.x * n.mass;
            cy += n.pos.y * n.mass;
            cz += n.pos.z * n.mass;
            totalMass += n.mass;
        }
        if (totalMass <= 0) return new Vec3(0, 0.5, 0);
        return new Vec3(cx / totalMass, cy / totalMass, cz / totalMass);
    }

    _computeInertia() {
        let ix = 0, iy = 0, iz = 0;
        for (const n of this.nodes) {
            const dx = n.pos.x - this.position.x;
            const dy = n.pos.y - this.position.y;
            const dz = n.pos.z - this.position.z;
            ix += n.mass * (dy * dy + dz * dz);
            iy += n.mass * (dx * dx + dz * dz);
            iz += n.mass * (dx * dx + dy * dy);
        }
        return new Vec3(Math.max(ix, 10), Math.max(iy, 10), Math.max(iz, 10));
    }

    applyForce(force, worldPoint) {
        this.velocity = this.velocity.add(force.scale(this.invMass));
        if (worldPoint) {
            const r = worldPoint.sub(this.position);
            const torque = r.cross(force);
            this.angularVel.x += torque.x * this.invInertia.x;
            this.angularVel.y += torque.y * this.invInertia.y;
            this.angularVel.z += torque.z * this.invInertia.z;
        }
    }

    integrate(dt) {
        this.position = this.position.add(this.velocity.scale(dt));
        this.velocity = this.velocity.scale(0.9995);
        this.angularVel = this.angularVel.scale(0.998);
        // Update node positions relative to COM
        for (const beam of this.beams) beam.solve();
        for (const node of this.nodes) node.integrate(dt);
        this.position = this._computeCOM();
    }

    getSpeed() { return this.velocity.length(); }
    getForwardDir() {
        return new Vec3(
            -Math.sin(this.orientation.y),
            0,
            -Math.cos(this.orientation.y)
        );
    }
}

export class PhysicsWorld {
    constructor(gravity = -9.81) {
        this.gravity = new Vec3(0, gravity, 0);
        this.chassis = null;
        this.tires = [];
        this.groundPlanes = [];
        this.colliders = [];
        this.time = 0;
    }

    setChassis(chassis) { this.chassis = chassis; }
    addTire(tire) { this.tires.push(tire); }
    addGroundPlane(y, normal) { this.groundPlanes.push({ y, normal: normal || new Vec3(0, 1, 0) }); }
    addCollider(collider) { this.colliders.push(collider); }

    step(dt) {
        this.time += dt;
        const subSteps = 8; // more substeps for stability
        const subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
            // Apply gravity to chassis nodes
            if (this.chassis) {
                for (const node of this.chassis.nodes) {
                    node.applyForce(this.gravity.scale(node.mass));
                }
                // Solve beam constraints
                for (const beam of this.chassis.beams) beam.solve();
                // Integrate nodes
                for (const node of this.chassis.nodes) node.integrate(subDt);
                this.chassis.position = this.chassis._computeCOM();
                // Compute chassis velocity from COM movement
                this.chassis.velocity = this.chassis.velocity.scale(0.999);
            }

            // Update tires
            for (const tire of this.tires) {
                const groundH = this._getGroundHeight(tire.center);
                tire.update(subDt, groundH, this.chassis ? this.chassis.velocity : new Vec3(), 0, 0, 0);
            }

            // Ground collision for chassis nodes
            if (this.chassis) {
                for (const node of this.chassis.nodes) {
                    if (!node.collides) continue;
                    const gh = this._getGroundHeight(node.pos);
                    if (node.pos.y < gh) {
                        node.pos.y = gh;
                        node.vel.y *= -0.1;
                        node.vel.x *= 0.95;
                        node.vel.z *= 0.95;
                    }
                }
            }
        }
    }

    _getGroundHeight(pos) {
        let maxH = 0;
        for (const plane of this.groundPlanes) {
            if (pos.y <= plane.y + 0.5) maxH = Math.max(maxH, plane.y);
        }
        for (const col of this.colliders) {
            if (col.type === 'box') {
                if (pos.x >= col.min.x && pos.x <= col.max.x &&
                    pos.z >= col.min.z && pos.z <= col.max.z &&
                    pos.y <= col.max.y && pos.y >= col.min.y) {
                    maxH = Math.max(maxH, col.max.y);
                }
            } else if (col.type === 'heightfield') {
                const h = col.getHeight(pos.x, pos.z);
                if (pos.y <= h + 0.5) maxH = Math.max(maxH, h);
            }
        }
        return maxH;
    }
}
