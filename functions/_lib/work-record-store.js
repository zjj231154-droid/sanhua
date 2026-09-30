import { assetsBucket, getJson, listJson, putJson } from './asset-store.js'

const prefix = 'metadata/work-records/'
const keyFor = id => `${prefix}${id}.json`
const now = () => new Date().toISOString()
const text = (value, limit) => String(value ?? '').trim().slice(0, limit)
const strings = value => Array.isArray(value) ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 100) : []
const allowedModules = new Set(['home', 'retouch', 'brand', 'script', 'assets', 'video'])
const allowedStatuses = new Set(['draft', 'ready', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'archived'])
const draftEnvelope = (value, { moduleKey = '', route = '', subRoute = '', currentStep = 1 } = {}) => ({ ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}), moduleKey, currentRoute: route, currentSubRoute: subRoute, currentStep })

function sanitize(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return value
  if (typeof value === 'string') return value.slice(0, 20000)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitize(item, depth + 1))
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(api.?key|password|secret|token|authorization)/i.test(key)).slice(0, 120).map(([key, item]) => [key.slice(0, 100), sanitize(item, depth + 1)]))
}

export const validModule = value => allowedModules.has(String(value || ''))
export const validStatus = value => allowedStatuses.has(String(value || ''))

export async function getWorkRecord(context, id) {
  const bucket = assetsBucket(context)
  return bucket ? getJson(bucket, keyFor(id)) : null
}

export async function listWorkRecords(context, { workspaceId, ownerUserId, moduleKey, status, page = 1, pageSize = 20, includeArchived = false } = {}) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  const wantedStatuses = String(status || '').split(',').map(item => item.trim()).filter(Boolean)
  const rows = (await listJson(bucket, prefix))
    .filter(record => !workspaceId || record.workspaceId === workspaceId)
    .filter(record => !ownerUserId || record.ownerUserId === ownerUserId)
    .filter(record => !moduleKey || record.moduleKey === moduleKey)
    .filter(record => includeArchived || record.status !== 'archived')
    .filter(record => !wantedStatuses.length || wantedStatuses.includes(record.status))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  const size = Math.max(1, Math.min(100, Number(pageSize) || 20))
  const currentPage = Math.max(1, Number(page) || 1)
  const start = (currentPage - 1) * size
  return { items: rows.slice(start, start + size), page: currentPage, pageSize: size, total: rows.length, nextCursor: start + size < rows.length ? String(start + size) : null }
}

export async function createWorkRecord(context, input = {}) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  const moduleKey = text(input.moduleKey, 40)
  if (!validModule(moduleKey)) return { invalid: 'MODULE_KEY_REQUIRED' }
  const createdAt = now()
  const record = {
    taskId: crypto.randomUUID(), recordType: 'draft_task', workspaceId: text(input.workspaceId, 160), ownerUserId: text(input.ownerUserId, 160),
    moduleKey, moduleName: text(input.moduleName, 120) || moduleKey, route: text(input.route, 160), subRoute: text(input.subRoute, 160), title: text(input.title, 180) || `${text(input.moduleName, 120) || moduleKey}工作记录`,
    currentStep: Math.max(1, Number(input.currentStep) || 1), status: 'draft', draftData: draftEnvelope(sanitize(input.initialData || {}), { moduleKey, route: text(input.route, 160), subRoute: text(input.subRoute, 160), currentStep: Math.max(1, Number(input.currentStep) || 1) }), stepSnapshots: [], operationSummary: text(input.operationSummary, 400),
    inputAssetIds: strings(input.inputAssetIds), sourceTextRecordIds: strings(input.sourceTextRecordIds), resultAssetIds: strings(input.resultAssetIds), resultTextRecordIds: strings(input.resultTextRecordIds),
    providerTaskId: text(input.providerTaskId, 200), providerType: text(input.providerType, 80), providerModel: text(input.providerModel, 160), syncState: 'synced', lastSyncError: '', progress: 0, errorCode: '', errorMessage: '', retryCount: 0, version: 1, createdAt, updatedAt: createdAt, submittedAt: null, completedAt: null, archivedAt: null,
    clientSessionId: text(input.clientSessionId, 160), createdBy: text(input.ownerUserId, 160), updatedBy: text(input.ownerUserId, 160),
  }
  await putJson(bucket, keyFor(record.taskId), record)
  return record
}

