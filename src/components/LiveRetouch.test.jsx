import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import LiveRetouch from './LiveRetouch'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

function response(value) {
  return { ok: true, text: async () => JSON.stringify(value), json: async () => value }
}

function renderWorkspace() {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (String(url).startsWith('/api/v1/assets')) return response({ assets: [] })
    return response({ engine: 'api' })
  }))
  return render(<LiveRetouch />)
}

it('一键修图默认直接显示单图精修工作流，不再展示准备页或旧精修助手', () => {
  renderWorkspace()

  expect(screen.getByLabelText('单图精修工作流')).toBeInTheDocument()
  expect(screen.getByLabelText('精修设计步骤')).toHaveTextContent('1素材2尺寸与比例3场景4装饰与保留5精修计划')
  expect(screen.getByRole('button', { name: '从云端素材库选择' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '选择单图精修流程' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '选择批量精修流程' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '选择模板精修流程' })).toBeInTheDocument()
  expect(document.querySelector('.assistant-panel')).toBeNull()
})

it('从云端选择单图后自动进入尺寸与比例步骤', async () => {
  const fetch = vi.fn(async url => {
    if (String(url).startsWith('/api/v1/assets')) return response({ assets: [{ id: 'photo-1', name: '茶饮产品图', assetSpace: 'retouch', url: 'data:image/png;base64,AA==' }] })
    return response({ engine: 'api' })
  })
  vi.stubGlobal('fetch', fetch)
  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('button', { name: '选择单图精修流程' }))
  fireEvent.click(screen.getByRole('button', { name: '从云端素材库选择' }))
  fireEvent.click(await screen.findByRole('button', { name: /茶饮产品图/ }))

  expect(await screen.findByRole('textbox', { name: '尺寸与比例' })).toBeInTheDocument()
  expect(screen.getByText('当前素材：茶饮产品图')).toBeInTheDocument()
})

it('从本机上传后可五步推进，生成计划后才确认调用模型', async () => {
  const fetch = vi.fn(async (url, options) => {
    if (String(url).startsWith('/api/v1/assets')) return response({ assets: [] })
    if (url === '/api/retouch' && options?.method === 'POST') return response({ id: 'plan-1', status: 'awaiting_confirmation', plan: '保留原比例与产品文字，清理背景杂物并提亮主体。' })
    if (url === '/api/retouch/plan-1/confirm' && options?.method === 'POST') return response({ id: 'plan-1', status: 'done', results: [] })
    return response({ engine: 'api' })
  })
  vi.stubGlobal('fetch', fetch)
  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('button', { name: '选择单图精修流程' }))
  const input = document.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['image'], 'product.png', { type: 'image/png' })] } })
  await screen.findByRole('textbox', { name: '尺寸与比例' })
  fireEvent.click(screen.getByRole('button', { name: '下一步：确认场景 →' }))
  fireEvent.click(screen.getByRole('button', { name: '下一步：装饰与保留 →' }))
  fireEvent.click(screen.getByRole('button', { name: '生成精修计划' }))

  const finalPrompt = await screen.findByRole('textbox', { name: '最终精修提示词' })
  expect(finalPrompt).toHaveValue('保留原比例与产品文字，清理背景杂物并提亮主体。')
  expect(finalPrompt).toHaveClass('retouch-final-prompt')
  expect(finalPrompt).toHaveStyle({ height: '180px' })
  expect(fetch.mock.calls.some(([url]) => url === '/api/retouch/plan-1/confirm')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '确认提示词并开始精修' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/retouch/plan-1/confirm', expect.objectContaining({ method: 'POST' })))
})

it('批量精修从云端选择时限制十张素材', async () => {
  const assets = Array.from({ length: 11 }, (_, index) => ({ id: `asset-${index}`, name: `素材${index + 1}`, assetSpace: 'retouch', url: 'data:image/png;base64,AA==' }))
  vi.stubGlobal('fetch', vi.fn(async url => String(url).startsWith('/api/v1/assets') ? response({ assets }) : response({ engine: 'api' })))
  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('button', { name: '选择批量精修流程' }))
  fireEvent.click(screen.getByRole('button', { name: '从云端素材库选择' }))
  const dialog = screen.getByRole('dialog', { name: '从云端素材库选择图片' })
  for (let index = 1; index <= 10; index += 1) fireEvent.click((await within(dialog).findByText(`素材${index}`, { selector: 'span' })).closest('button'))
  expect(screen.getByText('已选 10 / 10 张')).toBeInTheDocument()
  fireEvent.click((await within(dialog).findByText('素材11', { selector: 'span' })).closest('button'))
  expect(screen.getByRole('alert')).toHaveTextContent('一次最多选择 10 张')
})

it('模板精修在第四步提供只影响视觉风格的模板参考入口', async () => {
  renderWorkspace()
  fireEvent.click(screen.getByRole('button', { name: '选择模板精修流程' }))
  const input = document.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [new File(['image'], 'product.png', { type: 'image/png' })] } })
  await screen.findByRole('textbox', { name: '尺寸与比例' })
  fireEvent.click(screen.getByRole('button', { name: '下一步：确认场景 →' }))
  fireEvent.click(screen.getByRole('button', { name: '下一步：装饰与保留 →' }))
  expect(screen.getByRole('button', { name: '选择云端模板参考' })).toBeInTheDocument()
  expect(screen.getByText(/不会被模板参考覆盖/)).toBeInTheDocument()
})

it('图库图片双击后可打开缩放预览，并从右下角关闭', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (String(url).startsWith('/api/v1/assets')) return response({ assets: [{ id: 'gallery-1', name: '图库精修图', assetSpace: 'retouch', url: 'data:image/png;base64,AA==' }] })
    return response({ engine: 'api' })
  }))
  render(<LiveRetouch />)
  fireEvent.click(screen.getByRole('tab', { name: '图库' }))
  const galleryCard = (await screen.findByText('图库精修图')).closest('article')
  fireEvent.doubleClick(galleryCard)

  expect(screen.getByRole('dialog', { name: '图片查看器' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '放大' })).toBeInTheDocument()
  const close = screen.getByRole('button', { name: '关闭图片查看器' })
  expect(close).toHaveClass('image-viewer-close')
  fireEvent.click(close)
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '图片查看器' })).not.toBeInTheDocument())
})
