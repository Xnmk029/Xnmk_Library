import {marked} from './vendor/marked.mjs';
import DOMPurify from './vendor/purify.mjs';

// Resolve document assets against the source file, rather than the compare page.
export function renderMarkdown(target,text,documentUrl) {
 target.innerHTML=DOMPurify.sanitize(marked.parse(text.replace(/^\uFEFF/,''),{gfm:true,breaks:true}),{USE_PROFILES:{html:true}});
 const base=new URL(documentUrl,location.href);
 for(const element of target.querySelectorAll('a[href],img[src]')){
  const attribute=element.tagName==='A'?'href':'src';
  const value=element.getAttribute(attribute);
  try{
   const url=new URL(value,base);
   if(!['http:','https:'].includes(url.protocol)){element.removeAttribute(attribute);continue}
   element.setAttribute(attribute,url.href);
   if(attribute==='href'){element.target='_blank';element.rel='noopener noreferrer'}
   else{element.loading='lazy';element.alt ||= '文档参考图'}
  }catch{element.removeAttribute(attribute)}
 }
 for(const table of target.querySelectorAll('table')){
  const wrapper=document.createElement('div');wrapper.className='doc-table';table.before(wrapper);wrapper.append(table);
 }
}

export function createTaskDocs({getTask,getPair,controls,stage}) {
 const dialog=document.createElement('dialog');dialog.id='taskDocs';dialog.setAttribute('aria-label','题面与提示词');
 dialog.innerHTML='<div class="panelhead"><strong data-doc="title"></strong><button data-doc="close">关闭 · Esc</button></div><nav class="doc-tabs" aria-label="文档类型"><button data-view="statement">题面 · F2</button><button data-view="prompt">提示词 · Alt + ↑</button><button data-view="a">A 实际调用</button><button data-view="b">B 实际调用</button></nav><div class="doc-actions"><button data-doc="copy">复制全文</button><a data-doc="file" target="_blank" rel="noopener">打开原始文档 ↗</a><a data-doc="source" target="_blank" rel="noopener">当前帧参考图 ↗</a></div><p data-doc="note" role="status"></p><pre data-doc="body" tabindex="0"></pre>';
 document.body.append(dialog);const $=id=>dialog.querySelector(`[data-doc="${id}"]`);let token=0,current='';
 const rendered=document.createElement('article');rendered.className='doc-markdown';rendered.tabIndex=0;$('body').before(rendered);
 const format=document.createElement('button');format.textContent='查看 MD 原文';format.setAttribute('aria-pressed','false');dialog.querySelector('.doc-actions').prepend(format);
 let raw=false,currentUrl='';
 function display(){rendered.hidden=raw;$('body').hidden=!raw;format.textContent=raw?'查看排版预览':'查看 MD 原文';format.setAttribute('aria-pressed',String(raw));$('body').textContent=current;if(!raw)renderMarkdown(rendered,current,currentUrl)}
 format.onclick=()=>{raw=!raw;display()};
 const references=document.createElement('div');references.className='doc-actions';dialog.querySelector('.doc-actions').after(references);
 const entry=document.createElement('div');entry.className='doc-entry';for(const [view,label] of [['statement','查看题面 · F2'],['prompt','查看提示词 · Alt + ↑']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>open(view);entry.append(b)}controls.insertBefore(entry,controls.querySelector('header'));
 function close(){token++;dialog.close();stage.focus()}
 $('close').onclick=close;dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='F2'){e.preventDefault();open('statement')}});
 dialog.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>open(b.dataset.view));
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(current);$('note').textContent='全文已复制'}catch{$('note').textContent='复制失败，可选中下方全文手动复制'}};
 async function open(view='statement'){
  const t=getTask(),pair=getPair(),version=++token;current='';format.disabled=true;$('copy').disabled=true;rendered.hidden=true;$('body').hidden=false;$('body').textContent='正在读取…';$('title').textContent=t.task.title+' / v'+t.task.version;dialog.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view)});
  const source=t.task.frames[t.frame]?.source;$('source').hidden=!source?.url;if(source?.url)$('source').href=source.url;
  references.replaceChildren();for(const ref of t.task.references||[]){const link=document.createElement('a');link.textContent=ref.label+' ↗';link.href=ref.url;link.target='_blank';link.rel='noopener';references.append(link)}references.hidden=!references.childElementCount;
  const actual=view==='a'||view==='b',model=pair[view==='b'?1:0];let url=actual?model?.meta:t.task.documents?.[view];let fallback=false;
  if(view==='statement'&&!url){url=t.task.documents?.prompt;fallback=true}
  $('file').hidden=!url;if(url)$('file').href=url;
  $('note').textContent=actual?`${view.toUpperCase()} · ${model?.label||'无图片'} · 仅显示调用记录明确保存的提示词。`:fallback?'此题未另设题面文件，显示该题提示词原文。':'工作区题目文档；不代表每个模型实际调用时使用的提示词。';
  if(!dialog.open)dialog.showModal();
  try{if(!url)throw Error(actual?'该结果没有保存实际调用提示词。':'此题没有对应文档。');const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error('文档读取失败：HTTP '+response.status);let text;if(actual){const record=await response.json();text=record.prompt;if(typeof text!=='string'||!text.trim())throw Error('该调用记录未保存提示词；不能据题目文档推定实际输入。')}else text=await response.text();if(version!==token)return;current=text;currentUrl=response.url||url;display();format.disabled=false;$('copy').disabled=false}catch(e){if(version===token){rendered.hidden=true;$('body').hidden=false;$('body').textContent=e.message}}
 }
 return {open,get isOpen(){return dialog.open}};
}

