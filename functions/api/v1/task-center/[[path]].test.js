import { describe, expect, it } from 'vitest'
import { onRequestGet } from './[[path]].js'
import { createWorkRecord } from '../../../_lib/work-record-store.js'
import { saveTask } from '../../../_lib/task-store.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } } }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

const request = url => new Request(url)

describe('unified task center', () => {
  it('returns one unified item for a work record and its provider task', async () => {
    const env = { SANHUA_ASSETS: new MemoryBucket() }
    const record = await createWorkRecord({ env }, { moduleKey: 'video', moduleName: '视频生成', route: 'video', title: '茶馆镜头', workspaceId: '', ownerUserId: '', clientSessionId: 'test-session' })
    await saveTask({ env }, { id: 'provider-task-1', workRecordId: record.taskId, workspace: 'video', workspaceId: '', status: 'running', progress: 42, stage: '视频服务已受理', createdAt: new Date().toISOString() })
    const response = await onRequestGet({ env, params: { path: [] }, request: request('https://example.test/api/v1/task-center?page=1&pageSize=20') })
    expect(response.status).toBe(200)
    const value = await response.json()
    expect(value.items).toHaveLength(1)
    expect(value.items[0].workRecordId).toBe(record.taskId)
    expect(value.items[0].status).toBe('running')
    expect(value.items[0].providerTaskId).toBe('provider-task-1')
  })
})
