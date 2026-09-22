import { describe, expect, it } from 'vitest'
import { onRequestDelete, onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } } }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

const context = bucket => ({ env: { SANHUA_ASSETS: bucket }, params: { path: undefined } })
const request = (method, url, body) => new Request(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })

describe('text records', () => {
  it('creates, filters, updates, deletes and restores a shared record', async () => {
    const bucket = new MemoryBucket(); const base = context(bucket)
    const created = await onRequestPost({ ...base, request: request('POST', 'https://example.test/api/v1/text-records', { workspace: 'brand', sourceModule: 'brand.prompts', recordType: 'brand_final_prompt', title: '茶纹礼盒', content: '保留茶纹、Logo 与留白，生成礼盒主视觉。', contentFormat: 'prompt' }) })
    expect(created.status).toBe(201); const record = (await created.json()).record
    const listed = await onRequestGet({ ...base, request: request('GET', 'https://example.test/api/v1/text-records?workspace=brand&q=Logo') })
    expect((await listed.json()).records.map(item => item.id)).toEqual([record.id])
    const renamed = await onRequestPatch({ ...base, params: { path: record.id }, request: request('PATCH', `https://example.test/api/v1/text-records/${record.id}`, { title: '茶纹礼盒最终提示词' }) })
    expect((await renamed.json()).record.title).toBe('茶纹礼盒最终提示词')
    await onRequestDelete({ ...base, params: { path: record.id }, request: request('DELETE', `https://example.test/api/v1/text-records/${record.id}`) })
    const hidden = await onRequestGet({ ...base, request: request('GET', 'https://example.test/api/v1/text-records?workspace=brand') })
    expect((await hidden.json()).records).toEqual([])
    const restored = await onRequestPost({ ...base, params: { path: `${record.id}/restore` }, request: request('POST', `https://example.test/api/v1/text-records/${record.id}/restore`) })
    expect((await restored.json()).record.status).toBe('active')
  })
})
