import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShotReferenceEditor } from './ShotReferences'
import { compileReferencePrompt, promptSegmentsFor } from '../../functions/_lib/reference-bindings.js'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const assets = [{ id: 'scene-id', name: '茶馆场景', url: '/scene.png' }, { id: 'character-id', name: '掌柜', url: '/actor.png' }]
function Editor({ initial = '镜头前景。镜头后景。' }) {
  const [draft, setDraft] = useState({ prompt: initial, referenceBindings: [], referencedAssetIds: [] })
  return <><ShotReferenceEditor value={draft.prompt} bindings={draft.referenceBindings} assets={assets} onChange={patch => setDraft(current => ({ ...current, ...patch }))} /><output aria-label="实际引用ID">{draft.referencedAssetIds.join(',')}</output></>
}
it('mention_inserts_asset_at_current_cursor without dropping or reordering surrounding text', async () => {
  render(<Editor />)
  const field = screen.getByRole('textbox', { name: '当前镜头视频提示词' })
  field.focus(); field.setSelectionRange(5, 5)
  fireEvent.click(screen.getByRole('button', { name: '在光标位置引用素材' }))
  fireEvent.click(screen.getByRole('button', { name: '引用 茶馆场景' }))
  expect(field).toHaveValue('镜头前景。@图片1镜头后景。')
  expect(screen.getByLabelText('实际引用ID')).toHaveTextContent('scene-id')
  await waitFor(() => expect(field.selectionStart).toBe(9))
})
it('typing @ in the middle replaces only that marker and binds the selected asset ID', () => {
  render(<Editor initial="前景后景" />)
  const field = screen.getByRole('textbox', { name: '当前镜头视频提示词' })
  fireEvent.change(field, { target: { value: '前景@后景', selectionStart: 3, selectionEnd: 3 } })
  fireEvent.click(screen.getByRole('button', { name: '引用 掌柜' }))
  expect(field).toHaveValue('前景@图片1后景')
  expect(screen.getByLabelText('实际引用ID')).toHaveTextContent('character-id')
})
it('provider prompt and prompt segments bind tokens to exact IDs even when labels repeat', () => {
  const bindings = [{ assetId: 'scene-id', token: '@图片3' }, { assetId: 'character-id', token: '@图片8' }]
  expect(compileReferencePrompt('@图片8走入@图片3', ['scene-id', 'character-id'], bindings)).toBe('[Image2]走入[Image1]')
  expect(promptSegmentsFor('前景@图片3后景', bindings)).toEqual([{ type: 'text', text: '前景' }, { type: 'asset', assetId: 'scene-id', token: '@图片3' }, { type: 'text', text: '后景' }])
  expect(() => promptSegmentsFor('@图片9', bindings)).toThrow('未绑定素材')
})
