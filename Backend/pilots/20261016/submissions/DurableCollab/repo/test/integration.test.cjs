const { test } = require('node:test')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
let Y
const WebSocket = require('ws')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const until = async (fn, timeout = 7000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await fn()) return
    await sleep(25)
  }
  throw new Error('Condition timed out')
}
const root = path.resolve(__dirname, '..')
const makeUpdate = text => {
  const doc = new Y.Doc()
  doc.getText('text').insert(0, text)
  const update = Y.encodeStateAsUpdate(doc)
  doc.destroy()
  return update
}
const b64 = update => Buffer.from(update).toString('base64')

test('two real processes, standard clients, durable boundaries', { timeout: 90000 }, async t => {
  Y = await import('yjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-collab-'))
  const db = path.join(dir, 'shared.sqlite')
  const children = new Set()
  const clients = new Set()
  const { WebsocketProvider } = await import('../src/y-websocket.js')
  const start = async (extra = {}) => {
    const child = spawn(process.execPath, ['bin/server.cjs'], {
      cwd: root,
      env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DB_PATH: db, ROOM_IDLE_MS: '100', BENCH_FAILPOINT: '', BENCH_MARKER: '', ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    children.add(child)
    let output = ''
    child.stdout.on('data', data => { output += data })
    child.stderr.on('data', data => { output += data })
    await until(() => {
      if (child.exitCode !== null) throw new Error(output)
      return /on port (\d+)/.test(output)
    })
    const port = Number(/on port (\d+)/.exec(output)[1])
    return { child, port, url: `http://127.0.0.1:${port}`, logs: () => output }
  }
  const stop = async server => {
    if (!children.has(server.child)) return
    const exited = once(server.child, 'exit')
    server.child.kill('SIGKILL')
    await exited
    children.delete(server.child)
  }
  const api = async (server, room, operation, input, expected = 200) => {
    const res = await fetch(`${server.url}/v1/rooms/${room}/${operation}`, {
      method: input === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: AbortSignal.timeout(15000)
    })
    const result = await res.json()
    assert.equal(res.status, expected, JSON.stringify(result))
    return result
  }
  const put = (server, room, id, update, expected) => api(server, room, 'updates', { updateId: id, update: b64(update) }, expected)
  const client = (server, room, doc = new Y.Doc()) => {
    const provider = new WebsocketProvider(server.url.replace('http:', 'ws:'), room, doc, { WebSocketPolyfill: WebSocket, disableBc: true })
    const value = { doc, provider, text: doc.getText('text') }
    clients.add(value)
    return value
  }
  const destroy = c => { c.provider.destroy(); c.doc.destroy(); clients.delete(c) }
  const assertTruth = async (server, room, updates) => {
    const truth = new Y.Doc({ gc: false })
    const actual = new Y.Doc({ gc: false })
    try {
      updates.forEach(update => Y.applyUpdate(truth, update))
      const state = await api(server, room, 'state')
      Y.applyUpdate(actual, Buffer.from(state.update, 'base64'))
      assert.equal(state.text, truth.getText('text').toString())
      assert.equal(actual.getText('text').toString(), truth.getText('text').toString())
      assert.deepEqual(Y.encodeStateVector(actual), Y.encodeStateVector(truth))
      return state
    } finally { truth.destroy(); actual.destroy() }
  }
  t.after(async () => {
    clients.forEach(destroy)
    for (const child of Array.from(children)) await stop({ child })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  let a = await start()
  let b = await start()

  await t.test('empty state, strict input rejection and room validation', async () => {
    const empty = await api(a, 'empty', 'state')
    assert.deepEqual(empty, { update: 'AAA=', text: '', lastSeq: 0, snapshotSeq: 0, totalUpdates: 0 })
    const update = makeUpdate('unchanged')
    for (const value of ['AAA', 'AAB=', ' AAA=', '!!!!', b64(Buffer.concat([Buffer.from(update), Buffer.from([1])])), b64(new Uint8Array([255]))]) {
      await api(a, 'invalid', 'updates', { updateId: 'bad', update: value }, 400)
    }
    assert.equal((await api(a, 'invalid', 'stats')).lastSeq, 0)
    for (const room of ['bad%20room', 'a'.repeat(65), '%E4%B8%AD', 'bad.name']) {
      await api(a, room, 'state', undefined, 400)
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(a.url.replace('http:', 'ws:') + '/' + room)
        ws.on('unexpected-response', (_, res) => { assert.equal(res.statusCode, 400); res.resume(); ws.terminate(); resolve() })
        ws.on('open', () => { ws.terminate(); reject(new Error('Invalid room accepted')) })
        ws.on('error', () => {})
      })
    }
  })

  await t.test('cross-process WS, awareness cleanup, offline concurrent edits and no echo log', async () => {
    const ca = client(a, 'live')
    const cb = client(b, 'live')
    await until(() => ca.provider.synced && cb.provider.synced)
    const started = Date.now()
    ca.text.insert(0, 'base')
    await until(() => cb.text.toString() === 'base', 1900)
    assert.ok(Date.now() - started < 2000)
    const local = client(a, 'live')
    await until(() => local.provider.synced)
    ca.provider.awareness.setLocalStateField('name', 'alice')
    await until(() => local.provider.awareness.getStates().has(ca.doc.clientID))
    ca.provider.disconnect()
    await until(() => !local.provider.awareness.getStates().has(ca.doc.clientID))
    cb.provider.disconnect()
    ca.doc.transact(() => { ca.text.delete(0, 1); ca.text.insert(0, 'A') })
    cb.doc.transact(() => { cb.text.insert(4, 'B'); cb.text.delete(1, 1) })
    const updates = [Y.encodeStateAsUpdate(ca.doc), Y.encodeStateAsUpdate(cb.doc)]
    ca.provider.connect()
    cb.provider.connect()
    await until(() => ca.provider.synced && cb.provider.synced && ca.text.toString() === cb.text.toString())
    await assertTruth(b, 'live', updates)
    const before = await api(a, 'live', 'stats')
    await sleep(400)
    assert.deepEqual(await api(b, 'live', 'stats'), before)
    destroy(local); destroy(ca); destroy(cb)
    await sleep(200)
    const rejoined = client(b, 'live')
    await until(() => rejoined.provider.synced)
    const state = await assertTruth(a, 'live', updates)
    assert.equal(rejoined.text.toString(), state.text)
    destroy(rejoined)
  })

  await t.test('concurrent HTTP dedup, permanent conflict, equal bytes with distinct IDs', async () => {
    const update = makeUpdate('exact bytes')
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => put(i % 2 ? a : b, 'dedup', 'same', update)))
    results.forEach(result => assert.equal(result.seq, 1))
    await put(b, 'dedup', 'same', makeUpdate('conflict'), 409)
    assert.equal((await put(a, 'dedup', 'different', update)).seq, 2)
    await api(a, 'dedup', 'compact', {})
    await stop(a); a = await start()
    assert.equal((await put(a, 'dedup', 'same', update)).seq, 1)
    await put(a, 'dedup', 'same', makeUpdate('conflict again'), 409)
    assert.deepEqual(await api(b, 'dedup', 'stats'), { lastSeq: 2, snapshotSeq: 2, totalUpdates: 2, logRows: 0, dedupRows: 2 })
    await assertTruth(a, 'dedup', [update])
  })

  await t.test('multiwriter compaction, simultaneous compactors, snapshot-gap tail, isolation', async () => {
    const watcher = client(b, 'race')
    await until(() => watcher.provider.synced)
    const updates = Array.from({ length: 40 }, (_, i) => makeUpdate(`[${i}]`))
    const other = makeUpdate('separate room')
    await put(a, 'other', 'fixed', other)
    const pending = updates.map((update, i) => put(i % 2 ? a : b, 'race', `u${i}`, update))
    for (let i = 0; i < 10; i++) pending.push(api(i % 2 ? a : b, 'race', 'compact', {}))
    await Promise.all(pending)
    await api(a, 'race', 'compact', {})
    const state = await assertTruth(b, 'race', updates)
    await until(() => watcher.text.toString() === state.text)
    assert.deepEqual(await api(a, 'race', 'stats'), { lastSeq: 40, snapshotSeq: 40, totalUpdates: 40, logRows: 0, dedupRows: 40 })
    assert.equal((await api(b, 'other', 'stats')).logRows, 1)
    await assertTruth(a, 'other', [other])
    destroy(watcher)
  })

  await t.test('unresolved structs and delete sets survive compact, kill, restart', async () => {
    for (const mode of ['dependency', 'delete']) {
      const source = new Y.Doc({ gc: false })
      const updates = []
      source.on('update', update => updates.push(update))
      source.getText('text').insert(0, 'first')
      if (mode === 'dependency') source.getText('text').insert(5, '-second')
      else source.getText('text').delete(1, 3)
      await put(a, mode, 'late-first', updates[1])
      const pending = await api(b, mode, 'state')
      assert.equal(pending.text, '')
      const independent = new Y.Doc({ gc: false })
      Y.applyUpdate(independent, Buffer.from(pending.update, 'base64'))
      Y.applyUpdate(independent, updates[0])
      assert.equal(independent.getText('text').toString(), source.getText('text').toString())
      independent.destroy()
      await api(b, mode, 'compact', {})
      await stop(a); await stop(b)
      a = await start(); b = await start()
      const recovered = await api(a, mode, 'state')
      const recoveredDoc = new Y.Doc({ gc: false })
      Y.applyUpdate(recoveredDoc, Buffer.from(recovered.update, 'base64'))
      Y.applyUpdate(recoveredDoc, updates[0])
      assert.equal(recoveredDoc.getText('text').toString(), source.getText('text').toString())
      recoveredDoc.destroy()
      const observer = client(b, mode)
      await until(() => observer.provider.synced)
      await put(a, mode, 'now-first', updates[0])
      await assertTruth(b, mode, updates)
      await until(() => observer.text.toString() === source.getText('text').toString())
      destroy(observer)
      source.destroy()
    }
  })

  for (const point of ['update-before-commit', 'update-after-commit', 'compact-before-commit']) {
    await t.test(`SIGKILL at ${point}`, async () => {
      const room = point
      const marker = path.join(dir, `${point}.marker`)
      const update = makeUpdate(point)
      if (point.startsWith('compact')) await put(a, room, 'u1', update)
      const fault = await start({ BENCH_FAILPOINT: point, BENCH_MARKER: marker })
      let responded = false
      const request = fetch(`${fault.url}/v1/rooms/${room}/${point.startsWith('compact') ? 'compact' : 'updates'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updateId: 'u1', update: b64(update) }),
        signal: AbortSignal.timeout(12000)
      }).then(() => { responded = true }, () => {})
      await until(() => fs.existsSync(marker))
      assert.equal(JSON.parse(fs.readFileSync(marker, 'utf8')).point, point)
      assert.equal(responded, false)
      assert.equal((await fetch(`${a.url}/v1/health`)).status, 200)
      const during = await api(b, room, 'stats')
      assert.equal(during.lastSeq, point === 'update-before-commit' ? 0 : 1)
      if (point.startsWith('compact')) assert.equal(during.logRows, 1)
      await stop(fault)
      await request
      const recovered = await start()
      const after = await api(recovered, room, 'stats')
      assert.deepEqual(after, during)
      if (point !== 'update-before-commit') await assertTruth(recovered, room, [update])
      assert.equal((await put(recovered, room, 'u1', update)).seq, 1)
      await api(recovered, room, 'compact', {})
      assert.equal((await api(recovered, room, 'stats')).logRows, 0)
      await assertTruth(a, room, [update])
      await stop(recovered)
    })
  }
})
