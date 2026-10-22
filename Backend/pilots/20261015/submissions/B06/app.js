'use strict';

const fields = ['state', 'requests', 'upstreamCalls', 'rateRejected', 'circuitRejected'];
let refreshing = false;
async function refreshStats() {
  if (refreshing) return;
  refreshing = true;
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const stats = await response.json();
    for (const field of fields) document.getElementById(field).textContent = stats[field];
    document.getElementById('state').dataset.state = stats.state;
    document.getElementById('sync').textContent = `最近同步 ${new Date().toLocaleTimeString()} · 已连接`;
  } catch (error) {
    document.getElementById('sync').textContent = `状态同步失败：${error.message}（上方数值可能已过期）`;
  } finally { refreshing = false; }
}
document.getElementById('refresh').addEventListener('click', refreshStats);
document.getElementById('relay-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('send');
  const requestedPath = document.getElementById('path').value;
  const start = performance.now();
  const time = new Date().toLocaleTimeString();
  let status = '连接失败';
  button.disabled = true;
  document.getElementById('response-meta').textContent = '请求中…';
  try {
    const response = await fetch(`/relay?${new URLSearchParams({ path: requestedPath })}`, { cache: 'no-store' });
    status = String(response.status);
    const body = await response.text();
    document.getElementById('response').textContent = body || '（空响应体）';
  } catch (error) {
    document.getElementById('response').textContent = `请求失败：${error.message}`;
  } finally {
    const elapsed = `${Math.round(performance.now() - start)} ms`;
    document.getElementById('response-meta').textContent = `${status} · ${elapsed}`;
    document.getElementById('empty')?.remove();
    const row = document.createElement('tr');
    for (const value of [time, requestedPath, status, elapsed]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const history = document.getElementById('history');
    history.prepend(row);
    while (history.children.length > 30) history.lastElementChild.remove();
    button.disabled = false;
    await refreshStats();
  }
});
refreshStats();
setInterval(refreshStats, 1000);
