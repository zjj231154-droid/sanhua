const entries = new Map()

export function imageCacheKey(assetOrUrl, version = '') {
  if (typeof assetOrUrl === 'string') return `${assetOrUrl}|${version}`
  const asset = assetOrUrl || {}
  return [asset.id || asset.assetId || '', asset.thumbnailKey || '', asset.storageKey || asset.url || '', asset.cacheVersion || asset.updatedAt || asset.createdAt || version].join('|')
}

export function imageCacheStatus(key) {
  return entries.get(key)?.status || 'idle'
}

export function preloadImage(src, key = imageCacheKey(src)) {
  if (!src || typeof Image === 'undefined') return Promise.resolve()
  const existing = entries.get(key)
  if (existing?.status === 'loaded') return Promise.resolve()
  if (existing?.promise) return existing.promise

  const image = new Image()
  const promise = new Promise((resolve, reject) => {
    image.onload = async () => {
      try { await image.decode?.() } catch {}
      entries.set(key, { status: 'loaded', image })
      resolve()
    }
    image.onerror = () => {
      entries.set(key, { status: 'error' })
      reject(new Error('IMAGE_LOAD_FAILED'))
    }
  })
  entries.set(key, { status: 'loading', image, promise })
  image.src = src
  return promise
}

export function clearImageCache(key) {
  if (key) entries.delete(key)
  else entries.clear()
}
