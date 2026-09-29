import { useMemo, useState } from 'react'

const LIBRARIES = [
  { key: 'retouch', label: '精修图库', folders: [['template', '模板'], ['effect', '效果图']] },
  { key: 'brand', label: '茶馆文创库', folders: [['product-effect', '产品效果'], ['graphic-effect', '平面效果']] },
  { key: 'script', label: '短剧库', folders: [['scene', '场景资产'], ['character', '人物资产'], ['prop', '道具资产']] },
]

export default function GeneratedArchiveDialog({ asset, onClose, onArchived }) {
  const initialLibrary = asset?.recommendedLibraryKey === 'brand' ? 'brand' : asset?.recommendedLibraryKey === 'script' ? 'script' : 'retouch'
  const [libraryKey, setLibraryKey] = useState(initialLibrary)
  const activeLibrary = useMemo(() => LIBRARIES.find(library => library.key === libraryKey) || LIBRARIES[0], [libraryKey])
  const [folderKey, setFolderKey] = useState(asset?.recommendedFolderKey || activeLibrary.folders[0][0])
  const [name, setName] = useState(asset?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changeLibrary = value => { const next = LIBRARIES.find(library => library.key === value) || LIBRARIES[0]; setLibraryKey(next.key); setFolderKey(next.folders[0][0]) }
  const folderLabel = activeLibrary.folders.find(folder => folder[0] === folderKey)?.[1] || activeLibrary.folders[0][1]
  const save = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/v1/generated-results/${asset.id}/archive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libraryKey, folderKey, name: name.trim() }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || '保存失败，可重试')
      onArchived?.(value.asset, `已保存到：${activeLibrary.label} / ${folderLabel}`)
    } catch (reason) { setError(reason.message || '保存失败，可重试') } finally { setBusy(false) }
  }
  return <div className="asset-picker-modal" role="presentation"><section className="asset-picker-dialog generated-archive-dialog" role="dialog" aria-modal="true" aria-label="保存到资产库"><header className="asset-picker-heading"><div><strong>保存到资产库</strong><small>生成结果会在确认后转为正式资产；取消不会删除待保存结果。</small></div><button type="button" className="icon-button" aria-label="关闭保存弹窗" onClick={onClose}>×</button></header><div className="generated-archive-body"><img src={asset.previewUrl || asset.thumbnailUrl || asset.url} alt={asset.name} /><div><label>保存到一级库<select value={libraryKey} onChange={event => changeLibrary(event.target.value)} aria-label="保存到一级库">{LIBRARIES.map(library => <option key={library.key} value={library.key}>{library.label}</option>)}</select></label><label>保存到文件夹<select value={folderKey} onChange={event => setFolderKey(event.target.value)} aria-label="保存到文件夹">{activeLibrary.folders.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>图片名称<input value={name} maxLength="160" onChange={event => setName(event.target.value)} aria-label="保存图片名称" placeholder={asset.name} /></label><small>来源：{asset.sourceModule || asset.assetSpace || 'AI 生成'} · 任务 {String(asset.sourceTaskId || asset.taskId || '—').slice(0, 12)}</small></div></div>{error && <p className="retouch-error" role="alert">{error}</p>}<footer className="asset-picker-footer"><span>目标路径：{activeLibrary.label} / {folderLabel}</span><div><button className="secondary-button" disabled={busy} onClick={onClose}>暂不保存</button><button className="primary-button" disabled={busy} onClick={save}>{busy ? '正在保存…' : '确认保存'}</button></div></footer></section></div>
}
