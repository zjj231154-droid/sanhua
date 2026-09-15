import { json } from '../../_lib/tokenspace.js'
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
  const key = `uploads/${crypto.randomUUID()}.${extension}`
  await bucket.put(key, image.bytes, { httpMetadata: { contentType: image.type }, customMetadata: { originalName: String(input.name || '').slice(0, 160) } })
  return json(201, { key, url: `/api/assets/${key}` })
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
