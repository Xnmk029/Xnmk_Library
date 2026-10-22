// Benchmark conformance changes to BiliReveal v2.3.0; see PATCHES.md.
// This code is inserted inside the original upstream IIFE by build-gold.mjs.
var benchLocation = (reply) => {
  const value = reply?.reply_control?.location;
  if (typeof value !== 'string') return '';
  const text = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!text || text.length > 160) return '';
  const place = text.replace(/^IP\s*属地\s*[:：]?\s*/i, '').trim();
  return place ? 'IP属地：' + place : '';
};
var benchEscape = (text) => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var benchLabel = (root, anchor, locationText) => {
  if (!anchor || !root) return;
  const own = '[data-bilireveal-bench]';
  for (const native of root.querySelectorAll('#location,.reply-location,.sub-reply-location,.ip-location')) {
    if (native.matches(own) || !native.textContent.trim() || !native.getClientRects().length) continue;
    const style = getComputedStyle(native);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      for (const label of root.querySelectorAll(own)) label.remove();
      return;
    }
  }
  let label = root.querySelector(own);
  if (!label) {
    label = document.createElement('span');
    label.setAttribute('data-bilireveal-bench', '');
    label.style.cssText = 'display:inline-block;position:static;margin-inline-start:6px;color:var(--text3,#9499a0);font:inherit;max-width:min(28ch,45vw);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto';
  }
  const text = locationText || 'IP属地：未提供';
  if (label.textContent !== text) label.textContent = text;
  label.title = locationText ? text + '（该条评论发布时的公开属地）' : '该条评论没有可展示的公开属地';
  if (anchor.nextSibling !== label) anchor.after(label);
  for (const other of root.querySelectorAll(own)) if (other !== label) other.remove();
};
var benchVueReply = (element) => {
  const sources = [element.__vueParentComponent, ...(Array.isArray(element.__vue__) ? element.__vue__ : [element.__vue__])];
  for (const app of sources) {
    const props = app?.props || app?.vnode?.props || app?.$props;
    const reply = element.classList.contains('sub-reply-item') ? props?.subReply : props?.reply;
    if (reply) return reply;
  }
};
var benchRenderVue = (element) => {
  const root = element.querySelector(element.classList.contains('sub-reply-item') ? '.sub-reply-info' : '.reply-info');
  if (!root) return;
  const anchor = root.querySelector('.reply-time,.sub-reply-time') || root.firstElementChild;
  benchLabel(root, anchor, benchLocation(benchVueReply(element)));
};
var benchRenderLit = (element) => {
  const root = element.shadowRoot;
  if (!root) return;
  benchLabel(root, root.querySelector('#pubdate'), benchLocation(element.data));
};
var benchObserveVue = () => {
  let pending = 0;
  const scan = () => {
    pending = 0;
    for (const element of document.querySelectorAll('.reply-item,.sub-reply-item')) {
      try { benchRenderVue(element); } catch {}
    }
  };
  const schedule = () => { if (!pending) pending = setTimeout(scan, 50); };
  new MutationObserver(schedule).observe(document, {childList:true,subtree:true});
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  setInterval(() => { if (!document.hidden) schedule(); }, 300);
  schedule();
};
