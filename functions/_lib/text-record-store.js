import { assetsBucket, getJson, listJson, putJson } from './asset-store.js'

const key = id => `metadata/text-records/${id}.json`
const now = () => new Date().toISOString()
const text = (value, limit) => String(value || '').trim().slice(0, limit)
const strings = value => Array.isArray(value) ? [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 50) : []
const summaryFor = value => text(value, 300).replace(/\s+/g, ' ')

export async function listTextRecords(context, { workspace, recordType, q, includeDeleted = false, limit = 40, cursor } = {}) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  const types = String(recordType || '').split(',').map(item => item.trim()).filter(Boolean)
  const needle = String(q || '').trim().toLowerCase()
  const rows = (await listJson(bucket, 'metadata/text-records/'))
    .filter(record => includeDeleted || record.status !== 'deleted')
    .filter(record => !workspace || record.workspace === workspace)
    .filter(record => !types.length || types.includes(record.recordType))
    .filter(record => !needle || `${record.title} ${record.summary} ${record.content} ${record.sourceModule}`.toLowerCase().includes(needle))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  const start = cursor ? Math.max(0, rows.findIndex(item => item.id === cursor) + 1) : 0
  const page = rows.slice(start, start + Math.max(1, Math.min(80, Number(limit) || 40)))
  return { records: page, nextCursor: start + page.length < rows.length ? page.at(-1)?.id || null : null }
}

export async function getTextRecord(context, id) {
  const bucket = assetsBucket(context)
  return bucket ? getJson(bucket, key(id)) : null
}

export async function createTextRecord(context, input = {}) {
  const bucket = assetsBucket(context)
  if (!bucket) return null
  const content = text(input.content, 20000)
  if (!content) return { invalid: 'TEXT_RECORD_CONTENT_REQUIRED' }
  const createdAt = now()
  const record = {
    id: crypto.randomUUID(), tenantId: 'default', storeId: 'day-coffee-night-bar',
    workspace: ['retouch', 'brand', 'script', 'video'].includes(input.workspace) ? input.workspace : 'script',
    sourceModule: text(input.sourceModule, 100) || 'assets.text', recordType: text(input.recordType, 100) || 'note',
    title: text(input.title, 160) || '未命名文本记录', summary: text(input.summary, 300) || summaryFor(content), content,
    contentFormat: ['plain', 'markdown', 'prompt'].includes(input.contentFormat) ? input.contentFormat : 'plain',
    model: text(input.model, 160), provider: text(input.provider, 80), sourceTaskId: text(input.sourceTaskId, 160),
    sourceAssetIds: strings(input.sourceAssetIds), referenceAssetIds: strings(input.referenceAssetIds), generatedAssetIds: strings(input.generatedAssetIds),
    scriptId: text(input.scriptId, 160), scriptVersionId: text(input.scriptVersionId, 160), videoTaskId: text(input.videoTaskId, 160),
    status: 'active', starred: Boolean(input.starred), readonlyLegacy: Boolean(input.readonlyLegacy),
    createdBy: 'demo-designer', updatedBy: 'demo-designer', createdAt, updatedAt: createdAt, deletedAt: null,
  }
  await putJson(bucket, key(record.id), record)
  return record
}

export async function updateTextRecord(context, id, input = {}) {
  const bucket = assetsBucket(context)
  const current = bucket ? await getJson(bucket, key(id)) : null
  if (!current) return null
  const content = input.content === undefined ? current.content : text(input.content, 20000)
  if (!content) return { invalid: 'TEXT_RECORD_CONTENT_REQUIRED' }
  const status = ['active', 'archived'].includes(input.status) ? input.status : current.status
  const next = { ...current, title: input.title === undefined ? current.title : text(input.title, 160) || current.title, content, summary: input.summary === undefined ? (input.content === undefined ? current.summary : summaryFor(content)) : text(input.summary, 300) || summaryFor(content), starred: input.starred === undefined ? current.starred : Boolean(input.starred), status, updatedBy: 'demo-designer', updatedAt: now() }
  await putJson(bucket, key(id), next)
  return next
}

export async function setTextRecordDeleted(context, id, deleted) {
  const bucket = assetsBucket(context)
  const current = bucket ? await getJson(bucket, key(id)) : null
  if (!current) return null
  const next = { ...current, status: deleted ? 'deleted' : 'active', deletedAt: deleted ? now() : null, updatedBy: 'demo-designer', updatedAt: now() }
  await putJson(bucket, key(id), next)
  return next
}
