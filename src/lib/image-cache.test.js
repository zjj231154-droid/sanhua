import { afterEach, expect, it, vi } from 'vitest'
import { clearImageCache, imageCacheKey, preloadImage } from './image-cache'

afterEach(() => {
  clearImageCache()
  vi.unstubAllGlobals()
})

it('uses an asset version as a stable image cache key', () => {
  expect(imageCacheKey({ id: 'asset-1', thumbnailKey: 'thumb.png', storageKey: 'full.png', cacheVersion: 'v2' })).toContain('asset-1|thumb.png|full.png|v2')
})

it('does not preload the same session image twice', async () => {
  const images = []
  vi.stubGlobal('Image', class {
    set src(value) { this.value = value; images.push(value); queueMicrotask(() => this.onload()) }
    async decode() {}
  })
  await Promise.all([preloadImage('/api/assets/a.png', 'asset-a'), preloadImage('/api/assets/a.png', 'asset-a')])
  expect(images).toEqual(['/api/assets/a.png'])
})
