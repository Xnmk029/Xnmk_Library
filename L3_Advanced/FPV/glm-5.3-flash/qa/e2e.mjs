/* Headless-Chrome CDP end-to-end verification for answer.html (iteration #2).
   Real browser render + real Gamepad-API mock + real DOM events.            */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const WS = decodeURIComponent(new URL('.', import.meta.url).pathname).replace(new RegExp('^\/([A-Za-z]:)'),'$1');
const FILE_URL = 'file:///' + encodeURI('F:/benchmark/暂存/glm-5.3-flash-20260826/ws-fpv/answer.html');
const PORT = 9223;
const results=[]; let fails=0;
function check(name, pass, detail){
  results.push({name,pass,detail});
  console.log((pass?'PASS':'FAIL')+'  '+name+'   '+detail);
  if(!pass)fails++;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROF=WS+'_cdp_profile';
rmSync(PROF,{recursive:true,force:true});
const chrome=spawn(CHROME,[
 '--headless=new','--remote-debugging-port='+PORT,
 '--user-data-dir='+PROF,'--window-size=1280,720','--hide-scrollbars',
 '--no-first-run','--no-default-browser-check',
 '--enable-unsafe-swiftshader','--use-angle=swiftshader',
 'about:blank'],{stdio:'ignore'});
process.on('exit',()=>{try{chrome.kill();}catch(e){}});

async function wsConnect(url){
  const ws=new WebSocket(url);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=e=>rej(new Error('ws err'));});
  return ws;
}
let msgId=0; const pend=new Map(); const listeners=[];
function rpc(ws,method,params){
  const id=++msgId;
  return new Promise((res,rej)=>{
    pend.set(id,{res,rej});
    ws.send(JSON.stringify({id,method,params:params||{}}));});
}
function onMsg(ws,fn){listeners.push(fn);}
function pump(ws){
  ws.onmessage=(ev)=>{
    const m=JSON.parse(ev.data);
    if(m.id&&pend.has(m.id)){
      const p=pend.get(m.id);pend.delete(m.id);
      m.error?p.rej(new Error(m.error.message)):p.res(m.result);
    } else {for(const l of listeners)l(m);}
  };
}
async function evalJs(ws,expr){
  const r=await rpc(ws,'Runtime.evaluate',
    {expression:expr,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw new Error('page: '+
    (r.exceptionDetails.exception?.description||r.exceptionDetails.text));
  return r.result.value;
}

/* ---------------- screenshots + navigation helpers ---------------- */
async function shot(ws,name){
  const r=await rpc(ws,'Page.captureScreenshot',{format:'png'});
  writeFileSync(WS+name,Buffer.from(r.data,'base64'));
  console.log('shot -> qa/'+name);
}
async function waitLoad(ws){
  await new Promise(res=>{
    const off=(m)=>{if(m.method==='Page.loadEventFired'){off();res();}};
    onMsgOnce(ws,off);});
}
const onceQ=[];
function onMsgOnce(ws,f){onceQ.push(f);}
/* route once-handlers inside pump: simplest—filter in pump via tag */
async function nav(ws,url){
  const ld=new Promise(res=>{
    const h=(m)=>{if(m.method==='Page.loadEventFired'){
      listeners.splice(listeners.indexOf(h),1);res();}};
    listeners.push(h);});
  await rpc(ws,'Page.navigate',{url});
  await ld;
  await sleep(700); /* first frames settle */
}

/* injectable mock pad: programmable axes */
const MOCK=`(function(){
  var ax=new Float32Array([0,0,0,0]);
  var gp={connected:true,id:'MOCK-TX Joystick',index:0,
          mapping:'standard',timestamp:0,axes:ax,vibrationActuator:null,buttons:[]};
  navigator.getGamepads=function(){var a=new Array(4);a[0]=gp;return a;};
  window.__setAxes=function(v){for(var i=0;i<4;i++)ax[i]=v[i];return true;};
  window.__getAxes=function(){return [ax[0],ax[1],ax[2],ax[3]];};
})();`;
const NOMOCK='';

/* pixel probe: readPixels right after each post pass */
const PROBE=`(function(){
  if(window.__probeOn)return 'already';
  window.__probeOn=true;
  var R=window.Renderer.prototype, orig=R.render;
  window.__PIX=null;window.__PIXERR=null;
  R.render=function(env){
    orig.call(this,env);
    try{
      var gl=this.gl,w=this.fw,h=this.fh;
      if(w>4&&h>4){
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        var b=new Uint8Array(w*h*4);
        gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
        function band(ya,yb){
          var r=0,g=0,bl=0,n=0;
          for(var y=Math.floor(ya*h);y<Math.floor(yb*h);y+=3)
            for(var x=0;x<w;x+=7){var k=(y*w+x)*4;
              r+=b[k];g+=b[k+1];bl+=b[k+2];n++;}
          return [r/n/255,g/n/255,bl/n/255];}
        /* GL origin bottom-left: sky occupies LARGE y in GL => top of screen */
        window.__PIX={w:w,h:h,
          screenTop:band(0.60,0.98),
          screenBot:band(0.02,0.40)};
      }
    }catch(e){window.__PIXERR=String(e);}
  };
  return 'installed';})()`;

/* horizon NDC probe using the page's own math (post-fix chain) */
const HNDC=`(function(){
  var deg=Math.PI/180;
  var a=VIEW.camTiltDeg*deg, ca=Math.cos(a), sa=Math.sin(a);
  /* replicate camAttitude(): RC = R * T * B (iteration-#2 conventions) */
  var B=[[0,0,-1],[0,1,0],[1,0,0]];
  var T=[[ca,-sa,0],[sa,ca,0],[0,0,1]];
  function mul(A,C){var O=[[0,0,0],[0,0,0],[0,0,0]];
    for(var i=0;i<3;i++)for(var j=0;j<3;j++)
      O[i][j]=A[i][0]*C[0][j]+A[i][1]*C[1][j]+A[i][2]*C[2][j];
    return O;}
  var RC=mul(drone.R,mul(T,B));
  var fw=(renderer.fw||1280)/(renderer.fh||720);
  var f=1/Math.tan(VIEW.fovDeg*deg/2), nf=1/(0.08-760);
  var P=[f/fw,0,0,0, 0,f,0,0, 0,0,(760+0.08)*nf,-1, 0,0,2*760*0.08*nf,0];
  var p=[drone.pos[0],drone.pos[1],drone.pos[2]];
  function ndc(w){
    var dx=w[0]-p[0],dy=w[1]-p[1],dz=w[2]-p[2];
    /* world->camera = RC^T : component i = dot(column_i(RC), d) */
    var vx=RC[0][0]*dx+RC[1][0]*dy+RC[2][0]*dz;
    var vy=RC[0][1]*dx+RC[1][1]*dy+RC[2][1]*dz;
    var vz=RC[0][2]*dx+RC[1][2]*dy+RC[2][2]*dz;
    return [(P[0]*vx)/(-vz),(P[5]*vy)/(-vz)];}
  var det=RC[0][0]*(RC[1][1]*RC[2][2]-RC[1][2]*RC[2][1])-
          RC[0][1]*(RC[1][0]*RC[2][2]-RC[1][2]*RC[2][0])+
          RC[0][2]*(RC[1][0]*RC[2][1]-RC[1][1]*RC[2][0]);
  return {horizon:ndc([p[0],p[1],p[2]-320]),
          highSky:ndc([p[0],p[1]+80,p[2]-160]),
          nearGnd:ndc([p[0],p[1]-1.6,p[2]-10]),
          detRC:det};
})()`;

function key(ws,code,down){
  return evalJs(ws,
   "window.dispatchEvent(new KeyboardEvent('"+(down?'keydown':'keyup')+
   "',{code:'"+code+"'}));1");
}

/* ======================= MAIN SCENARIOS ======================= */
async function main(){
  /* wait for CDP endpoint */
  let ver=null;
  for(let i=0;i<50;i++){
    try{
      const r=await fetch('http://127.0.0.1:'+PORT+'/json/version');
      ver=await r.json();break;
    }catch(e){await sleep(200);}
  }
  if(!ver){console.error('chrome CDP not up');process.exit(2);}
  const list=await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();
  const page=list.find(t=>t.type==='page');
  const ws=await wsConnect(page.webSocketDebuggerUrl);
  pump(ws);
  await rpc(ws,'Page.enable');
  await rpc(ws,'Runtime.enable');

  /* ---------- SCENARIO 1: D1 orientation + keyboard fallback flow -------- */
  await nav(ws,FILE_URL);
  /* a REAL Jumper T-Pro dongle is attached to this bench machine; scenario 1
     must exercise the pure keyboard fallback, so deselect pads explicitly */
  await evalJs(ws,'inputCfg.padIndex=-1');
  await sleep(150);
  const bootMsg=await evalJs(ws,"document.getElementById('msg').textContent");
  const srcS1=await evalJs(ws,"document.getElementById('hSrc').textContent");
  check('S1 keyboard fallback selected', /KEYBOARD/.test(srcS1), srcS1);
  check('S1 boot without BOOT ERROR', !/BOOT ERROR/i.test(bootMsg), bootMsg.slice(0,60));
  await evalJs(ws,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await evalJs(ws,PROBE);
  await evalJs(ws,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const pix=await evalJs(ws,'window.__PIX');
  const pixErr=await evalJs(ws,'window.__PIXERR');
  check('S1 readPixels probe ran', !!pix&&!pixErr,
        'w='+pix&&pix.w+' h='+(pix&&pix.h)+' err='+pixErr);
  await shot(ws,'d1_horizon_rest.png');

  const geom=await evalJs(ws,'('+HNDC+')');
  check('S1 camera basis det(Rcam)=+1', Math.abs(geom.detRC-1)<1e-9,
        'det='+geom.detRC.toFixed(6));
  check('S1 horizon NDC inside middle band', Math.abs(geom.horizon[1])<0.35,
        'horizon_ndc_y='+geom.horizon[1].toFixed(3)+
        ' (closed form -tan22/tan50=-0.339)');
  check('S1 vertical ordering sky above ground',
        geom.highSky[1]>geom.nearGnd[1]+0.3,
        'highSky_y='+geom.highSky[1].toFixed(3)+' > nearGnd_y='+geom.nearGnd[1].toFixed(3));
  const T=pix.screenTop,B=pix.screenBot;
  const lum=a=>a[0]*0.299+a[1]*0.587+a[2]*0.114;
  check('S1 pixels: sky-blue dominates screen top',
        T[2]-B[2]>0.04, 'topRGB=['+T.map(v=>v.toFixed(2))+'] '+
        'botRGB=['+B.map(v=>v.toFixed(2))+'] blueDiff='+(T[2]-B[2]).toFixed(3));
  check('S1 pixels: top brighter than bottom',
        lum(T)>lum(B), 'lumTop='+lum(T).toFixed(3)+' lumBot='+lum(B).toFixed(3));

  /* keyboard full flow */
  const alt0=parseFloat(await evalJs(ws,"document.getElementById('hAlt').textContent"));
  await key(ws,'Space',true);await sleep(250);
  const armed1=await evalJs(ws,'window.drone.armed');
  check('S1 keyboard SPACE arms at idle', armed1===true, 'armed='+armed1);
  await key(ws,'KeyW',true);
  await sleep(1600);
  const alt1=parseFloat(await evalJs(ws,"document.getElementById('hAlt').textContent"));
  const y1=await evalJs(ws,'window.drone.pos[1]');
  check('S1 W-throttle lifts off (ALT rise)', y1>alt0+1.0&&y1>1.5,
        'ALT '+alt0.toFixed(1)+'m -> '+y1.toFixed(2)+'m after 1.6s hold (hud '+
        alt1+' m)');
  await shot(ws,'kbd_flight.png');
  await key(ws,'KeyW',false);
  const st=await evalJs(ws,
   '(function(){window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyR"}));'+
   /* fullReset runs synchronously inside the dispatched event: sample the
      state in the SAME task, before any physics substep can advance. */
   'return {a:window.drone.armed,y:window.drone.pos[1],d:window.drone.dist};})()');
  await sleep(400);
  const st2=await evalJs(ws,
   '({a:window.drone.armed,y:window.drone.pos[1],'+
   'b:document.getElementById("banner").style.display})');
  check('S1 KeyR disarms and teleports to spawn on the very frame',
        st.a===false&&Math.abs(st.y-0.9)<0.05,
        'armed='+st.a+' y='+st.y.toFixed(3)+' dist='+st.d.toFixed(2));
  check('S1 post-reset craft settles disarmed on ground contact',
        st2.a===false&&st2.y<0.6&&st2.b==='none',
        'armed='+st2.a+' settledY='+st2.y.toFixed(3)+' banner='+st2.b+
        ' (motors cut -> free-fall onto soft ground 0.12 m is physics-exact)');

  /* ---------- SCENARIO 2: D2 gamepad arming gate + % message ------------- */
  await rpc(ws,'Page.addScriptToEvaluateOnNewDocument',{source:MOCK});
  await nav(ws,FILE_URL);
  check('S2 mock pad visible to page',
    (await evalJs(ws,"(navigator.getGamepads()[0]||{}).id"))==='MOCK-TX Joystick',
    (await evalJs(ws,"(navigator.getGamepads()[0]||{}).id")));
  const srcLbl=await evalJs(ws,"document.getElementById('hSrc').textContent");
  check('S2 input source switched to GAMEPAD', /GAMEPAD/.test(srcLbl), srcLbl);

  /* throttle raw ax1=+1 with default inv -> channel 0.0 -> arm allowed */
  await evalJs(ws,'__setAxes([0,1,0,0])');await sleep(250);
  await key(ws,'Space',true);await sleep(250);
  const okMsg=await evalJs(ws,"document.getElementById('msg').textContent");
  const armed2=await evalJs(ws,'window.drone.armed');
  check('S2 SPACE arms with pad throttle at idle', armed2===true,
        'armed='+armed2+' msg="'+okMsg.slice(-28)+'"');
  await shot(ws,'d2_arm_ok.png');
  await key(ws,'KeyR',true);await sleep(250);

  /* throttle raw 0 -> channel 0.5 -> denied, message must show percentage */
  await evalJs(ws,'__setAxes([0,0,0,0])');await sleep(300);
  await key(ws,'Space',true);await sleep(250);
  const chanState=await evalJs(ws,
   '({thr:LAST_CH.thr,raw:inputCfg.thrInfo.raw,pct:inputCfg.thrInfo.pct,'+
   'cal:inputCfg.thrInfo.calibrated,lo:inputCfg.cal.thr.lo,'+
   'hi:inputCfg.cal.thr.hi,inv:inputCfg.bind.thr.inv,'+
   'ax:inputCfg.bind.thr.axis})');  const deny=await evalJs(ws,"document.getElementById('msg').textContent");
  const mDeny=deny.match(/ARM denied[^\n]*?(\d{1,3})%/);
  const stillDis=await evalJs(ws,'window.drone.armed===false');
  check('S2 throttle 50% denied and message shows %',
        !!mDeny&&stillDis&&parseInt(mDeny[1],10)===50,
        'denied='+stillDis+' pct_in_msg='+(mDeny&&mDeny[1])+
        ' chan='+JSON.stringify(chanState));
  await shot(ws,'d2_arm_denied.png');

  /* Explicit learn-window calibration rescues a NON-STANDARD stick whose
     travel spans only raw [-0.6 .. +0.8]: after apply, the physical bottom
     of that custom stick must read ~0 and its top ~1. */
  await evalJs(ws,'thrCalStart()');
  for(const v of [-0.6,0.8,-0.62,0.8,-0.6]){
    await evalJs(ws,'__setAxes([0,'+v+',0,0])');await sleep(150);}
  await evalJs(ws,'__setAxes([0,-0.6,0,0])');await sleep(120);
  await evalJs(ws,'thrCalStop()');await sleep(120);
  const cal=await evalJs(ws,
    '({applied:inputCfg.cal.thr.applied,lo:inputCfg.cal.thr.lo,'+
    'hi:inputCfg.cal.thr.hi})');
  check('S2 explicit learn captures custom bounds',
        cal.applied===true&&cal.lo<-0.75&&cal.hi>0.55,
        JSON.stringify(cal)+' (tv=-raw since inv ON)');
  await evalJs(ws,'__setAxes([0,0.8,0,0])');await sleep(180);
  const thrTop=await evalJs(ws,'LAST_CH.thr');
  await evalJs(ws,'__setAxes([0,-0.6,0,0])');await sleep(200);
  const thrBot=await evalJs(ws,'LAST_CH.thr');
  check('S2 calibrated mapping tracks custom endpoints',
        Math.abs(thrTop-0)<0.03&&Math.abs(thrBot-1)<0.03,
        'custom top(raw .8) thr='+thrTop.toFixed(3)+
        ' bottom(raw -.6) thr='+thrBot.toFixed(3));
  await evalJs(ws,'__setAxes([0,0.8,0,0])');await sleep(200);
  const idleThr=await evalJs(ws,'LAST_CH.thr');
  await key(ws,'Space',true);await sleep(250);
  const rescue=await evalJs(ws,'window.drone.armed');
  check('S2 odd-hardware idle arm allowed after calibration',
        rescue===true&&idleThr<0.03,
        'armed='+rescue+' idleThr='+idleThr.toFixed(3)+
        ' at custom-stick bottom (raw .8)');

  /* ---------- SCENARIO 3: D3 live monitor + binding UI ------------------- */
  await nav(ws,FILE_URL); /* mock persists via new-document script */
  await evalJs(ws,'__setAxes([0.5,-0.25,0.75,0.12])');
  await evalJs(ws,'toggleMenu()');await sleep(400);
  const nA=await evalJs(ws,'detectedAxisCount()');
  check('S3 axis monitor detects 4 axes', nA===4, 'NA='+nA);
  const av=[await evalJs(ws,'document.getElementById("axval_0").textContent'),
            await evalJs(ws,'document.getElementById("axval_1").textContent'),
            await evalJs(ws,'document.getElementById("axval_2").textContent')];
  check('S3 live per-axis readouts track mock',
        av[0]==='+0.500'&&av[1]==='-0.250'&&av[2]==='+0.750', 'vals='+av.join(','));
  const barsNonZero=await evalJs(ws,
   '[0,1,2].map(i=>document.getElementById("axfill_"+i).style.width!=="0%")');
  check('S3 axis bar fills rendered', barsNonZero.every(Boolean),
        JSON.stringify(barsNonZero));
  await shot(ws,'d3_bind_ui.png');

  /* wheel-cycle PITCH from AX2 -> AX3 */
  await evalJs(ws,
   'document.getElementById("bindbtn_pitch").dispatchEvent('+
   'new WheelEvent("wheel",{deltaY:-120}))');
  await sleep(120);
  const pitchAx=await evalJs(ws,'inputCfg.bind.pitch.axis');
  check('S3 WHEEL cycles PITCH bind AX2->AX3', pitchAx===3, 'axis='+pitchAx);

  /* click-capture binding THR onto AX3 through real DOM clicks */
  const thrBefore=await evalJs(ws,'inputCfg.bind.thr.axis');
  await evalJs(ws,'document.getElementById("bindbtn_thr").click()');
  const capOn=await evalJs(ws,'CAPTURE_CH');
  check('S3 capture mode armed on THR button click', capOn==='thr',
        'CAPTURE_CH='+capOn);
  await evalJs(ws,'document.getElementById("axrow_3").click()');
  await sleep(150);
  const thrAfter=await evalJs(ws,'inputCfg.bind.thr.axis');
  check('S3 click AX bar binds THR to AX3', thrBefore!==3&&thrAfter===3,
        'AX'+thrBefore+' -> AX'+thrAfter);

  /* reading follows rebound axis + REVERSE flips instantly */
  await evalJs(ws,'__setAxes([0,0,0,1])');await sleep(200); /* raw +1 */
  const tInvOn=await evalJs(ws,'window.LAST_CH.thr');
  await evalJs(ws,'__setAxes([0,0,0,-1])');await sleep(200);
  const tInvOff=await evalJs(ws,'window.LAST_CH.thr');
  const outTxt=await evalJs(ws,
    'document.getElementById("chout_thr").textContent');
  check('S3 THR reads rebound AX3 (inv ON: +1->0, -1->1)',
        Math.abs(tInvOn-0)<0.02&&Math.abs(tInvOff-1)<0.02,
        'ax3=+1 thr='+tInvOn.toFixed(3)+' ; ax3=-1 thr='+tInvOff.toFixed(3)+
        ' ; ui "'+outTxt+'"');
  /* uncheck REVERSE */
  await evalJs(ws,
   'var cb=document.getElementById("inv_thr");cb.checked=false;'+
   'cb.dispatchEvent(new Event("change"));');
  await evalJs(ws,'__setAxes([0,0,0,1])');await sleep(200);
  const tRev=await evalJs(ws,'window.LAST_CH.thr');
  check('S3 REVERSE toggle flips THR reading', Math.abs(tRev-1)<0.02,
        'inv off: ax3=+1 thr='+tRev.toFixed(3));
  await evalJs(ws,'__setAxes([0,0.5,0,-1])');await sleep(200);
  await shot(ws,'d3_after_rebind.png');

  writeFileSync(WS+'e2e_results.json',
    JSON.stringify({results,fails},null,2));
  console.log(fails===0?'\nE2E ALL GREEN':'\nE2E FAILURES='+fails);
  try{ws.close();}catch(e){}
}
async function shutdown(code){
  try{chrome.kill();}catch(e){}
  await sleep(900);
  try{rmSync(PROF,{recursive:true,force:true});}catch(e){
    console.log('(profile cleanup deferred to shell)');}
  process.exit(code);
}
main().then(()=>shutdown(fails?1:0)).catch(e=>{
  console.error('HARNESS ERROR',e);
  shutdown(3);
});
