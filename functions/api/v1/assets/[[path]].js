import { json } from '../../../_lib/tokenspace.js'
import { assetMetadataKey, assetsBucket, downloadFileName, getJson, normalizeAssetName, putJson } from '../../../_lib/asset-store.js'

const pathParts = context => Array.isArray(context.params.path) ? context.params.path : String(context.params.path || '').split('/').filter(Boolean)

async function assetFor(context, id) {
  const bucket = assetsBucket(context)
  if (!bucket) return { error: json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) }
  const asset = await getJson(bucket, assetMetadataKey(id))
  if (!asset) return { error: json(404, { error: 'ASSET_NOT_FOUND' }) }
  return { bucket, asset }
}

export async function onRequestPatch(context) {
  const [id, action] = pathParts(context)
  if (!id || action !== 'name') return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const { bucket, asset, error } = await assetFor(context, id)
  if (error) return error
  const supplied = String(input.display_name || input.displayName || '').trim()
  if (!supplied || supplied.length > 160) return json(400, { error: 'ASSET_NAME_INVALID' })
  const displayName = normalizeAssetName(supplied)
  const extension = String(asset.mimeType || 'image/png').split('/')[1] === 'jpeg' ? 'jpg' : String(asset.mimeType || 'image/png').split('/')[1]
  const next = { ...asset, name: displayName, displayName, downloadName: downloadFileName(input.download_name || input.downloadName || displayName, extension), renamedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  await putJson(bucket, assetMetadataKey(id), next)
  return json(200, { asset: next })
}

export async function onRequestGet(context) {
  const [id, action] = pathParts(context)
  if (!id || action !== 'download') return json(404, { error: 'ASSET_ROUTE_NOT_FOUND' })
  const { bucket, asset, error } = await assetFor(context, id)
  if (error) return error
  const object = await bucket.get(asset.storageKey)
  if (!object) return json(404, { error: 'ASSET_FILE_NOT_FOUND' })
  return new Response(object.body, { headers: { 'content-type': asset.mimeType || 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.downloadName || asset.name || 'image.png')}`, 'cache-control': 'private, max-age=0, no-store' } })
}
