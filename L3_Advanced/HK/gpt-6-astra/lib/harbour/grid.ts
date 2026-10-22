import { GRID, CHUNK } from './geo';

/** Run-length encoded occupancy of base-grid cells. All six bounds are integer
 * cell coordinates. Surface meshing merges occupied cells, never their placement. */
export interface VoxelRun { x: number; y: number; z: number; w: number; h: number; d: number; material: number; owner: number; }
export class VoxelStore {
  runs: VoxelRun[] = [];
  cells = 0;
  rejected = 0;
  chunks = new Map<string, VoxelRun[]>();
  add(x: number, y: number, z: number, w: number, h: number, d: number, material: number, owner = 0) {
    const run = { x: x / GRID, y: y / GRID, z: z / GRID, w: w / GRID, h: h / GRID, d: d / GRID, material, owner };
    if (![run.x, run.y, run.z, run.w, run.h, run.d].every(Number.isInteger) || Math.min(w, h, d) <= 0) {
      this.rejected++; throw new Error(`Off-grid occupancy: ${JSON.stringify(run)}`);
    }
    this.runs.push(run);
    this.cells += run.w * run.h * run.d;
    const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
    if (!this.chunks.has(key)) this.chunks.set(key, []);
    this.chunks.get(key)!.push(run);
    return run;
  }
  occupied(x: number, y: number, z: number) {
    const ix = Math.floor(x / GRID), iy = Math.floor(y / GRID), iz = Math.floor(z / GRID);
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dx = -1; dx <= 0; dx++) for (let dz = -1; dz <= 0; dz++) {
      const runs = this.chunks.get(`${cx + dx},${cz + dz}`) || [];
      for (const r of runs) if (ix >= r.x && ix < r.x + r.w && iy >= r.y && iy < r.y + r.h && iz >= r.z && iz < r.z + r.d) return r;
    }
    return null;
  }
  intersects(x: number,y: number,z: number,w: number,h: number,d: number) {
    const bounds=[x/GRID,y/GRID,z/GRID,(x+w)/GRID,(y+h)/GRID,(z+d)/GRID];
    for(let cx=Math.floor(x/CHUNK)-1;cx<=Math.floor((x+w)/CHUNK);cx++)for(let cz=Math.floor(z/CHUNK)-1;cz<=Math.floor((z+d)/CHUNK);cz++){
      for(const r of this.chunks.get(`${cx},${cz}`)||[])if(r.x<bounds[3]&&r.x+r.w>bounds[0]&&r.y<bounds[4]&&r.y+r.h>bounds[1]&&r.z<bounds[5]&&r.z+r.d>bounds[2])return true;
    }
    return false;
  }
  /** Exact cuboid union, including concave corners of voxelized facades. */
  addUnion(x:number,y:number,z:number,w:number,h:number,d:number,material:number,owner=0) {
    type Cuboid=[number,number,number,number,number,number];
    let pieces:Cuboid[]=[[x,y,z,w,h,d]];
    const candidates:VoxelRun[]=[];
    const lo=[x/GRID,y/GRID,z/GRID],hi=[(x+w)/GRID,(y+h)/GRID,(z+d)/GRID];
    for(let cx=Math.floor(x/CHUNK)-1;cx<=Math.floor((x+w)/CHUNK);cx++)for(let cz=Math.floor(z/CHUNK)-1;cz<=Math.floor((z+d)/CHUNK);cz++)for(const r of this.chunks.get(`${cx},${cz}`)||[])if(r.x<hi[0]&&r.x+r.w>lo[0]&&r.y<hi[1]&&r.y+r.h>lo[1]&&r.z<hi[2]&&r.z+r.d>lo[2])candidates.push(r);
    if(!candidates.length){this.add(x,y,z,w,h,d,material,owner);return;}
    for(const r of candidates){
      const ax=r.x*GRID,ay=r.y*GRID,az=r.z*GRID,bx=(r.x+r.w)*GRID,by=(r.y+r.h)*GRID,bz=(r.z+r.d)*GRID;
      const next:Cuboid[]=[];
      for(const p of pieces){
        const [px,py,pz,pw,ph,pd]=p,ex=px+pw,ey=py+ph,ez=pz+pd;
        const ix=Math.max(px,ax),iy=Math.max(py,ay),iz=Math.max(pz,az),jx=Math.min(ex,bx),jy=Math.min(ey,by),jz=Math.min(ez,bz);
        if(ix>=jx||iy>=jy||iz>=jz){next.push(p);continue;}
        if(px<ix)next.push([px,py,pz,ix-px,ph,pd]);if(jx<ex)next.push([jx,py,pz,ex-jx,ph,pd]);
        if(py<iy)next.push([ix,py,pz,jx-ix,iy-py,pd]);if(jy<ey)next.push([ix,jy,pz,jx-ix,ey-jy,pd]);
        if(pz<iz)next.push([ix,iy,pz,jx-ix,jy-iy,iz-pz]);if(jz<ez)next.push([ix,iy,jz,jx-ix,jy-iy,ez-jz]);
      }
      pieces=next;if(!pieces.length)return;
    }
    for(const p of pieces)this.add(...p,material,owner);
  }
  audit() {
    return { runs: this.runs.length, cells: this.cells, chunks: this.chunks.size, rejected: this.rejected,
      aligned: this.runs.every(r => [r.x, r.y, r.z, r.w, r.h, r.d].every(Number.isInteger)), base: GRID };
  }
}
