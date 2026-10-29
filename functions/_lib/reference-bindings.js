export const referenceIdsFrom = value => Array.isArray(value) ? [...new Set(value.map(id => String(id || '').trim()).filter(Boolean))] : []
export function referenceBindingsFor(ids, bindings = []) {
  if (ids.length > 9) throw new Error('视频最多可引用 9 张图片，请减少选择。')
  const result = ids.map((assetId, index) => {
    const binding = bindings.find(item => item.assetId === assetId)
    const token = binding?.token || `@图片${index + 1}`
    if (!/^@图片[1-9]\d{0,2}$/.test(token)) throw new Error('素材引用标记无效，请重新选择素材。')
    return { assetId, token }
  })
  if (new Set(result.map(item => item.token)).size !== result.length) throw new Error('素材引用标记重复，请重新选择素材。')
  return result
}
export function promptSegmentsFor(prompt, bindings) {
  const segments = [], pattern = /@图片[1-9]\d{0,2}(?!\d)/g
  let last = 0
  for (const match of String(prompt || '').matchAll(pattern)) {
    const binding = bindings.find(item => item.token === match[0])
    if (!binding) throw new Error(`引用 ${match[0]} 未绑定素材，请重新选择。`)
    if (match.index > last) segments.push({ type: 'text', text: prompt.slice(last, match.index) })
    segments.push({ type: 'asset', assetId: binding.assetId, token: binding.token })
    last = match.index + match[0].length
  }
  if (last < prompt.length) segments.push({ type: 'text', text: prompt.slice(last) })
  return segments
}
export function compileReferencePrompt(prompt, ids, bindings) {
  return promptSegmentsFor(prompt, bindings).map(segment => segment.type === 'text' ? segment.text : `[Image${ids.indexOf(segment.assetId) + 1}]`).join('')
}
