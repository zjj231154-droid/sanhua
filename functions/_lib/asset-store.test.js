import { describe, expect, it } from 'vitest'
import { archiveImageOutputs, getJson, listJson, taskMetadataKey, putJson } from './asset-store.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value, options = {}) { this.values.set(key, { value: typeof value === 'string' ? value : new Uint8Array(value), options }) }
  async get(key) {
    const item = this.values.get(key)
    if (!item) return null
    return { httpMetadata: item.options.httpMetadata, body: item.value, async json() { return JSON.parse(typeof item.value === 'string' ? item.value : new TextDecoder().decode(item.value)) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

describe('persistent asset archive', () => {
  it('stores four generated images once and creates business + platform metadata', async () => {
    const bucket = new MemoryBucket()
    const context = { env: { SANHUA_ASSETS: bucket } }
    const result = await archiveImageOutputs(context, {
      taskId: 'batch-four', workspace: 'brand', model: 'gpt-image-2', prompt: 'test',
      outputs: Array.from({ length: 4 }, () => ({ b64_json: 'iVBORw0KGgo=' })),
    })
    expect(result.assets).toHaveLength(4)
    expect(new Set(result.assets.map(asset => asset.id)).size).toBe(4)
    expect(result.assets.every(asset => asset.storageKey.includes('/brand/ai-temp/'))).toBe(true)
    expect((await listJson(bucket, 'metadata/assets/')).length).toBe(4)
    expect((await listJson(bucket, 'metadata/master-assets/')).map(item => item.assetId).sort()).toEqual(result.assets.map(item => item.id).sort())
    await putJson(bucket, taskMetadataKey('batch-four'), { id: 'batch-four', status: 'completed' })
    expect(await getJson(bucket, taskMetadataKey('batch-four'))).toMatchObject({ status: 'completed' })
  })

  it('uses the requested name for metadata and safe download files', async () => {
    const bucket = new MemoryBucket()
    const result = await archiveImageOutputs({ env: { SANHUA_ASSETS: bucket } }, {
      taskId: 'named-one', workspace: 'retouch', model: 'gpt-image-2', prompt: 'test', requestedName: '山茶:精修/主图',
      outputs: [{ b64_json: 'iVBORw0KGgo=' }],
    })
    expect(result.assets[0]).toMatchObject({ name: '山茶 精修 主图', displayName: '山茶 精修 主图', downloadName: '山茶 精修 主图.png' })
  })
})
