import { assetsBucket, getJson, listJson, putJson } from './asset-store.js'

const scriptKey = id => `metadata/scripts/${id}.json`
const versionKey = (scriptId, id) => `metadata/script-versions/${scriptId}/${id}.json`
const now = () => new Date().toISOString()

const requireBucket = context => assetsBucket(context) || null
const text = (value, limit = 12000) => String(value || '').trim().slice(0, limit)

export async function listScripts(context, { includeDeleted = false } = {}) {
  const bucket = requireBucket(context)
  if (!bucket) return null
  const values = await listJson(bucket, 'metadata/scripts/')
  return values.filter(item => includeDeleted || !item.deletedAt).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function getScript(context, id) {
  const bucket = requireBucket(context)
  return bucket ? getJson(bucket, scriptKey(id)) : null
}

export async function listVersions(context, scriptId) {
  const bucket = requireBucket(context)
  if (!bucket) return null
  return (await listJson(bucket, `metadata/script-versions/${scriptId}/`)).sort((a, b) => Number(b.versionNo) - Number(a.versionNo))
}

export async function createScript(context, input = {}) {
  const bucket = requireBucket(context)
  if (!bucket) return null
  const createdAt = now()
  const id = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const values = { title: text(input.title, 80), kind: text(input.kind, 80), summary: text(input.summary, 3000), outline: text(input.outline, 12000), content: text(input.content, 24000) }
  const script = { id, tenantId: input.workspaceId || 'default', workspaceId: input.workspaceId || 'default', projectId: 'script', storeId: 'day-coffee-night-bar', workspace: 'script', status: 'active', sourceAssetIds: Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds.slice(0, 50) : [], createdBy: input.createdBy || 'demo-designer', updatedBy: input.updatedBy || input.createdBy || 'demo-designer', version: 1, currentVersionId: versionId, versionCount: 1, ...values, createdAt, updatedAt: createdAt }
  const version = { id: versionId, scriptId: id, workspaceId: script.workspaceId, versionNo: 1, ...values, changeNote: '初始版本', savedBy: script.createdBy, savedAt: createdAt }
  await putJson(bucket, scriptKey(id), script)
  await putJson(bucket, versionKey(id, versionId), version)
  return script
}

export async function updateScript(context, id, input = {}) {
  const bucket = requireBucket(context)
  const current = bucket ? await getJson(bucket, scriptKey(id)) : null
  if (!current || current.deletedAt) return null
  const values = { title: input.title === undefined ? current.title : text(input.title, 80), kind: input.kind === undefined ? current.kind : text(input.kind, 80), summary: input.summary === undefined ? current.summary : text(input.summary, 3000), outline: input.outline === undefined ? current.outline : text(input.outline, 12000), content: input.content === undefined ? current.content : text(input.content, 24000), sourceAssetIds: input.sourceAssetIds === undefined ? current.sourceAssetIds : Array.isArray(input.sourceAssetIds) ? input.sourceAssetIds.slice(0, 50) : [] }
  if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) return { conflict: current }
  const next = { ...current, ...values, updatedBy: input.updatedBy || 'demo-designer', version: Number(current.version || 0) + 1, updatedAt: now() }
  await putJson(bucket, scriptKey(id), next)
  return next
}

export async function saveVersion(context, id, input = {}) {
  const script = await updateScript(context, id, input)
  if (!script) return null
  if (script.conflict) return script
  const bucket = requireBucket(context)
  const version = { id: crypto.randomUUID(), scriptId: id, workspaceId: script.workspaceId, versionNo: Number(script.versionCount || 0) + 1, title: script.title, kind: script.kind, summary: script.summary, outline: script.outline, content: script.content, changeNote: text(input.changeNote, 300) || '手动保存版本', savedBy: input.updatedBy || script.updatedBy, savedAt: now() }
  const next = { ...script, currentVersionId: version.id, versionCount: version.versionNo, version: Number(script.version || 0) + 1, updatedAt: version.savedAt }
  await putJson(bucket, versionKey(id, version.id), version)
  await putJson(bucket, scriptKey(id), next)
  return { script: next, version }
}

export async function restoreVersion(context, id, versionId, actorId = 'demo-designer') {
  const bucket = requireBucket(context)
  const script = bucket ? await getJson(bucket, scriptKey(id)) : null
  const version = bucket ? await getJson(bucket, versionKey(id, versionId)) : null
  if (!script || !version || script.deletedAt) return null
  const next = { ...script, title: version.title, kind: version.kind, summary: version.summary, outline: version.outline, content: version.content, currentVersionId: version.id, updatedBy: actorId, version: Number(script.version || 0) + 1, updatedAt: now() }
  await putJson(bucket, scriptKey(id), next)
  return next
}

export async function setScriptDeleted(context, id, deleted, actorId = 'demo-designer') {
  const bucket = requireBucket(context)
  const script = bucket ? await getJson(bucket, scriptKey(id)) : null
  if (!script) return null
  const next = { ...script, deletedAt: deleted ? now() : null, updatedBy: actorId, version: Number(script.version || 0) + 1, updatedAt: now() }
  await putJson(bucket, scriptKey(id), next)
  return next
}
