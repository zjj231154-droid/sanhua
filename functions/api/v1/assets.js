import { json } from '../../_lib/tokenspace.js'
import { assetsBucket, assetUrl, listJson } from '../../_lib/asset-store.js'

export async function onRequestGet(context) {
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请在 Cloudflare Pages 绑定 SANHUA_ASSETS，或在 Railway 挂载 Volume 并设置 SANHUA_STORAGE_DIR。' })
  const url = new URL(context.request.url)
  const workspace = url.searchParams.get('workspace') || url.searchParams.get('assetSpace')
  const limit = Math.max(1, Math.min(40, Number(url.searchParams.get('limit') || 40)))
  const cursor = url.searchParams.get('cursor')
  const allAssets = (await listJson(bucket, 'metadata/assets/'))
    .filter(asset => !workspace || asset.assetSpace === workspace)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const start = cursor ? Math.max(0, allAssets.findIndex(asset => asset.id === cursor) + 1) : 0
  const page = allAssets.slice(start, start + limit)
  const assets = page.map(asset => {
    const previewUrl = asset.previewKey ? assetUrl(asset.previewKey) : assetUrl(asset.thumbnailKey || asset.storageKey)
    return { ...asset, updatedAt: asset.updatedAt || asset.createdAt, cacheVersion: asset.cacheVersion || asset.checksum || asset.id, url: assetUrl(asset.storageKey), thumbnailUrl: assetUrl(asset.thumbnailKey || asset.storageKey), previewUrl, width: asset.width ?? null, height: asset.height ?? null, fileSize: asset.fileSize ?? asset.size ?? null }
  })
  return json(200, { assets, nextCursor: start + limit < allAssets.length ? page.at(-1)?.id || null : null })
}
