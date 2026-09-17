import { useEffect, useMemo, useRef, useState } from 'react'
import { imageCacheKey, imageCacheStatus, preloadImage, clearImageCache } from '../lib/image-cache'

export default function CachedImage({ asset, src, alt, className = '', loading = 'lazy', onClick }) {
  const cacheKey = useMemo(() => imageCacheKey(asset || src), [asset, src])
  const [status, setStatus] = useState(() => imageCacheStatus(cacheKey))
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const wrapper = useRef(null)

  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { rootMargin: '360px' })
    if (wrapper.current) observer.observe(wrapper.current)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined
    let active = true
    setStatus(imageCacheStatus(cacheKey))
    preloadImage(src, cacheKey).then(() => active && setStatus('loaded')).catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [src, cacheKey, visible])

  const retry = event => {
    event.preventDefault()
    event.stopPropagation()
    clearImageCache(cacheKey)
    setStatus('loading')
    preloadImage(src, cacheKey).then(() => setStatus('loaded')).catch(() => setStatus('error'))
  }

  return <span ref={wrapper} className={`cached-image ${className}`} data-image-status={visible ? status : 'idle'}>
    {visible && <img src={src} alt={alt} loading={loading} onClick={onClick} />}
    {status === 'error' && <button type="button" className="image-retry" onClick={retry}>图片加载失败，点击重试</button>}
  </span>
}
