import { json } from '../../../_lib/tokenspace.js'
import { addAssetLocation, assetMetadataKey, assetUrl, assetsBucket, downloadFileName, getJson, normalizeAssetName, putJson, uniqueNameForLocation } from '../../../_lib/asset-store.js'
import { folderFor } from '../../../_lib/library-config.js'
import { hasPermission, requireIdentity } from '../../../_lib/collaboration.js'

const pathParts = context => Array.isArray(context.params.path) ? context.params.path : String(context.params.path || '').split('/').filter(Boolean)
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const extensionFor = mimeType => mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
const uploadKey = (workspaceId, uploadId) => `metadata/asset-upload-ids/${workspaceId}/${String(uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120)}.json`
const assetSummary = asset => ({ ...asset, url: assetUrl(asset.storageKey), thumbnailUrl: assetUrl(asset.thumbnailKey || asset.storageKey), previewUrl: assetUrl(asset.previewKey || asset.thumbnailKey || asset.storageKey) })

async function assetFor(context, id) {
  const identity = await requireIdentity(context, 'view')
  if (identity.error) return { error: identity.error }
  const bucket = assetsBucket(context)
  if (!bucket) return { error: json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) }
  const asset = await getJson(bucket, assetMetadataKey(id))
  if (!asset) return { error: json(404, { error: 'ASSET_NOT_FOUND' }) }
  if (!identity.compatibilityMode && asset.workspaceId !== identity.workspaceId && asset.tenantId !== identity.workspaceId) return { error: json(404, { error: 'ASSET_NOT_FOUND' }) }
  if (asset.visibility === 'private' && asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) return { error: json(403, { error: 'INSUFFICIENT_PERMISSION' }) }
  return { bucket, asset, identity }
}

