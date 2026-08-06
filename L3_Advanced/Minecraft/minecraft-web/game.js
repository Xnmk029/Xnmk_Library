/* ================================================================
 * 我的世界 3D - 网页版
 * 无限体素世界 · 程序化材质 · 昼夜光影
 * 单文件（内嵌 three.js），双击 HTML 即可运行
 * ================================================================ */
(function(){
'use strict';

/* ================= 基础工具 ================= */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash3i(x,y,z){let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1274126177);h=(h^(h>>>13))>>>0;h=Math.imul(h,1103515245);h=(h^(h>>>16))>>>0;return h/4294967296;}

/* ================= Simplex 噪声 2D / 3D ================= */
(function(){
  const grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const grad2=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const perm=new Uint8Array(512);
  { const p=new Uint8Array(256); const rnd=mulberry32(20240802);
    for(let i=0;i<256;i++)p[i]=i;
    for(let i=255;i>0;i--){const j=(rnd()*(i+1))|0,t=p[i];p[i]=p[j];p[j]=t;}
    for(let i=0;i<512;i++)perm[i]=p[i&255]; }
  const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  const F3=1/3,G3=1/6;
  window.__snoise2=function(xin,yin){
    let n0=0,n1=0,n2=0;
    const s=(xin+yin)*F2,i=Math.floor(xin+s),j=Math.floor(yin+s),t=(i+j)*G2;
    const x0=xin-(i-t),y0=yin-(j-t);
    const i1=x0>y0?1:0,j1=x0>y0?0:1;
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2;
    const ii=i&255,jj=j&255;
    const gi0=perm[ii+perm[jj]]%8,gi1=perm[ii+i1+perm[jj+j1]]%8,gi2=perm[ii+1+perm[jj+1]]%8;
    let t0=0.5-x0*x0-y0*y0; if(t0>=0){t0*=t0;n0=t0*t0*(grad2[gi0][0]*x0+grad2[gi0][1]*y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>=0){t1*=t1;n1=t1*t1*(grad2[gi1][0]*x1+grad2[gi1][1]*y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>=0){t2*=t2;n2=t2*t2*(grad2[gi2][0]*x2+grad2[gi2][1]*y2);}
    return 70*(n0+n1+n2);
  };
  window.__snoise3=function(xin,yin,zin){
    let n0=0,n1=0,n2=0,n3=0;
    const s=(xin+yin+zin)*F3,i=Math.floor(xin+s),j=Math.floor(yin+s),k=Math.floor(zin+s),t=(i+j+k)*G3;
    const x0=xin-(i-t),y0=yin-(j-t),z0=zin-(k-t);
    let i1,j1,k1,i2,j2,k2;
    if(x0>=y0){ if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;} }
    else{ if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;} }
    const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
    const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
    const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
    const ii=i&255,jj=j&255,kk=k&255;
    const g0=perm[ii+perm[jj+perm[kk]]]%12,g1=perm[ii+i1+perm[jj+j1+perm[kk+k1]]]%12;
    const g2=perm[ii+i2+perm[jj+j2+perm[kk+k2]]]%12,g3=perm[ii+1+perm[jj+1+perm[kk+1]]]%12;
    let t0=0.6-x0*x0-y0*y0-z0*z0; if(t0>=0){t0*=t0;n0=t0*t0*(grad3[g0][0]*x0+grad3[g0][1]*y0+grad3[g0][2]*z0);}
    let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1>=0){t1*=t1;n1=t1*t1*(grad3[g1][0]*x1+grad3[g1][1]*y1+grad3[g1][2]*z1);}
    let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2>=0){t2*=t2;n2=t2*t2*(grad3[g2][0]*x2+grad3[g2][1]*y2+grad3[g2][2]*z2);}
    let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3>=0){t3*=t3;n3=t3*t3*(grad3[g3][0]*x3+grad3[g3][1]*y3+grad3[g3][2]*z3);}
    return 32*(n0+n1+n2+n3);
  };
})();
const snoise2=window.__snoise2, snoise3=window.__snoise3;
function fbm2(x,z,oct=4,lac=2,gain=0.5){let a=1,f=1,n=0,norm=0;for(let i=0;i<oct;i++){n+=snoise2(x*f,z*f)*a;norm+=a;a*=gain;f*=lac;}return n/norm;}
function fbm3(x,y,z,oct=3,lac=2,gain=0.5){let a=1,f=1,n=0,norm=0;for(let i=0;i<oct;i++){n+=snoise3(x*f,y*f,z*f)*a;norm+=a;a*=gain;f*=lac;}return n/norm;}

/* ================= 方块定义 ================= */
const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, LOG=5, LEAVES=6, PLANKS=7, GLASS=8,
      COBBLE=9, BRICK=10, SNOW=11, COAL=12, IRON=13, DIAMOND=14,
      FLOWER_R=15, FLOWER_Y=16, TALLGRASS=17, WATER=18, BEDROCK=19;
const SEA=24, H=64, CH=16;
const isPlant=b=>b===FLOWER_R||b===FLOWER_Y||b===TALLGRASS;
const occludes=b=>b!==AIR&&b!==WATER&&!isPlant(b);
const SOLID=new Set([GRASS,DIRT,STONE,SAND,LOG,LEAVES,PLANKS,GLASS,COBBLE,BRICK,SNOW,COAL,IRON,DIAMOND,BEDROCK]);
const isSolid=b=>SOLID.has(b);

