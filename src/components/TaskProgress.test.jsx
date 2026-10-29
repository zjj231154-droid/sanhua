import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import TaskProgress from './TaskProgress'
const draft = { id: 'draft-1', taskId: 'draft-1', title: '精修草稿', moduleName: '产品精修', moduleKey: 'retouch', status: 'draft', version: 2, currentStep: 3, progress: null, progressSource: 'unknown' }
const summary = (active = [], recentCompleted = [], extra = {}) => ({ summary: { activeCount: active.length, averageProgress: null, ...extra }, active, recentCompleted, recentCompletedTotal: recentCompleted.length })
const response = (data, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => data })
const setup = (data = summary(), actions = {}) => {
 const fetcher = vi.fn(async (url, options) => actions[url]?.(options) || response(data)); vi.stubGlobal('fetch', fetcher); return fetcher
}
const open = async () => { const button = screen.getByRole('button', { name: /打开.*任务列表|打开近期任务列表/ }); fireEvent.click(button); await screen.findByRole('region', { name: '后台任务进度' }); return button }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear() })
it('progress_ring_shows_real_single_task_progress', async () => { setup(summary([{ ...draft, status: 'running', progress: 37, progressSource: 'provider' }], [], { averageProgress: 37, runningCount: 1 })); render(<TaskProgress />); expect(await screen.findByRole('button', { name: /进度 37%/ })).toHaveTextContent('37%') })
it('unknown_progress_does_not_inflate_average', async () => { setup(summary([draft, { ...draft, id: 'known', status: 'running', progress: 42, progressSource: 'provider' }], [], { averageProgress: 42, hasUnknownProgress: true })); render(<TaskProgress />); const button = await screen.findByRole('button', { name: /进度 42%.*当前 2 个任务/ }); fireEvent.click(button); expect(await screen.findByText('处理中 · 等待服务响应')).toBeInTheDocument() })
it('empty_ring_does_not_show_fake_100_percent', async () => { setup(); render(<TaskProgress />); await waitFor(() => expect(screen.getByRole('button', { name: /当前空闲/ })).toHaveTextContent('空闲')); expect(screen.queryByText('100%')).not.toBeInTheDocument() })
it('failed_task_shows_failure_indicator', async () => { setup(summary([], [{ ...draft, status: 'failed' }], { hasFailed: true })); render(<TaskProgress />); expect(await screen.findByLabelText('有失败任务')).toBeInTheDocument() })
it('progress_ring_opens_and_closes_task_panel_accessibly with Escape and outside pointer', async () => { setup(summary([draft])); render(<TaskProgress />); const button = await open(); fireEvent.keyDown(document, { key: 'Escape' }); expect(button).toHaveFocus(); expect(screen.queryByRole('region')).not.toBeInTheDocument(); fireEvent.click(button); fireEvent.pointerDown(document.body); expect(screen.queryByRole('region')).not.toBeInTheDocument(); fireEvent.click(button); fireEvent.click(button); expect(screen.queryByRole('region')).not.toBeInTheDocument() })
it('task_panel_groups_active_and_recent_completed', async () => { setup(summary([draft], [{ ...draft, id: 'completed', title: '品牌结果', status: 'succeeded' }])); render(<TaskProgress />); await open(); expect(await screen.findByText('品牌结果')).toBeInTheDocument(); expect(screen.getByText('进行中的任务')).toBeInTheDocument(); expect(screen.getByText('最近完成的任务')).toBeInTheDocument() })
it('task_list_error_is_not_rendered_as_empty_state and reload recovers', async () => { const fetcher = setup(); fetcher.mockImplementation(async () => response({ error: 'network unavailable' }, false)); render(<TaskProgress />); fireEvent.click(screen.getByRole('button')); expect(await screen.findByRole('alert')).toHaveTextContent('任务加载失败'); expect(screen.queryByText(/暂无进行中的任务/)).not.toBeInTheDocument(); fetcher.mockImplementation(async () => response(summary([draft]))); fireEvent.click(screen.getByRole('button', { name: '重试加载' })); expect(await screen.findByText('精修草稿')).toBeInTheDocument() })
it('continue_fetches_latest_work_record and continues without creating duplicate draft', async () => { const latest = { ...draft, currentStep: 5, draftData: { prompt: '最新输入', assetIds: ['asset-1'], ratio: '9:16' }, recordType: 'draft_task' }; const fetcher = setup(summary([draft]), { '/api/v1/task-center/draft-1': () => response({ item: latest, record: latest }) }); const resume = vi.fn(); render(<TaskProgress onResume={resume} />); await open(); fireEvent.click(await screen.findByRole('button', { name: '继续', exact: true })); await waitFor(() => expect(resume).toHaveBeenCalledWith(expect.objectContaining({ currentStep: 5, draftData: latest.draftData }))); expect(fetcher.mock.calls.some(([url]) => url === '/api/v1/work-records')).toBe(false); expect(screen.getByRole('status')).toHaveTextContent('已恢复上次工作') })
it('continue_failure_keeps_panel_open_and_is_retryable', async () => { setup(summary([draft]), { '/api/v1/task-center/draft-1': () => response({ error: 'TASK_NOT_FOUND' }, false) }); render(<TaskProgress onResume={vi.fn()} />); await open(); fireEvent.click(await screen.findByRole('button', { name: '继续', exact: true })); expect(await screen.findByRole('alert')).toHaveTextContent('无法恢复该工作记录'); expect(screen.getByRole('region', { name: '后台任务进度' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: '继续', exact: true })).toBeEnabled() })
it('cancel waits for confirmation and server result; cancelled task moves to recent', async () => { let state = summary([draft]); const cancelled = { ...draft, status: 'cancelled', cancelledAt: new Date().toISOString() }; const fetcher = setup(); fetcher.mockImplementation(async (url, options) => { if (url.endsWith('/cancel')) { state = summary([], [cancelled]); return response({ item: cancelled, notice: '任务已取消，工作记录已保留。' }) }; return response(state) }); render(<TaskProgress />); await open(); fireEvent.click(await screen.findByRole('button', { name: '取消', exact: true })); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(fetcher.mock.calls.some(([url]) => url.endsWith('/cancel'))).toBe(false); fireEvent.click(screen.getByRole('button', { name: '确认取消' })); await waitFor(() => expect(screen.getByText('已取消')).toBeInTheDocument()); expect(screen.queryByRole('button', { name: '继续', exact: true })).not.toBeInTheDocument(); expect(fetcher).toHaveBeenCalledWith('/api/v1/task-center/draft-1/cancel', expect.objectContaining({ body: JSON.stringify({ expectedVersion: 2, reason: '用户从任务面板取消' }) })) })
it('cancel_failure_keeps_task_active', async () => { setup(summary([draft]), { '/api/v1/task-center/draft-1/cancel': () => response({ hint: '上游暂不可用' }, false) }); render(<TaskProgress />); await open(); fireEvent.click(await screen.findByRole('button', { name: '取消', exact: true })); fireEvent.click(screen.getByRole('button', { name: '确认取消' })); expect(await screen.findByRole('alert')).toHaveTextContent('上游暂不可用'); expect(screen.getByText('精修草稿')).toBeInTheDocument(); expect(screen.getByRole('button', { name: '确认取消' })).toBeEnabled() })
it('task_creation_updates_panel_immediately and task_completion_moves_item_to_recent_completed', async () => { let data = summary(); const fetcher = setup(); fetcher.mockImplementation(async () => response(data)); render(<TaskProgress />); await open(); data = summary([draft]); fireEvent(window, new Event('sanhua:tasks-updated')); expect(await screen.findByText('精修草稿')).toBeInTheDocument(); data = summary([], [{ ...draft, status: 'succeeded' }]); fireEvent(window, new Event('sanhua:tasks-updated')); expect(await screen.findByRole('button', { name: '查看结果' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: '取消', exact: true })).not.toBeInTheDocument() })
it('workspace_switch_clears_previous_task_cache and ignores late requests', async () => { let data = summary([draft]); const fetcher = setup(); fetcher.mockImplementation(async () => response(data)); const rendered = render(<TaskProgress scopeKey="user-a:workspace-a" />); await open(); expect(await screen.findByText('精修草稿')).toBeInTheDocument(); data = summary(); rendered.rerender(<TaskProgress scopeKey="user-a:workspace-b" />); await waitFor(() => expect(screen.queryByText('精修草稿')).not.toBeInTheDocument()); await open(); expect(screen.queryByText('精修草稿')).not.toBeInTheDocument() })
it('logout_clears_previous_session_task_state', async () => { setup(summary([draft])); const rendered = render(<TaskProgress />); await open(); expect(await screen.findByText('精修草稿')).toBeInTheDocument(); rendered.unmount(); expect(screen.queryByRole('region')).not.toBeInTheDocument() })
it('task entry lives in a dedicated topbar dock instead of the batch action area', async () => {
  setup(); const host = document.createElement('div'); host.style.overflow = 'hidden'; document.body.append(host)
  const rendered = render(<TaskProgress />, { container: host })
  const ring = screen.getByRole('button', { name: /当前空闲/ })
  expect(ring.closest('.task-hub-dock').parentElement).toBe(document.body)
  expect(ring).not.toHaveAttribute('style')
  rendered.unmount(); host.remove()
})

