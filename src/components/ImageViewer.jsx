import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'

export default function ImageViewer({ src, alt = '生成图片', onClose }) {
  const [zoom, setZoom] = useState(100)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const clamp = value => Math.max(10, Math.min(800, value))
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const reset = () => { setZoom(100); setOffset({ x: 0, y: 0 }) }
  const fullscreen = async () => { try { await document.documentElement.requestFullscreen?.() } catch {} }
  return <div className="image-viewer" role="dialog" aria-modal="true" aria-label="图片查看器">
    <div className="image-viewer-toolbar"><strong>{alt}</strong><span>{zoom}%</span><button onClick={() => setZoom(value => clamp(value - 10))} aria-label="缩小"><Minus size={17} /></button><button onClick={() => setZoom(value => clamp(value + 10))} aria-label="放大"><Plus size={17} /></button><button onClick={reset} aria-label="重置视图"><RotateCcw size={17} /></button><button onClick={fullscreen} aria-label="全屏查看"><Maximize2 size={17} /></button><button onClick={onClose} aria-label="关闭图片查看器"><X size={18} /></button></div>
    <div className="image-viewer-stage" onWheel={event => { event.preventDefault(); setZoom(value => clamp(value + (event.deltaY < 0 ? 10 : -10))) }} onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, offset }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (!drag.current) return; setOffset({ x: drag.current.offset.x + event.clientX - drag.current.x, y: drag.current.offset.y + event.clientY - drag.current.y }) }} onPointerUp={() => { drag.current = null }}>
      <img src={src} alt={alt} draggable="false" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom / 100})` }} />
    </div>
  </div>
}
