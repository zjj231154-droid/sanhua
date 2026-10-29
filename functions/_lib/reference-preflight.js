import { assetAvailableInWorkspace, assetMetadataKey, assetsBucket, getJson } from './asset-store.js'
import { hasPermission, validProviderBaseUrl } from './collaboration.js'
import { mayReadTaskResult } from './task-ownership.js'
import { referenceIdsFrom } from './reference-bindings.js'

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const maxImageBytes = 8 * 1024 * 1024, maxTotalBytes = 30 * 1024 * 1024
const failure = (code, reason) => Object.assign(new Error(reason), { code })
const toBase64 = bytes => { let text = ''; for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(text) }
async function readBytes(object) {
  if (Number(object.size || object.headers?.get('content-length')) > maxImageBytes) throw failure('IMAGE_TOO_LARGE', '图片超过 8MB')
  if (object.body?.getReader) {
    const reader = object.body.getReader(), chunks = []; let size = 0
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > maxImageBytes) throw failure('IMAGE_TOO_LARGE', '图片超过 8MB'); chunks.push(chunk.value) } }
    finally { await reader.cancel().catch(() => {}) }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }; return bytes
  }
  return new Uint8Array(await (object.arrayBuffer ? object.arrayBuffer() : new Response(object.body).arrayBuffer()))
}
async function remoteImage(url, ownLegacy) {
  for (let redirects = 0; redirects < 4; redirects++) {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '')
    if (!ownLegacy && (!validProviderBaseUrl(url) || /^(0\.|169\.254\.|100\.(6[4-9]|[78]\d|9\d|1[01]\d|12[0-7])\.|::|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(host))) throw failure('REFERENCE_URL_FORBIDDEN', '参考图地址不可公开访问')
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    if ([301, 302, 303, 307, 308].includes(response.status)) { const location = response.headers.get('location'); if (!location) throw failure('IMAGE_UNREADABLE', '图片重定向无效'); url = new URL(location, url).toString(); ownLegacy = false; continue }
    if (!response.ok) throw failure('IMAGE_UNREADABLE', `无法读取图片（HTTP ${response.status}）`)
    return response
  }
  throw failure('IMAGE_UNREADABLE', '图片重定向次数过多')
}
export async function preflightReferences(context, identity, inputIds, { includeImages = false } = {}) {
  const ids = referenceIdsFrom(inputIds), bucket = assetsBucket(context), items = [], images = []
  if (ids.length > 9) return { ready: false, count: ids.length, status: 'failed', items: [], errors: [{ code: 'TOO_MANY_REFERENCES', reason: '视频最多可引用 9 张图片，请减少选择。' }] }
  let totalBytes = 0
  for (const assetId of ids) {
    let name = assetId
    try {
      if (!bucket) throw failure('STORAGE_UNAVAILABLE', '资产存储未配置')
      const asset = await getJson(bucket, assetMetadataKey(assetId))
      if (!asset || !mayReadTaskResult(asset, identity) || (!identity.compatibilityMode && !assetAvailableInWorkspace(asset, identity.workspaceId))) throw failure('ASSET_NOT_FOUND', '素材不存在或无权引用')
      if (asset.visibility === 'private' && asset.createdBy !== identity.user.id && !hasPermission(identity.membership, 'manage')) throw failure('ASSET_NOT_FOUND', '素材不存在或无权引用')
      name = asset.name || asset.displayName || assetId
      if (asset.assetType && asset.assetType !== 'image') throw failure('UNSUPPORTED_FORMAT', '参考素材必须是图片')
      if (asset.usableFor?.length && !asset.usableFor.includes('video')) throw failure('ASSET_NOT_USABLE', '该素材未授权用于视频生成')
      let object, mimeType = asset.mimeType
      if (asset.externalUrl) {
        const legacy = /^\/cloud-assets\//.test(asset.externalUrl)
        if (!legacy && !/^https:\/\//i.test(asset.externalUrl)) throw failure('IMAGE_UNREADABLE', '素材地址无效，请重新上传')
        object = await remoteImage(new URL(asset.externalUrl, context.request.url).toString(), legacy)
        mimeType = (object.headers.get('content-type') || asset.mimeType || '').split(';')[0].trim().toLowerCase()
      } else {
        if (!asset.storageKey) throw failure('IMAGE_UNREADABLE', '素材缺少图片文件，请重新上传')
        object = await bucket.get(asset.storageKey)
      }
      if (!object) throw failure('IMAGE_UNREADABLE', '图片文件不存在，请重新选择或上传')
      mimeType ||= object.httpMetadata?.contentType
      if (!imageTypes.has(mimeType)) throw failure('UNSUPPORTED_FORMAT', '仅支持 PNG、JPG、WebP 图片')
      const bytes = await readBytes(object)
      if (!bytes.byteLength) throw failure('IMAGE_UNREADABLE', '图片文件为空')
      if (bytes.byteLength > maxImageBytes) throw failure('IMAGE_TOO_LARGE', '图片超过 8MB')
      totalBytes += bytes.byteLength
      if (totalBytes > maxTotalBytes) throw failure('REFERENCES_TOO_LARGE', '本次参考图片合计超过 30MB')
      items.push({ assetId, name, readable: true, status: 'available', size: bytes.byteLength, mimeType })
      if (includeImages) images.push({ id: assetId, name: String(name).slice(0, 160), source: `data:${mimeType};base64,${toBase64(bytes)}` })
    } catch (error) { items.push({ assetId, name, readable: false, status: 'failed', code: error.code || 'IMAGE_UNREADABLE', reason: error.code ? error.message : '读取图片失败，请重新选择或上传' }) }
  }
  const errors = items.filter(item => !item.readable)
  return { ready: !errors.length, count: ids.length, status: errors.length ? 'failed' : 'available', items, errors, ...(includeImages ? { images } : {}) }
}
