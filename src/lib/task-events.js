// All successful task mutations share the same invalidation event; polling is only a fallback.
export function installTaskEvents(target = window) {
  if (target.__sanhuaTaskEvents) return
  target.__sanhuaTaskEvents = true
  const original = target.fetch.bind(target)
  target.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const method = String(options.method || input?.method || 'GET').toUpperCase()
    const taskMutation = method !== 'GET' && (/\/api\/v1\/(work-records|tasks|task-center|agent-runs|image-batches|video-tasks|drama-projects)(?:[/?]|$)/.test(url) || /\/api\/tokenspace(?:[/?]|$)/.test(url))
    let timer
    if (taskMutation) timer = setTimeout(() => target.dispatchEvent(new Event('sanhua:tasks-updated')), 400)
    try { const response = await original(input, options); if (taskMutation) target.dispatchEvent(new Event('sanhua:tasks-updated')); return response }
    finally { clearTimeout(timer) }
  }
}
