/**
 * render/PostFX.js — post-processing pipeline
 *  - HDR scene render target (half-float + depth texture)
 *  - Bloom (bright-pass + separable gaussian, 2 levels)
 *  - optional depth-based edge detection (Sobel, sampled from depth texture)
 *  - final composite: ACES tonemap + exposure + vignette
 */
import * as THREE from 'three';

const fullscreenVert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function makeQuad(mat) {
  const geo = new THREE.PlaneGeometry(2, 2);
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

export class PostFX {
  constructor(renderer, scene, camera, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.bloomEnabled = true;
    this.edgeEnabled = false;

    const w = renderer.domElement.width || 1280;
    const h = renderer.domElement.height || 720;

    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(w, h),
    });
    this.sceneRT.texture.colorSpace = THREE.SRGBColorSpace;

    const mk = (tw, th) => new THREE.WebGLRenderTarget(tw, th, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: false,
    });
    this.bloomW = Math.max(4, Math.floor(w / 2));
    this.bloomH = Math.max(4, Math.floor(h / 2));
    this.bloomRTs = {
      bright: mk(this.bloomW, this.bloomH),
      blurA: mk(this.bloomW, this.bloomH),
      blurB: mk(this.bloomW, this.bloomH),
      blurA2: mk(Math.max(4, this.bloomW >> 1), Math.max(4, this.bloomH >> 1)),
      blurB2: mk(Math.max(4, this.bloomW >> 1), Math.max(4, this.bloomH >> 1)),
    };

    // bright pass
    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
          float soft = smoothstep(uThreshold, uThreshold + 0.5, l);
          gl_FragColor = vec4(c.rgb * soft, 1.0);
        }`,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: opts.bloomThreshold ?? 0.78 } },
      depthTest: false, depthWrite: false,
    });

    const blurFS = /* glsl */`
      uniform sampler2D tDiffuse;
      uniform vec2 uDir;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec2 px = uDir * uTexel;
        vec3 acc = texture2D(tDiffuse, vUv).rgb * 0.227027;
        acc += texture2D(tDiffuse, vUv + px * 1.3846).rgb * 0.3162162;
        acc += texture2D(tDiffuse, vUv - px * 1.3846).rgb * 0.3162162;
        acc += texture2D(tDiffuse, vUv + px * 3.2308).rgb * 0.0702703;
        acc += texture2D(tDiffuse, vUv - px * 3.2308).rgb * 0.0702703;
        gl_FragColor = vec4(acc, 1.0);
      }`;
    this.blurMat = (dir) => new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: blurFS,
      uniforms: { tDiffuse: { value: null }, uDir: { value: dir }, uTexel: { value: new THREE.Vector2(1 / this.bloomW, 1 / this.bloomH) } },
      depthTest: false, depthWrite: false,
    });
    this.blurH = this.blurMat(new THREE.Vector2(1, 0));
    this.blurV = this.blurMat(new THREE.Vector2(0, 1));
    this.blurH2 = this.blurMat(new THREE.Vector2(1, 0));
    this.blurV2 = this.blurMat(new THREE.Vector2(0, 1));

    // final composite
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform sampler2D tDepth;
        uniform float uBloomStrength;
        uniform float uExposure;
        uniform float uEdgeOn;
        uniform float uNear;
        uniform float uFar;
        varying vec2 vUv;

        float linearDepth(float d) {
          float z = d * 2.0 - 1.0;
          return (2.0 * uNear) / (uFar + uNear - z * (uFar - uNear));
        }

        void main() {
          vec3 col = texture2D(tDiffuse, vUv).rgb * uExposure;
          vec3 bloom = texture2D(tBloom, vUv).rgb;
          col += bloom * uBloomStrength;

          // ACES approximation
          vec3 aces = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
          col = clamp(aces, 0.0, 1.0);

          // depth edge detection (Sobel on linearized depth)
          if (uEdgeOn > 0.5) {
            vec2 px = vec2(1.0) / vec2(textureSize(tDepth, 0));
            float d00 = linearDepth(texture2D(tDepth, vUv + px * vec2(-1,-1)).r);
            float d10 = linearDepth(texture2D(tDepth, vUv + px * vec2( 1,-1)).r);
            float d01 = linearDepth(texture2D(tDepth, vUv + px * vec2(-1, 1)).r);
            float d11 = linearDepth(texture2D(tDepth, vUv + px * vec2( 1, 1)).r);
            float d0  = linearDepth(texture2D(tDepth, vUv + px * vec2( 0,-1)).r);
            float d2  = linearDepth(texture2D(tDepth, vUv + px * vec2(-1, 0)).r);
            float d3  = linearDepth(texture2D(tDepth, vUv + px * vec2( 1, 0)).r);
            float d4  = linearDepth(texture2D(tDepth, vUv + px * vec2( 0, 1)).r);
            float gx = d2 - d3 + 2.0 * d00 - 2.0 * d10 + d01 - d11;
            float gy = d0 - d4 + 2.0 * d00 - 2.0 * d01 + d10 - d11;
            float e = smoothstep(0.015, 0.06, length(vec2(gx, gy)));
            col = mix(col, vec3(0.04, 0.05, 0.11), e * 0.85);
          }

          // vignette
          vec2 uv2 = vUv - 0.5;
          float vig = 1.0 - dot(uv2, uv2) * 0.6;
          col *= clamp(vig, 0.0, 1.0);

          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        tDepth: { value: null },
        uBloomStrength: { value: opts.bloomStrength ?? 0.5 },
        uExposure: { value: opts.exposure ?? 1.02 },
        uEdgeOn: { value: 0 },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
      },
      depthTest: false, depthWrite: false,
    });

    this.quadScene = new THREE.Scene();
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene.add(this.orthoCam);
    const add = (mat) => { const q = makeQuad(mat); q.visible = false; this.quadScene.add(q); return q; };
    this.qBright = add(this.brightMat);
    this.qBlurH = add(this.blurH);
    this.qBlurV = add(this.blurV);
    this.qBlurH2 = add(this.blurH2);
    this.qBlurV2 = add(this.blurV2);
    this.qFinal = add(this.finalMat);
  }

  resize(w, h) {
    this.sceneRT.setSize(w, h);
    this.bloomW = Math.max(4, Math.floor(w / 2));
    this.bloomH = Math.max(4, Math.floor(h / 2));
    for (const k of Object.keys(this.bloomRTs)) {
      const rt = this.bloomRTs[k];
      const tw = k.includes('2') ? Math.max(4, this.bloomW >> 1) : this.bloomW;
      const th = k.includes('2') ? Math.max(4, this.bloomH >> 1) : this.bloomH;
      rt.setSize(tw, th);
    }
    const t1 = new THREE.Vector2(1 / this.bloomW, 1 / this.bloomH);
    this.blurH.uniforms.uTexel.value = t1;
    this.blurV.uniforms.uTexel.value = t1;
    const t2 = new THREE.Vector2(1 / Math.max(4, this.bloomW >> 1), 1 / Math.max(4, this.bloomH >> 1));
    this.blurH2.uniforms.uTexel.value = t2;
    this.blurV2.uniforms.uTexel.value = t2;
    this.finalMat.uniforms.uNear.value = this.camera.near;
    this.finalMat.uniforms.uFar.value = this.camera.far;
  }

  render(time) {
    const r = this.renderer;
    const q = this.quadScene;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
      return;
    }
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.scene, this.camera);

    if (this.bloomEnabled) {
      this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
      this.qBright.visible = true;
      r.setRenderTarget(this.bloomRTs.bright);
      r.clear();
      r.render(q, this.orthoCam);
      this.qBright.visible = false;

      this.blurH.uniforms.tDiffuse.value = this.bloomRTs.bright.texture;
      this.qBlurH.visible = true;
      r.setRenderTarget(this.bloomRTs.blurA);
      r.clear();
      r.render(q, this.orthoCam);
      this.qBlurH.visible = false;

      this.blurV.uniforms.tDiffuse.value = this.bloomRTs.blurA.texture;
      this.qBlurV.visible = true;
      r.setRenderTarget(this.bloomRTs.blurB);
      r.clear();
      r.render(q, this.orthoCam);
      this.qBlurV.visible = false;

      this.blurH2.uniforms.tDiffuse.value = this.bloomRTs.blurB.texture;
      this.qBlurH2.visible = true;
      r.setRenderTarget(this.bloomRTs.blurA2);
      r.clear();
      r.render(q, this.orthoCam);
      this.qBlurH2.visible = false;

      this.blurV2.uniforms.tDiffuse.value = this.bloomRTs.blurA2.texture;
      this.qBlurV2.visible = true;
      r.setRenderTarget(this.bloomRTs.blurB2);
      r.clear();
      r.render(q, this.orthoCam);
      this.qBlurV2.visible = false;
    }

    this.finalMat.uniforms.tDiffuse.value = this.sceneRT.texture;
    this.finalMat.uniforms.tBloom.value = this.bloomRTs.blurB2.texture;
    this.finalMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.finalMat.uniforms.uEdgeOn.value = this.edgeEnabled ? 1 : 0;
    this.qFinal.visible = true;
    r.setRenderTarget(null);
    r.clear();
    r.render(q, this.orthoCam);
    this.qFinal.visible = false;
  }
}
