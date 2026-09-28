import { json } from '../../_lib/tokenspace.js'
import { getTask, listTasks, saveTask, updateTask } from '../../_lib/task-store.js'
import { requireIdentity } from '../../_lib/collaboration.js'

export async function onRequestGet(context) {
  const identity = await requireIdentity(context, 'view'); if (identity.error) return identity.error
  const id = context.request.url ? new URL(context.request.url).searchParams.get('id') : null
  if (id) {
    const task = await getTask(context, id)
    return task && (identity.compatibilityMode || task.workspaceId === identity.workspaceId) ? json(200, task) : json(404, { error: 'TASK_NOT_FOUND' })
  }
  return json(200, { tasks: await listTasks(context, { ...Object.fromEntries(new URL(context.request.url).searchParams), workspaceId: identity.workspaceId, compatibilityMode: identity.compatibilityMode }) })
}

export async function onRequestPost(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = ['retouch', 'brand', 'script', 'video'].includes(input.workspace) ? input.workspace : null
  if (!workspace) return json(400, { error: 'WORKSPACE_REQUIRED' })
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace, type: String(input.type || 'agent'),
    status: 'queued', progress: 0, stage: '已受理', heartbeatAt: new Date().toISOString(),
    requirements: String(input.requirements || '').slice(0, 10000), assets: Array.isArray(input.assets) ? input.assets.slice(0, 50) : [],
    model: String(input.model || '').slice(0, 160), workspaceId: identity.workspaceId, projectId: workspace, createdBy: identity.user.id, updatedBy: identity.user.id, version: 1, createdAt: new Date().toISOString()
  })
  return json(202, task)
}

export async function onRequestPatch(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const id = input.id
  if (!id) return json(400, { error: 'TASK_ID_REQUIRED' })
  const allowed = ['queued', 'running', 'waiting_user', 'completed', 'failed', 'cancelled']
  if (input.status && !allowed.includes(input.status)) return json(400, { error: 'INVALID_STATUS' })
  const current = await getTask(context, id)
  if (!current || (!identity.compatibilityMode && current.workspaceId !== identity.workspaceId)) return json(404, { error: 'TASK_NOT_FOUND' })
  if (!Number.isInteger(input.expectedVersion) && !identity.compatibilityMode) return json(400, { error: 'EXPECTED_VERSION_REQUIRED' })
  if (!identity.compatibilityMode && input.expectedVersion !== current.version) return json(409, { error: 'VERSION_CONFLICT', currentVersion: current.version, updatedBy: current.updatedBy, updatedAt: current.updatedAt })
  const task = await updateTask(context, id, { status: input.status, progress: Math.max(0, Math.min(100, Number(input.progress ?? 0))), stage: String(input.stage || '').slice(0, 200), error: input.error ? String(input.error).slice(0, 1000) : undefined, updatedBy: identity.user.id, version: Number(current.version || 0) + 1 })
  return task ? json(200, task) : json(404, { error: 'TASK_NOT_FOUND' })
}

export async function onRequestDelete(context) {
  const identity = await requireIdentity(context, 'edit'); if (identity.error) return identity.error
  const id = new URL(context.request.url).searchParams.get('id')
  if (!id) return json(400, { error: 'TASK_ID_REQUIRED' })
  const task = await getTask(context, id)
  if (!task || (!identity.compatibilityMode && task.workspaceId !== identity.workspaceId)) return json(404, { error: 'TASK_NOT_FOUND' })
  if (!['completed', 'failed', 'cancelled'].includes(task.status)) return json(409, { error: 'TASK_STILL_ACTIVE' })
  const hiddenAt = new Date().toISOString()
  await updateTask(context, id, { hiddenAt, hiddenBy: identity.user.id, hiddenReason: 'user_dismissed', updatedBy: identity.user.id, version: Number(task.version || 0) + 1 })
  return json(200, { ok: true, id, hiddenAt })
}
