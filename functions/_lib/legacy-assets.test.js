import { expect, it } from 'vitest'
import { getJson } from './asset-store.js'
import { syncLegacyAssets } from './legacy-assets.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, value) }
  async get(key) {
    const value = this.values.get(key)
    return value === undefined ? null : { async json() { return JSON.parse(value) } }
  }
}

it('migrates the legacy remote assets once for a workspace and keeps their library mapping', async () => {
  const bucket = new MemoryBucket()
  const identity = { workspaceId: 'workspace-a' }
  const created = await syncLegacyAssets(bucket, identity)

  expect(created.length).toBeGreaterThan(30)
  expect(created.find(asset => asset.libraryKey === 'script' && asset.folderKey === 'scene')).toMatchObject({
    usableFor: ['script', 'video'],
    externalUrl: expect.stringContaining('/cloud-assets/'),
  })
  expect(await syncLegacyAssets(bucket, identity)).toEqual([])
  expect(await getJson(bucket, 'metadata/legacy-sync/workspace-a.json')).toMatchObject({ assetCount: created.length })
})
