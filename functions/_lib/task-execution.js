import { getWorkRecord, updateWorkRecord } from './work-record-store.js'

const controllers = new Map()
export function executionSignal(id) {
  if (!id) return undefined
  if (!controllers.has(id)) controllers.set(id, new AbortController())
  return controllers.get(id).signal
}
export function stopExecution(id) { controllers.get(id)?.abort(); controllers.delete(id) }
export function resetExecution(id) { controllers.delete(id) }
export function requestControl(id) {
  const signals = [AbortSignal.timeout(1800000), executionSignal(id)].filter(Boolean)
  const combined = new AbortController(), abort = () => combined.abort()
  for (const signal of signals) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }) }
  return { signal: combined.signal, release: () => signals.forEach(signal => signal.removeEventListener('abort', abort)) }
}
export async function executionCancelled(context, id = context.workRecordId) {
  return Boolean(id && (await getWorkRecord(context, id))?.status === 'cancelled')
}
export async function noteLateResult(context, id = context.workRecordId) {
  if (id) await updateWorkRecord(context, id, { lateResultAt: new Date().toISOString(), lateResultNotice: '取消后收到上游响应，已保留待处理提示，未自动归档。' })
}
