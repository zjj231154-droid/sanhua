import { describe, expect, it } from 'vitest'
import { onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } } }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

const request = (url, method = 'GET', body) => new Request(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })

describe('draft work records', () => {
  it('creates, version-checks and lists a draft record', async () => {
    const env = { SANHUA_ASSETS: new MemoryBucket() }
    const createdResponse = await onRequestPost({ env, request: request('https://example.test/api/v1/work-records', 'POST', { moduleKey: 'script', moduleName: '短剧脚本', route: 'create', subRoute: 'create', title: '短剧草稿', clientSessionId: 'session-1', initialData: { scriptPrompt: '茶馆误会', apiKey: 'must-not-persist' } }) })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()).item
    expect(created.status).toBe('draft')
    expect(created.subRoute).toBe('create')
    expect(created.draftData.apiKey).toBeUndefined()
    const savedResponse = await onRequestPatch({ env, params: { path: created.taskId }, request: request(`https://example.test/api/v1/work-records/${created.taskId}`, 'PATCH', { expectedVersion: created.version, currentStep: 2, draftData: { scriptPrompt: '茶馆误会 · 已补充角色' } }) })
    expect(savedResponse.status).toBe(200)
    const saved = (await savedResponse.json()).item
    expect(saved.currentStep).toBe(2)
    expect(saved.stepSnapshots.length).toBeGreaterThan(0)
    const conflict = await onRequestPatch({ env, params: { path: created.taskId }, request: request(`https://example.test/api/v1/work-records/${created.taskId}`, 'PATCH', { expectedVersion: created.version, draftData: { stale: true } }) })
    expect(conflict.status).toBe(409)
    const listed = await onRequestGet({ env, request: request('https://example.test/api/v1/work-records?page=1&pageSize=20') })
    expect((await listed.json()).items).toHaveLength(1)
  })
})
