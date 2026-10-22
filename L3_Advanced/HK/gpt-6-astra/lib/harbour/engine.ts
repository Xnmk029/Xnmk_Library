import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { BOUNDS, GRID, LANDMARKS, VIEWS, hash, project, unproject, type CityData, type Point } from './geo';
import { VoxelWorld, CELL, NX, NZ } from './world';
import { VoxelStore } from './grid';

export interface FrameInfo { fps: number; calls: number; visibleChunks: number; heading: number; position: [number,number,number]; lon: number; lat: number; labels: { id: string; x: number; y: number; visible: boolean }[]; }
export interface Settings { hour: number; grid: boolean; chunks: boolean; labels: boolean; motion: boolean; weather: 'clear' | 'haze' | 'rain'; quality: 'high' | 'balanced'; }
type Transition = { from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3; start: number; duration: number; };
type Moving = { group: THREE.Group; path: THREE.Vector3[]; length: number; speed: number; offset: number; boat?: boolean; wake?: THREE.Mesh; };

export class HarbourEngine {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, .15, 18000);
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  world: VoxelWorld;
  data: CityData;
  settings: Settings = { hour: 17.5, grid: false, chunks: false, labels: true, motion: true, weather: 'clear', quality: 'high' };
  mode: 'orbit' | 'walk' = 'orbit';
  detailStore = new VoxelStore();
  propsStore = new VoxelStore();
  private chunkMeshes: THREE.Mesh[] = [];
  private chunkLines = new THREE.Group();
  private detailGroup = new THREE.Group();
  private dynamic = new THREE.Group();
  private moving: Moving[] = [];
  private sky: THREE.Mesh;
  private water: THREE.Mesh;
  private reflection: Reflector;
  private rain: THREE.LineSegments;
  private sun = new THREE.DirectionalLight('#fff0cd', 3.5);
  private ambient = new THREE.HemisphereLight('#c6d9e1', '#5e665d', 2.2);
  private uniforms = { uTime: { value: 0 }, uGrid: { value: 0 }, uNight: { value: 0 }, uHaze: { value: 0 }, uRain: { value: 0 }, uReflect: { value: 1 } };
  private raf = 0;
  private last = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private simulationTime = 0;
  private transition: Transition | null = null;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private velocityY = 0;
  private footY = 4;
  private dragging = false;
  private lastDetail = '';
  private resizeObserver: ResizeObserver;
  private destroyed = false;
  private audioContext: AudioContext | null = null;
  private audioGain: GainNode | null = null;
  private audioPanner: PannerNode | null = null;
  private horn: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private savedOrbit: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  onFrame: (frame: FrameInfo) => void;
  onLock: (locked: boolean) => void;

  constructor(host: HTMLElement, data: CityData, onFrame: (f: FrameInfo) => void, onLock: (b: boolean) => void) {
    this.data = data; this.onFrame = onFrame; this.onLock = onLock;
    this.world = new VoxelWorld(data).build();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '维多利亚港交互式三维体素沙盘');
    this.renderer.domElement.tabIndex = 0;
    host.appendChild(this.renderer.domElement);
    this.camera.position.fromArray(VIEWS[0].position);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.fromArray(VIEWS[0].target);
    this.controls.enableDamping = true; this.controls.dampingFactor = .075;
    this.controls.minDistance = 18; this.controls.maxDistance = 9000;
    this.controls.maxPolarAngle = Math.PI / 2 - .035;
    this.controls.minPolarAngle = .12;
    this.controls.zoomSpeed = .7; this.controls.panSpeed = .8;
    this.controls.update();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, .04).texture;
    this.scene.environmentIntensity = .35;
    room.dispose(); pmrem.dispose();
    this.scene.add(this.ambient, this.sun, this.sun.target, this.chunkLines, this.dynamic, this.detailGroup);
    this.sun.position.set(-2400, 2400, 1400);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -3400, right: 3400, top: 3400, bottom: -3400, near: 1, far: 9500 });
    this.sun.shadow.bias = -.0002;
    this.sun.shadow.normalBias = 1.5;
    this.sun.shadow.camera.updateProjectionMatrix();
    const material = this.cityMaterial();
    for (const c of this.world.chunks) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(c.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(c.normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(c.colors, 3));
      geometry.setAttribute('voxelKind', new THREE.Float32BufferAttribute(c.kinds, 1));
      geometry.setIndex(c.indices);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.center = c.center;
      this.scene.add(mesh); this.chunkMeshes.push(mesh);
      const box = new THREE.Box3(new THREE.Vector3(c.center[0] - 128, 0, c.center[1] - 128), new THREE.Vector3(c.center[0] + 128, 512, c.center[1] + 128));
      const lines = new THREE.Box3Helper(box, '#bca983');
      (lines.material as THREE.LineBasicMaterial).transparent = true; (lines.material as THREE.LineBasicMaterial).opacity = .22;
      this.chunkLines.add(lines);
      // Typed GPU buffers now own the mesh; release temporary JS arrays.
      c.positions = []; c.normals = []; c.colors = []; c.kinds = []; c.indices = [];
    }
    this.chunkLines.visible = false;
    this.sky = this.makeSky(); this.scene.add(this.sky);
    this.water = this.makeWater(); this.scene.add(this.water);
    this.reflection = new Reflector(new THREE.PlaneGeometry(15000,15000,32,32), { color: '#758c91', textureWidth: 1024, textureHeight: 1024, clipBias: .001, multisample: 0 });
    this.reflection.rotateX(-Math.PI/2);this.reflection.position.y=-.5;
    const renderReflection=this.reflection.onBeforeRender;
    this.reflection.onBeforeRender=(...args)=>{this.water.visible=false;try{renderReflection.apply(this.reflection,args);}finally{this.water.visible=true;}};
    this.scene.add(this.reflection);
    this.rain=this.makeRain();this.scene.add(this.rain);
    this.makeProps(); this.makeTraffic();
    this.setSettings(this.settings);
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); };
    this.resizeObserver = new ResizeObserver(resize); this.resizeObserver.observe(host); resize();
    window.addEventListener('keydown', this.keyDown); window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('pointerlockchange', this.lockChange);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pointermove', this.pointerMove);
    this.raf = requestAnimationFrame(this.tick);
  }
  private cityMaterial() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .18 });
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = `attribute float voxelKind; varying float vKind; varying vec3 vGridPosition; varying vec3 vGridNormal;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGridPosition = (modelMatrix * vec4(position, 1.0)).xyz; vGridNormal = normal; vKind = voxelKind;');
      shader.fragmentShader = `uniform float uTime; uniform float uGrid; uniform float uNight; uniform float uRain; varying float vKind; varying vec3 vGridPosition; varying vec3 vGridNormal;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 faceUV = abs(vGridNormal.x) > .5 ? vGridPosition.zy : vGridPosition.xy;
        float windowMask = 0.0;
        if (vKind > 0.5 && abs(vGridNormal.y) < .5 && vGridPosition.y > 8.0) {
          vec2 cell = mod(faceUV, 4.0);
          windowMask = step(.5, cell.x) * step(cell.x, 3.5) * step(.5, cell.y) * step(cell.y, 3.0);
          float variation = fract(sin(dot(floor(faceUV / 4.0), vec2(12.9898,78.233)) + vKind) * 43758.5453);
          diffuseColor.rgb *= mix(1.1, .58 + variation * .25, windowMask);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.79, 1.04, 1.14), windowMask * .5);
        }
        if (uGrid > .5) {
          float dist = distance(cameraPosition, vGridPosition);
          float unit = dist < 100.0 ? .5 : dist < 700.0 ? 4.0 : 32.0;
          vec2 uv = abs(vGridNormal.y) > .5 ? vGridPosition.xz : faceUV;
          vec2 g = abs(fract(uv / unit - .5) - .5) / max(fwidth(uv / unit), vec2(.001));
          float line = 1.0 - min(min(g.x, g.y), 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.5,.82,.62), line * .65);
        }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lit = step(.43, fract(sin(dot(floor(faceUV / 4.0), vec2(23.13,54.87)) + vKind) * 19483.31));
        totalEmissiveRadiance += vec3(1.0,.57,.2) * windowMask * lit * uNight * .8;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor = mix(.84, .3, windowMask) * mix(1.0,.7,uRain);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = mix(.07, .36, windowMask);');
    };
    return mat;
  }
  private makeSky() {
    const material = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { ...this.uniforms, uTop: { value: new THREE.Color('#87999c') }, uBottom: { value: new THREE.Color('#d8c7ab') } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vDir; uniform float uTime; uniform float uNight; uniform vec3 uTop; uniform vec3 uBottom; void main(){ vec3 d=normalize(vDir); float h=pow(max(d.y,0.0),.6); vec3 c=mix(uBottom,uTop,h); float cloud=sin(d.x*28.0+uTime*.012)*sin(d.z*37.0+uTime*.006); cloud=smoothstep(.65,.95,cloud)*smoothstep(.05,.4,d.y)*.09; c+=cloud*(1.0-uNight); gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }' });
    return new THREE.Mesh(new THREE.SphereGeometry(14000, 32, 16), material);
  }
  private makeWater() {
    const geo = new THREE.PlaneGeometry(15000, 15000, 256, 256); geo.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({ uniforms: { ...this.uniforms, uSun: { value: new THREE.Vector3(-.7,.3,.4).normalize() } }, transparent: true, depthWrite: false,
      vertexShader: `uniform float uTime; varying vec3 vWorld; void main(){ vec3 p=position; p.y=sin(p.x*.021+uTime*.75)*.16+cos(p.z*.028+uTime*.5)*.14; vWorld=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `uniform float uTime; uniform float uNight; uniform float uGrid; uniform float uHaze; uniform float uReflect; uniform vec3 uSun; varying vec3 vWorld;
        void main(){ vec2 p=vWorld.xz; float a=sin(p.x*.036+p.y*.014+uTime*.7); float b=sin(p.y*.052-p.x*.013+uTime*.4); float fine=sin(p.x*.27+sin(p.y*.13)+uTime)*sin(p.y*.2+uTime*.9);
          vec3 n=normalize(vec3(a*.035+fine*.021,1.0,b*.04)); vec3 view=normalize(cameraPosition-vWorld); float fres=pow(1.0-max(dot(n,view),0.0),3.0);
          vec3 deep=mix(vec3(.16,.265,.28),vec3(.025,.055,.085),uNight); vec3 reflection=mix(vec3(.63,.61,.51),vec3(.085,.12,.19),uNight);
          vec3 col=mix(deep,reflection,fres*.74); col+=(a*b*.012+fine*.014)*(1.0-uNight*.7);
          float spec=pow(max(dot(reflect(-uSun,n),view),0.0),180.0); col+=vec3(.95,.74,.42)*spec*(1.0-uNight)*.7;
          float shimmer=pow(max(sin(p.y*.16+uTime+sin(p.x*.008)*3.0),0.0),18.0)*.017; col+=shimmer;
          if(uGrid>.5){ vec2 g=abs(fract(p/32.0-.5)-.5)/max(fwidth(p/32.0),vec2(.001)); col=mix(col,vec3(.65,.75,.55),(1.0-min(min(g.x,g.y),1.0))*.3); }
          float fog=smoothstep(4500.0,14000.0,distance(cameraPosition,vWorld)); col=mix(col,reflection,fog*.45); gl_FragColor=vec4(col,mix(1.0,.72,uReflect));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const water = new THREE.Mesh(geo, material); water.position.y = 0; return water;
  }
  private makeRain() {
    const p:number[]=[];
    for(let i=0;i<1400;i++){const x=(hash(i+78)-.5)*160,y=hash(i+981)*80,z=(hash(i+21)-.5)*160;p.push(x,y,z,x-.2,y-2.5,z);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    const mat=new THREE.ShaderMaterial({uniforms:this.uniforms,transparent:true,depthWrite:false,
      vertexShader:'uniform float uTime; varying float vAlpha; void main(){vec3 p=position;p.y=mod(p.y-uTime*20.0,80.0)-15.0;vAlpha=1.0-length(p.xz)/115.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
      fragmentShader:'varying float vAlpha;void main(){gl_FragColor=vec4(.72,.82,.84,max(vAlpha,0.0)*.22);}' });
    const rain=new THREE.LineSegments(geo,mat);rain.frustumCulled=false;rain.visible=false;return rain;
  }
  private instances(store: VoxelStore, parent: THREE.Object3D, colors: string[]) {
    const grouped = new Map<number, typeof store.runs>();
    for (const r of store.runs) { if (!grouped.has(r.material)) grouped.set(r.material, []); grouped.get(r.material)!.push(r); }
    const matrix = new THREE.Matrix4(), geo = new THREE.BoxGeometry(1, 1, 1);
    for (const [material, runs] of grouped) {
      const mat = new THREE.MeshStandardMaterial({ color: colors[material % colors.length], roughness: material === 2 ? .32 : .85, metalness: material === 2 ? .35 : .04, emissive: material === 5 ? '#ffd39b' : '#000000', emissiveIntensity: material === 5 ? .5 : 0 });
      const mesh = new THREE.InstancedMesh(geo, mat, runs.length);
      runs.forEach((r, i) => { matrix.makeScale(r.w * GRID, r.h * GRID, r.d * GRID); matrix.setPosition((r.x + r.w / 2) * GRID, (r.y + r.h / 2) * GRID, (r.z + r.d / 2) * GRID); mesh.setMatrixAt(i, matrix); });
      mesh.computeBoundingSphere(); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    }
  }
  private makeProps() {
    const s = this.propsStore;
    for (const [x,y,z] of this.world.trees) {
      const height = 5 + Math.floor(hash(x + z) * 4);
      if([[-2,-2],[3,-2],[-2,3],[3,3]].some(([dx,dz])=>this.world.height(x+dx,z+dz)>y+height-2))continue;
      s.addUnion(x, y, z, 1, height - 2, 1, 0);
      s.addUnion(x - 2, y + height - 2, z - 2, 5, 2, 5, 1);
      s.addUnion(x - 1, y + height, z - 1, 3, 1, 3, 1);
    }
    for (const [x,y,z] of this.world.lamps) {
      if(s.intersects(x-1,y,z-1,3,6,3))continue;
      s.addUnion(x, y, z, .5, 5, .5, 2); s.addUnion(x - .5, y + 5, z - .5, 1.5, .5, 1.5, 5);
      // A waterfront bench occupies its own cells beside each light.
      if (this.world.clear(x + 4,z,3)&&this.world.height(x+3,z)===y&&this.world.height(x+5,z)===y&&!s.intersects(x+3,y,z,2.5,1.5,1)) { s.addUnion(x+3,y,z, .5, .5, 1, 2); s.addUnion(x+5,y,z,.5,.5,1,2); s.addUnion(x+3,y+.5,z,2.5,.5,1,0); s.addUnion(x+3,y+1,z+.5,2.5,.5,.5,0); }
    }
    const boc = project(LANDMARKS[1].lon, LANDMARKS[1].lat);
    // Exterior diagonal trusses are sampled into axis-aligned 0.5 m cells.
    // They attach to the tower faces; no rotated boxes or floating diagonal mesh.
    for(let x=Math.floor((boc[0]-40)/4)*4;x<boc[0]+40;x+=4)for(let z=Math.floor((boc[1]-40)/4)*4;z<boc[1]+40;z+=4){
      const i=this.world.index(x,z);if(i<0||this.world.landmarkIds.get(this.world.owner[i])!=='boc')continue;
      const top=this.world.top[i]*.5;
      for(let side=0;side<4;side++){
        const adjacent=this.world.height(x+(side===0?-4:side===1?4:0),z+(side===2?-4:side===3?4:0));
        if(adjacent>=top)continue;
        const u=side<2?(z+2-boc[1]+28)/56:(x+2-boc[0]+28)/56;
        for(let y=Math.ceil(Math.max(4,adjacent)/2)*2;y<top;y+=2){
          const t=((y-4)%100)/100;if(Math.abs(u-t)>.055&&Math.abs(u-(1-t))>.055)continue;
          const h=Math.min(2,top-y);
          if(side<2)s.addUnion(side===0?x-.5:x+4,y,z,.5,h,4,4);else s.addUnion(x,y,side===2?z-.5:z+4,4,h,.5,4);
        }
      }
    }
    for (const dx of [-8, 4]) {
      const x = Math.round((boc[0]+dx)*2)/2, z = Math.round((boc[1]-15)*2)/2, y = this.world.height(x,z);
      if (y>0) s.addUnion(x,y,z,1,Math.max(.5,Math.round((371.5-y)*2)/2),1,2);
    }
    this.instances(s, this.scene, ['#776247','#58724e','#9da6a5','#c9c7b7','#d7dacc','#ffcf86']);
  }
  private vehicle(kind: 'boat' | 'bus' | 'person', n: number) {
    const group = new THREE.Group(), s = new VoxelStore();
    if (kind === 'boat') {
      // Local 0.5 m grid; motion only transforms this complete rigid object.
      for (let z = -16; z < 16; z++) {
        const w = Math.min(4, Math.floor((16 - Math.abs(z)) * .6) + 1);
        s.addUnion(-w,0,z,w*2,1.5,1,0);
      }
      s.addUnion(-3,1.5,-11,6,2,22,1); s.addUnion(-3,3.5,-11,6,.5,22,2);
      for (let z=-10;z<11;z+=2) { s.addUnion(-3,4,z,1,1.5,1,2); s.addUnion(2,4,z,1,1.5,1,2); }
      s.addUnion(-3,5.5,-11,6,.5,22,1); s.addUnion(-2,6,-5,4,.5,10,2); s.addUnion(-.5,6.5,2,1,3,1,3);
    } else if (kind === 'bus') {
      s.addUnion(-1,0,-5,2,1,10,0); s.addUnion(-1,1,-5,2,2.5,10,1);
      for(let z=-4;z<5;z+=2) { s.addUnion(-1,3.5,z,2,.5,1,2); }
      s.addUnion(-1,4,-5,2,.5,10,1);
    } else {
      s.addUnion(-.5,0,0,.5,1,.5,0); s.addUnion(.5,0,0,.5,1,.5,0); s.addUnion(-.5,1,0,1.5,.5,.5,1); s.addUnion(0,1.5,0,.5,.5,.5,3);
    }
    const colors = kind==='boat' ? ['#244c46','#ddd8bd','#7399a1','#b7774b'] : ['#354044', ['#a4513f','#c8aa6e','#698c89'][n%3], '#43626e','#c7ac8b'];
    this.instances(s,group,colors); return group;
  }
  private addMover(group: THREE.Group, p: Point[], speed: number, offset: number, boat = false) {
    const seaClear=(x:number,z:number)=>[[-8,-8],[8,-8],[-8,8],[8,8],[0,0]].every(([dx,dz])=>this.world.height(x+dx,z+dz)<0&&this.world.index(x+dx,z+dz)>=0);
    if(boat){
      p=p.map(([x,z])=>{if(seaClear(x,z))return[x,z];for(let r=8;r<240;r+=8)for(let k=0;k<24;k++){const px=x+Math.cos(k*Math.PI/12)*r,pz=z+Math.sin(k*Math.PI/12)*r;if(seaClear(px,pz))return[px,pz];}return[x,z];});
    }
    for(let n=1;n<p.length;n++){
      const a=p[n-1],b=p[n],steps=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/8);
      for(let k=0;k<=steps;k++){const u=steps?k/steps:0,x=a[0]+(b[0]-a[0])*u,z=a[1]+(b[1]-a[1])*u;if(boat?!seaClear(x,z):!this.world.isWalkable(x,z))return;}
    }
    const path = p.map(([x,z]) => new THREE.Vector3(x, boat ? .2 : this.world.height(x,z), z));
    let length = 0; for(let i=1;i<path.length;i++) length+=path[i].distanceTo(path[i-1]);
    if (length<10) return;
    const mover: Moving = {group,path,length,speed,offset,boat};
    if (boat) {
      const shape = new THREE.Shape(); shape.moveTo(0,0);shape.lineTo(-7,-95);shape.lineTo(-1,-22);shape.lineTo(1,-22);shape.lineTo(7,-95);shape.lineTo(0,0);
      const wake = new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#d6ded0',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}));
      wake.rotation.x=-Math.PI/2; this.dynamic.add(wake); mover.wake=wake;
    }
    this.dynamic.add(group); this.moving.push(mover);
  }
  private makeTraffic() {
    const routes: Point[][] = [
      [project(114.1604,22.2874),project(114.163,22.29),project(114.1693,22.2933)],
      [project(114.1746,22.285),project(114.175,22.2885),project(114.1698,22.2928)],
      [[-2700,100],[-1600,-50],[-200,-50],[1400,-300],[2600,-600]],
    ];
    for(let n=0;n<8;n++) this.addMover(this.vehicle('boat',n),routes[n%3],6+n%3,n*.127,true);
    const roads=this.data.roads.filter(r=>r.p.length>2 && !/Tunnel|Elevated|Flyover/i.test(r.kind||''));
    for(let n=0;n<24;n++) {
      const road=roads[Math.floor(hash(n+70)*roads.length)]; if(!road)continue;
      const path=road.p.filter(p=>this.world.isWalkable(...p));
      if(path.length>1)this.addMover(this.vehicle('bus',n),path,7+n%3,hash(n));
    }
    for(let n=0;n<36 && this.world.walkable.length;n++) {
      const p=this.world.walkable[Math.floor(hash(n+230)*this.world.walkable.length)];
      const next=this.world.walkable.find(q=>Math.hypot(q[0]-p[0],q[1]-p[1])>30 && Math.hypot(q[0]-p[0],q[1]-p[1])<70 && this.world.isWalkable((p[0]+q[0])/2,(p[1]+q[1])/2));
      if(next)this.addMover(this.vehicle('person',n),[p,next],1.2,hash(n+19));
    }
  }
  setSettings(settings: Partial<Settings>) {
    Object.assign(this.settings,settings);
    const h=this.settings.hour, daylight=Math.max(0,Math.sin((h-5.8)/13.4*Math.PI));
    const night=1-THREE.MathUtils.smoothstep(daylight,.02,.22), golden=1-THREE.MathUtils.smoothstep(daylight,.25,.8);
    this.uniforms.uNight.value=night; this.uniforms.uGrid.value=this.settings.grid?1:0;
    this.uniforms.uHaze.value=this.settings.weather==='clear'?0:1;
    this.uniforms.uRain.value=this.settings.weather==='rain'?1:0;
    this.rain.visible=this.settings.weather==='rain';
    this.chunkLines.visible=this.settings.chunks;
    this.sun.intensity=(this.settings.weather==='rain'?.85:3.3)*Math.max(.04,daylight);
    this.sun.color.set('#fff3de').lerp(new THREE.Color('#ffcc89'),golden*.55);
    this.sun.position.set(Math.cos((h-6)/12*Math.PI)*3600,Math.max(280,daylight*4200),1700);
    this.ambient.intensity=.55+daylight*1.7;
    this.ambient.color.set('#c1d5e2').lerp(new THREE.Color('#697b9b'),night);
    const skyMaterial=this.sky.material as THREE.ShaderMaterial;
    skyMaterial.uniforms.uTop.value.set('#8fa4ab').lerp(new THREE.Color('#121e37'),night);
    skyMaterial.uniforms.uBottom.value.set('#d2c7b0').lerp(new THREE.Color('#233449'),night);
    if(this.settings.weather==='rain'){skyMaterial.uniforms.uTop.value.multiplyScalar(.65);skyMaterial.uniforms.uBottom.value.multiplyScalar(.65);}
    (this.water.material as THREE.ShaderMaterial).uniforms.uSun.value.copy(this.sun.position).normalize();
    const fogColor=new THREE.Color('#bcbba8').lerp(new THREE.Color('#182a3a'),night);
    this.scene.fog=new THREE.FogExp2(fogColor,this.settings.weather==='clear'?.000045:this.settings.weather==='haze'?.00015:.0002);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,this.settings.quality==='high'?1.6:1));
    this.renderer.shadowMap.enabled=this.settings.quality==='high';
  }
  flyView(id: string) {
    const view=VIEWS.find(v=>v.id===id)||VIEWS[0];
    if(this.mode==='walk') { this.teleport(...project(view.walk[0],view.walk[1])); return; }
    this.fly(new THREE.Vector3(...view.position),new THREE.Vector3(...view.target));
  }
  flyLandmark(id: string) {
    const l=LANDMARKS.find(v=>v.id===id); if(!l)return;
    const [x,z]=project(l.lon,l.lat);
    if(this.mode==='walk') { this.teleport(x+70,z-90); return; }
    const dist=l.id==='hkcec'?520:Math.max(l.height*1.9,550);
    this.fly(new THREE.Vector3(x+dist*.72,dist*.64,z-dist),new THREE.Vector3(x,l.height*.35,z));
  }
  private fly(to: THREE.Vector3,target: THREE.Vector3) {
    this.transition={from:this.camera.position.clone(),to,targetFrom:this.controls.target.clone(),targetTo:target,start:performance.now(),duration:1600};
  }
  zoom(delta: number) { if(this.mode==='walk')return; const offset=this.camera.position.clone().sub(this.controls.target);offset.multiplyScalar(delta>0?.78:1.28);this.fly(this.controls.target.clone().add(offset),this.controls.target.clone()); }
  north() { const target=this.controls.target.clone(),distance=this.camera.position.distanceTo(target);this.fly(target.clone().add(new THREE.Vector3(0,distance*.65,-distance*.76)),target); }
  setMode(mode: 'orbit' | 'walk', viewId = 'tsim') {
    if(mode===this.mode)return;
    this.keys.clear(); this.transition=null;
    if(mode==='walk') {
      this.savedOrbit={position:this.camera.position.clone(),target:this.controls.target.clone()};
      this.mode='walk'; this.controls.enabled=false;
      const target=this.controls.target;
      const view=VIEWS.find(v=>v.id===viewId)||VIEWS[1];
      const p=this.camera.position.distanceTo(target)<1000 && this.world.isWalkable(target.x,target.z)?[target.x,target.z]:project(view.walk[0],view.walk[1]);
      const [x,z]=this.world.nearestWalk(p[0],p[1]);
      this.footY=this.world.height(x,z); this.velocityY=0;
      this.yaw=Math.PI; this.pitch=0;
      const to=new THREE.Vector3(x,this.footY+1.7,z),look=to.clone().add(new THREE.Vector3(0,0,20));
      this.fly(to,look);
      this.requestLock();
    } else {
      this.mode='orbit'; document.exitPointerLock?.();this.controls.enabled=true;
      const target=this.camera.position.clone();target.y=Math.max(4,target.y-1.7);
      this.controls.target.copy(target);
      const to=target.clone().add(new THREE.Vector3(600,680,-850));
      this.fly(to,target); this.detailGroup.visible=false;
    }
  }
  teleport(x: number,z: number) {
    const p=this.world.nearestWalk(x,z), y=this.world.height(...p)+1.7;
    if(this.mode==='walk'){this.footY=y-1.7;this.velocityY=0;this.fly(new THREE.Vector3(p[0],y,p[1]),new THREE.Vector3(p[0],y,p[1]+20));}
    else this.fly(new THREE.Vector3(p[0]+400,650,p[1]-600),new THREE.Vector3(p[0],25,p[1]));
  }
  requestLock() { if(this.mode==='walk')this.renderer.domElement.requestPointerLock?.()?.catch(()=>this.onLock(false)); }
  setKey(key: string,down: boolean) { down?this.keys.add(key):this.keys.delete(key); }
  private keyDown=(event: KeyboardEvent)=> {
    if((event.target as HTMLElement).closest('input,textarea,[role="slider"],[role="dialog"]'))return;
    if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){this.keys.add(event.code);if(this.mode==='walk')event.preventDefault();}
  };
  private keyUp=(e: KeyboardEvent)=>this.keys.delete(e.code);
  private blur=()=>{this.keys.clear();this.dragging=false;};
  private lockChange=()=>{this.keys.clear();this.onLock(document.pointerLockElement===this.renderer.domElement);};
  private pointerDown=(e: PointerEvent)=>{ if(this.mode==='walk'){this.dragging=true;if(e.pointerType==='mouse')this.requestLock();}else this.transition=null; };
  private pointerUp=()=>{this.dragging=false;};
  private pointerMove=(e: PointerEvent)=>{if(this.mode==='walk'&&!this.transition&&(document.pointerLockElement===this.renderer.domElement||this.dragging)){this.yaw-=e.movementX*.002;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.002,-1.35,1.35);}};
  private canMove(x: number,z: number) {
    for(const [dx,dz] of [[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]]) {
      const y=this.world.height(x+dx,z+dz);if(y < -20 || y-this.footY>.51)return false;
      if(this.propsStore.occupied(x+dx,this.footY+1,z+dz))return false;
      if(this.detailStore.occupied(x+dx,this.footY+1,z+dz))return false;
    }
    return true;
  }
  private walk(dt: number) {
    const forward=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'));
    const right=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
    const len=Math.hypot(forward,right)||1,speed=this.keys.has('ShiftLeft')?4.4:1.65;
    const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right)/len*speed*dt;
    const dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right)/len*speed*dt;
    if(this.canMove(this.camera.position.x+dx,this.camera.position.z))this.camera.position.x+=dx;
    if(this.canMove(this.camera.position.x,this.camera.position.z+dz))this.camera.position.z+=dz;
    const floor=this.world.height(this.camera.position.x,this.camera.position.z);
    const grounded=this.footY<=floor+.02;
    if(grounded&&this.keys.has('Space'))this.velocityY=3.6;
    this.velocityY-=9.81*dt;this.footY=Math.max(floor,this.footY+this.velocityY*dt);
    if(this.footY===floor)this.velocityY=0;
    this.camera.position.y=THREE.MathUtils.damp(this.camera.position.y,this.footY+1.7,20,dt);
    this.camera.rotation.order='YXZ';this.camera.rotation.set(this.pitch,this.yaw,0);
    this.updateDetail();
  }
  private updateDetail() {
    const px=Math.floor(this.camera.position.x/64)*64,pz=Math.floor(this.camera.position.z/64)*64,key=`${px},${pz}`;
    if(key===this.lastDetail){this.detailGroup.visible=true;return;}
    this.lastDetail=key;
    this.clearGroup(this.detailGroup);this.detailStore=new VoxelStore();
    const s=this.detailStore;
    for(let x=px-92;x<px+156;x+=CELL)for(let z=pz-92;z<pz+156;z+=CELL){
      const i=this.world.index(x,z);if(i<0||!this.world.owner[i])continue;
      if(this.world.landmarkIds.get(this.world.owner[i])==='boc')continue;
      const top=this.world.top[i]*.5,g=this.world.ground[i]*.5;
      for(let side=0;side<4;side++){
        const nx=x+(side===0?-4:side===1?4:0),nz=z+(side===2?-4:side===3?4:0),near=this.world.height(nx,nz);
        const low=Math.max(g,near);if(low>=top)continue;
        for(let y=Math.ceil(low/4)*4;y<Math.min(top,Math.max(g+32,this.camera.position.y+36));y+=4){
          const height=Math.min(4,top-y);if(height<=0)continue;
          if(side<2){const fx=side===0?x-.5:x+4;s.addUnion(fx,y,z,.5,.5,4,0);if(height>.5){s.addUnion(fx,y+.5,z,.5,height-.5,.5,0);s.addUnion(fx,y+.5,z+3.5,.5,height-.5,.5,0);}}
          else {const fz=side===2?z-.5:z+4;s.addUnion(x,y,fz,4,.5,.5,0);if(height>.5){s.addUnion(x,y+.5,fz,.5,height-.5,.5,0);s.addUnion(x+3.5,y+.5,fz,.5,height-.5,.5,0);}}
        }
      }
    }
    this.instances(s,this.detailGroup,['#afb9b5']);this.detailGroup.visible=true;
  }
  async setAudio(on: boolean) {
    if(!on){if(this.audioContext)await this.audioContext.suspend();return;}
    if(!this.audioContext){
      const context=new AudioContext();this.audioContext=context;
      const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate),samples=buffer.getChannelData(0);let brown=0;
      for(let i=0;i<samples.length;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;samples[i]=brown;}
      const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
      const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
      const gain=context.createGain();gain.gain.value=.25;this.audioGain=gain;
      const panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=300;panner.maxDistance=6000;this.audioPanner=panner;
      source.connect(filter).connect(gain).connect(panner).connect(context.destination);source.start();
      const horn=context.createOscillator();horn.type='sine';horn.frequency.value=122;
      const hornGain=context.createGain();hornGain.gain.value=0;horn.connect(hornGain).connect(panner);horn.start();this.horn=horn;this.hornGain=hornGain;
    }
    await this.audioContext.resume();
  }
  private updateAudio(t: number) {
    const context=this.audioContext;if(!context||context.state!=='running')return;
    const p=this.camera.position,front=new THREE.Vector3();this.camera.getWorldDirection(front);
    context.listener.positionX.value=p.x;context.listener.positionY.value=p.y;context.listener.positionZ.value=p.z;
    context.listener.forwardX.value=front.x;context.listener.forwardY.value=front.y;context.listener.forwardZ.value=front.z;
    if(this.audioPanner){const boat=this.moving[0]?.group.position;this.audioPanner.positionX.value=boat?.x||0;this.audioPanner.positionZ.value=boat?.z||0;this.audioPanner.positionY.value=1;}
    if(this.hornGain)this.hornGain.gain.setTargetAtTime(t%38<1.8?.045:0,context.currentTime,.3);
  }
  screenshot() {this.renderer.render(this.scene,this.camera);const a=document.createElement('a');a.download='harbour-atlas.png';a.href=this.renderer.domElement.toDataURL('image/png');a.click();}
  audit() {const a=this.world.store.audit(),b=this.propsStore.audit(),c=this.detailStore.audit();return {...a,aligned:a.aligned&&b.aligned&&c.aligned,cells:a.cells+b.cells+c.cells,runs:a.runs+b.runs+c.runs,detailRuns:c.runs,sourceBuildings:this.data.meta.buildings};}
  private tick=(now: number)=>{
    if(this.destroyed)return;
    const dt=Math.min((now-(this.last||now))/1000,.05);this.last=now;
    if(this.settings.motion)this.simulationTime+=dt;
    this.uniforms.uTime.value=this.simulationTime;
    if(this.transition){
      const t=THREE.MathUtils.clamp((now-this.transition.start)/this.transition.duration,0,1),e=t*t*(3-2*t);
      this.camera.position.lerpVectors(this.transition.from,this.transition.to,e);
      this.controls.target.lerpVectors(this.transition.targetFrom,this.transition.targetTo,e);
      this.camera.lookAt(this.controls.target);
      if(t===1){this.transition=null;if(this.mode==='walk'){this.footY=this.camera.position.y-1.7;this.yaw=Math.PI;this.pitch=0;}}
    }else if(this.mode==='orbit')this.controls.update();else this.walk(dt);
    this.camera.fov=THREE.MathUtils.damp(this.camera.fov,this.mode==='walk'?72:43,3,dt);this.camera.near=this.mode==='walk'?.1:5;this.camera.updateProjectionMatrix();
    this.sky.position.copy(this.camera.position);
    this.rain.position.copy(this.camera.position);
    this.reflection.visible=this.settings.quality==='high'&&this.mode==='orbit';
    this.uniforms.uReflect.value=this.reflection.visible?1:0;
    for(const m of this.moving){
      const raw=(this.simulationTime*m.speed/m.length+m.offset)%2,u=raw>1?2-raw:raw;let distance=u*m.length;
      for(let n=1;n<m.path.length;n++){
        const a=m.path[n-1],b=m.path[n],length=a.distanceTo(b);
        if(distance>length){distance-=length;continue;}
        m.group.position.lerpVectors(a,b,distance/length);m.group.rotation.y=Math.atan2(b.x-a.x,b.z-a.z)+(raw>1?Math.PI:0);
        if(m.boat){m.group.position.y=.3+Math.sin(this.simulationTime*.8+m.offset)*.12;if(m.wake){m.wake.position.set(m.group.position.x,.25,m.group.position.z);m.wake.rotation.z=m.group.rotation.y;}}
        else {const y=this.world.height(m.group.position.x,m.group.position.z);m.group.visible=this.world.isWalkable(m.group.position.x,m.group.position.z)&&y<80;m.group.position.y=y;}
        break;
      }
    }
    this.updateAudio(this.simulationTime);
    this.renderer.render(this.scene,this.camera);
    this.fpsFrames++;this.fpsTime+=dt;
    if(this.fpsTime>.5){
      const labels=LANDMARKS.map(l=>{const [x,z]=project(l.lon,l.lat),v=new THREE.Vector3(x,l.height+32,z).project(this.camera);return{id:l.id,x:(v.x*.5+.5)*this.renderer.domElement.clientWidth,y:(-.5*v.y+.5)*this.renderer.domElement.clientHeight,visible:this.settings.labels&&v.z>-1&&v.z<1&&Math.abs(v.x)<.96&&Math.abs(v.y)<.9};});
      const dir=new THREE.Vector3();this.camera.getWorldDirection(dir);const [lon,lat]=unproject(this.camera.position.x,this.camera.position.z);
      const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
      this.onFrame({fps:Math.round(this.fpsFrames/this.fpsTime),calls:this.renderer.info.render.calls,visibleChunks:this.chunkMeshes.filter(m=>frustum.intersectsObject(m)).length,heading:Math.atan2(dir.x,-dir.z)*180/Math.PI,position:this.camera.position.toArray() as [number,number,number],lon,lat,labels});
      this.fpsFrames=0;this.fpsTime=0;
    }
    this.raf=requestAnimationFrame(this.tick);
  };
  private clearGroup(group: THREE.Group) {group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});group.clear();}
  dispose(){
    this.destroyed=true;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.controls.dispose();
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.blur);document.removeEventListener('pointerlockchange',this.lockChange);window.removeEventListener('pointerup',this.pointerUp);window.removeEventListener('pointermove',this.pointerMove);
    this.renderer.domElement.removeEventListener('pointerdown',this.pointerDown);if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});this.scene.environment?.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.audioContext?.close();
  }
}