/* ================= 程序化材质（像素画风） ================= */
function makeTile(seed,draw){
  const c=document.createElement('canvas'); c.width=c.height=16;
  const g=c.getContext('2d'); const d=g.createImageData(16,16);
  draw(d.data,mulberry32(seed));
  g.putImageData(d,0,0); return c;
}
const px=(d,i,r,g,b,a=255)=>{d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=a;};
const stoneFill=(d,rnd,seedAdj)=>{
  for(let i=0;i<256;i++){
    const v=126+rnd()*30-(rnd()<0.05?34:0);
    px(d,i*4,v,v,v+3);
  }
  // 裂纹
  let x=rnd()*16|0,y=0;
  for(let s=0;s<26;s++){ px(d,(y*16+x)*4,84,84,88); y++; x+=rnd()<0.5?1:-1; x=clamp(x,0,15); if(y>15)break; }
};
const blob=(d,rnd,color,n)=>{
  for(let k=0;k<n;k++){
    const bx=rnd()*13|0, by=rnd()*13|0, w=2+(rnd()*2|0), h=2+(rnd()*2|0);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const i=((by+yy)*16+bx+xx)*4;
      const sh=rnd()*0.75+0.25;
      px(d,i,color[0]*sh,color[1]*sh,color[2]*sh);
    }
  }
};
const TILES=[
  // 0 草顶
  makeTile(101,(d,r)=>{
    for(let i=0;i<256;i++){const v=r()*46;px(d,i*4,74+v,128+v*0.62,52+v*0.3);}
    for(let k=0;k<14;k++){const i=((r()*16|0)*16+(r()*16|0))*4;px(d,i,120,168,72);}
    for(let k=0;k<10;k++){const i=((r()*16|0)*16+(r()*16|0))*4;px(d,i,58,96,40);}
  }),
  // 1 草侧面
  makeTile(102,(d,r)=>{
    for(let i=0;i<256;i++){const v=r()*26;px(d,i*4,122+v,94+v*0.7,60+v*0.45);}
    for(let x=0;x<16;x++){
      const gh=3+((x*7)%3);
      for(let y=0;y<16;y++){
        if(y<gh){const v=r()*40;px(d,(y*16+x)*4,76+v,132+v*0.5,54+v*0.3);}
        else if(y===gh&&r()<0.5){px(d,(y*16+x)*4,84,142,60);}
      }
      if(r()<0.5){const i=((gh+1)*16+x)*4;px(d,i,70,120,50);}
    }
  }),
  // 2 泥土
  makeTile(103,(d,r)=>{for(let i=0;i<256;i++){const v=r()*34;px(d,i*4,138+v*0.6,98+v*0.55,62+v*0.4);}blob(d,r,[112,82,52],3);}),
  // 3 石头
  makeTile(104,stoneFill),
  // 4 沙子
  makeTile(105,(d,r)=>{
    for(let i=0;i<256;i++){const v=r()*26;px(d,i*4,222+v*0.5,208+v*0.42,162+v*0.35);}
    for(let k=0;k<8;k++){const i=((r()*16|0)*16+(r()*16|0))*4;px(d,i,190,176,132);}
  }),
  // 5 原木侧面
  makeTile(106,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4, dark=(x%4===0||x%4===3);
      const v=r()*18*(dark?0.55:1);
      px(d,i,116+v,86+v*0.7,52+v*0.45);
    }
  }),
  // 6 原木顶
  makeTile(107,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4, dx=x-7.5, dy=y-7.5;
      const ring=(Math.floor(Math.sqrt(dx*dx+dy*dy)))%2===0;
      const v=r()*16;
      px(d,i,ring?118+v:88+v, ring?90+v*0.7:64+v*0.7, ring?54+v*0.4:38+v*0.4);
    }
  }),
  // 7 树叶
  makeTile(108,(d,r)=>{
    for(let i=0;i<256;i++){
      const v=r();
      if(v<0.05){px(d,i*4,60,110,44,0);continue;}
      px(d,i*4,52+r()*46,104+r()*40,44+r()*26);
    }
    for(let k=0;k<10;k++){const i=((r()*16|0)*16+(r()*16|0))*4;px(d,i,88,150,64);}
  }),
  // 8 木板
  makeTile(109,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4, board=y>>2, seam=y%4===0;
      const v=r()*20;
      px(d,i,seam?128+v*0.5:166+v, seam?100:132+v*0.6, seam?58:82+v*0.4);
    }
    for(let k=0;k<7;k++){const x=r()*16|0,y=r()*16|0;px(d,(y*16+x)*4,150,116,70);}
  }),
  // 9 玻璃（无十字撑条，像窗框）
  makeTile(110,(d,r)=>{
    for(let i=0;i<256;i++){d[i*4]=160;d[i*4+1]=195;d[i*4+2]=228;d[i*4+3]=0;}
    for(let x=0;x<16;x++){
      px(d,(x)*4,200,228,250,255); px(d,(x+15*16)*4,200,228,250,255);
    }
    for(let y=0;y<16;y++){ px(d,(y*16)*4,200,228,250,255); px(d,(y*16+15)*4,200,228,250,255); }
    for(let y=1;y<15;y++){px(d,(y*16+1)*4,175,208,238,255);px(d,(y*16+14)*4,175,208,238,255);}
    for(let x=1;x<15;x++){px(d,(15*16+x)*4,160,195,228,255);px(d,(14*16+x)*4,175,208,238,255);}
  }),
  // 10 圆石
  makeTile(111,(d,r)=>{
    for(let i=0;i<256;i++)px(d,i*4,112,112,118);
    for(let by=0;by<4;by++)for(let bx=0;bx<4;bx++){
      const ox=bx*4+1, oy=by*4+1, w=2+(r()*2|0), h=2+(r()*2|0);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=((oy+y)*16+ox+x)*4, v=r()*22;
        px(d,i,126+v,126+v,132+v);
      }
      const i=(oy*16+ox)*4; px(d,i,158,158,164);
    }
  }),
  // 11 红砖
  makeTile(112,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4, brickRow=(y>>2), rowY=y%4;
      const off=(brickRow%2)*4;
      const isMortar=(rowY===0)||((x+off)%8===0);
      if(isMortar)px(d,i,206,200,192);
      else{const v=r()*18;px(d,i,rowY===1?176+v*0.6:158+v,78+v*0.5,58+v*0.4);}
    }
  }),
  // 12 雪
  makeTile(113,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4, v=r()*9;
      px(d,i,y>12?220+v:238+v, y>12?228+v:244+v, y>12?236+v:250+v);
    }
  }),
  // 13 煤矿
  makeTile(114,(d,r)=>{stoneFill(d,r,1);blob(d,r,[28,28,30],4);}),
  // 14 铁矿
  makeTile(115,(d,r)=>{stoneFill(d,r,2);blob(d,r,[212,168,138],4);}),
  // 15 钻石矿
  makeTile(116,(d,r)=>{stoneFill(d,r,3);blob(d,r,[92,222,226],4);}),
  // 16 红色花朵
  makeTile(117,(d,r)=>{
    for(let i=0;i<256;i++){d[i*4]=80;d[i*4+1]=120;d[i*4+2]=60;d[i*4+3]=0;}
    px(d,(14*16+7)*4,58,128,48,255); px(d,(13*16+7)*4,62,136,52,255);
    px(d,(12*16+6)*4,70,140,58,255);
    const c=[226,52,44]; // 花瓣
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(Math.abs(dx)+Math.abs(dy)>2)continue;
      const cx=7+dx, cy=6+dy;
      if(cx<0||cx>15||cy<0||cy>15)continue;
      if(dx===0&&dy===0)continue;
      px(d,(cy*16+cx)*4,c[0],c[1],c[2],255);
    }
    px(d,(6*16+7)*4,244,214,66,255);
  }),
  // 17 黄色花朵
  makeTile(118,(d,r)=>{
    for(let i=0;i<256;i++){d[i*4]=80;d[i*4+1]=120;d[i*4+2]=60;d[i*4+3]=0;}
    px(d,(14*16+7)*4,58,128,48,255); px(d,(13*16+7)*4,62,136,52,255);
    px(d,(12*16+6)*4,70,140,58,255);
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
      if(Math.abs(dx)+Math.abs(dy)>2)continue;
      const cx=7+dx, cy=6+dy;
      if(cx<0||cx>15||cy<0||cy>15)continue;
      if(dx===0&&dy===0)continue;
      px(d,(cy*16+cx)*4,242,206,74,255);
    }
    px(d,(6*16+7)*4,222,150,52,255);
  }),
  // 18 草丛
  makeTile(119,(d,r)=>{
    for(let i=0;i<256;i++){d[i*4]=80;d[i*4+1]=120;d[i*4+2]=60;d[i*4+3]=0;}
    for(let k=0;k<7;k++){
      const x=2+(r()*12|0), h=5+(r()*7|0);
      for(let y=15;y>15-h;y--){
        if(x<0||x>15)break;
        px(d,(y*16+x)*4,72+r()*26,130+r()*22,58+r()*16,255);
      }
    }
  }),
  // 19 基岩
  makeTile(120,(d,r)=>{for(let i=0;i<256;i++){const v=r()*60;px(d,i*4,58+v,58+v*0.96,62+v*0.9);}}),
  // 20 水（独立动画纹理，不用在 atlas 里）
  makeTile(121,(d,r)=>{
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const i=(y*16+x)*4;
      if(y%4===1)px(d,i,66,126,222);
      else px(d,i,44,96,196);
      if(r()<0.12)px(d,i,96,158,236);
    }
  })
];

/* ================= 材质集（atlas） ================= */
const atlas=document.createElement('canvas'); atlas.width=atlas.height=256;
{ const g=atlas.getContext('2d'); g.imageSmoothingEnabled=false;
  for(let i=0;i<21;i++)g.drawImage(TILES[i],(i%16)*16,(i>>4)*16); }
