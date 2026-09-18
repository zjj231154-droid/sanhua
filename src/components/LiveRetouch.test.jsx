import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

it('单图点击后立即应用，批量选择会在工作区保留全部素材', async () => {
  const fetch = vi.fn(async url => {
    if (url === '/api/v1/assets?workspace=retouch') return { ok: true, json: async () => ({ assets: [
      { id: 'remote-retouch-1', name: '云端素材一', assetSpace: 'retouch', url: '/api/assets/generated/one.png' },
      { id: 'remote-retouch-2', name: '云端素材二', assetSpace: 'retouch', url: '/api/assets/generated/two.png' },
    ] }) }
    return { ok: true, json: async () => ({ engine: 'api' }) }
  })
  vi.stubGlobal('fetch', fetch)
  render(<LiveRetouch />)

  fireEvent.click(screen.getByRole('button', { name: /添加图片/ }))
  fireEvent.click(await screen.findByRole('button', { name: /云端素材一/ }))
  await waitFor(() => expect(screen.getByText('已选择 1 张素材')).toBeInTheDocument())
  expect(screen.queryByRole('dialog', { name: '从云端素材库选择图片' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /批量修图/ }))
  const assetPicker = screen.getByRole('dialog', { name: '从云端素材库选择图片' })
  expect(await within(assetPicker).findByRole('button', { name: /云端素材一/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(within(assetPicker).getByRole('button', { name: /云端素材二/ }))
  expect(screen.getByText('已选 2 / 4 张')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '使用已选 2 张素材' }))
  await waitFor(() => expect(screen.getByText('已选择 2 张素材')).toBeInTheDocument())
  expect(screen.getAllByText('批量精修素材')).toHaveLength(2)
})

it('修图模板面板只提供上传与云资产参考素材入口', () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ engine: 'api' }) })))
  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('button', { name: '修图模版' }))
  const panel = screen.getByLabelText('修图模板')
  expect(within(panel).getByText('上传参考素材')).toBeInTheDocument()
  expect(within(panel).getByRole('button', { name: '选择云资产参考素材' })).toBeInTheDocument()
  expect(within(panel).queryByText('咖啡日光')).not.toBeInTheDocument()
})
