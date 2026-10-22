/* global location, fetch, AbortSignal */
import * as Y from 'yjs'
import { WebsocketProvider } from '../src/y-websocket.js'

const $ = id => document.getElementById(id)
const timeline = []
const log = message => {
  timeline.unshift(`${new Date().toLocaleTimeString()}  ${message}`)
  $('timeline').textContent = timeline.slice(0, 100).join('\n')
}
let panes = []
const verdict = () => {
  $('verdict').textContent = panes.length === 2 && panes.every(p => p.provider.synced && p.provider.wsconnected)
    ? (panes[0].text.toString() === panes[1].text.toString() ? '两端在线 · 文本已收敛' : '同步中 · 文本暂未一致')
    : '离线编辑可用 · 等待重连'
}
function createPane (label, port, room) {
  const base = `http://${location.hostname}:${port}`
  const doc = new Y.Doc()
  const text = doc.getText('text')
  const provider = new WebsocketProvider(base.replace('http:', 'ws:'), room, doc, { disableBc: true })
  const element = document.createElement('section')
  element.className = 'pane'
  element.innerHTML = `<div class="title"><h2>编辑窗口 ${label}</h2><span class="status">连接中</span></div><p class="endpoint"></p><textarea aria-label="窗口 ${label} 编辑内容" placeholder="在这里编辑；断网后仍可继续输入"></textarea><div><button class="toggle">断开网络</button> <button class="compact">压缩房间</button> <button class="check">检查持久状态</button></div><div class="metrics"><div class="metric"><small>seq</small><b class="seq">—</b></div><div class="metric"><small>snapshot</small><b class="snapshot">—</b></div><div class="metric"><small>日志行数</small><b class="rows">—</b></div></div><small>客户端实际 Y.Text</small><pre class="actual local"></pre><small>API 已提交 text</small><pre class="actual durable"></pre><small class="api-status">等待 API</small>`
  $('panes').appendChild(element)
  const find = selector => element.querySelector(selector)
  find('.endpoint').textContent = `${base} / ${room}`
  const textarea = find('textarea')
  const render = () => {
    const value = text.toString()
    if (textarea.value !== value) {
      const { selectionStart, selectionEnd } = textarea
      textarea.value = value
      textarea.setSelectionRange(Math.min(selectionStart, value.length), Math.min(selectionEnd, value.length))
    }
    find('.local').textContent = value || '（空）'
    verdict()
  }
  textarea.addEventListener('input', () => {
    const before = text.toString()
    const after = textarea.value
    let prefix = 0
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++
    let suffix = 0
    while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++
    doc.transact(() => {
      const removed = before.length - prefix - suffix
      if (removed) text.delete(prefix, removed)
      const inserted = after.slice(prefix, after.length - suffix)
      if (inserted) text.insert(prefix, inserted)
    }, 'editor')
  })
  text.observe(event => { render(); log(`${label} ${event.transaction.origin === 'editor' ? '本地编辑' : '收到同步'}：${JSON.stringify(text.toString())}`) })
  const setOnline = online => {
    if (online) provider.connect()
    else provider.disconnect()
    find('.toggle').textContent = online ? '断开网络' : '重新连接'
    log(`${label} ${online ? '请求重连' : '网络已断开，本地文档保留'}`)
    verdict()
  }
  find('.toggle').onclick = () => setOnline(!provider.shouldConnect)
  provider.on('status', ({ status }) => {
    find('.status').textContent = status
    find('.status').classList.toggle('online', status === 'connected')
    log(`${label} 连接状态：${status}`)
    verdict()
  })
  provider.on('sync', synced => { log(`${label} 协议同步：${synced}`); verdict() })
  const api = async (operation, method = 'GET') => {
    const response = await fetch(`${base}/v1/rooms/${room}/${operation}`, { method, signal: AbortSignal.timeout(2500) })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error)
    return value
  }
  const refresh = async () => {
    try {
      const state = await api('state')
      const stats = await api('stats')
      find('.seq').textContent = state.lastSeq
      find('.snapshot').textContent = state.snapshotSeq
      find('.rows').textContent = stats.logRows
      find('.durable').textContent = state.text || '（空）'
      find('.api-status').textContent = `API 检查 ${new Date().toLocaleTimeString()} · 唯一 HTTP 凭据 ${stats.dedupRows}`
      return state
    } catch (err) { find('.api-status').textContent = `API 不可用：${err.message}`; return null }
  }
  find('.compact').onclick = async () => {
    try { const result = await api('compact', 'POST'); log(`${label} 压缩提交：snapshotSeq=${result.snapshotSeq}`); await refresh() } catch (err) { log(`${label} 压缩失败：${err.message}`) }
  }
  find('.check').onclick = async () => {
    const state = await refresh()
    if (state) log(`${label} 持久检查：seq=${state.lastSeq}, snapshot=${state.snapshotSeq}, text=${JSON.stringify(state.text)}`)
  }
  render()
  refresh()
  const timer = setInterval(refresh, 1000)
  return { provider, text, setOnline, destroy: () => { clearInterval(timer); provider.destroy(); doc.destroy() } }
}
const open = () => {
  const room = $('room').value
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(room)) { log('房间名须为 1–64 位字母、数字、下划线或连字符'); return }
  panes.forEach(pane => pane.destroy())
  panes = []
  $('panes').replaceChildren()
  panes.push(createPane('A', $('port-a').value, room))
  panes.push(createPane('B', $('port-b').value, room))
  log(`连接房间 ${room}；BroadcastChannel 已禁用`)
}
$('open').onclick = open
$('offline').onclick = () => panes.forEach(pane => pane.setOnline(false))
$('online').onclick = () => panes.forEach(pane => pane.setOnline(true))
open()
