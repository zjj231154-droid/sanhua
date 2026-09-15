const TOKENSPACE_BASE_URL = 'https://tokenspace.io'
const USEGOODAI_BASE_URL = 'https://api.usegoodai.com'
export const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export const providerFrom = context => {
  const useGoodKey = String(context.env?.USEGOODAI_API_KEY || '').trim()
  return useGoodKey ? { name: 'usegoodai', apiKey: useGoodKey, baseUrl: USEGOODAI_BASE_URL } : { name: 'tokenspace', apiKey: String(context.env?.TOKENSPACE_API_KEY || '').trim(), baseUrl: TOKENSPACE_BASE_URL }
}
export const apiKeyFrom = context => providerFrom(context).apiKey
export async function tokenSpaceRequest(context, endpoint, { model, payload, form } = {}) {
  const provider = providerFrom(context)
  if (!provider.apiKey) return { response: json(503, { error: 'API_KEY_NOT_CONFIGURED' }) }
  console.log({ provider: provider.name, apiKeyConfigured: true, apiKeyLength: provider.apiKey.length, endpoint, model })
  try {
    const response = await fetch(`${provider.baseUrl}/v1/${endpoint}`, {
      method: 'POST',
      headers: form ? { Authorization: `Bearer ${provider.apiKey}` } : { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: form || JSON.stringify(payload),
      signal: AbortSignal.timeout(1800000),
    })
    const text = await response.text()
    if (!response.ok) { console.error({ provider: provider.name, status: response.status, response: text }); return { response: json(response.status, { provider: provider.name, status: response.status, error: text }) } }
    try { return { data: JSON.parse(text) } } catch { return { response: json(502, { provider: provider.name, status: 502, error: 'Provider returned invalid JSON' }) } }
  } catch (error) { console.error({ provider: provider.name, status: 502, response: error.message }); return { response: json(502, { provider: provider.name, status: 502, error: error.cause?.code || error.message }) } }
}
