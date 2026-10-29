// Real HTTP + filesystem acceptance. Does not mock models or inject generated results.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'

const root = fileURLToPath(new URL('../', import.meta.url)), port = Number(process.env.SANHUA_QA_PORT || 53128)
const storage = path.join(root, 'qa', `v2.8-live-${Date.now()}`), base = `http://127.0.0.1:${port}`
await fs.mkdir(storage, { recursive: true })
const password = randomUUID() + randomUUID(), username = 'qa_v28_owner'
const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), SANHUA_BIND_HOST: '127.0.0.1', SANHUA_STORAGE_DIR: storage, RAILWAY_VOLUME_MOUNT_PATH: '', SANHUA_ALLOW_LEGACY_DEMO: 'false', SANHUA_BOOTSTRAP_ADMIN_USERNAME: username, SANHUA_BOOTSTRAP_ADMIN_PASSWORD: password, SANHUA_BOOTSTRAP_ADMIN_PHONE: '', SANHUA_BOOTSTRAP_ADMIN_EMAIL: '', SANHUA_SECURE_COOKIES: 'false', APP_COMMIT_SHA: process.env.APP_COMMIT_SHA || 'v2.8-local-verification' }
const checks = []; let server, a, b
async function start() {
  server = spawn(process.execPath, ['server/railway.mjs'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; server.stdout.on('data', chunk => { output += chunk }); server.stderr.on('data', chunk => { output += chunk })
  for (let i = 0; i < 100; i++) {
    if (server.exitCode != null) throw new Error(`Local service exited: ${output.slice(-500)}`)
    if (output.includes('service listening')) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Local service did not start within 10 seconds')
}
async function stop() { if (server && server.exitCode == null) { const exited = once(server, 'exit'); server.kill(); await exited } }
async function api(who, route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { ...(who?.cookie ? { cookie: who.cookie } : {}), ...(body instanceof FormData ? {} : body ? { 'content-type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  return { response, data, status: response.status }
}
function check(name, expected, actual) { assert.deepEqual(actual, expected, name); checks.push({ name, result: 'passed' }) }
try {
  await start()
  const login = await api(null, '/api/v1/auth/login', 'POST', { username, password })
  check('A real login', 200, login.status); a = { cookie: login.response.headers.get('set-cookie').split(';')[0] }
  const invitation = await api(a, '/api/v1/admin/seats/S02/invites', 'POST', { role: 'editor' })
  check('Issue real seat invite', 201, invitation.status)
  const member = await api(null, '/api/v1/auth/register', 'POST', { username: 'qa_v28_member', password: randomUUID() + randomUUID(), inviteCode: invitation.data.code })
  check('B real invite registration', 201, member.status); b = { cookie: member.response.headers.get('set-cookie').split(';')[0] }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1i8AAAAASUVORK5CYII=', 'base64')
  const upload = async name => { const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), `${name}.png`); form.append('name', name); form.append('libraryKey', 'script'); form.append('folderKey', 'scene'); form.append('visibility', 'workspace'); const result = await api(a, '/api/v1/assets/upload', 'POST', form); check(`Upload ${name}`, 201, result.status); return result.data.asset }
  const good = await upload('可读场景'), broken = await upload('不可读场景')
  const shared = await api(b, '/api/v1/assets/reference-preflight', 'POST', { referencedAssetIds: [good.id] })
  check('B can reference A workspace-shared image bytes', true, shared.data.ready)
  const brokenPath = path.resolve(storage, broken.storageKey)
  assert.ok(brokenPath.startsWith(storage + path.sep))
  await fs.rename(brokenPath, `${brokenPath}.qa-unavailable`)
  const preflight = await api(a, '/api/v1/assets/reference-preflight', 'POST', { referencedAssetIds: [good.id, broken.id] })
  check('Unreadable image blocks preflight', 422, preflight.status)
  check('Readable image remains available', true, preflight.data.items[0].readable)
  check('Failure points to exact image name', '不可读场景', preflight.data.errors[0].name)
  const project = await api(a, '/api/v1/drama-projects', 'POST', { title: 'v2.8 实服验收', brief: '窗边一杯茶，纸条被微风轻轻吹动。', sceneAssetIds: [good.id] })
  check('Create persistent project', 201, project.status)
  const projectId = project.data.project.projectId
  const saved = await api(a, `/api/v1/drama-projects/${projectId}`, 'PATCH', { brief: '更新后的创作需求，保留茶杯主体和窗边光线。', generationParams: { aspectRatio: '16:9', resolution: '720p', durationSeconds: 4 }, expectedVersion: project.data.project.version })
  check('Save project with version check', 200, saved.status)
  check('Cross-account project read', 404, (await api(b, `/api/v1/drama-projects/${projectId}`)).status)
  const records = []
  for (const who of [a, b]) { const record = await api(who, '/api/v1/work-records', 'POST', { moduleKey: 'retouch', title: who === a ? 'A 精修草稿' : 'B 品牌草稿', currentStep: 3, initialData: { prompt: '真实保存的输入' } }); check('Create own persistent draft', 201, record.status); records.push(record.data.item) }
  for (const [who, foreign] of [[a, records[1]], [b, records[0]]]) {
    check('Cross-account task read', 404, (await api(who, `/api/v1/task-center/${foreign.taskId}`)).status)
    for (const action of ['cancel', 'retry', 'archive']) check(`Cross-account ${action}`, 404, (await api(who, `/api/v1/task-center/${foreign.taskId}/${action}`, 'POST', { expectedVersion: foreign.version })).status)
  }
  const ownCenter = await api(b, '/api/v1/task-center')
  check('B task list excludes A', false, ownCenter.data.items.some(item => item.taskId === records[0].taskId))
  const cancelled = await api(a, `/api/v1/task-center/${records[0].taskId}/cancel`, 'POST', { expectedVersion: records[0].version })
  check('Cancel own draft', 200, cancelled.status)
  const provider = await api(a, '/api/v1/me/video-provider-connection')
  const videoConfigured = Boolean(provider.data.connection?.model && provider.data.connection?.verificationStatus === 'verified')
  checks.push({ name: 'Actual upstream video generation', result: videoConfigured ? 'not_executed' : 'blocked', reason: videoConfigured ? 'Requires browser flow verification before execution' : 'Isolated acceptance accounts have no configured personal video model key; no production keys were copied' })
  const failedGeneration = await api(a, `/api/v1/drama-projects/${projectId}/generate-script-storyboard`, 'POST', {})
  check('Missing personal key is a real, explicit failure', 409, failedGeneration.status)
  const retained = await api(a, `/api/v1/drama-projects/${projectId}`)
  check('Generation failure preserves project input', saved.data.project.brief, retained.data.project.brief)
  await stop(); await start()
  const restored = await api(a, `/api/v1/drama-projects/${projectId}`)
  check('Session and saved input survive service restart', saved.data.project.brief, restored.data.project.brief)
  check('Generation settings survive restart', saved.data.project.generationParams, restored.data.project.generationParams)
  const history = await api(a, `/api/v1/task-center/${records[0].taskId}`)
  check('Cancellation survives restart', 'cancelled', history.data.item.status)
  const stale = await api(a, `/api/v1/drama-projects/${projectId}`, 'PATCH', { brief: '旧版本不得覆盖', expectedVersion: project.data.project.version })
  check('Stale version cannot overwrite saved input', 409, stale.status)
  const report = { environment: 'local real HTTP service, NODE_ENV=production, persistent filesystem, no mocks', baseUrl: base, storagePath: storage, productionModified: false, checks, passed: checks.filter(item => item.result === 'passed').length, browserAndViewportAcceptance: 'blocked: browser runtime cannot write kernel assets', realGeneration: 'blocked: personal provider key not configured' }
  await fs.writeFile(path.join(storage, 'verification.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, checks: checks.filter(item => item.result !== 'passed') }, null, 2))
} finally { await stop() }