const atlasTex=new THREE.CanvasTexture(atlas);
atlasTex.magFilter=THREE.NearestFilter;
atlasTex.minFilter=THREE.NearestMipmapLinearFilter;
atlasTex.generateMipmaps=true;
atlasTex.colorSpace=THREE.SRGBColorSpace;
atlasTex.anisotropy=4;

const waterTex=new THREE.CanvasTexture(TILES[20]);
waterTex.magFilter=THREE.NearestFilter; waterTex.minFilter=THREE.NearestFilter;
waterTex.wrapS=waterTex.wrapT=THREE.RepeatWrapping;
waterTex.colorSpace=THREE.SRGBColorSpace;

// 方块各面贴图: [col,row] 于 atlas（按方块 ID 索引）
const T=[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[0,1],[1,1],[2,1],[3,1],[3,1]];
function tileOf(b,face){ // face: 0+x 1-x 2+y 3-y 4+z 5-z
  if(b===GRASS)return face===2?T[0]:face===3?T[2]:T[1];
  if(b===LOG)return face===2||face===3?[6,0]:T[5];
  return T[b];
}

/* ================= 世界高度 / 生成 ================= */
function worldHeight(x,z){
  let h=24+fbm2(x*0.0055,z*0.0055,4)*15;
  const m=fbm2(x*0.0016+77.7,z*0.0016-31.3,3);
  const ridge=Math.pow(Math.max(0,1-Math.abs(2*m-1)),1.8);
  const mf=smoothstep(0.22,0.55,fbm2(x*0.0012+13.7,z*0.0012+91.1,2));
  h+=ridge*mf*36;
  h+=fbm2(x*0.02+5.5,z*0.02-9.3,2)*2.5;
  return clamp(Math.round(h),2,60);
}
function findSpawn(){
  for(let r=0;r<=24;r++){
    for(let a=0;a<12;a++){
      const ang=a/12*Math.PI*2;
      const x=Math.round(8+Math.cos(ang)*r), z=Math.round(8+Math.sin(ang)*r);
      const h=worldHeight(x,z);
      if(h>=SEA+2&&h<=SEA+13&&fbm2(x*0.007+101.3,z*0.007+59.7,3)<0.45&&worldHeight(x+8,z)<h+2&&worldHeight(x-8,z)<h+2){
        return {x,z,h};
      }
    }
  }
  return {x:8,z:8,h:worldHeight(8,8)};
}
const tintCache=new Map();
function grassTint(wx,wz,h){
  const key=(wx*31+wx)^(wz*17);
  let v=tintCache.get(key);
  if(v===undefined){
    const t=smoothstep(-0.55,0.55,fbm2(wx*0.021+31.7,wz*0.021+17.3,2));
    let r=lerp(0.42,0.72,t),g=lerp(0.70,0.82,t),b=lerp(0.30,0.38,t);
    const sn=smoothstep(40,48,h);
    r=lerp(r,0.82,sn);g=lerp(g,0.88,sn);b=lerp(b,0.76,sn);
    v=[r,g,b]; tintCache.set(key,v);
    if(tintCache.size>65536)tintCache.clear();
  }
  return v;
}

const chunks=new Map(); // key: cx*8192+cz
const chunkKey=(cx,cz)=>cx*8192+cz;
function getChunk(cx,cz){return chunks.get(chunkKey(cx,cz))||null;}
function getBlockWorld(x,y,z){
  if(y<0||y>=H)return 0;
  const cx=Math.floor(x/16),cz=Math.floor(z/16);
  const c=chunks.get(chunkKey(cx,cz));
  if(!c)return 0;
  return c.data[((y*16+(z&15))*16)+(x&15)];
}
function setBlockWorld(x,y,z,b){
  if(y<=0||y>=H-1)return;
  const cx=Math.floor(x/16),cz=Math.floor(z/16);
  const c=chunks.get(chunkKey(cx,cz));
  if(!c)return;
  const lx=x&15,lz=z&15;
  c.data[(y*16+lz)*16+lx]=b;
  c.dirty=true;
  if(lx===0){const n=chunks.get(chunkKey(cx-1,cz));if(n)n.dirty=true;}
  if(lx===15){const n=chunks.get(chunkKey(cx+1,cz));if(n)n.dirty=true;}
  if(lz===0){const n=chunks.get(chunkKey(cx,cz-1));if(n)n.dirty=true;}
  if(lz===15){const n=chunks.get(chunkKey(cx,cz+1));if(n)n.dirty=true;}
}

function generateChunk(cx,cz){
  const data=new Uint8Array(CH*H*CH);
  const heights=new Int16Array(CH*CH);
  const tops=new Uint8Array(CH*CH); // 表面方块（填列时记录）
  for(let lx=0;lx<CH;lx++)for(let lz=0;lz<CH;lz++){
    const wx=cx*CH+lx, wz=cz*CH+lz;
    const h=worldHeight(wx,wz);
    heights[lz*CH+lx]=h;
    for(let y=0;y<H;y++){
      let b=AIR;
      if(y===0)b=BEDROCK;
      else if(y<h){
        b=y<h-3?STONE:DIRT;
        if(b===STONE){
          const r=hash3i(wx,y,wz);
          if(y<13&&r>0.9988)b=DIAMOND;
          else if(y<33&&r>0.9963)b=IRON;
          else if(y<48&&r>0.9945)b=COAL;
        }
        // 洞穴（单层噪声，快）
        if(y>=SEA+1&&y<h-1&&snoise3(wx*0.09,y*0.13,wz*0.09)>0.52)b=AIR;
      }
      else if(y===h){
        if(h<=SEA+2)b=SAND;
        else if(h>=44)b=STONE;
        else if(h>=40)b=SNOW;
        else b=GRASS;
      }
      else if(y<=SEA&&h<SEA)b=WATER;
      data[(y*CH+lz)*CH+lx]=b;
    }
    tops[lz*CH+lx]=data[((h*CH+lz)*CH+lx)];
  }
  // 树木 / 花草
  for(let lx=3;lx<CH-3;lx++)for(let lz=3;lz<CH-3;lz++){
    const wx=cx*CH+lx, wz=cz*CH+lz;
    const h=heights[lz*CH+lx];
    if(h<=SEA+1||h>=40||tops[lz*CH+lx]!==GRASS)continue;
    const forest=smoothstep(0.42,0.62,fbm2(wx*0.007+101.3,wz*0.007+59.7,3));
    const dens=0.022+forest*0.11;
    if(hash3i(wx,wz,7)<dens){
      // 坡度检查：附近高度差太大则不长树
      const dh=Math.max(Math.abs(h-heights[lz*CH+lx+3]),Math.abs(h-heights[lz*CH+lx-3]),Math.abs(h-heights[(lz+3)*CH+lx]),Math.abs(h-heights[(lz-3)*CH+lx]));
      if(dh>2)continue;
      const trunk=4+(hash3i(wx*3+1,wz*7+2,5)*3|0);
      const top=h+trunk;
      for(let dy=1;dy<=trunk;dy++)data[((h+dy)*CH+lz)*CH+lx]=LOG;
      const leafR=hash3i(wx,wz,13);
      for(let dy=top-2;dy<=top+1;dy++){
        for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
          if(dy===top-2){if(Math.abs(dx)+Math.abs(dz)>2||(leafR>0.5&&Math.abs(dx)===2&&Math.abs(dz)===2))continue;}
          if(dy===top&&Math.abs(dx)===2&&Math.abs(dz)===2)continue;
          if(dy===top+1&&Math.abs(dx)+Math.abs(dz)>1)continue;
          const X=lx+dx,Z=lz+dz;
          if(X<0||X>15||Z<0||Z>15)continue;
          const idx=((dy*CH+Z)*CH+X);
          if(data[idx]===AIR)data[idx]=LEAVES;
        }
      }
      continue;
    }
    const r=hash3i(wx*11+3,wz*13+7,9);
    if(r<0.016)tops[lz*CH+lx]=(r<0.008?FLOWER_R:FLOWER_Y);
    else if(r<0.05)tops[lz*CH+lx]=TALLGRASS;
  }
  // 写入花草
  for(let lx=0;lx<CH;lx++)for(let lz=0;lz<CH;lz++){
    const t=tops[lz*CH+lx];
    if(t===FLOWER_R||t===FLOWER_Y||t===TALLGRASS){
      const h=heights[lz*CH+lx];
      data[((h+1)*CH+lz)*CH+lx]=t;
    }
  }
  const c={cx,cz,data,heights,mesh:null,dirty:false};
  chunks.set(chunkKey(cx,cz),c);
  // 邻居可能因我们出现而变化 → 标脏
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const n=chunks.get(chunkKey(cx+dx,cz+dz));
    if(n)n.dirty=true;
  }
  return c;
}

