import { apiKeyFrom, json } from '../../_lib/tokenspace.js'
export async function onRequestGet(context) {
  const key = apiKeyFrom(context)
  return json(200, { configured: Boolean(key), keyLength: key.length, startsWithSk: key.startsWith('sk-') })
}
