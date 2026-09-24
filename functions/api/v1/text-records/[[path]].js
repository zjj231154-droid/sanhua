import { json } from '../../../_lib/tokenspace.js'
import { createTextRecord, getTextRecord, listTextRecords, setTextRecordDeleted, updateTextRecord } from '../../../_lib/text-record-store.js'
import { listTasks } from '../../../_lib/task-store.js'

const read = async request => { try { return await request.json() } catch { return null } }
const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
const unavailable = value => value === null ? json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) : null

async function backfillTaskPromptRecords(context) {
  const existing = await listTextRecords(context, { includeDeleted: true, limit: 80 })
  if (existing === null) return null
  const tasks = await listTasks(context, {})
  const candidates = tasks.flatMap(task => {
    const sourceAssetIds = Array.isArray(task.sourceAssetIds) ? task.sourceAssetIds : Array.isArray(task.assets) ? task.assets : []
    if (task.type === 'agent-plan' && task.plan && ['brand', 'script', 'retouch'].includes(task.workspace)) return [{
      workspace: task.workspace, sourceModule: `${task.workspace}.prompts`, recordType: task.workspace === 'brand' ? 'brand_plan' : task.workspace === 'script' ? 'script_outline' : 'retouch_plan',
      title: task.workspace === 'brand' ? '品牌设计计划' : task.workspace === 'script' ? '待确认短剧脚本大纲' : '产品精修计划', content: task.plan, contentFormat: 'prompt', model: task.model, provider: 'usegoodai-reasoning', sourceTaskId: task.id, sourceAssetIds,
    }]
    if (task.type === 'image-batch' && task.finalPrompt && ['brand', 'retouch'].includes(task.workspace)) return [{
      workspace: task.workspace, sourceModule: `${task.workspace}.prompts`, recordType: task.workspace === 'brand' ? 'brand_final_prompt' : 'retouch_final_prompt',
      title: task.requestedName || (task.workspace === 'brand' ? '品牌创作最终提示词' : '产品精修最终提示词'), content: task.finalPrompt, contentFormat: 'prompt', model: task.model, provider: 'usegoodai', sourceTaskId: task.id, sourceAssetIds,
    }]
    return []
  })
  const created = []
  for (const candidate of candidates) {
    if (existing.records.some(record => record.sourceTaskId === candidate.sourceTaskId && record.recordType === candidate.recordType)) continue
    const record = await createTextRecord(context, candidate)
    if (record?.id) { existing.records.push(record); created.push(record) }
  }
  return { scanned: candidates.length, created }
}

export async function onRequestGet(context) {
  const [id] = parts(context)
  if (id) { const record = await getTextRecord(context, id); return record ? json(200, { record }) : json(404, { error: 'TEXT_RECORD_NOT_FOUND' }) }
  const url = new URL(context.request.url)
  const result = await listTextRecords(context, { workspace: url.searchParams.get('workspace') || undefined, recordType: url.searchParams.get('recordType') || undefined, q: url.searchParams.get('q') || undefined, includeDeleted: url.searchParams.get('includeDeleted') === 'true', limit: url.searchParams.get('limit'), cursor: url.searchParams.get('cursor') || undefined })
  return unavailable(result) || json(200, result)
}

export async function onRequestPost(context) {
  const [id, action] = parts(context)
  if (id === 'backfill' && !action) {
    const result = await backfillTaskPromptRecords(context)
    return unavailable(result) || json(200, { created: result.created, scanned: result.scanned })
  }
  if (id && action === 'restore') { const record = await setTextRecordDeleted(context, id, false); return record ? json(200, { record }) : json(404, { error: 'TEXT_RECORD_NOT_FOUND' }) }
  if (id) return json(404, { error: 'TEXT_RECORD_ROUTE_NOT_FOUND' })
  const input = await read(context.request)
  if (!input) return json(400, { error: '请求格式必须是 JSON' })
  const record = await createTextRecord(context, input)
  if (record?.invalid) return json(400, { error: record.invalid })
  return unavailable(record) || json(201, { record })
}

export async function onRequestPatch(context) {
  const [id] = parts(context); const input = await read(context.request)
  if (!id || !input) return json(400, { error: !id ? 'TEXT_RECORD_ID_REQUIRED' : '请求格式必须是 JSON' })
  const record = await updateTextRecord(context, id, input)
  if (record?.invalid) return json(400, { error: record.invalid })
  return record ? json(200, { record }) : json(404, { error: 'TEXT_RECORD_NOT_FOUND' })
}

export async function onRequestDelete(context) {
  const [id] = parts(context)
  if (!id) return json(400, { error: 'TEXT_RECORD_ID_REQUIRED' })
  const record = await setTextRecordDeleted(context, id, true)
  return record ? json(200, { record }) : json(404, { error: 'TEXT_RECORD_NOT_FOUND' })
}
