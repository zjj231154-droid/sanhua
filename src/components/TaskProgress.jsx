import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleHelp, LoaderCircle, RefreshCw, X } from 'lucide-react'

const activeStates = new Set(['draft', 'ready', 'queued', 'running', 'retrying', 'cancelling'])
const labels = { draft: '编辑中', ready: '待确认', queued: '排队中', running: '运行中', retrying: '重试中', cancelling: '正在取消', succeeded: '已完成', completed: '已完成', failed: '失败', cancelled: '已取消', archived: '已归档' }
const visiblePosition = position => { const bound = (value, size) => Number.isFinite(value) && value >= 12 && value <= size - 80 ? value : Math.max(12, Math.min(28, size - 80)); return { right: bound(position?.right, window.innerWidth), bottom: bound(position?.bottom, window.innerHeight) } }
const messages = { VERSION_CONFLICT: '任务状态已更新，请刷新后重试。', TASK_NOT_FOUND: '无法读取该工作记录，可能已切换工作区。', TASK_NOT_CANCELLABLE: '任务已经结束，不能取消。', TASK_NOT_RETRYABLE: '此记录不能重试。' }
async function api(path, body, signal) {
  const response = await fetch(`/api/v1/task-center${path}`, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.hint || messages[data.error] || data.error || '任务请求失败')
  return data
}
export default function TaskProgress({ onResume, onResult, scopeKey = 'default' }) {
  const [open, setOpen] = useState(false), [data, setData] = useState(null), [error, setError] = useState('')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [confirmation, setConfirmation] = useState(null)
  const [detail, setDetail] = useState(null), [notice, setNotice] = useState(''), [limit, setLimit] = useState(8)
  const trigger = useRef(null), panel = useRef(null), cancelDialog = useRef(null), controller = useRef(null), alive = useRef(true)
  const drag = useRef(null), suppressClick = useRef(false)
  const [position, setPosition] = useState(() => { try { return visiblePosition(JSON.parse(localStorage.getItem('sanhua-task-progress-position') || '{}')) } catch { return visiblePosition({}) } })
  useEffect(() => {
    const resize = () => setPosition(current => visiblePosition(current))
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const startDrag = event => { if (event.button !== 0) return; const box = trigger.current.getBoundingClientRect(); drag.current = { x: event.clientX, y: event.clientY, right: innerWidth - box.right, bottom: innerHeight - box.bottom } }
  const moveDrag = event => { const point = drag.current; if (!point || Math.abs(point.x - event.clientX) + Math.abs(point.y - event.clientY) < 5) return; suppressClick.current = true; setPosition({ right: Math.max(12, Math.min(innerWidth - 80, point.right + point.x - event.clientX)), bottom: Math.max(12, Math.min(innerHeight - 80, point.bottom + point.y - event.clientY)) }) }
  const endDrag = () => { drag.current = null; if (suppressClick.current) localStorage.setItem('sanhua-task-progress-position', JSON.stringify(position)) }
  const load = useCallback(async () => {
    controller.current?.abort()
    const requestController = new AbortController(); controller.current = requestController
    setLoading(true)
    try { const value = await api(`?active=true&recentCompleted=${limit}`, null, requestController.signal); if (!requestController.signal.aborted && alive.current) { setData(value); setError('') } }
    catch (reason) { if (!requestController.signal.aborted && alive.current) setError(`任务加载失败：${reason.message}`) }
    finally { if (!requestController.signal.aborted && alive.current) setLoading(false) }
  }, [scopeKey, limit])
  useEffect(() => {
    alive.current = true; setData(null); setDetail(null); setError(''); setNotice(''); setConfirmation(null); setOpen(false)
    void load()
    return () => { alive.current = false; controller.current?.abort() }
  }, [scopeKey])
  useEffect(() => {
    const delay = open || data?.summary?.runningCount ? 6000 : 30000
    const interval = setInterval(load, delay)
    return () => clearInterval(interval)
  }, [load, open, data?.summary?.runningCount])
  useEffect(() => { if (open) void load() }, [open, load])
  useEffect(() => {
    let timer
    const updated = () => { clearTimeout(timer); timer = setTimeout(load, 180) }
    const show = () => { setOpen(true); void load() }
    window.addEventListener('sanhua:tasks-updated', updated); window.addEventListener('sanhua:open-task-progress', show)
    return () => { clearTimeout(timer); window.removeEventListener('sanhua:tasks-updated', updated); window.removeEventListener('sanhua:open-task-progress', show) }
  }, [load])
  const close = () => { setOpen(false); trigger.current?.focus() }
  useEffect(() => {
    if (!open) return
    const outside = event => { if (!confirmation && !detail && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false) }
    const key = event => { if (event.key === 'Escape') { setConfirmation(null); setDetail(null); setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key) }
  }, [open, confirmation, detail])
  useEffect(() => { if (confirmation) cancelDialog.current?.focus() }, [confirmation])
  const fresh = async task => api(`/${encodeURIComponent(task.taskId || task.id)}`)
  const resume = async (task, retry = false) => {
    setBusy(task.id); setError('')
    try {
      let value = await fresh(task)
      if (value.item.status === 'cancelled' || value.item.status === 'archived') throw new Error('该任务已结束，请查看记录。')
      if (retry) value = await api(`/${task.id}/retry`, { expectedVersion: value.record?.version || value.item.version })
      await onResume?.({ ...value.item, ...(value.record || {}), taskSource: value.item.taskSource })
      setNotice(retry ? '已恢复原任务，请确认内容后重试。' : '已恢复上次工作'); close(); void load()
    } catch (reason) { setError(`无法恢复该工作记录：${reason.message} 可点击继续重试。`) }
    finally { if (alive.current) setBusy('') }
  }
  const cancel = async () => {
    const task = confirmation; setBusy(task.id); setError('')
    try {
      const value = await api(`/${task.id}/cancel`, { expectedVersion: task.version, reason: '用户从任务面板取消' })
      setConfirmation(null); setNotice(value.notice || value.item?.providerCancelResult?.notice || '任务已取消，工作记录已保留。'); await load()
    } catch (reason) { setError(`取消失败：${reason.message}`) }
    finally { if (alive.current) setBusy('') }
  }
  const viewRecord = async task => { setBusy(task.id); try { setDetail(await fresh(task)) } catch (reason) { setError(reason.message) } finally { setBusy('') } }
  const result = async (task, library = false) => {
    setBusy(task.id)
    try {
      const value = await fresh(task)
      if (library) { await onResult?.({ ...value.item, ...(task.resultAssetIds?.length === 0 ? { resultAssetIds: [] } : {}) }); close(); return }
      const texts = await Promise.all((value.item.resultTextRecordIds || []).map(async id => { const response = await fetch(`/api/v1/text-records/${encodeURIComponent(id)}`); if (!response.ok) throw new Error('关联文本无法读取'); return (await response.json()).record }))
      const assets = await Promise.all((value.item.resultAssetIds || []).map(async id => { const response = await fetch(`/api/v1/assets/${encodeURIComponent(id)}`); if (!response.ok) throw new Error('关联资产无法读取'); return (await response.json()).asset }))
      setDetail({ ...value, texts, assets: assets.length ? assets : value.item.providerVideoUrl ? [{ id: value.item.id, assetType: 'video', name: '视频结果', externalUrl: value.item.providerVideoUrl }] : [] })
    } catch (reason) { setError(`无法查看结果：${reason.message}`) } finally { setBusy('') }
  }
  const archive = async task => { setBusy(task.id); try { await api(`/${task.id}/archive`, {}); setNotice('工作记录已归档'); await load() } catch (reason) { setError(reason.message) } finally { setBusy('') } }
  const summary = data?.summary || {}, active = data?.active || [], recent = data?.recentCompleted || []
  const average = summary.averageProgress, count = summary.activeCount || 0
  const name = error ? '任务状态暂不可用，打开任务列表重试' : count ? `当前 ${count} 个任务，${average == null ? '进度未知' : `整体进度 ${average}%`}，打开任务列表` : recent.length ? '当前没有进行中任务，打开近期任务列表' : '当前空闲，打开任务列表'
  const card = task => {
    const ongoing = activeStates.has(task.status), known = task.progress != null && task.progressSource !== 'unknown'
    return <article className={`task-hub-card status-${task.status}`} key={task.id} aria-label={task.title || task.moduleName}>
      <div className="task-hub-card-title"><strong>{task.title || task.moduleName}</strong><span>{labels[task.status] || task.status}</span></div>
      <small>{task.moduleName} · 第 {task.currentStep || 1} 步 · {task.stage}</small>
      {ongoing && <><div className="task-hub-progress-label"><span>{known ? `${Math.round(task.progress)}%${task.progressSource === 'platform_estimate' ? '（阶段估算）' : ''}` : '处理中 · 等待服务响应'}</span></div><div className="task-hub-track"><i style={{ width: known ? `${task.progress}%` : '0%' }} /></div></>}
      {task.errorMessage && <p className="task-hub-error">{task.errorMessage}</p>}
      {task.providerCancelResult?.notice && <p>{task.providerCancelResult.notice}</p>}{task.lateResultNotice && <p>{task.lateResultNotice}</p>}
      <small>更新于 {new Date(task.updatedAt || Date.now()).toLocaleString('zh-CN')}</small>
      <div className="task-hub-actions">
        {ongoing && <><button disabled={Boolean(busy)} onClick={() => void resume(task)}>{busy === task.id ? '处理中…' : '继续'}</button><button disabled={Boolean(busy)} onClick={() => setConfirmation(task)}>取消</button></>}
        {task.status === 'failed' && <><button disabled={Boolean(busy)} onClick={() => void resume(task, true)}>重试</button><button disabled={Boolean(busy)} onClick={() => void resume(task)}>继续编辑</button></>}
        {['succeeded', 'completed'].includes(task.status) && <button disabled={Boolean(busy)} onClick={() => void result(task)}>查看结果</button>}
        {!ongoing && <><button disabled={Boolean(busy)} onClick={() => void viewRecord(task)}>查看记录</button><button disabled={Boolean(busy)} onClick={() => void archive(task)}>归档</button></>}
        {task.resultAssetIds?.length > 0 && <button disabled={Boolean(busy)} onClick={() => void result(task, true)}>进入资产库</button>}
        {task.resultTextRecordIds?.length > 0 && <button disabled={Boolean(busy)} onClick={() => void result({ ...task, resultAssetIds: [] }, true)}>进入文本库</button>}
      </div>
    </article>
  }
  return <>
    {createPortal(<button ref={trigger} style={position} onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={endDrag} className={`task-hub-ring ${summary.runningCount ? 'is-running' : 'is-editing'}`} aria-label={name} aria-expanded={open} aria-controls="task-hub-panel" onClick={() => { if (suppressClick.current) { suppressClick.current = false; return }; setOpen(value => !value) }} title="任务进度，可拖动">
      <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="track" cx="32" cy="32" r="27" /><circle className="value" cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${average == null ? 0 : average} 100`} /></svg>
      <span>{error ? '!' : loading && !data ? <LoaderCircle className="spin-icon" size={21} /> : count ? average == null ? <CircleHelp size={22} /> : `${average}%` : recent.length ? <Check size={24} /> : '空闲'}</span>
      {count > 0 && <b>{count}</b>}{summary.hasFailed && !summary.runningCount && <i className="failure-dot" aria-label="有失败任务" />}
    </button>, document.body)}
    {notice && <div className="task-hub-toast" role="status">{notice}<button aria-label="关闭任务提示" onClick={() => setNotice('')}>×</button></div>}
    {open && createPortal(<section ref={panel} className="task-hub-panel" id="task-hub-panel" aria-label="后台任务进度"><header><div><strong>任务中心</strong><small>{count} 个工作正在进行</small></div><button aria-label="刷新任务进度" disabled={loading} onClick={() => void load()}><RefreshCw size={17} className={loading ? 'spin-icon' : ''} /></button><button aria-label="关闭任务进度" onClick={close}><X size={18} /></button></header>
      {error && <div className="task-hub-error" role="alert">{error}<button onClick={() => void load()}>重试加载</button></div>}
      {loading && !data && <p role="status">正在读取任务…</p>}
      {data && <div className="task-hub-scroll"><h3>进行中的任务 <span>{count}</span></h3>{active.map(card)}{!active.length && <p>暂无进行中的任务。开始输入或选择素材后，工作会保存到这里。</p>}<h3>最近完成的任务 <span>{data.recentCompletedTotal ?? recent.length}</span></h3>{recent.map(card)}{!recent.length && <p>暂无近期完成记录。</p>}{data.recentCompletedTotal > recent.length && <button onClick={() => setLimit(value => Math.min(100, value + 8))}>查看更多近期任务</button>}<small>已标注的阶段估算来自平台处理阶段，供应商未提供精确进度时不会显示为实时进度。</small></div>}
    </section>, document.body)}
    {confirmation && createPortal(<div className="task-hub-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="cancel-task-title" className="task-hub-dialog"><h2 id="cancel-task-title">取消未完成任务</h2><p>确定取消这项未完成任务吗？取消后将停止生成，但会保留工作记录，可在近期任务中查看。</p><div className="task-hub-actions"><button ref={cancelDialog} disabled={Boolean(busy)} onClick={() => setConfirmation(null)}>继续任务</button><button disabled={Boolean(busy)} onClick={() => void cancel()}>{busy ? '正在取消…' : '确认取消'}</button></div></section></div>, document.body)}
    {detail && createPortal(<div className="task-hub-backdrop"><section className="task-hub-dialog" role="dialog" aria-modal="true" aria-label="工作记录详情"><h2>{detail.item.title || detail.item.moduleName}</h2><p>{labels[detail.item.status]} · 第 {detail.item.currentStep || 1} 步</p>{detail.item.cancelReason && <p>取消原因：{detail.item.cancelReason}</p>}{detail.texts?.map(text => <article key={text.id}><h3>{text.title}</h3><pre>{text.content}</pre></article>)}{detail.assets?.map(asset => <article key={asset.id}><h3>{asset.name}</h3>{asset.assetType === 'video' ? <video style={{ width: '100%' }} controls src={asset.url || asset.externalUrl} /> : <img style={{ maxWidth: '100%' }} src={asset.url || asset.previewUrl || `/api/assets/${asset.storageKey}`} alt={asset.name} />}</article>)}{!detail.texts?.length && !detail.assets?.length && <pre>{JSON.stringify(detail.record?.draftData || detail.item.draftData, null, 2)}</pre>}<button onClick={() => setDetail(null)}>关闭记录</button></section></div>, document.body)}
  </>
}
