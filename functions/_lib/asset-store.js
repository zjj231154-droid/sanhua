import { json } from './tokenspace.js'
import { r2S3BucketFor } from './r2-s3.js'

const MAX_ASSET_BYTES = 20 * 1024 * 1024
const dateParts = date => {
  const value = date || new Date()
  return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, '0'), String(value.getUTCDate()).padStart(2, '0')]
}
export const assetsBucket = context => {
  const nativeBucket = context.env?.SANHUA_ASSETS
  return nativeBucket?.put && nativeBucket?.get && nativeBucket?.list ? nativeBucket : r2S3BucketFor(context.env)
}
export const requiredBucket = context => assetsBucket(context) || null
export const dataUrlBytes = value => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || '')
  if (!match) return null
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
  return bytes.byteLength <= MAX_ASSET_BYTES ? { bytes, mimeType: match[1], extension: match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1] } : null
}
export const outputBytes = output => output?.b64_json ? dataUrlBytes(`data:image/png;base64,${output.b64_json}`) : null
export const assetUrl = key => `/api/assets/${key}`
export const assetMetadataKey = id => `metadata/assets/${id}.json`
export const taskMetadataKey = id => `metadata/tasks/${id}.json`

export async function putJson(bucket, key, value) {
  await bucket.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json; charset=utf-8' } })
  return value
}
export async function getJson(bucket, key) {
  const object = await bucket.get(key)
  return object ? object.json() : null
}
export async function listJson(bucket, prefix, limit = 200) {
  const listed = await bucket.list({ prefix, limit })
  const rows = await Promise.all(listed.objects.map(item => getJson(bucket, item.key)))
  return rows.filter(Boolean)
}

export async function archiveImageOutputs(context, { taskId, workspace, outputs, model, prompt, sourceAssetIds = [], title }) {
  const bucket = requiredBucket(context)
  if (!bucket) return { error: json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请绑定 Cloudflare Pages 的 SANHUA_ASSETS，或在 Railway 配置 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET_NAME。' }) }
  const allowedWorkspace = ['retouch', 'brand'].includes(workspace) ? workspace : null
  if (!allowedWorkspace) return { error: json(400, { error: 'INVALID_ASSET_WORKSPACE' }) }
  const [year, month, day] = dateParts()
  const assets = []
  for (let index = 0; index < outputs.length; index += 1) {
    const converted = outputBytes(outputs[index])
    if (!converted) return { error: json(502, { error: 'MODEL_OUTPUT_NOT_ARCHIVABLE', index: index + 1 }) }
    const id = crypto.randomUUID()
    const storageKey = `generated/default/day-coffee-night-bar/${allowedWorkspace}/ai-temp/${year}/${month}/${day}/${taskId}/outputs/${id}.${converted.extension}`
    const asset = {
      id, tenantId: 'default', storeId: 'day-coffee-night-bar', assetSpace: allowedWorkspace,
      folderType: 'ai-temp', category: 'generated', name: `${title || (allowedWorkspace === 'brand' ? '品牌创作' : '产品精修')}-${index + 1}.${converted.extension}`,
      storageKey, thumbnailKey: storageKey, mimeType: converted.mimeType, size: converted.bytes.byteLength,
      checksum: `${converted.bytes.byteLength}:${id.slice(0, 8)}`, isTemporary: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), sourceAssetIds,
      taskId, model, prompt, createdAt: new Date().toISOString(), platformIndex: { assetId: id, syncStatus: 'synced' },
    }
    await bucket.put(storageKey, converted.bytes, { httpMetadata: { contentType: converted.mimeType }, customMetadata: { assetId: id, taskId, workspace: allowedWorkspace } })
    await putJson(bucket, assetMetadataKey(id), asset)
    await putJson(bucket, `metadata/master-assets/${id}.json`, { assetId: id, tenantId: asset.tenantId, storeId: asset.storeId, assetSpace: allowedWorkspace, sourceTaskId: taskId, syncStatus: 'synced', createdAt: asset.createdAt })
    assets.push(asset)
  }
  return { assets }
}
