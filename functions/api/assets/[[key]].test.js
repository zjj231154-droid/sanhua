import { describe, expect, it } from 'vitest'
import { onRequestGet } from './[[key]].js'

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
})
