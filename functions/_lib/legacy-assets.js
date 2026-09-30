import { assetMetadataKey, getJson, putJson } from './asset-store.js'

const records = [
  ...Array.from({ length: 7 }, (_, index) => ({ id: `coffee-${index + 1}`, name: `咖啡场景 ${index + 1}`, libraryKey: 'retouch', folderKey: 'source', group: '咖啡店场景', externalUrl: `/cloud-assets/retouch/coffee-scene/coffee-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `coffee-product-${index + 1}`, name: `咖啡产品 ${index + 1}`, libraryKey: 'retouch', folderKey: 'source', group: '咖啡产品图', externalUrl: `/cloud-assets/retouch/coffee-products/coffee-product-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `teahouse-${index + 1}`, name: `茶馆场景 ${index + 1}`, libraryKey: 'retouch', folderKey: 'source', group: '茶馆场景', externalUrl: `/cloud-assets/retouch/teahouse-scene/teahouse-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 12 }, (_, index) => ({ id: `script-teahouse-${index + 1}`, name: `茶馆场景 ${index + 1}`, libraryKey: 'script', folderKey: 'scene', group: '短剧场景', externalUrl: `/cloud-assets/retouch/teahouse-scene/teahouse-${String(index + 1).padStart(2, '0')}.jpg` })),
  ...Array.from({ length: 6 }, (_, index) => ({ id: `brand-${index + 1}`, name: ['茉语轻岚', '叁花茶馆贴纸', '叁花热水袋图案', '叁花 Logo', '叁花原创物料', '线上茶叶包装'][index], libraryKey: 'brand', folderKey: 'illustration', group: '品牌文创', externalUrl: `/cloud-assets/brand/identity/brand-${String(index + 1).padStart(2, '0')}.${index === 0 ? 'jpg' : 'png'}` })),
]

const scopedId = (workspaceId, id) => `legacy-${String(workspaceId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')}-${id}`

export async function syncLegacyAssets(bucket, identity) {
  const workspaceId = identity.workspaceId || 'default'
  const markerKey = `metadata/legacy-sync/${String(workspaceId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
  const previous = await getJson(bucket, markerKey)
  const now = new Date().toISOString()
  const created = []
  for (const source of records) {
    const id = scopedId(workspaceId, source.id)
    if (await getJson(bucket, assetMetadataKey(id))) continue
    const location = { id: `location-${id}`, assetId: id, workspaceId, libraryKey: source.libraryKey, folderKey: source.folderKey, projectId: source.libraryKey, createdBy: 'system:legacy-sync', createdAt: now, deletedAt: null }
    const asset = { id, tenantId: workspaceId, workspaceId, projectId: source.libraryKey, createdBy: 'system:legacy-sync', updatedBy: 'system:legacy-sync', version: 1, visibility: 'workspace', storeId: 'legacy-cloud', assetSpace: source.libraryKey, libraryKey: source.libraryKey, folderKey: source.folderKey, locations: [location], folderType: source.folderKey, category: 'synced-legacy', assetType: 'image', videoAssetType: source.libraryKey === 'script' ? 'scene' : undefined, usableFor: source.libraryKey === 'script' ? ['script', 'video'] : source.libraryKey === 'retouch' ? ['retouch'] : ['brand'], sourceModule: 'legacy-cloud-sync', sourceTaskId: null, name: source.name, displayName: source.name, downloadName: source.name, externalUrl: source.externalUrl, thumbnailExternalUrl: source.externalUrl, previewExternalUrl: source.externalUrl, mimeType: source.externalUrl.endsWith('.png') ? 'image/png' : 'image/jpeg', status: 'succeeded', isTemporary: false, expiresAt: null, group: source.group, createdAt: now, updatedAt: now, cacheVersion: id }
    await putJson(bucket, assetMetadataKey(id), asset)
    await putJson(bucket, `metadata/asset-locations/${id}/${source.libraryKey}-${source.folderKey}-${source.libraryKey}.json`, location)
    created.push(asset)
  }
  await putJson(bucket, markerKey, { workspaceId, completedAt: now, assetCount: records.length, repairedCount: created.length, previousCompletedAt: previous?.completedAt || null })
  return created
}
