import { afterEach, expect, it, vi } from 'vitest'
import { taskCenterRequest } from './task-center-api'
const ok = { ok: true, json: async () => ({ active: [] }) }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('retries a transient GET network failure once', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok)
  vi.stubGlobal('fetch', fetcher)
  expect(await taskCenterRequest('', null, undefined, { retryDelayMs: 0 })).toEqual({ active: [] })
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('never automatically repeats a mutation after a lost response', async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')); vi.stubGlobal('fetch', fetcher)
  await expect(taskCenterRequest('/one/cancel', {})).rejects.toThrow('无法连接任务服务')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('bounds slow requests and reports a Chinese timeout after one GET retry', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))))
  vi.stubGlobal('fetch', fetcher)
  const pending = expect(taskCenterRequest('', null, undefined, { timeoutMs: 100, retryDelayMs: 10 })).rejects.toThrow('连接超时')
  await vi.advanceTimersByTimeAsync(220); await pending
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('account switch aborts a pending retry and never starts another request', async () => {
  vi.useFakeTimers()
  const controller = new AbortController(), fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
  vi.stubGlobal('fetch', fetcher)
  const pending = expect(taskCenterRequest('', null, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(1); controller.abort(); await pending
  await vi.advanceTimersByTimeAsync(1000)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('expired sessions do not retry or show a raw error code', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'UNAUTHORIZED' }) }); vi.stubGlobal('fetch', fetcher)
  await expect(taskCenterRequest('')).rejects.toThrow('登录已过期')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
