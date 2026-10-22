import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({entryPoints:['lib/harbour/world.ts'],bundle:true,platform:'node',format:'esm',outfile:'data/world-test.mjs'});
const {VoxelWorld,NX,NZ}=await import('../data/world-test.mjs');
const data=JSON.parse(await fs.readFile('public/city.json','utf8'));
const start=performance.now();
const world=new VoxelWorld(data).build();
const audit=world.store.audit();
console.log('Build time',((performance.now()-start)/1000).toFixed(2),'s');
console.log('Grid audit',JSON.stringify(audit));
console.log('Land cells',world.land.reduce((a,b)=>a+b,0));
console.log('Occupied footprint cells',world.owner.reduce((a,b)=>a+(b>0),0));
console.log('Faces',world.chunks.reduce((n,c)=>n+c.indices.length/6,0));
for(const chunk of world.chunks)for(let i=0;i<chunk.positions.length;i+=12){
  const p=chunk.positions,n=chunk.normals,a=[p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]],b=[p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]];
  const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  assert(cross[0]*n[i]+cross[1]*n[i+1]+cross[2]*n[i+2]>0,'All voxel surfaces must face outward');
}
console.log('Trees',world.trees.length,'lamps',world.lamps.length,'walk points',world.walkable.length);
const p=(lon,lat)=>[(lon-114.1694)*111320*Math.cos(22.29*Math.PI/180),-(lat-22.29)*111320];
const landmarks=[['IFC',114.1596,22.2852],['BOC',114.1615,22.2793],['ICC',114.1602,22.3034],['HKCEC',114.173,22.2845]];
for(const [name,lon,lat] of landmarks){const q=p(lon,lat);console.log(name,world.height(...q),world.isWalkable(...q),world.nearestWalk(...q));assert(world.height(...q)>35,`${name} must be present on land`);assert(Math.hypot(...world.nearestWalk(...q).map((v,i)=>v-q[i]))<180,`${name} must have a nearby pedestrian landing`);}
for(const [name,lon,lat] of [['Harbour',114.17,22.29],['TST',114.1714,22.2932],['Central',114.1605,22.2864],['Wan Chai',114.1751,22.2837]]){const q=p(lon,lat);console.log('Location',name,world.height(...q),world.isWalkable(...q),world.nearestWalk(...q));}
assert.equal(audit.aligned,true);assert.equal(audit.rejected,0);assert(audit.runs>1000);assert(world.walkable.length>0);
assert(world.height(...p(114.17,22.29))<0,'Central harbour must be water');
assert(world.owner.reduce((n,id)=>n+(id>0),0)>100000,'Real city building coverage must be loaded');
// The disjoint column partition is independently checked against the source
// height field, including total occupied volume (each base cell is 0.125 m³).
let volume=0;for(let i=0;i<NX*NZ;i++)if(world.land[i])volume+=(world.top[i]*.5+16)*16;
assert.equal(audit.cells*.125,volume,'Compressed runs must exactly partition occupancy');
for(let i=0;i<NX*NZ;i++){assert(world.top[i]>=world.ground[i]);if(!world.land[i])assert.equal(world.owner[i],0);}
await fs.writeFile('data/grid-audit.json',JSON.stringify({...audit,volume,buildSeconds:(performance.now()-start)/1000,faces:world.chunks.reduce((n,c)=>n+c.indices.length/6,0)},null,2));
console.log('PASS: exact integer grid bounds, volume conservation, land and ownership invariants');
