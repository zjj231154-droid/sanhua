import { json } from '../../../_lib/tokenspace.js'
import { requireIdentity } from '../../../_lib/collaboration.js'
import { activeStatuses, cancelCenterTask, centerDetail, centerItems, centerSummary, retryCenterTask } from '../../../_lib/task-center-store.js'
import { updateWorkRecord } from '../../../_lib/work-record-store.js'
import { updateTask } from '../../../_lib/task-store.js'
import { archiveImageOutputs } from '../../../_lib/asset-store.js'
const archiveLocks = new Set()
const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const [id] = parts(context)
  if (id) { const detail = await centerDetail(context, identity, id); return detail ? json(200, detail) : json(404, { error: 'TASK_NOT_FOUND' }) }
  const query = new URL(context.request.url).searchParams
  const items = await centerItems(context, identity, { includeArchived: query.get('includeArchived') === 'true' })
  if (!items) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
  const active = items.filter(item => activeStatuses.has(item.status))
  const ended = items.filter(item => !activeStatuses.has(item.status)).sort((a, b) => String(b.completedAt || b.updatedAt).localeCompare(String(a.completedAt || a.updatedAt)))
  const count = Math.max(1, Math.min(100, Number(query.get('recentCompleted')) || 8))
  const size = Math.max(1, Math.min(100, Number(query.get('pageSize')) || 20)), page = Math.max(1, Number(query.get('page')) || 1)
  return json(200, { summary: centerSummary(active, ended), active, recentCompleted: ended.slice(0, count), recentCompletedTotal: ended.length,
    items: items.slice((page - 1) * size, page * size), tasks: items.slice((page - 1) * size, page * size), total: items.length, page, pageSize: size, updatedAt: new Date().toISOString() })
}
export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const [id, action] = parts(context)
  let input; try { input = await context.request.json() } catch { return json(400, { error: 'INVALID_JSON' }) }
  if (action === 'cancel' || action === 'retry') {
    const result = await (action === 'cancel' ? cancelCenterTask : retryCenterTask)(context, identity, id, input)
    return json(result.status, result.data)
  }
  if (action === 'refresh') { const detail = await centerDetail(context, identity, id); return detail ? json(200, detail) : json(404, { error: 'TASK_NOT_FOUND' }) }
  if (action === 'archive-results') {
    const detail = await centerDetail(context, identity, id)
    if (!detail) return json(404, { error: 'TASK_NOT_FOUND' })
    if (['cancelled', 'archived'].includes(detail.item.status)) return json(409, { error: 'TASK_ENDED' })
    const task = detail.tasks.find(item => item.pendingArchive)
    if (!task) return json(409, { error: 'NO_PENDING_RESULTS' })
    if (archiveLocks.has(id)) return json(409, { error: 'ARCHIVE_IN_PROGRESS' })
    archiveLocks.add(id)
    try {
      const archived = await archiveImageOutputs({ ...context, workRecordId: detail.record?.taskId }, task.pendingArchive)
      if (archived.error) return archived.error
      await updateTask(context, task.id, { status: 'completed', progress: 100, pendingArchive: null, error: '', outputIds: archived.assets.map(asset => asset.id), stage: '结果已重新归档' })
      return json(200, { ...(await centerDetail(context, identity, id)), notice: '结果已重新归档' })
    } catch { return json(502, { error: 'RESULT_ARCHIVE_FAILED', hint: '结果仍保留，请重试归档。' }) }
    finally { archiveLocks.delete(id) }
  }
  if (action === 'archive') {
    const detail = await centerDetail(context, identity, id)
    if (!detail) return json(404, { error: 'TASK_NOT_FOUND' })
    if (activeStatuses.has(detail.item.status)) return json(409, { error: 'TASK_STILL_ACTIVE' })
    if (detail.record) await updateWorkRecord(context, detail.record.taskId, { status: 'archived' })
    for (const task of detail.tasks) await updateTask(context, task.id, { hiddenAt: new Date().toISOString() })
    return json(200, { archived: true })
  }
  return json(404, { error: 'TASK_CENTER_ROUTE_NOT_FOUND' })
}
