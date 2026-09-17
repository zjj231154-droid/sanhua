import { json } from '../../../_lib/tokenspace.js'
import { createScript, getScript, listScripts, listVersions, restoreVersion, saveVersion, setScriptDeleted, updateScript } from '../../../_lib/script-store.js'

const readBody = async request => { try { return await request.json() } catch { return null } }
const routeParts = context => (Array.isArray(context.params.path) ? context.params.path : String(context.params.path || '').split('/')).filter(Boolean)
const unavailable = value => value === null ? json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) : null

export async function onRequestGet(context) {
  const [id, action] = routeParts(context)
  if (!id) {
    const includeDeleted = new URL(context.request.url).searchParams.get('includeDeleted') === 'true'
    const scripts = await listScripts(context, { includeDeleted })
    return unavailable(scripts) || json(200, { scripts })
  }
  if (action === 'versions') { const versions = await listVersions(context, id); return unavailable(versions) || json(200, { versions }) }
  const script = await getScript(context, id)
  return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}

export async function onRequestPost(context) {
  const [id, action] = routeParts(context)
  const input = await readBody(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  if (!id) {
    if (!String(input.title || '').trim()) return json(400, { error: 'SCRIPT_TITLE_REQUIRED' })
    const script = await createScript(context, input)
    return unavailable(script) || json(201, { script })
  }
  if (action === 'versions') { const result = await saveVersion(context, id, input); return result ? json(201, result) : json(404, { error: 'SCRIPT_NOT_FOUND' }) }
  if (action === 'restore-version') { const script = await restoreVersion(context, id, input.versionId); return script ? json(200, { script }) : json(404, { error: 'SCRIPT_VERSION_NOT_FOUND' }) }
  if (action === 'restore') { const script = await setScriptDeleted(context, id, false); return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' }) }
  return json(404, { error: 'SCRIPT_ROUTE_NOT_FOUND' })
}

export async function onRequestPatch(context) {
  const [id] = routeParts(context)
  const input = await readBody(context.request)
  if (!id || !input) return json(400, { error: !id ? 'SCRIPT_ID_REQUIRED' : '请求格式必须是 JSON' })
  const script = await updateScript(context, id, input)
  return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}

export async function onRequestDelete(context) {
  const [id] = routeParts(context)
  if (!id) return json(400, { error: 'SCRIPT_ID_REQUIRED' })
  const script = await setScriptDeleted(context, id, true)
  return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}
