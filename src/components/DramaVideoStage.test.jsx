import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import DramaVideoStage from './DramaVideoStage'

const shot = { shotId: 'shot-1', shotNumber: 1, prompt: '茶馆窗边的茶杯，缓慢推镜', durationSeconds: 8, status: 'ready', videoTaskIds: [] }
afterEach(() => vi.unstubAllGlobals())
const propsFor = patch => ({ project: { shots: [shot], sceneAssetIds: [], characterAssetIds: [], propAssetIds: [] }, selectedShot: shot, selectedShotId: shot.shotId, selectedShotIds: [], setSelectedShotIds: vi.fn(), selectShot: vi.fn(), shotDraft: shot, setShotDraft: vi.fn(), saveShot: vi.fn().mockResolvedValue(undefined), saveState: '已自动保存', busy: '', submitVideos: vi.fn(), videoTasks: [], shotTasks: [], selectedTask: null, setSelectedVideoTaskId: vi.fn(), setPlaying: vi.fn(), acceptVideo: vi.fn(), discardVideo: vi.fn(), videoModel: 'Seedance', aspectRatio: '9:16', setAspectRatio: vi.fn(), resolution: '720p', setResolution: vi.fn(), duration: 8, setDuration: vi.fn(), loadAssets: vi.fn(), onNavigate: vi.fn(), ...patch })

it('short drama batch actions are separate from settings with a reason for disabled selection', () => {
  const props = propsFor(); render(<DramaVideoStage {...props} />)
  expect(screen.getByRole('button', { name: '生成选中镜头视频 (0)' })).toBeDisabled()
  expect(screen.getByText('请先在镜头列表勾选要生成的镜头。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '生成当前镜头视频' }))
  expect(props.submitVideos).toHaveBeenCalledWith('single', ['shot-1'])
  fireEvent.click(screen.getByRole('button', { name: '生成全部镜头视频' }))
  expect(props.submitVideos).toHaveBeenCalledWith('all')
})

it('failed shot shows its cause and retries that specific shot without leaving the video stage', () => {
  const failed = { ...shot, shotId: 'failed-shot', shotNumber: 2, status: 'failed', submissionError: '参考图片读取失败' }
  const props = propsFor({ project: { shots: [shot, failed] } }); render(<DramaVideoStage {...props} />)
  const card = screen.getByRole('article', { name: '镜头 2' })
  fireEvent.click(within(card).getByRole('button', { name: '查看原因' }))
  expect(within(card).getByRole('alert')).toHaveTextContent('参考图片读取失败')
  fireEvent.click(within(card).getByRole('button', { name: '重试视频' }))
  expect(props.submitVideos).toHaveBeenCalledWith('single', ['failed-shot'], true)
})

it('panel switches preserve the prompt and settings; selecting a shot returns to the editor', async () => {
  const props = propsFor(); render(<DramaVideoStage {...props} />)
  const region = screen.getByRole('region', { name: '镜头视频工作区' })
  fireEvent.click(screen.getByRole('button', { name: '生成设置', exact: true }))
  expect(region).toHaveAttribute('data-active-panel', 'settings')
  fireEvent.change(screen.getByRole('combobox', { name: '画幅' }), { target: { value: '16:9' } })
  expect(props.setAspectRatio).toHaveBeenCalledWith('16:9')
  fireEvent.click(screen.getByRole('button', { name: '镜头列表 (1)' }))
  fireEvent.click(within(screen.getByRole('article', { name: '镜头 1' })).getByRole('button', { name: /镜头 1/ }))
  await waitFor(() => expect(region).toHaveAttribute('data-active-panel', 'editor'))
  expect(props.selectShot).toHaveBeenCalledWith('shot-1')
  expect(screen.getByRole('textbox', { name: '当前镜头视频提示词' })).toHaveValue(shot.prompt)
})

it('prompt save failure stays visible and can be retried', async () => {
  const props = propsFor({ saveShot: vi.fn().mockRejectedValueOnce(new Error('网络中断')).mockResolvedValue(undefined) }); render(<DramaVideoStage {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '保存提示词修改' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败：网络中断')
  fireEvent.click(screen.getByRole('button', { name: '保存提示词修改' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(props.saveShot).toHaveBeenCalledTimes(2)
})

it('completed video opens a player on demand and offers download, archive and library actions', () => {
  const task = { id: 'result-video', providerVideoUrl: 'https://cdn.example/video.mp4', status: 'completed' }
  const props = propsFor({ selectedTask: task, shotTasks: [task] }); const { container } = render(<DramaVideoStage {...props} />)
  expect(container.querySelector('video')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '打开视频' }))
  expect(props.setPlaying).toHaveBeenCalledWith(task)
  expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute('href', '/api/v1/video-tasks/result-video/download')
  fireEvent.click(screen.getByRole('button', { name: '进入视频库' }))
  expect(props.onNavigate).toHaveBeenCalledWith('assets', 'video-library')
})

it('unreadable_reference_blocks_submission_and_names_asset, then a successful recheck enables generation', async () => {
  let readable = false
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: readable, json: async () => ({ ready: readable, items: [{ assetId: 'broken', name: '失效茶馆图', readable, reason: readable ? undefined : '图片文件不存在' }], errors: [] }) })))
  const props = propsFor({ shotDraft: { ...shot, referencedAssetIds: ['broken'] }, assets: [{ id: 'broken', name: '失效茶馆图' }] })
  render(<DramaVideoStage {...props} />)
  await screen.findByText(/图片文件不存在/)
  expect(screen.getByRole('button', { name: '生成当前镜头视频' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: '当前镜头视频提示词' })).toHaveValue(shot.prompt)
  readable = true
  fireEvent.click(screen.getByRole('button', { name: '重新检查素材' }))
  expect(await screen.findByText('本次将发送 1 张参考图')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '生成当前镜头视频' })).toBeEnabled()
})
