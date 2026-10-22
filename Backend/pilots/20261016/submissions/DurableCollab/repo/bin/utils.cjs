// @ts-nocheck
const Y = require('yjs')
const syncProtocol = require('y-protocols/sync')
const awarenessProtocol = require('y-protocols/awareness')
const encoding = require('lib0/encoding')
const decoding = require('lib0/decoding')
const debounce = require('lodash.debounce')
const { callbackHandler, isCallbackSet } = require('./callback.cjs')
const { getStore, validRoom, retryBusy } = require('./storage.cjs')

const docs = new Map()
const COMMITTED = Symbol('committed-log')
const messageSync = 0
const messageAwareness = 1
const idleMs = Math.max(0, Number(process.env.ROOM_IDLE_MS || 1000))
let persistence = null
let contentInitializor = () => Promise.resolve()
exports.docs = docs
exports.setPersistence = value => { persistence = value }
exports.getPersistence = () => persistence
exports.setContentInitializor = fn => { contentInitializor = fn }

const send = (doc, conn, message) => {
  if (conn.readyState !== 1) return closeConn(doc, conn)
  try { conn.send(message, {}, err => { if (err) closeConn(doc, conn) }) } catch (_) { closeConn(doc, conn) }
}

const broadcastUpdate = (doc, update) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => { if (conn.collabReady) send(doc, conn, message) })
}

class WSSharedDoc extends Y.Doc {
  constructor (name) {
    super({ gc: process.env.GC !== 'false' && process.env.GC !== '0' })
    this.name = name
    this.conns = new Map()
    this.lastSeq = 0
    this.idleTimer = null
    this.tailTimer = null
    this.disposed = false
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awareness.setLocalState(null)
    this.awareness.on('update', ({ added, updated, removed }, conn) => {
      const ids = this.conns.get(conn)
      if (ids) {
        added.forEach(id => ids.add(id))
        removed.forEach(id => ids.delete(id))
      }
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, added.concat(updated, removed)))
      const message = encoding.toUint8Array(encoder)
      this.conns.forEach((_, c) => { if (c.collabReady) send(this, c, message) })
    })
    this.on('update', (update, origin) => {
      if (origin === COMMITTED) return
      // Public getYDoc/initializer mutations commit before socket broadcast.
      try {
        getStore().append(this.name, update)
        this.catchUp()
      } catch (err) {
        this.destroy()
        throw err
      }
    })
    this.callback = isCallbackSet ? debounce(callbackHandler, Number(process.env.CALLBACK_DEBOUNCE_WAIT || 2000), { maxWait: Number(process.env.CALLBACK_DEBOUNCE_MAXWAIT || 10000) }) : null
    this.whenInitialized = Promise.resolve()
  }

  catchUp () {
    if (this.disposed) throw new Error('Room already disposed')
    const boundary = getStore().read(this.name, this.lastSeq)
    const apply = update => {
      Y.applyUpdate(this, update, COMMITTED)
      // Pending structures/delete sets may not emit a Y.Doc update event.
      broadcastUpdate(this, update)
      if (this.callback) this.callback(update, COMMITTED, this)
    }
    if (boundary.snapshotSeq > this.lastSeq) apply(boundary.snapshot)
    boundary.rows.forEach(row => apply(row.payload))
    this.lastSeq = boundary.lastSeq
  }

  scheduleIdle () {
    clearTimeout(this.idleTimer)
    if (this.conns.size || this.disposed) return
    this.idleTimer = setTimeout(() => {
      if (docs.get(this.name) === this && !this.conns.size) this.destroy()
    }, idleMs)
  }

  destroy () {
    if (this.disposed) return
    this.disposed = true
    clearTimeout(this.idleTimer)
    clearInterval(this.tailTimer)
    if (this.callback) this.callback.cancel()
    if (docs.get(this.name) === this) docs.delete(this.name)
    this.conns.forEach((_, conn) => conn.terminate())
    this.conns.clear()
    this.awareness.destroy()
    super.destroy()
  }
}
exports.WSSharedDoc = WSSharedDoc

