import { useEffect, useRef, useState } from 'react'

const topics = [
  ['00后掌柜整顿老茶馆', '逆袭轻喜剧', '接手亏损茶馆的女孩，用一场直播让老手艺重新被看见。'],
  ['穿成茶馆老板后我爆单了', '穿越爽剧', '现代运营人穿进旧茶馆，靠新品和奇招扭转生意。'],
  ['前任在我茶馆办婚礼', '情感反转', '一场包场婚宴，让茶馆老板与失联多年的旧人再次相遇。'],
  ['这家茶馆只卖后悔药', '都市奇幻', '每位客人点的茶，都让他们重逢一个错过的人。'],
]
export default function ScriptEditor({ initial, onClose, onSave }) {
  const dialog = useRef(null)
  const [title, setTitle] = useState(initial?.title || topics[0][0])
  const [kind, setKind] = useState(initial?.kind || topics[0][1])
  const [summary, setSummary] = useState(initial?.summary || topics[0][2])
  const [outline, setOutline] = useState(initial?.outline || '开场钩子：\n主要人物：\n茶馆场景：\n核心冲突：\n结尾反转：')
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal(); }, [])
  return <dialog ref={dialog} className="script-editor" onCancel={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { onSave({ title: title.trim(), kind, summary, outline }); onClose() } catch { setError('保存失败，请检查浏览器存储空间后重试') } }}>
      <header><div><small>茶馆故事 · 选题编辑</small><h2>新建短剧项目</h2></div><button type="button" className="secondary-button" onClick={onClose}>关闭</button></header>
      <div className="topic-options">{topics.map(topic => <button key={topic[0]} type="button" className="secondary-button" onClick={() => { setTitle(topic[0]); setKind(topic[1]); setSummary(topic[2]) }}>{topic[0]}</button>)}</div>
      <label>选题名称<input required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>类型<input required value={kind} onChange={e => setKind(e.target.value)} /></label>
      <label>故事梗概<textarea value={summary} onChange={e => setSummary(e.target.value)} /></label>
      <label>分集创意与拍摄笔记<textarea rows={7} value={outline} onChange={e => setOutline(e.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <footer><small>保存为本机草稿，可再次点击编辑。</small><button className="primary-button" disabled={!title.trim()}>保存选题</button></footer>
    </form>
  </dialog>
}
