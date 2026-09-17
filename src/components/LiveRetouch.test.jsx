import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import LiveRetouch from './LiveRetouch'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })
it('恢复计划后等待明确确认，才提交编辑请求', async () => {
  localStorage.setItem('retouch-job', 'saved-job')
  const fetch = vi.fn(async (url, options) => ({ ok: true, json: async () => url.endsWith('/status') ? { connected: true } : options ? { id: 'saved-job', status: 'editing' } : { id: 'saved-job', status: 'awaiting_confirmation', plan: '保留原比例与杯型；咖啡店；无新增道具。' } }))
  vi.stubGlobal('fetch', fetch)
  render(<LiveRetouch />)
  const button = await screen.findByRole('button', { name: '确认计划并开始精修' })
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  fireEvent.click(button)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/retouch/saved-job/confirm', expect.objectContaining({ method: 'POST' })))
})

it('将已归档的云端精修结果显示在素材选择器中', async () => {
  const fetch = vi.fn(async url => {
    if (url === '/api/v1/assets?workspace=retouch') return { ok: true, json: async () => ({ assets: [{ id: 'remote-retouch-1', name: '已归档精修结果', assetSpace: 'retouch', url: '/api/assets/generated/remote-retouch-1.png' }] }) }
    return { ok: true, json: async () => ({ engine: 'api' }) }
  })
  vi.stubGlobal('fetch', fetch)

  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('button', { name: /添加图片/ }))

  expect(await screen.findByRole('button', { name: /已归档精修结果/ })).toBeInTheDocument()
})
