import { json } from '../../../_lib/tokenspace.js'
import { createScript, getScript, listScripts, listVersions, restoreVersion, saveVersion, setScriptDeleted, updateScript } from '../../../_lib/script-store.js'
import { requireIdentity } from '../../../_lib/collaboration.js'

const readBody = async request => { try { return await request.json() } catch { return null } }
const routeParts = context => (Array.isArray(context.params.path) ? context.params.path : String(context.params.path || '').split('/')).filter(Boolean)
const unavailable = value => value === null ? json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) : null

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const [id, action] = routeParts(context)
  if (!id) {
    const includeDeleted = new URL(context.request.url).searchParams.get('includeDeleted') === 'true'
    const scripts = await listScripts(context, { includeDeleted })
    return unavailable(scripts) || json(200, { scripts: identity.compatibilityMode ? scripts : scripts.filter(script => script.workspaceId === identity.workspaceId) })
  }
  if (action === 'versions') { const script = await getScript(context, id); if (!script || (!identity.compatibilityMode && script.workspaceId !== identity.workspaceId)) return json(404, { error: 'SCRIPT_NOT_FOUND' }); const versions = await listVersions(context, id); return unavailable(versions) || json(200, { versions }) }
  const script = await getScript(context, id)
  return script && (identity.compatibilityMode || script.workspaceId === identity.workspaceId) ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action] = routeParts(context)
  const input = await readBody(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  if (!id) {
    if (!String(input.title || '').trim()) return json(400, { error: 'SCRIPT_TITLE_REQUIRED' })
    const script = await createScript(context, { ...input, workspaceId: identity.workspaceId, createdBy: identity.user.id, updatedBy: identity.user.id })
    return unavailable(script) || json(201, { script })
  }
  const current = await getScript(context, id); if (!current || (!identity.compatibilityMode && current.workspaceId !== identity.workspaceId)) return json(404, { error: 'SCRIPT_NOT_FOUND' })
  if (!identity.compatibilityMode && !Number.isInteger(input.expectedVersion)) return json(400, { error: 'EXPECTED_VERSION_REQUIRED' })
  if (action === 'versions') { const result = await saveVersion(context, id, { ...input, updatedBy: identity.user.id }); return result?.conflict ? json(409, { error: 'VERSION_CONFLICT', currentVersion: result.conflict.version }) : result ? json(201, result) : json(404, { error: 'SCRIPT_NOT_FOUND' }) }
  if (action === 'restore-version') { const script = await restoreVersion(context, id, input.versionId, identity.user.id); return script ? json(200, { script }) : json(404, { error: 'SCRIPT_VERSION_NOT_FOUND' }) }
  if (action === 'restore') { const script = await setScriptDeleted(context, id, false, identity.user.id); return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' }) }
  return json(404, { error: 'SCRIPT_ROUTE_NOT_FOUND' })
}

export async function onRequestPatch(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id] = routeParts(context)
  const input = await readBody(context.request)
  if (!id || !input) return json(400, { error: !id ? 'SCRIPT_ID_REQUIRED' : '请求格式必须是 JSON' })
  const existing = await getScript(context, id); if (!existing || (!identity.compatibilityMode && existing.workspaceId !== identity.workspaceId)) return json(404, { error: 'SCRIPT_NOT_FOUND' })
  if (!identity.compatibilityMode && !Number.isInteger(input.expectedVersion)) return json(400, { error: 'EXPECTED_VERSION_REQUIRED' })
  const script = await updateScript(context, id, { ...input, updatedBy: identity.user.id })
  return script?.conflict ? json(409, { error: 'VERSION_CONFLICT', currentVersion: script.conflict.version, updatedBy: script.conflict.updatedBy, updatedAt: script.conflict.updatedAt }) : script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}

export async function onRequestDelete(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id] = routeParts(context)
  if (!id) return json(400, { error: 'SCRIPT_ID_REQUIRED' })
  const existing = await getScript(context, id); if (!existing || (!identity.compatibilityMode && existing.workspaceId !== identity.workspaceId)) return json(404, { error: 'SCRIPT_NOT_FOUND' })
  const script = await setScriptDeleted(context, id, true, identity.user.id)
  return script ? json(200, { script }) : json(404, { error: 'SCRIPT_NOT_FOUND' })
}
