import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { onRequestGet as centerGet, onRequestPost as centerPost } from './[[path]].js'
import * as tasks from '../tasks.js'
import * as work from '../work-records/[[path]].js'
import * as video from '../video-tasks/[[path]].js'
import * as results from '../generated-results/[[path]].js'
import * as assets from '../assets/[[path]].js'
import * as assetList from '../assets.js'
import * as rawAssets from '../../assets/[[key]].js'
import * as texts from '../text-records/[[path]].js'
import * as scripts from '../scripts/[[path]].js'
import * as projects from '../drama-projects/[[path]].js'
import { onRequestPost as auth } from '../collaboration/[[path]].js'
import { prepareAuthentication, createSeatInvite } from '../../../_lib/auth-system.js'
import { listUsers, saveImageProviderConnection, saveProviderConnection } from '../../../_lib/collaboration.js'
import { onRequestPost as generateImages } from '../image-batches.js'
import { onRequestPost as assistant } from '../../tokenspace/[[path]].js'
import { archiveImageOutputs, putJson } from '../../../_lib/asset-store.js'
import { getTask, saveTask, updateTask } from '../../../_lib/task-store.js'
import { getWorkRecord, updateWorkRecord } from '../../../_lib/work-record-store.js'

class Bucket {
  constructor(values = new Map()) { this.values = values }
  async put(key, value, options = {}) { this.values.set(key, { value, options }) }
  async get(key) { const item = this.values.get(key); if (!item) return null; const bytes = typeof item.value === 'string' ? new TextEncoder().encode(item.value) : new Uint8Array(item.value); return { json: async () => JSON.parse(new TextDecoder().decode(bytes)), body: bytes, arrayBuffer: async () => bytes.buffer, httpMetadata: item.options.httpMetadata } }
  async list({ prefix = '', limit = 1000, cursor } = {}) { const keys = [...this.values.keys()].filter(key => key.startsWith(prefix) && (!cursor || key > cursor)).sort(), page = keys.slice(0, limit); return { objects: page.map(key => ({ key })), truncated: keys.length > limit, cursor: page.at(-1) } }
  async delete(key) { this.values.delete(key) }
}
let env, a, b
afterEach(() => vi.unstubAllGlobals())
const context = (who, route = 'task-center', path = '', method = 'GET', body) => ({ env, params: { path: path.split('?')[0].split('/').filter(Boolean) }, request: new Request(`https://app.test/api/v1/${route}/${path}`, { method, headers: { cookie: who.cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }) })
const create = async (who, workspace = 'retouch') => {
  const response = await tasks.onRequestPost(context(who, 'tasks', '', 'POST', { workspace, createdBy: 'forged-owner', ownerUserId: 'forged-owner', workspaceId: 'forged-workspace' }))
  expect(response.status).toBe(202); return response.json()
}
beforeAll(async () => {
  env = { SANHUA_ASSETS: new Bucket(), SANHUA_BOOTSTRAP_ADMIN_USERNAME: 'v27_owner', SANHUA_BOOTSTRAP_ADMIN_PASSWORD: 'fixture-password-v27' }
  await prepareAuthentication({ env })
  const login = await auth({ env, request: new Request('https://app.test/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: 'v27_owner', password: 'fixture-password-v27' }) }) })
  expect(login.status).toBe(200)
  a = { cookie: login.headers.get('set-cookie').split(';')[0], id: (await login.json()).user.id }
  const owner = (await listUsers(env.SANHUA_ASSETS))[0], invite = await createSeatInvite(env.SANHUA_ASSETS, owner, 'S02')
  const registered = await auth({ env, request: new Request('https://app.test/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ username: 'v27_member', password: 'fixture-member-v27', inviteCode: invite.code }) }) })
  expect(registered.status).toBe(201)
  b = { cookie: registered.headers.get('set-cookie').split(';')[0], id: (await registered.json()).user.id }
}, 20000)

it('task_center_filters_by_session_user even when both real sessions share a workspace and an owner is forged', async () => {
  await Promise.all([create(a), create(b, 'brand')])
  for (const who of [a, b]) {
    const data = await (await centerGet(context(who, 'task-center', '?ownerUserId=forged-owner&workspaceId=forged-workspace'))).json()
    expect(data.items.length).toBeGreaterThan(0)
    expect(data.items.every(item => item.ownerUserId === who.id && item.workspaceId === 'main' && item.visibility === 'private')).toBe(true)
    expect(data.summary).not.toHaveProperty('averageProgress')
    const legacy = await (await tasks.onRequestGet(context(who, 'tasks', '?ownerUserId=forged-owner&compatibilityMode=true'))).json()
    expect(legacy.tasks.every(task => task.ownerUserId === who.id)).toBe(true)
  }
})

it('cross_user_get_cancel_retry_archive_update_download_are_denied in both directions, including an administrator', async () => {
  for (const [owner, other] of [[a, b], [b, a]]) {
    const task = await create(owner, 'video')
    for (const id of [task.id, task.workRecordId]) {
      expect((await centerGet(context(other, 'task-center', id))).status).toBe(404)
      for (const action of ['cancel', 'retry', 'archive', 'archive-results']) expect((await centerPost(context(other, 'task-center', `${id}/${action}`, 'POST', { expectedVersion: 1 }))).status).toBe(404)
    }
    expect((await tasks.onRequestGet(context(other, 'tasks', `?id=${task.id}`))).status).toBe(404)
    expect((await tasks.onRequestPatch(context(other, 'tasks', '', 'PATCH', { id: task.id, expectedVersion: task.version, status: 'completed' }))).status).toBe(404)
    expect((await tasks.onRequestDelete(context(other, 'tasks', `?id=${task.id}`, 'DELETE'))).status).toBe(404)
    expect((await video.onRequestGet(context(other, 'video-tasks', `${task.id}/download`))).status).toBe(404)
    expect((await video.onRequestGet(context(other, 'video-tasks', task.id))).status).toBe(404)
    expect((await work.onRequestGet(context(other, 'work-records', task.workRecordId))).status).toBe(404)
    expect((await work.onRequestPatch(context(other, 'work-records', task.workRecordId, 'PATCH', { status: 'ready' }))).status).toBe(404)
    for (const action of ['submit', 'cancel', 'retry', 'archive']) expect((await work.onRequestPost(context(other, 'work-records', `${task.workRecordId}/${action}`, 'POST', {}))).status).toBe(404)
  }
})

it('personal text, script, project and generated result references stay owner scoped while shared upload assets remain usable', async () => {
  for (const [owner, other] of [[a, b], [b, a]]) {
    const task = await create(owner)
    const generated = await archiveImageOutputs(context(owner), { taskId: task.workRecordId, workspace: 'retouch', outputs: [{ b64_json: 'AQID' }], prompt: '茶杯', model: 'fixture' })
    const asset = generated.assets[0]
    for (const suffix of ['', '/download', '/locations']) expect((await assets.onRequestGet(context(other, 'assets', asset.id + suffix))).status).toBe(404)
    const raw = context(other); raw.params = { key: asset.storageKey.split('/') }
    expect((await rawAssets.onRequestGet(raw)).status).toBe(404)
    expect((await results.onRequestGet(context(other, 'generated-results', asset.id))).status).toBe(404)
    expect((await results.onRequestPost(context(other, 'generated-results', `${asset.id}/archive`, 'POST', { libraryKey: 'retouch', folderKey: 'result' }))).status).toBe(404)
    expect((await (await assetList.onRequestGet(context(other, 'assets'))).json()).assets.some(row => row.id === asset.id)).toBe(false)
    const text = (await (await texts.onRequestPost(context(owner, 'text-records', '', 'POST', { content: '本人提示词', ownerUserId: other.id, createdBy: other.id, workspace: 'script' }))).json()).record
    expect(text.ownerUserId).toBe(owner.id)
    expect((await texts.onRequestGet(context(other, 'text-records', text.id))).status).toBe(404)
    expect((await texts.onRequestPost(context(other, 'text-records', `${text.id}/restore`, 'POST', {}))).status).toBe(404)
    const script = (await (await scripts.onRequestPost(context(owner, 'scripts', '', 'POST', { title: '本人剧本' }))).json()).script
    expect((await scripts.onRequestGet(context(other, 'scripts', `${script.id}/versions`))).status).toBe(404)
    const project = (await (await projects.onRequestPost(context(owner, 'drama-projects', '', 'POST', { title: '本人项目' }))).json()).project
    expect((await projects.onRequestGet(context(other, 'drama-projects', project.projectId))).status).toBe(404)
    expect((await projects.onRequestPost(context(other, 'drama-projects', `${project.projectId}/video-tasks`, 'POST', {}))).status).toBe(404)
  }
  await putJson(env.SANHUA_ASSETS, 'metadata/assets/shared-upload.json', { id: 'shared-upload', createdBy: a.id, workspaceId: 'main', visibility: 'workspace', sourceTaskId: null, assetSpace: 'script', assetType: 'image', name: '共享场景' })
  expect((await assets.onRequestGet(context(b, 'assets', 'shared-upload'))).status).toBe(200)
})

it('continue_restores_exact_module_state and cancel_draft_preserves_history across storage reloads', async () => {
  const task = await create(b)
  const record = await updateWorkRecord({ env }, task.workRecordId, { route: 'create', subRoute: 'one-click', currentStep: 5, inputAssetIds: ['shared-upload'], generationParams: { aspectRatio: '9:16', resolution: '2K', apiKey: 'must-be-removed' }, draftData: { prompt: '最新提示词', selectedAssetIds: ['shared-upload'], currentStep: 5 } })
  env = { ...env, SANHUA_ASSETS: new Bucket(env.SANHUA_ASSETS.values) }
  const restored = await (await centerGet(context(b, 'task-center', record.taskId))).json()
  expect(restored.record).toMatchObject({ route: 'create', subRoute: 'one-click', currentStep: 5, inputAssetIds: ['shared-upload'], generationParams: { aspectRatio: '9:16', resolution: '2K' }, draftData: { prompt: '最新提示词' } })
  expect(restored.record.generationParams).not.toHaveProperty('apiKey')
  const cancelled = await centerPost(context(b, 'task-center', `${record.taskId}/cancel`, 'POST', { expectedVersion: record.version }))
  expect(cancelled.status).toBe(200)
  expect((await getWorkRecord({ env }, record.taskId))).toMatchObject({ status: 'cancelled', cancelledBy: b.id, draftData: { prompt: '最新提示词' } })
  expect((await (await centerGet(context(b))).json()).recentCompleted.some(item => item.id === record.taskId && item.status === 'cancelled')).toBe(true)
})

it('archive failure keeps durable outputs and owner can retry without generating or duplicating images', async () => {
  const task = await saveTask({ env }, { id: crypto.randomUUID(), workspace: 'retouch', workspaceId: 'main', createdBy: b.id, status: 'failed', pendingArchive: { taskId: 'retry-fixture', workspace: 'retouch', outputs: [{ b64_json: 'AQID', archiveAssetId: crypto.randomUUID() }], model: 'fixture', prompt: '茶杯' } })
  expect((await centerPost(context(a, 'task-center', `${task.workRecordId}/archive-results`, 'POST', {}))).status).toBe(404)
  expect((await centerPost(context(b, 'task-center', `${task.workRecordId}/archive-results`, 'POST', {}))).status).toBe(200)
  const saved = await getTask({ env }, task.id)
  expect(saved.status).toBe('completed'); expect(saved.pendingArchive).toBeNull(); expect(saved.outputIds).toHaveLength(1)
  expect((await (await centerGet(context(b, 'task-center', task.workRecordId))).json()).item.resultAssetIds).toEqual(saved.outputIds)
  expect((await centerPost(context(b, 'task-center', `${task.workRecordId}/archive-results`, 'POST', {}))).status).toBe(409)
})

it('an actual image archive write failure preserves output bytes and retry reuses partially written assets', async () => {
  env.SANHUA_CONNECTION_ENCRYPTION_KEY = 'fixture-encryption-v27'
  await saveImageProviderConnection({ env }, b.id, { provider: 'fixture', baseUrl: 'https://provider.example.test/v1', apiKey: 'fixture-image-key', model: 'image-model' })
  const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'AQID' }] }), { status: 200 }))
  vi.stubGlobal('fetch', upstream)
  const bucket = env.SANHUA_ASSETS, put = bucket.put.bind(bucket)
  let failed = false
  bucket.put = async (key, value, options) => { if (!failed && key.startsWith('metadata/master-assets/')) { failed = true; throw new Error('injected storage outage') }; return put(key, value, options) }
  const response = await generateImages(context(b, 'image-batches', '', 'POST', { workspace: 'retouch', prompt: '茶杯光线修复', images: ['data:image/png;base64,AQID'], count: 1 }))
  expect(response.status).toBe(502)
  const pending = [...bucket.values.entries()].filter(([key]) => key.startsWith('metadata/tasks/')).map(([, value]) => JSON.parse(value.value)).find(task => task.createdBy === b.id && task.pendingArchive)
  expect(pending.pendingArchive.outputs[0].b64_json).toBe('AQID')
  const assetId = pending.pendingArchive.outputs[0].archiveAssetId
  const retried = await centerPost(context(b, 'task-center', `${pending.workRecordId}/archive-results`, 'POST', {}))
  expect(retried.status).toBe(200)
  expect((await retried.json()).item.resultAssetIds).toEqual([assetId])
  expect(upstream).toHaveBeenCalledTimes(1)
  expect([...bucket.values.keys()].filter(key => key === `metadata/assets/${assetId}.json`)).toHaveLength(1)
  bucket.put = put
})

it('legacy assistant and text generation sources enter the same owner scoped task center', async () => {
  env.SANHUA_CONNECTION_ENCRYPTION_KEY = 'fixture-encryption-v27'
  await saveProviderConnection({ env }, b.id, { provider: 'fixture', baseUrl: 'https://provider.example.test/v1', apiKey: 'fixture-text-key', reasoningModel: 'fixture-model' })
  for (const type of ['analyze', 'prompt']) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '本人助手输出' } }] }), { status: 200 })))
    const response = await assistant({ ...context(b, 'tokenspace', '', 'POST', { type, image: 'data:image/png;base64,AQID', prompt: '分析茶杯素材', sourceAssetIds: ['shared-upload'] }), params: { path: [] } })
    expect(response.status).toBe(200)
  }
  const own = await (await centerGet(context(b))).json()
  expect(own.items.some(item => item.title === '图片识别助手' && item.resultTextRecordIds.length === 1)).toBe(true)
  expect(own.active.some(item => item.title === '精修提示词助手' && item.status === 'ready')).toBe(true)
  const other = await (await centerGet(context(a))).json()
  expect(other.items.some(item => item.title === '图片识别助手' && item.ownerUserId === b.id)).toBe(false)
})

it('task snapshots never persist credentials from nested client metadata', async () => {
  const task = await saveTask({ env }, { id: crypto.randomUUID(), workspace: 'retouch', workspaceId: 'main', createdBy: a.id, status: 'draft', draftData: { prompt: '茶杯', apiKey: 'fixture-private', nested: { password: 'fixture-password', authorization: 'fixture-session', ratio: '9:16' } } })
  const saved = await getTask({ env }, task.id)
  expect(saved.draftData).toEqual({ prompt: '茶杯', nested: { ratio: '9:16' } })
  expect((await getWorkRecord({ env }, task.workRecordId)).draftData).not.toHaveProperty('apiKey')
})
