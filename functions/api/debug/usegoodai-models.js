import { json } from '../../_lib/tokenspace.js'

export async function onRequestGet(context) {
  const apiKey = String(context.env?.USEGOODAI_REASONING_API_KEY || context.env?.USEGOODAI_API_KEY || '').trim()
  if (!apiKey) return json(503, { provider: 'usegoodai', configured: false, models: [] })
  try {
    const response = await fetch('https://api.usegoodai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) })
    const text = await response.text()
    if (!response.ok) return json(response.status, { provider: 'usegoodai', configured: true, error: text.slice(0, 1200), models: [] })
    const data = JSON.parse(text)
    return json(200, { provider: 'usegoodai', configured: true, models: (Array.isArray(data.data) ? data.data : []).map(item => item.id).filter(id => typeof id === 'string').slice(0, 200) })
  } catch (error) { return json(502, { provider: 'usegoodai', configured: true, error: error.message, models: [] }) }
}
