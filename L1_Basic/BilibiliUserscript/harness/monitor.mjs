// Infrastructure runs before the candidate. All data in this fixture is synthetic.
export function installMonitor() {
  const events = [];
  const mark = (type, detail = '') => events.push({ type, detail: String(detail).slice(0, 500) });
  Object.defineProperty(window, '__replayEvents', { value: events });
  window.__replayRequestDepth = 0;
  const fetch0 = window.fetch;
  window.fetch = function (...args) {
    mark(window.__replayRequestDepth ? 'page-fetch' : 'candidate-network', args[0]?.url || args[0]);
    return Reflect.apply(fetch0, this, args);
  };
  const urls = new WeakMap();
  const open0 = XMLHttpRequest.prototype.open;
  const send0 = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (...args) {
    urls.set(this, args[1]);
    return Reflect.apply(open0, this, args);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    mark(window.__replayRequestDepth ? 'page-xhr' : 'candidate-network', urls.get(this));
    return Reflect.apply(send0, this, args);
  };
  navigator.sendBeacon = (url) => { mark('candidate-network', url); return false; };
  for (const name of ['WebSocket', 'EventSource']) {
    window[name] = class { constructor(url) { mark('candidate-network', url); throw new Error('Offline replay blocks ' + name); } };
  }
  for (const name of ['setItem', 'removeItem', 'clear']) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function (...args) {
      mark('persistent-write', name + ':' + (args[0] || ''));
      return Reflect.apply(original, this, args);
    };
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookie?.set) Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true, get: cookie.get,
    set(value) { mark('persistent-write', 'cookie'); return cookie.set.call(this, value); },
  });
  if (window.indexedDB) {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => { mark('persistent-write', 'indexedDB.open'); return open(...args); };
  }
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => {
    mark('persistent-write', 'serviceWorker.register'); return Promise.reject(new Error('Offline replay'));
  };
  const gmWrite = (key) => mark('persistent-write', 'GM:' + key);
  window.unsafeWindow = window;
  window.GM_getValue = (_key, fallback) => fallback;
  window.GM_setValue = gmWrite;
  window.GM_deleteValue = gmWrite;
  window.GM_registerMenuCommand = () => 1;
  window.GM_unregisterMenuCommand = () => {};
  window.GM_setClipboard = () => mark('persistent-write', 'clipboard');
  window.GM_xmlhttpRequest = (options) => { mark('candidate-network', options?.url); return { abort() {} }; };
  window.GM_addStyle = (css) => {
    const style = document.createElement('style'); style.textContent = css;
    (document.head || document.documentElement).append(style); return style;
  };
  window.GM_info = { script: { version: 'replay' }, scriptHandler: 'recorded-shim', version: '1' };
  window.GM = {
    getValue: async (_key, fallback) => fallback,
    setValue: async (key) => gmWrite(key), deleteValue: async (key) => gmWrite(key),
    xmlHttpRequest: window.GM_xmlhttpRequest, addStyle: window.GM_addStyle,
    registerMenuCommand: window.GM_registerMenuCommand,
  };
  for (const name of ['alert', 'confirm', 'prompt']) window[name] = (...args) => {
    mark('dialog', name + ':' + args[0]); return name === 'confirm' ? false : null;
  };
  window.addEventListener('error', (event) => mark('uncaught-error', event.message));
  window.addEventListener('unhandledrejection', (event) => mark('uncaught-error', event.reason));
}