/* ================= 网格构建（含环境光遮蔽 + 草地染色） ================= */
const AO_SHADE=[1.0,0.87,0.74,0.62];
const FACES=[
  {n:[1,0,0], v:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], tu:[0,0,-1], tv:[0,1,0]},
  {n:[-1,0,0],v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], tu:[0,0,1],  tv:[0,1,0]},
  {n:[0,1,0], v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], tu:[1,0,0],  tv:[0,0,-1]},
  {n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], tu:[1,0,0],  tv:[0,0,1]},
  {n:[0,0,1], v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], tu:[1,0,0],  tv:[0,1,0]},
  {n:[0,0,-1],v:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], tu:[-1,0,0], tv:[0,1,0]},
];
const FACE_UV=[[0,0],[1,0],[1,1],[0,1]];
const PLANT_QUADS=[
  [[0.15,0,0.15],[0.85,0,0.85],[0.85,1,0.85],[0.15,1,0.15]],
  [[0.85,0,0.15],[0.15,0,0.85],[0.15,1,0.85],[0.85,1,0.15]]
];

function buildChunkMesh(chunk){
  const {data,cx,cz}=chunk;
  const P=[],N=[],UV=[],C=[],I=[];
  let cOpaque=0,cPlant=0,cWater=0;
  // 邻居引用
  const nb={px:chunks.get(chunkKey(cx+1,cz)),mx:chunks.get(chunkKey(cx-1,cz)),pz:chunks.get(chunkKey(cx,cz+1)),mz:chunks.get(chunkKey(cx,cz-1))};
  const gb=(x,y,z)=>{
    if(y<0||y>=H)return 0;
    const lx=x-cx*16,lz=z-cz*16;
    if(lx>=0&&lx<16&&lz>=0&&lz<16)return data[(y*16+lz)*16+lx];
    const c2=lx<0?nb.mx:lx>=16?nb.px:lz<0?nb.mz:nb.pz;
    if(!c2)return 0;
    return c2.data[((y*16)+(lz&15))*16+(lx&15)];
  };
  // 环境光遮蔽：在面的平面层采样 3 个相邻方块
  const aoAt=(x,y,z,n,tu,tv,cu,cv)=>{
    const ax=tu[0]*(cu?1:-1),ay=tu[1]*(cu?1:-1),az=tu[2]*(cu?1:-1);
    const bx2=tv[0]*(cv?1:-1),by2=tv[1]*(cv?1:-1),bz2=tv[2]*(cv?1:-1);
    const s1=occludes(gb(x+n[0]+ax,y+n[1]+ay,z+n[2]+az))?1:0;
    const s2=occludes(gb(x+n[0]+bx2,y+n[1]+by2,z+n[2]+bz2))?1:0;
    if(s1&&s2)return 3;
    const s3=occludes(gb(x+n[0]+ax+bx2,y+n[1]+ay+by2,z+n[2]+az+bz2))?1:0;
    return s1+s2+s3;
  };
  const hh=chunk.heights;
  for(let y=0;y<H;y++)for(let lz=0;lz<CH;lz++)for(let lx=0;lx<CH;lx++){
    const b=data[(y*CH+lz)*CH+lx];
    if(b===AIR)continue;
    const bx=cx*16+lx,by=y,bz=cz*16+lz;
    if(isPlant(b)){
      const tile=tileOf(b,2);
      const u0=tile[0]/16,u1=(tile[0]+1)/16,v1=1-tile[1]/16,v0=1-(tile[1]+1)/16;
      for(let q=0;q<2;q++){
        const s=P.length/3;
        for(let k=0;k<4;k++){
          const v=PLANT_QUADS[q][k];
          P.push(bx+v[0],by+v[1],bz+v[2]);
          N.push(0,1,0);
          UV.push(k===0||k===3?u0:u1,k<2?v0:v1);
          C.push(1,1,1);
        }
        I.push(s,s+1,s+2,s,s+2,s+3);
      }
      cPlant+=12;
      continue;
    }
    if(b===WATER){
      const above=gb(bx,by+1,bz);
      // 顶面（略低于方块顶）
      if(above===AIR||isPlant(above)){
        const s=P.length/3,yy=by+0.85;
        P.push(bx,yy,bz+1,bx+1,yy,bz+1,bx+1,yy,bz,bx,yy,bz);
        for(let k=0;k<4;k++)N.push(0,1,0);
        UV.push(0,0,3,0,3,3,0,3);
        C.push(1,1,1,1,1,1,1,1,1,1,1,1);
        I.push(s,s+1,s+2,s,s+2,s+3);
        cWater+=6;
      }
      // 侧面
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nb2=gb(bx+dx,by,bz+dz);
        if(nb2!==WATER&&!occludes(nb2)){
          const s=P.length/3;
          const f = dx===1?0:dx===-1?1:dz===1?4:5;
          for(let k=0;k<4;k++){
            const v=FACES[f].v[k];
            P.push(bx+v[0],by+v[1],bz+v[2]);
            N.push(FACES[f].n[0],FACES[f].n[1],FACES[f].n[2]);
            UV.push(FACE_UV[k][0],FACE_UV[k][1]);
            C.push(1,1,1);
          }
          I.push(s,s+1,s+2,s,s+2,s+3);
          cWater+=6;
        }
      }
      continue;
    }
    // 不透明方块
    const tint=grassTint(bx,bz,hh?hh[lz*CH+lx]:worldHeight(bx,bz));
    const isGrassy=b===GRASS||b===LEAVES;
    for(let f=0;f<6;f++){
      const n=FACES[f].n;
      if(occludes(gb(bx+n[0],by+n[1],bz+n[2])))continue;
      const s=P.length/3;
      const tile=tileOf(b,f);
      const u0=tile[0]/16,u1=(tile[0]+1)/16,v1=1-tile[1]/16,v0=1-(tile[1]+1)/16;
      const tintFace=(isGrassy&&f!==3)?tint:[1,1,1];
      for(let k=0;k<4;k++){
        const v=FACES[f].v[k],u=FACE_UV[k];
        P.push(bx+v[0],by+v[1],bz+v[2]);
        N.push(n[0],n[1],n[2]);
        UV.push(lerp(u0,u1,u[0]),lerp(v0,v1,u[1]));
        const cu=(k===1||k===2)?1:0, cv=(k===2||k===3)?1:0;
        const ao=aoAt(bx,by,bz,n,FACES[f].tu,FACES[f].tv,cu,cv);
        const sh=AO_SHADE[ao];
        C.push(tintFace[0]*sh,tintFace[1]*sh,tintFace[2]*sh);
      }
      I.push(s,s+1,s+2,s,s+2,s+3);
      cOpaque+=6;
    }
  }
  const geo=new THREE.BufferGeometry();
  if(P.length){
    geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
    geo.setIndex(I);
    if(cOpaque)geo.addGroup(0,cOpaque,0);
    if(cPlant)geo.addGroup(cOpaque,cPlant,1);
    if(cWater)geo.addGroup(cOpaque+cPlant,cWater,2);
    geo.computeBoundingSphere();
  }
  if(chunk.mesh){scene.remove(chunk.mesh);chunk.mesh.geometry.dispose();}
  if(P.length){
    const mesh=new THREE.Mesh(geo,[matOpaque,matPlant,matWater]);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    chunk.mesh=mesh;
  }else{chunk.mesh=null;}
  chunk.dirty=false;
}

