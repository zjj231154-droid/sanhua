import { describe, expect, it } from 'vitest'
import { onRequestGet, onRequestPost } from './[[key]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, body, httpMetadata) { this.values.set(key, { body, httpMetadata }) }
  async get(key) { return this.values.get(key) || null }
}

describe('protected asset cache headers', () => {
  it('returns an immutable private ETag and accepts a conditional request', async () => {
    const bucket = new MemoryBucket()
    await bucket.put('generated/retouch/result.png', new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' })
    const context = { env: { SANHUA_ASSETS: bucket }, params: { key: 'generated/retouch/result.png' }, request: new Request('https://example.test/api/assets/generated/retouch/result.png') }
    const first = await onRequestGet(context)
    const etag = first.headers.get('etag')
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('private, max-age=604800, immutable')
    expect(etag).toBeTruthy()
    const second = await onRequestGet({ ...context, request: new Request('https://example.test/api/assets/generated/retouch/result.png', { headers: { 'if-none-match': etag } }) })
    expect(second.status).toBe(304)
  })

  it('stores the short-drama asset type so local uploads are reusable by script and video flows', async () => {
    const bucket = new MemoryBucket()
    const image = 'data:image/png;base64,iVBORw0KGgo='
    const response = await onRequestPost({
      env: { SANHUA_ASSETS: bucket },
      params: { key: 'script-assets/character-1.png' },
      request: new Request('https://example.test/api/assets/script-assets/character-1.png', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, workspace: 'script', name: '年轻掌柜.png', videoAssetType: 'character', usableFor: ['script', 'video'], tags: ['短剧', '角色'] }) }),
    })
    const value = await response.json()

    expect(response.status).toBe(201)
    expect(value.asset).toMatchObject({ assetSpace: 'script', assetType: 'image', videoAssetType: 'character', usableFor: ['script', 'video'], tags: ['短剧', '角色'] })
  })
})