export async function updateWorkRecord(context, id, patch = {}) {
  const bucket = assetsBucket(context)
  const current = bucket ? await getJson(bucket, keyFor(id)) : null
  if (!current) return null
  if (patch.expectedVersion !== undefined && Number(patch.expectedVersion) !== Number(current.version)) return { conflict: current }
  const nextStatus = patch.status === undefined ? current.status : String(patch.status)
  if (!validStatus(nextStatus)) return { invalid: 'INVALID_STATUS' }
  const next = {
    ...current,
    title: patch.title === undefined ? current.title : text(patch.title, 180) || current.title,
    route: patch.route === undefined ? current.route : text(patch.route, 160),
    subRoute: patch.subRoute === undefined ? (current.subRoute || '') : text(patch.subRoute, 160),
    currentStep: patch.currentStep === undefined ? current.currentStep : Math.max(1, Number(patch.currentStep) || 1),
    status: nextStatus,
    draftData: patch.draftData === undefined ? current.draftData : draftEnvelope(sanitize(patch.draftData), { moduleKey: current.moduleKey, route: patch.route === undefined ? current.route : text(patch.route, 160), subRoute: patch.subRoute === undefined ? (current.subRoute || '') : text(patch.subRoute, 160), currentStep: patch.currentStep === undefined ? current.currentStep : Math.max(1, Number(patch.currentStep) || 1) }),
    inputAssetIds: patch.inputAssetIds === undefined ? current.inputAssetIds : strings(patch.inputAssetIds),
    sourceTextRecordIds: patch.sourceTextRecordIds === undefined ? current.sourceTextRecordIds : strings(patch.sourceTextRecordIds),
    resultAssetIds: patch.resultAssetIds === undefined ? current.resultAssetIds : strings(patch.resultAssetIds),
    resultTextRecordIds: patch.resultTextRecordIds === undefined ? current.resultTextRecordIds : strings(patch.resultTextRecordIds),
    operationSummary: patch.operationSummary === undefined ? current.operationSummary : text(patch.operationSummary, 400),
    providerTaskId: patch.providerTaskId === undefined ? current.providerTaskId : text(patch.providerTaskId, 200),
    providerType: patch.providerType === undefined ? (current.providerType || '') : text(patch.providerType, 80),
    providerModel: patch.providerModel === undefined ? (current.providerModel || '') : text(patch.providerModel, 160),
    syncState: patch.syncState === undefined ? (current.syncState || 'synced') : ['synced', 'pending', 'failed', 'conflict'].includes(String(patch.syncState)) ? String(patch.syncState) : (current.syncState || 'synced'),
    lastSyncError: patch.lastSyncError === undefined ? (current.lastSyncError || '') : text(patch.lastSyncError, 1000),
    progress: patch.progress === undefined ? current.progress : Math.max(0, Math.min(100, Number(patch.progress) || 0)),
    errorCode: patch.errorCode === undefined ? current.errorCode : text(patch.errorCode, 120),
    errorMessage: patch.errorMessage === undefined ? current.errorMessage : text(patch.errorMessage, 1000),
    retryCount: patch.retryCount === undefined ? Number(current.retryCount || 0) : Math.max(0, Math.min(100, Number(patch.retryCount) || 0)),
    stepSnapshots: patch.stepSnapshots === undefined ? current.stepSnapshots : sanitize(Array.isArray(patch.stepSnapshots) ? patch.stepSnapshots : []),
    updatedBy: text(patch.updatedBy, 160) || current.updatedBy,
    version: Number(current.version || 0) + 1, updatedAt: now(),
  }
  if (patch.captureSnapshot !== false && (patch.draftData !== undefined || patch.currentStep !== undefined || patch.route !== undefined || patch.subRoute !== undefined)) {
    const snapshot = { route: next.route, subRoute: next.subRoute || '', currentStep: next.currentStep, draftData: sanitize(next.draftData), capturedAt: next.updatedAt }
    next.stepSnapshots = [...(Array.isArray(current.stepSnapshots) ? current.stepSnapshots : []), snapshot].slice(-30)
  }
  if (nextStatus === 'queued' && !current.submittedAt) next.submittedAt = now()
  if (['succeeded', 'failed', 'cancelled', 'archived'].includes(nextStatus)) next.completedAt = next.completedAt || now()
  if (nextStatus === 'archived') next.archivedAt = next.archivedAt || now()
  await putJson(bucket, keyFor(id), next)
  return next
}

export { allowedStatuses }
