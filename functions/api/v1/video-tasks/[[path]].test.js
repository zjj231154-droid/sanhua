import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScript } from '../../../_lib/script-store.js'
import { saveVideoProviderConnection } from '../../../_lib/collaboration.js'
import { onRequestPost } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } } }
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

  it('submits a Seedance video task through the encrypted personal video connection', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() }, params: { path: undefined } }
    const script = await createScript(context, { title: '茶馆视频', kind: '轻喜剧', summary: '摘要', outline: '镜头一：茶馆内景，掌柜招待顾客。' })
    await saveVideoProviderConnection(context, 'test-user', { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', apiKey: 'sk-video-secret', model: 'doubao-seedance-2-0-260128' })
    const upstream = vi.fn(async () => new Response(JSON.stringify({ id: 'seedance-job-1' }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    const body = { scriptId: script.id, scriptVersionId: script.currentVersionId, assetRefs: { scene: ['tea-house-1'], character: ['actor-1'], prop: ['teapot-1'], other: [] }, videoPrompt: '镜头从茶馆门口推进到掌柜与顾客的对峙。', shotPlan: script.outline, aspectRatio: '9:16', durationSeconds: 8, resolution: '720p' }
    const response = await onRequestPost({ ...context, request: request('https://example.test/api/v1/video-tasks', body) })
    const value = await response.json()
    expect(response.status).toBe(202)
    expect(value.task.status).toBe('running')
    expect(value.task.simulated).toBe(false)
    expect(value.task.providerTaskId).toBe('seedance-job-1')
    expect(value.task.model).toBe('doubao-seedance-2-0-260128')
    expect(value.task.assetRefs).toEqual(body.assetRefs)
    expect(value.task.aspectRatio).toBe('9:16')
    expect(value.textRecordId).toBeTruthy()
    expect(upstream).toHaveBeenCalledWith('https://tokenspace.io/v1/video/generations', expect.objectContaining({ method: 'POST' }))
    const upstreamBody = JSON.parse(upstream.mock.calls[0][1].body)
    expect(upstreamBody).toMatchObject({ model: 'doubao-seedance-2-0-260128', duration: 8, ratio: '9:16', size: '720p' })
    expect(upstreamBody).not.toHaveProperty('resolution')
    expect(upstreamBody).not.toHaveProperty('generate_audio')
  })
})
