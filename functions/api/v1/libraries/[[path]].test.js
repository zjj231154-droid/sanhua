import { expect, it } from 'vitest'
import { onRequestGet } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, value) }
  async get(key) { const value = this.values.get(key); return value === undefined ? null : { async json() { return JSON.parse(value) } } }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

it('returns the fixed library structure with counts based on stored locations', async () => {
  const bucket = new MemoryBucket()
  await bucket.put('metadata/assets/scene-1.json', JSON.stringify({ id: 'scene-1', name: '茶馆内景', libraryKey: 'script', folderKey: 'scene', storageKey: 'uploads/scene-1.png' }))
  await bucket.put('metadata/assets/effect-1.json', JSON.stringify({ id: 'effect-1', name: '精修效果', locations: [{ libraryKey: 'retouch', folderKey: 'effect' }], storageKey: 'generated/effect-1.png' }))
  const response = await onRequestGet({ env: { SANHUA_ASSETS: bucket }, params: { path: '' }, request: new Request('https://example.test/api/v1/libraries') })
  const body = await response.json()
  expect(response.status).toBe(200)
  expect(body.libraries.find(library => library.key === 'script').folders.find(folder => folder.key === 'scene').count).toBe(1)
  expect(body.libraries.find(library => library.key === 'retouch').folders.find(folder => folder.key === 'effect').count).toBe(1)
})
