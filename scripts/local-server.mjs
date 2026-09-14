import { spawn } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
// A loopback-only lock prevents multiple launchers from spawning servers.
const lock = net.createServer(socket => socket.end())
lock.on('error', () => process.exit(0))
lock.listen(5174, '127.0.0.1', start)
let child
let stopping = false
function start() {
  if (stopping) return
  console.log(new Date().toISOString(), 'Starting local workbench on 127.0.0.1:5173')
  child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd, windowsHide: true, stdio: 'inherit' })
  child.on('error', error => console.error(error.message))
  child.on('close', code => {
    console.log(new Date().toISOString(), 'Server exited:', code)
    if (!stopping) setTimeout(start, 5000)
  })
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true
  child?.kill()
  lock.close(() => process.exit(0))
})
