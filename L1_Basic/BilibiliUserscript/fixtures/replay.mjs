// Minimal behavioral replays of public Bilibili/BiliReveal component contracts.
// These are purpose-built fixtures, not copies of Bilibili's production bundle.
export function installReplay(config) {
  const esc = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const controls = '<button class="fixture-action" type="button">回复</button><button class="fixture-menu" type="button">更多</button>';
  const baseCSS = ':host{display:block}*{box-sizing:border-box}.reply-info,.sub-reply-info,.info,#footer{display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:#9499a0;font:12px/20px Arial,sans-serif;max-width:100%;min-width:0}.fixture-action,.fixture-menu{position:static;flex:0 0 auto;border:0;background:#f1f2f3;color:#666;padding:0 4px;line-height:20px}.comment-body{font:14px/22px Arial;padding:8px 0;color:#333}';
  const mount = document.getElementById('fixture-mount');
  let records = config.records;
  let roots = new Map();
  let clicked = 0;
  const bindButtons = root => {
    for (const button of root.querySelectorAll('button')) button.addEventListener('click', () => clicked++);
  };
  if (config.framework === 'lit') {
    class ActionButtons extends HTMLElement {
      constructor() {
        super();
        if (config.scenario === 'late-shadow') setTimeout(() => { this.attachShadow({mode:'open'}); this.update(); }, 90);
        else this.attachShadow({mode:'open'});
      }
      set data(value) { this._data = value; this.update(); }
      get data() { return this._data; }
      update() {
        if (!this.shadowRoot || !this.data) return;
        if (!this.shadowRoot.querySelector('#pubdate')) {
          this.shadowRoot.innerHTML = '<style>' + baseCSS + '</style><div id="footer"><span id="pubdate"></span>' + controls + '</div>';
          bindButtons(this.shadowRoot);
        }
        this.shadowRoot.querySelector('#pubdate').textContent = '2026-09-01';
        if (config.scenario === 'native') {
          let location = this.shadowRoot.querySelector('#location');
          if (!location) { location = document.createElement('span'); location.id = 'location'; location.dataset.native = 'preserve'; this.shadowRoot.querySelector('#pubdate').after(location); }
          location.textContent = this.data.reply_control.location;
        }
      }
    }
    customElements.define('bili-comment-action-buttons-renderer', ActionButtons);
    const commentClass = () => class extends HTMLElement {
      constructor() { super(); this.attachShadow({mode:'open'}); }
      set reply(value) {
        if (config.scenario !== 'footer-only') this.__data = value;
        if (!this.shadowRoot.querySelector('bili-comment-action-buttons-renderer')) {
          this.shadowRoot.innerHTML = '<style>' + baseCSS + '</style><div class="comment-body"></div><bili-comment-action-buttons-renderer></bili-comment-action-buttons-renderer>';
        }
        this.shadowRoot.querySelector('.comment-body').textContent = value.content.message;
        const footer = this.shadowRoot.querySelector('bili-comment-action-buttons-renderer');
        footer.dataset.replayKey = value.key;
        footer.data = value;
        roots.set(value.key, this);
      }
    };
    customElements.define('bili-comment-renderer', commentClass());
    customElements.define('bili-comment-reply-renderer', commentClass());
    customElements.define('bili-comment-thread-renderer', class extends HTMLElement { constructor() { super(); this.attachShadow({mode:'open'}); } });
    customElements.define('bili-comments', class extends HTMLElement { constructor() { super(); this.attachShadow({mode:'open'}); } });
  } else if (config.framework === 'vue2') {
    const bbComment = function bbComment() {};
    bbComment.prototype._createListCon = function(item) {
      return '<div class="reply-wrap" data-id="' + esc(item.rpid_str) + '"><div class="reply-con"><div class="comment-body">' + esc(item.content.message) + '</div><div class="info"><span class="reply-time">2026-09-01</span>' + controls + '</div></div></div>';
    };
    bbComment.prototype._createSubReplyItem = function(item) {
      return '<div class="sub-reply-item" data-id="' + esc(item.rpid_str) + '"><div class="con"><div class="comment-body">' + esc(item.content.message) + '</div><div class="info"><span class="reply-time">2026-09-01</span>' + controls + '</div></div></div>';
    };
    window.bbComment = bbComment;
  }
  function mountRecords(next = records) {
    records = next; roots = new Map(); mount.replaceChildren();
    if (config.framework === 'lit') {
      const app = document.createElement('bili-comments'); mount.append(app);
      const thread = document.createElement('bili-comment-thread-renderer'); app.shadowRoot.append(thread);
      for (const record of records) {
        const element = document.createElement(record.sub ? 'bili-comment-reply-renderer' : 'bili-comment-renderer');
        thread.shadowRoot.append(element); element.reply = record;
      }
    } else if (config.framework === 'vue3') {
      const list = document.createElement('div'); list.className = 'reply-list'; mount.append(list);
      // Match framework app discovery before element binding, then asynchronous rendering.
      setTimeout(() => {
        for (const [index, record] of records.entries()) {
          const element = document.createElement('div'); element.className = record.sub ? 'sub-reply-item' : 'reply-item';
          const props = record.sub ? {subReply:record,rootReply:records[0]} : {reply:record};
          const app = {uid:index,vnode:{el:null,props},props,isUnmounted:false}; app.vnode.component = app;
          new window.Proxy({_:app}, {});
          element.__vueParentComponent = app;
          app.vnode.el = element;
          element.innerHTML = '<div class="comment-body"></div><div class="' + (record.sub ? 'sub-reply-info' : 'reply-info') + '"><span class="' + (record.sub ? 'sub-reply-time' : 'reply-time') + '">2026-09-01</span>' + controls + '</div>';
          element.querySelector('.comment-body').textContent = record.content.message;
          element.querySelector('.reply-info,.sub-reply-info').dataset.replayKey = record.key;
          roots.set(record.key,element); bindButtons(element); list.append(element);
        }
      }, 30);
    } else {
      const comment = new window.bbComment();
      for (const record of records) {
        const temp = document.createElement('div');
        temp.innerHTML = (record.sub ? comment._createSubReplyItem : comment._createListCon).call(comment,record,0);
        const element = temp.firstElementChild;
        element.querySelector('.info').dataset.replayKey = record.key;
        roots.set(record.key,element); bindButtons(element); mount.append(element);
      }
    }
  }
  async function pageRequest(fail = false) {
    window.__replayRequestDepth++;
    let promise;
    try { promise = window.fetch('https://api.bilibili.com/x/v2/reply/main?oid=101&type=1' + (fail ? '&fixture_fail=1' : '')); }
    finally { window.__replayRequestDepth--; }
    try { const response = await promise; const payload = await response.json(); return payload.code; }
    catch { return 'failed'; }
  }
  const api = {
    mount: mountRecords,
    async ready() { api.responseCode = await pageRequest(config.scenario === 'failed-response'); mountRecords(); },
    update(next) {
      if (config.framework !== 'lit') return mountRecords(next);
      const oldRoot = roots.get(records[0].key); records = next;
      oldRoot.reply = next[0];
    },
    repeat(count = 8) { for (let i=0;i<count;i++) for (const root of roots.values()) root.shadowRoot?.querySelector('bili-comment-action-buttons-renderer')?.update(); },
    navigate(method,next,path,framework) {
      history[method]({},'',path);
      if (method === 'replaceState') window.dispatchEvent(new PopStateEvent('popstate'));
      if (framework) config.framework = framework;
      mountRecords(next);
    },
    clicks: () => clicked,
  };
  Object.defineProperty(window,'__replayFixture',{value:api});
  setTimeout(() => api.ready(), config.scenario === 'delayed' ? 230 : 20);
}

export function replayHTML(config) {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Bilibili synthetic comment replay</title><style>body{margin:24px;font-family:Arial,sans-serif}#fixture-mount{max-width:760px}bili-comment-renderer,bili-comment-reply-renderer,.reply-wrap,.reply-item,.sub-reply-item{padding:12px;border-bottom:1px solid #eee}.reply-info,.sub-reply-info,.info{display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:#9499a0;font:12px/20px Arial}.fixture-action,.fixture-menu{border:0;padding:0 4px;line-height:20px}.comment-body{padding:8px 0}</style></head><body><h1>评论回放</h1><div id="fixture-mount"></div><script>(' + installReplay.toString() + ')(' + JSON.stringify(config).replace(/</g,'\\u003c') + ');</script></body></html>';
}
