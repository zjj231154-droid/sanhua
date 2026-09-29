import { expect, it } from 'vitest'
import { onRequestGet, onRequestPost } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) {
    const value = this.values.get(key)
    return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

it('archives a temporary generated image only after a user selects a valid library folder', async () => {
  const bucket = new MemoryBucket()
  await bucket.put('metadata/assets/temp-1.json', JSON.stringify({ id: 'temp-1', name: '待保存精修图', category: 'generated', isTemporary: true, assetSpace: 'retouch', storageKey: 'generated/temp-1.png', createdAt: '2026-09-29T00:00:00.000Z', recommendedLibraryKey: 'retouch', recommendedFolderKey: 'effect' }))
  const response = await onRequestPost({ env: { SANHUA_ASSETS: bucket }, params: { path: 'temp-1/archive' }, request: new Request('https://example.test/api/v1/generated-results/temp-1/archive', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ libraryKey: 'retouch', folderKey: 'effect', name: '确认后的精修图' }) }) })
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.asset).toMatchObject({ name: '确认后的精修图', isTemporary: false, libraryKey: 'retouch', folderKey: 'effect' })
  expect(body.location).toMatchObject({ libraryKey: 'retouch', folderKey: 'effect' })

  const listed = await onRequestGet({ env: { SANHUA_ASSETS: bucket }, params: { path: '' }, request: new Request('https://example.test/api/v1/generated-results') })
  expect((await listed.json()).results).toEqual([expect.objectContaining({ id: 'temp-1', isTemporary: false })])
})
