#!/usr/bin/env node
// @ts-nocheck
const WebSocket = require('ws')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { setupWSConnection, docs } = require('./utils.cjs')
const { getStore, validRoom, parseUpdate, retryBusy, error } = require('./storage.cjs')
const store = getStore()
const wss = new WebSocket.Server({ noServer: true, maxPayload: 8 * 1024 * 1024 })
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 1234)
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(body))
}
const body = async req => {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) throw error(413, 'Body too large')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch (_) { throw error(400, 'Invalid JSON') }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = (req.url || '/').split('?')[0]
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
      res.end()
      return
    }
    if (req.method === 'GET' && pathname === '/v1/health') return json(res, 200, { ok: true })
    if (req.method === 'GET' && (pathname === '/' || pathname === '/demo.js')) {
      const file = pathname === '/' ? 'index.html' : 'bundle.js'
      const filename = path.join(__dirname, '../demo', file)
      if (!fs.existsSync(filename)) throw error(404, 'Run npm run demo:build first')
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript' })
      res.end(fs.readFileSync(filename))
      return
    }
    const match = /^\/v1\/rooms\/([^/]+)\/(updates|state|compact|stats)$/.exec(pathname)
    if (!match || !validRoom(match[1])) throw error(400, 'Invalid room or route')
    const [, room, operation] = match
    let result
    if (req.method === 'POST' && operation === 'updates') {
      const input = await body(req)
      if (!input || typeof input.updateId !== 'string' || input.updateId.length === 0) throw error(400, 'updateId must be a nonempty string')
      const update = parseUpdate(input.update)
      result = await retryBusy(() => store.append(room, update, input.updateId, true))
      if (result.paused) return
      const doc = docs.get(room)
      if (doc && !doc.disposed) {
        try { doc.catchUp() } catch (err) { console.error('Cache refresh failed', err.message); doc.destroy() }
      }
    } else if (req.method === 'POST' && operation === 'compact') {
      result = await retryBusy(() => store.compact(room, true))
      if (result.paused) return
    } else if (req.method === 'GET' && operation === 'state') {
      result = store.state(room)
    } else if (req.method === 'GET' && operation === 'stats') {
      result = store.stats(room)
    } else throw error(405, 'Method not allowed')
    json(res, 200, result)
  } catch (err) {
    const status = err.status || (/database is (locked|busy)/i.test(err.message) ? 503 : 500)
    if (status === 500) console.error(err)
    if (!res.headersSent) json(res, status, { error: status === 500 ? 'Storage operation failed' : err.message })
  }
})

wss.on('connection', (conn, req) => setupWSConnection(conn, req))
server.on('upgrade', (request, socket, head) => {
  const room = (request.url || '').slice(1).split('?')[0]
  if (!validRoom(room)) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    return
  }
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
})
server.listen(port, host, () => console.log(`running at '${host}' on port ${server.address().port}`))
