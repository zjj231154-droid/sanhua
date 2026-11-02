const messages = { VERSION_CONFLICT: '任务状态已更新，请刷新后重试。', TASK_NOT_FOUND: '无法读取该工作记录，可能已切换工作区。', TASK_NOT_CANCELLABLE: '任务已经结束，不能取消。', TASK_NOT_RETRYABLE: '此记录不能重试。' }

export async function taskCenterRequest(path, body, signal, { timeoutMs = body ? 35000 : 12000, retryDelayMs = 350 } = {}) {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    try {
      const response = await fetch(`/api/v1/task-center${path}`, {
        cache: 'no-store', credentials: 'same-origin',
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: controller.signal
      })
      const data = await response.json().catch(() => { throw Object.assign(new Error('服务返回异常，请稍后刷新。'), { retryable: true }) })
      if (!response.ok) throw Object.assign(new Error(response.status === 401 ? '登录已过期，请重新登录。' : data.hint || messages[data.error] || data.error || `服务暂不可用（HTTP ${response.status}）`), { retryable: response.status >= 500 })
      return data
    } catch (reason) {
      signal?.throwIfAborted()
      const retryable = timedOut || reason instanceof TypeError || reason.retryable
      if (body || attempt >= 1 || !retryable) {
        if (timedOut) throw new Error('连接超时，请检查网络后重试。')
        if (reason instanceof TypeError) throw new Error('无法连接任务服务，请检查网络；连接恢复后会自动刷新。')
        throw reason
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, retryDelayMs)
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
  }
}
