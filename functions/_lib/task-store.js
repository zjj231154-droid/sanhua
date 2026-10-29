import { assetsBucket, getJson, listAllJson, putJson, taskMetadataKey } from './asset-store.js'
import { createWorkRecord, getWorkRecord, updateWorkRecord, sanitizeTaskData } from './work-record-store.js'

const memory = globalThis.__sanhuaTasks || (globalThis.__sanhuaTasks = new Map())

const keyFor = id => `task:${id}`
const binding = context => context.env?.TASKS_KV || context.env?.SANHUA_TASKS

export async function saveTask(context, task) {
  const prior = await getTask(context, task.id)
  if (prior?.status === 'cancelled') return prior
  if (!task.workRecordId && ['retouch', 'brand', 'script', 'video'].includes(task.workspace)) {
    const record = await createWorkRecord(context, { moduleKey: task.workspace, moduleName: { retouch: '产品精修', brand: '品牌创作', script: '短剧脚本', video: '视频生成' }[task.workspace], title: task.title || task.stage, workspaceId: task.workspaceId, ownerUserId: task.createdBy || task.ownerUserId, route: task.workspace === 'video' ? 'video' : 'create', currentStep: task.type === 'image-batch' ? 5 : task.workspace === 'video' ? 3 : 1, initialData: task.draftData || { requirements: task.requirements, prompt: task.requirements, selectedAssetIds: task.assets || [], sourceTaskId: task.id } })
    if (record?.taskId) task = { ...task, workRecordId: record.taskId }
  }
  const record = task.workRecordId ? await getWorkRecord(context, task.workRecordId) : null
  if (record?.status === 'cancelled') task = { ...task, status: 'cancelled', cancelledAt: record.cancelledAt, providerCancelResult: record.providerCancelResult }
  const value = { ...task, ...(task.draftData ? { draftData: sanitizeTaskData(task.draftData) } : {}), ownerUserId: prior?.ownerUserId || prior?.createdBy || task.createdBy || task.ownerUserId, visibility: 'private', version: Number(prior?.version || task.version || 0) + 1, updatedAt: new Date().toISOString() }
  memory.set(task.id, value)
  const kv = binding(context)
  if (kv?.put) await kv.put(keyFor(task.id), JSON.stringify(value), { expirationTtl: 60 * 60 * 24 * 30 })
  const bucket = assetsBucket(context)
  if (bucket) await putJson(bucket, taskMetadataKey(task.id), value)
  if (record && record.status !== 'cancelled') await updateWorkRecord(context, record.taskId, {
    sourceProjectId: value.sourceProjectId, sourceScriptId: value.sourceScriptId, sourceShotId: value.sourceShotId, generationParams: value.generationParams,
    status: ({ completed: 'succeeded', waiting_user: 'ready' })[value.status] || value.status,
    progress: value.progress ?? null, progressSource: value.progressSource || (value.progress == null ? 'unknown' : 'platform_estimate'),
    providerTaskId: value.providerTaskId || '', providerType: value.provider || '', providerModel: value.model || '',
    operationSummary: value.stage || '', errorMessage: value.error || value.errorMessage || '',
    ...(value.plan ? { draftData: { ...record.draftData, plan: value.plan, ...(value.workspace === 'brand' ? { brandPlan: value.plan } : value.workspace === 'script' ? { scriptPlan: value.plan } : {}) } } : {}),
    resultAssetIds: [...new Set([...(record.resultAssetIds || []), ...(value.outputIds || []), ...(value.videoAssetId ? [value.videoAssetId] : [])])],
    resultTextRecordIds: [...new Set([...(record.resultTextRecordIds || []), ...(value.textRecordId ? [value.textRecordId] : [])])],
  })
  return value
}

export async function getTask(context, id) {
  const kv = binding(context)
  if (kv?.get) {
    const value = await kv.get(keyFor(id), 'json')
    if (value) return value
  }
  const bucket = assetsBucket(context)
  if (bucket) {
    const value = await getJson(bucket, taskMetadataKey(id))
    if (value) return value
  }
  return memory.get(id) || null
}

export async function listTasks(context, filters = {}) {
  const bucket = assetsBucket(context)
  const values = bucket ? await listAllJson(bucket, 'metadata/tasks/') : [...memory.values()]
  return values.filter(task => filters.includeHidden === 'true' || !task.hiddenAt)
    .filter(task => filters.compatibilityMode || !filters.workspaceId || task.workspaceId === filters.workspaceId)
    .filter(task => !filters.ownerUserId || (task.ownerUserId || task.createdBy) === filters.ownerUserId)
    .filter(task => !filters.workspace || task.workspace === filters.workspace)
    .filter(task => !filters.status || task.status === filters.status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function updateTask(context, id, patch) {
  const current = await getTask(context, id)
  if (!current) return null
  return saveTask(context, { ...current, ...patch, id })
}
