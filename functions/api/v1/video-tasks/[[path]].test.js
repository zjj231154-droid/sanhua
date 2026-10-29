import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScript } from '../../../_lib/script-store.js'
import { saveVideoProviderConnection } from '../../../_lib/collaboration.js'
import { assetMetadataKey, putJson } from '../../../_lib/asset-store.js'
import { createDramaProject, updateDramaProject } from '../../../_lib/drama-project-store.js'
import { onRequestGet, onRequestPost } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) {
    const value = this.values.get(key)
    if (value === undefined) return null
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
    return {
      async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) },
      async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

const request = (url, body) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('video task validation', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('reports each missing prerequisite before allowing a task', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() }, params: { path: 'validate' } }
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks/validate', {}) })
    const value = await response.json()
    expect(response.status).toBe(422)
    expect(value.missing).toEqual(expect.arrayContaining(['已保存剧本', '至少一个场景资产', '分镜或分场说明']))
  })

  it('allows text-only video only for a confirmed project linked to the saved script', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() }, params: { path: 'validate' } }
    const project = await createDramaProject(context, { workspaceId: 'default', user: { id: 'test-user' } }, { title: '纯文本短剧' })
    const script = await createScript(context, { projectId: project.projectId, title: '茶杯短剧', outline: '茶杯旁的纸条被微风轻轻吹动。' })
    const body = { projectId: project.projectId, scriptId: script.id, scriptVersionId: script.currentVersionId, videoPrompt: script.outline, durationSeconds: 4 }
    const validateBody = value => onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks/validate', value) })
    expect((await validateBody(body)).status).toBe(422)
    await updateDramaProject(context, project, { scriptId: script.id, stage: 'video' })
    expect((await validateBody(body)).status).toBe(200)
    const unrelated = await validateBody({ ...body, projectId: 'unrelated-project' })
    expect(unrelated.status).toBe(422)
    expect((await unrelated.json()).missing).toContain('至少一个场景资产')
  })

  it('returns an actionable validation message when a selected reference file cannot be read', async () => {
    const bucket = new MemoryBucket()
    const context = { env: { SANHUA_ASSETS: bucket }, params: { path: 'validate' } }
    const script = await createScript(context, { title: '茶馆视频', kind: '轻喜剧', summary: '摘要', outline: '镜头一：茶馆内景，掌柜招待顾客。' })
    await putJson(bucket, assetMetadataKey('broken-scene'), { id: 'broken-scene', name: '损坏场景', assetType: 'image', usableFor: ['script', 'video'], storageKey: 'uploads/broken-scene.png' })
    const originalGet = bucket.get.bind(bucket)
    bucket.get = async key => {
      if (key === 'uploads/broken-scene.png') throw new Error('object store unavailable')
      return originalGet(key)
    }
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks/validate', {
      scriptId: script.id, scriptVersionId: script.currentVersionId, assetRefs: { scene: ['broken-scene'] }, videoPrompt: '镜头从茶馆门口推进到掌柜与顾客的对峙。', durationSeconds: 8,
    }) })
    const value = await response.json()
    expect(response.status).toBe(422)
    expect(value.missing).toEqual(expect.arrayContaining([expect.stringContaining('损坏场景：读取图片失败')]))
  })

  it('accepts a visible legacy cloud asset as a real video reference image', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() }, params: { path: 'validate' } }
    const script = await createScript(context, { title: '茶馆视频', kind: '轻喜剧', summary: '摘要', outline: '镜头一：茶馆内景，掌柜招待顾客。' })
    await putJson(context.env.SANHUA_ASSETS, assetMetadataKey('legacy-scene'), { id: 'legacy-scene', name: '茶馆场景 7', assetType: 'image', usableFor: ['script', 'video'], externalUrl: '/cloud-assets/retouch/teahouse-scene/teahouse-07.jpg', mimeType: 'image/jpeg' })
    const imageFetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }))
    vi.stubGlobal('fetch', imageFetch)
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks/validate', {
      scriptId: script.id, scriptVersionId: script.currentVersionId, assetRefs: { scene: ['legacy-scene'] }, videoPrompt: '镜头从茶馆门口推进到掌柜与顾客的对峙。', durationSeconds: 8,
    }) })
    expect(response.status).toBe(200)
    expect(String(imageFetch.mock.calls[0][0])).toBe('https://example.test/cloud-assets/retouch/teahouse-scene/teahouse-07.jpg')
  })

  it('backend_revalidates_reference_at_submit after successful preflight, preserving named failures', async () => {
    const bucket = new MemoryBucket(), context = { env: { SANHUA_ASSETS: bucket }, params: { path: 'validate' } }
    const script = await createScript(context, { title: '引用校验', outline: '茶馆里掌柜轻轻拿起桌上的茶杯。' })
    const project = await createDramaProject(context, { workspaceId: 'default', user: { id: 'test-user' } })
    await updateDramaProject(context, project, { scriptId: script.id, stage: 'video' })
    await putJson(bucket, assetMetadataKey('scene-recheck'), { id: 'scene-recheck', name: '茶馆参考图', assetType: 'image', mimeType: 'image/png', storageKey: 'uploads/recheck.png' })
    await bucket.put('uploads/recheck.png', new Uint8Array([1, 2, 3]))
    const body = { projectId: project.projectId, scriptId: script.id, scriptVersionId: script.currentVersionId, referencedAssetIds: ['scene-recheck'], referenceBindings: [{ assetId: 'scene-recheck', token: '@图片8' }], videoPrompt: '@图片8中茶杯旁的纸条缓慢飘动，镜头保持稳定。', durationSeconds: 4 }
    expect((await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks/validate', body) })).status).toBe(200)
    bucket.values.delete('uploads/recheck.png')
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream)
    const rejected = await onRequestPost({ ...context, params: { path: '' }, request: request('https://example.test/api/v1/video-tasks', body) })
    expect(rejected.status).toBe(422)
    expect((await rejected.json()).referencePreflightErrors[0]).toMatchObject({ name: '茶馆参考图', readable: false })
    expect(upstream).not.toHaveBeenCalled()
  })

  it('submits bound reference tokens as actual image bytes with the same asset mapping', async () => {
    const bucket = new MemoryBucket(), context = { env: { SANHUA_ASSETS: bucket }, params: { path: '' } }
    const script = await createScript(context, { title: '图文引用', outline: '茶馆中掌柜拿起桌上的茶杯，镜头缓慢推进。' })
    const project = await createDramaProject(context, { workspaceId: 'default', user: { id: 'test-user' } })
    await updateDramaProject(context, project, { scriptId: script.id, stage: 'video' })
    await saveVideoProviderConnection(context, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'fixture-video-key', model: 'doubao-seedance-2.0' })
    await putJson(bucket, assetMetadataKey('bound-image'), { id: 'bound-image', name: '茶杯图', assetType: 'image', mimeType: 'image/png', storageKey: 'uploads/bound.png' })
    await bucket.put('uploads/bound.png', new Uint8Array([1, 2, 3]))
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'bound-job' }), { status: 200 })); vi.stubGlobal('fetch', upstream)
    const body = { projectId: project.projectId, scriptId: script.id, scriptVersionId: script.currentVersionId, referencedAssetIds: ['bound-image'], referenceBindings: [{ assetId: 'bound-image', token: '@图片8' }], videoPrompt: '使用@图片8的茶杯，镜头轻轻向前推进，保留主体。', durationSeconds: 4 }
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks', body) })
    expect(response.status).toBe(202)
    const task = (await response.json()).task, payload = JSON.parse(upstream.mock.calls[0][1].body)
    expect(payload.prompt).toContain('使用[Image1]的茶杯')
    expect(payload.metadata.content[0].image_url.url).toBe('data:image/png;base64,AQID')
    expect(task).toMatchObject({ referencedAssetIds: ['bound-image'], referencePreflightStatus: 'available', generationParams: { model: 'doubao-seedance-2.0' }, referenceBindings: [{ assetId: 'bound-image', alias: 'Image1', token: '@图片8' }] })
  })

  it('submits a Seedance video task through the encrypted personal video connection', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() }, params: { path: undefined } }
    const script = await createScript(context, { title: '茶馆视频', kind: '轻喜剧', summary: '摘要', outline: '镜头一：茶馆内景，掌柜招待顾客。' })
    await saveVideoProviderConnection(context, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'sk-video-secret', model: 'doubao-seedance-2.0' })
    await putJson(context.env.SANHUA_ASSETS, assetMetadataKey('tea-house-1'), { id: 'tea-house-1', name: '茶馆场景', assetType: 'image', usableFor: ['script', 'video'], externalUrl: 'https://cdn.example.test/tea-house-1.png' })
    await putJson(context.env.SANHUA_ASSETS, assetMetadataKey('actor-1'), { id: 'actor-1', name: '掌柜角色', assetType: 'image', usableFor: ['script', 'video'], storageKey: 'uploads/actor-1.png', mimeType: 'image/png' })
    await context.env.SANHUA_ASSETS.put('uploads/actor-1.png', new Uint8Array([1, 2, 3]))
    await putJson(context.env.SANHUA_ASSETS, assetMetadataKey('teapot-1'), { id: 'teapot-1', name: '紫砂茶壶', assetType: 'image', usableFor: ['script', 'video'], externalUrl: 'https://cdn.example.test/teapot-1.png' })
    const responses = [new Response(JSON.stringify({ id: 'seedance-job-1' }), { status: 200 }), new Response(JSON.stringify({ status: 'succeeded', progress: 100, url: 'https://cdn.example.test/videos/seedance-job-1.mp4' }), { status: 200 })]
    const upstream = vi.fn(async url => String(url).endsWith('.png') ? new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } }) : responses.shift())
    vi.stubGlobal('fetch', upstream)
    const body = { scriptId: script.id, scriptVersionId: script.currentVersionId, assetRefs: { scene: ['tea-house-1'], character: ['actor-1'], prop: ['teapot-1'], other: [] }, videoPrompt: '镜头从茶馆门口推进到掌柜与顾客的对峙。', shotPlan: script.outline, aspectRatio: '9:16', durationSeconds: 8, resolution: '720p' }
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks', body) })
    const value = await response.json()
    expect(response.status).toBe(202)
    expect(value.task.status).toBe('running')
    expect(value.task.simulated).toBe(false)
    expect(value.task.providerTaskId).toBe('seedance-job-1')
    expect(value.task.model).toBe('doubao-seedance-2.0')
    expect(value.task.assetRefs).toEqual(body.assetRefs)
    expect(value.task.aspectRatio).toBe('9:16')
    expect(value.textRecordId).toBeTruthy()
    expect(upstream).toHaveBeenCalledWith('https://tokenspace.io/v1/video/generations', expect.objectContaining({ method: 'POST' }))
    const upstreamBody = JSON.parse(upstream.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)
    expect(upstreamBody).toMatchObject({ model: 'doubao-seedance-2.0', duration: 8, ratio: '9:16', size: '720p' })
    expect(upstreamBody.metadata.content).toEqual([
      { type: 'image_url', role: 'reference_image', image_url: { url: 'data:image/png;base64,AQID' } },
      { type: 'image_url', role: 'reference_image', image_url: { url: 'data:image/png;base64,AQID' } },
      { type: 'image_url', role: 'reference_image', image_url: { url: 'data:image/png;base64,AQID' } },
    ])
    expect(upstreamBody.prompt).toContain('[Image1] = @茶馆场景')
    expect(upstreamBody).not.toHaveProperty('resolution')
    expect(upstreamBody).not.toHaveProperty('generate_audio')
    const taskList = await onRequestGet({ ...context, request: new Request('https://example.test/api/v1/video-tasks') })
    const synced = await taskList.json()
    expect(synced.tasks[0]).toMatchObject({ id: value.task.id, status: 'completed', progress: 100, providerVideoUrl: 'https://cdn.example.test/videos/seedance-job-1.mp4' })
    expect(upstream).toHaveBeenLastCalledWith('https://tokenspace.io/v1/video/generations/seedance-job-1', expect.objectContaining({ headers: { Authorization: 'Bearer sk-video-secret' } }))
    upstream.mockResolvedValueOnce(new Response(new Uint8Array([7, 8, 9]), { status: 200, headers: { 'content-type': 'video/mp4' } }))
    const downloaded = await onRequestGet({ ...context, params: { path: [value.task.id, 'download'] }, request: new Request(`https://example.test/api/v1/video-tasks/${value.task.id}/download`) })
    expect(downloaded.status).toBe(200)
    expect(downloaded.headers.get('content-disposition')).toContain('attachment')
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]))
  })
})
