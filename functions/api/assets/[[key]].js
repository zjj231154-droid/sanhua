import { json } from '../../_lib/tokenspace.js'
import { assetMetadataKey, assetUrl, putJson } from '../../_lib/asset-store.js'
const safeKey = value => /^[a-zA-Z0-9/_-]{1,180}\.(png|jpe?g|webp)$/i.test(value || '')
const readDataUrl = value => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || '')
  if (!match) return null
  return { type: match[1], bytes: Uint8Array.from(atob(match[2]), char => char.charCodeAt(0)) }
}
const bucketFrom = context => context.env?.SANHUA_ASSETS
export async function onRequestPost(context) {
  const bucket = bucketFrom(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const image = readDataUrl(input.image)
  if (!image || image.bytes.byteLength > 15 * 1024 * 1024) return json(400, { error: '仅支持 15MB 以内的 PNG、JPG、WebP 图片' })
  const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'
  const workspace = ['retouch', 'brand', 'script'].includes(input.workspace) ? input.workspace : null
  if (!workspace) return json(400, { error: 'ASSET_WORKSPACE_REQUIRED' })
  const id = crypto.randomUUID()
  const key = `uploads/default/day-coffee-night-bar/${workspace}/${id}.${extension}`
  const metadata = { id, tenantId: 'default', storeId: 'day-coffee-night-bar', assetSpace: workspace, folderType: 'source', category: 'uploaded', name: String(input.name || `素材.${extension}`).slice(0, 160), storageKey: key, thumbnailKey: key, mimeType: image.type, size: image.bytes.byteLength, isTemporary: false, createdAt: new Date().toISOString(), platformIndex: { assetId: id, syncStatus: 'synced' } }
  await bucket.put(key, image.bytes, { httpMetadata: { contentType: image.type }, customMetadata: { assetId: id, originalName: metadata.name, workspace } })
  await putJson(bucket, assetMetadataKey(id), metadata)
  await putJson(bucket, `metadata/master-assets/${id}.json`, { assetId: id, tenantId: metadata.tenantId, storeId: metadata.storeId, assetSpace: workspace, syncStatus: 'synced', createdAt: metadata.createdAt })
  return json(201, { id, key, url: assetUrl(key), asset: metadata })
}
export async function onRequestGet(context) {
  const bucket = bucketFrom(context)
  const key = Array.isArray(context.params.key) ? context.params.key.join('/') : context.params.key
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  if (!safeKey(key)) return json(400, { error: '无效素材地址' })
  const object = await bucket.get(key)
  if (!object) return json(404, { error: '素材不存在' })
  return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=3600' } })
}
