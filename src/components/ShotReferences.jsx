import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function useReferencePreflight(ids) {
  const key = ids.join('|'), [revision, setRevision] = useState(0), [result, setResult] = useState({ key: '', status: 'checking', items: [] })
  useEffect(() => {
    const controller = new AbortController()
    if (!ids.length) { setResult({ key, status: 'available', ready: true, items: [], count: 0 }); return () => controller.abort() }
    setResult({ key, status: 'checking', items: [], count: ids.length })
    fetch('/api/v1/assets/reference-preflight', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referencedAssetIds: ids }), signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!controller.signal.aborted) setResult({ ...data, key, status: response.ok && data.ready ? 'available' : 'failed', error: data.error || '' }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ key, status: 'failed', items: [], error: error.message || '素材检查失败，请重试' }) })
    return () => controller.abort()
  }, [key, revision])
  return { ...(!ids.length ? { key, status: 'available', items: [], count: 0 } : result.key === key ? result : { key, status: 'checking', items: [] }), retry: () => setRevision(value => value + 1) }
}

export const ShotReferenceEditor = forwardRef(function ShotReferenceEditor({ value, bindings, assets = [], onChange, onPreview, onLoadAssets, disabled = false }, ref) {
  const input = useRef(null), range = useRef(null), caret = useRef(null)
  const [picker, setPicker] = useState(null), [query, setQuery] = useState(''), [error, setError] = useState('')
  const open = (replaceId = '') => {
    if (!replaceId) range.current = { start: input.current?.selectionStart ?? value.length, end: input.current?.selectionEnd ?? value.length }
    setPicker({ replaceId }); setQuery(''); setError('')
    Promise.resolve(onLoadAssets?.()).catch(reason => setError(reason.message || '素材列表加载失败'))
  }
  useImperativeHandle(ref, () => ({ open, remove: assetId => {
    const removed = bindings.find(item => item.assetId === assetId)
    const next = bindings.filter(item => item.assetId !== assetId)
    onChange({ prompt: removed ? value.replace(new RegExp(`${removed.token}(?!\\d)`, 'g'), '') : value, referencedAssetIds: next.map(item => item.assetId), referenceBindings: next })
  } }))
  useEffect(() => { if (caret.current != null && input.current) { input.current.focus(); input.current.setSelectionRange(caret.current, caret.current); caret.current = null } }, [value])
  const choose = asset => {
    let next = [...bindings], binding = next.find(item => item.assetId === asset.id), prompt = value
    if (picker.replaceId) {
      if (binding && binding.assetId !== picker.replaceId) { setError('该素材已经引用，请选择其他素材。'); return }
      next = next.map(item => item.assetId === picker.replaceId ? { ...item, assetId: asset.id } : item)
    } else {
      if (!binding) {
        if (next.length >= 9) { setError('最多引用 9 张图片，请先移除一张素材。'); return }
        let number = 1; while (next.some(item => item.token === `@图片${number}`)) number++
        binding = { assetId: asset.id, token: `@图片${number}` }; next.push(binding)
      }
      const selection = range.current || { start: value.length, end: value.length }
      prompt = value.slice(0, selection.start) + binding.token + value.slice(selection.end)
      caret.current = selection.start + binding.token.length
    }
    onChange({ prompt, referencedAssetIds: next.map(item => item.assetId), referenceBindings: next }); setPicker(null)
  }
  return <>
    <label>当前镜头视频提示词<textarea ref={input} disabled={disabled} aria-label="当前镜头视频提示词" value={value} onChange={event => {
      const prompt = event.target.value, end = event.target.selectionStart
      onChange({ prompt })
      if (prompt[end - 1] === '@') { range.current = { start: end - 1, end }; setPicker({ replaceId: '' }); setQuery(''); setError(''); Promise.resolve(onLoadAssets?.()).catch(reason => setError(reason.message)) }
    }} /></label>
    <div className="drama-reference-toolbar"><button disabled={disabled} className="secondary-button" onMouseDown={event => event.preventDefault()} onClick={() => open()} aria-label="在光标位置引用素材">@ 引用素材</button><span>输入 @ 或点击按钮，在当前光标位置插入图片引用。</span></div>
    {picker && createPortal(<div className="drama-overlay"><section className="drama-reference-picker" role="dialog" aria-modal="true" aria-label="引用上传素材"><header><h2>{picker.replaceId ? '替换引用素材' : '选择引用素材'}</h2><button onClick={() => setPicker(null)} aria-label="关闭引用素材选择">×</button></header><input autoFocus aria-label="搜索引用素材" placeholder="搜索素材名称" value={query} onChange={event => setQuery(event.target.value)} />{error && <p role="alert">{error}</p>}<div className="drama-reference-grid">{assets.filter(asset => !asset.assetType || asset.assetType === 'image').filter(asset => String(asset.name || asset.id).toLowerCase().includes(query.toLowerCase())).map(asset => <button key={asset.id} onClick={() => choose(asset)} aria-label={`引用 ${asset.name || asset.id}`}><img src={asset.thumbnailUrl || asset.previewUrl || asset.url} alt="" /><strong>{asset.name || asset.id}</strong></button>)}</div>{!assets.length && <p>暂无已上传的短剧素材，可先在项目素材区上传图片。</p>}<p>所选素材将绑定实际 assetId，并在提交时作为图片发送给模型。</p></section></div>, document.body)}
  </>
})

export function ReferenceSummary({ bindings, assets = [], preflight, onPreview, onReplace, onRemove, disabled = false }) {
  return <section className="drama-reference-summary" aria-label="本镜头参考素材"><h3>本镜头参考素材</h3>
    <p role="status">{preflight.status === 'checking' ? '正在检查参考素材…' : preflight.status === 'available' ? `本次将发送 ${bindings.length} 张参考图` : '参考素材读取失败，请重新选择后再生成。'}</p>
    {preflight.error && <p role="alert">{preflight.error}</p>}
    {bindings.map((binding, index) => {
      const checked = preflight.items?.find(item => item.assetId === binding.assetId)
      const asset = assets.find(item => item.id === binding.assetId) || { id: binding.assetId, name: checked?.name || binding.assetId }
      return <article className="drama-reference-card" key={binding.assetId}><button className="drama-reference-preview" onClick={() => onPreview?.(asset)} aria-label={`预览 ${asset.name}`}><img src={asset.thumbnailUrl || asset.previewUrl || asset.url} alt="" /></button><div><strong>{binding.token} · {asset.name}</strong><small>参考图 {index + 1} · {preflight.status === 'checking' ? '预检中' : checked?.readable ? '可用' : checked?.reason || '待检查'}</small><div className="drama-inline-actions"><button disabled={disabled} onClick={() => onReplace(binding.assetId)}>{checked?.readable === false ? '重新选择' : '替换'}</button><button disabled={disabled} onClick={() => onRemove(binding.assetId)} aria-label={`移除引用 ${asset.name}`}>移除</button></div></div></article>
    })}
    {preflight.status === 'failed' && <button className="secondary-button" onClick={preflight.retry}>重新检查素材</button>}
  </section>
}
