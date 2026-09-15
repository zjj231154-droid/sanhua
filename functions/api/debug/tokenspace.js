import { providerFrom, json } from '../../_lib/tokenspace.js'
export async function onRequestGet(context) {
  const provider = providerFrom(context)
  return json(200, { provider: provider.name, configured: Boolean(provider.apiKey), keyLength: provider.apiKey.length, startsWithSk: provider.apiKey.startsWith('sk-') })
}
