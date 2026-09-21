import { useEffect, useMemo, useRef, useState } from 'react'

const topics = [
  ['00后掌柜整顿老茶馆', '逆袭轻喜剧', '接手亏损茶馆的女孩，用一场直播让老手艺重新被看见。'],
  ['穿成茶馆老板后我爆单了', '穿越爽剧', '现代运营人穿进旧茶馆，靠新品和奇招扭转生意。'],
  ['前任在我茶馆办婚礼', '情感反转', '一场包场婚宴，让茶馆老板与失联多年的旧人再次相遇。'],
  ['这家茶馆只卖后悔药', '都市奇幻', '每位客人点的茶，都让他们重逢一个错过的人。'],
]

const valuesFrom = ({ title, kind, summary, outline }) => ({ title: title.trim(), kind: kind.trim(), summary: summary.trim(), outline: outline.trim() })

export default function ScriptEditor({ initial, onClose, onSave, onAutoSave, onSaveVersion, onListVersions, onRestoreVersion }) {
  const dialog = useRef(null)
  const latest = useRef(null)
  const saved = useRef('')
  const confirmation = Boolean(initial?.pendingConfirmation)
  const [title, setTitle] = useState(initial?.title || topics[0][0])
  const [kind, setKind] = useState(initial?.kind || topics[0][1])
  const [summary, setSummary] = useState(initial?.summary || topics[0][2])
  const [outline, setOutline] = useState(initial?.outline || '开场钩子：\n主要人物：\n茶馆场景：\n核心冲突：\n结尾反转：')
  const [versions, setVersions] = useState([])
  const [changeNote, setChangeNote] = useState('')
  const [status, setStatus] = useState(initial?.id ? '已加载，自动保存已开启' : confirmation ? '请审阅生成计划，确认后才会写入云端剧本库' : '新剧本将在首次保存后进入云端剧本库')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const values = useMemo(() => valuesFrom({ title, kind, summary, outline }), [title, kind, summary, outline])
  latest.current = values

  useEffect(() => {
    dialog.current?.showModal()
    saved.current = JSON.stringify(valuesFrom(initial || { title, kind, summary, outline }))
  }, [])

  useEffect(() => {
    if (!initial?.id || !onListVersions) return undefined
    onListVersions(initial.id).then(setVersions).catch(() => setError('版本记录读取失败，请稍后重试'))
  }, [initial?.id, onListVersions])

  useEffect(() => {
    if (!initial?.id || !onAutoSave) return undefined
    const timer = window.setInterval(async () => {
      const next = latest.current
      const serialized = JSON.stringify(next)
      if (!next.title || serialized === saved.current) return
      setStatus('自动保存中…')
      try {
        await onAutoSave(next)
        saved.current = serialized
        setStatus(`已自动保存 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)
      } catch (saveError) {
        setError(saveError.message || '自动保存失败，请检查网络后手动保存')
        setStatus('自动保存失败')
      }
    }, 7000)
    return () => window.clearInterval(timer)
  }, [initial?.id, onAutoSave])

  const submit = async event => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const script = await onSave(values)
      saved.current = JSON.stringify(values)
      setStatus('已保存到云端剧本库')
      if (!initial?.id && script?.id) onClose()
      else onClose()
    } catch (saveError) {
      setError(saveError.message || '保存失败，请稍后重试')
    } finally { setSaving(false) }
  }

  const saveVersion = async () => {
    if (!initial?.id || !onSaveVersion) return
    setSaving(true); setError('')
    try {
      const result = await onSaveVersion(values, changeNote)
      saved.current = JSON.stringify(values)
      setVersions(current => [result.version, ...current])
      setChangeNote('')
      setStatus(`已保存版本 v${result.version.versionNo}`)
    } catch (saveError) { setError(saveError.message || '保存版本失败，请稍后重试') } finally { setSaving(false) }
  }

  const restore = async version => {
    if (!initial?.id || !onRestoreVersion) return
    setSaving(true); setError('')
    try {
      const script = await onRestoreVersion(version.id)
      setTitle(script.title); setKind(script.kind); setSummary(script.summary); setOutline(script.outline)
      saved.current = JSON.stringify(valuesFrom(script))
      setStatus(`已恢复 v${version.versionNo}，将继续自动保存`)
    } catch (restoreError) { setError(restoreError.message || '恢复版本失败，请稍后重试') } finally { setSaving(false) }
  }

  return <dialog ref={dialog} className="script-editor" onCancel={onClose}>
    <form onSubmit={submit}>
      <header><div><small>{confirmation ? '编导助手 · 待确认计划' : '茶馆故事 · 云端剧本库'}</small><h2>{confirmation ? '确认短剧计划' : initial?.id ? '编辑短剧项目' : '新建短剧项目'}</h2></div><button type="button" className="secondary-button" onClick={onClose}>{confirmation ? '返回修改' : '关闭'}</button></header>
      <div className="topic-options">{topics.map(topic => <button key={topic[0]} type="button" className="secondary-button" onClick={() => { setTitle(topic[0]); setKind(topic[1]); setSummary(topic[2]) }}>{topic[0]}</button>)}</div>
      <label>选题名称<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>类型<input required value={kind} onChange={e => setKind(e.target.value)} /></label>
      <label>故事梗概<textarea value={summary} onChange={e => setSummary(e.target.value)} /></label>
      <label>{confirmation ? '生成的故事规划（可直接修改）' : '分集创意与拍摄笔记'}<textarea rows={confirmation ? 14 : 7} value={outline} onChange={e => setOutline(e.target.value)} /></label>
      {initial?.id && <section className="script-version-panel"><div><strong>版本记录</strong><small>{status}</small></div><div className="script-version-actions"><input value={changeNote} maxLength={300} onChange={event => setChangeNote(event.target.value)} placeholder="本次版本说明（可选）" aria-label="版本说明" /><button type="button" className="secondary-button" disabled={saving} onClick={saveVersion}>{saving ? '正在保存…' : '保存版本'}</button></div>{versions.length ? <ul>{versions.map(version => <li key={version.id}><span><strong>v{version.versionNo}</strong><small>{version.changeNote} · {new Date(version.savedAt).toLocaleString('zh-CN')}</small></span><button type="button" className="quiet-button" disabled={saving} onClick={() => restore(version)}>恢复此版本</button></li>)}</ul> : <p>尚无可恢复版本。</p>}</section>}
      {error && <p className="retouch-error" role="alert">{error}</p>}
      <footer><small>{initial?.id ? status : confirmation ? status : '保存后将持久化到云端，可在刷新或重新部署后恢复。'}</small><button className="primary-button" disabled={!title.trim() || saving}>{saving ? '正在保存…' : confirmation ? '确认并保存剧本' : '保存并关闭'}</button></footer>
    </form>
  </dialog>
}
