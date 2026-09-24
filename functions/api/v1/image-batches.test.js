import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from './image-batches.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value, options = {}) { this.values.set(key, { value: typeof value === 'string' ? value : new Uint8Array(value), options }) }
  async get(key) { const item = this.values.get(key); return item ? { async json() { return JSON.parse(typeof item.value === 'string' ? item.value : new TextDecoder().decode(item.value)) } } : null }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

afterEach(() => vi.unstubAllGlobals())

describe('four-image batch generation', () => {
  it('requests four images and archives every response before completing the task', async () => {
    const bucket = new MemoryBucket()
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: Array.from({ length: 4 }, () => ({ b64_json: 'iVBORw0KGgo=' })) }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const request = new Request('https://example.test/api/v1/image-batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', prompt: '四张茶馆海报', count: 4 }) })
    const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
    const value = await response.json()
    expect(response.status).toBe(201)
    expect(value.task.status).toBe('completed')
    expect(value.assets).toHaveLength(4)
    expect(JSON.parse(fetch.mock.calls[0][1].body).n).toBe(4)
    expect([...bucket.values.keys()].filter(key => key.includes('/outputs/'))).toHaveLength(4)
    const promptRecord = [...bucket.values.entries()].find(([key]) => key.startsWith('metadata/text-records/'))
    expect(promptRecord).toBeTruthy()
    expect(JSON.parse(promptRecord[1].value)).toMatchObject({ workspace: 'brand', recordType: 'brand_final_prompt', content: '四张茶馆海报', sourceTaskId: value.task.id })
  })

  it('uses image edits when source images are provided', async () => {
    const bucket = new MemoryBucket()
    const fetch = vi.fn(async (url, options) => {
      expect(url).toContain('/v1/images/edits')
      expect(options.body).toBeInstanceOf(FormData)
      return new Response(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgo=' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetch)
    const request = new Request('https://example.test/api/v1/image-batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'retouch', prompt: '提亮商品并保留标签', count: 1, images: ['data:image/png;base64,iVBORw0KGgo='] }) })
    const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
    expect(response.status).toBe(201)
    expect((await response.json()).assets).toHaveLength(1)
  })

  it('rejects more than ten retouch images before calling the provider', async () => {
    const bucket = new MemoryBucket()
    const request = new Request('https://example.test/api/v1/image-batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'retouch', prompt: '批量精修', count: 11, images: Array.from({ length: 11 }, () => 'data:image/png;base64,iVBORw0KGgo=') }) })
    const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'BATCH_LIMIT_EXCEEDED', limit: 10 })
  })
})
