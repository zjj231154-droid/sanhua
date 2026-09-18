import { describe, expect, it } from 'vitest'
import { onRequestDelete, onRequestGet, onRequestPost } from './tasks.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } } }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

const create = (url, method, body) => new Request(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })

describe('task soft deletion', () => {
  it('rejects deleting active tasks and hides completed tasks from the default list', async () => {
    const env = { SANHUA_ASSETS: new MemoryBucket() }
    const created = await onRequestPost({ request: create('https://example.test/api/v1/tasks', 'POST', { workspace: 'retouch' }), env })
    const active = await created.json()
    const blocked = await onRequestDelete({ request: create(`https://example.test/api/v1/tasks?id=${active.id}`, 'DELETE'), env })
    expect(blocked.status).toBe(409)

    const completed = { ...active, status: 'completed', progress: 100, stage: '完成' }
    await env.SANHUA_ASSETS.put(`metadata/tasks/${active.id}.json`, JSON.stringify(completed))
    const removed = await onRequestDelete({ request: create(`https://example.test/api/v1/tasks?id=${active.id}`, 'DELETE'), env })
    expect(removed.status).toBe(200)
    const listed = await onRequestGet({ request: create('https://example.test/api/v1/tasks', 'GET'), env })
    expect((await listed.json()).tasks).toEqual([])
  })
})
