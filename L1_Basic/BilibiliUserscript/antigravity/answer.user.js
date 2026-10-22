// ==UserScript==
// @name         B站网页端 IP 属地显示
// @name:en      Bilibili IP Location Display
// @namespace    https://github.com/bilibili-ip-display
// @version      1.0.0
// @description  在 B 站（bilibili.com）电脑端视频播放页、个人空间、动态、专栏等页面展示 UP 主、动态发布者及评论区用户的公开 IP 归属地信息。
// @description:en Displays public IP attribution location for uploaders, dynamic posters, and commenters on Bilibili web pages.
// @author       Antigravity
// @match        *://*.bilibili.com/*
// @match        *://bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // =========================================================================
  // 1. 常量与配置 (Constants & Config)
  // =========================================================================
  const CONFIG = {
    CACHE_MAX_SIZE: 3000,          // 内存缓存最大条数
    WBI_CACHE_TTL: 10 * 60 * 1000, // WBI 密钥缓存有效期 (10分钟)
    DEBOUNCE_DELAY: 80,            // DOM 变更防抖延迟 (ms)
    REQUEST_DELAY: 60,             // 批量查询间隔，避免突发高频请求 (ms)
    MAX_CONCURRENT_REQS: 3         // 最大并发主动请求数
  };

  // 样式表定义
  const STYLES = `
    .bili-ip-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      font-size: 12px;
      line-height: 1.4;
      color: #61666d;
      background-color: rgba(0, 0, 0, 0.04);
      padding: 1px 6px;
      border-radius: 4px;
      vertical-align: middle;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      user-select: none;
      font-weight: normal;
      white-space: nowrap;
      transition: background-color 0.2s ease, color 0.2s ease;
      margin-left: 6px;
      box-sizing: border-box;
    }
    .bili-ip-badge:hover {
      background-color: rgba(0, 0, 0, 0.08);
      color: #18191c;
    }
    .bili-ip-badge.bili-ip-loading {
      color: #9499a0;
      opacity: 0.6;
    }
    .bili-ip-badge.bili-ip-unknown {
      color: #a0a5ab;
      background-color: rgba(0, 0, 0, 0.02);
      opacity: 0.75;
    }

    /* 针对各业务场景的微调适配 */
    .bili-ip-badge-up {
      margin-left: 8px;
      font-size: 12px;
      display: inline-flex;
    }
    .bili-ip-badge-space {
      margin-left: 10px;
      font-size: 13px;
      vertical-align: middle;
    }
    .bili-ip-badge-comment {
      margin-left: 8px;
      font-size: 12px;
    }
    .bili-ip-badge-dynamic {
      margin-left: 8px;
      font-size: 12px;
    }
    .bili-ip-badge-card {
      margin-top: 4px;
      margin-left: 0;
      display: inline-flex;
    }
    .bili-ip-badge-live {
      margin-left: 6px;
      font-size: 12px;
    }

    /* 深色模式 / 夜间主题兼容 */
    [data-theme="dark"] .bili-ip-badge,
    .dark .bili-ip-badge {
      color: #9499a0;
      background-color: rgba(255, 255, 255, 0.08);
    }
    [data-theme="dark"] .bili-ip-badge:hover,
    .dark .bili-ip-badge:hover {
      color: #e3e5e7;
      background-color: rgba(255, 255, 255, 0.14);
    }
    [data-theme="dark"] .bili-ip-badge.bili-ip-unknown,
    .dark .bili-ip-badge.bili-ip-unknown {
      color: #61666d;
      background-color: rgba(255, 255, 255, 0.03);
    }
  `;

  // =========================================================================
  // 2. 纯 JS MD5 算法与 WBI 签名支持 (Pure JS MD5 & WBI Signing)
  // =========================================================================
  const MD5 = (function () {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      const lX8 = lX & 0x80000000;
      const lY8 = lY & 0x80000000;
      const lX4 = lX & 0x40000000;
      const lY4 = lY & 0x40000000;
      const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
      if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
        return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      }
      return lResult ^ lX8 ^ lY8;
    }
    function F(x, y, z) { return (x & y) | (~x & z); }
    function G(x, y, z) { return (x & z) | (y & ~z); }
    function H(x, y, z) { return x ^ y ^ z; }
    function I(x, y, z) { return y ^ (x | ~z); }

    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(string) {
      const lMessageLength = string.length;
      const lNumberOfWords_temp1 = lMessageLength + 8;
      const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      const lWordArray = Array(lNumberOfWords - 1);
      let lBytePosition = 0;
      let lByteCount = 0;
      while (lByteCount < lMessageLength) {
        const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition);
        lByteCount++;
      }
      const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }

    function wordToHex(lValue) {
      let wordToHexValue = '';
      for (let lCount = 0; lCount <= 3; lCount++) {
        const lByte = (lValue >>> (lCount * 8)) & 255;
        const hex = '0' + lByte.toString(16);
        wordToHexValue += hex.substr(hex.length - 2, 2);
      }
      return wordToHexValue;
    }

    function utf8Encode(string) {
      string = string.replace(/\r\n/g, '\n');
      let utftext = '';
      for (let n = 0; n < string.length; n++) {
        const c = string.charCodeAt(n);
        if (c < 128) {
          utftext += String.fromCharCode(c);
        } else if (c > 127 && c < 2048) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        } else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }

    return function (string) {
      const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
      const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
      const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
      const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

      string = utf8Encode(string);
      const x = convertToWordArray(string);
      let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

      for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
        b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
        a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
        c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
        c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);

        a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
        a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
        d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
        a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);

        a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
        a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
        c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x04881d05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);

        a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
        c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
        b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
        c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
        d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
        c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
        a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
        d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
        b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);

        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
      }
      return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
    };
  })();

  const mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
  ];

  function getMixinKey(orig) {
    let temp = '';
    mixinKeyEncTab.forEach((n) => {
      if (orig[n]) temp += orig[n];
    });
    return temp.slice(0, 32);
  }

  function encWbi(params, img_key, sub_key) {
    const mixin_key = getMixinKey(img_key + sub_key);
    const curr_time = Math.round(Date.now() / 1000);
    const chr_filter = /[!'()*]/g;
    const newParams = { ...params, wts: curr_time };
    const query = Object.keys(newParams)
      .sort()
      .map((key) => {
        const val = (newParams[key] + '').replace(chr_filter, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      })
      .join('&');
    const wbi_sign = MD5(query + mixin_key);
    return `${query}&w_rid=${wbi_sign}`;
  }

  // =========================================================================
  // 3. 内存缓存系统 (In-Memory Cache Management)
  // =========================================================================
  class SimpleLRUCache {
    constructor(limit = CONFIG.CACHE_MAX_SIZE) {
      this.limit = limit;
      this.map = new Map();
    }
    get(key) {
      if (!this.map.has(key)) return undefined;
      const value = this.map.get(key);
      this.map.delete(key);
      this.map.set(key, value);
      return value;
    }
    set(key, value) {
      if (this.map.has(key)) {
        this.map.delete(key);
      } else if (this.map.size >= this.limit) {
        const firstKey = this.map.keys().next().value;
        this.map.delete(firstKey);
      }
      this.map.set(key, value);
    }
    has(key) {
      return this.map.has(key);
    }
  }

  // 全局缓存实例
  const userIpCache = new SimpleLRUCache();       // mid -> "IP属地：XX"
  const replyIpCache = new SimpleLRUCache();      // rpid -> "IP属地：XX"
  const dynamicIpCache = new SimpleLRUCache();    // dynId -> "IP属地：XX"
  const pendingRequests = new Map();              // mid -> Promise (合并重复并发查询)

  let wbiKeysCache = null; // { imgKey, subKey, expiresAt }

  // 格式化 IP 归属地文本
  function normalizeIpText(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let text = raw.trim();
    if (!text || text === '未知' || text === 'IP属地未知' || text === 'IP属地: 未知' || text === 'IP属地：未知') {
      return null;
    }
    if (/^IP\s*属地[:：]\s*/i.test(text)) {
      text = text.replace(/^IP\s*属地[:：]\s*/i, '');
    } else if (/^发布于\s*/.test(text)) {
      text = text.replace(/^发布于\s*/, '');
    }
    text = text.trim();
    return text ? `IP属地：${text}` : null;
  }

  // =========================================================================
  // 4. 网络拦截嗅探器 (Passive Network Sniffer)
  // =========================================================================
  // 通过无缝劫持 fetch 与 XMLHttpRequest，直接提取 B站 页面自然流经的数据，
  // 做到 0 额外网络消耗即可捕获评论区、动态、专栏等公开 IP 归属地。
  function setupNetworkInterceptors() {
    function processApiResponse(url, json) {
      try {
        if (!json || typeof json !== 'object') return;

        // 1. 评论区接口: /x/v2/reply, /x/v2/reply/main, /x/v2/reply/wbi/main, /x/v2/reply/reply
        if (url.includes('/x/v2/reply')) {
          const replies = [
            ...(json.data?.replies || []),
            ...(json.data?.top_replies || []),
            ...(json.data?.roots || []),
            ...(json.data?.top?.upper ? [json.data.top.upper] : [])
          ];

          function extractReplies(list) {
            if (!Array.isArray(list)) return;
            for (const item of list) {
              if (!item) continue;
              const rpid = String(item.rpid || item.rpid_str || '');
              const mid = String(item.mid || '');
              const loc = normalizeIpText(item.reply_control?.location || item.location || item.reply_control?.pub_location);

              if (loc) {
                if (rpid) replyIpCache.set(rpid, loc);
                if (mid && !userIpCache.has(mid)) userIpCache.set(mid, loc);
              }
              if (item.replies && Array.isArray(item.replies)) {
                extractReplies(item.replies);
              }
            }
          }
          extractReplies(replies);
          triggerDomScan();
        }

        // 2. 动态信息接口: /x/polymer/web-dynamic/v1/feed, /detail, /opus/detail
        if (url.includes('/x/polymer/web-dynamic/')) {
          const items = json.data?.items || (json.data?.item ? [json.data.item] : []);
          if (Array.isArray(items)) {
            for (const it of items) {
              const dynId = String(it.id_str || it.id || '');
              const author = it.modules?.module_author || it.author;
              const mid = String(author?.mid || '');
              const loc = normalizeIpText(author?.pub_location || author?.pub_action || author?.location);
              if (loc) {
                if (dynId) dynamicIpCache.set(dynId, loc);
                if (mid) userIpCache.set(mid, loc);
              }
            }
            triggerDomScan();
          }
        }

        // 3. 用户空间/卡片信息: /x/space/wbi/acc/info, /x/web-interface/card
        if (url.includes('/x/space/') || url.includes('/x/web-interface/card')) {
          const mid = String(json.data?.mid || json.data?.card?.mid || '');
          const loc = normalizeIpText(json.data?.ip_location || json.data?.space?.ip_location || json.data?.card?.space?.location);
          if (mid && loc) {
            userIpCache.set(mid, loc);
            triggerDomScan();
          }
        }
      } catch (err) {
        // 静默降级，不影响宿主环境
      }
    }

    // 劫持 Fetch
    if (typeof window.fetch === 'function') {
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        const promise = originalFetch.apply(this, args);
        try {
          const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
          if (url && (url.includes('/x/v2/reply') || url.includes('/x/polymer/web-dynamic') || url.includes('/x/space/') || url.includes('/x/web-interface/'))) {
            promise.then((res) => {
              try {
                res.clone().json().then((data) => {
                  processApiResponse(url, data);
                }).catch(() => {});
              } catch (e) {}
            }).catch(() => {});
          }
        } catch (e) {}
        return promise;
      };
    }

    // 劫持 XMLHttpRequest
    if (typeof window.XMLHttpRequest === 'function') {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._bili_url = typeof url === 'string' ? url : '';
        return originalOpen.apply(this, [method, url, ...rest]);
      };

      XMLHttpRequest.prototype.send = function (...rest) {
        if (this._bili_url && (this._bili_url.includes('/x/v2/reply') || this._bili_url.includes('/x/polymer/web-dynamic') || this._bili_url.includes('/x/space/') || this._bili_url.includes('/x/web-interface/'))) {
          this.addEventListener('load', function () {
            try {
              if (this.responseType === '' || this.responseType === 'text') {
                const data = JSON.parse(this.responseText);
                processApiResponse(this._bili_url, data);
              } else if (this.responseType === 'json') {
                processApiResponse(this._bili_url, this.response);
              }
            } catch (e) {}
          });
        }
        return originalSend.apply(this, rest);
      };
    }
  }

  // =========================================================================
  // 5. 主动数据获取器与 WBI 鉴权 (Active Data Fetcher)
  // =========================================================================
  async function getWbiKeys() {
    const now = Date.now();
    if (wbiKeysCache && wbiKeysCache.expiresAt > now) {
      return wbiKeysCache;
    }
    try {
      const res = await window.fetch('https://api.bilibili.com/x/web-interface/nav', {
        credentials: 'include'
      });
      const json = await res.json();
      const img_url = json?.data?.wbi_img?.img_url;
      const sub_url = json?.data?.wbi_img?.sub_url;
      if (img_url && sub_url) {
        const imgKey = img_url.slice(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.'));
        const subKey = sub_url.slice(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.'));
        wbiKeysCache = { imgKey, subKey, expiresAt: now + CONFIG.WBI_CACHE_TTL };
        return wbiKeysCache;
      }
    } catch (e) {}
    return null;
  }

  async function fetchUserIp(mid) {
    if (!mid) return null;
    mid = String(mid);

    if (userIpCache.has(mid)) {
      return userIpCache.get(mid);
    }
    if (pendingRequests.has(mid)) {
      return pendingRequests.get(mid);
    }

    const requestPromise = (async () => {
      try {
        // 优先使用 WBI 签名请求个人空间详细信息接口
        const wbi = await getWbiKeys();
        if (wbi) {
          const query = encWbi({ mid }, wbi.imgKey, wbi.subKey);
          const res = await window.fetch(`https://api.bilibili.com/x/space/wbi/acc/info?${query}`, {
            credentials: 'include'
          });
          const json = await res.json();
          if (json?.code === 0 && json?.data) {
            const loc = normalizeIpText(json.data.ip_location || json.data.space?.ip_location || json.data.location);
            if (loc) {
              userIpCache.set(mid, loc);
              return loc;
            }
          }
        }

        // 备用兜底：请求基础 Card 接口
        const fallbackRes = await window.fetch(`https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(mid)}`, {
          credentials: 'include'
        });
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson?.code === 0 && fallbackJson?.data) {
          const loc = normalizeIpText(fallbackJson.data.space?.ip_location || fallbackJson.data.card?.space?.location);
          if (loc) {
            userIpCache.set(mid, loc);
            return loc;
          }
        }
      } catch (err) {
        // 发生网络错误时静默降级
      } finally {
        pendingRequests.delete(mid);
      }
      return null;
    })();

    pendingRequests.set(mid, requestPromise);
    return requestPromise;
  }

  // =========================================================================
  // 6. DOM 渲染与徽标注入 (Badge Renderer & DOM Injection)
  // =========================================================================
  function createBadgeElement(initialText, className = '') {
    const badge = document.createElement('span');
    badge.className = `bili-ip-badge ${className}`.trim();
    if (initialText) {
      badge.textContent = initialText;
      badge.title = `${initialText} (数据来源于页面公开接口)`;
    } else {
      badge.textContent = 'IP查询中...';
      badge.classList.add('bili-ip-loading');
    }
    badge.setAttribute('data-bili-ip-injected', 'true');
    return badge;
  }

  function updateBadgeElement(badge, locationText) {
    if (!badge) return;
    badge.classList.remove('bili-ip-loading');
    if (locationText) {
      badge.textContent = locationText;
      badge.classList.remove('bili-ip-unknown');
      badge.title = `${locationText} (数据来源于页面公开接口)`;
    } else {
      // 字段缺失或获取失败时的静默优雅降级展示
      badge.textContent = 'IP: 未知';
      badge.classList.add('bili-ip-unknown');
      badge.title = '该用户暂无公开的 IP 归属地信息';
    }
  }

  // 支持穿透 Shadow DOM 的元素查询工具函数
  function queryAllDeep(selector, root = document) {
    const results = [];
    function search(node) {
      if (!node || (node.nodeType !== Node.ELEMENT_NODE && node !== document)) return;
      if (node.matches && node.matches(selector)) {
        results.push(node);
      }
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        search(children[i]);
      }
      if (node.shadowRoot) {
        const shadowChildren = node.shadowRoot.children || [];
        for (let i = 0; i < shadowChildren.length; i++) {
          search(shadowChildren[i]);
        }
      }
    }
    search(root);
    return results;
  }

  // =========================================================================
  // 7. 各页面模块处理器 (Page Specific Processors)
  // =========================================================================

  // [模块 1]: 视频播放页 UP 主信息
  function processVideoUpInfo() {
    // 兼容新版、旧版、分 P 播放页 UP 主区域
    const upContainers = document.querySelectorAll('.up-detail-top, .up-info-container, .up-info_right, .up-info--right, .up-card-container, .members-info-container');
    if (!upContainers.length) {
      // 尝试直接查找 UP 主名字元素
      const upNameEl = document.querySelector('.up-info_right .name-text, .up-detail-top .up-name, .up-info-container .username, .up-card-container .up-name');
      if (upNameEl && !upNameEl.parentElement.querySelector('.bili-ip-badge-up')) {
        const anchor = upNameEl.closest('a') || document.querySelector('.up-avatar[href*="space.bilibili.com"]');
        const href = anchor?.getAttribute('href') || '';
        const match = href.match(/space\.bilibili\.com\/(\d+)/);
        const mid = match ? match[1] : (window.__INITIAL_STATE__?.videoData?.owner?.mid || window.__INITIAL_STATE__?.upData?.mid);
        if (mid) {
          const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-up');
          upNameEl.parentElement.appendChild(badge);
          if (!userIpCache.has(mid)) {
            fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
          }
        }
      }
      return;
    }

    upContainers.forEach((container) => {
      // 联合投稿处理 (多 UP 主列表)
      const staffItems = container.querySelectorAll('.staff-item, .member-item, .up-card-item');
      if (staffItems.length > 0) {
        staffItems.forEach((item) => {
          if (item.querySelector('.bili-ip-badge-up')) return;
          const link = item.querySelector('a[href*="space.bilibili.com"]');
          const nameEl = item.querySelector('.staff-name, .name, .up-name');
          const match = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/);
          const mid = match ? match[1] : null;
          if (mid && nameEl) {
            const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-up');
            nameEl.parentElement.appendChild(badge);
            if (!userIpCache.has(mid)) {
              fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
            }
          }
        });
        return;
      }

      // 单 UP 主处理
      if (container.querySelector('.bili-ip-badge-up')) return;
      const link = container.querySelector('a[href*="space.bilibili.com"]');
      const nameEl = container.querySelector('.up-name, .name-text, .username, .name');
      const match = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/);
      const mid = match ? match[1] : (window.__INITIAL_STATE__?.videoData?.owner?.mid || window.__INITIAL_STATE__?.upData?.mid);

      if (mid && nameEl) {
        const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-up');
        nameEl.parentElement.appendChild(badge);
        if (!userIpCache.has(mid)) {
          fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
        }
      }
    });
  }

  // [模块 2]: 个人空间页 (space.bilibili.com)
  function processSpaceHeader() {
    if (!location.hostname.includes('space.bilibili.com')) return;
    const headerContainer = document.querySelector('#h-name, .h-basic, .user-basic, .h-text, .header-info');
    if (!headerContainer) return;

    if (headerContainer.querySelector('.bili-ip-badge-space')) return;

    const urlMatch = location.pathname.match(/\/(\d+)/);
    const mid = urlMatch ? urlMatch[1] : window.__INITIAL_STATE__?.space?.mid;
    if (!mid) return;

    const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-space');
    headerContainer.appendChild(badge);

    if (!userIpCache.has(mid)) {
      fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
    }
  }

  // [模块 3]: 评论区处理 (Web Components & 经典评论区)
  function processComments() {
    // 兼容 B站 新版 Web Components 评论组件 (<bili-comment-renderer>, <bili-comment-reply-renderer>) 与旧版 DOM
    const replyMetaList = queryAllDeep('.reply-info, .sub-reply-info, .reply-time, .sub-reply-time, .con .info', document);

    replyMetaList.forEach((meta) => {
      // 检查原页面是否已经内建显示了 IP 属地 (避免重复)
      const textContent = meta.textContent || '';
      if (textContent.includes('IP属地') || meta.querySelector('.reply-location, .sub-reply-location, .bili-ip-badge-comment')) {
        return;
      }

      // 定位父级评论节点获取 rpid 或 mid
      const rootItem = meta.closest('.reply-item, .sub-reply-item, bili-comment-renderer, bili-comment-reply-renderer, .comment-item') || meta.parentElement;
      if (!rootItem) return;

      const rpid = rootItem.getAttribute('data-id') || rootItem.getAttribute('data-rpid') || rootItem.getAttribute('id')?.replace(/^reply-/, '');
      const userLink = rootItem.querySelector('a[href*="space.bilibili.com"]') || rootItem.querySelector('.user-name, .name');
      const midMatch = userLink?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/) || userLink?.getAttribute('data-user-id');
      const mid = Array.isArray(midMatch) ? midMatch[1] : midMatch;

      // 优先从嗅探到的评论缓存或用户缓存中取值
      const loc = (rpid && replyIpCache.get(rpid)) || (mid && userIpCache.get(mid));

      if (loc) {
        const badge = createBadgeElement(loc, 'bili-ip-badge-comment');
        meta.appendChild(badge);
      }
    });
  }

  // [模块 4]: 动态与专栏 (t.bilibili.com / opus / 动态流)
  function processDynamics() {
    const dynCards = document.querySelectorAll('.bili-dyn-item, .bili-dyn-card, .bili-dyn-list__item, .opus-detail, .bili-opus-header');

    dynCards.forEach((card) => {
      if (card.querySelector('.bili-ip-badge-dynamic')) return;

      const authorContainer = card.querySelector('.bili-dyn-item__header, .bili-dyn-item__author, .opus-module-author, .bili-opus-header');
      if (!authorContainer) return;

      const timeEl = authorContainer.querySelector('.bili-dyn-time, .opus-module-author__pub-time, .time');
      const link = authorContainer.querySelector('a[href*="space.bilibili.com"]');
      const midMatch = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/);
      const mid = midMatch ? midMatch[1] : null;

      const dynId = card.getAttribute('data-dynamic-id') || card.getAttribute('data-id');
      const cachedLoc = (dynId && dynamicIpCache.get(dynId)) || (mid && userIpCache.get(mid));

      if (cachedLoc) {
        const badge = createBadgeElement(cachedLoc, 'bili-ip-badge-dynamic');
        if (timeEl) {
          timeEl.parentElement.appendChild(badge);
        } else {
          authorContainer.appendChild(badge);
        }
      } else if (mid) {
        const badge = createBadgeElement(null, 'bili-ip-badge-dynamic');
        if (timeEl) {
          timeEl.parentElement.appendChild(badge);
        } else {
          authorContainer.appendChild(badge);
        }
        fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
      }
    });
  }

  // [模块 5]: 用户悬浮卡片 (Hover User Card Popover)
  function processUserHoverCards() {
    const userCards = document.querySelectorAll('.user-card, .bili-user-profile, .user-card-m, .bili-user-card');

    userCards.forEach((card) => {
      if (card.querySelector('.bili-ip-badge-card')) return;

      const nameEl = card.querySelector('.user-name, .name, .user-info-detail');
      const link = card.querySelector('a[href*="space.bilibili.com"]') || card.querySelector('.avatar');
      const midMatch = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/) || card.getAttribute('data-mid');
      const mid = Array.isArray(midMatch) ? midMatch[1] : midMatch;

      if (mid && nameEl) {
        const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-card');
        nameEl.parentElement.appendChild(badge);
        if (!userIpCache.has(mid)) {
          fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
        }
      }
    });
  }

  // [模块 6]: 直播间与专栏阅读页 (Live & Article Reads)
  function processOtherPages() {
    // 直播间主播信息
    if (location.hostname.includes('live.bilibili.com')) {
      const liveOwner = document.querySelector('.room-owner-username, .up-info-section, .upper-row');
      if (liveOwner && !liveOwner.querySelector('.bili-ip-badge-live')) {
        const link = liveOwner.closest('a') || document.querySelector('a[href*="space.bilibili.com"]');
        const midMatch = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/);
        const mid = midMatch ? midMatch[1] : null;
        if (mid) {
          const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-live');
          liveOwner.appendChild(badge);
          if (!userIpCache.has(mid)) {
            fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
          }
        }
      }
    }

    // 专栏文章页 (read/cv...)
    if (location.pathname.startsWith('/read/')) {
      const readUp = document.querySelector('.up-info .author-name, .article-read-info .author-name');
      if (readUp && !readUp.parentElement.querySelector('.bili-ip-badge-up')) {
        const link = readUp.closest('a') || document.querySelector('.up-info a[href*="space.bilibili.com"]');
        const midMatch = link?.getAttribute('href')?.match(/space\.bilibili\.com\/(\d+)/);
        const mid = midMatch ? midMatch[1] : null;
        if (mid) {
          const badge = createBadgeElement(userIpCache.get(mid), 'bili-ip-badge-up');
          readUp.parentElement.appendChild(badge);
          if (!userIpCache.has(mid)) {
            fetchUserIp(mid).then((loc) => updateBadgeElement(badge, loc));
          }
        }
      }
    }
  }

  // =========================================================================
  // 8. 调度引擎与 SPA 路由监听 (Engine & SPA Route Observer)
  // =========================================================================
  let debounceTimer = null;

  function runAllScanners() {
    processVideoUpInfo();
    processSpaceHeader();
    processComments();
    processDynamics();
    processUserHoverCards();
    processOtherPages();
  }

  function triggerDomScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      window.requestAnimationFrame(() => {
        runAllScanners();
      });
    }, CONFIG.DEBOUNCE_DELAY);
  }

  function injectGlobalStyles() {
    if (document.getElementById('bili-ip-display-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'bili-ip-display-styles';
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function handleRouteUrlChange() {
    // 路由切换时重新触发扫描，确保 SPA 页面刷新后组件能够正确装载
    setTimeout(() => {
      runAllScanners();
    }, 200);
  }

  function setupSpaRouteListeners() {
    // 劫持 history.pushState 与 replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      handleRouteUrlChange();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      handleRouteUrlChange();
      return result;
    };

    window.addEventListener('popstate', handleRouteUrlChange);
    window.addEventListener('hashchange', handleRouteUrlChange);
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.addedNodes.length > 0) {
          // 忽略由本脚本创建的节点自身引发的变动
          let hasExternalNode = false;
          for (let j = 0; j < m.addedNodes.length; j++) {
            const node = m.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains('bili-ip-badge')) {
              hasExternalNode = true;
              break;
            }
          }
          if (hasExternalNode) {
            shouldScan = true;
            break;
          }
        }
      }
      if (shouldScan) {
        triggerDomScan();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // =========================================================================
  // 9. 脚本主入口 (Bootstrap)
  // =========================================================================
  function init() {
    setupNetworkInterceptors();
    injectGlobalStyles();
    setupSpaRouteListeners();
    setupMutationObserver();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectGlobalStyles();
        runAllScanners();
      });
    } else {
      runAllScanners();
    }
  }

  init();
})();
