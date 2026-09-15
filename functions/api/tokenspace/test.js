import { json, tokenSpaceRequest } from '../../../_lib/tokenspace.js'
export async function onRequestGet(context) {
  const result = await tokenSpaceRequest(context, 'chat/completions', { model: 'gpt-5.6-luna', payload: { model: 'gpt-5.6-luna', messages: [{ role: 'user', content: 'Reply with exactly: connection successful' }] } })
  if (result.response) return result.response
  return json(200, { success: true, provider: 'tokenspace' })
}
