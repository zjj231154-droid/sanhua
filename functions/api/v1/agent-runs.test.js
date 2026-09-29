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
  expect(JSON.parse(stored[1].value)).toMatchObject({ id: value.textRecordId, workspace: 'brand', recordType: 'brand_prompt', content: 'FINAL_IMAGE_PROMPT: 茶纹礼盒主视觉', sourceTaskId: value.id, sourceAssetIds: ['brand-asset-1'] })
})

it('uses the v4.0 graphic workflow and locks IP consistency for a flat-design plan', async () => {
  const bucket = new MemoryBucket()
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'FINAL_IMAGE_PROMPT: 茶猫四季海报' } }] }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const request = new Request('https://example.test/api/v1/agent-runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', requirements: '创作模式：平面二创\n二创方向：四季 / 节气延展\n输出形式：四张独立插画\n画幅比例：4:5', assets: ['tea-cat'] }) })

  const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)

  expect(response.status).toBe(202)
  expect(body.messages[0].content).toContain('v4.0.0')
  expect(body.messages[0].content).toContain('唯一角色视觉基准')
  expect(body.messages[0].content).toContain('不得重新设计角色')
})

it('creates a separate concept-dieline prompt before a product effect plan', async () => {
  const bucket = new MemoryBucket()
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'FINAL_DIELINE_PROMPT: 冰箱贴结构图' } }] }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const request = new Request('https://example.test/api/v1/agent-runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace: 'brand', requirements: '流程阶段：产品刀版图\n产品类型：冰箱贴\n真实尺寸：90 × 90 mm', assets: ['tea-cat'] }) })

  const response = await onRequestPost({ request, env: { SANHUA_ASSETS: bucket, USEGOODAI_API_KEY: 'test-key' } })
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)

  expect(response.status).toBe(202)
  expect(body.messages[0].content).toContain('结构确认优先')
  expect(body.messages[0].content).toContain('FINAL_DIELINE_PROMPT:')
  expect(body.messages[0].content).toContain('生产前由厂家/CAD 校核')
})
