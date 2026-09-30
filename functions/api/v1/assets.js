import { json } from '../../_lib/tokenspace.js'
import { assetAvailableInWorkspace, assetsBucket, assetUrl, listJson } from '../../_lib/asset-store.js'
import { hasLocation, locationsForAsset, validAssetFolder } from '../../_lib/library-config.js'
import { requireIdentity, hasPermission } from '../../_lib/collaboration.js'
import { syncLegacyAssets } from '../../_lib/legacy-assets.js'

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view')
  if (identity.error) return identity.error
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请在 Cloudflare Pages 绑定 SANHUA_ASSETS，或在 Railway 挂载 Volume 并设置 SANHUA_STORAGE_DIR。' })
  const url = new URL(context.request.url)
  if (url.searchParams.get('includeLegacy') === 'true') await syncLegacyAssets(bucket, identity)
  const workspace = url.searchParams.get('workspace') || url.searchParams.get('assetSpace')
  const libraryKey = url.searchParams.get('libraryKey')
  const folderKey = url.searchParams.get('folderKey')
  const assetType = url.searchParams.get('assetType')
  const videoAssetType = url.searchParams.get('videoAssetType')
  const usableFor = url.searchParams.get('usableFor')
  const query = String(url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 40)))
  const cursor = url.searchParams.get('cursor')
  const pageParam = url.searchParams.get('page')
  const pageSizeParam = url.searchParams.get('pageSize')
  const pageNumber = pageParam === null ? null : Number(pageParam)
  const pageSize = pageSizeParam === null ? limit : Number(pageSizeParam)
  if ((pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1)) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 40) return json(400, { error: 'INVALID_PAGINATION' })
  if ((libraryKey && !folderKey) || (folderKey && !libraryKey) || (libraryKey && folderKey && !validAssetFolder(libraryKey, folderKey))) return json(400, { error: 'INVALID_LIBRARY_FOLDER' })
  const normalize = asset => {
    const name = `${asset.name || ''} ${asset.group || ''} ${asset.folderType || ''}`
    const inferredType = /场景|内景|外景|茶馆/.test(name) ? 'scene' : /角色|人物|掌柜|顾客/.test(name) ? 'character' : /道具|茶具|杯|壶/.test(name) ? 'prop' : 'other'
    const locations = locationsForAsset(asset)
    return { ...asset, locations, libraryKey: asset.libraryKey || locations[0]?.libraryKey, folderKey: asset.folderKey || locations[0]?.folderKey, assetType: asset.assetType || 'image', videoAssetType: asset.videoAssetType || inferredType, usableFor: Array.isArray(asset.usableFor) ? asset.usableFor : ['script', 'video'], inferred: asset.videoAssetType ? Boolean(asset.inferred) : true, tags: Array.isArray(asset.tags) ? asset.tags : [] }
  }
  const allAssets = (await listJson(bucket, 'metadata/assets/', 1000)).map(normalize)
    .filter(asset => identity.compatibilityMode || assetAvailableInWorkspace(asset, identity.workspaceId))
    .filter(asset => asset.visibility !== 'private' || asset.createdBy === identity.user.id || hasPermission(identity.membership, 'manage'))
    .filter(asset => !workspace || asset.assetSpace === workspace)
    .filter(asset => !libraryKey || hasLocation(asset, libraryKey, folderKey))
    .filter(asset => !assetType || asset.assetType === assetType)
    .filter(asset => !videoAssetType || asset.videoAssetType === videoAssetType)
    .filter(asset => !usableFor || asset.usableFor.includes(usableFor))
    .filter(asset => !query || `${asset.name} ${asset.tags.join(' ')} ${asset.videoAssetType}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(a.id).localeCompare(String(b.id)))
  const total = allAssets.length
  const effectivePageSize = pageNumber === null ? limit : pageSize
  const start = pageNumber === null ? (cursor ? Math.max(0, allAssets.findIndex(asset => asset.id === cursor) + 1) : 0) : (pageNumber - 1) * effectivePageSize
  const page = allAssets.slice(start, start + effectivePageSize)
  const assets = page.map(asset => {
    const previewUrl = asset.previewKey ? assetUrl(asset.previewKey) : assetUrl(asset.thumbnailKey || asset.storageKey)
    return { ...asset, updatedAt: asset.updatedAt || asset.createdAt, cacheVersion: asset.cacheVersion || asset.checksum || asset.id, url: asset.externalUrl || assetUrl(asset.storageKey), thumbnailUrl: asset.thumbnailExternalUrl || asset.externalUrl || assetUrl(asset.thumbnailKey || asset.storageKey), previewUrl: asset.previewExternalUrl || asset.externalUrl || previewUrl, width: asset.width ?? null, height: asset.height ?? null, fileSize: asset.fileSize ?? asset.size ?? null }
  })
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))
  return json(200, {
    assets,
    page: pageNumber || Math.floor(start / effectivePageSize) + 1,
    pageSize: effectivePageSize,
    total,
    totalPages,
    hasPrevious: start > 0,
    hasNext: start + effectivePageSize < total,
    nextCursor: start + effectivePageSize < total ? page.at(-1)?.id || null : null,
  })
}
