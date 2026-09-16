import { useEffect, useRef, useState } from 'react'
import { Upload, ImagePlus, Sparkles, PanelRightClose, PanelRightOpen, Layers3, LoaderCircle, ArrowUpRight } from 'lucide-react'
import { CLOUD_ASSETS } from '../data/cloudAssets'
import ImageViewer from './ImageViewer'

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

function readAnalysis(value) {
  const content = value?.data?.choices?.[0]?.message?.content || ''
  const matched = content.match(/\{[\s\S]*\}/)
  if (!matched) throw new Error('识别服务未返回可用字段')
  const parsed = JSON.parse(matched[0])
  return Object.fromEntries(Object.keys(DEFAULT_ANALYSIS).map(key => [key, String(parsed[key] || DEFAULT_ANALYSIS[key]).slice(0, 600)]))
}

function RetouchField({ name, label, value, recommendation, locked, onChange, onToggleLock, onReset, disabled }) {
  return <label className="retouch-analysis-field">
    <span><b>{label}</b><button type="button" className={locked ? 'field-lock is-locked' : 'field-lock'} aria-pressed={locked} onClick={onToggleLock}>{locked ? '已锁定' : '锁定'}</button></span>
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
export default function LiveRetouch() {
  const cloudMode = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev')
  const [image, setImage] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const fileInput = useRef(null)
  const batchInput = useRef(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [assetPickerMode, setAssetPickerMode] = useState('single')
  const [selectedCloudAssets, setSelectedCloudAssets] = useState([])
  const [gallerySelected, setGallerySelected] = useState([])
  const [retouchTab, setRetouchTab] = useState('one-click')
  const [templateKeywords, setTemplateKeywords] = useState('')
  const [templateImage, setTemplateImage] = useState('')
  const [templateName, setTemplateName] = useState('')
  async function uploadTemplate(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError('模版图片请选择 15 MB 以内的 PNG、JPG 或 WebP')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setError('模版图片读取失败，请重试')
    reader.onload = () => { setTemplateImage(reader.result); setTemplateName(file.name); setError('') }
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
  const [cloudResult, setCloudResult] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [connection, setConnection] = useState('检查 Codex 连接…')
  const busy = sending || ['planning', 'editing'].includes(job?.status)
  function openAssetPicker(mode = 'single') { setAssetPickerMode(mode); setAssetPickerOpen(true) }
  function toggleCloudAsset(asset) {
    if (assetPickerMode === 'single') { setSelectedCloudAssets([asset]); return }
    setSelectedCloudAssets(current => current.some(item => item.id === asset.id) ? current.filter(item => item.id !== asset.id) : [...current, asset])
  }
  const fields = { size, scene, decor, product, preserve, requirements }
  const setField = (name, value) => ({ size: setSize, scene: setScene, decor: setDecor, product: setProduct, preserve: setPreserve, requirements: setRequirements }[name])(value)
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
  function applyCloudAssets() {
    if (!selectedCloudAssets.length) return
    const source = selectedCloudAssets[0].url
    setSelectedAssetId(selectedCloudAssets[0].id); setEditedFields({})
    setImage(source); setCloudResult(''); setJob(null); setError(''); localStorage.removeItem('retouch-job'); setAssetPickerOpen(false)
    void analyzeImage(source, selectedCloudAssets[0].id)
  }
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
    reader.onload = () => { const assetId = `upload-${Date.now()}`; setSelectedAssetId(assetId); setEditedFields({}); setImage(reader.result); setCloudResult(''); setJob(null); setError(''); localStorage.removeItem('retouch-job'); void analyzeImage(reader.result, assetId) }
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
      const editPrompt = `用途：商品精修\n尺寸：${size}\n场景：${scene}\n装饰：${decor}\n产品：${product}\n必须保留：${preserve}\n文字：保留原文，不新增\n要求：${requirements}\n模版关键词：${templateKeywords || '未设置'}\n参考模版：${templateName || '未设置'}，仅参考光线、色调和构图，保留商品主体。`
      if (cloudMode) {
        if (!confirm) {
          const planned = await cloudRequest({ type: 'prompt', prompt: `请把以下商品修图要求整理为简洁、可执行的中文生图计划，只输出计划正文：\n${editPrompt}` })
          const plan = planned.data?.choices?.[0]?.message?.content || editPrompt
          setJob({ id: 'cloud', status: 'awaiting_confirmation', plan })
          setFinalPrompt(plan)
          setPromptDialogOpen(true)
        } else {
          const edited = await cloudRequest({ type: 'edit', model: 'gpt-image-2', prompt: `${finalPrompt || job?.plan || ''}\n${editPrompt}`, images: [source, templateImage].filter(Boolean) })
          const output = edited.data?.data?.[0]
          const resultUrl = output?.b64_json ? `data:image/png;base64,${output.b64_json}` : output?.url
          if (!resultUrl) throw new Error('生图服务未返回可用图片')
          setCloudResult(resultUrl)
          setJob({ ...job, status: 'done' })
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
        {retouchTab === 'one-click' ? <div className="canvas-toolbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('single')}><Upload size={16} />添加图片</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('batch')}><Layers3 size={16} />批量修图</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy || job?.status === 'awaiting_confirmation'} aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(value => !value)}><Sparkles size={16} />修图模版</button></div><Layers3 size={17} /></div> : <div className="canvas-toolbar gallery-toolbar"><span>产品精修图库 · 原图 / 参考图 / 精修结果 / 修图模版</span><button className="primary-button" onClick={() => setRetouchTab('one-click')}>去一键修图</button></div>}
        {assetPickerOpen && <div className="asset-picker-modal" role="dialog" aria-label="从云端素材库选择图片"><div className="asset-picker-dialog"><div className="asset-picker-heading"><div><strong>从云端素材库选择</strong><small>{assetPickerMode === 'batch' ? '可多选图片，确认后进入批量修图' : '选择一张图片进入精修助手'}</small></div><button className="assistant-toggle" onClick={() => setAssetPickerOpen(false)} aria-label="关闭素材选择">×</button></div><div className="asset-picker-grid">{CLOUD_ASSETS.filter(asset => asset.category === 'retouch').map(asset => <button key={asset.id} className={selectedCloudAssets.some(item => item.id === asset.id) ? 'asset-select-card is-selected' : 'asset-select-card'} onClick={() => toggleCloudAsset(asset)}><img src={asset.url} alt={asset.name} /><span>{asset.name}</span><small>{asset.group}</small></button>)}</div><div className="asset-picker-footer"><span>已选 {selectedCloudAssets.length} 张</span><button className="primary-button" disabled={!selectedCloudAssets.length} onClick={applyCloudAssets}>使用选中素材</button></div></div></div>}
        {templatesOpen && <div className="assistant-message" aria-label="修图模版"><p>选择模版，将自动填入精修助手。</p>{[
          ['咖啡日光', '保留原图咖啡店场景，柔和自然日光', '提亮咖啡主体与杯身，保留拉花、杯型、商标和真实质感。'],
          ['夜酒氛围', '保留原图咖啡酒吧场景，暖色夜间灯光', '突出酒液通透感与冰块细节，保留杯型、标签与文字。'],
          ['干净商品图', '保留原图场景', '清理桌面细小污点，校正曝光与色温，保持商品形状与文字。'],
        ].map(([name, nextScene, nextRequirements]) => <button className="secondary-button" key={name} onClick={() => { setScene(nextScene); setRequirements(nextRequirements); setAssistantOpen(true); setTemplatesOpen(false) }}>{name}</button>)}
          <fieldset className="live-controls" disabled={busy || job?.status === 'awaiting_confirmation'} style={{ border: 0, padding: '16px 0 0' }}>
            <label>模版关键词<textarea maxLength={1500} value={templateKeywords} onChange={event => setTemplateKeywords(event.target.value)} placeholder="例如：暖色日光、复古咖啡店、自然阴影、保留杯型" /></label>
            <label>上传图片作为模版<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadTemplate} /></label>
            <small>支持 PNG、JPG、WebP，最大 15 MB。关键词和参考图可以同时使用。</small>
            {templateImage && <div><img src={templateImage} alt="修图参考模版" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 16 }} /><p>{templateName}</p><button className="secondary-button" onClick={() => { setTemplateImage(''); setTemplateName('') }}>移除参考图</button></div>}
            <button className="primary-button" onClick={() => { setTemplatesOpen(false); setAssistantOpen(true) }}>应用模版</button>
          </fieldset>
        </div>}
        <div className="retouch-feedback" role="status" aria-live="polite">{busy && <LoaderCircle size={15} className="spin-icon" />}{image ? status : cloudMode ? '上传产品照片，云端精修将通过 UseGoodAI 处理' : '上传产品照片，在精修助手中编辑要求'}{job?.status === 'done' && ' · 结果已更新到下方卡片'}</div>
        {(error || job?.error) && <p className="retouch-error" role="alert">{error || job.error}</p>}
        <section ref={galleryRef} className="photo-grid live-photo-grid" tabIndex={0} title="滚轮上下滚动 · Shift + 滚轮左右滚动" aria-label="产品精修图片与结果，可上下左右滚动">
          <button className="upload-card" disabled={busy} onClick={() => openAssetPicker('single')}><span><ImagePlus size={24} /></span><strong>从云端资产库选择产品照片</strong><small>选择已整理的咖啡店或茶馆场景素材</small></button>
          {retouchTab === 'gallery' && CLOUD_ASSETS.filter(asset => asset.category === 'retouch').map(asset => { const selectedIndex = gallerySelected.indexOf(asset.id); return <article className={selectedIndex >= 0 ? 'photo-card gallery-asset-card is-selected' : 'photo-card gallery-asset-card'} key={`gallery-${asset.id}`} onClick={() => setGallerySelected(current => selectedIndex >= 0 ? current.filter(id => id !== asset.id) : [...current, asset.id])}><div className="real-photo"><img src={asset.url} alt={asset.name} loading="lazy" /><span className="photo-badge">{asset.group}</span><span className="gallery-checkbox" aria-hidden="true">{selectedIndex >= 0 ? `✓ ${selectedIndex + 1}` : ''}</span></div><div className="photo-info"><span><strong>{asset.name}</strong><small>产品精修 · {asset.group}</small></span></div></article> })}
          {image && !job?.results?.length && !cloudResult && retouchTab === 'one-click' && <article className="photo-card"><div className="real-photo"><img src={image} alt="待精修原图" /><span className="photo-badge">原图</span></div><div className="photo-info"><span><strong>产品原图</strong><small>{status}</small></span><button aria-label="编辑精修要求" onClick={() => setAssistantOpen(true)}><Sparkles size={17} /></button></div></article>}
          {cloudResult && <article className="photo-card result-card"><button className="real-photo image-open-button" onClick={() => setViewerImage(cloudResult)}><img src={cloudResult} alt="云端精修结果，点击查看大图" /><span className="photo-badge">精修完成</span></button><div className="photo-info"><span><strong>精修结果</strong><a href={cloudResult} download="sanhua-retouched.png">下载图片</a></span><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(cloudResult); setCloudResult(''); setJob(null); setAssistantOpen(true) }}><ArrowUpRight size={17} /></button></div></article>}
          {job?.results?.map(name => { const url = `/api/retouch/${job.id}/output/${encodeURIComponent(name)}`; return <article className="photo-card result-card" key={name}><div className="real-photo"><img src={url} alt="精修结果" /><span className="photo-badge">精修完成</span></div><div className="photo-info"><span><strong>精修结果</strong><a href={url} download={name}>下载原尺寸图片</a></span><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(url); setJob(null); setAssistantOpen(true); localStorage.removeItem('retouch-job') }}><ArrowUpRight size={17} /></button></div></article> })}
          {retouchTab === 'one-click' && ['冰美式', '暮色特调', '桂花拿铁', '山茶气泡饮'].map((name, index) => <article className="photo-card" key={name}><div className={`photo-visual photo-visual--${['amber','rose','cream','green'][index]}`} role="img" aria-label={`${name}案例图片`}><span className="photo-badge">案例参考</span></div><div className="photo-info"><span><strong>{name}</strong><small>咖啡店商品摄影 · 精修案例</small></span></div></article>)}
        </section>
        {retouchTab === 'gallery' && <div className="gallery-selection-bar"><span>已选 {gallerySelected.length} 张</span><button className="secondary-button" onClick={() => setGallerySelected([])}>清空</button><button className="primary-button" disabled={!gallerySelected.length} onClick={() => { const picked = CLOUD_ASSETS.filter(asset => gallerySelected.includes(asset.id)); setSelectedCloudAssets(picked); setImage(picked[0]?.url || ''); setCloudResult(''); setJob(null); setRetouchTab('one-click'); setAssetPickerOpen(false) }}>使用选中素材</button></div>}
      </main>
      <aside className={retouchTab === 'gallery' ? 'assistant-panel is-library' : assistantOpen ? 'assistant-panel' : 'assistant-panel is-collapsed'}>
        <div className="assistant-title"><span className="assistant-avatar"><Sparkles size={18} /></span><span><strong>精修助手</strong><small><i />{busy ? status : '已就绪'}</small></span><button className="assistant-toggle" aria-label={assistantOpen ? '收起精修助手' : '展开精修助手'} aria-expanded={assistantOpen} onClick={() => setAssistantOpen(value => !value)}>{assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button></div>
        <div className="assistant-body live-controls" hidden={!assistantOpen}>
        <div className="assistant-message"><p>{analyzing ? '正在根据当前素材识别商品、场景与可保留元素…' : '当前素材已生成可编辑的精修字段。锁定的字段在重新识别时不会被覆盖。'}</p>{image && cloudMode && <button className="text-button" disabled={analyzing || busy} onClick={() => void analyzeImage(image)}>重新识别当前素材</button>}</div>
        <fieldset disabled={busy || job?.status === 'awaiting_confirmation'}>
          {ANALYSIS_FIELDS.map(([name, label]) => <RetouchField key={name} name={name} label={label} value={fields[name]} recommendation={recommendations[name] || DEFAULT_ANALYSIS[name]} locked={Boolean(lockedFields[name])} disabled={busy || job?.status === 'awaiting_confirmation'} onChange={value => { setEditedFields(current => ({ ...current, [name]: true })); setField(name, value) }} onToggleLock={() => setLockedFields(current => ({ ...current, [name]: !current[name] }))} onReset={() => { setEditedFields(current => ({ ...current, [name]: false })); setField(name, recommendations[name] || DEFAULT_ANALYSIS[name]) }} />)}
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
    {promptDialogOpen && <div className="retouch-prompt-modal" role="dialog" aria-modal="true" aria-label="确认精修提示词"><div className="retouch-prompt-dialog"><header><div><span className="kicker">第二步 · 提示词确认</span><h2>确认最终精修提示词</h2><p>你可以直接修改这份提示词；确认后才会将图片交给生图模型。</p></div><button className="assistant-toggle" onClick={() => setPromptDialogOpen(false)} aria-label="关闭提示词确认">×</button></header><textarea value={finalPrompt} onChange={event => setFinalPrompt(event.target.value)} aria-label="最终精修提示词" /><footer><button className="secondary-button" disabled={sending} onClick={() => setPromptDialogOpen(false)}>返回修改</button><button className="primary-button" disabled={sending || !finalPrompt.trim()} onClick={() => { setPromptDialogOpen(false); submit(true) }}>{sending ? '正在生成…' : '确认提示词并开始精修'}</button></footer></div></div>}
    {viewerImage && <ImageViewer src={viewerImage} alt="精修生成结果" onClose={() => setViewerImage('')} />}
  </section>
}
