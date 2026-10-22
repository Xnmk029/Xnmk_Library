const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const Y = require('yjs')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
test('cache identity, timers, async initialization gate and load failure', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-lifecycle-'))
  process.env.DB_PATH = path.join(dir, 'cache.sqlite')
  process.env.ROOM_IDLE_MS = '50'
  const { getStore } = require('../bin/storage.cjs')
  const { getYDoc, docs, setupWSConnection, setContentInitializor } = require('../bin/utils.cjs')
  const store = getStore()
  t.after(() => {
    Array.from(docs.values()).forEach(doc => doc.destroy())
    store.db.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const source = new Y.Doc()
  source.getText('text').insert(0, 'from durable log')
  store.append('recycle', Y.encodeStateAsUpdate(source), 'u1')
  source.destroy()
  const first = getYDoc('recycle')
  await first.whenInitialized
  assert.equal(first.getText('text').toString(), 'from durable log')
  await sleep(100)
  assert.equal(docs.has('recycle'), false)
  assert.equal(first.disposed, true)
  assert.equal(first.tailTimer._destroyed, true)
  const next = getYDoc('recycle')
  await next.whenInitialized
  const pin = { terminate () {} }
  next.conns.set(pin, new Set())
  first.scheduleIdle()
  first.destroy()
  await sleep(100)
  assert.equal(docs.get('recycle'), next)
  assert.equal(next.disposed, false)
  assert.equal(next.getText('text').toString(), 'from durable log')
  next.conns.delete(pin)
  next.scheduleIdle()
  await sleep(100)
  assert.equal(docs.has('recycle'), false)

  class Socket extends EventEmitter {
    constructor () { super(); this.readyState = 1; this.sent = [] }
    send (message, _, done) { this.sent.push(message); done() }
    close () { this.readyState = 3; this.emit('close') }
    terminate () { this.close() }
    ping () {}
  }
  let release
  setContentInitializor(() => new Promise(resolve => { release = resolve }))
  const socket = new Socket()
  setupWSConnection(socket, { url: '/recycle' })
  await sleep(20)
  assert.equal(socket.sent.length, 0, 'No sync frames before initialization')
  release()
  await docs.get('recycle').whenInitialized
  await sleep(10)
  assert.ok(socket.sent.length > 0)
  assert.equal(docs.get('recycle').getText('text').toString(), 'from durable log')
  socket.close()
  await sleep(100)
  setContentInitializor(() => Promise.resolve())
  const before = store.stats('recycle')
  const originalRead = store.read
  store.read = () => { throw new Error('injected storage failure') }
  assert.throws(() => getYDoc('recycle'), /injected storage failure/)
  assert.equal(docs.has('recycle'), false)
  store.read = originalRead
  assert.deepEqual(store.stats('recycle'), before)
  const recovered = getYDoc('recycle')
  await recovered.whenInitialized
  assert.equal(recovered.getText('text').toString(), 'from durable log')
})
