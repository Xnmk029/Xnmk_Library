'use strict';
const $ = id => document.getElementById(id);
const names = { reserved: '预占中', paid: '已支付', cancelled: '已取消', expired: '已过期' };
const attempts = new Map();
const pending = new Set();
let refreshing = false;
let lastOrders = [];
let hasActivity = false;
$('request-id').value = crypto.randomUUID();
$('new-id').onclick = () => { $('request-id').value = crypto.randomUUID(); };

async function api(url, body) {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, body: await response.json() };
}
function log(message, error = false) {
  if (!hasActivity) { $('activity').replaceChildren(); hasActivity = true; }
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  if (error) item.className = 'error';
  $('activity').prepend(item);
  while ($('activity').children.length > 30) $('activity').lastChild.remove();
}
function renderOrders(orders) {
  lastOrders = orders;
  $('order-count').textContent = orders.length;
  $('empty').hidden = orders.length > 0;
  const fragment = document.createDocumentFragment();
  for (const order of orders) {
    const row = document.createElement('tr');
    function cell(text) {
      const td = document.createElement('td');
      if (text !== undefined) td.textContent = text;
      row.append(td);
      return td;
    }
    cell(order.id);
    cell(order.quantity);
    const badge = document.createElement('span');
    badge.className = `badge ${order.status}`;
    badge.textContent = names[order.status] || order.status;
    cell().append(badge);
    cell(new Date(order.expiresAt).toLocaleString('zh-CN', { hour12: false }) + '.' + String(order.expiresAt % 1000).padStart(3, '0'));
    const actions = cell();
    if (order.status === 'reserved') {
      for (const [action, label] of [['pay', '支付'], ['cancel', '取消']]) {
        const button = document.createElement('button');
        button.textContent = label;
        button.disabled = pending.has(order.id);
        button.onclick = () => act(order.id, action);
        actions.append(button);
      }
    } else actions.textContent = '—';
    fragment.append(row);
  }
  $('orders-body').replaceChildren(fragment);
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const [inventory, orders] = await Promise.all([api('/api/inventory'), api('/api/orders')]);
    if (!inventory.ok || !orders.ok) throw new Error(inventory.body.error || orders.body.error);
    for (const key of ['capacity', 'available', 'reserved', 'sold']) $(key).textContent = inventory.body[key];
    renderOrders(orders.body.orders);
    $('connection').textContent = `已同步 ${new Date().toLocaleTimeString()}`;
    $('connection').className = 'connection';
  } catch {
    $('connection').textContent = '连接失败 · 显示上次数据';
    $('connection').className = 'connection error';
  } finally { refreshing = false; }
}
async function act(id, action) {
  if (pending.has(id)) return;
  pending.add(id);
  renderOrders(lastOrders);
  const key = `${id}/${action}`;
  if (!attempts.has(key)) attempts.set(key, crypto.randomUUID());
  try {
    const result = await api(`/api/orders/${id}/${action}`, { requestId: attempts.get(key) });
    log(result.ok ? `${action === 'pay' ? '支付' : '取消'}成功 · ${id} · ${names[result.body.status]}` : `${result.status} · ${result.body.error}`, !result.ok);
    if (result.status < 500) attempts.delete(key);
  } catch { log('网络异常，操作结果未知；再次点击将使用相同请求 ID 重试。', true); }
  finally { pending.delete(id); await refresh(); }
}
$('reserve-form').onsubmit = async event => {
  event.preventDefault();
  $('reserve-button').disabled = true;
  try {
    const result = await api('/api/orders', { requestId: $('request-id').value, quantity: Number($('quantity').value) });
    log(result.ok ? `${result.status} · 预占响应 ${result.body.id}，数量 ${result.body.quantity}；当前状态见列表。` : `${result.status} · ${result.body.error}`, !result.ok);
  } catch { log('网络异常，结果未知；保留请求 ID 和数量重试。', true); }
  finally { $('reserve-button').disabled = false; await refresh(); }
};
$('race-form').onsubmit = async event => {
  event.preventDefault();
  const count = Number($('concurrency').value);
  if (!Number.isInteger(count) || count < 1 || count > 100) return;
  $('race-button').disabled = true;
  $('race-result').textContent = `正在发送 ${count} 个并发请求…`;
  const results = await Promise.allSettled(Array.from({ length: count }, () => api('/api/orders', { requestId: crypto.randomUUID(), quantity: 1 })));
  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
  const insufficient = results.filter(r => r.status === 'fulfilled' && r.value.status === 409 && r.value.body.error === '可用库存不足').length;
  const other = count - success - insufficient;
  const message = `${count} 笔请求：成功 ${success} 笔，库存不足 ${insufficient} 笔，其他失败或结果未知 ${other} 笔。`;
  $('race-result').textContent = message;
  log(message, other > 0);
  $('race-button').disabled = false;
  await refresh();
};
$('refresh').onclick = refresh;
refresh();
setInterval(refresh, 500);
