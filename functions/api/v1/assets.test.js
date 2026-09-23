import { expect, it } from 'vitest'
import { onRequestGet } from './assets.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, value) }
  async get(key) {
    const value = this.values.get(key)
    return value === undefined ? null : { async json() { return JSON.parse(value) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) {
    return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) }
  }
}

it('returns stable twelve-item asset pages with pagination metadata', async () => {
  const bucket = new MemoryBucket()
  for (let index = 1; index <= 13; index += 1) {
    const id = `asset-${String(index).padStart(2, '0')}`
    await bucket.put(`metadata/assets/${id}.json`, JSON.stringify({ id, name: id, assetSpace: 'retouch', storageKey: `generated/${id}.png`, createdAt: '2026-09-23T00:00:00.000Z' }))
  }

  const response = await onRequestGet({ env: { SANHUA_ASSETS: bucket }, request: new Request('https://example.test/api/v1/assets?workspace=retouch&page=2&pageSize=12') })
  const body = await response.json()

  expect(response.status).toBe(200)
  expect(body).toMatchObject({ page: 2, pageSize: 12, total: 13, totalPages: 2, hasPrevious: true, hasNext: false })
  expect(body.assets.map(asset => asset.id)).toEqual(['asset-13'])
})
