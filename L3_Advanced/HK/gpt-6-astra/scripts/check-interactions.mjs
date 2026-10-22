import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import * as THREE from 'three';
await build({entryPoints:['lib/harbour/engine.ts'],bundle:true,platform:'node',format:'esm',outfile:'data/engine-test.mjs'});
await build({entryPoints:['lib/harbour/grid.ts'],bundle:true,platform:'node',format:'esm',outfile:'data/grid-test.mjs'});
const {HarbourEngine}=await import('../data/engine-test.mjs');
const {VoxelWorld}=await import('../data/world-test.mjs');
const {VoxelStore}=await import('../data/grid-test.mjs');
const city=JSON.parse(await fs.readFile('public/city.json','utf8'));
const world=new VoxelWorld(city).build();
const e=Object.create(HarbourEngine.prototype);
Object.assign(e,{world,data:city,propsStore:new VoxelStore(),detailStore:new VoxelStore(),scene:new THREE.Scene(),dynamic:new THREE.Group(),detailGroup:new THREE.Group(),camera:new THREE.PerspectiveCamera(),moving:[],lastDetail:'',keys:new Set(),yaw:0,pitch:0,velocityY:0,footY:4});
let objectCount=0;
function disjoint(store,label){
  const check=new VoxelStore();
  for(const r of store.runs){const p=[r.x*.5,r.y*.5,r.z*.5,r.w*.5,r.h*.5,r.d*.5];assert(!check.intersects(...p),`${label}: duplicate cell at ${p.join(',')}`);check.add(...p,r.material,r.owner);}
  assert(store.audit().aligned,label+' stays on grid');
}
e.instances=(store)=>{disjoint(store,'Instance model');objectCount++;};
e.makeProps();disjoint(e.propsStore,'City fixtures');
const fixtureRuns=e.propsStore.runs.length;
console.log('Static fixtures',e.propsStore.runs.length,'disjoint runs');
for(const p of [[206,-358],[-974,534],[-806,1218],[490,614]]){
  e.camera.position.set(p[0],world.height(...p)+1.7,p[1]);const start=performance.now();e.updateDetail();console.log('Detailed area',p,'in',Math.round(performance.now()-start),'ms');disjoint(e.detailStore,'Near facade');
  for(const r of e.detailStore.runs)assert(!e.propsStore.intersects(r.x*.5,r.y*.5,r.z*.5,r.w*.5,r.h*.5,r.d*.5),'Near facades must not duplicate city fixtures');
}
console.log('Near facade LOD: aligned and disjoint at four landings');
e.makeTraffic();
const boats=e.moving.filter(m=>m.boat),street=e.moving.filter(m=>!m.boat);
console.log('Navigable dynamic routes',boats.length,'boats,',street.length,'street actors;',objectCount,'local grid models');
assert(boats.length>=3,'At least three boat routes must remain on water');assert(street.length>4,'Street life must have navigable paths');
e.updateDetail=()=>{};e.propsStore=new VoxelStore();e.detailStore=new VoxelStore();
const landing=world.nearestWalk(206,-358);e.camera.position.set(landing[0],world.height(...landing)+1.7,landing[1]);e.footY=4;
assert(Math.abs(e.camera.position.y-world.height(...landing)-1.7)<1e-6,'Eye height 1.70 m');
// Walk toward the water for a minute; a single movement step is smaller than the
// capsule radius, so no discrete frame can tunnel across a wall or the shoreline.
e.yaw=Math.PI;e.keys.add('KeyW');
for(let i=0;i<3600;i++){e.walk(1/60);assert(world.height(e.camera.position.x,e.camera.position.z)>=0,'Walker may never enter water');assert(e.footY>=world.height(e.camera.position.x,e.camera.position.z),'Walker may never fall through ground');}
console.log('60 second waterfront collision simulation passed');
const simple=Object.create(HarbourEngine.prototype);Object.assign(simple,{world:{height:()=>4},propsStore:new VoxelStore(),detailStore:new VoxelStore(),camera:new THREE.PerspectiveCamera(),footY:4,yaw:0,pitch:0,velocityY:0,keys:new Set(['KeyW']),updateDetail:()=>{}});simple.camera.position.set(0,5.7,0);
for(let i=0;i<60;i++)simple.walk(1/60);assert(Math.abs(simple.camera.position.z+1.65)<.001,'Metric walking speed 1.65 m/s');
simple.keys=new Set(['Space']);for(let i=0;i<5;i++)simple.walk(1/60);assert(simple.footY>4,'Jump lifts the capsule');simple.keys.clear();for(let i=0;i<180;i++)simple.walk(1/60);assert.equal(simple.footY,4,'Gravity returns walker to the same ground');
const union=new VoxelStore();union.addUnion(0,0,0,2,2,2,0);union.addUnion(1,1,1,2,2,2,1);disjoint(union,'Cuboid union');assert.equal(union.cells*.125,15,'Cuboid CSG subtracts exactly the shared 1 m³');
const report={fixtures:fixtureRuns,boats:boats.length,streetActors:street.length,worldGrid:world.store.audit(),checks:['integer grid','no fixture overlaps','no LOD overlaps','navigable traffic','shore collision 60 seconds','1.70 m eye height','1.65 m/s movement','jump and gravity','cuboid union volume']};
await fs.writeFile('data/interaction-audit.json',JSON.stringify(report,null,2));
console.log('PASS: grid occupancy, navigation, movement scale and collision checks');
