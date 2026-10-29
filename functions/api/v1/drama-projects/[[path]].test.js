import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'
import { getScript } from '../../../_lib/script-store.js'
import { listTextRecords } from '../../../_lib/text-record-store.js'
import { saveVideoProviderConnection } from '../../../_lib/collaboration.js'
import { assetMetadataKey } from '../../../_lib/asset-store.js'
import { updateTask } from '../../../_lib/task-store.js'
import { listWorkRecords } from '../../../_lib/work-record-store.js'

class Bucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) {
    const value = this.values.get(key)
    if (value === undefined) return null
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
    return { async json() { return JSON.parse(new TextDecoder().decode(bytes)) }, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}
const env = () => ({ SANHUA_ASSETS: new Bucket(), USEGOODAI_API_KEY: 'test-reasoning-key' })
const context = (environment, path, method = 'GET', body) => ({ env: environment, params: { path }, request: new Request(`https://example.test/api/v1/drama-projects/${path || ''}`, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }) })
const post = (environment, path, body) => onRequestPost(context(environment, path, 'POST', body))
const patch = (environment, path, body) => onRequestPatch(context(environment, path, 'PATCH', body))
const modelOutput = { summary: '掌柜化解误会', characters: ['掌柜', '顾客'], scenes: ['茶馆'], script: '第一场：掌柜走进茶馆，与顾客发生误会并化解。', shots: [
  { scene: '茶馆', characters: ['掌柜'], prompt: '镜头一：掌柜走入茶馆，竖屏中景，保持人物与场景连续。', action: '走入', camera: '缓推', dialogue: '欢迎', sound: '茶杯声', durationSeconds: 8 },
  { scene: '茶馆', characters: ['顾客'], prompt: '镜头二：顾客抬头回应，竖屏近景，承接上一个镜头。', action: '抬头', camera: '近景', dialogue: '你好', sound: '环境声', durationSeconds: 8 },
] }
const mockReasoning = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(modelOutput) } }] }), { status: 200 })))

