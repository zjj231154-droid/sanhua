import { useEffect, useRef, useState } from 'react'
import { Upload, ImagePlus, Sparkles, PanelRightClose, PanelRightOpen, Layers3, LoaderCircle, ArrowUpRight, Download, Pencil } from 'lucide-react'
import { CLOUD_ASSETS } from '../data/cloudAssets'
import ImageViewer from './ImageViewer'
import CachedImage from './CachedImage'
import { isCloudDeployment } from '../lib/deployment'

const ANALYSIS_FIELDS = [
  ['size', '尺寸与比例'],
  ['scene', '场景'],
  ['decor', '装饰'],
  ['product', '产品类型'],
  ['preserve', '必须保留'],
  ['requirements', '精修要求'],
]
const DEFAULT_ANALYSIS = {
  size: '保留原图比例与尺寸',
  scene: '保留原图真实场景',
  decor: '不新增与产品无关的道具',
  product: '待识别产品',
  preserve: '产品主体、文字、标签与现有品牌标识',
  requirements: '提亮主体，清理桌面细小污点，保留真实材质与细节。',
}
const BATCH_LIMIT = 10

function readAnalysis(value) {
  const content = value?.data?.choices?.[0]?.message?.content || ''
  const matched = content.match(/\{[\s\S]*\}/)
  if (!matched) throw new Error('识别服务未返回可用字段')
  const parsed = JSON.parse(matched[0])
  return Object.fromEntries(Object.keys(DEFAULT_ANALYSIS).map(key => [key, String(parsed[key] || DEFAULT_ANALYSIS[key]).slice(0, 600)]))
}

function RetouchField({ name, label, value, recommendation, locked, dirty, onChange, onToggleLock, onReset, disabled }) {
  return <label className={dirty ? 'retouch-analysis-field is-dirty' : 'retouch-analysis-field'}>
    <span><b>{label}</b><em>{dirty ? '已偏离 AI 建议' : 'AI 建议'}</em><button type="button" className={locked ? 'field-lock is-locked' : 'field-lock'} aria-pressed={locked} onClick={onToggleLock}>{locked ? '已锁定' : '锁定'}</button></span>
    {name === 'requirements' || name === 'preserve' ? <textarea value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /> : <input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />}
    <button type="button" className="field-reset" disabled={disabled || value === recommendation} onClick={onReset}>恢复 AI 建议</button>
  </label>
}

