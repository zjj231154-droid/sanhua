import { json } from '../../../_lib/tokenspace.js'
import { createTextRecord, getTextRecord, listTextRecords, setTextRecordDeleted, updateTextRecord } from '../../../_lib/text-record-store.js'

const read = async request => { try { return await request.json() } catch { return null } }
const parts = context => (Array.isArray(context.params?.path) ? context.params.path : String(context.params?.path || '').split('/')).filter(Boolean)
const unavailable = value => value === null ? json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) : null

export async function onRequestGet(context) {
  const [id] = parts(context)
  if (id) { const record = await getTextRecord(context, id); return record ? json(200, { record }) : json(404, { error: 'TEXT_RECORD_NOT_FOUND' }) }
  const url = new URL(context.request.url)
  const result = await listTextRecords(context, { workspace: url.searchParams.get('workspace') || undefined, recordType: url.searchParams.get('recordType') || undefined, q: url.searchParams.get('q') || undefined, includeDeleted: url.searchParams.get('includeDeleted') === 'true', limit: url.searchParams.get('limit'), cursor: url.searchParams.get('cursor') || undefined })
  return unavailable(result) || json(200, result)
}

export async function onRequestPost(context) {
  const [id, action] = parts(context)
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