describe('v2.5 drama projects', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('video archive failure preserves its result and retry reuses the same asset ID', async () => {
    const storage = env()
    const project = (await (await post(storage, '', { title: '归档恢复测试', brief: '一杯茶在窗边的微短剧，镜头缓慢推进。' })).json()).project
    mockReasoning()
    const generated = (await (await post(storage, `${project.projectId}/generate-script-storyboard`, {})).json()).project
    await post(storage, `${project.projectId}/confirm-script-storyboard`, {})
    await saveVideoProviderConnection({ env: storage }, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'fixture-video-key', model: 'doubao-seedance-2.0' })
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'archive-result', url: 'https://cdn.example.test/video.mp4' }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    const submitted = await (await post(storage, `${project.projectId}/video-tasks`, { mode: 'single', shotIds: [generated.shots[0].shotId], durationSeconds: 4 })).json()
    const task = submitted.tasks[0], originalPut = storage.SANHUA_ASSETS.put.bind(storage.SANHUA_ASSETS)
    let failed = false
    storage.SANHUA_ASSETS.put = async (key, value) => { if (!failed && key.startsWith('metadata/drama-projects/')) { failed = true; throw new Error('injected archive outage') }; return originalPut(key, value) }
    const rejected = await post(storage, `${project.projectId}/video-assets/${task.id}/accept`, {})
    expect(rejected.status).toBe(502)
    const pending = await storage.SANHUA_ASSETS.get(`metadata/tasks/${task.id}.json`).then(item => item.json())
    expect(pending).toMatchObject({ archiveStatus: 'archive_failed', providerVideoUrl: 'https://cdn.example.test/video.mp4' })
    const accepted = await post(storage, `${project.projectId}/video-assets/${task.id}/accept`, {})
    expect(accepted.status).toBe(200)
    expect((await accepted.json()).assetId).toBe(pending.archiveAssetId)
    expect((await storage.SANHUA_ASSETS.list({ prefix: 'metadata/assets/' })).objects).toHaveLength(1)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('creates a draft project and generates a script and storyboard together without mandatory assets', async () => {
    const storage = env()
    const created = (await (await post(storage, '', { title: '茶馆误会' })).json()).project
    expect(created.stage).toBe('requirements')
    expect(created.currentTaskId).toBeTruthy()
    const edited = (await (await patch(storage, created.projectId, { brief: '掌柜与顾客在茶馆发生误会，并在三分钟内化解。', expectedVersion: created.version })).json()).project
    mockReasoning()
    const response = await post(storage, `${created.projectId}/generate-script-storyboard`, {})
    expect(response.status).toBe(200)
    const generated = (await response.json()).project
    expect(generated.stage).toBe('script_storyboard')
    expect(generated.scriptId).toBeTruthy()
    expect(generated.storyboardId).toBeTruthy()
    expect(generated.shots).toHaveLength(2)
    expect(generated.textRecordIds).toHaveLength(2)
    expect((await getScript({ env: storage }, generated.scriptId)).projectId).toBe(created.projectId)
    const records = await listTextRecords({ env: storage }, { workspace: 'script' })
    expect(records.records.filter(item => item.projectId === created.projectId).map(item => item.recordType).sort()).toEqual(['script', 'storyboard_prompt'])
    const repeated = await post(storage, `${created.projectId}/generate-script-storyboard`, {})
    expect((await repeated.json()).idempotent).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(edited.brief).toContain('茶馆')
  })

  it('regenerates only the selected shot and moves to the video stage after confirmation', async () => {
    const storage = env()
    const created = (await (await post(storage, '', { title: '镜头测试', brief: '茶馆三人短剧，包含冲突与和解。' })).json()).project
    mockReasoning()
    const generated = (await (await post(storage, `${created.projectId}/generate-script-storyboard`, {})).json()).project
    const otherShot = generated.shots[1]
    globalThis.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...modelOutput.shots[0], prompt: '只更新了第一镜头的画面提示词。' }) } }] }), { status: 200 }))
    const changed = (await (await post(storage, `${created.projectId}/regenerate-section`, { targetType: 'shot', targetId: generated.shots[0].shotId, scope: 'current' })).json()).project
    expect(changed.shots[0].prompt).toContain('只更新')
    expect(changed.shots[1]).toEqual(otherShot)
    const confirmed = (await (await post(storage, `${created.projectId}/confirm-script-storyboard`, {})).json()).project
    expect(confirmed.stage).toBe('video')
    expect(confirmed.shots).toHaveLength(2)
  })

  it('regenerates only the chosen script paragraph and keeps the rest of the script', async () => {
    const storage = env()
    const created = (await (await post(storage, '', { title: '段落测试', brief: '茶馆里发生误会，并最终化解。' })).json()).project
    mockReasoning()
    const generated = (await (await post(storage, `${created.projectId}/generate-script-storyboard`, {})).json()).project
    const initial = '第一段：掌柜登场。\n第二段：顾客提出疑问。'
    const saved = (await (await patch(storage, `${created.projectId}/script`, { content: initial })).json()).project
    globalThis.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ content: '第二段：顾客与掌柜和解。' }) } }] }), { status: 200 }))
    const response = await post(storage, `${created.projectId}/regenerate-section`, { targetType: 'script', targetStart: initial.indexOf('第二段'), targetText: '第二段：顾客提出疑问。' })
    expect(response.status).toBe(200)
    const changed = (await response.json()).project
    expect(changed.script.content).toBe('第一段：掌柜登场。\n第二段：顾客与掌柜和解。')
    expect(changed.shots).toEqual(saved.shots)
    expect(changed.textRecordIds.length).toBeGreaterThan(generated.textRecordIds.length)
  })

  it('submits selected shots without mandatory assets, tracks results and archives an accepted video with project relations', async () => {
    const storage = env()
    const created = (await (await post(storage, '', { title: '视频测试', brief: '茶馆里掌柜和顾客发生误会。' })).json()).project
    mockReasoning()
    const generated = (await (await post(storage, `${created.projectId}/generate-script-storyboard`, {})).json()).project
    await post(storage, `${created.projectId}/confirm-script-storyboard`, {})
    await saveVideoProviderConnection({ env: storage }, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'sk-test', model: 'doubao-seedance-2.0' })
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'provider-1', url: 'https://cdn.example.test/video.mp4' }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    const body = { mode: 'selected', shotIds: [generated.shots[0].shotId], aspectRatio: '9:16', resolution: '720p' }
    const submitted = await post(storage, `${created.projectId}/video-tasks`, body)
    expect(submitted.status).toBe(202)
    const first = (await submitted.json()).tasks[0]
    expect(first.projectId).toBe(created.projectId)
    expect(first.shotId).toBe(generated.shots[0].shotId)
    expect(JSON.parse(upstream.mock.calls[0][1].body).metadata.content).toEqual([])
    const detail = await onRequestGet(context(storage, `${created.projectId}/video-tasks/${first.id}`))
    expect((await detail.json()).task.id).toBe(first.id)
    const repeated = await post(storage, `${created.projectId}/video-tasks`, body)
    expect((await repeated.json()).tasks[0].id).toBe(first.id)
    expect(upstream).toHaveBeenCalledTimes(1)
    await updateTask({ env: storage }, first.id, { status: 'failed' })
    const refreshed = await onRequestGet(context(storage, `${created.projectId}/video-tasks`))
    expect((await refreshed.json()).project.shots[0].status).toBe('failed')
    await updateTask({ env: storage }, first.id, { status: 'completed' })
    const acceptedResponse = await post(storage, `${created.projectId}/video-assets/${first.id}/accept`, {})
    expect(acceptedResponse.status).toBe(200)
    const accepted = await acceptedResponse.json()
    const asset = await storage.SANHUA_ASSETS.get(assetMetadataKey(accepted.assetId)).then(item => item.json())
    expect(asset).toMatchObject({ projectId: created.projectId, scriptId: generated.scriptId, storyboardId: generated.storyboardId, shotId: generated.shots[0].shotId })
    expect(accepted.project.shots[0].acceptedVideoTaskId).toBe(first.id)
    const listed = await onRequestGet(context(storage, created.projectId))
    expect((await listed.json()).project.videoTaskIds).toContain(first.id)
  })

  it('records rejected submissions as failed shots and work records, then retries only failed shots', async () => {
    const storage = env()
    const created = (await (await post(storage, '', { title: '失败重试', brief: '茶杯旁的纸条被微风轻轻吹动。' })).json()).project
    mockReasoning()
    const generated = (await (await post(storage, `${created.projectId}/generate-script-storyboard`, {})).json()).project
    await post(storage, `${created.projectId}/confirm-script-storyboard`, {})
    await saveVideoProviderConnection({ env: storage }, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'sk-test', model: 'doubao-seedance-2.0' })
    const upstream = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'new_api_error', message: 'This token has no access to model doubao-seedance-2.0' } }), { status: 403 }))
    vi.stubGlobal('fetch', upstream)
    const rejected = await post(storage, `${created.projectId}/video-tasks`, { mode: 'single', shotIds: [generated.shots[0].shotId] })
    expect(rejected.status).toBe(422)
    const failure = await rejected.json()
    expect(failure.hint).toContain('no access to model')
    expect(failure.project.status).toBe('failed')
    expect(failure.project.shots[0].status).toBe('failed')
    expect(failure.project.shots[1].status).toBe('ready')
    const works = await listWorkRecords({ env: storage }, { moduleKey: 'video', status: 'failed' })
    expect(works.items).toHaveLength(1)
    expect(works.items[0].errorMessage).toContain('no access to model')
    const refreshed = await onRequestGet(context(storage, `${created.projectId}/video-tasks`))
    expect((await refreshed.json()).project.shots[0].status).toBe('failed')
    upstream.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'retry-provider-1', url: 'https://cdn.example.test/retry-video.mp4' }), { status: 200 }))
    const retried = await post(storage, `${created.projectId}/video-tasks`, { mode: 'failed', regenerate: true })
    expect(retried.status).toBe(202)
    const result = await retried.json()
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].shotId).toBe(generated.shots[0].shotId)
    expect(result.project.shots[0].submissionError).toBe('')
    expect(upstream).toHaveBeenCalledTimes(2)
  })
})
