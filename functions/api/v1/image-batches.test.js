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
  })
})
