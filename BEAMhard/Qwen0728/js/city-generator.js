/**
 * Procedural City Generation - Phase 5 Task 5.1
 * L-System/Grid road network, building extrusion, prop placement
 */
import * as THREE from 'three';

export class CityGenerator {
    constructor(scene) {
        this.scene = scene;
        this.cityGroup = new THREE.Group();
        this.scene.add(this.cityGroup);

        this.roads = [];
        this.buildings = [];
        this.props = [];
        this.gridSize = 10; // blocks
        this.blockSize = 40; // meters per block
        this.roadWidth = 12;
        this.seed = 42;
    }

    /**
     * Generate complete city
     */
    generate(options = {}) {
        const { gridSize = 10, blockSize = 40, seed = 42 } = options;
        this.gridSize = gridSize;
        this.blockSize = blockSize;
        this.seed = seed;

        this._generateRoadNetwork();
        this._generateBuildings();
        this._generateProps();
        this._generateRoadMarkings();

        return this.cityGroup;
    }

    /**
     * Task 5.1: Road Network using Grid Graph with L-System arterial variation
     */
    _generateRoadNetwork() {
        const half = (this.gridSize * this.blockSize) / 2;
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.92, metalness: 0 });
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.85 });

        // Grid-based road network
        for (let i = 0; i <= this.gridSize; i++) {
            const pos = -half + i * this.blockSize;
            const isArterial = i % 3 === 0;
            const width = isArterial ? this.roadWidth : this.roadWidth * 0.6;

            // Horizontal roads (X direction)
            const hGeo = new THREE.BoxGeometry(this.gridSize * this.blockSize + this.roadWidth, 0.05, width);
            const hRoad = new THREE.Mesh(hGeo, roadMat);
            hRoad.position.set(0, 0.02, pos);
            hRoad.receiveShadow = true;
            this.cityGroup.add(hRoad);
            this.roads.push({ type: 'horizontal', pos, width, arterial: isArterial });

            // Vertical roads (Z direction)
            const vGeo = new THREE.BoxGeometry(width, 0.05, this.gridSize * this.blockSize + this.roadWidth);
            const vRoad = new THREE.Mesh(vGeo, roadMat);
            vRoad.position.set(pos, 0.02, 0);
            vRoad.receiveShadow = true;
            this.cityGroup.add(vRoad);
            this.roads.push({ type: 'vertical', pos, width, arterial: isArterial });

            // Sidewalks along arterials
            if (isArterial) {
                const swGeo = new THREE.BoxGeometry(this.gridSize * this.blockSize, 0.12, 1.5);
                const sw1 = new THREE.Mesh(swGeo, sidewalkMat);
                sw1.position.set(0, 0.06, pos + width / 2 + 0.75);
                this.cityGroup.add(sw1);
                const sw2 = new THREE.Mesh(swGeo, sidewalkMat);
                sw2.position.set(0, 0.06, pos - width / 2 - 0.75);
                this.cityGroup.add(sw2);
            }
        }

        // L-System diagonal boulevard
        this._generateLBoulevard(half);
    }

    _generateLBoulevard(half) {
        // Simple L-System: F -> F+F-F-F+F (generates interesting diagonal)
        const axiom = 'F+F-F';
        const rules = { 'F': 'F+F-F-F+F' };
        let lstr = axiom;
        for (let i = 0; i < 2; i++) {
            let next = '';
            for (const c of lstr) next += rules[c] || c;
            lstr = next;
        }

        // Interpret L-System as road path
        const angle = Math.PI / 4;
        let dir = 0, x = -half * 0.6, z = -half * 0.6;
        const step = this.blockSize * 0.8;
        const points = [new THREE.Vector3(x, 0.03, z)];

        for (const c of lstr.substring(0, 30)) {
            if (c === 'F') {
                x += Math.cos(dir) * step;
                z += Math.sin(dir) * step;
                points.push(new THREE.Vector3(x, 0.03, z));
            } else if (c === '+') dir += angle;
            else if (c === '-') dir -= angle;
        }

        if (points.length > 1) {
            const curve = new THREE.CatmullRomCurve3(points);
            const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, 4, 4, false);
            const tubeMat = new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.9 });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.scale.y = 0.01;
            tube.receiveShadow = true;
            this.cityGroup.add(tube);
        }
    }

    /**
     * Task 5.1: Building volume extrusion from block footprints
     */
    _generateBuildings() {
        const half = (this.gridSize * this.blockSize) / 2;
        const rng = this._createRNG(this.seed);

        const buildingColors = [0x667788, 0x556677, 0x778899, 0x445566, 0x889999, 0x5a6a7a, 0x4a5a6a];
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.6 });

        for (let bx = 0; bx < this.gridSize; bx++) {
            for (let bz = 0; bz < this.gridSize; bz++) {
                const blockX = -half + bx * this.blockSize + this.blockSize / 2;
                const blockZ = -half + bz * this.blockSize + this.blockSize / 2;
                const innerSize = this.blockSize - this.roadWidth - 4;

                // Distance from center affects height
                const distFromCenter = Math.sqrt(blockX * blockX + blockZ * blockZ) / half;
                const maxHeight = 60 * (1 - distFromCenter * 0.7) + 10;

                // Subdivide block into 1-4 buildings
                const subdivisions = Math.floor(rng() * 3) + 1;
                for (let s = 0; s < subdivisions; s++) {
                    const bw = (innerSize / subdivisions) * (0.6 + rng() * 0.3);
                    const bd = innerSize * (0.5 + rng() * 0.4);
                    const bh = 5 + rng() * maxHeight;
                    const ox = (s - subdivisions / 2 + 0.5) * (innerSize / subdivisions);

                    const color = buildingColors[Math.floor(rng() * buildingColors.length)];
                    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });

                    const geo = new THREE.BoxGeometry(bw, bh, bd);
                    const building = new THREE.Mesh(geo, mat);
                    building.position.set(blockX + ox, bh / 2, blockZ + (rng() - 0.5) * 5);
                    building.castShadow = true;
                    building.receiveShadow = true;
                    this.cityGroup.add(building);
                    this.buildings.push(building);

                    // Glass windows (emissive strips)
                    if (bh > 15) {
                        const floors = Math.floor(bh / 3.5);
                        for (let f = 1; f < floors; f += 2) {
                            const winGeo = new THREE.PlaneGeometry(bw * 0.85, 1.5);
                            const win = new THREE.Mesh(winGeo, glassMat);
                            win.position.set(blockX + ox, f * 3.5, building.position.z + bd / 2 + 0.05);
                            this.cityGroup.add(win);
                        }
                    }

                    // Rooftop details
                    if (rng() > 0.5 && bh > 20) {
                        const antennaGeo = new THREE.CylinderGeometry(0.1, 0.1, 5, 4);
                        const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
                        antenna.position.set(blockX + ox, bh + 2.5, building.position.z);
                        this.cityGroup.add(antenna);
                    }
                }
            }
        }
    }

    /**
     * Task 5.1: Street props (lights, signals, markings)
     */
    _generateProps() {
        const half = (this.gridSize * this.blockSize) / 2;
        const rng = this._createRNG(this.seed + 100);

        const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffcc44, emissiveIntensity: 0.8 });
        const signalRedMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        const signalGreenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5 });

        // Streetlights at intersections
        for (let i = 0; i <= this.gridSize; i += 2) {
            for (let j = 0; j <= this.gridSize; j += 2) {
                const x = -half + i * this.blockSize;
                const z = -half + j * this.blockSize;

                // Pole
                const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6);
                const pole = new THREE.Mesh(poleGeo, poleMat);
                pole.position.set(x + 7, 3, z + 7);
                pole.castShadow = true;
                this.cityGroup.add(pole);

                // Arm
                const armGeo = new THREE.BoxGeometry(2, 0.08, 0.08);
                const arm = new THREE.Mesh(armGeo, poleMat);
                arm.position.set(x + 6, 6, z + 7);
                this.cityGroup.add(arm);

                // Light
                const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
                const light = new THREE.Mesh(lightGeo, lightMat);
                light.position.set(x + 5, 5.9, z + 7);
                this.cityGroup.add(light);
                this.props.push({ type: 'streetlight', pos: [x + 5, 5.9, z + 7] });
            }
        }

        // Traffic signals at major intersections
        for (let i = 0; i <= this.gridSize; i += 3) {
            for (let j = 0; j <= this.gridSize; j += 3) {
                const x = -half + i * this.blockSize;
                const z = -half + j * this.blockSize;

                const signalPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), poleMat);
                signalPole.position.set(x + 6, 2, z - 6);
                this.cityGroup.add(signalPole);

                const boxGeo = new THREE.BoxGeometry(0.3, 0.9, 0.2);
                const boxMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                const box = new THREE.Mesh(boxGeo, boxMat);
                box.position.set(x + 6, 4.2, z - 6);
                this.cityGroup.add(box);

                // Signal lights
                const red = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), signalRedMat);
                red.position.set(x + 6, 4.5, z - 5.9);
                this.cityGroup.add(red);
                const green = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), signalGreenMat);
                green.position.set(x + 6, 3.9, z - 5.9);
                this.cityGroup.add(green);
                this.props.push({ type: 'signal', pos: [x + 6, 4.2, z - 6] });
            }
        }
    }

    _generateRoadMarkings() {
        const half = (this.gridSize * this.blockSize) / 2;
        const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

        for (let i = 0; i <= this.gridSize; i += 3) {
            const pos = -half + i * this.blockSize;
            // Center dashes on arterials
            for (let d = 0; d < this.gridSize * 4; d++) {
                const dashGeo = new THREE.PlaneGeometry(0.15, 2);
                const dash = new THREE.Mesh(dashGeo, yellowMat);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(pos, 0.04, -half + d * 10 + 5);
                this.cityGroup.add(dash);

                const dash2 = new THREE.Mesh(dashGeo.clone(), yellowMat);
                dash2.rotation.x = -Math.PI / 2;
                dash2.rotation.z = Math.PI / 2;
                dash2.position.set(-half + d * 10 + 5, 0.04, pos);
                this.cityGroup.add(dash2);
            }
        }

        // Crosswalks at intersections
        for (let i = 0; i <= this.gridSize; i += 3) {
            for (let j = 0; j <= this.gridSize; j += 3) {
                const x = -half + i * this.blockSize;
                const z = -half + j * this.blockSize;
                for (let s = 0; s < 6; s++) {
                    const stripeGeo = new THREE.PlaneGeometry(0.5, 3);
                    const stripe = new THREE.Mesh(stripeGeo, markMat);
                    stripe.rotation.x = -Math.PI / 2;
                    stripe.position.set(x - 3 + s * 1.2, 0.04, z + 8);
                    this.cityGroup.add(stripe);
                }
            }
        }
    }

    _createRNG(seed) {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
            return (s >>> 0) / 0xFFFFFFFF;
        };
    }

    clear() {
        this.scene.remove(this.cityGroup);
        this.cityGroup = new THREE.Group();
        this.scene.add(this.cityGroup);
        this.roads = [];
        this.buildings = [];
        this.props = [];
    }
}
