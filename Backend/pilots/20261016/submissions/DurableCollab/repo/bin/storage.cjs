// @ts-nocheck
// SQLite is the authority. No Y.Doc serialization is used for snapshots.
const { DatabaseSync } = require('node:sqlite')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const Y = require('yjs')
const decoding = require('lib0/decoding')
const EMPTY = new Uint8Array([0, 0])
const validRoom = room => typeof room === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(room)
const error = (status, message) => Object.assign(new Error(message), { status })

function validateUpdate (bytes) {
  const doc = new Y.Doc({ gc: false })
  try {
    const decoder = decoding.createDecoder(bytes)
    Y.readUpdate(decoder, doc)
    if (decoder.pos !== bytes.length) throw new Error('Trailing update bytes')
    Y.decodeUpdate(bytes)
  } catch (_) {
    throw error(400, 'Invalid Yjs V1 update')
  } finally {
    doc.destroy()
  }
}

function parseUpdate (value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw error(400, 'Expected canonical base64')
  }
  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) throw error(400, 'Expected canonical base64')
  validateUpdate(bytes)
  return bytes
}

class Store {
  constructor (filename) {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true })
    this.db = new DatabaseSync(filename)
    this.paused = false
    const version = this.db.prepare('PRAGMA user_version').get().user_version
    if (version > 1) {
      this.db.close()
      throw new Error(`Unsupported database schema version ${version}`)
    }
    this.db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        room TEXT PRIMARY KEY, last_seq INTEGER NOT NULL DEFAULT 0,
        snapshot_seq INTEGER NOT NULL DEFAULT 0, total_updates INTEGER NOT NULL DEFAULT 0,
        snapshot BLOB NOT NULL DEFAULT X'0000'
      );
      CREATE TABLE IF NOT EXISTS updates (
        room TEXT NOT NULL, seq INTEGER NOT NULL, payload BLOB NOT NULL,
        PRIMARY KEY (room, seq)
      );
      CREATE TABLE IF NOT EXISTS dedup (
        room TEXT NOT NULL, update_id TEXT NOT NULL, seq INTEGER NOT NULL,
        digest TEXT NOT NULL, byte_length INTEGER NOT NULL,
        PRIMARY KEY (room, update_id)
      );
      PRAGMA user_version=1;
      PRAGMA busy_timeout=100;
    `)
  }

  check () {
    if (this.paused) throw error(503, 'Process paused at failpoint')
  }

  hit (name) {
    if (process.env.BENCH_FAILPOINT !== name) return false
    if (!process.env.BENCH_MARKER) throw new Error('BENCH_MARKER required')
    fs.writeFileSync(process.env.BENCH_MARKER, JSON.stringify({ point: name, pid: process.pid }))
    this.paused = true
    return true
  }

  transaction (write, fn) {
    this.check()
    this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN')
    try {
      const result = fn()
      // A before-commit failpoint deliberately leaves the transaction open.
      if (!this.paused) this.db.exec('COMMIT')
      return result
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  boundary (room, since = 0) {
    const row = this.db.prepare('SELECT * FROM rooms WHERE room=?').get(room)
    if (!row) return { lastSeq: 0, snapshotSeq: 0, totalUpdates: 0, snapshot: EMPTY, rows: [] }
    return {
      lastSeq: row.last_seq,
      snapshotSeq: row.snapshot_seq,
      totalUpdates: row.total_updates,
      snapshot: row.snapshot,
      rows: this.db.prepare('SELECT seq,payload FROM updates WHERE room=? AND seq>? ORDER BY seq').all(room, Math.max(since, row.snapshot_seq))
    }
  }

  read (room, since = 0) {
    return this.transaction(false, () => this.boundary(room, since))
  }

  merge (boundary) {
    return Y.mergeUpdates([boundary.snapshot, ...boundary.rows.map(row => row.payload)])
  }

  append (room, bytes, updateId = null, http = false) {
    validateUpdate(bytes)
    const digest = createHash('sha256').update(bytes).digest('hex')
    const result = this.transaction(true, () => {
      if (updateId !== null) {
        const old = this.db.prepare('SELECT * FROM dedup WHERE room=? AND update_id=?').get(room, updateId)
        if (old) {
          if (old.digest !== digest || old.byte_length !== bytes.length) throw error(409, 'updateId already used for different bytes')
          return { updateId, seq: old.seq }
        }
      }
      const current = this.merge(this.boundary(room))
      const merged = Y.mergeUpdates([current, bytes])
      // Validate against the committed state before touching either SQL or a live cache.
      validateUpdate(merged)
      if (updateId === null && Buffer.from(current).equals(Buffer.from(merged))) return { seq: null }
      this.db.prepare('INSERT OR IGNORE INTO rooms(room) VALUES (?)').run(room)
      const row = this.db.prepare('UPDATE rooms SET last_seq=last_seq+1,total_updates=total_updates+1 WHERE room=? RETURNING last_seq').get(room)
      this.db.prepare('INSERT INTO updates(room,seq,payload) VALUES (?,?,?)').run(room, row.last_seq, bytes)
      if (updateId !== null) this.db.prepare('INSERT INTO dedup VALUES (?,?,?,?,?)').run(room, updateId, row.last_seq, digest, bytes.length)
      if (http && this.hit('update-before-commit')) return { paused: true }
      return { updateId, seq: row.last_seq }
    })
    if (!result.paused && http && this.hit('update-after-commit')) return { paused: true }
    return result
  }

  compact (room, http = false) {
    return this.transaction(true, () => {
      const boundary = this.boundary(room)
      const snapshot = this.merge(boundary)
      this.db.prepare('UPDATE rooms SET snapshot=?,snapshot_seq=? WHERE room=?').run(snapshot, boundary.lastSeq, room)
      this.db.prepare('DELETE FROM updates WHERE room=? AND seq<=?').run(room, boundary.lastSeq)
      if (http && this.hit('compact-before-commit')) return { paused: true }
      return { snapshotSeq: boundary.lastSeq }
    })
  }

  state (room) {
    const boundary = this.read(room)
    const update = this.merge(boundary)
    const doc = new Y.Doc({ gc: false })
    try {
      Y.applyUpdate(doc, update)
      return { update: Buffer.from(update).toString('base64'), text: doc.getText('text').toString(), lastSeq: boundary.lastSeq, snapshotSeq: boundary.snapshotSeq, totalUpdates: boundary.totalUpdates }
    } finally { doc.destroy() }
  }

  stats (room) {
    return this.transaction(false, () => {
      const row = this.db.prepare('SELECT last_seq,snapshot_seq,total_updates FROM rooms WHERE room=?').get(room)
      return {
        lastSeq: row ? row.last_seq : 0,
        snapshotSeq: row ? row.snapshot_seq : 0,
        totalUpdates: row ? row.total_updates : 0,
        logRows: this.db.prepare('SELECT count(*) AS n FROM updates WHERE room=?').get(room).n,
        dedupRows: this.db.prepare('SELECT count(*) AS n FROM dedup WHERE room=?').get(room).n
      }
    })
  }
}

let singleton
const getStore = () => {
  if (!singleton) singleton = new Store(process.env.DB_PATH || path.resolve('data/collab.sqlite'))
  return singleton
}
const retryBusy = async fn => {
  const deadline = Date.now() + 10000
  while (true) {
    try { return fn() } catch (err) {
      if (!/database is (locked|busy)/i.test(err.message) || Date.now() >= deadline) throw err
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
}
module.exports = { Store, getStore, validRoom, parseUpdate, validateUpdate, retryBusy, error }
