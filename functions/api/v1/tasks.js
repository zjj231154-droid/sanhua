import { json } from '../../_lib/tokenspace.js'
import { getTask, listTasks, saveTask, updateTask } from '../../_lib/task-store.js'

export async function onRequestGet(context) {
  const id = context.request.url ? new URL(context.request.url).searchParams.get('id') : null
  if (id) {
    const task = await getTask(context, id)
    return task ? json(200, task) : json(404, { error: 'TASK_NOT_FOUND' })
  }
  return json(200, { tasks: await listTasks(context, Object.fromEntries(new URL(context.request.url).searchParams)) })
}

export async function onRequestPost(context) {
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const workspace = ['retouch', 'brand', 'script', 'video'].includes(input.workspace) ? input.workspace : null
  if (!workspace) return json(400, { error: 'WORKSPACE_REQUIRED' })
  const task = await saveTask(context, {
    id: crypto.randomUUID(), workspace, type: String(input.type || 'agent'),
    status: 'queued', progress: 0, stage: '已受理', heartbeatAt: new Date().toISOString(),
    requirements: String(input.requirements || '').slice(0, 10000), assets: Array.isArray(input.assets) ? input.assets.slice(0, 50) : [],
    model: String(input.model || '').slice(0, 160), createdAt: new Date().toISOString()
  })
  return json(202, task)
}

export async function onRequestPatch(context) {
  let input
  try { input = await context.request.json() } catch { return json(400, { error: '请求格式必须是 JSON' }) }
  const id = input.id
  if (!id) return json(400, { error: 'TASK_ID_REQUIRED' })
  const allowed = ['queued', 'running', 'waiting_user', 'completed', 'failed', 'cancelled']
  if (input.status && !allowed.includes(input.status)) return json(400, { error: 'INVALID_STATUS' })
  const task = await updateTask(context, id, { status: input.status, progress: Math.max(0, Math.min(100, Number(input.progress ?? 0))), stage: String(input.stage || '').slice(0, 200), error: input.error ? String(input.error).slice(0, 1000) : undefined })
  return task ? json(200, task) : json(404, { error: 'TASK_NOT_FOUND' })
}

export async function onRequestDelete(context) {
  const id = new URL(context.request.url).searchParams.get('id')
  if (!id) return json(400, { error: 'TASK_ID_REQUIRED' })
  const task = await getTask(context, id)
  if (!task) return json(404, { error: 'TASK_NOT_FOUND' })
  if (!['completed', 'failed', 'cancelled'].includes(task.status)) return json(409, { error: 'TASK_STILL_ACTIVE' })
  const hiddenAt = new Date().toISOString()
  await updateTask(context, id, { hiddenAt, hiddenBy: 'demo-user', hiddenReason: 'user_dismissed' })
  return json(200, { ok: true, id, hiddenAt })
}