async function request(route, data) {
  const res = await fetch(`/api/retouch${route}`, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : undefined)
  const raw = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json())
  let value
  try { value = JSON.parse(raw) } catch { throw new Error(res.ok ? '服务返回了无效响应，请刷新后重试。' : '线上版本暂未部署本地精修服务。') }
  if (!res.ok) throw new Error(value.error || '本地服务连接失败')
  return value
}
async function cloudRequest(data) {
  const res = await fetch('/api/tokenspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  const raw = await res.text()
  let value
  try { value = JSON.parse(raw) } catch { throw new Error('云端服务返回了无效响应') }
  if (!res.ok) throw new Error(typeof value.error === 'string' ? value.error : JSON.stringify(value.error || value))
  return value
}
export default function LiveRetouch({ initialTab = 'one-click', focusAssistant = false }) {
  const cloudMode = isCloudDeployment()
  const [image, setImage] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const fileInput = useRef(null)
  const batchInput = useRef(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [assetPickerMode, setAssetPickerMode] = useState('single')
  const [selectedCloudAssets, setSelectedCloudAssets] = useState([])
  const [activeRetouchAssets, setActiveRetouchAssets] = useState([])
  const [gallerySelected, setGallerySelected] = useState([])
  const [storedAssets, setStoredAssets] = useState([])
  const [assetNextCursor, setAssetNextCursor] = useState(null)
  const [loadingMoreAssets, setLoadingMoreAssets] = useState(false)
  const [retouchTab, setRetouchTab] = useState('one-click')
  const [openSections, setOpenSections] = useState(() => {
    try { return { size: true, product: true, ...JSON.parse(localStorage.getItem('sanhua-retouch-open-sections') || '{}') } } catch { return { size: true, product: true } }
  })
  const [templateImage, setTemplateImage] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateAssetId, setTemplateAssetId] = useState('')
  const [resultName, setResultName] = useState('')
  const [batchNamePrefix, setBatchNamePrefix] = useState('')
  useEffect(() => {
    setRetouchTab(initialTab === 'gallery' ? 'gallery' : 'one-click')
    if (focusAssistant) setAssistantOpen(true)
  }, [initialTab, focusAssistant])
  async function uploadTemplate(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError('模版图片请选择 15 MB 以内的 PNG、JPG 或 WebP')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError('模版图片读取失败，请重试')
    reader.onload = () => { setTemplateImage(reader.result); setTemplateName(file.name); setTemplateAssetId(''); setError('') }
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const galleryRef = useRef(null)
  useEffect(() => {
    const gallery = galleryRef.current
    const wheel = event => {
      if (event.ctrlKey) return
      const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? gallery.clientHeight : 1
      const horizontal = event.shiftKey || gallery.scrollHeight <= gallery.clientHeight
      const dx = (horizontal ? event.deltaX || event.deltaY : event.deltaX) * unit
      const dy = horizontal ? 0 : event.deltaY * unit
      if (gallery.scrollWidth > gallery.clientWidth || gallery.scrollHeight > gallery.clientHeight) {
        event.preventDefault()
        gallery.scrollLeft += dx
        gallery.scrollTop += dy
      }
    }
    gallery.addEventListener('wheel', wheel, { passive: false })
    return () => gallery.removeEventListener('wheel', wheel)
  }, [])
  const [requirements, setRequirements] = useState('提亮主体，清理桌面细小污点，保留杯型、标签、文字和饮品质感。')
  const [scene, setScene] = useState('保留原图咖啡店场景')
  const [size, setSize] = useState('保留原图比例，PNG')
  const [decor, setDecor] = useState('不新增道具')
  const [product, setProduct] = useState('待识别产品')
  const [preserve, setPreserve] = useState('杯型、标签、文字、饮品质感与品牌标识')
  const [recommendations, setRecommendations] = useState(() => ({ ...DEFAULT_ANALYSIS, size, scene, decor, requirements }))
  const [lockedFields, setLockedFields] = useState({})
  const [editedFields, setEditedFields] = useState({})
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const analysisRequest = useRef(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [finalPrompt, setFinalPrompt] = useState('')
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [viewerImage, setViewerImage] = useState('')
  const [job, setJob] = useState(null)
  const [cloudResult, setCloudResult] = useState(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [connection, setConnection] = useState('检查 Codex 连接…')
  const busy = sending || ['planning', 'editing'].includes(job?.status)
  const toRetouchAsset = asset => ({
    ...asset,
    category: 'retouch',
    group: asset.group || '云端精修结果',
    url: asset.url || asset.thumbnailUrl,
  })
  const retouchAssets = [
    ...storedAssets,
    ...CLOUD_ASSETS.filter(asset => asset.category === 'retouch' && !storedAssets.some(item => item.id === asset.id)),
  ]
  async function refreshStoredAssets(cursor = null) {
    if (cursor && loadingMoreAssets) return
    if (cursor) setLoadingMoreAssets(true)
    try {
      const query = new URLSearchParams({ workspace: 'retouch', limit: '40', quality: 'preview' })
      if (cursor) query.set('cursor', cursor)
      const response = await fetch(`/api/v1/assets?${query}`)
      if (!response.ok) return
      const value = await response.json()
      const assets = Array.isArray(value.assets) ? value.assets.map(toRetouchAsset).filter(asset => asset.id && asset.url) : []
      setStoredAssets(current => cursor ? [...current, ...assets.filter(asset => !current.some(item => item.id === asset.id))] : assets)
      setAssetNextCursor(value.nextCursor || null)
    } catch {} finally { setLoadingMoreAssets(false) }
  }
  async function renameAsset(asset) {
    const nextName = window.prompt('输入新的图片名称', asset.name)
    if (!nextName?.trim()) return
    try {
      const response = await fetch(`/api/v1/assets/${asset.id}/name`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: nextName }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '重命名失败')
      setStoredAssets(current => current.map(item => item.id === asset.id ? { ...item, ...value.asset } : item))
      setCloudResult(current => current?.id === asset.id ? { ...current, ...value.asset } : current)
    } catch (err) { setError(err.message) }
  }
  function openAssetPicker(mode = 'single') {
    setAssetPickerMode(mode)
    setSelectedCloudAssets(mode === 'template' ? retouchAssets.filter(asset => asset.id === templateAssetId) : mode === 'batch' ? activeRetouchAssets : activeRetouchAssets.slice(0, 1))
    setAssetPickerOpen(true)
  }
  function loadNextAssetPage(event) {
    const element = event.currentTarget
    if (!assetNextCursor || loadingMoreAssets || element.scrollTop + element.clientHeight < element.scrollHeight - 72) return
    void refreshStoredAssets(assetNextCursor)
  }
  function toggleCloudAsset(asset) {
    if (assetPickerMode === 'template') {
      setTemplateImage(asset.url); setTemplateName(asset.name); setTemplateAssetId(asset.id); setAssetPickerOpen(false); setTemplatesOpen(false); setAssistantOpen(true)
      return
    }
    if (assetPickerMode === 'single') { applyCloudAssets([asset]); return }
    setSelectedCloudAssets(current => {
      if (current.some(item => item.id === asset.id)) return current.filter(item => item.id !== asset.id)
      if (current.length >= BATCH_LIMIT) { setError('一次最多选择 10 张，请先取消一张再选择。'); return current }
      return [...current, asset]
    })
  }
  const fields = { size, scene, decor, product, preserve, requirements }
  const setField = (name, value) => ({ size: setSize, scene: setScene, decor: setDecor, product: setProduct, preserve: setPreserve, requirements: setRequirements }[name])(value)
  const toggleSection = name => setOpenSections(current => {
    const next = { ...current, [name]: !current[name] }
    localStorage.setItem('sanhua-retouch-open-sections', JSON.stringify(next))
    return next
  })
  function applyAnalysis(next, requestId) {
    if (requestId !== analysisRequest.current) return
    setRecommendations(next)
    ANALYSIS_FIELDS.forEach(([name]) => { if (!lockedFields[name] && !editedFields[name]) setField(name, next[name]) })
  }
  async function analyzeImage(source, assetId = selectedAssetId) {
    if (!cloudMode || !source) return
    const requestId = ++analysisRequest.current
    setAnalyzing(true)
    try {
      let imageSource = source
      if (!imageSource.startsWith('data:')) {
        const response = await fetch(imageSource)
        if (!response.ok) throw new Error('无法读取所选素材')
        const blob = await response.blob()
        imageSource = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
      }
      const result = await cloudRequest({
        type: 'analyze', image: imageSource,
        prompt: '你是商品修图视觉分析师。分析图片后，只返回 JSON 对象，必须有 size、scene、decor、product、preserve、requirements 六个中文字符串字段。size 写原图比例和输出建议；scene 写真实场景；decor 写可保留或可调整的装饰；product 写产品类型；preserve 写不可改变的产品、文字、标签和品牌元素；requirements 写可直接执行的精修要求。不要使用 Markdown，不要编造不可见元素。',
      })
      applyAnalysis(readAnalysis(result), requestId)
      setError('')
    } catch (err) { setError(`图片识别未完成：${err.message}`) }
    finally { setAnalyzing(false) }
  }
  function applyCloudAssets(picked = selectedCloudAssets, mode = assetPickerMode) {
    if (!picked.length) return
    const assets = mode === 'single' ? [picked[0]] : picked.slice(0, BATCH_LIMIT)
    const source = assets[0].url
    setSelectedCloudAssets(assets); setActiveRetouchAssets(assets); setSelectedAssetId(assets[0].id); setEditedFields({})
    setImage(source); setCloudResult(null); setJob(null); setError(''); localStorage.removeItem('retouch-job'); setAssetPickerOpen(false)
    void analyzeImage(source, assets[0].id)
  }
  function removeActiveAsset(id) {
    setActiveRetouchAssets(current => {
      const next = current.filter(asset => asset.id !== id)
      setSelectedCloudAssets(next)
      if (!next.length) {
        setImage(''); setSelectedAssetId(''); setJob(null); setCloudResult(null)
      } else if (id === selectedAssetId) {
        setImage(next[0].url); setSelectedAssetId(next[0].id); void analyzeImage(next[0].url, next[0].id)
      }
      return next
    })
  }
  useEffect(() => {
    void refreshStoredAssets()
  }, [])
  useEffect(() => {
    if (cloudMode) {
      setConnection('UseGoodAI 云端精修已连接')
      localStorage.removeItem('retouch-job')
      return
    }
    request('/status').then(value => setConnection(value.engine === 'api' ? '中转 API 已配置' : '本地 Codex 已连接 · image-edit-agent')).catch(() => setConnection('服务未连接，请检查管理设置'))
    const id = localStorage.getItem('retouch-job')
    if (id) request(`/${id}`).then(value => { setJob(value); setImage(`/api/retouch/${id}/input`) }).catch(() => localStorage.removeItem('retouch-job'))
  }, [cloudMode])
  useEffect(() => {
    if (!['planning', 'editing'].includes(job?.status)) return
    const timer = setInterval(() => request(`/${job.id}`).then(value => { setJob(value); setError('') }).catch(err => setError(err.message)), 2500)
    return () => clearInterval(timer)
  }, [job?.id, job?.status])
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) return setError('请选择 15 MB 以内的 PNG、JPG 或 WebP')
    const reader = new FileReader()
    reader.onload = () => { const assetId = `upload-${Date.now()}`; const asset = { id: assetId, name: file.name, url: reader.result, group: '本次上传' }; setSelectedCloudAssets([asset]); setActiveRetouchAssets([asset]); setSelectedAssetId(assetId); setEditedFields({}); setImage(reader.result); setCloudResult(null); setJob(null); setError(''); localStorage.removeItem('retouch-job'); void analyzeImage(reader.result, assetId) }
    reader.readAsDataURL(file)
  }
  async function submit(confirm = false) {
    setSending(true); setError('')
    try {
      let source = image
      if ((!confirm || cloudMode) && !image.startsWith('data:')) {
        const response = await fetch(image)
        if (!response.ok) throw new Error('无法读取原图，请重新上传')
        const blob = await response.blob()
        source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
      }
      const templateNote = templateImage
        ? `参考模板图片：${templateName}（${templateAssetId ? '云资产' : '本地上传'}）。模板仅用于光线、构图、色调、质感或氛围参考；不得覆盖产品主体、文字、标签、Logo 和真实外形。`
        : '未引用修图模板参考素材。'
      const editPrompt = `用途：商品精修\n尺寸：${size}\n场景：${scene}\n装饰：${decor}\n产品：${product}\n必须保留：${preserve}\n文字：保留原文，不新增\n要求：${requirements}\n${templateNote}`
      if (cloudMode) {
        if (!confirm) {
          const planned = await cloudRequest({ type: 'prompt', prompt: `请把以下商品修图要求整理为简洁、可执行的中文生图计划，只输出计划正文：\n${editPrompt}` })
          const plan = planned.data?.choices?.[0]?.message?.content || editPrompt
          setJob({ id: 'cloud', status: 'awaiting_confirmation', plan })
          setFinalPrompt(plan)
          setPromptDialogOpen(true)
        } else {
          const sourceImages = await Promise.all((activeRetouchAssets.length ? activeRetouchAssets.map(asset => asset.url) : [image]).map(async sourceUrl => {
            if (sourceUrl.startsWith('data:')) return sourceUrl
            const response = await fetch(sourceUrl)
            if (!response.ok) throw new Error('无法读取所选素材，请重新选择')
            const blob = await response.blob()
            return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob) })
          }))
          const response = await fetch('/api/v1/image-batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            workspace: 'retouch', model: 'gpt-image-2', prompt: `${finalPrompt || job?.plan || ''}\n${editPrompt}`,
            images: [...sourceImages, templateImage].filter(Boolean), count: Math.max(1, activeRetouchAssets.length), size: '1024x1024', title: activeRetouchAssets.length > 1 ? '批量产品精修' : '产品精修', requestedName: activeRetouchAssets.length > 1 ? '' : resultName, namePrefix: activeRetouchAssets.length > 1 ? batchNamePrefix : '', promptSummary: editPrompt, referenceAssetIds: templateAssetId ? [templateAssetId] : [], sourceAssetIds: (activeRetouchAssets.length ? activeRetouchAssets : [{ id: selectedAssetId }]).map(asset => asset.id).filter(Boolean),
          }) })
          const value = await response.json()
          if (!response.ok) throw new Error(value.error || '产品精修失败')
          const resultAsset = value.assets?.[0]
          if (!resultAsset?.url) throw new Error('模型结果未能完成资产归档')
          const newAssets = (Array.isArray(value.assets) ? value.assets : []).map(toRetouchAsset).filter(asset => asset.id && asset.url)
          setStoredAssets(current => [...newAssets, ...current.filter(asset => !newAssets.some(item => item.id === asset.id))])
          void refreshStoredAssets()
          setCloudResult(resultAsset)
          setJob({ ...job, status: 'done', taskId: value.task?.id })
        }
        return
      }
      const result = confirm ? await request(`/${job.id}/confirm`, {}) : await request('', { image: source, referenceImage: templateImage, requirements: editPrompt })
      setJob(result); localStorage.setItem('retouch-job', result.id)
    } catch (err) { setError(err.message) }
    finally { setSending(false) }
  }
  const status = busy ? job?.status === 'editing' ? '正在精修' : '正在整理计划' : job?.status === 'done' ? '精修完成' : job?.status === 'awaiting_confirmation' ? '等待确认计划' : job?.status === 'failed' ? '处理失败' : '待处理'
  return <section className="retouch-page integrated-retouch">
    <header className="workspace-header"><div><span className="breadcrumb">产品精修 / 创作任务</span><h1>产品精修</h1><p>先确认小样，再放心精修</p></div><span className="connection-note" title={connection}>{connection.includes('已连接') ? 'Codex 已连接' : connection}</span></header>
    <input hidden ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} />
    <input hidden ref={batchInput} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy} />
    <div className={retouchTab === 'gallery' ? 'retouch-layout is-library-layout' : assistantOpen ? 'retouch-layout' : 'retouch-layout is-assistant-closed'}>
      <main className="canvas-area">
        <div className="section-tabs" role="tablist" aria-label="产品精修功能"><button className={retouchTab === 'one-click' ? 'primary-button' : 'secondary-button'} role="tab" aria-selected={retouchTab === 'one-click'} onClick={() => setRetouchTab('one-click')}>一键修图</button><button className={retouchTab === 'gallery' ? 'primary-button' : 'secondary-button'} role="tab" aria-selected={retouchTab === 'gallery'} onClick={() => setRetouchTab('gallery')}>图库</button></div>
        {retouchTab === 'gallery' && <div className="gallery-scope-note">产品精修图库 · 仅显示 retouch 资产与精修结果</div>}
        {retouchTab === 'one-click' ? <div className="canvas-toolbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('single')}><Upload size={16} />添加图片</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('batch')}><Layers3 size={16} />批量修图</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy || job?.status === 'awaiting_confirmation'} aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(value => !value)}><Sparkles size={16} />修图模版</button>{activeRetouchAssets.length > 0 && <span className="retouch-selection-summary">已选择 {activeRetouchAssets.length} 张素材</span>}</div><Layers3 size={17} /></div> : <div className="canvas-toolbar gallery-toolbar"><span>产品精修图库 · 原图 / 参考图 / 精修结果 / 修图模版</span><button className="primary-button" onClick={() => setRetouchTab('one-click')}>去一键修图</button></div>}
        {assetPickerOpen && <div className="asset-picker-modal" role="dialog" aria-label="从云端素材库选择图片"><div className="asset-picker-dialog"><div className="asset-picker-heading"><div><strong>{assetPickerMode === 'template' ? '选择云资产参考素材' : '从云端素材库选择'}</strong><small>{assetPickerMode === 'template' ? '仅作为修图模板参考，不会替换产品主体' : assetPickerMode === 'batch' ? '最多选择 10 张图片，确认后进入批量修图' : '单图模式：点击图片后立即进入精修助手'}</small></div><button className="assistant-toggle" onClick={() => setAssetPickerOpen(false)} aria-label="关闭素材选择">×</button></div><div className="asset-picker-grid" onScroll={loadNextAssetPage}>{retouchAssets.map(asset => { const selectedIndex = selectedCloudAssets.findIndex(item => item.id === asset.id); return <button key={asset.id} className={selectedIndex >= 0 ? 'asset-select-card is-selected' : 'asset-select-card'} aria-pressed={selectedIndex >= 0} onClick={() => toggleCloudAsset(asset)}><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><span className="asset-selection-index" aria-hidden="true">{selectedIndex >= 0 ? `✓ ${assetPickerMode === 'template' ? '模板' : selectedIndex + 1}` : ''}</span><span>{asset.name}</span><small>{asset.group}</small></button> })}{loadingMoreAssets && <p className="asset-picker-loading" role="status">正在加载更多素材…</p>}</div><div className="asset-picker-footer"><span>{assetPickerMode === 'template' ? '点击图片即可设为模板参考' : assetPickerMode === 'single' ? '点击图片即可使用' : `已选 ${selectedCloudAssets.length} / 10 张`}</span>{assetPickerMode === 'batch' && <button className="primary-button" disabled={!selectedCloudAssets.length} onClick={() => applyCloudAssets(selectedCloudAssets, 'batch')}>使用已选 {selectedCloudAssets.length} 张素材</button>}</div></div></div>}
        {templatesOpen && <div className="assistant-message template-panel" aria-label="修图模板"><p>模板参考只影响光线、构图、色调和质感，不替换当前商品主体。</p><div className="brand-agent-actions"><label className="secondary-button merch-upload">上传参考素材<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadTemplate} /></label><button className="secondary-button" disabled={busy} onClick={() => openAssetPicker('template')}>选择云资产参考素材</button></div>{templateImage && <div className="template-reference-card"><img src={templateImage} alt={`模板参考：${templateName}`} /><div><strong>{templateName}</strong><small>{templateAssetId ? '来源：云资产' : '来源：本地上传'}</small></div><button className="secondary-button" onClick={() => { setTemplateImage(''); setTemplateName(''); setTemplateAssetId('') }}>移除</button></div>}</div>}
        <div className="retouch-feedback" role="status" aria-live="polite">{busy && <LoaderCircle size={15} className="spin-icon" />}{activeRetouchAssets.length ? `已选择 ${activeRetouchAssets.length} 张素材 · ${activeRetouchAssets.length > 1 ? '批量精修准备就绪' : '单图精修准备就绪'}` : image ? status : cloudMode ? '上传产品照片，云端精修将通过 UseGoodAI 处理' : '上传产品照片，在精修助手中编辑要求'}{job?.status === 'done' && ' · 结果已更新到下方卡片'}</div>
        {(error || job?.error) && <p className="retouch-error" role="alert">{error || job.error}</p>}
        <section ref={galleryRef} className="photo-grid live-photo-grid" tabIndex={0} title="滚轮上下滚动 · Shift + 滚轮左右滚动" aria-label="产品精修图片与结果，可上下左右滚动">
          <button className="upload-card" disabled={busy} onClick={() => openAssetPicker('single')}><span><ImagePlus size={24} /></span><strong>从云端资产库选择产品照片</strong><small>选择已整理的咖啡店或茶馆场景素材</small></button>
          {retouchTab === 'gallery' && retouchAssets.map(asset => { const selectedIndex = gallerySelected.indexOf(asset.id); const editable = Boolean(storedAssets.some(item => item.id === asset.id)); return <article className={selectedIndex >= 0 ? 'photo-card gallery-asset-card is-selected' : 'photo-card gallery-asset-card'} key={`gallery-${asset.id}`} onClick={() => setGallerySelected(current => selectedIndex >= 0 ? current.filter(id => id !== asset.id) : [...current, asset.id])}><div className="real-photo"><CachedImage asset={asset} src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><span className="photo-badge">{asset.group}</span><span className="gallery-checkbox" aria-hidden="true">{selectedIndex >= 0 ? `✓ ${selectedIndex + 1}` : ''}</span></div><div className="photo-info"><span><strong>{asset.name}</strong><small>产品精修 · {asset.group}</small></span>{editable ? <span className="gallery-card-actions"><a href={`/api/v1/assets/${asset.id}/download`} download={asset.downloadName || asset.name} aria-label={`下载 ${asset.name}`} onClick={event => event.stopPropagation()}><Download size={15} /></a><button aria-label={`重命名 ${asset.name}`} onClick={event => { event.stopPropagation(); renameAsset(asset) }}><Pencil size={15} /></button></span> : <small title="演示素材为只读内容">演示素材</small>}</div></article> })}
          {retouchTab === 'one-click' && activeRetouchAssets.map((asset, index) => <article className="photo-card selected-source-card is-selected" key={`selected-${asset.id}`}><button className="real-photo image-open-button" onClick={() => setViewerImage(asset.url)}><CachedImage asset={asset} src={asset.thumbnailUrl || asset.url} alt={asset.name} /><span className="photo-badge">已选 {index + 1} / {activeRetouchAssets.length}</span></button><div className="photo-info"><span><strong>{asset.name}</strong><small>{activeRetouchAssets.length > 1 ? '批量精修素材' : '单图精修素材'}</small></span><button aria-label={`移除 ${asset.name}`} disabled={busy} onClick={() => removeActiveAsset(asset.id)}>×</button></div></article>)}
          {image && !activeRetouchAssets.length && !job?.results?.length && !cloudResult && retouchTab === 'one-click' && <article className="photo-card"><div className="real-photo"><img src={image} alt="待精修原图" /><span className="photo-badge">原图</span></div><div className="photo-info"><span><strong>产品原图</strong><small>{status}</small></span><button aria-label="编辑精修要求" onClick={() => setAssistantOpen(true)}><Sparkles size={17} /></button></div></article>}
          {cloudResult && <article className="photo-card result-card"><button className="real-photo image-open-button" onClick={() => setViewerImage(cloudResult)}><CachedImage src={cloudResult.url} alt="云端精修结果，点击查看大图" loading="eager" /><span className="photo-badge">精修完成</span></button><div className="photo-info"><span><strong>{cloudResult.name}</strong><a href={`/api/v1/assets/${cloudResult.id}/download`} download={cloudResult.downloadName || cloudResult.name}>下载图片</a></span><button aria-label={`重命名 ${cloudResult.name}`} disabled={busy} onClick={() => renameAsset(cloudResult)}>改名</button><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(cloudResult.url); setCloudResult(null); setJob(null); setAssistantOpen(true) }}><ArrowUpRight size={17} /></button></div></article>}
          {job?.results?.map(name => { const url = `/api/retouch/${job.id}/output/${encodeURIComponent(name)}`; return <article className="photo-card result-card" key={name}><div className="real-photo"><img src={url} alt="精修结果" /><span className="photo-badge">精修完成</span></div><div className="photo-info"><span><strong>精修结果</strong><a href={url} download={name}>下载原尺寸图片</a></span><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(url); setJob(null); setAssistantOpen(true); localStorage.removeItem('retouch-job') }}><ArrowUpRight size={17} /></button></div></article> })}
        </section>
        {retouchTab === 'gallery' && <div className="gallery-selection-bar"><span>已选 {gallerySelected.length} 张</span><button className="secondary-button" onClick={() => setGallerySelected([])}>清空</button><button className="primary-button" disabled={!gallerySelected.length} onClick={() => { const picked = retouchAssets.filter(asset => gallerySelected.includes(asset.id)); applyCloudAssets(picked, 'batch'); setRetouchTab('one-click') }}>使用已选素材</button></div>}
      </main>
      <aside className={retouchTab === 'gallery' ? 'assistant-panel is-library' : assistantOpen ? 'assistant-panel' : 'assistant-panel is-collapsed'}>
        <div className="assistant-title"><span className="assistant-avatar"><Sparkles size={18} /></span><span><strong>精修助手</strong><small><i />{busy ? status : '已就绪'}</small></span><button className="assistant-toggle" aria-label={assistantOpen ? '收起精修助手' : '展开精修助手'} aria-expanded={assistantOpen} onClick={() => setAssistantOpen(value => !value)}>{assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button></div>
        <div className="assistant-body live-controls" hidden={!assistantOpen}>
        <div className="assistant-message"><p>{analyzing ? '正在根据当前素材识别商品、场景与可保留元素…' : '当前素材已生成可编辑的精修字段。锁定的字段在重新识别时不会被覆盖。'}</p>{image && cloudMode && <button className="text-button" disabled={analyzing || busy} onClick={() => void analyzeImage(image)}>重新识别当前素材</button>}</div>
        {templateImage && <div className="template-reference-card" aria-label="模板参考"><img src={templateImage} alt={`模板参考：${templateName}`} /><div><strong>模板参考</strong><b>{templateName}</b><small>{templateAssetId ? '云资产参考素材' : '本地上传参考素材'}</small></div><button className="secondary-button" disabled={busy} onClick={() => { setTemplateImage(''); setTemplateName(''); setTemplateAssetId('') }}>移除</button></div>}
        <fieldset className="retouch-accordion" disabled={busy || job?.status === 'awaiting_confirmation'}>
          {ANALYSIS_FIELDS.map(([name, label]) => {
            const recommendation = recommendations[name] || DEFAULT_ANALYSIS[name]
            const dirty = Boolean(editedFields[name] && fields[name] !== recommendation)
            return <section key={name} className={dirty ? 'retouch-accordion-item is-dirty' : 'retouch-accordion-item'}>
              <button type="button" className="retouch-accordion-trigger" aria-expanded={Boolean(openSections[name])} onClick={() => toggleSection(name)}><span><b>{label}</b><small>{dirty ? '已偏离 AI 建议' : fields[name] || '待补充'}</small></span><i>{openSections[name] ? '−' : '+'}</i></button>
              {openSections[name] && <RetouchField name={name} label={label} value={fields[name]} recommendation={recommendation} locked={Boolean(lockedFields[name])} dirty={dirty} disabled={busy || job?.status === 'awaiting_confirmation'} onChange={value => { setEditedFields(current => ({ ...current, [name]: true })); setField(name, value) }} onToggleLock={() => setLockedFields(current => ({ ...current, [name]: !current[name] }))} onReset={() => { setEditedFields(current => ({ ...current, [name]: false })); setField(name, recommendation) }} />}
            </section>
          })}
        </fieldset>
        {job?.plan && <div className="live-plan"><h3>生图计划</h3><p>{job.plan}</p></div>}
        {job?.note && <details><summary>查看精修说明</summary><p>{job.note}</p></details>}
        </div>
        <div className="assistant-footer live-controls" hidden={!assistantOpen}>
        {job?.status === 'awaiting_confirmation' ? <>{cloudMode ? <button className="primary-button" disabled={busy} onClick={() => setPromptDialogOpen(true)}>查看并确认提示词</button> : <button className="primary-button" disabled={busy} onClick={() => submit(true)}>确认计划并开始精修</button>}<button className="secondary-button" onClick={() => { setJob(null); setPromptDialogOpen(false); localStorage.removeItem('retouch-job') }}>修改要求</button></> : <button className="primary-button" disabled={!image || busy || analyzing || !requirements.trim()} onClick={() => submit()}>{analyzing ? '正在识别素材…' : '生成精修计划'}</button>}
        <small>{cloudMode ? '图片将通过服务端发送至 UseGoodAI；密钥不会进入浏览器。' : '图片保存在本机任务目录。按管理设置使用 Codex 或中转 API，确认计划后才编辑图片。'}</small>
        </div>
      </aside>
    </div>
    {promptDialogOpen && <div className="retouch-prompt-modal" role="dialog" aria-modal="true" aria-label="确认精修提示词"><div className="retouch-prompt-dialog"><header><div><span className="kicker">第二步 · 提示词确认</span><h2>确认最终精修提示词</h2><p>你可以直接修改这份提示词；确认后才会将图片交给生图模型。</p></div><button className="assistant-toggle" onClick={() => setPromptDialogOpen(false)} aria-label="关闭提示词确认">×</button></header><label>结果图片名称<input value={activeRetouchAssets.length > 1 ? batchNamePrefix : resultName} maxLength="160" onChange={event => activeRetouchAssets.length > 1 ? setBatchNamePrefix(event.target.value) : setResultName(event.target.value)} placeholder={activeRetouchAssets.length > 1 ? '例如：咖啡新品' : '例如：山茶气泡饮-精修主图'} aria-label={activeRetouchAssets.length > 1 ? '批量命名前缀' : '结果图片名称'} /></label><textarea value={finalPrompt} onChange={event => setFinalPrompt(event.target.value)} aria-label="最终精修提示词" /><footer><button className="secondary-button" disabled={sending} onClick={() => setPromptDialogOpen(false)}>返回修改</button><button className="primary-button" disabled={sending || !finalPrompt.trim()} onClick={() => { setPromptDialogOpen(false); submit(true) }}>{sending ? '正在生成…' : '确认提示词并开始精修'}</button></footer></div></div>}
    {viewerImage && <ImageViewer src={typeof viewerImage === 'string' ? viewerImage : viewerImage.url} alt={typeof viewerImage === 'string' ? '精修生成结果' : viewerImage.name} downloadUrl={typeof viewerImage === 'string' ? viewerImage : `/api/v1/assets/${viewerImage.id}/download`} downloadName={typeof viewerImage === 'string' ? undefined : viewerImage.downloadName || viewerImage.name} onClose={() => setViewerImage('')} />}
  </section>
}
