import { ShotReferenceEditor, ReferenceSummary, useReferencePreflight } from './ShotReferences'
import { referenceBindingsFor, referenceIdsFrom } from '../../functions/_lib/reference-bindings.js'
import { useLayoutEffect, useRef, useState } from 'react'
import { Download, Film, LoaderCircle } from 'lucide-react'

const statusLabel = task => ({ completed: '已生成', failed: '生成失败', cancelled: '已取消', queued: '排队中', running: '生成中' }[task?.status] || '未生成')
export default function DramaVideoStage({ project, selectedShot, selectedShotId, selectedShotIds, setSelectedShotIds, selectShot, shotDraft, setShotDraft, saveShot, saveState, busy, submitVideos, videoTasks, shotTasks, selectedTask, setSelectedVideoTaskId, setPlaying, acceptVideo, discardVideo, videoModel, aspectRatio, setAspectRatio, resolution, setResolution, duration, setDuration, loadAssets, onNavigate, assets = [], onLoadReferenceAssets, onPreview }) {
  const [panel, setPanel] = useState('editor')
  const [failureId, setFailureId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const stage = useRef(null)
  useLayoutEffect(() => {
    const measure = () => { if (stage.current) stage.current.style.setProperty('--stage-visible-height', `${Math.max(280, window.innerHeight - Math.max(12, stage.current.getBoundingClientRect().top) - 16)}px`) }
    measure(); window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [])
  const save = async () => { setSaving(true); setSaveError(''); try { await saveShot() } catch (error) { setSaveError(error.message) } finally { setSaving(false) } }
  const referenceEditor = useRef(null)
  const referenceIds = referenceIdsFrom(shotDraft?.referencedAssetIds ?? [...(project.sceneAssetIds || []), ...(project.characterAssetIds || []), ...(project.propAssetIds || [])])
  let bindings, bindingError = ''
  try { bindings = referenceBindingsFor(referenceIds, shotDraft?.referenceBindings || []) } catch (error) { bindingError = error.message; bindings = referenceIds.map((assetId, index) => ({ assetId, token: `@图片${index + 1}` })) }
  const checked = useReferencePreflight(referenceIds)
  const preflight = bindingError ? { ...checked, status: 'failed', error: bindingError } : checked
  const blocked = preflight.status !== 'available'
  return <div className="drama-video-stage" ref={stage}>
    <nav className="drama-video-tabs" aria-label="视频工作区面板">{[['shots', `镜头列表 (${project.shots.length})`], ['editor', '提示词与结果'], ['settings', '生成设置']].map(([key, title]) => <button key={key} aria-pressed={panel === key} onClick={() => setPanel(key)}>{title}</button>)}</nav>
    <section className="drama-video-layout" data-active-panel={panel} aria-label="镜头视频工作区">
      <aside className="drama-shot-nav" data-video-panel="shots"><h2>镜头列表</h2><div className="drama-inline-actions"><button onClick={() => setSelectedShotIds(project.shots.map(shot => shot.shotId))}>全选</button><button onClick={() => setSelectedShotIds(project.shots.filter(shot => shot.status === 'failed').map(shot => shot.shotId))}>只选失败</button><button onClick={() => setSelectedShotIds([])}>清空</button></div>
        <div className="drama-shot-scroll">{project.shots.map(shot => {
          const task = [...(shot.videoTaskIds || [])].reverse().map(id => videoTasks.find(item => item.id === id)).find(Boolean)
          const failed = Boolean(shot.submissionError || task?.status === 'failed' || shot.status === 'failed')
          const cause = shot.submissionError || task?.error || task?.stage || '未返回具体失败原因，请重新提交。'
          return <article key={shot.shotId} className={`drama-shot-card ${selectedShotId === shot.shotId ? 'selected' : ''} ${failed ? 'has-failed' : ''}`} aria-label={`镜头 ${shot.shotNumber}`}>
            <div className="drama-shot-choice"><input type="checkbox" checked={selectedShotIds.includes(shot.shotId)} onChange={event => setSelectedShotIds(current => event.target.checked ? [...current, shot.shotId] : current.filter(id => id !== shot.shotId))} aria-label={`选择镜头 ${shot.shotNumber}`} /><button onClick={async () => { await selectShot(shot.shotId); setPanel('editor') }}><strong>镜头 {shot.shotNumber}</strong><small>{shot.durationSeconds} 秒 · {failed ? '生成失败' : statusLabel(task)}</small></button></div>
            <p className="drama-shot-summary">{shot.prompt || shot.scene || '尚未填写提示词'}</p>
            {failed && <><div className="drama-inline-actions"><button aria-expanded={failureId === shot.shotId} onClick={() => setFailureId(current => current === shot.shotId ? '' : shot.shotId)}>查看原因</button><button disabled={Boolean(busy)} onClick={() => void submitVideos('single', [shot.shotId], true)}>重试视频</button></div>{failureId === shot.shotId && <p className="drama-shot-failure" role="alert">{cause}</p>}</>}
          </article>
        })}</div>
      </aside>
      <div className="drama-video-main" data-video-panel="editor"><div className="drama-section-heading"><div><small>阶段三 · 视频生成</small><h2>镜头 {selectedShot?.shotNumber || '—'}</h2></div><span className="drama-save-status" role="status">{saving ? '正在保存…' : saveState}</span></div>
        {selectedShot && <><ShotReferenceEditor disabled={Boolean(busy)} ref={referenceEditor} value={shotDraft?.prompt || ''} bindings={bindings} assets={assets} onChange={patch => setShotDraft(current => ({ ...current, ...patch }))} onPreview={onPreview} onLoadAssets={onLoadReferenceAssets} /><p className="drama-video-help">将按右侧设置的时长、画幅和清晰度生成视频。</p>{saveError && <p role="alert">保存失败：{saveError}</p>}<div className="drama-inline-actions drama-current-actions"><button className="secondary-button" disabled={saving} onClick={() => void save()}>保存提示词修改</button><button className="primary-button" disabled={Boolean(busy) || saving || blocked} title={blocked ? '请先完成参考素材检查' : undefined} onClick={() => void submitVideos('single', [selectedShotId])} aria-busy={busy === 'video'}>{busy === 'video' ? <><LoaderCircle size={15} className="spin-icon" />正在检查并提交…</> : '生成当前镜头视频'}</button></div></>}
        {shotTasks.length > 0 && <div className="drama-result-versions"><strong>结果版本</strong>{shotTasks.map((task, index) => <button key={task.id} className={selectedTask?.id === task.id ? 'active' : ''} onClick={() => setSelectedVideoTaskId(task.id)}>第 {shotTasks.length - index} 版 · {statusLabel(task)}{task.videoAssetId ? ' · 已归档' : ''}</button>)}</div>}
        {selectedTask && <div className="drama-video-result"><h3>当前镜头结果 · {statusLabel(selectedTask)}</h3>{selectedTask.status === 'failed' && <p className="drama-shot-failure">{selectedTask.error || selectedTask.stage || '视频生成失败，请重试。'}</p>}{selectedTask.providerVideoUrl && <><button className="secondary-button" onClick={() => setPlaying(selectedTask)}><Film size={15} />打开视频</button><a className="secondary-button" href={`/api/v1/video-tasks/${selectedTask.id}/download`} download><Download size={15} />下载</a><button className="primary-button" disabled={Boolean(selectedTask.videoAssetId) || Boolean(busy)} onClick={() => void acceptVideo(selectedTask)}>{selectedTask.videoAssetId ? '已归档' : selectedTask.archiveStatus === 'archive_failed' ? '重新归档视频' : '选为当前版本并归档'}</button><button className="secondary-button" onClick={() => onNavigate?.('assets', 'video-library')}>进入视频库</button><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('single', [selectedShotId], true)}>重新生成视频</button>{!selectedTask.videoAssetId && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => void discardVideo(selectedTask)}>删除待选结果</button>}</>}{selectedTask.status === 'failed' && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => void submitVideos('single', [selectedShotId], true)}>重试当前镜头视频</button>}</div>}
      </div>
      <aside className="drama-video-settings" data-video-panel="settings"><div className="drama-settings-scroll"><h2>生成设置</h2><p>视频模型：{videoModel}</p><label>画幅<select disabled={Boolean(busy)} value={aspectRatio} onChange={event => setAspectRatio(event.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label><label>清晰度<select disabled={Boolean(busy)} value={resolution} onChange={event => setResolution(event.target.value)}><option>720p</option><option>1080p</option><option>480p</option></select></label><label>时长（秒）<input disabled={Boolean(busy)} type="number" min="4" max="15" value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><ReferenceSummary disabled={Boolean(busy)} bindings={bindings} assets={assets} preflight={preflight} onPreview={onPreview} onReplace={id => referenceEditor.current?.open(id)} onRemove={id => referenceEditor.current?.remove(id)} /><button className="secondary-button" onClick={() => void loadAssets('scene')}>补充场景素材</button></div>
        <div className="drama-video-submit"><h3>批量生成视频</h3><p id="drama-selection-hint">{selectedShotIds.length ? `已选择 ${selectedShotIds.length} 个镜头` : '请先在镜头列表勾选要生成的镜头。'}</p><button className="primary-button" aria-describedby="drama-selection-hint" disabled={Boolean(busy) || blocked || !selectedShotIds.length} onClick={() => void submitVideos('selected', selectedShotIds)}>生成选中镜头视频 ({selectedShotIds.length})</button><button className="secondary-button" disabled={Boolean(busy) || blocked || !project.shots.length} onClick={() => void submitVideos('all')}>生成全部镜头视频</button><button className="secondary-button" disabled={Boolean(busy) || !project.shots.some(shot => shot.status === 'failed')} onClick={() => void submitVideos('failed', [], true)}>只重试失败镜头视频</button></div>
      </aside>
    </section>
  </div>
}
