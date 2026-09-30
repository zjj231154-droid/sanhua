import { json } from '../../../_lib/tokenspace.js'
import { requireIdentity } from '../../../_lib/collaboration.js'
import { getWorkRecord, listWorkRecords } from '../../../_lib/work-record-store.js'
import { getTask, listTasks } from '../../../_lib/task-store.js'

const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
const unifiedStatus = status => ({ completed: 'succeeded', waiting_user: 'ready', queued: 'queued', running: 'running', failed: 'failed', cancelled: 'cancelled' }[status] || status || 'draft')
const ownedRecord = (record, identity) => record && (identity.compatibilityMode || (record.workspaceId === identity.workspaceId && record.ownerUserId === identity.user.id))
const ownedTask = (task, identity) => task && (identity.compatibilityMode || task.workspaceId === identity.workspaceId || task.ownerUserId === identity.user.id || task.createdBy === identity.user.id)

function recordItem(record) {
  return {
    ...record,
    id: record.taskId,
    workRecordId: record.taskId,
    status: unifiedStatus(record.status),
    stage: record.operationSummary || (record.status === 'draft' ? '编辑中' : '处理中'),
    error: record.errorMessage || '',
    taskSource: 'work_record',
  }
}

function legacyItem(task) {
  return {
    ...task,
    id: task.id,
    taskId: task.id,
    workRecordId: task.workRecordId || task.taskId || '',
    status: unifiedStatus(task.status),
    stage: task.stage || task.operationSummary || '处理中',
    error: task.error || task.errorMessage || '',
    taskSource: 'legacy_task',
  }
}

async function allItems(context, identity, url) {
  const records = await listWorkRecords(context, {
    ...(identity.compatibilityMode ? {} : { workspaceId: identity.workspaceId, ownerUserId: identity.user.id }),
    includeArchived: url.searchParams.get('includeArchived') === 'true', page: 1, pageSize: 100,
  })
  if (records === null) return null
  const legacy = await listTasks(context, { workspaceId: identity.workspaceId, compatibilityMode: identity.compatibilityMode, includeHidden: 'false' })
  const merged = new Map()
  for (const record of records.items || []) merged.set(record.taskId, recordItem(record))
  for (const task of legacy) {
    const key = task.workRecordId || task.taskId || task.id
    if (merged.has(key)) {
      const current = merged.get(key)
      merged.set(key, { ...current, providerTaskId: current.providerTaskId || task.providerTaskId || task.id, legacyTaskId: task.id, legacyStatus: task.status, status: unifiedStatus(task.status) === 'draft' ? current.status : unifiedStatus(task.status), stage: task.stage || current.stage, progress: Math.max(Number(current.progress || 0), Number(task.progress || 0)), error: current.error || task.error || '' })
    } else merged.set(key, legacyItem(task))
  }
  const wantedStatus = String(url.searchParams.get('status') || '').split(',').map(value => value.trim()).filter(Boolean)
  const moduleKey = url.searchParams.get('moduleKey') || ''
  const items = [...merged.values()]
    .filter(item => !moduleKey || item.moduleKey === moduleKey || item.workspace === moduleKey || item.projectId === moduleKey)
    .filter(item => !wantedStatus.length || wantedStatus.includes(item.status))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
  return items
}

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const [id] = parts(context)
  if (id) {
    const record = await getWorkRecord(context, id)
    if (ownedRecord(record, identity)) return json(200, { item: recordItem(record), record })
    const task = await getTask(context, id)
    return ownedTask(task, identity) ? json(200, { item: legacyItem(task), task }) : json(404, { error: 'TASK_CENTER_ITEM_NOT_FOUND' })
  }
  const url = new URL(context.request.url)
  const items = await allItems(context, identity, url)
  if (items === null) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  const size = Math.max(1, Math.min(100, Number(url.searchParams.get('pageSize')) || 20))
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const start = (page - 1) * size
  return json(200, { items: items.slice(start, start + size), tasks: items.slice(start, start + size), total: items.length, page, pageSize: size, nextCursor: start + size < items.length ? String(start + size) : null })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action] = parts(context)
  if (!id || action !== 'refresh') return json(404, { error: 'TASK_CENTER_ROUTE_NOT_FOUND' })
  const record = await getWorkRecord(context, id)
  if (ownedRecord(record, identity)) return json(200, { item: recordItem(record), record, refreshed: true })
  const task = await getTask(context, id)
  return ownedTask(task, identity) ? json(200, { item: legacyItem(task), task, refreshed: true }) : json(404, { error: 'TASK_CENTER_ITEM_NOT_FOUND' })
}