export async function onRequestPatch(context) {
  const [id, action] = pathParts(context)
  if (!id || action !== 'name') return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const { bucket, asset, identity, error } = await assetFor(context, id)
  if (error) return error
  if (!hasPermission(identity.membership, 'edit')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
  const supplied = String(input.display_name || input.displayName || '').trim()
  if (!supplied || supplied.length > 160) return json(400, { error: 'ASSET_NAME_INVALID' })
  const displayName = normalizeAssetName(supplied)
  const extension = String(asset.mimeType || 'image/png').split('/')[1] === 'jpeg' ? 'jpg' : String(asset.mimeType || 'image/png').split('/')[1]
  if (!identity.compatibilityMode && !Number.isInteger(input.expectedVersion)) return json(400, { error: 'EXPECTED_VERSION_REQUIRED' })
  if (!identity.compatibilityMode && input.expectedVersion !== asset.version) return json(409, { error: 'VERSION_CONFLICT', currentVersion: asset.version, updatedBy: asset.updatedBy, updatedAt: asset.updatedAt })
  const next = { ...asset, name: displayName, displayName, downloadName: downloadFileName(input.download_name || input.downloadName || displayName, extension), renamedAt: new Date().toISOString(), updatedBy: identity.user.id, version: Number(asset.version || 0) + 1, updatedAt: new Date().toISOString() }
  await putJson(bucket, assetMetadataKey(id), next)
  return json(200, { asset: next })
}

export async function onRequestPost(context) {
  const [id, action] = pathParts(context)
  const identity = await requireIdentity(context, 'edit')
  if (identity.error) return identity.error
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  if (id === 'upload' && !action) {
    let form
    try { form = await context.request.formData() } catch { return json(400, { error: 'INVALID_UPLOAD_FORM' }) }
    const file = form.get('file')
    const libraryKey = String(form.get('libraryKey') || '').trim()
    const folderKey = String(form.get('folderKey') || '').trim()
    const folder = folderFor(libraryKey, folderKey)
    if (!folder?.uploadEnabled) return json(403, { error: 'FOLDER_UPLOAD_FORBIDDEN' })
    if (!file || typeof file.arrayBuffer !== 'function') return json(400, { error: 'INVALID_FILE' })
    const extension = extensionFor(file.type)
    if (!imageTypes.has(file.type) || !/\.(png|jpe?g|webp)$/i.test(String(file.name || ''))) return json(400, { error: 'INVALID_FILE' })
    if (file.size > 20 * 1024 * 1024) return json(413, { error: 'FILE_TOO_LARGE' })
    const uploadId = String(form.get('uploadId') || '').trim()
    if (uploadId) {
      const previous = await getJson(bucket, uploadKey(identity.workspaceId, uploadId))
      if (previous?.assetId) {
        const existing = await getJson(bucket, assetMetadataKey(previous.assetId))
        if (existing) return json(200, { asset: assetSummary(existing), location: previous.location, idempotent: true })
      }
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!bytes.byteLength) return json(400, { error: 'INVALID_FILE' })
    const assetId = crypto.randomUUID()
    const now = new Date().toISOString()
    const requestedName = normalizeAssetName(form.get('name') || String(file.name || '').replace(/\.[^.]+$/, ''), folder.label)
    const name = await uniqueNameForLocation(bucket, requestedName, { libraryKey, folderKey })
    const storageKey = `uploads/${identity.workspaceId}/day-coffee-night-bar/${libraryKey}/${folderKey}/${assetId}.${extension}`
    const location = { id: crypto.randomUUID(), assetId, workspaceId: identity.workspaceId, libraryKey, folderKey, projectId: String(form.get('projectId') || libraryKey).trim() || libraryKey, createdBy: identity.user.id, createdAt: now, deletedAt: null }
    const videoAssetType = libraryKey === 'script' ? folderKey : undefined
    const asset = { id: assetId, tenantId: identity.workspaceId, workspaceId: identity.workspaceId, projectId: location.projectId, createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, visibility: ['private', 'project', 'workspace'].includes(form.get('visibility')) ? form.get('visibility') : 'project', storeId: 'day-coffee-night-bar', assetSpace: libraryKey === 'text' ? 'script' : libraryKey, libraryKey, folderKey, locations: [location], folderType: folderKey, category: 'uploaded', assetType: 'image', videoAssetType, usableFor: libraryKey === 'script' ? ['script', 'video'] : libraryKey === 'retouch' ? ['retouch'] : ['brand'], sourceModule: 'upload', sourceTaskId: null, name, displayName: name, downloadName: downloadFileName(name, extension), storageKey, thumbnailKey: storageKey, previewKey: storageKey, mimeType: file.type, size: bytes.byteLength, fileSize: bytes.byteLength, format: extension, width: null, height: null, status: 'succeeded', isTemporary: false, expiresAt: null, createdAt: now, updatedAt: now, cacheVersion: assetId, platformIndex: { assetId, syncStatus: 'synced' } }
    await bucket.put(storageKey, bytes, { httpMetadata: { contentType: file.type }, customMetadata: { assetId, originalName: String(file.name || ''), libraryKey, folderKey } })
    await putJson(bucket, assetMetadataKey(assetId), asset)
    await putJson(bucket, `metadata/asset-locations/${assetId}/${libraryKey}-${folderKey}-${encodeURIComponent(location.projectId)}.json`, location)
    if (uploadId) await putJson(bucket, uploadKey(identity.workspaceId, uploadId), { assetId, location, createdAt: now })
    return json(201, { asset: assetSummary(asset), location })
  }
  if (!id || action !== 'save-as-template') return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  let input
  try { input = await context.request.json() } catch { input = {} }
  const asset = await getJson(bucket, assetMetadataKey(id))
  if (!asset || (!identity.compatibilityMode && asset.workspaceId !== identity.workspaceId)) return json(404, { error: 'ASSET_NOT_FOUND' })
  if (asset.visibility === 'private' && asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
  const placed = await addAssetLocation(bucket, asset, { libraryKey: 'retouch', folderKey: 'template', projectId: input.projectId || asset.projectId, createdBy: identity.user.id })
  if (placed.invalid) return json(400, { error: 'INVALID_TEMPLATE_LOCATION' })
  const requestedName = String(input.name || '').trim()
  const extension = extensionFor(asset.mimeType)
  const nextName = await uniqueNameForLocation(bucket, requestedName ? normalizeAssetName(requestedName) : placed.asset.name, { libraryKey: 'retouch', folderKey: 'template', assetId: asset.id })
  const next = { ...placed.asset, name: nextName, displayName: nextName, downloadName: downloadFileName(nextName, extension), sourceAssetId: asset.sourceAssetId || asset.id, updatedBy: identity.user.id, updatedAt: new Date().toISOString(), version: Number(asset.version || 0) + 1 }
  await putJson(bucket, assetMetadataKey(id), next)
  return json(200, { asset: assetSummary(next), location: placed.location, idempotent: placed.existed })
}

export async function onRequestGet(context) {
  const [id, action] = pathParts(context)
  if (!id) return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  const { bucket, asset, error } = await assetFor(context, id)
  if (error) return error
  if (!action) return json(200, { asset: assetSummary(asset) })
  if (action === 'locations') return json(200, { locations: Array.isArray(asset.locations) ? asset.locations : [] })
  if (action !== 'download') return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  const object = await bucket.get(asset.storageKey)
  if (!object) return json(404, { error: 'ASSET_FILE_NOT_FOUND' })
  return new Response(object.body, { headers: { 'content-type': asset.mimeType || 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.downloadName || asset.name || 'image.png')}`, 'cache-control': 'private, max-age=0, no-store' } })
}