const getYDoc = (name, gc = true) => {
  if (!validRoom(name)) throw new Error('Invalid room')
  let doc = docs.get(name)
  if (doc) return doc
  doc = new WSSharedDoc(name)
  doc.gc = gc
  try { doc.catchUp() } catch (err) { doc.destroy(); throw err }
  docs.set(name, doc)
  doc.whenInitialized = Promise.resolve().then(async () => {
    if (persistence) await persistence.bindState(name, doc)
    await contentInitializor(doc)
    doc.catchUp()
    doc.tailTimer = setInterval(() => {
      try { doc.catchUp() } catch (err) {
        if (!/database is (locked|busy)|paused at failpoint/i.test(err.message)) {
          console.error('Room tail failed', name, err.message)
          doc.destroy()
        }
      }
    }, 100)
    doc.scheduleIdle()
  }).catch(err => { doc.destroy(); throw err })
  doc.whenInitialized.catch(err => console.error('Room initialization failed', name, err.message))
  return doc
}
exports.getYDoc = getYDoc

const closeConn = (doc, conn) => {
  clearInterval(conn.collabPing)
  if (doc.conns.has(conn)) {
    const ids = doc.conns.get(conn)
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(ids), null)
    doc.scheduleIdle()
  }
  if (conn.readyState < 2) conn.close()
}

const messageListener = async (conn, doc, message) => {
  if (doc.disposed || !doc.conns.has(conn)) return
  const decoder = decoding.createDecoder(message)
  const type = decoding.readVarUint(decoder)
  if (type === messageSync) {
    const subtype = decoding.readVarUint(decoder)
    if (subtype === syncProtocol.messageYjsSyncStep1) {
      const vector = decoding.readVarUint8Array(decoder)
      doc.catchUp()
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeSyncStep2(encoder, doc, vector)
      send(doc, conn, encoding.toUint8Array(encoder))
    } else if (subtype === syncProtocol.messageYjsSyncStep2 || subtype === syncProtocol.messageYjsUpdate) {
      const update = decoding.readVarUint8Array(decoder)
      if (decoder.pos !== message.length) throw new Error('Trailing sync bytes')
      await retryBusy(() => getStore().append(doc.name, update))
      if (!doc.disposed) doc.catchUp()
    } else throw new Error('Unknown sync message')
  } else if (type === messageAwareness) {
    awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
  }
}

exports.setupWSConnection = (conn, req, { docName = (req.url || '').slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'
  let doc
  try { doc = getYDoc(docName, gc) } catch (err) { conn.close(1011, 'Load failed'); return }
  clearTimeout(doc.idleTimer)
  doc.conns.set(conn, new Set())
  conn.collabReady = false
  let queuedBytes = 0
  let queue = doc.whenInitialized
  conn.on('message', message => {
    const bytes = new Uint8Array(message)
    queuedBytes += bytes.length
    if (queuedBytes > 16 * 1024 * 1024) return conn.close(1009, 'Input queue too large')
    queue = queue.then(() => messageListener(conn, doc, bytes)).catch(err => {
      console.error('Rejected WS message:', err.message)
      conn.close(1008, 'Invalid update or unavailable storage')
    }).finally(() => { queuedBytes -= bytes.length })
  })
  let pongReceived = true
  conn.collabPing = setInterval(() => {
    if (!pongReceived) { conn.terminate(); closeConn(doc, conn); return }
    pongReceived = false
    try { conn.ping() } catch (_) { closeConn(doc, conn) }
  }, 30000)
  conn.on('pong', () => { pongReceived = true })
  conn.on('close', () => closeConn(doc, conn))
  conn.on('error', () => closeConn(doc, conn))
  doc.whenInitialized.then(() => {
    if (doc.disposed || !doc.conns.has(conn) || conn.readyState !== 1) return
    doc.catchUp()
    conn.collabReady = true
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
    const states = doc.awareness.getStates()
    if (states.size) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())))
      send(doc, conn, encoding.toUint8Array(encoder))
    }
  }).catch(() => conn.close(1011, 'Load failed'))
}
