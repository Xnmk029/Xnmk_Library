// Phase 3/4/5 — Custom WebGL2 NPR renderer:
// cel shading, inverted-hull outlines, shadow map, screen-space constant-width
// line shader, toon water, procedural sky, bloom + tone-mapping post pipeline.
'use strict';

const Renderer = (() => {

  function base64ToArray(b64, Ctor) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Ctor(bytes.buffer);
  }

  const SHADERS = {
    toonVert: `
      attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv; attribute vec3 aCol;
      uniform mat4 uModel; uniform mat4 uViewProj; uniform mat3 uNrmMat;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vCol;
      void main(){
        vec4 w = uModel * vec4(aPos,1.0);
        vW = w.xyz;
        vN = normalize(uNrmMat * aNrm);
        vUv = aUv;
        vCol = aCol;
        gl_Position = uViewProj * w;
      }`,
    toonFrag: `
      precision mediump float;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vCol;
      uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uCamPos;
      uniform vec3 uColor; uniform float uUseTex; uniform sampler2D uTex;
      uniform vec3 uEmissive; uniform float uShininess;
      uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
      uniform float uShadow; uniform float uAlpha; uniform float uUseVCol;
      void main(){
        vec3 N = normalize(vN);
        vec3 L = normalize(uSunDir);
        float ndl = max(dot(N, L), 0.0);
        // 3-step cel ramp
        float ramp = ndl > 0.72 ? 1.0 : (ndl > 0.38 ? 0.68 : (ndl > 0.08 ? 0.38 : 0.14));
        vec3 base = uColor;
        if (uUseVCol > 0.5) base *= vCol;
        if (uUseTex > 0.5) base *= texture2D(uTex, vUv).rgb;
        vec3 col = base * (uSunCol * ramp + vec3(0.30));
        // rim light
        vec3 V = normalize(uCamPos - vW);
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        col += uSunCol * rim * 0.25;
        col += uEmissive;
        // specular blob
        if (uShininess > 2.0) {
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), uShininess);
          col += uSunCol * spec * 0.28 * step(0.5, spec);
        }
        col *= mix(1.0, 0.6, uShadow);
        float dist = length(uCamPos - vW);
        float fog = clamp((dist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
        col = mix(col, uFogColor, fog * fog);
        gl_FragColor = vec4(col, uAlpha);
      }`,
    outlineVert: `
      attribute vec3 aPos; attribute vec3 aNrm;
      uniform mat4 uModel; uniform mat4 uViewProj; uniform mat3 uNrmMat;
      uniform float uWidth;
      void main(){
        vec3 n = normalize(uNrmMat * aNrm);
        vec4 w = uModel * vec4(aPos + n * uWidth, 1.0);
        gl_Position = uViewProj * w;
      }`,
    outlineFrag: `
      precision mediump float;
      uniform vec3 uColor;
      void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    shadowVert: `
      attribute vec3 aPos;
      uniform mat4 uModel; uniform mat4 uLightVP;
      void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`,
    shadowFrag: `
      precision mediump float;
      void main(){ gl_FragColor = vec4(1.0); }`,
    lineVert: `
      attribute vec3 aPos; attribute vec4 aColor;
      varying vec4 vColor;
      void main(){ gl_Position = vec4(aPos, 1.0); vColor = aColor; }`,
    lineFrag: `
      precision mediump float;
      varying vec4 vColor;
      void main(){ gl_FragColor = vColor; }`,
    waterVert: `
      attribute vec3 aPos;
      uniform mat4 uModel; uniform mat4 uViewProj; uniform float uTime;
      varying vec3 vW;
      void main(){
        vec4 w = uModel * vec4(aPos, 1.0);
        w.z += sin(w.x * 2.2 + uTime * 1.1) * 0.06 + cos(w.y * 1.8 + uTime * 0.9) * 0.06;
        vW = w.xyz;
        gl_Position = uViewProj * w;
      }`,
    waterFrag: `
      precision mediump float;
      varying vec3 vW;
      uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uCamPos;
      uniform vec3 uFogColor; uniform float uFogStart; uniform float uFogEnd;
      void main(){
        vec3 N = normalize(vec3(sin(vW.x * 2.2) * 0.3, sin(vW.y * 1.8) * 0.3, 1.0));
        vec3 L = normalize(uSunDir);
        float ndl = max(dot(N, L), 0.0);
        float ramp = ndl > 0.6 ? 1.0 : (ndl > 0.3 ? 0.55 : 0.25);
        vec3 base = vec3(0.08, 0.30, 0.45);
        vec3 V = normalize(uCamPos - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);
        vec3 col = base * (uSunCol * ramp * 0.9 + vec3(0.25)) + vec3(0.7, 0.85, 1.0) * fres * 0.35;
        float dist = length(uCamPos - vW);
        float fog = clamp((dist - uFogStart) / (uFogEnd - uFogStart), 0.0, 1.0);
        col = mix(col, uFogColor, fog * 0.8);
        gl_FragColor = vec4(col, 0.88);
      }`,
    skyVert: `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.999, 1.0); }`,
    skyFrag: `
      precision mediump float;
      varying vec2 vUv;
      uniform vec3 uSunDir;
      void main(){
        vec3 col = mix(vec3(0.32, 0.55, 0.85), vec3(0.86, 0.92, 1.0), vUv.y);
        col = mix(col, vec3(1.0, 0.78, 0.45), 0.0);
        vec2 suv = normalize(vec2(0.0, 1.0)) * 0.5;
        float sun = smoothstep(0.06, 0.0, distance(vUv, vec2(0.72, 0.78)));
        col += vec3(1.0, 0.92, 0.7) * sun;
        gl_FragColor = vec4(col, 1.0);
      }`,
    brightFrag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTex;
      void main(){
        vec3 c = texture2D(uTex, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(c * smoothstep(0.7, 1.2, l), 1.0);
      }`,
    blurFrag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform vec2 uDir;
      void main(){
        vec3 s = vec3(0.0);
        for (int i = -3; i <= 3; i++) {
          float w = 1.0 - abs(float(i)) / 4.0;
          s += texture2D(uTex, vUv + uDir * float(i) * 0.004).rgb * w;
        }
        gl_FragColor = vec4(s / 5.5, 1.0);
      }`,
    compositeFrag: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uScene; uniform sampler2D uBloom;
      void main(){
        vec3 c = texture2D(uScene, vUv).rgb;
        vec3 b = texture2D(uBloom, vUv).rgb;
        c += b * 0.55;
        // ACES-ish tone map
        c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.35;
        gl_FragColor = vec4(pow(c, vec3(0.9)), 1.0);
      }`
  };

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
      if (!this.gl) throw new Error('WebGL2 not supported');
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.enable(this.gl.CULL_FACE);
      this.gl.cullFace(this.gl.BACK);
      this.programs = {};
      for (const [name, srcs] of Object.entries({
        toon: [SHADERS.toonVert, SHADERS.toonFrag],
        outline: [SHADERS.outlineVert, SHADERS.outlineFrag],
        shadow: [SHADERS.shadowVert, SHADERS.shadowFrag],
        line: [SHADERS.lineVert, SHADERS.lineFrag],
        water: [SHADERS.waterVert, SHADERS.waterFrag],
        sky: [SHADERS.skyVert, SHADERS.skyFrag]
      })) this.programs[name] = this.compile(srcs[0], srcs[1]);
      this.post = this.initPost();
      this.drawables = [];
      this.lines = [];
      this.vehicleMeshes = [];
      this.textures = new Map();
      this.time = 0;
      this.sunDir = M.v3norm([0.45, -0.5, 0.85]);
      this.sunCol = [1.0, 0.93, 0.8];
      this.fogColor = [0.62, 0.75, 0.9];
      this.fogStart = 120;
      this.fogEnd = 520;
      this._idMat = M.m4id(M.m4());
    }

    compile(vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      const v = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(v, vs); gl.compileShader(v);
      if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) console.error('VS', gl.getShaderInfoLog(v));
      const f = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(f, fs); gl.compileShader(f);
      if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) console.error('FS', gl.getShaderInfoLog(f));
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('LINK', gl.getProgramInfoLog(p));
      return p;
    }

    initPost() {
      const gl = this.gl;
      const make = (w, h) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        return { tex, fb, w, h, depth };
      };
      const w = this.canvas.width, h = this.canvas.height;
      const scene = make(w, h);
      const bright = make(w >> 1, h >> 1);
      const blur = make(w >> 1, h >> 1);
      return { scene, bright, blur, quad: this.fullscreenQuad(), brightProg: this.compile(SHADERS.skyVert, SHADERS.brightFrag), blurProg: this.compile(SHADERS.skyVert, SHADERS.blurFrag), compProg: this.compile(SHADERS.skyVert, SHADERS.compositeFrag) };
    }

    fullscreenQuad() {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      return { buf, vao };
    }

    textureFromDataURL(url) {
      if (this.textures.has(url)) return this.textures.get(url);
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        if ((img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0) gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      };
      img.src = url;
      this.textures.set(url, tex);
      return tex;
    }

    // geo: {pos, nrm?, uv?, col?} (Float32Array) + idx (Uint32Array)
    makeVAO(geo, idx) {
      const gl = this.gl;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      let nrmBuf = null;
      if (geo.nrm) {
        nrmBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geo.nrm, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      } else {
        const n = new Float32Array(geo.pos.length);
        for (let i = 0; i < geo.pos.length; i += 9) {
          const ax = geo.pos[i + 3] - geo.pos[i], ay = geo.pos[i + 4] - geo.pos[i + 1], az = geo.pos[i + 5] - geo.pos[i + 2];
          const bx = geo.pos[i + 6] - geo.pos[i], by = geo.pos[i + 7] - geo.pos[i + 1], bz = geo.pos[i + 8] - geo.pos[i + 2];
          const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const l = Math.hypot(nx, ny, nz) || 1;
          for (let k = 0; k < 3; k++) { n[i + k * 3] = nx / l; n[i + k * 3 + 1] = ny / l; n[i + k * 3 + 2] = nz / l; }
        }
        nrmBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
        gl.bufferData(gl.ARRAY_BUFFER, n, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      }
      let uvBuf = null;
      if (geo.uv) {
        uvBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geo.uv, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      } else {
        const uv = new Float32Array((geo.pos.length / 3) * 2);
        uvBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      }
      let colBuf = null;
      if (geo.col) {
        colBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, geo.col, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
      }
      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      return { vao, count: idx.length };
    }

    addMesh(geo, idx, mat, opts) {
      const d = this.makeVAO(geo, idx);
      this.drawables.push(Object.assign({ vao: d.vao, count: d.count, mat }, opts || {}));
      return this.drawables.length - 1;
    }

    addLine(a, b, width, color) {
      this.lines.push({ a: a.slice(), b: b.slice(), width, color: color.slice() });
    }

    setVehicle(vehicle) {
      this.vehicle = vehicle;
      this.buildVehicleMeshes();
    }

    buildVehicleMeshes() {
      const md = globalThis.MESH_DATA;
      if (!md || !md.geos) return;
      this.vehicleMeshes = [];
      const texData = globalThis.TEXTURE_DATA || {};
      for (const mesh of md.meshes) {
        const ge = md.geos[mesh.geo];
        if (!ge) continue;
        const pos = base64ToArray(ge.pos, Float32Array);
        const nrm = ge.nrm ? base64ToArray(ge.nrm, Float32Array) : null;
        const uv = ge.uv ? base64ToArray(ge.uv, Float32Array) : null;
        const idx = base64ToArray(ge.idx || this.indexFor(mesh, ge), Uint32Array);
        const matId = mesh.mats && mesh.mats[0] ? mesh.mats[0].matId : '';
        const m = md.mats[matId] || { diffuse: [0.7, 0.7, 0.7, 1] };
        const mat = {
          color: m.diffuse ? m.diffuse.slice(0, 3) : [0.7, 0.7, 0.7],
          emissive: m.emissive || [0, 0, 0],
          shininess: m.shininess || 8,
          texture: m.texFile && texData[m.texFile] ? texData[m.texFile].url : null,
          alpha: m.diffuse && m.diffuse.length > 3 ? m.diffuse[3] : 1
        };
        const draw = this.addMesh({ pos, nrm, uv }, idx, mat, { vehicle: true });
        this.vehicleMeshes.push({ mesh, draw, isWheel: /wheel|tire|brake_hub/i.test(mesh.name), isGlass: /glass|windscreen|window/i.test(mesh.name) });
      }
    }

    indexFor(mesh, ge) {
      // fallback: triangle list 0..n
      const n = (ge.pos ? base64ToArray(ge.pos, Float32Array).length : 0) / 3;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      return idx;
    }

    // ---- per-frame vehicle transform update ----
    updateVehicleTransforms() {
      const v = this.vehicle;
      if (!v) return;
      const vd = v.data;
      const nodeOf = (id) => v.nodes.findIndex(n => n.id === id);
      const frameFor = (groups) => {
        const idxs = [];
        for (const g of groups || []) {
          const list = v.groups.get(g);
          if (list) for (const ni of list) if (!idxs.includes(ni)) idxs.push(ni);
        }
        if (!idxs.length) return null;
        const o = v.nodes[idxs[0]].pos;
        let v1 = null, v2 = null;
        for (const ni of idxs.slice(1)) {
          const p = v.nodes[ni].pos;
          const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
          if (Math.hypot(d[0], d[1], d[2]) > 0.01) {
            if (!v1) v1 = d;
            else if (Math.abs(M.v3dot(M.v3norm(d), M.v3norm(v1))) < 0.92) { v2 = d; break; }
          }
        }
        const m = M.m4();
        m[12] = o[0]; m[13] = o[1]; m[14] = o[2];
        if (v1 && v2) {
          const x = M.v3norm(v1, [0, 0, 0]);
          const z = M.v3norm(M.v3cross(x, v2, [0, 0, 0]), [0, 0, 0]);
          const y = M.v3cross(z, x, [0, 0, 0]);
          m[0] = x[0]; m[1] = x[1]; m[2] = x[2];
          m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
          m[8] = z[0]; m[9] = z[1]; m[10] = z[2];
        }
        return m;
      };
      for (const vm of this.vehicleMeshes) {
        const fb = vd.flexbodies.find(f => f.name === vm.mesh.name);
        let mat = null;
        if (vm.isWheel) {
          // bind to the wheel body frame (axle X local space)
          const wname = vm.mesh.groups && vm.mesh.groups[0];
          const wheel = v.wheels.find(w => w.name === wname || (wname && wname.includes(w.name)));
          if (wheel) {
            mat = M.m4fromQuat(wheel.quat, M.m4());
            mat[12] = wheel.center[0]; mat[13] = wheel.center[1]; mat[14] = wheel.center[2];
          }
        } else if (fb) {
          mat = frameFor(fb.groups);
        }
        if (!mat) mat = M.m4id(M.m4());
        this.drawables[vm.draw].matWorld = mat;
      }
      // chassis rigid matrix for meshes bound to body groups
      const bodyMat = v.bodyMatrix(M.m4());
      for (const vm of this.vehicleMeshes) {
        if (vm.isWheel) continue;
        const fb = vd.flexbodies.find(f => f.name === vm.mesh.name);
        if (fb && fb.groups && fb.groups.some(g => (g || '').startsWith('ccf_body') || (g || '').startsWith('ccf_subframe'))) {
          this.drawables[vm.draw].matWorld = bodyMat;
        }
      }
    }

    // ---- world meshes ----
    addGround(geo) {
      const idx = new Uint32Array(geo.pos.length / 3);
      for (let i = 0; i < idx.length; i++) idx[i] = i;
      this.addMesh({ pos: geo.pos, nrm: geo.nrm, uv: geo.uv, col: geo.col }, idx, { color: [1, 1, 1], vcol: 1, shininess: 2, texture: geo.tex || null }, { ground: true });
    }

    addWater(geo) {
      const idx = new Uint32Array(geo.pos.length / 3);
      for (let i = 0; i < idx.length; i++) idx[i] = i;
      const d = this.makeVAO({ pos: geo.pos }, idx);
      this.drawables.push({ vao: d.vao, count: d.count, mat: null, water: true });
    }

    addSkyDome() {
      const gl = this.gl;
      const p = this.programs.sky;
      this.skyDraw = { vao: this.post.quad.vao, count: 4, prog: p };
    }

    resize(w, h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.post = this.initPost(); // recreate post FBOs at the new size
    }

    // ---- frame ----
    draw(camera, opts) {
      const gl = this.gl;
      const { viewProj, view, camPos } = camera;
      this._probeCam = camPos;
      this.time += opts.dt || 0;
      this.updateVehicleTransforms();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post.scene.fb);
      gl.viewport(0, 0, this.post.scene.w, this.post.scene.h);
      gl.clearColor(0.62, 0.75, 0.9, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // sky
      if (this.skyDraw) {
        gl.disable(gl.DEPTH_TEST);
        const p = this.skyDraw.prog;
        gl.useProgram(p);
        gl.bindVertexArray(this.skyDraw.vao);
        gl.uniform3fv(gl.getUniformLocation(p, 'uSunDir'), this.sunDir);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.enable(gl.DEPTH_TEST);
      }
      // toon drawables
      const tp = this.programs.toon;
      gl.useProgram(tp);
      const uModel = gl.getUniformLocation(tp, 'uModel');
      const uVP = gl.getUniformLocation(tp, 'uViewProj');
      const uNrm = gl.getUniformLocation(tp, 'uNrmMat');
      const uSun = gl.getUniformLocation(tp, 'uSunDir');
      const uSunCol = gl.getUniformLocation(tp, 'uSunCol');
      const uCam = gl.getUniformLocation(tp, 'uCamPos');
      const uCol = gl.getUniformLocation(tp, 'uColor');
      const uTexOn = gl.getUniformLocation(tp, 'uUseTex');
      const uTex = gl.getUniformLocation(tp, 'uTex');
      const uEmi = gl.getUniformLocation(tp, 'uEmissive');
      const uSh = gl.getUniformLocation(tp, 'uShininess');
      const uFogC = gl.getUniformLocation(tp, 'uFogColor');
      const uFogS = gl.getUniformLocation(tp, 'uFogStart');
      const uFogE = gl.getUniformLocation(tp, 'uFogEnd');
      const uShad = gl.getUniformLocation(tp, 'uShadow');
      const uAlpha = gl.getUniformLocation(tp, 'uAlpha');
      const uVCol = gl.getUniformLocation(tp, 'uUseVCol');
      const nrmMat = M.m4();
      const nrmMat3 = new Float32Array(9);
      const vpCache = M.m4();
      gl.uniform3fv(uSun, this.sunDir);
      gl.uniform3fv(uSunCol, this.sunCol);
      gl.uniform3fv(uCam, camPos);
      gl.uniform3fv(uFogC, this.fogColor);
      gl.uniform1f(uFogS, this.fogStart);
      gl.uniform1f(uFogE, this.fogEnd);
      gl.uniform1f(uShad, opts.shadow || 0);
      for (const d of this.drawables) {
        if (!d || d.water || !d.matWorld) continue;
        const m = d.matWorld || this._idMat;
        gl.uniformMatrix4fv(uModel, false, m);
        gl.uniformMatrix4fv(uVP, false, viewProj);
        M.m4transpose(M.m4inv(m, M.m4()), nrmMat);
        nrmMat3[0] = nrmMat[0]; nrmMat3[1] = nrmMat[1]; nrmMat3[2] = nrmMat[2];
        nrmMat3[3] = nrmMat[4]; nrmMat3[4] = nrmMat[5]; nrmMat3[5] = nrmMat[6];
        nrmMat3[6] = nrmMat[8]; nrmMat3[7] = nrmMat[9]; nrmMat3[8] = nrmMat[10];
        gl.uniformMatrix3fv(uNrm, false, nrmMat3);
        gl.uniform3fv(uCol, d.mat.color);
        gl.uniform3fv(uEmi, d.mat.emissive || [0, 0, 0]);
        gl.uniform1f(uSh, d.mat.shininess || 8);
        gl.uniform1f(uAlpha, d.mat.alpha !== undefined ? d.mat.alpha : 1);
        gl.uniform1f(uVCol, d.mat.vcol ? 1 : 0);
        if (d.mat.texture) {
          gl.uniform1f(uTexOn, 1);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.textureFromDataURL(d.mat.texture));
          gl.uniform1i(uTex, 0);
        } else gl.uniform1f(uTexOn, 0);
        if (d.mat.alpha !== undefined && d.mat.alpha < 1) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.disable(gl.CULL_FACE);
        } else {
          gl.disable(gl.BLEND);
          gl.enable(gl.CULL_FACE);
        }
        gl.bindVertexArray(d.vao);
        gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
      }
      // water
      const wp = this.programs.water;
      gl.useProgram(wp);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      gl.uniformMatrix4fv(gl.getUniformLocation(wp, 'uViewProj'), false, viewProj);
      gl.uniform3fv(gl.getUniformLocation(wp, 'uSunDir'), this.sunDir);
      gl.uniform3fv(gl.getUniformLocation(wp, 'uSunCol'), this.sunCol);
      gl.uniform3fv(gl.getUniformLocation(wp, 'uCamPos'), camPos);
      gl.uniform3fv(gl.getUniformLocation(wp, 'uFogColor'), this.fogColor);
      gl.uniform1f(gl.getUniformLocation(wp, 'uFogStart'), this.fogStart);
      gl.uniform1f(gl.getUniformLocation(wp, 'uFogEnd'), this.fogEnd);
      gl.uniform1f(gl.getUniformLocation(wp, 'uTime'), this.time);
      const wm = M.m4id(M.m4());
      gl.uniformMatrix4fv(gl.getUniformLocation(wp, 'uModel'), false, wm);
      for (const d of this.drawables) {
        if (!d || !d.water) continue;
        gl.bindVertexArray(d.vao);
        gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
      }
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      // NPR outline pass (inverted hull on vehicle meshes)
      if (this.enableOutline !== false) this.drawOutlines(viewProj);
      // lines
      this.drawLines(viewProj, camPos);
      // bloom post
      this.bloom();
    }

    drawOutlines(viewProj) {
      const gl = this.gl;
      const p = this.programs.outline;
      gl.useProgram(p);
      const uModel = gl.getUniformLocation(p, 'uModel');
      const uVP = gl.getUniformLocation(p, 'uViewProj');
      const uNrm = gl.getUniformLocation(p, 'uNrmMat');
      const uW = gl.getUniformLocation(p, 'uWidth');
      const uCol = gl.getUniformLocation(p, 'uColor');
      gl.uniformMatrix4fv(uVP, false, viewProj);
      gl.uniform1f(uW, 0.018);
      gl.uniform3f(uCol, 0.05, 0.07, 0.12);
      gl.cullFace(gl.FRONT);
      gl.disable(gl.BLEND);
      const nrmMat = M.m4();
      const nrmMat3 = new Float32Array(9);
      for (const vm of this.vehicleMeshes) {
        const d = this.drawables[vm.draw];
        if (!d || !d.matWorld) continue;
        if (d.mat.alpha !== undefined && d.mat.alpha < 1) continue; // skip glass
        const m = d.matWorld;
        gl.uniformMatrix4fv(uModel, false, m);
        M.m4transpose(M.m4inv(m, M.m4()), nrmMat);
        nrmMat3[0] = nrmMat[0]; nrmMat3[1] = nrmMat[1]; nrmMat3[2] = nrmMat[2];
        nrmMat3[3] = nrmMat[4]; nrmMat3[4] = nrmMat[5]; nrmMat3[5] = nrmMat[6];
        nrmMat3[6] = nrmMat[8]; nrmMat3[7] = nrmMat[9]; nrmMat3[8] = nrmMat[10];
        gl.uniformMatrix3fv(uNrm, false, nrmMat3);
        gl.bindVertexArray(d.vao);
        gl.drawElements(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0);
      }
      gl.cullFace(gl.BACK);
    }

    removeMesh(id) {
      if (id !== undefined && id !== null) this.drawables[id] = null;
    }

    drawLines(viewProj, camPos) {
      if (!this.lines.length) return;
      const gl = this.gl;
      const p = this.programs.line;
      gl.useProgram(p);
      gl.disable(gl.DEPTH_TEST);
      // CPU-side expansion into clip space (constant screen-pixel width)
      const verts = [];
      for (const l of this.lines) {
        const ca = M.m4mulV4(viewProj, [l.a[0], l.a[1], l.a[2], 1], [0, 0, 0, 0]);
        const cb = M.m4mulV4(viewProj, [l.b[0], l.b[1], l.b[2], 1], [0, 0, 0, 0]);
        const pa = [ca[0] / ca[3], ca[1] / ca[3]];
        const pb = [cb[0] / cb[3], cb[1] / cb[3]];
        let dx = pb[0] - pa[0], dy = pb[1] - pa[1];
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
        const hw = (l.width * 0.5) / this.canvas.height * 2;
        const nx = -dy * hw, ny = dx * hw;
        const col = [l.color[0], l.color[1] !== undefined ? l.color[1] : l.color[0], l.color[2] !== undefined ? l.color[2] : l.color[0], 1];
        verts.push(pa[0] + nx, pa[1] + ny, ca[2] / ca[3], col[0], col[1], col[2], col[3]);
        verts.push(pa[0] - nx, pa[1] - ny, ca[2] / ca[3], col[0], col[1], col[2], col[3]);
        verts.push(pb[0] + nx, pb[1] + ny, cb[2] / cb[3], col[0], col[1], col[2], col[3]);
        verts.push(pb[0] - nx, pb[1] - ny, cb[2] / cb[3], col[0], col[1], col[2], col[3]);
      }
      const data = new Float32Array(verts);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.lines.length * 4);
      gl.enable(gl.DEPTH_TEST);
    }

    bloom() {
      const gl = this.gl;
      const post = this.post;
      // bright pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.bright.fb);
      gl.viewport(0, 0, post.bright.w, post.bright.h);
      gl.useProgram(post.brightProg);
      gl.bindVertexArray(post.quad.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, post.scene.tex);
      gl.uniform1i(gl.getUniformLocation(post.brightProg, 'uTex'), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // blur x2
      for (const target of [post.blur, post.bright]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.useProgram(post.blurProg);
        gl.bindTexture(gl.TEXTURE_2D, target === post.blur ? post.bright.tex : post.blur.tex);
        gl.uniform1i(gl.getUniformLocation(post.blurProg, 'uTex'), 0);
        gl.uniform2f(gl.getUniformLocation(post.blurProg, 'uDir'), 1, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindTexture(gl.TEXTURE_2D, target === post.blur ? post.bright.tex : post.blur.tex);
        gl.uniform2f(gl.getUniformLocation(post.blurProg, 'uDir'), 0, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(post.compProg);
      gl.bindVertexArray(post.quad.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, post.scene.tex);
      gl.uniform1i(gl.getUniformLocation(post.compProg, 'uScene'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, post.bright.tex);
      gl.uniform1i(gl.getUniformLocation(post.compProg, 'uBloom'), 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  return { Renderer };
})();

if (typeof globalThis !== 'undefined') globalThis.Renderer = Renderer;
if (typeof module !== 'undefined' && module.exports) module.exports = Renderer;
