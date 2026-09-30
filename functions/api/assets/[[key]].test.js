import { describe, expect, it } from 'vitest'
import { onRequestGet, onRequestPost } from './[[key]].js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, body, options = {}) { this.values.set(key, { body, httpMetadata: options.httpMetadata || options }) }
  async get(key) {
    const item = this.values.get(key)
    if (!item) return null
    return { ...item, async json() { return JSON.parse(typeof item.body === 'string' ? item.body : new TextDecoder().decode(item.body)) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
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

  it('resolves a generated image directly from its embedded asset id', async () => {
    const bucket = new MemoryBucket()
    const id = '26b0d389-bc8e-4bcb-aed8-f690367b2a51'
    const key = `generated/default/retouch/${id}.png`
    await bucket.put(`metadata/assets/${id}.json`, JSON.stringify({ id, storageKey: key, workspaceId: 'main' }), { httpMetadata: { contentType: 'application/json' } })
    await bucket.put(key, new Uint8Array([137, 80, 78, 71]), { httpMetadata: { contentType: 'image/png' } })

    const result = await onRequestGet({ env: { SANHUA_ASSETS: bucket }, params: { key }, request: new Request(`https://example.test/api/assets/${key}`) })

    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]))
  })
})
