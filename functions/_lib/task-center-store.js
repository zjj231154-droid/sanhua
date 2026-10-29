import { getWorkRecord, listWorkRecords, updateWorkRecord } from './work-record-store.js'
import { getTask, listTasks, updateTask } from './task-store.js'
import { resolvedVideoProviderConnection } from './collaboration.js'
import { resetExecution, stopExecution } from './task-execution.js'
import { ownsTask, taskScope } from './task-ownership.js'
export const activeStatuses = new Set(['draft', 'ready', 'queued', 'running', 'retrying', 'cancelling'])
export const taskStatus = status => ({ completed: 'succeeded', waiting_user: 'ready' }[status] || status || 'draft')
export const ownedRecord = ownsTask
export const ownedTask = ownsTask
const names = { retouch: '产品精修', brand: '品牌创作', script: '短剧脚本', video: '视频生成', assets: '资产库' }
const progress = value => value != null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : null
export function unifiedItem(record, tasks = []) {
  const latest = tasks.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]
  const item = record || latest
  if (!item) return null
  const moduleKey = record?.moduleKey || latest.workspace, cancelled = record?.status === 'cancelled'
  const state = record && (!latest || String(record.updatedAt || '') >= String(latest.updatedAt || '')) ? record : latest
  const status = cancelled ? 'cancelled' : taskStatus(state.status)
  const source = state.progressSource || 'unknown'
  const value = activeStatuses.has(status) && source !== 'provider' ? null : progress(state.progress)
  const { pendingArchive, ...safeItem } = item
  return { ...safeItem, archiveRetryAvailable: Boolean(latest?.pendingArchive || pendingArchive), visibility: 'private', ownerUserId: item.ownerUserId || item.createdBy, id: record?.taskId || latest.id, taskId: record?.taskId || latest.id, workRecordId: record?.taskId || latest.workRecordId || '', moduleKey, moduleName: record?.moduleName || names[moduleKey] || '创作任务', status,
    progress: value, progressSource: value == null ? 'unknown' : source, progressUpdatedAt: latest?.updatedAt || record?.progressUpdatedAt || item.updatedAt,
    archiveStatus: latest?.archiveStatus || record?.archiveStatus || 'pending', stage: state.stage || state.operationSummary || `第 ${record?.currentStep || 1} 步`, errorMessage: state.errorMessage || state.error || '', error: state.errorMessage || state.error || '',
    legacyTaskId: latest?.id || '', providerTaskId: latest?.providerTaskId || record?.providerTaskId || latest?.id || '', providerVideoUrl: latest?.providerVideoUrl || null, providerCancelSupported: record?.providerCancelSupported || false, taskSource: record ? 'work_record' : 'legacy_task',
    resultAssetIds: [...new Set([...(record?.resultAssetIds || []), ...tasks.flatMap(task => [...(task.outputIds || []), ...(task.videoAssetId ? [task.videoAssetId] : [])])])], resultTextRecordIds: [...new Set([...(record?.resultTextRecordIds || []), ...tasks.map(task => task.textRecordId).filter(Boolean)])],
    draftData: record?.draftData || { ...latest, requirements: latest?.requirements || '', selectedAssetIds: latest?.assets || [] },
    updatedAt: cancelled ? record.updatedAt : [record?.updatedAt, latest?.updatedAt].filter(Boolean).sort().at(-1), completedAt: record?.completedAt || latest?.completedAt || (!activeStatuses.has(status) ? latest?.updatedAt : null) }
}
export async function centerItems(context, identity, { sync = true, includeArchived = false } = {}) {
  const records = []
  for (let page = 1; ; page++) {
    const result = await listWorkRecords(context, { ...(identity.compatibilityMode ? {} : { workspaceId: identity.workspaceId, ownerUserId: identity.user.id }), includeArchived, page, pageSize: 100 })
    if (!result) return null
    records.push(...result.items)
    if (records.length >= result.total) break
  }
  let tasks = (await listTasks(context, taskScope(identity))).filter(task => ownedTask(task, identity))
  if (sync) {
    const { syncVideoTask } = await import('../api/v1/video-tasks/[[path]].js')
    tasks = await Promise.all(tasks.map(task => task.workspace === 'video' && ['queued', 'running'].includes(task.status) && !records.some(record => record.taskId === task.workRecordId && record.status === 'cancelled') ? syncVideoTask(context, task) : task))
  }
  const currentRecords = await Promise.all(records.map(record => getWorkRecord(context, record.taskId)))
  const items = currentRecords.filter(record => ownedRecord(record, identity)).map(record => unifiedItem(record, tasks.filter(task => task.workRecordId === record.taskId))), ids = new Set(records.map(record => record.taskId))
  for (const task of tasks) if (!ids.has(task.workRecordId)) {
    const linked = task.workRecordId ? await getWorkRecord(context, task.workRecordId) : null
    if (!linked || ownedRecord(linked, identity)) items.push(unifiedItem(linked, [task]))
  }
  return items.filter(item => includeArchived || item.status !== 'archived').sort(sortActiveTasks)
}
export async function centerDetail(context, identity, id) {
  let record = await getWorkRecord(context, id)
  const task = await getTask(context, id)
  if (!record && ownedTask(task, identity) && task.workRecordId) record = await getWorkRecord(context, task.workRecordId)
  if (record && !ownedRecord(record, identity)) return null
  if (!record && !ownedTask(task, identity)) return null
  const tasks = record ? (await listTasks(context, { includeHidden: 'true', compatibilityMode: identity.compatibilityMode, workspaceId: identity.workspaceId })).filter(item => !item.hiddenAt && item.workRecordId === record.taskId && ownedTask(item, identity)) : [task]
  return { item: unifiedItem(record, tasks), record, tasks }
}
export function centerSummary(active, recent) {
  return { activeCount: active.length, runningCount: active.filter(item => ['queued', 'running', 'retrying', 'cancelling'].includes(item.status)).length, trackedTaskId: [...active].sort(sortActiveTasks)[0]?.taskId || null, hasUnknownProgress: active.some(item => item.progress == null), hasFailed: recent.some(item => item.status === 'failed') }
}
const priority = { running: 0, retrying: 0, cancelling: 0, queued: 1, ready: 2, draft: 3 }
export function sortActiveTasks(a, b) { return (priority[a.status] ?? 4) - (priority[b.status] ?? 4) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) }
const cancelLocks = new Set()
export async function cancelCenterTask(context, identity, id, input = {}) {
  const initial = await centerDetail(context, identity, id)
  if (!initial) return { status: 404, data: { error: 'TASK_NOT_FOUND' } }
  const lockId = initial.record?.taskId || initial.item.id
  if (cancelLocks.has(lockId)) return { status: 409, data: { error: 'CANCELLATION_IN_PROGRESS' } }
  cancelLocks.add(lockId)
  try {
    const detail = await centerDetail(context, identity, id)
    if (!detail) return { status: 404, data: { error: 'TASK_NOT_FOUND' } }
    const { item, record, tasks } = detail
    if (item.status === 'cancelled') return { status: 200, data: { ...detail, idempotent: true } }
    if (!activeStatuses.has(item.status)) return { status: 409, data: { error: 'TASK_NOT_CANCELLABLE' } }
    if (input.expectedVersion !== (record || item).version) return { status: 409, data: { error: 'VERSION_CONFLICT', currentVersion: (record || item).version, item } }
    const outcomes = []
    if (!tasks.length && ['running', 'retrying'].includes(item.status)) outcomes.push({ supported: false, status: 'platform_request_aborted' })
    for (const task of tasks.filter(task => ['queued', 'running', 'retrying'].includes(task.status))) {
      const provider = task.workspace === 'video' ? await resolvedVideoProviderConnection(context, task.createdBy || identity.user.id) : null
      // Ark only cancels queued jobs; deleting succeeded jobs would remove upstream history.
      // https://docs.volcengine.com/docs/ark/cancel-or-delete-video-generation-tasks-api
      const arkQueued = task.status === 'queued' && task.providerTaskId && /^https:\/\/ark\.[a-z0-9-]+\.volces\.com\/api\/v3\/?$/.test(provider?.baseUrl || '')
      if (arkQueued) {
        let response
        try { response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/contents/generations/tasks/${encodeURIComponent(task.providerTaskId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30000) }) }
        catch { return { status: 502, data: { error: 'PROVIDER_CANCEL_FAILED', hint: '上游取消请求失败，任务状态未改变，请重试。' } } }
        if (!response.ok) return { status: 502, data: { error: 'PROVIDER_CANCEL_FAILED', hint: `上游取消失败（HTTP ${response.status}），任务仍在进行。` } }
        outcomes.push({ taskId: task.id, supported: true, status: 'cancelled', requestedAt: new Date().toISOString() })
      } else outcomes.push({ taskId: task.id, supported: false, status: 'platform_tracking_stopped' })
    }
    const cancelledAt = new Date().toISOString(), providerCancelSupported = outcomes.length > 0 && outcomes.every(outcome => outcome.supported)
    const notice = outcomes.some(outcome => !outcome.supported) ? '上游任务可能仍在处理，但平台已停止跟踪和归档。' : '任务已取消，工作记录已保留。'
    const audit = { status: 'cancelled', cancelledAt, cancelledBy: identity.user.id, cancelReason: String(input.reason || '用户取消').slice(0, 500), cancelRequestedAt: cancelledAt, providerCancelSupported, providerCancelResult: { outcomes, notice } }
    if (record) await updateWorkRecord(context, record.taskId, { ...audit, operationSummary: '已取消', updatedBy: identity.user.id })
    stopExecution(record?.taskId || item.id)
    for (const task of tasks) if (activeStatuses.has(taskStatus(task.status))) await updateTask(context, task.id, audit)
    return { status: 200, data: { ...(await centerDetail(context, identity, id)), notice, providerCancelSupported } }
  } finally { cancelLocks.delete(lockId) }
}
export async function retryCenterTask(context, identity, id, input) {
  const detail = await centerDetail(context, identity, id)
  if (!detail) return { status: 404, data: { error: 'TASK_NOT_FOUND' } }
  if (detail.item.status !== 'failed' || !detail.record) return { status: 409, data: { error: 'TASK_NOT_RETRYABLE' } }
  if (input.expectedVersion !== detail.record.version) return { status: 409, data: { error: 'VERSION_CONFLICT' } }
  resetExecution(detail.record.taskId)
  for (const task of detail.tasks) if (task.status === 'failed') await updateTask(context, task.id, { hiddenAt: new Date().toISOString() })
  const record = await updateWorkRecord(context, detail.record.taskId, { status: 'ready', retryCount: detail.record.retryCount + 1, progress: null, errorCode: '', errorMessage: '', operationSummary: '已准备重试，请确认原内容后提交', sourceTaskId: detail.item.taskId })
  return { status: 200, data: { record, item: unifiedItem(record) } }
}
