'use strict';
// 取证抓取工具：node evidence/fetch.js <样本名> <URL> [Referer]
// 仅抓取 B 站公开页面/公开接口；产物一律落 evidence/。
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const [, , name, url, referer] = process.argv;
if (!name || !url) { console.error('usage: node evidence/fetch.js <name> <url> [referer]'); process.exit(2); }
if (!/^https:\/\/(www\.bilibili\.com|t\.bilibili\.com|space\.bilibili\.com|api\.bilibili\.com)\//.test(url)) {
  console.error('[blocked] 仅允许 bilibili 公开域名:', url); process.exit(2);
}
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Referer': referer || 'https://www.bilibili.com/',
  'Accept-Encoding': 'gzip, deflate, br',
};
https.get(url, { headers, timeout: 20000 }, (res) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    let buf = Buffer.concat(chunks);
    const enc = (res.headers['content-encoding'] || '').toLowerCase();
    try {
      if (enc.includes('br')) buf = zlib.brotliDecompressSync(buf);
      else if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
      else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
    } catch (e) { console.error(name, 'DECOMP_FAIL', e.message); }
    const ext = /json/.test(res.headers['content-type'] || '') ? 'json' : 'html';
    const file = path.join(__dirname, name + '.' + ext);
    fs.writeFileSync(file, buf);
    fs.writeFileSync(path.join(__dirname, name + '.headers.txt'), name + ' ' + res.statusCode + '\n' + JSON.stringify(res.headers, null, 1));
    console.log(name, res.statusCode, (res.headers['content-type'] || '').split(';')[0], 'enc=' + (enc || '-'), file, buf.length + 'B');
  });
}).on('error', (e) => { console.error(name, 'ERR', e.message); process.exitCode = 1; })
  .on('timeout', function () { this.destroy(); console.error(name, 'TIMEOUT'); process.exitCode = 1; });
