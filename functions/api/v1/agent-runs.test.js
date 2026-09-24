import { afterEach, expect, it, vi } from 'vitest'
import { onRequestPost } from './agent-runs.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value, options = {}) { this.values.set(key, { value: typeof value === 'string' ? value : new Uint8Array(value), options }) }
  async get(key) { const item = this.values.get(key); return item ? { async json() { return JSON.parse(typeof item.value === 'string' ? item.value : new TextDecoder().decode(item.value)) } } : null }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

afterEach(() => vi.unstubAllGlobals())

it('archives a brand design plan before returning the awaiting-confirmation task', async () => {
  const bucket = new MemoryBucket()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'FINAL_IMAGE_PROMPT: 茶纹礼盒主视觉' } }] }), { status: 200 })))
  const request = new Request('https://example.test/api/v1/agent-runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', requirements: '茶纹礼盒', assets: ['brand-asset-1'] }) })

  const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
  const value = await response.json()
  const stored = [...bucket.values.entries()].find(([key]) => key.startsWith('metadata/text-records/'))

  expect(response.status).toBe(202)
  expect(value.textRecordId).toBeTruthy()
  expect(JSON.parse(stored[1].value)).toMatchObject({ id: value.textRecordId, workspace: 'brand', recordType: 'brand_plan', content: 'FINAL_IMAGE_PROMPT: 茶纹礼盒主视觉', sourceTaskId: value.id, sourceAssetIds: ['brand-asset-1'] })
})
