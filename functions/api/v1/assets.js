import { json } from '../../_lib/tokenspace.js'
import { assetsBucket, assetUrl, listJson } from '../../_lib/asset-store.js'

export async function onRequestGet(context) {
  const bucket = assetsBucket(context)
  if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED', hint: '请在 Cloudflare Pages 绑定 SANHUA_ASSETS，或在 Railway 挂载 Volume 并设置 SANHUA_STORAGE_DIR。' })
  const url = new URL(context.request.url)
  const workspace = url.searchParams.get('workspace')
  const assets = (await listJson(bucket, 'metadata/assets/'))
    .filter(asset => !workspace || asset.assetSpace === workspace)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(asset => ({ ...asset, url: assetUrl(asset.storageKey), thumbnailUrl: assetUrl(asset.thumbnailKey) }))
  return json(200, { assets })
}
