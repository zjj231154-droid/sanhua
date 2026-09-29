import { json } from '../../../_lib/tokenspace.js'
import { addAssetLocation, assetMetadataKey, assetUrl, assetsBucket, downloadFileName, getJson, listJson, putJson, uniqueNameForLocation } from '../../../_lib/asset-store.js'
import { folderFor } from '../../../_lib/library-config.js'
import { hasPermission, requireIdentity } from '../../../_lib/collaboration.js'

const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)

const publicAsset = asset => ({
  ...asset,
  url: assetUrl(asset.storageKey),
  thumbnailUrl: assetUrl(asset.thumbnailKey || asset.storageKey),
  previewUrl: assetUrl(asset.previewKey || asset.thumbnailKey || asset.storageKey),
})

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view')
  if (identity.error) return identity.error
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  const [id] = parts(context)
  const allowed = asset => (identity.compatibilityMode || asset.workspaceId === identity.workspaceId || asset.tenantId === identity.workspaceId)
    && (asset.visibility !== 'private' || asset.createdBy === identity.user.id || hasPermission(identity.membership, 'manage'))
  const all = (await listJson(bucket, 'metadata/assets/')).filter(allowed).filter(asset => asset.category === 'generated' || asset.sourceTaskId || asset.isTemporary)
  if (id) {
    const asset = all.find(item => item.id === id)
    if (!asset) return json(404, { error: 'GENERATED_RESULT_NOT_FOUND' })
    const relatedIds = [...new Set([...(asset.sourceAssetIds || []), ...(asset.referenceAssetIds || [])])]
    const sources = (await Promise.all(relatedIds.map(sourceId => getJson(bucket, assetMetadataKey(sourceId))))).filter(Boolean).filter(allowed).map(publicAsset)
    return json(200, { result: publicAsset(asset), sources })
  }
  const url = new URL(context.request.url)
  const workspace = url.searchParams.get('workspace')
  const results = all.filter(asset => !workspace || asset.assetSpace === workspace || asset.workspace === workspace)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(publicAsset)
  return json(200, { results })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit')
  if (identity.error) return identity.error
  const [id, action] = parts(context)
  if (!id || action !== 'archive') return json(404, { error: 'GENERATED_RESULT_ROUTE_NOT_FOUND' })
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const asset = await getJson(bucket, assetMetadataKey(id))
  if (!asset || (!identity.compatibilityMode && asset.workspaceId !== identity.workspaceId)) return json(404, { error: 'GENERATED_RESULT_NOT_FOUND' })
  if (asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
  if (asset.category !== 'generated' && !asset.isTemporary) return json(409, { error: 'RESULT_NOT_ARCHIVABLE' })
  const libraryKey = String(input.libraryKey || asset.recommendedLibraryKey || '').trim()
  const folderKey = String(input.folderKey || asset.recommendedFolderKey || '').trim()
  const folder = folderFor(libraryKey, folderKey)
  if (!folder?.generatedArchiveEnabled) return json(403, { error: 'FOLDER_ARCHIVE_FORBIDDEN' })
  const placed = await addAssetLocation(bucket, asset, { libraryKey, folderKey, projectId: input.projectId || asset.projectId, createdBy: identity.user.id })
  const name = String(input.name || '').trim()
  const requestedName = name ? String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : asset.displayName || asset.name
  const finalName = await uniqueNameForLocation(bucket, requestedName, { libraryKey, folderKey, assetId: asset.id })
  const extension = asset.mimeType === 'image/jpeg' ? 'jpg' : asset.mimeType === 'image/webp' ? 'webp' : 'png'
  const next = { ...placed.asset, name: finalName, displayName: finalName, downloadName: downloadFileName(finalName, extension), isTemporary: false, expiresAt: null, status: 'succeeded', updatedBy: identity.user.id, updatedAt: new Date().toISOString(), version: Number(asset.version || 0) + 1 }
  await putJson(bucket, assetMetadataKey(id), next)
  return json(200, { asset: { ...next, url: assetUrl(next.storageKey), thumbnailUrl: assetUrl(next.thumbnailKey || next.storageKey), previewUrl: assetUrl(next.previewKey || next.thumbnailKey || next.storageKey) }, location: placed.location, existed: placed.existed })
}
