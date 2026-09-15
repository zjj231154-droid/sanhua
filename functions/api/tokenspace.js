const BASE_URL = 'https://api.tokenspace.tech'
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export async function onRequestGet(context) {
  const token = String(context.env?.TOKENSPACE_API_KEY || '').trim()
  return json(200, { tokenSpaceConfigured: !!token, tokenSpaceKeyLength: token.length })
}
export async function onRequestPost(context) {
  const { request } = context
  const token = String(context.env?.TOKENSPACE_API_KEY || '').trim()
  if (!token) return json(503, { upstream: 'tokenspace', status: 503, error: 'TOKENSPACE_API_KEY is not configured' })
  let input
  try { input = await request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const type = ['prompt', 'image', 'video'].includes(input.type) ? input.type : 'prompt'
  const endpoint = type === 'image' ? 'images/generations' : type === 'video' ? 'videos/generations' : 'chat/completions'
  const model = String(input.model || (type === 'image' ? 'gpt-image-2' : type === 'video' ? 'sora-2' : 'gpt-5.6-luna')).slice(0, 160)
  const payload = type === 'prompt'
    ? { model, messages: [{ role: 'user', content: String(input.prompt || '').slice(0, 10000) }] }
    : { model, prompt: String(input.prompt || '').slice(0, 10000), size: input.size || '1024x1024', response_format: 'b64_json' }
  if (!payload.prompt && type !== 'prompt') return json(400, { error: '请填写提示词' })
  try {
    const response = await fetch(`${BASE_URL}/v1/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(1800000) })
    const text = await response.text()
    if (!response.ok) return json(response.status, { upstream: 'tokenspace', status: response.status, error: text.slice(0, 4000) })
    let data
    try { data = JSON.parse(text) } catch { return json(502, { error: 'TokenSpace 返回了无效 JSON' }) }
    return json(200, { type, data })
  } catch (error) { console.error('[TokenSpace]', { endpoint, message: error.message, cause: error.cause?.message || error.cause?.code || null }); return json(502, { upstream: 'tokenspace', status: 502, error: error.cause?.code || error.message }) }
}
