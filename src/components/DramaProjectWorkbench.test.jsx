import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DramaProjectWorkbench from './DramaProjectWorkbench'

afterEach(() => vi.unstubAllGlobals())
it('continue_restores_the_exact_shot_prompt_and_generation_settings_from_the_latest_server_snapshot', async () => {
  const project = { projectId: 'project-restore', title: '恢复测试', brief: '茶馆短剧', stage: 'video', sceneAssetIds: [], characterAssetIds: [], propAssetIds: [], shots: [{ shotId: 'one', shotNumber: 1, prompt: '第一镜头', durationSeconds: 8 }, { shotId: 'two', shotNumber: 2, prompt: '第二镜头的最新提示词', durationSeconds: 4 }], videoTaskIds: [] }
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, json: async () => String(url).endsWith('/video-tasks') ? { tasks: [], project } : String(url) === '/api/v1/drama-projects' ? { projects: [project] } : String(url).includes('video-provider-connection') ? { connection: { model: 'fixture-model' } } : { project } })))
  render(<DramaProjectWorkbench initialRoute="video" incomingContext={{ draftRecord: { taskId: 'restore-task', sourceShotId: 'two', generationParams: { durationSeconds: 13, aspectRatio: '16:9', resolution: '1080p' }, draftData: { dramaProjectId: project.projectId, shotId: 'two' } } }} />)
  await waitFor(() => expect(screen.getByRole('textbox', { name: '当前镜头视频提示词' })).toHaveValue('第二镜头的最新提示词'))
  expect(screen.getByRole('combobox', { name: '画幅' })).toHaveValue('16:9')
  expect(screen.getByRole('combobox', { name: '清晰度' })).toHaveValue('1080p')
  expect(screen.getByRole('spinbutton', { name: '时长（秒）' })).toHaveValue(13)
})
