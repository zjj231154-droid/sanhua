import { json } from '../../_lib/tokenspace.js'
const gateways = ['https://tokenspace.io', 'https://api.tokenspace.tech']
export async function onRequestGet(context) {
  const apiKey = String(context.env?.TOKENSPACE_API_KEY || '').trim()
  if (!apiKey) return json(503, { error: 'TOKENSPACE_API_KEY_NOT_CONFIGURED' })
  const results = []
  for (const baseUrl of gateways) {
    try {
      const response = await fetch(`${baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30000) })
      const body = await response.text()
      console.log({ provider: 'tokenspace', endpoint: `${baseUrl}/v1/models`, apiKeyConfigured: true, apiKeyLength: apiKey.length, status: response.status })
      results.push({ baseUrl, status: response.status, body: body.slice(0, 12000) })
    } catch (error) {
      console.error({ provider: 'tokenspace', endpoint: `${baseUrl}/v1/models`, status: 502, response: error.message })
      results.push({ baseUrl, status: 502, body: error.cause?.code || error.message })
    }
  }
  return json(200, { results })
}
