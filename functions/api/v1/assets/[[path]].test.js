import { expect, it } from 'vitest'
import { onRequestPatch } from './[[path]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, typeof value === 'string' ? value : new Uint8Array(value)) }
  async get(key) {
    const value = this.values.get(key)
    return value === undefined ? null : { async json() { return JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) } }
  }
}

it('renames an archived asset through the name action', async () => {
  const bucket = new MemoryBucket()
  await bucket.put('metadata/assets/example.json', JSON.stringify({ id: 'example', name: '旧名称', mimeType: 'image/png' }))
  const request = new Request('https://example.test/api/v1/assets/example/name', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ display_name: '新版名称' }),
  })

  const response = await onRequestPatch({ request, env: { SANHUA_ASSETS: bucket }, params: { path: 'example/name' } })

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ asset: expect.objectContaining({ name: '新版名称', downloadName: '新版名称.png' }) })
})
