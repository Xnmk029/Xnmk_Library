/**
 * NPR Stylized Anime Rendering - Phase 4 Task 4.1
 * Cel-Shading, Inverted Hull Outline, Post-Process Edge Detection
 */
import * as THREE from 'three';

/**
 * Cel-Shading Toon Material with stepped diffuse lighting
 */
export function createCelShadeMaterial(baseColor, options = {}) {
    const {
        rampSteps = 4,
        specularStrength = 0.5,
        rimPower = 3.0,
        rimColor = new THREE.Color(0.4, 0.6, 1.0),
        shadowColor = new THREE.Color(0.15, 0.1, 0.2)
    } = options;

    return new THREE.ShaderMaterial({
        uniforms: {
            uBaseColor: { value: new THREE.Color(baseColor) },
            uShadowColor: { value: shadowColor },
            uRimColor: { value: rimColor },
            uLightDir: { value: new THREE.Vector3(0.5, 0.8, -0.3).normalize() },
            uLightColor: { value: new THREE.Color(1.0, 0.95, 0.9) },
            uRampSteps: { value: rampSteps },
            uSpecStrength: { value: specularStrength },
            uRimPower: { value: rimPower },
            uTime: { value: 0 }
        },
        vertexShader: /* glsl */`
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vViewDir = normalize(cameraPosition - worldPos.xyz);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uBaseColor;
            uniform vec3 uShadowColor;
            uniform vec3 uRimColor;
            uniform vec3 uLightDir;
            uniform vec3 uLightColor;
            uniform float uRampSteps;
            uniform float uSpecStrength;
            uniform float uRimPower;
            uniform float uTime;

            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            varying vec2 vUv;

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(uLightDir);
                vec3 viewDir = normalize(vViewDir);

                // Cel-shading stepped diffuse
                float NdotL = dot(normal, lightDir);
                float diffuse = NdotL * 0.5 + 0.5; // half-lambert
                // Quantize to steps
                float stepped = floor(diffuse * uRampSteps) / uRampSteps;
                stepped = smoothstep(0.0, 1.0, stepped); // slight smoothing at edges

                // Mix base and shadow color
                vec3 color = mix(uShadowColor, uBaseColor, stepped);
                color *= uLightColor;

                // Specular highlight (stepped)
                vec3 halfVec = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);
                float specStep = step(0.5, spec) * uSpecStrength;
                color += vec3(specStep);

                // Rim light (anime edge glow)
                float rim = 1.0 - max(dot(viewDir, normal), 0.0);
                rim = pow(rim, uRimPower);
                color += uRimColor * rim * 0.4;

                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
}

/**
 * Inverted Hull Outline Material (back-face extrusion)
 */
export function createOutlineMaterial(outlineWidth = 0.03, outlineColor = 0x000000) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uOutlineWidth: { value: outlineWidth },
            uOutlineColor: { value: new THREE.Color(outlineColor) }
        },
        vertexShader: /* glsl */`
            uniform float uOutlineWidth;
            varying vec3 vNormal;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                // Extrude along normal direction
                vec3 pos = position + normal * uOutlineWidth;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 uOutlineColor;
            varying vec3 vNormal;

            void main() {
                gl_FragColor = vec4(uOutlineColor, 1.0);
            }
        `,
        side: THREE.BackSide
    });
}

/**
 * Apply inverted hull outline to a mesh (creates outline clone)
 */
export function addOutlineToMesh(mesh, width = 0.025, color = 0x111111) {
    const outlineMat = createOutlineMaterial(width, color);
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.scale.copy(mesh.scale);
    outlineMesh.position.copy(mesh.position);
    outlineMesh.rotation.copy(mesh.rotation);
    outlineMesh.renderOrder = -1;
    if (mesh.parent) mesh.parent.add(outlineMesh);
    return outlineMesh;
}

/**
 * Post-process edge detection shader (Color-based Sobel)
 * Robust implementation with proper render target management
 */
export class OutlinePostProcess {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.enabled = true;

        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false
        });

        // Full-screen quad for post-process
        this.quadScene = new THREE.Scene();
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.edgeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.renderTarget.texture },
                uResolution: { value: new THREE.Vector2(size.x, size.y) },
                uEdgeThreshold: { value: 0.08 },
                uEdgeColor: { value: new THREE.Color(0x0a0a0a) },
                uEdgeStrength: { value: 0.8 }
            },
            vertexShader: /* glsl */`
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                uniform sampler2D tDiffuse;
                uniform vec2 uResolution;
                uniform float uEdgeThreshold;
                uniform vec3 uEdgeColor;
                uniform float uEdgeStrength;
                varying vec2 vUv;

                vec3 sobelColor(vec2 uv) {
                    vec2 texel = 1.0 / uResolution;
                    vec3 c00 = texture2D(tDiffuse, uv + vec2(-texel.x, -texel.y)).rgb;
                    vec3 c01 = texture2D(tDiffuse, uv + vec2(0.0, -texel.y)).rgb;
                    vec3 c02 = texture2D(tDiffuse, uv + vec2(texel.x, -texel.y)).rgb;
                    vec3 c10 = texture2D(tDiffuse, uv + vec2(-texel.x, 0.0)).rgb;
                    vec3 c12 = texture2D(tDiffuse, uv + vec2(texel.x, 0.0)).rgb;
                    vec3 c20 = texture2D(tDiffuse, uv + vec2(-texel.x, texel.y)).rgb;
                    vec3 c21 = texture2D(tDiffuse, uv + vec2(0.0, texel.y)).rgb;
                    vec3 c22 = texture2D(tDiffuse, uv + vec2(texel.x, texel.y)).rgb;

                    vec3 sx = c00 + 2.0*c10 + c20 - c02 - 2.0*c12 - c22;
                    vec3 sy = c00 + 2.0*c01 + c02 - c20 - 2.0*c21 - c22;
                    return sqrt(sx*sx + sy*sy);
                }

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    vec3 colorEdge = sobelColor(vUv);
                    float edgeMag = length(colorEdge);

                    float edge = smoothstep(uEdgeThreshold, uEdgeThreshold * 2.5, edgeMag);
                    vec3 finalColor = mix(color.rgb, uEdgeColor, edge * uEdgeStrength);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            depthTest: false,
            depthWrite: false
        });

        const quadGeo = new THREE.PlaneGeometry(2, 2);
        this.quadMesh = new THREE.Mesh(quadGeo, this.edgeMaterial);
        this.quadMesh.frustumCulled = false;
        this.quadScene.add(this.quadMesh);
    }

    render() {
        if (!this.enabled) {
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene, this.camera);
            return;
        }
        // Pass 1: Render scene to offscreen target
        this.renderer.setRenderTarget(this.renderTarget);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

        // Pass 2: Edge detection composite to screen
        this.renderer.setRenderTarget(null);
        this.renderer.clear();
        this.renderer.render(this.quadScene, this.quadCamera);
    }

    setSize(w, h) {
        const pixelRatio = this.renderer.getPixelRatio();
        const bw = Math.floor(w * pixelRatio);
        const bh = Math.floor(h * pixelRatio);
        this.renderTarget.setSize(bw, bh);
        this.edgeMaterial.uniforms.uResolution.value.set(bw, bh);
    }

    dispose() {
        this.renderTarget.dispose();
        this.edgeMaterial.dispose();
    }
}

/**
 * Apply cel-shading to all meshes in a group
 */
export function applyCelShading(group, options = {}) {
    group.traverse((child) => {
        if (child.isMesh && child.material && !child.material.isShaderMaterial) {
            const color = child.material.color ? child.material.color.getHex() : 0x888888;
            const celMat = createCelShadeMaterial(color, options);
            child.material = celMat;
            // Add outline
            addOutlineToMesh(child, 0.02, 0x111111);
        }
    });
}
