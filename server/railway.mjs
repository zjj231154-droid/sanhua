import { createReadStream, existsSync, promises as fs } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRailwayVolumeBucket } from './railway-assets.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT || 3000)
const storageDirectory = String(process.env.SANHUA_STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim()
const volumeBucket = storageDirectory ? createRailwayVolumeBucket(storageDirectory) : null
const functionEnv = volumeBucket ? { ...process.env, SANHUA_ASSETS: volumeBucket } : process.env
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

const apiRoutes = {
  '/api/tokenspace': () => import('../functions/api/tokenspace/[[path]].js'),
  '/api/v1/agent-runs': () => import('../functions/api/v1/agent-runs.js'),
  '/api/v1/image-batches': () => import('../functions/api/v1/image-batches.js'),
  '/api/v1/assets': () => import('../functions/api/v1/assets.js'),
  '/api/v1/scripts': () => import('../functions/api/v1/scripts/[[path]].js'),
  '/api/v1/video-tasks': () => import('../functions/api/v1/video-tasks/[[path]].js'),
  '/api/assets': () => import('../functions/api/assets/[[key]].js'),
  '/api/v1/tasks': () => import('../functions/api/v1/tasks.js'),
  '/api/debug/tokenspace': () => import('../functions/api/debug/tokenspace.js'),
  '/api/debug/usegoodai-models': () => import('../functions/api/debug/usegoodai-models.js'),
}

const send = async (res, response) => {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}

const requestBody = request => new Promise((resolve, reject) => {
  const chunks = []; let bytes = 0
  request.on('data', chunk => { bytes += chunk.length; if (bytes > 50 * 1024 * 1024) { reject(new Error('请求体过大')); request.destroy() } else chunks.push(chunk) })
  request.on('end', () => resolve(Buffer.concat(chunks)))
  request.on('error', reject)
})

async function runApi(request, response, pathname) {
  // Asset actions share the collection prefix but are handled by the dynamic Pages Function.
  const assetAction = pathname.startsWith('/api/v1/assets/')
  const route = assetAction ? '/api/v1/assets' : Object.keys(apiRoutes).find(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (!route) return false
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await requestBody(request)
    const handler = assetAction ? await import('../functions/api/v1/assets/[[path]].js') : await apiRoutes[route]()
    const endpoint = pathname.slice(route.length).replace(/^\//, '')
    const method = `onRequest${request.method.slice(0, 1)}${request.method.slice(1).toLowerCase()}`
    const fn = handler[method]
    if (!fn) { response.writeHead(405, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' })); return true }
    const headers = new Headers()
    for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value)
    const origin = `http://${request.headers.host || `localhost:${port}`}`
    const webRequest = new Request(`${origin}${request.url}`, { method: request.method, headers, body: body?.length ? body : undefined })
    const params = route === '/api/assets' ? { key: endpoint || undefined } : { path: endpoint || undefined }
    const result = await fn({ request: webRequest, env: functionEnv, params })
    await send(response, result)
  } catch (error) {
    console.error('[railway-api]', { path: pathname, message: error.message })
    response.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    response.end(JSON.stringify({ error: 'SERVER_ERROR', message: '服务暂时不可用，请稍后重试' }))
  }
  return true
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (url.pathname === '/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true })); return }
  if (await runApi(request, response, url.pathname)) return
  const candidate = path.normalize(path.join(dist, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)))
  const safe = candidate.startsWith(dist) ? candidate : path.join(dist, 'index.html')
  const file = existsSync(safe) && (await fs.stat(safe)).isFile() ? safe : path.join(dist, 'index.html')
  response.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  createReadStream(file).pipe(response)
})

server.listen(port, '0.0.0.0', () => console.log(`Sanhua Railway service listening on ${port}`))
