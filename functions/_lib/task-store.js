const memory = globalThis.__sanhuaTasks || (globalThis.__sanhuaTasks = new Map())

const keyFor = id => `task:${id}`
const binding = context => context.env?.TASKS_KV || context.env?.SANHUA_TASKS

export async function saveTask(context, task) {
  const value = { ...task, updatedAt: new Date().toISOString() }
  memory.set(task.id, value)
  const kv = binding(context)
  if (kv?.put) await kv.put(keyFor(task.id), JSON.stringify(value), { expirationTtl: 60 * 60 * 24 * 30 })
  return value
}

export async function getTask(context, id) {
  const kv = binding(context)
  if (kv?.get) {
    const value = await kv.get(keyFor(id), 'json')
    if (value) return value
  }
  return memory.get(id) || null
}

export async function listTasks(context, filters = {}) {
  const values = [...memory.values()]
  return values.filter(task => !filters.workspace || task.workspace === filters.workspace)
    .filter(task => !filters.status || task.status === filters.status)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export async function updateTask(context, id, patch) {
  const current = await getTask(context, id)
  if (!current) return null
  return saveTask(context, { ...current, ...patch, id })
}