it('progress_ring_tracks_only_one_task and never averages multiple tasks', async () => {
  const first = { ...draft, id: 'one', title: '第一项', status: 'running', progress: 20, progressSource: 'provider', updatedAt: '2026-10-01T01:00:00Z' }
  const second = { ...first, id: 'two', title: '第二项', progress: 80, updatedAt: '2026-10-01T02:00:00Z' }
  setup(summary([first, second], [], { averageProgress: 50 }))
  render(<TaskProgress scopeKey="owner-a:main" />)
  expect(await screen.findByRole('button', { name: /正在跟踪 第二项，进度 80%/ })).toHaveTextContent('80%')
  await open()
  const firstCard = screen.getByRole('article', { name: '第一项' })
  fireEvent.click(within(firstCard).getByRole('button', { name: '圆环跟踪此任务' }))
  expect(screen.getByRole('button', { name: /正在跟踪 第一项，进度 20%/ })).toHaveTextContent('20%')
  expect(within(firstCard).getByText('20%')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: '第二项' })).getByText('80%')).toBeInTheDocument()
  expect(sessionStorage.getItem('sanhua-task-tracking:owner-a:main')).toBe('one')
})

it('tracked_task_finishing_selects_next_active_task; unknown progress does not become an estimate', async () => {
  const running = { ...draft, id: 'running', title: '视频', status: 'running', progress: 60, progressSource: 'provider' }
  const queued = { ...draft, id: 'queued', title: '图片', status: 'queued', progress: 25, progressSource: 'platform_estimate' }
  let data = summary([queued, running]); const fetcher = setup(); fetcher.mockImplementation(async () => response(data))
  render(<TaskProgress />)
  expect(await screen.findByRole('button', { name: /正在跟踪 视频，进度 60%/ })).toBeInTheDocument()
  data = summary([queued], [{ ...running, status: 'succeeded' }])
  fireEvent(window, new Event('sanhua:tasks-updated'))
  const ring = await screen.findByRole('button', { name: /正在跟踪 图片，排队中/ })
  expect(ring).not.toHaveTextContent('25%')
  expect(within(ring).getByLabelText('处理中，进度未知')).toBeInTheDocument()
})

