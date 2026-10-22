import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(project,'dist','client');
if(!fs.existsSync(path.join(root,'index.html'))){console.error('请先执行 npm run build，生成可运行的沙盘。');process.exit(1);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.rsc':'text/x-component'};
const port=Number(process.env.HARBOUR_PORT||3000);
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let name=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
    if(name.endsWith('/'))name+='index.html';
    let file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let stat;try{stat=await fsp.stat(file);}catch{res.writeHead(404);res.end('Not found');return;}
    if(!stat.isFile()){res.writeHead(404);res.end();return;}
    const ext=path.extname(file),compressed=/gzip/.test(req.headers['accept-encoding']||'')&&['.html','.js','.mjs','.css','.json','.svg','.rsc'].includes(ext);
    res.setHeader('Content-Type',mime[ext]||'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Application','Harbour-Atlas');
    res.setHeader('Cache-Control',name.includes('/assets/')?'public,max-age=31536000,immutable':'no-cache');
    if(compressed){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');}else res.setHeader('Content-Length',stat.size);
    res.writeHead(200);if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());
    if(compressed)stream.pipe(createGzip()).pipe(res);else stream.pipe(res);
  }catch{res.writeHead(400);res.end('Bad request');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已在使用。可设置 HARBOUR_PORT 选择其他端口。`:error);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log(`HARBOUR ATLAS ready · http://localhost:${port}/`));