/* ================= 渲染环境 ================= */
const cvs=document.getElementById('cv');
const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(78,innerWidth/innerHeight,0.1,900);
camera.rotation.order='YXZ';
scene.fog=new THREE.Fog(0x9fd8ff,60,120);

const matOpaque=new THREE.MeshLambertMaterial({map:atlasTex,vertexColors:true,alphaTest:0.45});
const matPlant=new THREE.MeshLambertMaterial({map:atlasTex,vertexColors:true,alphaTest:0.45,side:THREE.DoubleSide});
const matWater=new THREE.MeshPhongMaterial({map:waterTex,transparent:true,opacity:0.82,specular:0xaaccff,shininess:110,side:THREE.DoubleSide,color:0x8fc0ee,depthWrite:true});

/* 太阳光（带阴影） */
const sunLight=new THREE.DirectionalLight(0xfff4e0,1.1);
sunLight.castShadow=true;
sunLight.shadow.mapSize.set(2048,2048);
sunLight.shadow.camera.left=-52; sunLight.shadow.camera.right=52;
sunLight.shadow.camera.top=52; sunLight.shadow.camera.bottom=-52;
sunLight.shadow.camera.near=20; sunLight.shadow.camera.far=260;
sunLight.shadow.bias=-0.0006;
sunLight.shadow.normalBias=0.6;
sunLight.shadow.camera.updateProjectionMatrix();
sunLight.target.position.set(0,0,0);
scene.add(sunLight); scene.add(sunLight.target);
const hemi=new THREE.HemisphereLight(0x9fc4ff,0x6b5a44,0.55);
scene.add(hemi);

