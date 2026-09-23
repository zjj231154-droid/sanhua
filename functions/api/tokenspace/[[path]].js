import { json, tokenSpaceRequest, DEFAULT_REASONING_MODEL, providerFrom } from '../../_lib/tokenspace.js'
const dataUrlToBlob = value => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || '')
  if (!match) return null
  return new Blob([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], { type: match[1] })
}
export async function onRequestGet(context) {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path
  if (path !== 'test') return json(405, { error: 'METHOD_NOT_ALLOWED' })
  // This endpoint deliberately performs a tiny completion rather than merely
  // checking whether a key exists or whether the provider's /models endpoint
  // is reachable. It therefore verifies the configured key, route and model.
  const provider = providerFrom(context, 'usegoodai-reasoning')
  const model = String(context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL).trim()
  if (!provider.apiKey) return json(503, { error: 'API_KEY_NOT_CONFIGURED', provider: provider.name, requestedModel: model })
  const startedAt = Date.now()
  try {
    const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: connection successful' }], max_tokens: 16, temperature: 0 }),
      signal: AbortSignal.timeout(30000),
    })
    const raw = await response.text()
    let data
    try { data = JSON.parse(raw) } catch { data = null }
    const elapsedMs = Date.now() - startedAt
    if (!response.ok) {
      const message = String(data?.error?.message || data?.message || data?.error || `模型服务返回 HTTP ${response.status}`).slice(0, 500)
      return json(response.status, { error: message, provider: provider.name, requestedModel: model, elapsedMs })
    }
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) return json(502, { error: '模型已返回响应，但响应不含可读文本', provider: provider.name, requestedModel: model, elapsedMs })
    return json(200, { success: true, provider: provider.name, requestedModel: model, respondedModel: String(data?.model || model), reply: reply.trim().slice(0, 200), elapsedMs })
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    const message = error?.name === 'TimeoutError' ? '模型调用超过 30 秒未返回，请检查模型服务或稍后重试' : '无法连接模型服务，请检查 Railway 网络与 UseGoodAI 配置'
    return json(502, { error: message, provider: provider.name, requestedModel: model, elapsedMs })
  }
}
export async function onRequestPost(context) {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : context.params.path
  if (path) return json(404, { error: 'NOT_FOUND' })
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const type = ['prompt', 'analyze', 'image', 'edit', 'video'].includes(input.type) ? input.type : 'prompt'
  const model = String(input.model || (type === 'image' || type === 'edit' ? 'gpt-image-2' : type === 'video' ? 'sora-2' : context.env?.USEGOODAI_REASONING_MODEL || DEFAULT_REASONING_MODEL)).slice(0, 160)
  const prompt = String(input.prompt || '').slice(0, 10000)
  if (!prompt) return json(400, { error: '请填写提示词' })
  if (type === 'analyze') {
    const image = String(input.image || '').slice(0, 24_000_000)
    if (!dataUrlToBlob(image)) return json(400, { error: '图片识别需要 PNG、JPG 或 WebP 图片' })
    const payload = {
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ] }],
    }
    const result = await tokenSpaceRequest(context, 'chat/completions', { model, payload, provider: 'usegoodai-reasoning' })
    return result.response || json(200, { type, data: result.data })
  }
  if (type === 'edit') {
    const sources = Array.isArray(input.images) ? input.images : [input.image]
    const images = sources.map(dataUrlToBlob).filter(Boolean)
    if (!images.length) return json(400, { error: '图生图需要至少一张 PNG、JPG 或 WebP 图片' })
    const form = new FormData(); form.append('model', model); form.append('prompt', prompt); form.append('response_format', 'b64_json')
    images.forEach((image, index) => form.append(images.length === 1 ? 'image' : 'image[]', image, `source-${index}.png`))
    const result = await tokenSpaceRequest(context, 'images/edits', { model, form, provider: 'usegoodai' })
    return result.response || json(200, { type, data: result.data })
  }
  const endpoint = type === 'image' ? 'images/generations' : type === 'video' ? 'videos/generations' : 'chat/completions'
  const payload = type === 'prompt' ? { model, messages: [{ role: 'user', content: prompt }] } : { model, prompt, size: input.size || '1024x1024', response_format: 'b64_json' }
  const result = await tokenSpaceRequest(context, endpoint, { model, payload, provider: type === 'prompt' ? 'usegoodai-reasoning' : 'usegoodai' })
  return result.response || json(200, { type, data: result.data })
}
