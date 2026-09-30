import { promises as fs } from 'node:fs'
import path from 'node:path'

const metadataSuffix = '.sanhua-meta.json'

const contentTypeFor = key => {
  const extension = path.extname(key).toLowerCase()
  return extension === '.json' ? 'application/json; charset=utf-8' : extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg' : 'application/octet-stream'
}

export function createRailwayVolumeBucket(storageDirectory) {
  const root = path.resolve(storageDirectory)
  const locksRoot = path.join(root, '.sanhua-locks')

  const resolveKey = key => {
    const target = path.resolve(root, String(key || ''))
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid storage key')
    return target
  }

  const readMetadata = async target => {
    try { return JSON.parse(await fs.readFile(`${target}${metadataSuffix}`, 'utf8')) } catch { return {} }
  }

  async function walk(directory, prefix, objects, limit) {
    if (objects.length >= limit) return
    let entries
    try { entries = await fs.readdir(directory, { withFileTypes: true }) } catch (error) { if (error.code === 'ENOENT') return; throw error }
    for (const entry of entries) {
      if (objects.length >= limit) return
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target, relative, objects, limit)
      else if (!relative.endsWith(metadataSuffix)) objects.push({ key: relative.split(path.sep).join('/') })
    }
  }

  return {
    async put(key, value, options = {}) {
      const target = resolveKey(key)
      await fs.mkdir(path.dirname(target), { recursive: true })
      const suffix = `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const temporary = `${target}${suffix}`; const metadataTemporary = `${target}${metadataSuffix}${suffix}`
      await fs.writeFile(temporary, value)
      await fs.rename(temporary, target)
      await fs.writeFile(metadataTemporary, JSON.stringify({ contentType: options.httpMetadata?.contentType || contentTypeFor(key) }))
      await fs.rename(metadataTemporary, `${target}${metadataSuffix}`)
    },

    async get(key) {
      const target = resolveKey(key)
      let body
      try { body = await fs.readFile(target) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
      const metadata = await readMetadata(target)
      return {
        body,
        httpMetadata: { contentType: metadata.contentType || contentTypeFor(key) },
        json: async () => JSON.parse(body.toString('utf8')),
      }
    },

    async list({ prefix = '', limit = 1000 } = {}) {
      const objects = []
      await walk(root, '', objects, Math.min(Number(limit) || 1000, 1000))
      return { objects: objects.filter(item => item.key.startsWith(prefix)).slice(0, limit) }
    },

    async delete(key) {
      const target = resolveKey(key)
      await Promise.all([fs.rm(target, { force: true }), fs.rm(`${target}${metadataSuffix}`, { force: true })])
    },

    async withLock(name, action) {
      await fs.mkdir(locksRoot, { recursive: true })
      const safeName = String(name || 'lock').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
      const lockPath = path.join(locksRoot, `${safeName}.lock`)
      const started = Date.now(); let handle
      while (!handle) {
        try { handle = await fs.open(lockPath, 'wx'); await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })) }
        catch (error) {
          if (error.code !== 'EEXIST') throw error
          try { const stat = await fs.stat(lockPath); if (Date.now() - stat.mtimeMs > 30000) await fs.rm(lockPath, { force: true }) } catch {}
          if (Date.now() - started > 15000) throw new Error('AUTH_LOCK_TIMEOUT')
          await new Promise(resolve => setTimeout(resolve, 40))
        }
      }
      try { return await action() } finally { await handle.close().catch(() => {}); await fs.rm(lockPath, { force: true }) }
    },

    async createBackup(prefixes, label) {
      const baseName = String(label || `backup-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_')
      let destination = path.join(root, 'backups', baseName); let suffix = 2
      while (true) { try { await fs.access(destination); destination = path.join(root, 'backups', `${baseName}-${suffix}`); suffix += 1 } catch { break } }
      await fs.mkdir(destination, { recursive: true })
      for (const prefix of prefixes) {
        const source = resolveKey(prefix)
        try {
          const stat = await fs.stat(source); const target = path.join(destination, prefix)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.cp(source, target, { recursive: stat.isDirectory(), errorOnExist: true, force: false })
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      await fs.writeFile(path.join(destination, 'backup-manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), prefixes }, null, 2))
      return destination
    },
  }
}