it('switch_account_clears_task_cache and ignores the old session preference and delayed response', async () => {
  sessionStorage.setItem('sanhua-task-tracking:owner-a:main', 'private-a')
  let resolveOld
  const fetcher = setup(); fetcher.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const rendered = render(<TaskProgress scopeKey="owner-a:main" />)
  fetcher.mockImplementation(async () => response(summary([{ ...draft, id: 'private-b', title: 'B 的草稿' }])))
  rendered.rerender(<TaskProgress scopeKey="owner-b:main" />)
  await waitFor(() => expect(screen.getByRole('button', { name: /正在跟踪 B 的草稿/ })).toBeInTheDocument())
  resolveOld(response(summary([{ ...draft, id: 'private-a', title: 'A 的私有任务' }])))
  await open()
  expect(screen.queryByText('A 的私有任务')).not.toBeInTheDocument()
  expect(screen.getByText('B 的草稿')).toBeInTheDocument()
})

it('a saved tracking preference restores only the current account active task', async () => {
  const tasks = [{ ...draft, id: 'chosen', title: '本人选中的草稿' }, { ...draft, id: 'running', title: '运行任务', status: 'running', progress: 80, progressSource: 'provider' }]
  sessionStorage.setItem('sanhua-task-tracking:a:main', 'chosen')
  setup(summary(tasks)); render(<TaskProgress scopeKey="a:main" />)
  expect(await screen.findByRole('button', { name: /正在跟踪 本人选中的草稿，编辑中/ })).toBeInTheDocument()
})

it('archive failure keeps results visible and exposes a retry without clearing the task panel', async () => {
  const task = { ...draft, status: 'failed', archiveRetryAvailable: true }
  setup(summary([], [task]), { '/api/v1/task-center/draft-1/archive-results': () => response({ hint: '存储暂不可用' }, false) })
  render(<TaskProgress />); await open()
  fireEvent.click(screen.getByRole('button', { name: '重新归档结果' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('生成结果已保留')
  expect(screen.getByRole('button', { name: '重新归档结果' })).toBeEnabled()
})