/* 天空穹顶 shader */
const skyUniforms={topCol:{value:new THREE.Color(0x2f6fd8)},botCol:{value:new THREE.Color(0xbfe3ff)},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color(1,0.95,0.85)},moonDir:{value:new THREE.Vector3(0,-1,0)},starMix:{value:0},uUnder:{value:0}};
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:skyUniforms,
  vertexShader:'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:`
    varying vec3 vDir; uniform vec3 topCol,botCol,sunDir,sunCol,moonDir; uniform float starMix,uUnder;
    float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){
      vec3 d=normalize(vDir);
      float h=d.y;
      vec3 col=mix(botCol,topCol,pow(smoothstep(-0.06,0.55,h),0.65));
      float sd=max(dot(d,sunDir),0.0);
      col+=sunCol*(pow(sd,1200.0)*1.6+pow(sd,10.0)*0.16+pow(sd,3.0)*0.05);
      float md=max(dot(d,moonDir),0.0);
      col+=vec3(0.75,0.82,1.0)*pow(md,600.0)*1.2*starMix;
      if(starMix>0.02){
        vec3 sp=floor(d*140.0);
        float st=hash(sp);
        float s=smoothstep(0.9975,0.9985,st)*(0.45+0.55*hash(sp+17.0));
        col+=vec3(s)*starMix*0.9;
        vec3 sp2=floor(d*64.0);
        float st2=hash(sp2+5.0);
        float s2=smoothstep(0.996,0.997,st2)*0.35;
        col+=vec3(s2)*starMix;
      }
      col=mix(col,vec3(0.06,0.16,0.34),uUnder);
      gl_FragColor=vec4(col,1.0);
    }`
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(600,24,16),skyMat);
sky.frustumCulled=false;
scene.add(sky);

/* 云 */
function cloudTex(){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const g=c.getContext('2d');
  const rnd=mulberry32(777);
  for(let i=0;i<42;i++){
    const x=rnd()*256, y=18+rnd()*92, w=10+rnd()*22, h=5+rnd()*12;
    const grd=g.createRadialGradient(x,y,0,x,y,Math.max(w,h));
    grd.addColorStop(0,'rgba(255,255,255,0.85)');
    grd.addColorStop(0.55,'rgba(255,255,255,0.5)');
    grd.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=grd;
    g.beginPath();g.ellipse(x,y,w,h,0,0,7);g.fill();
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(2.5,1.4);
  t.minFilter=t.magFilter=THREE.LinearFilter;
  return t;
}
const cloudMat=new THREE.MeshLambertMaterial({map:cloudTex(),transparent:true,opacity:0.85,depthWrite:false});
const clouds=[];
{ for(let i=0;i<2;i++){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(480,240),cloudMat);
    m.position.set(0,92+i*8,0);
    m.rotation.x=-Math.PI/2;
    clouds.push({mesh:m,offx:i*137,offz:i*89,spd:1.1+i*0.35});
    scene.add(m);
} }

/* ================= 玩家 ================= */
const player={x:8.5,y:worldHeight(8,8)+3,z:8.5,vx:0,vy:0,vz:0,yaw:0.6,pitch:-0.15,onGround:false,flying:false,eye:1.62};
const keys=new Set();
let mouseL=false,mouseR=false,breakTimer=0;
const BREAK_INTERVAL=0.24;

function collides(x,y,z){
  const b=getBlockWorld(x,y,z);
  return isSolid(b);
}
function moveAxis(axis,d){
  if(axis===0)player.x+=d;else if(axis===1)player.y+=d;else player.z+=d;
  const lo=[player.x-0.3,player.y,player.z-0.3];
  const hi=[player.x+0.3,player.y+1.8,player.z+0.3];
  const x0=Math.floor(lo[0]+1e-6),x1=Math.floor(hi[0]-1e-6);
  const y0=Math.floor(lo[1]+1e-6),y1=Math.floor(hi[1]-1e-6);
  const z0=Math.floor(lo[2]+1e-6),z1=Math.floor(hi[2]-1e-6);
  for(let bx=x0;bx<=x1;bx++)for(let by=y0;by<=y1;by++)for(let bz=z0;bz<=z1;bz++){
    if(!collides(bx,by,bz))continue;
    if(axis===0){
      if(d>0)player.x=bx-0.3-1e-4;else player.x=bx+1+0.3+1e-4;
      player.vx=0;
    }else if(axis===2){
      if(d>0)player.z=bz-0.3-1e-4;else player.z=bz+1+0.3+1e-4;
      player.vz=0;
    }else{
      if(d>0){player.y=by-1.8-1e-4;player.vy=0;}
      else{player.y=by+1+1e-4;player.vy=0;player.onGround=true;}
    }
  }
}
function inWater(){
  const ex=Math.floor(player.x),ey=Math.floor(player.y+player.eye),ez=Math.floor(player.z);
  return getBlockWorld(ex,ey,ez)===WATER||getBlockWorld(Math.floor(player.x),Math.floor(player.y+0.4),Math.floor(player.z))===WATER;
}
function updatePlayer(dt){
  const fw=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
  const st=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
  const sprint=keys.has('ControlLeft')||keys.has('ControlRight');
  const sneak=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const sin=Math.sin(player.yaw),cos=Math.cos(player.yaw);
  let fx=-sin, fz=-cos, rx=-fz, rz=sin;
  let mx=fx*fw+rx*st, mz=fz*fw+rz*st;
  const ml=Math.hypot(mx,mz);
  if(ml>0){mx/=ml;mz/=ml;}
  const water=inWater();
  if(player.flying){
    const sp=(sprint?16:11);
    player.vx=mx*sp; player.vz=mz*sp;
    const vv=(keys.has('Space')?1:0)-(keys.has('ShiftLeft')||keys.has('ShiftRight')?1:0);
    player.vy=vv*sp*0.8;
    player.onGround=false;
  }else{
    const sp=sprint?6.6:sneak?1.8:4.4;
    const acc=20;
    player.vx=lerp(player.vx,mx*sp,clamp(acc*dt,0,1));
    player.vz=lerp(player.vz,mz*sp,clamp(acc*dt,0,1));
    if(water){
      player.vy-=9*dt;
      player.vy=Math.max(player.vy,-4.2);
      if(keys.has('Space'))player.vy=3.6;
      player.vx*=0.94; player.vz*=0.94;
    }else{
      player.vy-=30*dt;
      if(player.vy<-45)player.vy=-45;
      if(keys.has('Space')&&player.onGround){player.vy=9.2;player.onGround=false;}
    }
  }
  player.onGround=false;
  moveAxis(0,player.vx*dt);
  moveAxis(2,player.vz*dt);
  moveAxis(1,player.vy*dt);
}
/* ================= 射线（体素 DDA） ================= */
function raycast(o,dir,maxDist){
  let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z);
  const sx=dir.x>0?1:-1,sy=dir.y>0?1:-1,sz=dir.z>0?1:-1;
  const tdx=dir.x!==0?Math.abs(1/dir.x):Infinity;
  const tdy=dir.y!==0?Math.abs(1/dir.y):Infinity;
  const tdz=dir.z!==0?Math.abs(1/dir.z):Infinity;
  let tmx=dir.x!==0?(dir.x>0?(x+1-o.x):(o.x-x))*tdx:Infinity;
  let tmy=dir.y!==0?(dir.y>0?(y+1-o.y):(o.y-y))*tdy:Infinity;
  let tmz=dir.z!==0?(dir.z>0?(z+1-o.z):(o.z-z))*tdz:Infinity;
  let nx=0,ny=0,nz=0;
  for(let i=0;i<160;i++){
    let t;
    if(tmx<tmy&&tmx<tmz){t=tmx;tmx+=tdx;x+=sx;nx=-sx;ny=0;nz=0;}
    else if(tmy<tmz){t=tmy;tmy+=tdy;y+=sy;ny=-sy;nx=0;nz=0;}
    else{t=tmz;tmz+=tdz;z+=sz;nz=-sz;nx=0;ny=0;}
    if(t>maxDist)return null;
    const b=getBlockWorld(x,y,z);
    if(b!==AIR)return {x,y,z,nx,ny,nz,b};
  }
  return null;
}
/* ================= 方块高亮框 ================= */
const hlGeo=new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002));
const hlMat=new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:0.5});
const hlMat2=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.85});
const hl=new THREE.LineSegments(hlGeo,hlMat);
const hl2=new THREE.LineSegments(hlGeo,hlMat2);
hl.visible=false;hl2.visible=false;
hl2.scale.set(1.004,1.004,1.004);
scene.add(hl);scene.add(hl2);

/* ================= 方块编辑 ================= */
let selSlot=0;
const hotbarItems=[GRASS,DIRT,STONE,LOG,PLANKS,LEAVES,GLASS,COBBLE,BRICK];
let target=null;
function doBreak(){
  if(!target)return;
  setBlockWorld(target.x,target.y,target.z,AIR);
  rebuildDirtySoon();
}
function doPlace(){
  if(!target)return;
  const x=target.x+target.nx,y=target.y+target.ny,z=target.z+target.nz;
  if(y<=0||y>=H-1)return;
  const cur=getBlockWorld(x,y,z);
  if(cur!==AIR&&!isPlant(cur)&&cur!==WATER)return;
  // 不能放进玩家身体
  const b=hotbarItems[selSlot];
  const px=player.x,py=player.y,pz=player.z;
  if(x+1>px-0.3&&x<px+0.3&&z+1>pz-0.3&&z<pz+0.3&&y+1>py&&y<py+1.8)return;
  setBlockWorld(x,y,z,b);
  rebuildDirtySoon();
}
function pickBlock(){
  if(!target)return;
  const idx=hotbarItems.indexOf(target.b);
  if(idx>=0)setSlot(idx);
}
/* ================= UI ================= */
const hotbarEl=document.getElementById('hotbar');
const slotEls=[];
{ for(let i=0;i<9;i++){
    const s=document.createElement('div');s.className='slot'+(i===0?' sel':'');
    const cv=document.createElement('canvas');cv.width=cv.height=40;
    const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
    const t=T[hotbarItems[i]];
    g.drawImage(atlas,t[0]*16,t[1]*16,16,16,1,1,38,38);
    const num=document.createElement('div');num.className='num';num.textContent=i+1;
    s.appendChild(cv);s.appendChild(num);hotbarEl.appendChild(s);slotEls.push(s);
} }
function setSlot(i){
  selSlot=(i+9)%9;
  slotEls.forEach((s,k)=>s.classList.toggle('sel',k===selSlot));
}
/* ===== 状态栏（爱心 + 饥饿值） ===== */
{ const statusEl=document.getElementById('status');
  const S=2,G=2;
  const HEART=['.XX.XX.','XXXXXXX','XXXXXXX','.XXXXX.','..XXX..','...X...'];
  const DRUM=['.MMMMM..','MMMMMMMM','MMMMMMMM','MMMMMMMM','MMMMMMMM','.WWWWW..','WWWWWWW.','WWWWWWW.','.WWWWW..'];
  const mk=(rows,w,h,fill)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=fill;for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++)if(rows[y][x]!=='.')g.fillRect(x*S,y*S,S,S);return c;};
  const hcv=mk(HEART,(7*S+G)*10-G,6*S,'#e84242');
  const hg=hcv.getContext('2d');hg.fillStyle='#ff6a5e';
  for(let i=0;i<10;i++){const ox=i*(7*S+G);hg.fillRect(ox+2*S,0,S,S);hg.fillRect(ox+4*S,0,S,S);}
  const dcv=mk(DRUM,(8*S+G)*10-G,9*S,'#c97a3d');
  const dg=dcv.getContext('2d');dg.fillStyle='#f4f1ea';
  for(let i=0;i<10;i++){const ox=i*(8*S+G);for(let y=0;y<4;y++)dg.fillRect(ox+(y===0?2:1)*S,y*S,(y===0?4:6)*S,S);}
  const hp=document.createElement('div');hp.style.cssText='display:flex;gap:2px;align-items:center;';
  hp.appendChild(hcv);hp.appendChild(dcv);statusEl.appendChild(hp);
}
const overlay=document.getElementById('overlay');
const startBox=document.getElementById('startBox');
const loadingBox=document.getElementById('loadingBox');
const loadFill=document.getElementById('loadingFill');
const loadText=document.getElementById('loadText');
const toastEl=document.getElementById('toast');
let toastTimer=0;
function showToast(t){
  toastEl.textContent=t;toastEl.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2200);
}
const debugEl=document.getElementById('debug');
const underTint=document.getElementById('underTint');
let paused=true, started=false;
let dragLook=false;
function showPause(){
  overlay.style.display='flex';
  startBox.style.display='block';
  const sb=document.getElementById('startBtn');
  sb.style.display='inline-block';
  sb.textContent='点击继续游戏';
  document.getElementById('keys').style.display='block';
  paused=true;
}
function startGame(){
  startBox.style.display='none';
  try{
    const p=cvs.requestPointerLock();
    if(p&&p.catch)p.catch(()=>enableFallback());
  }catch(e){enableFallback();}
  setTimeout(()=>{if(!document.pointerLockElement&&paused)enableFallback();},600);
}
function enableFallback(){
  if(document.pointerLockElement||!paused)return;
  dragLook=true;
  overlay.style.display='none';
  paused=false;
  showToast('已进入游戏 · 鼠标移动视角，Esc 暂停');
}
document.getElementById('startBtn').addEventListener('click',startGame);
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===cvs){
    dragLook=false;
    overlay.style.display='none';paused=false;
  }else if(started){
    showPause();
  }
});
document.addEventListener('pointerlockerror',()=>{if(started&&paused)enableFallback();});
/* 开始后 overlay 内按钮文字切换 */
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===cvs){
    player.yaw-=e.movementX*0.0023;
    player.pitch=clamp(player.pitch-e.movementY*0.0023,-1.55,1.55);
  }else if(dragLook&&!paused){
    player.yaw-=e.movementX*0.0023;
    player.pitch=clamp(player.pitch-e.movementY*0.0023,-1.55,1.55);
  }
});
cvs.addEventListener('mousedown',e=>{
  const active=document.pointerLockElement===cvs||dragLook;
  if(!active||paused)return;
  if(e.button===0){mouseL=true;breakTimer=0.1;doBreak();}
  else if(e.button===2){mouseR=true;doPlace();}
  else if(e.button===1){pickBlock();}
});
window.addEventListener('mouseup',e=>{
  if(e.button===0)mouseL=false;
  if(e.button===2)mouseR=false;
});
cvs.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('wheel',e=>{
  if(document.pointerLockElement===cvs)setSlot(selSlot+(e.deltaY>0?1:-1));
},{passive:true});
window.addEventListener('keydown',e=>{
  if(e.code==='Space')e.preventDefault();
  keys.add(e.code);
  if(e.code==='Escape'&&dragLook&&!paused&&started){showPause();return;}
  if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'||e.code==='Digit4'||e.code==='Digit5'||e.code==='Digit6'||e.code==='Digit7'||e.code==='Digit8'||e.code==='Digit9')setSlot(+e.code.slice(5)-1);
  if(e.code==='KeyF'&&paused===false){player.flying=!player.flying;player.vy=0;showToast(player.flying?'✈ 飞行模式 开':'🦶 飞行模式 关');}
  if(e.code==='KeyT')timeScale=timeScale>1?1:8;
  if(e.code==='F1'){renderDist=Math.max(3,renderDist-1);showToast('视距 '+renderDist);}
  if(e.code==='F2'){renderDist=Math.min(10,renderDist+1);showToast('视距 '+renderDist);}
  if(e.code==='F3'){debugEl.style.display=debugEl.style.display==='none'?'block':'none';}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

/* ================= 世界流式加载 ================= */
let renderDist=6;
let initQueue=[];
let worldReady=false;
function buildInitQueue(){
  const R=5,q=[];
  for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++)q.push([dx,dz]);
  q.sort((a,b)=>(a[0]*a[0]+a[1]*a[1])-(b[0]*b[0]+b[1]*b[1]));
  return q;
}
let spiral=[];
(function(){for(let r=1;r<=14;r++){
  for(let x=-r;x<=r;x++){spiral.push([x,-r],[x,r]);}
  for(let z=-r+1;z<r;z++){spiral.push([-r,z],[r,z]);}
}})();
function streamChunks(){
  if(!worldReady)return;
  const pcx=Math.floor(player.x/16),pcz=Math.floor(player.z/16);
  // 卸载
  for(const [k,c] of chunks){
    if(Math.abs(c.cx-pcx)>renderDist+2||Math.abs(c.cz-pcz)>renderDist+2){
      if(c.mesh){scene.remove(c.mesh);c.mesh.geometry.dispose();c.mesh=null;}
      chunks.delete(k);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const n=chunks.get(chunkKey(c.cx+dx,c.cz+dz));
        if(n)n.dirty=true;
      }
    }
  }
  // 加载缺失
  let budget=2;
  for(const [dx,dz] of spiral){
    if(budget<=0)break;
    const cx=pcx+dx,cz=pcz+dz;
    if(Math.abs(dx)>renderDist||Math.abs(dz)>renderDist)continue;
    if(chunks.has(chunkKey(cx,cz)))continue;
    const t0=performance.now();
    const c=generateChunk(cx,cz);
    buildChunkMesh(c);
    const dt=performance.now()-t0;
    if(dt>4)budget=1;
    else budget--;
  }
  // 重建脏块
  let rbudget=3;
  for(const [,c] of chunks){
    if(rbudget<=0)break;
    if(c.dirty){buildChunkMesh(c);rbudget--;}
  }
}
let rebuildPending=false;
function rebuildDirtySoon(){
  for(const [,c] of chunks){if(c.dirty)buildChunkMesh(c);}
}

/* ================= 时间 / 光照 ================= */
let dayTime=0.32; // 0.32 ≈ 早上
let timeScale=1;
function updateSky(dt){
  dayTime=(dayTime+dt*timeScale/240)%1;
  const az=dayTime*Math.PI*2;
  const elev=Math.sin((dayTime-0.25)*Math.PI*2);
  const cosE=Math.sqrt(Math.max(0,1-elev*elev));
  const sunDir=new THREE.Vector3(Math.cos(az)*cosE,elev,Math.sin(az)*cosE);
  const day=smoothstep(-0.08,0.22,elev);
  const sunset=smoothstep(0.0,0.16,elev)-smoothstep(0.16,0.32,elev);
  // 颜色
  const sunC=new THREE.Color().lerpColors(new THREE.Color(1.0,0.96,0.88),new THREE.Color(1.0,0.42,0.18),sunset*0.85);
  const topC=new THREE.Color().lerpColors(new THREE.Color(0.025,0.035,0.09),new THREE.Color(0.30,0.58,0.96),day);
  topC.lerp(new THREE.Color(0.22,0.30,0.62),sunset*0.4);
  const botC=new THREE.Color().lerpColors(new THREE.Color(0.045,0.06,0.11),new THREE.Color(0.78,0.87,0.95),day);
  botC.lerp(new THREE.Color(1.0,0.55,0.28),sunset*0.85);
  skyUniforms.topCol.value.copy(topC);
  skyUniforms.botCol.value.copy(botC);
  skyUniforms.sunDir.value.copy(sunDir);
  skyUniforms.sunCol.value.copy(sunC);
  skyUniforms.moonDir.value.set(-sunDir.x,Math.max(-sunDir.y,-0.6),-sunDir.z);
  skyUniforms.starMix.value=(1-day)*0.9;
  // 光照
  const nightC=1-day;
  const li=lerp(0.34,1.15,day);
  const moonC=new THREE.Color(0.55,0.65,1.0);
  sunLight.color.copy(sunC).lerp(moonC,nightC*0.85);
  sunLight.intensity=Math.max(li,0.42);
  sunLight.position.set(player.x+sunDir.x*120,player.y+Math.max(sunDir.y*120,25),player.z+sunDir.z*120);
  sunLight.target.position.copy(player);
  hemi.color.setRGB(lerp(0.14,0.56,day),lerp(0.17,0.70,day),lerp(0.34,0.90,day));
  hemi.groundColor.setRGB(lerp(0.16,0.5,day),lerp(0.15,0.42,day),lerp(0.24,0.32,day));
  hemi.intensity=lerp(0.5,0.68,day);
  renderer.toneMappingExposure=lerp(1.2,1.06,day);
  // 雾 / 天空跟随
  scene.fog.color.copy(botC);
  const RD=renderDist*16;
  scene.fog.near=RD*0.42;scene.fog.far=RD*0.95;
  sky.position.copy(camera.position);
  const under=getBlockWorld(Math.floor(camera.position.x),Math.floor(camera.position.y),Math.floor(camera.position.z))===WATER;
  skyUniforms.uUnder.value=under?1:0;
  underTint.style.display=under?'block':'none';
  if(under){scene.fog.near=1;scene.fog.far=26;scene.fog.color.setRGB(0.03,0.10,0.22);}
  // 云
  const cloudC=new THREE.Color().lerpColors(new THREE.Color(0.14,0.15,0.24),new THREE.Color(1,1,1),day);
  cloudC.lerp(new THREE.Color(1.0,0.6,0.35),sunset*0.55);
  cloudMat.color.copy(cloudC);
  cloudMat.opacity=0.2+0.65*day;
}
const tmpV=new THREE.Vector3();
function updateClouds(dt){
  for(let i=0;i<clouds.length;i++){
    const c=clouds[i];
    c.offx+=c.spd*dt;
    const m=c.mesh;
    m.position.x=Math.round((player.x+c.offx)/160)*160;
    m.position.z=Math.round((player.z+c.offz)/160)*160;
    m.position.y=92+i*8;
  }
}

/* ================= 主循环 ================= */
let last=performance.now(),fps=60,fpsAcc=0,fpsN=0,debugTimer=0;
let quality=2,qualityTimer=0,frameEMA=0.016;
const QUAL=[1.5,1.25,1.1,1.0];
const SHAD=[2048,1536,1024,768];
function applyQuality(){
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,QUAL[quality]));
  sunLight.shadow.mapSize.set(SHAD[quality],SHAD[quality]);
}
const SHOT=location.search.includes('shot');
let autoRotate=SHOT;
function loop(now){
  const rdt=(now-last)/1000;last=now;
  const dt=Math.min(0.05,rdt);
  frameEMA=lerp(frameEMA,rdt,0.04);
  qualityTimer+=rdt;
  if(qualityTimer>2.5){
    qualityTimer=0;
    if(frameEMA>0.042&&quality>0){quality--;applyQuality();showToast('⚙ 画质已自动降低');}
    else if(frameEMA<0.016&&quality<2){quality++;applyQuality();}
  }
  fpsAcc+=dt;fpsN++;if(fpsAcc>=0.5){fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;}
  updateSky(dt);
  updateClouds(dt);
  if(!paused){
    updatePlayer(dt);
    if(mouseL){breakTimer-=dt;if(breakTimer<=0){doBreak();breakTimer=BREAK_INTERVAL;}}
  }
  // 相机
  camera.position.set(player.x,player.y+player.eye,player.z);
  camera.rotation.set(player.pitch,player.yaw,0);
  // 瞄准
  if(!paused){
    tmpV.set(0,0,-1).applyEuler(camera.rotation);
    target=raycast(camera.position,tmpV,6);
    if(target){
      hl.visible=true;hl2.visible=true;
      hl.position.set(target.x+0.5,target.y+0.5,target.z+0.5);
      hl2.position.set(target.x+0.5,target.y+0.5,target.z+0.5);
    }else{hl.visible=false;hl2.visible=false;}
  }else{hl.visible=false;hl2.visible=false;}
  streamChunks();
  waterTex.offset.x+=dt*0.06;
  renderer.render(scene,camera);
  debugTimer+=dt;
  if(debugTimer>0.4){
    debugTimer=0;
    debugEl.textContent=
      `FPS   ${fps.toFixed(1)}\n`+
      `XYZ   ${player.x.toFixed(1)} ${player.y.toFixed(1)} ${player.z.toFixed(1)}\n`+
      `区块  ${chunks.size}  |  三角面 ${(renderer.info.render.triangles/1000).toFixed(0)}k\n`+
      `时间  ${(dayTime*24).toFixed(1)}:00  ${player.flying?'飞行中':''}\n`+
      `视距  ${renderDist}  |  draw ${renderer.info.render.calls}`;
  }
  if(autoRotate&&!paused){
    player.yaw+=dt*0.25;
  }
}
renderer.setAnimationLoop(loop);

/* ================= 初始化 ================= */
(function init(){
  initQueue=buildInitQueue();
  const total=initQueue.length;
  (function step(){
    const t0=performance.now();
    let n=0;
    while(initQueue.length&&performance.now()-t0<40){
      const [dx,dz]=initQueue.shift();
      const c=generateChunk(dx,dz);
      buildChunkMesh(c);
      n++;
    }
    const done=total-initQueue.length;
    loadFill.style.width=(done/total*100)+'%';
    loadText.textContent=`正在生成世界… ${done}/${total}`;
    if(initQueue.length){
      requestAnimationFrame(step);
    }else{
      // 出生点（找一块草地，清除可能的树）
      const sp=findSpawn();
      const h=sp.h;
      for(let yy=h+1;yy<h+9;yy++)for(let xx=sp.x-2;xx<=sp.x+2;xx++)for(let zz=sp.z-2;zz<=sp.z+2;zz++)setBlockWorld(xx,yy,zz,AIR);
      const qp=new URLSearchParams(location.search);
      if(qp.get('x')!==null&&qp.get('z')!==null){
        player.x=+qp.get('x')+0.5;player.z=+qp.get('z')+0.5;
        player.y=worldHeight(+qp.get('x'),+qp.get('z'))+3;
      }else{
        player.x=sp.x+0.5;player.y=h+2;player.z=sp.z+0.5;
      }
      loadingBox.style.display='none';
      startBox.style.display='block';
      started=true;
      worldReady=true;
      if(SHOT){overlay.style.display='none';paused=false;showToast('演示模式');}
    }
  })();
})();

/* ================= 调试接口 ================= */
window.__mc={
  player, getBlock:(x,y,z)=>getBlockWorld(x,y,z),
  setBlock:(x,y,z,b)=>{setBlockWorld(x,y,z,b);rebuildDirtySoon();},
  teleport:(x,z)=>{player.x=x+0.5;player.z=z+0.5;player.y=worldHeight(Math.floor(x),Math.floor(z))+3;},
  time:(t)=>{dayTime=t;},
  chunks:()=>chunks.size,
  stats:()=>({fps:Math.round(fps),chunks:chunks.size,tris:renderer.info.render.triangles,calls:renderer.info.render.calls}),
  renderDist:(r)=>{if(r)renderDist=clamp(r,3,10);return renderDist;},
  aim:(y,p)=>{player.yaw=y;player.pitch=p;autoRotate=false;},
  quality:(q)=>{if(q!==undefined)quality=clamp(q|0,0,2);applyQuality();return quality;},
  breakTarget:()=>doBreak(),
  placeTarget:()=>doPlace(),
  target:()=>target?{x:target.x,y:target.y,z:target.z,b:target.b,nx:target.nx,ny:target.ny,nz:target.nz}:null,
  dbg:{worldHeight, snoise2, snoise3, fbm2, getBlockWorld, setBlockWorld, dayTime:()=>dayTime, clouds:(v)=>{clouds.forEach(c=>c.mesh.visible=v);}, plants:(v)=>{matPlant.visible=v;}, highlight:(v)=>{hl.visible=hl2.visible=v;}, sky:(v)=>{sky.visible=v;}}
};
})();
