import { promises as fs } from 'node:fs'
import path from 'node:path'

const metadataSuffix = '.sanhua-meta.json'

const contentTypeFor = key => {
  const extension = path.extname(key).toLowerCase()
  return extension === '.json' ? 'application/json; charset=utf-8' : extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : ['.jpg', '.jpeg'].includes(extension) ? 'image/jpeg' : 'application/octet-stream'
}

export function createRailwayVolumeBucket(storageDirectory) {
  const root = path.resolve(storageDirectory)

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
      await fs.writeFile(target, value)
      await fs.writeFile(`${target}${metadataSuffix}`, JSON.stringify({ contentType: options.httpMetadata?.contentType || contentTypeFor(key) }))
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
  }
}