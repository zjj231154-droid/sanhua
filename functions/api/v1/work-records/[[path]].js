import { json } from '../../../_lib/tokenspace.js'
import { createWorkRecord, getWorkRecord, listWorkRecords, updateWorkRecord, validModule, validStatus } from '../../../_lib/work-record-store.js'
import { requireIdentity } from '../../../_lib/collaboration.js'

const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
const read = async request => { try { return await request.json() } catch { return null } }
const unavailable = value => value === null ? json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) : null
const owned = (record, identity) => record && (identity.compatibilityMode || (record.workspaceId === identity.workspaceId && record.ownerUserId === identity.user.id))

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const [id] = parts(context)
  if (id) {
    const record = await getWorkRecord(context, id)
    return owned(record, identity) ? json(200, { item: record, record }) : json(404, { error: 'WORK_RECORD_NOT_FOUND' })
  }
  const url = new URL(context.request.url)
  const result = await listWorkRecords(context, { workspaceId: identity.workspaceId, ownerUserId: identity.user.id, moduleKey: url.searchParams.get('moduleKey') || undefined, status: url.searchParams.get('status') || undefined, page: url.searchParams.get('page'), pageSize: url.searchParams.get('pageSize'), includeArchived: url.searchParams.get('includeArchived') === 'true' })
  return unavailable(result) || json(200, result)
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action] = parts(context)
  const input = await read(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  if (id) {
    const current = await getWorkRecord(context, id)
    if (!owned(current, identity)) return json(404, { error: 'WORK_RECORD_NOT_FOUND' })
    if (action === 'submit') {
      if (current.providerTaskId) return json(200, { item: current, record: current, idempotent: true })
      if (!['draft', 'ready'].includes(current.status)) return json(409, { error: 'WORK_RECORD_NOT_SUBMITTABLE', status: current.status })
      const record = await updateWorkRecord(context, id, { ...input, status: 'queued', progress: 0, updatedBy: identity.user.id, expectedVersion: input.expectedVersion ?? current.version })
      if (record?.conflict) return json(409, { error: 'VERSION_CONFLICT', currentVersion: record.conflict.version, updatedAt: record.conflict.updatedAt })
      return unavailable(record) || json(200, { item: record, record })
    }
    if (action === 'retry') {
      const record = await updateWorkRecord(context, id, { ...input, status: 'queued', progress: 0, errorCode: '', errorMessage: '', retryCount: Number(current.retryCount || 0) + 1, updatedBy: identity.user.id, expectedVersion: input.expectedVersion ?? current.version })
      if (record?.conflict) return json(409, { error: 'VERSION_CONFLICT', currentVersion: record.conflict.version, updatedAt: record.conflict.updatedAt })
      return unavailable(record) || json(200, { item: record, record })
    }
    if (action === 'cancel') {
      const record = await updateWorkRecord(context, id, { ...input, status: 'cancelled', updatedBy: identity.user.id, expectedVersion: input.expectedVersion ?? current.version })
      if (record?.conflict) return json(409, { error: 'VERSION_CONFLICT', currentVersion: record.conflict.version, updatedAt: record.conflict.updatedAt })
      return unavailable(record) || json(200, { item: record, record })
    }
    if (action === 'archive') {
      const record = await updateWorkRecord(context, id, { ...input, status: 'archived', updatedBy: identity.user.id, expectedVersion: input.expectedVersion ?? current.version })
      if (record?.conflict) return json(409, { error: 'VERSION_CONFLICT', currentVersion: record.conflict.version, updatedAt: record.conflict.updatedAt })
      return unavailable(record) || json(200, { item: record, record })
    }
    return json(404, { error: 'WORK_RECORD_ROUTE_NOT_FOUND' })
  }
  if (!validModule(input.moduleKey)) return json(400, { error: 'MODULE_KEY_REQUIRED' })
  const result = await listWorkRecords(context, { workspaceId: identity.workspaceId, ownerUserId: identity.user.id, includeArchived: true, page: 1, pageSize: 100 })
  if (result?.items.some(record => record.status !== 'archived' && record.clientSessionId && record.clientSessionId === String(input.clientSessionId || '') && record.moduleKey === input.moduleKey)) {
    const existing = result.items.find(record => record.status !== 'archived' && record.clientSessionId === String(input.clientSessionId || '') && record.moduleKey === input.moduleKey)
    return json(200, { item: existing, record: existing, existing: true })
  }
  const record = await createWorkRecord(context, { ...input, workspaceId: identity.workspaceId, ownerUserId: identity.user.id })
  return unavailable(record) || (record?.invalid ? json(400, { error: record.invalid }) : json(201, { item: record, record }))
}

export async function onRequestPatch(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id] = parts(context); const input = await read(context.request)
  if (!id || !input) return json(400, { error: !id ? 'WORK_RECORD_ID_REQUIRED' : '请求格式必须是 JSON' })
  const current = await getWorkRecord(context, id)
  if (!owned(current, identity)) return json(404, { error: 'WORK_RECORD_NOT_FOUND' })
  if (input.status && !validStatus(input.status)) return json(400, { error: 'INVALID_STATUS' })
  const record = await updateWorkRecord(context, id, { ...input, updatedBy: identity.user.id })
  if (record?.conflict) return json(409, { error: 'VERSION_CONFLICT', currentVersion: record.conflict.version, updatedAt: record.conflict.updatedAt })
  if (record?.invalid) return json(400, { error: record.invalid })
  return unavailable(record) || (record ? json(200, { item: record, record }) : json(404, { error: 'WORK_RECORD_NOT_FOUND' }))
}
