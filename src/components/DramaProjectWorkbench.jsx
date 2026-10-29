import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Download, Film, ImagePlus, LoaderCircle, Plus, RefreshCw, Upload, X } from 'lucide-react'
import ImageViewer from './ImageViewer'

const stageNames = ['项目需求', '剧本与分镜', '视频生成']
const stageKeys = ['requirements', 'script_storyboard', 'video']
const assetGroups = [['scene', '场景'], ['character', '人物'], ['prop', '道具']]
const assetField = { scene: 'sceneAssetIds', character: 'characterAssetIds', prop: 'propAssetIds' }
const allAssetIds = project => [...(project.sceneAssetIds || []), ...(project.characterAssetIds || []), ...(project.propAssetIds || [])]
const taskLabel = task => task?.status === 'completed' ? '已生成' : task?.status === 'failed' ? '生成失败' : task?.status === 'running' || task?.status === 'queued' ? `生成中 ${task.progress || 15}%` : '未生成'
const request = async (url, options = {}) => {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const failure = new Error(data.hint || data.missing?.join('、') || data.error || '请求失败')
    failure.project = data.project
    throw failure
  }
  return data
}
const jsonOptions = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const fullPrompt = shot => [shot?.prompt, shot?.action && `动作：${shot.action}`, shot?.camera && `运镜：${shot.camera}`, shot?.dialogue && `台词：${shot.dialogue}`, shot?.sound && `声音：${shot.sound}`, shot?.negative && `负向约束：${shot.negative}`].filter(Boolean).join('\n')

