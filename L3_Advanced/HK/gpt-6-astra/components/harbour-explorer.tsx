'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Orbit, Footprints, ArrowUpRight, ArrowRight, MapPin, Compass, Layers3, Grid3X3, Sun, Sunset, Sunrise, Moon, CloudFog, CloudRain, Camera, Maximize2, Minimize2, Plus, Minus, RotateCcw, Volume2, VolumeX, Pause, Play, CircleHelp, X, Navigation, Check, ChevronRight, Menu, LoaderCircle, Keyboard, Eye, Building2, SlidersHorizontal, ExternalLink, MoveUpRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BOUNDS, LANDMARKS, VIEWS, type CityData } from '@/lib/harbour/geo';
import type { HarbourEngine, FrameInfo, Settings } from '@/lib/harbour/engine';

const INITIAL: Settings = { hour: 17.5, grid: false, chunks: false, labels: true, motion: true, weather: 'clear', quality: 'high' };
const initialFrame: FrameInfo = { fps: 0, calls: 0, visibleChunks: 0, heading: 0, position: [0,0,0],lon:114.1694,lat:22.29,labels:[] };
const clockText=(h:number)=>`${String(Math.floor(h)%24).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
const ViewIcons=[Orbit,Eye,Building2,Sunset];

function MiniMap({ data, frame, onNavigate }: { data: CityData | null; frame: FrameInfo; onNavigate: (x:number,z:number)=>void }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d'); if(!ctx||!data)return;
    const w=440,h=280,sx=w/(BOUNDS.maxX-BOUNDS.minX),sz=h/(BOUNDS.maxZ-BOUNDS.minZ);
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#18272c';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#213037';ctx.lineWidth=1;
    for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let z=0;z<h;z+=40){ctx.beginPath();ctx.moveTo(0,z);ctx.lineTo(w,z);ctx.stroke();}
    const p=(x:number,z:number)=>[(x-BOUNDS.minX)*sx,(z-BOUNDS.minZ)*sz];
    for(const poly of data.land){ctx.beginPath();poly.forEach((v,i)=>{const q=p(...v);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.fillStyle='#3e4c4d';ctx.fill();ctx.strokeStyle='#728078';ctx.lineWidth=1.2;ctx.stroke();}
    ctx.fillStyle='#70827b';
    data.buildings.forEach((b,i)=>{if(i%4)return;const v=b.p[0];const q=p(...v);ctx.fillRect(q[0],q[1],1.3,1.3);});
    ctx.font='18px Arial';ctx.fillStyle='#a2adaa';ctx.fillText('九 龙',245,57);ctx.fillText('香 港 岛',160,240);
    ctx.font='italic 16px Georgia';ctx.fillStyle='#768d91';ctx.fillText('Victoria Harbour',143,137);
    const q=p(frame.position[0],frame.position[2]),px=Math.max(14,Math.min(w-14,q[0])),pz=Math.max(14,Math.min(h-14,q[1]));
    ctx.save();ctx.translate(px,pz);ctx.rotate(frame.heading*Math.PI/180);ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,48,-Math.PI*.7,-Math.PI*.3);ctx.closePath();ctx.fillStyle='#d4bb7730';ctx.fill();ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fillStyle='#e4cb89';ctx.fill();ctx.restore();
  },[data,frame]);
  return <div className="mini-map"><div className="mini-map-heading"><span><MapPin size={13}/> 位置概览</span><span>N <Navigation size={11}/></span></div><canvas ref={canvas} width={440} height={280} aria-label="香港两岸地图，点击地图前往对应位置" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onNavigate(0,0);}} onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();onNavigate(BOUNDS.minX+(e.clientX-rect.left)/rect.width*(BOUNDS.maxX-BOUNDS.minX),BOUNDS.minZ+(e.clientY-rect.top)/rect.height*(BOUNDS.maxZ-BOUNDS.minZ));}}/><div className="mini-map-foot"><span>维多利亚港</span><span className="map-scale">500 m</span></div></div>;
}

export default function HarbourExplorer(){
  const host=useRef<HTMLDivElement>(null),engine=useRef<HarbourEngine|null>(null);
  const [data,setData]=useState<CityData|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  const [settings,setSettings]=useState<Settings>(INITIAL),[mode,setMode]=useState<'orbit'|'walk'>('orbit');
  const [view,setView]=useState('harbour'),[selected,setSelected]=useState<string|null>(null),[frame,setFrame]=useState(initialFrame);
  const [inspect,setInspect]=useState(false),[help,setHelp]=useState(false),[audio,setAudio]=useState(false),[locked,setLocked]=useState(false),[playing,setPlaying]=useState(false),[mobilePanel,setMobilePanel]=useState(false),[full,setFull]=useState(false);
  const [toast,setToast]=useState(''),[audit,setAudit]=useState<ReturnType<HarbourEngine['audit']>|null>(null);
  const notify=useCallback((text:string)=>setToast(text),[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();
    async function boot(){try{
      const [response,module]=await Promise.all([fetch('/city.json',{signal:controller.signal}),import('@/lib/harbour/engine')]);
      if(!response.ok)throw Error('城市数据暂时无法载入。');
      const city:CityData=await response.json();if(cancelled||!host.current)return;
      setData(city);await new Promise(resolve=>setTimeout(resolve,80));if(cancelled||!host.current)return;
      const instance=new module.HarbourEngine(host.current,city,setFrame,setLocked);engine.current=instance;setAudit(instance.audit());setReady(true);
    }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'三维场景初始化失败。');}}
    boot();return()=>{cancelled=true;controller.abort();engine.current?.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.setSettings(settings);},[settings,ready]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setSettings(s=>({...s,hour:(s.hour+.025)%24})),150);return()=>clearInterval(timer);},[playing]);
  useEffect(()=>{const handler=()=>setFull(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',handler);return()=>document.removeEventListener('fullscreenchange',handler);},[]);
  const update=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
  const changeMode=(value:'orbit'|'walk')=>{if(!ready)return;setMode(value);engine.current?.setMode(value,view);if(value==='walk'&&selected)engine.current?.flyLandmark(selected);setMobilePanel(false);if(value==='walk')notify('W A S D 移动 · Shift 加速 · Esc 释放鼠标');};
  const chooseView=(id:string)=>{setView(id);setSelected(null);engine.current?.flyView(id);setMobilePanel(false);};
  const chooseLandmark=(id:string)=>{setSelected(id);engine.current?.flyLandmark(id);setMobilePanel(false);};
  const toggleGrid=()=>{const next=!settings.grid;update('grid',next);setInspect(next);if(next)setAudit(engine.current?.audit()||null);};
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,[role="slider"],[role="dialog"]'))return;if(e.code==='KeyG'){setSettings(s=>({...s,grid:!s.grid}));}if(e.code==='KeyH')setHelp(v=>!v);if(e.code==='KeyR')engine.current?.flyView('harbour');};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
  const landmark=LANDMARKS.find(l=>l.id===selected);
  const night=settings.hour<6||settings.hour>=19;
  const WeatherIcon=settings.weather==='rain'?CloudRain:settings.weather==='haze'?CloudFog:night?Moon:Sun;
  const period=night?'城市之夜':settings.hour<9?'晨光初现':settings.hour<16?'日光漫游':'黄金时刻';
  const weatherText=settings.weather==='clear'?'晴朗':settings.weather==='haze'?'薄雾':'阴雨';
  const changeWeather=()=>update('weather',settings.weather==='clear'?'haze':settings.weather==='haze'?'rain':'clear');
  const fullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('当前窗口不支持全屏，可在浏览器中打开。');}};

  return <main className="atlas-app">
    <header className="app-header">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();chooseView('harbour');}} aria-label="Harbour Atlas 返回维港全景"><span className="brand-mark"><Box size={25} strokeWidth={1.3}/><i/></span><span>HARBOUR<span className="brand-light"> ATLAS</span><small>HONG KONG · VOXEL WORLD</small></span></a>
      <nav className="top-nav" aria-label="工作台"><button className={!inspect?'active':''} onClick={()=>setInspect(false)}><Orbit size={15}/>城市探索</button><button className={inspect?'active':''} onClick={()=>{setInspect(true);setAudit(engine.current?.audit()||null);}}><Grid3X3 size={15}/>网格检查</button><button onClick={()=>setHelp(true)}>关于沙盘<ArrowUpRight size={13}/></button></nav>
      <div className="header-actions"><span className="live-status"><i/>{ready?'世界已就绪':'构建城市中'}</span><button className="icon-button capture" onClick={()=>{engine.current?.screenshot();notify('已保存当前画面');}} title="保存当前画面" disabled={!ready}><Camera size={18}/></button><button className="primary-button enter" disabled={!ready} onClick={()=>changeMode(mode==='walk'?'orbit':'walk')}>{mode==='walk'?<Orbit size={16}/>:<Footprints size={16}/>}<span>{mode==='walk'?'返回沙盘':'进入城市'}</span><ArrowUpRight size={15}/></button></div>
    </header>

    <aside className={`control-panel ${mobilePanel?'mobile-open':''}`} aria-label="探索控制台">
      <div className="panel-heading"><span>探索控制台</span><button className="mobile-close icon-button" aria-label="收起控制台" onClick={()=>setMobilePanel(false)}><X size={17}/></button><SlidersHorizontal className="desktop-only" size={15}/></div>
      <Tabs value={mode} onValueChange={v=>changeMode(v as 'orbit'|'walk')} className="mode-tabs"><TabsList><TabsTrigger value="orbit" disabled={!ready}><Orbit size={15}/>沙盘视角</TabsTrigger><TabsTrigger value="walk" disabled={!ready}><Footprints size={15}/>步行探索</TabsTrigger></TabsList><TabsContent value="orbit" className="mode-caption">从城市尺度，发现维港的每一面。</TabsContent><TabsContent value="walk" className="mode-caption">1.7 m 视高 · 走入真实尺度的街道</TabsContent></Tabs>
      {inspect?<section className="grid-inspector"><div className="section-label"><span>网格与空间</span><span className="tiny-label">GRID SYSTEM</span></div><div className="grid-hero"><Box size={34} strokeWidth={1}/><strong>0.5<span>m</span></strong><p>全局基础体素</p></div><div className="switch-row"><label htmlFor="grid-inspect">体素网格</label><Switch id="grid-inspect" checked={settings.grid} onCheckedChange={v=>update('grid',v)}/></div><div className="switch-row"><label htmlFor="chunks">分块边界</label><Switch id="chunks" checked={settings.chunks} onCheckedChange={v=>update('chunks',v)}/></div><div className="inspector-values"><p><span>坐标原点</span><b>114.1694° E<br/>22.2900° N</b></p><p><span>坐标轴</span><b>X 东 · Y 上 · Z 南</b></p><p><span>区块边长</span><b>256 m</b></p><p><span>网格表面步长</span><b>4 m / 0.5 m 细部</b></p><p><span>压缩占用段</span><b>{audit?.runs.toLocaleString()||'—'}</b></p><p><span>细部占用段</span><b>{audit?.detailRuns.toLocaleString()||'0'}</b></p></div><button className="audit-button" disabled={!ready} onClick={()=>{setAudit(engine.current?.audit()||null);notify('已检查整数网格边界与尺寸');}}><Check size={15}/>{audit?.aligned?'网格对齐检查通过':'等待场景就绪'}<RotateCcw size={13}/></button><p className="inspector-note">远处显示 32 m 辅助格，接近时细分到 4 m 和 0.5 m。所有层级共享同一原点。</p></section>:<>
        <section className="view-section"><div className="section-label"><span>预设观景点</span><span className="tiny-label">04 VIEWS</span></div><div className="view-list">{VIEWS.map((v,i)=>{const Icon=ViewIcons[i];return <button key={v.id} className={`view-card ${view===v.id&&!selected?'selected':''}`} disabled={!ready} onClick={()=>chooseView(v.id)}><span className="view-icon"><Icon size={21} strokeWidth={1.3}/></span><span><b>{v.name}</b><small>{v.en}</small></span><span className="view-index">0{i+1}</span><ArrowUpRight className="view-arrow" size={14}/></button>;})}</div></section>
        <section className="landmarks-section"><div className="section-label"><span>城市地标</span><MapPin size={13}/></div><div className="landmark-list">{LANDMARKS.map((l,i)=><button key={l.id} disabled={!ready} className={`landmark-row ${selected===l.id?'selected':''}`} onClick={()=>chooseLandmark(l.id)}><span className="landmark-number">0{i+1}</span><span><b>{l.name}</b><small>{l.id==='hkcec'?'HKCEC':l.en==='TWO IFC'?'IFC · 中环':l.id==='boc'?'BOC · 金钟':'ICC · 西九龙'}</small></span><span className="landmark-height">{l.displayHeight}</span><ChevronRight size={12}/></button>)}</div></section>
        {landmark&&<div className="landmark-detail"><div><span className="tiny-label">{landmark.area}</span><button aria-label="关闭地标说明" onClick={()=>setSelected(null)}><X size={13}/></button></div><p>{landmark.desc}</p><button className="text-link" onClick={()=>changeMode('walk')}>在附近落地探索<ArrowRight size={13}/></button></div>}
      </>}
      <div className="panel-bottom"><div className="switch-row"><label htmlFor="labels"><MapPin size={14}/>地标标注</label><Switch id="labels" checked={settings.labels} onCheckedChange={v=>update('labels',v)}/></div><div className="switch-row"><label htmlFor="motion"><Orbit size={14}/>城市动态</label><Switch id="motion" checked={settings.motion} onCheckedChange={v=>update('motion',v)}/></div><div className="world-card"><div><span className="world-dot"/>同一网格，连接整座城市<Box size={14}/></div><p><strong>1 : 1</strong><span>现实米制</span><i/><strong>0.5 m</strong><span>基础网格</span></p></div><button className="guide-link" onClick={()=>setHelp(true)}><CircleHelp size={15}/>操作指南<span>H</span></button></div>
    </aside>

    <section className={`world-viewport ${mode==='walk'?'is-walking':''}`} aria-label="三维探索窗口">
      <div ref={host} className="scene-host"/>
      <div className="viewport-vignette"/>
      <div className="scene-title"><div className="eyebrow"><span/>HONG KONG · DIGITAL SANDBOX</div><h1>维多利亚港</h1><p>VICTORIA HARBOUR <span>/</span> 22°17′ N 114°10′ E</p></div>
      <div className="scene-weather"><button title="点击切换晴朗、薄雾、阴雨" onClick={changeWeather}><WeatherIcon size={23} strokeWidth={1.25}/><span>{weatherText}<small>{settings.weather==='clear'?'CLEAR SKY':settings.weather==='haze'?'SOFT HAZE':'OVERCAST'}</small></span></button><i/><div><strong>{clockText(settings.hour)}</strong><small>HONG KONG TIME</small></div></div>
      <button className="mobile-menu icon-button" aria-label="打开控制台" onClick={()=>setMobilePanel(true)}><Menu size={20}/></button>
      <div className="floating-labels" aria-hidden={!settings.labels}>{frame.labels.filter(l=>l.visible).map(l=>{const feature=LANDMARKS.find(v=>v.id===l.id)!;return <button key={l.id} className={`world-label ${selected===l.id?'active':''}`} style={{left:l.x,top:l.y}} onClick={()=>chooseLandmark(l.id)}><span className="label-body"><i/>{feature.name}<ArrowUpRight size={11}/></span><span className="label-stem"/><span className="label-anchor"/></button>;})}</div>
      <div className="viewport-tools"><button className="icon-button compass-control" title="朝向正北" onClick={()=>engine.current?.north()}><span>N</span><Navigation size={20} strokeWidth={1.2} style={{transform:`rotate(${-frame.heading}deg)`}}/></button><div className="tool-group"><button className="icon-button" aria-label="放大" disabled={mode==='walk'} onClick={()=>engine.current?.zoom(1)}><Plus size={19}/></button><button className="icon-button" aria-label="缩小" disabled={mode==='walk'} onClick={()=>engine.current?.zoom(-1)}><Minus size={19}/></button></div><div className="tool-group"><button className={`icon-button ${settings.grid?'active':''}`} aria-label="切换体素网格 G" aria-pressed={settings.grid} onClick={toggleGrid}><Grid3X3 size={18}/></button><button className={`icon-button ${settings.chunks?'active':''}`} aria-label="切换分块边界" aria-pressed={settings.chunks} onClick={()=>update('chunks',!settings.chunks)}><Layers3 size={18}/></button></div><button className="icon-button" aria-label={full?'退出全屏':'全屏'} onClick={fullscreen}>{full?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button></div>
      {settings.grid&&<div className="grid-badge"><Grid3X3 size={14}/><span>网格检查视图</span><b>{mode==='walk'?'0.5 m':'32 m'} 辅助格</b></div>}
      {mode==='walk'&&<><div className="crosshair"/><div className={`walk-instructions ${locked?'locked':''}`}><Footprints size={16}/><span>{locked?'W A S D 移动 · Shift 加速 · Space 跳跃':'点击场景自由环顾 · W A S D 移动'}</span><button onClick={()=>changeMode('orbit')}>返回沙盘<ArrowUpRight size={13}/></button></div><div className="touch-movement">{[['ArrowUp','↑'],['ArrowLeft','←'],['ArrowDown','↓'],['ArrowRight','→']].map(([code,label])=><button key={code} aria-label={`移动 ${label}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);engine.current?.setKey(code,true);}} onPointerUp={()=>engine.current?.setKey(code,false)} onPointerCancel={()=>engine.current?.setKey(code,false)}>{label}</button>)}</div></>}
      <div className="scene-bottom-left"><div className="location-chip"><MapPin size={13}/>{mode==='walk'?'街道漫游':selected?landmark?.area:VIEWS.find(v=>v.id===view)?.name}<span>{mode==='walk'?'1.70 m':'自由视角'}</span></div><div className="navigation-hint"><span className="mouse-icon"/>拖动旋转 <i/>滚轮缩放 <i/>右键平移</div></div>
      <div className="environment-panel"><div className="environment-top"><span><Sunset size={16}/>{period}<small>光照与时间</small></span><div><button className="icon-button" title={audio?'关闭环境音':'开启空间环境音'} onClick={async()=>{try{await engine.current?.setAudio(!audio);setAudio(!audio);}catch{notify('浏览器暂时无法启用环境音');}}}>{audio?<Volume2 size={16}/>:<VolumeX size={16}/>}</button><button className={`icon-button ${playing?'active':''}`} title={playing?'暂停时间流逝':'播放昼夜变化'} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button><strong>{clockText(settings.hour)}</strong></div></div><div className="time-slider"><Slider aria-label="一天中的时间" min={0} max={23.99} step={.25} value={[settings.hour]} onValueChange={v=>{setPlaying(false);update('hour',Array.isArray(v)?v[0]:v);}}/><div className="time-marks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div><div className="time-presets">{[{name:'晨曦',h:6.75,Icon:Sunrise},{name:'日间',h:12,Icon:Sun},{name:'日落',h:17.5,Icon:Sunset},{name:'夜景',h:21,Icon:Moon}].map(({name,h,Icon})=><button key={name} className={Math.abs(settings.hour-h)<1?'active':''} onClick={()=>{setPlaying(false);update('hour',h);}}><Icon size={14}/>{name}</button>)}</div></div>
      <MiniMap data={data} frame={frame} onNavigate={(x,z)=>engine.current?.teleport(x,z)}/>
      {!ready&&<div className="scene-loading" role="status">{error?<><Box size={32}/><h2>暂时无法打开三维世界</h2><p>{error}</p><button className="primary-button" onClick={()=>window.location.reload()}>重新载入</button><small>需要支持 WebGL 2 的浏览器与硬件加速。</small></>:<><div className="loading-cube"><Box size={38} strokeWidth={1}/></div><span className="eyebrow">ASSEMBLING HONG KONG</span><h2>{data?'正在编织城市网格':'正在载入维港两岸'}</h2><p>{data?`${data.meta.buildings.toLocaleString()} 个建筑结构，共享同一空间原点。`:'建筑、街道与海岸线，即将在此相遇。'}</p><div className="loading-track"><span/></div></>}</div>}
      {toast&&<div className="atlas-toast" role="status"><Check size={15}/>{toast}</div>}
    </section>

    <footer className="status-bar"><div><span className="status-indicator"/><span>香港城市沙盘</span><i/><span>{data?.meta.buildings.toLocaleString()||'—'} 个建筑结构</span><i/><span>地政总署公开数据</span></div><div><span className="coordinates">{frame.lat.toFixed(4)}° N &nbsp; {frame.lon.toFixed(4)}° E</span><i/><button title="切换画质" onClick={()=>update('quality',settings.quality==='high'?'balanced':'high')}>{settings.quality==='high'?'高品质':'流畅模式'}<ChevronRight size={11}/></button><span className="fps"><i/>{frame.fps||'—'} FPS</span></div></footer>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="atlas-dialog"><DialogTitle><Box size={26} strokeWidth={1.2}/>认识这座体素香港</DialogTitle><DialogDescription>HARBOUR ATLAS · 探索指南与数据说明</DialogDescription><div className="guide-grid"><div><h3><Orbit size={17}/>俯瞰城市</h3><p>拖动旋转 · 滚轮缩放<br/>右键平移 · 选择地标飞近观察</p></div><div><h3><Footprints size={17}/>走入街道</h3><p>W A S D 移动 · Shift 加速<br/>Space 跳跃 · Esc 释放鼠标</p></div></div><div className="guide-keys"><kbd>G</kbd>网格辅助线<kbd>R</kbd>维港全景<kbd>H</kbd>操作指南</div><div className="guide-copy"><h3>真实地图，统一网格</h3><p>建筑轮廓与高度来自香港地政总署 CSDI，道路来自道路中线数据，岸线采用公开香港行政区 GeoJSON，植被参考 CEDD 地形图。全部实体以 0.5 米为基础网格，采用整数占用段与表面合并；城市轮廓以 4 米步长采样，近处立面细部为 0.5 米。</p><p>这是可探索的艺术化沙盘：山体为示意地形，岸线参考数据发布于 2019 年，地标轮廓经过体素化简化；室内、实时交通和精确工程地形不在本版本中。低层基座和塔楼重叠区域在生成前合并，避免重复占用。</p><div className="source-links"><a href="https://data.gov.hk/en-data/dataset/hk-landsd-openmap-landsd-building/resource/e62b1e3f-c766-408f-a104-7848a775cbba" target="_blank" rel="noreferrer">建筑数据<ExternalLink size={12}/></a><a href="https://data.gov.hk/en-data/dataset/hk-landsd-openmap-road-centreline/resource/dd229cd1-9ba2-4a93-b4f7-355320cfffa8" target="_blank" rel="noreferrer">道路数据<ExternalLink size={12}/></a><a href="https://gist.github.com/howawong/487f3cfe98d8ec4b5df73aa8b73f4121" target="_blank" rel="noreferrer">海岸数据<ExternalLink size={12}/></a></div></div></DialogContent></Dialog>
  </main>;
}
