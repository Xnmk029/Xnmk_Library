const fs=require('fs');
const s=fs.readFileSync('index.html','utf8');
const m=s.match(/<script type="module">([\s\S]*?)<\/script>/);
if(!m){console.log('NO_SCRIPT');process.exit(1);}
let code=m[1].split('\n').filter(l=>!/^\s*import\s/.test(l)).join('\n');
try{ new Function(code); console.log('SYNTAX_OK'); }
catch(e){ console.log('SYNTAX_ERR: '+e.message); }
