export function snapshotFooters() {
  const nodes=[];
  function scan(root) {
    for(const element of root.querySelectorAll('*')) {
      if(element.hasAttribute('data-replay-key')) nodes.push(element);
      if(element.shadowRoot) scan(element.shadowRoot);
    }
  }
  scan(document);
  const visible=el=>{
    if(!el?.isConnected||!el.getClientRects().length) return false;
    for(let n=el;n;n=n.parentElement||n.getRootNode()?.host) {
      const s=getComputedStyle(n);
      if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0') return false;
    }
    return true;
  };
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  return nodes.map(node=>{
    const region=node.shadowRoot?.querySelector('#footer')||node;
    const segments=[];
    const walker=document.createTreeWalker(region,NodeFilter.SHOW_TEXT);
    for(let text=walker.nextNode();text;text=walker.nextNode()) {
      const parent=text.parentElement;
      if(!parent||parent.closest('style,script,button')||!visible(parent)||!text.textContent.trim()) continue;
      segments.push({text:text.textContent,rect:rect(parent),position:getComputedStyle(parent).position});
    }
    return {key:node.dataset.replayKey,text:segments.map(x=>x.text).join(' '),segments,rect:rect(region),
      buttons:Array.from(region.querySelectorAll('button')).map(b=>({text:b.textContent,rect:rect(b),visible:visible(b)})),
      nativePreserved:!!region.querySelector('[data-native="preserve"]'),
      executableMarkup:!!region.querySelector('img,iframe,script,svg,[onerror],[onload]'),
      locationExecuted:!!window.__locationExecuted};
  });
}

const normalize = value => String(value||'').replace(/IP\s*属地\s*[:：]?/gi,'').replace(/\s+/g,'').trim();
export function validateFooters(snapshots, records, scenario) {
  const findings=[];
  for(const record of records) {
    const row=snapshots.find(x=>x.key===record.key);
    if(!row) {findings.push(record.key+': footer missing');continue;}
    const expected=normalize(record.reply_control?.location);
    const actual=normalize(row.text);
    if(expected) {
      const occurrences=actual.split(expected).length-1;
      if(occurrences!==1) findings.push(record.key+': expected exactly one '+JSON.stringify(expected)+', found '+occurrences+' in '+JSON.stringify(row.text));
      for(const other of records) {
        const foreign=normalize(other.reply_control?.location);
        if(foreign&&foreign!==expected&&actual.includes(foreign)) findings.push(record.key+': another comment location present');
      }
    } else {
      if(!/未提供|未获取|未知|暂无|无数据|缺失|不可用|未公开|—|--/.test(row.text)) findings.push(record.key+': missing quiet visible status');
      if(/北京|上海|广东|湖北|新疆|日本|加拿大|四川|浙江|辽宁|德国/.test(row.text)) findings.push(record.key+': inferred or stale location');
    }
    if(row.executableMarkup||row.locationExecuted) findings.push(record.key+': location became executable markup');
    if(scenario==='native'&&!row.nativePreserved) findings.push(record.key+': native label removed or replaced');
    if(['controls','narrow'].includes(scenario)) {
      for(const segment of row.segments) {
        if(!/IP\s*属地|未提供|未获取/.test(segment.text)&&!expected) continue;
        if(segment.position==='fixed'||segment.position==='absolute') findings.push(record.key+': positioned overlay');
        const r=segment.rect,f=row.rect;
        if(r.x<f.x-2||r.right>f.right+2||r.y<f.y-2||r.bottom>f.bottom+2) findings.push(record.key+': text box extends outside footer');
        for(const button of row.buttons) if(button.visible&&Math.min(r.right,button.rect.right)-Math.max(r.x,button.rect.x)>1&&Math.min(r.bottom,button.rect.bottom)-Math.max(r.y,button.rect.y)>1) findings.push(record.key+': overlaps native control');
      }
      if(row.buttons.length!==2||row.buttons.some(b=>!b.visible)) findings.push(record.key+': native controls missing or hidden');
    }
  }
  if(snapshots.length!==records.length) findings.push('Footer count changed: '+snapshots.length+' expected '+records.length);
  return {pass:findings.length===0,findings};
}

export function clickNativeControls() {
  const before=window.__replayFixture.clicks();
  let count=0;
  function scan(root) {for(const e of root.querySelectorAll('*')) {if(e.hasAttribute('data-replay-key')) {for(const button of (e.shadowRoot||e).querySelectorAll('button')) {button.click();count++;}} if(e.shadowRoot) scan(e.shadowRoot);}}
  scan(document);
  return {count,received:window.__replayFixture.clicks()-before};
}
