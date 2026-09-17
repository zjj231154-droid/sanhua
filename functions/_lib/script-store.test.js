import { describe, expect, it } from 'vitest'
import { createScript, getScript, listScripts, listVersions, restoreVersion, saveVersion, setScriptDeleted, updateScript } from './script-store.js'

class MemoryBucket {
  constructor() { this.values = new Map() }
  async put(key, value, options = {}) { this.values.set(key, { value: typeof value === 'string' ? value : new Uint8Array(value), options }) }
  async get(key) {
    const item = this.values.get(key)
    if (!item) return null
    return { async json() { return JSON.parse(typeof item.value === 'string' ? item.value : new TextDecoder().decode(item.value)) } }
  }
  async list({ prefix = '', limit = 1000 } = {}) { return { objects: [...this.values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } }
}

describe('persistent script library', () => {
  it('creates, versions, restores, deletes and restores a script from persistent storage', async () => {
    const context = { env: { SANHUA_ASSETS: new MemoryBucket() } }
    const created = await createScript(context, { title: '茶馆开场', kind: '轻喜剧', summary: '掌柜解决误会', outline: '场景：茶馆\n冲突：顾客争执' })
    expect((await listScripts(context)).map(item => item.id)).toEqual([created.id])

    const edited = await updateScript(context, created.id, { title: '茶馆开场（修订）', outline: '场景：茶馆\n冲突：顾客争执\n结尾：和解' })
    const saved = await saveVersion(context, created.id, { changeNote: '补充分镜结尾' })
    expect(saved.version.versionNo).toBe(2)
    expect((await listVersions(context, created.id)).map(item => item.versionNo)).toEqual([2, 1])

    const restored = await restoreVersion(context, created.id, created.currentVersionId)
    expect(restored.title).toBe(created.title)
    expect(restored.outline).toBe(created.outline)
    expect(edited.title).toContain('修订')

    await setScriptDeleted(context, created.id, true)
    expect(await listScripts(context)).toEqual([])
    expect((await listScripts(context, { includeDeleted: true }))[0].deletedAt).toBeTruthy()
    await setScriptDeleted(context, created.id, false)
    expect((await getScript(context, created.id)).deletedAt).toBeNull()
  })
})
