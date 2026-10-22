const { spawn } = require('node:child_process')
const { once } = require('node:events')
const readline = require('node:readline')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const assert = require('node:assert/strict')
const Y = require('yjs')

const root = path.resolve(__dirname, '..')
const smoke = process.argv.includes('--smoke')
const temp = smoke ? fs.mkdtempSync(path.join(os.tmpdir(), 'collab-demo-')) : null
const database = process.env.DB_PATH || path.join(temp || root, 'data', 'demo.sqlite')
const ports = [Number(process.env.PORT_A || 1234), Number(process.env.PORT_B || 1235)]
let children = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function start () {
  children = ports.map(port => {
    const child = spawn(process.execPath, ['bin/server.cjs'], {
      cwd: root,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DB_PATH: database, BENCH_FAILPOINT: '', BENCH_MARKER: '' },
      stdio: 'inherit',
      windowsHide: true
    })
    return child
  })
  for (const [index, port] of ports.entries()) {
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (children[index].exitCode !== null) throw new Error(`Server on ${port} exited`)
      try {
        ready = (await fetch(`http://127.0.0.1:${port}/v1/health`)).ok
        if (ready) break
      } catch (_) {}
      await sleep(50)
    }
    if (!ready) throw new Error(`Server on ${port} did not become healthy`)
  }
}
async function stop () {
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return
    const exited = once(child, 'exit')
    child.kill('SIGKILL')
    await exited
  }))
  children = []
}
async function api (port, room, operation, body) {
  const res = await fetch(`http://127.0.0.1:${port}/v1/rooms/${room}/${operation}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const value = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(value))
  return value
}
async function restart (room) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(room)) throw new Error('Invalid room')
  const before = await api(ports[0], room, 'state')
  await stop()
  await start()
  const after = await api(ports[1], room, 'state')
  // A separate Yjs instance verifies the returned binary state, not just HTTP 200.
  const doc = new Y.Doc({ gc: false })
  try {
    Y.applyUpdate(doc, Buffer.from(after.update, 'base64'))
    assert.equal(doc.getText('text').toString(), before.text)
    assert.equal(after.lastSeq, before.lastSeq)
    assert.equal(after.update, before.update, 'Full update, including pending content, changed')
  } finally { doc.destroy() }
  console.log(`Restart verified: room=${room} seq=${after.lastSeq} snapshot=${after.snapshotSeq} text=${JSON.stringify(after.text)}`)
}
async function main () {
  await start()
  console.log(`Open http://127.0.0.1:${ports[0]}/ — A=${ports[0]}, B=${ports[1]}, database=${database}`)
  if (smoke) {
    const doc = new Y.Doc()
    doc.getText('text').insert(0, 'demo restart verified')
    await api(ports[0], 'smoke', 'updates', { updateId: 'smoke', update: Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64') })
    doc.destroy()
    await api(ports[1], 'smoke', 'compact', {})
    await restart('smoke')
    await stop()
    if (temp) fs.rmSync(temp, { recursive: true, force: true })
    return
  }
  console.log('Commands: r [room] = kill/restart and verify (default demo); c [room] = compact; q = stop. Pause editing before restart verification.')
  const input = readline.createInterface({ input: process.stdin, output: process.stdout })
  for await (const line of input) {
    const [command, room = 'demo'] = line.trim().split(/\s+/)
    try {
      if (command === 'q') { input.close(); break }
      if (command === 'r') await restart(room)
      if (command === 'c') console.log(await api(ports[0], room, 'compact', {}))
    } catch (err) { console.error(err.message) }
  }
  await stop()
}
process.on('SIGINT', () => { stop().then(() => process.exit(0)) })
main().catch(async err => { console.error(err); await stop(); process.exitCode = 1 })
