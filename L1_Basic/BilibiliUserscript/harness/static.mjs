import { parse } from 'acorn';

export function inspectSource(source, filename) {
  let ast, error;
  try { ast = parse(source,{ecmaVersion:'latest',sourceType:'script',allowHashBang:false}); }
  catch (e) { error=e.message; }
  const block = source.match(/^\s*\/\/\s*==UserScript==\s*\r?\n([\s\S]*?)^\s*\/\/\s*==\/UserScript==/m);
  const metadata = {};
  for (const match of (block?.[1] || '').matchAll(/^[ \t]*\/\/[ \t]*@([\w-]+)(?:[ \t]+([^\r\n]*))?[ \t]*\r?$/gm)) (metadata[match[1]] ||= []).push((match[2]||'').trim());
  const required = ['name','namespace','match','grant'];
  const missing = required.filter(key=>!metadata[key]?.some(value=>value.length>0));
  const matches = [...(metadata.match||[]),...(metadata.include||[])];
  const scopesValid = matches.length > 0 && matches.every(value => /^(?:https?|\*):\/\/(?:\*\.)?(?:[a-z0-9-]+\.)*bilibili\.com\//i.test(value));
  const connects = metadata.connect || [];
  const networkValid = connects.every(value=> /^(?:api\.)?bilibili\.com$/.test(value));
  const grantsValid=(metadata.grant||[]).every(value=>['none','unsafeWindow','GM_addStyle','GM.addStyle','GM_registerMenuCommand','GM.registerMenuCommand'].includes(value));
  let dependency = false;
  const walk = value => {
    if (!value || typeof value!=='object') return;
    if (['ImportDeclaration','ImportExpression','ExportNamedDeclaration','ExportDefaultDeclaration'].includes(value.type)) dependency=true;
    if (value.type==='CallExpression' && value.callee?.type==='Identifier' && value.callee.name==='require') dependency=true;
    for (const item of Object.values(value)) if (Array.isArray(item)) item.forEach(walk); else if (item&&typeof item==='object') walk(item);
  };
  if (ast) walk(ast);
  return { metadata, checks:[
    {id:'C01',pass:!!ast,detail:error||'Native script syntax parsed'},
    {id:'C02',pass:!!block&&missing.length===0&&scopesValid&&networkValid&&grantsValid&&/\.user\.js$/i.test(filename),detail:JSON.stringify({missing,scopesValid,networkValid,grantsValid,filename})},
    {id:'C03',pass:!!ast&&!dependency&&!metadata.require&&!metadata.resource&&!/\b(?:TODO|FIXME)\b|待实现|未完成占位/.test(source),detail:'AST imports/require, remote resources and unfinished markers inspected'},
  ]};
}
