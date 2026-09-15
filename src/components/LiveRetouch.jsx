import { useEffect, useRef, useState } from 'react'
import { Upload, ImagePlus, Sparkles, PanelRightClose, PanelRightOpen, Layers3, LoaderCircle, ArrowUpRight } from 'lucide-react'
import { CLOUD_ASSETS } from '../data/cloudAssets'

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
  function applyCloudAssets() {
    if (!selectedCloudAssets.length) return
    setImage(selectedCloudAssets[0].url); setCloudResult(''); setJob(null); setError(''); localStorage.removeItem('retouch-job'); setAssetPickerOpen(false)
  }
  useEffect(() => {
    if (cloudMode) {
      setConnection('TokenSpace 云端精修已连接')
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
    reader.onload = () => { setImage(reader.result); setCloudResult(''); setJob(null); setError(''); localStorage.removeItem('retouch-job') }
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
      const editPrompt = `用途：商品精修\n尺寸：${size}\n场景：${scene}\n装饰：${decor}\n文字：保留原文，不新增\n要求：${requirements}\n模版关键词：${templateKeywords || '未设置'}\n参考模版：${templateName || '未设置'}，仅参考光线、色调和构图，保留商品主体。`
      if (cloudMode) {
        if (!confirm) {
          const planned = await cloudRequest({ type: 'prompt', prompt: `请把以下商品修图要求整理为简洁、可执行的中文生图计划，只输出计划正文：\n${editPrompt}` })
          const plan = planned.data?.choices?.[0]?.message?.content || editPrompt
          setJob({ id: 'cloud', status: 'awaiting_confirmation', plan })
        } else {
          const edited = await cloudRequest({ type: 'edit', model: 'gpt-image-2', prompt: `${job?.plan || ''}\n${editPrompt}`, images: [source, templateImage].filter(Boolean) })
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
    <div className={assistantOpen ? 'retouch-layout' : 'retouch-layout is-assistant-closed'}>
      <main className="canvas-area">
        <div className="section-tabs" role="tablist" aria-label="产品精修功能"><button className={retouchTab === 'one-click' ? 'primary-button' : 'secondary-button'} role="tab" aria-selected={retouchTab === 'one-click'} onClick={() => setRetouchTab('one-click')}>一键修图</button><button className={retouchTab === 'gallery' ? 'primary-button' : 'secondary-button'} role="tab" aria-selected={retouchTab === 'gallery'} onClick={() => setRetouchTab('gallery')}>图库</button></div>
        {retouchTab === 'gallery' && <div className="gallery-scope-note">产品精修图库 · 仅显示 retouch 资产与精修结果</div>}
        <div className="canvas-toolbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto' }}><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('single')}><Upload size={16} />添加图片</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy} onClick={() => openAssetPicker('batch')}><Layers3 size={16} />批量修图</button><button className="secondary-button" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} disabled={busy || job?.status === 'awaiting_confirmation'} aria-expanded={templatesOpen} onClick={() => setTemplatesOpen(value => !value)}><Sparkles size={16} />修图模版</button></div><Layers3 size={17} /></div>
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
        <div className="retouch-feedback" role="status" aria-live="polite">{busy && <LoaderCircle size={15} className="spin-icon" />}{image ? status : cloudMode ? '上传产品照片，云端精修将通过 TokenSpace 处理' : '上传产品照片，在精修助手中编辑要求'}{job?.status === 'done' && ' · 结果已更新到下方卡片'}</div>
        {(error || job?.error) && <p className="retouch-error" role="alert">{error || job.error}</p>}
        <section ref={galleryRef} className="photo-grid live-photo-grid" tabIndex={0} title="滚轮上下滚动 · Shift + 滚轮左右滚动" aria-label="产品精修图片与结果，可上下左右滚动">
          <button className="upload-card" disabled={busy} onClick={() => openAssetPicker('single')}><span><ImagePlus size={24} /></span><strong>从云端资产库选择产品照片</strong><small>选择已整理的咖啡店或茶馆场景素材</small></button>
          {image && !job?.results?.length && !cloudResult && <article className="photo-card"><div className="real-photo"><img src={image} alt="待精修原图" /><span className="photo-badge">原图</span></div><div className="photo-info"><span><strong>产品原图</strong><small>{status}</small></span><button aria-label="编辑精修要求" onClick={() => setAssistantOpen(true)}><Sparkles size={17} /></button></div></article>}
          {cloudResult && <article className="photo-card result-card"><div className="real-photo"><img src={cloudResult} alt="云端精修结果" /><span className="photo-badge">精修完成</span></div><div className="photo-info"><span><strong>精修结果</strong><a href={cloudResult} download="sanhua-retouched.png">下载图片</a></span><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(cloudResult); setCloudResult(''); setJob(null); setAssistantOpen(true) }}><ArrowUpRight size={17} /></button></div></article>}
          {job?.results?.map(name => { const url = `/api/retouch/${job.id}/output/${encodeURIComponent(name)}`; return <article className="photo-card result-card" key={name}><div className="real-photo"><img src={url} alt="精修结果" /><span className="photo-badge">精修完成</span></div><div className="photo-info"><span><strong>精修结果</strong><a href={url} download={name}>下载原尺寸图片</a></span><button aria-label="继续编辑此结果" disabled={busy} onClick={() => { setImage(url); setJob(null); setAssistantOpen(true); localStorage.removeItem('retouch-job') }}><ArrowUpRight size={17} /></button></div></article> })}
          {['冰美式', '暮色特调', '桂花拿铁', '山茶气泡饮'].map((name, index) => <article className="photo-card" key={name}><div className={`photo-visual photo-visual--${['amber','rose','cream','green'][index]}`} role="img" aria-label={`${name}案例图片`}><span className="photo-badge">案例参考</span></div><div className="photo-info"><span><strong>{name}</strong><small>咖啡店商品摄影 · 精修案例</small></span></div></article>)}
        </section>
      </main>
      <aside className={assistantOpen ? 'assistant-panel' : 'assistant-panel is-collapsed'}>
        <div className="assistant-title"><span className="assistant-avatar"><Sparkles size={18} /></span><span><strong>精修助手</strong><small><i />{busy ? status : '已就绪'}</small></span><button className="assistant-toggle" aria-label={assistantOpen ? '收起精修助手' : '展开精修助手'} aria-expanded={assistantOpen} onClick={() => setAssistantOpen(value => !value)}>{assistantOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}</button></div>
        <div className="assistant-body live-controls" hidden={!assistantOpen}>
        <div className="assistant-message"><p>告诉我你希望调整的光线、场景和商品细节。确认计划后开始精修，结果会显示在左侧。</p></div>
        <fieldset disabled={busy || job?.status === 'awaiting_confirmation'}>
          <label>尺寸与比例<input value={size} onChange={e => setSize(e.target.value)} /></label>
          <label>场景<input value={scene} onChange={e => setScene(e.target.value)} /></label>
          <label>装饰<input value={decor} onChange={e => setDecor(e.target.value)} /></label>
          <label>精修要求<textarea value={requirements} onChange={e => setRequirements(e.target.value)} /></label>
        </fieldset>
        {job?.plan && <div className="live-plan"><h3>生图计划</h3><p>{job.plan}</p></div>}
        {job?.note && <details><summary>查看精修说明</summary><p>{job.note}</p></details>}
        </div>
        <div className="assistant-footer live-controls" hidden={!assistantOpen}>
        {job?.status === 'awaiting_confirmation' ? <><button className="primary-button" disabled={busy} onClick={() => submit(true)}>确认计划并开始精修</button><button className="secondary-button" onClick={() => { setJob(null); localStorage.removeItem('retouch-job') }}>修改要求</button></> : <button className="primary-button" disabled={!image || busy || !requirements.trim()} onClick={() => submit()}>生成精修计划</button>}
        <small>{cloudMode ? '图片将通过 Cloudflare 服务端发送至 TokenSpace；密钥不会进入浏览器。' : '图片保存在本机任务目录。按管理设置使用 Codex 或中转 API，确认计划后才编辑图片。'}</small>
        </div>
      </aside>
    </div>
  </section>
}
