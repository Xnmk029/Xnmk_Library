/*! Comment-PC Release Version (1.2.26). TimeStamp (Wed Jul 27 2022 11:10:31 GMT+0000 (Coordinated Universal Time)). */
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@bilibili/bili-user/lib/index.js":
/*!*******************************************************!*\
  !*** ./node_modules/@bilibili/bili-user/lib/index.js ***!
  \*******************************************************/
/***/ (function(module) {

!function(e,t){if(true)module.exports=t();else { var i, n; }}(this,(function(){return function(e){var t={};function n(i){if(t[i])return t[i].exports;var o=t[i]={i:i,l:!1,exports:{}};return e[i].call(o.exports,o,o.exports,n),o.l=!0,o.exports}return n.m=e,n.c=t,n.d=function(e,t,i){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:i})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(i,o,function(t){return e[t]}.bind(null,o));return i},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=6)}([function(e,t){function n(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}e.exports=function(e,t,i){return t&&n(e.prototype,t),i&&n(e,i),e}},function(e,t,n){"use strict";t.decode=t.parse=n(4),t.encode=t.stringify=n(5)},function(e,t){e.exports=function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}},function(e,t){function n(t){return"function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?e.exports=n=function(e){return typeof e}:e.exports=n=function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},n(t)}e.exports=n},function(e,t,n){"use strict";function i(e,t){return Object.prototype.hasOwnProperty.call(e,t)}e.exports=function(e,t,n,r){t=t||"&",n=n||"=";var a={};if("string"!=typeof e||0===e.length)return a;var c=/\+/g;e=e.split(t);var s=1e3;r&&"number"==typeof r.maxKeys&&(s=r.maxKeys);var u=e.length;s>0&&u>s&&(u=s);for(var l=0;l<u;++l){var f,d,p,h,v=e[l].replace(c,"%20"),y=v.indexOf(n);y>=0?(f=v.substr(0,y),d=v.substr(y+1)):(f=v,d=""),p=decodeURIComponent(f),h=decodeURIComponent(d),i(a,p)?o(a[p])?a[p].push(h):a[p]=[a[p],h]:a[p]=h}return a};var o=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)}},function(e,t,n){"use strict";var i=function(e){switch(typeof e){case"string":return e;case"boolean":return e?"true":"false";case"number":return isFinite(e)?e:"";default:return""}};e.exports=function(e,t,n,c){return t=t||"&",n=n||"=",null===e&&(e=void 0),"object"==typeof e?r(a(e),(function(a){var c=encodeURIComponent(i(a))+n;return o(e[a])?r(e[a],(function(e){return c+encodeURIComponent(i(e))})).join(t):c+encodeURIComponent(i(e[a]))})).join(t):c?encodeURIComponent(i(c))+n+encodeURIComponent(i(e)):""};var o=Array.isArray||function(e){return"[object Array]"===Object.prototype.toString.call(e)};function r(e,t){if(e.map)return e.map(t);for(var n=[],i=0;i<e.length;i++)n.push(t(e[i],i));return n}var a=Object.keys||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&t.push(n);return t}},function(e,t,n){"use strict";n.r(t);var i=n(2),o=n.n(i),r=n(0),a=n.n(r),c=n(3),s=n.n(c),u=n(1),l=n.n(u),f=function(e){var t=e.method,n=e.url,i=e.data,o=e.headers,r="POST"===(t=t.toLocaleUpperCase())?l.a.stringify(i):"",a="GET"===t?l.a.stringify(i):"",c=a?-1!==n.indexOf("?")?"".concat(n,"&").concat(a):"".concat(n,"?").concat(a):n;return new Promise((function(e,n){var i=new XMLHttpRequest;if(i.onreadystatechange=function(){if(i.readyState===XMLHttpRequest.DONE)if(200===i.status){var t=null;try{t=JSON.parse(i.responseText)}catch(e){t=i.responseText}e(t)}else n(i.status)},i.withCredentials=!0,i.open(t,c,!0),"POST"===t&&o&&"object"===s()(o))for(var a in o)i.setRequestHeader(a,o[a]);i.send(r)}))},d=function(e){var t=""+document.cookie,n=t.indexOf(e+"=");if(-1===n||""===e)return"";var i=t.indexOf(";",n);return-1===i&&(i=t.length),unescape(t.substring(n+e.length+1,i))},p=function(e){return e&&"function"==typeof e},h=function(){return"undefined"==typeof window},v=function(){return!h()&&"www.biligame.com"===location.host},y=v()?"//main-api.biligame.com/x/web-interface/nav":"//api.bilibili.com/x/web-interface/nav",g=function(){function e(){o()(this,e),this.callbacks=window.__BiliUserWatch__||[],this.once=[],this.locked=!1,this.cache=null,this.isLogin=!1,this.MiniLogin=null,this._onStorage(),this.callbacks.length>0&&this._getNav()}return a()(e,null,[{key:"init",value:function(){return e.instace||(e.instace=new e),e.instace}}]),a()(e,[{key:"_notice",value:function(e){for(var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1],n=0,i=this.callbacks.length;n<i;n++){var o=this.callbacks[n];o.state=o.state||0,(0===o.state||t)&&(o(e),o.state++)}for(var r=0,a=this.once.length;r<a;r++)this.once[r](e);this.once=[]}},{key:"_clean",value:function(){this.locked=!1,this.isLogin=!1,this.cache=null}},{key:"_setBiliLoginState",value:function(){var e=Number(window.localStorage.getItem("bili-login-state")||1);window.localStorage.setItem("bili-login-state",++e)}},{key:"_onStorage",value:function(){var e=this;window.addEventListener("storage",(function(t){"bili-login-state"===t.key&&e.refresh()}))}},{key:"_getNav",value:function(){var e=this;this.cache?this._notice(this.cache):this.locked||(this.locked=!0,f({method:"GET",url:y}).then((function(t){e.cache=t,e.isLogin=t.data&&t.data.isLogin,e._notice(t,!0)})))}},{key:"_addOnce",value:function(e){this.once.push(e),this._getNav()}},{key:"_addCallbacks",value:function(e){var t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];this.callbacks.push(e),t&&this._getNav()}},{key:"get",value:function(t){if(!p(t))return new Promise((function(t){e.instace._addOnce((function(e){t(e)}))}));this._addOnce(t)}},{key:"watch",value:function(e){var t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];p(e)&&this._addCallbacks(e,t)}},{key:"unWatch",value:function(e){if(p(e)){var t=this.callbacks.indexOf(e);-1!==t&&this.callbacks.splice(t,1)}}},{key:"refresh",value:function(){this._clean(),this._getNav()}},{key:"quickLogin",value:function(e){var t,n=this;this.MiniLogin?this._Login(e):(t="//s1.hdslb.com/bfs/seed/jinkela/short/mini-login/miniLogin.umd.min.js",new Promise((function(e){var n=document.createElement("script");n.type="text/javascript",n.readyState?n.onreadystatechange=function(){"loaded"!==n.readyState&&"complete"!==n.readyState||(n.onreadystatechange=null,e())}:n.onload=function(){e()},n.src=t,document.body.appendChild(n)}))).then((function(){n.MiniLogin=new window.MiniLogin,n._Login(e)}))}},{key:"_Login",value:function(e){var t=this;this.MiniLogin.showComponent(),this.MiniLogin.addEventListener("success",(function(){t.refresh(),t._setBiliLoginState(),e&&e({code:0,message:"success"}),t.MiniLogin.removeEventListener("success"),t.MiniLogin.removeEventListener("cancel")})),this.MiniLogin.addEventListener("cancel",(function(){e&&e({code:-1,message:"cancel"}),t.MiniLogin.removeEventListener("success"),t.MiniLogin.removeEventListener("cancel")}))}},{key:"logout",value:function(e,t){var n=this,i="function"==typeof e&&e,o={biliCSRF:d("bili_jct")};t&&(o.gourl=t),f({method:"POST",url:"//passport.bilibili.com/login/exit/v2",headers:{"Content-type":"application/x-www-form-urlencoded"},data:o}).then((function(e){e.status&&(n.refresh(),n._setBiliLoginState(),i&&i({code:0,message:"log out success",data:e.data}),t&&(window.location=e.data.redirectUrl))})).catch((function(e){i&&i({code:-1,message:"XMLHttpRequest status:"+e})}))}}]),e}(),m={};h()||(m=window.__BiliUser__||function(){var e=null,t=v()?"biligame":"bilibili";if(new RegExp(".?".concat(t,".com$")).test(document.domain))try{document.domain="".concat(t,".com"),e=window.parent.__BiliUser__}catch(e){}return e}()||g.init(),window.__BiliUser__=m);t.default=m}])}));

/***/ }),

/***/ "./node_modules/@bilibili/risk-control-captcha/dist/risk-control-captcha.js":
/*!**********************************************************************************!*\
  !*** ./node_modules/@bilibili/risk-control-captcha/dist/risk-control-captcha.js ***!
  \**********************************************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

/*! For license information please see risk-control-captcha.js.LICENSE.txt */
!function(e,t){ true?module.exports=t():0}("undefined"!=typeof window?window:"undefined"!=typeof __webpack_require__.g?__webpack_require__.g:"undefined"!=typeof self?self:{},(function(){return function(){var e={646:function(e){"undefined"!=typeof self&&self,e.exports=function(e){var t={};function n(r){if(t[r])return t[r].exports;var i=t[r]={i:r,l:!1,exports:{}};return e[r].call(i.exports,i,i.exports,n),i.l=!0,i.exports}return n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var i in e)n.d(r,i,function(t){return e[t]}.bind(null,i));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s="fb15")}({"0a06":function(e,t,n){"use strict";var r=n("c532"),i=n("30b5"),o=n("f6b4"),a=n("5270"),s=n("4a7b");function c(e){this.defaults=e,this.interceptors={request:new o,response:new o}}c.prototype.request=function(e){"string"==typeof e?(e=arguments[1]||{}).url=arguments[0]:e=e||{},(e=s(this.defaults,e)).method?e.method=e.method.toLowerCase():this.defaults.method?e.method=this.defaults.method.toLowerCase():e.method="get";var t=[a,void 0],n=Promise.resolve(e);for(this.interceptors.request.forEach((function(e){t.unshift(e.fulfilled,e.rejected)})),this.interceptors.response.forEach((function(e){t.push(e.fulfilled,e.rejected)}));t.length;)n=n.then(t.shift(),t.shift());return n},c.prototype.getUri=function(e){return e=s(this.defaults,e),i(e.url,e.params,e.paramsSerializer).replace(/^\?/,"")},r.forEach(["delete","get","head","options"],(function(e){c.prototype[e]=function(t,n){return this.request(s(n||{},{method:e,url:t,data:(n||{}).data}))}})),r.forEach(["post","put","patch"],(function(e){c.prototype[e]=function(t,n,r){return this.request(s(r||{},{method:e,url:t,data:n}))}})),e.exports=c},"0df6":function(e,t,n){"use strict";e.exports=function(e){return function(t){return e.apply(null,t)}}},"1d2b":function(e,t,n){"use strict";e.exports=function(e,t){return function(){for(var n=new Array(arguments.length),r=0;r<n.length;r++)n[r]=arguments[r];return e.apply(t,n)}}},2444:function(e,t,n){"use strict";(function(t){var r=n("c532"),i=n("c8af"),o={"Content-Type":"application/x-www-form-urlencoded"};function a(e,t){!r.isUndefined(e)&&r.isUndefined(e["Content-Type"])&&(e["Content-Type"]=t)}function s(){var e;return("undefined"!=typeof XMLHttpRequest||void 0!==t&&"[object process]"===Object.prototype.toString.call(t))&&(e=n("b50d")),e}var c={adapter:s(),transformRequest:[function(e,t){return i(t,"Accept"),i(t,"Content-Type"),r.isFormData(e)||r.isArrayBuffer(e)||r.isBuffer(e)||r.isStream(e)||r.isFile(e)||r.isBlob(e)?e:r.isArrayBufferView(e)?e.buffer:r.isURLSearchParams(e)?(a(t,"application/x-www-form-urlencoded;charset=utf-8"),e.toString()):r.isObject(e)?(a(t,"application/json;charset=utf-8"),JSON.stringify(e)):e}],transformResponse:[function(e){if("string"==typeof e)try{e=JSON.parse(e)}catch(e){}return e}],timeout:0,xsrfCookieName:"XSRF-TOKEN",xsrfHeaderName:"X-XSRF-TOKEN",maxContentLength:-1,maxBodyLength:-1,validateStatus:function(e){return e>=200&&e<300},headers:{common:{Accept:"application/json, text/plain, */*"}}};r.forEach(["delete","get","head"],(function(e){c.headers[e]={}})),r.forEach(["post","put","patch"],(function(e){c.headers[e]=r.merge(o)})),e.exports=c}).call(this,n("4362"))},"2d83":function(e,t,n){"use strict";var r=n("387f");e.exports=function(e,t,n,i,o){var a=new Error(e);return r(a,t,n,i,o)}},"2e67":function(e,t,n){"use strict";e.exports=function(e){return!(!e||!e.__CANCEL__)}},"30b5":function(e,t,n){"use strict";var r=n("c532");function i(e){return encodeURIComponent(e).replace(/%3A/gi,":").replace(/%24/g,"$").replace(/%2C/gi,",").replace(/%20/g,"+").replace(/%5B/gi,"[").replace(/%5D/gi,"]")}e.exports=function(e,t,n){if(!t)return e;var o;if(n)o=n(t);else if(r.isURLSearchParams(t))o=t.toString();else{var a=[];r.forEach(t,(function(e,t){null!=e&&(r.isArray(e)?t+="[]":e=[e],r.forEach(e,(function(e){r.isDate(e)?e=e.toISOString():r.isObject(e)&&(e=JSON.stringify(e)),a.push(i(t)+"="+i(e))})))})),o=a.join("&")}if(o){var s=e.indexOf("#");-1!==s&&(e=e.slice(0,s)),e+=(-1===e.indexOf("?")?"?":"&")+o}return e}},"387f":function(e,t,n){"use strict";e.exports=function(e,t,n,r,i){return e.config=t,n&&(e.code=n),e.request=r,e.response=i,e.isAxiosError=!0,e.toJSON=function(){return{message:this.message,name:this.name,description:this.description,number:this.number,fileName:this.fileName,lineNumber:this.lineNumber,columnNumber:this.columnNumber,stack:this.stack,config:this.config,code:this.code}},e}},3934:function(e,t,n){"use strict";var r=n("c532");e.exports=r.isStandardBrowserEnv()?function(){var e,t=/(msie|trident)/i.test(navigator.userAgent),n=document.createElement("a");function i(e){var r=e;return t&&(n.setAttribute("href",r),r=n.href),n.setAttribute("href",r),{href:n.href,protocol:n.protocol?n.protocol.replace(/:$/,""):"",host:n.host,search:n.search?n.search.replace(/^\?/,""):"",hash:n.hash?n.hash.replace(/^#/,""):"",hostname:n.hostname,port:n.port,pathname:"/"===n.pathname.charAt(0)?n.pathname:"/"+n.pathname}}return e=i(window.location.href),function(t){var n=r.isString(t)?i(t):t;return n.protocol===e.protocol&&n.host===e.host}}():function(){return!0}},4127:function(e,t,n){"use strict";var r=n("d233"),i=n("b313"),o=Object.prototype.hasOwnProperty,a={brackets:function(e){return e+"[]"},comma:"comma",indices:function(e,t){return e+"["+t+"]"},repeat:function(e){return e}},s=Array.isArray,c=Array.prototype.push,l=function(e,t){c.apply(e,s(t)?t:[t])},u=Date.prototype.toISOString,f=i.default,d={addQueryPrefix:!1,allowDots:!1,charset:"utf-8",charsetSentinel:!1,delimiter:"&",encode:!0,encoder:r.encode,encodeValuesOnly:!1,format:f,formatter:i.formatters[f],indices:!1,serializeDate:function(e){return u.call(e)},skipNulls:!1,strictNullHandling:!1},p=function(e){return"string"==typeof e||"number"==typeof e||"boolean"==typeof e||"symbol"==typeof e||"bigint"==typeof e},h=function e(t,n,i,o,a,c,u,f,h,v,g,m,b){var y=t;if("function"==typeof u?y=u(n,y):y instanceof Date?y=v(y):"comma"===i&&s(y)&&(y=r.maybeMap(y,(function(e){return e instanceof Date?v(e):e})).join(",")),null===y){if(o)return c&&!m?c(n,d.encoder,b,"key"):n;y=""}if(p(y)||r.isBuffer(y))return c?[g(m?n:c(n,d.encoder,b,"key"))+"="+g(c(y,d.encoder,b,"value"))]:[g(n)+"="+g(String(y))];var w,A=[];if(void 0===y)return A;if(s(u))w=u;else{var x=Object.keys(y);w=f?x.sort(f):x}for(var E=0;E<w.length;++E){var C=w[E],k=y[C];if(!a||null!==k){var S=s(y)?"function"==typeof i?i(n,C):n:n+(h?"."+C:"["+C+"]");l(A,e(k,S,i,o,a,c,u,f,h,v,g,m,b))}}return A},v=function(e){if(!e)return d;if(null!==e.encoder&&void 0!==e.encoder&&"function"!=typeof e.encoder)throw new TypeError("Encoder has to be a function.");var t=e.charset||d.charset;if(void 0!==e.charset&&"utf-8"!==e.charset&&"iso-8859-1"!==e.charset)throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");var n=i.default;if(void 0!==e.format){if(!o.call(i.formatters,e.format))throw new TypeError("Unknown format option provided.");n=e.format}var r=i.formatters[n],a=d.filter;return("function"==typeof e.filter||s(e.filter))&&(a=e.filter),{addQueryPrefix:"boolean"==typeof e.addQueryPrefix?e.addQueryPrefix:d.addQueryPrefix,allowDots:void 0===e.allowDots?d.allowDots:!!e.allowDots,charset:t,charsetSentinel:"boolean"==typeof e.charsetSentinel?e.charsetSentinel:d.charsetSentinel,delimiter:void 0===e.delimiter?d.delimiter:e.delimiter,encode:"boolean"==typeof e.encode?e.encode:d.encode,encoder:"function"==typeof e.encoder?e.encoder:d.encoder,encodeValuesOnly:"boolean"==typeof e.encodeValuesOnly?e.encodeValuesOnly:d.encodeValuesOnly,filter:a,formatter:r,serializeDate:"function"==typeof e.serializeDate?e.serializeDate:d.serializeDate,skipNulls:"boolean"==typeof e.skipNulls?e.skipNulls:d.skipNulls,sort:"function"==typeof e.sort?e.sort:null,strictNullHandling:"boolean"==typeof e.strictNullHandling?e.strictNullHandling:d.strictNullHandling}};e.exports=function(e,t){var n,r=e,i=v(t);"function"==typeof i.filter?r=(0,i.filter)("",r):s(i.filter)&&(n=i.filter);var o,c=[];if("object"!=typeof r||null===r)return"";o=t&&t.arrayFormat in a?t.arrayFormat:t&&"indices"in t?t.indices?"indices":"repeat":"indices";var u=a[o];n||(n=Object.keys(r)),i.sort&&n.sort(i.sort);for(var f=0;f<n.length;++f){var d=n[f];i.skipNulls&&null===r[d]||l(c,h(r[d],d,u,i.strictNullHandling,i.skipNulls,i.encode?i.encoder:null,i.filter,i.sort,i.allowDots,i.serializeDate,i.formatter,i.encodeValuesOnly,i.charset))}var p=c.join(i.delimiter),g=!0===i.addQueryPrefix?"?":"";return i.charsetSentinel&&("iso-8859-1"===i.charset?g+="utf8=%26%2310003%3B&":g+="utf8=%E2%9C%93&"),p.length>0?g+p:""}},4328:function(e,t,n){"use strict";var r=n("4127"),i=n("9e6a"),o=n("b313");e.exports={formats:o,parse:i,stringify:r}},4362:function(e,t,n){t.nextTick=function(e){var t=Array.prototype.slice.call(arguments);t.shift(),setTimeout((function(){e.apply(null,t)}),0)},t.platform=t.arch=t.execPath=t.title="browser",t.pid=1,t.browser=!0,t.env={},t.argv=[],t.binding=function(e){throw new Error("No such module. (Possibly not yet loaded)")},function(){var e,r="/";t.cwd=function(){return r},t.chdir=function(t){e||(e=n("df7c")),r=e.resolve(t,r)}}(),t.exit=t.kill=t.umask=t.dlopen=t.uptime=t.memoryUsage=t.uvCounters=function(){},t.features={}},"467f":function(e,t,n){"use strict";var r=n("2d83");e.exports=function(e,t,n){var i=n.config.validateStatus;n.status&&i&&!i(n.status)?t(r("Request failed with status code "+n.status,n.config,null,n.request,n)):e(n)}},"4a7b":function(e,t,n){"use strict";var r=n("c532");e.exports=function(e,t){t=t||{};var n={},i=["url","method","data"],o=["headers","auth","proxy","params"],a=["baseURL","transformRequest","transformResponse","paramsSerializer","timeout","timeoutMessage","withCredentials","adapter","responseType","xsrfCookieName","xsrfHeaderName","onUploadProgress","onDownloadProgress","decompress","maxContentLength","maxBodyLength","maxRedirects","transport","httpAgent","httpsAgent","cancelToken","socketPath","responseEncoding"],s=["validateStatus"];function c(e,t){return r.isPlainObject(e)&&r.isPlainObject(t)?r.merge(e,t):r.isPlainObject(t)?r.merge({},t):r.isArray(t)?t.slice():t}function l(i){r.isUndefined(t[i])?r.isUndefined(e[i])||(n[i]=c(void 0,e[i])):n[i]=c(e[i],t[i])}r.forEach(i,(function(e){r.isUndefined(t[e])||(n[e]=c(void 0,t[e]))})),r.forEach(o,l),r.forEach(a,(function(i){r.isUndefined(t[i])?r.isUndefined(e[i])||(n[i]=c(void 0,e[i])):n[i]=c(void 0,t[i])})),r.forEach(s,(function(r){r in t?n[r]=c(e[r],t[r]):r in e&&(n[r]=c(void 0,e[r]))}));var u=i.concat(o).concat(a).concat(s),f=Object.keys(e).concat(Object.keys(t)).filter((function(e){return-1===u.indexOf(e)}));return r.forEach(f,l),n}},5270:function(e,t,n){"use strict";var r=n("c532"),i=n("c401"),o=n("2e67"),a=n("2444");function s(e){e.cancelToken&&e.cancelToken.throwIfRequested()}e.exports=function(e){return s(e),e.headers=e.headers||{},e.data=i(e.data,e.headers,e.transformRequest),e.headers=r.merge(e.headers.common||{},e.headers[e.method]||{},e.headers),r.forEach(["delete","get","head","post","put","patch","common"],(function(t){delete e.headers[t]})),(e.adapter||a.adapter)(e).then((function(t){return s(e),t.data=i(t.data,t.headers,e.transformResponse),t}),(function(t){return o(t)||(s(e),t&&t.response&&(t.response.data=i(t.response.data,t.response.headers,e.transformResponse))),Promise.reject(t)}))}},"7a77":function(e,t,n){"use strict";function r(e){this.message=e}r.prototype.toString=function(){return"Cancel"+(this.message?": "+this.message:"")},r.prototype.__CANCEL__=!0,e.exports=r},"7aac":function(e,t,n){"use strict";var r=n("c532");e.exports=r.isStandardBrowserEnv()?{write:function(e,t,n,i,o,a){var s=[];s.push(e+"="+encodeURIComponent(t)),r.isNumber(n)&&s.push("expires="+new Date(n).toGMTString()),r.isString(i)&&s.push("path="+i),r.isString(o)&&s.push("domain="+o),!0===a&&s.push("secure"),document.cookie=s.join("; ")},read:function(e){var t=document.cookie.match(new RegExp("(^|;\\s*)("+e+")=([^;]*)"));return t?decodeURIComponent(t[3]):null},remove:function(e){this.write(e,"",Date.now()-864e5)}}:{write:function(){},read:function(){return null},remove:function(){}}},"83b9":function(e,t,n){"use strict";var r=n("d925"),i=n("e683");e.exports=function(e,t){return e&&!r(t)?i(e,t):t}},8875:function(e,t,n){var r,i,o,a;"undefined"!=typeof self&&self,a=function(){function e(){if(document.currentScript)return document.currentScript;try{throw new Error}catch(u){var e,t,n,r=/@([^@]*):(\d+):(\d+)\s*$/gi,i=/.*at [^(]*\((.*):(.+):(.+)\)$/gi.exec(u.stack)||r.exec(u.stack),o=i&&i[1]||!1,a=i&&i[2]||!1,s=document.location.href.replace(document.location.hash,""),c=document.getElementsByTagName("script");o===s&&(e=document.documentElement.outerHTML,t=new RegExp("(?:[^\\n]+?\\n){0,"+(a-2)+"}[^<]*<script>([\\d\\D]*?)<\\/script>[\\d\\D]*","i"),n=e.replace(t,"$1").trim());for(var l=0;l<c.length;l++){if("interactive"===c[l].readyState)return c[l];if(c[l].src===o)return c[l];if(o===s&&c[l].innerHTML&&c[l].innerHTML.trim()===n)return c[l]}return null}}return e},i=[],void 0===(o="function"==typeof(r=a)?r.apply(t,i):r)||(e.exports=o)},"8df4":function(e,t,n){"use strict";var r=n("7a77");function i(e){if("function"!=typeof e)throw new TypeError("executor must be a function.");var t;this.promise=new Promise((function(e){t=e}));var n=this;e((function(e){n.reason||(n.reason=new r(e),t(n.reason))}))}i.prototype.throwIfRequested=function(){if(this.reason)throw this.reason},i.source=function(){var e;return{token:new i((function(t){e=t})),cancel:e}},e.exports=i},9224:function(e){e.exports=JSON.parse('{"name":"@bilibili/bili-app-ajax","version":"3.3.2","main":"dist/BiliAjax.umd.min.js","scripts":{"dev":"vue-cli-service serve","build":"vue-cli-service build --target lib --name BiliAjax src/index.js","lint":"vue-cli-service lint --fix"},"author":"falstack <icesilt@outlook.com>","devDependencies":{"@vue/cli-plugin-babel":"^4.5.8","@vue/cli-plugin-eslint":"^4.5.8","@vue/cli-service":"^4.5.8","babel-eslint":"^10.1.0","core-js":"^3.6.5","eslint":"^7.12.1","eslint-plugin-vue":"^7.1.0","vue-template-compiler":"^2.6.12"},"dependencies":{"@bilibili/js-bridge":"^1.0.75","axios":"^0.21.0","qs":"^6.9.4"}}')},"9e6a":function(e,t,n){"use strict";var r=n("d233"),i=Object.prototype.hasOwnProperty,o=Array.isArray,a={allowDots:!1,allowPrototypes:!1,arrayLimit:20,charset:"utf-8",charsetSentinel:!1,comma:!1,decoder:r.decode,delimiter:"&",depth:5,ignoreQueryPrefix:!1,interpretNumericEntities:!1,parameterLimit:1e3,parseArrays:!0,plainObjects:!1,strictNullHandling:!1},s=function(e){return e.replace(/&#(\d+);/g,(function(e,t){return String.fromCharCode(parseInt(t,10))}))},c=function(e,t){return e&&"string"==typeof e&&t.comma&&e.indexOf(",")>-1?e.split(","):e},l="utf8=%26%2310003%3B",u="utf8=%E2%9C%93",f=function(e,t){var n,f={},d=t.ignoreQueryPrefix?e.replace(/^\?/,""):e,p=t.parameterLimit===1/0?void 0:t.parameterLimit,h=d.split(t.delimiter,p),v=-1,g=t.charset;if(t.charsetSentinel)for(n=0;n<h.length;++n)0===h[n].indexOf("utf8=")&&(h[n]===u?g="utf-8":h[n]===l&&(g="iso-8859-1"),v=n,n=h.length);for(n=0;n<h.length;++n)if(n!==v){var m,b,y=h[n],w=y.indexOf("]="),A=-1===w?y.indexOf("="):w+1;-1===A?(m=t.decoder(y,a.decoder,g,"key"),b=t.strictNullHandling?null:""):(m=t.decoder(y.slice(0,A),a.decoder,g,"key"),b=r.maybeMap(c(y.slice(A+1),t),(function(e){return t.decoder(e,a.decoder,g,"value")}))),b&&t.interpretNumericEntities&&"iso-8859-1"===g&&(b=s(b)),y.indexOf("[]=")>-1&&(b=o(b)?[b]:b),i.call(f,m)?f[m]=r.combine(f[m],b):f[m]=b}return f},d=function(e,t,n,r){for(var i=r?t:c(t,n),o=e.length-1;o>=0;--o){var a,s=e[o];if("[]"===s&&n.parseArrays)a=[].concat(i);else{a=n.plainObjects?Object.create(null):{};var l="["===s.charAt(0)&&"]"===s.charAt(s.length-1)?s.slice(1,-1):s,u=parseInt(l,10);n.parseArrays||""!==l?!isNaN(u)&&s!==l&&String(u)===l&&u>=0&&n.parseArrays&&u<=n.arrayLimit?(a=[])[u]=i:a[l]=i:a={0:i}}i=a}return i},p=function(e,t,n,r){if(e){var o=n.allowDots?e.replace(/\.([^.[]+)/g,"[$1]"):e,a=/(\[[^[\]]*])/,s=/(\[[^[\]]*])/g,c=n.depth>0&&a.exec(o),l=c?o.slice(0,c.index):o,u=[];if(l){if(!n.plainObjects&&i.call(Object.prototype,l)&&!n.allowPrototypes)return;u.push(l)}for(var f=0;n.depth>0&&null!==(c=s.exec(o))&&f<n.depth;){if(f+=1,!n.plainObjects&&i.call(Object.prototype,c[1].slice(1,-1))&&!n.allowPrototypes)return;u.push(c[1])}return c&&u.push("["+o.slice(c.index)+"]"),d(u,t,n,r)}},h=function(e){if(!e)return a;if(null!==e.decoder&&void 0!==e.decoder&&"function"!=typeof e.decoder)throw new TypeError("Decoder has to be a function.");if(void 0!==e.charset&&"utf-8"!==e.charset&&"iso-8859-1"!==e.charset)throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");var t=void 0===e.charset?a.charset:e.charset;return{allowDots:void 0===e.allowDots?a.allowDots:!!e.allowDots,allowPrototypes:"boolean"==typeof e.allowPrototypes?e.allowPrototypes:a.allowPrototypes,arrayLimit:"number"==typeof e.arrayLimit?e.arrayLimit:a.arrayLimit,charset:t,charsetSentinel:"boolean"==typeof e.charsetSentinel?e.charsetSentinel:a.charsetSentinel,comma:"boolean"==typeof e.comma?e.comma:a.comma,decoder:"function"==typeof e.decoder?e.decoder:a.decoder,delimiter:"string"==typeof e.delimiter||r.isRegExp(e.delimiter)?e.delimiter:a.delimiter,depth:"number"==typeof e.depth||!1===e.depth?+e.depth:a.depth,ignoreQueryPrefix:!0===e.ignoreQueryPrefix,interpretNumericEntities:"boolean"==typeof e.interpretNumericEntities?e.interpretNumericEntities:a.interpretNumericEntities,parameterLimit:"number"==typeof e.parameterLimit?e.parameterLimit:a.parameterLimit,parseArrays:!1!==e.parseArrays,plainObjects:"boolean"==typeof e.plainObjects?e.plainObjects:a.plainObjects,strictNullHandling:"boolean"==typeof e.strictNullHandling?e.strictNullHandling:a.strictNullHandling}};e.exports=function(e,t){var n=h(t);if(""===e||null==e)return n.plainObjects?Object.create(null):{};for(var i="string"==typeof e?f(e,n):e,o=n.plainObjects?Object.create(null):{},a=Object.keys(i),s=0;s<a.length;++s){var c=a[s],l=p(c,i[c],n,"string"==typeof e);o=r.merge(o,l,n)}return r.compact(o)}},b313:function(e,t,n){"use strict";var r=String.prototype.replace,i=/%20/g,o=n("d233"),a={RFC1738:"RFC1738",RFC3986:"RFC3986"};e.exports=o.assign({default:a.RFC3986,formatters:{RFC1738:function(e){return r.call(e,i,"+")},RFC3986:function(e){return String(e)}}},a)},b50d:function(e,t,n){"use strict";var r=n("c532"),i=n("467f"),o=n("7aac"),a=n("30b5"),s=n("83b9"),c=n("c345"),l=n("3934"),u=n("2d83");e.exports=function(e){return new Promise((function(t,n){var f=e.data,d=e.headers;r.isFormData(f)&&delete d["Content-Type"];var p=new XMLHttpRequest;if(e.auth){var h=e.auth.username||"",v=e.auth.password?unescape(encodeURIComponent(e.auth.password)):"";d.Authorization="Basic "+btoa(h+":"+v)}var g=s(e.baseURL,e.url);if(p.open(e.method.toUpperCase(),a(g,e.params,e.paramsSerializer),!0),p.timeout=e.timeout,p.onreadystatechange=function(){if(p&&4===p.readyState&&(0!==p.status||p.responseURL&&0===p.responseURL.indexOf("file:"))){var r="getAllResponseHeaders"in p?c(p.getAllResponseHeaders()):null,o={data:e.responseType&&"text"!==e.responseType?p.response:p.responseText,status:p.status,statusText:p.statusText,headers:r,config:e,request:p};i(t,n,o),p=null}},p.onabort=function(){p&&(n(u("Request aborted",e,"ECONNABORTED",p)),p=null)},p.onerror=function(){n(u("Network Error",e,null,p)),p=null},p.ontimeout=function(){var t="timeout of "+e.timeout+"ms exceeded";e.timeoutErrorMessage&&(t=e.timeoutErrorMessage),n(u(t,e,"ECONNABORTED",p)),p=null},r.isStandardBrowserEnv()){var m=(e.withCredentials||l(g))&&e.xsrfCookieName?o.read(e.xsrfCookieName):void 0;m&&(d[e.xsrfHeaderName]=m)}if("setRequestHeader"in p&&r.forEach(d,(function(e,t){void 0===f&&"content-type"===t.toLowerCase()?delete d[t]:p.setRequestHeader(t,e)})),r.isUndefined(e.withCredentials)||(p.withCredentials=!!e.withCredentials),e.responseType)try{p.responseType=e.responseType}catch(t){if("json"!==e.responseType)throw t}"function"==typeof e.onDownloadProgress&&p.addEventListener("progress",e.onDownloadProgress),"function"==typeof e.onUploadProgress&&p.upload&&p.upload.addEventListener("progress",e.onUploadProgress),e.cancelToken&&e.cancelToken.promise.then((function(e){p&&(p.abort(),n(e),p=null)})),f||(f=null),p.send(f)}))}},bc3a:function(e,t,n){e.exports=n("cee4")},c345:function(e,t,n){"use strict";var r=n("c532"),i=["age","authorization","content-length","content-type","etag","expires","from","host","if-modified-since","if-unmodified-since","last-modified","location","max-forwards","proxy-authorization","referer","retry-after","user-agent"];e.exports=function(e){var t,n,o,a={};return e?(r.forEach(e.split("\n"),(function(e){if(o=e.indexOf(":"),t=r.trim(e.substr(0,o)).toLowerCase(),n=r.trim(e.substr(o+1)),t){if(a[t]&&i.indexOf(t)>=0)return;a[t]="set-cookie"===t?(a[t]?a[t]:[]).concat([n]):a[t]?a[t]+", "+n:n}})),a):a}},c401:function(e,t,n){"use strict";var r=n("c532");e.exports=function(e,t,n){return r.forEach(n,(function(n){e=n(e,t)})),e}},c532:function(e,t,n){"use strict";var r=n("1d2b"),i=Object.prototype.toString;function o(e){return"[object Array]"===i.call(e)}function a(e){return void 0===e}function s(e){return null!==e&&!a(e)&&null!==e.constructor&&!a(e.constructor)&&"function"==typeof e.constructor.isBuffer&&e.constructor.isBuffer(e)}function c(e){return"[object ArrayBuffer]"===i.call(e)}function l(e){return"undefined"!=typeof FormData&&e instanceof FormData}function u(e){return"undefined"!=typeof ArrayBuffer&&ArrayBuffer.isView?ArrayBuffer.isView(e):e&&e.buffer&&e.buffer instanceof ArrayBuffer}function f(e){return"string"==typeof e}function d(e){return"number"==typeof e}function p(e){return null!==e&&"object"==typeof e}function h(e){if("[object Object]"!==i.call(e))return!1;var t=Object.getPrototypeOf(e);return null===t||t===Object.prototype}function v(e){return"[object Date]"===i.call(e)}function g(e){return"[object File]"===i.call(e)}function m(e){return"[object Blob]"===i.call(e)}function b(e){return"[object Function]"===i.call(e)}function y(e){return p(e)&&b(e.pipe)}function w(e){return"undefined"!=typeof URLSearchParams&&e instanceof URLSearchParams}function A(e){return e.replace(/^\s*/,"").replace(/\s*$/,"")}function x(){return("undefined"==typeof navigator||"ReactNative"!==navigator.product&&"NativeScript"!==navigator.product&&"NS"!==navigator.product)&&"undefined"!=typeof window&&"undefined"!=typeof document}function E(e,t){if(null!=e)if("object"!=typeof e&&(e=[e]),o(e))for(var n=0,r=e.length;n<r;n++)t.call(null,e[n],n,e);else for(var i in e)Object.prototype.hasOwnProperty.call(e,i)&&t.call(null,e[i],i,e)}function C(){var e={};function t(t,n){h(e[n])&&h(t)?e[n]=C(e[n],t):h(t)?e[n]=C({},t):o(t)?e[n]=t.slice():e[n]=t}for(var n=0,r=arguments.length;n<r;n++)E(arguments[n],t);return e}function k(e,t,n){return E(t,(function(t,i){e[i]=n&&"function"==typeof t?r(t,n):t})),e}function S(e){return 65279===e.charCodeAt(0)&&(e=e.slice(1)),e}e.exports={isArray:o,isArrayBuffer:c,isBuffer:s,isFormData:l,isArrayBufferView:u,isString:f,isNumber:d,isObject:p,isPlainObject:h,isUndefined:a,isDate:v,isFile:g,isBlob:m,isFunction:b,isStream:y,isURLSearchParams:w,isStandardBrowserEnv:x,forEach:E,merge:C,extend:k,trim:A,stripBOM:S}},c8af:function(e,t,n){"use strict";var r=n("c532");e.exports=function(e,t){r.forEach(e,(function(n,r){r!==t&&r.toUpperCase()===t.toUpperCase()&&(e[t]=n,delete e[r])}))}},c8ba:function(e,t){var n;n=function(){return this}();try{n=n||new Function("return this")()}catch(e){"object"==typeof window&&(n=window)}e.exports=n},cee4:function(e,t,n){"use strict";var r=n("c532"),i=n("1d2b"),o=n("0a06"),a=n("4a7b");function s(e){var t=new o(e),n=i(o.prototype.request,t);return r.extend(n,o.prototype,t),r.extend(n,t),n}var c=s(n("2444"));c.Axios=o,c.create=function(e){return s(a(c.defaults,e))},c.Cancel=n("7a77"),c.CancelToken=n("8df4"),c.isCancel=n("2e67"),c.all=function(e){return Promise.all(e)},c.spread=n("0df6"),e.exports=c,e.exports.default=c},d049:function(e,t,n){(function(e){!function(e,n){n(t)}(0,(function(t){"use strict";var n="undefined"!=typeof window?window:void 0!==e?e:"undefined"!=typeof self?self:{};function r(e,t){return e(t={exports:{}},t.exports),t.exports}var i=r((function(e){!function(){var t,r,i,o=null,a="object"==typeof window,s=a?window:n,c=s.Promise,l=s.process,u=s.console,f=!1,d=Array,p=Error,h=1,v=2,g=3,m="Symbol",b="iterator",y="species",w=m+"("+y+")",A="return",x="_uh",E="_pt",C="_st",k="Invalid this",S="Invalid argument",O="\nFrom previous ",_="Chaining cycle detected for promise",T="Uncaught (in promise)",I="rejectionHandled",j="unhandledRejection",B={e:o},M=function(){},P=/^.+\/node_modules\/yaku\/.+\n?/gm,R=function(e){var n,r=this;if(!F(r)||r._s!==t)throw W(k);if(r._s=g,f&&(r[E]=G()),e!==M){if(!V(e))throw W(S);(n=H(e)(ee(r,v),ee(r,h)))===B&&oe(r,h,n.e)}};function N(){return R[m][y]||w}function D(e,t){for(var n in t)e[n]=t[n]}function F(e){return e&&"object"==typeof e}function V(e){return"function"==typeof e}function U(e,t){return e instanceof t}function L(e){return U(e,p)}function q(e,t,n){if(!t(e))throw W(n)}function Q(){try{return r.apply(i,arguments)}catch(e){return B.e=e,B}}function H(e,t){return r=e,i=t,Q}function J(e,n){var r=d(e),i=0;function o(){for(var o=0;o<i;)n(r[o],r[o+1]),r[o++]=t,r[o++]=t;i=0,r.length>e&&(r.length=e)}return function(e,t){r[i++]=e,r[i++]=t,2===i&&R.nextTick(o)}}function z(e,t){var n,r,i,o,a=0;if(!e)throw W(S);var s=e[R[m][b]];if(V(s))r=s.call(e);else{if(!V(e.next)){if(U(e,d)){for(n=e.length;a<n;)t(e[a],a++);return a}throw W(S)}r=e}for(;!(i=r.next()).done;)if((o=H(t)(i.value,a++))===B)throw V(r[A])&&r[A](),o.e;return a}function W(e){return new TypeError(e)}function G(e){return(e?"":O)+(new p).stack}R.default=R,D(R.prototype,{then:function(e,t){if(void 0===this._s)throw W();return te(this,$(R.speciesConstructor(this,R)),e,t)},catch:function(e){return this.then(t,e)},finally:function(e){return this.then((function(t){return R.resolve(e()).then((function(){return t}))}),(function(t){return R.resolve(e()).then((function(){throw t}))}))},_c:0,_p:o}),R.resolve=function(e){return Z(e)?e:ae($(this),e)},R.reject=function(e){return oe($(this),h,e)},R.race=function(e){var t=this,n=$(t),r=function(e){oe(n,v,e)},i=function(e){oe(n,h,e)},o=H(z)(e,(function(e){t.resolve(e).then(r,i)}));return o===B?t.reject(o.e):n},R.all=function(e){var t,n=this,r=$(n),i=[];function o(e){oe(r,h,e)}return(t=H(z)(e,(function(e,a){n.resolve(e).then((function(e){i[a]=e,--t||oe(r,v,i)}),o)})))===B?n.reject(t.e):(t||oe(r,v,[]),r)},R.Symbol=s[m]||{},H((function(){Object.defineProperty(R,N(),{get:function(){return this}})}))(),R.speciesConstructor=function(e,t){var n=e.constructor;return n&&n[N()]||t},R.unhandledRejection=function(e,t){u&&u.error(T,f?t.longStack:re(e,t))},R.rejectionHandled=M,R.enableLongStackTrace=function(){f=!0},R.nextTick=a?function(e){c?new c((function(e){e()})).then(e):setTimeout(e)}:l.nextTick,R._s=1;var X=J(999,(function(e,n){var r,i;(i=e._s!==h?n._onFulfilled:n._onRejected)!==t?(r=H(ie)(i,e._v))!==B?ae(n,r):oe(n,h,r.e):oe(n,e._s,e._v)})),K=J(9,(function(e){ne(e)||(e[x]=1,Y(j,e))}));function Y(e,t){var n="on"+e.toLowerCase(),r=s[n];l&&l.listeners(e).length?e===j?l.emit(e,t._v,t):l.emit(e,t):r?r({reason:t._v,promise:t}):R[e](t._v,t)}function Z(e){return e&&e._s}function $(e){return Z(e)?new e(M):(t=new e((function(e,i){if(t)throw W();n=e,r=i})),q(n,V),q(r,V),t);var t,n,r}function ee(e,t){var n=!1;return function(r){n||(n=!0,f&&(e[C]=G(!0)),t===v?ae(e,r):oe(e,t,r))}}function te(e,t,n,r){return V(n)&&(t._onFulfilled=n),V(r)&&(e[x]&&Y(I,e),t._onRejected=r),f&&(t._p=e),e[e._c++]=t,e._s!==g&&X(e,t),t}function ne(e){if(e._umark)return!0;e._umark=!0;for(var t,n=0,r=e._c;n<r;)if((t=e[n++])._onRejected||ne(t))return!0}function re(e,t){var n=[];function r(e){return n.push(e.replace(/^\s+|\s+$/g,""))}return f&&(t[C]&&r(t[C]),function e(t){t&&E in t&&(e(t._next),r(t[E]+""),e(t._p))}(t)),(e&&e.stack?e.stack:e)+("\n"+n.join("\n")).replace(P,"")}function ie(e,t){return e(t)}function oe(e,t,n){var r=0,i=e._c;if(e._s===g)for(e._s=t,e._v=n,t===h&&(f&&L(n)&&(n.longStack=re(n,e)),K(e));r<i;)X(e,e[r++]);return e}function ae(e,t){if(t===e&&t)return oe(e,h,W(_)),e;if(t!==o&&(V(t)||F(t))){var n=H(se)(t);if(n===B)return oe(e,h,n.e),e;V(n)?(f&&Z(t)&&(e._next=t),Z(t)?ce(e,t,n):R.nextTick((function(){ce(e,t,n)}))):oe(e,v,t)}else oe(e,v,t);return e}function se(e){return e.then}function ce(e,t,n){var r=H(n,t)((function(n){t&&(t=o,ae(e,n))}),(function(n){t&&(t=o,oe(e,h,n))}));r===B&&t&&(oe(e,h,r.e),t=o)}try{e.exports=R}catch(e){s.Yaku=R}}()})),o=Object.freeze({__proto__:null,default:i,__moduleExports:i}),a=o&&i||o;function s(){var e=navigator.userAgent;return!(!/ OS \d/.test(e)||~e.indexOf("CriOS")||e.indexOf("Mozilla")||!/Safari\/[\d\.]+$/.test(e))}function c(){window.selfBrowser={version:function(){var e=navigator.userAgent;return{mobile:/AppleWebKit.*Mobile.*/i.test(e),ios:/\(i[^;]+;( U;)? CPU.+Mac OS X/i.test(e),android:/Android/i.test(e)||/Linux/i.test(e),windowsphone:/Windows Phone/i.test(e),iPhone:/iPhone/i.test(e),iPad:/iPad/i.test(e),webApp:!/Safari/i.test(e),MicroMessenger:/MicroMessenger/i.test(e),weibo:/Weibo/i.test(e),uc:/UCBrowser/i.test(e),qq:/MQQBrowser/i.test(e),baidu:/Baidu/i.test(e),mqq:/QQ\/([\d\.]+)/i.test(e),mbaidu:/baiduboxapp/i.test(e),iqiyi:/iqiyi/i.test(e),QQLive:/QQLive/i.test(e),Safari:s(),Youku:/youku/i.test(e),chrome:/CriOS/i.test(e),CMDC:/CMDC/i.test(e),BiliApp:/BiliApp|BiliComic/i.test(e)}}(),language:(navigator.browserLanguage||navigator.language).toLowerCase()}}function l(e){for(var t in e)e.hasOwnProperty(t)&&"function"==typeof e[t]&&"callback"!==t&&(window.BiliJsBridge.callbacks.push({callbackId:window.BiliJsBridge.selfCallbackId,callback:e[t]}),e[t]="",e.data[t+"CallbackId"]=window.BiliJsBridge.selfCallbackId++)}function u(e){window.BiliJsBridge.biliInject.biliCallbackReceived||(window.BiliJsBridge.biliInject.biliCallbackReceived=function(e,t,n){var r=window.BiliJsBridge.callbacks.map((function(e){return e.callbackId})).indexOf(Number(e));r>=0&&window.BiliJsBridge.callbacks[r].callback&&window.BiliJsBridge.callbacks[r].callback(n||t)});var t=void 0;t=window.BiliJsBridge.biliInject&&"function"==typeof window.BiliJsBridge.biliInject.postMessage?window.BiliJsBridge.biliInject.postMessage.bind(window.BiliJsBridge.biliInject):function(){},l(e),window.BiliJsBridge.callbacks.push({callbackId:window.BiliJsBridge.selfCallbackId,callback:e.callback}),window.selfBrowser.version.android?t(JSON.stringify({method:e.method,data:Object.assign(e.data,{callbackId:window.BiliJsBridge.selfCallbackId++})})):t({method:e.method,data:JSON.stringify(Object.assign(e.data,{callbackId:window.BiliJsBridge.selfCallbackId++}))})}function f(e){e.forEach((function(e){u(e)})),window.BiliJsBridge.sendTasks=[]}"undefined"!=typeof window&&(window.Promise||(window.Promise=a)),"function"!=typeof Object.assign&&Object.defineProperty(Object,"assign",{value:function(e,t){if(null==e)throw new TypeError("Cannot convert undefined or null to object");for(var n=Object(e),r=1;r<arguments.length;r++){var i=arguments[r];if(null!=i)for(var o in i)Object.prototype.hasOwnProperty.call(i,o)&&(n[o]=i[o])}return n},writable:!0,configurable:!0}),"undefined"!=typeof window&&(window.selfBrowser||c(),window.BiliJsBridge||(window.BiliJsBridge={sendTasks:[],callbacks:[],biliInject:null,selfCallbackId:1,inited:!1,newVersion:!1}));var d={callNative:function(e){if((e=e||{}).data=e.data||{},!e.method)throw new Error("no method");window.BiliJsBridge.inited?window.BiliJsBridge.newVersion&&u(e):window.BiliJsBridge.sendTasks.push(e)}};function p(){return window.biliInject||window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.biliInject}function h(){return new Promise((function(e,t){if(p())t();else if(window.selfBrowser.version.ios)var n=setInterval((function(){p()&&(t(),clearInterval(n))}),1e3);else setTimeout((function(){p()&&t()}),2e3)})).catch((function(){window.BiliJsBridge.biliInject=p(),window.BiliJsBridge.newVersion=!0,window.BiliJsBridge.inited=!0,f(window.BiliJsBridge.sendTasks)}))}function v(e){return new Promise((function(t,n){d.callNative({method:"global.getAllSupport",callback:function(n){n.indexOf(e)>=0?t(!0):t(!1)}})}))}function g(){h()}var m={initEnv:g,biliBridge:d,isSupport:v,isNewJsBridge:p,inBiliApp:"undefined"!=typeof window&&window.selfBrowser.version.BiliApp},b=m.initEnv,y=m.biliBridge,w=m.isSupport,A=m.isNewJsBridge,x=m.inBiliApp;t.biliBridge=y,t.default=m,t.inBiliApp=x,t.initEnv=b,t.isNewJsBridge=A,t.isSupport=w,Object.defineProperty(t,"__esModule",{value:!0})}))}).call(this,n("c8ba"))},d233:function(e,t,n){"use strict";var r=Object.prototype.hasOwnProperty,i=Array.isArray,o=function(){for(var e=[],t=0;t<256;++t)e.push("%"+((t<16?"0":"")+t.toString(16)).toUpperCase());return e}(),a=function(e){for(;e.length>1;){var t=e.pop(),n=t.obj[t.prop];if(i(n)){for(var r=[],o=0;o<n.length;++o)void 0!==n[o]&&r.push(n[o]);t.obj[t.prop]=r}}},s=function(e,t){for(var n=t&&t.plainObjects?Object.create(null):{},r=0;r<e.length;++r)void 0!==e[r]&&(n[r]=e[r]);return n},c=function e(t,n,o){if(!n)return t;if("object"!=typeof n){if(i(t))t.push(n);else{if(!t||"object"!=typeof t)return[t,n];(o&&(o.plainObjects||o.allowPrototypes)||!r.call(Object.prototype,n))&&(t[n]=!0)}return t}if(!t||"object"!=typeof t)return[t].concat(n);var a=t;return i(t)&&!i(n)&&(a=s(t,o)),i(t)&&i(n)?(n.forEach((function(n,i){if(r.call(t,i)){var a=t[i];a&&"object"==typeof a&&n&&"object"==typeof n?t[i]=e(a,n,o):t.push(n)}else t[i]=n})),t):Object.keys(n).reduce((function(t,i){var a=n[i];return r.call(t,i)?t[i]=e(t[i],a,o):t[i]=a,t}),a)},l=function(e,t){return Object.keys(t).reduce((function(e,n){return e[n]=t[n],e}),e)},u=function(e,t,n){var r=e.replace(/\+/g," ");if("iso-8859-1"===n)return r.replace(/%[0-9a-f]{2}/gi,unescape);try{return decodeURIComponent(r)}catch(e){return r}},f=function(e,t,n){if(0===e.length)return e;var r=e;if("symbol"==typeof e?r=Symbol.prototype.toString.call(e):"string"!=typeof e&&(r=String(e)),"iso-8859-1"===n)return escape(r).replace(/%u[0-9a-f]{4}/gi,(function(e){return"%26%23"+parseInt(e.slice(2),16)+"%3B"}));for(var i="",a=0;a<r.length;++a){var s=r.charCodeAt(a);45===s||46===s||95===s||126===s||s>=48&&s<=57||s>=65&&s<=90||s>=97&&s<=122?i+=r.charAt(a):s<128?i+=o[s]:s<2048?i+=o[192|s>>6]+o[128|63&s]:s<55296||s>=57344?i+=o[224|s>>12]+o[128|s>>6&63]+o[128|63&s]:(a+=1,s=65536+((1023&s)<<10|1023&r.charCodeAt(a)),i+=o[240|s>>18]+o[128|s>>12&63]+o[128|s>>6&63]+o[128|63&s])}return i},d=function(e){for(var t=[{obj:{o:e},prop:"o"}],n=[],r=0;r<t.length;++r)for(var i=t[r],o=i.obj[i.prop],s=Object.keys(o),c=0;c<s.length;++c){var l=s[c],u=o[l];"object"==typeof u&&null!==u&&-1===n.indexOf(u)&&(t.push({obj:o,prop:l}),n.push(u))}return a(t),e},p=function(e){return"[object RegExp]"===Object.prototype.toString.call(e)},h=function(e){return!(!e||"object"!=typeof e||!(e.constructor&&e.constructor.isBuffer&&e.constructor.isBuffer(e)))},v=function(e,t){return[].concat(e,t)},g=function(e,t){if(i(e)){for(var n=[],r=0;r<e.length;r+=1)n.push(t(e[r]));return n}return t(e)};e.exports={arrayToObject:s,assign:l,combine:v,compact:d,decode:u,encode:f,isBuffer:h,isRegExp:p,maybeMap:g,merge:c}},d925:function(e,t,n){"use strict";e.exports=function(e){return/^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e)}},df7c:function(e,t,n){(function(e){function n(e,t){for(var n=0,r=e.length-1;r>=0;r--){var i=e[r];"."===i?e.splice(r,1):".."===i?(e.splice(r,1),n++):n&&(e.splice(r,1),n--)}if(t)for(;n--;n)e.unshift("..");return e}function r(e){"string"!=typeof e&&(e+="");var t,n=0,r=-1,i=!0;for(t=e.length-1;t>=0;--t)if(47===e.charCodeAt(t)){if(!i){n=t+1;break}}else-1===r&&(i=!1,r=t+1);return-1===r?"":e.slice(n,r)}function i(e,t){if(e.filter)return e.filter(t);for(var n=[],r=0;r<e.length;r++)t(e[r],r,e)&&n.push(e[r]);return n}t.resolve=function(){for(var t="",r=!1,o=arguments.length-1;o>=-1&&!r;o--){var a=o>=0?arguments[o]:e.cwd();if("string"!=typeof a)throw new TypeError("Arguments to path.resolve must be strings");a&&(t=a+"/"+t,r="/"===a.charAt(0))}return(r?"/":"")+(t=n(i(t.split("/"),(function(e){return!!e})),!r).join("/"))||"."},t.normalize=function(e){var r=t.isAbsolute(e),a="/"===o(e,-1);return(e=n(i(e.split("/"),(function(e){return!!e})),!r).join("/"))||r||(e="."),e&&a&&(e+="/"),(r?"/":"")+e},t.isAbsolute=function(e){return"/"===e.charAt(0)},t.join=function(){var e=Array.prototype.slice.call(arguments,0);return t.normalize(i(e,(function(e,t){if("string"!=typeof e)throw new TypeError("Arguments to path.join must be strings");return e})).join("/"))},t.relative=function(e,n){function r(e){for(var t=0;t<e.length&&""===e[t];t++);for(var n=e.length-1;n>=0&&""===e[n];n--);return t>n?[]:e.slice(t,n-t+1)}e=t.resolve(e).substr(1),n=t.resolve(n).substr(1);for(var i=r(e.split("/")),o=r(n.split("/")),a=Math.min(i.length,o.length),s=a,c=0;c<a;c++)if(i[c]!==o[c]){s=c;break}var l=[];for(c=s;c<i.length;c++)l.push("..");return(l=l.concat(o.slice(s))).join("/")},t.sep="/",t.delimiter=":",t.dirname=function(e){if("string"!=typeof e&&(e+=""),0===e.length)return".";for(var t=e.charCodeAt(0),n=47===t,r=-1,i=!0,o=e.length-1;o>=1;--o)if(47===(t=e.charCodeAt(o))){if(!i){r=o;break}}else i=!1;return-1===r?n?"/":".":n&&1===r?"/":e.slice(0,r)},t.basename=function(e,t){var n=r(e);return t&&n.substr(-1*t.length)===t&&(n=n.substr(0,n.length-t.length)),n},t.extname=function(e){"string"!=typeof e&&(e+="");for(var t=-1,n=0,r=-1,i=!0,o=0,a=e.length-1;a>=0;--a){var s=e.charCodeAt(a);if(47!==s)-1===r&&(i=!1,r=a+1),46===s?-1===t?t=a:1!==o&&(o=1):-1!==t&&(o=-1);else if(!i){n=a+1;break}}return-1===t||-1===r||0===o||1===o&&t===r-1&&t===n+1?"":e.slice(t,r)};var o=function(e,t,n){return e.substr(t,n)}}).call(this,n("4362"))},e683:function(e,t,n){"use strict";e.exports=function(e,t){return t?e.replace(/\/+$/,"")+"/"+t.replace(/^\/+/,""):e}},f6b4:function(e,t,n){"use strict";var r=n("c532");function i(){this.handlers=[]}i.prototype.use=function(e,t){return this.handlers.push({fulfilled:e,rejected:t}),this.handlers.length-1},i.prototype.eject=function(e){this.handlers[e]&&(this.handlers[e]=null)},i.prototype.forEach=function(e){r.forEach(this.handlers,(function(t){null!==t&&e(t)}))},e.exports=i},fb15:function(e,t,n){"use strict";if(n.r(t),"undefined"!=typeof window){var r=window.document.currentScript,i=n("8875");r=i(),"currentScript"in document||Object.defineProperty(document,"currentScript",{get:i});var o=r&&r.src.match(/(.+\/)[^/]+\.js(\?.*)?$/);o&&(n.p=o[1])}var a=n("d049"),s=n("bc3a"),c=n.n(s),l=n("4328"),u=n.n(l),f=n("9224"),d="undefined"==typeof window,p=function(e){return"[object Array]"===Object.prototype.toString.call(e)},h=!!d||/android/i.test(window.navigator.userAgent),v=function(e){var t="";if(d)return t;var n=document.cookie;if(!n)return t;for(var r=n.split(";"),i=new RegExp("^".concat(e,"=")),o=0;o<r.length;o++){var a=r[o].trim();if(i.test(a)){t=a.split("=")[1];break}}return t},g=!d&&window.parent!==window.self,m={json:"application/json",form:"application/x-www-form-urlencoded"};function b(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function y(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?b(Object(n),!0).forEach((function(t){w(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):b(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function w(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function A(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function x(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function E(e,t,n){return t&&x(e.prototype,t),n&&x(e,n),e}var C=function(){function e(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};A(this,e),a.inBiliApp&&Object(a.initEnv)(),this.appKey=t.appKey||"",this.csrfKey=void 0===t.csrfKey?"csrf":t.csrfKey,this.defaultError=t.defaultError||{code:500,message:"网络错误"},this.usePolicy=t.useCookie?"0":"1",this.timeout=t.timeout||1e4,this.baseUrl=t.baseUrl||t.baseURL||"",this.fallback=!1!==t.oldAppUseAxios,this.newAppUseV2=!!t.newAppUseV2,this.onlyUseV2Bridge=!!t.onlyUseV2Bridge,this.qsConfig=t.qsConfig||{},this.transformResponse=t.transformResponse||null,this.transformRequest=t.transformRequest||null,this.handleSuccess=t.handleSuccess||null,this.handleError=t.handleError||null,this.transformHeaders=t.transformHeaders||null,this.autoInjectDevice=!!t.autoInjectDevice,this.debug=t.debug||!1,this.deviceInfo=null,this._parseUA(),this._detectBridgeIsV7(),this._detectBridgeIsV6(),this._detectBridgeIsV5(),this._detectBridgeIsV4(),this._detectBridgeIsV3(),this._detectBridgeIsV2(),this._detectBridgeIsV1(),this._getCsrfToken(),this.axios=this._initAxios()}return E(e,[{key:"get",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return this._prefetch("GET",{href:e,data:t,config:n})}},{key:"post",value:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"",t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};return this._prefetch("POST",{href:e,data:t,config:n})}},{key:"device",value:function(){var e=this;return new Promise((function(t){if(e.deviceInfo)return t(e.deviceInfo);if(!a.inBiliApp){var n={buvid:v("buvid3")};return e.deviceInfo=n,t(y({},n))}a.biliBridge.callNative({method:"global.getContainerInfo",callback:function(n){e.deviceInfo=y(y({},n),{},{device_id:n.fingerprint,build:n.build,buvid:n.buvid,device_name:decodeURIComponent(n.deviceName),device_platform:h?n.devicePlatform:n.modelName,local_id:n.buvid,bili_local_id:n.localFingerprint}),t(e.deviceInfo)}})}))}},{key:"user",value:function(){var e=this;return new Promise((function(t,n){a.inBiliApp?a.biliBridge.callNative({method:"auth.getUserInfo",data:{type:"default"},callback:function(e){try{if("0"===e.state.toString())return void t(null);t({id:e.mid,avatar:e.face,nickname:e.userName})}catch(e){n(e)}}}):e.get("https://api.bilibili.com/x/web-interface/nav").then((function(e){-101!==e.code?e.code?n(e):e.data.isLogin?t({id:e.data.mid,avatar:e.data.face,nickname:e.data.uname}):t(null):t(null)})).catch(n)}))}},{key:"_prefetch",value:function(e,t){var n=this;return this.autoInjectDevice?new Promise((function(r,i){n.device().then((function(o){var a;p(n.autoInjectDevice)?n.autoInjectDevice.forEach((function(e){o[e]&&(a[e]=o[e])})):a=o,n._request(e,{href:t.href,data:y(y({},a),t.data),config:t.config}).then(r).catch(i)})).catch((function(){n._request(e,t).then(r).catch(i)}))})):this._request(e,t)}},{key:"_request",value:function(e,t){var n=this,r=t.href,i=t.data,o=t.config;this._debug({inBiliApp:a.inBiliApp,bridgeIsV1:this.bridgeIsV1,bridgeIsV2:this.bridgeIsV2,bridgeIsV3:this.bridgeIsV3,bridgeIsV4:this.bridgeIsV4,bridgeIsV5:this.bridgeIsV5,bridgeIsV6:this.bridgeIsV6,fallback:this.fallback,usePolicy:this.usePolicy,csrfToken:this.csrfToken,version:f.version});var s=this._formatUrl(r,e),c="POST"===e;i=this._requestParamsAppend(i,e);var l=function(){var t=y(y({},o),{},{url:s,method:e});return c?t.data=i:t.params=i,n.axios(t)},d="0"===this.usePolicy;if(o.xhr||!this.csrfKey||!a.inBiliApp||this.bridgeIsV1||g&&!h||!this.bridgeIsV1&&!this.bridgeIsV2&&!this.bridgeIsV3&&!this.birdgeIsV6&&this.fallback||!this.bridgeIsV6&&this.onlyUseV2Bridge||d&&this.bridgeIsV5||d&&this.bridgeIsV1)return l();var p=y(y({},o),{},{method:e,timeout:(o.timeout||this.timeout)/1e3,header:{}});this.csrfKey&&!this.bridgeIsV6&&(p.csrfKey=this.csrfKey);var v,b=function(e,t){return e>t?1:-1},w=function(){c?(p.url=s,p.data=n._appParamsSerialize(i,o)):p.url=Object.keys(i).length?"".concat(s).concat(/\?/.test(s)?"&":"?").concat(u.a.stringify(i,{sort:b})):s};if(this.bridgeIsV6?(v=d?"net.requestV2":"net.requestWithSignV2",w()):this.bridgeIsV3?(v="net.requestWithSign",p.url=s,p.params=i):(v="net.request",p.policy=this.usePolicy,w()),p.header={"Content-Type":o.headers&&o.headers["Content-Type"]||(c?m.form:m.json),"User-Agent":window.navigator.userAgent,Referer:window.location.href},this.transformHeaders){var A=p.header;p.header=y(y({},A),this.transformHeaders(y(y({},p),{},{headers:A}))||{})}return!c||p.header["Content-Type"]!==m.json||this.bridgeIsV6&&d?new Promise((function(e,t){if(!n.bridgeIsV1&&!n.bridgeIsV2&&!n.bridgeIsV3){var r={code:-1,message:"请使用新版本的客户端"};return n.handleError&&n.handleError(r),void t(r)}var i=function(e){n._debug({on:"callback",message:e}),n._getCsrfToken()},o=function(r){var i=r.response,o=r.httpStatus;if(n._debug({on:"load",message:{response:i,httpStatus:o}}),o<200||o>=400){var a=y(y({},n.defaultError),{},{code:o});return n.handleError&&n.handleError(a),t(a)}try{var s,c="string"==typeof i;s=n.transformResponse?"string"==typeof(s=n.transformResponse(c?i:JSON.stringify(i)))?JSON.parse(s):s:c?JSON.parse(i):i,n.handleSuccess&&n.handleSuccess(s),e(s)}catch(e){n._debug({on:"catch",message:e}),n.handleError&&n.handleError(n.defaultError),t(n.defaultError)}};n._debug({on:"call",message:{method:v,data:p}}),a.biliBridge.callNative({method:v,data:p,callback:i,onLoad:o})})):l()}},{key:"_getCsrfToken",value:function(){var e=this;this.csrfToken=v("bili_jct"),Object(a.isSupport)("net.getCsrf").then((function(t){t&&a.biliBridge.callNative({method:"net.getCsrf",callback:function(t){e.csrfToken=t.csrf}})}))}},{key:"_initAxios",value:function(){var e=this,t=c.a.create({timeout:this.timeout});t.defaults.withCredentials=!0;var n=function(t){var n=t.response&&t.response.status||500,r=y(y({},e.defaultError),{},{code:n});return e.handleError&&e.handleError(r),Promise.reject(r)};return t.interceptors.response.use((function(t){return t&&t.data?(e.handleSuccess&&e.handleSuccess(t.data),t.data):Promise.reject(e.defaultError)}),(function(e){return n(e)})),t.interceptors.request.use((function(t){if("post"===t.method&&(t.headers["Content-Type"]||(t.headers["Content-Type"]=m.form),t.data=e._stringifyData(t.data,!0,!0)),e.transformHeaders){var n=t.headers;t.headers=y(y({},n),e.transformHeaders(y({},t))||{})}return t}),(function(e){return n(e)})),this.transformResponse&&(t.defaults.transformResponse=[function(t){return e.transformResponse(t)}]),t}},{key:"_debug",value:function(e){this.debug&&console.log("bili-app-ajax",e)}},{key:"_appParamsSerialize",value:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};if(this.bridgeIsV1){var n={},r={};Object.keys(e).forEach((function(t){/(pwd|password|seccode)/.test(t)?r[t]=e[t]:n[t]=e[t]}));var i=this._stringifyData(n);return i+(i?"&":"")+this._stringifyData(r,!1)}return this._stringifyData(e,!1!==t.eocnde,!0)}},{key:"_requestParamsAppend",value:function(e,t){var n=this._appendParamsCSRF(e);return!a.inBiliApp&&this.appKey&&(n.appkey=this.appKey),!this.bridgeIsV4||h||this.bridgeIsV7||Object.keys(n).length||"POST"!==t||(n._bridge_v4_fixed_="1"),this.transformRequest?this.transformRequest(n)||{}:n}},{key:"_stringifyData",value:function(e){var t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];return arguments.length>2&&void 0!==arguments[2]&&arguments[2]&&this.qsConfig.jsonStringify?JSON.stringify(e):u.a.stringify(e,y(y({},this.qsConfig),{},{encode:t}))}},{key:"_appendParamsCSRF",value:function(e){return this.bridgeIsV4&&!this.bridgeIsV5&&h||this.bridgeIsV5&&"1"===this.usePolicy?y({},e):this.csrfToken&&this.csrfKey?y(w({},this.csrfKey,this.csrfToken),e):y({},e)}},{key:"_formatUrl",value:function(e,t){var n=e;return/^\/\//.test(n)?n="https:".concat(e):/^http/.test(e)||(n="".concat(this.baseUrl).concat(e)),/^\/\//.test(n)&&(n="https:".concat(n)),"GET"!==t||!this.bridgeIsV4||this.bridgeIsV7||h||/\?/.test(n)||(n="".concat(n,"?_bridge_v4_fixed_=1")),n}},{key:"_parseUA",value:function(){var e=window.navigator.userAgent.split(" "),t=0,n="";e.forEach((function(e){/^biliapp/i.test(e)?t=+e.split("/")[1]:/^mobi_app/i.test(e)?n=e.split("/")[1]:/^bilicomic/i.test(e)&&(t=+e.split("/")[1])})),this.appVersion=t,this.appDevice=n}},{key:"_detectBridgeIsV1",value:function(){var e=this;if(this.bridgeIsV1=!1,!d&&a.inBiliApp&&!this.bridgeIsV2)try{var t=this.appDevice,n=this.appVersion;if(this.bridgeIsV1="android_i"===t||"android_comic"===t&&n>=214e5,"iphone"===t&&n<8930||"ipad"===t&&n<12350||"iphone_b"===t&&n<8110)return void(this.bridgeIsV1=!1);Object(a.isSupport)("net.request").then((function(t){e.bridgeIsV1=t}))}catch(e){}}},{key:"_detectBridgeIsV2",value:function(){var e=this;if(this.bridgeIsV2=!1,!d&&a.inBiliApp)try{var t=this.appDevice,n=this.appVersion;this.bridgeIsV2="iphone_i"===t&&n>=1e4||"android_i"===t&&n>=2050400||"android"===t&&n>551e4||"android_b"===t&&n>=535e4||"iphone"===t&&n>8960||"ipad"===t&&n>12300||"iphone_b"===t&&n>8990||"android_comic"===t&&n>=2161e4||"android_bbs"===t&&n>=1000200,this.bridgeIsV2&&Object(a.isSupport)("net.request").then((function(t){e.bridgeIsV2=t}))}catch(e){}}},{key:"_detectBridgeIsV3",value:function(){var e=this;if(this.bridgeIsV3=!1,!d&&a.inBiliApp&&!h&&"iphone_comic"===this.appDevice)try{Object(a.isSupport)("net.requestWithSign").then((function(t){e.bridgeIsV3=t}))}catch(e){}}},{key:"_detectBridgeIsV4",value:function(){if(this.bridgeIsV4=!1,!this.bridgeIsV6)try{var e=this.appDevice,t=this.appVersion;this.bridgeIsV4="iphone"===e&&t>1e4||"iphone_i"===e&&t>=1e4||"iphone_b"===e&&t>9360||"ipad"===e&&t>12390||"android"===e&&t>=601e4||"android_b"===e&&t>=541e4||"android_bbs"===e&&t>=1000200}catch(e){}}},{key:"_detectBridgeIsV5",value:function(){this.bridgeIsV5=!1;try{var e=this.appDevice,t=this.appVersion;this.bridgeIsV5="android"===e&&t>=6060100&&t<=6060210}catch(e){}}},{key:"_detectBridgeIsV6",value:function(){var e=this;if(this.bridgeIsV6=!1,this.newAppUseV2)try{var t=this.appDevice,n=this.appVersion;this.bridgeIsV6="android"===t&&n>=607e4||"iphone"===t&&n>10170||"iphone_b"===t&&n>10200||"ipad"===t&&n>12410,this.bridgeIsV6&&Object(a.isSupport)("net.getCsrf").then((function(t){e.bridgeIsV6=t}))}catch(e){}}},{key:"_detectBridgeIsV7",value:function(){this.bridgeIsV7=!1;try{var e=this.appDevice,t=this.appVersion;this.bridgeIsV7="iphone"===e&&t>=10030||"iphone_b"===e&&t>=10030||"ipad"===e&&t>=12420}catch(e){}}}]),e}();t.default=C}})},937:function(e,t,n){!function(e){"use strict";var t="undefined"!=typeof window?window:void 0!==n.g?n.g:"undefined"!=typeof self?self:{};function r(e,t){return e(t={exports:{}},t.exports),t.exports}var i=r((function(e){!function(){var n,r,i,o=null,a="object"==typeof window,s=a?window:t,c=s.Promise,l=s.process,u=s.console,f=!1,d=Array,p=Error,h=1,v=2,g=3,m="Symbol",b="iterator",y="species",w=m+"("+y+")",A="return",x="_uh",E="_pt",C="_st",k="Invalid this",S="Invalid argument",O="\nFrom previous ",_="Chaining cycle detected for promise",T="Uncaught (in promise)",I="rejectionHandled",j="unhandledRejection",B={e:o},M=function(){},P=/^.+\/node_modules\/yaku\/.+\n?/gm,R=function(e){var t,r=this;if(!F(r)||r._s!==n)throw W(k);if(r._s=g,f&&(r[E]=G()),e!==M){if(!V(e))throw W(S);(t=H(e)(ee(r,v),ee(r,h)))===B&&oe(r,h,t.e)}};function N(){return R[m][y]||w}function D(e,t){for(var n in t)e[n]=t[n]}function F(e){return e&&"object"==typeof e}function V(e){return"function"==typeof e}function U(e,t){return e instanceof t}function L(e){return U(e,p)}function q(e,t,n){if(!t(e))throw W(n)}function Q(){try{return r.apply(i,arguments)}catch(e){return B.e=e,B}}function H(e,t){return r=e,i=t,Q}function J(e,t){var r=d(e),i=0;function o(){for(var o=0;o<i;)t(r[o],r[o+1]),r[o++]=n,r[o++]=n;i=0,r.length>e&&(r.length=e)}return function(e,t){r[i++]=e,r[i++]=t,2===i&&R.nextTick(o)}}function z(e,t){var n,r,i,o,a=0;if(!e)throw W(S);var s=e[R[m][b]];if(V(s))r=s.call(e);else{if(!V(e.next)){if(U(e,d)){for(n=e.length;a<n;)t(e[a],a++);return a}throw W(S)}r=e}for(;!(i=r.next()).done;)if((o=H(t)(i.value,a++))===B)throw V(r[A])&&r[A](),o.e;return a}function W(e){return new TypeError(e)}function G(e){return(e?"":O)+(new p).stack}R.default=R,D(R.prototype,{then:function(e,t){if(void 0===this._s)throw W();return te(this,$(R.speciesConstructor(this,R)),e,t)},catch:function(e){return this.then(n,e)},finally:function(e){return this.then((function(t){return R.resolve(e()).then((function(){return t}))}),(function(t){return R.resolve(e()).then((function(){throw t}))}))},_c:0,_p:o}),R.resolve=function(e){return Z(e)?e:ae($(this),e)},R.reject=function(e){return oe($(this),h,e)},R.race=function(e){var t=this,n=$(t),r=function(e){oe(n,v,e)},i=function(e){oe(n,h,e)},o=H(z)(e,(function(e){t.resolve(e).then(r,i)}));return o===B?t.reject(o.e):n},R.all=function(e){var t,n=this,r=$(n),i=[];function o(e){oe(r,h,e)}return(t=H(z)(e,(function(e,a){n.resolve(e).then((function(e){i[a]=e,--t||oe(r,v,i)}),o)})))===B?n.reject(t.e):(t||oe(r,v,[]),r)},R.Symbol=s[m]||{},H((function(){Object.defineProperty(R,N(),{get:function(){return this}})}))(),R.speciesConstructor=function(e,t){var n=e.constructor;return n&&n[N()]||t},R.unhandledRejection=function(e,t){u&&u.error(T,f?t.longStack:re(e,t))},R.rejectionHandled=M,R.enableLongStackTrace=function(){f=!0},R.nextTick=a?function(e){c?new c((function(e){e()})).then(e):setTimeout(e)}:l.nextTick,R._s=1;var X=J(999,(function(e,t){var r,i;(i=e._s!==h?t._onFulfilled:t._onRejected)!==n?(r=H(ie)(i,e._v))!==B?ae(t,r):oe(t,h,r.e):oe(t,e._s,e._v)})),K=J(9,(function(e){ne(e)||(e[x]=1,Y(j,e))}));function Y(e,t){var n="on"+e.toLowerCase(),r=s[n];l&&l.listeners(e).length?e===j?l.emit(e,t._v,t):l.emit(e,t):r?r({reason:t._v,promise:t}):R[e](t._v,t)}function Z(e){return e&&e._s}function $(e){return Z(e)?new e(M):(t=new e((function(e,i){if(t)throw W();n=e,r=i})),q(n,V),q(r,V),t);var t,n,r}function ee(e,t){var n=!1;return function(r){n||(n=!0,f&&(e[C]=G(!0)),t===v?ae(e,r):oe(e,t,r))}}function te(e,t,n,r){return V(n)&&(t._onFulfilled=n),V(r)&&(e[x]&&Y(I,e),t._onRejected=r),f&&(t._p=e),e[e._c++]=t,e._s!==g&&X(e,t),t}function ne(e){if(e._umark)return!0;e._umark=!0;for(var t,n=0,r=e._c;n<r;)if((t=e[n++])._onRejected||ne(t))return!0}function re(e,t){var n=[];function r(e){return n.push(e.replace(/^\s+|\s+$/g,""))}return f&&(t[C]&&r(t[C]),function e(t){t&&E in t&&(e(t._next),r(t[E]+""),e(t._p))}(t)),(e&&e.stack?e.stack:e)+("\n"+n.join("\n")).replace(P,"")}function ie(e,t){return e(t)}function oe(e,t,n){var r=0,i=e._c;if(e._s===g)for(e._s=t,e._v=n,t===h&&(f&&L(n)&&(n.longStack=re(n,e)),K(e));r<i;)X(e,e[r++]);return e}function ae(e,t){if(t===e&&t)return oe(e,h,W(_)),e;if(t!==o&&(V(t)||F(t))){var n=H(se)(t);if(n===B)return oe(e,h,n.e),e;V(n)?(f&&Z(t)&&(e._next=t),Z(t)?ce(e,t,n):R.nextTick((function(){ce(e,t,n)}))):oe(e,v,t)}else oe(e,v,t);return e}function se(e){return e.then}function ce(e,t,n){var r=H(n,t)((function(n){t&&(t=o,ae(e,n))}),(function(n){t&&(t=o,oe(e,h,n))}));r===B&&t&&(oe(e,h,r.e),t=o)}try{e.exports=R}catch(e){s.Yaku=R}}()})),o=Object.freeze({__proto__:null,default:i,__moduleExports:i}),a=o&&i||o;function s(){var e=navigator.userAgent;return!(!/ OS \d/.test(e)||~e.indexOf("CriOS")||e.indexOf("Mozilla")||!/Safari\/[\d\.]+$/.test(e))}function c(){var e;window.selfBrowser={version:(e=navigator.userAgent,{mobile:/AppleWebKit.*Mobile.*/i.test(e),ios:/\(i[^;]+;( U;)? CPU.+Mac OS X/i.test(e),android:/Android/i.test(e)||/Linux/i.test(e),windowsphone:/Windows Phone/i.test(e),iPhone:/iPhone/i.test(e),iPad:/iPad/i.test(e),webApp:!/Safari/i.test(e),MicroMessenger:/MicroMessenger/i.test(e),weibo:/Weibo/i.test(e),uc:/UCBrowser/i.test(e),qq:/MQQBrowser/i.test(e),baidu:/Baidu/i.test(e),mqq:/QQ\/([\d\.]+)/i.test(e),mbaidu:/baiduboxapp/i.test(e),iqiyi:/iqiyi/i.test(e),QQLive:/QQLive/i.test(e),Safari:s(),Youku:/youku/i.test(e),chrome:/CriOS/i.test(e),CMDC:/CMDC/i.test(e),BiliApp:/BiliApp|BiliComic/i.test(e)}),language:(navigator.browserLanguage||navigator.language).toLowerCase()}}function l(e){for(var t in e)e.hasOwnProperty(t)&&"function"==typeof e[t]&&"callback"!==t&&(window.BiliJsBridge.callbacks.push({callbackId:window.BiliJsBridge.selfCallbackId,callback:e[t]}),e[t]="",e.data[t+"CallbackId"]=window.BiliJsBridge.selfCallbackId++)}function u(e){window.BiliJsBridge.biliInject.biliCallbackReceived||(window.BiliJsBridge.biliInject.biliCallbackReceived=function(e,t,n){var r=window.BiliJsBridge.callbacks.map((function(e){return e.callbackId})).indexOf(Number(e));r>=0&&window.BiliJsBridge.callbacks[r].callback&&window.BiliJsBridge.callbacks[r].callback(n||t)});var t=void 0;t=window.BiliJsBridge.biliInject&&"function"==typeof window.BiliJsBridge.biliInject.postMessage?window.BiliJsBridge.biliInject.postMessage.bind(window.BiliJsBridge.biliInject):function(){},l(e),window.BiliJsBridge.callbacks.push({callbackId:window.BiliJsBridge.selfCallbackId,callback:e.callback}),window.selfBrowser.version.android?t(JSON.stringify({method:e.method,data:Object.assign(e.data,{callbackId:window.BiliJsBridge.selfCallbackId++})})):t({method:e.method,data:JSON.stringify(Object.assign(e.data,{callbackId:window.BiliJsBridge.selfCallbackId++}))})}function f(e){e.forEach((function(e){u(e)})),window.BiliJsBridge.sendTasks=[]}"undefined"!=typeof window&&(window.Promise||(window.Promise=a)),"function"!=typeof Object.assign&&Object.defineProperty(Object,"assign",{value:function(e,t){if(null==e)throw new TypeError("Cannot convert undefined or null to object");for(var n=Object(e),r=1;r<arguments.length;r++){var i=arguments[r];if(null!=i)for(var o in i)Object.prototype.hasOwnProperty.call(i,o)&&(n[o]=i[o])}return n},writable:!0,configurable:!0}),"undefined"!=typeof window&&(window.selfBrowser||c(),window.BiliJsBridge||(window.BiliJsBridge={sendTasks:[],callbacks:[],biliInject:null,selfCallbackId:1,inited:!1,newVersion:!1}));var d={callNative:function(e){if((e=e||{}).data=e.data||{},!e.method)throw new Error("no method");window.BiliJsBridge.inited?window.BiliJsBridge.newVersion&&u(e):window.BiliJsBridge.sendTasks.push(e)}};function p(){return window.biliInject||window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.biliInject}function h(){return new Promise((function(e,t){if(p())t();else if(window.selfBrowser.version.ios)var n=setInterval((function(){p()&&(t(),clearInterval(n))}),1e3);else setTimeout((function(){p()&&t()}),2e3)})).catch((function(){window.BiliJsBridge.biliInject=p(),window.BiliJsBridge.newVersion=!0,window.BiliJsBridge.inited=!0,f(window.BiliJsBridge.sendTasks)}))}function v(e){return new Promise((function(t,n){d.callNative({method:"global.getAllSupport",callback:function(n){n.indexOf(e)>=0?t(!0):t(!1)}})}))}function g(){h()}var m={initEnv:g,biliBridge:d,isSupport:v,isNewJsBridge:p,inBiliApp:"undefined"!=typeof window&&window.selfBrowser.version.BiliApp},b=m.initEnv,y=m.biliBridge,w=m.isSupport,A=m.isNewJsBridge,x=m.inBiliApp;e.biliBridge=y,e.default=m,e.inBiliApp=x,e.initEnv=b,e.isNewJsBridge=A,e.isSupport=w,Object.defineProperty(e,"__esModule",{value:!0})}(t)},672:function(e,t){var n=2654435769;try{String.fromCharCode.apply(String,new Uint8Array([1,2]))}catch(e){!1,Object.defineProperty(Array.prototype,"subarray",{value:Array.prototype.slice})}function r(e,t){var n=e.length,r=n<<2;if(t){var i=e[n-1];if(i<(r-=4)-3||i>r)return null;r=i}for(var o=new Uint8Array(r),a=0;a<r;++a)o[a]=e[a>>2]>>((3&a)<<3);return o}function i(e,t){var n,r=e.length,i=r>>2;0!=(3&r)&&++i,t?(n=new Uint32Array(i+1))[i]=r:n=new Uint32Array(i);for(var o=0;o<r;++o)n[o>>2]|=e[o]<<((3&o)<<3);return n}function o(e){return 4294967295&e}function a(e,t,n,r,i,o){return(n>>>5^t<<2)+(t>>>3^n<<4)^(e^t)+(o[3&r^i]^n)}function s(e){if(e.length<16){var t=new Uint8Array(16);t.set(e),e=t}return e}function c(e){for(var t=e.length,n=new Uint8Array(3*t),r=0,i=0;i<t;i++){var o=e.charCodeAt(i);if(o<128)n[r++]=o;else if(o<2048)n[r++]=192|o>>6,n[r++]=128|63&o;else{if(!(o<55296||o>57343)){if(i+1<t){var a=e.charCodeAt(i+1);if(o<56320&&56320<=a&&a<=57343){var s=65536+((1023&o)<<10|1023&a);n[r++]=240|s>>18,n[r++]=128|s>>12&63,n[r++]=128|s>>6&63,n[r++]=128|63&s,i++;continue}}throw new Error("Malformed string")}n[r++]=224|o>>12,n[r++]=128|o>>6&63,n[r++]=128|63&o}}return n.subarray(0,r)}function l(e){var t=e.length;return 0===t?"":t<65535?function(e,t){for(var n=new Array(t),r=0,i=0,o=e.length;r<t&&i<o;r++){var a=e[i++];switch(a>>4){case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:n[r]=a;break;case 12:case 13:if(!(i<o))throw new Error("Unfinished UTF-8 octet sequence");n[r]=(31&a)<<6|63&e[i++];break;case 14:if(!(i+1<o))throw new Error("Unfinished UTF-8 octet sequence");n[r]=(15&a)<<12|(63&e[i++])<<6|63&e[i++];break;case 15:if(!(i+2<o))throw new Error("Unfinished UTF-8 octet sequence");var s=((7&a)<<18|(63&e[i++])<<12|(63&e[i++])<<6|63&e[i++])-65536;if(!(0<=s&&s<=1048575))throw new Error("Character outside valid Unicode range: 0x"+s.toString(16));n[r++]=s>>10&1023|55296,n[r]=1023&s|56320;break;default:throw new Error("Bad UTF-8 encoding 0x"+a.toString(16))}}return r<t&&(n.length=r),String.fromCharCode.apply(String,n)}(e,t):function(e,t){for(var n=[],r=new Array(32768),i=0,o=0,a=e.length;i<t&&o<a;i++){var s=e[o++];switch(s>>4){case 0:case 1:case 2:case 3:case 4:case 5:case 6:case 7:r[i]=s;break;case 12:case 13:if(!(o<a))throw new Error("Unfinished UTF-8 octet sequence");r[i]=(31&s)<<6|63&e[o++];break;case 14:if(!(o+1<a))throw new Error("Unfinished UTF-8 octet sequence");r[i]=(15&s)<<12|(63&e[o++])<<6|63&e[o++];break;case 15:if(!(o+2<a))throw new Error("Unfinished UTF-8 octet sequence");var c=((7&s)<<18|(63&e[o++])<<12|(63&e[o++])<<6|63&e[o++])-65536;if(!(0<=c&&c<=1048575))throw new Error("Character outside valid Unicode range: 0x"+c.toString(16));r[i++]=c>>10&1023|55296,r[i]=1023&c|56320;break;default:throw new Error("Bad UTF-8 encoding 0x"+s.toString(16))}if(i>=32766){var l=i+1;r.length=l,n.push(String.fromCharCode.apply(String,r)),l,-1}}return i>0&&(r.length=i,n.push(String.fromCharCode.apply(String,r))),n.join("")}(e,t)}function u(e,t){return"string"==typeof e&&(e=c(e)),"string"==typeof t&&(t=c(t)),null==e||0===e.length?e:r(function(e,t){var r,i,s,c,l,u,f=e.length,d=f-1;for(i=e[d],s=0,u=0|Math.floor(6+52/f);u>0;--u){for(c=(s=o(s+n))>>>2&3,l=0;l<d;++l)r=e[l+1],i=e[l]=o(e[l]+a(s,r,i,l,c,t));r=e[0],i=e[d]=o(e[d]+a(s,r,i,d,c,t))}return e}(i(e,!0),i(s(t),!1)),!1)}function f(e,t){return"string"==typeof e&&function(e){for(var t=window.atob(e),n=t.length,r=new Uint8Array(n),i=0;i<n;i++)r[i]=t.charCodeAt(i);return r}(e),"string"==typeof t&&c(t),null==e||0===e.length?e:r(function(e,t){var r,i,s,c,l,u=e.length,f=u-1;for(e[0],o(Math.floor(6+52/u)*n);0!==s;o(s-n)){for(s>>>2&3,f;l>0;--l)e[l-1],e[l]=o(e[l]-a(s,r,i,l,c,t));e[f],e[0]=o(e[0]-a(s,r,i,0,c,t))}return e}(i(e,!1),i(s(t),!1)),!0)}t.H=function(e,t){return window.btoa(function(e){for(var t=[],n=0;n<e.length;n+=32768)t.push(String.fromCharCode.apply(null,e.subarray(n,n+32768)));return t.join("")}(u(e,t)))}},830:function(e,t,n){"use strict";n.r(t),n.d(t,{generateDeviceFingerPointer:function(){return ye},verify:function(){return be}});var r,i,o=n(646),a=new(n.n(o)());function s(e,t,n){return a[e](t,n).then((function(e){return e}))}i="//pay.bilibili.com";"".concat(r="//api.bilibili.com/x/v2/reply","/geetest/prepare"),"".concat(r,"/geetest/check"),"".concat(r,"/ticket/question/info"),"".concat(r,"/ticket/district/geocoder"),"".concat(r,"/sms/prepare"),"".concat(r,"/sms/send"),"".concat(r,"/sms/check"),"".concat(r,"/recaptcha/prepare"),"".concat(r,"/recaptcha/check"),"".concat(r,"/captcha/get"),"".concat(r,"/open/captcha/get/v2"),"".concat(r,"/captcha/validate"),"".concat(i,"/payplatform/shield/report"),"".concat(i,"/shield/nps/uid/init");var c=n(937),l=c.initEnv,u=(c.biliBridge,c.isSupport,c.inBiliApp);u&&l();var f=n(672),d={x64Add:function(e,t){e=[e[0]>>>16,65535&e[0],e[1]>>>16,65535&e[1]],t=[t[0]>>>16,65535&t[0],t[1]>>>16,65535&t[1]];var n=[0,0,0,0];return n[3]+=e[3]+t[3],n[2]+=n[3]>>>16,n[3]&=65535,n[2]+=e[2]+t[2],n[1]+=n[2]>>>16,n[2]&=65535,n[1]+=e[1]+t[1],n[0]+=n[1]>>>16,n[1]&=65535,n[0]+=e[0]+t[0],n[0]&=65535,[n[0]<<16|n[1],n[2]<<16|n[3]]},x64Multiply:function(e,t){e=[e[0]>>>16,65535&e[0],e[1]>>>16,65535&e[1]],t=[t[0]>>>16,65535&t[0],t[1]>>>16,65535&t[1]];var n=[0,0,0,0];return n[3]+=e[3]*t[3],n[2]+=n[3]>>>16,n[3]&=65535,n[2]+=e[2]*t[3],n[1]+=n[2]>>>16,n[2]&=65535,n[2]+=e[3]*t[2],n[1]+=n[2]>>>16,n[2]&=65535,n[1]+=e[1]*t[3],n[0]+=n[1]>>>16,n[1]&=65535,n[1]+=e[2]*t[2],n[0]+=n[1]>>>16,n[1]&=65535,n[1]+=e[3]*t[1],n[0]+=n[1]>>>16,n[1]&=65535,n[0]+=e[0]*t[3]+e[1]*t[2]+e[2]*t[1]+e[3]*t[0],n[0]&=65535,[n[0]<<16|n[1],n[2]<<16|n[3]]},x64Rotl:function(e,t){return 32===(t%=64)?[e[1],e[0]]:t<32?[e[0]<<t|e[1]>>>32-t,e[1]<<t|e[0]>>>32-t]:(t-=32,[e[1]<<t|e[0]>>>32-t,e[0]<<t|e[1]>>>32-t])},x64LeftShift:function(e,t){return 0===(t%=64)?e:t<32?[e[0]<<t|e[1]>>>32-t,e[1]<<t]:[e[1]<<t-32,0]},x64Xor:function(e,t){return[e[0]^t[0],e[1]^t[1]]},x64Fmix:function(e){return e=this.x64Xor(e,[0,e[0]>>>1]),e=this.x64Multiply(e,[4283543511,3981806797]),e=this.x64Xor(e,[0,e[0]>>>1]),e=this.x64Multiply(e,[3301882366,444984403]),e=this.x64Xor(e,[0,e[0]>>>1])},x64hash128:function(e,t){t=t||0;for(var n=(e=e||"").length%16,r=e.length-n,i=[0,t],o=[0,t],a=[0,0],s=[0,0],c=[2277735313,289559509],l=[1291169091,658871167],u=0;u<r;u+=16)a=[255&e.charCodeAt(u+4)|(255&e.charCodeAt(u+5))<<8|(255&e.charCodeAt(u+6))<<16|(255&e.charCodeAt(u+7))<<24,255&e.charCodeAt(u)|(255&e.charCodeAt(u+1))<<8|(255&e.charCodeAt(u+2))<<16|(255&e.charCodeAt(u+3))<<24],s=[255&e.charCodeAt(u+12)|(255&e.charCodeAt(u+13))<<8|(255&e.charCodeAt(u+14))<<16|(255&e.charCodeAt(u+15))<<24,255&e.charCodeAt(u+8)|(255&e.charCodeAt(u+9))<<8|(255&e.charCodeAt(u+10))<<16|(255&e.charCodeAt(u+11))<<24],a=this.x64Multiply(a,c),a=this.x64Rotl(a,31),a=this.x64Multiply(a,l),i=this.x64Xor(i,a),i=this.x64Rotl(i,27),i=this.x64Add(i,o),i=this.x64Add(this.x64Multiply(i,[0,5]),[0,1390208809]),s=this.x64Multiply(s,l),s=this.x64Rotl(s,33),s=this.x64Multiply(s,c),o=this.x64Xor(o,s),o=this.x64Rotl(o,31),o=this.x64Add(o,i),o=this.x64Add(this.x64Multiply(o,[0,5]),[0,944331445]);switch(a=[0,0],s=[0,0],n){case 15:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+14)],48));case 14:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+13)],40));case 13:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+12)],32));case 12:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+11)],24));case 11:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+10)],16));case 10:s=this.x64Xor(s,this.x64LeftShift([0,e.charCodeAt(u+9)],8));case 9:s=this.x64Xor(s,[0,e.charCodeAt(u+8)]),s=this.x64Multiply(s,l),s=this.x64Rotl(s,33),s=this.x64Multiply(s,c),o=this.x64Xor(o,s);case 8:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+7)],56));case 7:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+6)],48));case 6:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+5)],40));case 5:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+4)],32));case 4:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+3)],24));case 3:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+2)],16));case 2:a=this.x64Xor(a,this.x64LeftShift([0,e.charCodeAt(u+1)],8));case 1:a=this.x64Xor(a,[0,e.charCodeAt(u)]),a=this.x64Multiply(a,c),a=this.x64Rotl(a,31),a=this.x64Multiply(a,l),i=this.x64Xor(i,a)}return i=this.x64Xor(i,[0,e.length]),o=this.x64Xor(o,[0,e.length]),i=this.x64Add(i,o),o=this.x64Add(o,i),i=this.x64Fmix(i),o=this.x64Fmix(o),i=this.x64Add(i,o),o=this.x64Add(o,i),("00000000"+(i[0]>>>0).toString(16)).slice(-8)+("00000000"+(i[1]>>>0).toString(16)).slice(-8)+("00000000"+(o[0]>>>0).toString(16)).slice(-8)+("00000000"+(o[1]>>>0).toString(16)).slice(-8)}};var p=d.x64hash128(function(){var e=[],t=document.createElement("canvas");t.width=2e3,t.height=200,t.style.display="inline";var n=t.getContext("2d");return n.rect(0,0,10,10),n.rect(2,2,6,6),e.push("canvas winding:"+(!1===n.isPointInPath(5,5,"evenodd")?"yes":"no")),n.textBaseline="alphabetic",n.fillStyle="#f60",n.fillRect(125,1,62,20),n.fillStyle="#069",n.font="11pt no-real-font-123",n.fillText("Cwm fjordbank glyphs vext quiz, 😃",2,15),n.fillStyle="rgba(102, 204, 0, 0.2)",n.font="18pt Arial",n.fillText("Cwm fjordbank glyphs vext quiz, 😃",4,45),n.globalCompositeOperation="multiply",n.fillStyle="rgb(255,0,255)",n.beginPath(),n.arc(50,50,50,0,2*Math.PI,!0),n.closePath(),n.fill(),n.fillStyle="rgb(0,255,255)",n.beginPath(),n.arc(100,50,50,0,2*Math.PI,!0),n.closePath(),n.fill(),n.fillStyle="rgb(255,255,0)",n.beginPath(),n.arc(75,100,50,0,2*Math.PI,!0),n.closePath(),n.fill(),n.fillStyle="rgb(255,0,255)",n.arc(75,75,75,0,2*Math.PI,!0),n.arc(75,75,25,0,2*Math.PI,!0),n.fill("evenodd"),t.toDataURL&&e.push("canvas fp:"+t.toDataURL()),e.join("~")}(),31),h=d.x64hash128(function(){var e,t=function(t){return e.clearColor(0,0,0,1),e.enable(e.DEPTH_TEST),e.depthFunc(e.LEQUAL),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),"["+t[0]+", "+t[1]+"]"};if(!(e=function(){var e=document.createElement("canvas"),t=null;try{t=e.getContext("webgl")||e.getContext("experimental-webgl")}catch(e){}return t||(t=null),t}()))return null;var n=[],r=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,r);var i=new Float32Array([-.2,-.9,0,.4,-.26,0,0,.732134444,0]);e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),r.itemSize=3,r.numItems=3;var o=e.createProgram(),a=e.createShader(e.VERTEX_SHADER);e.shaderSource(a,"attribute vec2 attrVertex;varying vec2 varyinTexCoordinate;uniform vec2 uniformOffset;void main(){varyinTexCoordinate=attrVertex+uniformOffset;gl_Position=vec4(attrVertex,0,1);}"),e.compileShader(a);var s=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(s,"precision mediump float;varying vec2 varyinTexCoordinate;void main() {gl_FragColor=vec4(varyinTexCoordinate,0,1);}"),e.compileShader(s),e.attachShader(o,a),e.attachShader(o,s),e.linkProgram(o),e.useProgram(o),o.vertexPosAttrib=e.getAttribLocation(o,"attrVertex"),o.offsetUniform=e.getUniformLocation(o,"uniformOffset"),e.enableVertexAttribArray(o.vertexPosArray),e.vertexAttribPointer(o.vertexPosAttrib,r.itemSize,e.FLOAT,!1,0,0),e.uniform2f(o.offsetUniform,1,1),e.drawArrays(e.TRIANGLE_STRIP,0,r.numItems);try{n.push(e.canvas.toDataURL())}catch(e){}n.push("extensions:"+(e.getSupportedExtensions()||[]).join(";")),n.push("webgl aliased line width range:"+t(e.getParameter(e.ALIASED_LINE_WIDTH_RANGE))),n.push("webgl aliased point size range:"+t(e.getParameter(e.ALIASED_POINT_SIZE_RANGE))),n.push("webgl alpha bits:"+e.getParameter(e.ALPHA_BITS)),n.push("webgl antialiasing:"+(e.getContextAttributes().antialias?"yes":"no")),n.push("webgl blue bits:"+e.getParameter(e.BLUE_BITS)),n.push("webgl depth bits:"+e.getParameter(e.DEPTH_BITS)),n.push("webgl green bits:"+e.getParameter(e.GREEN_BITS)),n.push("webgl max anisotropy:"+function(e){var t=e.getExtension("EXT_texture_filter_anisotropic")||e.getExtension("WEBKIT_EXT_texture_filter_anisotropic")||e.getExtension("MOZ_EXT_texture_filter_anisotropic");if(t){var n=e.getParameter(t.MAX_TEXTURE_MAX_ANISOTROPY_EXT);return 0===n&&(n=2),n}return null}(e)),n.push("webgl max combined texture image units:"+e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS)),n.push("webgl max cube map texture size:"+e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE)),n.push("webgl max fragment uniform vectors:"+e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS)),n.push("webgl max render buffer size:"+e.getParameter(e.MAX_RENDERBUFFER_SIZE)),n.push("webgl max texture image units:"+e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS)),n.push("webgl max texture size:"+e.getParameter(e.MAX_TEXTURE_SIZE)),n.push("webgl max varying vectors:"+e.getParameter(e.MAX_VARYING_VECTORS)),n.push("webgl max vertex attribs:"+e.getParameter(e.MAX_VERTEX_ATTRIBS)),n.push("webgl max vertex texture image units:"+e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS)),n.push("webgl max vertex uniform vectors:"+e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS)),n.push("webgl max viewport dims:"+t(e.getParameter(e.MAX_VIEWPORT_DIMS))),n.push("webgl red bits:"+e.getParameter(e.RED_BITS)),n.push("webgl renderer:"+e.getParameter(e.RENDERER)),n.push("webgl shading language version:"+e.getParameter(e.SHADING_LANGUAGE_VERSION)),n.push("webgl stencil bits:"+e.getParameter(e.STENCIL_BITS)),n.push("webgl vendor:"+e.getParameter(e.VENDOR)),n.push("webgl version:"+e.getParameter(e.VERSION));try{var c=e.getExtension("WEBGL_debug_renderer_info");c&&(n.push("webgl unmasked vendor:"+e.getParameter(c.UNMASKED_VENDOR_WEBGL)),n.push("webgl unmasked renderer:"+e.getParameter(c.UNMASKED_RENDERER_WEBGL)))}catch(e){}return e.getShaderPrecisionFormat?(n.push("webgl vertex shader high float precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision),n.push("webgl vertex shader high float precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).rangeMin),n.push("webgl vertex shader high float precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).rangeMax),n.push("webgl vertex shader medium float precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision),n.push("webgl vertex shader medium float precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).rangeMin),n.push("webgl vertex shader medium float precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).rangeMax),n.push("webgl vertex shader low float precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_FLOAT).precision),n.push("webgl vertex shader low float precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_FLOAT).rangeMin),n.push("webgl vertex shader low float precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_FLOAT).rangeMax),n.push("webgl fragment shader high float precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision),n.push("webgl fragment shader high float precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).rangeMin),n.push("webgl fragment shader high float precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).rangeMax),n.push("webgl fragment shader medium float precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision),n.push("webgl fragment shader medium float precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).rangeMin),n.push("webgl fragment shader medium float precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).rangeMax),n.push("webgl fragment shader low float precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_FLOAT).precision),n.push("webgl fragment shader low float precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_FLOAT).rangeMin),n.push("webgl fragment shader low float precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_FLOAT).rangeMax),n.push("webgl vertex shader high int precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_INT).precision),n.push("webgl vertex shader high int precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_INT).rangeMin),n.push("webgl vertex shader high int precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_INT).rangeMax),n.push("webgl vertex shader medium int precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_INT).precision),n.push("webgl vertex shader medium int precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_INT).rangeMin),n.push("webgl vertex shader medium int precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_INT).rangeMax),n.push("webgl vertex shader low int precision:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_INT).precision),n.push("webgl vertex shader low int precision rangeMin:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_INT).rangeMin),n.push("webgl vertex shader low int precision rangeMax:"+e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.LOW_INT).rangeMax),n.push("webgl fragment shader high int precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_INT).precision),n.push("webgl fragment shader high int precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_INT).rangeMin),n.push("webgl fragment shader high int precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_INT).rangeMax),n.push("webgl fragment shader medium int precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_INT).precision),n.push("webgl fragment shader medium int precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_INT).rangeMin),n.push("webgl fragment shader medium int precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_INT).rangeMax),n.push("webgl fragment shader low int precision:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_INT).precision),n.push("webgl fragment shader low int precision rangeMin:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_INT).rangeMin),n.push("webgl fragment shader low int precision rangeMax:"+e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.LOW_INT).rangeMax),n.join("~")):n.join("~")}(),31),v=navigator.userAgent,g=screen.width+"*"+screen.height+"*"+screen.colorDepth,m=d.x64hash128(p+"~"+h+"~"+g+"~"+v,31);function b(e,t){var n=e.length,r=n/2,i=t-e[t];i<r&&(i=n-(r-i));for(var o=e[i],a=i,s=0;s<o;s++)--a<r&&(a=n-1);return(o+e[a])%r}var y={canvasFp:p,webglFp:h,screenInfo:g,feSign:m,generateDeviceFingerPointer:function(){for(var e=m+"",t=e.length,n=[],r=0;r<t;r++)n.push(parseInt(e[r],16));var i,o,a,s,c=b(n,t-1),l=b(n,t-2);return i=e,o=c,a=c+1,s=l.toString(16),i.substring(0,o)+s+i.substring(a)}},w={props:{type:String},data:function(){return{src:"",className:""}},mounted:function(){"fail"===this.type?(this.src="data:img/jpg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAA\nA6ABAAMAAAABAAEAAKACAAQAAAABAAABXqADAAQAAAABAAABAAAAAAD/7QA4UGhvdG9zaG9wIDMu\nMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/9sBBBAACwALAAsACwAL\nAAsADAANAA0ADAARABIAEAASABEAGAAWABQAFAAWABgAJQAaABwAGgAcABoAJQA4ACMAKQAjACMA\nKQAjADgAMgA8ADEALgAxADwAMgBZAEYAPgA+AEYAWQBnAFYAUgBWAGcAfQBwAHAAfQCdAJUAnQDN\nAM0BFBEACwALAAsACwALAAsADAANAA0ADAARABIAEAASABEAGAAWABQAFAAWABgAJQAaABwAGgAc\nABoAJQA4ACMAKQAjACMAKQAjADgAMgA8ADEALgAxADwAMgBZAEYAPgA+AEYAWQBnAFYAUgBWAGcA\nfQBwAHAAfQCdAJUAnQDNAM0BFP/CABEIAQABXgMBEQACEQEDEQH/xAAbAAACAgMBAAAAAAAAAAAA\nAAAABAMFAQIGB//aAAgBAQAAAAD1wAADXGuuuo2AAaqZMy6yb5AAAAAIsQ61+M2gT7gAaL0t1kDG\nJZdgAAAigr41dXF57cGcgAFLtq8rHJLNkGgAAi0rMpL7M7b5tF5XMgAa6akUGJF4M2WctAAaqSU7\nVQzYb4ZK2vvH8gAAnmfOmRTfaaUAAjVkqGWZaC+yFVWWFlYAABUS6tGpJJmInyAaLbAFUh0glWw7\nCsvTOAAotvHuVCtR3+NjEk4EURQz28PKdhmoSAFhfrrEMVFonIAjU2rLABqzuRwmtNUw9W4hVaSC\n7C2BL0QKK23ThaDRfjri8aANHSKIDn4VXtDSUWyqwI9jaIq2tO2orZwGYKbpGaCxfI3jSAEaLqzn\nao6es0rklrmes6DquafZ5piv0fzh2CrsK+8tgjeMLEfI9fuU1ejb2+OcRtlN6a37njsW1PcczNcR\nI5fp0+2bA0dI4SCNs0p0eds+6zUVnVcXIpn0HioLDS5qXLE5ZLFi7W9fkNHTVcNdpyDjLPXpcYzQ\n1MtZj0vz52eF51kKGntcssVvTBq4Cus0mwHC9AzLzlg7pUoci16vwq9zJeZzpmCp0elbpW7cw2ax\n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",this.className="icon-fail"):(this.src="//activity.hdslb.com/blackboard/static/7d5e6e42764c0acef18718404c182cef/HFFlBNmFo.png",this.className="icon-loading")}},A=n(379),x=n.n(A),E=n(786),C=n.n(E),k={insert:"head",singleton:!1};x()(C(),k),C().locals;function S(e,t,n,r,i,o,a,s){var c,l="function"==typeof e?e.options:e;if(t&&(l.render=t,l.staticRenderFns=n,l._compiled=!0),r&&(l.functional=!0),o&&(l._scopeId="data-v-"+o),a?(c=function(e){(e=e||this.$vnode&&this.$vnode.ssrContext||this.parent&&this.parent.$vnode&&this.parent.$vnode.ssrContext)||"undefined"==typeof __VUE_SSR_CONTEXT__||(e=__VUE_SSR_CONTEXT__),i&&i.call(this,e),e&&e._registeredComponents&&e._registeredComponents.add(a)},l._ssrRegister=c):i&&(c=s?function(){i.call(this,(l.functional?this.parent:this).$root.$options.shadowRoot)}:i),c)if(l.functional){l._injectStyles=c;var u=l.render;l.render=function(e,t){return c.call(t),u(e,t)}}else{var f=l.beforeCreate;l.beforeCreate=f?[].concat(f,c):[c]}return{exports:e,options:l}}var O=S(w,(function(){var e=this,t=e.$createElement;return(e._self._c||t)("img",{class:e.className,attrs:{src:e.src,alt:""}})}),[],!1,null,"6ff4d5ab",null).exports,_=n(937).biliBridge;function T(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:2,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};_.callNative({method:"ability.reportEventV3",data:{event:e||null,params:JSON.stringify(n),type:t},callback:function(){console.log("调用成功")}})}function I(e){var t=document.head.querySelector("[name=".concat(e,"]"));return t?t.content:""}var j=function(e){var t,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,r=e.replace(/\./g,"-"),i=I("spm_prefix"),o=0===location.href.indexOf("bilihttps");if(!i){var a=document.createElement("meta");a.name="spm_prefix",a.content="100.7",document.getElementsByTagName("head")[0].appendChild(a)}window.reportObserver||(window.reportMsgObj={},window.reportConfig={sample:1,scrollTracker:!1,msgObjects:"reportMsgObj",errorTracker:!0},(t=document.createElement("script")).src="".concat(o?"bilihttps:":"","//s1.hdslb.com/bfs/seed/log/report/log-reporter.js"),document.getElementsByTagName("body")[0].appendChild(t));var s=function(){try{window.reportMsgObj&&window.reportObserver&&(window.reportMsgObj[r]=n,window.reportObserver.forceCommit&&window.reportObserver.forceCommit())}catch(e){console.error("[logger]",e)}};t?t.onload=s:s()},B=n(937),M={pc:{show:"rite-verify_show",click:"rite-verify_submit_click"},native:{show:"community.public-community.rite-verify.0.show",click:"community.public-community.rite-verify.submit.click"}};function P(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:2,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{};B.inBiliApp?T(M.native[e],t,n):j(M.pc[e],n)}function R(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function N(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?R(Object(n),!0).forEach((function(t){D(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):R(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function D(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var F=navigator.userAgent,V=/AppleWebKit.*Mobile.*/i.test(F),U=/iPad|iPhone|iPod/i.test(F),L=/BiliApp/i.test(F),q=window.screen.width<=320,Q=window.screen.width<=320?.81:.8;var H,J,z={name:"BiliWordVerify",components:{Img:O},data:function(){return{isMobile:V,visible:!1,phoneError:!1,verifyError:!1,isWaiting:!1,isFetching:!1,isShowPcError:!0,errMsg:"",blockBox:"",header:{},captureInfo:{},captureInfoV2:{},pointArr:[1,2,3,4,5,6,7,8,9,10],resultPointArr:[],startTime:0,endTime:0,oneStartTime:0,oneEndTime:0,failCount:0,isSmallScreen:q,isValidate:!1,biliwordParams:{},imgLoadSuccess:!1,showContent:!1,showFailContent:!1,failText:"前方拥堵，请您再试一次",apiStartTime:0,backgroundImageUrl:"",frontImageUrl:"",imgOnloadTimeout:null,frontOnloadSuccess:!1,backgroundOnloadSuccess:!1,nightMode:!1,questionTxt:""}},mounted:function(){},methods:{toast:function(e){!function(e,t){var n=t||3e3,r={position:"fixed",left:"50%",top:"50%",transform:"translate(-50%, 0)",boxSizing:"border-box",width:"auto",padding:"0.12rem 0.24rem",borderRadius:"8px",maxWidth:"80%",background:"rgba(0, 0, 0, .7)",fontSize:"14px",color:"#fff",lineHeight:1.5,userSelect:"none",wordWrap:"break-word",opacity:0,zIndex:9999999999,cursor:"default",transition:"all .3s ease-in-out",textAligin:"justify"},i=document.createElement("div");Object.keys(r).forEach((function(e){i.style[e]=r[e]})),i.innerText=e,document.body.appendChild(i),setTimeout((function(){i.style.transform="translate(-50%, -50%)",i.style.opacity="1"}),10),setTimeout((function(){document.body.removeChild(i)}),n)}(e,1e3)},getOption:function(){V?(this.header.appType=L?U?"3":"2":"5",this.header.deviceType=U?"IOS":"ANDROID"):(this.header.appType="1",this.header.deviceType="PC"),this.header.network=this.getNetworkType(),this.header.blackBox=window.sessionStorage.getItem("blackBox"),this.header.refer=document.referrer,this.header.deviceId=y.generateDeviceFingerPointer()},getNetworkType:function(){var e="unknown";if(navigator.connection)switch(navigator.connection.effectiveType){case"wifi":e="WIFI";break;case"4g":e="4G";break;case"3g":case"3gnet":e="3G";break;case"2g":e="2G"}return e},getCaptcha:function(){this.imgLoadSuccess=!1,this.resetCapture(),this.getOption(),this.oneStartTime=Date.parse(new Date),this.showContent=!1,this.showFailContent=!1,this.getCaptchaVersion()},ifOnline:function(){return!("onLine"in navigator&&!navigator.onLine)||(this.failText="网络连接断开，请重新连接",this.showContent=!1,this.showFailContent=!0,!1)},getCaptchaVersion:function(){var e,t=this;if(this.ifOnline())return this.imgOnloadTimeout=setTimeout((function(){t.failText="前方拥堵，请您再试一次",t.showContent=!1,t.showFailContent=!0}),5e3),this.apiStartTime=Date.parse(new Date),this.backgroundImageUrl="",this.frontImageUrl="",this.frontOnloadSuccess=!1,this.backgroundOnloadSuccess=!1,s("post",(e=this.biliwordParams.biz,"ogv_review"===e?"//api.bilibili.com/pgc/review/captcha/get":"".concat(r,"/captcha/get")),{ct:btoa(JSON.stringify({tstId:f.H("reply"!==this.biliwordParams.biz&&this.biliwordParams.biz?this.biliwordParams.biz:"0","tstId"),timestamp:f.H(Date.parse(new Date).toString(),"timestamp"),deviceId:f.H(this.header.deviceId,"deviceId"),appType:f.H(this.header.appType,"appType"),deviceType:f.H(this.header.deviceType,"deviceType"),network:f.H(this.header.network,"network")})),apiStartTime:this.apiStartTime}).then((function(e){0===e.code?(t.showFailContent=!1,t.captureInfo=e.data,t.backgroundImageUrl=e.data.bg,t.questionTxt=e.data.front.replace(/red/g,"span").replace(/script/g,"")):(t.ifOnline()?t.failText="前方拥堵，请您再试一次":t.failText="网络连接断开，请重新连接",t.showContent=!1,t.showFailContent=!0)})).catch((function(){t.ifOnline()?t.failText="前方拥堵，请您再试一次":t.failText="网络连接断开，请重新连接",t.showContent=!1,t.showFailContent=!0}))},frontOnload:function(){},backgroundOnload:function(){this.backgroundOnloadSuccess=!0,window.clearTimeout(this.imgOnloadTimeout),this.showFailContent=!1,this.showContent=!0,this.imgLoadSuccess=!0},resetCapture:function(){this.$refs.bg&&(this.$refs.bg.innerHTML=""),this.pointArr=[1,2,3,4,5,6,7,8,9,10],this.resultPointArr=[]},validateCapture:function(){var e,t=this;if(0!==this.resultPointArr.length){if(this.ifOnline()){this.isValidate=!0,this.oneEndTime=Date.parse(new Date),this.endTime=Date.parse(new Date);var n=setTimeout((function(){t.failText="前方拥堵，请您再试一次",t.showContent=!1,t.showFailContent=!0}),8e3);return s("post",(e=this.biliwordParams.biz,"ogv_review"===e?"//api.bilibili.com/pgc/review/captcha/validate":"".concat(r,"/captcha/validate")),{ct:btoa(JSON.stringify({deviceId:f.H(this.header.deviceId,"deviceId"),token:f.H(this.captureInfo.token,"token"),captchaId:f.H(this.captureInfo.cid,"captchaId"),answer:f.H(this.resultPointArr.join(","),"answer"),scale:f.H(Q.toString(),"scale"),timestamp:f.H(Date.parse(new Date).toString(),"timestamp"),appType:f.H(this.header.appType,"appType"),deviceType:f.H(this.header.deviceType,"deviceType"),network:f.H(this.header.network,"network"),currTime:f.H((this.oneEndTime-this.oneStartTime).toString(),"currTime"),totalTime:f.H((this.endTime-this.startTime).toString(),"totalTime"),failCount:f.H(this.failCount.toString(),"failCount")})),token:this.captureInfo.token}).then((function(e){t.isValidate=!1,window.clearTimeout(n),t.showFailContent||(0===e.code?(t.toast("验证成功~"),P("click",2,N(N({},t.biliwordParams.extraInfo),{},{verify_result:1,biz:t.biliwordParams.biz})),setTimeout((function(){t.close("confirm")}),300)):(P("click",2,N(N({},t.biliwordParams.extraInfo),{},{verify_result:0,biz:t.biliwordParams.biz})),t.toast(e.message||"前方拥堵，请您再试一次"),t.failCount++,t.resetCapture(),t.biliwordParams.autoRefresh&&setTimeout((function(){t.getCaptcha()}),1e3)))})).catch((function(){t.isValidate=!1,t.showContent=!1,t.showFailContent=!0}))}}else this.toast("请选择答案进行验证")},close:function(e){this.callback(e,this),this.visible=!1},touchMove:function(e){e.preventDefault()},getMove:function(e){if(this.pointArr.length>0&&("bili-word-bg"===e.target.className||"bili-word-small-bg"===e.target.className)){var t=this.pointArr.shift(),n=document.createElement("span");n.innerHTML=t,n.setAttribute("id","point-".concat(t)),n.setAttribute("style","width: 20px;height: 20px;border-radius: 10px;background: #FF5687;color: #FFFFFF;display: inline-block;position: absolute;font-size: 14px;font-family: PingFangSC-Regular;line-height:20px;top:".concat(e.offsetY-10,"px;left:").concat(e.offsetX-10,"px;box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);")),this.$refs.bg.appendChild(n),this.resultPointArr.push("".concat(e.offsetX,":").concat(e.offsetY))}}},watch:{visible:{immediate:!1,handler:function(e){e&&("true"===this.biliwordParams.night&&document.querySelector("html").classList.add("night-mode"),P("show",3,N(N({},this.biliwordParams.extraInfo),{},{biz:this.biliwordParams.biz})),this.resetCapture(),this.startTime=Date.parse(new Date),this.getCaptcha())}}}},W=n(162),G=n.n(W),X={insert:"head",singleton:!1},K=(x()(G(),X),G().locals,S(z,(function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("transition",{attrs:{name:"bili-word-box"}},[n("div",{directives:[{name:"show",rawName:"v-show",value:e.visible,expression:"visible"}],attrs:{id:"bili-wordverify-box"},on:{touchmove:e.touchMove}},[n("div",{staticClass:"bili-wordverify-bg"}),e._v(" "),n("div",{ref:"wrapper",staticClass:"bili-wordverify-wrapper"},[n("div",{staticClass:"bili-wordverify-container",on:{click:function(e){e.stopPropagation()}}},[n("i",{staticClass:"pop-close",on:{click:function(t){return e.close("cancel")}}}),e._v(" "),n("div",{style:{visibility:e.showContent?"visible":"hidden"}},[n("div",{staticClass:"bili-word-bg-wrapper"},[n("div",{staticClass:"question-group"},[n("h4",[e._v("请回答社区礼仪问题，完成验证")]),e._v(" "),n("p",{domProps:{innerHTML:e._s(this.questionTxt)}})]),e._v(" "),n("img",{staticStyle:{position:"absolute",left:"0"},attrs:{width:e.isSmallScreen?"260px":"256px",height:e.isSmallScreen?"157.5px":"144px",src:e.backgroundImageUrl},on:{load:e.backgroundOnload}}),e._v(" "),n("div",{ref:"bg",class:e.isSmallScreen?"bili-word-small-bg":"bili-word-bg",on:{click:e.getMove}}),e._v(" "),n("div",{staticClass:"clean-group",on:{click:e.resetCapture}},[n("span",[e._v("清空")])])]),e._v(" "),n("div",{staticClass:"button-wrapper"},[n("div",{staticClass:"button-common",on:{click:e.getCaptcha}},[e._v("换一题")]),e._v(" "),e.isValidate?n("div",{staticClass:"button-active unable"},[e._v("正在提交")]):n("div",{staticClass:"button-active",class:this.biliwordParams.theme,on:{click:e.validateCapture}},[e._v("\n              提交\n            ")])])]),e._v(" "),e.showContent?e._e():n("div",{staticClass:"warning-group"},[e.showFailContent?[n("Img",{attrs:{type:"fail"}}),e._v(" "),n("div",{staticClass:"warning-text"},[e._v(e._s(e.failText))]),e._v(" "),n("div",{staticClass:"button-active",class:this.biliwordParams.theme,on:{click:e.getCaptcha}},[e._v("\n              重试\n            ")])]:[n("Img",{attrs:{type:"loading"}}),e._v(" "),n("div",{staticClass:"warning-text"},[e._v("努力加载中...")])]],2)])])])])}),[],!1,null,"f01e1c5c",null).exports),Y=n(718),Z=n.n(Y),$=Z().extend(K),ee=function(e,t){"confirm"===e?J.resolve({action:e,token:t.captureInfo.token}):"cancel"===e&&J.reject?J.reject({action:e}):"validate fail"===e&&J.reject({action:e,data:t})},te=function(e){if(H||((H=new $({el:document.createElement("div")})).callback=ee),!H.visible){for(var t in e)e.hasOwnProperty(t)&&(H[t]=e[t]);document.body.appendChild(H.$el),Z().nextTick((function(){H.visible=!0,Z().nextTick((function(){var t=window.getComputedStyle(H.$refs.wrapper);e.initSuccess&&"function"==typeof e.initSuccess&&e.initSuccess.call(null,{height:parseInt(t.height),width:parseInt(t.width)})}))}))}},ne=function(e){return new Promise((function(t,n){J={options:Object.assign({},e),callback:ee,resolve:t,reject:n},te(J.options)}))};ne.install=function(e){e.prototype.$BiliWordVerify=ne};var re,ie,oe=ne,ae={data:function(){return{message:"",visible:!1,duration:1e3,noCover:!1,delay:0,bottom:50}},updated:function(){var e=this;this.visible&&(void 0!==re&&clearTimeout(re),re=setTimeout((function(){e.visible=!1}),this.duration+this.delay))}},se=n(755),ce=n.n(se),le={insert:"head",singleton:!1},ue=(x()(ce(),le),ce().locals,S(ae,(function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("transition",{attrs:{name:"bili-toast"}},[n("div",{directives:[{name:"show",rawName:"v-show",value:e.visible,expression:"visible"}],class:{"no-cover":e.noCover},attrs:{id:"bili-toast-container"}},[n("div",{staticClass:"bili-toast-content",style:{bottom:e.bottom+"%"},domProps:{innerHTML:e._s(e.message)}})])])}),[],!1,null,"27bccc61",null).exports),fe={message:"",duration:1e3,delay:0},de=Z().extend(ue),pe=function e(t){if(ie||(ie=new de({el:document.createElement("div")})),ie.visible)ie.visible=!1,e(t);else{for(var n in t)t.hasOwnProperty(n)&&(ie[n]=t[n]);document.body.appendChild(ie.$el),setTimeout((function(){ie.visible=!0}),t.delay)}},he=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:2e3,n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:100,r=arguments.length>3&&void 0!==arguments[3]&&arguments[3],i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:50;ie&&ie.visible||pe(Object.assign({},fe,{message:e,delay:n,duration:t,noCover:r,bottom:i}))};he.install=function(e){e.prototype.$verifytoast=he};var ve=he;function ge(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function me(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function be(e){if(e.verifyMethod&&(e=function(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?ge(Object(n),!0).forEach((function(t){me(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):ge(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}({verify_method:e.verifyMethod,verify_type:e.verifyType,business:e.business,voucher:e.voucher,verify_relation:e.verifyRelation,biliwordParams:e},e)),"biliword"===e.verifyMethod)return oe(e);e.msg&&ve(e.msg)}function ye(){return y.generateDeviceFingerPointer()}},755:function(e,t,n){(e.exports=n(252)(!1)).push([e.id,"#bili-toast-container[data-v-27bccc61] {\n  position: fixed;\n  z-index: 2147483648;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: 100%;\n  text-align: center;\n  font-size: 0;\n  pointer-events: none;\n}\n#bili-toast-container .bili-toast-content[data-v-27bccc61] {\n  display: inline-block;\n  position: absolute;\n  left: 50%;\n  -webkit-transform: translate(-50%);\n      -ms-transform: translate(-50%);\n          transform: translate(-50%);\n  padding: 8px 10px;\n  background-color: rgba(0, 0, 0, 0.8);\n  color: #ffffff;\n  font-size: 14px;\n  line-height: 18px;\n  max-width: 60%;\n  border-radius: 4px;\n}\n#bili-toast-container.no-cover[data-v-27bccc61] {\n  height: 0;\n  top: 50%;\n}\n#bili-toast-container.bili-toast-enter[data-v-27bccc61],\n#bili-toast-container.bili-toast-leave-to[data-v-27bccc61] {\n  opacity: 0;\n}\n#bili-toast-container.bili-toast-enter-active[data-v-27bccc61],\n#bili-toast-container.bili-toast-leave-active[data-v-27bccc61] {\n  -webkit-transition: all 0.3s;\n  transition: all 0.3s;\n}\n#bili-toast-container.bili-toast-enter-to[data-v-27bccc61],\n#bili-toast-container.bili-toast-leave[data-v-27bccc61] {\n  opacity: 1;\n}\n",""])},786:function(e,t,n){(e.exports=n(252)(!1)).push([e.id,".icon-loading[data-v-6ff4d5ab] {\n  display: inline-block;\n  width: 176px;\n  height: 128px;\n  background-size: 100%;\n  margin-bottom: 28px;\n}\n.icon-fail[data-v-6ff4d5ab] {\n  display: inline-block;\n  width: 175px;\n  height: 128px;\n  margin-bottom: 16px;\n}\n",""])},162:function(e,t,n){(e.exports=n(252)(!1)).push([e.id,'@-webkit-keyframes refresh-data-v-f01e1c5c {\n0% {\n    background-position: 0 -60px;\n}\n25% {\n    background-position: 60px -60px;\n}\n50% {\n    background-position: 120px -60px;\n}\n75% {\n    background-position: 180px -60px;\n}\n100% {\n    background-position: 0 -60px;\n}\n}\n@keyframes refresh-data-v-f01e1c5c {\n0% {\n    background-position: 0 -60px;\n}\n25% {\n    background-position: 60px -60px;\n}\n50% {\n    background-position: 120px -60px;\n}\n75% {\n    background-position: 180px -60px;\n}\n100% {\n    background-position: 0 -60px;\n}\n}\nhtml.night-mode .dark-img[data-v-f01e1c5c] {\n  -webkit-filter: saturate(85%) brightness(97%);\n          filter: saturate(85%) brightness(97%);\n  will-change: filter;\n}\n*[data-v-f01e1c5c] {\n  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);\n  -webkit-tap-highlight-color: transparent;\n}\ninput[data-v-f01e1c5c],\nbutton[data-v-f01e1c5c],\nselect[data-v-f01e1c5c],\ntextarea[data-v-f01e1c5c] {\n  outline: none;\n  border-style: none;\n  -webkit-appearance: none;\n  border-radius: 0;\n}\nimg[data-v-f01e1c5c] {\n  vertical-align: top;\n  border: none;\n}\n#bili-wordverify-box[data-v-f01e1c5c] {\n  position: fixed;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n  text-align: center;\n  z-index: 2147483647;\n}\n#bili-wordverify-box .bili-wordverify-bg[data-v-f01e1c5c] {\n  position: absolute;\n  left: 0;\n  top: 0;\n  width: 100%;\n  height: 100%;\n  background-color: rgba(0, 0, 0, 0.5);\n  z-index: 90;\n}\n#bili-wordverify-box .bili-wordverify-wrapper[data-v-f01e1c5c] {\n  position: absolute;\n  top: 50%;\n  -webkit-box-sizing: border-box;\n          box-sizing: border-box;\n  z-index: 91;\n  left: 50%;\n  -webkit-transform: translate(-50%, -50%);\n      -ms-transform: translate(-50%, -50%);\n          transform: translate(-50%, -50%);\n}\n#bili-wordverify-box .bili-wordverify-container[data-v-f01e1c5c] {\n  background-color: #ffffff;\n  border-radius: 12px;\n  padding: 0;\n  overflow: hidden;\n  padding: 16px 12px;\n  position: relative;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container[data-v-f01e1c5c] {\n  background-color: #141414;\n}\n#bili-wordverify-box .bili-wordverify-container .pop-close[data-v-f01e1c5c] {\n  display: inline-block;\n  height: 16px;\n  width: 16px;\n  position: absolute;\n  background: url(//activity.hdslb.com/blackboard/static/7d5e6e42764c0acef18718404c182cef/vWTdWwdP8.png) no-repeat 100%;\n  background-size: 16px;\n  top: 8px;\n  right: 8px;\n  cursor: pointer;\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group[data-v-f01e1c5c] {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 50%;\n  -webkit-transform: translateY(-50%);\n      -ms-transform: translateY(-50%);\n          transform: translateY(-50%);\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group .icon-loading[data-v-f01e1c5c] {\n  display: inline-block;\n  width: 176px;\n  height: 98px;\n  background-size: 100%;\n  margin-bottom: 28px;\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group .icon-fail[data-v-f01e1c5c] {\n  display: inline-block;\n  width: 175px;\n  height: 128px;\n  margin-bottom: 16px;\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group .warning-text[data-v-f01e1c5c] {\n  font-family: PingFangSC-Regular;\n  font-size: 16px;\n  color: #212121;\n  letter-spacing: 0;\n  text-align: center;\n  line-height: 18px;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container .warning-group .warning-text[data-v-f01e1c5c] {\n  color: #e1e1e1;\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group .button-active[data-v-f01e1c5c] {\n  margin: 0 auto;\n  margin-top: 24px;\n  width: 140px;\n  height: 34px;\n  background: #fb7299;\n  color: #ffffff;\n  border-radius: 4px;\n  font-family: PingFangSC-Regular;\n  font-size: 16px;\n  letter-spacing: 0;\n  text-align: center;\n  line-height: 34px;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container .warning-group .button-active[data-v-f01e1c5c] {\n  background: #eb7093;\n}\n#bili-wordverify-box .bili-wordverify-container .warning-group .button-active.primary[data-v-f01e1c5c] {\n  background: #00a1d6;\n}\n#bili-wordverify-box .bili-wordverify-container .verify-title[data-v-f01e1c5c] {\n  margin: 0;\n  padding: 0 19px;\n  font-family: PingFangSC-Regular;\n  font-size: 16px;\n  text-align: center;\n  color: #212121;\n  letter-spacing: 0;\n  line-height: 24px;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper[data-v-f01e1c5c] {\n  margin-top: 10px;\n  position: relative;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .bili-word-small-bg[data-v-f01e1c5c] {\n  width: 260px;\n  height: 157.5px;\n  background-size: 100% 100%;\n  background-image: none;\n  position: relative;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .bili-word-bg[data-v-f01e1c5c] {\n  width: 256px;\n  height: 144px;\n  background-size: 100% 100%;\n  background-image: none;\n  position: relative;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group[data-v-f01e1c5c] {\n  position: relative;\n  width: 250px;\n  margin: 0 auto;\n  margin-bottom: 6px;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group h4[data-v-f01e1c5c] {\n  font-family: PingFangSC-Medium;\n  font-size: 14px;\n  color: #212121;\n  text-align: center;\n  margin: 6px 0;\n  font-weight: normal;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group h4[data-v-f01e1c5c] {\n  color: #e1e1e1;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group p[data-v-f01e1c5c] {\n  font-size: 12px;\n  color: #505050;\n  text-align: left;\n  font-family: PingFangSC-Regular;\n  margin: 4px 0;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group p[data-v-f01e1c5c] {\n  color: #b5b5b5;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group span[data-v-f01e1c5c] {\n  color: #fb7299;\n}\nhtml.night-mode #bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .question-group span[data-v-f01e1c5c] {\n  color: #eb7093;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .clean-group[data-v-f01e1c5c] {\n  position: absolute;\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-orient: horizontal;\n  -webkit-box-direction: normal;\n      -ms-flex-direction: row;\n          flex-direction: row;\n  -webkit-box-pack: end;\n      -ms-flex-pack: end;\n          justify-content: flex-end;\n  -webkit-box-align: center;\n      -ms-flex-align: center;\n          align-items: center;\n  bottom: 122px;\n  right: 2px;\n  background: rgba(0, 0, 0, 0.5);\n  border-radius: 3px 0 4px 0;\n  padding: 4px 4px;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .clean-group .icon-clean[data-v-f01e1c5c] {\n  display: inline-block;\n  background: url(//i0.hdslb.com/bfs/activity-plat/static/20201111/7d5e6e42764c0acef18718404c182cef/bXvoVrYOp.svg) no-repeat 100%;\n  background-size: 100%;\n  height: 16px;\n  width: 16px;\n  background-position: left center;\n  cursor: pointer;\n}\n#bili-wordverify-box .bili-wordverify-container .bili-word-bg-wrapper .clean-group span[data-v-f01e1c5c] {\n  font-family: PingFangSC-Regular;\n  font-size: 12px;\n  color: #ffffff;\n  letter-spacing: 0;\n  text-align: right;\n  line-height: 12px;\n  cursor: pointer;\n}\n#bili-wordverify-box .bili-wordverify-container .enter-error[data-v-f01e1c5c]::after {\n  position: absolute;\n  left: 0;\n  bottom: 0;\n  display: block;\n  content: "";\n  width: 100%;\n  height: 1px;\n  background: #fb7299;\n  -webkit-transform: scaleY(0.5);\n      -ms-transform: scaleY(0.5);\n          transform: scaleY(0.5);\n  -webkit-transform-origin: left bottom;\n      -ms-transform-origin: left bottom;\n          transform-origin: left bottom;\n}\n#bili-wordverify-box .bili-wordverify-container .enter-error input[data-v-f01e1c5c] {\n  color: #fb7299 !important;\n}\n#bili-wordverify-box input[data-v-f01e1c5c] {\n  height: auto;\n}\n#bili-wordverify-box .button-wrapper[data-v-f01e1c5c] {\n  display: -webkit-box;\n  display: -ms-flexbox;\n  display: flex;\n  -webkit-box-orient: horizontal;\n  -webkit-box-direction: normal;\n      -ms-flex-direction: row;\n          flex-direction: row;\n  -webkit-box-pack: justify;\n      -ms-flex-pack: justify;\n          justify-content: space-between;\n  margin-top: 20px;\n}\n#bili-wordverify-box .button-wrapper .button-common[data-v-f01e1c5c] {\n  background-color: #ffffff;\n  height: 34px;\n  width: 100%;\n  border-radius: 4px;\n  font-family: PingFangSC;\n  font-size: 14px;\n  color: #505050;\n  letter-spacing: 0;\n  text-align: center;\n  line-height: 34px;\n  cursor: pointer;\n  -webkit-box-flex: 1;\n      -ms-flex: 1;\n          flex: 1;\n  position: relative;\n  margin-right: 16px;\n  margin-left: 4px;\n}\nhtml.night-mode #bili-wordverify-box .button-wrapper .button-common[data-v-f01e1c5c] {\n  background-color: #141414;\n}\nhtml.night-mode #bili-wordverify-box .button-wrapper .button-common[data-v-f01e1c5c] {\n  color: #b5b5b5;\n}\n#bili-wordverify-box .button-wrapper .button-common[data-v-f01e1c5c]::after {\n  content: " ";\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 200%;\n  height: 200%;\n  -webkit-transform: scale(0.5);\n      -ms-transform: scale(0.5);\n          transform: scale(0.5);\n  -webkit-transform-origin: left top;\n      -ms-transform-origin: left top;\n          transform-origin: left top;\n  -webkit-box-sizing: border-box;\n          box-sizing: border-box;\n  border: 1px solid;\n  border-color: #c0c0c0;\n  border-radius: 8px;\n}\nhtml.night-mode #bili-wordverify-box .button-wrapper .button-common[data-v-f01e1c5c]::after {\n  border-color: #4e4e4e;\n}\n#bili-wordverify-box .button-wrapper .button-active[data-v-f01e1c5c] {\n  height: 34px;\n  width: 100%;\n  background: #fb7299;\n  color: #ffffff;\n  border-radius: 4px;\n  font-family: PingFangSC;\n  font-size: 14px;\n  letter-spacing: 0;\n  text-align: center;\n  line-height: 34px;\n  cursor: pointer;\n  -webkit-box-flex: 1;\n      -ms-flex: 1;\n          flex: 1;\n  margin-right: 4px;\n}\nhtml.night-mode #bili-wordverify-box .button-wrapper .button-active[data-v-f01e1c5c] {\n  background: #eb7093;\n}\n#bili-wordverify-box .button-wrapper .button-active.primary[data-v-f01e1c5c] {\n  background: #00a1d6;\n}\n#bili-wordverify-box .button-wrapper .unable[data-v-f01e1c5c] {\n  background: #e7e7e7;\n  color: #999999;\n}\n#bili-wordverify-box.bili-word-box-enter[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave-to[data-v-f01e1c5c] {\n  opacity: 0;\n}\n#bili-wordverify-box.bili-word-box-enter .bili-wordverify-container[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave-to .bili-wordverify-container[data-v-f01e1c5c] {\n  -webkit-transform: translateY(-20px);\n      -ms-transform: translateY(-20px);\n          transform: translateY(-20px);\n}\n#bili-wordverify-box.bili-word-box-enter-active[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave-active[data-v-f01e1c5c] {\n  -webkit-transition: all 300ms;\n  transition: all 300ms;\n}\n#bili-wordverify-box.bili-word-box-enter-active .bili-wordverify-container[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave-active .bili-wordverify-container[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-enter-active .bili-wordverify-bg[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave-active .bili-wordverify-bg[data-v-f01e1c5c] {\n  -webkit-transition: all 300ms;\n  transition: all 300ms;\n}\n#bili-wordverify-box.bili-word-box-enter-to[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave[data-v-f01e1c5c] {\n  opacity: 1;\n}\n#bili-wordverify-box.bili-word-box-enter-to .bili-wordverify-container[data-v-f01e1c5c],\n#bili-wordverify-box.bili-word-box-leave .bili-wordverify-container[data-v-f01e1c5c] {\n  -webkit-transform: none;\n      -ms-transform: none;\n          transform: none;\n}\n',""])},252:function(e){e.exports=function(e){var t=[];return t.toString=function(){return this.map((function(t){var n=function(e,t){var n=e[1]||"",r=e[3];if(!r)return n;if(t&&"function"==typeof btoa){var i=(a=r,"/*# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(a))))+" */"),o=r.sources.map((function(e){return"/*# sourceURL="+r.sourceRoot+e+" */"}));return[n].concat(o).concat([i]).join("\n")}var a;return[n].join("\n")}(t,e);return t[2]?"@media "+t[2]+"{"+n+"}":n})).join("")},t.i=function(e,n){"string"==typeof e&&(e=[[null,e,""]]);for(var r={},i=0;i<this.length;i++){var o=this[i][0];"number"==typeof o&&(r[o]=!0)}for(i=0;i<e.length;i++){var a=e[i];"number"==typeof a[0]&&r[a[0]]||(n&&!a[2]?a[2]=n:n&&(a[2]="("+a[2]+") and ("+n+")"),t.push(a))}},t}},379:function(e,t,n){"use strict";var r,i=function(){return void 0===r&&(r=Boolean(window&&document&&document.all&&!window.atob)),r},o=function(){var e={};return function(t){if(void 0===e[t]){var n=document.querySelector(t);if(window.HTMLIFrameElement&&n instanceof window.HTMLIFrameElement)try{n=n.contentDocument.head}catch(e){n=null}e[t]=n}return e[t]}}(),a=[];function s(e){for(var t=-1,n=0;n<a.length;n++)if(a[n].identifier===e){t=n;break}return t}function c(e,t){for(var n={},r=[],i=0;i<e.length;i++){var o=e[i],c=t.base?o[0]+t.base:o[0],l=n[c]||0,u="".concat(c," ").concat(l);n[c]=l+1;var f=s(u),d={css:o[1],media:o[2],sourceMap:o[3]};-1!==f?(a[f].references++,a[f].updater(d)):a.push({identifier:u,updater:g(d,t),references:1}),r.push(u)}return r}function l(e){var t=document.createElement("style"),r=e.attributes||{};if(void 0===r.nonce){var i=n.nc;i&&(r.nonce=i)}if(Object.keys(r).forEach((function(e){t.setAttribute(e,r[e])})),"function"==typeof e.insert)e.insert(t);else{var a=o(e.insert||"head");if(!a)throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");a.appendChild(t)}return t}var u,f=(u=[],function(e,t){return u[e]=t,u.filter(Boolean).join("\n")});function d(e,t,n,r){var i=n?"":r.media?"@media ".concat(r.media," {").concat(r.css,"}"):r.css;if(e.styleSheet)e.styleSheet.cssText=f(t,i);else{var o=document.createTextNode(i),a=e.childNodes;a[t]&&e.removeChild(a[t]),a.length?e.insertBefore(o,a[t]):e.appendChild(o)}}function p(e,t,n){var r=n.css,i=n.media,o=n.sourceMap;if(i?e.setAttribute("media",i):e.removeAttribute("media"),o&&"undefined"!=typeof btoa&&(r+="\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(o))))," */")),e.styleSheet)e.styleSheet.cssText=r;else{for(;e.firstChild;)e.removeChild(e.firstChild);e.appendChild(document.createTextNode(r))}}var h=null,v=0;function g(e,t){var n,r,i;if(t.singleton){var o=v++;n=h||(h=l(t)),r=d.bind(null,n,o,!1),i=d.bind(null,n,o,!0)}else n=l(t),r=p.bind(null,n,t),i=function(){!function(e){if(null===e.parentNode)return!1;e.parentNode.removeChild(e)}(n)};return r(e),function(t){if(t){if(t.css===e.css&&t.media===e.media&&t.sourceMap===e.sourceMap)return;r(e=t)}else i()}}e.exports=function(e,t){(t=t||{}).singleton||"boolean"==typeof t.singleton||(t.singleton=i());var n=c(e=e||[],t);return function(e){if(e=e||[],"[object Array]"===Object.prototype.toString.call(e)){for(var r=0;r<n.length;r++){var i=s(n[r]);a[i].references--}for(var o=c(e,t),l=0;l<n.length;l++){var u=s(n[l]);0===a[u].references&&(a[u].updater(),a.splice(u,1))}n=o}}}},718:function(e,t,n){e.exports=function(){"use strict";var e=Object.freeze({});function t(e){return null==e}function r(e){return null!=e}function i(e){return!0===e}function o(e){return"string"==typeof e||"number"==typeof e||"symbol"==typeof e||"boolean"==typeof e}function a(e){return null!==e&&"object"==typeof e}var s=Object.prototype.toString;function c(e){return"[object Object]"===s.call(e)}function l(e){var t=parseFloat(String(e));return t>=0&&Math.floor(t)===t&&isFinite(e)}function u(e){return r(e)&&"function"==typeof e.then&&"function"==typeof e.catch}function f(e){return null==e?"":Array.isArray(e)||c(e)&&e.toString===s?JSON.stringify(e,null,2):String(e)}function d(e){var t=parseFloat(e);return isNaN(t)?e:t}function p(e,t){for(var n=Object.create(null),r=e.split(","),i=0;i<r.length;i++)n[r[i]]=!0;return t?function(e){return n[e.toLowerCase()]}:function(e){return n[e]}}var h=p("key,ref,slot,slot-scope,is");function v(e,t){if(e.length){var n=e.indexOf(t);if(n>-1)return e.splice(n,1)}}var g=Object.prototype.hasOwnProperty;function m(e,t){return g.call(e,t)}function b(e){var t=Object.create(null);return function(n){return t[n]||(t[n]=e(n))}}var y=/-(\w)/g,w=b((function(e){return e.replace(y,(function(e,t){return t?t.toUpperCase():""}))})),A=b((function(e){return e.charAt(0).toUpperCase()+e.slice(1)})),x=/\B([A-Z])/g,E=b((function(e){return e.replace(x,"-$1").toLowerCase()})),C=Function.prototype.bind?function(e,t){return e.bind(t)}:function(e,t){function n(n){var r=arguments.length;return r?r>1?e.apply(t,arguments):e.call(t,n):e.call(t)}return n._length=e.length,n};function k(e,t){t=t||0;for(var n=e.length-t,r=new Array(n);n--;)r[n]=e[n+t];return r}function S(e,t){for(var n in t)e[n]=t[n];return e}function O(e){for(var t={},n=0;n<e.length;n++)e[n]&&S(t,e[n]);return t}function _(e,t,n){}var T=function(e,t,n){return!1},I=function(e){return e};function j(e,t){if(e===t)return!0;var n=a(e),r=a(t);if(!n||!r)return!n&&!r&&String(e)===String(t);try{var i=Array.isArray(e),o=Array.isArray(t);if(i&&o)return e.length===t.length&&e.every((function(e,n){return j(e,t[n])}));if(e instanceof Date&&t instanceof Date)return e.getTime()===t.getTime();if(i||o)return!1;var s=Object.keys(e),c=Object.keys(t);return s.length===c.length&&s.every((function(n){return j(e[n],t[n])}))}catch(e){return!1}}function B(e,t){for(var n=0;n<e.length;n++)if(j(e[n],t))return n;return-1}function M(e){var t=!1;return function(){t||(t=!0,e.apply(this,arguments))}}var P="data-server-rendered",R=["component","directive","filter"],N=["beforeCreate","created","beforeMount","mounted","beforeUpdate","updated","beforeDestroy","destroyed","activated","deactivated","errorCaptured","serverPrefetch"],D={optionMergeStrategies:Object.create(null),silent:!1,productionTip:!1,devtools:!1,performance:!1,errorHandler:null,warnHandler:null,ignoredElements:[],keyCodes:Object.create(null),isReservedTag:T,isReservedAttr:T,isUnknownElement:T,getTagNamespace:_,parsePlatformTagName:I,mustUseProp:T,async:!0,_lifecycleHooks:N};function F(e,t,n,r){Object.defineProperty(e,t,{value:n,enumerable:!!r,writable:!0,configurable:!0})}var V,U=new RegExp("[^"+/a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/.source+".$_\\d]"),L="__proto__"in{},q="undefined"!=typeof window,Q="undefined"!=typeof WXEnvironment&&!!WXEnvironment.platform,H=Q&&WXEnvironment.platform.toLowerCase(),J=q&&window.navigator.userAgent.toLowerCase(),z=J&&/msie|trident/.test(J),W=J&&J.indexOf("msie 9.0")>0,G=J&&J.indexOf("edge/")>0,X=(J&&J.indexOf("android"),J&&/iphone|ipad|ipod|ios/.test(J)||"ios"===H),K=(J&&/chrome\/\d+/.test(J),J&&/phantomjs/.test(J),J&&J.match(/firefox\/(\d+)/)),Y={}.watch,Z=!1;if(q)try{var $={};Object.defineProperty($,"passive",{get:function(){Z=!0}}),window.addEventListener("test-passive",null,$)}catch(e){}var ee=function(){return void 0===V&&(V=!q&&!Q&&void 0!==n.g&&n.g.process&&"server"===n.g.process.env.VUE_ENV),V},te=q&&window.__VUE_DEVTOOLS_GLOBAL_HOOK__;function ne(e){return"function"==typeof e&&/native code/.test(e.toString())}var re,ie="undefined"!=typeof Symbol&&ne(Symbol)&&"undefined"!=typeof Reflect&&ne(Reflect.ownKeys);re="undefined"!=typeof Set&&ne(Set)?Set:function(){function e(){this.set=Object.create(null)}return e.prototype.has=function(e){return!0===this.set[e]},e.prototype.add=function(e){this.set[e]=!0},e.prototype.clear=function(){this.set=Object.create(null)},e}();var oe=_,ae=0,se=function(){this.id=ae++,this.subs=[]};se.prototype.addSub=function(e){this.subs.push(e)},se.prototype.removeSub=function(e){v(this.subs,e)},se.prototype.depend=function(){se.target&&se.target.addDep(this)},se.prototype.notify=function(){for(var e=this.subs.slice(),t=0,n=e.length;t<n;t++)e[t].update()},se.target=null;var ce=[];function le(e){ce.push(e),se.target=e}function ue(){ce.pop(),se.target=ce[ce.length-1]}var fe=function(e,t,n,r,i,o,a,s){this.tag=e,this.data=t,this.children=n,this.text=r,this.elm=i,this.ns=void 0,this.context=o,this.fnContext=void 0,this.fnOptions=void 0,this.fnScopeId=void 0,this.key=t&&t.key,this.componentOptions=a,this.componentInstance=void 0,this.parent=void 0,this.raw=!1,this.isStatic=!1,this.isRootInsert=!0,this.isComment=!1,this.isCloned=!1,this.isOnce=!1,this.asyncFactory=s,this.asyncMeta=void 0,this.isAsyncPlaceholder=!1},de={child:{configurable:!0}};de.child.get=function(){return this.componentInstance},Object.defineProperties(fe.prototype,de);var pe=function(e){void 0===e&&(e="");var t=new fe;return t.text=e,t.isComment=!0,t};function he(e){return new fe(void 0,void 0,void 0,String(e))}function ve(e){var t=new fe(e.tag,e.data,e.children&&e.children.slice(),e.text,e.elm,e.context,e.componentOptions,e.asyncFactory);return t.ns=e.ns,t.isStatic=e.isStatic,t.key=e.key,t.isComment=e.isComment,t.fnContext=e.fnContext,t.fnOptions=e.fnOptions,t.fnScopeId=e.fnScopeId,t.asyncMeta=e.asyncMeta,t.isCloned=!0,t}var ge=Array.prototype,me=Object.create(ge);["push","pop","shift","unshift","splice","sort","reverse"].forEach((function(e){var t=ge[e];F(me,e,(function(){for(var n=[],r=arguments.length;r--;)n[r]=arguments[r];var i,o=t.apply(this,n),a=this.__ob__;switch(e){case"push":case"unshift":i=n;break;case"splice":i=n.slice(2)}return i&&a.observeArray(i),a.dep.notify(),o}))}));var be=Object.getOwnPropertyNames(me),ye=!0;function we(e){ye=e}var Ae=function(e){var t;this.value=e,this.dep=new se,this.vmCount=0,F(e,"__ob__",this),Array.isArray(e)?(L?(t=me,e.__proto__=t):function(e,t,n){for(var r=0,i=n.length;r<i;r++){var o=n[r];F(e,o,t[o])}}(e,me,be),this.observeArray(e)):this.walk(e)};function xe(e,t){var n;if(a(e)&&!(e instanceof fe))return m(e,"__ob__")&&e.__ob__ instanceof Ae?n=e.__ob__:ye&&!ee()&&(Array.isArray(e)||c(e))&&Object.isExtensible(e)&&!e._isVue&&(n=new Ae(e)),t&&n&&n.vmCount++,n}function Ee(e,t,n,r,i){var o=new se,a=Object.getOwnPropertyDescriptor(e,t);if(!a||!1!==a.configurable){var s=a&&a.get,c=a&&a.set;s&&!c||2!==arguments.length||(n=e[t]);var l=!i&&xe(n);Object.defineProperty(e,t,{enumerable:!0,configurable:!0,get:function(){var t=s?s.call(e):n;return se.target&&(o.depend(),l&&(l.dep.depend(),Array.isArray(t)&&function e(t){for(var n=void 0,r=0,i=t.length;r<i;r++)(n=t[r])&&n.__ob__&&n.__ob__.dep.depend(),Array.isArray(n)&&e(n)}(t))),t},set:function(t){var r=s?s.call(e):n;t===r||t!=t&&r!=r||s&&!c||(c?c.call(e,t):n=t,l=!i&&xe(t),o.notify())}})}}function Ce(e,t,n){if(Array.isArray(e)&&l(t))return e.length=Math.max(e.length,t),e.splice(t,1,n),n;if(t in e&&!(t in Object.prototype))return e[t]=n,n;var r=e.__ob__;return e._isVue||r&&r.vmCount?n:r?(Ee(r.value,t,n),r.dep.notify(),n):(e[t]=n,n)}function ke(e,t){if(Array.isArray(e)&&l(t))e.splice(t,1);else{var n=e.__ob__;e._isVue||n&&n.vmCount||m(e,t)&&(delete e[t],n&&n.dep.notify())}}Ae.prototype.walk=function(e){for(var t=Object.keys(e),n=0;n<t.length;n++)Ee(e,t[n])},Ae.prototype.observeArray=function(e){for(var t=0,n=e.length;t<n;t++)xe(e[t])};var Se=D.optionMergeStrategies;function Oe(e,t){if(!t)return e;for(var n,r,i,o=ie?Reflect.ownKeys(t):Object.keys(t),a=0;a<o.length;a++)"__ob__"!==(n=o[a])&&(r=e[n],i=t[n],m(e,n)?r!==i&&c(r)&&c(i)&&Oe(r,i):Ce(e,n,i));return e}function _e(e,t,n){return n?function(){var r="function"==typeof t?t.call(n,n):t,i="function"==typeof e?e.call(n,n):e;return r?Oe(r,i):i}:t?e?function(){return Oe("function"==typeof t?t.call(this,this):t,"function"==typeof e?e.call(this,this):e)}:t:e}function Te(e,t){var n=t?e?e.concat(t):Array.isArray(t)?t:[t]:e;return n?function(e){for(var t=[],n=0;n<e.length;n++)-1===t.indexOf(e[n])&&t.push(e[n]);return t}(n):n}function Ie(e,t,n,r){var i=Object.create(e||null);return t?S(i,t):i}Se.data=function(e,t,n){return n?_e(e,t,n):t&&"function"!=typeof t?e:_e(e,t)},N.forEach((function(e){Se[e]=Te})),R.forEach((function(e){Se[e+"s"]=Ie})),Se.watch=function(e,t,n,r){if(e===Y&&(e=void 0),t===Y&&(t=void 0),!t)return Object.create(e||null);if(!e)return t;var i={};for(var o in S(i,e),t){var a=i[o],s=t[o];a&&!Array.isArray(a)&&(a=[a]),i[o]=a?a.concat(s):Array.isArray(s)?s:[s]}return i},Se.props=Se.methods=Se.inject=Se.computed=function(e,t,n,r){if(!e)return t;var i=Object.create(null);return S(i,e),t&&S(i,t),i},Se.provide=_e;var je=function(e,t){return void 0===t?e:t};function Be(e,t,n){if("function"==typeof t&&(t=t.options),function(e,t){var n=e.props;if(n){var r,i,o={};if(Array.isArray(n))for(r=n.length;r--;)"string"==typeof(i=n[r])&&(o[w(i)]={type:null});else if(c(n))for(var a in n)i=n[a],o[w(a)]=c(i)?i:{type:i};e.props=o}}(t),function(e,t){var n=e.inject;if(n){var r=e.inject={};if(Array.isArray(n))for(var i=0;i<n.length;i++)r[n[i]]={from:n[i]};else if(c(n))for(var o in n){var a=n[o];r[o]=c(a)?S({from:o},a):{from:a}}}}(t),function(e){var t=e.directives;if(t)for(var n in t){var r=t[n];"function"==typeof r&&(t[n]={bind:r,update:r})}}(t),!t._base&&(t.extends&&(e=Be(e,t.extends,n)),t.mixins))for(var r=0,i=t.mixins.length;r<i;r++)e=Be(e,t.mixins[r],n);var o,a={};for(o in e)s(o);for(o in t)m(e,o)||s(o);function s(r){var i=Se[r]||je;a[r]=i(e[r],t[r],n,r)}return a}function Me(e,t,n,r){if("string"==typeof n){var i=e[t];if(m(i,n))return i[n];var o=w(n);if(m(i,o))return i[o];var a=A(o);return m(i,a)?i[a]:i[n]||i[o]||i[a]}}function Pe(e,t,n,r){var i=t[e],o=!m(n,e),a=n[e],s=De(Boolean,i.type);if(s>-1)if(o&&!m(i,"default"))a=!1;else if(""===a||a===E(e)){var c=De(String,i.type);(c<0||s<c)&&(a=!0)}if(void 0===a){a=function(e,t,n){if(m(t,"default")){var r=t.default;return e&&e.$options.propsData&&void 0===e.$options.propsData[n]&&void 0!==e._props[n]?e._props[n]:"function"==typeof r&&"Function"!==Re(t.type)?r.call(e):r}}(r,i,e);var l=ye;we(!0),xe(a),we(l)}return a}function Re(e){var t=e&&e.toString().match(/^\s*function (\w+)/);return t?t[1]:""}function Ne(e,t){return Re(e)===Re(t)}function De(e,t){if(!Array.isArray(t))return Ne(t,e)?0:-1;for(var n=0,r=t.length;n<r;n++)if(Ne(t[n],e))return n;return-1}function Fe(e,t,n){le();try{if(t)for(var r=t;r=r.$parent;){var i=r.$options.errorCaptured;if(i)for(var o=0;o<i.length;o++)try{if(!1===i[o].call(r,e,t,n))return}catch(e){Ue(e,r,"errorCaptured hook")}}Ue(e,t,n)}finally{ue()}}function Ve(e,t,n,r,i){var o;try{(o=n?e.apply(t,n):e.call(t))&&!o._isVue&&u(o)&&!o._handled&&(o.catch((function(e){return Fe(e,r,i+" (Promise/async)")})),o._handled=!0)}catch(e){Fe(e,r,i)}return o}function Ue(e,t,n){if(D.errorHandler)try{return D.errorHandler.call(null,e,t,n)}catch(t){t!==e&&Le(t,null,"config.errorHandler")}Le(e,t,n)}function Le(e,t,n){if(!q&&!Q||"undefined"==typeof console)throw e;console.error(e)}var qe,Qe=!1,He=[],Je=!1;function ze(){Je=!1;var e=He.slice(0);He.length=0;for(var t=0;t<e.length;t++)e[t]()}if("undefined"!=typeof Promise&&ne(Promise)){var We=Promise.resolve();qe=function(){We.then(ze),X&&setTimeout(_)},Qe=!0}else if(z||"undefined"==typeof MutationObserver||!ne(MutationObserver)&&"[object MutationObserverConstructor]"!==MutationObserver.toString())qe="undefined"!=typeof setImmediate&&ne(setImmediate)?function(){setImmediate(ze)}:function(){setTimeout(ze,0)};else{var Ge=1,Xe=new MutationObserver(ze),Ke=document.createTextNode(String(Ge));Xe.observe(Ke,{characterData:!0}),qe=function(){Ge=(Ge+1)%2,Ke.data=String(Ge)},Qe=!0}function Ye(e,t){var n;if(He.push((function(){if(e)try{e.call(t)}catch(e){Fe(e,t,"nextTick")}else n&&n(t)})),Je||(Je=!0,qe()),!e&&"undefined"!=typeof Promise)return new Promise((function(e){n=e}))}var Ze=new re;function $e(e){!function e(t,n){var r,i,o=Array.isArray(t);if(!(!o&&!a(t)||Object.isFrozen(t)||t instanceof fe)){if(t.__ob__){var s=t.__ob__.dep.id;if(n.has(s))return;n.add(s)}if(o)for(r=t.length;r--;)e(t[r],n);else for(r=(i=Object.keys(t)).length;r--;)e(t[i[r]],n)}}(e,Ze),Ze.clear()}var et=b((function(e){var t="&"===e.charAt(0),n="~"===(e=t?e.slice(1):e).charAt(0),r="!"===(e=n?e.slice(1):e).charAt(0);return{name:e=r?e.slice(1):e,once:n,capture:r,passive:t}}));function tt(e,t){function n(){var e=arguments,r=n.fns;if(!Array.isArray(r))return Ve(r,null,arguments,t,"v-on handler");for(var i=r.slice(),o=0;o<i.length;o++)Ve(i[o],null,e,t,"v-on handler")}return n.fns=e,n}function nt(e,n,r,o,a,s){var c,l,u,f;for(c in e)l=e[c],u=n[c],f=et(c),t(l)||(t(u)?(t(l.fns)&&(l=e[c]=tt(l,s)),i(f.once)&&(l=e[c]=a(f.name,l,f.capture)),r(f.name,l,f.capture,f.passive,f.params)):l!==u&&(u.fns=l,e[c]=u));for(c in n)t(e[c])&&o((f=et(c)).name,n[c],f.capture)}function rt(e,n,o){var a;e instanceof fe&&(e=e.data.hook||(e.data.hook={}));var s=e[n];function c(){o.apply(this,arguments),v(a.fns,c)}t(s)?a=tt([c]):r(s.fns)&&i(s.merged)?(a=s).fns.push(c):a=tt([s,c]),a.merged=!0,e[n]=a}function it(e,t,n,i,o){if(r(t)){if(m(t,n))return e[n]=t[n],o||delete t[n],!0;if(m(t,i))return e[n]=t[i],o||delete t[i],!0}return!1}function ot(e){return o(e)?[he(e)]:Array.isArray(e)?function e(n,a){var s,c,l,u,f=[];for(s=0;s<n.length;s++)t(c=n[s])||"boolean"==typeof c||(u=f[l=f.length-1],Array.isArray(c)?c.length>0&&(at((c=e(c,(a||"")+"_"+s))[0])&&at(u)&&(f[l]=he(u.text+c[0].text),c.shift()),f.push.apply(f,c)):o(c)?at(u)?f[l]=he(u.text+c):""!==c&&f.push(he(c)):at(c)&&at(u)?f[l]=he(u.text+c.text):(i(n._isVList)&&r(c.tag)&&t(c.key)&&r(a)&&(c.key="__vlist"+a+"_"+s+"__"),f.push(c)));return f}(e):void 0}function at(e){return r(e)&&r(e.text)&&!1===e.isComment}function st(e,t){if(e){for(var n=Object.create(null),r=ie?Reflect.ownKeys(e):Object.keys(e),i=0;i<r.length;i++){var o=r[i];if("__ob__"!==o){for(var a=e[o].from,s=t;s;){if(s._provided&&m(s._provided,a)){n[o]=s._provided[a];break}s=s.$parent}if(!s&&"default"in e[o]){var c=e[o].default;n[o]="function"==typeof c?c.call(t):c}}}return n}}function ct(e,t){if(!e||!e.length)return{};for(var n={},r=0,i=e.length;r<i;r++){var o=e[r],a=o.data;if(a&&a.attrs&&a.attrs.slot&&delete a.attrs.slot,o.context!==t&&o.fnContext!==t||!a||null==a.slot)(n.default||(n.default=[])).push(o);else{var s=a.slot,c=n[s]||(n[s]=[]);"template"===o.tag?c.push.apply(c,o.children||[]):c.push(o)}}for(var l in n)n[l].every(lt)&&delete n[l];return n}function lt(e){return e.isComment&&!e.asyncFactory||" "===e.text}function ut(t,n,r){var i,o=Object.keys(n).length>0,a=t?!!t.$stable:!o,s=t&&t.$key;if(t){if(t._normalized)return t._normalized;if(a&&r&&r!==e&&s===r.$key&&!o&&!r.$hasNormal)return r;for(var c in i={},t)t[c]&&"$"!==c[0]&&(i[c]=ft(n,c,t[c]))}else i={};for(var l in n)l in i||(i[l]=dt(n,l));return t&&Object.isExtensible(t)&&(t._normalized=i),F(i,"$stable",a),F(i,"$key",s),F(i,"$hasNormal",o),i}function ft(e,t,n){var r=function(){var e=arguments.length?n.apply(null,arguments):n({});return(e=e&&"object"==typeof e&&!Array.isArray(e)?[e]:ot(e))&&(0===e.length||1===e.length&&e[0].isComment)?void 0:e};return n.proxy&&Object.defineProperty(e,t,{get:r,enumerable:!0,configurable:!0}),r}function dt(e,t){return function(){return e[t]}}function pt(e,t){var n,i,o,s,c;if(Array.isArray(e)||"string"==typeof e)for(n=new Array(e.length),i=0,o=e.length;i<o;i++)n[i]=t(e[i],i);else if("number"==typeof e)for(n=new Array(e),i=0;i<e;i++)n[i]=t(i+1,i);else if(a(e))if(ie&&e[Symbol.iterator]){n=[];for(var l=e[Symbol.iterator](),u=l.next();!u.done;)n.push(t(u.value,n.length)),u=l.next()}else for(s=Object.keys(e),n=new Array(s.length),i=0,o=s.length;i<o;i++)c=s[i],n[i]=t(e[c],c,i);return r(n)||(n=[]),n._isVList=!0,n}function ht(e,t,n,r){var i,o=this.$scopedSlots[e];o?(n=n||{},r&&(n=S(S({},r),n)),i=o(n)||t):i=this.$slots[e]||t;var a=n&&n.slot;return a?this.$createElement("template",{slot:a},i):i}function vt(e){return Me(this.$options,"filters",e)||I}function gt(e,t){return Array.isArray(e)?-1===e.indexOf(t):e!==t}function mt(e,t,n,r,i){var o=D.keyCodes[t]||n;return i&&r&&!D.keyCodes[t]?gt(i,r):o?gt(o,e):r?E(r)!==t:void 0}function bt(e,t,n,r,i){if(n&&a(n)){var o;Array.isArray(n)&&(n=O(n));var s=function(a){if("class"===a||"style"===a||h(a))o=e;else{var s=e.attrs&&e.attrs.type;o=r||D.mustUseProp(t,s,a)?e.domProps||(e.domProps={}):e.attrs||(e.attrs={})}var c=w(a),l=E(a);c in o||l in o||(o[a]=n[a],i&&((e.on||(e.on={}))["update:"+a]=function(e){n[a]=e}))};for(var c in n)s(c)}return e}function yt(e,t){var n=this._staticTrees||(this._staticTrees=[]),r=n[e];return r&&!t||At(r=n[e]=this.$options.staticRenderFns[e].call(this._renderProxy,null,this),"__static__"+e,!1),r}function wt(e,t,n){return At(e,"__once__"+t+(n?"_"+n:""),!0),e}function At(e,t,n){if(Array.isArray(e))for(var r=0;r<e.length;r++)e[r]&&"string"!=typeof e[r]&&xt(e[r],t+"_"+r,n);else xt(e,t,n)}function xt(e,t,n){e.isStatic=!0,e.key=t,e.isOnce=n}function Et(e,t){if(t&&c(t)){var n=e.on=e.on?S({},e.on):{};for(var r in t){var i=n[r],o=t[r];n[r]=i?[].concat(i,o):o}}return e}function Ct(e,t,n,r){t=t||{$stable:!n};for(var i=0;i<e.length;i++){var o=e[i];Array.isArray(o)?Ct(o,t,n):o&&(o.proxy&&(o.fn.proxy=!0),t[o.key]=o.fn)}return r&&(t.$key=r),t}function kt(e,t){for(var n=0;n<t.length;n+=2){var r=t[n];"string"==typeof r&&r&&(e[t[n]]=t[n+1])}return e}function St(e,t){return"string"==typeof e?t+e:e}function Ot(e){e._o=wt,e._n=d,e._s=f,e._l=pt,e._t=ht,e._q=j,e._i=B,e._m=yt,e._f=vt,e._k=mt,e._b=bt,e._v=he,e._e=pe,e._u=Ct,e._g=Et,e._d=kt,e._p=St}function _t(t,n,r,o,a){var s,c=this,l=a.options;m(o,"_uid")?(s=Object.create(o))._original=o:(s=o,o=o._original);var u=i(l._compiled),f=!u;this.data=t,this.props=n,this.children=r,this.parent=o,this.listeners=t.on||e,this.injections=st(l.inject,o),this.slots=function(){return c.$slots||ut(t.scopedSlots,c.$slots=ct(r,o)),c.$slots},Object.defineProperty(this,"scopedSlots",{enumerable:!0,get:function(){return ut(t.scopedSlots,this.slots())}}),u&&(this.$options=l,this.$slots=this.slots(),this.$scopedSlots=ut(t.scopedSlots,this.$slots)),l._scopeId?this._c=function(e,t,n,r){var i=Dt(s,e,t,n,r,f);return i&&!Array.isArray(i)&&(i.fnScopeId=l._scopeId,i.fnContext=o),i}:this._c=function(e,t,n,r){return Dt(s,e,t,n,r,f)}}function Tt(e,t,n,r,i){var o=ve(e);return o.fnContext=n,o.fnOptions=r,t.slot&&((o.data||(o.data={})).slot=t.slot),o}function It(e,t){for(var n in t)e[w(n)]=t[n]}Ot(_t.prototype);var jt={init:function(e,t){if(e.componentInstance&&!e.componentInstance._isDestroyed&&e.data.keepAlive){var n=e;jt.prepatch(n,n)}else(e.componentInstance=function(e,t){var n={_isComponent:!0,_parentVnode:e,parent:t},i=e.data.inlineTemplate;return r(i)&&(n.render=i.render,n.staticRenderFns=i.staticRenderFns),new e.componentOptions.Ctor(n)}(e,Wt)).$mount(t?e.elm:void 0,t)},prepatch:function(t,n){var r=n.componentOptions;!function(t,n,r,i,o){var a=i.data.scopedSlots,s=t.$scopedSlots,c=!!(a&&!a.$stable||s!==e&&!s.$stable||a&&t.$scopedSlots.$key!==a.$key),l=!!(o||t.$options._renderChildren||c);if(t.$options._parentVnode=i,t.$vnode=i,t._vnode&&(t._vnode.parent=i),t.$options._renderChildren=o,t.$attrs=i.data.attrs||e,t.$listeners=r||e,n&&t.$options.props){we(!1);for(var u=t._props,f=t.$options._propKeys||[],d=0;d<f.length;d++){var p=f[d],h=t.$options.props;u[p]=Pe(p,h,n,t)}we(!0),t.$options.propsData=n}r=r||e;var v=t.$options._parentListeners;t.$options._parentListeners=r,zt(t,r,v),l&&(t.$slots=ct(o,i.context),t.$forceUpdate())}(n.componentInstance=t.componentInstance,r.propsData,r.listeners,n,r.children)},insert:function(e){var t,n=e.context,r=e.componentInstance;r._isMounted||(r._isMounted=!0,Yt(r,"mounted")),e.data.keepAlive&&(n._isMounted?((t=r)._inactive=!1,$t.push(t)):Kt(r,!0))},destroy:function(e){var t=e.componentInstance;t._isDestroyed||(e.data.keepAlive?function e(t,n){if(!(n&&(t._directInactive=!0,Xt(t))||t._inactive)){t._inactive=!0;for(var r=0;r<t.$children.length;r++)e(t.$children[r]);Yt(t,"deactivated")}}(t,!0):t.$destroy())}},Bt=Object.keys(jt);function Mt(n,o,s,c,l){if(!t(n)){var f=s.$options._base;if(a(n)&&(n=f.extend(n)),"function"==typeof n){var d;if(t(n.cid)&&void 0===(n=function(e,n){if(i(e.error)&&r(e.errorComp))return e.errorComp;if(r(e.resolved))return e.resolved;var o=Vt;if(o&&r(e.owners)&&-1===e.owners.indexOf(o)&&e.owners.push(o),i(e.loading)&&r(e.loadingComp))return e.loadingComp;if(o&&!r(e.owners)){var s=e.owners=[o],c=!0,l=null,f=null;o.$on("hook:destroyed",(function(){return v(s,o)}));var d=function(e){for(var t=0,n=s.length;t<n;t++)s[t].$forceUpdate();e&&(s.length=0,null!==l&&(clearTimeout(l),l=null),null!==f&&(clearTimeout(f),f=null))},p=M((function(t){e.resolved=Ut(t,n),c?s.length=0:d(!0)})),h=M((function(t){r(e.errorComp)&&(e.error=!0,d(!0))})),g=e(p,h);return a(g)&&(u(g)?t(e.resolved)&&g.then(p,h):u(g.component)&&(g.component.then(p,h),r(g.error)&&(e.errorComp=Ut(g.error,n)),r(g.loading)&&(e.loadingComp=Ut(g.loading,n),0===g.delay?e.loading=!0:l=setTimeout((function(){l=null,t(e.resolved)&&t(e.error)&&(e.loading=!0,d(!1))}),g.delay||200)),r(g.timeout)&&(f=setTimeout((function(){f=null,t(e.resolved)&&h(null)}),g.timeout)))),c=!1,e.loading?e.loadingComp:e.resolved}}(d=n,f)))return function(e,t,n,r,i){var o=pe();return o.asyncFactory=e,o.asyncMeta={data:t,context:n,children:r,tag:i},o}(d,o,s,c,l);o=o||{},wn(n),r(o.model)&&function(e,t){var n=e.model&&e.model.prop||"value",i=e.model&&e.model.event||"input";(t.attrs||(t.attrs={}))[n]=t.model.value;var o=t.on||(t.on={}),a=o[i],s=t.model.callback;r(a)?(Array.isArray(a)?-1===a.indexOf(s):a!==s)&&(o[i]=[s].concat(a)):o[i]=s}(n.options,o);var p=function(e,n,i){var o=n.options.props;if(!t(o)){var a={},s=e.attrs,c=e.props;if(r(s)||r(c))for(var l in o){var u=E(l);it(a,c,l,u,!0)||it(a,s,l,u,!1)}return a}}(o,n);if(i(n.options.functional))return function(t,n,i,o,a){var s=t.options,c={},l=s.props;if(r(l))for(var u in l)c[u]=Pe(u,l,n||e);else r(i.attrs)&&It(c,i.attrs),r(i.props)&&It(c,i.props);var f=new _t(i,c,a,o,t),d=s.render.call(null,f._c,f);if(d instanceof fe)return Tt(d,i,f.parent,s);if(Array.isArray(d)){for(var p=ot(d)||[],h=new Array(p.length),v=0;v<p.length;v++)h[v]=Tt(p[v],i,f.parent,s);return h}}(n,p,o,s,c);var h=o.on;if(o.on=o.nativeOn,i(n.options.abstract)){var g=o.slot;o={},g&&(o.slot=g)}!function(e){for(var t=e.hook||(e.hook={}),n=0;n<Bt.length;n++){var r=Bt[n],i=t[r],o=jt[r];i===o||i&&i._merged||(t[r]=i?Pt(o,i):o)}}(o);var m=n.options.name||l;return new fe("vue-component-"+n.cid+(m?"-"+m:""),o,void 0,void 0,void 0,s,{Ctor:n,propsData:p,listeners:h,tag:l,children:c},d)}}}function Pt(e,t){var n=function(n,r){e(n,r),t(n,r)};return n._merged=!0,n}var Rt=1,Nt=2;function Dt(e,n,s,c,l,u){return(Array.isArray(s)||o(s))&&(l=c,c=s,s=void 0),i(u)&&(l=Nt),function(e,n,o,s,c){return r(o)&&r(o.__ob__)?pe():(r(o)&&r(o.is)&&(n=o.is),n?(Array.isArray(s)&&"function"==typeof s[0]&&((o=o||{}).scopedSlots={default:s[0]},s.length=0),c===Nt?s=ot(s):c===Rt&&(s=function(e){for(var t=0;t<e.length;t++)if(Array.isArray(e[t]))return Array.prototype.concat.apply([],e);return e}(s)),"string"==typeof n?(u=e.$vnode&&e.$vnode.ns||D.getTagNamespace(n),l=D.isReservedTag(n)?new fe(D.parsePlatformTagName(n),o,s,void 0,void 0,e):o&&o.pre||!r(f=Me(e.$options,"components",n))?new fe(n,o,s,void 0,void 0,e):Mt(f,o,e,s,n)):l=Mt(n,o,e,s),Array.isArray(l)?l:r(l)?(r(u)&&function e(n,o,a){if(n.ns=o,"foreignObject"===n.tag&&(o=void 0,a=!0),r(n.children))for(var s=0,c=n.children.length;s<c;s++){var l=n.children[s];r(l.tag)&&(t(l.ns)||i(a)&&"svg"!==l.tag)&&e(l,o,a)}}(l,u),r(o)&&function(e){a(e.style)&&$e(e.style),a(e.class)&&$e(e.class)}(o),l):pe()):pe());var l,u,f}(e,n,s,c,l)}var Ft,Vt=null;function Ut(e,t){return(e.__esModule||ie&&"Module"===e[Symbol.toStringTag])&&(e=e.default),a(e)?t.extend(e):e}function Lt(e){return e.isComment&&e.asyncFactory}function qt(e){if(Array.isArray(e))for(var t=0;t<e.length;t++){var n=e[t];if(r(n)&&(r(n.componentOptions)||Lt(n)))return n}}function Qt(e,t){Ft.$on(e,t)}function Ht(e,t){Ft.$off(e,t)}function Jt(e,t){var n=Ft;return function r(){null!==t.apply(null,arguments)&&n.$off(e,r)}}function zt(e,t,n){Ft=e,nt(t,n||{},Qt,Ht,Jt,e),Ft=void 0}var Wt=null;function Gt(e){var t=Wt;return Wt=e,function(){Wt=t}}function Xt(e){for(;e&&(e=e.$parent);)if(e._inactive)return!0;return!1}function Kt(e,t){if(t){if(e._directInactive=!1,Xt(e))return}else if(e._directInactive)return;if(e._inactive||null===e._inactive){e._inactive=!1;for(var n=0;n<e.$children.length;n++)Kt(e.$children[n]);Yt(e,"activated")}}function Yt(e,t){le();var n=e.$options[t],r=t+" hook";if(n)for(var i=0,o=n.length;i<o;i++)Ve(n[i],e,null,e,r);e._hasHookEvent&&e.$emit("hook:"+t),ue()}var Zt=[],$t=[],en={},tn=!1,nn=!1,rn=0,on=0,an=Date.now;if(q&&!z){var sn=window.performance;sn&&"function"==typeof sn.now&&an()>document.createEvent("Event").timeStamp&&(an=function(){return sn.now()})}function cn(){var e,t;for(on=an(),nn=!0,Zt.sort((function(e,t){return e.id-t.id})),rn=0;rn<Zt.length;rn++)(e=Zt[rn]).before&&e.before(),t=e.id,en[t]=null,e.run();var n=$t.slice(),r=Zt.slice();rn=Zt.length=$t.length=0,en={},tn=nn=!1,function(e){for(var t=0;t<e.length;t++)e[t]._inactive=!0,Kt(e[t],!0)}(n),function(e){for(var t=e.length;t--;){var n=e[t],r=n.vm;r._watcher===n&&r._isMounted&&!r._isDestroyed&&Yt(r,"updated")}}(r),te&&D.devtools&&te.emit("flush")}var ln=0,un=function(e,t,n,r,i){this.vm=e,i&&(e._watcher=this),e._watchers.push(this),r?(this.deep=!!r.deep,this.user=!!r.user,this.lazy=!!r.lazy,this.sync=!!r.sync,this.before=r.before):this.deep=this.user=this.lazy=this.sync=!1,this.cb=n,this.id=++ln,this.active=!0,this.dirty=this.lazy,this.deps=[],this.newDeps=[],this.depIds=new re,this.newDepIds=new re,this.expression="","function"==typeof t?this.getter=t:(this.getter=function(e){if(!U.test(e)){var t=e.split(".");return function(e){for(var n=0;n<t.length;n++){if(!e)return;e=e[t[n]]}return e}}}(t),this.getter||(this.getter=_)),this.value=this.lazy?void 0:this.get()};un.prototype.get=function(){var e;le(this);var t=this.vm;try{e=this.getter.call(t,t)}catch(e){if(!this.user)throw e;Fe(e,t,'getter for watcher "'+this.expression+'"')}finally{this.deep&&$e(e),ue(),this.cleanupDeps()}return e},un.prototype.addDep=function(e){var t=e.id;this.newDepIds.has(t)||(this.newDepIds.add(t),this.newDeps.push(e),this.depIds.has(t)||e.addSub(this))},un.prototype.cleanupDeps=function(){for(var e=this.deps.length;e--;){var t=this.deps[e];this.newDepIds.has(t.id)||t.removeSub(this)}var n=this.depIds;this.depIds=this.newDepIds,this.newDepIds=n,this.newDepIds.clear(),n=this.deps,this.deps=this.newDeps,this.newDeps=n,this.newDeps.length=0},un.prototype.update=function(){this.lazy?this.dirty=!0:this.sync?this.run():function(e){var t=e.id;if(null==en[t]){if(en[t]=!0,nn){for(var n=Zt.length-1;n>rn&&Zt[n].id>e.id;)n--;Zt.splice(n+1,0,e)}else Zt.push(e);tn||(tn=!0,Ye(cn))}}(this)},un.prototype.run=function(){if(this.active){var e=this.get();if(e!==this.value||a(e)||this.deep){var t=this.value;if(this.value=e,this.user)try{this.cb.call(this.vm,e,t)}catch(e){Fe(e,this.vm,'callback for watcher "'+this.expression+'"')}else this.cb.call(this.vm,e,t)}}},un.prototype.evaluate=function(){this.value=this.get(),this.dirty=!1},un.prototype.depend=function(){for(var e=this.deps.length;e--;)this.deps[e].depend()},un.prototype.teardown=function(){if(this.active){this.vm._isBeingDestroyed||v(this.vm._watchers,this);for(var e=this.deps.length;e--;)this.deps[e].removeSub(this);this.active=!1}};var fn={enumerable:!0,configurable:!0,get:_,set:_};function dn(e,t,n){fn.get=function(){return this[t][n]},fn.set=function(e){this[t][n]=e},Object.defineProperty(e,n,fn)}function pn(e){e._watchers=[];var t=e.$options;t.props&&function(e,t){var n=e.$options.propsData||{},r=e._props={},i=e.$options._propKeys=[];e.$parent&&we(!1);var o=function(o){i.push(o);var a=Pe(o,t,n,e);Ee(r,o,a),o in e||dn(e,"_props",o)};for(var a in t)o(a);we(!0)}(e,t.props),t.methods&&function(e,t){for(var n in e.$options.props,t)e[n]="function"!=typeof t[n]?_:C(t[n],e)}(e,t.methods),t.data?function(e){var t=e.$options.data;c(t=e._data="function"==typeof t?function(e,t){le();try{return e.call(t,t)}catch(e){return Fe(e,t,"data()"),{}}finally{ue()}}(t,e):t||{})||(t={});for(var n,r=Object.keys(t),i=e.$options.props,o=(e.$options.methods,r.length);o--;){var a=r[o];i&&m(i,a)||(n=void 0,36!==(n=(a+"").charCodeAt(0))&&95!==n&&dn(e,"_data",a))}xe(t,!0)}(e):xe(e._data={},!0),t.computed&&function(e,t){var n=e._computedWatchers=Object.create(null),r=ee();for(var i in t){var o=t[i],a="function"==typeof o?o:o.get;r||(n[i]=new un(e,a||_,_,hn)),i in e||vn(e,i,o)}}(e,t.computed),t.watch&&t.watch!==Y&&function(e,t){for(var n in t){var r=t[n];if(Array.isArray(r))for(var i=0;i<r.length;i++)bn(e,n,r[i]);else bn(e,n,r)}}(e,t.watch)}var hn={lazy:!0};function vn(e,t,n){var r=!ee();"function"==typeof n?(fn.get=r?gn(t):mn(n),fn.set=_):(fn.get=n.get?r&&!1!==n.cache?gn(t):mn(n.get):_,fn.set=n.set||_),Object.defineProperty(e,t,fn)}function gn(e){return function(){var t=this._computedWatchers&&this._computedWatchers[e];if(t)return t.dirty&&t.evaluate(),se.target&&t.depend(),t.value}}function mn(e){return function(){return e.call(this,this)}}function bn(e,t,n,r){return c(n)&&(r=n,n=n.handler),"string"==typeof n&&(n=e[n]),e.$watch(t,n,r)}var yn=0;function wn(e){var t=e.options;if(e.super){var n=wn(e.super);if(n!==e.superOptions){e.superOptions=n;var r=function(e){var t,n=e.options,r=e.sealedOptions;for(var i in n)n[i]!==r[i]&&(t||(t={}),t[i]=n[i]);return t}(e);r&&S(e.extendOptions,r),(t=e.options=Be(n,e.extendOptions)).name&&(t.components[t.name]=e)}}return t}function An(e){this._init(e)}function xn(e){e.cid=0;var t=1;e.extend=function(e){e=e||{};var n=this,r=n.cid,i=e._Ctor||(e._Ctor={});if(i[r])return i[r];var o=e.name||n.options.name,a=function(e){this._init(e)};return(a.prototype=Object.create(n.prototype)).constructor=a,a.cid=t++,a.options=Be(n.options,e),a.super=n,a.options.props&&function(e){var t=e.options.props;for(var n in t)dn(e.prototype,"_props",n)}(a),a.options.computed&&function(e){var t=e.options.computed;for(var n in t)vn(e.prototype,n,t[n])}(a),a.extend=n.extend,a.mixin=n.mixin,a.use=n.use,R.forEach((function(e){a[e]=n[e]})),o&&(a.options.components[o]=a),a.superOptions=n.options,a.extendOptions=e,a.sealedOptions=S({},a.options),i[r]=a,a}}function En(e){return e&&(e.Ctor.options.name||e.tag)}function Cn(e,t){return Array.isArray(e)?e.indexOf(t)>-1:"string"==typeof e?e.split(",").indexOf(t)>-1:(n=e,"[object RegExp]"===s.call(n)&&e.test(t));var n}function kn(e,t){var n=e.cache,r=e.keys,i=e._vnode;for(var o in n){var a=n[o];if(a){var s=En(a.componentOptions);s&&!t(s)&&Sn(n,o,r,i)}}}function Sn(e,t,n,r){var i=e[t];!i||r&&i.tag===r.tag||i.componentInstance.$destroy(),e[t]=null,v(n,t)}!function(t){t.prototype._init=function(t){var n=this;n._uid=yn++,n._isVue=!0,t&&t._isComponent?function(e,t){var n=e.$options=Object.create(e.constructor.options),r=t._parentVnode;n.parent=t.parent,n._parentVnode=r;var i=r.componentOptions;n.propsData=i.propsData,n._parentListeners=i.listeners,n._renderChildren=i.children,n._componentTag=i.tag,t.render&&(n.render=t.render,n.staticRenderFns=t.staticRenderFns)}(n,t):n.$options=Be(wn(n.constructor),t||{},n),n._renderProxy=n,n._self=n,function(e){var t=e.$options,n=t.parent;if(n&&!t.abstract){for(;n.$options.abstract&&n.$parent;)n=n.$parent;n.$children.push(e)}e.$parent=n,e.$root=n?n.$root:e,e.$children=[],e.$refs={},e._watcher=null,e._inactive=null,e._directInactive=!1,e._isMounted=!1,e._isDestroyed=!1,e._isBeingDestroyed=!1}(n),function(e){e._events=Object.create(null),e._hasHookEvent=!1;var t=e.$options._parentListeners;t&&zt(e,t)}(n),function(t){t._vnode=null,t._staticTrees=null;var n=t.$options,r=t.$vnode=n._parentVnode,i=r&&r.context;t.$slots=ct(n._renderChildren,i),t.$scopedSlots=e,t._c=function(e,n,r,i){return Dt(t,e,n,r,i,!1)},t.$createElement=function(e,n,r,i){return Dt(t,e,n,r,i,!0)};var o=r&&r.data;Ee(t,"$attrs",o&&o.attrs||e,null,!0),Ee(t,"$listeners",n._parentListeners||e,null,!0)}(n),Yt(n,"beforeCreate"),function(e){var t=st(e.$options.inject,e);t&&(we(!1),Object.keys(t).forEach((function(n){Ee(e,n,t[n])})),we(!0))}(n),pn(n),function(e){var t=e.$options.provide;t&&(e._provided="function"==typeof t?t.call(e):t)}(n),Yt(n,"created"),n.$options.el&&n.$mount(n.$options.el)}}(An),function(e){var t={get:function(){return this._data}},n={get:function(){return this._props}};Object.defineProperty(e.prototype,"$data",t),Object.defineProperty(e.prototype,"$props",n),e.prototype.$set=Ce,e.prototype.$delete=ke,e.prototype.$watch=function(e,t,n){if(c(t))return bn(this,e,t,n);(n=n||{}).user=!0;var r=new un(this,e,t,n);if(n.immediate)try{t.call(this,r.value)}catch(e){Fe(e,this,'callback for immediate watcher "'+r.expression+'"')}return function(){r.teardown()}}}(An),function(e){var t=/^hook:/;e.prototype.$on=function(e,n){var r=this;if(Array.isArray(e))for(var i=0,o=e.length;i<o;i++)r.$on(e[i],n);else(r._events[e]||(r._events[e]=[])).push(n),t.test(e)&&(r._hasHookEvent=!0);return r},e.prototype.$once=function(e,t){var n=this;function r(){n.$off(e,r),t.apply(n,arguments)}return r.fn=t,n.$on(e,r),n},e.prototype.$off=function(e,t){var n=this;if(!arguments.length)return n._events=Object.create(null),n;if(Array.isArray(e)){for(var r=0,i=e.length;r<i;r++)n.$off(e[r],t);return n}var o,a=n._events[e];if(!a)return n;if(!t)return n._events[e]=null,n;for(var s=a.length;s--;)if((o=a[s])===t||o.fn===t){a.splice(s,1);break}return n},e.prototype.$emit=function(e){var t=this._events[e];if(t){t=t.length>1?k(t):t;for(var n=k(arguments,1),r='event handler for "'+e+'"',i=0,o=t.length;i<o;i++)Ve(t[i],this,n,this,r)}return this}}(An),function(e){e.prototype._update=function(e,t){var n=this,r=n.$el,i=n._vnode,o=Gt(n);n._vnode=e,n.$el=i?n.__patch__(i,e):n.__patch__(n.$el,e,t,!1),o(),r&&(r.__vue__=null),n.$el&&(n.$el.__vue__=n),n.$vnode&&n.$parent&&n.$vnode===n.$parent._vnode&&(n.$parent.$el=n.$el)},e.prototype.$forceUpdate=function(){this._watcher&&this._watcher.update()},e.prototype.$destroy=function(){var e=this;if(!e._isBeingDestroyed){Yt(e,"beforeDestroy"),e._isBeingDestroyed=!0;var t=e.$parent;!t||t._isBeingDestroyed||e.$options.abstract||v(t.$children,e),e._watcher&&e._watcher.teardown();for(var n=e._watchers.length;n--;)e._watchers[n].teardown();e._data.__ob__&&e._data.__ob__.vmCount--,e._isDestroyed=!0,e.__patch__(e._vnode,null),Yt(e,"destroyed"),e.$off(),e.$el&&(e.$el.__vue__=null),e.$vnode&&(e.$vnode.parent=null)}}}(An),function(e){Ot(e.prototype),e.prototype.$nextTick=function(e){return Ye(e,this)},e.prototype._render=function(){var e,t=this,n=t.$options,r=n.render,i=n._parentVnode;i&&(t.$scopedSlots=ut(i.data.scopedSlots,t.$slots,t.$scopedSlots)),t.$vnode=i;try{Vt=t,e=r.call(t._renderProxy,t.$createElement)}catch(n){Fe(n,t,"render"),e=t._vnode}finally{Vt=null}return Array.isArray(e)&&1===e.length&&(e=e[0]),e instanceof fe||(e=pe()),e.parent=i,e}}(An);var On=[String,RegExp,Array],_n={KeepAlive:{name:"keep-alive",abstract:!0,props:{include:On,exclude:On,max:[String,Number]},created:function(){this.cache=Object.create(null),this.keys=[]},destroyed:function(){for(var e in this.cache)Sn(this.cache,e,this.keys)},mounted:function(){var e=this;this.$watch("include",(function(t){kn(e,(function(e){return Cn(t,e)}))})),this.$watch("exclude",(function(t){kn(e,(function(e){return!Cn(t,e)}))}))},render:function(){var e=this.$slots.default,t=qt(e),n=t&&t.componentOptions;if(n){var r=En(n),i=this.include,o=this.exclude;if(i&&(!r||!Cn(i,r))||o&&r&&Cn(o,r))return t;var a=this.cache,s=this.keys,c=null==t.key?n.Ctor.cid+(n.tag?"::"+n.tag:""):t.key;a[c]?(t.componentInstance=a[c].componentInstance,v(s,c),s.push(c)):(a[c]=t,s.push(c),this.max&&s.length>parseInt(this.max)&&Sn(a,s[0],s,this._vnode)),t.data.keepAlive=!0}return t||e&&e[0]}}};!function(e){var t={get:function(){return D}};Object.defineProperty(e,"config",t),e.util={warn:oe,extend:S,mergeOptions:Be,defineReactive:Ee},e.set=Ce,e.delete=ke,e.nextTick=Ye,e.observable=function(e){return xe(e),e},e.options=Object.create(null),R.forEach((function(t){e.options[t+"s"]=Object.create(null)})),e.options._base=e,S(e.options.components,_n),function(e){e.use=function(e){var t=this._installedPlugins||(this._installedPlugins=[]);if(t.indexOf(e)>-1)return this;var n=k(arguments,1);return n.unshift(this),"function"==typeof e.install?e.install.apply(e,n):"function"==typeof e&&e.apply(null,n),t.push(e),this}}(e),function(e){e.mixin=function(e){return this.options=Be(this.options,e),this}}(e),xn(e),function(e){R.forEach((function(t){e[t]=function(e,n){return n?("component"===t&&c(n)&&(n.name=n.name||e,n=this.options._base.extend(n)),"directive"===t&&"function"==typeof n&&(n={bind:n,update:n}),this.options[t+"s"][e]=n,n):this.options[t+"s"][e]}}))}(e)}(An),Object.defineProperty(An.prototype,"$isServer",{get:ee}),Object.defineProperty(An.prototype,"$ssrContext",{get:function(){return this.$vnode&&this.$vnode.ssrContext}}),Object.defineProperty(An,"FunctionalRenderContext",{value:_t}),An.version="2.6.12";var Tn=p("style,class"),In=p("input,textarea,option,select,progress"),jn=p("contenteditable,draggable,spellcheck"),Bn=p("events,caret,typing,plaintext-only"),Mn=function(e,t){return Fn(t)||"false"===t?"false":"contenteditable"===e&&Bn(t)?t:"true"},Pn=p("allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,defaultchecked,defaultmuted,defaultselected,defer,disabled,enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,translate,truespeed,typemustmatch,visible"),Rn="http://www.w3.org/1999/xlink",Nn=function(e){return":"===e.charAt(5)&&"xlink"===e.slice(0,5)},Dn=function(e){return Nn(e)?e.slice(6,e.length):""},Fn=function(e){return null==e||!1===e};function Vn(e){for(var t=e.data,n=e,i=e;r(i.componentInstance);)(i=i.componentInstance._vnode)&&i.data&&(t=Un(i.data,t));for(;r(n=n.parent);)n&&n.data&&(t=Un(t,n.data));return function(e,t){return r(e)||r(t)?Ln(e,qn(t)):""}(t.staticClass,t.class)}function Un(e,t){return{staticClass:Ln(e.staticClass,t.staticClass),class:r(e.class)?[e.class,t.class]:t.class}}function Ln(e,t){return e?t?e+" "+t:e:t||""}function qn(e){return Array.isArray(e)?function(e){for(var t,n="",i=0,o=e.length;i<o;i++)r(t=qn(e[i]))&&""!==t&&(n&&(n+=" "),n+=t);return n}(e):a(e)?function(e){var t="";for(var n in e)e[n]&&(t&&(t+=" "),t+=n);return t}(e):"string"==typeof e?e:""}var Qn={svg:"http://www.w3.org/2000/svg",math:"http://www.w3.org/1998/Math/MathML"},Hn=p("html,body,base,head,link,meta,style,title,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,menuitem,summary,content,element,shadow,template,blockquote,iframe,tfoot"),Jn=p("svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view",!0),zn=function(e){return Hn(e)||Jn(e)},Wn=Object.create(null),Gn=p("text,number,password,search,email,tel,url"),Xn=Object.freeze({createElement:function(e,t){var n=document.createElement(e);return"select"!==e||t.data&&t.data.attrs&&void 0!==t.data.attrs.multiple&&n.setAttribute("multiple","multiple"),n},createElementNS:function(e,t){return document.createElementNS(Qn[e],t)},createTextNode:function(e){return document.createTextNode(e)},createComment:function(e){return document.createComment(e)},insertBefore:function(e,t,n){e.insertBefore(t,n)},removeChild:function(e,t){e.removeChild(t)},appendChild:function(e,t){e.appendChild(t)},parentNode:function(e){return e.parentNode},nextSibling:function(e){return e.nextSibling},tagName:function(e){return e.tagName},setTextContent:function(e,t){e.textContent=t},setStyleScope:function(e,t){e.setAttribute(t,"")}}),Kn={create:function(e,t){Yn(t)},update:function(e,t){e.data.ref!==t.data.ref&&(Yn(e,!0),Yn(t))},destroy:function(e){Yn(e,!0)}};function Yn(e,t){var n=e.data.ref;if(r(n)){var i=e.context,o=e.componentInstance||e.elm,a=i.$refs;t?Array.isArray(a[n])?v(a[n],o):a[n]===o&&(a[n]=void 0):e.data.refInFor?Array.isArray(a[n])?a[n].indexOf(o)<0&&a[n].push(o):a[n]=[o]:a[n]=o}}var Zn=new fe("",{},[]),$n=["create","activate","update","remove","destroy"];function er(e,n){return e.key===n.key&&(e.tag===n.tag&&e.isComment===n.isComment&&r(e.data)===r(n.data)&&function(e,t){if("input"!==e.tag)return!0;var n,i=r(n=e.data)&&r(n=n.attrs)&&n.type,o=r(n=t.data)&&r(n=n.attrs)&&n.type;return i===o||Gn(i)&&Gn(o)}(e,n)||i(e.isAsyncPlaceholder)&&e.asyncFactory===n.asyncFactory&&t(n.asyncFactory.error))}function tr(e,t,n){var i,o,a={};for(i=t;i<=n;++i)r(o=e[i].key)&&(a[o]=i);return a}var nr={create:rr,update:rr,destroy:function(e){rr(e,Zn)}};function rr(e,t){(e.data.directives||t.data.directives)&&function(e,t){var n,r,i,o=e===Zn,a=t===Zn,s=or(e.data.directives,e.context),c=or(t.data.directives,t.context),l=[],u=[];for(n in c)r=s[n],i=c[n],r?(i.oldValue=r.value,i.oldArg=r.arg,sr(i,"update",t,e),i.def&&i.def.componentUpdated&&u.push(i)):(sr(i,"bind",t,e),i.def&&i.def.inserted&&l.push(i));if(l.length){var f=function(){for(var n=0;n<l.length;n++)sr(l[n],"inserted",t,e)};o?rt(t,"insert",f):f()}if(u.length&&rt(t,"postpatch",(function(){for(var n=0;n<u.length;n++)sr(u[n],"componentUpdated",t,e)})),!o)for(n in s)c[n]||sr(s[n],"unbind",e,e,a)}(e,t)}var ir=Object.create(null);function or(e,t){var n,r,i=Object.create(null);if(!e)return i;for(n=0;n<e.length;n++)(r=e[n]).modifiers||(r.modifiers=ir),i[ar(r)]=r,r.def=Me(t.$options,"directives",r.name);return i}function ar(e){return e.rawName||e.name+"."+Object.keys(e.modifiers||{}).join(".")}function sr(e,t,n,r,i){var o=e.def&&e.def[t];if(o)try{o(n.elm,e,n,r,i)}catch(r){Fe(r,n.context,"directive "+e.name+" "+t+" hook")}}var cr=[Kn,nr];function lr(e,n){var i=n.componentOptions;if(!(r(i)&&!1===i.Ctor.options.inheritAttrs||t(e.data.attrs)&&t(n.data.attrs))){var o,a,s=n.elm,c=e.data.attrs||{},l=n.data.attrs||{};for(o in r(l.__ob__)&&(l=n.data.attrs=S({},l)),l)a=l[o],c[o]!==a&&ur(s,o,a);for(o in(z||G)&&l.value!==c.value&&ur(s,"value",l.value),c)t(l[o])&&(Nn(o)?s.removeAttributeNS(Rn,Dn(o)):jn(o)||s.removeAttribute(o))}}function ur(e,t,n){e.tagName.indexOf("-")>-1?fr(e,t,n):Pn(t)?Fn(n)?e.removeAttribute(t):(n="allowfullscreen"===t&&"EMBED"===e.tagName?"true":t,e.setAttribute(t,n)):jn(t)?e.setAttribute(t,Mn(t,n)):Nn(t)?Fn(n)?e.removeAttributeNS(Rn,Dn(t)):e.setAttributeNS(Rn,t,n):fr(e,t,n)}function fr(e,t,n){if(Fn(n))e.removeAttribute(t);else{if(z&&!W&&"TEXTAREA"===e.tagName&&"placeholder"===t&&""!==n&&!e.__ieph){var r=function(t){t.stopImmediatePropagation(),e.removeEventListener("input",r)};e.addEventListener("input",r),e.__ieph=!0}e.setAttribute(t,n)}}var dr={create:lr,update:lr};function pr(e,n){var i=n.elm,o=n.data,a=e.data;if(!(t(o.staticClass)&&t(o.class)&&(t(a)||t(a.staticClass)&&t(a.class)))){var s=Vn(n),c=i._transitionClasses;r(c)&&(s=Ln(s,qn(c))),s!==i._prevClass&&(i.setAttribute("class",s),i._prevClass=s)}}var hr,vr={create:pr,update:pr},gr="__r",mr="__c";function br(e,t,n){var r=hr;return function i(){null!==t.apply(null,arguments)&&Ar(e,i,n,r)}}var yr=Qe&&!(K&&Number(K[1])<=53);function wr(e,t,n,r){if(yr){var i=on,o=t;t=o._wrapper=function(e){if(e.target===e.currentTarget||e.timeStamp>=i||e.timeStamp<=0||e.target.ownerDocument!==document)return o.apply(this,arguments)}}hr.addEventListener(e,t,Z?{capture:n,passive:r}:n)}function Ar(e,t,n,r){(r||hr).removeEventListener(e,t._wrapper||t,n)}function xr(e,n){if(!t(e.data.on)||!t(n.data.on)){var i=n.data.on||{},o=e.data.on||{};hr=n.elm,function(e){if(r(e[gr])){var t=z?"change":"input";e[t]=[].concat(e[gr],e[t]||[]),delete e[gr]}r(e[mr])&&(e.change=[].concat(e[mr],e.change||[]),delete e[mr])}(i),nt(i,o,wr,Ar,br,n.context),hr=void 0}}var Er,Cr={create:xr,update:xr};function kr(e,n){if(!t(e.data.domProps)||!t(n.data.domProps)){var i,o,a=n.elm,s=e.data.domProps||{},c=n.data.domProps||{};for(i in r(c.__ob__)&&(c=n.data.domProps=S({},c)),s)i in c||(a[i]="");for(i in c){if(o=c[i],"textContent"===i||"innerHTML"===i){if(n.children&&(n.children.length=0),o===s[i])continue;1===a.childNodes.length&&a.removeChild(a.childNodes[0])}if("value"===i&&"PROGRESS"!==a.tagName){a._value=o;var l=t(o)?"":String(o);Sr(a,l)&&(a.value=l)}else if("innerHTML"===i&&Jn(a.tagName)&&t(a.innerHTML)){(Er=Er||document.createElement("div")).innerHTML="<svg>"+o+"</svg>";for(var u=Er.firstChild;a.firstChild;)a.removeChild(a.firstChild);for(;u.firstChild;)a.appendChild(u.firstChild)}else if(o!==s[i])try{a[i]=o}catch(e){}}}}function Sr(e,t){return!e.composing&&("OPTION"===e.tagName||function(e,t){var n=!0;try{n=document.activeElement!==e}catch(e){}return n&&e.value!==t}(e,t)||function(e,t){var n=e.value,i=e._vModifiers;if(r(i)){if(i.number)return d(n)!==d(t);if(i.trim)return n.trim()!==t.trim()}return n!==t}(e,t))}var Or={create:kr,update:kr},_r=b((function(e){var t={},n=/:(.+)/;return e.split(/;(?![^(]*\))/g).forEach((function(e){if(e){var r=e.split(n);r.length>1&&(t[r[0].trim()]=r[1].trim())}})),t}));function Tr(e){var t=Ir(e.style);return e.staticStyle?S(e.staticStyle,t):t}function Ir(e){return Array.isArray(e)?O(e):"string"==typeof e?_r(e):e}var jr,Br=/^--/,Mr=/\s*!important$/,Pr=function(e,t,n){if(Br.test(t))e.style.setProperty(t,n);else if(Mr.test(n))e.style.setProperty(E(t),n.replace(Mr,""),"important");else{var r=Nr(t);if(Array.isArray(n))for(var i=0,o=n.length;i<o;i++)e.style[r]=n[i];else e.style[r]=n}},Rr=["Webkit","Moz","ms"],Nr=b((function(e){if(jr=jr||document.createElement("div").style,"filter"!==(e=w(e))&&e in jr)return e;for(var t=e.charAt(0).toUpperCase()+e.slice(1),n=0;n<Rr.length;n++){var r=Rr[n]+t;if(r in jr)return r}}));function Dr(e,n){var i=n.data,o=e.data;if(!(t(i.staticStyle)&&t(i.style)&&t(o.staticStyle)&&t(o.style))){var a,s,c=n.elm,l=o.staticStyle,u=o.normalizedStyle||o.style||{},f=l||u,d=Ir(n.data.style)||{};n.data.normalizedStyle=r(d.__ob__)?S({},d):d;var p=function(e,t){for(var n,r={},i=e;i.componentInstance;)(i=i.componentInstance._vnode)&&i.data&&(n=Tr(i.data))&&S(r,n);(n=Tr(e.data))&&S(r,n);for(var o=e;o=o.parent;)o.data&&(n=Tr(o.data))&&S(r,n);return r}(n);for(s in f)t(p[s])&&Pr(c,s,"");for(s in p)(a=p[s])!==f[s]&&Pr(c,s,null==a?"":a)}}var Fr={create:Dr,update:Dr},Vr=/\s+/;function Ur(e,t){if(t&&(t=t.trim()))if(e.classList)t.indexOf(" ")>-1?t.split(Vr).forEach((function(t){return e.classList.add(t)})):e.classList.add(t);else{var n=" "+(e.getAttribute("class")||"")+" ";n.indexOf(" "+t+" ")<0&&e.setAttribute("class",(n+t).trim())}}function Lr(e,t){if(t&&(t=t.trim()))if(e.classList)t.indexOf(" ")>-1?t.split(Vr).forEach((function(t){return e.classList.remove(t)})):e.classList.remove(t),e.classList.length||e.removeAttribute("class");else{for(var n=" "+(e.getAttribute("class")||"")+" ",r=" "+t+" ";n.indexOf(r)>=0;)n=n.replace(r," ");(n=n.trim())?e.setAttribute("class",n):e.removeAttribute("class")}}function qr(e){if(e){if("object"==typeof e){var t={};return!1!==e.css&&S(t,Qr(e.name||"v")),S(t,e),t}return"string"==typeof e?Qr(e):void 0}}var Qr=b((function(e){return{enterClass:e+"-enter",enterToClass:e+"-enter-to",enterActiveClass:e+"-enter-active",leaveClass:e+"-leave",leaveToClass:e+"-leave-to",leaveActiveClass:e+"-leave-active"}})),Hr=q&&!W,Jr="transition",zr="animation",Wr="transition",Gr="transitionend",Xr="animation",Kr="animationend";Hr&&(void 0===window.ontransitionend&&void 0!==window.onwebkittransitionend&&(Wr="WebkitTransition",Gr="webkitTransitionEnd"),void 0===window.onanimationend&&void 0!==window.onwebkitanimationend&&(Xr="WebkitAnimation",Kr="webkitAnimationEnd"));var Yr=q?window.requestAnimationFrame?window.requestAnimationFrame.bind(window):setTimeout:function(e){return e()};function Zr(e){Yr((function(){Yr(e)}))}function $r(e,t){var n=e._transitionClasses||(e._transitionClasses=[]);n.indexOf(t)<0&&(n.push(t),Ur(e,t))}function ei(e,t){e._transitionClasses&&v(e._transitionClasses,t),Lr(e,t)}function ti(e,t,n){var r=ri(e,t),i=r.type,o=r.timeout,a=r.propCount;if(!i)return n();var s=i===Jr?Gr:Kr,c=0,l=function(){e.removeEventListener(s,u),n()},u=function(t){t.target===e&&++c>=a&&l()};setTimeout((function(){c<a&&l()}),o+1),e.addEventListener(s,u)}var ni=/\b(transform|all)(,|$)/;function ri(e,t){var n,r=window.getComputedStyle(e),i=(r[Wr+"Delay"]||"").split(", "),o=(r[Wr+"Duration"]||"").split(", "),a=ii(i,o),s=(r[Xr+"Delay"]||"").split(", "),c=(r[Xr+"Duration"]||"").split(", "),l=ii(s,c),u=0,f=0;return t===Jr?a>0&&(n=Jr,u=a,f=o.length):t===zr?l>0&&(n=zr,u=l,f=c.length):f=(n=(u=Math.max(a,l))>0?a>l?Jr:zr:null)?n===Jr?o.length:c.length:0,{type:n,timeout:u,propCount:f,hasTransform:n===Jr&&ni.test(r[Wr+"Property"])}}function ii(e,t){for(;e.length<t.length;)e=e.concat(e);return Math.max.apply(null,t.map((function(t,n){return oi(t)+oi(e[n])})))}function oi(e){return 1e3*Number(e.slice(0,-1).replace(",","."))}function ai(e,n){var i=e.elm;r(i._leaveCb)&&(i._leaveCb.cancelled=!0,i._leaveCb());var o=qr(e.data.transition);if(!t(o)&&!r(i._enterCb)&&1===i.nodeType){for(var s=o.css,c=o.type,l=o.enterClass,u=o.enterToClass,f=o.enterActiveClass,p=o.appearClass,h=o.appearToClass,v=o.appearActiveClass,g=o.beforeEnter,m=o.enter,b=o.afterEnter,y=o.enterCancelled,w=o.beforeAppear,A=o.appear,x=o.afterAppear,E=o.appearCancelled,C=o.duration,k=Wt,S=Wt.$vnode;S&&S.parent;)k=S.context,S=S.parent;var O=!k._isMounted||!e.isRootInsert;if(!O||A||""===A){var _=O&&p?p:l,T=O&&v?v:f,I=O&&h?h:u,j=O&&w||g,B=O&&"function"==typeof A?A:m,P=O&&x||b,R=O&&E||y,N=d(a(C)?C.enter:C),D=!1!==s&&!W,F=li(B),V=i._enterCb=M((function(){D&&(ei(i,I),ei(i,T)),V.cancelled?(D&&ei(i,_),R&&R(i)):P&&P(i),i._enterCb=null}));e.data.show||rt(e,"insert",(function(){var t=i.parentNode,n=t&&t._pending&&t._pending[e.key];n&&n.tag===e.tag&&n.elm._leaveCb&&n.elm._leaveCb(),B&&B(i,V)})),j&&j(i),D&&($r(i,_),$r(i,T),Zr((function(){ei(i,_),V.cancelled||($r(i,I),F||(ci(N)?setTimeout(V,N):ti(i,c,V)))}))),e.data.show&&(n&&n(),B&&B(i,V)),D||F||V()}}}function si(e,n){var i=e.elm;r(i._enterCb)&&(i._enterCb.cancelled=!0,i._enterCb());var o=qr(e.data.transition);if(t(o)||1!==i.nodeType)return n();if(!r(i._leaveCb)){var s=o.css,c=o.type,l=o.leaveClass,u=o.leaveToClass,f=o.leaveActiveClass,p=o.beforeLeave,h=o.leave,v=o.afterLeave,g=o.leaveCancelled,m=o.delayLeave,b=o.duration,y=!1!==s&&!W,w=li(h),A=d(a(b)?b.leave:b),x=i._leaveCb=M((function(){i.parentNode&&i.parentNode._pending&&(i.parentNode._pending[e.key]=null),y&&(ei(i,u),ei(i,f)),x.cancelled?(y&&ei(i,l),g&&g(i)):(n(),v&&v(i)),i._leaveCb=null}));m?m(E):E()}function E(){x.cancelled||(!e.data.show&&i.parentNode&&((i.parentNode._pending||(i.parentNode._pending={}))[e.key]=e),p&&p(i),y&&($r(i,l),$r(i,f),Zr((function(){ei(i,l),x.cancelled||($r(i,u),w||(ci(A)?setTimeout(x,A):ti(i,c,x)))}))),h&&h(i,x),y||w||x())}}function ci(e){return"number"==typeof e&&!isNaN(e)}function li(e){if(t(e))return!1;var n=e.fns;return r(n)?li(Array.isArray(n)?n[0]:n):(e._length||e.length)>1}function ui(e,t){!0!==t.data.show&&ai(t)}var fi=function(e){var n,a,s={},c=e.modules,l=e.nodeOps;for(n=0;n<$n.length;++n)for(s[$n[n]]=[],a=0;a<c.length;++a)r(c[a][$n[n]])&&s[$n[n]].push(c[a][$n[n]]);function u(e){var t=l.parentNode(e);r(t)&&l.removeChild(t,e)}function f(e,t,n,o,a,c,u){if(r(e.elm)&&r(c)&&(e=c[u]=ve(e)),e.isRootInsert=!a,!function(e,t,n,o){var a=e.data;if(r(a)){var c=r(e.componentInstance)&&a.keepAlive;if(r(a=a.hook)&&r(a=a.init)&&a(e,!1),r(e.componentInstance))return d(e,t),h(n,e.elm,o),i(c)&&function(e,t,n,i){for(var o,a=e;a.componentInstance;)if(r(o=(a=a.componentInstance._vnode).data)&&r(o=o.transition)){for(o=0;o<s.activate.length;++o)s.activate[o](Zn,a);t.push(a);break}h(n,e.elm,i)}(e,t,n,o),!0}}(e,t,n,o)){var f=e.data,p=e.children,g=e.tag;r(g)?(e.elm=e.ns?l.createElementNS(e.ns,g):l.createElement(g,e),b(e),v(e,p,t),r(f)&&m(e,t),h(n,e.elm,o)):i(e.isComment)?(e.elm=l.createComment(e.text),h(n,e.elm,o)):(e.elm=l.createTextNode(e.text),h(n,e.elm,o))}}function d(e,t){r(e.data.pendingInsert)&&(t.push.apply(t,e.data.pendingInsert),e.data.pendingInsert=null),e.elm=e.componentInstance.$el,g(e)?(m(e,t),b(e)):(Yn(e),t.push(e))}function h(e,t,n){r(e)&&(r(n)?l.parentNode(n)===e&&l.insertBefore(e,t,n):l.appendChild(e,t))}function v(e,t,n){if(Array.isArray(t))for(var r=0;r<t.length;++r)f(t[r],n,e.elm,null,!0,t,r);else o(e.text)&&l.appendChild(e.elm,l.createTextNode(String(e.text)))}function g(e){for(;e.componentInstance;)e=e.componentInstance._vnode;return r(e.tag)}function m(e,t){for(var i=0;i<s.create.length;++i)s.create[i](Zn,e);r(n=e.data.hook)&&(r(n.create)&&n.create(Zn,e),r(n.insert)&&t.push(e))}function b(e){var t;if(r(t=e.fnScopeId))l.setStyleScope(e.elm,t);else for(var n=e;n;)r(t=n.context)&&r(t=t.$options._scopeId)&&l.setStyleScope(e.elm,t),n=n.parent;r(t=Wt)&&t!==e.context&&t!==e.fnContext&&r(t=t.$options._scopeId)&&l.setStyleScope(e.elm,t)}function y(e,t,n,r,i,o){for(;r<=i;++r)f(n[r],o,e,t,!1,n,r)}function w(e){var t,n,i=e.data;if(r(i))for(r(t=i.hook)&&r(t=t.destroy)&&t(e),t=0;t<s.destroy.length;++t)s.destroy[t](e);if(r(t=e.children))for(n=0;n<e.children.length;++n)w(e.children[n])}function A(e,t,n){for(;t<=n;++t){var i=e[t];r(i)&&(r(i.tag)?(x(i),w(i)):u(i.elm))}}function x(e,t){if(r(t)||r(e.data)){var n,i=s.remove.length+1;for(r(t)?t.listeners+=i:t=function(e,t){function n(){0==--n.listeners&&u(e)}return n.listeners=t,n}(e.elm,i),r(n=e.componentInstance)&&r(n=n._vnode)&&r(n.data)&&x(n,t),n=0;n<s.remove.length;++n)s.remove[n](e,t);r(n=e.data.hook)&&r(n=n.remove)?n(e,t):t()}else u(e.elm)}function E(e,t,n,i){for(var o=n;o<i;o++){var a=t[o];if(r(a)&&er(e,a))return o}}function C(e,n,o,a,c,u){if(e!==n){r(n.elm)&&r(a)&&(n=a[c]=ve(n));var d=n.elm=e.elm;if(i(e.isAsyncPlaceholder))r(n.asyncFactory.resolved)?O(e.elm,n,o):n.isAsyncPlaceholder=!0;else if(i(n.isStatic)&&i(e.isStatic)&&n.key===e.key&&(i(n.isCloned)||i(n.isOnce)))n.componentInstance=e.componentInstance;else{var p,h=n.data;r(h)&&r(p=h.hook)&&r(p=p.prepatch)&&p(e,n);var v=e.children,m=n.children;if(r(h)&&g(n)){for(p=0;p<s.update.length;++p)s.update[p](e,n);r(p=h.hook)&&r(p=p.update)&&p(e,n)}t(n.text)?r(v)&&r(m)?v!==m&&function(e,n,i,o,a){for(var s,c,u,d=0,p=0,h=n.length-1,v=n[0],g=n[h],m=i.length-1,b=i[0],w=i[m],x=!a;d<=h&&p<=m;)t(v)?v=n[++d]:t(g)?g=n[--h]:er(v,b)?(C(v,b,o,i,p),v=n[++d],b=i[++p]):er(g,w)?(C(g,w,o,i,m),g=n[--h],w=i[--m]):er(v,w)?(C(v,w,o,i,m),x&&l.insertBefore(e,v.elm,l.nextSibling(g.elm)),v=n[++d],w=i[--m]):er(g,b)?(C(g,b,o,i,p),x&&l.insertBefore(e,g.elm,v.elm),g=n[--h],b=i[++p]):(t(s)&&(s=tr(n,d,h)),t(c=r(b.key)?s[b.key]:E(b,n,d,h))?f(b,o,e,v.elm,!1,i,p):er(u=n[c],b)?(C(u,b,o,i,p),n[c]=void 0,x&&l.insertBefore(e,u.elm,v.elm)):f(b,o,e,v.elm,!1,i,p),b=i[++p]);d>h?y(e,t(i[m+1])?null:i[m+1].elm,i,p,m,o):p>m&&A(n,d,h)}(d,v,m,o,u):r(m)?(r(e.text)&&l.setTextContent(d,""),y(d,null,m,0,m.length-1,o)):r(v)?A(v,0,v.length-1):r(e.text)&&l.setTextContent(d,""):e.text!==n.text&&l.setTextContent(d,n.text),r(h)&&r(p=h.hook)&&r(p=p.postpatch)&&p(e,n)}}}function k(e,t,n){if(i(n)&&r(e.parent))e.parent.data.pendingInsert=t;else for(var o=0;o<t.length;++o)t[o].data.hook.insert(t[o])}var S=p("attrs,class,staticClass,staticStyle,key");function O(e,t,n,o){var a,s=t.tag,c=t.data,l=t.children;if(o=o||c&&c.pre,t.elm=e,i(t.isComment)&&r(t.asyncFactory))return t.isAsyncPlaceholder=!0,!0;if(r(c)&&(r(a=c.hook)&&r(a=a.init)&&a(t,!0),r(a=t.componentInstance)))return d(t,n),!0;if(r(s)){if(r(l))if(e.hasChildNodes())if(r(a=c)&&r(a=a.domProps)&&r(a=a.innerHTML)){if(a!==e.innerHTML)return!1}else{for(var u=!0,f=e.firstChild,p=0;p<l.length;p++){if(!f||!O(f,l[p],n,o)){u=!1;break}f=f.nextSibling}if(!u||f)return!1}else v(t,l,n);if(r(c)){var h=!1;for(var g in c)if(!S(g)){h=!0,m(t,n);break}!h&&c.class&&$e(c.class)}}else e.data!==t.text&&(e.data=t.text);return!0}return function(e,n,o,a){if(!t(n)){var c,u=!1,d=[];if(t(e))u=!0,f(n,d);else{var p=r(e.nodeType);if(!p&&er(e,n))C(e,n,d,null,null,a);else{if(p){if(1===e.nodeType&&e.hasAttribute(P)&&(e.removeAttribute(P),o=!0),i(o)&&O(e,n,d))return k(n,d,!0),e;c=e,e=new fe(l.tagName(c).toLowerCase(),{},[],void 0,c)}var h=e.elm,v=l.parentNode(h);if(f(n,d,h._leaveCb?null:v,l.nextSibling(h)),r(n.parent))for(var m=n.parent,b=g(n);m;){for(var y=0;y<s.destroy.length;++y)s.destroy[y](m);if(m.elm=n.elm,b){for(var x=0;x<s.create.length;++x)s.create[x](Zn,m);var E=m.data.hook.insert;if(E.merged)for(var S=1;S<E.fns.length;S++)E.fns[S]()}else Yn(m);m=m.parent}r(v)?A([e],0,0):r(e.tag)&&w(e)}}return k(n,d,u),n.elm}r(e)&&w(e)}}({nodeOps:Xn,modules:[dr,vr,Cr,Or,Fr,q?{create:ui,activate:ui,remove:function(e,t){!0!==e.data.show?si(e,t):t()}}:{}].concat(cr)});W&&document.addEventListener("selectionchange",(function(){var e=document.activeElement;e&&e.vmodel&&yi(e,"input")}));var di={inserted:function(e,t,n,r){"select"===n.tag?(r.elm&&!r.elm._vOptions?rt(n,"postpatch",(function(){di.componentUpdated(e,t,n)})):pi(e,t,n.context),e._vOptions=[].map.call(e.options,gi)):("textarea"===n.tag||Gn(e.type))&&(e._vModifiers=t.modifiers,t.modifiers.lazy||(e.addEventListener("compositionstart",mi),e.addEventListener("compositionend",bi),e.addEventListener("change",bi),W&&(e.vmodel=!0)))},componentUpdated:function(e,t,n){if("select"===n.tag){pi(e,t,n.context);var r=e._vOptions,i=e._vOptions=[].map.call(e.options,gi);i.some((function(e,t){return!j(e,r[t])}))&&(e.multiple?t.value.some((function(e){return vi(e,i)})):t.value!==t.oldValue&&vi(t.value,i))&&yi(e,"change")}}};function pi(e,t,n){hi(e,t,n),(z||G)&&setTimeout((function(){hi(e,t,n)}),0)}function hi(e,t,n){var r=t.value,i=e.multiple;if(!i||Array.isArray(r)){for(var o,a,s=0,c=e.options.length;s<c;s++)if(a=e.options[s],i)o=B(r,gi(a))>-1,a.selected!==o&&(a.selected=o);else if(j(gi(a),r))return void(e.selectedIndex!==s&&(e.selectedIndex=s));i||(e.selectedIndex=-1)}}function vi(e,t){return t.every((function(t){return!j(t,e)}))}function gi(e){return"_value"in e?e._value:e.value}function mi(e){e.target.composing=!0}function bi(e){e.target.composing&&(e.target.composing=!1,yi(e.target,"input"))}function yi(e,t){var n=document.createEvent("HTMLEvents");n.initEvent(t,!0,!0),e.dispatchEvent(n)}function wi(e){return!e.componentInstance||e.data&&e.data.transition?e:wi(e.componentInstance._vnode)}var Ai={model:di,show:{bind:function(e,t,n){var r=t.value,i=(n=wi(n)).data&&n.data.transition,o=e.__vOriginalDisplay="none"===e.style.display?"":e.style.display;r&&i?(n.data.show=!0,ai(n,(function(){e.style.display=o}))):e.style.display=r?o:"none"},update:function(e,t,n){var r=t.value;!r!=!t.oldValue&&((n=wi(n)).data&&n.data.transition?(n.data.show=!0,r?ai(n,(function(){e.style.display=e.__vOriginalDisplay})):si(n,(function(){e.style.display="none"}))):e.style.display=r?e.__vOriginalDisplay:"none")},unbind:function(e,t,n,r,i){i||(e.style.display=e.__vOriginalDisplay)}}},xi={name:String,appear:Boolean,css:Boolean,mode:String,type:String,enterClass:String,leaveClass:String,enterToClass:String,leaveToClass:String,enterActiveClass:String,leaveActiveClass:String,appearClass:String,appearActiveClass:String,appearToClass:String,duration:[Number,String,Object]};function Ei(e){var t=e&&e.componentOptions;return t&&t.Ctor.options.abstract?Ei(qt(t.children)):e}function Ci(e){var t={},n=e.$options;for(var r in n.propsData)t[r]=e[r];var i=n._parentListeners;for(var o in i)t[w(o)]=i[o];return t}function ki(e,t){if(/\d-keep-alive$/.test(t.tag))return e("keep-alive",{props:t.componentOptions.propsData})}var Si=function(e){return e.tag||Lt(e)},Oi=function(e){return"show"===e.name},_i={name:"transition",props:xi,abstract:!0,render:function(e){var t=this,n=this.$slots.default;if(n&&(n=n.filter(Si)).length){var r=this.mode,i=n[0];if(function(e){for(;e=e.parent;)if(e.data.transition)return!0}(this.$vnode))return i;var a=Ei(i);if(!a)return i;if(this._leaving)return ki(e,i);var s="__transition-"+this._uid+"-";a.key=null==a.key?a.isComment?s+"comment":s+a.tag:o(a.key)?0===String(a.key).indexOf(s)?a.key:s+a.key:a.key;var c=(a.data||(a.data={})).transition=Ci(this),l=this._vnode,u=Ei(l);if(a.data.directives&&a.data.directives.some(Oi)&&(a.data.show=!0),u&&u.data&&!function(e,t){return t.key===e.key&&t.tag===e.tag}(a,u)&&!Lt(u)&&(!u.componentInstance||!u.componentInstance._vnode.isComment)){var f=u.data.transition=S({},c);if("out-in"===r)return this._leaving=!0,rt(f,"afterLeave",(function(){t._leaving=!1,t.$forceUpdate()})),ki(e,i);if("in-out"===r){if(Lt(a))return l;var d,p=function(){d()};rt(c,"afterEnter",p),rt(c,"enterCancelled",p),rt(f,"delayLeave",(function(e){d=e}))}}return i}}},Ti=S({tag:String,moveClass:String},xi);function Ii(e){e.elm._moveCb&&e.elm._moveCb(),e.elm._enterCb&&e.elm._enterCb()}function ji(e){e.data.newPos=e.elm.getBoundingClientRect()}function Bi(e){var t=e.data.pos,n=e.data.newPos,r=t.left-n.left,i=t.top-n.top;if(r||i){e.data.moved=!0;var o=e.elm.style;o.transform=o.WebkitTransform="translate("+r+"px,"+i+"px)",o.transitionDuration="0s"}}delete Ti.mode;var Mi={Transition:_i,TransitionGroup:{props:Ti,beforeMount:function(){var e=this,t=this._update;this._update=function(n,r){var i=Gt(e);e.__patch__(e._vnode,e.kept,!1,!0),e._vnode=e.kept,i(),t.call(e,n,r)}},render:function(e){for(var t=this.tag||this.$vnode.data.tag||"span",n=Object.create(null),r=this.prevChildren=this.children,i=this.$slots.default||[],o=this.children=[],a=Ci(this),s=0;s<i.length;s++){var c=i[s];c.tag&&null!=c.key&&0!==String(c.key).indexOf("__vlist")&&(o.push(c),n[c.key]=c,(c.data||(c.data={})).transition=a)}if(r){for(var l=[],u=[],f=0;f<r.length;f++){var d=r[f];d.data.transition=a,d.data.pos=d.elm.getBoundingClientRect(),n[d.key]?l.push(d):u.push(d)}this.kept=e(t,null,l),this.removed=u}return e(t,null,o)},updated:function(){var e=this.prevChildren,t=this.moveClass||(this.name||"v")+"-move";e.length&&this.hasMove(e[0].elm,t)&&(e.forEach(Ii),e.forEach(ji),e.forEach(Bi),this._reflow=document.body.offsetHeight,e.forEach((function(e){if(e.data.moved){var n=e.elm,r=n.style;$r(n,t),r.transform=r.WebkitTransform=r.transitionDuration="",n.addEventListener(Gr,n._moveCb=function e(r){r&&r.target!==n||r&&!/transform$/.test(r.propertyName)||(n.removeEventListener(Gr,e),n._moveCb=null,ei(n,t))})}})))},methods:{hasMove:function(e,t){if(!Hr)return!1;if(this._hasMove)return this._hasMove;var n=e.cloneNode();e._transitionClasses&&e._transitionClasses.forEach((function(e){Lr(n,e)})),Ur(n,t),n.style.display="none",this.$el.appendChild(n);var r=ri(n);return this.$el.removeChild(n),this._hasMove=r.hasTransform}}}};return An.config.mustUseProp=function(e,t,n){return"value"===n&&In(e)&&"button"!==t||"selected"===n&&"option"===e||"checked"===n&&"input"===e||"muted"===n&&"video"===e},An.config.isReservedTag=zn,An.config.isReservedAttr=Tn,An.config.getTagNamespace=function(e){return Jn(e)?"svg":"math"===e?"math":void 0},An.config.isUnknownElement=function(e){if(!q)return!0;if(zn(e))return!1;if(e=e.toLowerCase(),null!=Wn[e])return Wn[e];var t=document.createElement(e);return e.indexOf("-")>-1?Wn[e]=t.constructor===window.HTMLUnknownElement||t.constructor===window.HTMLElement:Wn[e]=/HTMLUnknownElement/.test(t.toString())},S(An.options.directives,Ai),S(An.options.components,Mi),An.prototype.__patch__=q?fi:_,An.prototype.$mount=function(e,t){return function(e,t,n){var r;return e.$el=t,e.$options.render||(e.$options.render=pe),Yt(e,"beforeMount"),r=function(){e._update(e._render(),n)},new un(e,r,_,{before:function(){e._isMounted&&!e._isDestroyed&&Yt(e,"beforeUpdate")}},!0),n=!1,null==e.$vnode&&(e._isMounted=!0,Yt(e,"mounted")),e}(this,e=e&&q?function(e){return"string"==typeof e?document.querySelector(e)||document.createElement("div"):e}(e):void 0,t)},q&&setTimeout((function(){D.devtools&&te&&te.emit("init",An)}),0),An}()}},t={};function n(r){if(t[r])return t[r].exports;var i=t[r]={id:r,exports:{}};return e[r].call(i.exports,i,i.exports,n),i.exports}return n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,{a:t}),t},n.d=function(e,t){for(var r in t)n.o(t,r)&&!n.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},n.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n(830)}()}));

/***/ }),

/***/ "./node_modules/@bilibili/userAvatar/dist/user-avatar.js":
/*!***************************************************************!*\
  !*** ./node_modules/@bilibili/userAvatar/dist/user-avatar.js ***!
  \***************************************************************/
/***/ (function(module) {

/*!
 * @bilibili/userAvatar
 * version: 1.1.7. Powered by main-frontend
 * 用户头像公共组件.
 * author: wuxiuran
 */
!function(t,n){ true?module.exports=n():0}(this,(function(){return function(t){var n={};function e(r){if(n[r])return n[r].exports;var o=n[r]={i:r,l:!1,exports:{}};return t[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}return e.m=t,e.c=n,e.d=function(t,n,r){e.o(t,n)||Object.defineProperty(t,n,{enumerable:!0,get:r})},e.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},e.t=function(t,n){if(1&n&&(t=e(t)),8&n)return t;if(4&n&&"object"==typeof t&&t&&t.__esModule)return t;var r=Object.create(null);if(e.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:t}),2&n&&"string"!=typeof t)for(var o in t)e.d(r,o,function(n){return t[n]}.bind(null,o));return r},e.n=function(t){var n=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(n,"a",n),n},e.o=function(t,n){return Object.prototype.hasOwnProperty.call(t,n)},e.p="",e(e.s=16)}([function(t,n,e){"use strict";(function(t){function r(t){return(r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}e.d(n,"h",(function(){return o})),e.d(n,"d",(function(){return a})),e.d(n,"f",(function(){return s})),e.d(n,"a",(function(){return f})),e.d(n,"g",(function(){return b})),e.d(n,"e",(function(){return d})),e.d(n,"c",(function(){return p})),e.d(n,"b",(function(){return v}));var o="object"==("undefined"==typeof self?"undefined":r(self))&&self.self===self&&self||"object"==(void 0===t?"undefined":r(t))&&t.global===t&&t||void 0,i=o.devicePixelRatio&&3===o.devicePixelRatio?3:2,a=function(t){o.document&&(o.document.addEventListener?o.document.addEventListener("DOMContentLoaded",(function(){t&&t()})):o.document.onreadystatechange=function(){"complete"===o.document.readyState&&t&&t()})},c=function(t){if(!t)return"";var n=t.replace(/^(http:\/\/|:\/\/|\/\/|\/)/,"https://");return n.match(/^https:\/\//)?n:"https://"+n},s=function(t,n,e){var r=arguments.length>3&&void 0!==arguments[3]&&arguments[3],o=arguments.length>4&&void 0!==arguments[4]&&arguments[4];return function(t){if(!t)return t;var a=(t=c(t).replace(/\@.+/,"")).match(/(.*\.(jpg|jpeg|gif|png|JPG|JPEG|GIF|PNG|webp|WEBP))(\?.*)?/),s=-1!=t.indexOf("/bfs/");try{if(!a||!s||!a)return t}catch(n){return t}var l=[];n&&e&&(l.push(Math.round(+n*i)+"w"),l.push(Math.round(+e*i)+"h")),r&&l.push("1c"),o&&l.push("1s");var f=a[3]?a[3]:"";return u?a[1]+"@"+l.join("_")+".webp"+f:a[1]+"@"+l.join("_")+"."+a[2]+f}(t)},u=function(){try{return o.document&&0==o.document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp")}catch(t){return!1}}(),l=function(t,n){return new RegExp("\\b"+n+"\\b").test(t.className)},f=function(t,n){t.className?l(t,n)||(t.className+=" "+n):t.className=n},b=function(t,n){var e=new RegExp("\\b"+n+"\\b","g");l(t,n)&&(t.className=t.className.replace(e,"").replace(/^\s+|\s+$/g,"").replace(/\s+/g," "))},d=function(t){return t=t<=48?48:t<=60?60:t<=80?80:120},p=function(t,n,e){return t?"".concat(e?n?.96*t:.85*t:n?1.13*t:t,"px"):"100%"},v=function(t,n,e){if(!t)return"translate(0px, 0px)";if(n){if(e){var r=.04*t/2;return"translate(".concat(r,"px, ").concat(r,"px)")}var o=.13*t/2;return"translate(".concat(-o,"px, ").concat(-o,"px)")}if(e){var i=.15*t/2;return"translate(".concat(i,"px, ").concat(i,"px)")}return"translate(0px, 0px)"}}).call(this,e(4))},function(t,n){function e(t){return(e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}t.exports=function(t){return null!=t&&"object"==e(t)}},function(t,n,e){var r=e(1),o=e(8);t.exports=function(t){return r(t)&&1===t.nodeType&&!o(t)}},function(t,n,e){var r=e(5),o=e(15),i=e(1);t.exports=function(t){return"string"==typeof t||!o(t)&&i(t)&&"[object String]"==r(t)}},function(t,n){function e(t){return(e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var r;r=function(){return this}();try{r=r||new Function("return this")()}catch(t){"object"===("undefined"==typeof window?"undefined":e(window))&&(r=window)}t.exports=r},function(t,n,e){var r=e(6),o=e(11),i=e(12),a=r?r.toStringTag:void 0;t.exports=function(t){return null==t?void 0===t?"[object Undefined]":"[object Null]":a&&a in Object(t)?o(t):i(t)}},function(t,n,e){var r=e(9).Symbol;t.exports=r},function(t,n,e){},function(t,n,e){var r=e(5),o=e(13),i=e(1),a=Function.prototype,c=Object.prototype,s=a.toString,u=c.hasOwnProperty,l=s.call(Object);t.exports=function(t){if(!i(t)||"[object Object]"!=r(t))return!1;var n=o(t);if(null===n)return!0;var e=u.call(n,"constructor")&&n.constructor;return"function"==typeof e&&e instanceof e&&s.call(e)==l}},function(t,n,e){function r(t){return(r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var o=e(10),i="object"==("undefined"==typeof self?"undefined":r(self))&&self&&self.Object===Object&&self,a=o||i||Function("return this")();t.exports=a},function(t,n,e){(function(n){function e(t){return(e="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var r="object"==(void 0===n?"undefined":e(n))&&n&&n.Object===Object&&n;t.exports=r}).call(this,e(4))},function(t,n,e){var r=e(6),o=Object.prototype,i=o.hasOwnProperty,a=o.toString,c=r?r.toStringTag:void 0;t.exports=function(t){var n=i.call(t,c),e=t[c];try{t[c]=void 0;var r=!0}catch(t){}var o=a.call(t);return r&&(n?t[c]=e:delete t[c]),o}},function(t,n){var e=Object.prototype.toString;t.exports=function(t){return e.call(t)}},function(t,n,e){var r=e(14)(Object.getPrototypeOf,Object);t.exports=r},function(t,n){t.exports=function(t,n){return function(e){return t(n(e))}}},function(t,n){var e=Array.isArray;t.exports=e},function(t,n,e){"use strict";e.r(n),e.d(n,"UserAvatar",(function(){return d}));var r,o=e(0),i=function(t,n){var e=t.src,r=t.height,i=t.width,a=t.className,c=t.style,s=t.radius,u=t.freeze;return"\n<img ".concat(c?' style="'+c+'"':"",'\n  class="').concat(a,'" \n  ').concat(n?"data-":"",'src="').concat(Object(o.f)(e,i,r,s,u),'" \n  alt\n/>\n')},a=(e(7),e(2)),c=e.n(a),s=e(3),u=e.n(s),l=((r=o.h).LazyLoad=function(t){var n={src:"data-src",srcset:"data-srcset",selector:".lazyload",root:null,rootMargin:"0px",threshold:0};function e(t,e){this.settings=function t(){var n={},e=!1,r=0,o=arguments.length;"[object Boolean]"===Object.prototype.toString.call(arguments[0])&&(e=arguments[0],r++);for(var i=function(r){for(var o in r)Object.prototype.hasOwnProperty.call(r,o)&&(e&&"[object Object]"===Object.prototype.toString.call(r[o])?n[o]=t(!0,n[o],r[o]):n[o]=r[o])};r<o;r++){var a=arguments[r];i(a)}return n}(n,e||{}),this.images=t||document.querySelectorAll(this.settings.selector),this.observer=null,this.init()}if(e.prototype={init:function(){if(t.IntersectionObserver){var n=this,e={root:this.settings.root,rootMargin:this.settings.rootMargin,threshold:[this.settings.threshold]};this.observer=new IntersectionObserver((function(t){Array.prototype.forEach.call(t,(function(t){if(t.intersectionRatio>0){n.observer.unobserve(t.target);var e=t.target.getAttribute(n.settings.src),r=t.target.getAttribute(n.settings.srcset);"img"===t.target.tagName.toLowerCase()?(e&&(t.target.src=e),r&&(t.target.srcset=r)):t.target.style.backgroundImage="url("+e+")"}}))}),e),Array.prototype.forEach.call(this.images,(function(t){n.observer.observe(t)}))}else this.loadImages()},loadAndDestroy:function(){this.settings&&(this.loadImages(),this.destroy())},loadImages:function(){if(this.settings){var t=this;Array.prototype.forEach.call(this.images,(function(n){var e=n.getAttribute(t.settings.src),r=n.getAttribute(t.settings.srcset);"img"===n.tagName.toLowerCase()?(e&&(n.src=e),r&&(n.srcset=r)):n.style.backgroundImage="url('"+e+"')"}))}},destroy:function(){this.settings&&(this.observer.disconnect(),this.settings=null)}},t.lazyload=function(t,n){return new e(t,n)},t.jQuery){var r=t.jQuery;r.fn.lazyload=function(t){return(t=t||{}).attribute=t.attribute||"data-src",new e(r.makeArray(this),t),this}}return e}(r),r.LazyLoad);function f(t,n){for(var e=0;e<n.length;e++){var r=n[e];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}var b=function(t){return t.querySelectorAll(".bili-avatar-img").forEach((function(t){t.addEventListener("error",(function(t){Object(o.a)(t.target,"bili-avatar-img-error")}))}))};Object(o.d)((function(){return b(document)}));var d=function(){function t(){!function(t,n){if(!(t instanceof n))throw new TypeError("Cannot call a class as a function")}(this,t),this.lazy=[],this.$refs={}}var n,e,r;return n=t,(e=[{key:"actionFn",value:function(t){this.lazy.length&&this.lazy.forEach((function(n){n[t]()}))}},{key:"loadImages",value:function(){this.actionFn("loadImages")}},{key:"loadAndDestroy",value:function(){this.actionFn("loadAndDestroy")}},{key:"append",value:function(t,n,e){var r=t.avatar,a=t.pendent,s=t.avatarWidth,f=t.renderWidth,d=t.iconType,p=t.isAnimate,v=t.isNFT,y=t.NFTIconType,m=t.isCenterScale,g=t.duration,h=t.customIcon,j=function(t,n){var e=t.avatar,r=void 0===e?"":e,a=t.pendent,c=void 0===a?"":a,s=t.avatarHeight,u=t.avatarWidth,l=t.renderWidth,f=t.pendentHeight,b=t.pendentWidth,d=t.iconType,p=void 0===d?"":d,v=t.isAnimate,y=void 0!==v&&v,m=t.isNFT,g=void 0!==m&&m,h=t.NFTIconType,j=void 0===h?0:h,O=t.isCenterScale,S=void 0!==O&&O,x=t.duration,w=void 0===x?2:x,T=t.customIcon,A=void 0===T?"":T;0===j&&g&&(j=1);var N=1===j,E=Object(o.c)(l,N,c),I=Object(o.b)(l,N,c),z=S?"transform: ".concat(I,";"):"";return'\n    <div class="bili-avatar" style="width: '.concat(E,";height:").concat(E,";").concat(z,'">\n      ').concat(i({src:r,className:"bili-avatar-img bili-avatar-face bili-avatar-img-radius",height:s,width:u,radius:!0,freeze:!0},n),"\n      \n      ").concat(c?'<div class="bili-avatar-pendent-dom">\n          '.concat(i({src:c,className:"bili-avatar-img",style:y&&"-webkit-animation: bili-avatar ".concat(w,"s steps(").concat(39,") infinite; -moz-animation: bili-avatar ").concat(w,"s steps(").concat(39,") infinite; animation: bili-avatar ").concat(w,"s steps(").concat(39,") infinite;"),height:f,width:b},n),"\n        </div>"):"","\n      ").concat(j?'<span class="bili-avatar-nft-icon bili-avatar-nft--icon--'.concat(j," ").concat(l?"bili-avatar-size-nft-".concat(l):"",'" style="right:').concat(p||A?"":"0px",'"></span>'):"",'\n\n      <span\n        class="bili-avatar-icon bili-avatar-right-icon ').concat(p&&!A?" bili-avatar-icon--"+p:""," ").concat(l?"bili-avatar-size-".concat(l):"",'"\n        ').concat(A?'style="background-image: url('+Object(o.f)(A,u/3,u/3,!0)+');"':"","\n      ></span>\n    </div>\n  ")}({avatar:r,pendent:a,renderWidth:f,avatarHeight:s=Object(o.e)(s),avatarWidth:s,pendentHeight:1.5*s,pendentWidth:p?1.5*s*40:1.5*s,iconType:d,isAnimate:p,isNFT:v,NFTIconType:y,isCenterScale:m,duration:g,customIcon:h},n),O=n;if(!O)return j;c()(O)?(O.innerHTML=j,b(O)):u()(O)&&((O=document.querySelector(O)).innerHTML=j,b(O)),this.lazy.push(new l(null,{root:null,rootMargin:"0px",threshold:0,selector:".bili-avatar-img"})),e&&(this.$refs[e]=O.firstElementChild)}},{key:"resetConfig",value:function(t,n){var e=n.avatar,r=n.pendent,a=n.avatarWidth,s=n.iconType,l=n.isAnimate,f=n.duration,b=n.customIcon;a=Object(o.e)(a);var d=null;if(c()(t)?d=t:u()(t)&&(d=this.$refs[t]),d){var p=d.querySelector(".bili-avatar-pendent-dom img");if(p)r?(p.src=Object(o.f)(r,l?1.7*a*40:1.7*a,1.7*a),p.addEventListener("load",(function t(){var n="bili-avatar ".concat(f,"s steps(").concat(39,") infinite");p.style.cssText=l&&"-webkit-animation: ".concat(n,"; -moz-animation: ").concat(n,"; animation: ").concat(n,";"),p.removeEventListener("load",t)}))):d.removeChild(d.querySelector(".bili-avatar-pendent-dom"));else if(r){var v=document.createElement("div");Object(o.a)(v,"bili-avatar-pendent-dom");var y="bili-avatar ".concat(f,"s steps(").concat(39,") infinite");v.innerHTML=i({src:r,className:"bili-avatar-img",style:l&&"-webkit-animation: ".concat(y,"; -moz-animation: ").concat(y,"; animation: ").concat(y,";"),height:1.7*a,width:l?1.7*a*40:1.7*a},!1),d.insertBefore(v,d.querySelector(".bili-avatar-icon"))}var m=d.querySelector(".bili-avatar-icon");b?(Object(o.g)(m,"bili-avatar-icon--big-vip"),Object(o.g)(m,"bili-avatar-icon--personal"),Object(o.g)(m,"bili-avatar-icon--business"),Object(o.g)(m,"bili-avatar-icon--small-vip"),m.style.backgroundImage="url(".concat(Object(o.f)(b,a/3,a/3,!0),")")):(s?new RegExp(s).test(m.className)||(Object(o.g)(m,"bili-avatar-icon--big-vip"),Object(o.g)(m,"bili-avatar-icon--personal"),Object(o.g)(m,"bili-avatar-icon--business"),Object(o.g)(m,"bili-avatar-icon--small-vip"),Object(o.a)(m,"bili-avatar-icon--".concat(s))):(Object(o.g)(m,"bili-avatar-icon--big-vip"),Object(o.g)(m,"bili-avatar-icon--personal"),Object(o.g)(m,"bili-avatar-icon--business"),Object(o.g)(m,"bili-avatar-icon--small-vip")),m.style.cssText="");var g=d.querySelector(".bili-avatar-img");e&&(g.src=Object(o.f)(e,a,a,!0))}}}])&&f(n.prototype,e),r&&f(n,r),t}();n.default=d}])}));

/***/ }),

/***/ "./src/emoji.js":
/*!**********************!*\
  !*** ./src/emoji.js ***!
  \**********************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

__webpack_require__(/*! ../static/style/less/emoji.less */ "./static/style/less/emoji.less");

var utils = __webpack_require__(/*! ./utils.js */ "./src/utils.js");
/*
 * @container 指定一个容器
 * @trigger   指定按钮打开表情
 * @ta      关联的输入框
 */


function Emoji(container, data) {
  this.container = container;
  this.data = data; //当前选中的tab

  this.currentSelect = 0;
  this.curPage = 1; // 表情tab的当前页

  this.totalPage = 1; // 表情tab的总页数

  this.tabNum = 5; // 表情tab每页7个

  this.tabWidth = 58; // 每个tab的宽度

  this.avalEmojiNum = 0; // 可用的tab数
  //默认表情数据结构

  this.emojiData = [];
  this.showed = false; //表情dom

  this.emojiDom = "<div class='emoji-box'>" + "<div class='emoji-title'><span></span></div>" + "<div class='emoji-wrap'></div>" + "<div class='emoji-notice'>想要使用更多表情包，请到app中进行设置</div>" + "<div class='emoji-tabs'><div class='emoji-container'><div class='emoji-tab-wrap clearfix'></div></div></div>" + "</div>";
}

Emoji.prototype = {
  init: function init() {
    $(this.container).find('.emoji-box').remove(); //表情dom添加到指定容器

    $(this.container).append(this.emojiDom); //整个表情容器

    this.emojiBox = $(this.container).find('.emoji-box');
    this.hide(); //tabs容器

    var tabs = $(this.container).find('.emoji-tabs'); //表情容器

    var wrap = $(this.container).find('.emoji-wrap'); //表情标题

    var title = $(this.container).find('.emoji-title');
    var the = this;
    this.emojiData = this.data;
    this.avalEmojiNum = this.data.length;
    this.createTabs(tabs);
    this.createEmoji(wrap, title, this.emojiData[0]['pid']); //绑定tab事件

    tabs.off('click.tab').on('click.tab', '.tab-link', function () {
      the.currentSelect = +$(this).attr('data-index');
      var pid = +$(this).data('pid');
      the.oldCurrentSelect = the.currentSelect;
      $(this).addClass('on').siblings('.tab-link').removeClass('on');
      the.createEmoji(wrap, title, pid);
    }); //绑定表情事件

    wrap.off('click').on('click', '.emoji-list', function (e) {
      var _$$, _$$2, _$$3;

      var msg = $(this).attr('data-emoji-text');
      the.insertAtCursor($(the.ta)[0], msg);
      var emojiEl = $(this);
      var pid = emojiEl.data('pid');
      var id = emojiEl.data('id');
      var index = emojiEl.data('index');
      var reportParams = {};

      if (pid) {
        reportParams = {
          pid: pid,
          id: id
        };
      } else if (index) {
        reportParams = {
          index: index
        };
      }

      utils.customReport('emoji_click', reportParams); // 在这里处理输入emoji的时候让评论框变为激发态样式

      if ((_$$ = $('.bb-comment > .comment-send .textarea-container .ipt-txt')[0]) !== null && _$$ !== void 0 && _$$.value) {
        $('.bb-comment > .comment-send').addClass('send-active');
        $('.bb-comment > .comment-send .textarea-container .comment-submit').addClass('btn-active');
      }

      if ((_$$2 = $('.bb-comment > .comment-send-lite .textarea-container .ipt-txt')[0]) !== null && _$$2 !== void 0 && _$$2.value) {
        $('.bb-comment > .comment-send-lite').addClass('send-active');
        $('.bb-comment > .comment-send-lite .textarea-container .comment-submit').addClass('btn-active');
      }

      if ((_$$3 = $('.comment-list .list-item .textarea-container .ipt-txt')[0]) !== null && _$$3 !== void 0 && _$$3.value) {
        $('.comment-list .list-item .comment-send').addClass('send-active');
        $('.comment-list .list-item .comment-send .textarea-container .comment-submit').addClass('btn-active');
      }
    }); //点击空白处关闭表情框

    $(document).off('click.offEmoji').on('click.offEmoji', function (e) {
      if (!the.emojiBox.is(e.target) && the.emojiBox.has(e.target).length === 0) {
        the.emojiBox.hide();
      }
    });
    tabs.off('click.prev').on('click.prev', '.prev', function () {
      if (the.curPage > 1) {
        the.curPage--;
      }

      the.updateTabSlide();
    });
    tabs.off('click.next').on('click.next', '.next', function () {
      if (the.curPage < the.totalPage) {
        the.curPage++;
      }

      the.updateTabSlide();
    });
  },
  updateTabSlide: function updateTabSlide() {
    var $slide = $(this.container).find('.emoji-tab-slider');
    var $prev = $slide.find('.prev');
    var $next = $slide.find('.next');

    if (this.curPage > 1) {
      $prev.addClass('on');
    } else {
      $prev.removeClass('on');
    }

    if (this.curPage < this.totalPage) {
      $next.addClass('on');
    } else {
      $next.removeClass('on');
    }

    $(this.container).find('.emoji-tab-wrap').css({
      left: -1 * (this.curPage - 1) * this.tabWidth * this.tabNum
    });
  },

  /*
   * 生成tabs
   */
  createTabs: function createTabs(box) {
    var html = '';
    this.totalPage = Math.ceil(this.avalEmojiNum / this.tabNum);

    for (var i = 0; i < this.emojiData.length; i++) {
      var cla = this.currentSelect == i ? 'on' : '';
      var pid = this.emojiData[i]['pid'];
      html += "<a class='tab-link " + cla + "' data-index='" + i + "' data-pid='" + pid + "'><img src='" + utils.trimHttp(utils.webp(this.emojiData[i].purl, {
        w: 88,
        h: 88
      })) + "'></a>";
    }

    box.find('.emoji-tab-wrap').html(html).css({
      width: this.emojiData.length * this.tabWidth,
      left: 0
    });
    box.find('.emoji-tab-slider').remove();

    if (this.totalPage > 1) {
      box.append('<div class="emoji-tab-slider clearfix"><span class="prev"></span><span class="next on"></span></div>');
    }
  },

  /*
   * 生成表情列表
   */
  createEmoji: function createEmoji(box, title, pid) {
    //修改title
    title.find('span').text(this.emojiData[this.currentSelect].pname); //生成表情
    //因为默认表情和VIP表情的emojis里的数据格式不一样 所以分开处理

    var currentEmoji = this.emojiData[this.currentSelect];

    if (currentEmoji.type === 4) {
      var str = '';

      for (var i = 0; i < currentEmoji.emojis.length; i++) {
        str += "<a class='emoji-list emoji-text emoji-default' data-emoji-text='" + currentEmoji.emojis[i].name + "' data-index='" + i + "'>" + currentEmoji.emojis[i].url + "</a>";
      }

      box.html('').append(str);
    } else {
      var str = '';
      var emojis = currentEmoji.emojis;

      for (var i = 0; i < emojis.length; i++) {
        if (emojis[i].state == 0) {
          var className = 'emoji-list emoji-text emoji-pic';

          if (emojis[i].size && emojis[i].size === 's') {
            className += ' emoji-small';
          }

          var id = emojis[i].id;
          str += "<a class='" + className + "' data-emoji-text='" + emojis[i].name + "' data-pid='" + pid + "' data-id='" + id + "'><img src='" + utils.trimHttp(utils.webp(emojis[i].url, {
            w: 112,
            h: 112
          })) + "' title='" + emojis[i].name + "'></a>";
        }
      }

      box.html('').append(str);
    }
  },

  /*
   * 插入指定光标位置
   */
  insertAtCursor: function insertAtCursor(myField, myValue) {
    if (document.selection) {
      myField.focus();
      sel = document.selection.createRange();
      sel.text = myValue;
      sel.select();
    } else if (myField.selectionStart || myField.selectionStart == '0') {
      var startPos = myField.selectionStart;
      var endPos = myField.selectionEnd;
      var restoreTop = myField.scrollTop;
      myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length);

      if (restoreTop > 0) {
        myField.scrollTop = restoreTop;
      }

      myField.focus();
      myField.selectionStart = startPos + myValue.length;
      myField.selectionEnd = startPos + myValue.length;
    } else {
      myField.value += myValue;
      myField.focus();
    }
  },
  show: function show(ta, x, y, direction, position) {
    if (!this.showed) {
      this.init();
      this.showed = true;
    }

    this.ta = ta;
    var me = this;
    this.emojiBox.show().css({
      left: x,
      top: y,
      position: position
    }).removeClass('top').removeClass('bottom').addClass(direction);
    var tab = $(this.container).find('.emoji-tabs .tab-link');
    var $slider = $(this.container).find('.emoji-tab-slider');

    if (!localStorage.getItem('emoji-notice-showed')) {
      localStorage.setItem('emoji-notice-showed', 1);
      this.emojiBox.find('.emoji-notice').show();
      setTimeout(function () {
        me.emojiBox.find('.emoji-notice').hide();
      }, 3000);
    }
  },
  hide: function hide() {
    this.emojiBox.hide();
  }
};
module.exports = Emoji;

/***/ }),

/***/ "./src/friend.js":
/*!***********************!*\
  !*** ./src/friend.js ***!
  \***********************/
/***/ (function(module) {

function getPageSpmid() {
  var spmPrefixTag = document.getElementsByTagName('meta').spm_prefix;
  var spmPrefix = spmPrefixTag && spmPrefixTag.content;
  return spmPrefix ? spmPrefix + '.0.0' : '';
}

function Friend() {}

Friend.prototype = {
  addBlacklist: function addBlacklist(uid, callback, src) {
    var cb = callback ? callback : null;
    $.ajax({
      url: '//api.bilibili.com/x/relation/modify?cross_domain=true',
      type: 'POST',
      data: {
        fid: uid,
        act: 5,
        re_src: src || 15,
        spmid: getPageSpmid()
      },
      xhrFields: {
        withCredentials: true
      }
    }).done(function (res) {
      cb(res);
    });
  },
  follow: function follow(uid, callback, src) {
    var cb = callback ? callback : null;
    $.ajax({
      url: '//api.bilibili.com/x/relation/modify?cross_domain=true',
      type: 'POST',
      data: {
        fid: uid,
        act: 1,
        re_src: src || 15,
        spmid: getPageSpmid()
      },
      xhrFields: {
        withCredentials: true
      }
    }).done(function (res) {
      cb(res);
    });
  },
  whisperUser: function whisperUser(uid, callback) {
    var cb = callback ? callback : null;
    this.todoFriend({
      act: "add",
      attention: 0,
      format: "json",
      uid: uid
    }, cb);
  },
  unFollow: function unFollow(uid, callback, quiet, src) {
    var cb = callback ? callback : null;
    $.ajax({
      url: '//api.bilibili.com/x/relation/modify?cross_domain=true',
      type: 'POST',
      data: {
        fid: uid,
        act: quiet ? 4 : 2,
        re_src: src || 15,
        spmid: getPageSpmid()
      },
      xhrFields: {
        withCredentials: true
      }
    }).done(function (res) {
      cb(res);
    });
  },
  delFans: function delFans(uid, callback) {
    var cb = callback ? callback : null;
    this.todoFriend({
      act: "delFans",
      attention: 0,
      format: "json",
      uid: uid
    }, cb);
  }
};
module.exports = Friend;

/***/ }),

/***/ "./src/message_box.js":
/*!****************************!*\
  !*** ./src/message_box.js ***!
  \****************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

__webpack_require__(/*! ../static/style/less/message_box.less */ "./static/style/less/message_box.less");

var lastMessageBoxLayer = 20000;
/** Define MessageBox Class **/

/**
 * 支持4个显示方位+视区4条边界检测+两种动画效果
 */

function MessageBox(params) {
  this.params = {
    evType: "over",
    center: true,
    Overlap: false,
    focusShowPos: "up",
    zIndex: null,
    animation: "fade",
    position: null,
    event: null,
    bound: true,
    margin: 5,
    backdrop: false,
    bindInput: false
  };

  if (typeof params == 'string') {
    params = {
      evType: params
    };
  }

  if (_typeof(params) != 'object') {
    return;
  }

  for (var k in this.params) {
    if (params.hasOwnProperty(k)) {
      this.params[k] = params[k];
    }
  }
}

;
MessageBox.prototype = {
  timer: null,
  msgbox: null,
  bindobj: null,
  backobj: null,
  incomingTimer: null,
  position: {},
  reverseMap: {
    "up": "down",
    "down": "up",
    "left": "right",
    "right": "left"
  },
  show: function show(obj, msg, timeout, icon, onclick) {
    /**
    icon:
    ok
    warning
    question
    msg
    button
    **/
    obj = $(obj);
    if (this.params.Overlap == false && obj.attr('hasMessageBox') == 'yes') return;
    obj.attr('hasMessageBox', 'yes');
    if (typeof timeout == "undefined") timeout = 1000;
    if (typeof icon == "undefined") icon = "msg";

    if (timeout == "button") {
      onclick = icon;
      icon = timeout;
      timeout = 1000;
    }

    var vtimeout = timeout;
    if (timeout == 0) vtimeout = 50;
    var self = this;

    self.leftTimer = function () {
      if (icon == 'button') return;
      clearTimeout(self.timer);
      self.timer = setTimeout(function () {
        clearTimeout(self.timer);
        self.close(self);
      }, vtimeout);
    };

    self.incomingTimer = function () {
      clearTimeout(self.timer);
    };

    this.bindobj = obj;
    this.msgbox = $('<div class="m-layer m_layer"><div class="bg"><div class="content"><div class="mini"><div class="msg-text"><i class="b-icon"></i>' + msg + '</div>' + (icon == 'button' ? '<div class="btnbox"><a class="b-btn ok">确认</a><a class="b-btn-cancel cancel">取消</a></div>' : '') + '</div></div></div></div>').prependTo("body");
    this.msgbox.addClass('m-' + icon);

    if (self.params.backdrop) {
      self.backobj = $('<div class="m-backdrop"></div>').css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.6,
        backgroundColor: '#000',
        zIndex: (self.params.zIndex || lastMessageBoxLayer) - 1
      }).appendTo('body');
    }

    if (this.params.evType == 'over') {
      obj.bind('mouseleave', self.leftTimer);
      obj.bind('mouseenter', self.incomingTimer);
      this.msgbox.bind('mouseenter', function () {
        clearTimeout(self.timer);
      });
      this.msgbox.bind('mouseleave', self.leftTimer);
    } else {
      obj.bind('blur', self.leftTimer);
    }

    this.setPos();
    this.msgbox.css("z-index", self.params.zIndex || lastMessageBoxLayer++);

    if (this.params.bindInput && icon == "error") {
      if (obj.is(":text") || obj.is("textarea")) {
        obj.addClass("error").on("focus.m-error", this.closeErrHandler());
      } else if (obj.find(":text,textarea").length > 0) {
        obj.addClass("error").find(":text,textarea").on("focus.m-error", this.closeErrHandler());
      }
    }

    if (icon == "button") {
      this.msgbox.find(".ok").click(function () {
        if (typeof onclick == "undefined" || onclick(self) != false) {
          self.close();
        }
      });
      this.msgbox.find(".cancel").click(function () {
        self.close();
      });
    }

    if (timeout != 0) self.leftTimer();

    if (this.params.animation != 'fade') {
      this.msgbox.addClass(this.params.animation);
    } else {
      this.moveIn(this.params.focusShowPos);
    }

    this.bindobj.data('b-msgbox', this);
    return this.msgbox;
  },
  close: function close() {
    var self = this,
        closeCallback = function closeCallback() {
      self.msgbox.remove();

      if (self.params.backdrop) {
        self.backobj.remove();
      }

      if (self.params.evType == 'over') {
        self.bindobj.off('mouseenter', self.incomingTimer);
      }

      self.bindobj.off(self.params.evType == 'over' ? 'mouseleave' : 'blur', self.leftTimer);
    };

    this.bindobj.attr('hasMessageBox', '');

    if (this.params.animation != 'fade') {
      this.msgbox.removeClass(this.params.animation).fadeOut(200, closeCallback);
    } else {
      this.msgbox.fadeOut(200, closeCallback);
    }
  },
  closeErrHandler: function closeErrHandler() {
    var self = this;
    return function () {
      var obj = self.bindobj.removeClass('error');
      self.close();

      if (obj.is(":text") || obj.is("textarea")) {
        obj.off("focus.m-error");
      } else if (obj.find(":text,textarea").length > 0) {
        obj.find(":text,textarea").off("focus.m-error");
      }
    };
  },
  moveIn: function moveIn(pos) {
    var aniData = {
      "opacity": 1
    };
    var _moveT = 5,
        _moveL = 5;

    switch (pos) {
      case "up":
        aniData["top"] = "-=5";
        _moveL = 0;
        break;

      case "down":
        aniData["top"] = "+=5";
        _moveT = -_moveT;
        _moveL = 0;
        break;

      case "left":
        aniData["left"] = "-=5";
        _moveT = 0;
        break;

      case "right":
        aniData["left"] = "+=5";
        _moveL = -_moveL;
        _moveT = 0;
        break;

      default:
        aniData["top"] = "-=5";
        _moveL = 0;
    }

    this.msgbox.show().css({
      "top": this.position.top + _moveT,
      "left": this.position.left + _moveL,
      "opacity": 0
    });
    this.msgbox.animate(aniData, 200);
  },
  setPos: function setPos() {
    if (this.params.position) {
      this.position = this.params.position;
      this.resetBound();
    } else {
      this._pos(this.params.focusShowPos);
    }

    this.msgbox.css("left", this.position.left);
    this.msgbox.css("top", this.position.top);
  },
  _pos: function _pos(direction, reversed) {
    var obj = this.bindobj;
    this.params.focusShowPos = direction;

    switch (direction) {
      case "up":
        this.position.top = obj.offset().top - this.msgbox.outerHeight() - this.params.margin;
        this.position.left = obj.offset().left;

        if (this.params.center) {
          this.position.left = this.position.left - this.msgbox.outerWidth() / 2 + obj.outerWidth() / 2;
        }

        break;

      case "down":
        this.position.top = obj.offset().top + obj.outerHeight() + this.params.margin;
        this.position.left = obj.offset().left;

        if (this.params.center) {
          this.position.left = this.position.left - this.msgbox.outerWidth() / 2 + obj.outerWidth() / 2;
        }

        break;

      case "left":
        this.position.top = obj.offset().top;
        this.position.left = obj.offset().left - this.msgbox.outerWidth() - this.params.margin;
        break;

      case "right":
        this.position.top = obj.offset().top;
        this.position.left = obj.offset().left + obj.outerWidth() + this.params.margin;
        break;

      default:
        ;
    }

    if (!this.checkBound(direction)) {
      if (reversed !== true) {
        return this._pos(this.reverseMap[direction], true);
      } else {
        this.setBound('down');
        this.setBound('left');
        this.position.top -= 10;
        this.position.left += 10;
      }
    }

    this.resetBound();
    return this.position;
  },
  resetBound: function resetBound(force) {
    if (!this.params.bound && force !== true) {
      return;
    }

    var directions = ["up", "down", "left", "right"];

    for (var i = 0; i < directions.length; i++) {
      var dir = directions[i];

      if (!this.checkBound(dir)) {
        this.setBound(dir);
      }
    }
  },
  checkBound: function checkBound(direction) {
    switch (direction) {
      case "up":
        return this.position.top >= $(window).scrollTop();

      case "down":
        return this.position.top + this.msgbox.outerHeight() <= $(window).height() + $(window).scrollTop();

      case "left":
        return this.position.left >= $(window).scrollLeft();

      case "right":
        return this.position.left + this.msgbox.outerWidth() <= $(window).width() + $(window).scrollLeft();

      default:
        return true;
    }
  },
  setBound: function setBound(direction) {
    switch (direction) {
      case "up":
        this.position.top = $(window).scrollTop();
        break;

      case "down":
        this.position.top = $(window).height() + $(window).scrollTop() - this.msgbox.outerHeight();
        break;

      case "left":
        this.position.left = $(window).scrollLeft();
        break;

      case "right":
        this.position.left = $(window).width() + $(window).scrollLeft() - this.msgbox.outerWidth();
        break;

      default:
        ;
    }
  }
};
module.exports = MessageBox;

/***/ }),

/***/ "./src/new-comment/components/comment-box.js":
/*!***************************************************!*\
  !*** ./src/new-comment/components/comment-box.js ***!
  \***************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >评论容器盒子组件
var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    browser = _require.browser;

__webpack_require__(/*! ../../../static/style/less/new-comment/commment-box.less */ "./static/style/less/new-comment/commment-box.less");

var CommentBox = {
  init: function init(us) {
    if (us) {
      this.userStatus = $.extend({}, defaultStatus, us);
    }

    try {
      // 基本结构
      var h = ["<div class=\"bb-comment ".concat(browser.version.mobile ? 'bb-comment-h5' : '', "\">"), '<div class="reply-notice"></div>', '<div class="comment-header clearfix">', '<div class="tabs-order">', '<ul class="clearfix">', '<li class="default-sort" data-sort="0">评论</li>', "<li class=\"total-reply\"></li>", '<li data-sort="2" class="hot-sort on"></li>', '<li class="part-symbol"></li>', '<li data-sort="0" class="new-sort">最新</li>', '<li class="up-spot"></li>', '</ul>', '</div>', '<div class="header-interaction"></div>', '</div>', "<div class=\"comment-list ".concat(this.pageSize ? 'has-limit' : '', "\"></div>"), this.abtest.optimize ? '<div class="loading-state"></div>' : '', "<div class=\"bottom-page ".concat(browser.version.mobile ? 'paging-box' : 'paging-box-big', "\"></div>"), '</div>'].join('');
      this.$root.html(h);

      this._showLoading('<span>loading...</span>');

      if (this.userStatus.isLogin) {
        this._renderInteractionManage();
      }

      if (this.jumpId) {
        this.jumpToReply(this.jumpId);
      } else if (this.jumpToParent) {
        this.loadPage(1);
      } else if (this._isInView(this.$root)) {
        this.loadPage(1);
      }

      this.userCard.reset(this.userStatus);
    } catch (e) {
      window.console && window.console.log('[comment]', e);
    }
  }
};
module.exports = CommentBox;

/***/ }),

/***/ "./src/new-comment/components/header.js":
/*!**********************************************!*\
  !*** ./src/new-comment/components/header.js ***!
  \**********************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >头部组件
var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    cmGetUrl = _require.cmGetUrl;

__webpack_require__(/*! ../../../static/style/less/new-comment/header.less */ "./static/style/less/new-comment/header.less");

var Header = {
  _rednderInteractionDom: function _rednderInteractionDom(data) {
    var selection = data.up_reply_selection,
        reply = data.up_reply,
        dm = data.up_dm;
    this.interactionStatus = {
      selection: selection.status,
      reply: reply.status,
      dm: dm.status
    };

    if (!data.can_modify) {
      return;
    }

    var html = ['<div class="operation">', '<div class="spot"></div>', '<div class="opera-list">', '<ul>', selection.can_modify ? '<li class="up_reply_selection">' + (selection.status ? '停止' : '开启') + '评论精选</li>' : '', reply.can_modify ? '<li class="up_reply">' + (reply.status ? '关闭' : '恢复') + '评论</li>' : '', dm.can_modify ? '<li class="up_dm">' + (dm.status ? '关闭' : '恢复') + '弹幕</li>' : '', '</ul>', '</div>', '</div>'].join('');
    this.$root.find('.up-spot').html(html);
  },
  _renderNotice: function _renderNotice(notice) {
    var _notice$data = notice.data,
        data = _notice$data === void 0 ? {} : _notice$data;
    var hasLocalStorage = window.localStorage && window.localStorage.getItem;

    var _flagName, _id, target, h, link;

    if (notice.type === 'cm') {
      _flagName = 'comment-cm-flag';
      _id = data.creative_id;
      target = {
        id: _id,
        link: cmGetUrl(data, this.notice.locsId),
        content: data.name
      };
    }

    if (notice.type === 'notice' && data.id !== undefined) {
      _flagName = 'comment-notice-flag';
      _id = data.id;
      link = notice.data && notice.data.link || '';
      target = {
        id: _id,
        link: link.replace('__MID__', this.userStatus.mid || '__MID__').replace('__REQUESTID__', _id || '__REQUESTID__'),
        content: data.content
      };
    }

    var cachedId = hasLocalStorage ? window.localStorage.getItem(_flagName) || -1 : -1;
    if (notice.type === 'notice' && _id <= cachedId) return;

    if (notice.type === 'cm') {
      var nowTs = Date.now();
      var expireObjs = JSON.parse(cachedId);
      if (expireObjs[target.id] > nowTs) return;
    } // 情况一：如果是老的小黄条，只需要判断是否id 为正确


    if (_id !== undefined && this.notice.type === 'notice') {
      h = '<a href="' + target.link + '" target="_blank">' + '<div class="notice-item" data-id="' + target.id + '" flag-name="' + _flagName + '">' + '<i class="icon-close-notice"></i><i class="icon-notice"></i>' + target.content + '</div></a>';
      this.$root.find('.reply-notice').html(h);
      this.$root.find('.reply-notice').css('margin-bottom', '10px');
      this.$root.find('.notice-item').css('min-height', '40px');
      return;
    }

    if (this.notice.type !== 'cm') return; // 情况二：如果是商业小黄条，需要判断 是否有投放广告

    if (_id !== undefined && this.notice.isAd) {
      h = '<a href="' + target.link + '" target="_blank">' + '<div class="notice-item" data-id="' + target.id + '" flag-name="' + _flagName + '">' + '<i class="icon-close-notice"></i><i class="icon-notice"></i>' + target.content + '</div></a>';
      this.$root.find('.reply-notice').html(h);
      this.$root.find('.reply-notice').css('margin-bottom', '10px');
      this.$root.find('.notice-item').css('min-height', '40px');
      return;
    } // 情况三：如果是商业小黄条，需要 判断无投放广告也展示1px 内容


    h = "<div class=\"notice-item\" style=\"height:1px;padding:0px;border:0px;background: none;\"></div>";
    this.$root.find('.reply-notice').html(h);
    this.$root.find('.notice-item').append("<style>.notice-item::after{display:none}</style>");
  }
};
module.exports = Header;

/***/ }),

/***/ "./src/new-comment/components/modal.js":
/*!*********************************************!*\
  !*** ./src/new-comment/components/modal.js ***!
  \*********************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >对话框组件
var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    getByteLen = _require.getByteLen,
    customReport = _require.customReport;

var _require2 = __webpack_require__(/*! ../constant */ "./src/new-comment/constant.js"),
    api = _require2.api;

var Friend = __webpack_require__(/*! ../../friend.js */ "./src/friend.js");

var MessageBox = __webpack_require__(/*! ../../message_box.js */ "./src/message_box.js");

var friend = new Friend();

__webpack_require__(/*! ../../../static/style/less/new-comment/modal.less */ "./static/style/less/new-comment/modal.less");

var Modal = {
  /**
   * 举报评论
   * @param {Object} obj - 触发弹框的jquery对象
   * @param {Number} oid - 稿件或话题id
   * @param {Number} type - 页面类型
   * @param {Number} rid - 举报评论的id
   * @return {boolean}
   * @private
   */
  _reportFB: function _reportFB(obj, oid, type, rid) {
    var that = this;
    var me = this;
    var html = ['<div class="comment-bilibili-mask comment-report-bilibili-mask" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-report-bilibili">', '<div class="t">请选择举报理由<i class="btn-close"></i></div>', '<div class="con">', '<div class="reason-box"></div>', '<div class="other">', '<p class="btn-other"><input type="radio" name="reason" id="other" value="0" /><label for="other">其他</label></p>', '<div class="ta"><textarea placeholder="自定义理由" value=""></textarea></div></div>', '<div class="btn"><a class="btn-cancel">取消</a><a class="btn-submit">确定</a><div>', '</div></div></div>'].join('');
    $('.comment-report-bilibili-mask').remove();
    $('body').append(html);
    var data = [{
      type: '违反法律法规',
      list: [{
        name: '违法违规',
        reason: 9
      }, {
        name: '色情',
        reason: 2
      }, {
        name: '低俗',
        reason: 10
      }, {
        name: '赌博诈骗',
        reason: 12
      }]
    }, {
      type: '侵犯个人权益',
      list: [{
        name: '人身攻击',
        reason: 7
      }, {
        name: '侵犯隐私',
        reason: 15
      }]
    }, {
      type: '有害社区环境',
      list: [{
        name: '垃圾广告',
        reason: 1
      }, {
        name: '引战',
        reason: 4
      }, {
        name: '剧透',
        reason: 5
      }, {
        name: '刷屏',
        reason: 3
      }, {
        name: '抢楼',
        reason: 16
      }, {
        name: '内容不相关',
        reason: 8
      }, {
        name: '青少年不良信息',
        reason: 17
      }]
    }];
    var reasonBox = $('.comment-report-bilibili .reason-box');
    var reasonHtml = '';
    var m = 0;

    for (var i = 0; i < data.length; i++) {
      reasonHtml += '<dl class="clearfix"><dt>' + data[i].type + '</dt>';

      for (var j = 0; j < data[i]['list'].length; j++) {
        reasonHtml += '<dd><input type="radio" name="reason" id="r' + m + '" value="' + data[i]['list'][j]['reason'] + '" /><label for="r' + m + '">' + data[i]['list'][j]['name'] + '</label></dd>';
        m++;
      }

      reasonHtml += '</dl>';
    }

    reasonBox.append(reasonHtml);
    $('.comment-report-bilibili').off('click.comment-report-close').on('click.comment-report-close', '.btn-close,.btn-cancel', function (e) {
      $('.comment-report-bilibili-mask').remove();
    });
    $('.comment-report-bilibili').off('click.comment-report-label').on('click.comment-report-label', 'label', function (e) {
      if ($(this).attr('for') === 'other') {
        $('.comment-report-bilibili').find('.ta').show(200);
      } else {
        $('.comment-report-bilibili').find('.ta').hide(200);
      }
    });
    $('.comment-report-bilibili').off('click.comment-report-submit').on('click.comment-report-submit', '.btn-submit', function (e) {
      var reasonType = $('.comment-report-bilibili').find('input[type="radio"]:checked').val();
      var reasonText = $('.comment-report-bilibili').find('textarea').val();

      if (reasonType) {
        if (reasonType == '0') {
          if (reasonText) {
            if (getByteLen(reasonText) >= 2 && getByteLen(reasonText) <= 200) {
              ajaxReport(reasonType, reasonText, $(this));
            } else {
              new MessageBox().show($(this), "自定义举报内容长度为2-200字符", 1000, "error");
            }
          } else {
            new MessageBox().show($(this), "请完善举报理由", 1000, "error");
          }
        } else {
          ajaxReport(reasonType, reasonText, $(this));
        }
      } else {
        new MessageBox().show($(this), "请选择举报理由", 1000, "error");
      }
    }); //提交举报

    function ajaxReport(reasonType, reasonText, btn) {
      var params = {
        oid: oid,
        type: type,
        rpid: rid,
        reason: reasonType,
        content: reasonText,
        ordering: that.sort === 2 ? 'heat' : 'time',
        jsonp: 'jsonp'
      };
      $.ajax({
        url: api.report,
        type: 'post',
        data: params,
        xhrFields: {
          withCredentials: true
        }
      }).done(function (rs) {
        if (rs.code === 0) {
          new MessageBox().show(btn, "举报已受理", 3000, "info");
          $('.comment-report-bilibili-mask').remove();
        } else if (rs.code == 12019) {
          new MessageBox().show(btn, '举报过于频繁，请' + rs.data.ttl + '秒后重试', 3000, "error");
        } else {
          new MessageBox().show(btn, rs.message || "提交失败，请重试", 3000, "info");
        }

        me.trigger('report', params, rs);
      });
    }

    return false;
  },

  /**
   * 评论投票
   * @param {Object} obj - 触发弹框的jquery对象
   * @param {Number} voteId - 投票id
   * @param {Number} voteName - 投票名称
   * @return {boolean}
   * @private
   */
  _voteFB: function _voteFB(obj, voteId, voteName) {
    var html = ['<div class="comment-bilibili-mask comment-vote-bilibili-mask" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-vote-bilibili">', '<div class="t">' + voteName + '<i class="btn-close"></i></div>', '<div class="con">', '<div class="vote-iframe"><iframe src="//t.bilibili.com/h5/dynamic/vote#/result?vote_id=' + voteId + '&from=comment&isWeb=true" frameborder="0"></iframe></div>', '</div></div></div>'].join('');
    $('.comment-vote-bilibili-mask').remove();
    $('body').append(html);
    $('.comment-vote-bilibili').off('click.comment-vote-close').on('click.comment-vote-close', '.btn-close,.btn-cancel', function (e) {
      $('.comment-vote-bilibili-mask').remove();
    });
  },

  /**
   * 评论抽奖
   * @param {Object} obj - 触发弹框的jquery对象
   * @param {Number} lotteryId - 抽奖id
   * @return {boolean}
   * @private
   */
  _lotteryFB: function _lotteryFB(obj, lotteryId) {
    var html = ['<div class="comment-bilibili-mask comment-vote-bilibili-mask" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-vote-bilibili">', '<div class="t">评论抽奖<i class="btn-close"></i></div>', '<div class="con">', '<div class="vote-iframe"><iframe src="//t.bilibili.com/lottery/h5/index/#/result?lottery_id=' + lotteryId + '" frameborder="0"></iframe></div>', '</div></div></div>'].join('');
    $('.comment-vote-bilibili-mask').remove();
    $('body').append(html);
    $('.comment-vote-bilibili').off('click.comment-vote-close').on('click.comment-vote-close', '.btn-close,.btn-cancel', function (e) {
      $('.comment-vote-bilibili-mask').remove();
    });
  },

  /**
   * 加入黑名单
   * @param {Object} obj - 触发弹框的jquery对象
   * @param {Number} oid - 稿件或话题id
   * @param {Number} type - 页面类型
   * @param {Number} rid - 黑名单对象的id
   * @return {boolean}
   * @private
   */
  _blackListFB: function _blackListFB(obj, oid, type, mid, wrap) {
    var me = this,
        isUp = +this.upId === +this.userStatus.mid;
    var text = isUp ? '拉黑后，将取消我对他的关注<br>禁止该用户与我进行互动。本条评论也会被删除。' : '拉黑该用户之后，将自动解除关注关系，并禁止他关注我<br>以及与我互动。';
    var html = ['<div class="comment-bilibili-mask comment-bilibili-blacklist" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con">', '<div class="con">', '<div class="text">' + text + '</div>', '<div class="btn"><a class="btn-cancel blacklist-confirm">确认拉黑</a><a class="btn-submit blacklist-cancel">取消</a><div>', '</div></div></div>'].join('');
    $('.comment-bilibili-blacklist').remove();
    $('body').append(html);
    $('.comment-bilibili-blacklist').off('click.comment-blacklist-close').on('click.comment-blacklist-close', '.btn-close,.blacklist-cancel', function (e) {
      $('.comment-bilibili-blacklist').remove();
    });
    $('.comment-bilibili-blacklist').off('click.comment-blacklist-submit').on('click.comment-blacklist-submit', '.blacklist-confirm', function (e) {
      var that = this;
      friend.addBlacklist(mid, function (d) {
        if (d.code === 0) {
          var html = '';

          if (wrap.hasClass('list-item')) {
            var i = wrap.data('index');
            var item = me.fbData[i];
            html = '<div class="user-face"><img src="' + me.noface + '"></div>' + me._parentBlacklistDom(item, i, me._pos);
            wrap.html(html);
          }

          if (wrap.hasClass('reply-item')) {
            var i = wrap.parents('.list-item').data('index');
            var j = wrap.data('index');
            var item = me.fbData[i]['replies'][j];
            html = me._subBlacklistDom(item);
            $(html).insertAfter(wrap);
            wrap.remove();
          }

          if (!isUp) {
            new MessageBox().show($(that), "加入黑名单成功", 1000, "info");
            $('.comment-bilibili-blacklist').remove();
            $(wrap).remove();
          } else {
            me._delReply({
              id: oid,
              type: 'normal'
            }).done(function (d) {
              if (d.code === 0) {
                new MessageBox().show($(that), '加入黑名单成功');
                $(wrap).remove();
              } else {
                new MessageBox().show($(that), d.message || '操作失败');
              }

              me.trigger('delete', oid, d);
              $('.comment-bilibili-blacklist').remove();
            });
          }
        } else {
          new MessageBox().show(obj, "加入黑名单失败", 1000, "info");
          $('.comment-bilibili-blacklist').remove();
        }

        me.trigger('blackList', mid, d);
      });
    });
  },
  _interActionFB: function _interActionFB(type) {
    var me = this;
    var textList = {
      reply: {
        0: '恢复评论后，用户可正常发表评论、参与评论互动，已有的评论也恢复正常展示。',
        1: '关闭评论将会禁止任何人在此评论区发表内容，且已有评论在关闭期间将不可见。'
      },
      selection: {
        0: '开启精选评论后，所有评论都需经过我的确认后再向所有用户展示。可前往PC端创作中心',
        1: '停止精选评论后，如有遗留未处理评论，可前往PC端创作中心'
      },
      dm: {
        0: '恢复弹幕后，用户可正常发表弹幕、参与弹幕互动，已有的弹幕也恢复正常展示。',
        1: '关闭弹幕将会禁止任何人在此视频中发表弹幕，且已有弹幕在关闭期间将不可见。'
      }
    };
    var status = this.interactionStatus[type];
    var confirmText = '确认' + (status === 0 ? type === 'selection' ? '开启' : '恢复' : type === 'selection' ? '停止' : '关闭');
    var html = ['<div class="comment-bilibili-mask comment-bilibili-interaction" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con">', '<div class="con">', '<div class="text">' + textList[type][status] + '</div>', '<div class="btn"><a class="btn-cancel interaction-confirm">' + confirmText + '</a><a class="btn-submit interaction-cancel">取消</a><div>', '</div></div></div>'].join('');
    $('.comment-bilibili-interaction').remove();
    $('body').append(html);
    $('.comment-bilibili-interaction').off('click.comment-interaction-close').on('click.comment-interaction-close', '.btn-close,.interaction-cancel', function (e) {
      $('.comment-bilibili-interaction').remove();
    });
    $('.comment-bilibili-interaction').off('click.comment-interaction-submit').on('click.comment-interaction-submit', '.interaction-confirm', function (e) {
      var btn = this,
          data;

      if (type === 'dm') {
        data = {
          type: 1,
          aid: me.oid,
          state: status
        };
      } else {
        var action = type === 'selection' ? status === 1 ? 2 : 1 : status === 1 ? 3 : 4;
        data = {
          oid: me.oid,
          type: me.pageType,
          action: action
        };
      }

      customReport('interaction-submit', {
        type: type,
        status: status
      });
      $.ajax({
        type: 'post',
        url: type === 'dm' ? api.dmModify : api.interactionModify,
        dataType: 'json',
        data: data,
        xhrFields: {
          withCredentials: true
        }
      }).done(function (res) {
        if (res.code !== 0) {
          new MessageBox().show(btn, res.message || "操作失败", 1000, "error");
          return;
        }

        var data = res.data || {};
        new MessageBox().show(btn, data.action_toast || "操作成功", 1000, "info");
        var classMap = {
          selection: '.up_reply_selection',
          reply: '.up_reply',
          dm: '.up_dm'
        };
        var textMap = {
          selection: '评论精选',
          reply: '评论',
          dm: '弹幕'
        };
        var actionText = type === 'selection' ? status ? '开启' : '停止' : status ? '恢复' : '关闭';
        me.$root.find(classMap[type]).text(actionText + textMap[type]);
        me.interactionStatus[type] = 1 - me.interactionStatus[type];

        if (type === 'dm' && window.player) {
          // prevent api delay
          setTimeout(function () {
            window.player.outActions({
              dmSwitch: me.interactionStatus['dm'] === 1
            });
          }, 300);
        } else {
          me.firstLoad = false;
          me.loadPage(1);
        }

        $('.comment-bilibili-interaction').remove();
      }).fail(function () {
        new MessageBox().show(btn, "操作失败", 1000, "error");
      });
    });
  },
  _renameFB: function _renameFB() {
    customReport('rename-show');
    var me = this;
    var html = ['<div class="comment-bilibili-mask comment-bilibili-rename" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-rename-bilibili">', '<div class="t no-title"><i class="btn-close"></i></div>', '<div class="con">', '<div class="text">拥有昵称后才能评论哦！快来取个适合你的昵称吧！</div>', '<div>', '<input type="text" class="rename-input">', '<p class="err-info">', '<svg t="1606377669058" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1970" width="200" height="200"><path d="M941.632 737.536L602.24 192c-24-43.136-52.8-64-89.6-64-36.864 0-67.264 20.864-89.728 62.4L83.584 737.536c-24.064 41.6-25.6 78.4-6.464 110.464 19.2 31.936 52.8 48 99.264 48h672.384c46.464 0 80-16 99.328-48 17.536-32.064 16-68.8-6.464-110.464zM511.936 832C475.776 832 448 802.112 448 768c0-36.224 29.888-64 64-64 36.16 0 63.872 29.888 63.872 64 2.112 34.112-27.712 64-63.936 64z m45.824-241.216a45.824 45.824 0 0 1-91.52 0L448 377.152C448 345.216 477.248 320 512 320c34.752 0 64 25.216 64 57.152l-18.24 213.632z" p-id="1971" fill="#E40C0C"></path></svg>', '<span class="err-text">&nbsp;</span>', '</p>', '</div>', '<div class="btn">', '<a class="btn-cancel">取消</a>', '<a class="btn-submit">提交昵称</a>', '<div>', '</div></div></div>'].join('');
    $('body').append(html);
    var renameModal = $('.comment-bilibili-rename');
    renameModal.off('click.comment-rename-close').on('click.comment-rename-close', '.btn-close,.btn-cancel', function (e) {
      customReport('rename-cancel');
      renameModal.remove();
    });
    renameModal.off('click.comment-rename-submit').on('click.comment-rename-submit', '.btn-submit', function (e) {
      var btn = $(this);
      var unameInput = renameModal.find('.rename-input');
      var errInfo = renameModal.find('.err-info');
      var uname = unameInput.val();
      var errText = errInfo.find('.err-text');

      if (!uname) {
        unameInput.addClass('err');
        errText.html('请输入昵称').show();
        errInfo.find('svg').show();
        return;
      }

      $.ajax({
        type: 'post',
        url: api.updateName,
        dataType: 'json',
        data: {
          uname: uname,
          source: 'reply'
        },
        xhrFields: {
          withCredentials: true
        }
      }).then(function (res) {
        if (res.code !== 0) {
          unameInput.addClass('err');
          errText.html(res.message).show();
          errInfo.find('svg').show();
          customReport('rename-submit', false);
          return;
        }

        customReport('rename-submit', true);
        new MessageBox().show(btn, "修改成功", 1000, "info");
        renameModal.remove();
      });
    });
  },
  _blackroomExamFB: function _blackroomExamFB(obj, oid, type, mid, wrap) {
    var me = this;
    var html = ['<div class="comment-bilibili-mask comment-bilibili-blackexam" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con">', '<div class="con">', '<div class="text">该账号处于封禁中，点击申请答题</div>', '<div class="t no-title"><i class="btn-close"></i></div>', '<div class="btn"><a class="btn-cancel">取消</a><a class="btn-submit" target="_blank" href="//www.bilibili.com/blackroom/releaseexame.html">去答题</a><div>', '</div></div></div>'].join('');
    $('body').append(html);
    $('.comment-bilibili-blackexam').off('click.comment-blackexam-close').on('click.comment-blackexam-close', '.btn-close,.btn-cancel,.btn-submit', function (e) {
      $('.comment-bilibili-blackexam').remove();
    });
  },
  _foldFB: function _foldFB(target) {
    var me = this;

    this._getFoldedReply(this.foldedNext).then(function (res) {
      if (res.code !== 0) {
        new MessageBox().show(target, res.message, 2000, 'error');
        return;
      }

      var data = res.data;
      me.foldedNext = data.cursor.next;
      me.foldIsEnd = data.cursor.is_end;
      var list = '';
      data.replies.forEach(function (item) {
        list += me._createReplyItem(item, 0);
      });
      var html = ['<div class="comment-bilibili-mask comment-bilibili-fold' + (browser.version.mobile ? '-h5' : '') + '" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-fold-bilibili">', '<div class="t">查看评论<i class="btn-close"></i></div>', '<div class="comment-area"><div class="comment-list">', list, '</div></div>', '</div>', '</div>'].join('');
      $('body').append(html).addClass('preventScroll');

      me._registerEvent('.comment-bilibili-fold');

      me.foldDialogIsOpen = true;
      $('.comment-fold-bilibili').off('click.comment-fold-close').on('click.comment-fold-close', '.btn-close', function (e) {
        $('.comment-bilibili-fold').remove();
        $('body').removeClass('preventScroll');
        me.foldDialogIsOpen = false;
        me.foldedNext = null;
      });

      me._fixEmojiPosition();

      if (me._needLoadMoreFold()) {
        me._loadMoreFold();
      }

      $('.comment-bilibili-fold .comment-area').off('scroll').on('scroll', function () {
        if (me._needLoadMoreFold() && !me.isLoadingFold) {
          me._loadMoreFold();
        }
      });
    });
  },
  _subFoldFB: function _subFoldFB(target, root) {
    var me = this;

    this._getSubFoldedReply(root, this.subFoldedNext).then(function (res) {
      if (res.code !== 0) {
        new MessageBox().show(target, res.message, 2000, 'error');
        return;
      }

      var data = res.data;
      me.subFoldedNext = data.cursor.next;
      me.subFoldIsEnd = data.cursor.is_end;
      var list = '';
      list += me._createTopFoldedReplyItem(me.foldedReply[root]);
      list += '<p class="sub-fold-tip">被折叠评论</p>';
      data.replies.forEach(function (item, index) {
        list += me._createSubFoldedReplyItem(item, index === 0);
      });
      var html = ['<div class="comment-bilibili-mask comment-bilibili-fold comment-bilibili-sub-fold' + (browser.version.mobile ? '-h5' : '') + '" style="height:' + $(document).height() + 'px;">', '<div class="comment-bilibili-con comment-sub-fold-bilibili">', '<div class="t">查看评论<i class="btn-close"></i></div>', '<div class="comment-area"><div class="comment-list">', list, '</div></div>', '</div>', '</div>'].join('');
      $('body').append(html).addClass('preventScroll');

      me._registerEvent('.comment-bilibili-fold');

      me.subFoldDialogIsOpen = true;
      $('.comment-sub-fold-bilibili').off('click.comment-sub-fold-close').on('click.comment-sub-fold-close', '.btn-close', function (e) {
        $('.comment-bilibili-sub-fold').remove();
        $('body').removeClass('preventScroll');
        me.subFoldDialogIsOpen = false;
        me.subFoldedNext = null;
      });

      if (me._needLoadMoreSubFold()) {
        me._loadMoreSubFold(root);
      }

      $('.comment-bilibili-fold .comment-area').off('scroll').on('scroll', function () {
        if (me._needLoadMoreSubFold() && !me.isLoadingSubFold) {
          me._loadMoreSubFold(root);
        }
      });
    });
  }
};
module.exports = Modal;

/***/ }),

/***/ "./src/new-comment/components/pagination.js":
/*!**************************************************!*\
  !*** ./src/new-comment/components/pagination.js ***!
  \**************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >分页器组件
var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    browser = _require.browser,
    videoReport = _require.videoReport;

__webpack_require__(/*! ../../../static/style/less/new-comment/pagination.less */ "./static/style/less/new-comment/pagination.less");

var Pagination = {
  /**
   * 渲染底部的分页
   * @param {Object} pageInfo - 分页相关信息
   * @private
   */
  _renderBottomPagination: function _renderBottomPagination(pageInfo) {
    if (this.noPage) {
      var isLastPage = pageInfo.count <= this.pageSize;
      var html = '';

      if (isLastPage) {
        html = '没有更多了～';
      } else {
        html = '<a class="more-link" href="javascript:">查看更多评论</a>';
      }

      this.$root.find('.bottom-page').addClass('center').html(html);
      return;
    }

    console.log('run paging');
    var me = this;
    var count = Math.ceil(pageInfo.count / pageInfo.size);

    if (count > 1) {
      this.$root.find('.bottom-page').paging({
        pageCount: count,
        current: pageInfo.num,
        jump: browser.version.mobile ? false : true,
        smallSize: this.smallPager,
        backFn: function backFn(p) {
          me.$root.trigger('replyPageChange', {
            p: p,
            isBottom: true
          });
          me.trigger('replyPageChange', {
            p: p,
            isBottom: true
          });
          me.currentPage = p; //播放页日志上报

          videoReport('playpage_comment_pageclick2');
        }
      });
    } else {
      this.$root.find('.bottom-page').html('');
    }
  }
};
module.exports = Pagination;

/***/ }),

/***/ "./src/new-comment/components/reply.js":
/*!*********************************************!*\
  !*** ./src/new-comment/components/reply.js ***!
  \*********************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >评论列表组件
var UserAvatar = __webpack_require__(/*! @bilibili/userAvatar */ "./node_modules/@bilibili/userAvatar/dist/user-avatar.js");

var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    browser = _require.browser,
    isWebp = _require.isWebp,
    unhtml = _require.unhtml,
    formatLotteryTime = _require.formatLotteryTime,
    hexToRgbA = _require.hexToRgbA,
    trimHttp = _require.trimHttp,
    webp = _require.webp,
    selectStyle = _require.selectStyle,
    cookie = _require.cookie;

var medalGuardLevel = [__webpack_require__(/*! ../../../static/images/medal_level_1.png */ "./static/images/medal_level_1.png")["default"], __webpack_require__(/*! ../../../static/images/medal_level_2.png */ "./static/images/medal_level_2.png")["default"], __webpack_require__(/*! ../../../static/images/medal_level_3.png */ "./static/images/medal_level_3.png")["default"]];

var _require2 = __webpack_require__(/*! ../constant */ "./src/new-comment/constant.js"),
    levelIconList = _require2.levelIconList;

__webpack_require__("./static/style/less/new-comment sync recursive ^\\.\\/reply.*\\.less$")("./reply".concat(selectStyle(), ".less"));

var getImgSrc = function getImgSrc(file) {
  var option = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  return trimHttp(webp(file, option));
};

var Reply = {
  /**
   * 渲染回复列表
   * @param {Object[]} replies - 回复列表数据
   * @param {Number} pos - 热门评论查看更多的插入位置
   * @private
   */
  _renderReplyList: function _renderReplyList(replies, pos, isLastPage) {
    var list = '';

    if (!replies) {
      return;
    }

    this.fbData = replies;

    if (replies.length === 0 && !this.noPage && !this.next && !$('.loading-state')) {
      list += '<div class="no-more-reply">' + (this.control.bg_text || '没有更多信息') + '</div>';
    } else {
      this.$root.find('.no-more-reply').remove();

      for (var i = 0, len = replies.length; i < len; ++i) {
        var item = replies[i];

        if (item) {
          if (i < pos || item.isUpTop || item.isTop) {
            item.isHot = true;
          }

          list += this._createReplyItem(item, i, pos);

          if (pos && i === pos - 1 && this.isViewHot && pos < replies.length) {
            list += '<div class="hot-line"><span>以上为热门评论，<a class="more-hot">查看更多</a></span></div>';
          }
        }
      }

      if (isLastPage && this.folder.has_folded && !browser.version.mobile) {
        list += '<div class="reply-fold-tip"><a class="view-fold">查看被折叠的评论</a><a href="' + this.folder.rule + '" class="fold-rule" target="_blank">（折叠规则）</a></div>';
      }
    }

    if (this.abtest.optimize && this.next) {
      this.$root.find('.comment-list').append(list);
    } else {
      this.$root.find('.comment-list').html(list);
    }

    if (this.mounted) {
      this.mounted(replies);
    }
  },

  /**
   *
   * @param {Object} item - 评论条目数据
   * @param {Number} [i] - 评论条目索引
   * @param {Number} [pos] - 热评个数
   * @return {string}
   * @private
   */
  _createReplyItem: function _createReplyItem(item, i, pos) {
    if (item.invisible) {
      return '';
    }

    if (item.folder && item.folder.has_folded) {
      this.foldedReply[item.rpid] = item;
    }

    return ['<div class="list-item reply-wrap ' + (item.isTop || item.isUpTop ? 'is-top' : '') + '" data-id="' + item.rpid + (item.lottery_id ? '" data-lottery-id=' + item.lottery_id : '"') + ' data-index="' + i + '">', this._createUserFace(item), this._createListCon(item, i, pos), '</div>'].join('');
  },
  _createTopFoldedReplyItem: function _createTopFoldedReplyItem(item) {
    if (item.invisible) {
      return '';
    }

    return ['<div class="list-item reply-wrap top-fold-reply" data-id="' + item.rpid + '">', this._createUserFace(item), this._createTopFoldedListCon(item), '</div>'].join('');
  },
  _createSubFoldedReplyItem: function _createSubFoldedReplyItem(item, isFirst) {
    if (item.invisible) {
      return '';
    }

    return ['<div class="list-item reply-wrap ' + (isFirst ? 'no-border' : '') + '" data-id="' + item.rpid + '">', this._createUserFace(item), this._createSubFoldedListCon(item), '</div>'].join('');
  },
  _createLegalizeIcon: function _createLegalizeIcon(official_verify) {
    var legalizeIcon = '';

    if (official_verify && official_verify.type == 0) {
      legalizeIcon = '<div class="legalize p-auth" title="个人认证"></div>';
    } else if (official_verify && official_verify.type == 1) {
      legalizeIcon = '<div class="legalize o-auth" title="企业/团体认证"></div>';
    }

    return legalizeIcon;
  },
  _createUserFace: function _createUserFace(item) {
    var _item$member, _item$member2, _item$member2$nft_int, _item$member2$nft_int2, _item$member3, _item$member4, _item$member4$nft_int, _item$member4$nft_int2;

    //黑名单默认头像
    var blFace = '<div class="user-face"><img src="' + this.noface + '" class="blacklist-face"></div>';
    var verify = item.member.official_verify;
    var iconType = {
      0: 'personal',
      1: 'business'
    }[verify.type];
    var userAvatar = new UserAvatar.default({});
    var pendant = item.member.pendant;
    var pendantImg = isWebp ? pendant.image_enhance : pendant.image_enhance_frame || pendant.image;
    var normalAvatarStr = userAvatar.append({
      avatar: item.member.avatar,
      pendent: this.appMode !== 'comic' ? pendantImg : '',
      avatarWidth: 65,
      renderWidth: 40,
      isNFT: item === null || item === void 0 ? void 0 : (_item$member = item.member) === null || _item$member === void 0 ? void 0 : _item$member.face_nft_new,
      NFTIconType: item === null || item === void 0 ? void 0 : (_item$member2 = item.member) === null || _item$member2 === void 0 ? void 0 : (_item$member2$nft_int = _item$member2.nft_interaction) === null || _item$member2$nft_int === void 0 ? void 0 : (_item$member2$nft_int2 = _item$member2$nft_int.region) === null || _item$member2$nft_int2 === void 0 ? void 0 : _item$member2$nft_int2.type,
      iconType: iconType,
      isAnimate: !isWebp && Boolean(pendant.image_enhance_frame)
    });
    var widescreenAvatarStr = userAvatar.append({
      avatar: item.member.avatar,
      pendent: this.appMode !== 'comic' ? pendantImg : '',
      avatarWidth: 65,
      renderWidth: 48,
      isNFT: item === null || item === void 0 ? void 0 : (_item$member3 = item.member) === null || _item$member3 === void 0 ? void 0 : _item$member3.face_nft_new,
      NFTIconType: item === null || item === void 0 ? void 0 : (_item$member4 = item.member) === null || _item$member4 === void 0 ? void 0 : (_item$member4$nft_int = _item$member4.nft_interaction) === null || _item$member4$nft_int === void 0 ? void 0 : (_item$member4$nft_int2 = _item$member4$nft_int.region) === null || _item$member4$nft_int2 === void 0 ? void 0 : _item$member4$nft_int2.type,
      iconType: iconType,
      isAnimate: !isWebp && Boolean(pendant.image_enhance_frame)
    }); //正常头像

    var face = ['<div class="user-face normal">', '<a href="//space.bilibili.com/' + item.mid + '" target="_blank" data-usercard-mid="' + item.mid + '">', normalAvatarStr, '</a>', '</div>', '<div class="user-face widescreen">', '<a href="//space.bilibili.com/' + item.mid + '" target="_blank" data-usercard-mid="' + item.mid + '">', widescreenAvatarStr, '</a>', '</div>'].join('');
    return item.state === this.blacklistCode ? blFace : face;
  },
  _createNickNameDom: function _createNickNameDom(item) {
    var showColor = this.appMode !== 'comic';
    return ["<a data-usercard-mid=\"".concat(item.mid, "\" href=\"//space.bilibili.com/").concat(item.mid, "\" target=\"_black\" class=\"name\" style=\"color:").concat(showColor ? item.member.vip.nickname_color : '', "\">"), "".concat(unhtml(item.member.uname)), '</a>'].join('');
  },
  _createListCon: function _createListCon(item, i, pos) {
    var _item$member5;

    //黑名单结构
    var blCon = this._parentBlacklistDom(item, i, pos); //正常结构


    var con = ['<div class="con ' + (pos == i ? 'no-border' : '') + '">', '<div class="user">' + this._createNickNameDom(item), this._createLevelLink(item), this._identity(item.mid, item.assist, item.member.fans_detail, !(item !== null && item !== void 0 && (_item$member5 = item.member) !== null && _item$member5 !== void 0 && _item$member5.is_contractor)), // 契约比粉丝勋章优先级高
    this._createContractor(item), this._createNameplate(item.member.nameplate) + this._createUserSailing(item) + '</div>', this._createMsgContent(item), this._createPerfectReply(item), '<div class="info">', this._createPlatformDom(item.content.plat), "<span class=\"time-location\">", "<span class=\"reply-time\">".concat(this._formateTime(item.ctime), "</span>"), // item?.reply_control?.location ? `<span class="reply-location">IP属地：${item?.reply_control?.location || ''}</span>` : '',
    "</span>", item.lottery_id ? '' : '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', item.lottery_id ? '' : '<span class="hate ' + (item.action == 2 ? 'hated' : '') + '"><i></i></span>', item.lottery_id ? '' : this._createReplyBtn(item.rcount), item.lottery_id && item.mid !== this.userStatus.mid ? '' : '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', this._createLotteryContent(item.content), this._createVoteContent(item.content), this._createTags(item), '</div>', '<div class="reply-box">', this._createSubReplyList(item.replies, item.rcount, false, item.rpid, item.folder && item.folder.has_folded, item.reply_control), '</div>', '<div class="paging-box">', '</div>', '</div>'].join('');

    if (browser.version.mobile) {
      con = ['<div class="con ' + (pos == i ? 'no-border' : '') + '">', '<div class="user">' + this._identity(item.mid, item.assist, item.member.fans_detail), this._createNickNameDom(item), this._createLevelLink(item), this._createNameplate(item.member.nameplate) + '<div class="right">', '<span class="time">' + this._formateMobileTime(item.ctime) + '</span></div>', '</div>', this._createMsgContent(item), this._createVoteContent(item.content), '<div class="info">', this._createPlatformDom(item.content.plat), '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', '<span class="hate ' + (item.action == 2 ? 'hated' : '') + '"><i></i></span>', this._createReplyBtn(item.rcount), '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', this._createTags(item), '<div class="reply-box">', this._createSubReplyList(item.replies, item.rcount, false, item.rpid, item.folder && item.folder.has_folded, item.reply_control), '</div>', '<div class="paging-box">', '</div>', '</div>'].join('');
    }

    return item.state === this.blacklistCode ? blCon : con;
  },
  _createSubFoldedListCon: function _createSubFoldedListCon(item) {
    //黑名单结构
    var blCon = this._parentBlacklistDom(item, 0); //正常结构


    var con = ['<div class="con">', '<div class="user">' + this._identity(item.mid, item.assist, item.member.fans_detail), this._createNickNameDom(item), this._createLevelLink(item), this._createNameplate(item.member.nameplate), '</div>', this._createMsgContent(item), '<div class="info">', '<span class="time">' + this._formateTime(item.ctime) + '</span>', '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', this._createReplyBtn(item.rcount), '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>'].join('');

    if (browser.version.mobile) {
      con = ['<div class="con">', '<div class="user">' + this._identity(item.mid, item.assist, item.member.fans_detail), this._createNickNameDom(item), this._createLevelLink(item), this._createNameplate(item.member.nameplate), '<div class="right">', '<span class="time">' + this._formateMobileTime(item.ctime) + '</span></div>', '</div>', this._createMsgContent(item), '<div class="info">', this._createPlatformDom(item.content.plat), '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', this._createReplyBtn(item.rcount), '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>'].join('');
    }

    return item.state === this.blacklistCode ? blCon : con;
  },
  _createLevelLink: function _createLevelLink(item) {
    var _memberInfo$level_inf;

    var memberInfo = item === null || item === void 0 ? void 0 : item.member;
    if (this.appMode === 'comic') return '<i class="gap"></i>';
    var href = '//www.bilibili.com/blackboard/help.html#/?qid=59e2cffdaa69465486497bb35a5ac295';
    return ["<a class=\"level-link\" href=\"".concat(href, "\" target=\"_blank\">"), "<img class=\"level ".concat(memberInfo !== null && memberInfo !== void 0 && memberInfo.is_senior_member ? 'senior' : '', "\" src=\"").concat(getImgSrc(levelIconList[memberInfo !== null && memberInfo !== void 0 && memberInfo.is_senior_member ? 'senior' : memberInfo === null || memberInfo === void 0 ? void 0 : (_memberInfo$level_inf = memberInfo.level_info) === null || _memberInfo$level_inf === void 0 ? void 0 : _memberInfo$level_inf.current_level]), "\"></img>"), '</a>'].join('');
  },
  _createContractor: function _createContractor(item) {
    var memberInfo = item === null || item === void 0 ? void 0 : item.member;
    var isRender = memberInfo === null || memberInfo === void 0 ? void 0 : memberInfo.is_contractor;
    var contractText = memberInfo === null || memberInfo === void 0 ? void 0 : memberInfo.contract_desc;
    var fontFamily = '"Microsoft YaHei", Arial, Helvetica, sans-serif';

    var metrics = this._getTextMetrics(contractText, {
      fontWeight: 400,
      fontSize: 8,
      fontFamily: fontFamily
    });

    var boxWidth = Math.ceil(metrics.width);

    if (!isRender) {
      return '';
    }

    return ["<div class=\"contractor-box\" style=\"width:".concat(boxWidth + 2, "px\">"), "<span class=\"contractor-text\">".concat(memberInfo === null || memberInfo === void 0 ? void 0 : memberInfo.contract_desc, "</span>"), "</div>"].join('');
  },
  _createTopFoldedListCon: function _createTopFoldedListCon(item) {
    //黑名单结构
    var blCon = this._parentBlacklistDom(item, 0); //正常结构


    var con = ['<div class="con">', '<div class="user">' + this._identity(item.mid, item.assist, item.member.fans_detail), this._createNickNameDom(item), this._createLevelLink(item), this._createNameplate(item.member.nameplate), '</div>', this._createMsgContent(item), '<div class="info">', this._createPlatformDom(item.content.plat), '<span class="time">' + this._formateTime(item.ctime) + '</span>', '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', '<span class="hate ' + (item.action == 2 ? 'hated' : '') + '"><i></i></span>', this._createReplyBtn(item.rcount), '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>'].join('');

    if (browser.version.mobile) {
      con = ['<div class="con">', '<div class="user">' + this._createNickNameDom(item), this._createLevelLink(item), this._identity(item.mid, item.assist, item.member.fans_detail), this._createNameplate(item.member.nameplate), '<div class="right">', '<span class="time">' + this._formateMobileTime(item.ctime) + '</span></div>', '</div>', this._createMsgContent(item), '<div class="info">', this._createPlatformDom(item.content.plat), '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', '<span class="hate ' + (item.action == 2 ? 'hated' : '') + '"><i></i></span>', this._createReplyBtn(item.rcount), '<div class="operation more-operation"><div class="spot"></div><div class="opera-list"><ul>' + (this._canSetTop(item) ? '<li class="set-top">' + (item.isUpTop ? '取消置顶' : '设为置顶') + '</li>' : '') + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) && !item.isTop ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>'].join('');
    }

    return item.state === this.blacklistCode ? blCon : con;
  },
  _createMsgContent: function _createMsgContent(reply) {
    var h = '';

    if ([3, 4].indexOf(reply.state) !== -1 && !reply.content.lottery) {
      h = '<p><a href=\"javascript:;\">***</a></p>';
    } else {
      var msg = unhtml(reply.content.message.replace(/&amp;/g, '&'));

      var jumpStr = this._resolveJump(msg, reply.content.jump_url || {});

      var urlStr = this._resolveUrl(jumpStr);

      var memberMap = this._formateMemberMap(reply.content.members || []);

      var atStr = this._resolveAt(urlStr, memberMap);

      var emojiStr = this._resolveEmoji(atStr, reply.content.emote || {});

      var seekStr = this._resolveSeek(emojiStr);

      var voteStr = this._resolveVote(seekStr, reply.content);

      var lottery = this._resolveLottery(voteStr, reply.content);

      var message = this._resolveUnderlineWord(lottery, reply.content.jump_url || {});

      h = '<p class="text">' + (reply.isTop || reply.isUpTop ? '<span class="stick">置顶</span>' : '') + message + '</p>';
    }

    return h;
  },
  _createVoteContent: function _createVoteContent(content) {
    if (content.vote && content.vote.id && !content.lottery) {
      content.vote.title = unhtml(content.vote.title);
      var dom = ['<div class="vote-wrap">', '<div class="vote-container" data-id="' + content.vote.id + '" data-name="' + content.vote.title + '">', '<div class="image-area">', '<div class="share-img"></div>', '</div>', '<div class="text-area">', '<div class="text-content">' + content.vote.title + '</div>', '<div class="text-desc">' + content.vote.cnt + '人参与</div>', '<div class="vote-btn-box">', '<div class="vote-btn">投票</div>', '</div>', '</div>', '</div>', '</div>'].join('');
      return dom;
    } else {
      return '';
    }
  },
  _createLotteryContent: function _createLotteryContent(content) {
    if (content.lottery && content.lottery.lottery_id) {
      content.lottery.title = unhtml(content.lottery.title);
      var now = new Date().getTime();
      var desc;

      if (content.lottery.lottery_status === 2) {
        desc = '活动已结束';
      } else {
        desc = formatLotteryTime(content.lottery.lottery_time);
      }

      var dom = ['<div class="lottery-container" data-id="' + content.lottery.lottery_id + '">', '<div class="image-area">', '<div class="share-img"></div>', '</div>', '<div class="text-area">', '<div class="text-content">评论抽奖</div>', '<div class="text-desc">' + desc + '</div>', content.lottery.lottery_status === 2 ? '<div class="lottery-btn-box"><div class="lottery-btn">查看结果</div></div>' : '', '</div>', '</div>'].join('');
      return dom;
    } else {
      return '';
    }
  },

  /**
   * 显示UP 骑士 粉丝的处理
   * @param {Number} mid - 发该评论的用户id
   * @param {Number} assist - 发该评论的用户是否是骑士
   * @param {Number} fansgrade - 发该评论的用户是否是粉丝
   * @return {string}
   * @private
   */
  _identity: function _identity(mid, assist, fansMedal) {
    var isRender = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    if (!isRender) {
      return '';
    }

    var fontFamily = '"Microsoft YaHei", Arial, Helvetica, sans-serif';

    if (+this.upId === mid) {
      var metrics = this._getTextMetrics('UP', {
        fontWeight: 400,
        fontSize: 10,
        fontFamily: fontFamily
      });

      var upWidth = Math.ceil(metrics.width);
      return ["<span class=\"stick up\">", '<div class="tinyfont">UP</div>', '</span>'].join('');
    }

    if (assist) {
      var _metrics = this._getTextMetrics('骑士', {
        fontWeight: 400,
        fontSize: 10,
        fontFamily: fontFamily
      });

      var assistWidth = Math.ceil(_metrics.width);
      return ["<div class=\"stick assist\" style=\"width:".concat(assistWidth + 4, "px;\">"), '<div class="tinyfont">骑士</div>', '</div>'].join('');
    }

    if (this.appMode === 'comic') return '';

    if (fansMedal) {
      // fansMedal.level 1-20 纯色 21 + 渐变
      var backgroundColorStart = hexToRgbA(fansMedal.medal_color.toString(16));
      var backgroundColorEnd = hexToRgbA(fansMedal.medal_color_end.toString(16));
      var broderColor = hexToRgbA(fansMedal.medal_color_border.toString(16));
      var levelColor = hexToRgbA(fansMedal.medal_color_level.toString(16));
      var nameColor = hexToRgbA(fansMedal.medal_color_name.toString(16));
      var guardLevel = fansMedal.guard_level;
      var guardIcon = fansMedal === null || fansMedal === void 0 ? void 0 : fansMedal.guard_icon;
      var honorIcon = fansMedal === null || fansMedal === void 0 ? void 0 : fansMedal.honor_icon;

      var _metrics2 = this._getTextMetrics(fansMedal.medal_name, {
        fontWeight: 400,
        fontSize: 10,
        fontFamily: fontFamily
      });

      var medalNameWidth = Math.ceil(_metrics2.width);
      var normalLevelDom = ["<div class=\"medal-level\" style=\"border-color:".concat(broderColor, ";color:").concat(levelColor, "\">"), "<div class=\"tinyfont\">".concat(fansMedal.level, "</div>"), '</div>'].join('');
      var medalLevelIconDom = ["<div class=\"medal-level-icon\" style=\"background-image: url(".concat(honorIcon, "); color:").concat(levelColor, "\">"), "<div class=\"tinyfont\">".concat(fansMedal.level, "</div>"), "</div>"].join('');
      return ["<div class=\"medal\" style=\"padding-left:".concat(guardLevel > 0 ? '8' : '0', "px;\">"), "<img class=\"true-love-flag\" src=\"".concat(guardIcon, "\" style=\"display: ").concat(guardLevel > 0 ? 'block' : 'none', ";\">"), "<div class=\"true-love\" style=\"width: ".concat(medalNameWidth + 2, "px; padding-left: ").concat(guardLevel > 0 ? '8' : '2', "px; padding-right: ").concat(honorIcon ? '10px' : '0', "; border-color:").concat(broderColor, "; color:").concat(nameColor, "; background-image: linear-gradient(90deg, ").concat(backgroundColorStart, ", ").concat(backgroundColorEnd, ")\">"), "<div class=\"tinyfont\">".concat(fansMedal.medal_name, "</div>"), '</div>', honorIcon ? medalLevelIconDom : normalLevelDom, '</div>'].join(''); // return '<span class="stick true-love" style="border-color:' + broderColor + ';color:' + nameColor + '">' 
      //   + fansMedal.medal_name 
      //   + '<span class="medal-level" style="border-color:' + broderColor + ';color:' + levelColor + '">' + fansMedal.level + '</span>' 
      //   + '</span>'
    }

    return '';
  },
  _createReplyBtn: function _createReplyBtn(count) {
    if (count > 0) {
      return '<span class="reply btn-hover btn-highlight">回复</span>';
    } else {
      return '<span class="reply btn-hover">回复</span>';
    }
  },
  // 创建神评图标
  _createPerfectReply: function _createPerfectReply(item) {
    var _item$card_label;

    if (this.appMode === 'comic') return;
    if (!Array.isArray(item.card_label)) return '';
    var perfectReply = item === null || item === void 0 ? void 0 : (_item$card_label = item.card_label) === null || _item$card_label === void 0 ? void 0 : _item$card_label.find(function (item) {
      return item.type === 1;
    });

    if (perfectReply !== null && perfectReply !== void 0 && perfectReply.background) {
      return ["<div class=\"perfect-reply\">", "<img class=\"perfact-reply-bg\" src=\"".concat(trimHttp(perfectReply.background), "\" />"), "</div>"].join('');
    }

    return '';
  },
  _createTags: function _createTags(item) {
    var _this = this;

    if (!item.card_label) return '';
    var tagLabelList = item === null || item === void 0 ? void 0 : item.card_label.filter(function (item) {
      // 漫画评论用的是reply接口，'单话精选'tag的type也为1，会有冲突
      if (_this.appMode !== 'comic') {
        return (item === null || item === void 0 ? void 0 : item.type) !== 1;
      }

      return item;
    });
    var result = tagLabelList.map(function (x) {
      var tagStyle = {
        light: {
          background: x.label_color_day,
          color: x.text_color_day
        },
        dark: {
          background: x.label_color_night,
          color: x.text_color_night
        }
      }[cookie.get('theme_style')];
      return ["<span style=\"background:".concat(tagStyle === null || tagStyle === void 0 ? void 0 : tagStyle.background, ";color:").concat(tagStyle === null || tagStyle === void 0 ? void 0 : tagStyle.color, "\">"), "".concat(x.text_content), '</span>'].join('');
    });
    return "<div class=\"reply-tags\">".concat(result.join(''), "</div>");
  },
  _createNameplate: function _createNameplate(data) {
    if (this.appMode === 'comic') return '';

    if (data.image_small) {
      return '<div class="nameplate">' + '<a class="nameplate-icon"' + (browser.version.mobile ? '' : 'href="https://account.bilibili.com/site/nameplate.html" target="_blank"') + '><img src="' + trimHttp(webp(data.image_small, {
        w: 40,
        h: 40
      })) + '"></a>' + '<div class="nameplate-card">' + '<i class="nameplate-arrow"></i>' + '<img class="nameplate-pic" src="' + trimHttp(webp(data.image, {
        w: 62,
        h: 62
      })) + '">' + '<div class="nameplate-text">' + '<p class="n-name">' + data.name + '</p>' + '<p class="n-title" title="' + data.condition + '">' + data.condition + '</p>' + '<p class="n-type"><span>' + data.level + '</span><a href="https://account.bilibili.com/site/nameplate.html" target="_blank">查看全部>></a></p>' + '</div>' + '</div>' + '</div>';
    } else {
      return '';
    }
  },
  _createUserSailing: function _createUserSailing(item) {
    var _item$member6, _item$card_label2;

    if (this.appMode === 'comic') return '';
    var data = item === null || item === void 0 ? void 0 : (_item$member6 = item.member) === null || _item$member6 === void 0 ? void 0 : _item$member6.user_sailing; // 有神评则优先显示神评

    var isPerfectReply = Array.isArray(item === null || item === void 0 ? void 0 : item.card_label) && (item === null || item === void 0 ? void 0 : (_item$card_label2 = item.card_label) === null || _item$card_label2 === void 0 ? void 0 : _item$card_label2.find(function (item) {
      return item.type === 1;
    }));
    if (!(data && data.cardbg) || isPerfectReply) return '';
    var card = data.cardbg;
    var suitInfo = '';

    if (card.type === 'suit') {
      var id = card.fan.number;
      var idStr = id.toString();

      if (id < 100000) {
        idStr = '0'.repeat(6 - idStr.length) + idStr;
      }

      suitInfo = '<div class="sailing-info" style="color:' + card.fan.color + '">' + 'NO.<br>' + idStr + '</div>';
    }

    return '<div class="sailing">' + '<img class="sailing-img" src="' + trimHttp(webp(card.image, {
      w: 576,
      h: 96
    })) + '" alt="' + card.name + '"/>' + suitInfo + '</div>';
  },

  /**
   * 根据平台码返回dom
   * @param {Number} code - 平台码
   * @return {String}
   * @private
   */
  _createPlatformDom: function _createPlatformDom(code) {
    var text = '';

    if (code === 2) {
      text = '安卓客户端';
    } else if (code === 3) {
      text = 'iOS客户端';
    } else if (code === 4) {
      text = 'Windows Phone客户端';
    }

    return text && '<span class="plad">来自<a href="//app.bilibili.com/" target="_blank">' + text + '</a></span>';
  },

  /**
   * 构造子回复列表
   * @param {Object[]} replies - 子回复列表数据
   * @param {Number} count - 子回复总数
   * @param {Boolean} showMore - 是否显示全部
   * @param {Number} root - 父评论的id
   * @return {string}
   * @private
   */
  _createSubReplyList: function _createSubReplyList(replies, count, showMore, root, hasFolded, isLastPage, reply_control) {
    var list = '';
    var data;
    replies = replies || [];

    if (count === 0) {
      return list;
    } // 设置了显示全部或跳到指定评论时


    var find = this.jumpId ? this._checkId(replies, this.jumpId) : false;
    var max = showMore || find ? replies.length : Math.min(replies.length, 3);

    for (var i = 0; i < max; ++i) {
      var item = replies[i];

      var dom = this._createSubReplyItem(item, i);

      var blDom = this._subBlacklistDom(item);

      list += item.state === this.blacklistCode ? blDom : dom;
    }

    if ((isLastPage || count <= replies.length) && hasFolded && !browser.version.mobile) {
      list += '<div class="sub-reply-fold-tip"><a class="view-sub-fold" data-root="' + root + '">查看被折叠的回复</a><a href="' + this.folder.rule + '" class="fold-rule" target="_blank">（折叠规则）</a></div>';
    }

    if (!(showMore || find) && count > replies.length) {
      var countText = reply_control ? reply_control.sub_reply_entry_text : "\u5171".concat(count, "\u6761\u56DE\u590D"); // const currentCountText = countText.replace(/\d+/ig, (match, p1) => {
      //   return `<span>${match}</span>`
      // })

      list += ["<div class=\"view-more\">".concat(countText, "\uFF0C"), "<a class=\"btn-more\" data-pid=\"".concat(root, "\" data-fold=\"").concat(hasFolded, "\">\u70B9\u51FB\u67E5\u770B</a>"), '</div>'].join(''); // list += '<div class="view-more">共<b>' + count + '</b>条回复' 
      //   +', <a class="btn-more" data-pid="' + root + '" data-fold="' + hasFolded + '">点击查看</a></div>'
    }

    return list;
  },
  _createSubReplyUserFace: function _createSubReplyUserFace(item) {
    var userAvatar = new UserAvatar.default({});
    var iconType = {
      0: 'personal',
      1: 'business'
    }[item.member.official_verify.type];
    var normalAvatarStr = userAvatar.append({
      avatar: item.member.avatar,
      avatarWidth: 24,
      renderWidth: 24,
      iconType: iconType
    });
    var widescreenAvatarStr = userAvatar.append({
      avatar: item.member.avatar,
      avatarWidth: 30,
      renderWidth: 30,
      iconType: iconType
    });
    return ["<a href=\"//space.bilibili.com/".concat(item.mid, "\" data-usercard-mid=\"").concat(item.mid, "\" target=\"_blank\" class=\"reply-face normal\">").concat(normalAvatarStr, "</a>"), "<a href=\"//space.bilibili.com/".concat(item.mid, "\" data-usercard-mid=\"").concat(item.mid, "\" target=\"_blank\" class=\"reply-face widescreen\">").concat(widescreenAvatarStr, "</a>")];
  },
  _createSubReplyItem: function _createSubReplyItem(item, i) {
    if (item.invisible) {
      return '';
    }

    var dom = ['<div class="reply-item reply-wrap" data-id="' + item.rpid + '" data-index="' + i + '">', this._createSubReplyUserFace(item), '<div class="reply-con">', '<div class="user">', '<span class="userInfo">', this._createNickNameDom(item), this._createLevelLink(item), this._identity(item.mid), '</span>', this._createSubMsgContent(item), '</div>', '</div>', '<div class="info">', "<span class=\"time-location\">", "<span class=\"reply-time\">".concat(this._formateTime(item.ctime), "</span>"), // item?.reply_control?.location ? `<span class="reply-location">IP属地：${item?.reply_control?.location || ''}</span>` : '',
    "</span>", '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', '<span class="hate ' + (item.action == 2 ? 'hated' : '') + '"><i></i></span>', '<span class="reply btn-hover">回复</span>', '<div class="operation btn-hover btn-hide-re"><div class="spot"></div><div class="opera-list"><ul>' + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>'].join('');

    if (browser.version.mobile) {
      var dom = ['<div class="reply-item reply-wrap" data-id="' + item.rpid + '" data-index="' + i + '">', '<div class="reply-con">', '<div class="user">', this._createNickNameDom(item), this._createLevelLink(item), this._identity(item.mid), '<div class="right"><span class="time">' + this._formateMobileTime(item.ctime) + '</span></div>', '</a>', this._createSubMsgContent(item), '</div>', '<div class="info">', '<span class="like ' + (item.action == 1 ? 'liked' : '') + '"><i></i><span>' + (item.like ? item.like : '') + '</span></span>', '<span class="reply btn-hover">回复</span>', '<div class="operation btn-hover btn-hide-re"><div class="spot"></div><div class="opera-list"><ul>' + (this._canBlackList(item.mid) ? '<li class="blacklist">加入黑名单</li>' : '') + (this._canReport(item.mid) ? '<li class="report">举报</li>' : '') + (this._canDel(item.mid) ? '<li class="del" data-mid="' + item.mid + '">删除</li>' : '') + '</ul></div></div>', '</div>', '</div>', '</div>'].join('');
    }

    return dom;
  },
  _createSubMsgContent: function _createSubMsgContent(reply) {
    var h = '';

    if ([3, 4].indexOf(reply.state) !== -1) {
      h = '<a href=\"javascript:;\">***</a>';
    } else {
      var msg = unhtml(reply.content.message.replace(/&amp;/g, '&'));

      var jumpStr = this._resolveJump(msg, reply.content.jump_url || {});

      var urlStr = this._resolveUrl(jumpStr);

      var memberMap = this._formateMemberMap(reply.content.members || []);

      var atStr = this._resolveAt(urlStr, memberMap);

      var emojiStr = this._resolveEmoji(atStr, reply.content.emote || {});

      var seekStr = this._resolveSeek(emojiStr);

      h = '<span class="text-con">' + seekStr + '</span>';
    }

    return h;
  }
};
module.exports = Reply;

/***/ }),

/***/ "./src/new-comment/components/send.js":
/*!********************************************!*\
  !*** ./src/new-comment/components/send.js ***!
  \********************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

var _this = this;

// >发送评论组件
var UserAvatar = __webpack_require__(/*! @bilibili/userAvatar */ "./node_modules/@bilibili/userAvatar/dist/user-avatar.js");

var _require = __webpack_require__(/*! ../../utils */ "./src/utils.js"),
    trimHttp = _require.trimHttp,
    webp = _require.webp,
    isWebp = _require.isWebp;

__webpack_require__(/*! ../../../static/style/less/new-comment/send.less */ "./static/style/less/new-comment/send.less");

var renderFace = function renderFace(userStatus) {
  var _userStatus$officialV;

  var iconType = {
    0: 'personal',
    1: 'business'
  }[userStatus === null || userStatus === void 0 ? void 0 : (_userStatus$officialV = userStatus.officialVerify) === null || _userStatus$officialV === void 0 ? void 0 : _userStatus$officialV.type];
  var userAvatar = new UserAvatar.default({});
  var pendant = userStatus.pendant;
  var pendantImg = isWebp ? pendant === null || pendant === void 0 ? void 0 : pendant.image_enhance : (pendant === null || pendant === void 0 ? void 0 : pendant.image_enhance_frame) || (pendant === null || pendant === void 0 ? void 0 : pendant.image);
  var normalAvatarStr = userAvatar.append({
    avatar: userStatus.face,
    pendent: _this.appMode !== 'comic' ? pendantImg : '',
    avatarWidth: 65,
    renderWidth: 40,
    isNFT: userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_new,
    NFTIconType: (userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_type) && (userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_type),
    iconType: iconType,
    isAnimate: !isWebp && Boolean(pendant === null || pendant === void 0 ? void 0 : pendant.image_enhance_frame)
  });
  var widescreenAvatarStr = userAvatar.append({
    avatar: userStatus.face,
    pendent: _this.appMode !== 'comic' ? pendantImg : '',
    avatarWidth: 65,
    renderWidth: 48,
    isNFT: userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_new,
    NFTIconType: (userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_type) && (userStatus === null || userStatus === void 0 ? void 0 : userStatus.face_nft_type),
    iconType: iconType,
    isAnimate: !isWebp && Boolean(pendant === null || pendant === void 0 ? void 0 : pendant.image_enhance_frame)
  }); //正常头像

  var face = ['<div class="user-face normal">', normalAvatarStr, '</a>', '</div>', '<div class="user-face widescreen">', widescreenAvatarStr, '</a>', '</div>'].join('');
  return face;
};

var Send = {
  _createReplyBox: function _createReplyBox(options) {
    options = options || {};
    var cla = '';
    var disableText = '',
        subDisableText = '';
    var placeHolder = this.control.root_input_text || '请自觉遵守互联网相关的政策法规，严禁发布色情、暴力、反动的言论。';

    if (!this.userStatus.isLogin) {
      disableText = '请先登录后发表评论<a class="b-btn btn-open-mini-Login">登录</a>';
      subDisableText = '请先登录后发表评论<a class="b-btn btn-open-mini-Login">登录</a>';
      cla = 'no-login';
    } else if (options.forbid || this.control.input_disable) {
      disableText = this.control.root_input_text;
      subDisableText = this.control.child_input_text;
      cla = 'no-login';
    } else if (this.disableText) {
      disableText = this.disableText;
      cla = 'no-login';
    }

    var emojiBtnDom = options.forbid ? '' : ['<div class="comment-emoji" id="comment-emoji">', '<i class="face"></i>', '<span class="emoji-text">表情</span>', '</div>'].join('');
    return ["<div class=\"comment-send ".concat(cla, "\">"), renderFace(this.userStatus), "<div class=\"textarea-container\">", disableText ? "<div class=\"baffle-wrap\"><div class=\"baffle\">".concat(options.isSub ? subDisableText : disableText, "</div></div>") : '', "<i class=\"ipt-arrow\"></i>", "<textarea cols=\"80\" name=\"msg\" rows=\"5\" placeholder=\"".concat(placeHolder, "\" class=\"ipt-txt\"></textarea>"), "<button type=\"submit\" class=\"comment-submit\" ".concat(cla ? 'disabled="disabled"' : '', ">"), "<span class=\"submit-text\">\u53D1\u5E03</span>", "</button>", "</div>", emojiBtnDom, "</div>"].join('');
  },
  _createLiteReplyBox: function _createLiteReplyBox(options) {
    options = options || {};
    var cla = '';
    var disableText = '',
        subDisableText = '';
    var placeHolder = this.control.root_input_text || '请自觉遵守互联网相关的政策法规，严禁发布色情、暴力、反动的言论。';

    if (!this.userStatus.isLogin) {
      disableText = '请先登录后发表评论<a class="b-btn btn-open-mini-Login">登录</a>';
      subDisableText = '请先登录后发表评论<a class="b-btn btn-open-mini-Login">登录</a>';
      cla = 'no-login';
    } else if (options.forbid || this.control.input_disable) {
      disableText = this.control.root_input_text;
      subDisableText = this.control.child_input_text;
      cla = 'no-login';
    } else if (this.disableText) {
      disableText = this.disableText;
      cla = 'no-login';
    }

    var emojiBtnDom = options.forbid ? '' : ['<div class="comment-emoji comment-emoji-lite">', '<i class="face"></i>', '<span class="text">表情</span>', '</div>'].join('');
    return ["<div class=\"comment-send-lite ".concat(cla, "\">"), renderFace(this.userStatus), "<div class=\"textarea-container\">",  true ? "<div class=\"baffle-wrap\"><div class=\"baffle\">".concat(options.isSub ? subDisableText : disableText, "</div></div>") : 0, "<i class=\"ipt-arrow\"></i>", "<textarea cols=\"80\" name=\"msg\" rows=\"5\" placeholder=\"".concat(placeHolder, "\" class=\"ipt-txt\"></textarea>"), "<button type=\"submit\" class=\"comment-submit\" ".concat(cla ? 'disabled="disabled"' : '', ">"), "<span class=\"submit-text\">\u53D1\u5E03</span>", "</button>", "</div>", emojiBtnDom, "</div>", "<div class=\"comment-send-lite-mask\"></div>"].join('');
  }
};
module.exports = Send;

/***/ }),

/***/ "./src/new-comment/constant.js":
/*!*************************************!*\
  !*** ./src/new-comment/constant.js ***!
  \*************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >此文件用于存放通用常量
var BASE_URL = '//api.bilibili.com/x';
var api = {
  locs: "".concat(BASE_URL, "/web-show/res/locs"),
  nav: "".concat(BASE_URL, "/web-interface/nav"),
  reply: "".concat(BASE_URL, "/v2/reply"),
  main: "".concat(BASE_URL, "/v2/reply/main"),
  subReply: "".concat(BASE_URL, "/v2/reply/reply"),
  report: "".concat(BASE_URL, "/v2/reply/report"),
  blacklist: "".concat(BASE_URL, "/v2/reply/blacklist"),
  add: "".concat(BASE_URL, "/v2/reply/add"),
  emoji: "".concat(BASE_URL, "/emote/user/panel/web?business=reply"),
  setTop: "".concat(BASE_URL, "/v2/reply/top"),
  like: "".concat(BASE_URL, "/v2/reply/action"),
  hate: "".concat(BASE_URL, "/v2/reply/hate"),
  del: "".concat(BASE_URL, "/v2/reply/del"),
  lotteryDel: "".concat(BASE_URL, "/v2/reply/lottery/del"),
  jump: "".concat(BASE_URL, "/v2/reply/jump"),
  folded: "".concat(BASE_URL, "/v2/reply/folded"),
  replyFolded: "".concat(BASE_URL, "/v2/reply/reply/folded"),
  interactionStatus: "".concat(BASE_URL, "/v2/reply/subject/interaction-status"),
  interactionModify: "".concat(BASE_URL, "/v2/reply/subject/modify"),
  dmModify: "".concat(BASE_URL, "/v2/dm/subject/state/update"),
  updateName: "".concat(BASE_URL, "/member/web/uname/update"),
  abtest: "".concat(BASE_URL, "/web-frontend/ab/getabtestinfo")
};
var levelIconList = {
  0: __webpack_require__(/*! ../../static/images/ic_user level_0.svg */ "./static/images/ic_user level_0.svg")["default"],
  1: __webpack_require__(/*! ../../static/images/ic_user level_1.svg */ "./static/images/ic_user level_1.svg")["default"],
  2: __webpack_require__(/*! ../../static/images/ic_user level_2.svg */ "./static/images/ic_user level_2.svg")["default"],
  3: __webpack_require__(/*! ../../static/images/ic_user level_3.svg */ "./static/images/ic_user level_3.svg")["default"],
  4: __webpack_require__(/*! ../../static/images/ic_user level_4.svg */ "./static/images/ic_user level_4.svg")["default"],
  5: __webpack_require__(/*! ../../static/images/ic_user level_5.svg */ "./static/images/ic_user level_5.svg")["default"],
  6: __webpack_require__(/*! ../../static/images/ic_user level_6.svg */ "./static/images/ic_user level_6.svg")["default"],
  senior: __webpack_require__(/*! ../../static/images/ic_user level_6+.svg */ "./static/images/ic_user level_6+.svg")["default"]
};
var subPageSize = 10;
module.exports = {
  api: api,
  subPageSize: subPageSize,
  levelIconList: levelIconList
};

/***/ }),

/***/ "./src/new-comment/index.js":
/*!**********************************!*\
  !*** ./src/new-comment/index.js ***!
  \**********************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

// >此文件用于搭建评论组件构造函数
var CommentBox = __webpack_require__(/*! ./components/comment-box */ "./src/new-comment/components/comment-box.js");

var Header = __webpack_require__(/*! ./components/header */ "./src/new-comment/components/header.js");

var Send = __webpack_require__(/*! ./components/send */ "./src/new-comment/components/send.js");

var Reply = __webpack_require__(/*! ./components/reply */ "./src/new-comment/components/reply.js");

var Modal = __webpack_require__(/*! ./components/modal */ "./src/new-comment/components/modal.js");

var Pagination = __webpack_require__(/*! ./components/pagination */ "./src/new-comment/components/pagination.js");

var method = __webpack_require__(/*! ./method */ "./src/new-comment/method.js");

var _require = __webpack_require__(/*! ./constant */ "./src/new-comment/constant.js"),
    api = _require.api;

var _require2 = __webpack_require__(/*! ../utils.js */ "./src/utils.js"),
    jqAjaxHandle = _require2.jqAjaxHandle,
    initPaging = _require2.initPaging,
    asyncScript = _require2.asyncScript,
    browser = _require2.browser; // require('../../static/style/less/new-comment.less')


__webpack_require__(/*! @bilibili/userAvatar/dist/user-avatar.css */ "./node_modules/@bilibili/userAvatar/dist/user-avatar.css");
/**
 * @description 评论组件构造函数,后跟参数可以直接传可以传一个配置对象,也可以传多个配置参数
 * @param {String} parent - 绑定到的节点的选择符
 * @param {Number} oid - 视频aid或话题topic id
 * @param {Number} pageType - 评论所在页面类型 1:视频，2:话题
 * @param {Object} userStatus - 用户信息
 * @param {Number|String} jumpId - 需要跳转到的评论的id
 */


function Comment(parent) {
  for (var _len = arguments.length, config = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    config[_key - 1] = arguments[_key];
  }

  /// 将配置值赋给对应实例属性
  if (Object.prototype.toString.call(config[0]) === '[object Object]') {
    var _config$2;

    var _config$ = config[0],
        oid = _config$.oid,
        pageType = _config$.pageType,
        jumpId = _config$.jumpId,
        noLevelLimit = _config$.noLevelLimit,
        noPage = _config$.noPage,
        pageSize = _config$.pageSize,
        dynamicRepost = _config$.dynamicRepost,
        contentMaxLength = _config$.contentMaxLength,
        smallPager = _config$.smallPager,
        disableText = _config$.disableText,
        scroller = _config$.scroller,
        domain = _config$.domain;
    this.oid = oid;
    this.pageType = pageType;
    this.jumpId = jumpId;
    this.noLevelLimit = noLevelLimit;
    this.noPage = noPage;
    this.pageSize = pageSize || 20;
    this.dynamicRepost = dynamicRepost;
    this.contentMaxLength = contentMaxLength;
    this.smallPager = smallPager;
    this.disableText = disableText;
    this.scroller = scroller || window;

    if (domain) {
      for (var key in api) {
        api[k] = api[key].replace('api.bilibili.com', domain);
      }
    }

    var userStatus = (_config$2 = config[0]) === null || _config$2 === void 0 ? void 0 : _config$2.userStatus;
  } else {
    var _oid = config[0],
        _pageType = config[1],
        _userStatus = config[2],
        _jumpId = config[3],
        ex = config[4];
    this.oid = _oid;
    this.pageType = _pageType;
    this.jumpId = _jumpId;
    this.mounted = ex === null || ex === void 0 ? void 0 : ex.mounted;
    this.contentMaxLength = 1000;
  }

  this.noface = '//static.hdslb.com/images/member/noface.gif';
  this._caches = {
    parent: parent
  };
  this.upId = '';
  var defaultStatus = {
    isLogin: false,
    face: this.noface,
    vipStatus: 0,
    vipType: 0
  };
  this.sort = 2; //排序类型，0：最新评论，2：热门评论

  this.loaded = false;
  this.loading = false;
  this.likeRequest = null; // 发送点赞请求

  this.firstLoad = false;
  this.emojiLoaded = false;
  this.userStatus = defaultStatus;
  this.fbData = []; //缓存的评论列表

  this.events = {};
  this.pageInfo = {}; // 缓存的分页信息

  this.foldedReply = {};
  this.isViewHot = false; //是否显示热门评论标签

  this.readOnly = false; //只读

  this.blacklistCode = 9; //黑名单code码

  this.blacklist = 0; //是否被up加入黑名单

  this.assist = 0; //是否up主骑士员

  this._pos = -1;
  this.showBv = false;
  this.currentPage = 1;
  this.sendPosition = 1;
  this.control = {
    bg_text: "",
    child_input_text: "",
    input_disable: false,
    root_input_text: "",
    web_selection: false
  };
  this.notice = {
    sended: false,
    locsId: undefined,
    isAd: false,
    type: undefined,
    data: {}
  };
  this.jumpReportIndex = 0;
  this.jumpReport = {};
  this.interactionStatus = {
    selection: 0,
    reply: 0,
    dm: 0
  }; /// 判断是否在漫画的范围内

  this.appMode = 'main';

  if (browser.version.comicApp) {
    this.appMode = 'comic';
  }

  if ([22, 29].indexOf(this.pageType) !== -1) {
    this.appMode = 'comic';
  }

  this.next = null;
  this.isEnd = false;
  this.abtest = {};
  var me = this; /// 获取query 参数

  var oGetVars = {};

  if (window.location.search.length > 1) {
    for (var aItKey, nKeyId = 0, aCouples = window.location.search.substr(1).split("&"); nKeyId < aCouples.length; nKeyId++) {
      aItKey = aCouples[nKeyId].split("=");
      oGetVars[decodeURIComponent(aItKey[0])] = aItKey.length > 1 ? decodeURIComponent(aItKey[1]) : "";
    }
  }

  this.querySearch = oGetVars;
  this.jumpToParent = this.querySearch['jumpToComment'] === '1';
  var p = [];

  if (!window.jQuery) {
    p.push(asyncScript('//s1.hdslb.com/bfs/static/jinkela/long/js/jquery/jquery3.3.1.min.js'));
  }

  if (!window.BiliCm) {
    p.push(asyncScript('//s1.hdslb.com/bfs/cm/cm-sdk/static/js/bili-collect.js'));
  }

  Promise.all(p).then(function () {
    initPaging(me);
    jqAjaxHandle();
    me.start(parent, userStatus);
  }).catch(function (e) {
    console.error('loadscript error', e);
  });
  return this;
}
/* ======================= 渲染dom ======================= */
// 渲染容器


Comment.prototype.init = CommentBox.init; // 渲染头部

Comment.prototype._rednderInteractionDom = Header._rednderInteractionDom;
Comment.prototype._renderNotice = Header._renderNotice; // 渲染发送评论

Comment.prototype._createReplyBox = Send._createReplyBox;
Comment.prototype._createLiteReplyBox = Send._createLiteReplyBox; // 渲染评论列表

Comment.prototype._renderReplyList = Reply._renderReplyList;
Comment.prototype._createReplyItem = Reply._createReplyItem;
Comment.prototype._createTopFoldedReplyItem = Reply._createTopFoldedReplyItem;
Comment.prototype._createSubFoldedReplyItem = Reply._createSubFoldedReplyItem;
Comment.prototype._createLegalizeIcon = Reply._createLegalizeIcon;
Comment.prototype._createUserFace = Reply._createUserFace;
Comment.prototype._createNickNameDom = Reply._createNickNameDom;
Comment.prototype._createListCon = Reply._createListCon;
Comment.prototype._createSubFoldedListCon = Reply._createSubFoldedListCon;
Comment.prototype._createLevelLink = Reply._createLevelLink;
Comment.prototype._createContractor = Reply._createContractor;
Comment.prototype._createTopFoldedListCon = Reply._createTopFoldedListCon;
Comment.prototype._createMsgContent = Reply._createMsgContent;
Comment.prototype._createVoteContent = Reply._createVoteContent;
Comment.prototype._createLotteryContent = Reply._createLotteryContent;
Comment.prototype._identity = Reply._identity;
Comment.prototype._createReplyBtn = Reply._createReplyBtn;
Comment.prototype._createTags = Reply._createTags;
Comment.prototype._createPerfectReply = Reply._createPerfectReply;
Comment.prototype._createNameplate = Reply._createNameplate;
Comment.prototype._createUserSailing = Reply._createUserSailing;
Comment.prototype._createPlatformDom = Reply._createPlatformDom;
Comment.prototype._createSubReplyList = Reply._createSubReplyList;
Comment.prototype._createSubReplyUserFace = Reply._createSubReplyUserFace;
Comment.prototype._createSubReplyItem = Reply._createSubReplyItem;
Comment.prototype._createSubMsgContent = Reply._createSubMsgContent; // 渲染弹出的对话框

Comment.prototype._reportFB = Modal._reportFB;
Comment.prototype._voteFB = Modal._voteFB;
Comment.prototype._lotteryFB = Modal._lotteryFB;
Comment.prototype._blackListFB = Modal._blackListFB;
Comment.prototype._interActionFB = Modal._interActionFB;
Comment.prototype._renameFB = Modal._renameFB;
Comment.prototype._blackroomExamFB = Modal._blackroomExamFB;
Comment.prototype._foldFB = Modal._foldFB;
Comment.prototype._subFoldFB = Modal._subFoldFB; // 渲染底部分页器（漫画区才有）

Comment.prototype._renderBottomPagination = Pagination._renderBottomPagination;
/* ======================= 事件 ======================= */

Comment.prototype.on = method.on;
Comment.prototype.trigger = method.trigger;
Comment.prototype.quickLogin = method.quickLogin;
Comment.prototype.start = method.start;
Comment.prototype.initAbtest = method.initAbtest;
Comment.prototype._fixRootPosition = method._fixRootPosition;
Comment.prototype._fixEmojiPosition = method._fixEmojiPosition;
Comment.prototype._getEmoji = method._getEmoji;
Comment.prototype.handleEmojiData = method.handleEmojiData;
Comment.prototype._resolveEmoji = method._resolveEmoji;
Comment.prototype._resolveJump = method._resolveJump;
Comment.prototype._resolveUnderlineWord = method._resolveUnderlineWord;
Comment.prototype._createUnderlineLink = method._createUnderlineLink;
Comment.prototype._createLinkById = method._createLinkById;
Comment.prototype._resolveUrl = method._resolveUrl;
Comment.prototype._resolveSeek = method._resolveSeek;
Comment.prototype._resolveVote = method._resolveVote;
Comment.prototype._resolveLottery = method._resolveLottery;
Comment.prototype._resolveAt = method._resolveAt;
Comment.prototype._timeStrToNumber = method._timeStrToNumber;
Comment.prototype._formateMemberMap = method._formateMemberMap;
Comment.prototype.loadPage = method.loadPage;
Comment.prototype._renderTabs = method._renderTabs;
Comment.prototype._updateReplyListByData = method._updateReplyListByData;
Comment.prototype._uniq = method._uniq;
Comment.prototype._renderInteractionManage = method._renderInteractionManage;
Comment.prototype._canSetTop = method._canSetTop;
Comment.prototype._canReport = method._canReport;
Comment.prototype._canBlackList = method._canBlackList;
Comment.prototype._getTextMetrics = method._getTextMetrics;
Comment.prototype._canDel = method._canDel;
Comment.prototype._checkId = method._checkId;
Comment.prototype._formateTime = method._formateTime;
Comment.prototype._formateMobileTime = method._formateMobileTime;
Comment.prototype._getReplyByPage = method._getReplyByPage;
Comment.prototype._getLocs = method._getLocs;
Comment.prototype._getReplyByCursor = method._getReplyByCursor;
Comment.prototype._getSubReplyByPage = method._getSubReplyByPage;
Comment.prototype._getFoldedReply = method._getFoldedReply;
Comment.prototype._getSubFoldedReply = method._getSubFoldedReply;
Comment.prototype._sendMsg = method._sendMsg;
Comment.prototype._renderCaptcha = method._renderCaptcha;
Comment.prototype._removeCaptcha = method._removeCaptcha;
Comment.prototype._needLoadMoreFold = method._needLoadMoreFold;
Comment.prototype._loadMoreFold = method._loadMoreFold;
Comment.prototype._needLoadMoreSubFold = method._needLoadMoreSubFold;
Comment.prototype._loadMoreSubFold = method._loadMoreSubFold;
Comment.prototype._parentBlacklistDom = method._parentBlacklistDom;
Comment.prototype._subBlacklistDom = method._subBlacklistDom;
Comment.prototype._setTop = method._setTop;
Comment.prototype._delReply = method._delReply;
Comment.prototype._likeReply = method._likeReply;
Comment.prototype._hateReply = method._hateReply;
Comment.prototype._updateSubReplyByPage = method._updateSubReplyByPage;
Comment.prototype._registerEvent = method._registerEvent;
Comment.prototype._isInView = method._isInView;
Comment.prototype._showLoading = method._showLoading;
Comment.prototype._hideLoading = method._hideLoading;
Comment.prototype.jumpToReply = method.jumpToReply;
Comment.prototype._showMessage = method._showMessage;
Comment.prototype._reportEvent = method._reportEvent;
Comment.prototype._appendReplyToTop = method._appendReplyToTop;
Comment.prototype._appendSubReplyToTop = method._appendSubReplyToTop;
window.bbComment = Comment;
module.exports = Comment;

/***/ }),

/***/ "./src/new-comment/method.js":
/*!***********************************!*\
  !*** ./src/new-comment/method.js ***!
  \***********************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

// >此文件用于定义评论组件的事件和方法
var MessageBox = __webpack_require__(/*! ../message_box.js */ "./src/message_box.js");

var Emoji = __webpack_require__(/*! ../emoji.js */ "./src/emoji.js");

var UserCard = __webpack_require__(/*! ../user_card.js */ "./src/user_card.js");

var Friend = __webpack_require__(/*! ../friend.js */ "./src/friend.js");

var friend = new Friend();

var verify = __webpack_require__(/*! @bilibili/risk-control-captcha */ "./node_modules/@bilibili/risk-control-captcha/dist/risk-control-captcha.js").verify;

var BiliUser = __webpack_require__(/*! @bilibili/bili-user */ "./node_modules/@bilibili/bili-user/lib/index.js")["default"];

var _require = __webpack_require__(/*! ./constant */ "./src/new-comment/constant.js"),
    api = _require.api,
    subPageSize = _require.subPageSize;

var _require2 = __webpack_require__(/*! ../utils.js */ "./src/utils.js"),
    browser = _require2.browser,
    trimHttp = _require2.trimHttp,
    webp = _require2.webp,
    unhtml = _require2.unhtml,
    customReport = _require2.customReport,
    allCustomReport = _require2.allCustomReport,
    cookie = _require2.cookie,
    videoReport = _require2.videoReport,
    checkInView = _require2.checkInView,
    cmSendData = _require2.cmSendData,
    cmSendStrictData = _require2.cmSendStrictData,
    cmSendCloseData = _require2.cmSendCloseData,
    initPaging = _require2.initPaging;

var method = {
  on: function on(event, cb) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(cb);
  },
  trigger: function trigger(event) {
    if (!this.events[event]) {
      return;
    }

    var args = [];
    var me = this;

    for (var i = 1; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    this.events[event].forEach(function (cb) {
      cb.apply(me, args);
    });
  },
  quickLogin: function quickLogin() {
    if (browser.version.mobile) {
      location.href = '//passport.bilibili.com/login?gourl=' + encodeURIComponent(location.href);
    } else {
      BiliUser.quickLogin(function (res) {
        if (res.code === 0) {
          window.location.reload();
        }
      });
    }
  },
  start: function start(parent, userStatus) {
    var me = this;
    var defaultStatus = {
      isLogin: false,
      face: this.noface,
      vipStatus: 0,
      vipType: 0
    };
    this.$root = $(parent);

    if (!this.$root.length) {
      return;
    }

    if (window.reportObserver) {
      if (reportObserver.scrollTracker) {
        reportObserver.scrollTracker.scrollReportOffset = 1;
        reportObserver.scrollTracker.customReport(me.$root[0], '.list-item', 'replyCardShow', {
          type: me.pageType,
          oid: me.oid,
          page: function page() {
            return me.currentPage;
          },
          ordering: function ordering() {
            return me.sort === 2 ? 'heat' : 'time';
          },
          rpid: function rpid(node) {
            return $(node).data('id');
          }
        });
      } else if (typeof reportObserver.importTracker === 'function') {
        reportObserver.importTracker('scroll');

        window.onScrollTrackerLoaded = function () {
          reportObserver.scrollTracker.scrollReportOffset = 1;
          reportObserver.scrollTracker.customReport(me.$root[0], '.list-item', 'replyCardShow', {
            type: me.pageType,
            oid: me.oid,
            page: function page() {
              return me.currentPage;
            },
            ordering: function ordering() {
              return me.sort === 2 ? 'heat' : 'time';
            },
            rpid: function rpid(node) {
              return $(node).data('id');
            }
          });
        };
      }
    }

    this._fixRootPosition(); //名片


    this.userCard = new UserCard(this.userStatus);

    if (userStatus) {
      this.userStatus = $.extend({}, defaultStatus, userStatus);
      this.initAbtest();
    } else {
      BiliUser.get().then(function (res) {
        if (res.code === 0) {
          me.userStatus = $.extend({}, defaultStatus, res.data);
        }

        me.initAbtest();
      }).catch(function () {
        me.initAbtest();
      });
    }
  },
  initAbtest: function initAbtest() {
    var me = this;
    me.abtest = {};
    me.abtest.optimize = true; //abtest.web_reply_list

    if (me.jumpId || me.noPage) {
      me.abtest.optimize = false;
    } // TODO: 漫画独立处理他们的pc 端内容


    if (me.appMode === 'comic') {
      me.abtest.optimize = false;
    }

    me._registerEvent();

    me.init();
  },
  _fixRootPosition: function _fixRootPosition() {
    if (this.$root.css('position') == 'static') {
      this.$root.css({
        position: 'relative'
      });
    }
  },
  // 修复第一行包含大表情时头像错位的问题
  _fixEmojiPosition: function _fixEmojiPosition() {
    if (!browser.version.mobile) {
      var subReplyItem;

      if ($('.comment-fold-bilibili').length > 0) {
        subReplyItem = $('.comment-fold-bilibili .reply-item');
      } else {
        subReplyItem = this.$root.find('.reply-box .reply-item');
      }

      subReplyItem.each(function (index, item) {
        var head = $(item).find('.reply-face');
        var user = $(item).find('.user');
        var name = $(item).find('.name');

        if (head && user && name) {
          var offset = name.offset().top - user.offset().top;

          if (offset > 10) {
            head.css('top', '38px');
          } else {
            head.css('top', '9px');
          }
        }
      });
    }
  },

  /**
   * 获取表情数据
   */
  _getEmoji: function _getEmoji(ta, x, y, direction, position) {
    var me = this;
    me.emojiLoaded = true;
    $.ajax({
      url: api.emoji,
      xhrFields: {
        withCredentials: true
      }
    }).done(function (data) {
      if (data && data.data && data.code === 0) {
        //表情字典赋值
        var packages = data.data.packages || [];
        var edata = me.handleEmojiData(packages);
        me.emoji = new Emoji(me.$root, edata);
        me.emoji.show(ta, x, y, direction, position);
        $('.emoji-box').css('zIndex', 10001);
        me.trigger('emojiLoaded');
      }
    }).fail(function () {
      me.emojiLoaded = false;

      if (!me.loaded) {
        me._showLoading('<span>加载失败，<a class="reload-comment">点击重试</a></span>');
      }
    });
  },
  handleEmojiData: function handleEmojiData(packages) {
    var edata = [];

    for (var i = 0; i < packages.length; i++) {
      if (!(packages[i].flags && packages[i].no_access)) {
        var pack = packages[i];
        var group = {
          pid: pack.id,
          pname: pack.text,
          pstate: 0,
          purl: pack.url,
          type: pack.type,
          emojis: [],
          size: pack.meta && pack.meta.size === 1 ? 's' : 'l'
        };

        for (var j = 0; j < pack.emote.length; j++) {
          var item = pack.emote[j];
          var emoji = {
            id: item.id,
            name: item.text,
            url: item.url,
            state: 0,
            size: item.meta && item.meta.size === 1 ? 's' : 'l'
          };
          group.emojis.push(emoji);
        }

        edata.push(group);
      }
    }

    return edata;
  },
  _resolveEmoji: function _resolveEmoji(str, emote) {
    var reg = new RegExp(/\[[^\]]+\]/g);
    return str.replace(reg, function (match) {
      if (emote[match]) {
        var emoji = emote[match];

        if (emoji.type === 4) {
          return emoji.url;
        }

        var size = emoji.meta && emoji.meta.size === 1 ? 's' : 'l';
        return '<img src="' + trimHttp(webp(emoji.url, {
          w: 100,
          h: 100
        })) + '"' + (size === 's' ? ' class="small"' : '') + '>';
      }

      return match;
    });
    return str;
  },
  _resolveJump: function _resolveJump(str, jumpUrl) {
    var jumpUrlSortKeyList = []; // 由于服务端无法判断超链接中的状态,如http:xxxx/av123,会解析成两个超链接,一个超链接,一个av123视频,如果先将av123渲染为超链接,则会导致显示异常,因此前端需排序处理,优先处理普通超链接的【这里转为数据做排序处理】

    for (var item in jumpUrl) {
      if (item.startsWith('http')) {
        jumpUrlSortKeyList.unshift(item);
      } else {
        jumpUrlSortKeyList.push(item);
      }
    }

    for (var _i = 0, _jumpUrlSortKeyList = jumpUrlSortKeyList; _i < _jumpUrlSortKeyList.length; _i++) {
      var jumpKey = _jumpUrlSortKeyList[_i];

      if (str.includes(jumpKey)) {
        var _jumpInfo$extra;

        var jumpInfo = jumpUrl[jumpKey];
        var img = jumpInfo.prefix_icon ? '<img src="' + jumpInfo.prefix_icon + '" class="jump-img"/>' : '';
        var content = unhtml(jumpInfo.title);

        if ((_jumpInfo$extra = jumpInfo.extra) !== null && _jumpInfo$extra !== void 0 && _jumpInfo$extra.is_word_search) {
          continue;
        } else {
          var url = jumpInfo.pc_url ? jumpInfo.pc_url : jumpKey.indexOf('http') === 0 ? jumpKey : this._createLinkById(jumpKey);
          var res = img + (jumpInfo.state === 0 ? '<a href="' + url + '" data-report="' + this.jumpReportIndex + '" class="comment-jump-url" target="_blank">' + content + '</a>' : content);
          var reg = new RegExp(jumpKey.replace(/\?/, '\\?'), 'ig');

          try {
            var regStr = jumpKey.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\?/, '\\?');
            var reg = new RegExp(regStr, 'ig');
            str = str.replace(reg, res);
          } catch (e) {}
        }

        this.jumpReport[this.jumpReportIndex] = jumpInfo.click_report;
        this.jumpReportIndex++;
      }
    }

    return str;
  },
  // 该方法不能保证100%特殊场景适用，但可确保基本正常使用无误（待后续改造渲染内容方式
  _resolveUnderlineWord: function _resolveUnderlineWord(content, jumpUrl) {
    var _this = this;

    var renderUnderlineDom = function renderUnderlineDom(_ref) {
      var jumpInfo = _ref.jumpInfo,
          contentSplitArr = _ref.contentSplitArr,
          index = _ref.index;
      var content = unhtml(jumpInfo.title);
      var url = jumpInfo.pc_url ? jumpInfo.pc_url : _this._createUnderlineLink(item);
      prefixIconDom = jumpInfo.prefix_icon ? "<i class=\"underline jump-img\" style=\"background-image: url(".concat(jumpInfo.prefix_icon, ")\"></i>") : '';
      underlineDom = (jumpInfo.state === 0 ? "<a class=\"underline-link comment-jump-url\" href=\"".concat(url, "\" data-message=\"").concat(content, "\" data-report=\"").concat(_this.jumpReportIndex, "\" target=\"_blank\">").concat(content, "</a>") : content) + prefixIconDom;
      contentSplitArr[index] = "".concat(underlineDom).concat(contentSplitArr[index]);
    };

    var prefixIconDom = '';
    var underlineDom = '';

    for (var item in jumpUrl) {
      if (content.indexOf(item) >= 0) {
        var _jumpInfo$extra2;

        var jumpInfo = jumpUrl[item]; // 命中划词条件

        if ((_jumpInfo$extra2 = jumpInfo.extra) !== null && _jumpInfo$extra2 !== void 0 && _jumpInfo$extra2.is_word_search) {
          if (!this.searchWordInfo) {
            this.searchWordInfo = {
              totalCount: 0,
              specificWordCount: {}
            };
          }

          var searchWordInfo = this.searchWordInfo;
          var totalCount = searchWordInfo.totalCount;
          var searchWordCount = searchWordInfo.specificWordCount[item] ? searchWordInfo.specificWordCount[item] : 0;

          if (totalCount >= 20 || searchWordCount >= 1) {
            continue;
          } else {
            searchWordInfo.totalCount = totalCount + 1, searchWordInfo.specificWordCount[item] = searchWordCount + 1;
          }

          var contentSplitArr = content.split(item);

          for (var index in contentSplitArr) {
            if (index !== '0') {
              var _contentSplitArr$inde, _contentSplitArr$inde2, _contentSplitArr$inde3, _contentSplitArr$inde4;

              var ltCount = (_contentSplitArr$inde = contentSplitArr[index]) === null || _contentSplitArr$inde === void 0 ? void 0 : (_contentSplitArr$inde2 = _contentSplitArr$inde.match(/<a/g)) === null || _contentSplitArr$inde2 === void 0 ? void 0 : _contentSplitArr$inde2.length;
              var gtCount = (_contentSplitArr$inde3 = contentSplitArr[index]) === null || _contentSplitArr$inde3 === void 0 ? void 0 : (_contentSplitArr$inde4 = _contentSplitArr$inde3.match(/<\/a>/g)) === null || _contentSplitArr$inde4 === void 0 ? void 0 : _contentSplitArr$inde4.length; // 处理分割数组中含其他完整超链接的情况【 xxx(undeline)<a>xxx</a> => ['xxx', '<a>xxx</a>'] 】

              if (Number(ltCount) === Number(gtCount)) {
                // Number(undefined)为NaN, NaN不全等NaN
                // 防止出现【 <a>(undeline)</a><a>(underline)</a> => ['<a>', '</a><a>'], '</a>' 】的情况
                if (contentSplitArr[index].indexOf(/<a/g) > contentSplitArr[index].indexOf(/<\/a>/g)) {
                  continue;
                }

                renderUnderlineDom({
                  jumpInfo: jumpInfo,
                  contentSplitArr: contentSplitArr,
                  index: index
                });
                break;
              } // 处理分割数组中含非完整超链接的情况(包括不带超链接的情况)
              else {
                var _contentSplitArr$preI, _contentSplitArr$preI2, _contentSplitArr$next, _contentSplitArr$next2;

                var nextIndex = Number(index) + 1;
                var preIndex = Number(index) - 1;
                var preLtCount = (_contentSplitArr$preI = contentSplitArr[preIndex]) === null || _contentSplitArr$preI === void 0 ? void 0 : (_contentSplitArr$preI2 = _contentSplitArr$preI.match(/<a/g)) === null || _contentSplitArr$preI2 === void 0 ? void 0 : _contentSplitArr$preI2.length;
                var nextGtCount = (_contentSplitArr$next = contentSplitArr[nextIndex]) === null || _contentSplitArr$next === void 0 ? void 0 : (_contentSplitArr$next2 = _contentSplitArr$next.match(/<\/a>/g)) === null || _contentSplitArr$next2 === void 0 ? void 0 : _contentSplitArr$next2.length; // 处理【 (underline)<a>xxx(underline)x</a> => '<a>xxx', 'x</a>'】

                if (Number(ltCount) === Number(nextGtCount)) {
                  renderUnderlineDom({
                    jumpInfo: jumpInfo,
                    contentSplitArr: contentSplitArr,
                    index: index
                  });
                  break;
                } // 处理不含超链接的情况


                if (!ltCount && !gtCount) {
                  // 处理 【 <a>(underline)(underline)</a> => ['<a>', '', '</a>'] 】
                  if (Number(preLtCount) === Number(nextGtCount)) {
                    continue;
                  }

                  renderUnderlineDom({
                    jumpInfo: jumpInfo,
                    contentSplitArr: contentSplitArr,
                    index: index
                  });
                  break;
                }
              }
            }
          } // 数组回填文本时，需要把变成划词处的原划词文本删去 


          content = contentSplitArr.join(item);
          var reg = new RegExp("".concat(item, "(?=<a class=\"underline-link)"));
          content = content.replace(reg, '');
          break;
        }
      }
    }

    return content;
  },
  _createUnderlineLink: function _createUnderlineLink(str) {
    return "//search.bilibili.com/all?keyword=".concat(str);
  },
  _createLinkById: function _createLinkById(str) {
    if (/bv1/i.test(str)) {
      return '//www.bilibili.com/video/' + str;
    }

    if (/av/i.test(str)) {
      return '//www.bilibili.com/video/' + str.toLowerCase();
    }

    if (/cv/i.test(str)) {
      return '//www.bilibili.com/read/' + str;
    }
  },
  // 解析url
  _resolveUrl: function _resolveUrl(str) {
    // https://regex101.com/r/PtKCX3/2
    // var reg = /(http(s)?:\/\/)?([0-9a-zA-Z]+.)?((b23\.tv)|(kaola\.com)|(sugs\.suning\.com)|(biliapi\.net)|((bilibiliyoo|im9)\.com)|(biligame\.(com|cn))|(bilibili\.(com|tv|cn)))(\/?|<![^@])([-\.\_0-9A-Za-z\/]+(\/)?)?((\?|\&)(\w+=\w+))*(\#[0-9a-zA-Z]+)?(?![^<>]*>|[^"]*?<\/a)/ig
    var reg = /(?:(?:https?):\/\/)?(?:(?:[a-z0-9](?:[a-z0-9_\-]{0,61}[a-z0-9]){0,1}\.)*(?:b23\.tv|kaola\.com|sugs\.suning\.com|biliapi\.net|(?:bilibiliyoo|im9)\.com|biligame\.c(?:om|n)|bilibili\.(?:tv|c(?:om|n))))(?:[/\?](?:(?:[a-z0-9;/\?:@&=#~\-\.\+!\*'\(\),_\$])|(?:%[a-f0-9]{2}))*)?(?![^<>]*>|[^"]*?<\/a)/gi; // var match = str.match(reg)

    return str.replace(reg, function (match) {
      var unhtmlMatch = unhtml(match);
      var url = unhtmlMatch;

      try {
        match = decodeURI(s);
      } catch (e) {}

      if (match.indexOf('http') !== 0) {
        url = '//' + url;
      }

      return '<a href="' + url + '" target="_blank">' + unhtmlMatch + '</a>';
    });
  },

  /**
   * 处理视频跳转
   */
  _resolveSeek: function _resolveSeek(str) {
    var me = this;

    if (this.pageType === 1) {
      var seekReg = /(\d+\#)?(\d+(\:|\：)){1,2}\d\d/g;
      var matchResult = str.match(seekReg);

      if (matchResult) {
        matchResult.forEach(function (item) {
          if (item.indexOf('#') > 0) {
            var p = parseInt(item.split('#')[0]);
            var timeStr = item.split('#')[1];
          } else {
            var p = -1;
            var timeStr = item;
          }

          if (me._timeStrToNumber(timeStr)) {
            var time = me._timeStrToNumber(timeStr);

            str = str.replace(item, "<a class=\"video-seek\" data-p=\"".concat(p, "\" data-time=\"").concat(time, "\">").concat(item.replace(/：/g, ':'), " </a>"));
          }
        });
      }
    }

    return str;
  },

  /**
   * 处理投票
   */
  _resolveVote: function _resolveVote(str, content) {
    if (content.vote) {
      return str.replace(/\{vote:.*}/, '<a class="vote-link" data-id="' + content.vote.id + '" data-name="' + unhtml(content.vote.title) + '"><img src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIyLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMjggMjkiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4IDI5OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cjx0aXRsZT5Hcm91cCAyPC90aXRsZT4KPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CjxnIGlkPSJQYWdlLTEiIHN0eWxlPSJmaWxsOiMwMEExRDYiPgoJPGcgaWQ9IuWwgemdoiI+CgkJPGcgaWQ9Ikdyb3VwLTIiPgoJCQk8ZyBpZD0iUmVjdGFuZ2xlLTUiPgoJCQkJPHBhdGggZD0iTTMuMywyOC4zQzEuNSwyOC4zLDAsMjYuOSwwLDI1VjEwLjFjMC0xLjgsMS41LTMuMywzLjMtMy4zczMuMywxLjUsMy4zLDMuM1YyNUM2LjcsMjYuOSw1LjIsMjguMywzLjMsMjguM3ogTTMuMyw4CgkJCQkJYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMVYxMC4xQzUuNSw4LjksNC41LDgsMy4zLDh6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzFfIj4KCQkJCTxwYXRoIGQ9Ik0xNCwyOC40Yy0xLjgsMC0zLjMtMS41LTMuMy0zLjNWMy4zQzEwLjcsMS41LDEyLjIsMCwxNCwwczMuMywxLjUsMy4zLDMuM1YyNUMxNy4zLDI2LjksMTUuOCwyOC40LDE0LDI4LjR6IE0xNCwxLjIKCQkJCQljLTEuMiwwLTIuMSwxLTIuMSwyLjFWMjVjMCwxLjIsMSwyLjEsMi4xLDIuMWMxLjIsMCwyLjEtMSwyLjEtMi4xVjMuM0MxNi4xLDIuMiwxNS4yLDEuMiwxNCwxLjJ6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzJfIj4KCQkJCTxwYXRoIGQ9Ik0yNC43LDI4LjRjLTEuOCwwLTMuMy0xLjUtMy4zLTMuM3YtNi44YzAtMS44LDEuNS0zLjMsMy4zLTMuM3MzLjMsMS41LDMuMywzLjNWMjVDMjgsMjYuOSwyNi41LDI4LjQsMjQuNywyOC40egoJCQkJCSBNMjQuNywxNi4xYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMXYtNi44QzI2LjgsMTcsMjUuOCwxNi4xLDI0LjcsMTYuMXoiLz4KCQkJPC9nPgoJCTwvZz4KCTwvZz4KPC9nPgo8L3N2Zz4K" alt="" />' + unhtml(content.vote.title) + '</a>');
    } else {
      return str;
    }
  },

  /**
   * 处理抽奖
   */
  _resolveLottery: function _resolveLottery(str, content) {
    if (content.lottery) {
      return str.replace(/\{lottery:.*}/, '<a class="lottery-link" data-id="' + content.lottery.lottery_id + '"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAApVJREFUSA3tVEtoE1EUvfclE39gW7uypYKfih9UmkR3ol10Iy6aRItaUbppQSSpLhRdBTciuEhKcVFEdCNobJNuuhTduUhiKEIVUQJ+aqmgJbTWOpnrGduZxsnHhauKD4b37jn3vvPufW8u0UofXCuB7oHX62dlpoeFmxWrJ8ORtrHjD9+t0Senzwob2xSpZyNh76Nae1QVCAxONIo+l2aSWSF+QSRHyMV32KB2EVrLTGlgHeDGUhHfmWoiqhpBxtxFbPLJ3eTbl+r3nVBuOkwGhUVkXX3dhj3JiO+k0jwHEN8VjD3fX22fGgLSSiJPE11cNINHzvuzOPE3xfTqbs/meRMbPrf3LXzyooztpl1pVBVg5rQQdZ66Nd5gBTKxISi+ZR8byBxEllsUS8bCnLN9B9FoVI03HD0kzE2mEwitKHQZd7AJ5nt8gstuFaYfWOYh7oFPC7FKwmfUjFE4gCryROJCW860zWELBOO5dqHiAwSPmlst0rAIL4ikHgBA2YksFsC9gZDOBk8B/WL5Yu3BA+jWlGpKhL3TJu62SEg3o9qpZL+/18KccyCWvgfJr/CJODnLho9fV8os6+8CqOxnnLIjEM9eR8oV7wYvyAuf78F45oa1YemMrBAqW1nTCxZuZ+DeuPqx/nE+QWJEcIsuuP56PZbj0qyZRQO/y4FjX9KU8BSzujTS55108rYdiGfyoVg2ZAMlC7NE+OIlkL3sHEjfBHffBpYWFUvhdPob+7/AH6u38ktk/wfLuUrBUOQNDeZeLmOLK6Oo16GNKHC7K3A70Mc+OPFyAaFr6Dm3i7p+1em8aKNj6frpco7zmkuuOHG72ZUSaAncN5QpE1/wNLqmCrq0rJqxW7YVN9TnR5f9F8dPt6z3H8GtPW0AAAAASUVORK5CYII=" alt="" />评论抽奖</a>');
    } else {
      return str;
    }
  },

  /**
   * 处理消息中的@、换行、av链接
   * @param {String} str - 消息内容
   * @param {String[]} map - @使用的map
   * @private
   */
  _resolveAt: function _resolveAt(str, map) {
    return str.replace(/(?!<a[^>]*>)@[^\s]+(?![^<]*<\/a>)/g, function (match) {
      return map[match.trim().substring(1)] || match;
    }).replace(/(?!<a[^>]*>)(bv1)(\w{9})(?![^<]*<\/a>)/ig, this.showBv ? '<a href="//www.bilibili.com/video/bv1$2/" target="_blank">$1$2</a>' : '$1$2').replace(/(?!<a[^>]*>)av([0-9]+)(?![^<]*<\/a>)/ig, '<a href="//www.bilibili.com/video/av$1/" target="_blank" data-view="$1">av$1</a>').replace(/(?!<a[^>]*>)cv([0-9]+)(?![^<]*<\/a>)/ig, '<a href="//www.bilibili.com/read/cv$1/" target="_blank" data-view="$1">cv$1</a>').replace(/\n/g, "<br />");
  },

  /**
   * 时间字符串转秒数
   */
  _timeStrToNumber: function _timeStrToNumber(timeStr) {
    var arr = timeStr.split(/\:|\：/);

    if (arr.length === 3 && arr[1].length === 2 && arr[2].length === 2) {
      var hour = parseInt(arr[0]);
      var minute = parseInt(arr[1]);
      var second = parseInt(arr[2]);

      if (minute >= 0 && minute < 60 && second >= 0 && second < 60) {
        return second + minute * 60 + hour * 3600;
      }
    }

    if (arr.length === 2 && arr[1].length === 2) {
      var minute = parseInt(arr[0]);
      var second = parseInt(arr[1]);

      if (second >= 0 && second < 60) {
        return second + minute * 60;
      }
    }
  },
  _formateMemberMap: function _formateMemberMap(members) {
    var obj = {};
    var item;

    for (var i = 0, len = members.length; i < len; ++i) {
      item = members[i];
      obj[item.uname] = '<a class="jump-link--name" href="//space.bilibili.com/' + item.mid + '" target="_blank" data-usercard-mid="' + item.mid + '">@' + unhtml(item.uname) + ' </a>';
    }

    return obj;
  },

  /**
   * 加载并渲染评论
   * @param {Number} p - 页码
   * @param {Boolean} scroll - 是否需要滚动到顶部
   */
  loadPage: function loadPage(p, scroll) {
    var me = this;
    me.loading = true;

    if (scroll) {
      $(window).scrollTop(me.$root.offset().top);
    }

    if (this.abtest.optimize) {
      if (this.isEnd) {
        return;
      }

      this.$root.find('.loading-state').html('正在加载...');
    }

    var loadFunction = this.abtest.optimize ? this._getReplyByCursor() : this._getReplyByPage(p); // $.when(this._getLocs([me.notice.locsId]), loadFunction).done(function(v1, v2) {

    loadFunction.done(function (res2) {
      me._hideLoading();

      me.loaded = true;

      if (res2 && res2.code === 0) {
        if (res2.data) {
          var _res2$data, _res2$data$cursor;

          var cm_info = res2.data.cm_info;

          if (cm_info && cm_info.ads && Object.keys(cm_info.ads).length > 0) {
            me.notice.locsId = Object.keys(cm_info.ads)[0];
            me.notice.data = cm_info.ads[me.notice.locsId][0];
            me.notice.type = 'cm';
            me.notice.isAd = Boolean(cm_info.ads[me.notice.locsId][0].is_ad);
          }

          if (me.notice.isAd === false && res2.data.notice) {
            me.notice.data = res2.data.notice;
            me.notice.type = 'notice';
          }

          me.mode = res2.data.mode || res2.data.cursor.mode;
          me.show_type = res2.data.cursor ? res2.data.cursor.show_type : res2.data.control ? res2.data.control.show_type : 1, me.all_count = res2 === null || res2 === void 0 ? void 0 : (_res2$data = res2.data) === null || _res2$data === void 0 ? void 0 : (_res2$data$cursor = _res2$data.cursor) === null || _res2$data$cursor === void 0 ? void 0 : _res2$data$cursor.all_count;
          me.blacklist = res2.data.blacklist || 0;
          me.assist = res2.data.assist || 0;
          me.pageInfo = res2.data.page || {};
          me.readOnly = res2.data.config.read_only;
          me.folder = res2.data.folder || {};
          me.showBv = res2.data.show_bvid || false;
          var isLastPage = me.pageInfo.num * me.pageInfo.size >= me.pageInfo.count;
          var control = res2.data.control;

          if (control) {
            me.control.bg_text = control.bg_text;
            me.control.child_input_text = control.child_input_text;
            me.control.input_disable = control.input_disable;
            me.control.root_input_text = control.root_input_text;
            me.control.web_selection = control.web_selection;
          }

          me._renderTabs(res2);

          me._renderNotice(me.notice);

          me._updateReplyListByData(res2.data, p, isLastPage);

          if (me.abtest.optimize) {
            me.next = res2.data.cursor.next;
            me.isEnd = res2.data.cursor.is_end;

            if (me.isEnd) {
              me.$root.find('.loading-state').html('没有更多评论');
            } else {
              me.$root.find('.loading-state').html('');
            }
          } else {
            me._renderBottomPagination(me.pageInfo);
          }

          me._fixEmojiPosition();

          if (res2.data.page) {
            //获取外部元素 并赋值最大评论数
            $('.common .b-head .results').html(res2.data.page.acount || 0).show();
          } else if (res2.data.cursor) {
            $('.common .b-head .results').html(res2.data.cursor.all_count || 0).show();
          }

          $('.common .b-head .del-log').remove(); //初始化评论输入框

          if (!me.$root.find('.bb-comment > .comment-send')[0]) {
            $(me._createReplyBox()).insertBefore(me.$root.find('.comment-list'));
          }

          if (me.abtest.optimize && me.$root.find('.comment-send-lite').length === 0) {
            var _$$, _$$$getBoundingClient, _$$2, _$$2$getBoundingClien;

            $(me._createLiteReplyBox()).insertAfter(me.$root.find('.comment-list'));
            if (!$('.comment-send')) return;
            var sendWidth = $('.comment-send').width();
            var sendLeft = $(window).width() < 1681 ? (_$$ = $('.comment-send .user-face.normal')[0]) === null || _$$ === void 0 ? void 0 : (_$$$getBoundingClient = _$$.getBoundingClientRect()) === null || _$$$getBoundingClient === void 0 ? void 0 : _$$$getBoundingClient.left : (_$$2 = $('.comment-send .user-face.widescreen')[0]) === null || _$$2 === void 0 ? void 0 : (_$$2$getBoundingClien = _$$2.getBoundingClientRect()) === null || _$$2$getBoundingClien === void 0 ? void 0 : _$$2$getBoundingClien.left;
            $('.comment-send-lite').css('width', sendWidth);
            $('.comment-send-lite').css('left', sendLeft);
            $('.comment-send-lite-mask').css('width', sendWidth);
            $('.comment-send-lite-mask').css('left', sendLeft);
            $(window).resize(function () {
              var _$$3, _$$3$getBoundingClien, _$$4, _$$4$getBoundingClien;

              if (!$('.comment-send')) return;
              var sendWidth = $('.comment-send').width();
              var sendLeft = $(window).width() < 1681 ? (_$$3 = $('.comment-send .user-face.normal')[0]) === null || _$$3 === void 0 ? void 0 : (_$$3$getBoundingClien = _$$3.getBoundingClientRect()) === null || _$$3$getBoundingClien === void 0 ? void 0 : _$$3$getBoundingClien.left : (_$$4 = $('.comment-send .user-face.widescreen')[0]) === null || _$$4 === void 0 ? void 0 : (_$$4$getBoundingClien = _$$4.getBoundingClientRect()) === null || _$$4$getBoundingClien === void 0 ? void 0 : _$$4$getBoundingClien.left;
              $('.comment-send-lite').css('width', sendWidth);
              $('.comment-send-lite').css('left', sendLeft);
              $('.comment-send-lite-mask').css('width', sendWidth);
              $('.comment-send-lite-mask').css('left', sendLeft);
            });
          }

          me.trigger('pageLoaded', isLastPage, res2.data); //是否跳转到评论区域

          if (me.jumpToParent) {
            scrollTo(0, me.$root.offset().top);
          } // 加入评论数量


          if (me.all_count) {
            me.$root.find('.comment-header .tabs-order .total-reply').html(me.all_count);
          }
        }
      } else {
        me.$root.find('.bb-comment > .comment-send').remove();
        me.control = {
          bg_text: "",
          child_input_text: res2.message || '当前稿件评论功能已关闭',
          input_disable: false,
          root_input_text: res2.message || '当前稿件评论功能已关闭',
          web_selection: false
        };
        me.isEnd = true;
        me.$root.find('.loading-state').html('');
        $(me._createReplyBox({
          forbid: true
        })).insertBefore(me.$root.find('.comment-list'));
        me.$root.find('.comment-header .tabs-order .hot-sort').hide();
        me.$root.find('.comment-header .tabs-order .new-sort').hide();
        me.$root.find('.comment-header .tabs-order .total-reply').hide();

        me._renderReplyList([]);
      }
    }).fail(function () {
      if (!me.loaded) {
        me._showLoading('<span>加载失败，<a class="reload-comment">点击重试</a></span>');
      }
    }).always(function () {
      me.loading = false;
    });
  },
  _renderTabs: function _renderTabs(res) {
    if (this.firstLoad) {
      return;
    }

    this.firstLoad = true;
    customReport('replyShow', {
      ordering: this.mode === 3 ? 'heat' : 'time',
      type: this.pageType,
      oid: this.oid
    });
    var defaultTab = this.$root.find('.comment-header .tabs-order .default-sort');
    var newTab = this.$root.find('.comment-header .tabs-order .new-sort');
    var hotTab = this.$root.find('.comment-header .tabs-order .hot-sort');
    var partSymbol = this.$root.find('.comment-header .tabs-order .part-symbol');

    if (this.control.web_selection) {
      hotTab.html('精选评论');
      newTab.hide();
      partSymbol.hide();
      return;
    }

    if (this.mode === 2 || this.mode === 3) {
      hotTab.html('最热');
      defaultTab.hide().removeClass('on'); // 显示类型 1: 热评/新评切换

      if (this.show_type === 1) {
        newTab.show();
        hotTab.show();
      } // 显示类型 2:什么都不展示（意思是PC评论区只显示 hotTab）
      else if (this.show_type === 2) {
        hotTab.show();
        newTab.hide();
        partSymbol.hide();
      } // 排序模式 2-新评


      if (this.mode === 2) {
        newTab.addClass('on');
        hotTab.removeClass('on');
        this.sort = 0;

        if (!this.jumpId) {
          this.loadPage(1);
        }
      } // 排序模式 3-热评
      else if (this.mode === 3) {
        newTab.removeClass('on');
        hotTab.addClass('on');
      }
    }

    if (res.data.page && res.data.page.count >= 20 || res.data.hots || this.sort === 2) {
      hotTab.show();
    } else {
      hotTab.hide();
      partSymbol.hide();
    }

    if (res.data.hots) {
      this.isViewHot = true;
    } else {
      this.isViewHot = false;
    }
  },
  _updateReplyListByData: function _updateReplyListByData(data, p, isLastPage) {
    var topReplies = [];
    var pos = -1;
    var me = this;

    for (var i in data.top) {
      data.upper[i] = data.top[i];
    } // 缓存up的id


    me.upId = data.upper && data.upper.mid;
    me.hasUpTop = data.upper && data.upper.top;

    if (data.lottery_card && !me.next) {
      data.lottery_card.isUpTop = true;
      topReplies.push(data.lottery_card);
    }

    if (!this.abtest.optimize && data.top && (me.pageInfo.num === 1 || !me.next)) {
      data.top.isTop = true;
      topReplies.push(data.top);
    }

    if (data.upper && data.upper.admin && (me.pageInfo.num === 1 || !me.next)) {
      data.upper.admin.isTop = true;
      topReplies.push(data.upper.admin);
    }

    if (data.upper && data.upper.top && (me.pageInfo.num === 1 || !me.next)) {
      data.upper.top.isUpTop = true;
      topReplies.push(data.upper.top);
    }

    if (data.upper && data.upper.upper && (me.pageInfo.num === 1 || !me.next)) {
      data.upper.upper.isUpTop = true;
      topReplies.push(data.upper.upper);
    }

    if (data.upper && data.upper.vote && (me.pageInfo.num === 1 || !me.next)) {
      data.upper.vote.isUpTop = true;
      topReplies.push(data.upper.vote);
    } // 取最新评论的第一页时


    if (p === 1 && !me.next && me.sort === 0 && me.mode !== 2 && me.mode !== 3) {
      if (me.isViewHot) {
        topReplies = topReplies.concat(data.hots || []);
      }

      pos = data.hots && data.hots.length > 0 ? topReplies.length : -1;
      me._pos = pos;
    }

    var arr;

    if (data.replies instanceof Array) {
      arr = topReplies.length > 0 ? me._uniq(topReplies.concat(data.replies)) : topReplies.concat(data.replies);
    } else {
      arr = topReplies.length > 0 ? me._uniq(topReplies) : topReplies;
    }

    if (this.noPage && this.pageSize) {
      arr = arr.slice(0, this.pageSize);
    }

    me._renderReplyList(arr, pos, isLastPage);
  },
  // 置顶去重
  _uniq: function _uniq(a) {
    var seen = {};
    return a.filter(function (item) {
      return seen.hasOwnProperty(item.rpid) ? false : seen[item.rpid] = true;
    });
  },

  /**
   * 渲染顶部的互动管理
   * @private
   */
  _renderInteractionManage: function _renderInteractionManage() {
    var me = this;
    $.ajax({
      url: api.interactionStatus,
      type: 'GET',
      data: {
        type: this.pageType,
        oid: this.oid
      },
      xhrFields: {
        withCredentials: true
      }
    }).done(function (d) {
      if (d && d.code === 0) {
        me._rednderInteractionDom(d.data);
      }
    });
  },

  /**
   * 判断是否能置顶评论，up主可以操作评论置顶或取消置顶
   * @return {boolean}
   * @private
   */
  _canSetTop: function _canSetTop(reply) {
    if (!this.userStatus.isLogin) {
      return false;
    } // 不是up主


    if (+this.upId !== +this.userStatus.mid) {
      return false;
    } // 抽奖


    if (reply.lottery_id) {
      return false;
    } // 管理员置顶


    if (reply.isTop) {
      return false;
    }

    return true;
  },
  _canReport: function _canReport(id) {
    return +id !== +this.userStatus.mid;
  },
  _canBlackList: function _canBlackList(id) {
    return +id !== +this.userStatus.mid;
  },
  _getTextMetrics: function _getTextMetrics(msg, styles) {
    var canvas = this._caches.canvas ? this._caches.canvas : document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    ctx.font = "".concat(styles.fontWeight, " ").concat(styles.fontSize, "px ").concat(styles.fontFamily);
    var metrics = ctx.measureText(msg);
    this._caches.canvas = canvas;
    return {
      width: metrics.width
    };
  },

  /**
   * 判断是否能删除一条评论，up主或发该评论的用户可以删除
   * @param {Number} mid - 发该评论的用户id
   * @return {boolean}
   * @private
   */
  _canDel: function _canDel(mid) {
    if (!this.userStatus.isLogin) {
      return false;
    }

    return +this.upId === +this.userStatus.mid || +this.userStatus.mid === +mid || this.assist;
  },

  /**
  * 查看是否包含指定id的评论
  * @param {Object[]} arr - 评论数据
  * @param {Number} id - 指定id
  * @return {boolean}
  * @private
  */
  _checkId: function _checkId(arr, id) {
    for (var i = 0, len = arr.length; i < len; ++i) {
      if (+arr[i].rpid === +id) {
        return true;
      }
    }

    return false;
  },

  /**
   * 格式化评论创建时间
   * @param {Number} t - 时间(秒)
   * @return {string}
   * @private
   */
  _formateTime: function _formateTime(t) {
    if (!+t) {
      return t;
    }

    var now = Math.floor(new Date().getTime() / 1000);
    var td_start = new Date();
    td_start.setHours(0);
    td_start.setMinutes(0);
    td_start.setSeconds(0);
    td_start = Math.floor(td_start.getTime() / 1000);

    if (t > td_start && now - t >= 0) {
      if (now - t <= 50) {
        var _t = Math.floor((now - t) % 60 / 10) * 10;

        return (t > 10 ? _t : 10) + "秒前";
      } else if (now - t < 3600) {
        return Math.floor((now - t) / 60) + "分钟前";
      } else {
        return Math.floor((now - t) / 3600) + "小时前";
      }
    } else {
      var n_d = new Date();
      n_d.setTime(t * 1000);
      var m = n_d.getMonth() + 1;
      var d = n_d.getDate();
      var H = n_d.getHours();
      var M = n_d.getMinutes();
      if (m < 10) m = "0" + m;
      if (d < 10) d = "0" + d;
      if (H < 10) H = "0" + H;
      if (M < 10) M = "0" + M;
      return n_d.getFullYear() + "-" + m + "-" + d + " " + H + ":" + M;
    }
  },
  _formateMobileTime: function _formateMobileTime(t) {
    if (!+t) {
      return t;
    }

    var now = Math.floor(new Date().getTime() / 1000);

    if (now - t >= 0) {
      if (now - t <= 50) {
        var _t = Math.floor((now - t) % 60 / 10) * 10;

        return (t > 10 ? _t : 10) + "秒前";
      } else if (now - t < 3600) {
        return Math.floor((now - t) / 60) + "分钟前";
      } else if (now - t < 3600 * 24) {
        return Math.floor((now - t) / 3600) + "小时前";
      } else if (now - t < 3600 * 24 * 30) {
        return Math.floor((now - t) / 3600 / 24) + "天前";
      } else if (now - t < 3600 * 24 * 365) {
        return Math.floor((now - t) / 3600 / 24 / 30) + "月前";
      } else {
        return Math.floor((now - t) / 3600 / 24 / 365) + "年前";
      }
    }
  },

  /**
   * 获取某页回复数据
   * @param {Number} p - 页码
   * @private
   */
  _getReplyByPage: function _getReplyByPage(p) {
    var me = this;
    return $.ajax({
      url: api.reply,
      data: {
        jsonp: 'jsonp',
        pn: p,
        type: me.pageType,
        oid: me.oid,
        sort: me.sort
      },
      dataType: 'jsonp'
    });
  },
  _getLocs: function _getLocs(locsIds) {
    return $.ajax({
      url: api.locs,
      data: {
        pf: 0,
        // TOOD: pf 啥意思
        ids: locsIds.join(',')
      }
    });
  },

  /**
   * 获取下一组数据
   * @private
   */
  _getReplyByCursor: function _getReplyByCursor() {
    var me = this;
    return $.ajax({
      url: api.main,
      data: {
        jsonp: 'jsonp',
        next: me.next || 0,
        type: me.pageType,
        oid: me.oid,
        mode: me.sort === 0 ? 2 : 3,
        plat: 1
      },
      dataType: 'jsonp'
    });
  },

  /**
   * 获取子回复
   * @param {Number} prid - 父评论的id
   * @param {Number} p - 页码
   * @return {Object} ajax请求promise
   * @private
   */
  _getSubReplyByPage: function _getSubReplyByPage(prid, p) {
    var me = this;
    return $.ajax({
      url: api.subReply,
      data: {
        jsonp: 'jsonp',
        pn: p,
        type: me.pageType,
        oid: me.oid,
        ps: subPageSize,
        root: prid
      },
      dataType: 'jsonp'
    });
  },
  // 获取折叠评论
  _getFoldedReply: function _getFoldedReply(next) {
    var params = {
      oid: this.oid,
      type: this.pageType,
      jsonp: 'jsonp'
    };

    if (next) {
      params['next'] = next;
    }

    return $.ajax({
      url: api.folded,
      data: params,
      dataType: 'jsonp'
    });
  },
  // 获取折叠子评论
  _getSubFoldedReply: function _getSubFoldedReply(root, next) {
    var params = {
      oid: this.oid,
      type: this.pageType,
      root: root,
      jsonp: 'jsonp'
    };

    if (next) {
      params['next'] = next;
    }

    return $.ajax({
      url: api.replyFolded,
      data: params,
      dataType: 'jsonp'
    });
  },

  /**
   * 发送评论
   * @param {Dom elem} target - 发送模块
   * @param {Object} opt - 要发送的消息参数
   * @param {Function} cb - 发送成功后回调
   */
  _sendMsg: function _sendMsg(target, opt, cb) {
    var the = this;
    var btn = $(target).find('.comment-submit');
    var ta = $(target).find('textarea');
    var atMsg = this.isSubReply; //匹配以[开始]结尾 并且中间没有] []内格式为XXX_XXX 的字符串

    var reg = new RegExp(/\[[^\]]+_[^\]]+\]/g);
    var copy = opt.msg; //过滤字符串前后的空格

    copy = copy.replace(/(^\s*)|(\s*$)/g, '');

    if (copy.length === 0) {
      new MessageBox().show(btn, '你还没有评论！', 2000, 'error');
      ta.focus().parent().addClass('error');
      return false;
    } else {
      ta.parent().removeClass('error');
      btn.addClass('disabled');
      $('submit-text').text('发送中');
      the.timer = setTimeout(function () {
        clearTimeout(the.timer);
        btn.removeClass('disabled');
        $('submit-text').text('发布');
        new MessageBox().show(target, '当前网速不太给力哦，请尝试重新提交~', 2000, 'info');
      }, 5000);
    } // 处理空格和换行 最多连续 5【全角】个空格 和  最多连续 3个换行


    var mg = String(opt.msg).replace(/\　{5,}/g, '　　　').replace(/\n{3,}/g, '\n\n\n') || opt.msg;
    var message = (atMsg ? this.atMsg : '') + mg;
    console.log('send', message);
    customReport('reply-send-click', {
      oid: this.oid,
      type: this.pageType,
      root: opt.rid,
      parent: opt.pid,
      ordering: this.sort === 2 ? 'heat' : 'time'
    });
    var option = {
      oid: this.oid,
      type: this.pageType,
      root: opt.rid,
      parent: opt.pid,
      message: message,
      plat: opt.plat,
      code: opt.code,
      code_v2: opt.code_v2,
      ordering: this.sort === 2 ? 'heat' : 'time',
      jsonp: 'jsonp'
    };
    $.ajax({
      url: api.add,
      type: "POST",
      data: option,
      dataType: "json",
      xhrFields: {
        withCredentials: true
      },
      success: function success(data) {
        if (data && data.code === 0) {
          ta.val(''); //成功后回调

          if (cb && data.data.success_action === 0) {
            cb(data.data.rpid, data.data.reply);
          }

          new MessageBox().show(btn, data.data.success_toast || '发送成功', 2000);

          the._removeCaptcha();

          if (the.dynamicRepost) {
            var _the$$root$find$;

            var isRepost = (_the$$root$find$ = the.$root.find('.dynamic-repost-checkbox')[0]) === null || _the$$root$find$ === void 0 ? void 0 : _the$$root$find$.checked;

            if (isRepost) {
              the.trigger('dynamicRepost', message, the.oid, the.userStatus.mid);
            }
          }

          console.log($('.comment-send-lite .ipt-txt').val());

          if ($('.comment-send-lite').length > 0 && !$('.comment-send-lite .ipt-txt').val()) {
            $('.comment-send-lite-mask').removeClass('focus');
          }
        } else if (data.code === 12041) {
          the._blackroomExamFB();
        } else if (data.code === 61001 || data.code === 61002) {
          $.getScript("//static.hdslb.com/common/js/identityDialog.js", function () {
            IdentityDialog(data.code, data.message);
          });
        } else if (data.code === 12074) {
          the._renameFB();
        } else if (data && !(data.data && data.data.need_captcha_v2)) {
          new MessageBox().show(btn, data.message || '操作失败', 2000, 'error');
        } //触发验证码


        if (data && data.data && data.data.need_captcha_v2) {
          customReport('rite-verify_show', {
            oid: the.oid,
            type: the.pageType,
            ordering: the.sort === 2 ? 'heat' : 'time',
            page: the.isSubReply ? 'detail' : 'list'
          });
          var verifyOpt = {
            verifyMethod: "biliword",
            verifyRelation: "0",
            extraInfo: {
              oid: the.oid,
              page: the.isSubReply ? 'detail' : 'list',
              type: the.pageType,
              ordering: the.sort === 2 ? 'heat' : 'time'
            },
            biz: "reply",
            theme: 'primary'
          };
          verify(verifyOpt).then(function (res) {
            opt.code_v2 = res.token;

            the._sendMsg(target, opt, cb);

            customReport('rite-verify_submit_click', {
              oid: the.oid,
              type: the.pageType,
              ordering: the.sort === 2 ? 'heat' : 'time',
              page: the.isSubReply ? 'detail' : 'list',
              verify_result: true
            });
          }).catch(function (e) {
            if (e.action !== "cancel") {
              customReport('rite-verify_submit_click', {
                oid: the.oid,
                type: the.pageType,
                ordering: the.sort === 2 ? 'heat' : 'time',
                page: the.isSubReply ? 'detail' : 'list',
                verify_result: false
              });
            }
          });
        } else if (data && data.data && data.data.need_captcha) {
          the._renderCaptcha(target, data.data.url);
        } else {
          the._removeCaptcha();
        }

        the.trigger('commentSent', option, data); //发送成功后清除定时

        clearTimeout(the.timer);
        btn.removeClass('disabled');
        $('submit-text').text('发布'); // 发送成功后也取消激发态

        if (!$('.comment-send .textarea-container .ipt-txt')[0].value) {
          $('.comment-send').removeClass('send-active');
        }

        if (!$('.comment-send-lite .textarea-container .ipt-txt')[0].value) {
          $('.comment-send-lite').removeClass('send-active');
        }
      }
    });
  },

  /**
   * 生成验证码
   * @param {Dom} target - 发送评论模块
   * @param {String} url - 验证码图片
   * @private
   */
  _renderCaptcha: function _renderCaptcha(target, url) {
    var h = '<div class="comment-captcha">' + '<span>验证码：</span><input type="text" class="b-input" size="6" />' + '<img src="' + trimHttp(url) + '"/>' + '</div>';
    target.find('.comment-captcha').remove();
    target.append(h);
  },

  /**
   * 清楚验证码
   * @private
   */
  _removeCaptcha: function _removeCaptcha() {
    $('.comment-captcha').remove();
  },
  _needLoadMoreFold: function _needLoadMoreFold() {
    var commentArea = $('.comment-fold-bilibili .comment-area');
    var commentList = $('.comment-fold-bilibili .comment-list');
    var commentAreaHeight = commentArea.height();
    var commentListHeight = commentList.height();
    var scrollTop = commentArea.scrollTop();
    return this.foldDialogIsOpen && !this.foldIsEnd && (commentListHeight <= commentAreaHeight + 20 || commentAreaHeight + scrollTop + 20 > commentListHeight);
  },
  _loadMoreFold: function _loadMoreFold() {
    var me = this;
    me.isLoadingFold = true;

    this._getFoldedReply(this.foldedNext).then(function (res) {
      if (res.code !== 0) {
        return;
      }

      var data = res.data;
      me.foldedNext = data.cursor.next;
      me.foldIsEnd = data.cursor.is_end;
      var list = '';
      data.replies.forEach(function (item) {
        list = me._createReplyItem(item, 0);
        $('.comment-fold-bilibili .comment-list').append(list);
      });
      me.isLoadingFold = false;

      me._fixEmojiPosition();

      if (me._needLoadMoreFold()) {
        me._loadMoreFold();
      }
    }).fail(function () {
      me.isLoadingFold = false;
    });
  },
  _needLoadMoreSubFold: function _needLoadMoreSubFold() {
    var commentArea = $('.comment-sub-fold-bilibili .comment-area');
    var commentList = $('.comment-sub-fold-bilibili .comment-list');
    var commentAreaHeight = commentArea.height();
    var commentListHeight = commentList.height();
    var scrollTop = commentArea.scrollTop();
    return this.subFoldDialogIsOpen && !this.subFoldIsEnd && (commentListHeight <= commentAreaHeight + 20 || commentAreaHeight + scrollTop + 20 > commentListHeight);
  },
  _loadMoreSubFold: function _loadMoreSubFold(root) {
    var me = this;
    me.isLoadingSubFold = true;

    this._getSubFoldedReply(root, this.subFoldedNext).then(function (res) {
      if (res.code !== 0) {
        return;
      }

      var data = res.data;
      me.subFoldedNext = data.cursor.next;
      me.subFoldIsEnd = data.cursor.is_end;
      var list = '';
      data.replies.forEach(function (item) {
        list = me._createSubFoldedReplyItem(item);
        $('.comment-sub-fold-bilibili .comment-list').append(list);
      });
      me.isLoadingSubFold = false;

      if (me._needLoadMoreSubFold()) {
        me._loadMoreSubFold();
      }
    }).fail(function () {
      me.isLoadingSubFold = false;
    });
  },
  //黑名单父楼层结构
  _parentBlacklistDom: function _parentBlacklistDom(item, i, pos) {
    return ['<div class="con ' + (pos == i ? 'no-border' : '') + '">', '<div class="user blacklist-font-color">黑名单用户</div>', '<p class="text">由于黑名单设置，该评论已被隐藏。</p>', '<div class="info">', item.floor ? '<span class="floor">#' + item.floor + '</span>' : '', this._createPlatformDom(item.content.plat), '<span class="time">' + this._formateTime(item.ctime) + '</span>', this._canDel(item.mid) ? '<div class="operation btn-hover"><div class="spot"></div><div class="opera-list"><ul><li class="del" data-mid="' + item.mid + '">删除</li></ul></div></div>' : '', '</div>', '</div>'].join('');
  },
  //黑名单子楼层结构
  _subBlacklistDom: function _subBlacklistDom(item) {
    if (item.invisible) {
      return '';
    }

    return ['<div class="reply-item reply-wrap" data-id="' + item.rpid + '">', '<a class="reply-face"><img src="' + this.noface + '"></a>', '<div class="reply-con">', '<div class="user">', '<span class="blacklist-font-color name">黑名单用户 </span> <span class="text-con">由于黑名单设置，该回复已被隐藏。</span>', '</div>', '</div>', '<div class="info">', '<span class="time">' + this._formateTime(item.ctime) + '</span>', this._canDel(item.mid) ? '<div class="operation btn-hover btn-hide-re"><div class="spot"></div><div class="opera-list"><ul><li class="del" data-mid="' + item.mid + '">删除</li></ul></div></div>' : '', '</div>', '</div>'].join('');
  },

  /**
   * 置顶指定评论
   * @param {Number} id - 需要置顶的评论的id
   * @param {Number} action - 置顶标记
   * @private
   */
  _setTop: function _setTop(id, action) {
    return $.ajax({
      type: 'post',
      url: api.setTop,
      dataType: 'json',
      data: {
        oid: this.oid,
        type: this.pageType,
        rpid: id,
        action: action,
        jsonp: 'jsonp'
      },
      xhrFields: {
        withCredentials: true
      }
    });
  },

  /**
   * 删除指定评论
   * @param {Number} id - 需要删除的评论的id
   * @private
   */
  _delReply: function _delReply(options) {
    var url = {
      lottery: api.lotteryDel,
      normal: api.del
    }[options.type];
    var params = {
      oid: this.oid,
      type: this.pageType,
      jsonp: 'jsonp'
    };
    var key = options.type === 'lottery' ? 'lottery_id' : 'rpid';
    params[key] = options.id;
    return $.ajax({
      type: 'POST',
      url: url,
      dataType: "json",
      data: params,
      xhrFields: {
        withCredentials: true
      }
    });
  },

  /**
   * 赞指定评论
   * @param {Number} id - 需要赞的评论的id
   * @param {Number} action - 操作类型
   * @private
   */
  _likeReply: function _likeReply(id, action) {
    return $.ajax({
      type: 'POST',
      url: api.like,
      dataType: "json",
      data: {
        oid: this.oid,
        type: this.pageType,
        rpid: id,
        action: action,
        ordering: this.sort === 2 ? 'heat' : 'time',
        jsonp: 'jsonp'
      },
      xhrFields: {
        withCredentials: true
      }
    });
  },

  /**
   * 踩指定评论
   * @param {Number} id - 需要踩的评论的id
   * @param {Number} action - 操作类型
   * @private
   */
  _hateReply: function _hateReply(id, action) {
    return $.ajax({
      type: 'POST',
      url: api.hate,
      dataType: 'json',
      data: {
        oid: this.oid,
        type: this.pageType,
        rpid: id,
        action: action,
        ordering: this.sort === 2 ? 'heat' : 'time',
        jsonp: 'jsonp'
      },
      xhrFields: {
        withCredentials: true
      }
    });
  },

  /**
   * 更新子回复
   * @param {Number} pid - 父评论的id
   * @param {Number} p - 页码
   * @param {Object} $parent - 父评论的节点，jquery对象
   * @private
   */
  _updateSubReplyByPage: function _updateSubReplyByPage(pid, p, $parent, cb, hasFolded) {
    var me = this;

    if (!$.fn.paging) {
      initPaging();
    }

    this._getSubReplyByPage(pid, p).done(function (res) {
      // console.log('_getSubReplyByPage, Need test more')
      if (res && res.code === 0) {
        var pager = res.data.page;
        var isLastPage = pager.num * pager.size >= pager.count;
        $parent.find('.reply-box').html(me._createSubReplyList(res.data.replies, res.data.page.count, true, pid, hasFolded, isLastPage, false));
        var pageNum = Math.ceil(res.data.page.count / res.data.page.size);
        var $paging = $parent.find('.paging-box');
        $parent.find('.reply-box').attr('data-page', p).attr('data-total', res.data.page.count);

        if (pageNum > 1) {
          $paging.paging({
            pageCount: pageNum,
            current: p,
            backFn: function backFn(p) {
              if (typeof $parent[0].scrollIntoView === 'function') {
                $parent[0].scrollIntoView();
              }

              me.$root.trigger('subReplyPageChange', {
                pid: pid,
                page: p,
                parent: $parent,
                hasFolded: hasFolded
              });
              me.trigger('subReplyPageChange', {
                pid: pid,
                page: p,
                parent: $parent,
                hasFolded: hasFolded
              });
            }
          });
        } else {
          $parent.find('.paging-box').html('');
        }

        me._fixEmojiPosition();

        if (typeof cb === 'function') {
          setTimeout(function () {
            cb.call(null);
          }, 10);
        }
      }
    }).fail(function () {});
  },

  /**
   * 注册事件响应
   * @private
   */
  _registerEvent: function _registerEvent(root) {
    var me = this;
    var commentArea = this.$root;
    var hasLocalStorage = window.localStorage && window.localStorage.getItem;

    if (root) {
      var commentArea = $(root);
    }

    commentArea.off('click');
    commentArea.off('click.showMore').on('click.showMore', '.btn-more', function () {
      var pid = $(this).data('pid');
      var hasFold = $(this).data('fold');

      me._updateSubReplyByPage(pid, 1, $(this).parents('.list-item:eq(0)'), null, hasFold);

      customReport('replyCardCheckClick', {
        parentId: pid
      });
    });
    commentArea.off('subReplyPageChange').on('subReplyPageChange', function (e, d) {
      me._updateSubReplyByPage(d.pid, d.page, d.parent, null, d.hasFolded);
    }); //上下分页

    commentArea.off('replyPageChange').on('replyPageChange', function (e, data) {
      me.loadPage(data.p, data.isBottom);
    }); //迷你登录框

    commentArea.on('click.openMiniLogin', '.btn-open-mini-Login', function () {
      me.quickLogin();
    }); //弹出表情

    commentArea.on('click.emoji', '.comment-emoji', function (e) {
      var ta = $(this).siblings('.textarea-container').find('.ipt-txt');
      var x = $(this).offset().left - me.$root.offset().left;
      var y = $(this).offset().top - me.$root.offset().top + $(this).outerHeight();
      var direction = 'bottom',
          position = 'absolute';

      if ($(this).hasClass('comment-emoji-lite')) {
        x = this.getBoundingClientRect().x;
        y = this.getBoundingClientRect().y - 370;
        direction = 'top';
        position = 'fixed';

        if (!$(this).parents('.comment-send-lite').hasClass('two-line')) {
          $(this).parents('.comment-send-lite').addClass('two-line');
        }
      }

      ta.focus();

      if (!me.emoji) {
        me._getEmoji(ta, x, y, direction, position);
      } else {
        me.emoji.show(ta, x, y, direction, position);
        $('.emoji-box').css('zIndex', 10001);
      }

      var isSub = $(this).prev().find('.comment-submit').data('rid');
      customReport('replyEmojiClick', {
        type: me.pageType,
        oid: me.oid,
        position: isSub ? 3 : me.sendPosition
      });
      e.stopPropagation();
    }); //输入框获取焦点

    commentArea.off('focus.textarea').on('focus.textarea', 'textarea', function () {
      $(this).parent().addClass('focus');

      if ($(this).parents('.list-item').length === 0) {
        me.isSubReply = false;
      }

      if ($(this).parents('.comment-send-lite').length > 0) {
        $('.comment-send-lite-mask').addClass('focus');
        $(this).parents('.comment-send-lite').addClass('two-line');
      }

      var isSub = $(this).next().data('rid');
      customReport('replyInputClick', {
        type: me.pageType,
        oid: me.oid,
        position: isSub ? 3 : me.sendPosition
      }); //安卓和ios safari输入框获取焦点，开启键盘，触发页面滚动，window的滚动事件又会导致键盘收起，所以这里临时去掉scroll事件，blur时再绑定上

      if (browser.version.mobile) {
        $(window).off('scroll.comment');
      } // 阻止点击表情按钮导致输入框失去焦点的情况


      var targetElements = ['comment-emoji', 'emoji-box', 'reply'];

      var getSelfAndParentsClasses = function getSelfAndParentsClasses(element) {
        var _$, _$$prop;

        var parentElements = $(element).parents();
        var classesArr = [];
        classesArr.push.apply(classesArr, _toConsumableArray((_$ = $(element)) === null || _$ === void 0 ? void 0 : (_$$prop = _$.prop('class')) === null || _$$prop === void 0 ? void 0 : _$$prop.split(' '))); // 加入自身类名
        // 加入父元素类名

        for (var i = 0; i < (parentElements === null || parentElements === void 0 ? void 0 : parentElements.length); i++) {
          var _parentElements$eq, _parentElements$eq$pr;

          classesArr.push.apply(classesArr, _toConsumableArray(parentElements === null || parentElements === void 0 ? void 0 : (_parentElements$eq = parentElements.eq(i)) === null || _parentElements$eq === void 0 ? void 0 : (_parentElements$eq$pr = _parentElements$eq.prop('class')) === null || _parentElements$eq$pr === void 0 ? void 0 : _parentElements$eq$pr.split(' ')));
        } // 去掉空字符类名(感觉不去也可以


        var result = classesArr.filter(function (item) {
          return item !== '';
        });
        return result;
      }; // 如果一个元素自身类名或者其父元素类名在目标中，则点击时评论框不失去焦点


      document.addEventListener("mousedown", function (e) {
        var parentClassArr = getSelfAndParentsClasses(e.target);
        targetElements.forEach(function (item) {
          if (parentClassArr.includes(item)) e.preventDefault();
        });
      }, false);
    });

    function bindScrollEvent() {
      $(window).off('scroll.comment').on('scroll.comment', function () {
        var $send = me.$root.find('.bb-comment > .comment-send');
        var $head = me.$root.find('.bb-comment > .comment-header');

        if (me._isInView(me.$root) && !me.loaded && !me.loading) {
          me._showLoading('<span>loading...</span>');

          me.loadPage(1);
        }

        if (me.abtest.optimize && !me.isEnd && !me.loading && me._isInView(me.$root.find('.loading-state'))) {
          me.loadPage();
        } // 滚动到评论顶部时


        if (!me.noPage && $('.comment-list').height() > $(window).height()) {
          if (me._isInView($head, true)) {
            $send.insertAfter($head);
            me.sendPosition = 1;
          } else if (me._isInView(me.$root.find('.bottom-page'), true) && !me.abtest.optimize) {
            me.$root.find('.bb-comment').append($send);
            me.sendPosition = 2;
          }
        }

        if (me.abtest.optimize && $head.offset()) {
          if ($(window).scrollTop() - $head.offset().top > 400) {
            me.$root.find('.comment-send-lite').fadeIn();
            me.$root.find('.comment-send-lite').css('display', 'flex');
            me.$root.find('.comment-send-lite-mask').fadeIn();
          } else {
            me.$root.find('.comment-send-lite').fadeOut();
            me.$root.find('.comment-send-lite-mask').hide();
          }
        } // 广告Cm Notice 是否在视窗


        var $cmNotice = $('.notice-item');
        var cmHeight = $cmNotice.outerHeight();

        if (me.notice.type === 'cm' && me.notice.sended !== true && checkInView($cmNotice.get(0), cmHeight / 2 * -1)) {
          cmSendData(me.notice.data, me.notice.locsId);
          me.notice.sended = true;

          if (!me.notice.timer) {
            me.notice.timer = setTimeout(function () {
              clearTimeout(me.notice.timer);
              cmSendStrictData(me.notice.data, me.notice.locsId);
              me.notice.timer = undefined;
            }, 1000);
          }
        }
      });
    }

    $(window).off('resize.comment').on('resize.comment', function () {
      me._fixEmojiPosition();
    }); //失去焦点

    commentArea.off('blur.textarea').on('blur.textarea', 'textarea', function () {
      var _$$5;

      $(this).parent().removeClass('focus');

      if ($(this).parents('.comment-send-lite').length > 0 && $(this).val() === '') {
        console.log('@@@');
        $('.comment-send-lite-mask').removeClass('focus');
        $(this).parents('.comment-send-lite').removeClass('two-line');
      }

      if (browser.version.mobile) {
        bindScrollEvent();
      } // 如果离开焦点时输入框无内容，则取消激发态样式


      if (!((_$$5 = $(this)[0]) !== null && _$$5 !== void 0 && _$$5.value)) {
        $(this).parent().parent().removeClass('send-active');
      }
    }); //输入

    commentArea.off('input.textarea').on('input.textarea', 'textarea', function () {
      var _$$6;

      $(this).parent().removeClass('error');

      if ((_$$6 = $(this)[0]) !== null && _$$6 !== void 0 && _$$6.value) {
        // 将评论框转为激发态的样式
        $(this).parent().parent().addClass('send-active');
        $(this).next().addClass('btn-active');
      } else {
        $(this).next().removeClass('btn-active');
      }
    }); //提交回复

    commentArea.on('click.sendMsg', '.comment-submit', function () {
      var that = this;
      var target = $(this).parent();
      var the = this;
      var value = $(this).siblings('textarea').val() || '';
      var code = undefined;
      var captchaDom = target.find('.comment-captcha'); // 如果正在发送中 不能重复发送

      if ($(this).hasClass('disabled')) {
        return;
      }

      if (captchaDom.length > 0) {
        code = captchaDom.find('input').val();
      }

      var isSub = $(this).data('rid');
      customReport('replySendClick', {
        type: me.pageType,
        oid: me.oid,
        position: isSub ? 3 : me.sendPosition
      });
      var option = {
        rid: $(this).attr('data-rid'),
        pid: $(this).attr('data-pid'),
        msg: value,
        plat: 1,
        code: code
      };
      var $list = $(this).parents('.list-item:eq(0)');
      var replyBox = $list.find('.reply-box');
      var page = +$list.find('.reply-box').attr('data-page') || 1;
      var total = +$list.find('.reply-box').attr('data-total') || 0;

      me._sendMsg(target, option, function (rid, reply) {
        // 二级回复和默认回复
        if (option.rid) {
          // 最后一页的情况需要刷新
          if (page === Math.ceil(total / subPageSize) || total === 0) {
            me._appendSubReplyToTop(reply, replyBox);
          }
        } else {
          // 顶部插入最新评论
          me._appendReplyToTop(reply);
        }
      });
    }); //举报

    commentArea.on('click.report', '.report', function () {
      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var $wrap = $(this).parents('.reply-wrap:eq(0)');
      var rid = $wrap.data('id');

      if (rid) {
        me._reportFB($(this), me.oid, me.pageType, rid);
      }
    });
    commentArea.on('click.up_reply_selection', '.up_reply_selection', function () {
      me._interActionFB('selection');
    });
    commentArea.on('click.up_reply', '.up_reply', function () {
      me._interActionFB('reply');
    });
    commentArea.on('click.up_dm', '.up_dm', function () {
      me._interActionFB('dm');
    }); //加入黑名单

    commentArea.on('click.blacklist', '.blacklist', function () {
      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var $wrap = $(this).parents('.reply-wrap:eq(0)');
      var mid = $wrap.find('[data-usercard-mid]:eq(0)').data('usercard-mid');

      if (mid) {
        me._blackListFB($(this), me.oid, me.pageType, mid, $wrap);
      }
    });
    commentArea.on('click.reply', '.reply', function () {
      var _me$control;

      if (me !== null && me !== void 0 && (_me$control = me.control) !== null && _me$control !== void 0 && _me$control.input_disable) {
        var _me$control2;

        new MessageBox().show($(this), me === null || me === void 0 ? void 0 : (_me$control2 = me.control) === null || _me$control2 === void 0 ? void 0 : _me$control2.root_input_text, 2000, 'ok');
        return;
      }

      if (me.readOnly) {
        new MessageBox().show($(this), '评论区已被冻结，禁止发送评论', 2000, 'ok');
        return;
      }

      var $listItem = $(this).parents('.list-item:eq(0)');
      var $replyWrap = $(this).parents('.reply-wrap:eq(0)');
      var isSubReply = $replyWrap.hasClass('reply-item');
      var userName = isSubReply ? $replyWrap.find('.user .name').text() : $replyWrap.find('.user .name').eq(0).text();
      var text = '回复 @' + userName + ' :';
      me.isSubReply = isSubReply;
      me.atMsg = '回复 @' + $replyWrap.find('.user .name').text() + ' :';
      var rid = $listItem.attr('data-id');
      var pid = $replyWrap.attr('data-id');
      var cannotReply = !me.userStatus.isLogin;
      $listItem.siblings('.list-item').removeClass('open-reply').find('.comment-send').remove();

      if ($listItem.hasClass('open-reply')) {
        var $btn = $listItem.find('.comment-send .comment-submit');
        var isPreSubReply = $btn.attr('data-rid') !== $btn.attr('data-pid');

        if (isSubReply || isPreSubReply) {
          !cannotReply ? $listItem.find('.comment-send textarea').focus().prop('placeholder', text).val('') : '';
        } else {
          $listItem.find('.comment-send').remove();
          $listItem.removeClass('open-reply');
        }
      } else {
        $listItem.find('.con').append(me._createReplyBox({
          isSub: true
        }));
        $listItem.addClass('open-reply');

        if (!cannotReply) {
          $listItem.find('.comment-send textarea').focus().prop('placeholder', text).val('');
        }
      }

      $listItem.find('.comment-send button.comment-submit').attr('data-rid', rid).attr('data-pid', pid);
      customReport('replyCardReplyClick', {
        rpid: rid
      });
    });
    commentArea.on('click', '.follow-btn', function () {
      if (me.userStatus.isLogin) {
        var btn = $(this);
        var followBtns = $('.follow-btn[data-mid="' + btn.data('mid') + '"]');

        if (btn.hasClass('followed')) {
          friend.unFollow(btn.data('mid'), function (d) {
            if (d.code === 0) {
              var params = {
                type: 9,
                aid: me.oid,
                follow: false
              };
              customReport('follow_click', params);
              me.trigger('follow', params);
              followBtns.removeClass('followed').text('关注');
              new MessageBox().show(btn, '取消关注成功!', 500, 'ok');
            } else {
              new MessageBox().show(btn, d.message, 500, 'error');
            }
          }, btn.attr('quiet'), 122);
        } else {
          friend.follow(btn.data('mid'), function (d) {
            if (d.code == 22006) {
              $.getScript('//static.hdslb.com/plugins/attentionLimitPopup/attentionLimitPopup.js', function () {
                new attentionLimitPopup();
              });
              return;
            }

            if (d.code === 0) {
              var params = {
                type: 9,
                aid: me.oid,
                follow: true
              };
              customReport('follow_click', params);
              me.trigger('follow', params);
              followBtns.addClass('followed').text('已关注');
            } else {
              new MessageBox().show(btn, d.message, 500, 'error');
            }
          }, 122);
        }
      } else {
        me.quickLogin();
      }
    });
    commentArea.on('click.delete', '.del', function () {
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      var lotteryId = $replyItem.attr('data-lottery-id');
      var hint = $replyItem.hasClass('list-item') ? '删除评论后，评论下所有回复都会被删除' : '删除评论后将不可恢复';
      var $target = $(this);
      var replyMid = $target.attr('data-mid');
      var isUpdelOther = me.userStatus.mid == me.upId && replyMid != me.upId;
      new MessageBox().show($target, '<p>' + hint + '</p><p>是否继续？</p>', 'button', function () {
        me._reportEvent(isUpdelOther ? 'upmaster_deletecomment' : 'user_deletecomment');

        me._delReply({
          id: lotteryId || rid,
          type: lotteryId ? 'lottery' : 'normal'
        }).done(function (d) {
          if (d.code === 0) {
            new MessageBox().show($replyItem, '删除成功');
            $replyItem.remove();
          } else {
            new MessageBox().show($replyItem, d.message || '操作失败');
          }

          me.trigger('delete', rid, d);
        });
      });
    });
    commentArea.on('click.set-top', '.set-top', function () {
      var $target = $(this);
      var $replyItem = $target.parents('.list-item:eq(0)');
      var rid = +$replyItem.attr('data-id');
      var isTop = $replyItem.hasClass('is-top');
      var action = isTop ? 0 : 1;
      var msg = isTop ? '取消成功' : '置顶成功';

      me._setTop(rid, action).done(function (d) {
        if (d && d.code === 0) {
          new MessageBox().show($replyItem, msg);
          me.loadPage(1);
        } else {
          new MessageBox().show($replyItem, d.message || '操作失败');
        }

        me.trigger('setTop', {
          rid: rid,
          action: action
        }, d);
      });

      me._reportEvent(isTop ? 'upmaster_cancelstick' : 'upmaster_stick');
    });
    commentArea.on('click.like', '.like', function () {
      if (me.likeRequest) return; // 做了个节流，防止网速慢的时候发送多次请求

      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var $target = $(this);
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      var $hate = $target.siblings('.hate');
      var action;

      if ($target.hasClass('liked')) {
        action = 0; // 取消赞
      } else {
        action = 1; // 赞
      }

      customReport('replyCardLikeClick', {
        rpid: rid
      });
      me.likeRequest = me._likeReply(rid, action).then(function (d) {
        if (d && d.code === 0) {
          me.likeRequest = null;

          if (action === 0) {
            $target.removeClass('liked');
            var val = +$target.find('span').text() - 1;
            $target.find('span').text(val > 0 ? val : '');
          } else if (action === 1) {
            $target.addClass('liked');
            var val = +$target.find('span').text() + 1;
            $target.find('span').text(val > 0 ? val : '');
            $hate.removeClass('hated');
          }
        } else {
          new MessageBox().show($target, d.message || '操作失败');
        }

        me.trigger('like', {
          rid: rid,
          action: action
        }, d);
      });
    });
    commentArea.on('click.hate', '.hate', function () {
      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var $target = $(this);
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      var $like = $target.siblings('.like');
      var action;
      customReport('replyCardHateClick', {
        rpid: rid
      });

      if ($target.hasClass('hated')) {
        action = 0; // 取消踩
      } else {
        action = 1; // 踩
      }

      me._hateReply(rid, action).then(function (d) {
        if (d && d.code === 0) {
          if (action === 0) {
            $target.removeClass('hated');
          } else if (action === 1) {
            $target.addClass('hated');

            if ($like.hasClass('liked')) {
              $like.removeClass('liked');
              var val = +$like.find('span').text() - 1;
              $like.find('span').text(val > 0 ? val : '');
            }
          }
        } else {
          new MessageBox().show($target, d.message || '操作失败');
        }

        me.trigger('hate', {
          rid: rid,
          action: action
        }, d);
      });
    });
    commentArea.on('click.operation', '.spot', function (e) {
      $('.opera-list').hide();
      $(this).siblings('.opera-list').show();
      e.stopPropagation();

      if ($(this).hasClass('more-operation')) {
        var $replyItem = $(this).parents('.reply-wrap:eq(0)');
        var rid = +$replyItem.attr('data-id');
        customReport('replyCardMoreClick', {
          rpid: rid
        });
      }
    });
    commentArea.off('mouseleave.operation').on('mouseleave.operation', '.opera-list', function (e) {
      $('.opera-list').hide();
    });
    commentArea.on('click.tab', '.tabs-order li', function () {
      var $target = $(this);

      if (!$target.hasClass('on')) {
        $target.addClass('on').siblings().removeClass('on');
        me.sort = +$target.attr('data-sort');
        me.isEnd = false;
        me.next = null;
        me.searchWordInfo = null;
        me.loadPage(1);
      }

      if ($target.attr('data-sort') == '0') {
        //播放页日志上报
        videoReport('playpage_comment_allcomment');
        customReport('replyOrderClick', {
          ordering: 'time'
        });
      }

      if ($target.attr('data-sort') == '2') {
        //播放页日志上报
        videoReport('playpage_comment_hotcomment');
        customReport('replyOrderClick', {
          ordering: 'heat'
        });
      }
    });
    commentArea.on('click.moreHot', '.more-hot', function () {
      me.$root.find('.tabs-order li').removeClass('on');
      me.$root.find('.tabs-order li[data-sort="2"]').addClass('on');
      me.sort = 2;
      me.loadPage(1, true);
      me.trigger('loadMoreHot');
    });
    commentArea.on('click.reload', '.reload-comment', function () {
      me._showLoading('<span>loading...</span>');

      me.loadPage(1);
      me.trigger('reload');
    });
    commentArea.on('click.notice', '.reply-notice', function () {
      customReport('playpage_anoun');
    });
    commentArea.on('click.deletNotice', '.icon-close-notice', function (e) {
      var $parent = $(this).parent();
      var id = +$parent.attr('data-id');

      var _flagName = $parent.attr('flag-name');

      if (hasLocalStorage) {
        if (me.notice.type === 'notice') {
          var cachedId = window.localStorage.getItem(_flagName) || -1;

          if (id > cachedId) {
            window.localStorage.setItem(_flagName, id);
          }
        }

        if (me.notice.type === 'cm') {
          var cachedId = window.localStorage.getItem(_flagName) || '{}';
          var expireTs = Date.now() + 24 * 60 * 60 * 1000; //24h expire

          var expireObjs = _objectSpread(_objectSpread({}, JSON.parse(cachedId)), {}, _defineProperty({}, id, expireTs));

          window.localStorage.setItem(_flagName, JSON.stringify(expireObjs));
        }
      }

      $parent.remove();
      if (me.notice.type === 'cm') cmSendCloseData(me.notice.data, me.notice.locsId); // me._reportEvent('comment_notice_close')
      // customReport('playpage_anoun_delete')

      me.trigger('closeNotice');
      return false;
    });
    bindScrollEvent(); // 点击验证码

    commentArea.on('click.captcha', '.comment-captcha > img', function () {
      var img = $(this).get(0);
      var index = img.src.indexOf('&_ts=');
      img.src = img.src.substr(0, index === -1 ? img.src.length : index) + '&_ts=' + Date.now();
    });
    commentArea.on('click.hide', '.hidden-reply-toggle', function () {
      $(this).siblings('.quote').slideToggle(200);
    }); // commentArea.on('click.notice', '.notice-item a', function () {
    //   me._reportEvent('comment_notice_click')
    // })

    commentArea.on('click.vote', '.vote-container, .vote-link', function () {
      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var voteId = $(this).data('id');
      var voteName = $(this).data('name');

      if (browser.version.mobile) {
        location.href = '//t.bilibili.com/h5/dynamic/vote#/result?vote_id=' + voteId + '&from=comment';
      }

      if (voteId) {
        me._voteFB($(this), voteId, voteName);
      }
    });
    commentArea.on('click.lottery', '.lottery-container, .lottery-link', function () {
      if (!me.userStatus.isLogin) {
        me.quickLogin();
        return;
      }

      var lotteryId = $(this).data('id');

      if (browser.version.mobile) {
        location.href = '//t.bilibili.com/lottery/h5/index/#/result?lottery_id=' + lotteryId;
      }

      if (lotteryId) {
        me._lotteryFB($(this), lotteryId);
      }
    });
    commentArea.on('click.space', '.user-face a, .reply-face', function (event) {
      var mid = $(this).data('usercard-mid');
      me.trigger('clickSpace', {
        event: event,
        type: 'face',
        mid: mid
      });
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      customReport('replyCardProfileClick', {
        rpid: rid
      });
    });
    commentArea.on('click.space', '.name', function (event) {
      var mid = $(this).data('usercard-mid');
      me.trigger('clickSpace', {
        event: event,
        type: 'name',
        mid: mid
      });
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      customReport('replyCardNameClick', {
        rpid: rid
      });
    });
    commentArea.on('click.space', '.jump-link--name', function (event) {
      var mid = $(this).data('usercard-mid');
      me.trigger('clickSpace', {
        event: event,
        type: 'name',
        mid: mid
      });
    });
    commentArea.on('click.level', '.level-link', function () {
      var $replyItem = $(this).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      customReport('replyCardLvClick', {
        rpid: rid
      });
    });
    commentArea.on('click.moreLink', '.more-link', function () {
      me.trigger('moreLinkClick');
    });
    this.on('repostSuc', function () {
      var checkbox = me.$root.find('.dynamic-repost-checkbox');
      checkbox[0].checked = false;
    });
    this.on('repostFail', function (res) {
      var target = me.$root.find('.dynamic-repost');
      var msg = res.data && res.data.errmsg;
      new MessageBox().show(target, msg, 2000, 'error');
    });
    this.on('repostError', function (res) {
      var target = me.$root.find('.dynamic-repost');
      var msg = res.msg;
      new MessageBox().show(target, msg, 2000, 'error');
    });
    commentArea.on('click.seek', '.video-seek', function () {
      if (window.commentAgent && typeof window.commentAgent.seek === 'function') {
        var time = $(this).data('time');
        var p = $(this).data('p');

        if (p < 0) {
          window.commentAgent.seek(time);
          customReport('reply_timelink_click', {
            time: time
          });
        } else {
          window.commentAgent.seek(time, p);
          customReport('reply_timelink_click', {
            time: time,
            p: p
          });
        }

        window.scrollTo(0, 0);
      }
    });
    commentArea.on('click.fold', '.view-fold', function () {
      customReport('foldingreply-click', 1);

      me._foldFB(this);
    });
    commentArea.on('click.fold', '.view-sub-fold', function () {
      customReport('foldingreply-click', 1);
      var root = $(this).data('root');

      me._subFoldFB(this, root);
    });
    commentArea.on('click.fold-rule', '.fold-rule', function () {
      customReport('foldingreply-click', 2);
    });
    commentArea.on('click.jump-url', '.comment-jump-url', function () {
      var reportContent = me.jumpReport[$(this).data('report')];
      customReport('reply_jumpUrl_click', encodeURIComponent(reportContent));
    });
    commentArea.on('click.text', '.con .text', function () {
      customReport('reply-card-click', {
        oid: me.oid,
        type: me.pageType,
        ordering: me.sort === 2 ? 'heat' : 'time'
      });
    });
    commentArea.on('click.underline', '.underline-link', function (e) {
      var _$2;

      var message = (_$2 = $(e.target)) === null || _$2 === void 0 ? void 0 : _$2.attr('data-message');
      allCustomReport({
        c: 'community.public-community.reply-card',
        d: 'all',
        e: 'click',
        type: 'click'
      }, {
        msg: JSON.stringify({
          position: 32,
          message: message
        })
      });
    }); // 控制徽章卡片延时关闭

    var nameplateTimer = 0;
    commentArea.on('mouseenter.nameplate', '.nameplate', function (e) {
      var element = $(e.target);

      while (!element.is('.nameplate')) {
        element = element.parent();
      }

      element.addClass('on');
      $('.nameplate.on .nameplate-card').show();
    });
    commentArea.on('mouseleave.nameplate', '.nameplate.on', function (e) {
      clearTimeout(nameplateTimer);
      nameplateTimer = setTimeout(function () {
        $('.nameplate.on .nameplate-card').hide();
        $('.nameplate.on').removeClass('on');
      }, 100);
    });
    commentArea.on('mouseenter.nameplate-card', '.nameplate.on .nameplate-card', function (e) {
      clearTimeout(nameplateTimer);
    });
    commentArea.on('mouseleave.nameplate-card', '.nameplate.on .nameplate-card', function (e) {
      $('.nameplate.on .nameplate-card').hide();
      $('.nameplate.on').removeClass('on');
    }); ///$('body').on('mouseenter.data-userCard', '[data-usercard-mid]', function (e) {
  },
  _isInView: function _isInView($elem, inside) {
    if (!$elem.length) {
      return;
    }

    var wh = $(window).height();
    var d = $elem.offset().top - $(window).scrollTop();
    return inside ? d <= wh && d >= 0 : d <= wh;
  },
  _showLoading: function _showLoading(html) {
    if (this.abtest.optimize) {
      return;
    }

    this.$root.find('.comment-loading').remove();
    this.$root.find('.bb-comment').append('<div class="comment-loading">' + html + '</div>');
  },
  _hideLoading: function _hideLoading() {
    this.$root.find('.comment-loading').remove();
  },

  /**
   * 跳到指定评论
   * @param {Number} rid - 需要跳到的评论id
   */
  jumpToReply: function jumpToReply(rid) {
    var me = this;
    this.jumpId = rid;
    me.loading = true;
    var f1 = $.ajax({
      url: api.jump,
      dataType: 'jsonp',
      data: {
        jsonp: 'jsonp',
        rpid: rid,
        oid: me.oid,
        type: me.pageType
      }
    }); // const f2 = this._getLocs([this.locsMap[this.pageType.toString()]])

    f1.done(function (res) {
      me._hideLoading();

      me.loaded = true;

      if (res && res.code === 0) {
        me.mode = res.data.mode || res.data.cursor.mode;
        var cm_info = res.data.cm_info;

        if (cm_info && cm_info.ads && Object.keys(cm_info.ads).length > 0) {
          me.notice.locsId = Object.keys(cm_info.ads)[0];
          me.notice.data = cm_info.ads[me.notice.locsId][0];
          me.notice.type = 'cm';
          me.notice.isAd = Boolean(cm_info.ads[me.notice.locsId][0].is_ad);
        }

        if (me.notice.isAd === false && res.data.notice) {
          me.notice.data = res.data.notice;
          me.notice.type = 'notice';
        }

        me.blacklist = res.data.blacklist || 0;
        me.assist = res.data.assist || 0;
        me.pageInfo = res.data.page || {};
        var control = res.data.control;

        if (control) {
          me.control.bg_text = control.bg_text;
          me.control.child_input_text = control.child_input_text;
          me.control.input_disable = control.input_disable;
          me.control.root_input_text = control.root_input_text;
          me.control.web_selection = control.web_selection;
        }

        me._renderTabs(res);

        me._renderNotice(me.notice);

        me._updateReplyListByData(res.data, me.pageInfo.num);

        if (me.abtest.optimize) {
          me.next = res.data.cursor.next;
          me.isEnd = res.data.cursor.isEnd;
        } else {
          me._renderBottomPagination(me.pageInfo);
        } // 获取外部元素 并赋值最大评论数


        $('.common .b-head .results').html(res.data.page.acount || 0).show(); //是否显示删除日志入口

        if (res.data && res.data.config && res.data.config.showentry) {
          $('.common .b-head .del-log').show();
        } else {
          $('.common .b-head .del-log').remove();
        } //初始化评论输入框


        me.$root.find('.bb-comment > .comment-send').remove();
        $(me._createReplyBox()).insertBefore(me.$root.find('.comment-list')); // 清除jumpId

        me.jumpId = '';
        setTimeout(function () {
          var $target = $('[data-id="' + rid + '"]');

          if (!$target.length) {
            $(window).scrollTop(me.$root.offset().top); // me._showMessage('评论已被删除', 2500)

            window.console && window.console.log('[comment] dom not find when jump');
            return;
          }

          $(window).scrollTop($target.offset().top);

          if ($target.hasClass('reply-item')) {
            // 二级回复
            var $parent = $target.parents('.list-item:eq(0)');

            me._updateSubReplyByPage(+$parent.attr('data-id'), me.pageInfo.rt_num, $parent, function () {
              $('[data-id="' + rid + '"]').find('.reply').click();
            });
          } else if ($target.hasClass('list-item')) {
            // 一级回复
            $target.find('.con .reply').click();
          }
        }, 100);
      } else if (res.code == 12002) {
        // 禁止评论
        me.$root.find('.bb-comment > .comment-send').remove();
        $(me._createReplyBox({
          forbid: true
        })).insertBefore(me.$root.find('.comment-list'));
      }
    }).fail(function () {
      if (!me.loaded) {
        me._showLoading('<span>加载失败，<a class="reload-comment">点击重试</a></span>');
      }
    }).always(function () {
      me.loading = false;
    });
  },
  _showMessage: function _showMessage(msg, time) {
    $('body').append('<div class="comment-msg"><span>' + msg + '</span></div>');
    setTimeout(function () {
      $('.comment-msg').remove();
    }, time || 2000);
  },
  _reportEvent: function _reportEvent(name, data) {
    if (typeof window.rec_rp == 'function') {
      window.rec_rp('event', name, data);
    }
  },
  _appendReplyToTop: function _appendReplyToTop(reply) {
    var $item = $(this._createReplyItem(reply, 1));
    var first = this.$root.find('.comment-list .list-item:eq(0)');

    if (first.length > 0) {
      first.before($item);
    } else {
      this.$root.find('.no-more-reply').remove();
      this.$root.find('.comment-list').append($item);
    }

    if (this.mounted) {
      var arr = this.fbData;
      arr.unshift(reply);
      this.mounted(arr);
    }
  },
  _appendSubReplyToTop: function _appendSubReplyToTop(reply, replyBox) {
    var $item = $(this._createSubReplyItem(reply));
    replyBox.prepend($item);

    this._fixEmojiPosition();
  }
};
module.exports = method;

/***/ }),

/***/ "./src/paging.js":
/*!***********************!*\
  !*** ./src/paging.js ***!
  \***********************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

__webpack_require__(/*! ../static/style/less/paging.less */ "./static/style/less/paging.less");

var ms = {
  init: function init(obj, args) {
    return function () {
      ms.fillHtml(obj, args);
      ms.bindEvent(obj, args);
    }();
  },
  //填充html
  fillHtml: function fillHtml(obj, args) {
    return function () {
      obj.empty();

      if (args.smallSize) {
        obj.addClass('small');
      }

      pageOffset = args.smallSize ? 1 : 2; //总页数

      if (args.pageCount > 1 && !args.jump) {
        obj.append('<span class="result">共' + args.pageCount + '页</span>');
      } //上一页


      if (args.current > 1) {
        obj.append('<a href="javascript:;" class="prev">上一页</a>');
      } else {
        obj.remove('.prev');
        obj.append('<span class="disabled">上一页</span>');
      } //中间页码


      if (args.current != 1 && args.current >= pageOffset + 2 && args.pageCount != pageOffset + 2) {
        obj.append('<a href="javascript:;" class="tcd-number">' + 1 + '</a>');
      }

      if (args.current - pageOffset > 2 && args.current <= args.pageCount && args.pageCount > pageOffset + 3) {
        obj.append('<span class="dian">...</span>');
      }

      var start = args.current - pageOffset,
          end = args.current + pageOffset;

      if (start > 1 && args.current < pageOffset + 2 || args.current == 1) {
        end++;
      }

      if (args.current > args.pageCount - (pageOffset + 2) && args.current >= args.pageCount) {
        start--;
      }

      for (; start <= end; start++) {
        if (start <= args.pageCount && start >= 1) {
          if (start != args.current) {
            obj.append('<a href="javascript:;" class="tcd-number">' + start + '</a>');
          } else {
            obj.append('<span class="current">' + start + '</span>');
          }
        }
      }

      if (args.current + pageOffset < args.pageCount - 1 && args.current >= 1 && args.pageCount > pageOffset + 3) {
        obj.append('<span class="dian">...</span>');
      }

      if (args.current != args.pageCount && args.current < args.pageCount - pageOffset && args.pageCount != pageOffset + 2) {
        obj.append('<a href="javascript:;" class="tcd-number">' + args.pageCount + '</a>');
      } //下一页


      if (args.current < args.pageCount) {
        obj.append('<a href="javascript:;" class="next">下一页</a>');
      } else {
        obj.remove('.next');
        obj.append('<span class="disabled">下一页</span>');
      } //直接跳转


      if (args.pageCount > 1 && args.jump) {
        var html = '<div class="page-jump">';

        if (!args.smallSize) {
          html += '共<span>' + args.pageCount + '</span>页，';
        }

        html += '跳至<input type="text" />页</div>';
        obj.append(html);
      }
    }();
  },
  //绑定事件
  bindEvent: function bindEvent(obj, args) {
    return function () {
      obj.off('click');
      obj.off('keydown');
      obj.on("click", "a.tcd-number", function () {
        var current = parseInt($(this).text());
        ms.fillHtml(obj, {
          "current": current,
          "pageCount": args.pageCount,
          "jump": args.jump
        });

        if (typeof args.backFn == "function") {
          args.backFn(current);
        }
      }); //上一页

      obj.on("click", "a.prev", function () {
        var current = parseInt(obj.children("span.current").text());
        ms.fillHtml(obj, {
          "current": current - 1,
          "pageCount": args.pageCount,
          "jump": args.jump
        });

        if (typeof args.backFn == "function") {
          args.backFn(current - 1);
        }
      }); //下一页

      obj.on("click", "a.next", function () {
        var current = parseInt(obj.children("span.current").text());
        ms.fillHtml(obj, {
          "current": current + 1,
          "pageCount": args.pageCount,
          "jump": args.jump
        });

        if (typeof args.backFn == "function") {
          args.backFn(current + 1);
        }
      }); //跳转

      obj.on("keydown", "input", function (e) {
        if (e.keyCode == 13) {
          var val = Math.abs(parseInt($(this).val()));
          var i = val ? val : 1;
          i = i > args.pageCount ? args.pageCount : i;
          ms.fillHtml(obj, {
            "current": i,
            "pageCount": args.pageCount,
            "jump": args.jump
          });

          if (typeof args.backFn == "function") {
            args.backFn(i);
          }
        }
      });
    }();
  }
};
module.exports = ms;

/***/ }),

/***/ "./src/user_card.js":
/*!**************************!*\
  !*** ./src/user_card.js ***!
  \**************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

__webpack_require__(/*! ../static/style/less/usercard.less */ "./static/style/less/usercard.less");

var Friend = __webpack_require__(/*! ./friend.js */ "./src/friend.js");

var utils = __webpack_require__(/*! ./utils.js */ "./src/utils.js");

var MessageBox = __webpack_require__(/*! ./message_box.js */ "./src/message_box.js");

var dataCache = {};
var friend = new Friend();
var isover = false;
var cd = 0;
var verifyIcon = [__webpack_require__(/*! ../static/images/ic_tag_offic_tagial.png */ "./static/images/ic_tag_offic_tagial.png")["default"], __webpack_require__(/*! ../static/images/ic_tag_enterprise.png */ "./static/images/ic_tag_enterprise.png")["default"]];

var _require = __webpack_require__(/*! ./new-comment/constant */ "./src/new-comment/constant.js"),
    levelIconList = _require.levelIconList;

var sexIcon = {
  'man': __webpack_require__(/*! ../static/images/ic_tag_man_border.png */ "./static/images/ic_tag_man_border.png")["default"],
  'woman': __webpack_require__(/*! ../static/images/ic_tag_woman_border.png */ "./static/images/ic_tag_woman_border.png")["default"]
};

function getImgSrc(file) {
  var option = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  return utils.trimHttp(utils.webp(file, option));
}

function UserCard(userStatus) {
  if (utils.browser.version.mobile) return;
  var defaultStatus = {
    isLogin: false,
    vipStatus: 0,
    vipType: 0,
    mid: null
  };
  this.userStatus = $.extend(defaultStatus, userStatus);

  if (!utils.browser.version.mobile) {
    this._registerEvent();
  }
}

UserCard.prototype.reset = function (data) {
  this.userStatus = data;
  dataCache = {};
};

UserCard.prototype._renderCard = function (data) {
  $('.user-card').remove();
  $('body').append(this._createCard(data)); //播放页日志上报

  utils.videoReport('playpage_namecard2');
};

UserCard.prototype._renderErrorCard = function () {
  $('.user-card').remove();
  $('body').append(this._createErrorCard());
};

UserCard.prototype._renderLoadingCard = function () {
  $('.user-card').remove(); // 暂时不需要loading图
};

UserCard.prototype._isLikeMe = function (data) {
  if (data.card && data.card.attentions) {
    for (var i = 0, len = data.card.attentions.length; i < len; ++i) {
      if (data.card.attentions[i] === this.userStatus.mid) {
        return true;
      }
    }
  }

  return false;
};

UserCard.prototype._createCard = function (data) {
  var _data$card, _data$card2;

  var bgUrl = data.space.s_img ? data.space.s_img : '//i0.hdslb.com/bfs/static/c9dae917e24b4fc17c4d544caf6b6c0b17f8692b.jpg';
  var nameColor = data.card.vip && data.card.vip.nickname_color ? ' style="color:' + data.card.vip.nickname_color + '"' : '';

  var isLikeMe = this._isLikeMe(data);

  var like = data.following ? '已关注' : '<div class="add-icon"></div>关注';
  var liked = data.following ? 'liked' : '';
  var isVip = data.card.vip && data.card.vip.label && data.card.vip.label.text;
  liked += isLikeMe ? ' liked-me' : ''; // 埋点

  var _ref = data.card || {},
      mid = _ref.mid;

  var _ref2 = data.card.Official || {},
      verifyType = _ref2.type,
      verifyDesc = _ref2.title;

  utils.allCustomReport({
    c: 'up_information_window',
    d: 'o',
    e: 'show',
    type: 'appear'
  }, {
    msg: JSON.stringify({
      up_mid: mid,
      type: verifyType === 0 ? '1' : verifyType === 1 ? '2' : ''
    })
  });
  return "\n    <div class=\"user-card\">\n      <div class=\"bg\" style=\"background-image:url(".concat(getImgSrc(bgUrl, {
    w: 750,
    h: 240
  }), ")\"></div>\n      <a class=\"face\" href=\"//space.bilibili.com/").concat(mid, "\" target=\"_blank\">\n        <img src=\"").concat(getImgSrc(data.card.face, {
    w: 96,
    h: 96
  }), "\"/>\n        ").concat(verifyType === 0 ? "<img title=\"\u4E2A\u4EBA\u8BA4\u8BC1\" class=\"auth\" src=\"".concat(getImgSrc(verifyIcon[0]), "\"></img>") : '', "\n        ").concat(verifyType === 1 ? "<img title=\"\u4F01\u4E1A/\u56E2\u4F53\u8BA4\u8BC1\" class=\"auth\" src=\"".concat(getImgSrc(verifyIcon[1]), "\"></img>") : '', "\n      </a>\n      <div class=\"info\">\n        <p class=\"user\">\n          <a class=\"name\" ").concat(nameColor, " href=\"//space.bilibili.com/").concat(mid, "\" target=\"_blank\">").concat(utils.unhtml(data.card.name), "</a>\n          ").concat(data.card.sex === "保密" ? '' : data.card.sex === "男" ? "<img class=\"sex\" src=\"".concat(getImgSrc(sexIcon.man), "\"></img>") : "<img class=\"sex\" src=\"".concat(getImgSrc(sexIcon.woman), "\"></img>"), "\n          <a href=\"//www.bilibili.com/html/help.html#k_").concat(data.card.level_info.current_level, "\" target=\"_blank\">\n             <img class=\"level ").concat((_data$card = data.card) !== null && _data$card !== void 0 && _data$card.is_senior_member ? 'senior' : '', "\" src=\"").concat(getImgSrc(levelIconList[(_data$card2 = data.card) !== null && _data$card2 !== void 0 && _data$card2.is_senior_member ? 'senior' : data.card.level_info.current_level]), "\"> \n          </a>\n          ").concat(isVip ? "<span class=\"vip-icon\" style=\"color: ".concat(data.card.vip.label.text_color, "; background-color:").concat(data.card.vip.label.bg_color, "\"><span class=\"tinyfont\">").concat(data.card.vip.label.text, "</span></span>") : '', "\n        </p>\n        <p class=\"social\">\n          <a href=\"//space.bilibili.com/").concat(mid, "/fans/follow\" target=\"_blank\">\n            <span>").concat(data.card.friend, "</span><span class=\"gray-text\"> \u5173\u6CE8</span>\n          </a>\n          <a href=\"//space.bilibili.com/").concat(mid, "/fans/fans\" target=\"_blank\">\n            <span>").concat(utils.formatNum(data.card.fans), "</span><span class=\"gray-text\"> \u7C89\u4E1D</span>\n          </a>\n          <span>").concat(utils.formatNum(data.like_num), "</span><span class=\"gray-text\"> \u83B7\u8D5E</span>\n        </p>\n        <p class=\"verify\">\n          ").concat(verifyType === 0 ? "<span><img title=\"\u4E2A\u4EBA\u8BA4\u8BC1\" class=\"auth\" src=\"".concat(getImgSrc(verifyIcon[0]), "\"></img>bilibili\u4E2A\u4EBA\u8BA4\u8BC1\uFF1A").concat(verifyDesc, "</span>") : '', "\n          ").concat(verifyType === 1 ? "<span><img title=\"\u4F01\u4E1A/\u56E2\u4F53\u8BA4\u8BC1\" class=\"auth\" src=\"".concat(getImgSrc(verifyIcon[1]), "\"></img>bilibili\u673A\u6784\u8BA4\u8BC1\uFF1A").concat(verifyDesc, "</span>") : '', "\n        </p>\n        ").concat(data.card.sign ? "<p class=\"sign\">".concat(utils.unhtml(data.card.sign), "</p>") : '', "\n      </div>\n      <div class=\"btn-box\">\n        <a class=\"like ").concat(liked, "\" mid=\"").concat(mid, "\" uname=\"").concat(utils.unhtml(data.card.name), "\" ").concat(data.quiet ? quiet = "true" : '', ">\n          <span class=\"default-text\">").concat(like, "</span>\n          <span class=\"hover-text\">\u53D6\u6D88\u5173\u6CE8</span>\n        </a>\n        <a class=\"message\" href=\"//message.bilibili.com/#whisper/mid").concat(mid, "\" target=\"_blank\">\u53D1\u6D88\u606F</a>\n      </div>\n    </div>\n  ");
};

UserCard.prototype._createErrorCard = function () {
  return '<div class="user-card"><p class="error-card">加载失败</p></div>';
}; //设置坐标


UserCard.prototype._setPosition = function (obj) {
  var dest = 32;
  var tw = 375;
  var x = $(obj).offset().left;
  var y = $(obj).offset().top;
  var w = $(obj).outerWidth();
  var tx = 0; // if($(window).width()-(x+w) > dest+tw || (x-dest) < ($(window).width()-x-w-dest)){
  // 	tx = x + dest + w;
  // }else{
  // 	tx = x - dest - tw;
  // }
  // var h = y-220-$(obj).outerHeight();;

  if ($(obj).offset().top < $(window).scrollTop() + $('.user-card').height() + 32) {
    var h = y + $(obj).outerHeight() + 8;
  } else {
    var h = y - $('.user-card').height() - 32;
  }

  if ($(obj.height)) {}

  $('.user-card').css({
    left: x,
    top: h
  });
};

UserCard.prototype._registerEvent = function () {
  var me = this;
  $('body').off('click.userCardAttention').on('click.userCardAttention', '.user-card .btn-box .like', function () {
    if (me.userStatus.isLogin) {
      var liked = $(this).hasClass('liked');
      var likedMe = $(this).hasClass('liked-me');
      var uid = $(this).attr('mid');
      var uname = $(this).attr('uname');
      var the = this;

      if (liked) {
        //取消关注
        friend.unFollow(uid, function (d) {
          if (d && d.code === 0) {
            $(the).removeClass('liked').html('<div class="add-icon"></div>关注');
            delete dataCache[uid];
            new MessageBox().show($(the), '取消关注成功!', 1000, 'ok');
          } else if (d) {
            new MessageBox().show($(the), d.message, 1000, 'error');
          }
        }, $(this).attr('quiet')); //播放页日志上报

        utils.videoReport('playpage_unfollow2');
      } else {
        //关注
        friend.follow(uid, function (d) {
          //如果code == -665 提示关注上限
          if (d.code == 22006) {
            $.getScript('//static.hdslb.com/plugins/attentionLimitPopup/attentionLimitPopup.js', function () {
              new attentionLimitPopup();
            });
          } else {
            if (d && d.code === 0) {
              $(the).text('取消关注').addClass('liked');
              delete dataCache[uid];
            } else if (d) {
              new MessageBox().show($(the), d.message, 1000, 'error');
            }
          }
        }); //播放页日志上报

        utils.videoReport('playpage_follow2');
      }
    } else {
      document.location.href = 'https://account.bilibili.com/login';
    }
  });
  $('body').on('mouseenter.data-userCard', '[data-usercard-mid]', function (e) {
    var mid = $(this).attr('data-usercard-mid');
    var the = this;
    clearTimeout(cd);
    cd = setTimeout(function () {
      var $replyItem = $(the).parents('.reply-wrap:eq(0)');
      var rid = +$replyItem.attr('data-id');
      var isFace = $(the).parent().hasClass('user-face');
      var isName = $(the).hasClass('name');

      if (isFace) {
        utils.customReport('replyCardProfileHover', {
          rpid: rid
        });
      }

      if (isName) {
        utils.customReport('replyCardNameHover', {
          rpid: rid
        });
      }

      if (dataCache[mid]) {
        me._renderCard(dataCache[mid]);

        me._setPosition(the);
      } else {
        var _$$ajax;

        me._renderLoadingCard();

        me._setPosition(the);

        $.ajax((_$$ajax = {
          url: '//api.bilibili.com/x/web-interface/card',
          dataType: 'jsonp',
          data: {
            mid: mid,
            photo: 1,
            jsonp: 'jsonp'
          }
        }, _defineProperty(_$$ajax, "dataType", 'jsonp'), _defineProperty(_$$ajax, "cache", true), _defineProperty(_$$ajax, "success", function success(data) {
          if (data && data.code === 0) {
            $.ajax({
              url: '//api.bilibili.com/x/relation',
              data: {
                fid: mid,
                jsonp: 'jsonp'
              },
              dataType: 'jsonp'
            }).done(function (res) {
              if (res && res.code === 0) {
                data.data.following = res.data.attribute === 1 || res.data.attribute === 2 || res.data.attribute === 6;
                data.data.quiet = res.data.attribute === 1;
              } else {
                data.data.following = false;
              }

              me._renderCard(data.data);

              me._setPosition(the);

              dataCache[data.data.card.mid] = data.data;
            }).fail(function () {
              me._renderErrorCard();

              me._setPosition(the);
            });
          }
        }), _defineProperty(_$$ajax, "error", function error() {
          me._renderErrorCard();

          me._setPosition(the);
        }), _$$ajax));
      }
    }, 300);
  });
  $('body').on('mouseleave.data-userCard', '[data-usercard-mid]', function (e) {
    clearTimeout(cd);
    cd = setTimeout(function () {
      $('.user-card').remove();
    }, 100);
  });
  $('body').on('mouseenter.userCard', '.user-card', function (e) {
    clearTimeout(cd);
  });
  $('body').on('mouseleave.userCard', '.user-card', function (e) {
    $('.user-card').remove();
  });
};

module.exports = UserCard;

/***/ }),

/***/ "./src/utils.js":
/*!**********************!*\
  !*** ./src/utils.js ***!
  \**********************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

var ms = __webpack_require__(/*! ./paging */ "./src/paging.js");
/*
* 工具类
* 提供一些全局通用方法
*/


var utils = {
  jqAjaxHandle: function jqAjaxHandle() {
    var ajaxHandle = $.ajax;

    $.ajax = function (url, option) {
      if (_typeof(url) == "object") {
        option = url;
        url = undefined;
      }

      if ((option.type == 'post' || option.type == 'POST') && option.data && !option.data.csrf) {
        $.extend(option.data, {
          csrf: utils.cookie && utils.cookie.get('bili_jct')
        });
      }

      return ajaxHandle(url, option);
    };
  },
  initPaging: function initPaging() {
    $.fn.paging = function (options) {
      var args = $.extend({
        pageCount: 10,
        current: 1,
        jump: false,
        backFn: function backFn() {}
      }, options);
      ms.init(this, args);
    };
  },
  uncurryThis: function uncurryThis(f) {
    return function () {
      return f.call.apply(f, arguments);
    };
  },
  curryThis: function curryThis(f) {
    return function () {
      var a = Array.prototype.slice.call(arguments);
      a.unshift(this);
      return f.apply(null, a);
    };
  },
  bindFn: function bindFn(fn, context) {
    var _args = Array.prototype.slice.call(arguments, 2);

    return function () {
      return fn.apply(context, _args.concat(Array.prototype.slice.call(arguments)));
    };
  },
  extend: function extend(child, parent) {
    for (var key in parent) {
      if (parent.hasOwnProperty(key)) child[key] = parent[key];
    }

    function ctor() {}

    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
    child.prototype.constructor = child;
    child.__super__ = parent.prototype;
    return child;
  },
  mixin: function mixin(dest) {
    var sources = Array.prototype.slice.call(arguments, 1);

    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];

      for (var key in src) {
        if (!dest[key]) {
          dest[key] = src[key];
        }
      }
    }
  },
  distinctArray: function distinctArray(arr) {
    var newArray = [],
        dict = {},
        i = 0,
        item;

    for (; i < arr.length; i++) {
      item = arr[i];

      var key = item + ':' + _typeof(item);

      if (!dict[key]) {
        newArray.push(item);
        dict[key] = true;
      }
    }

    return newArray;
  },

  /*
   * 访问终端信息判断
   */
  browser: {
    version: function () {
      var u = navigator.userAgent,
          app = navigator.appVersion;
      return {
        //移动终端浏览器版本信息
        trident: /Trident/i.test(u),
        //IE内核
        presto: /Presto/i.test(u),
        //opera内核
        webKit: /AppleWebKit/i.test(u),
        //苹果、谷歌内核
        gecko: /Gecko/i.test(u) && !/KHTML/i.test(u),
        //火狐内核
        mobile: /AppleWebKit.*Mobile.*/i.test(u),
        //是否为移动终端
        ios: /\(i[^;]+;( U;)? CPU.+Mac OS X/i.test(u),
        //ios终端
        android: /Android/i.test(u) || /Linux/i.test(u),
        //android终端或者uc浏览器
        windowsphone: /Windows Phone/i.test(u),
        //Windows Phone
        iPhone: /iPhone/i.test(u),
        //是否为iPhone或者QQHD浏览器
        iPad: /iPad/i.test(u),
        //是否iPad
        MicroMessenger: /MicroMessenger/i.test(u),
        //是否为微信
        webApp: !/Safari/i.test(u),
        //是否web应该程序，没有头部与底部
        edge: /edge/i.test(u),
        weibo: /Weibo/i.test(u),
        uc: /UCBrowser/i.test(u),
        qq: /MQQBrowser/i.test(u),
        baidu: /Baidu/i.test(u),
        comicApp: /BiliComic|ComicWebView/i.test(u) //是否在漫画的app，或者漫画自己封装的webview

      };
    }(),
    language: (navigator.browserLanguage || navigator.language).toLowerCase(),
    lteIE: function lteIE(ver) {
      return $.browser.msie && parseInt($.browser.version) <= ver;
    }
  },
  cookie: {
    get: function get(cookieName) {
      var theCookie = "" + document.cookie;
      var ind = theCookie.indexOf(cookieName + "=");
      if (ind == -1 || cookieName == "") return "";
      var ind1 = theCookie.indexOf(';', ind);
      if (ind1 == -1) ind1 = theCookie.length;
      return unescape(theCookie.substring(ind + cookieName.length + 1, ind1));
    },
    set: function set(name, value, days) {
      days = days !== undefined ? days : 365;
      var exp = new Date();
      exp.setTime(exp.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString() + "; path=/; domain=.bilibili.com";
    },
    'delete': function _delete(name) {
      this.set(name, '', -1);
    }
  },
  readFromLocal: function readFromLocal(key) {
    if (this.localStorage._support) {
      return localStorage.getItem(key);
    } else {
      return this.cookie.get(key);
    }
  },
  saveToLocal: function saveToLocal(key, val, days) {
    if (this.localStorage._support) {
      return localStorage.setItem(key, val);
    } else {
      return this.cookie.set(key, val, days);
    }
  },
  localStorage: {
    _support: window.localStorage && _typeof(window.localStorage) == 'object' ? true : false,
    getItem: function getItem(key) {
      if (this._support) {
        return window.localStorage.getItem(key);
      } else {
        return null;
      }
    },
    setItem: function setItem(key, value) {
      if (this._support) {
        window.localStorage.setItem(key, value);
      }
    },
    removeItem: function removeItem(key) {
      if (this.getItem(key)) {
        window.localStorage.removeItem(key);
      }
    }
  },
  unhtml: function unhtml(str, reg) {
    return str ? str.replace(reg || /[&<">'](?:(amp|lt|quot|gt|#39|nbsp|#\d+);)?/g, function (a, b) {
      if (b) {
        return a;
      } else {
        return {
          '<': '&lt;',
          '&': '&amp;',
          '"': '&quot;',
          '>': '&gt;',
          "'": '&apos;'
        }[a];
      }
    }) : '';
  },
  html: function html(str) {
    return str ? str.replace(/&((g|l|quo)t|amp|#39|nbsp);/g, function (m) {
      return {
        '&lt;': '<',
        '&amp;': '&',
        '&quot;': '"',
        '&gt;': '>',
        '&#39;': "'",
        '&nbsp;': ' '
      }[m];
    }) : '';
  },
  hashManage: {
    prependHash: '!',
    _change: function _change(key, value) {
      var hash = location.hash,
          hashArray,
          hashMap = {},
          hashString = '',
          index = 0;

      if (hash) {
        hash = hash.substring(1);

        if (this.prependHash) {
          hash = hash.replace(new RegExp('^' + this.prependHash.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&")), '');
        }
      }

      hashArray = hash.split('&');

      for (var i = 0; i < hashArray.length; i++) {
        var _k = hashArray[i].split('=')[0],
            _v = hashArray[i].split('=')[1];

        if (_k) {
          hashMap[_k] = decodeURIComponent(_v);
        }
      }

      if (_typeof(key) == 'object') {
        for (var j in key) {
          var _val = key[j];

          if (_val) {
            hashMap[j] = encodeURIComponent(_val);
          } else if (_val === false) {
            delete hashMap[j];
          }
        }
      } else {
        if (value) {
          hashMap[key] = encodeURIComponent(value);
        } else if (value === false) {
          delete hashMap[key];
        } else if (typeof key == 'undefined') {
          return hashMap;
        } else {
          return hashMap[key] || null;
        }
      }

      for (var k in hashMap) {
        if (index != 0) {
          hashString += '&';
        } else {
          hashString += this.prependHash;
        }

        hashString += k + '=' + hashMap[k];
        index++;
      }

      location.hash = hashString;
      return hashMap;
    },
    get: function get(key) {
      return this._change(key, null);
    },
    set: function set(key, value) {
      return this._change(key, value);
    },
    clear: function clear() {
      location.hash = '';
    }
  },
  getColor16: function getColor16(rgb) {
    function _to16(d) {
      var color = parseInt(d).toString(16);
      return color.length == 1 ? "0" + color : color;
    }

    function _parse(array) {
      var value = "#";

      for (var i = 0; i < 3; i++) {
        value += _to16(array[i]);
      }

      return value;
    }

    var result = "";
    var rgbArray = [];

    if (rgb.match(/\((.*)\)/) != null) {
      rgbArray = rgb.match(/\((.*)\)/)[1].split(",");
      result = _parse(rgbArray);
    } else if (rgb.match(/,+/g) != null) {
      rgbArray = rgb.split(",");
      result = _parse(rgbArray);
    } else {
      result = _to16(rgb);
    }

    return result;
  },
  serializeParam: function serializeParam(json) {
    var strArr = [];

    for (var i in json) {
      if (!(_typeof(json[i]).toLowerCase() == "function" || _typeof(json[i]).toLowerCase() == "object")) {
        strArr.push(encodeURIComponent(i) + "=" + encodeURIComponent(json[i]));
      } else if ($.isArray(json[i])) {
        //支持传数组内容
        for (var j = 0; j < json[i].length; j++) {
          strArr.push(encodeURIComponent(i) + "[]=" + encodeURIComponent(json[i][j]));
        }
      }
    }

    return strArr.join("&");
  },
  query2json: function query2json(query) {
    if ($.isPlainObject(query)) {
      return query;
    }

    if (query === undefined) {
      return {};
    }

    var q = query.split("&"),
        j = {};

    for (var i = 0; i < q.length; i++) {
      var arr = q[i].split('=');
      j[arr[0]] = arr[1];
    }

    return j;
  },
  hash2json: function hash2json() {
    if (window.location.href.split('#').length > 1) {
      return this.query2json(window.location.href.split('#')[1].split('?')[0].replace(/#/, ""));
    } else {
      return {};
    }
  },
  query: {
    get: function get(key) {
      var queryJson = utils.query2json(this._getQuery());

      if (key) {
        return queryJson[key];
      } else {
        return queryJson;
      }
    },
    set: function set(key, value) {
      var queryJson = utils.query2json(this._getQuery());
      var hashJson = utils.hash2json();

      if (_typeof(key) == 'object') {
        for (var k in key) {
          this._set(queryJson, k, key[k]);
        }
      } else {
        this._set(queryJson, key, value);
      }

      return utils.makeUrl('', queryJson, hashJson);
    },
    _set: function _set(json, key, value) {
      if (value === null) {
        delete json[key];
      } else {
        json[key] = value;
      }

      return json;
    },
    _getQuery: function _getQuery() {
      if (window.location.search !== undefined) {
        return window.location.search.substring(1);
      } else {
        return window.location.href.split('?')[1] ? window.location.href.split('?')[1].split('#')[0] : '';
      }
    }
  },
  makeUrl: function makeUrl(url, queryJson, hashJson) {
    var query = this.serializeParam(queryJson),
        hash = this.serializeParam(hashJson),
        _url;

    if (query) {
      _url = (url || location.pathname) + '?' + query;
    } else {
      _url = url || location.pathname;
    }

    if (hash) {
      _url = _url + '#' + hash;
    }

    return _url;
  },
  formatNum: function formatNum(num, unit) {
    if (num === undefined || typeof num == 'string' && isNaN(parseInt(num))) return '--';
    var unitMap = {
      '万': 10000
    },
        defaultUnit = '万';
    unit = typeof unit == 'string' ? unit : defaultUnit;
    var factor = unitMap[unit] || unitMap[defaultUnit];
    if (typeof num == 'string' && num.indexOf(unit) >= 0) return;

    if (typeof num == 'string' && num.indexOf(",") >= 0) {
      var nums = num.split(",");
      var total = "";

      for (var i = 0; i < nums.length; i++) {
        total += nums[i];
      }

      num = total;
    }

    num = parseInt(num);

    if (num >= factor) {
      num = (num / factor).toFixed(1) + unit;
    }

    return num;
  },
  parseCardProps: function parseCardProps(dataItem, type) {
    var props = {
      'data-gk': dataItem.play,
      'data-sc': dataItem.favorites,
      'data-pl': dataItem.review,
      'data-dm': dataItem.video_review,
      'data-up': dataItem.author,
      'data-subtitle': dataItem.subtitle,
      'data-lm': dataItem.typename || '',
      'data-tg': dataItem.created ? new Date(dataItem.created * 1000).format('yyyy-MM-dd hh:mm') : dataItem.create || dataItem.created_at,
      'data-txt': dataItem.description,
      'data-yb': dataItem.coins
    },
        str = "";

    if (type == 'string') {
      for (var k in props) {
        if (str != "") {
          str += " ";
        }

        str += k + '="' + props[k] + '"';
      }

      return str;
    } else {
      return props;
    }
  },
  newParseCardProps: function newParseCardProps(dataItem, type) {
    var props = {
      'data-gk': dataItem.stat.view,
      'data-sc': dataItem.stat.favorite,
      'data-pl': dataItem.stat.reply,
      'data-dm': dataItem.stat.danmaku,
      'data-up': dataItem.owner.name,
      'data-lm': dataItem.tname || '',
      'data-tg': new Date(dataItem.pubdate * 1000).format('yyyy-MM-dd hh:mm'),
      'data-txt': dataItem.desc,
      'data-yb': dataItem.stat.coin
    };
    return props;
  },
  // protocol-relative 为了兼容ie8以下
  protocolRelative: function protocolRelative(url) {
    if (/http:|https:/.test(url)) {
      return url.replace(/http:|https:/, window.location.protocol);
    } else if ($.browser.msie && parseInt($.browser.version) <= 8) {
      return window.location.protocol + url;
    } else {
      return url;
    }
  },
  formatDuration: function formatDuration(duration, isToHour, minHeadBits) {
    if (typeof duration !== 'number') {
      return duration;
    }

    minHeadBits = minHeadBits || -1;
    var second = this.toFixed(duration % 60, 2);
    var minute = isToHour ? this.toFixed(Math.floor(duration % 3600 / 60), 2) : this.toFixed(Math.floor(duration / 60), minHeadBits);
    var hour = isToHour ? this.toFixed(Math.floor(duration / 3600), minHeadBits) : null;
    return hour === null ? [minute, second].join(':') : [hour, minute, second].join(':');
  },
  isObject: function isObject(obj) {
    return _typeof(obj) === 'object' && obj !== null;
  },
  isNothing: function isNothing(obj) {
    return obj == null; // Only deal with null/undefined values
  },
  isUndefined: function isUndefined(obj) {
    return typeof obj === 'undefined';
  },
  join: function join() {
    return Array.prototype.join.call(arguments, '');
  },
  random: function random(start, end) {
    if (this.isNothing(end)) {
      end = start;
      start = 0;
    }

    return Math.floor(Math.random() * (end - start + 1)) + start;
  },
  debounce: function debounce(func, delay, isImmediate) {
    var timeout;

    function debounced() {
      clearTimeout(timeout);

      if (isImmediate && utils.isNothing(timeout)) {
        func();
      }

      timeout = setTimeout(func, delay || 100);
    }

    debounced.clearNext = function () {
      clearTimeout(timeout);
    };

    return debounced;
  },
  throttle: function throttle(func, delay, options) {
    var timeout,
        prev = 0;
    delay = delay || 200;
    options = options || {};

    function later() {
      prev = options.head ? 0 : new Date().getTime();
      timeout = null;
      func();
    }

    function throttled() {
      var remain,
          now = new Date().getTime();

      if (!prev && options.head) {
        prev = now;
      }

      remain = delay - (now - prev);

      if (remain <= 0 || remain > delay) {
        clearTimeout(timeout);
        timeout = null;
        prev = now;
        func();
      } else if (!timeout && !options.tail) {
        timeout = setTimeout(later, remain);
      }
    }

    throttled.clearNext = function () {
      clearTimeout(timeout);
      timeout = null;
      prev = 0;
    };

    return throttled;
  },
  toFixed: function toFixed(data, bits) {
    if (typeof data !== 'number' && typeof data !== 'string') {
      return data;
    }

    data = String(data);
    bits = Number(bits) || 2;

    while (data.length < bits) {
      data = '0' + data;
    }

    return data.length > bits ? data : data.slice(-bits);
  },
  thumbnail: function thumbnail(src, width, height) {
    if (typeof src !== 'string') {
      return src;
    }

    if (typeof width === 'undefined') {
      return src;
    }

    var urls = src.split('?');
    var sizes, rules, feature, matches;
    height = height || width;
    sizes = {
      midfix: '/' + width + '_' + height,
      suffix: '_' + width + 'x' + height
    };
    rules = {
      cdn: /^http.+i[0-2]\.hdslb\.com\//,
      bfs: /^http.+i\d\.hdslb\.com\/bfs\//,
      group1: /^http.+i\d\.hdslb\.com\/group1\//,
      other: /(^http.+i\d\.hdslb\.com)(\/.+)/
    };
    feature = {
      bfs: /_\d+x\d+\./,
      other: /\/\d+_\d+\//
    };

    if (!rules.cdn.test(urls[0])) {
      return src;
    }

    if (feature.bfs.test(urls[0]) || feature.other.test(urls[0])) {
      return src;
    }

    if (rules.bfs.test(urls[0]) || rules.group1.test(urls[0])) {
      urls[0] += sizes.suffix + urls[0].slice(urls[0].lastIndexOf('.'));
      src = urls.join('?');
    } else {
      matches = rules.other.exec(urls[0]);

      if (matches) {
        urls[0] = matches[1] + sizes.midfix + matches[2];
        src = urls.join('?');
      }
    }

    return src;
  },
  //检查是否支持webp
  isWebp: function () {
    try {
      return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') == 0;
    } catch (err) {
      return false;
    }
  }(),
  webp: function webp(url, args) {
    if (!url) {
      return url;
    }

    var suffix = url.match(/(.*\.(jpg|jpeg|gif|png|bmp))(\?.*)?/); //路径是否包含/bfs/

    var isBfs = url.indexOf('/bfs/') != -1 ? true : false; //是否是GIF图片

    if (!suffix || suffix[2] === 'bmp' || !isBfs) {
      return url;
    }

    var w = args.w,
        h = args.h; //裁剪规则

    var filter = [];

    if (w && h) {
      filter.push(w + 'w');
      filter.push(h + 'h');
    }

    if (args.freeze) {
      filter.push('1s');
    } // var cut = (w && h) ? '@' + w + 'w_' + h + 'h' : '@'
    //图片后参数 比如视频动态图


    var args = suffix[3] ? suffix[3] : ''; // console.log(suffix[3], args)

    if (this.isWebp) {
      return suffix[1] + '@' + filter.join('_') + '.webp' + args;
    } else {
      return suffix[1] + '@' + filter.join('_') + '.' + suffix[2] + args;
    }
  },
  isAlpha: function isAlpha(items, rate) {
    var machineDna;

    if (localStorage.getItem('machineDna')) {
      machineDna = localStorage.getItem('machineDna');
    } else {
      machineDna = parseInt(Math.random() * 10 + 1);
      localStorage.setItem('machineDna', machineDna);
    }

    if (this.isBeta(items) || rate < machineDna) {
      return true;
    } else {
      return false;
    }
  },
  isBeta: function isBeta(items) {
    var isOpen = false;
    var mantissa = utils.cookie.get('DedeUserID').slice(-1);

    if (mantissa && $.isArray(items)) {
      isOpen = $.inArray(+mantissa, items) > -1;
    }

    return isOpen;
  },
  trimHttp: function trimHttp(url) {
    return url ? url.replace(/^http:/, '') : '';
  },
  getByteLen: function getByteLen(val) {
    var len = 0;

    for (var i = 0; i < val.length; i++) {
      var a = val.charAt(i);

      if (a.match(/[^\x00-\xff]/ig) != null) {
        len += 1;
      } else {
        len += .5;
      }
    }

    return len;
  },
  //评论在播放页日志上报
  videoReport: function videoReport(name) {
    if (window.spmReportData) {
      window.spmReportData[name] = name;
    }
  },
  //埋点上报
  customReport: function customReport(name, ops) {
    if (window.reportConfig && window[reportConfig['msgObjects']]) {
      var reportObj = window[reportConfig['msgObjects']];
      var obj = ops ? ops : name;
      reportObj[name] = obj;
    }
  },
  formatLotteryTime: function formatLotteryTime(time) {
    time = time * 1000;
    var date = new Date(time);
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var minute = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
    return year + '年' + month + '月' + day + '日 ' + hour + ':' + minute;
  },
  hexToRgbA: function hexToRgbA(hex) {
    var localHex = hex.toString();

    if (hex.length === 6) {
      localHex = 'ff' + localHex;
    }

    var r = parseInt(localHex.slice(2, 4), 16),
        g = parseInt(localHex.slice(4, 6), 16),
        b = parseInt(localHex.slice(6, 8), 16),
        alpha = parseInt(localHex.slice(0, 2), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha / 255 + ")";
  },
  asyncScript: function asyncScript(url) {
    return new Promise(function (resolve) {
      var script = document.createElement('script');
      script.setAttribute('src', url);
      document.body.appendChild(script);
      script.onload = resolve;
    });
  },
  cmGetUrl: function cmGetUrl(cmData, id) {
    if (!window.BiliCm) return '';
    return window.BiliCm.Base.getSyncUrl(cmData, Number(id));
  },
  cmSendData: function cmSendData(cmData, id) {
    if (!window.BiliCm) return;
    window.BiliCm.Base.sendShowData(cmData, Number(id));
  },
  cmSendStrictData: function cmSendStrictData(cmData, id) {
    if (!window.BiliCm) return;
    window.BiliCm.Base.sendStrictShowData(cmData, Number(id));
  },
  cmSendCloseData: function cmSendCloseData(cmData, id) {
    if (!window.BiliCm) return;
    window.BiliCm.Base.sendCloseData(cmData, Number(id));
  },
  checkInView: function checkInView(el, padding) {
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var p = padding || 0; // 只判断了纵向

    return rect.top < window.innerHeight + p && rect.bottom >= 0;
  },

  /**
   * 完全自定义上报 可自定义上报通道和公共参数
   * @param {*} options
   *  spm_id : spmid 非必传 取meta中spmid
   *  c : C段  非必传 默认 0
   *  d : D段 非必传  默认 0
   *  e : E段 非必传  默认 0
   *  type : pv, click, appear 上报类型通道
   * @param {*} info 
   */
  allCustomReport: function allCustomReport() {
    var _document$getElements;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var info = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var spm_idAB = options.spm_id || ((_document$getElements = document.getElementsByTagName('meta').spm_prefix) === null || _document$getElements === void 0 ? void 0 : _document$getElements.content) || '0.0';
    var spmidC = options.c || '0';
    var spmidD = options.d || '0';
    var spmidE = options.e || '0';
    var spm_id = spmidE ? "".concat(spm_idAB, ".").concat(spmidC, ".").concat(spmidD, ".").concat(spmidE) : "".concat(spm_idAB, ".").concat(spmidC, ".").concat(spmidD);

    if (!options.type) {
      throw new Error('report need type');
    }

    info.spm_id = spm_id;

    if (window.reportObserver && window.reportObserver.reportCustomData) {
      window.reportObserver.reportCustomData(options.type, info);
    }
  },
  selectStyle: function selectStyle() {
    var _window$abtest;

    var pageVersion = (_window$abtest = window.abtest) === null || _window$abtest === void 0 ? void 0 : _window$abtest.pageVersion; // 暂时下线方案2
    // if(pageVersion === 'v_new_home_5' || pageVersion === 'v_new_home_6') {
    //   return '-v2'
    // }

    return '-v1';
  }
};
module.exports = utils;

/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/@bilibili/userAvatar/dist/user-avatar.css":
/*!******************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/@bilibili/userAvatar/dist/user-avatar.css ***!
  \******************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, "/*!\n * @bilibili/userAvatar\n * version: 1.1.7. Powered by main-frontend\n * 用户头像公共组件.\n * author: wuxiuran\n */\n.bili-avatar {\n  display: block;\n  position: relative;\n  background-image: url(data:image/gif;base64,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);\n  background-size: cover;\n  border-radius: 50%;\n  margin: 0;\n  padding: 0;\n}\n.bili-avatar * {\n  margin: 0;\n  padding: 0;\n}\n.bili-avatar-face {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  -webkit-transform: translate(-50%, -50%);\n     -moz-transform: translate(-50%, -50%);\n      -ms-transform: translate(-50%, -50%);\n       -o-transform: translate(-50%, -50%);\n          transform: translate(-50%, -50%);\n  width: 100%;\n  height: 100%;\n}\n.bili-avatar-pendent-dom {\n  height: 176.48%;\n  width: 176.48%;\n  position: absolute;\n  top: -38.33%;\n  left: -38.33%;\n  overflow: hidden;\n}\n.bili-avatar-pendent-dom img {\n  height: 100%;\n  min-width: 100%;\n  -webkit-user-select: none;\n     -moz-user-select: none;\n      -ms-user-select: none;\n          user-select: none;\n}\n.bili-avatar-img {\n  border: none;\n  display: block;\n  -o-object-fit: cover;\n     object-fit: cover;\n  image-rendering: -webkit-optimize-contrast;\n}\n.bili-avatar-img-radius {\n  border-radius: 50%;\n}\n.bili-avatar-img[src=\"\"],\n.bili-avatar-img:not([src]) {\n  opacity: 0;\n}\n.bili-avatar-icon--big-vip {\n  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNTk0Mjk2ODk1Nzc2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjQ2MTIiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+PC9zdHlsZT48L2RlZnM+PHBhdGggZD0iTTUxMS4wNzA3OCAwLjA0NjQ2MWE1MTEuMDcwNzggNTExLjA3MDc4IDAgMCAxIDUxMS4wNzA3ODEgNTExLjA3MDc4YzAgMjgyLjI1MDQ1NC0yMjguODIwMzI3IDUxMS4wNzA3OC01MTEuMDcwNzgxIDUxMS4wNzA3ODFzLTUxMS4wNzA3OC0yMjguODIwMzI3LTUxMS4wNzA3OC01MTEuMDcwNzgxIDIyOC44MjAzMjctNTExLjA3MDc4IDUxMS4wNzA3OC01MTEuMDcwNzh6IiBmaWxsPSIjRkZGRkZGIiBwLWlkPSI0NjEzIj48L3BhdGg+PHBhdGggZD0iTTUxMS4wNzA3OCA5Mi45Njg0MjFhNDE4LjE0ODgyIDQxOC4xNDg4MiAwIDEgMSAwIDgzNi4yOTc2NDEgNDE4LjE0ODgyIDQxOC4xNDg4MiAwIDAgMSAwLTgzNi4yOTc2NDF6IiBmaWxsPSIjRkI3Mjk5IiBwLWlkPSI0NjE0Ij48L3BhdGg+PHBhdGggZD0iTTQzNi43MzMyMTIgMjQwLjIwMzI2N2M0MC4yODE2NyAwLjkyOTIyIDc3LjM1NzUzMiAyMi40ODcxMTQgOTguNDUwODE3IDU3LjE5MzQ2NiAyMC4zNDk5MDkgNDAuNjk5ODE5IDAgODkuMzQ0NDY1IDUuNjIxNzc5IDk1LjA1OTE2NSA1LjYyMTc3OSA1LjY2ODI0IDUwLjU0OTU0Ni0xNS44NDMxOTQgNjcuNzQwMTA5LTIxLjIzMjY2OGEyMDEuMTI5NTgzIDIwMS4xMjk1ODMgMCAwIDEgMTEwLjM0NDgyNy0xMS44OTQwMSA5Mi4wODU2NjIgOTIuMDg1NjYyIDAgMCAxIDQyLjU1ODI1OCA4OS4yMDUwODFjLTMuOTQ5MTgzIDM4LjI4Mzg0OC0zOC4wNTE1NDMgMzYuNTY0NzkxLTc4LjI0MDI5MSAyOS43MzUwMjdhNDMwLjQ2MDk4IDQzMC40NjA5OCAwIDAgMC0xNDIuNjgxNjY5IDE3LjA5NzY0MWMtMTcuNzAxNjMzIDUuNzE0NzAxLTI5LjkyMDg3MSA5LjE5OTI3NC0zOC4zNzY3NyAyNC4xMTMyNDloMC42NTA0NTRjLTguNTk1MjgxIDE0Ljg2NzUxNC04MC4yODQ1NzQgMTc5LjU3MTY4OC04OS4zNDQ0NjUgMjAyLjU2OTg3My0xNS4zMzIxMjMgMjcuODc2NTg4LTM4LjUxNjE1MiA1MC41NDk1NDYtNjYuNDg1NjYyIDY1LjIzMTIxNmExMDguMzQ3MDA1IDEwOC4zNDcwMDUgMCAwIDEtOTguNDUwODE3LTUuNzE0NzAxYy0yNy44MzAxMjctMjEuODM2NjYxLTM1LjMxMDM0NS0zOC40Njk2OTEtNS4xMTA3MDgtNDguNzg0MDI5IDMwLjE5OTYzNy0xMC4yNjc4NzcgODguNjk0MDExLTg0LjA5NDM3NCAxMDMuNTYxNTI1LTEwNi44NjAyNTQgMTQuODY3NTE0LTIyLjgxMjM0MSA2OC42NjkzMjgtOTkuMDA4MzQ4IDU2Ljc3NTMxOC0xMDcuMDkyNTU5YTI5My44NjU2OTkgMjkzLjg2NTY5OSAwIDAgMC0xMDIuOTU3NTMyIDExLjU2ODc4NGMtMTYuNDAwNzI2IDUuMDY0MjQ3LTI0LjM5MjAxNSAxMy4xNDg0NTctMzguNjU1NTM2LTUuMjUwMDkxYTE1OS43MzI4NDkgMTU5LjczMjg0OSAwIDAgMS0yMy45Mjc0MDQtNzcuMTI1MjI3YzEuODU4NDM5LTkuMTk5Mjc0IDMuNjIzOTU2LTEzLjc1MjQ1IDUuMTU3MTY4LTEzLjc1MjQ1YTk3Ni4zNzc0OTUgOTc2LjM3NzQ5NSAwIDAgMCAxODUuNTY1MTU1LTI1LjE4MTg1MWM3Ljg5ODM2Ny0yNC40Mzg0NzUgOS4zODUxMTgtNTAuNTQ5NTQ2IDQuNDEzNzkzLTc1LjczMTM5N2EzMDEuOTk2MzcgMzAxLjk5NjM3IDAgMCAwLTI5LjU5NTY0NC03Ny4yNjQ2MWMtNC41NTMxNzYtMy40ODQ1NzQgNi4yNzIyMzItMTUuODQzMTk0IDMyLjk4NzI5NS0xNS44NDMxOTR6IG0xNTUuNTUxMzYyIDM0MC4zMjY2NzlhNDEyLjU3MzUwMyA0MTIuNTczNTAzIDAgMCAxIDk1LjAxMjcwNCAyNy43MzcyMDVjMzAuMTUzMTc2IDE1LjA1MzM1OCAxMzIuNDEzNzkzIDUxLjYxODE0OSAxMTEuNzg1MTE4IDExNy44MjUwNDUtMjAuNTgyMjE0IDY2LjA2NzUxNC0yOS42NDIxMDUgNzEuNjQyODMxLTQ5LjIwMjE3OCA1NS41MjA4NzEtMTkuNTEzNjEyLTE2LjEyMTk2LTE4OC42MzE1NzktMTY2LjUxNjE1Mi0xOTMuODgxNjctMTc0Ljg3OTEyOWExNy45MzM5MzggMTcuOTMzOTM4IDAgMCAxIDEuMDY4NjAzLTIyLjMwMTI3YzcuODUxOTA2LTYuNjkwMzgxIDI1LjIyODMxMi00LjM2NzMzMiAzNS4yMTc0MjMtMy45MDI3MjJ6IiBmaWxsPSIjRkZGRkZGIiBwLWlkPSI0NjE1Ij48L3BhdGg+PC9zdmc+);\n}\n.bili-avatar-icon--business {\n  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNTk0Mjk2OTA0NjU3IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjQ4ODQiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+PC9zdHlsZT48L2RlZnM+PHBhdGggZD0iTTUxMiA1MTJtLTUxMiAwYTUxMiA1MTIgMCAxIDAgMTAyNCAwIDUxMiA1MTIgMCAxIDAtMTAyNCAwWiIgZmlsbD0iI0ZGRkZGRiIgcC1pZD0iNDg4NSI+PC9wYXRoPjxwYXRoIGQ9Ik01MTIgNTEybS00MTguOTA5MDkxIDBhNDE4LjkwOTA5MSA0MTguOTA5MDkxIDAgMSAwIDgzNy44MTgxODIgMCA0MTguOTA5MDkxIDQxOC45MDkwOTEgMCAxIDAtODM3LjgxODE4MiAwWiIgZmlsbD0iIzRBQzdGRiIgcC1pZD0iNDg4NiI+PC9wYXRoPjxwYXRoIGQ9Ik00NzQuMTEyIDc2My45NTA1NDVhMzMuMjggMzMuMjggMCAwIDEtMTQuMDU2NzI3IDQuMDQ5NDU1IDIxLjAzODU0NSAyMS4wMzg1NDUgMCAwIDEtMjEuMzE3ODE4LTIwLjgwNTgxOCAxOS41NDkwOTEgMTkuNTQ5MDkxIDAgMCAxIDEuMjEwMTgxLTUuODY0NzI3bDQwLjQ5NDU0Ni0xODcuNDM4NTQ2LTE2Ny42NTY3MjcgMC4zMjU4MThhMjEuMjI0NzI3IDIxLjIyNDcyNyAwIDAgMS0yMS44NzYzNjQtMjAuODA1ODE4IDIwLjQzMzQ1NSAyMC40MzM0NTUgMCAwIDEgOS40OTUyNzMtMTYuODQ5NDU0bDI1MC4xODE4MTgtMjU1Ljc2NzI3M2M0LjYwOC0yLjc5MjcyNyA5LjU0MTgxOC00Ljc0NzYzNiAxNC42NjE4MTgtNC43OTQxODJhMjEuMTMxNjM2IDIxLjEzMTYzNiAwIDAgMSAyMS4zNjQzNjQgMjAuODUyMzY0IDE5Ljk2OCAxOS45NjggMCAwIDEtMi43OTI3MjggOS43NzQ1NDVsLTQwLjIxNTI3MiAxODQuMzJoMTY3Ljg0MjkwOWEyMS4xNzgxODIgMjEuMTc4MTgyIDAgMCAxIDIxLjY0MzYzNiAyMC44NTIzNjQgMjAuMjkzODE4IDIwLjI5MzgxOCAwIDAgMS05LjQ5NTI3MyAxNi45NDI1NDVsLTI0OS40ODM2MzYgMjU1LjIwODcyN3oiIGZpbGw9IiNGRkZGRkYiIHAtaWQ9IjQ4ODciPjwvcGF0aD48L3N2Zz4=);\n}\n.bili-avatar-icon--personal {\n  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNTk0Mjk2OTAwOTA1IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjQ3NDgiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+PC9zdHlsZT48L2RlZnM+PHBhdGggZD0iTTUxMiA1MTJtLTUxMiAwYTUxMiA1MTIgMCAxIDAgMTAyNCAwIDUxMiA1MTIgMCAxIDAtMTAyNCAwWiIgZmlsbD0iI0ZGRkZGRiIgcC1pZD0iNDc0OSI+PC9wYXRoPjxwYXRoIGQ9Ik01MTIgNTEybS00MTguOTA5MDkxIDBhNDE4LjkwOTA5MSA0MTguOTA5MDkxIDAgMSAwIDgzNy44MTgxODIgMCA0MTguOTA5MDkxIDQxOC45MDkwOTEgMCAxIDAtODM3LjgxODE4MiAwWiIgZmlsbD0iI0ZGQzYyRSIgcC1pZD0iNDc1MCI+PC9wYXRoPjxwYXRoIGQ9Ik00NzQuMTEyIDc2My45NTA1NDVhMzMuMjggMzMuMjggMCAwIDEtMTQuMDU2NzI3IDQuMDQ5NDU1IDIxLjAzODU0NSAyMS4wMzg1NDUgMCAwIDEtMjEuMzE3ODE4LTIwLjgwNTgxOCAxOS41NDkwOTEgMTkuNTQ5MDkxIDAgMCAxIDEuMjEwMTgxLTUuODY0NzI3bDQwLjQ5NDU0Ni0xODcuNDM4NTQ2LTE2Ny42NTY3MjcgMC4zMjU4MThhMjEuMjI0NzI3IDIxLjIyNDcyNyAwIDAgMS0yMS44NzYzNjQtMjAuODA1ODE4IDIwLjQzMzQ1NSAyMC40MzM0NTUgMCAwIDEgOS40OTUyNzMtMTYuODQ5NDU0bDI1MC4xODE4MTgtMjU1Ljc2NzI3M2M0LjYwOC0yLjc5MjcyNyA5LjU0MTgxOC00Ljc0NzYzNiAxNC42NjE4MTgtNC43OTQxODJhMjEuMTMxNjM2IDIxLjEzMTYzNiAwIDAgMSAyMS4zNjQzNjQgMjAuODUyMzY0IDE5Ljk2OCAxOS45NjggMCAwIDEtMi43OTI3MjggOS43NzQ1NDVsLTQwLjIxNTI3MiAxODQuMzJoMTY3Ljg0MjkwOWEyMS4xNzgxODIgMjEuMTc4MTgyIDAgMCAxIDIxLjY0MzYzNiAyMC44NTIzNjQgMjAuMjkzODE4IDIwLjI5MzgxOCAwIDAgMS05LjQ5NTI3MyAxNi45NDI1NDVsLTI0OS40ODM2MzYgMjU1LjIwODcyN3oiIGZpbGw9IiNGRkZGRkYiIHAtaWQ9IjQ3NTEiPjwvcGF0aD48L3N2Zz4=);\n}\n.bili-avatar-icon--small-vip {\n  background-image: url(data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNTk0Mjk2ODc5NTM3IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjQ0NzYiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiPjxkZWZzPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+PC9zdHlsZT48L2RlZnM+PHBhdGggZD0iTTAgNTEyLjQ2NTQ1NUMwIDc5NC45OTYzNjQgMjI5LjAwMzYzNiAxMDI0IDUxMS41MzQ1NDUgMTAyNGMyODIuNDg0MzY0IDAgNTExLjQ4OC0yMjkuMDAzNjM2IDUxMS40ODgtNTExLjUzNDU0NSAwLTI4Mi40ODQzNjQtMjI5LjAwMzYzNi01MTEuNDg4LTUxMS41MzQ1NDUtNTExLjQ4OFMwIDIyOS45ODEwOTEgMCA1MTIuNTEyeiIgZmlsbD0iI0ZGRkZGRiIgcC1pZD0iNDQ3NyI+PC9wYXRoPjxwYXRoIGQ9Ik01MTIgNTEybS00MTguOTA5MDkxIDBhNDE4LjkwOTA5MSA0MTguOTA5MDkxIDAgMSAwIDgzNy44MTgxODIgMCA0MTguOTA5MDkxIDQxOC45MDkwOTEgMCAxIDAtODM3LjgxODE4MiAwWiIgZmlsbD0iIzZEQzc4MSIgcC1pZD0iNDQ3OCI+PC9wYXRoPjxwYXRoIGQ9Ik0zMzEuMjY0IDYxOC44MjE4MThhMjQuOTAxODE4IDI0LjkwMTgxOCAwIDAgMC01LjYzMi00Ljg4NzI3M2MtMC44Mzc4MTgtMC4wOTMwOTEgMS42MjkwOTEgMS45NTQ5MDkgNS41ODU0NTUgNC44ODcyNzN6IG0yNDUuMjk0NTQ1LTE4LjgwNDM2M2wyLjgzOTI3My0xMS4wNzc4MTlzLTQuMTg5MDkxLTAuMjc5MjczLTIuNzkyNzI3LTIuNzkyNzI3YzEuMzQ5ODE4LTIuNTYgMi43OTI3MjctMTMuODcwNTQ1IDIuNzkyNzI3LTEzLjg3MDU0NXYtMzMuMzI2NTQ2bC0yLjc5MjcyNy0xMS4xMjQzNjMgMi43OTI3MjctNS41ODU0NTUtMi43OTI3MjctMTEuMDc3ODE4di0zMC41MzM4MThsLTIuODM5MjczLTExLjEyNDM2NCA1LjYzMi01LjUzODkwOVYzNjYuNzc4MTgybC0yLjc5MjcyNy0xMS4wNzc4MTgtNS42Nzg1NDYtOC4zNzgxODItMTQuMTAzMjcyLTEzLjg3MDU0Ni0xNC4wNTY3MjgtMjIuMjAyMTgxLTE5Ljc4MTgxOC0yNC45OTQ5MS0xMS4yNjQtMTEuMDc3ODE4LTUuNjMyLTguMzc4MTgydi0yLjc5MjcyN2wtNS42MzItNS40OTIzNjNoLTIuNzkyNzI3bC0yLjgzOTI3My0yLjc5MjcyOC01LjY3ODU0NSA1LjU4NTQ1NS0yLjc5MjcyNy0yLjc5MjcyNy01LjYzMi0yLjc5MjcyOGgtMi43OTI3MjhsLTguNTE3ODE4IDguMzMxNjM3IDIuNzkyNzI3IDUuNTg1NDU0djE2LjYxNjcyN2wyLjg4NTgxOSA1LjU4NTQ1NXY1LjUzODkwOWwyLjc5MjcyNyAyLjc5MjcyNyAyLjc5MjcyNyAxMS4wNzc4MTkgMi44MzkyNzMgNS41ODU0NTQgMi43OTI3MjcgNS41Mzg5MDl2OC4zMzE2MzdsLTIuNzkyNzI3IDIuNzkyNzI3IDIuNzkyNzI3IDE2LjYxNjcyNy0yLjc5MjcyNyAxMS4xMjQzNjR2Mi43OTI3MjdsLTIuNzkyNzI3IDg4LjgwODcyN3YyMi4yNDg3MjhsMi43OTI3MjcgMTEuMDc3ODE4LTIuNzkyNzI3IDUuNTg1NDU0djIuNzkyNzI4cy0wLjM3MjM2NCAzLjQ0NDM2NCAwIDguMjg1MDljMC4zMjU4MTggNC44NDA3MjcgMCA4LjM3ODE4MiAwIDguMzc4MTgydjguMjg1MDkxbC0yLjc5MjcyOCA1LjU4NTQ1NXYyLjc5MjcyN2wyLjc5MjcyOCA1LjQ5MjM2NHYyLjc5MjcyN3MwLjE4NjE4MiA1My44OTk2MzYtMi43OTI3MjggNjMuODYwMzY0YTI0OC45MjUwOTEgMjQ4LjkyNTA5MSAwIDAgMS01LjY3ODU0NSAxNi42NjMyNzJ2NS41ODU0NTVsLTUuNjMyIDguMjg1MDkxdjUuNTg1NDU0bC0yLjc5MjcyNyA1LjUzODkwOS0yLjgzOTI3MyAyLjc5MjcyOHMtMS44NjE4MTggMC43NDQ3MjctMi44MzkyNzMgMGMtMS4wMjQtMC43NDQ3MjctMi43OTI3MjctMi43OTI3MjctMi43OTI3MjctMi43OTI3MjhsLTExOC41MDQ3MjctNjIuMjMxMjcyLTguMzc4MTgyLTQuNDIxODE5czEyMS43NjI5MDkgNjUuMTYzNjM2IDExOC40MTE2MzYgODAuNTIzNjM3YzAgMC05LjIxNiAxLjAyNC0xNC4xMDMyNzMtMi43OTI3MjctNC45MzM4MTgtMy43NzAxODItMTA3LjE0NzYzNi01OC4yNzQ5MDktMTA3LjE0NzYzNi01OC4yNzQ5MWw1My41MjcyNzMgMzYuMDcyNzI4aC0yLjc5MjcyOGwtNTMuNTczODE4LTI3Ljc0MTA5MSAzNi42Nzc4MTggMjcuNzQxMDkxcy0xOC41MjUwOTEtOC40NzEyNzMtMjguMjA2NTQ1LTEzLjMxMmMxMS42MzYzNjQgNy45MTI3MjcgMzYuNjMxMjczIDI3LjIyOTA5MSAzNi42MzEyNzMgMjcuMjI5MDkxaC0yLjc5MjcyOGwtNzAuNTE2MzYzLTQ3LjE5NzA5MSA0NS4xNDkwOTEgMzMuMjhzNjkuMzUyNzI3IDQ5Ljg5NjcyNyA3MC40Njk4MTggNTguMzIxNDU0bC04LjQ3MTI3MyAxMS4xMjQzNjRIMzkzLjMwOTA5MWwtMi44MzkyNzMgMi43OTI3MjctMi43OTI3MjcgMi43NDYxODIgMi43OTI3MjcgNS41ODU0NTVoLTguNDcxMjczbC01LjU4NTQ1NC0yLjc5MjcyOCAyLjc5MjcyNyA1LjUzODkwOXYyLjc5MjcyOGwtMi43OTI3MjcgMi43OTI3MjctMi44ODU4MTggMi43NDYxODIgMi44MzkyNzIgMi43OTI3MjdoOC40NzEyNzNsLTUuNjMyIDUuNTM4OTA5cy00Ljk4MDM2NCA1LjIxMzA5MSAwIDguMzMxNjM2YzQuOTMzODE4IDMuMTE4NTQ1IDMwLjk5OTI3MyAyNy43NDEwOTEgMzAuOTk5MjczIDI3Ljc0MTA5MWw1LjYzMiAyLjc5MjcyOGgzMS4wNDU4MThsMzAuOTk5MjczLTEzLjg3MDU0NmgxMS4yNjRsOC40NzEyNzMtNS41ODU0NTQgNDcuOTQxODE4LTQxLjYxMTYzNyA1LjYzMi0xMy45MTcwOTEgOC40NzEyNzItMTEuMDc3ODE4IDUuNjMyLTUuNTg1NDU0IDIuNzkyNzI4LTguMjg1MDkxIDguNTE3ODE4LTIyLjI0ODcyOCAyLjc5MjcyNy0xNi42NjMyNzIgMi43OTI3MjctNS41Mzg5MDktMi43OTI3MjctNS41ODU0NTUtMi43OTI3MjctMTkuNDA5NDU0eiBtMjg1Ljg4MjE4MiAzNS44NGMtMTEuNzc2LTQ2LjgyNDcyNy0zOS45MzYtODIuOTkwNTQ1LTg0LjQ4LTEwOC41OTA1NDZsLTM3LjE4OTgxOC0yNi44MTAxODItNTAuNzgxMDkxLTU3LjM5MDU0NS0yLjQ2NjkwOS0xLjc2ODcyN2ExNy40NTQ1NDUgMTcuNDU0NTQ1IDAgMCAwLTE2LjA1ODE4Mi00LjE4OTA5MWwxLjUzNiA5LjYzNDkwOWMxLjI1NjcyNyA0Ljk4MDM2NCA0LjMyODcyNyAxNC41Njg3MjcgOS4zMDkwOTEgMjguNzE4NTQ1IDQuODg3MjczIDE0LjE0OTgxOCA4Ljg0MzYzNiAyNC41Mjk0NTUgMTEuODIyNTQ2IDMxLjE4NTQ1NSAzLjAyNTQ1NSA2LjY1NiA4LjkzNjcyNyAxNy4yMjE4MTggMTcuODI2OTA5IDMxLjc5MDU0NSA4Ljg5MDE4MiAxNC41Njg3MjcgMTUuNDk5NjM2IDI0LjYyMjU0NSAxOS43ODE4MTggMzAuMTYxNDU1bC0xLjIxMDE4MiAxLjUzNi0xNC45NDEwOTEgMi42OTk2MzYtNzcuMTcyMzYzLTEuNzY4NzI3YTIxLjQxMDkwOSAyMS40MTA5MDkgMCAwIDAtMTUuNTkyNzI4LTEuNDg5NDU1bDAuNzkxMjczIDAuNjA1MDkxYTkzLjA5MDkwOSA5My4wOTA5MDkgMCAwIDAgMzYuMzk4NTQ1IDcuOTEyNzI3YzkuMzA5MDkxIDMuNDQ0MzY0IDE4LjE1MjcyNyA4LjE0NTQ1NSAyNi4zOTEyNzMgMTQuMTAzMjczIDMuNTM3NDU1IDAuOTMwOTA5IDUuMzUyNzI3IDMuMDI1NDU1IDUuMzk5MjczIDYuMzMwMTgybDQ0LjY4MzYzNiAxOC43NTc4MThjOC4wOTg5MDkgNS4wMjY5MDkgMTYuMzM3NDU1IDkuMzA5MDkxIDI0Ljc2MjE4MiAxMi44OTMwOTEgNi44ODg3MjcgNi42MDk0NTUgMTMuNDk4MTgyIDEzLjAzMjcyNyAxOS44MjgzNjQgMTkuMjIzMjczIDguODQzNjM2IDYuMzMwMTgyIDIxLjE3ODE4MiAxMi4wMDg3MjcgMzcuMDk2NzI3IDE2Ljk0MjU0NSAxNS45MTg1NDUgNC45MzM4MTggMjguMjUzMDkxIDIuODM5MjczIDM3LjA5NjcyNy02LjI4MzYzNmEzNS4xNDE4MTggMzUuMTQxODE4IDAgMCAwIDcuMTY4LTI0LjIwMzYzNnpNMzcwLjg3NDE4MiA0MjcuOTg1NDU1cy05Mi41Nzg5MDkgNjAuMzY5NDU1LTExMy44NTAxODIgODcuMTMzMDljMCAwLTE1Ljk2NTA5MS0xMS44MjI1NDUtMTYuMjkwOTA5LTMyLjY3NDkwOSAwIDAtMTIuNzA2OTA5LTMuMDcyLTI3LjA4OTQ1NSAyNy4yMjkwOTEtMTQuMzgyNTQ1IDMwLjI1NDU0NS0xNi4yOTA5MDkgMjcuMTgyNTQ1LTE2LjI5MDkwOSAyNy4xODI1NDZsLTE2LjI0NDM2MyA0My41NjY1NDVzLTI3LjA4OTQ1NSA4My4yNjk4MTggMzIuNTM1MjcyIDkyLjUzMjM2NGMwIDAgMzIuMjU2LTIuNjUzMDkxIDQzLjM4MDM2NC0yNy4yMjkwOTEgMTEuMDc3ODE4LTI0LjUyOTQ1NSAxNi4yOTA5MDktMzIuNjI4MzY0IDE2LjI5MDkwOS0zMi42MjgzNjR2LTEwLjg5MTYzNmwtNS40NDU4MTggNS40NDU4MTh2LTEwLjg5MTYzNmw1LjM5OTI3My01LjQ0NTgxOHMtOS4wMjk4MTgtMTkuNDU2IDAtMjcuMjI5MDkxYzkuMDI5ODE4LTcuNzI2NTQ1IDEwLjg0NTA5MS0xMC44OTE2MzYgMTAuODQ1MDkxLTEwLjg5MTYzN2wtNS4zOTkyNzMtNS40NDU4MThzMTEuMTcwOTA5LTE2Ljk4OTA5MSAxOS4xMzAxODItMzMuMDQ3MjczYy0yLjUxMzQ1NSA1LjA3MzQ1NS0wLjYwNTA5MS0zMy4xODY5MDkgNzMuMDI5ODE4LTg2LjcxNDE4MXoiIGZpbGw9IiNGRkZGRkYiIHAtaWQ9IjQ0NzkiPjwvcGF0aD48L3N2Zz4=);\n}\n.bili-avatar-img.bili-avatar-img-error {\n  display: none;\n}\n.bili-avatar-right-icon {\n  width: 27.5%;\n  height: 27.5%;\n  position: absolute;\n  right: 0;\n  bottom: -1px;\n  background-size: cover;\n  image-rendering: -webkit-optimize-contrast;\n}\n.bili-avatar-nft-icon {\n  position: absolute;\n  width: 27.5%;\n  height: 27.5%;\n  right: -webkit-calc(27.5% - 1px);\n  right: -moz-calc(27.5% - 1px);\n  right: calc(27.5% - 1px);\n  bottom: -1px;\n  background-size: cover;\n  image-rendering: -webkit-optimize-contrast;\n}\n.bili-avatar-nft--icon--1 {\n  background-image: url('//i0.hdslb.com/bfs/activity-plat/static/20211216/df3e2ff90b315fca2f8d24a29cb68a47/tFsbCWMDtV.gif');\n}\n.bili-avatar-nft--icon--2 {\n  background-image: url('//i0.hdslb.com/bfs/activity-plat/static/20220524/df3e2ff90b315fca2f8d24a29cb68a47/yifE7khbb1.gif');\n}\n@-webkit-keyframes bili-avatar {\n  0% {\n    -webkit-transform: translate3d(0, 0, 0);\n            transform: translate3d(0, 0, 0);\n  }\n  100% {\n    -webkit-transform: translate3d(-97.5%, 0, 0);\n            transform: translate3d(-97.5%, 0, 0);\n  }\n}\n@-moz-keyframes bili-avatar {\n  0% {\n    -moz-transform: translate3d(0, 0, 0);\n         transform: translate3d(0, 0, 0);\n  }\n  100% {\n    -moz-transform: translate3d(-97.5%, 0, 0);\n         transform: translate3d(-97.5%, 0, 0);\n  }\n}\n@keyframes bili-avatar {\n  0% {\n    -webkit-transform: translate3d(0, 0, 0);\n       -moz-transform: translate3d(0, 0, 0);\n            transform: translate3d(0, 0, 0);\n  }\n  100% {\n    -webkit-transform: translate3d(-97.5%, 0, 0);\n       -moz-transform: translate3d(-97.5%, 0, 0);\n            transform: translate3d(-97.5%, 0, 0);\n  }\n}\n.bili-avatar .bili-avatar-size-80 {\n  width: 22px;\n  height: 22px;\n  bottom: -1px;\n}\n.bili-avatar .bili-avatar-size-60,\n.bili-avatar .bili-avatar-size-50,\n.bili-avatar .bili-avatar-size-48 {\n  width: 18px;\n  height: 18px;\n  bottom: -1px;\n}\n.bili-avatar .bili-avatar-size-40,\n.bili-avatar .bili-avatar-size-36 {\n  width: 14px;\n  height: 14px;\n  bottom: -1px;\n}\n.bili-avatar .bili-avatar-size-30,\n.bili-avatar .bili-avatar-size-24 {\n  width: 12px;\n  height: 12px;\n  bottom: -1px;\n}\n.bili-avatar .bili-avatar-size-nft-80 {\n  width: 22px;\n  height: 22px;\n  bottom: -1px;\n  right: -webkit-calc(22px - 1px);\n  right: -moz-calc(22px - 1px);\n  right: calc(22px - 1px);\n}\n.bili-avatar .bili-avatar-size-nft-60,\n.bili-avatar .bili-avatar-size-nft-50,\n.bili-avatar .bili-avatar-size-nft-48 {\n  width: 18px;\n  height: 18px;\n  bottom: -1px;\n  right: -webkit-calc(18px - 1px);\n  right: -moz-calc(18px - 1px);\n  right: calc(18px - 1px);\n}\n.bili-avatar .bili-avatar-size-nft-40,\n.bili-avatar .bili-avatar-size-nft-36 {\n  width: 14px;\n  height: 14px;\n  bottom: -1px;\n  right: -webkit-calc(14px - 1px);\n  right: -moz-calc(14px - 1px);\n  right: calc(14px - 1px);\n}\n.bili-avatar .bili-avatar-size-nft-30,\n.bili-avatar .bili-avatar-size-nft-24 {\n  width: 12px;\n  height: 12px;\n  bottom: -1px;\n  right: -webkit-calc(12px - 1px);\n  right: -moz-calc(12px - 1px);\n  right: calc(12px - 1px);\n}\n\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/emoji.less":
/*!*******************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/emoji.less ***!
  \*******************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../images/arrow.png */ "./static/images/arrow.png");
var ___CSS_LOADER_URL_IMPORT_1___ = __webpack_require__(/*! ../../images/left-arrow-disable.svg */ "./static/images/left-arrow-disable.svg");
var ___CSS_LOADER_URL_IMPORT_2___ = __webpack_require__(/*! ../../images/right-arrow-disable.svg */ "./static/images/right-arrow-disable.svg");
var ___CSS_LOADER_URL_IMPORT_3___ = __webpack_require__(/*! ../../images/left-arrow.svg */ "./static/images/left-arrow.svg");
var ___CSS_LOADER_URL_IMPORT_4___ = __webpack_require__(/*! ../../images/right-arrow.svg */ "./static/images/right-arrow.svg");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
var ___CSS_LOADER_URL_REPLACEMENT_1___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_1___);
var ___CSS_LOADER_URL_REPLACEMENT_2___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_2___);
var ___CSS_LOADER_URL_REPLACEMENT_3___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_3___);
var ___CSS_LOADER_URL_REPLACEMENT_4___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_4___);
// Module
exports.push([module.id, "/*Icon图标*/\n.emoji-box {\n  font-size: 12px;\n  font-family: \"Microsoft YaHei\", Arial, Helvetica, sans-serif;\n  color: var(--text1);\n  overflow: visible;\n  background: var(--bg1);\n  border: 1px solid var(--line_regular);\n  box-shadow: 0 11px 12px 0 rgba(106, 115, 133, 0.3);\n  border-radius: 8px;\n  margin-top: 7px;\n  margin-bottom: 10px;\n  width: 363px;\n  position: absolute;\n  top: 25px;\n  z-index: 103;\n}\n.emoji-box * {\n  box-sizing: content-box;\n}\n.emoji-box button {\n  box-sizing: border-box;\n}\n.emoji-box.bottom:before {\n  content: \"\";\n  display: block;\n  position: absolute;\n  top: -5px;\n  left: 30px;\n  width: 8px;\n  height: 5px;\n  background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") 0 -49px no-repeat;\n}\n.emoji-box.top:after {\n  content: \"\";\n  display: block;\n  position: absolute;\n  bottom: -5px;\n  left: 30px;\n  width: 8px;\n  height: 5px;\n  background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") 0 -16px no-repeat;\n}\n.emoji-box .emoji-title {\n  line-height: 16px;\n  margin: 13px 15px 0;\n  color: var(--text2);\n}\n.emoji-box .emoji-wrap {\n  margin: 6px 11px 0 11px;\n  height: 196px;\n  font-size: 0;\n  overflow: auto;\n  word-break: break-word;\n}\n.emoji-box .emoji-wrap::-webkit-scrollbar {\n  background-color: var(--bg1);\n  width: 8px;\n}\n.emoji-box .emoji-wrap::-webkit-scrollbar-thumb {\n  background: var(--Ga5);\n  border-radius: 5px;\n}\n.emoji-box .emoji-wrap img {\n  margin: 4px;\n  width: 56px;\n  height: 56px;\n  cursor: pointer;\n}\n.emoji-box .emoji-wrap .emoji-pic {\n  margin: 0;\n  padding: 0;\n  font-size: 0;\n}\n.emoji-box .emoji-wrap .emoji-small img {\n  margin: 4px;\n  width: 24px;\n  height: 24px;\n}\n.emoji-box .emoji-notice {\n  position: relative;\n  height: 24px;\n  line-height: 24px;\n  font-size: 13px;\n  color: var(--Ye5_u);\n  text-align: center;\n  display: none;\n}\n.emoji-box .emoji-notice::after {\n  content: '';\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  top: 0;\n  left: 0;\n  background-color: var(--Ye5_u);\n  opacity: 0.2;\n}\n.emoji-box .emoji-text {\n  color: var(--text2);\n  border-radius: 4px;\n  transition: background 0.2s;\n  display: inline-block;\n  padding: 3px 5px;\n  margin: 2px 3px;\n  outline: 0;\n  text-decoration: none;\n  cursor: pointer;\n}\n.emoji-box .emoji-text.emoji-default {\n  font-size: 12px;\n  line-height: 22px;\n}\n.emoji-box .emoji-text:hover {\n  background-color: var(--Ga2_t);\n}\n.emoji-box .emoji-tabs {\n  position: relative;\n  height: 36px;\n  overflow: hidden;\n  background-color: var(--Ga1_s);\n  border-radius: 0 0 4px 4px;\n}\n.emoji-box .emoji-tabs .emoji-container {\n  width: 290px;\n  overflow: hidden;\n}\n.emoji-box .emoji-tabs .emoji-tab-wrap {\n  position: relative;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider {\n  position: absolute;\n  right: 10px;\n  top: 12px;\n  width: 40px;\n  height: 36px;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider span {\n  float: left;\n  width: 16px;\n  height: 16px;\n  cursor: default;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider .prev {\n  background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ") no-repeat;\n  background-size: cover;\n  margin-right: 8px;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider .next {\n  background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n  background-size: cover;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider .prev.on {\n  background-image: url(" + ___CSS_LOADER_URL_REPLACEMENT_3___ + ");\n  cursor: pointer;\n}\n.emoji-box .emoji-tabs .emoji-tab-slider .next.on {\n  background-image: url(" + ___CSS_LOADER_URL_REPLACEMENT_4___ + ");\n  cursor: pointer;\n}\n.emoji-box .emoji-tabs .tab-link {\n  float: left;\n  padding: 7px 18px;\n  width: 22px;\n  height: 22px;\n}\n.emoji-box .emoji-tabs .tab-link {\n  cursor: pointer;\n}\n.emoji-box .emoji-tabs .tab-link.on {\n  background-color: var(--bg1);\n}\n.emoji-box .emoji-tabs .tab-link:hover {\n  background: var(--Ga2_t);\n}\n.emoji-box .emoji-tabs .tab-link img {\n  width: 22px;\n  height: 22px;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/message_box.less":
/*!*************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/message_box.less ***!
  \*************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, ".m-layer,\n.m_layer {\n  position: absolute;\n  clear: both;\n  overflow: hidden;\n  z-index: 999;\n  border-radius: 4px;\n  background-color: rgba(0, 0, 0, 0.8);\n  color: var(--text_white);\n  min-width: 100px;\n  max-width: 500px;\n  font-size: 14px;\n}\n.m-layer.scale-in,\n.m_layer.scale-in {\n  -webkit-animation: scale-in 0.2s linear;\n  animation: scale-in 0.2s linear;\n}\n.m-layer.m-error a,\n.m_layer.m-error a,\n.m-layer.m-warning a,\n.m_layer.m-warning a {\n  color: var(--text_white);\n  text-decoration: underline;\n}\n.m-layer.m-error.error,\n.m_layer.m-error.error,\n.m-layer.m-warning.error,\n.m_layer.m-warning.error {\n  background-color: #e40c0c;\n  font-size: 12px;\n}\n.m-layer.m-error.error .bg,\n.m_layer.m-error.error .bg,\n.m-layer.m-warning.error .bg,\n.m_layer.m-warning.error .bg {\n  padding: 0;\n}\n.m-layer.m-error.error .bg .content,\n.m_layer.m-error.error .bg .content,\n.m-layer.m-warning.error .bg .content,\n.m_layer.m-warning.error .bg .content {\n  border: none;\n  background-color: transparent;\n}\n.m-layer.m-error.error .bg .content .mini,\n.m_layer.m-error.error .bg .content .mini,\n.m-layer.m-warning.error .bg .content .mini,\n.m_layer.m-warning.error .bg .content .mini {\n  padding: 1px 10px 1px 5px;\n}\n.m-layer.m-error.error .content .mini i,\n.m_layer.m-error.error .content .mini i,\n.m-layer.m-warning.error .content .mini i,\n.m_layer.m-warning.error .content .mini i {\n  display: inline-block;\n  *display: inline;\n  *zoom: 1;\n  padding: 0;\n  vertical-align: top;\n  background: url('//static.hdslb.com/upload/img/icons.png') -312px -27px no-repeat;\n  width: 20px;\n  height: 20px;\n}\n.m-layer.m-button,\n.m_layer.m-button {\n  background-color: var(--bg1);\n  border: 1px solid var(--line_regular);\n  color: var(--text1);\n  box-shadow: rgba(0, 0, 0, 0.16) 0px 2px 4px;\n  font-size: 12px;\n}\n.m-layer.m-coin,\n.m_layer.m-coin {\n  max-width: 340px;\n  margin-left: -176px;\n  padding: 30px;\n}\n.m-layer.m-coin .coin-panel,\n.m_layer.m-coin .coin-panel {\n  width: 280px;\n}\n.m-layer.m-coin .coin-panel .coin-nav,\n.m_layer.m-coin .coin-panel .coin-nav {\n  text-align: center;\n  padding-bottom: 20px;\n}\n.m-layer.m-coin .coin-panel .coin-nav.coin-nav-less,\n.m_layer.m-coin .coin-panel .coin-nav.coin-nav-less {\n  margin: 0 -5px;\n}\n.m-layer.m-coin .coin-panel .coin-nav.coin-nav-less .coin-nav-single,\n.m_layer.m-coin .coin-panel .coin-nav.coin-nav-less .coin-nav-single {\n  margin: 0 5px;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single {\n  display: inline-block;\n  *display: inline;\n  *zoom: 1;\n  color: #636c72;\n  width: 36px;\n  cursor: pointer;\n  height: 36px;\n  line-height: 36px;\n  font-size: 14px;\n  margin: 0 10px;\n  border-radius: 36px;\n  border: 1px solid #ccd0d7;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single .coin-nav-text,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single .coin-nav-text {\n  font-size: 12px;\n  display: none;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.active,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.active {\n  color: var(--text_white);\n  border-color: #00a1d6;\n  background-color: #00a1d6;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.active:hover,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.active:hover {\n  color: var(--text_white);\n  border-color: #00a1d6;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.active .coin-nav-text,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.active .coin-nav-text {\n  display: inline;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single:hover,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single:hover {\n  color: #00a1d6;\n  border-color: #00a1d6;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled {\n  color: #6d757a;\n  background-color: #edf0f6;\n  border-color: #edf0f6;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled:hover,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled:hover {\n  color: #6d757a;\n  background-color: #edf0f6;\n  border-color: #acb3c2;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled.active,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled.active {\n  color: var(--text_white);\n  background-color: #acb3c2;\n  border-color: #acb3c2;\n}\n.m-layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled.active:hover,\n.m_layer.m-coin .coin-panel .coin-nav .coin-nav-single.disabled.active:hover {\n  color: var(--text_white);\n  background-color: #acb3c2;\n  border-color: #acb3c2;\n}\n.m-layer.m-coin .coin-panel .coin-main,\n.m_layer.m-coin .coin-panel .coin-main {\n  margin: 0px 0 36px 0;\n  padding-top: 34px;\n  border-top: 1px solid var(--line_regular);\n}\n.m-layer.m-coin .coin-panel .coin-main.coin-error,\n.m_layer.m-coin .coin-panel .coin-main.coin-error {\n  padding-top: 40px;\n  padding-left: 82px;\n  background: transparent url(/images/base/error.png) no-repeat 0px 37px;\n}\n.m-layer.m-coin .coin-panel .coin-main.coin-error .coin-main-title,\n.m_layer.m-coin .coin-panel .coin-main.coin-error .coin-main-title,\n.m-layer.m-coin .coin-panel .coin-main.coin-error .coin-main-sub,\n.m_layer.m-coin .coin-panel .coin-main.coin-error .coin-main-sub {\n  text-align: left;\n}\n.m-layer.m-coin .coin-panel .coin-main .coin-main-title,\n.m_layer.m-coin .coin-panel .coin-main .coin-main-title {\n  text-align: center;\n  color: #222222;\n  font-size: 20px;\n  line-height: 20px;\n}\n.m-layer.m-coin .coin-panel .coin-main .coin-main-title .coin-main-number,\n.m_layer.m-coin .coin-panel .coin-main .coin-main-title .coin-main-number {\n  color: #00a1d6;\n  font-size: 36px;\n  padding: 0 5px;\n  font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n  font-weight: 600;\n  -webkit-font-smoothing: antialiased;\n}\n@media (-webkit-max-device-pixel-ratio: 1) {\n  .m-layer.m-coin .coin-panel .coin-main .coin-main-title .coin-main-number,\n  .m_layer.m-coin .coin-panel .coin-main .coin-main-title .coin-main-number {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n.m-layer.m-coin .coin-panel .coin-main .coin-main-sub,\n.m_layer.m-coin .coin-panel .coin-main .coin-main-sub {\n  margin-top: 9px;\n  font-size: 12px;\n  line-height: 30px;\n  color: #6d757a;\n}\n.m-layer.m-coin .coin-panel .b-icon,\n.m_layer.m-coin .coin-panel .b-icon {\n  background: transparent url(/images/base/icons.png) no-repeat top left;\n  display: inline-block;\n  width: 24px;\n  height: 24px;\n  line-height: 24px;\n}\n.m-layer.m-coin .coin-panel .b-icon.icon-exp-round,\n.m_layer.m-coin .coin-panel .b-icon.icon-exp-round {\n  background-position: -659px -981px;\n}\n.m-layer.m-coin .coin-panel .b-icon.icon-coin-round,\n.m_layer.m-coin .coin-panel .b-icon.icon-coin-round {\n  background-position: -659px -1045px;\n}\n.m-layer.m-coin .bg .content .mini,\n.m_layer.m-coin .bg .content .mini {\n  padding: 0;\n}\n.m-layer.m-coin .bg .content .mini .btnbox .ok,\n.m_layer.m-coin .bg .content .mini .btnbox .ok,\n.m-layer.m-coin .bg .content .mini .btnbox .cancel,\n.m_layer.m-coin .bg .content .mini .btnbox .cancel {\n  width: 128px;\n  line-height: 30px;\n  height: 30px;\n  font-size: 14px;\n}\n.m-layer.m-coin .bg .content .mini .btnbox .ok.disabled,\n.m_layer.m-coin .bg .content .mini .btnbox .ok.disabled,\n.m-layer.m-coin .bg .content .mini .btnbox .cancel.disabled,\n.m_layer.m-coin .bg .content .mini .btnbox .cancel.disabled {\n  cursor: default;\n}\n.m-layer.m-loading,\n.m_layer.m-loading,\n.m-layer.m-finish,\n.m_layer.m-finish {\n  background-image: none;\n  font-size: 12px;\n}\n.m-layer.m-loading .bg .content .mini,\n.m_layer.m-loading .bg .content .mini,\n.m-layer.m-finish .bg .content .mini,\n.m_layer.m-finish .bg .content .mini {\n  padding: 5px 20px;\n}\n.m-layer .bg,\n.m_layer .bg {\n  padding: 0!important;\n}\n.m-layer .bg .content,\n.m_layer .bg .content {\n  position: relative;\n  border-radius: 4px;\n}\n.m-layer .bg .content .mini,\n.m_layer .bg .content .mini {\n  text-align: center;\n  padding: 10px 20px;\n  margin: 0!important;\n}\n.m-layer .bg .content .mini .msg-text,\n.m_layer .bg .content .mini .msg-text {\n  line-height: 20px;\n}\n.m-layer .bg .content .mini .btnbox,\n.m_layer .bg .content .mini .btnbox {\n  clear: both;\n  margin-top: 10px;\n}\n.m-layer .bg .content .mini .btnbox .b-btn,\n.m_layer .bg .content .mini .btnbox .b-btn,\n.m-layer .bg .content .mini .btnbox .b-btn-cancel,\n.m_layer .bg .content .mini .btnbox .b-btn-cancel {\n  display: inline-block;\n  *display: inline;\n  *zoom: 1;\n  vertical-align: top;\n  line-height: 20px;\n  height: 20px;\n  width: 40px;\n  cursor: pointer;\n}\n.m-layer .bg .content .mini .btnbox .button,\n.m_layer .bg .content .mini .btnbox .button {\n  padding: 4px 7px 6px 6px;\n  margin: 4px;\n}\n.m-layer .bg .content .mini .btnbox .ok,\n.m_layer .bg .content .mini .btnbox .ok {\n  margin-right: 20px;\n}\n.m-layer .bg .content .mini .minput,\n.m_layer .bg .content .mini .minput {\n  width: 40px;\n  text-align: center;\n  color: #99a2aa;\n  font-family: sisum;\n  font-size: 11px;\n  margin: 0 5px 0 2px;\n}\n.m-layer .bg .content i,\n.m_layer .bg .content i {\n  margin-right: 5px;\n  display: none;\n}\n.m-layer .bg .content .error,\n.m_layer .bg .content .error {\n  background-position: -50px -50px;\n}\n.m-layer .bg .content .ok,\n.m_layer .bg .content .ok {\n  background-position: 0 0;\n}\n.m-layer .bg .content .warning,\n.m_layer .bg .content .warning {\n  background-position: -50px -100px;\n}\n.m-layer .bg .content .question,\n.m_layer .bg .content .question {\n  background-position: -50px -150px;\n}\n.m-layer .bg .content .msg,\n.m_layer .bg .content .msg {\n  background-position: 0px -200px;\n}\n.m-layer .b-btn {\n  color: var(--text_white);\n  cursor: pointer;\n  text-align: center;\n  border-radius: 4px;\n  background-color: #00a1d6;\n  vertical-align: middle;\n  border: 1px solid #00a1d6;\n  transition: 0.1s;\n  transition-property: background-color, border, color;\n  -webkit-touch-callout: none;\n  -webkit-user-select: none;\n  -khtml-user-select: none;\n  -moz-user-select: none;\n  -ms-user-select: none;\n  user-select: none;\n}\n.m-layer .b-btn:hover {\n  background-color: #00b5e5;\n  border-color: #00b5e5;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/commment-box.less":
/*!**************************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/commment-box.less ***!
  \**************************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, "@font-face {\n  font-family: 'fanscard';\n  src: url('//s1.hdslb.com/bfs/static/jinkela/mall-h5/asserts/fansCard.ttf');\n}\nbody.preventScroll {\n  height: 100%;\n  overflow: hidden;\n}\n@media screen and (max-width: 1440px) {\n  .bb-comment,\n  .comment-bilibili-fold {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 400;\n    -webkit-font-smoothing: antialiased;\n    min-height: 100px;\n    zoom: 1;\n    background: var(--bg1);\n    font-size: 0;\n  }\n  .bb-comment *,\n  .comment-bilibili-fold * {\n    box-sizing: content-box;\n  }\n  .bb-comment ::-moz-placeholder,\n  .comment-bilibili-fold ::-moz-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment ::-webkit-input-placeholder,\n  .comment-bilibili-fold ::-webkit-input-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment :-ms-input-placeholder,\n  .comment-bilibili-fold :-ms-input-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment button,\n  .comment-bilibili-fold button {\n    box-sizing: border-box;\n  }\n  .bb-comment p,\n  .comment-bilibili-fold p {\n    margin: 0;\n    padding: 0;\n  }\n  .bb-comment ul,\n  .comment-bilibili-fold ul,\n  .bb-comment li,\n  .comment-bilibili-fold li {\n    margin: 0;\n    padding: 0;\n    list-style: none;\n  }\n  .bb-comment *.clearfix,\n  .comment-bilibili-fold *.clearfix {\n    zoom: 1;\n  }\n  .bb-comment .clearfix:after,\n  .comment-bilibili-fold .clearfix:after {\n    content: \"\";\n    display: block;\n    visibility: hidden;\n    height: 0;\n    clear: both;\n    font-size: 0;\n  }\n  .bb-comment img,\n  .comment-bilibili-fold img {\n    border: none;\n    vertical-align: middle;\n  }\n  .bb-comment a,\n  .comment-bilibili-fold a {\n    outline: none;\n    color: var(--text_link);\n    text-decoration: none;\n    cursor: pointer;\n  }\n  .bb-comment a:hover,\n  .comment-bilibili-fold a:hover {\n    color: var(--brand_blue);\n  }\n  .bb-comment a:focus,\n  .comment-bilibili-fold a:focus {\n    -moz-outline-style: none;\n  }\n  .bb-comment textarea,\n  .comment-bilibili-fold textarea {\n    outline: none;\n    resize: none;\n  }\n  .bb-comment .loading-state,\n  .comment-bilibili-fold .loading-state {\n    height: 64px;\n    line-height: 64px;\n    font-size: 12px;\n    color: var(--text3);\n    text-align: center;\n    margin-bottom: 80px;\n  }\n  .bb-comment .comment-loading,\n  .comment-bilibili-fold .comment-loading {\n    text-align: center;\n    height: 20px;\n    color: var(--text3);\n    padding-bottom: 40px;\n    font-size: 12px;\n  }\n}\n@media screen and (max-width: 1440px) and (-webkit-max-device-pixel-ratio: 1) {\n  .bb-comment,\n  .comment-bilibili-fold {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1441px) {\n  .bb-comment,\n  .comment-bilibili-fold {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 400;\n    -webkit-font-smoothing: antialiased;\n    min-height: 100px;\n    zoom: 1;\n    background: var(--bg1);\n    font-size: 0;\n  }\n  .bb-comment *,\n  .comment-bilibili-fold * {\n    box-sizing: content-box;\n  }\n  .bb-comment ::-moz-placeholder,\n  .comment-bilibili-fold ::-moz-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment ::-webkit-input-placeholder,\n  .comment-bilibili-fold ::-webkit-input-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment :-ms-input-placeholder,\n  .comment-bilibili-fold :-ms-input-placeholder {\n    color: var(--text3);\n  }\n  .bb-comment button,\n  .comment-bilibili-fold button {\n    box-sizing: border-box;\n  }\n  .bb-comment p,\n  .comment-bilibili-fold p {\n    margin: 0;\n    padding: 0;\n  }\n  .bb-comment ul,\n  .comment-bilibili-fold ul,\n  .bb-comment li,\n  .comment-bilibili-fold li {\n    margin: 0;\n    padding: 0;\n    list-style: none;\n  }\n  .bb-comment *.clearfix,\n  .comment-bilibili-fold *.clearfix {\n    zoom: 1;\n  }\n  .bb-comment .clearfix:after,\n  .comment-bilibili-fold .clearfix:after {\n    content: \"\";\n    display: block;\n    visibility: hidden;\n    height: 0;\n    clear: both;\n    font-size: 0;\n  }\n  .bb-comment img,\n  .comment-bilibili-fold img {\n    border: none;\n    vertical-align: middle;\n  }\n  .bb-comment a,\n  .comment-bilibili-fold a {\n    outline: none;\n    color: var(--text_link);\n    text-decoration: none;\n    cursor: pointer;\n  }\n  .bb-comment a:hover,\n  .comment-bilibili-fold a:hover {\n    color: var(--brand_blue);\n  }\n  .bb-comment a:focus,\n  .comment-bilibili-fold a:focus {\n    -moz-outline-style: none;\n  }\n  .bb-comment textarea,\n  .comment-bilibili-fold textarea {\n    outline: none;\n    resize: none;\n  }\n  .bb-comment .loading-state,\n  .comment-bilibili-fold .loading-state {\n    height: 64px;\n    line-height: 64px;\n    font-size: 12px;\n    color: var(--text3);\n    text-align: center;\n    margin-bottom: 80px;\n  }\n  .bb-comment .comment-loading,\n  .comment-bilibili-fold .comment-loading {\n    text-align: center;\n    height: 20px;\n    color: var(--text3);\n    padding-bottom: 40px;\n    font-size: 12px;\n  }\n}\n@media screen and (min-width: 1441px) and (-webkit-max-device-pixel-ratio: 1) {\n  .bb-comment,\n  .comment-bilibili-fold {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/header.less":
/*!********************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/header.less ***!
  \********************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../../images/icons-comment.png */ "./static/images/icons-comment.png");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
// Module
exports.push([module.id, "@media screen and (max-width: 1681px) {\n  .reply-notice .notice-item {\n    display: flex;\n    align-items: center;\n    padding: 0 25px 0 9px;\n    color: var(--Ye5_u);\n    font-size: 13px;\n    border-radius: 2px;\n    position: relative;\n  }\n  .reply-notice .notice-item::after {\n    content: '';\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    top: 0;\n    left: 0;\n    background-color: var(--Ye5_u);\n    opacity: 0.2;\n  }\n  .reply-notice .notice-item a {\n    color: var(--Ye5_u);\n    vertical-align: top;\n    word-wrap: break-word;\n    word-break: break-all;\n  }\n  .reply-notice .notice-item .icon-notice {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ");\n    background-position: -280px -24px;\n    display: inline-block;\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n  }\n  .reply-notice .notice-item .icon-close-notice {\n    position: absolute;\n    right: 8px;\n    display: inline-block;\n    width: 20px;\n    height: 20px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ");\n    background-position: -278px -86px;\n    cursor: pointer;\n    z-index: 2;\n  }\n  .comment-header {\n    margin: 0 0 22px 0;\n  }\n  .comment-header .tabs-order {\n    float: left;\n    margin-bottom: -1px;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .tabs-order .clearfix {\n    display: flex;\n    align-items: center;\n  }\n  .comment-header .tabs-order .clearfix li {\n    position: relative;\n    float: left;\n    border: 0;\n    border-radius: 0;\n    background-color: transparent;\n    cursor: pointer;\n    line-height: 22px;\n    height: 22px;\n    vertical-align: middle;\n    color: var(--text2);\n  }\n  .comment-header .tabs-order .clearfix li.default-sort {\n    display: block !important;\n    height: 34px;\n    margin-right: 6px;\n    line-height: 34px;\n    color: var(--text1);\n    pointer-events: none;\n    font-weight: 500;\n  }\n  .comment-header .tabs-order .clearfix li.total-reply {\n    height: 20px;\n    margin-right: 36px;\n    line-height: 20px;\n    pointer-events: none;\n  }\n  .comment-header .tabs-order .clearfix li.part-symbol {\n    height: 11px;\n    margin: 0 12px;\n    border-right: solid 1px var(--text3);\n    pointer-events: none;\n  }\n  .comment-header .tabs-order .clearfix li.up-spot {\n    position: absolute;\n    right: 0;\n  }\n  .comment-header .tabs-order .clearfix li:hover {\n    color: var(--brand_blue);\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .tabs-order .clearfix li.on {\n    color: var(--text1);\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .header-interaction {\n    float: right;\n    line-height: 36px;\n  }\n  .comment-header .tabs-order .clearfix .default-sort {\n    font-size: 20px;\n  }\n  .comment-header .tabs-order .clearfix .total-reply {\n    font-size: 13px;\n  }\n  .comment-header .tabs-order .clearfix .hot-sort,\n  .comment-header .tabs-order .clearfix .new-sort {\n    font-size: 13px;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-header .tabs-order .clearfix li:hover {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-header .tabs-order .clearfix li.on {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) {\n  .reply-notice .notice-item {\n    display: flex;\n    align-items: center;\n    padding: 0 25px 0 9px;\n    color: var(--Ye5_u);\n    font-size: 13px;\n    border-radius: 2px;\n    position: relative;\n  }\n  .reply-notice .notice-item::after {\n    content: '';\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    top: 0;\n    left: 0;\n    background-color: var(--Ye5_u);\n    opacity: 0.2;\n  }\n  .reply-notice .notice-item a {\n    color: var(--Ye5_u);\n    vertical-align: top;\n    word-wrap: break-word;\n    word-break: break-all;\n  }\n  .reply-notice .notice-item .icon-notice {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ");\n    background-position: -280px -24px;\n    display: inline-block;\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n  }\n  .reply-notice .notice-item .icon-close-notice {\n    position: absolute;\n    right: 8px;\n    display: inline-block;\n    width: 20px;\n    height: 20px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ");\n    background-position: -278px -86px;\n    cursor: pointer;\n    z-index: 2;\n  }\n  .comment-header {\n    margin: 0 0 22px 0;\n  }\n  .comment-header .tabs-order {\n    float: left;\n    margin-bottom: -1px;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .tabs-order .clearfix {\n    display: flex;\n    align-items: center;\n  }\n  .comment-header .tabs-order .clearfix li {\n    position: relative;\n    float: left;\n    border: 0;\n    border-radius: 0;\n    background-color: transparent;\n    cursor: pointer;\n    line-height: 22px;\n    height: 22px;\n    vertical-align: middle;\n    color: var(--text2);\n  }\n  .comment-header .tabs-order .clearfix li.default-sort {\n    display: block !important;\n    height: 34px;\n    margin-right: 6px;\n    line-height: 34px;\n    color: var(--text1);\n    pointer-events: none;\n    font-weight: 500;\n  }\n  .comment-header .tabs-order .clearfix li.total-reply {\n    height: 20px;\n    margin-right: 36px;\n    line-height: 20px;\n    pointer-events: none;\n  }\n  .comment-header .tabs-order .clearfix li.part-symbol {\n    height: 11px;\n    margin: 0 12px;\n    border-right: solid 1px var(--text3);\n    pointer-events: none;\n  }\n  .comment-header .tabs-order .clearfix li.up-spot {\n    position: absolute;\n    right: 0;\n  }\n  .comment-header .tabs-order .clearfix li:hover {\n    color: var(--brand_blue);\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .tabs-order .clearfix li.on {\n    color: var(--text1);\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n  }\n  .comment-header .header-interaction {\n    float: right;\n    line-height: 36px;\n  }\n  .comment-header .tabs-order .clearfix .default-sort {\n    font-size: 24px;\n  }\n  .comment-header .tabs-order .clearfix .total-reply {\n    font-size: 14px;\n  }\n  .comment-header .tabs-order .clearfix .hot-sort,\n  .comment-header .tabs-order .clearfix .new-sort {\n    font-size: 16px;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-header .tabs-order .clearfix li:hover {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-header .tabs-order .clearfix li.on {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/modal.less":
/*!*******************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/modal.less ***!
  \*******************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, ".comment-msg {\n  position: fixed;\n  top: 200px;\n  height: 1px;\n  z-index: 9999;\n  text-align: center;\n  width: 100%;\n}\n.comment-msg span {\n  display: inline-block;\n  background-color: rgba(0, 0, 0, 0.8);\n  color: var(--text_white);\n  border-radius: 4px;\n  font-size: 14px;\n  padding: 10px 20px;\n}\n.comment-bilibili-mask {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  background: rgba(0, 0, 0, 0.3);\n  z-index: 10000;\n}\n.comment-bilibili-con {\n  position: fixed;\n  top: 50%;\n  left: 50%;\n  margin-left: -245px;\n  margin-top: -300px;\n  background: var(--bg1);\n  width: 490px;\n  border-radius: 4px;\n}\n@media (max-width: 768px) {\n  .comment-bilibili-con {\n    width: 90%;\n    margin-left: 0;\n    position: fixed;\n    left: 5%;\n    top: 50%;\n    transform: translateY(-50%);\n    margin-top: 0;\n  }\n}\n.comment-bilibili-con .vote-iframe iframe {\n  width: 100%;\n  height: 500px;\n}\n.comment-bilibili-con .t {\n  text-align: center;\n  font-size: 18px;\n  color: var(--text1);\n  padding: 20px;\n  border-bottom: 1px solid var(--line_regular);\n}\n.comment-bilibili-con .t.no-title {\n  padding: 0;\n  border-bottom: none;\n}\n.comment-bilibili-con .t .btn-close {\n  position: absolute;\n  width: 12px;\n  height: 12px;\n  right: 20px;\n  top: 20px;\n  overflow: hidden;\n  cursor: pointer;\n  transition: all 0.3s;\n}\n.comment-bilibili-con .t .btn-close:before {\n  content: '';\n  position: absolute;\n  height: 1px;\n  width: 100%;\n  top: 50%;\n  left: 0;\n  margin-top: -1px;\n  background: var(--text3);\n  transform: rotate(45deg);\n  -ms-transform: rotate(45deg);\n}\n.comment-bilibili-con .t .btn-close:after {\n  content: '';\n  position: absolute;\n  height: 1px;\n  width: 100%;\n  top: 50%;\n  left: 0;\n  margin-top: -1px;\n  background: var(--text3);\n  transform: rotate(-45deg);\n  -ms-transform: rotate(-45deg);\n}\n.comment-bilibili-con .t .btn-close:hover:before,\n.comment-bilibili-con .t .btn-close:hover:after {\n  background: var(--text2);\n}\n.comment-bilibili-con .con {\n  padding: 20px;\n}\n.comment-bilibili-con .con input[type='radio'] {\n  display: none;\n  position: absolute;\n}\n.comment-bilibili-con .con input[type='radio']:checked + label:after {\n  opacity: 1;\n}\n.comment-bilibili-con .con input[type='radio']:checked + label:before {\n  border-color: var(--brand_blue);\n}\n.comment-bilibili-con .con .text {\n  text-align: center;\n  font-size: 14px;\n  line-height: 24px;\n  padding: 20px 0;\n  color: var(--text1);\n}\n.comment-bilibili-con .con label {\n  position: relative;\n  display: block;\n  padding-left: 22px;\n  cursor: pointer;\n  vertical-align: middle;\n}\n.comment-bilibili-con .con label:before {\n  position: absolute;\n  top: 0;\n  left: 0;\n  display: inline-block;\n  width: 14px;\n  height: 14px;\n  content: '';\n  border-radius: 50%;\n  border: 1px solid var(--text4);\n  transition: all 0.3s;\n}\n.comment-bilibili-con .con label:after {\n  position: absolute;\n  opacity: 0;\n  content: '';\n  top: 4px;\n  left: 4px;\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: var(--brand_blue);\n  transition: all 0.3s;\n}\n.comment-bilibili-con .reason-box {\n  font-size: 12px;\n}\n.comment-bilibili-con .reason-box dl {\n  margin-bottom: 15px;\n}\n.comment-bilibili-con .reason-box dl dt {\n  color: var(--text3);\n  margin-bottom: 15px;\n}\n.comment-bilibili-con .reason-box dl dd {\n  color: var(--text1);\n  display: inline-block;\n  width: 100px;\n  margin: 0 10px 16px 0;\n  white-space: nowrap;\n}\n.comment-bilibili-con .reason-box dl dd input {\n  width: 14px;\n  height: 14px;\n  border-radius: 50%;\n  border: 1px solid var(--text4);\n}\n.comment-bilibili-con .other {\n  font-size: 12px;\n}\n.comment-bilibili-con .other p {\n  -webkit-margin-before: 0;\n  -webkit-margin-after: 0;\n  margin-bottom: 8px;\n}\n.comment-bilibili-con .other .ta {\n  display: none;\n}\n.comment-bilibili-con .other .ta textarea {\n  width: 96%;\n  border-width: 1px;\n  border-style: solid;\n  border-color: var(--line_regular);\n  border-radius: 4px;\n  resize: none;\n  outline: none;\n  transition: all 0.3s;\n  padding: 8px;\n  height: 52px;\n}\n.comment-bilibili-con .other .ta textarea:hover {\n  border-color: var(--graph_medium);\n}\n.comment-bilibili-con .other .ta textarea:focus {\n  border-color: var(--brand_blue);\n}\n.comment-bilibili-con .btn {\n  text-align: center;\n}\n.comment-bilibili-con .btn .btn-submit {\n  text-decoration: none;\n  display: inline-block;\n  width: 120px;\n  height: 40px;\n  line-height: 40px;\n  color: var(--text_white);\n  font-size: 14px;\n  background: var(--brand_blue);\n  border: 1px solid var(--brand_blue);\n  border-radius: 4px;\n  margin: 30px 0 10px 0;\n  cursor: pointer;\n  transition: all 0.3s;\n}\n.comment-bilibili-con .btn .btn-submit:hover {\n  background: #00b5e5;\n  border-color: #00b5e5;\n}\n.comment-bilibili-con .btn .btn-cancel {\n  display: inline-block;\n  width: 120px;\n  height: 40px;\n  line-height: 40px;\n  color: var(--text1);\n  font-size: 14px;\n  background: var(--bg1);\n  border: 1px solid var(--line_regular);\n  border-radius: 4px;\n  margin: 30px 0 10px 0;\n  cursor: pointer;\n  transition: all 0.3s;\n  margin-right: 20px;\n}\n.comment-bilibili-con .btn .btn-cancel:hover {\n  background: var(--line_regular);\n}\n.comment-bilibili-con.comment-vote-bilibili {\n  width: 600px;\n  margin-left: -300px;\n}\n.comment-bilibili-con.comment-rename-bilibili {\n  margin-top: -150px;\n  width: 380px;\n  margin-left: -190px;\n}\n.comment-bilibili-con.comment-rename-bilibili .con {\n  width: 280px;\n  margin: 20px auto;\n}\n.comment-bilibili-con.comment-rename-bilibili .text {\n  padding: 10px 0 30px 0;\n  font-size: 16px;\n  text-align: left;\n}\n.comment-bilibili-con.comment-rename-bilibili .rename-input {\n  width: 100%;\n  height: 40px;\n  border: 1px solid var(--line_regular);\n  border-radius: 4px;\n  padding: 0 10px;\n  box-sizing: border-box;\n}\n.comment-bilibili-con.comment-rename-bilibili .rename-input.err {\n  border-color: var(--stress_red);\n}\n.comment-bilibili-con.comment-rename-bilibili .rename-input:focus {\n  border-color: var(--brand_blue);\n}\n.comment-bilibili-con.comment-rename-bilibili .err-info {\n  margin-top: 4px;\n  font-size: 12px;\n  color: var(--stress_red);\n}\n.comment-bilibili-con.comment-rename-bilibili .err-info svg {\n  width: 15px;\n  height: 15px;\n  margin-right: 5px;\n  vertical-align: middle;\n  display: none;\n}\n.comment-bilibili-con.comment-rename-bilibili .btn-submit {\n  margin-top: 23px;\n}\n.comment-bilibili-con.comment-rename-bilibili .btn-cancel {\n  margin-top: 23px;\n  margin-right: 32px;\n}\n.comment-bilibili-con.comment-fold-bilibili,\n.comment-bilibili-con.comment-sub-fold-bilibili {\n  width: 594px;\n  margin-left: -297px;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-emoji,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-emoji {\n  display: none;\n}\n.comment-bilibili-con.comment-fold-bilibili .t,\n.comment-bilibili-con.comment-sub-fold-bilibili .t {\n  padding: 12px 0;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area {\n  height: 509px;\n  overflow: auto;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .comment-list,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .comment-list {\n  padding-top: 0;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .sub-fold-tip,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .sub-fold-tip {\n  font-size: 14px;\n  color: var(--text1);\n  margin: 12px 20px 2px;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .sub-fold-item:first-child > .con,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .sub-fold-item:first-child > .con {\n  border-top: none;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item {\n  padding: 0 16px 0 35px;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item:first-child > .con,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item:first-child > .con,\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item.no-border > .con,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item.no-border > .con {\n  border-top: none;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item > .con .text,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item > .con .text {\n  text-align: left;\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item.top-fold-reply,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item.top-fold-reply {\n  border-bottom: 10px solid var(--line_regular);\n}\n.comment-bilibili-con.comment-fold-bilibili .comment-area .list-item .nameplate:hover .nameplate-card,\n.comment-bilibili-con.comment-sub-fold-bilibili .comment-area .list-item .nameplate:hover .nameplate-card {\n  display: none;\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/pagination.less":
/*!************************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/pagination.less ***!
  \************************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, ".bottom-page {\n  margin: 20px 0;\n}\n.bottom-page.center {\n  text-align: center;\n  font-size: 14px;\n  color: var(--text3);\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v1.less":
/*!**********************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v1.less ***!
  \**********************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../../images/ic_like.svg */ "./static/images/ic_like.svg");
var ___CSS_LOADER_URL_IMPORT_1___ = __webpack_require__(/*! ../../../images/ic_like_hover.svg */ "./static/images/ic_like_hover.svg");
var ___CSS_LOADER_URL_IMPORT_2___ = __webpack_require__(/*! ../../../images/ic_like_clicked.svg */ "./static/images/ic_like_clicked.svg");
var ___CSS_LOADER_URL_IMPORT_3___ = __webpack_require__(/*! ../../../images/ic_hate.svg */ "./static/images/ic_hate.svg");
var ___CSS_LOADER_URL_IMPORT_4___ = __webpack_require__(/*! ../../../images/ic_hate_hover.svg */ "./static/images/ic_hate_hover.svg");
var ___CSS_LOADER_URL_IMPORT_5___ = __webpack_require__(/*! ../../../images/ic_hate_clicked.svg */ "./static/images/ic_hate_clicked.svg");
var ___CSS_LOADER_URL_IMPORT_6___ = __webpack_require__(/*! ../../../images/user-auth.png */ "./static/images/user-auth.png");
var ___CSS_LOADER_URL_IMPORT_7___ = __webpack_require__(/*! ../../../images/ic_spot.svg */ "./static/images/ic_spot.svg");
var ___CSS_LOADER_URL_IMPORT_8___ = __webpack_require__(/*! ../../../images/ic_spot_hover.svg */ "./static/images/ic_spot_hover.svg");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
var ___CSS_LOADER_URL_REPLACEMENT_1___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_1___);
var ___CSS_LOADER_URL_REPLACEMENT_2___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_2___);
var ___CSS_LOADER_URL_REPLACEMENT_3___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_3___);
var ___CSS_LOADER_URL_REPLACEMENT_4___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_4___);
var ___CSS_LOADER_URL_REPLACEMENT_5___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_5___);
var ___CSS_LOADER_URL_REPLACEMENT_6___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_6___);
var ___CSS_LOADER_URL_REPLACEMENT_7___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_7___);
var ___CSS_LOADER_URL_REPLACEMENT_8___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_8___);
// Module
exports.push([module.id, "@media screen and (max-width: 1681px) {\n  .comment-list .quote {\n    margin: 16px auto;\n    background: #f4f5f7;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    padding: 10px;\n    overflow: auto;\n  }\n  .comment-list .list-item .user-face {\n    position: absolute;\n    margin-top: 24px;\n  }\n  .comment-list .list-item .user-face .bili-avatar .bili-avatar-img-radius {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .user-face .blacklist-face {\n    width: 48px;\n    height: 48px;\n    border-radius: 24px;\n  }\n  .comment-list .list-item .con {\n    position: relative;\n    padding: 22px 0 14px 0;\n    border-top: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .con .text {\n    position: relative;\n    z-index: 2;\n  }\n  .comment-list .list-item .con .user {\n    display: flex;\n    align-items: center;\n    margin-bottom: 2px;\n  }\n  .comment-list .list-item .con .perfect-reply {\n    position: absolute;\n    top: 22px;\n    right: 0;\n  }\n  .comment-list .list-item .con .perfect-reply .perfact-reply-bg {\n    width: 60px;\n    height: 60px;\n  }\n  .comment-list .list-item .con .hidden-reply-toggle {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .quote {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-wrap {\n    width: 100%;\n  }\n  .comment-list .list-item .con .vote-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .vote-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .vote-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIyLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMjggMjkiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4IDI5OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cjx0aXRsZT5Hcm91cCAyPC90aXRsZT4KPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CjxnIGlkPSJQYWdlLTEiIHN0eWxlPSJmaWxsOiMwMEExRDYiPgoJPGcgaWQ9IuWwgemdoiI+CgkJPGcgaWQ9Ikdyb3VwLTIiPgoJCQk8ZyBpZD0iUmVjdGFuZ2xlLTUiPgoJCQkJPHBhdGggZD0iTTMuMywyOC4zQzEuNSwyOC4zLDAsMjYuOSwwLDI1VjEwLjFjMC0xLjgsMS41LTMuMywzLjMtMy4zczMuMywxLjUsMy4zLDMuM1YyNUM2LjcsMjYuOSw1LjIsMjguMywzLjMsMjguM3ogTTMuMyw4CgkJCQkJYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMVYxMC4xQzUuNSw4LjksNC41LDgsMy4zLDh6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzFfIj4KCQkJCTxwYXRoIGQ9Ik0xNCwyOC40Yy0xLjgsMC0zLjMtMS41LTMuMy0zLjNWMy4zQzEwLjcsMS41LDEyLjIsMCwxNCwwczMuMywxLjUsMy4zLDMuM1YyNUMxNy4zLDI2LjksMTUuOCwyOC40LDE0LDI4LjR6IE0xNCwxLjIKCQkJCQljLTEuMiwwLTIuMSwxLTIuMSwyLjFWMjVjMCwxLjIsMSwyLjEsMi4xLDIuMWMxLjIsMCwyLjEtMSwyLjEtMi4xVjMuM0MxNi4xLDIuMiwxNS4yLDEuMiwxNCwxLjJ6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzJfIj4KCQkJCTxwYXRoIGQ9Ik0yNC43LDI4LjRjLTEuOCwwLTMuMy0xLjUtMy4zLTMuM3YtNi44YzAtMS44LDEuNS0zLjMsMy4zLTMuM3MzLjMsMS41LDMuMywzLjNWMjVDMjgsMjYuOSwyNi41LDI4LjQsMjQuNywyOC40egoJCQkJCSBNMjQuNywxNi4xYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMXYtNi44QzI2LjgsMTcsMjUuOCwxNi4xLDI0LjcsMTYuMXoiLz4KCQkJPC9nPgoJCTwvZz4KCTwvZz4KPC9nPgo8L3N2Zz4K\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .vote-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box .vote-btn {\n    width: 54px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .vote-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item .con .lottery-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .lottery-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .lottery-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAABSNJREFUaAXtWW9oW1UUv+e9l6wd1tlZlQ4myloR/LPaRMWBbE6miFWbutR2ggyHuDmX1q+DYUHED0PXLOroQCaIThtiC/ObykSEyZa0dt2sIP7Z0E07aJmZTdq+d4/nvvQlMbsvyUtahvPdD7nnnXv+/c659757Xxhzm5uB/3cGYDHgB96euJ4Zc42aF6ejO1p+t7P5/Hs/1CX/nlmtemDm9u0tZ/sAuJ1sufyqAGwOj64zGO9HxHsth2TwZwC259Me/0cWL/hOoknXWYQx3ITIVMEHBpMMcJ/W6Nsb7QTDknXaVwygI5zoo2D2IENF6hQg1nJ3a9fY+MgzBPAgQ7ZcJkdgj2ugtEVDrRdk46V4FQEI9CfaKPAjwjgF8Bulc68K6kmD81sJ1EuUab/pGJQIMP4C8WroOamQHIByjCNrIJlnCVhbRg5iwz2+zSbt8McxgODgaa9+LvUrMtZI02BCq8UHoi/6L1p++46iNnZyZJCCCxA8muOoEMiLCMw3HPL/ZMmJPrA/8Tpy3C1oVYEnYyGfmRTxXG6Tl7+INp6ffVAEL0RQwd784AWv7yHQmVfbTuDM4AUPkL1WGLzgr72r9VWq3llBU1U6Re+0OQagM1xjOgHAG5exb2QOh3asnUTAM7kx9escnaNMsAjHFjhNuZHyKccAACBtmkeEab32WltXwC5ZY1wxpixa0l8neDTlMnYlAsVYjgFowEctg4Y+G7ToSvquyMgqCn2d0KV1MlKJDccAorv84+TsqHDGEd9o3x9/pBLH3f3jN6U5fky6dWQvrXk8ByuxU3QXCg6iWj+dWFZoOMnYzek0nKCyX7MwRmsBviNjqaws4DbaPleaz4AfACp/LNBA74Q1CLCB5k294NH2uruhhoXN8byfOW+SH9q6YZamLe0b8iYFEByIr5hPs3cBocv2RSW3t+hcCv4CAd051OuPyoxLp5CeYgcoS1uudPAiYKryDbTVHg6ET9wpA6AVMsW0mT8/0kWatLBgUFHxLdrwHZ9V6CXgR4MfEPYB1HZFQdtDXmEM1jPNm1Wc4/sEop7e4E8R/5Q1ZvWXARBzfpJiFwII6puxl1uOW8JO+kAkkd1iEYxTsV3/fguXaysQTnxOQDopC6tlOtIplBVEw3Hms7qLRSCaMVAVpOtVBmA+6xvgMTvFrMwSEt0D8QaaC/cJF6Ao0tOqFFV7f/xb0rnfVATIARKMMhttAGK7NKcoraXKbJh3h8xxXVWUTbFQ6xeF7i9bA0IANO05ZuhHaB3fRhXwFCo5fa7KBr0DKBP7ZMGbsdoFs/XQLzXJS1PrOWcRCqCZFpE42/xpJy/h19JORkcFagBn6Fc36VI/iOLGdosphiwMXhgY2umbsFOTTqF8YdoFviIA60nwML1MtuSPFaNpF9qIBn5pyiisSXaclul3DMQbeYqdE2N0JH9iqNf3mUzO4skWsTX2n+hdAFe6TG4F3ApUmQF3ClWZwKrV3QpUncIqDbgVqDKBVatf/RWg+2jmGAwgPpEveVPnPDk/UPoILr3Q5EcJiKcJxMN0w3qU/hd4BdTMUTdfRkZzhndYfDqKP94RSZS8SyAH0A2929LTGH5v0XZ9yfvA0+HRZo7GGIGotTOyNHz4ZLjX11XKdsk1EOu550dQYCN9vxSfV8q7VZXyWmScMjpFN5lI3UptWxGx7FDJCmQliRD/zrDpVFmVmDG8ioZp89spLPckPXMGFbF4886uwA9DzX8Vl3JH3Qy4GbiqMvAPcV29qtEhK+0AAAAASUVORK5CYII=\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .lottery-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box .lottery-btn {\n    width: 70px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .lottery-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item:last-child .con {\n    border-bottom: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .no-border {\n    border-top: none;\n  }\n  .comment-list .list-item .user {\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n    display: block;\n    word-wrap: break-word;\n    position: relative;\n    margin-bottom: 5px;\n  }\n  .comment-list .list-item .user .name {\n    color: var(--text2);\n  }\n  .comment-list .list-item .user .level-link {\n    position: relative;\n    display: inline-flex;\n    margin-left: 5px;\n    vertical-align: middle;\n  }\n  .comment-list .list-item .user .gap {\n    margin-right: 20px;\n  }\n  .comment-list .list-item .user .level {\n    position: relative;\n    display: inline-block;\n    width: 22px;\n    height: 22px;\n  }\n  .comment-list .list-item .user .level.senior {\n    width: 30px;\n  }\n  .comment-list .list-item .user > a {\n    vertical-align: bottom;\n  }\n  .comment-list .list-item .user .name:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .user .text-con {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 400;\n    -webkit-font-smoothing: antialiased;\n    color: var(--text1);\n    margin-left: 9px;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n  }\n  .comment-list .list-item .contractor-box {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: relative;\n    height: 8px;\n    padding: 2px;\n    margin-left: 8px;\n    border-radius: 2px;\n    color: var(--brand_pink);\n    background-color: var(--brand_pink_thin);\n  }\n  .comment-list .list-item .contractor-box .contractor-text {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: absolute;\n    font-size: 16px;\n    white-space: nowrap;\n    transform-origin: center center;\n    transform: scale(0.5);\n  }\n  .comment-list .list-item .identity {\n    display: inline-block;\n    width: 34px;\n    height: 18px;\n    background: var(--brand_pink);\n    border-radius: 2px;\n    text-align: center;\n    line-height: 18px;\n    font-style: normal;\n    color: var(--text_white);\n    margin-right: 5px;\n    font-weight: 400;\n  }\n  .comment-list .list-item .identity.true-love {\n    background: #f25d8e;\n  }\n  .comment-list .list-item .text {\n    text-shadow: none;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n    margin-bottom: 5px;\n    color: var(--text1);\n  }\n  .comment-list .list-item .text img,\n  .comment-list .list-item .text-con img {\n    vertical-align: text-bottom;\n    padding: 0 1px;\n  }\n  .comment-list .list-item .text .jump-img,\n  .comment-list .list-item .text-con .jump-img {\n    width: 20px;\n    height: 20px;\n    vertical-align: sub;\n  }\n  .comment-list .list-item .text .jump-img.underline,\n  .comment-list .list-item .text-con .jump-img.underline {\n    display: inline-block;\n    width: 12px;\n    height: 20px;\n    background-size: contain;\n    background-repeat: no-repeat;\n  }\n  .comment-list .list-item .text .vote-link,\n  .comment-list .list-item .text-con .vote-link,\n  .comment-list .list-item .text .lottery-link,\n  .comment-list .list-item .text-con .lottery-link,\n  .comment-list .list-item .text .comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url {\n    color: var(--text_link);\n    margin: 0 3px;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url,\n  .comment-list .list-item .text .lottery-link.comment-jump-url,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url {\n    vertical-align: baseline;\n    margin-left: 0;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text .lottery-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url.underline-link {\n    margin: 0;\n  }\n  .comment-list .list-item .text .vote-link img,\n  .comment-list .list-item .text-con .vote-link img,\n  .comment-list .list-item .text .lottery-link img,\n  .comment-list .list-item .text-con .lottery-link img,\n  .comment-list .list-item .text .comment-jump-url img,\n  .comment-list .list-item .text-con .comment-jump-url img {\n    width: 16px;\n    height: 16px;\n    margin-right: 3px;\n    vertical-align: text-top;\n  }\n  .comment-list .list-item .text .vote-link:hover,\n  .comment-list .list-item .text-con .vote-link:hover,\n  .comment-list .list-item .text .lottery-link:hover,\n  .comment-list .list-item .text-con .lottery-link:hover,\n  .comment-list .list-item .text .comment-jump-url:hover,\n  .comment-list .list-item .text-con .comment-jump-url:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .info {\n    display: flex;\n    flex-wrap: wrap;\n    position: relative;\n    align-items: center;\n    color: var(--text3);\n    margin-bottom: 0;\n  }\n  .comment-list .list-item .info .reply-location {\n    margin-left: 5px;\n  }\n  .comment-list .list-item .info > span {\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .btn-hover {\n    border-radius: 4px;\n    margin-right: 15px;\n    cursor: pointer;\n    display: inline-block;\n  }\n  .comment-list .list-item .info .btn-hover:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .btn-hide {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .btn-hide-re {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .plad a {\n    color: var(--text3);\n  }\n  .comment-list .list-item .info .plad a:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .like {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n  }\n  .comment-list .list-item .info .like i {\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .hate i {\n    width: 16px;\n    height: 16px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_3___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_4___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .reply-tags {\n    width: 100%;\n    margin-top: 10px;\n    font-size: 0;\n    border-radius: 2px;\n  }\n  .comment-list .list-item .info .reply-tags span {\n    display: inline-block;\n    margin-right: 10px;\n    padding: 5px 6px;\n    line-height: 14px;\n    background: var(--bg3);\n    border-radius: 2px;\n    font-size: 12px;\n    font-weight: 400;\n    color: var(--text2);\n  }\n  .comment-list .list-item .blacklist-font-color {\n    color: var(--text2);\n    margin-right: 10px;\n  }\n  .comment-list .list-item .reply-box {\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .reply-item {\n    position: relative;\n    padding: 8px 0;\n  }\n  .comment-list .list-item .reply-box .reply-item .hidden-reply-toggle {\n    color: var(--text2);\n  }\n  .comment-list .list-item .reply-box .reply-item .quote {\n    font-weight: normal;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face {\n    position: absolute;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar,\n  .comment-list .list-item .reply-box .reply-item .reply-face img {\n    border-radius: 50%;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con {\n    display: inline-block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user {\n    display: block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .userInfo {\n    display: inline-flex;\n    align-items: center;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .name {\n    position: relative;\n    vertical-align: text-bottom;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user > a {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .stick.up {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item:hover .btn-hide-re {\n    visibility: visible;\n  }\n  .comment-list .list-item .reply-box .view-more {\n    color: var(--text2);\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more {\n    color: var(--text2);\n    padding: 2px 3px;\n    border-radius: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item:hover .btn-hide {\n    visibility: visible;\n  }\n  .comment-list .list-item:first-child .con {\n    border-top: none;\n  }\n  .comment-list.has-limit .list-item:last-child > .con {\n    padding-bottom: 22px;\n  }\n  .reply-fold-tip {\n    padding-top: 20px;\n    margin-left: 85px;\n    border-top: 1px solid var(--line_regular);\n  }\n  .reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text2);\n  }\n  .reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  .sub-reply-fold-tip {\n    margin-bottom: 20px;\n  }\n  .sub-reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text2);\n  }\n  .sub-reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  /*vip红名*/\n  .vip-red-name {\n    color: var(--brand_pink) !important;\n  }\n  .vip-green-name {\n    color: #62c076 !important;\n  }\n  /*置顶*/\n  .stick {\n    position: relative;\n    top: -1px;\n    min-width: 30px;\n    display: inline-block;\n    text-align: center;\n    font-size: 12px;\n    color: var(--brand_pink);\n    font-weight: normal;\n    line-height: 16px;\n    height: 18px;\n    border: 1px solid var(--brand_pink);\n    border-radius: 3px;\n    margin-right: 5px;\n    box-sizing: border-box;\n    vertical-align: inherit;\n  }\n  .stick:after {\n    content: '';\n  }\n  .stick.assist,\n  .stick.up {\n    min-width: 0px;\n    width: 18px;\n    margin-right: 0px;\n    margin-left: 8px;\n    height: 12px;\n    font-size: 9px;\n    border-radius: 2px;\n    background-color: var(--brand_pink);\n    color: var(--text_white);\n    border-color: var(--brand_pink);\n  }\n  .stick.assist .tinyfont,\n  .stick.up .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n  }\n  .stick.assist {\n    background-color: var(--bg1);\n    color: var(--brand_pink);\n    padding: 1px;\n  }\n  .stick.assist .tinyfont {\n    font-size: 20px;\n    line-height: 18px;\n  }\n  .stick.up {\n    position: relative;\n    top: 0;\n  }\n  .stick.up .tinyfont {\n    font-size: 20px;\n    line-height: 20px;\n  }\n  .medal {\n    display: inline-block;\n    position: relative;\n    text-align: center;\n    border-width: 0px;\n    vertical-align: middle;\n    margin-left: 8px;\n  }\n  .medal .true-love-flag {\n    position: absolute;\n    left: 0;\n    top: -1px;\n    width: 14px;\n    height: 14px;\n    transform-origin: center;\n    transform: scale(1.3);\n  }\n  .medal .true-love,\n  .medal .medal-level {\n    float: left;\n    box-sizing: content-box;\n    text-align: center;\n    height: 12px;\n    line-height: 12px;\n    border-width: 0.5px;\n    border-color: #f25d8e;\n    border-style: solid;\n    border-bottom-left-radius: 1px;\n    border-top-left-radius: 1px;\n    color: #f25d8e;\n  }\n  .medal .true-love .tinyfont,\n  .medal .medal-level .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n    font-size: 20px;\n    line-height: 24px;\n  }\n  .medal .true-love {\n    border-right-width: 0px;\n    padding: 0 2px 0 2px;\n  }\n  .medal .medal-level {\n    position: relative;\n    border-right-width: 0.5px;\n    border-left-width: 0.5px;\n    border-bottom-right-radius: 1px;\n    border-top-right-radius: 1px;\n    border-bottom-left-radius: 0px;\n    border-top-left-radius: 0px;\n    width: 14px;\n  }\n  .medal .medal-level-icon {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: absolute;\n    top: 0.5px;\n    right: -6px;\n    width: 12px;\n    height: 12px;\n    background: no-repeat;\n    background-size: contain;\n    transform: scale(1.6);\n  }\n  .medal .medal-level-icon .tinyfont {\n    position: relative;\n    top: 1.4px;\n    font-size: 12px;\n    transform-origin: center;\n    transform: scale(0.5);\n  }\n  /*热门评论分割线*/\n  .hot-line {\n    text-align: center;\n    border-bottom: 1px solid var(--line_regular);\n    position: relative;\n    margin: 20px 0 20px 85px;\n    font-size: 12px;\n  }\n  .hot-line span {\n    position: absolute;\n    top: -7px;\n    margin-left: -115px;\n    padding: 0 20px;\n    background: var(--bg1);\n  }\n  .hot-line a {\n    padding: 5px 6px;\n    border-radius: 4px;\n  }\n  .hot-line a:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .no-more-reply {\n    color: var(--text3);\n    text-align: center;\n    padding: 30px 0;\n    font-size: 12px;\n  }\n  /*勋章*/\n  .nameplate {\n    display: none;\n    position: relative;\n    vertical-align: middle;\n    margin: 0 8px;\n    z-index: 1;\n  }\n  .nameplate .nameplate-icon {\n    display: inline-block;\n  }\n  .nameplate .nameplate-icon img {\n    width: 20px;\n  }\n  .nameplate .nameplate-card {\n    display: none;\n    position: absolute;\n    left: 42px;\n    top: 1px;\n    width: 322px;\n    padding: 22px 20px;\n    background: var(--bg1);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n  }\n  .nameplate .nameplate-card .nameplate-pic {\n    width: 62px;\n    height: 62px;\n    overflow: hidden;\n    float: left;\n  }\n  .nameplate .nameplate-card .nameplate-text {\n    float: left;\n    width: 219px;\n    margin-left: 20px;\n    padding-left: 20px;\n    border-left: 1px solid var(--line_regular);\n    font-weight: normal;\n  }\n  .nameplate .nameplate-card .nameplate-text p {\n    margin: 3px 0;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n    font-size: 14px;\n    color: var(--text1);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-title {\n    color: var(--text1);\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type {\n    color: var(--text3);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a {\n    float: right;\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a:hover {\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-arrow {\n    position: absolute;\n    width: 7px;\n    height: 13px;\n    left: -7px;\n    top: 10px;\n    background: url('//static.hdslb.com/images/v2images/info_arrows.png');\n  }\n  .sailing {\n    position: absolute;\n    right: -1px;\n    top: 50%;\n    margin-top: -25px;\n    user-select: none;\n  }\n  .sailing .sailing-img {\n    height: 48px;\n  }\n  .sailing .sailing-info {\n    font-family: fanscard;\n    display: inline-block;\n    position: absolute;\n    left: 238px;\n    top: 12px;\n    line-height: 16px;\n    font-size: 12px;\n    transform: scale(0.7);\n    transform-origin: left top;\n    word-break: keep-all;\n  }\n  .legalize {\n    height: 20px;\n    width: 20px;\n    display: inline-block;\n    position: absolute;\n    top: 30px;\n    left: 30px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_6___ + ");\n    background-repeat: no-repeat;\n  }\n  .p-auth {\n    background-position: -38px -53px;\n  }\n  .o-auth {\n    background-position: -4px -53px;\n  }\n  .comment-captcha {\n    line-height: 50px;\n    font-size: 12px;\n  }\n  .comment-captcha input {\n    border-radius: 4px;\n    border: 1px solid var(--line_regular);\n    background-color: var(--bg1);\n    color: var(--text2);\n    height: 22px;\n    line-height: 22px;\n    margin: 0 5px;\n    padding: 0 2px;\n    vertical-align: middle;\n  }\n  .operation {\n    position: absolute;\n    width: 18px;\n    top: 0;\n    right: 0;\n  }\n  .operation .spot {\n    width: 18px;\n    height: 18px;\n    cursor: pointer;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_7___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .spot:hover {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_8___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .opera-list {\n    display: none;\n    position: absolute;\n    width: 120px;\n    right: 0;\n    top: 20px;\n    z-index: 10;\n    background: var(--bg1);\n    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);\n    border-radius: 4px;\n    color: var(--text1);\n    font-size: 14px;\n    padding: 10px 0;\n    z-index: 999;\n  }\n  .operation .opera-list li {\n    padding: 0px 15px;\n    cursor: pointer;\n    height: 36px;\n    line-height: 36px;\n    transition: all 0.3s;\n  }\n  .operation .opera-list li:hover {\n    background: var(--Ga1_s);\n    color: var(--brand_blue);\n  }\n  .operation.btn-hover {\n    padding: 0;\n    border-radius: 0;\n    margin-right: 0;\n    display: block;\n  }\n  .operation.btn-hover:hover {\n    color: none;\n    background: none;\n  }\n  .list-item .user-face {\n    width: calc(1.7 * 40px);\n  }\n  .list-item .user-face.normal {\n    display: block;\n  }\n  .list-item .user-face.widescreen {\n    display: none;\n  }\n  .list-item .user-face .bili-avatar {\n    margin: auto;\n  }\n  .list-item .con {\n    margin-left: calc(1.7 * 40px);\n  }\n  .list-item .con .user {\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .text,\n  .list-item .con .text-con {\n    font-size: 15px;\n    line-height: 24px;\n  }\n  .list-item .con .text img,\n  .list-item .con .text-con img {\n    width: 50px;\n    height: 50px;\n  }\n  .list-item .con .text img.small,\n  .list-item .con .text-con img.small {\n    width: 20px;\n    height: 20px;\n  }\n  .list-item .con .info {\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .reply-box .reply-item {\n    padding: 8px 0;\n  }\n  .list-item .con .reply-box .reply-item .reply-face.normal {\n    display: block;\n  }\n  .list-item .con .reply-box .reply-item .reply-face.widescreen {\n    display: none;\n  }\n  .list-item .con .reply-box .reply-item .info {\n    margin-left: calc(24px + 10px);\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con {\n    margin-left: calc(24px + 10px);\n    line-height: 24px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .name {\n    font-size: 13px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .text-con {\n    font-size: 15px;\n  }\n  .list-item .con .reply-box .view-more {\n    font-size: 13px;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user .text-con {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) {\n  .comment-list .quote {\n    margin: 16px auto;\n    background: #f4f5f7;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    padding: 10px;\n    overflow: auto;\n  }\n  .comment-list .list-item .user-face {\n    position: absolute;\n    margin-top: 24px;\n  }\n  .comment-list .list-item .user-face .bili-avatar .bili-avatar-img-radius {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .user-face .blacklist-face {\n    width: 48px;\n    height: 48px;\n    border-radius: 24px;\n  }\n  .comment-list .list-item .con {\n    position: relative;\n    padding: 22px 0 14px 0;\n    border-top: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .con .text {\n    position: relative;\n    z-index: 2;\n  }\n  .comment-list .list-item .con .user {\n    display: flex;\n    align-items: center;\n    margin-bottom: 2px;\n  }\n  .comment-list .list-item .con .perfect-reply {\n    position: absolute;\n    top: 22px;\n    right: 0;\n  }\n  .comment-list .list-item .con .perfect-reply .perfact-reply-bg {\n    width: 60px;\n    height: 60px;\n  }\n  .comment-list .list-item .con .hidden-reply-toggle {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .quote {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-wrap {\n    width: 100%;\n  }\n  .comment-list .list-item .con .vote-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .vote-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .vote-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIyLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMjggMjkiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4IDI5OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cjx0aXRsZT5Hcm91cCAyPC90aXRsZT4KPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CjxnIGlkPSJQYWdlLTEiIHN0eWxlPSJmaWxsOiMwMEExRDYiPgoJPGcgaWQ9IuWwgemdoiI+CgkJPGcgaWQ9Ikdyb3VwLTIiPgoJCQk8ZyBpZD0iUmVjdGFuZ2xlLTUiPgoJCQkJPHBhdGggZD0iTTMuMywyOC4zQzEuNSwyOC4zLDAsMjYuOSwwLDI1VjEwLjFjMC0xLjgsMS41LTMuMywzLjMtMy4zczMuMywxLjUsMy4zLDMuM1YyNUM2LjcsMjYuOSw1LjIsMjguMywzLjMsMjguM3ogTTMuMyw4CgkJCQkJYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMVYxMC4xQzUuNSw4LjksNC41LDgsMy4zLDh6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzFfIj4KCQkJCTxwYXRoIGQ9Ik0xNCwyOC40Yy0xLjgsMC0zLjMtMS41LTMuMy0zLjNWMy4zQzEwLjcsMS41LDEyLjIsMCwxNCwwczMuMywxLjUsMy4zLDMuM1YyNUMxNy4zLDI2LjksMTUuOCwyOC40LDE0LDI4LjR6IE0xNCwxLjIKCQkJCQljLTEuMiwwLTIuMSwxLTIuMSwyLjFWMjVjMCwxLjIsMSwyLjEsMi4xLDIuMWMxLjIsMCwyLjEtMSwyLjEtMi4xVjMuM0MxNi4xLDIuMiwxNS4yLDEuMiwxNCwxLjJ6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzJfIj4KCQkJCTxwYXRoIGQ9Ik0yNC43LDI4LjRjLTEuOCwwLTMuMy0xLjUtMy4zLTMuM3YtNi44YzAtMS44LDEuNS0zLjMsMy4zLTMuM3MzLjMsMS41LDMuMywzLjNWMjVDMjgsMjYuOSwyNi41LDI4LjQsMjQuNywyOC40egoJCQkJCSBNMjQuNywxNi4xYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMXYtNi44QzI2LjgsMTcsMjUuOCwxNi4xLDI0LjcsMTYuMXoiLz4KCQkJPC9nPgoJCTwvZz4KCTwvZz4KPC9nPgo8L3N2Zz4K\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .vote-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box .vote-btn {\n    width: 54px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .vote-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item .con .lottery-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .lottery-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .lottery-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAABSNJREFUaAXtWW9oW1UUv+e9l6wd1tlZlQ4myloR/LPaRMWBbE6miFWbutR2ggyHuDmX1q+DYUHED0PXLOroQCaIThtiC/ObykSEyZa0dt2sIP7Z0E07aJmZTdq+d4/nvvQlMbsvyUtahvPdD7nnnXv+/c659757Xxhzm5uB/3cGYDHgB96euJ4Zc42aF6ejO1p+t7P5/Hs/1CX/nlmtemDm9u0tZ/sAuJ1sufyqAGwOj64zGO9HxHsth2TwZwC259Me/0cWL/hOoknXWYQx3ITIVMEHBpMMcJ/W6Nsb7QTDknXaVwygI5zoo2D2IENF6hQg1nJ3a9fY+MgzBPAgQ7ZcJkdgj2ugtEVDrRdk46V4FQEI9CfaKPAjwjgF8Bulc68K6kmD81sJ1EuUab/pGJQIMP4C8WroOamQHIByjCNrIJlnCVhbRg5iwz2+zSbt8McxgODgaa9+LvUrMtZI02BCq8UHoi/6L1p++46iNnZyZJCCCxA8muOoEMiLCMw3HPL/ZMmJPrA/8Tpy3C1oVYEnYyGfmRTxXG6Tl7+INp6ffVAEL0RQwd784AWv7yHQmVfbTuDM4AUPkL1WGLzgr72r9VWq3llBU1U6Re+0OQagM1xjOgHAG5exb2QOh3asnUTAM7kx9escnaNMsAjHFjhNuZHyKccAACBtmkeEab32WltXwC5ZY1wxpixa0l8neDTlMnYlAsVYjgFowEctg4Y+G7ToSvquyMgqCn2d0KV1MlKJDccAorv84+TsqHDGEd9o3x9/pBLH3f3jN6U5fky6dWQvrXk8ByuxU3QXCg6iWj+dWFZoOMnYzek0nKCyX7MwRmsBviNjqaws4DbaPleaz4AfACp/LNBA74Q1CLCB5k294NH2uruhhoXN8byfOW+SH9q6YZamLe0b8iYFEByIr5hPs3cBocv2RSW3t+hcCv4CAd051OuPyoxLp5CeYgcoS1uudPAiYKryDbTVHg6ET9wpA6AVMsW0mT8/0kWatLBgUFHxLdrwHZ9V6CXgR4MfEPYB1HZFQdtDXmEM1jPNm1Wc4/sEop7e4E8R/5Q1ZvWXARBzfpJiFwII6puxl1uOW8JO+kAkkd1iEYxTsV3/fguXaysQTnxOQDopC6tlOtIplBVEw3Hms7qLRSCaMVAVpOtVBmA+6xvgMTvFrMwSEt0D8QaaC/cJF6Ao0tOqFFV7f/xb0rnfVATIARKMMhttAGK7NKcoraXKbJh3h8xxXVWUTbFQ6xeF7i9bA0IANO05ZuhHaB3fRhXwFCo5fa7KBr0DKBP7ZMGbsdoFs/XQLzXJS1PrOWcRCqCZFpE42/xpJy/h19JORkcFagBn6Fc36VI/iOLGdosphiwMXhgY2umbsFOTTqF8YdoFviIA60nwML1MtuSPFaNpF9qIBn5pyiisSXaclul3DMQbeYqdE2N0JH9iqNf3mUzO4skWsTX2n+hdAFe6TG4F3ApUmQF3ClWZwKrV3QpUncIqDbgVqDKBVatf/RWg+2jmGAwgPpEveVPnPDk/UPoILr3Q5EcJiKcJxMN0w3qU/hd4BdTMUTdfRkZzhndYfDqKP94RSZS8SyAH0A2929LTGH5v0XZ9yfvA0+HRZo7GGIGotTOyNHz4ZLjX11XKdsk1EOu550dQYCN9vxSfV8q7VZXyWmScMjpFN5lI3UptWxGx7FDJCmQliRD/zrDpVFmVmDG8ioZp89spLPckPXMGFbF4886uwA9DzX8Vl3JH3Qy4GbiqMvAPcV29qtEhK+0AAAAASUVORK5CYII=\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .lottery-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box .lottery-btn {\n    width: 70px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .lottery-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item:last-child .con {\n    border-bottom: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .no-border {\n    border-top: none;\n  }\n  .comment-list .list-item .user {\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n    display: block;\n    word-wrap: break-word;\n    position: relative;\n    margin-bottom: 5px;\n  }\n  .comment-list .list-item .user .name {\n    color: var(--text2);\n  }\n  .comment-list .list-item .user .level-link {\n    position: relative;\n    display: inline-flex;\n    margin-left: 5px;\n    vertical-align: middle;\n  }\n  .comment-list .list-item .user .gap {\n    margin-right: 20px;\n  }\n  .comment-list .list-item .user .level {\n    position: relative;\n    display: inline-block;\n    width: 22px;\n    height: 22px;\n  }\n  .comment-list .list-item .user .level.senior {\n    width: 30px;\n  }\n  .comment-list .list-item .user > a {\n    vertical-align: bottom;\n  }\n  .comment-list .list-item .user .name:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .user .text-con {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 400;\n    -webkit-font-smoothing: antialiased;\n    color: var(--text1);\n    margin-left: 9px;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n  }\n  .comment-list .list-item .contractor-box {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: relative;\n    height: 8px;\n    padding: 2px;\n    margin-left: 8px;\n    border-radius: 2px;\n    color: var(--brand_pink);\n    background-color: var(--brand_pink_thin);\n  }\n  .comment-list .list-item .contractor-box .contractor-text {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: absolute;\n    font-size: 16px;\n    white-space: nowrap;\n    transform-origin: center center;\n    transform: scale(0.5);\n  }\n  .comment-list .list-item .identity {\n    display: inline-block;\n    width: 34px;\n    height: 18px;\n    background: var(--brand_pink);\n    border-radius: 2px;\n    text-align: center;\n    line-height: 18px;\n    font-style: normal;\n    color: var(--text_white);\n    margin-right: 5px;\n    font-weight: 400;\n  }\n  .comment-list .list-item .identity.true-love {\n    background: #f25d8e;\n  }\n  .comment-list .list-item .text {\n    text-shadow: none;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n    margin-bottom: 5px;\n    color: var(--text1);\n  }\n  .comment-list .list-item .text img,\n  .comment-list .list-item .text-con img {\n    vertical-align: text-bottom;\n    padding: 0 1px;\n  }\n  .comment-list .list-item .text .jump-img,\n  .comment-list .list-item .text-con .jump-img {\n    width: 20px;\n    height: 20px;\n    vertical-align: sub;\n  }\n  .comment-list .list-item .text .jump-img.underline,\n  .comment-list .list-item .text-con .jump-img.underline {\n    display: inline-block;\n    width: 12px;\n    height: 20px;\n    background-size: contain;\n    background-repeat: no-repeat;\n  }\n  .comment-list .list-item .text .vote-link,\n  .comment-list .list-item .text-con .vote-link,\n  .comment-list .list-item .text .lottery-link,\n  .comment-list .list-item .text-con .lottery-link,\n  .comment-list .list-item .text .comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url {\n    color: var(--text_link);\n    margin: 0 3px;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url,\n  .comment-list .list-item .text .lottery-link.comment-jump-url,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url {\n    vertical-align: baseline;\n    margin-left: 0;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text .lottery-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url.underline-link,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url.underline-link,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url.underline-link {\n    margin: 0;\n  }\n  .comment-list .list-item .text .vote-link img,\n  .comment-list .list-item .text-con .vote-link img,\n  .comment-list .list-item .text .lottery-link img,\n  .comment-list .list-item .text-con .lottery-link img,\n  .comment-list .list-item .text .comment-jump-url img,\n  .comment-list .list-item .text-con .comment-jump-url img {\n    width: 16px;\n    height: 16px;\n    margin-right: 3px;\n    vertical-align: text-top;\n  }\n  .comment-list .list-item .text .vote-link:hover,\n  .comment-list .list-item .text-con .vote-link:hover,\n  .comment-list .list-item .text .lottery-link:hover,\n  .comment-list .list-item .text-con .lottery-link:hover,\n  .comment-list .list-item .text .comment-jump-url:hover,\n  .comment-list .list-item .text-con .comment-jump-url:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .info {\n    display: flex;\n    flex-wrap: wrap;\n    position: relative;\n    align-items: center;\n    color: var(--text3);\n    margin-bottom: 0;\n  }\n  .comment-list .list-item .info .reply-location {\n    margin-left: 5px;\n  }\n  .comment-list .list-item .info > span {\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .btn-hover {\n    border-radius: 4px;\n    margin-right: 15px;\n    cursor: pointer;\n    display: inline-block;\n  }\n  .comment-list .list-item .info .btn-hover:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .btn-hide {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .btn-hide-re {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .plad a {\n    color: var(--text3);\n  }\n  .comment-list .list-item .info .plad a:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .like {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n  }\n  .comment-list .list-item .info .like i {\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .hate i {\n    width: 16px;\n    height: 16px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_3___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_4___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .reply-tags {\n    width: 100%;\n    margin-top: 10px;\n    font-size: 0;\n    border-radius: 2px;\n  }\n  .comment-list .list-item .info .reply-tags span {\n    display: inline-block;\n    margin-right: 10px;\n    padding: 5px 6px;\n    line-height: 14px;\n    background: var(--bg3);\n    border-radius: 2px;\n    font-size: 12px;\n    font-weight: 400;\n    color: var(--text2);\n  }\n  .comment-list .list-item .blacklist-font-color {\n    color: var(--text2);\n    margin-right: 10px;\n  }\n  .comment-list .list-item .reply-box {\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .reply-item {\n    position: relative;\n    padding: 8px 0;\n  }\n  .comment-list .list-item .reply-box .reply-item .hidden-reply-toggle {\n    color: var(--text2);\n  }\n  .comment-list .list-item .reply-box .reply-item .quote {\n    font-weight: normal;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face {\n    position: absolute;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar,\n  .comment-list .list-item .reply-box .reply-item .reply-face img {\n    border-radius: 50%;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con {\n    display: inline-block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user {\n    display: block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .userInfo {\n    display: inline-flex;\n    align-items: center;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .name {\n    position: relative;\n    vertical-align: text-bottom;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user > a {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .stick.up {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item:hover .btn-hide-re {\n    visibility: visible;\n  }\n  .comment-list .list-item .reply-box .view-more {\n    color: var(--text2);\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more {\n    color: var(--text2);\n    padding: 2px 3px;\n    border-radius: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item:hover .btn-hide {\n    visibility: visible;\n  }\n  .comment-list .list-item:first-child .con {\n    border-top: none;\n  }\n  .comment-list.has-limit .list-item:last-child > .con {\n    padding-bottom: 22px;\n  }\n  .reply-fold-tip {\n    padding-top: 20px;\n    margin-left: 85px;\n    border-top: 1px solid var(--line_regular);\n  }\n  .reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text2);\n  }\n  .reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  .sub-reply-fold-tip {\n    margin-bottom: 20px;\n  }\n  .sub-reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text2);\n  }\n  .sub-reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  /*vip红名*/\n  .vip-red-name {\n    color: var(--brand_pink) !important;\n  }\n  .vip-green-name {\n    color: #62c076 !important;\n  }\n  /*置顶*/\n  .stick {\n    position: relative;\n    top: -1px;\n    min-width: 30px;\n    display: inline-block;\n    text-align: center;\n    font-size: 12px;\n    color: var(--brand_pink);\n    font-weight: normal;\n    line-height: 16px;\n    height: 18px;\n    border: 1px solid var(--brand_pink);\n    border-radius: 3px;\n    margin-right: 5px;\n    box-sizing: border-box;\n    vertical-align: inherit;\n  }\n  .stick:after {\n    content: '';\n  }\n  .stick.assist,\n  .stick.up {\n    min-width: 0px;\n    width: 18px;\n    margin-right: 0px;\n    margin-left: 8px;\n    height: 12px;\n    font-size: 9px;\n    border-radius: 2px;\n    background-color: var(--brand_pink);\n    color: var(--text_white);\n    border-color: var(--brand_pink);\n  }\n  .stick.assist .tinyfont,\n  .stick.up .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n  }\n  .stick.assist {\n    background-color: var(--bg1);\n    color: var(--brand_pink);\n    padding: 1px;\n  }\n  .stick.assist .tinyfont {\n    font-size: 20px;\n    line-height: 18px;\n  }\n  .stick.up {\n    position: relative;\n    top: 0;\n  }\n  .stick.up .tinyfont {\n    font-size: 20px;\n    line-height: 20px;\n  }\n  .medal {\n    display: inline-block;\n    position: relative;\n    text-align: center;\n    border-width: 0px;\n    vertical-align: middle;\n    margin-left: 8px;\n  }\n  .medal .true-love-flag {\n    position: absolute;\n    left: 0;\n    top: -1px;\n    width: 14px;\n    height: 14px;\n    transform-origin: center;\n    transform: scale(1.3);\n  }\n  .medal .true-love,\n  .medal .medal-level {\n    float: left;\n    box-sizing: content-box;\n    text-align: center;\n    height: 12px;\n    line-height: 12px;\n    border-width: 0.5px;\n    border-color: #f25d8e;\n    border-style: solid;\n    border-bottom-left-radius: 1px;\n    border-top-left-radius: 1px;\n    color: #f25d8e;\n  }\n  .medal .true-love .tinyfont,\n  .medal .medal-level .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n    font-size: 20px;\n    line-height: 24px;\n  }\n  .medal .true-love {\n    border-right-width: 0px;\n    padding: 0 2px 0 2px;\n  }\n  .medal .medal-level {\n    position: relative;\n    border-right-width: 0.5px;\n    border-left-width: 0.5px;\n    border-bottom-right-radius: 1px;\n    border-top-right-radius: 1px;\n    border-bottom-left-radius: 0px;\n    border-top-left-radius: 0px;\n    width: 14px;\n  }\n  .medal .medal-level-icon {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: absolute;\n    top: 0.5px;\n    right: -6px;\n    width: 12px;\n    height: 12px;\n    background: no-repeat;\n    background-size: contain;\n    transform: scale(1.6);\n  }\n  .medal .medal-level-icon .tinyfont {\n    position: relative;\n    top: 1.4px;\n    font-size: 12px;\n    transform-origin: center;\n    transform: scale(0.5);\n  }\n  /*热门评论分割线*/\n  .hot-line {\n    text-align: center;\n    border-bottom: 1px solid var(--line_regular);\n    position: relative;\n    margin: 20px 0 20px 85px;\n    font-size: 12px;\n  }\n  .hot-line span {\n    position: absolute;\n    top: -7px;\n    margin-left: -115px;\n    padding: 0 20px;\n    background: var(--bg1);\n  }\n  .hot-line a {\n    padding: 5px 6px;\n    border-radius: 4px;\n  }\n  .hot-line a:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .no-more-reply {\n    color: var(--text3);\n    text-align: center;\n    padding: 30px 0;\n    font-size: 12px;\n  }\n  /*勋章*/\n  .nameplate {\n    display: none;\n    position: relative;\n    vertical-align: middle;\n    margin: 0 8px;\n    z-index: 1;\n  }\n  .nameplate .nameplate-icon {\n    display: inline-block;\n  }\n  .nameplate .nameplate-icon img {\n    width: 20px;\n  }\n  .nameplate .nameplate-card {\n    display: none;\n    position: absolute;\n    left: 42px;\n    top: 1px;\n    width: 322px;\n    padding: 22px 20px;\n    background: var(--bg1);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n  }\n  .nameplate .nameplate-card .nameplate-pic {\n    width: 62px;\n    height: 62px;\n    overflow: hidden;\n    float: left;\n  }\n  .nameplate .nameplate-card .nameplate-text {\n    float: left;\n    width: 219px;\n    margin-left: 20px;\n    padding-left: 20px;\n    border-left: 1px solid var(--line_regular);\n    font-weight: normal;\n  }\n  .nameplate .nameplate-card .nameplate-text p {\n    margin: 3px 0;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n    font-size: 14px;\n    color: var(--text1);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-title {\n    color: var(--text1);\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type {\n    color: var(--text3);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a {\n    float: right;\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a:hover {\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-arrow {\n    position: absolute;\n    width: 7px;\n    height: 13px;\n    left: -7px;\n    top: 10px;\n    background: url('//static.hdslb.com/images/v2images/info_arrows.png');\n  }\n  .sailing {\n    position: absolute;\n    right: -1px;\n    top: 50%;\n    margin-top: -25px;\n    user-select: none;\n  }\n  .sailing .sailing-img {\n    height: 48px;\n  }\n  .sailing .sailing-info {\n    font-family: fanscard;\n    display: inline-block;\n    position: absolute;\n    left: 238px;\n    top: 12px;\n    line-height: 16px;\n    font-size: 12px;\n    transform: scale(0.7);\n    transform-origin: left top;\n    word-break: keep-all;\n  }\n  .legalize {\n    height: 20px;\n    width: 20px;\n    display: inline-block;\n    position: absolute;\n    top: 30px;\n    left: 30px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_6___ + ");\n    background-repeat: no-repeat;\n  }\n  .p-auth {\n    background-position: -38px -53px;\n  }\n  .o-auth {\n    background-position: -4px -53px;\n  }\n  .comment-captcha {\n    line-height: 50px;\n    font-size: 12px;\n  }\n  .comment-captcha input {\n    border-radius: 4px;\n    border: 1px solid var(--line_regular);\n    background-color: var(--bg1);\n    color: var(--text2);\n    height: 22px;\n    line-height: 22px;\n    margin: 0 5px;\n    padding: 0 2px;\n    vertical-align: middle;\n  }\n  .operation {\n    position: absolute;\n    width: 18px;\n    top: 0;\n    right: 0;\n  }\n  .operation .spot {\n    width: 18px;\n    height: 18px;\n    cursor: pointer;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_7___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .spot:hover {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_8___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .opera-list {\n    display: none;\n    position: absolute;\n    width: 120px;\n    right: 0;\n    top: 20px;\n    z-index: 10;\n    background: var(--bg1);\n    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);\n    border-radius: 4px;\n    color: var(--text1);\n    font-size: 14px;\n    padding: 10px 0;\n    z-index: 999;\n  }\n  .operation .opera-list li {\n    padding: 0px 15px;\n    cursor: pointer;\n    height: 36px;\n    line-height: 36px;\n    transition: all 0.3s;\n  }\n  .operation .opera-list li:hover {\n    background: var(--Ga1_s);\n    color: var(--brand_blue);\n  }\n  .operation.btn-hover {\n    padding: 0;\n    border-radius: 0;\n    margin-right: 0;\n    display: block;\n  }\n  .operation.btn-hover:hover {\n    color: none;\n    background: none;\n  }\n  .list-item .user-face {\n    width: calc(1.7 * 48px);\n  }\n  .list-item .user-face.normal {\n    display: none;\n  }\n  .list-item .user-face.widescreen {\n    display: block;\n  }\n  .list-item .user-face .bili-avatar {\n    margin: auto;\n  }\n  .list-item .con {\n    margin-left: calc(1.7 * 48px);\n  }\n  .list-item .con .user {\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .text,\n  .list-item .con .text-con {\n    font-size: 16px;\n    line-height: 26px;\n  }\n  .list-item .con .text img,\n  .list-item .con .text-con img {\n    width: 50px;\n    height: 50px;\n  }\n  .list-item .con .text img.small,\n  .list-item .con .text-con img.small {\n    width: 22px;\n    height: 22px;\n  }\n  .list-item .con .info {\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .reply-box .reply-item {\n    padding: 10px 0;\n  }\n  .list-item .con .reply-box .reply-item .reply-face.normal {\n    display: none;\n  }\n  .list-item .con .reply-box .reply-item .reply-face.widescreen {\n    display: block;\n  }\n  .list-item .con .reply-box .reply-item .info {\n    margin-left: calc(30px + 10px);\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con {\n    margin-left: calc(30px + 10px);\n    line-height: 26px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .name {\n    font-size: 14px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .text-con {\n    font-size: 16px;\n  }\n  .list-item .con .reply-box .view-more {\n    font-size: 14px;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user .text-con {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v2.less":
/*!**********************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v2.less ***!
  \**********************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../../images/ic_like.svg */ "./static/images/ic_like.svg");
var ___CSS_LOADER_URL_IMPORT_1___ = __webpack_require__(/*! ../../../images/ic_like_hover.svg */ "./static/images/ic_like_hover.svg");
var ___CSS_LOADER_URL_IMPORT_2___ = __webpack_require__(/*! ../../../images/ic_like_clicked.svg */ "./static/images/ic_like_clicked.svg");
var ___CSS_LOADER_URL_IMPORT_3___ = __webpack_require__(/*! ../../../images/ic_hate.svg */ "./static/images/ic_hate.svg");
var ___CSS_LOADER_URL_IMPORT_4___ = __webpack_require__(/*! ../../../images/ic_hate_hover.svg */ "./static/images/ic_hate_hover.svg");
var ___CSS_LOADER_URL_IMPORT_5___ = __webpack_require__(/*! ../../../images/ic_hate_clicked.svg */ "./static/images/ic_hate_clicked.svg");
var ___CSS_LOADER_URL_IMPORT_6___ = __webpack_require__(/*! ../../../images/user-auth.png */ "./static/images/user-auth.png");
var ___CSS_LOADER_URL_IMPORT_7___ = __webpack_require__(/*! ../../../images/ic_spot.svg */ "./static/images/ic_spot.svg");
var ___CSS_LOADER_URL_IMPORT_8___ = __webpack_require__(/*! ../../../images/ic_spot_hover.svg */ "./static/images/ic_spot_hover.svg");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
var ___CSS_LOADER_URL_REPLACEMENT_1___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_1___);
var ___CSS_LOADER_URL_REPLACEMENT_2___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_2___);
var ___CSS_LOADER_URL_REPLACEMENT_3___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_3___);
var ___CSS_LOADER_URL_REPLACEMENT_4___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_4___);
var ___CSS_LOADER_URL_REPLACEMENT_5___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_5___);
var ___CSS_LOADER_URL_REPLACEMENT_6___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_6___);
var ___CSS_LOADER_URL_REPLACEMENT_7___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_7___);
var ___CSS_LOADER_URL_REPLACEMENT_8___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_8___);
// Module
exports.push([module.id, "@media screen and (max-width: 1681px) {\n  .comment-list .quote {\n    margin: 16px auto;\n    background: #f4f5f7;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    padding: 10px;\n    overflow: auto;\n  }\n  .comment-list .list-item .user-face {\n    float: left;\n    position: relative;\n    margin: 24px 0 0 5px;\n  }\n  .comment-list .list-item .user-face .bili-avatar .bili-avatar-img-radius {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .user-face .blacklist-face {\n    width: 48px;\n    height: 48px;\n    border-radius: 24px;\n  }\n  .comment-list .list-item .con {\n    position: relative;\n    padding: 22px 0 14px 0;\n    border-top: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .con .user {\n    display: flex;\n    align-items: center;\n    margin-bottom: 2px;\n  }\n  .comment-list .list-item .con .hidden-reply-toggle {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .quote {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-wrap {\n    width: 100%;\n  }\n  .comment-list .list-item .con .vote-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .vote-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .vote-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIyLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMjggMjkiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4IDI5OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cjx0aXRsZT5Hcm91cCAyPC90aXRsZT4KPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CjxnIGlkPSJQYWdlLTEiIHN0eWxlPSJmaWxsOiMwMEExRDYiPgoJPGcgaWQ9IuWwgemdoiI+CgkJPGcgaWQ9Ikdyb3VwLTIiPgoJCQk8ZyBpZD0iUmVjdGFuZ2xlLTUiPgoJCQkJPHBhdGggZD0iTTMuMywyOC4zQzEuNSwyOC4zLDAsMjYuOSwwLDI1VjEwLjFjMC0xLjgsMS41LTMuMywzLjMtMy4zczMuMywxLjUsMy4zLDMuM1YyNUM2LjcsMjYuOSw1LjIsMjguMywzLjMsMjguM3ogTTMuMyw4CgkJCQkJYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMVYxMC4xQzUuNSw4LjksNC41LDgsMy4zLDh6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzFfIj4KCQkJCTxwYXRoIGQ9Ik0xNCwyOC40Yy0xLjgsMC0zLjMtMS41LTMuMy0zLjNWMy4zQzEwLjcsMS41LDEyLjIsMCwxNCwwczMuMywxLjUsMy4zLDMuM1YyNUMxNy4zLDI2LjksMTUuOCwyOC40LDE0LDI4LjR6IE0xNCwxLjIKCQkJCQljLTEuMiwwLTIuMSwxLTIuMSwyLjFWMjVjMCwxLjIsMSwyLjEsMi4xLDIuMWMxLjIsMCwyLjEtMSwyLjEtMi4xVjMuM0MxNi4xLDIuMiwxNS4yLDEuMiwxNCwxLjJ6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzJfIj4KCQkJCTxwYXRoIGQ9Ik0yNC43LDI4LjRjLTEuOCwwLTMuMy0xLjUtMy4zLTMuM3YtNi44YzAtMS44LDEuNS0zLjMsMy4zLTMuM3MzLjMsMS41LDMuMywzLjNWMjVDMjgsMjYuOSwyNi41LDI4LjQsMjQuNywyOC40egoJCQkJCSBNMjQuNywxNi4xYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMXYtNi44QzI2LjgsMTcsMjUuOCwxNi4xLDI0LjcsMTYuMXoiLz4KCQkJPC9nPgoJCTwvZz4KCTwvZz4KPC9nPgo8L3N2Zz4K\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .vote-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box .vote-btn {\n    width: 54px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .vote-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item .con .lottery-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .lottery-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .lottery-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAABSNJREFUaAXtWW9oW1UUv+e9l6wd1tlZlQ4myloR/LPaRMWBbE6miFWbutR2ggyHuDmX1q+DYUHED0PXLOroQCaIThtiC/ObykSEyZa0dt2sIP7Z0E07aJmZTdq+d4/nvvQlMbsvyUtahvPdD7nnnXv+/c659757Xxhzm5uB/3cGYDHgB96euJ4Zc42aF6ejO1p+t7P5/Hs/1CX/nlmtemDm9u0tZ/sAuJ1sufyqAGwOj64zGO9HxHsth2TwZwC259Me/0cWL/hOoknXWYQx3ITIVMEHBpMMcJ/W6Nsb7QTDknXaVwygI5zoo2D2IENF6hQg1nJ3a9fY+MgzBPAgQ7ZcJkdgj2ugtEVDrRdk46V4FQEI9CfaKPAjwjgF8Bulc68K6kmD81sJ1EuUab/pGJQIMP4C8WroOamQHIByjCNrIJlnCVhbRg5iwz2+zSbt8McxgODgaa9+LvUrMtZI02BCq8UHoi/6L1p++46iNnZyZJCCCxA8muOoEMiLCMw3HPL/ZMmJPrA/8Tpy3C1oVYEnYyGfmRTxXG6Tl7+INp6ffVAEL0RQwd784AWv7yHQmVfbTuDM4AUPkL1WGLzgr72r9VWq3llBU1U6Re+0OQagM1xjOgHAG5exb2QOh3asnUTAM7kx9escnaNMsAjHFjhNuZHyKccAACBtmkeEab32WltXwC5ZY1wxpixa0l8neDTlMnYlAsVYjgFowEctg4Y+G7ToSvquyMgqCn2d0Kv2MlKJDccAorv84+TsqHDGEd9o3x9/pBLH3f3jN6U5fky6dWQvrXk8ByuxU3QXCg6iWj+dWFZoOMnYzek0nKCyX7MwRmsBviNjqaws4DbaPleaz4AfACp/LNBA74Q1CLCB5k294NH2uruhhoXN8byfOW+SH9q6YZamLe0b8iYFEByIr5hPs3cBocv2RSW3t+hcCv4CAd051OuPyoxLp5CeYgcoS1uudPAiYKryDbTVHg6ET9wpA6AVMsW0mT8/0kWatLBgUFHxLdrwHZ9V6CXgR4MfEPYB1HZFQdtDXmEM1jPNm1Wc4/sEop7e4E8R/5Q1ZvWXARBzfpJiFwII6puxl1uOW8JO+kAkkd1iEYxTsV3/fguXaysQTnxOQDopC6tlOtIplBVEw3Hms7qLRSCaMVAVpOtVBmA+6xvgMTvFrMwSEt0D8QaaC/cJF6Ao0tOqFFV7f/xb0rnfVATIARKMMhttAGK7NKcoraXKbJh3h8xxXVWUTbFQ6xeF7i9bA0IANO05ZuhHaB3fRhXwFCo5fa7KBr0DKBP7ZMGbsdoFs/XQLzXJS1PrOWcRCqCZFpE42/xpJy/h19JORkcFagBn6Fc36VI/iOLGdosphiwMXhgY2umbsFOTTqF8YdoFviIA60nwML1MtuSPFaNpF9qIBn5pyiisSXaclul3DMQbeYqdE2N0JH9iqNf3mUzO4skWsTX2n+hdAFe6TG4F3ApUmQF3ClWZwKrV3QpUncIqDbgVqDKBVatf/RWg+2jmGAwgPpEveVPnPDk/UPoILr3Q5EcJiKcJxMN0w3qU/hd4BdTMUTdfRkZzhndYfDqKP94RSZS8SyAH0A2929LTGH5v0XZ9yfvA0+HRZo7GGIGotTOyNHz4ZLjX11XKdsk1EOu550dQYCN9vxSfV8q7VZXyWmScMjpFN5lI3UptWxGx7FDJCmQliRD/zrDpVFmVmDG8ioZp89spLPckPXMGFbF4886uwA9DzX8Vl3JH3Qy4GbiqMvAPcV29qtEhK+0AAAAASUVORK5CYII=\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .lottery-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box .lottery-btn {\n    width: 70px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .lottery-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item:last-child .con {\n    border-bottom: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .no-border {\n    border-top: none;\n  }\n  .comment-list .list-item .user {\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n    display: block;\n    word-wrap: break-word;\n    position: relative;\n  }\n  .comment-list .list-item .user .name {\n    color: var(--text2);\n  }\n  .comment-list .list-item .user .level-link {\n    position: relative;\n    display: inline-block;\n    margin-left: 5px;\n  }\n  .comment-list .list-item .user .gap {\n    margin-right: 20px;\n  }\n  .comment-list .list-item .user .level {\n    position: relative;\n    display: inline-block;\n    width: 22px;\n  }\n  .comment-list .list-item .user > a {\n    vertical-align: bottom;\n  }\n  .comment-list .list-item .user .name:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .user .text-con {\n    color: var(--text1);\n    font-weight: normal;\n    margin-left: 9px;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n  }\n  .comment-list .list-item .identity {\n    display: inline-block;\n    width: 34px;\n    height: 18px;\n    background: var(--brand_pink);\n    border-radius: 2px;\n    text-align: center;\n    line-height: 18px;\n    font-style: normal;\n    color: var(--text_white);\n    margin-right: 5px;\n    font-weight: 400;\n  }\n  .comment-list .list-item .identity.true-love {\n    background: #f25d8e;\n  }\n  .comment-list .list-item .text {\n    text-shadow: none;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n    margin-bottom: 5px;\n    color: var(--text1);\n  }\n  .comment-list .list-item .text img,\n  .comment-list .list-item .text-con img {\n    vertical-align: text-bottom;\n    padding: 0 1px;\n  }\n  .comment-list .list-item .text .jump-img,\n  .comment-list .list-item .text-con .jump-img {\n    width: 20px;\n    height: 20px;\n    vertical-align: middle;\n  }\n  .comment-list .list-item .text .vote-link,\n  .comment-list .list-item .text-con .vote-link,\n  .comment-list .list-item .text .lottery-link,\n  .comment-list .list-item .text-con .lottery-link,\n  .comment-list .list-item .text .comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url {\n    color: var(--text_link);\n    margin: 0 3px;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url,\n  .comment-list .list-item .text .lottery-link.comment-jump-url,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url {\n    vertical-align: middle;\n    margin-left: 0;\n  }\n  .comment-list .list-item .text .vote-link img,\n  .comment-list .list-item .text-con .vote-link img,\n  .comment-list .list-item .text .lottery-link img,\n  .comment-list .list-item .text-con .lottery-link img,\n  .comment-list .list-item .text .comment-jump-url img,\n  .comment-list .list-item .text-con .comment-jump-url img {\n    width: 16px;\n    height: 16px;\n    margin-right: 3px;\n    vertical-align: text-top;\n  }\n  .comment-list .list-item .text .vote-link:hover,\n  .comment-list .list-item .text-con .vote-link:hover,\n  .comment-list .list-item .text .lottery-link:hover,\n  .comment-list .list-item .text-con .lottery-link:hover,\n  .comment-list .list-item .text .comment-jump-url:hover,\n  .comment-list .list-item .text-con .comment-jump-url:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .info {\n    display: flex;\n    flex-wrap: wrap;\n    position: relative;\n    align-items: center;\n    color: var(--text3);\n    margin-bottom: 0;\n  }\n  .comment-list .list-item .info > span {\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .btn-hover {\n    border-radius: 4px;\n    margin-right: 15px;\n    cursor: pointer;\n    display: inline-block;\n  }\n  .comment-list .list-item .info .btn-hover:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .btn-hide {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .btn-hide-re {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .plad a {\n    color: var(--text3);\n  }\n  .comment-list .list-item .info .plad a:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .like {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n  }\n  .comment-list .list-item .info .like i {\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .hate i {\n    width: 16px;\n    height: 16px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_3___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_4___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .reply-tags {\n    width: 100%;\n    margin-top: 10px;\n    font-size: 0;\n    border-radius: 2px;\n  }\n  .comment-list .list-item .info .reply-tags span {\n    display: inline-block;\n    margin-right: 10px;\n    padding: 5px 6px;\n    line-height: 14px;\n    background: var(--bg3);\n    border-radius: 2px;\n    font-size: 12px;\n    font-weight: 400;\n    color: var(--text2);\n  }\n  .comment-list .list-item .blacklist-font-color {\n    color: var(--text2);\n    margin-right: 10px;\n  }\n  .comment-list .list-item .reply-box {\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .reply-item {\n    position: relative;\n    padding: 8px 0;\n  }\n  .comment-list .list-item .reply-box .reply-item .hidden-reply-toggle {\n    color: var(--text2);\n  }\n  .comment-list .list-item .reply-box .reply-item .quote {\n    font-weight: normal;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face {\n    position: absolute;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar,\n  .comment-list .list-item .reply-box .reply-item .reply-face img {\n    border-radius: 50%;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar .bili-avatar-icon {\n    width: 12px;\n    height: 12px;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con {\n    display: inline-block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user {\n    display: block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .name {\n    position: relative;\n    vertical-align: text-bottom;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user > a {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .stick.up {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item:hover .btn-hide-re {\n    visibility: visible;\n  }\n  .comment-list .list-item .reply-box .view-more {\n    color: var(--text2);\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more {\n    color: var(--text2);\n    padding: 2px 3px;\n    border-radius: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item:hover .btn-hide {\n    visibility: visible;\n  }\n  .comment-list .list-item:first-child .con {\n    border-top: none;\n  }\n  .comment-list.has-limit .list-item:last-child > .con {\n    padding-bottom: 22px;\n  }\n  .reply-fold-tip {\n    padding-top: 20px;\n    margin-left: 85px;\n    border-top: 1px solid var(--line_regular);\n  }\n  .reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text3);\n  }\n  .reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  .sub-reply-fold-tip {\n    margin-bottom: 20px;\n  }\n  .sub-reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text3);\n  }\n  .sub-reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  /*vip红名*/\n  .vip-red-name {\n    color: var(--brand_pink) !important;\n  }\n  .vip-green-name {\n    color: #62c076 !important;\n  }\n  /*置顶*/\n  .stick {\n    position: relative;\n    top: -1px;\n    min-width: 30px;\n    display: inline-block;\n    text-align: center;\n    font-size: 12px;\n    color: var(--brand_pink);\n    font-weight: normal;\n    line-height: 16px;\n    height: 18px;\n    border: 1px solid var(--brand_pink);\n    border-radius: 3px;\n    margin-right: 5px;\n    box-sizing: border-box;\n    vertical-align: inherit;\n  }\n  .stick:after {\n    content: '';\n  }\n  .stick.assist,\n  .stick.up {\n    min-width: 0px;\n    width: 18px;\n    margin-right: 0px;\n    margin-left: 8px;\n    height: 12px;\n    font-size: 9px;\n    border-radius: 2px;\n    background-color: var(--brand_pink);\n    color: var(--text_white);\n    border-color: var(--brand_pink);\n  }\n  .stick.assist .tinyfont,\n  .stick.up .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n  }\n  .stick.assist {\n    background-color: var(--bg1);\n    color: var(--brand_pink);\n    padding: 1px;\n  }\n  .stick.assist .tinyfont {\n    font-size: 20px;\n    line-height: 18px;\n  }\n  .stick.up {\n    position: relative;\n    top: 0;\n  }\n  .stick.up .tinyfont {\n    font-size: 20px;\n    line-height: 20px;\n  }\n  .medal {\n    display: inline-block;\n    text-align: center;\n    border-width: 0px;\n    vertical-align: middle;\n    margin-left: 8px;\n  }\n  .medal .true-love-flag {\n    position: absolute;\n    transform: translate(-50%, -1px);\n    width: 16px;\n    height: 16px;\n  }\n  .medal .true-love,\n  .medal .medal-level {\n    float: left;\n    box-sizing: content-box;\n    text-align: center;\n    height: 12px;\n    line-height: 12px;\n    border-width: 0.5px;\n    border-color: #f25d8e;\n    border-style: solid;\n    border-bottom-left-radius: 1px;\n    border-top-left-radius: 1px;\n    color: #f25d8e;\n  }\n  .medal .true-love .tinyfont,\n  .medal .medal-level .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n    font-size: 20px;\n    line-height: 24px;\n  }\n  .medal .true-love {\n    border-right-width: 0px;\n    padding: 0 2px 0 2px;\n  }\n  .medal .medal-level {\n    border-right-width: 0.5px;\n    border-left-width: 0.5px;\n    border-bottom-right-radius: 1px;\n    border-top-right-radius: 1px;\n    border-bottom-left-radius: 0px;\n    border-top-left-radius: 0px;\n    width: 14px;\n  }\n  /*热门评论分割线*/\n  .hot-line {\n    text-align: center;\n    border-bottom: 1px solid var(--line_regular);\n    position: relative;\n    margin: 20px 0 20px 85px;\n    font-size: 12px;\n  }\n  .hot-line span {\n    position: absolute;\n    top: -7px;\n    margin-left: -115px;\n    padding: 0 20px;\n    background: var(--bg1);\n  }\n  .hot-line a {\n    padding: 5px 6px;\n    border-radius: 4px;\n  }\n  .hot-line a:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .no-more-reply {\n    color: var(--text3);\n    text-align: center;\n    padding: 30px 0;\n    font-size: 12px;\n  }\n  /*勋章*/\n  .nameplate {\n    position: relative;\n    display: inline-block;\n    vertical-align: middle;\n    margin: 0 8px;\n    z-index: 1;\n  }\n  .nameplate .nameplate-icon {\n    display: inline-block;\n  }\n  .nameplate .nameplate-icon img {\n    width: 20px;\n  }\n  .nameplate .nameplate-card {\n    display: none;\n    position: absolute;\n    left: 42px;\n    top: 1px;\n    width: 322px;\n    padding: 22px 20px;\n    background: var(--bg1);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n  }\n  .nameplate .nameplate-card .nameplate-pic {\n    width: 62px;\n    height: 62px;\n    overflow: hidden;\n    float: left;\n  }\n  .nameplate .nameplate-card .nameplate-text {\n    float: left;\n    width: 219px;\n    margin-left: 20px;\n    padding-left: 20px;\n    border-left: 1px solid var(--line_regular);\n    font-weight: normal;\n  }\n  .nameplate .nameplate-card .nameplate-text p {\n    margin: 3px 0;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n    font-size: 14px;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-title {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type {\n    color: var(--text3);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a {\n    float: right;\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a:hover {\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-arrow {\n    position: absolute;\n    width: 7px;\n    height: 13px;\n    left: -7px;\n    top: 10px;\n    background: url('//static.hdslb.com/images/v2images/info_arrows.png');\n  }\n  .sailing {\n    position: absolute;\n    right: -1px;\n    top: 50%;\n    margin-top: -25px;\n    user-select: none;\n  }\n  .sailing .sailing-img {\n    height: 48px;\n  }\n  .sailing .sailing-info {\n    font-family: fanscard;\n    display: inline-block;\n    position: absolute;\n    left: 238px;\n    top: 12px;\n    line-height: 16px;\n    font-size: 12px;\n    transform: scale(0.7);\n    transform-origin: left top;\n    word-break: keep-all;\n  }\n  .legalize {\n    height: 20px;\n    width: 20px;\n    display: inline-block;\n    position: absolute;\n    top: 30px;\n    left: 30px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_6___ + ");\n    background-repeat: no-repeat;\n  }\n  .p-auth {\n    background-position: -38px -53px;\n  }\n  .o-auth {\n    background-position: -4px -53px;\n  }\n  .comment-captcha {\n    line-height: 50px;\n    font-size: 12px;\n  }\n  .comment-captcha input {\n    border-radius: 4px;\n    border: 1px solid #ccd0d7;\n    background-color: var(--bg1);\n    color: #45484b;\n    height: 22px;\n    line-height: 22px;\n    margin: 0 5px;\n    padding: 0 2px;\n    vertical-align: middle;\n  }\n  .operation {\n    position: absolute;\n    width: 18px;\n    top: 0;\n    right: 0;\n  }\n  .operation .spot {\n    width: 18px;\n    height: 18px;\n    cursor: pointer;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_7___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .spot:hover {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_8___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .opera-list {\n    display: none;\n    position: absolute;\n    width: 120px;\n    right: 0;\n    top: 20px;\n    z-index: 10;\n    background: var(--bg1);\n    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);\n    border-radius: 4px;\n    color: var(--text1);\n    font-size: 14px;\n    padding: 10px 0;\n    z-index: 999;\n  }\n  .operation .opera-list li {\n    padding: 0px 15px;\n    cursor: pointer;\n    height: 36px;\n    line-height: 36px;\n    transition: all 0.3s;\n  }\n  .operation .opera-list li:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .operation.btn-hover {\n    padding: 0;\n    border-radius: 0;\n    margin-right: 0;\n    display: block;\n  }\n  .operation.btn-hover:hover {\n    color: none;\n    background: none;\n  }\n  .list-item .user-face .bili-avatar {\n    width: 40px;\n    height: 40px;\n  }\n  .list-item .user-face .bili-avatar .bili-avatar-icon {\n    width: 14px;\n    height: 14px;\n  }\n  .list-item .con {\n    margin-left: calc(40px + 28px);\n  }\n  .list-item .con .user {\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .user .level-link .level {\n    height: 24px;\n  }\n  .list-item .con .text,\n  .list-item .con .text-con {\n    font-size: 15px;\n    line-height: 24px;\n  }\n  .list-item .con .text img,\n  .list-item .con .text-con img {\n    width: 50px;\n    height: 50px;\n  }\n  .list-item .con .text img.small,\n  .list-item .con .text-con img.small {\n    width: 20px;\n    height: 20px;\n  }\n  .list-item .con .info {\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .reply-box .reply-item {\n    padding: 8px 0;\n  }\n  .list-item .con .reply-box .reply-item .reply-face .bili-avatar,\n  .list-item .con .reply-box .reply-item .reply-face img {\n    width: 24px;\n    height: 24px;\n  }\n  .list-item .con .reply-box .reply-item .info {\n    margin-left: calc(24px + 10px);\n    font-size: 13px;\n    line-height: 18px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con {\n    margin-left: calc(24px + 10px);\n    line-height: 24px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .name {\n    font-size: 13px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .level-link .level {\n    height: 24px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .stick.up {\n    top: 7px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .text-con {\n    font-size: 15px;\n  }\n  .list-item .con .reply-box .view-more {\n    font-size: 13px;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (max-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) {\n  .comment-list .quote {\n    margin: 16px auto;\n    background: #f4f5f7;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    padding: 10px;\n    overflow: auto;\n  }\n  .comment-list .list-item .user-face {\n    float: left;\n    position: relative;\n    margin: 24px 0 0 5px;\n  }\n  .comment-list .list-item .user-face .bili-avatar .bili-avatar-img-radius {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .user-face .blacklist-face {\n    width: 48px;\n    height: 48px;\n    border-radius: 24px;\n  }\n  .comment-list .list-item .con {\n    position: relative;\n    padding: 22px 0 14px 0;\n    border-top: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .con .user {\n    display: flex;\n    align-items: center;\n    margin-bottom: 2px;\n  }\n  .comment-list .list-item .con .hidden-reply-toggle {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .quote {\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-wrap {\n    width: 100%;\n  }\n  .comment-list .list-item .con .vote-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .vote-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .vote-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIyLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMjggMjkiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI4IDI5OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+Cjx0aXRsZT5Hcm91cCAyPC90aXRsZT4KPGRlc2M+Q3JlYXRlZCB3aXRoIFNrZXRjaC48L2Rlc2M+CjxnIGlkPSJQYWdlLTEiIHN0eWxlPSJmaWxsOiMwMEExRDYiPgoJPGcgaWQ9IuWwgemdoiI+CgkJPGcgaWQ9Ikdyb3VwLTIiPgoJCQk8ZyBpZD0iUmVjdGFuZ2xlLTUiPgoJCQkJPHBhdGggZD0iTTMuMywyOC4zQzEuNSwyOC4zLDAsMjYuOSwwLDI1VjEwLjFjMC0xLjgsMS41LTMuMywzLjMtMy4zczMuMywxLjUsMy4zLDMuM1YyNUM2LjcsMjYuOSw1LjIsMjguMywzLjMsMjguM3ogTTMuMyw4CgkJCQkJYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMVYxMC4xQzUuNSw4LjksNC41LDgsMy4zLDh6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzFfIj4KCQkJCTxwYXRoIGQ9Ik0xNCwyOC40Yy0xLjgsMC0zLjMtMS41LTMuMy0zLjNWMy4zQzEwLjcsMS41LDEyLjIsMCwxNCwwczMuMywxLjUsMy4zLDMuM1YyNUMxNy4zLDI2LjksMTUuOCwyOC40LDE0LDI4LjR6IE0xNCwxLjIKCQkJCQljLTEuMiwwLTIuMSwxLTIuMSwyLjFWMjVjMCwxLjIsMSwyLjEsMi4xLDIuMWMxLjIsMCwyLjEtMSwyLjEtMi4xVjMuM0MxNi4xLDIuMiwxNS4yLDEuMiwxNCwxLjJ6Ii8+CgkJCTwvZz4KCQkJPGcgaWQ9IlJlY3RhbmdsZS01XzJfIj4KCQkJCTxwYXRoIGQ9Ik0yNC43LDI4LjRjLTEuOCwwLTMuMy0xLjUtMy4zLTMuM3YtNi44YzAtMS44LDEuNS0zLjMsMy4zLTMuM3MzLjMsMS41LDMuMywzLjNWMjVDMjgsMjYuOSwyNi41LDI4LjQsMjQuNywyOC40egoJCQkJCSBNMjQuNywxNi4xYy0xLjIsMC0yLjEsMS0yLjEsMi4xVjI1YzAsMS4yLDEsMi4xLDIuMSwyLjFzMi4xLTEsMi4xLTIuMXYtNi44QzI2LjgsMTcsMjUuOCwxNi4xLDI0LjcsMTYuMXoiLz4KCQkJPC9nPgoJCTwvZz4KCTwvZz4KPC9nPgo8L3N2Zz4K\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .vote-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    background-color: var(--bg1);\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .vote-container .text-area .vote-btn-box .vote-btn {\n    width: 54px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .vote-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item .con .lottery-container {\n    margin: 10px 0;\n    width: 520px;\n    height: 80px;\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n    cursor: pointer;\n  }\n  .comment-list .list-item .con .lottery-container .image-area {\n    width: 80px;\n    height: 80px;\n    float: left;\n  }\n  .comment-list .list-item .con .lottery-container .image-area .share-img {\n    width: 100%;\n    height: 100%;\n    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAABSNJREFUaAXtWW9oW1UUv+e9l6wd1tlZlQ4myloR/LPaRMWBbE6miFWbutR2ggyHuDmX1q+DYUHED0PXLOroQCaIThtiC/ObykSEyZa0dt2sIP7Z0E07aJmZTdq+d4/nvvQlMbsvyUtahvPdD7nnnXv+/c659757Xxhzm5uB/3cGYDHgB96euJ4Zc42aF6ejO1p+t7P5/Hs/1CX/nlmtemDm9u0tZ/sAuJ1sufyqAGwOj64zGO9HxHsth2TwZwC259Me/0cWL/hOoknXWYQx3ITIVMEHBpMMcJ/W6Nsb7QTDknXaVwygI5zoo2D2IENF6hQg1nJ3a9fY+MgzBPAgQ7ZcJkdgj2ugtEVDrRdk46V4FQEI9CfaKPAjwjgF8Bulc68K6kmD81sJ1EuUab/pGJQIMP4C8WroOamQHIByjCNrIJlnCVhbRg5iwz2+zSbt8McxgODgaa9+LvUrMtZI02BCq8UHoi/6L1p++46iNnZyZJCCCxA8muOoEMiLCMw3HPL/ZMmJPrA/8Tpy3C1oVYEnYyGfmRTxXG6Tl7+INp6ffVAEL0RQwd784AWv7yHQmVfbTuDM4AUPkL1WGLzgr72r9VWq3llBU1U6Re+0OQagM1xjOgHAG5exb2QOh3asnUTAM7kx9escnaNMsAjHFjhNuZHyKccAACBtmkeEab32WltXwC5ZY1wxpixa0l8neDTlMnYlAsVYjgFowEctg4Y+G7ToSvquyMgqCn2d0Kv2MlKJDccAorv84+TsqHDGEd9o3x9/pBLH3f3jN6U5fky6dWQvrXk8ByuxU3QXCg6iWj+dWFZoOMnYzek0nKCyX7MwRmsBviNjqaws4DbaPleaz4AfACp/LNBA74Q1CLCB5k294NH2uruhhoXN8byfOW+SH9q6YZamLe0b8iYFEByIr5hPs3cBocv2RSW3t+hcCv4CAd051OuPyoxLp5CeYgcoS1uudPAiYKryDbTVHg6ET9wpA6AVMsW0mT8/0kWatLBgUFHxLdrwHZ9V6CXgR4MfEPYB1HZFQdtDXmEM1jPNm1Wc4/sEop7e4E8R/5Q1ZvWXARBzfpJiFwII6puxl1uOW8JO+kAkkd1iEYxTsV3/fguXaysQTnxOQDopC6tlOtIplBVEw3Hms7qLRSCaMVAVpOtVBmA+6xvgMTvFrMwSEt0D8QaaC/cJF6Ao0tOqFFV7f/xb0rnfVATIARKMMhttAGK7NKcoraXKbJh3h8xxXVWUTbFQ6xeF7i9bA0IANO05ZuhHaB3fRhXwFCo5fa7KBr0DKBP7ZMGbsdoFs/XQLzXJS1PrOWcRCqCZFpE42/xpJy/h19JORkcFagBn6Fc36VI/iOLGdosphiwMXhgY2umbsFOTTqF8YdoFviIA60nwML1MtuSPFaNpF9qIBn5pyiisSXaclul3DMQbeYqdE2N0JH9iqNf3mUzO4skWsTX2n+hdAFe6TG4F3ApUmQF3ClWZwKrV3QpUncIqDbgVqDKBVatf/RWg+2jmGAwgPpEveVPnPDk/UPoILr3Q5EcJiKcJxMN0w3qU/hd4BdTMUTdfRkZzhndYfDqKP94RSZS8SyAH0A2929LTGH5v0XZ9yfvA0+HRZo7GGIGotTOyNHz4ZLjX11XKdsk1EOu550dQYCN9vxSfV8q7VZXyWmScMjpFN5lI3UptWxGx7FDJCmQliRD/zrDpVFmVmDG8ioZp89spLPckPXMGFbF4886uwA9DzX8Vl3JH3Qy4GbiqMvAPcV29qtEhK+0AAAAASUVORK5CYII=\") center center / 28px no-repeat var(--brand_blue_thin);\n  }\n  .comment-list .list-item .con .lottery-container .text-area {\n    width: 335px;\n    height: 80px;\n    padding: 0 90px 0 15px;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-orient: vertical;\n    -webkit-box-direction: normal;\n    -ms-flex-direction: column;\n    flex-direction: column;\n    position: relative;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-content {\n    color: var(--text1);\n    font-size: 14px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .text-desc {\n    padding-top: 10px;\n    color: var(--text3);\n    font-size: 12px;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box {\n    width: 90px;\n    height: 80px;\n    text-align: center;\n    position: absolute;\n    top: 0;\n    right: 0;\n    display: -webkit-box;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -ms-flex-pack: center;\n    justify-content: center;\n    -webkit-box-align: center;\n    -ms-flex-align: center;\n    align-items: center;\n  }\n  .comment-list .list-item .con .lottery-container .text-area .lottery-btn-box .lottery-btn {\n    width: 70px;\n    display: inline-block;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n    font-size: 13px;\n    line-height: 28px;\n  }\n  .comment-list .list-item .con .lottery-container:hover .text-area {\n    box-shadow: 0 3px 10px 0 rgba(213, 216, 219, 0.44);\n  }\n  .comment-list .list-item:last-child .con {\n    border-bottom: 1px solid var(--line_regular);\n  }\n  .comment-list .list-item .no-border {\n    border-top: none;\n  }\n  .comment-list .list-item .user {\n    font-family: PingFang SC, HarmonyOS_Medium, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 500;\n    -webkit-font-smoothing: antialiased;\n    display: block;\n    word-wrap: break-word;\n    position: relative;\n  }\n  .comment-list .list-item .user .name {\n    color: var(--text2);\n  }\n  .comment-list .list-item .user .level-link {\n    position: relative;\n    display: inline-block;\n    margin-left: 5px;\n  }\n  .comment-list .list-item .user .gap {\n    margin-right: 20px;\n  }\n  .comment-list .list-item .user .level {\n    position: relative;\n    display: inline-block;\n    width: 22px;\n  }\n  .comment-list .list-item .user > a {\n    vertical-align: bottom;\n  }\n  .comment-list .list-item .user .name:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .user .text-con {\n    color: var(--text1);\n    font-weight: normal;\n    margin-left: 9px;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n  }\n  .comment-list .list-item .identity {\n    display: inline-block;\n    width: 34px;\n    height: 18px;\n    background: var(--brand_pink);\n    border-radius: 2px;\n    text-align: center;\n    line-height: 18px;\n    font-style: normal;\n    color: var(--text_white);\n    margin-right: 5px;\n    font-weight: 400;\n  }\n  .comment-list .list-item .identity.true-love {\n    background: #f25d8e;\n  }\n  .comment-list .list-item .text {\n    text-shadow: none;\n    overflow: hidden;\n    word-wrap: break-word;\n    word-break: break-word;\n    white-space: pre-wrap;\n    margin-bottom: 5px;\n    color: var(--text1);\n  }\n  .comment-list .list-item .text img,\n  .comment-list .list-item .text-con img {\n    vertical-align: text-bottom;\n    padding: 0 1px;\n  }\n  .comment-list .list-item .text .jump-img,\n  .comment-list .list-item .text-con .jump-img {\n    width: 20px;\n    height: 20px;\n    vertical-align: middle;\n  }\n  .comment-list .list-item .text .vote-link,\n  .comment-list .list-item .text-con .vote-link,\n  .comment-list .list-item .text .lottery-link,\n  .comment-list .list-item .text-con .lottery-link,\n  .comment-list .list-item .text .comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url {\n    color: var(--text_link);\n    margin: 0 3px;\n  }\n  .comment-list .list-item .text .vote-link.comment-jump-url,\n  .comment-list .list-item .text-con .vote-link.comment-jump-url,\n  .comment-list .list-item .text .lottery-link.comment-jump-url,\n  .comment-list .list-item .text-con .lottery-link.comment-jump-url,\n  .comment-list .list-item .text .comment-jump-url.comment-jump-url,\n  .comment-list .list-item .text-con .comment-jump-url.comment-jump-url {\n    vertical-align: middle;\n    margin-left: 0;\n  }\n  .comment-list .list-item .text .vote-link img,\n  .comment-list .list-item .text-con .vote-link img,\n  .comment-list .list-item .text .lottery-link img,\n  .comment-list .list-item .text-con .lottery-link img,\n  .comment-list .list-item .text .comment-jump-url img,\n  .comment-list .list-item .text-con .comment-jump-url img {\n    width: 16px;\n    height: 16px;\n    margin-right: 3px;\n    vertical-align: text-top;\n  }\n  .comment-list .list-item .text .vote-link:hover,\n  .comment-list .list-item .text-con .vote-link:hover,\n  .comment-list .list-item .text .lottery-link:hover,\n  .comment-list .list-item .text-con .lottery-link:hover,\n  .comment-list .list-item .text .comment-jump-url:hover,\n  .comment-list .list-item .text-con .comment-jump-url:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item .info {\n    display: flex;\n    flex-wrap: wrap;\n    position: relative;\n    align-items: center;\n    color: var(--text3);\n    margin-bottom: 0;\n  }\n  .comment-list .list-item .info > span {\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .btn-hover {\n    border-radius: 4px;\n    margin-right: 15px;\n    cursor: pointer;\n    display: inline-block;\n  }\n  .comment-list .list-item .info .btn-hover:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .btn-hide {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .btn-hide-re {\n    visibility: hidden;\n  }\n  .comment-list .list-item .info .plad a {\n    color: var(--text3);\n  }\n  .comment-list .list-item .info .plad a:hover {\n    color: #00a1d6;\n  }\n  .comment-list .list-item .info .like {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n  }\n  .comment-list .list-item .info .like i {\n    width: 16px;\n    height: 16px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .like.liked:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_2___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate {\n    display: flex;\n    align-items: center;\n    cursor: pointer;\n    margin-right: 19px;\n  }\n  .comment-list .list-item .info .hate i {\n    width: 16px;\n    height: 16px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_3___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_4___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .hate.hated:hover i {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_5___ + ") no-repeat;\n    background-size: cover;\n  }\n  .comment-list .list-item .info .reply-tags {\n    width: 100%;\n    margin-top: 10px;\n    font-size: 0;\n    border-radius: 2px;\n  }\n  .comment-list .list-item .info .reply-tags span {\n    display: inline-block;\n    margin-right: 10px;\n    padding: 5px 6px;\n    line-height: 14px;\n    background: var(--bg3);\n    border-radius: 2px;\n    font-size: 12px;\n    font-weight: 400;\n    color: var(--text2);\n  }\n  .comment-list .list-item .blacklist-font-color {\n    color: var(--text2);\n    margin-right: 10px;\n  }\n  .comment-list .list-item .reply-box {\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .reply-item {\n    position: relative;\n    padding: 8px 0;\n  }\n  .comment-list .list-item .reply-box .reply-item .hidden-reply-toggle {\n    color: var(--text2);\n  }\n  .comment-list .list-item .reply-box .reply-item .quote {\n    font-weight: normal;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face {\n    position: absolute;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar,\n  .comment-list .list-item .reply-box .reply-item .reply-face img {\n    border-radius: 50%;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar {\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-face .bili-avatar .bili-avatar-icon {\n    width: 12px;\n    height: 12px;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con {\n    display: inline-block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user {\n    display: block;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user .name {\n    position: relative;\n    vertical-align: text-bottom;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .user > a {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item .reply-con .stick.up {\n    position: relative;\n  }\n  .comment-list .list-item .reply-box .reply-item:hover .btn-hide-re {\n    visibility: visible;\n  }\n  .comment-list .list-item .reply-box .view-more {\n    color: var(--text2);\n    margin-top: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more {\n    color: var(--text2);\n    padding: 2px 3px;\n    border-radius: 4px;\n  }\n  .comment-list .list-item .reply-box .view-more .btn-more:hover {\n    color: var(--brand_blue);\n  }\n  .comment-list .list-item:hover .btn-hide {\n    visibility: visible;\n  }\n  .comment-list .list-item:first-child .con {\n    border-top: none;\n  }\n  .comment-list.has-limit .list-item:last-child > .con {\n    padding-bottom: 22px;\n  }\n  .reply-fold-tip {\n    padding-top: 20px;\n    margin-left: 85px;\n    border-top: 1px solid var(--line_regular);\n  }\n  .reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text3);\n  }\n  .reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  .sub-reply-fold-tip {\n    margin-bottom: 20px;\n  }\n  .sub-reply-fold-tip a {\n    font-size: 12px;\n    color: var(--text3);\n  }\n  .sub-reply-fold-tip a:hover {\n    color: #00a1d6;\n  }\n  /*vip红名*/\n  .vip-red-name {\n    color: var(--brand_pink) !important;\n  }\n  .vip-green-name {\n    color: #62c076 !important;\n  }\n  /*置顶*/\n  .stick {\n    position: relative;\n    top: -1px;\n    min-width: 30px;\n    display: inline-block;\n    text-align: center;\n    font-size: 12px;\n    color: var(--brand_pink);\n    font-weight: normal;\n    line-height: 16px;\n    height: 18px;\n    border: 1px solid var(--brand_pink);\n    border-radius: 3px;\n    margin-right: 5px;\n    box-sizing: border-box;\n    vertical-align: inherit;\n  }\n  .stick:after {\n    content: '';\n  }\n  .stick.assist,\n  .stick.up {\n    min-width: 0px;\n    width: 18px;\n    margin-right: 0px;\n    margin-left: 8px;\n    height: 12px;\n    font-size: 9px;\n    border-radius: 2px;\n    background-color: var(--brand_pink);\n    color: var(--text_white);\n    border-color: var(--brand_pink);\n  }\n  .stick.assist .tinyfont,\n  .stick.up .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n  }\n  .stick.assist {\n    background-color: var(--bg1);\n    color: var(--brand_pink);\n    padding: 1px;\n  }\n  .stick.assist .tinyfont {\n    font-size: 20px;\n    line-height: 18px;\n  }\n  .stick.up {\n    position: relative;\n    top: 0;\n  }\n  .stick.up .tinyfont {\n    font-size: 20px;\n    line-height: 20px;\n  }\n  .medal {\n    display: inline-block;\n    text-align: center;\n    border-width: 0px;\n    vertical-align: middle;\n    margin-left: 8px;\n  }\n  .medal .true-love-flag {\n    position: absolute;\n    transform: translate(-50%, -1px);\n    width: 16px;\n    height: 16px;\n  }\n  .medal .true-love,\n  .medal .medal-level {\n    float: left;\n    box-sizing: content-box;\n    text-align: center;\n    height: 12px;\n    line-height: 12px;\n    border-width: 0.5px;\n    border-color: #f25d8e;\n    border-style: solid;\n    border-bottom-left-radius: 1px;\n    border-top-left-radius: 1px;\n    color: #f25d8e;\n  }\n  .medal .true-love .tinyfont,\n  .medal .medal-level .tinyfont {\n    width: 200%;\n    height: 200%;\n    font-weight: 400;\n    transform-origin: center;\n    transform: scale(0.5) translate(-50%, -50%);\n    font-size: 20px;\n    line-height: 24px;\n  }\n  .medal .true-love {\n    border-right-width: 0px;\n    padding: 0 2px 0 2px;\n  }\n  .medal .medal-level {\n    border-right-width: 0.5px;\n    border-left-width: 0.5px;\n    border-bottom-right-radius: 1px;\n    border-top-right-radius: 1px;\n    border-bottom-left-radius: 0px;\n    border-top-left-radius: 0px;\n    width: 14px;\n  }\n  /*热门评论分割线*/\n  .hot-line {\n    text-align: center;\n    border-bottom: 1px solid var(--line_regular);\n    position: relative;\n    margin: 20px 0 20px 85px;\n    font-size: 12px;\n  }\n  .hot-line span {\n    position: absolute;\n    top: -7px;\n    margin-left: -115px;\n    padding: 0 20px;\n    background: var(--bg1);\n  }\n  .hot-line a {\n    padding: 5px 6px;\n    border-radius: 4px;\n  }\n  .hot-line a:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .no-more-reply {\n    color: var(--text3);\n    text-align: center;\n    padding: 30px 0;\n    font-size: 12px;\n  }\n  /*勋章*/\n  .nameplate {\n    position: relative;\n    display: inline-block;\n    vertical-align: middle;\n    margin: 0 8px;\n    z-index: 1;\n  }\n  .nameplate .nameplate-icon {\n    display: inline-block;\n  }\n  .nameplate .nameplate-icon img {\n    width: 20px;\n  }\n  .nameplate .nameplate-card {\n    display: none;\n    position: absolute;\n    left: 42px;\n    top: 1px;\n    width: 322px;\n    padding: 22px 20px;\n    background: var(--bg1);\n    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.16);\n    border: 1px solid var(--line_regular);\n    border-radius: 4px;\n  }\n  .nameplate .nameplate-card .nameplate-pic {\n    width: 62px;\n    height: 62px;\n    overflow: hidden;\n    float: left;\n  }\n  .nameplate .nameplate-card .nameplate-text {\n    float: left;\n    width: 219px;\n    margin-left: 20px;\n    padding-left: 20px;\n    border-left: 1px solid var(--line_regular);\n    font-weight: normal;\n  }\n  .nameplate .nameplate-card .nameplate-text p {\n    margin: 3px 0;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n    font-size: 14px;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-title {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type {\n    color: var(--text3);\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a {\n    float: right;\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-text .n-type a:hover {\n    color: #00a1d6;\n  }\n  .nameplate .nameplate-card .nameplate-arrow {\n    position: absolute;\n    width: 7px;\n    height: 13px;\n    left: -7px;\n    top: 10px;\n    background: url('//static.hdslb.com/images/v2images/info_arrows.png');\n  }\n  .sailing {\n    position: absolute;\n    right: -1px;\n    top: 50%;\n    margin-top: -25px;\n    user-select: none;\n  }\n  .sailing .sailing-img {\n    height: 48px;\n  }\n  .sailing .sailing-info {\n    font-family: fanscard;\n    display: inline-block;\n    position: absolute;\n    left: 238px;\n    top: 12px;\n    line-height: 16px;\n    font-size: 12px;\n    transform: scale(0.7);\n    transform-origin: left top;\n    word-break: keep-all;\n  }\n  .legalize {\n    height: 20px;\n    width: 20px;\n    display: inline-block;\n    position: absolute;\n    top: 30px;\n    left: 30px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_6___ + ");\n    background-repeat: no-repeat;\n  }\n  .p-auth {\n    background-position: -38px -53px;\n  }\n  .o-auth {\n    background-position: -4px -53px;\n  }\n  .comment-captcha {\n    line-height: 50px;\n    font-size: 12px;\n  }\n  .comment-captcha input {\n    border-radius: 4px;\n    border: 1px solid #ccd0d7;\n    background-color: var(--bg1);\n    color: #45484b;\n    height: 22px;\n    line-height: 22px;\n    margin: 0 5px;\n    padding: 0 2px;\n    vertical-align: middle;\n  }\n  .operation {\n    position: absolute;\n    width: 18px;\n    top: 0;\n    right: 0;\n  }\n  .operation .spot {\n    width: 18px;\n    height: 18px;\n    cursor: pointer;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_7___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .spot:hover {\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_8___ + ") no-repeat;\n    background-size: cover;\n  }\n  .operation .opera-list {\n    display: none;\n    position: absolute;\n    width: 120px;\n    right: 0;\n    top: 20px;\n    z-index: 10;\n    background: var(--bg1);\n    box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);\n    border-radius: 4px;\n    color: var(--text1);\n    font-size: 14px;\n    padding: 10px 0;\n    z-index: 999;\n  }\n  .operation .opera-list li {\n    padding: 0px 15px;\n    cursor: pointer;\n    height: 36px;\n    line-height: 36px;\n    transition: all 0.3s;\n  }\n  .operation .opera-list li:hover {\n    background: #e5e9ef;\n    color: #00a1d6;\n  }\n  .operation.btn-hover {\n    padding: 0;\n    border-radius: 0;\n    margin-right: 0;\n    display: block;\n  }\n  .operation.btn-hover:hover {\n    color: none;\n    background: none;\n  }\n  .list-item .user-face .bili-avatar {\n    width: 48px;\n    height: 48px;\n  }\n  .list-item .user-face .bili-avatar .bili-avatar-icon {\n    width: 18px;\n    height: 18px;\n  }\n  .list-item .con {\n    margin-left: calc(48px + 28px);\n  }\n  .list-item .con .user {\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .user .level-link .level {\n    height: 26px;\n  }\n  .list-item .con .text,\n  .list-item .con .text-con {\n    font-size: 18px;\n    line-height: 26px;\n  }\n  .list-item .con .text img,\n  .list-item .con .text-con img {\n    width: 50px;\n    height: 50px;\n  }\n  .list-item .con .text img.small,\n  .list-item .con .text-con img.small {\n    width: 24px;\n    height: 24px;\n  }\n  .list-item .con .info {\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .reply-box .reply-item {\n    padding: 10px 0;\n  }\n  .list-item .con .reply-box .reply-item .reply-face .bili-avatar,\n  .list-item .con .reply-box .reply-item .reply-face img {\n    width: 30px;\n    height: 30px;\n  }\n  .list-item .con .reply-box .reply-item .info {\n    margin-left: calc(30px + 10px);\n    font-size: 14px;\n    line-height: 20px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con {\n    margin-left: calc(30px + 10px);\n    line-height: 26px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .name {\n    font-size: 14px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .level-link .level {\n    height: 26px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .stick.up {\n    top: 6px;\n  }\n  .list-item .con .reply-box .reply-item .reply-con .user .text-con {\n    font-size: 18px;\n  }\n  .list-item .con .reply-box .view-more {\n    font-size: 14px;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .comment-list .list-item .user {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1681px) and (-webkit-max-device-pixel-ratio: 1) {\n  .nameplate .nameplate-card .nameplate-text .n-name {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/send.less":
/*!******************************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/send.less ***!
  \******************************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../../images/icons-comment.png */ "./static/images/icons-comment.png");
var ___CSS_LOADER_URL_IMPORT_1___ = __webpack_require__(/*! ../../../images/send_btn_icon.svg */ "./static/images/send_btn_icon.svg");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
var ___CSS_LOADER_URL_REPLACEMENT_1___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_1___);
// Module
exports.push([module.id, "@media screen and (max-width: 1681px) {\n  .comment-list .list-item .con .comment-send {\n    position: relative;\n    margin: 10px 0;\n    padding-top: 15px;\n  }\n  .comment-list .list-item .con .comment-send .user-face {\n    position: absolute;\n    top: 0;\n    display: flex;\n    justify-items: center;\n    align-items: center;\n    height: 50px;\n    margin-top: 15px;\n  }\n  .comment-send-lite-mask {\n    display: none;\n    position: fixed;\n    bottom: 41px;\n    height: 36px;\n    left: 80px;\n    background-color: rgba(0, 0, 0, 0.08);\n    filter: blur(10px);\n    border-radius: 50%;\n    z-index: 1;\n    transition: 0.2s;\n  }\n  .comment-send-lite-mask.focus {\n    bottom: 96px;\n  }\n  .comment-send,\n  .comment-send-lite {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    position: relative;\n  }\n  .comment-send.comment-send-lite,\n  .comment-send-lite.comment-send-lite {\n    position: fixed;\n    bottom: 0;\n    left: 0px;\n    right: 0px;\n    background: var(--bg1);\n    z-index: 99;\n    display: none;\n    box-sizing: border-box;\n    border-top: 0.5px solid var(--line_regular);\n  }\n  .comment-send.comment-send-lite .textarea-container .ipt-txt,\n  .comment-send-lite.comment-send-lite .textarea-container .ipt-txt {\n    position: relative;\n    z-index: 2;\n    height: 40px;\n    line-height: 28px;\n  }\n  .comment-send.comment-send-lite .textarea-container .baffle,\n  .comment-send-lite.comment-send-lite .textarea-container .baffle {\n    height: 40px;\n    line-height: 40px;\n  }\n  .comment-send .user-face,\n  .comment-send-lite .user-face {\n    position: absolute;\n    top: 0;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 50px;\n  }\n  .comment-send .user-face .user-head,\n  .comment-send-lite .user-face .user-head {\n    border-radius: 50%;\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-send .user-face .pendant,\n  .comment-send-lite .user-face .pendant {\n    width: 86px;\n    height: 86px;\n    border-radius: 0;\n    position: absolute;\n    top: -19px;\n    left: -19px;\n  }\n  .comment-send .textarea-container,\n  .comment-send-lite .textarea-container {\n    position: relative;\n    margin-right: 80px;\n  }\n  .comment-send .textarea-container .ipt-txt,\n  .comment-send-lite .textarea-container .ipt-txt {\n    display: inline-block;\n    box-sizing: border-box;\n    background-color: var(--bg3);\n    border: 1px solid var(--bg3);\n    overflow: auto;\n    border-radius: 6px;\n    color: var(--text1);\n    width: 100%;\n    height: 50px;\n    transition: 0.2s;\n    padding: 5px 10px;\n    line-height: 38px;\n    outline: none;\n    vertical-align: middle;\n  }\n  .comment-send .textarea-container .ipt-arrow,\n  .comment-send-lite .textarea-container .ipt-arrow {\n    position: absolute;\n    left: -12px;\n    top: 22px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") -395px -340px no-repeat;\n    width: 13px;\n    height: 20px;\n    display: inline-block;\n    z-index: 2;\n  }\n  .comment-send .textarea-container:hover textarea,\n  .comment-send-lite .textarea-container:hover textarea,\n  .comment-send .textarea-container.focus textarea,\n  .comment-send-lite .textarea-container.focus textarea {\n    background-color: var(--bg1);\n    border: 1px solid var(--graph_weak);\n  }\n  .comment-send .textarea-container:hover .ipt-arrow,\n  .comment-send-lite .textarea-container:hover .ipt-arrow,\n  .comment-send .textarea-container.focus .ipt-arrow,\n  .comment-send-lite .textarea-container.focus .ipt-arrow {\n    background-position: -395px -404px;\n  }\n  .comment-send .textarea-container.error textarea,\n  .comment-send-lite .textarea-container.error textarea {\n    background-color: var(--bg1);\n    border: 1px solid var(--stress_red);\n  }\n  .comment-send .textarea-container.error .ipt-arrow,\n  .comment-send-lite .textarea-container.error .ipt-arrow {\n    background-position: -395px -474px;\n  }\n  .comment-send .comment-submit,\n  .comment-send-lite .comment-submit {\n    width: 70px;\n    height: 100%;\n    position: absolute;\n    right: -80px;\n    top: 0;\n    padding: 4px 15px;\n    font-size: 16px;\n    background-color: transparent;\n    color: var(--text_white);\n    border-radius: 4px;\n    text-align: center;\n    vertical-align: top;\n    cursor: pointer;\n    border: none;\n    transition: 0.1s;\n    user-select: none;\n    outline: none;\n  }\n  .comment-send .comment-submit .submit-text,\n  .comment-send-lite .comment-submit .submit-text {\n    position: relative;\n    z-index: 1;\n  }\n  .comment-send .comment-submit::after,\n  .comment-send-lite .comment-submit::after {\n    content: '';\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    background-color: var(--brand_blue);\n    top: 0;\n    left: 0;\n    border-radius: 4px;\n    opacity: 0.5;\n  }\n  .comment-send .comment-submit:hover::after,\n  .comment-send-lite .comment-submit:hover::after {\n    opacity: 1;\n  }\n  .comment-send .comment-submit.disabled,\n  .comment-send-lite .comment-submit.disabled {\n    color: var(--text3);\n    background-color: var(--bg3);\n    border-color: var(--bg3);\n    padding: 4px 10px;\n  }\n  .comment-send .comment-emoji,\n  .comment-send-lite .comment-emoji {\n    display: none;\n    align-items: center;\n    justify-content: center;\n    box-sizing: border-box;\n    padding: 0;\n    width: 67px;\n    height: 24px;\n    color: var(--text3);\n    border: 1px solid var(--bg3);\n    border-radius: 4px;\n    position: relative;\n    font-size: 14px;\n    margin-left: 86px;\n    margin-top: 5px;\n    cursor: pointer;\n  }\n  .comment-send .comment-emoji .face,\n  .comment-send-lite .comment-emoji .face {\n    width: 17px;\n    height: 17px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ");\n  }\n  .comment-send .baffle,\n  .comment-send-lite .baffle {\n    display: none;\n  }\n  .comment-send.no-login ::-webkit-input-placeholder,\n  .comment-send-lite.no-login ::-webkit-input-placeholder {\n    color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container textarea,\n  .comment-send-lite.no-login .textarea-container textarea {\n    background-color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container .ipt-arrow {\n    background-position: -395px -538px;\n  }\n  .comment-send.no-login .textarea-container:hover textarea,\n  .comment-send-lite.no-login .textarea-container:hover textarea,\n  .comment-send.no-login .textarea-container.focus textarea,\n  .comment-send-lite.no-login .textarea-container.focus textarea {\n    background-color: var(--bg3);\n    border-color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container:hover .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container:hover .ipt-arrow,\n  .comment-send.no-login .textarea-container.focus .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container.focus .ipt-arrow {\n    background-position: -395px -538px;\n  }\n  .comment-send.no-login .comment-submit .submit-text,\n  .comment-send-lite.no-login .comment-submit .submit-text {\n    cursor: default;\n    color: var(--text3);\n  }\n  .comment-send.no-login .comment-submit::after,\n  .comment-send-lite.no-login .comment-submit::after {\n    cursor: default;\n    background-color: var(--bg3) !important;\n    opacity: 1;\n  }\n  .comment-send.no-login .comment-emoji,\n  .comment-send-lite.no-login .comment-emoji {\n    background-color: var(--bg3);\n  }\n  .comment-send.no-login .baffle,\n  .comment-send-lite.no-login .baffle {\n    display: block;\n    position: absolute;\n    height: 50px;\n    width: 100%;\n    top: 0;\n    font-size: 12px;\n    border-radius: 4px;\n    text-align: center;\n    color: var(--text3);\n    background-color: var(--bg3);\n    overflow: hidden;\n    line-height: 50px;\n    z-index: 3;\n  }\n  .comment-send.no-login .baffle .b-btn,\n  .comment-send-lite.no-login .baffle .b-btn {\n    padding: 4px 9px;\n    margin: 0 3px;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n  }\n  .comment-send.no-login .baffle .b-btn:hover,\n  .comment-send-lite.no-login .baffle .b-btn:hover {\n    background-color: #00b5e5;\n  }\n  .comment-send .textarea-container.focus .ipt-txt,\n  .comment-send-lite .textarea-container.focus .ipt-txt {\n    height: 65px;\n    background-color: var(--bg1);\n    border: 1px solid var(--graph_weak);\n  }\n  .comment-send .textarea-container.focus + .comment-emoji,\n  .comment-send-lite .textarea-container.focus + .comment-emoji {\n    display: flex;\n  }\n  .comment-send.send-active .textarea-container .ipt-txt,\n  .comment-send-lite.send-active .textarea-container .ipt-txt {\n    height: 65px;\n  }\n  .comment-send.send-active .comment-emoji,\n  .comment-send-lite.send-active .comment-emoji {\n    display: flex;\n  }\n  .comment-send {\n    margin-bottom: calc(40px * 0.35);\n  }\n  .comment-send .user-face,\n  .comment-send-lite .user-face {\n    width: calc(1.7 * 40px);\n  }\n  .comment-send .user-face.widescreen,\n  .comment-send-lite .user-face.widescreen {\n    display: none;\n  }\n  .comment-send .textarea-container,\n  .comment-send-lite .textarea-container {\n    width: calc(100% - (calc(1.7 * 40px) + 80px));\n    margin-left: calc(1.7 * 40px);\n  }\n  .comment-send .textarea-container .ipt-txt,\n  .comment-send-lite .textarea-container .ipt-txt {\n    font-size: 13px;\n  }\n  .comment-send .comment-emoji,\n  .comment-send-lite .comment-emoji {\n    margin-left: calc(1.7 * 40px);\n  }\n  .comment-send.send-active .textarea-container .ipt-txt,\n  .comment-send-lite.send-active .textarea-container .ipt-txt {\n    line-height: normal;\n  }\n  .comment-send.send-active .textarea-container .ipt-txt.focus,\n  .comment-send-lite.send-active .textarea-container .ipt-txt.focus {\n    background-color: var(--bg1);\n    border: 1px solid var(--graph_weak);\n  }\n  .comment-send.send-active .textarea-container .btn-active,\n  .comment-send-lite.send-active .textarea-container .btn-active {\n    background-color: var(--brand_blue);\n  }\n  .comment-send-lite {\n    padding-top: calc((1.7 * 40px - 40px) / 2);\n    padding-bottom: calc((1.7 * 40px - 40px) / 2);\n  }\n  .comment-send-lite .user-face {\n    height: calc(1.7 * 40px);\n  }\n  .comment-send-lite-mask {\n    bottom: calc(1.7 * 40px - 0.7 * 36px);\n  }\n}\n@media screen and (min-width: 1681px) {\n  .comment-list .list-item .con .comment-send {\n    position: relative;\n    margin: 10px 0;\n    padding-top: 15px;\n  }\n  .comment-list .list-item .con .comment-send .user-face {\n    position: absolute;\n    top: 0;\n    display: flex;\n    justify-items: center;\n    align-items: center;\n    height: 50px;\n    margin-top: 15px;\n  }\n  .comment-send-lite-mask {\n    display: none;\n    position: fixed;\n    bottom: 41px;\n    height: 36px;\n    left: 80px;\n    background-color: rgba(0, 0, 0, 0.08);\n    filter: blur(10px);\n    border-radius: 50%;\n    z-index: 1;\n    transition: 0.2s;\n  }\n  .comment-send-lite-mask.focus {\n    bottom: 96px;\n  }\n  .comment-send,\n  .comment-send-lite {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    position: relative;\n  }\n  .comment-send.comment-send-lite,\n  .comment-send-lite.comment-send-lite {\n    position: fixed;\n    bottom: 0;\n    left: 0px;\n    right: 0px;\n    background: var(--bg1);\n    z-index: 99;\n    display: none;\n    box-sizing: border-box;\n    border-top: 0.5px solid var(--line_regular);\n  }\n  .comment-send.comment-send-lite .textarea-container .ipt-txt,\n  .comment-send-lite.comment-send-lite .textarea-container .ipt-txt {\n    position: relative;\n    z-index: 2;\n    height: 40px;\n    line-height: 28px;\n  }\n  .comment-send.comment-send-lite .textarea-container .baffle,\n  .comment-send-lite.comment-send-lite .textarea-container .baffle {\n    height: 40px;\n    line-height: 40px;\n  }\n  .comment-send .user-face,\n  .comment-send-lite .user-face {\n    position: absolute;\n    top: 0;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    height: 50px;\n  }\n  .comment-send .user-face .user-head,\n  .comment-send-lite .user-face .user-head {\n    border-radius: 50%;\n    margin: -1px;\n    border: 1px solid var(--bg3);\n  }\n  .comment-send .user-face .pendant,\n  .comment-send-lite .user-face .pendant {\n    width: 86px;\n    height: 86px;\n    border-radius: 0;\n    position: absolute;\n    top: -19px;\n    left: -19px;\n  }\n  .comment-send .textarea-container,\n  .comment-send-lite .textarea-container {\n    position: relative;\n    margin-right: 80px;\n  }\n  .comment-send .textarea-container .ipt-txt,\n  .comment-send-lite .textarea-container .ipt-txt {\n    display: inline-block;\n    box-sizing: border-box;\n    background-color: var(--bg3);\n    border: 1px solid var(--bg3);\n    overflow: auto;\n    border-radius: 6px;\n    color: var(--text1);\n    width: 100%;\n    height: 50px;\n    transition: 0.2s;\n    padding: 5px 10px;\n    line-height: 38px;\n    outline: none;\n    vertical-align: middle;\n  }\n  .comment-send .textarea-container .ipt-arrow,\n  .comment-send-lite .textarea-container .ipt-arrow {\n    position: absolute;\n    left: -12px;\n    top: 22px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") -395px -340px no-repeat;\n    width: 13px;\n    height: 20px;\n    display: inline-block;\n    z-index: 2;\n  }\n  .comment-send .textarea-container:hover textarea,\n  .comment-send-lite .textarea-container:hover textarea,\n  .comment-send .textarea-container.focus textarea,\n  .comment-send-lite .textarea-container.focus textarea {\n    background-color: var(--bg1);\n    border: 1px solid var(--graph_weak);\n  }\n  .comment-send .textarea-container:hover .ipt-arrow,\n  .comment-send-lite .textarea-container:hover .ipt-arrow,\n  .comment-send .textarea-container.focus .ipt-arrow,\n  .comment-send-lite .textarea-container.focus .ipt-arrow {\n    background-position: -395px -404px;\n  }\n  .comment-send .textarea-container.error textarea,\n  .comment-send-lite .textarea-container.error textarea {\n    background-color: var(--bg1);\n    border: 1px solid var(--stress_red);\n  }\n  .comment-send .textarea-container.error .ipt-arrow,\n  .comment-send-lite .textarea-container.error .ipt-arrow {\n    background-position: -395px -474px;\n  }\n  .comment-send .comment-submit,\n  .comment-send-lite .comment-submit {\n    width: 70px;\n    height: 100%;\n    position: absolute;\n    right: -80px;\n    top: 0;\n    padding: 4px 15px;\n    font-size: 16px;\n    background-color: transparent;\n    color: var(--text_white);\n    border-radius: 4px;\n    text-align: center;\n    vertical-align: top;\n    cursor: pointer;\n    border: none;\n    transition: 0.1s;\n    user-select: none;\n    outline: none;\n  }\n  .comment-send .comment-submit .submit-text,\n  .comment-send-lite .comment-submit .submit-text {\n    position: relative;\n    z-index: 1;\n  }\n  .comment-send .comment-submit::after,\n  .comment-send-lite .comment-submit::after {\n    content: '';\n    position: absolute;\n    width: 100%;\n    height: 100%;\n    background-color: var(--brand_blue);\n    top: 0;\n    left: 0;\n    border-radius: 4px;\n    opacity: 0.5;\n  }\n  .comment-send .comment-submit:hover::after,\n  .comment-send-lite .comment-submit:hover::after {\n    opacity: 1;\n  }\n  .comment-send .comment-submit.disabled,\n  .comment-send-lite .comment-submit.disabled {\n    color: var(--text3);\n    background-color: var(--bg3);\n    border-color: var(--bg3);\n    padding: 4px 10px;\n  }\n  .comment-send .comment-emoji,\n  .comment-send-lite .comment-emoji {\n    display: none;\n    align-items: center;\n    justify-content: center;\n    box-sizing: border-box;\n    padding: 0;\n    width: 67px;\n    height: 24px;\n    color: var(--text3);\n    border: 1px solid var(--bg3);\n    border-radius: 4px;\n    position: relative;\n    font-size: 14px;\n    margin-left: 86px;\n    margin-top: 5px;\n    cursor: pointer;\n  }\n  .comment-send .comment-emoji .face,\n  .comment-send-lite .comment-emoji .face {\n    width: 17px;\n    height: 17px;\n    margin-right: 5px;\n    background: url(" + ___CSS_LOADER_URL_REPLACEMENT_1___ + ");\n  }\n  .comment-send .baffle,\n  .comment-send-lite .baffle {\n    display: none;\n  }\n  .comment-send.no-login ::-webkit-input-placeholder,\n  .comment-send-lite.no-login ::-webkit-input-placeholder {\n    color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container textarea,\n  .comment-send-lite.no-login .textarea-container textarea {\n    background-color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container .ipt-arrow {\n    background-position: -395px -538px;\n  }\n  .comment-send.no-login .textarea-container:hover textarea,\n  .comment-send-lite.no-login .textarea-container:hover textarea,\n  .comment-send.no-login .textarea-container.focus textarea,\n  .comment-send-lite.no-login .textarea-container.focus textarea {\n    background-color: var(--bg3);\n    border-color: var(--bg3);\n  }\n  .comment-send.no-login .textarea-container:hover .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container:hover .ipt-arrow,\n  .comment-send.no-login .textarea-container.focus .ipt-arrow,\n  .comment-send-lite.no-login .textarea-container.focus .ipt-arrow {\n    background-position: -395px -538px;\n  }\n  .comment-send.no-login .comment-submit .submit-text,\n  .comment-send-lite.no-login .comment-submit .submit-text {\n    cursor: default;\n    color: var(--text3);\n  }\n  .comment-send.no-login .comment-submit::after,\n  .comment-send-lite.no-login .comment-submit::after {\n    cursor: default;\n    background-color: var(--bg3) !important;\n    opacity: 1;\n  }\n  .comment-send.no-login .comment-emoji,\n  .comment-send-lite.no-login .comment-emoji {\n    background-color: var(--bg3);\n  }\n  .comment-send.no-login .baffle,\n  .comment-send-lite.no-login .baffle {\n    display: block;\n    position: absolute;\n    height: 50px;\n    width: 100%;\n    top: 0;\n    font-size: 12px;\n    border-radius: 4px;\n    text-align: center;\n    color: var(--text3);\n    background-color: var(--bg3);\n    overflow: hidden;\n    line-height: 50px;\n    z-index: 3;\n  }\n  .comment-send.no-login .baffle .b-btn,\n  .comment-send-lite.no-login .baffle .b-btn {\n    padding: 4px 9px;\n    margin: 0 3px;\n    color: var(--text_white);\n    background-color: var(--brand_blue);\n    border-radius: 4px;\n  }\n  .comment-send.no-login .baffle .b-btn:hover,\n  .comment-send-lite.no-login .baffle .b-btn:hover {\n    background-color: #00b5e5;\n  }\n  .comment-send .textarea-container.focus .ipt-txt,\n  .comment-send-lite .textarea-container.focus .ipt-txt {\n    height: 65px;\n    background-color: var(--bg1);\n    border: 1px solid var(--graph_weak);\n  }\n  .comment-send .textarea-container.focus + .comment-emoji,\n  .comment-send-lite .textarea-container.focus + .comment-emoji {\n    display: flex;\n  }\n  .comment-send.send-active .textarea-container .ipt-txt,\n  .comment-send-lite.send-active .textarea-container .ipt-txt {\n    height: 65px;\n  }\n  .comment-send.send-active .comment-emoji,\n  .comment-send-lite.send-active .comment-emoji {\n    display: flex;\n  }\n  .comment-send {\n    margin-bottom: calc(48px * 0.35);\n  }\n  .comment-send .user-face,\n  .comment-send-lite .user-face {\n    width: calc(1.7 * 48px);\n  }\n  .comment-send .user-face.normal,\n  .comment-send-lite .user-face.normal {\n    display: none;\n  }\n  .comment-send .textarea-container,\n  .comment-send-lite .textarea-container {\n    width: calc(100% - (calc(1.7 * 48px) + 80px));\n    margin-left: calc(1.7 * 48px);\n  }\n  .comment-send .textarea-container .ipt-txt,\n  .comment-send-lite .textarea-container .ipt-txt {\n    font-size: 14px;\n  }\n  .comment-send .comment-emoji,\n  .comment-send-lite .comment-emoji {\n    margin-left: calc(1.7 * 48px);\n  }\n  .comment-send.send-active .textarea-container .ipt-txt,\n  .comment-send-lite.send-active .textarea-container .ipt-txt {\n    line-height: normal;\n  }\n  .comment-send.send-active .textarea-container .btn-active,\n  .comment-send-lite.send-active .textarea-container .btn-active {\n    background-color: var(--brand_blue);\n  }\n  .comment-send-lite {\n    padding-top: calc((1.7 * 48px - 40px) / 2);\n    padding-bottom: calc((1.7 * 48px - 40px) / 2);\n  }\n  .comment-send-lite .user-face {\n    height: calc(1.7 * 48px);\n  }\n  .comment-send-lite-mask {\n    bottom: calc(1.7 * 48px - 0.7 * 36px);\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/paging.less":
/*!********************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/paging.less ***!
  \********************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
exports = ___CSS_LOADER_API_IMPORT___(false);
// Module
exports.push([module.id, "@media screen and (max-width: 1680px) {\n  .paging-box {\n    color: var(--text1);\n    font-size: 12px;\n  }\n  .paging-box .disabled {\n    display: none;\n  }\n  .paging-box .current,\n  .paging-box .next,\n  .paging-box .prev,\n  .paging-box .tcd-number,\n  .paging-box .dian {\n    color: var(--text1);\n    cursor: pointer;\n    text-align: center;\n    margin: 0 4px;\n    text-decoration: none;\n    line-height: 26px;\n  }\n  .paging-box .current:hover,\n  .paging-box .next:hover,\n  .paging-box .prev:hover,\n  .paging-box .tcd-number:hover,\n  .paging-box .dian:hover {\n    color: var(--brand_blue);\n  }\n  .paging-box .current {\n    color: var(--brand_blue);\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n  }\n  .paging-box .dian {\n    cursor: default;\n  }\n  .paging-box .dian:hover {\n    color: var(--text1);\n  }\n  .paging-box .result {\n    padding-right: 10px;\n  }\n  .paging-box-big {\n    font-size: 12px;\n  }\n  .paging-box-big .disabled {\n    display: none;\n  }\n  .paging-box-big .current,\n  .paging-box-big .next,\n  .paging-box-big .prev,\n  .paging-box-big .tcd-number,\n  .paging-box-big .dian {\n    color: var(--text1);\n    cursor: pointer;\n    text-align: center;\n    border-radius: 4px;\n    background-color: var(--bg1);\n    border: solid 1px var(--line_regular);\n    background-image: none;\n    transition: 0.2s all;\n    font-size: 14px;\n    min-width: 15px;\n    margin: 0 2px 0 2px;\n    padding: 0 10px;\n    display: inline-block;\n    height: 36px;\n    line-height: 36px;\n    text-decoration: none;\n  }\n  .paging-box-big .current:hover,\n  .paging-box-big .next:hover,\n  .paging-box-big .prev:hover,\n  .paging-box-big .tcd-number:hover,\n  .paging-box-big .dian:hover {\n    background: var(--brand_blue);\n    color: var(--text_white);\n    border: 1px solid var(--brand_blue);\n  }\n  .paging-box-big .current {\n    background: var(--brand_blue);\n    color: var(--text_white);\n    border: 1px solid var(--brand_blue);\n  }\n  .paging-box-big .dian {\n    cursor: default;\n    border-color: var(---line_regular);\n  }\n  .paging-box-big .dian:hover {\n    background: var(--bg1);\n    color: var(--text1);\n    border: 1px solid var(---line_regular);\n  }\n  .paging-box-big.small .dian {\n    padding: 0;\n  }\n  .paging-box-big .prev,\n  .paging-box-big .next {\n    padding: 0 15px;\n  }\n  .paging-box-big .page-jump {\n    float: right;\n    color: var(--text3);\n    line-height: 36px;\n  }\n  .paging-box-big .page-jump input {\n    margin: 0 5px;\n    padding: 0 10px;\n    height: 24px;\n    line-height: 24px;\n    margin-top: 7px;\n    font-size: 12px;\n    box-shadow: none;\n    width: 24px;\n    border-radius: 4px;\n    border: 1px solid var(--line_regular);\n    outline: none;\n    text-align: center;\n  }\n  .paging-box-big .page-jump input:focus {\n    border-color: var(--brand_blue);\n  }\n  .paging-box-big.small .page-jump input {\n    padding: 0 3px;\n  }\n  .paging-box {\n    font-size: 13px;\n  }\n}\n@media screen and (max-width: 1680px) and (-webkit-max-device-pixel-ratio: 1) {\n  .paging-box .current {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n@media screen and (min-width: 1680px) {\n  .paging-box {\n    color: var(--text1);\n    font-size: 12px;\n  }\n  .paging-box .disabled {\n    display: none;\n  }\n  .paging-box .current,\n  .paging-box .next,\n  .paging-box .prev,\n  .paging-box .tcd-number,\n  .paging-box .dian {\n    color: var(--text1);\n    cursor: pointer;\n    text-align: center;\n    margin: 0 4px;\n    text-decoration: none;\n    line-height: 26px;\n  }\n  .paging-box .current:hover,\n  .paging-box .next:hover,\n  .paging-box .prev:hover,\n  .paging-box .tcd-number:hover,\n  .paging-box .dian:hover {\n    color: var(--brand_blue);\n  }\n  .paging-box .current {\n    color: var(--brand_blue);\n    font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n    font-weight: 600;\n    -webkit-font-smoothing: antialiased;\n  }\n  .paging-box .dian {\n    cursor: default;\n  }\n  .paging-box .dian:hover {\n    color: var(--text1);\n  }\n  .paging-box .result {\n    padding-right: 10px;\n  }\n  .paging-box-big {\n    font-size: 12px;\n  }\n  .paging-box-big .disabled {\n    display: none;\n  }\n  .paging-box-big .current,\n  .paging-box-big .next,\n  .paging-box-big .prev,\n  .paging-box-big .tcd-number,\n  .paging-box-big .dian {\n    color: var(--text1);\n    cursor: pointer;\n    text-align: center;\n    border-radius: 4px;\n    background-color: var(--bg1);\n    border: solid 1px var(--line_regular);\n    background-image: none;\n    transition: 0.2s all;\n    font-size: 14px;\n    min-width: 15px;\n    margin: 0 2px 0 2px;\n    padding: 0 10px;\n    display: inline-block;\n    height: 36px;\n    line-height: 36px;\n    text-decoration: none;\n  }\n  .paging-box-big .current:hover,\n  .paging-box-big .next:hover,\n  .paging-box-big .prev:hover,\n  .paging-box-big .tcd-number:hover,\n  .paging-box-big .dian:hover {\n    background: var(--brand_blue);\n    color: var(--text_white);\n    border: 1px solid var(--brand_blue);\n  }\n  .paging-box-big .current {\n    background: var(--brand_blue);\n    color: var(--text_white);\n    border: 1px solid var(--brand_blue);\n  }\n  .paging-box-big .dian {\n    cursor: default;\n    border-color: var(---line_regular);\n  }\n  .paging-box-big .dian:hover {\n    background: var(--bg1);\n    color: var(--text1);\n    border: 1px solid var(---line_regular);\n  }\n  .paging-box-big.small .dian {\n    padding: 0;\n  }\n  .paging-box-big .prev,\n  .paging-box-big .next {\n    padding: 0 15px;\n  }\n  .paging-box-big .page-jump {\n    float: right;\n    color: var(--text3);\n    line-height: 36px;\n  }\n  .paging-box-big .page-jump input {\n    margin: 0 5px;\n    padding: 0 10px;\n    height: 24px;\n    line-height: 24px;\n    margin-top: 7px;\n    font-size: 12px;\n    box-shadow: none;\n    width: 24px;\n    border-radius: 4px;\n    border: 1px solid var(--line_regular);\n    outline: none;\n    text-align: center;\n  }\n  .paging-box-big .page-jump input:focus {\n    border-color: var(--brand_blue);\n  }\n  .paging-box-big.small .page-jump input {\n    padding: 0 3px;\n  }\n  .paging-box {\n    font-size: 14px;\n  }\n}\n@media screen and (min-width: 1680px) and (-webkit-max-device-pixel-ratio: 1) {\n  .paging-box .current {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/usercard.less":
/*!**********************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/usercard.less ***!
  \**********************************************************************************************************************/
/***/ (function(module, exports, __webpack_require__) {

// Imports
var ___CSS_LOADER_API_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
var ___CSS_LOADER_GET_URL_IMPORT___ = __webpack_require__(/*! ../../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
var ___CSS_LOADER_URL_IMPORT_0___ = __webpack_require__(/*! ../../images/ic_add.svg */ "./static/images/ic_add.svg");
exports = ___CSS_LOADER_API_IMPORT___(false);
var ___CSS_LOADER_URL_REPLACEMENT_0___ = ___CSS_LOADER_GET_URL_IMPORT___(___CSS_LOADER_URL_IMPORT_0___);
// Module
exports.push([module.id, ".user-card {\n  font-size: 12px;\n  position: absolute;\n  z-index: 50;\n  border: 0.5px solid var(--graph_weak);\n  box-shadow: 0px 0px 30px rgba(0, 0, 0, 0.1);\n  border-radius: 8px;\n  width: 366px;\n  background: var(--bg1);\n}\n.user-card a {\n  text-decoration: none;\n}\n.user-card p {\n  margin: 0;\n}\n.user-card .bg {\n  position: absolute;\n  width: 100%;\n  height: 85px;\n  top: 0;\n  left: 0;\n  border-radius: 8px 8px 0 0;\n  overflow: hidden;\n  background-size: cover;\n  background-repeat: no-repeat;\n  background-position: center;\n}\n.user-card .face {\n  position: absolute;\n  top: 95px;\n  left: 10px;\n  width: 48px;\n  height: 48px;\n  border-radius: 50%;\n}\n.user-card .face img {\n  width: 48px;\n  height: 48px;\n  border-radius: 50%;\n}\n.user-card .face .auth {\n  position: absolute;\n  top: 34px;\n  right: 0;\n  width: 20px;\n  height: 20px;\n  transform: scale(0.7);\n}\n.user-card .info {\n  padding: 95px 20px 16px 70px;\n}\n.user-card .info p {\n  margin: 0;\n  color: var(--text1);\n}\n.user-card .info .sign {\n  line-height: 16px;\n  margin-top: 11px;\n  color: var(--text3);\n  word-break: break-all;\n  word-wrap: break-word;\n}\n.user-card .info .social {\n  margin-bottom: 8px;\n}\n.user-card .info .social .gray-text {\n  color: var(--text3);\n  margin-right: 20px;\n}\n.user-card .info .social a {\n  color: var(--text1);\n}\n.user-card .info .user {\n  display: flex;\n  align-items: center;\n  font-family: PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif;\n  font-weight: 600;\n  -webkit-font-smoothing: antialiased;\n  margin-bottom: 10px;\n  font-size: 16px;\n  line-height: 20px;\n}\n@media (-webkit-max-device-pixel-ratio: 1) {\n  .user-card .info .user {\n    font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif;\n  }\n}\n.user-card .info .user .name {\n  max-width: 160px;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  color: var(--text1);\n}\n.user-card .info .user .sex {\n  margin-left: 2px;\n  width: 16px;\n  height: 16px;\n  display: inline-block;\n  position: relative;\n}\n.user-card .info .user .vip-icon {\n  display: block;\n  max-width: 58px;\n  height: 16px;\n  border-radius: 2px;\n  margin-left: 8px;\n  background-color: var(--brand_pink);\n  font-size: 12px;\n  font-weight: 400;\n  color: var(--text_white);\n  white-space: nowrap;\n}\n.user-card .info .user .vip-icon .tinyfont {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  transform-origin: center;\n  transform: scale(0.83);\n  line-height: 16px;\n  font-weight: 400;\n}\n.user-card .info .verify {\n  color: var(--text3);\n  line-height: 17px;\n}\n.user-card .info .verify img {\n  vertical-align: middle;\n}\n.user-card .info .verify .auth {\n  display: inline-block;\n  position: relative;\n  left: -3px;\n  width: 16px;\n  height: 16px;\n}\n.user-card .info .level {\n  position: relative;\n  display: inline-block;\n  vertical-align: middle;\n  width: 22px;\n  height: 22px;\n  margin-left: 6px;\n}\n.user-card .info .level.senior {\n  width: 30px;\n}\n.user-card .btn-box {\n  padding: 0 0 16px 70px;\n}\n.user-card .btn-box a {\n  display: inline-block;\n  cursor: pointer;\n  text-decoration: none;\n  width: 100px;\n  height: 28px;\n  line-height: 30px;\n  text-align: center;\n  border: 1px solid var(--line_regular);\n  margin-right: 6px;\n  border-radius: 3px;\n  color: var(--text2);\n  transition: all 0.3s;\n  font-size: 14px;\n}\n.user-card .btn-box a:hover {\n  border-color: var(--brand_blue);\n  color: var(--brand_blue);\n}\n.user-card .btn-box .like {\n  color: var(--text_white);\n  font-weight: normal;\n  border-color: var(--brand_blue);\n  background-color: var(--brand_blue);\n}\n.user-card .btn-box .like .add-icon {\n  position: relative;\n  top: 2.38px;\n  display: inline-block;\n  width: 16px;\n  height: 16px;\n  background: url(" + ___CSS_LOADER_URL_REPLACEMENT_0___ + ") no-repeat;\n  background-size: cover;\n}\n.user-card .btn-box .like:hover {\n  border-color: #00b8f6;\n  background-color: #00b8f6;\n  color: var(--text_white);\n}\n.user-card .btn-box .hover-text {\n  display: none;\n}\n.user-card .btn-box .liked {\n  background-color: var(--Ga2);\n  border-color: var(--line_regular);\n  color: var(--text3);\n}\n.user-card .btn-box .like.liked:hover {\n  background-color: var(--Ga2);\n  border-color: var(--line_regular);\n  color: var(--text3);\n}\n.user-card .btn-box .like.liked:hover .default-text {\n  display: none;\n}\n.user-card .btn-box .like.liked:hover .hover-text {\n  display: inline-block;\n}\n.user-card .btn-box .message {\n  background-color: var(--bg1);\n}\n.user-card .vip-red-name {\n  color: var(--brand_pink) !important;\n}\n.user-card .vip-green-name {\n  color: #62c076 !important;\n}\n.user-card.loading {\n  height: 291px;\n}\n.user-card.loading .bg.loading {\n  background-color: var(--graph_weak);\n}\n.user-card.loading .face.loading {\n  background-color: var(--graph_weak);\n}\n.user-card.loading .info.loading {\n  display: flex;\n  flex-direction: column;\n}\n.user-card.loading .info.loading .loading-block {\n  width: 258px;\n  height: 31px;\n  margin-bottom: 17px;\n  background-color: var(--graph_weak);\n}\n.user-card.loading .info.loading .loading-block:last-child {\n  margin-bottom: 0;\n}\n.user-card.loading .btn-box.loading {\n  display: flex;\n}\n.user-card.loading .btn-box.loading .btn-block {\n  width: 104px;\n  height: 31px;\n  margin-right: 8px;\n  background-color: var(--graph_weak);\n}\n", ""]);
// Exports
module.exports = exports;


/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/api.js":
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
/***/ (function(module) {

"use strict";


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
// css base code, injected by the css-loader
// eslint-disable-next-line func-names
module.exports = function (useSourceMap) {
  var list = []; // return the list of modules as css string

  list.toString = function toString() {
    return this.map(function (item) {
      var content = cssWithMappingToString(item, useSourceMap);

      if (item[2]) {
        return "@media ".concat(item[2], " {").concat(content, "}");
      }

      return content;
    }).join('');
  }; // import a list of modules into the list
  // eslint-disable-next-line func-names


  list.i = function (modules, mediaQuery, dedupe) {
    if (typeof modules === 'string') {
      // eslint-disable-next-line no-param-reassign
      modules = [[null, modules, '']];
    }

    var alreadyImportedModules = {};

    if (dedupe) {
      for (var i = 0; i < this.length; i++) {
        // eslint-disable-next-line prefer-destructuring
        var id = this[i][0];

        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }

    for (var _i = 0; _i < modules.length; _i++) {
      var item = [].concat(modules[_i]);

      if (dedupe && alreadyImportedModules[item[0]]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (mediaQuery) {
        if (!item[2]) {
          item[2] = mediaQuery;
        } else {
          item[2] = "".concat(mediaQuery, " and ").concat(item[2]);
        }
      }

      list.push(item);
    }
  };

  return list;
};

function cssWithMappingToString(item, useSourceMap) {
  var content = item[1] || ''; // eslint-disable-next-line prefer-destructuring

  var cssMapping = item[3];

  if (!cssMapping) {
    return content;
  }

  if (useSourceMap && typeof btoa === 'function') {
    var sourceMapping = toComment(cssMapping);
    var sourceURLs = cssMapping.sources.map(function (source) {
      return "/*# sourceURL=".concat(cssMapping.sourceRoot || '').concat(source, " */");
    });
    return [content].concat(sourceURLs).concat([sourceMapping]).join('\n');
  }

  return [content].join('\n');
} // Adapted from convert-source-map (MIT)


function toComment(sourceMap) {
  // eslint-disable-next-line no-undef
  var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))));
  var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
  return "/*# ".concat(data, " */");
}

/***/ }),

/***/ "./node_modules/css-loader/dist/runtime/getUrl.js":
/*!********************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/getUrl.js ***!
  \********************************************************/
/***/ (function(module) {

"use strict";


module.exports = function (url, options) {
  if (!options) {
    // eslint-disable-next-line no-param-reassign
    options = {};
  } // eslint-disable-next-line no-underscore-dangle, no-param-reassign


  url = url && url.__esModule ? url.default : url;

  if (typeof url !== 'string') {
    return url;
  } // If url is already wrapped in quotes, remove them


  if (/^['"].*['"]$/.test(url)) {
    // eslint-disable-next-line no-param-reassign
    url = url.slice(1, -1);
  }

  if (options.hash) {
    // eslint-disable-next-line no-param-reassign
    url += options.hash;
  } // Should url be wrapped?
  // See https://drafts.csswg.org/css-values-3/#urls


  if (/["'() \t\n]/.test(url) || options.needQuotes) {
    return "\"".concat(url.replace(/"/g, '\\"').replace(/\n/g, '\\n'), "\"");
  }

  return url;
};

/***/ }),

/***/ "./node_modules/@bilibili/userAvatar/dist/user-avatar.css":
/*!****************************************************************!*\
  !*** ./node_modules/@bilibili/userAvatar/dist/user-avatar.css ***!
  \****************************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _css_loader_dist_cjs_js_user_avatar_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../css-loader/dist/cjs.js!./user-avatar.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/@bilibili/userAvatar/dist/user-avatar.css");
/* harmony import */ var _css_loader_dist_cjs_js_user_avatar_css__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_css_loader_dist_cjs_js_user_avatar_css__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_css_loader_dist_cjs_js_user_avatar_css__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_css_loader_dist_cjs_js_user_avatar_css__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/emoji.less":
/*!**************************************!*\
  !*** ./static/style/less/emoji.less ***!
  \**************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_emoji_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../node_modules/css-loader/dist/cjs.js!../../../node_modules/less-loader/dist/cjs.js!./emoji.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/emoji.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_emoji_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_emoji_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_emoji_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_emoji_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/message_box.less":
/*!********************************************!*\
  !*** ./static/style/less/message_box.less ***!
  \********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_message_box_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../node_modules/css-loader/dist/cjs.js!../../../node_modules/less-loader/dist/cjs.js!./message_box.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/message_box.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_message_box_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_message_box_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_message_box_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_message_box_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/commment-box.less":
/*!*********************************************************!*\
  !*** ./static/style/less/new-comment/commment-box.less ***!
  \*********************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_commment_box_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./commment-box.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/commment-box.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_commment_box_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_commment_box_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_commment_box_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_commment_box_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/header.less":
/*!***************************************************!*\
  !*** ./static/style/less/new-comment/header.less ***!
  \***************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_header_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./header.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/header.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_header_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_header_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_header_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_header_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/modal.less":
/*!**************************************************!*\
  !*** ./static/style/less/new-comment/modal.less ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_modal_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./modal.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/modal.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_modal_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_modal_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_modal_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_modal_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/pagination.less":
/*!*******************************************************!*\
  !*** ./static/style/less/new-comment/pagination.less ***!
  \*******************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_pagination_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./pagination.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/pagination.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_pagination_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_pagination_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_pagination_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_pagination_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/reply-v1.less":
/*!*****************************************************!*\
  !*** ./static/style/less/new-comment/reply-v1.less ***!
  \*****************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v1_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./reply-v1.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v1.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v1_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v1_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v1_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v1_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/reply-v2.less":
/*!*****************************************************!*\
  !*** ./static/style/less/new-comment/reply-v2.less ***!
  \*****************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v2_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./reply-v2.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/reply-v2.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v2_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v2_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v2_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_reply_v2_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/new-comment/send.less":
/*!*************************************************!*\
  !*** ./static/style/less/new-comment/send.less ***!
  \*************************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_send_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../../node_modules/css-loader/dist/cjs.js!../../../../node_modules/less-loader/dist/cjs.js!./send.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/new-comment/send.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_send_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_send_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_send_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_send_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/paging.less":
/*!***************************************!*\
  !*** ./static/style/less/paging.less ***!
  \***************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_paging_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../node_modules/css-loader/dist/cjs.js!../../../node_modules/less-loader/dist/cjs.js!./paging.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/paging.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_paging_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_paging_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_paging_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_paging_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./static/style/less/usercard.less":
/*!*****************************************!*\
  !*** ./static/style/less/usercard.less ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_usercard_less__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !!../../../node_modules/css-loader/dist/cjs.js!../../../node_modules/less-loader/dist/cjs.js!./usercard.less */ "./node_modules/css-loader/dist/cjs.js!./node_modules/less-loader/dist/cjs.js!./static/style/less/usercard.less");
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_usercard_less__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_usercard_less__WEBPACK_IMPORTED_MODULE_1__);

            

var options = {};

options.insert = "head";
options.singleton = false;

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_usercard_less__WEBPACK_IMPORTED_MODULE_1___default()), options);



/* harmony default export */ __webpack_exports__["default"] = ((_node_modules_css_loader_dist_cjs_js_node_modules_less_loader_dist_cjs_js_usercard_less__WEBPACK_IMPORTED_MODULE_1___default().locals) || {});

/***/ }),

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js":
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

"use strict";


var isOldIE = function isOldIE() {
  var memo;
  return function memorize() {
    if (typeof memo === 'undefined') {
      // Test for IE <= 9 as proposed by Browserhacks
      // @see http://browserhacks.com/#hack-e71d8692f65334173fee715c222cb805
      // Tests for existence of standard globals is to allow style-loader
      // to operate correctly into non-standard environments
      // @see https://github.com/webpack-contrib/style-loader/issues/177
      memo = Boolean(window && document && document.all && !window.atob);
    }

    return memo;
  };
}();

var getTarget = function getTarget() {
  var memo = {};
  return function memorize(target) {
    if (typeof memo[target] === 'undefined') {
      var styleTarget = document.querySelector(target); // Special case to return head of iframe instead of iframe itself

      if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
        try {
          // This will throw an exception if access to iframe is blocked
          // due to cross-origin restrictions
          styleTarget = styleTarget.contentDocument.head;
        } catch (e) {
          // istanbul ignore next
          styleTarget = null;
        }
      }

      memo[target] = styleTarget;
    }

    return memo[target];
  };
}();

var stylesInDom = [];

function getIndexByIdentifier(identifier) {
  var result = -1;

  for (var i = 0; i < stylesInDom.length; i++) {
    if (stylesInDom[i].identifier === identifier) {
      result = i;
      break;
    }
  }

  return result;
}

function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var index = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3]
    };

    if (index !== -1) {
      stylesInDom[index].references++;
      stylesInDom[index].updater(obj);
    } else {
      stylesInDom.push({
        identifier: identifier,
        updater: addStyle(obj, options),
        references: 1
      });
    }

    identifiers.push(identifier);
  }

  return identifiers;
}

function insertStyleElement(options) {
  var style = document.createElement('style');
  var attributes = options.attributes || {};

  if (typeof attributes.nonce === 'undefined') {
    var nonce =  true ? __webpack_require__.nc : 0;

    if (nonce) {
      attributes.nonce = nonce;
    }
  }

  Object.keys(attributes).forEach(function (key) {
    style.setAttribute(key, attributes[key]);
  });

  if (typeof options.insert === 'function') {
    options.insert(style);
  } else {
    var target = getTarget(options.insert || 'head');

    if (!target) {
      throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
    }

    target.appendChild(style);
  }

  return style;
}

function removeStyleElement(style) {
  // istanbul ignore if
  if (style.parentNode === null) {
    return false;
  }

  style.parentNode.removeChild(style);
}
/* istanbul ignore next  */


var replaceText = function replaceText() {
  var textStore = [];
  return function replace(index, replacement) {
    textStore[index] = replacement;
    return textStore.filter(Boolean).join('\n');
  };
}();

function applyToSingletonTag(style, index, remove, obj) {
  var css = remove ? '' : obj.media ? "@media ".concat(obj.media, " {").concat(obj.css, "}") : obj.css; // For old IE

  /* istanbul ignore if  */

  if (style.styleSheet) {
    style.styleSheet.cssText = replaceText(index, css);
  } else {
    var cssNode = document.createTextNode(css);
    var childNodes = style.childNodes;

    if (childNodes[index]) {
      style.removeChild(childNodes[index]);
    }

    if (childNodes.length) {
      style.insertBefore(cssNode, childNodes[index]);
    } else {
      style.appendChild(cssNode);
    }
  }
}

function applyToTag(style, options, obj) {
  var css = obj.css;
  var media = obj.media;
  var sourceMap = obj.sourceMap;

  if (media) {
    style.setAttribute('media', media);
  } else {
    style.removeAttribute('media');
  }

  if (sourceMap && typeof btoa !== 'undefined') {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  } // For old IE

  /* istanbul ignore if  */


  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    while (style.firstChild) {
      style.removeChild(style.firstChild);
    }

    style.appendChild(document.createTextNode(css));
  }
}

var singleton = null;
var singletonCounter = 0;

function addStyle(obj, options) {
  var style;
  var update;
  var remove;

  if (options.singleton) {
    var styleIndex = singletonCounter++;
    style = singleton || (singleton = insertStyleElement(options));
    update = applyToSingletonTag.bind(null, style, styleIndex, false);
    remove = applyToSingletonTag.bind(null, style, styleIndex, true);
  } else {
    style = insertStyleElement(options);
    update = applyToTag.bind(null, style, options);

    remove = function remove() {
      removeStyleElement(style);
    };
  }

  update(obj);
  return function updateStyle(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap) {
        return;
      }

      update(obj = newObj);
    } else {
      remove();
    }
  };
}

module.exports = function (list, options) {
  options = options || {}; // Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
  // tags it will allow on a page

  if (!options.singleton && typeof options.singleton !== 'boolean') {
    options.singleton = isOldIE();
  }

  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];

    if (Object.prototype.toString.call(newList) !== '[object Array]') {
      return;
    }

    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDom[index].references--;
    }

    var newLastIdentifiers = modulesToDom(newList, options);

    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];

      var _index = getIndexByIdentifier(_identifier);

      if (stylesInDom[_index].references === 0) {
        stylesInDom[_index].updater();

        stylesInDom.splice(_index, 1);
      }
    }

    lastIdentifiers = newLastIdentifiers;
  };
};

/***/ }),

/***/ "./static/images/arrow.png":
/*!*********************************!*\
  !*** ./static/images/arrow.png ***!
  \*********************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/arrow.9b3deff.png");

/***/ }),

/***/ "./static/images/ic_add.svg":
/*!**********************************!*\
  !*** ./static/images/ic_add.svg ***!
  \**********************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/PjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+PHN2ZyB0PSIxNjM2MzY1MTcxNDY5IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjY1NzEiIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+PGRlZnM+PHN0eWxlIHR5cGU9InRleHQvY3NzIj48L3N0eWxlPjwvZGVmcz48cGF0aCBkPSJNNDY0IDQ2NHYtMjg4YTQ4IDQ4IDAgMCAxIDk2IDB2Mjg4aDI4OGE0OCA0OCAwIDAgMSAwIDk2aC0yODh2Mjg4YTQ4IDQ4IDAgMCAxLTk2IDB2LTI4OGgtMjg4YTQ4IDQ4IDAgMCAxIDAtOTZoMjg4eiIgZmlsbD0iI2ZmZmZmZiIgcC1pZD0iNjU3MiI+PC9wYXRoPjwvc3ZnPg==");

/***/ }),

/***/ "./static/images/ic_hate.svg":
/*!***********************************!*\
  !*** ./static/images/ic_hate.svg ***!
  \***********************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_hate.82d82d4.svg");

/***/ }),

/***/ "./static/images/ic_hate_clicked.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_hate_clicked.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PHN2ZyB0PSIxNjM2MDk0MDMwODU1IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjUxMDMiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNODYwLjAzMiA2OTMuNjMyaC0xODIuMDhjNy40ODggMTcuNDA4IDE0LjcyIDM4LjU5MiAxOC4wNDggNjAuNjA4IDUuOTUyIDM5Ljg3MiA0Ljk5MiA4Ny4yOTYtMTguMzY4IDEyOS4wODgtMjEuNzYgMzguODQ4LTUwLjMwNCA2MC45MjgtODMuNTIgNjEuMzEyLTMwLjcyIDAuMzg0LTUzLjg4OC0xOC4xNzYtNjUuNzI4LTMzLjQwOGExOTkuMjk2IDE5OS4yOTYgMCAwIDEtMzIuMDY0LTU5LjJsLTEuOTItNS4yNDhjLTUuNDQtMTQuOTEyLTEwLjg4LTI5Ljg4OC0yMy4wNC01MS40NTYtMTkuNzEyLTM0LjgxNi00OC44MzItNTYuMTI4LTc3LjY5Ni03NC4zMDRhMzkxLjY4IDM5MS42OCAwIDAgMC0zMC45NzYtMTcuOTg0VjE1MC41OTJhNDYxNy40MDggNDYxNy40MDggMCAwIDEgMzUxLjg3MiA1LjMxMmM1MS4yNjQgMi43NTIgMTAwLjY3MiAyOC42MDggMTI3LjQ4OCA3Ni4wOTYgMjQuMzIgNDMuMTM2IDU1LjE2OCAxMDguMTYgNzQuMzY4IDE4Ny4yNjQgMjAuNDE2IDg0LjA5NiAyNC42NCAxNTIuNjQgMjQuNTc2IDE5NS45MDQtMC4xMjggNDYuMzM2LTM4LjcyIDc4LjQ2NC04MC45NiA3OC40NjR6TTI5OC42MjQgMTUyLjMydjU0MS4yNDhIMjE1LjgwOGMtNTkuNzEyIDAtMTEzLjQwOC00Mi4wNDgtMTIwLjg5Ni0xMDQuMzJhMTM3NiAxMzc2IDAgMCAxIDAuNjQtMzMwLjQzMmM3LjM2LTU4LjYyNCA1Ni4xMjgtMTAwLjAzMiAxMTMuMDI0LTEwMi44NDggMjUuMDI0LTEuMjE2IDU1LjU1Mi0yLjU2IDkwLjExMi0zLjY0OHoiIHAtaWQ9IjUxMDQiIGZpbGw9IiMwMGFlZWMiPjwvcGF0aD48L3N2Zz4=");

/***/ }),

/***/ "./static/images/ic_hate_hover.svg":
/*!*****************************************!*\
  !*** ./static/images/ic_hate_hover.svg ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_hate_hover.80cf343.svg");

/***/ }),

/***/ "./static/images/ic_like.svg":
/*!***********************************!*\
  !*** ./static/images/ic_like.svg ***!
  \***********************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_like.350644e.svg");

/***/ }),

/***/ "./static/images/ic_like_clicked.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_like_clicked.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PHN2ZyB0PSIxNjM2MDkzOTkxODMzIiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjQ0NDciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNODYwLjAzMiAzNDEuMTJoLTE4Mi4wOGM3LjQ4OC0xNy40MDggMTQuNzItMzguNTI4IDE4LjA0OC02MC41NDQgNS45NTItMzkuODcyIDQuOTkyLTg3LjM2LTE4LjM2OC0xMjkuMDg4LTIxLjc2LTM4Ljg0OC01MC4zMDQtNjAuOTI4LTgzLjUyLTYxLjM3Ni0zMC43Mi0wLjM4NC01My44ODggMTguMTc2LTY1LjcyOCAzMy40MDhhMTk5LjI5NiAxOTkuMjk2IDAgMCAwLTMyLjA2NCA1OS4yNjRsLTEuOTIgNS4xODRjLTUuNDQgMTQuOTc2LTEwLjg4IDI5Ljk1Mi0yMy4wNCA1MS40NTYtMTkuNzEyIDM0LjgxNi00OC44MzIgNTYuMTI4LTc3LjY5NiA3NC4zNjhhMzkxLjkzNiAzOTEuOTM2IDAgMCAxLTMwLjk3NiAxNy45MnY1NTIuNDQ4YTQ2MjEuOTUyIDQ2MjEuOTUyIDAgMCAwIDM1MS44NzItNS4zMTJjNTEuMjY0LTIuNzUyIDEwMC42NzItMjguNTQ0IDEyNy40ODgtNzYuMDMyIDI0LjMyLTQzLjEzNiA1NS4xNjgtMTA4LjE2IDc0LjM2OC0xODcuMjY0IDIwLjQxNi04NC4xNiAyNC42NC0xNTIuNzA0IDI0LjU3Ni0xOTUuOTY4LTAuMTI4LTQ2LjMzNi0zOC43Mi03OC40LTgwLjk2LTc4LjR6IG0tNTYxLjM0NCA1NDEuMzEyVjM0MS4xMkgyMTUuODA4Yy01OS43MTIgMC0xMTMuNDA4IDQyLjA0OC0xMjAuODk2IDEwNC4zMmExMzc2IDEzNzYgMCAwIDAgMC42NCAzMzAuMzY4YzcuMzYgNTguNjg4IDU2LjEyOCAxMDAuMDMyIDExMy4wMjQgMTAyLjg0OCAyNS4wMjQgMS4yOCA1NS41NTIgMi41NiA5MC4xMTIgMy43MTJ6IiBwLWlkPSI0NDQ4IiBmaWxsPSIjMDBhZWVjIj48L3BhdGg+PC9zdmc+");

/***/ }),

/***/ "./static/images/ic_like_hover.svg":
/*!*****************************************!*\
  !*** ./static/images/ic_like_hover.svg ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_like_hover.1e0789c.svg");

/***/ }),

/***/ "./static/images/ic_spot.svg":
/*!***********************************!*\
  !*** ./static/images/ic_spot.svg ***!
  \***********************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PHN2ZyB0PSIxNjM2MDk3Nzk0NTQ5IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjU3MTMiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNNTg2LjYyNCAyMzQuNjI0YTc0LjYyNCA3NC42MjQgMCAxIDEtMTQ5LjE4NCAwIDc0LjYyNCA3NC42MjQgMCAwIDEgMTQ5LjEyIDB6IG0wIDU1NC42MjRhNzQuNjI0IDc0LjYyNCAwIDEgMS0xNDkuMjQ4IDAgNzQuNjI0IDc0LjYyNCAwIDAgMSAxNDkuMjQ4IDB6TTUxMiA1ODYuNjI0YTc0LjYyNCA3NC42MjQgMCAxIDAgMC0xNDkuMjQ4IDc0LjYyNCA3NC42MjQgMCAwIDAgMCAxNDkuMjQ4eiIgcC1pZD0iNTcxNCIgZmlsbD0iIzk0OTlhMCI+PC9wYXRoPjwvc3ZnPg==");

/***/ }),

/***/ "./static/images/ic_spot_hover.svg":
/*!*****************************************!*\
  !*** ./static/images/ic_spot_hover.svg ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PHN2ZyB0PSIxNjM2MDk3Nzk0NTQ5IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjU3MTMiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNNTg2LjYyNCAyMzQuNjI0YTc0LjYyNCA3NC42MjQgMCAxIDEtMTQ5LjE4NCAwIDc0LjYyNCA3NC42MjQgMCAwIDEgMTQ5LjEyIDB6IG0wIDU1NC42MjRhNzQuNjI0IDc0LjYyNCAwIDEgMS0xNDkuMjQ4IDAgNzQuNjI0IDc0LjYyNCAwIDAgMSAxNDkuMjQ4IDB6TTUxMiA1ODYuNjI0YTc0LjYyNCA3NC42MjQgMCAxIDAgMC0xNDkuMjQ4IDc0LjYyNCA3NC42MjQgMCAwIDAgMCAxNDkuMjQ4eiIgcC1pZD0iNTcxNCIgZmlsbD0iIzAwYWVlYyI+PC9wYXRoPjwvc3ZnPg==");

/***/ }),

/***/ "./static/images/ic_tag_enterprise.png":
/*!*********************************************!*\
  !*** ./static/images/ic_tag_enterprise.png ***!
  \*********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_tag_enterprise.9e3c59e.png");

/***/ }),

/***/ "./static/images/ic_tag_man_border.png":
/*!*********************************************!*\
  !*** ./static/images/ic_tag_man_border.png ***!
  \*********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_tag_man_border.89ca61d.png");

/***/ }),

/***/ "./static/images/ic_tag_offic_tagial.png":
/*!***********************************************!*\
  !*** ./static/images/ic_tag_offic_tagial.png ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_tag_offic_tagial.fe21613.png");

/***/ }),

/***/ "./static/images/ic_tag_woman_border.png":
/*!***********************************************!*\
  !*** ./static/images/ic_tag_woman_border.png ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_tag_woman_border.35fc0c5.png");

/***/ }),

/***/ "./static/images/ic_user level_0.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_0.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_0.7738e22.svg");

/***/ }),

/***/ "./static/images/ic_user level_1.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_1.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_1.4419801.svg");

/***/ }),

/***/ "./static/images/ic_user level_2.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_2.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_2.c467d66.svg");

/***/ }),

/***/ "./static/images/ic_user level_3.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_3.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_3.227481f.svg");

/***/ }),

/***/ "./static/images/ic_user level_4.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_4.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_4.8a52873.svg");

/***/ }),

/***/ "./static/images/ic_user level_5.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_5.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_5.a92f1e7.svg");

/***/ }),

/***/ "./static/images/ic_user level_6+.svg":
/*!********************************************!*\
  !*** ./static/images/ic_user level_6+.svg ***!
  \********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_6+.e7b4001.svg");

/***/ }),

/***/ "./static/images/ic_user level_6.svg":
/*!*******************************************!*\
  !*** ./static/images/ic_user level_6.svg ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/ic_user level_6.64b9440.svg");

/***/ }),

/***/ "./static/images/icons-comment.png":
/*!*****************************************!*\
  !*** ./static/images/icons-comment.png ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/icons-comment.2f36fc5.png");

/***/ }),

/***/ "./static/images/left-arrow-disable.svg":
/*!**********************************************!*\
  !*** ./static/images/left-arrow-disable.svg ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/left-arrow-disable.1c51ed4.svg");

/***/ }),

/***/ "./static/images/left-arrow.svg":
/*!**************************************!*\
  !*** ./static/images/left-arrow.svg ***!
  \**************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIzLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMTYgMTYiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDE2IDE2OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6Izc1NzU3NTt9Cjwvc3R5bGU+Cjx0aXRsZT5nZW5lcmFsX2JhY2tfczwvdGl0bGU+CjxkZXNjPkNyZWF0ZWQgd2l0aCBTa2V0Y2guPC9kZXNjPgo8cGF0aCBpZD0iQ29tYmluZWQtU2hhcGUiIGNsYXNzPSJzdDAiIGQ9Ik02LjgsOGwzLjQtMy40YzAuMy0wLjMsMC4zLTAuOCwwLTEuMWMtMC4zLTAuMy0wLjgtMC4zLTEuMSwwTDUuMiw3LjUKCWMtMC4zLDAuMy0wLjMsMC44LDAsMS4xbDMuOSwzLjljMC4zLDAuMywwLjgsMC4zLDEuMSwwYzAuMy0wLjMsMC4zLTAuOCwwLTEuMUw2LjgsOHoiLz4KPC9zdmc+Cg==");

/***/ }),

/***/ "./static/images/medal_level_1.png":
/*!*****************************************!*\
  !*** ./static/images/medal_level_1.png ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/medal_level_1.b2eb3c9.png");

/***/ }),

/***/ "./static/images/medal_level_2.png":
/*!*****************************************!*\
  !*** ./static/images/medal_level_2.png ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/medal_level_2.6e0679d.png");

/***/ }),

/***/ "./static/images/medal_level_3.png":
/*!*****************************************!*\
  !*** ./static/images/medal_level_3.png ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/medal_level_3.08316e7.png");

/***/ }),

/***/ "./static/images/right-arrow-disable.svg":
/*!***********************************************!*\
  !*** ./static/images/right-arrow-disable.svg ***!
  \***********************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/right-arrow-disable.8a5c39b.svg");

/***/ }),

/***/ "./static/images/right-arrow.svg":
/*!***************************************!*\
  !*** ./static/images/right-arrow.svg ***!
  \***************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = ("data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIzLjAuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IuWbvuWxgl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgMTYgMTYiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDE2IDE2OyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6Izc1NzU3NTt9Cjwvc3R5bGU+Cjx0aXRsZT5nZW5lcmFsX2VudGVyX3M8L3RpdGxlPgo8ZGVzYz5DcmVhdGVkIHdpdGggU2tldGNoLjwvZGVzYz4KPHBhdGggaWQ9IkNvbWJpbmVkLVNoYXBlIiBjbGFzcz0ic3QwIiBkPSJNOS4yLDhsLTMuNCwzLjRjLTAuMywwLjMtMC4zLDAuOCwwLDEuMWMwLjMsMC4zLDAuOCwwLjMsMS4xLDBsMy45LTMuOQoJYzAuMy0wLjMsMC4zLTAuOCwwLTEuMUw2LjksMy42Yy0wLjMtMC4zLTAuOC0wLjMtMS4xLDBjLTAuMywwLjMtMC4zLDAuOCwwLDEuMUw5LjIsOHoiLz4KPC9zdmc+Cg==");

/***/ }),

/***/ "./static/images/send_btn_icon.svg":
/*!*****************************************!*\
  !*** ./static/images/send_btn_icon.svg ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/send_btn_icon.5a651ca.svg");

/***/ }),

/***/ "./static/images/user-auth.png":
/*!*************************************!*\
  !*** ./static/images/user-auth.png ***!
  \*************************************/
/***/ (function(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony default export */ __webpack_exports__["default"] = (__webpack_require__.p + "static/img/user-auth.d37ec82.png");

/***/ }),

/***/ "./static/style/less/new-comment sync recursive ^\\.\\/reply.*\\.less$":
/*!*****************************************************************!*\
  !*** ./static/style/less/new-comment/ sync ^\.\/reply.*\.less$ ***!
  \*****************************************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

var map = {
	"./reply-v1.less": "./static/style/less/new-comment/reply-v1.less",
	"./reply-v2.less": "./static/style/less/new-comment/reply-v2.less"
};


function webpackContext(req) {
	var id = webpackContextResolve(req);
	return __webpack_require__(id);
}
function webpackContextResolve(req) {
	if(!__webpack_require__.o(map, req)) {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	}
	return map[req];
}
webpackContext.keys = function webpackContextKeys() {
	return Object.keys(map);
};
webpackContext.resolve = webpackContextResolve;
module.exports = webpackContext;
webpackContext.id = "./static/style/less/new-comment sync recursive ^\\.\\/reply.*\\.less$";

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	!function() {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = function(module) {
/******/ 			var getter = module && module.__esModule ?
/******/ 				function() { return module['default']; } :
/******/ 				function() { return module; };
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	!function() {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = function(exports, definition) {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	!function() {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	!function() {
/******/ 		__webpack_require__.p = "//s1.hdslb.com/bfs/seed/jinkela/commentpc/";
/******/ 	}();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/new-comment/index.js");
/******/ 	
/******/ })()
;