export default function DramaProjectWorkbench({ initialRoute = 'create', incomingContext, onIncomingContextConsumed, onNavigate }) {
  const [view, setView] = useState(initialRoute === 'library' ? 'library' : initialRoute === 'versions' ? 'records' : 'project')
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const projectRef = useRef(null)
  const saveQueue = useRef(Promise.resolve())
  const [stageView, setStageView] = useState('requirements')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [clearedBrief, setClearedBrief] = useState('')
  const [saveState, setSaveState] = useState('已自动保存')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [assets, setAssets] = useState([])
  const [assetPicker, setAssetPicker] = useState('')
  const [replaceAsset, setReplaceAsset] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer] = useState(null)
  const [selectedShotId, setSelectedShotId] = useState('')
  const [selectedShotIds, setSelectedShotIds] = useState([])
  const [shotDraft, setShotDraft] = useState(null)
  const [scriptDraft, setScriptDraft] = useState('')
  const [videoTasks, setVideoTasks] = useState([])
  const [selectedVideoTaskId, setSelectedVideoTaskId] = useState('')
  const [playing, setPlaying] = useState(null)
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [resolution, setResolution] = useState('720p')
  const [duration, setDuration] = useState(8)
  const [records, setRecords] = useState([])
  const [versions, setVersions] = useState([])
  const [videoModel, setVideoModel] = useState('读取中…')
  const [recordFilter, setRecordFilter] = useState('all')
  const importRef = useRef(null)
  const scriptAreaRef = useRef(null)

  const showProject = next => {
    projectRef.current = next
    setProject(next)
    setTitle(next.title || '')
    setBrief(next.brief || '')
    setStageView(next.stage === 'completed' ? 'video' : next.stage || 'requirements')
    setScriptDraft(next.script?.content || '')
    const first = next.shots?.[0]
    setSelectedShotId(current => next.shots?.some(shot => shot.shotId === current) ? current : first?.shotId || '')
    setShotDraft(next.shots?.find(shot => shot.shotId === selectedShotId) || first || null)
    setProjects(current => [next, ...current.filter(item => item.projectId !== next.projectId)])
    setView('project')
  }
  const loadProjects = async () => {
    const data = await request('/api/v1/drama-projects')
    setProjects(data.projects || [])
    return data.projects || []
  }
  const openProject = async id => {
    setSaveState('正在恢复上次工作')
    const data = await request(`/api/v1/drama-projects/${encodeURIComponent(id)}`)
    showProject(data.project)
    setSaveState('已自动保存')
  }
  useEffect(() => {
    let active = true
    loadProjects().then(async items => {
      if (!active) return
      const resumeId = incomingContext?.draftRecord?.draftData?.dramaProjectId || incomingContext?.dramaProjectId
      if (resumeId) await openProject(resumeId)
      else if (incomingContext?.asset?.id || incomingContext?.record?.content) {
        const base = items[0] || (await request('/api/v1/drama-projects', jsonOptions('POST', { title: '未命名短剧项目' }))).project
        if (base) {
          await openProject(base.projectId)
          const patch = {}
          if (incomingContext.asset?.id) patch[assetField[incomingContext.asset.videoAssetType] || 'sceneAssetIds'] = [incomingContext.asset.id]
          if (incomingContext.record?.content) patch.brief = incomingContext.record.content
          await save(patch)
          if (patch.brief) setBrief(patch.brief)
          onIncomingContextConsumed?.()
        }
      }
      else if (initialRoute === 'video' && items[0]) await openProject(items[0].projectId)
      else if (initialRoute === 'library') setView('library')
      else if (initialRoute === 'versions' && items[0]) { await openProject(items[0].projectId); setView('records') }
      else if (items[0]) await openProject(items[0].projectId)
    }).catch(reason => active && setError(reason.message))
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!incomingContext?.draftRecord?.draftData?.dramaProjectId) return
    void openProject(incomingContext.draftRecord.draftData.dramaProjectId).then(() => onIncomingContextConsumed?.()).catch(reason => setError(reason.message))
  }, [incomingContext?.createdAt])
  useEffect(() => {
    if (initialRoute === 'library') setView('library')
    else if (initialRoute === 'versions') setView('records')
    else if (initialRoute === 'video' && projectRef.current) { setView('project'); setStageView(projectRef.current.stage === 'requirements' ? 'requirements' : 'video') }
  }, [initialRoute])
  useEffect(() => {
    if (!project?.projectId || (view !== 'project' && view !== 'records')) return
    if (stageView !== 'video' && view !== 'records') return
    let active = true
    const load = async () => {
      try {
        const data = await request(`/api/v1/drama-projects/${project.projectId}/video-tasks`)
        if (active) {
          setVideoTasks(data.tasks || [])
          if (data.project && data.project.version !== projectRef.current?.version) { projectRef.current = data.project; setProject(data.project) }
        }
      } catch (reason) { if (active) setError(reason.message) }
    }
    void load()
    const interval = window.setInterval(load, 8000)
    return () => { active = false; window.clearInterval(interval) }
  }, [project?.projectId, stageView, view])
  useEffect(() => {
    if (view !== 'records' || !project?.projectId) return
    request(`/api/v1/drama-projects/${project.projectId}/text-records`).then(data => setRecords(data.records || [])).catch(reason => setError(reason.message))
  }, [view, project?.projectId])
  useEffect(() => {
    if (view !== 'project' || !project?.projectId) return
    if (title === project.title && brief === project.brief) return
    setSaveState('正在保存…')
    const timer = window.setTimeout(() => { void saveFields() }, 700)
    return () => window.clearTimeout(timer)
  }, [title, brief, project?.projectId])
  useEffect(() => {
    const ids = [...(project?.sceneAssetIds || []), ...(project?.characterAssetIds || []), ...(project?.propAssetIds || [])]
    if (!ids.length) return
    let active = true
    Promise.all(ids.filter(id => !assets.some(asset => asset.id === id)).map(id => request(`/api/v1/assets/${encodeURIComponent(id)}`).then(data => data.asset).catch(() => null))).then(found => {
      if (active) setAssets(current => [...current, ...found.filter(asset => asset && !current.some(item => item.id === asset.id))])
    })
    return () => { active = false }
  }, [project?.sceneAssetIds?.join(','), project?.characterAssetIds?.join(','), project?.propAssetIds?.join(',')])
  useEffect(() => {
    const shot = project?.shots?.find(item => item.shotId === selectedShotId)
    setShotDraft(shot ? { ...shot } : null)
    if (shot) setDuration(shot.durationSeconds || 8)
  }, [selectedShotId, project?.projectId])
  useEffect(() => {
    if (!project?.projectId || !project.scriptId || view !== 'project' || stageView !== 'script_storyboard') return
    if (scriptDraft === project.script?.content) return
    setSaveState('正在保存…')
    const timer = window.setTimeout(() => void saveScript().catch(reason => setError(reason.message)), 900)
    return () => window.clearTimeout(timer)
  }, [scriptDraft, project?.projectId, project?.script?.content, view, stageView])
  useEffect(() => {
    if (!project?.projectId || !selectedShotId || !shotDraft || view !== 'project') return
    const current = project.shots?.find(item => item.shotId === selectedShotId)
    if (!current || ['prompt', 'action', 'camera', 'dialogue', 'sound', 'negative', 'durationSeconds'].every(field => current[field] === shotDraft[field])) return
    setSaveState('正在保存…')
    const timer = window.setTimeout(() => void saveShot().catch(reason => setError(reason.message)), 900)
    return () => window.clearTimeout(timer)
  }, [shotDraft, selectedShotId, project?.projectId, project?.shots, view])
  useEffect(() => {
    request('/api/v1/me/video-provider-connection').then(data => setVideoModel(data.connection?.model || '尚未配置')).catch(() => setVideoModel('连接状态不可用'))
  }, [])
  useEffect(() => {
    if (!project?.scriptId || view !== 'project' || stageView !== 'script_storyboard') return
    request(`/api/v1/drama-projects/${project.projectId}/versions`).then(data => setVersions(data.versions || [])).catch(() => {})
  }, [project?.projectId, project?.scriptVersionId, view, stageView])

  const save = patch => {
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      const current = projectRef.current
      if (!current) return null
      setSaveState('正在保存…')
      let data
      try { data = await request(`/api/v1/drama-projects/${current.projectId}`, jsonOptions('PATCH', { ...patch, expectedVersion: current.version })) }
      catch (reason) {
        if (reason.message !== 'VERSION_CONFLICT') { setSaveState('保存失败，重试'); throw reason }
        const fresh = await request(`/api/v1/drama-projects/${current.projectId}`)
        data = await request(`/api/v1/drama-projects/${current.projectId}`, jsonOptions('PATCH', { ...patch, expectedVersion: fresh.project.version }))
      }
      projectRef.current = data.project
      setProject(data.project)
      setSaveState('已自动保存')
      return data.project
    })
    return saveQueue.current
  }
  const saveFields = async () => {
    const current = projectRef.current
    if (!current || (current.title === title && current.brief === brief)) return current
    try { return await save({ title, brief }) } catch (reason) { setError(reason.message); return null }
  }
  const createProject = async () => {
    if (project && (title !== project.title || brief !== project.brief)) await saveFields()
    setBusy('create'); setError('')
    try {
      const data = await request('/api/v1/drama-projects', jsonOptions('POST', { title: '未命名短剧项目' }))
      showProject(data.project)
      setNotice('新项目已建立，填写需求即可开始。')
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const mutate = async (path, body = {}) => {
    const current = projectRef.current
    try {
      const data = await request(`/api/v1/drama-projects/${current.projectId}/${path}`, jsonOptions('POST', body))
      if (data.project) showProject(data.project)
      return data
    } catch (reason) {
      if (reason.project) showProject(reason.project)
      throw reason
    }
  }
  const generate = async () => {
    if (!brief.trim()) { setError('请先填写短剧创作需求'); return }
    setBusy('generate'); setError('')
    try {
      await saveFields()
      const data = await mutate('generate-script-storyboard')
      setNotice(data.idempotent ? '已恢复上次生成的剧本与分镜。' : '剧本与分镜已一起生成，并自动保存到文本库。')
    } catch (reason) { setError(reason.message); await openProject(projectRef.current.projectId) } finally { setBusy('') }
  }
  const confirm = async () => {
    setBusy('confirm'); setError('')
    try {
      await saveScript()
      await saveShot()
      await mutate('confirm-script-storyboard')
      setNotice('剧本与分镜已确认，已进入视频生成。')
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const saveScript = async () => {
    if (!projectRef.current?.script || scriptDraft === projectRef.current.script.content) return
    const data = await request(`/api/v1/drama-projects/${projectRef.current.projectId}/script`, jsonOptions('PATCH', { content: scriptDraft }))
    projectRef.current = data.project; setProject(data.project); setSaveState('已自动保存')
  }
  const saveShot = async () => {
    const current = projectRef.current?.shots?.find(item => item.shotId === selectedShotId)
    if (!current || !shotDraft) return
    const fields = ['prompt', 'action', 'camera', 'dialogue', 'sound', 'negative', 'durationSeconds']
    if (fields.every(field => current[field] === shotDraft[field])) return
    const data = await request(`/api/v1/drama-projects/${projectRef.current.projectId}/shots/${selectedShotId}`, jsonOptions('PATCH', Object.fromEntries(fields.map(field => [field, shotDraft[field]]))))
    projectRef.current = data.project; setProject(data.project); setSaveState('已自动保存')
  }
  const selectShot = async shotId => {
    try {
      await saveShot()
      setSelectedShotId(shotId)
    } catch (reason) { setError(reason.message) }
  }
  const restoreScript = async versionId => {
    if (!window.confirm('恢复这个剧本版本？当前版本会保留在历史中。')) return
    setBusy('restore'); setError('')
    try {
      const data = await mutate('restore-version', { versionId })
      setScriptDraft(data.project.script?.content || '')
      setStageView('script_storyboard')
      setNotice('剧本版本已恢复。')
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const discardVideo = async task => {
    if (!window.confirm('删除这个待选结果？已归档的视频不会受到影响。')) return
    setBusy('discard'); setError('')
    try {
      await mutate(`video-tasks/${task.id}/discard`)
      setVideoTasks(current => current.filter(item => item.id !== task.id))
      setNotice('待选结果已移除。')
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const regenerate = async targetType => {
    const label = targetType === 'shot' ? `镜头 ${shotDraft?.shotNumber}` : '剧本正文'
    const area = scriptAreaRef.current
    let target = {}
    if (targetType === 'script') {
      const start = area?.selectionStart || 0
      const end = area?.selectionEnd || start
      const from = end > start ? start : scriptDraft.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const to = end > start ? end : (scriptDraft.indexOf('\n', start) < 0 ? scriptDraft.length : scriptDraft.indexOf('\n', start))
      target = { targetStart: from, targetText: scriptDraft.slice(from, to) }
      if (!target.targetText.trim()) { setError('请在剧本中选中或定位到需要重新生成的段落。'); return }
    }
    if (!window.confirm(`只重新生成当前${targetType === 'script' ? '段落' : label}，其他内容会保留。继续吗？`)) return
    setBusy(`regen-${targetType}`); setError('')
    try {
      await saveScript()
      const data = await mutate('regenerate-section', { targetType, targetId: targetType === 'shot' ? selectedShotId : projectRef.current.scriptId, scope: 'current', ...target })
      if (targetType === 'script') setScriptDraft(data.project.script?.content || '')
      setStageView('script_storyboard')
      setNotice(`当前${targetType === 'script' ? '段落' : label}已更新，其他内容未更改。`)
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const submitVideos = async (mode, shotIds = [], regenerate = false) => {
    setBusy('video'); setError('')
    try {
      await saveShot()
      const data = await mutate('video-tasks', { mode, shotIds, aspectRatio, resolution, durationSeconds: duration, regenerate })
      setVideoTasks(current => [...data.tasks, ...current.filter(item => !data.tasks.some(next => next.id === item.id))])
      if (data.errors?.length) setError(data.errors.map(item => `镜头 ${projectRef.current.shots.find(shot => shot.shotId === item.shotId)?.shotNumber || ''}：${item.missing?.join('、') || item.error}`).join('；'))
      setNotice(`已提交 ${data.tasks.length} 个镜头，进度会在此处和任务中心更新。`)
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const acceptVideo = async task => {
    setBusy(`accept-${task.id}`); setError('')
    try {
      const data = await mutate(`video-assets/${task.id}/accept`, { name: window.prompt('视频保存名称（可留空使用默认名称）', '') || '' })
      setVideoTasks(current => current.map(item => item.id === task.id ? { ...item, videoAssetId: data.assetId } : item))
      setNotice('视频已接受并归档到视频库。')
    } catch (reason) { setError(reason.message) } finally { setBusy('') }
  }
  const loadAssets = async (type, replace = false) => {
    setAssetPicker(type); setReplaceAsset(replace)
    try { const data = await request(`/api/v1/assets?workspace=script&assetType=image&videoAssetType=${type}&limit=40`); setAssets(current => [...(data.assets || []), ...current.filter(item => !(data.assets || []).some(next => next.id === item.id))]) }
    catch (reason) { setError(reason.message) }
  }
  const chooseAsset = async (type, asset) => {
    const field = assetField[type]
    try {
      const existing = projectRef.current?.[field] || []
      const next = asset ? replaceAsset ? [asset.id] : [...new Set([...existing, asset.id])] : []
      if (allAssetIds({ ...projectRef.current, [field]: next }).length > 9) throw new Error('视频模型最多接收 9 张参考图片，请先移除其他素材。')
      await save({ [field]: next })
      setAssetPicker('')
    } catch (reason) { setError(reason.message) }
  }
  const uploadAssets = async (type, files) => {
    setUploading(true); setError('')
    try {
      const uploaded = []
      for (const file of files) {
        const form = new FormData()
        form.append('file', file); form.append('libraryKey', 'script'); form.append('folderKey', type); form.append('projectId', project.projectId); form.append('uploadId', crypto.randomUUID())
        const data = await request('/api/v1/assets/upload', { method: 'POST', body: form })
        uploaded.push(data.asset)
      }
      const field = assetField[type]
      const current = replaceAsset ? [] : projectRef.current?.[field] || []
      const next = [...new Set([...current, ...uploaded.map(asset => asset.id)])]
      if (allAssetIds({ ...projectRef.current, [field]: next }).length > 9) throw new Error('图片已上传到素材库，但视频模型最多接收 9 张参考图片。请选择其中 9 张。')
      await save({ [field]: next })
      setAssets(existing => [...uploaded, ...existing.filter(asset => !uploaded.some(item => item.id === asset.id))])
      setAssetPicker('')
      setNotice(`已上传 ${files.length} 张素材。`)
    } catch (reason) { setError(reason.message) } finally { setUploading(false) }
  }
  const importText = event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024 || !/\.(txt|md)$/i.test(file.name)) { setError('仅支持 2MB 内的 TXT 或 Markdown 文件'); return }
    file.text().then(setBrief).catch(() => setError('文件读取失败'))
  }
  const selectedShot = project?.shots?.find(item => item.shotId === selectedShotId) || project?.shots?.[0]
  const shotTasks = [...(selectedShot?.videoTaskIds || [])].reverse().map(id => videoTasks.find(item => item.id === id)).filter(Boolean)
  const selectedTask = shotTasks.find(item => item.id === selectedVideoTaskId) || shotTasks[0]
  const tabs = [['project', '项目工作台'], ['library', '剧本库'], ['records', '文本记录']]

  return <div className="drama-page">
    <header className="drama-header"><div><small>创作工作台 / 短剧脚本</small><h1>短剧项目工作台</h1><p>从一个项目完成需求、剧本分镜和镜头视频。</p></div><div className="drama-header-actions"><button className="secondary-button" onClick={() => onNavigate?.('script', 'legacy')}>历史剧本入口</button><button className="primary-button" disabled={busy === 'create'} onClick={createProject}><Plus size={16} />新建短剧项目</button></div></header>
    <nav className="drama-tabs" aria-label="短剧页面">{tabs.map(([key, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => { void saveScript().then(saveShot).catch(reason => setError(reason.message)); setView(key) }}>{label}</button>)}</nav>
    {error && <div className="drama-alert" role="alert">{error}<button onClick={() => setError('')} aria-label="关闭错误"><X size={15} /></button></div>}
    {notice && <div className="drama-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="关闭提示"><X size={15} /></button></div>}
    {view === 'library' && <section className="drama-library"><div className="drama-section-heading"><div><h2>短剧项目</h2><p>每个项目保留剧本、分镜、镜头视频与工作进度。</p></div><span>{projects.length} 个项目</span></div><div className="drama-project-grid">{projects.map(item => <article key={item.projectId} className="drama-project-card"><small>{stageNames[stageKeys.indexOf(item.stage)] || '已完成'} · {item.status === 'generating' ? '生成中' : item.status === 'failed' ? '需要处理' : '已保存'}</small><h3>{item.title}</h3><p>{item.script?.summary || item.brief || '尚未填写创作需求'}</p><div><span>剧本 {item.scriptId ? '✓' : '—'}</span><span>分镜 {item.shots?.length || 0} 镜头</span><span>视频 {item.shots?.filter(shot => shot.acceptedVideoTaskId).length || 0} 个</span><span>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span></div><button className="primary-button" onClick={() => void openProject(item.projectId)}>继续创作</button><button className="secondary-button" onClick={() => { void openProject(item.projectId).then(() => setStageView('script_storyboard')) }}>查看剧本与分镜</button>{item.videoTaskIds?.length > 0 && <button className="secondary-button" onClick={() => { void openProject(item.projectId).then(() => setStageView('video')) }}>查看视频</button>}</article>)}</div>{!projects.length && <p className="drama-empty">还没有短剧项目。点击右上角“新建短剧项目”开始。</p>}</section>}
    {view === 'records' && <section className="drama-library"><div className="drama-section-heading"><div><h2>项目资料</h2><p>剧本、分镜和视频提示词自动记录来源。</p></div><select value={recordFilter} onChange={event => setRecordFilter(event.target.value)} aria-label="筛选文本类型"><option value="all">全部类型</option><option value="script">剧本</option><option value="storyboard_prompt">分镜提示词</option><option value="video_prompt">视频提示词</option></select></div>{!project && <p className="drama-empty">先在剧本库打开一个项目。</p>}{project && <div className="drama-records">{records.filter(item => recordFilter === 'all' || item.recordType === recordFilter).map(item => <article key={item.id}><small>{item.recordType} · {project.title} · {item.shotId ? `镜头 ${project.shots?.find(shot => shot.shotId === item.shotId)?.shotNumber || ''}` : '全项目'}</small><h3>{item.title}</h3><details><summary>查看全文</summary><pre>{item.content}</pre></details><button className="secondary-button" onClick={() => { setView('project'); setStageView(item.shotId ? 'video' : 'script_storyboard'); if (item.shotId) setSelectedShotId(item.shotId) }}>返回项目</button><button className="secondary-button" onClick={() => { setBrief(item.content); setView('project'); setStageView('requirements') }}>复用到项目需求</button><button className="secondary-button" onClick={() => { if (!navigator.clipboard?.writeText) { setError('浏览器不支持复制'); return } void navigator.clipboard.writeText(item.content).then(() => setNotice('已复制文本记录。')).catch(() => setError('复制失败')) }}>复制</button></article>)}{!records.length && <p className="drama-empty">该项目暂无文本记录。</p>}</div>}</section>}
    {view === 'project' && !project && <div className="drama-empty"><h2>开始制作短剧</h2><p>新建项目后，可在同一工作台生成剧本、分镜与视频。</p><button className="primary-button" onClick={createProject}>新建短剧项目</button></div>}
    {view === 'project' && project && <>
      <section className="drama-project-bar"><div><input aria-label="项目名称" value={title} onChange={event => setTitle(event.target.value)} onBlur={() => void saveFields()} maxLength={120} /><small>{project.status === 'generating' ? '生成中' : project.status === 'failed' ? '需要处理' : '编辑中'} · {saveState}</small></div><div className="drama-header-actions"><button className="secondary-button" onClick={() => window.dispatchEvent(new Event('sanhua:open-task-progress'))}>任务中心</button><button className="secondary-button" onClick={() => setView('library')}><ChevronLeft size={15} />返回项目列表</button></div></section>
      <nav className="drama-steps" aria-label="短剧制作阶段">{stageKeys.map((key, index) => { const reached = (project.stage === 'completed' ? 2 : stageKeys.indexOf(project.stage)) >= index; return <button key={key} className={`${stageView === key ? 'active' : ''} ${reached ? 'reached' : ''}`} disabled={!reached} onClick={() => setStageView(key)}><span>{reached && index < stageKeys.indexOf(project.stage) ? <Check size={15} /> : index + 1}</span>{stageNames[index]}</button> })}</nav>
      {stageView === 'requirements' && <section className="drama-requirements"><div className="drama-section-heading"><div><small>阶段一 · 项目需求</small><h2>告诉系统这部短剧要拍什么</h2><p>素材可以稍后补充，不影响生成剧本与分镜。</p></div><span>{brief.length} 字</span></div><textarea aria-label="短剧创作需求" value={brief} onChange={event => setBrief(event.target.value)} onBlur={() => void saveFields()} placeholder="描述人物、故事冲突、场景、时长和想要的情绪…" /><div className="drama-asset-strip">{assetGroups.map(([type, label]) => { const id = project[assetField[type]]?.[0]; const asset = assets.find(item => item.id === id); return <div key={type} className="drama-asset-pill"><b>{label}</b>{id ? <><span>{asset?.name || `已选素材 ${id.slice(0, 8)}`}{project[assetField[type]].length > 1 ? ` 等 ${project[assetField[type]].length} 张` : ''}</span><button onClick={() => void chooseAsset(type, null)}>移除</button></> : <span>可选</span>}<button onClick={() => void loadAssets(type, Boolean(id))}>{id ? '替换' : '选择'}</button></div> })}</div><div className="drama-inspiration">{['加入人物冲突', '加入反转', '绑定真实茶馆空间', '强化开场钩子', '控制在 3 分钟内'].map(item => <button key={item} onClick={() => setBrief(current => `${current}${current.trim() ? '\n' : ''}${item}`)}>{item}</button>)}</div><div className="drama-main-actions"><input ref={importRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={importText} /><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload size={15} />导入 TXT / Markdown</button><button className="secondary-button" onClick={() => onNavigate?.('assets', 'text')}>从文本库复用</button><button className="secondary-button" onClick={() => { setClearedBrief(brief); setBrief('') }}>清空需求</button>{clearedBrief && <button className="secondary-button" onClick={() => { setBrief(clearedBrief); setClearedBrief('') }}>恢复清空前内容</button>}<button className="primary-button" disabled={Boolean(busy) || !brief.trim()} onClick={generate}>{busy === 'generate' && <LoaderCircle size={15} className="spin-icon" />}一键生成剧本与分镜</button></div></section>}
      {stageView === 'script_storyboard' && <section className="drama-edit-layout"><aside className="drama-shot-nav"><h2>剧本结构</h2><button className={!selectedShotId ? 'selected' : ''} onClick={() => void selectShot('')}>剧情摘要与正文</button><p>{project.script?.summary}</p><h3>镜头 · {project.shots?.length || 0}</h3>{project.shots?.map(shot => <button key={shot.shotId} className={selectedShotId === shot.shotId ? 'selected' : ''} onClick={() => void selectShot(shot.shotId)}><strong>镜头 {shot.shotNumber}</strong><small>{shot.scene || '未指定场景'} · {shot.durationSeconds} 秒</small></button>)}</aside><div className="drama-editor"><div className="drama-section-heading"><div><small>阶段二 · 剧本与分镜</small><h2>同页查看和局部修改</h2></div><span>版本 {project.script?.version || 1}</span></div><label>剧情摘要<p>{project.script?.summary}</p></label><label>剧本正文<textarea ref={scriptAreaRef} aria-label="剧本正文" value={scriptDraft} onChange={event => setScriptDraft(event.target.value)} /></label><div className="drama-inline-actions"><button className="secondary-button" onClick={() => void saveScript()}>立即保存</button><label>历史版本<select aria-label="恢复剧本版本" value="" onChange={event => { if (event.target.value) void restoreScript(event.target.value) }}><option value="">选择版本恢复</option>{versions.map(item => <option key={item.id || item.versionId} value={item.id || item.versionId}>版本 {item.versionNo || item.version} · {new Date(item.savedAt || item.createdAt).toLocaleString('zh-CN')}</option>)}</select></label><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void regenerate('script')}>重新生成当前段落</button></div>{selectedShot && shotDraft && <div className="drama-shot-editor"><h3>镜头 {selectedShot.shotNumber} · {selectedShot.scene || '场景待定'}</h3>{[['prompt', '画面提示词'], ['action', '人物动作'], ['camera', '摄影与运镜'], ['dialogue', '台词'], ['sound', '声音'], ['negative', '负向约束']].map(([field, label]) => <label key={field}>{label}<textarea value={shotDraft[field] || ''} onChange={event => setShotDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}<div className="drama-inline-actions"><button className="secondary-button" onClick={() => void saveShot()}>保存当前镜头</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void regenerate('shot')}>重新生成当前镜头</button></div></div>}<div className="drama-main-actions"><button className="primary-button" disabled={Boolean(busy)} onClick={confirm}>确认剧本与分镜，进入视频生成</button></div></div></section>}
      {stageView === 'video' && <section className="drama-video-layout"><aside className="drama-shot-nav"><h2>镜头列表</h2><div className="drama-inline-actions"><button onClick={() => setSelectedShotIds(project.shots.map(shot => shot.shotId))}>全选</button><button onClick={() => setSelectedShotIds(project.shots.filter(shot => shot.status === 'failed').map(shot => shot.shotId))}>只选失败</button><button onClick={() => setSelectedShotIds([])}>清空</button></div>{project.shots.map(shot => { const task = [...(shot.videoTaskIds || [])].reverse().map(id => videoTasks.find(item => item.id === id)).find(Boolean); return <div key={shot.shotId} className={`drama-shot-row ${selectedShotId === shot.shotId ? 'selected' : ''}`}><input type="checkbox" checked={selectedShotIds.includes(shot.shotId)} onChange={event => setSelectedShotIds(current => event.target.checked ? [...current, shot.shotId] : current.filter(id => id !== shot.shotId))} aria-label={`选择镜头 ${shot.shotNumber}`} /><button onClick={() => void selectShot(shot.shotId)}><strong>镜头 {shot.shotNumber}</strong><small>{shot.scene || '场景待定'} · {shot.durationSeconds} 秒</small><small>{shot.submissionError || shot.status === 'failed' ? '生成失败' : taskLabel(task)}</small></button></div> })}</aside><div className="drama-video-main"><div className="drama-section-heading"><div><small>阶段三 · 视频生成</small><h2>镜头 {selectedShot?.shotNumber || '—'}</h2></div></div>{selectedShot && <><label>自动带入的镜头提示词<textarea aria-label="当前镜头视频提示词" value={shotDraft?.prompt || ''} onChange={event => setShotDraft(current => ({ ...current, prompt: event.target.value }))} /></label><div className="drama-prompt-details"><p>{fullPrompt(shotDraft || selectedShot)}</p></div><div className="drama-inline-actions"><button className="secondary-button" onClick={() => void saveShot()}>保存提示词修改</button><button className="primary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('single', [selectedShotId])}>生成当前镜头</button></div></>}{shotTasks.length > 0 && <div className="drama-result-versions"><strong>结果版本</strong>{shotTasks.map((task, index) => <button key={task.id} className={selectedTask?.id === task.id ? 'active' : ''} onClick={() => setSelectedVideoTaskId(task.id)}>第 {shotTasks.length - index} 次 · {taskLabel(task)}{task.videoAssetId ? ' · 已归档' : ''}</button>)}</div>}{selectedTask && <div className="drama-video-result"><h3>当前镜头结果 · {taskLabel(selectedTask)}</h3>{selectedTask.providerVideoUrl && <><button className="secondary-button" onClick={() => setPlaying(selectedTask)}><Film size={15} />打开视频</button><a className="secondary-button" href={`/api/v1/video-tasks/${selectedTask.id}/download`} download><Download size={15} />下载</a><button className="primary-button" disabled={Boolean(selectedTask.videoAssetId) || Boolean(busy)} onClick={() => void acceptVideo(selectedTask)}>{selectedTask.videoAssetId ? '已归档' : '设为当前版本并归档'}</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('single', [selectedShotId], true)}>重新生成</button>{!selectedTask.videoAssetId && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => void discardVideo(selectedTask)}>删除待选结果</button>}</>}{selectedTask.status === 'failed' && <button className="secondary-button" onClick={() => void submitVideos('single', [selectedShotId], true)}>重试当前镜头</button>}</div>}</div><aside className="drama-video-settings"><h2>生成设置</h2><p>视频模型：{videoModel}</p><label>画幅<select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label><label>清晰度<select value={resolution} onChange={event => setResolution(event.target.value)}><option>720p</option><option>1080p</option><option>480p</option></select></label><label>时长（秒）<input type="number" min="4" max="15" value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><p>参考素材：{projectAssetsText(project)}</p><button className="secondary-button" onClick={() => void loadAssets('scene')}>补充场景素材</button><div className="drama-video-submit"><button className="primary-button" disabled={Boolean(busy) || !selectedShotIds.length} onClick={() => void submitVideos('selected', selectedShotIds)}>生成选中镜头 ({selectedShotIds.length})</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('all')}>生成全部镜头</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('failed', [], true)}>只重试失败镜头</button></div></aside></section>}
    </>}
    {assetPicker && <div className="drama-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setAssetPicker('') }}><section className="drama-drawer" role="dialog" aria-modal="true" aria-label="选择短剧素材"><header><div><h2>选择{assetGroups.find(item => item[0] === assetPicker)?.[1]}素材</h2><small>从云端短剧库选择，或本地上传图片</small></div><button onClick={() => setAssetPicker('')} aria-label="关闭"><X size={18} /></button></header><label className="secondary-button"><ImagePlus size={15} />{uploading ? '正在上传…' : '从本地上传'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={event => { const files = [...(event.target.files || [])]; event.target.value = ''; if (files.length) void uploadAssets(assetPicker, files) }} /></label><div className="drama-asset-grid">{assets.filter(asset => (asset.videoAssetType || asset.folderKey) === assetPicker).map(asset => <article key={asset.id}><img src={asset.thumbnailUrl || asset.url} alt={asset.name} /><strong>{asset.name}</strong><small>{asset.folderKey || '短剧库'} · {asset.sourceModule || '云端资产'}</small><div><button onClick={() => setViewer(asset)}>查看</button><button className="primary-button" onClick={() => void chooseAsset(assetPicker, asset)}>选择</button></div></article>)}</div>{!assets.some(asset => (asset.videoAssetType || asset.folderKey) === assetPicker) && <p>当前类别没有素材，可以从本地上传。</p>}</section></div>}
    {viewer && <ImageViewer src={viewer.previewUrl || viewer.url} alt={viewer.name} onClose={() => setViewer(null)} />}
    {playing && <div className="drama-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setPlaying(null) }}><section className="drama-player" role="dialog" aria-modal="true" aria-label="播放短剧视频"><header><h2>镜头视频</h2><button onClick={() => setPlaying(null)} aria-label="关闭播放器"><X size={18} /></button></header><video controls playsInline src={playing.providerVideoUrl} /><a className="secondary-button" href={`/api/v1/video-tasks/${playing.id}/download`} download><Download size={15} />下载视频</a></section></div>}
  </div>
}

function projectAssetsText(project) { const count = (project.sceneAssetIds?.length || 0) + (project.characterAssetIds?.length || 0) + (project.propAssetIds?.length || 0); return count ? `已选 ${count} 项` : '尚未选择；视频生成前请补充场景图' }
