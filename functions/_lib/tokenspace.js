export const BASE_URL = 'https://tokenspace.io'
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export const apiKeyFrom = context => String(context.env?.TOKENSPACE_API_KEY || '').trim()
export async function tokenSpaceRequest(context, endpoint, { model, payload, form } = {}) {
  const apiKey = apiKeyFrom(context)
  if (!apiKey) return { response: json(503, { error: 'TOKENSPACE_API_KEY_NOT_CONFIGURED' }) }
  console.log({ provider: 'tokenspace', apiKeyConfigured: true, apiKeyLength: apiKey.length, endpoint, model })
  try {
    const response = await fetch(`${BASE_URL}/v1/${endpoint}`, {
      method: 'POST',
      headers: form ? { Authorization: `Bearer ${apiKey}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: form || JSON.stringify(payload),
      signal: AbortSignal.timeout(1800000),
    })
    const text = await response.text()
    if (!response.ok) { console.error({ provider: 'tokenspace', status: response.status, response: text }); return { response: json(response.status, { provider: 'tokenspace', status: response.status, error: text }) } }
    try { return { data: JSON.parse(text) } } catch { return { response: json(502, { provider: 'tokenspace', status: 502, error: 'TokenSpace returned invalid JSON' }) } }
  } catch (error) { console.error({ provider: 'tokenspace', status: 502, response: error.message }); return { response: json(502, { provider: 'tokenspace', status: 502, error: error.cause?.code || error.message }) } }
}
