import { afterEach, expect, it, vi } from 'vitest'
import { preflightReferences } from './reference-preflight.js'
import { onRequestPost } from '../api/v1/assets/[[path]].js'

class Bucket {
  constructor() { this.values = new Map() }
  async put(key, value) { this.values.set(key, value) }
  async get(key) { const value = this.values.get(key); return value == null ? null : { json: async () => JSON.parse(value), arrayBuffer: async () => new Uint8Array(value).buffer } }
}
const fixture = () => ({ env: { SANHUA_ASSETS: new Bucket() }, request: new Request('https://app.test/api/v1/assets/reference-preflight'), params: { path: 'reference-preflight' } })
const owner = { user: { id: 'user-a' }, workspaceId: 'main', membership: { role: 'editor' } }
const asset = async (context, id, patch = {}) => { await context.env.SANHUA_ASSETS.put(`metadata/assets/${id}.json`, JSON.stringify({ id, workspaceId: 'main', createdBy: 'user-a', name: id === 'broken' ? '损坏的茶馆图' : id, mimeType: 'image/png', assetType: 'image', usableFor: ['video'], storageKey: `uploads/${id}.png`, ...patch })); if (id !== 'broken') await context.env.SANHUA_ASSETS.put(`uploads/${id}.png`, [1, 2, 3]) }
afterEach(() => vi.unstubAllGlobals())

it('reference_preflight_returns_per_asset_readability and identifies the failing material', async () => {
  const context = fixture(); await asset(context, 'scene'); await asset(context, 'broken')
  const result = await preflightReferences(context, owner, ['scene', 'broken'])
  expect(result.ready).toBe(false)
  expect(result.items).toMatchObject([{ assetId: 'scene', readable: true }, { assetId: 'broken', name: '损坏的茶馆图', readable: false, code: 'IMAGE_UNREADABLE' }])
  expect(result.errors[0].reason).toContain('文件不存在')
})
it('shared_asset_can_be_referenced_without_exposing_owner_task; private result remains hidden', async () => {
  const context = fixture(); await asset(context, 'shared', { visibility: 'workspace' }); await asset(context, 'private-result', { sourceTaskId: 'private-task', visibility: 'private' })
  const other = { ...owner, user: { id: 'user-b' } }
  expect((await preflightReferences(context, other, ['shared'])).ready).toBe(true)
  const denied = await preflightReferences(context, other, ['private-result'])
  expect(denied.items[0]).toMatchObject({ name: 'private-result', code: 'ASSET_NOT_FOUND', readable: false })
  expect(JSON.stringify(denied)).not.toContain('private-task')
})
it('preflight checks actual external bytes, rejects unreadable or unsupported formats and private destinations', async () => {
  const context = fixture(); await asset(context, 'external', { externalUrl: 'https://cdn.example.test/scene.png' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })))
  expect((await preflightReferences(context, owner, ['external'])).errors[0].reason).toContain('HTTP 404')
  globalThis.fetch.mockResolvedValue(new Response('html', { headers: { 'content-type': 'text/html' } }))
  expect((await preflightReferences(context, owner, ['external'])).errors[0].code).toBe('UNSUPPORTED_FORMAT')
  await asset(context, 'internal', { externalUrl: 'https://127.0.0.1/private.png' })
  expect((await preflightReferences(context, owner, ['internal'])).errors[0].code).toBe('REFERENCE_URL_FORBIDDEN')
})
it('preflight endpoint returns 422 with named failures and rejects an invalid request', async () => {
  const context = fixture(); await asset(context, 'broken')
  const request = body => new Request(context.request.url, { method: 'POST', body: JSON.stringify(body) })
  const response = await onRequestPost({ ...context, request: request({ referencedAssetIds: ['broken'] }) })
  expect(response.status).toBe(422)
  expect((await response.json()).items[0].name).toBe('损坏的茶馆图')
  expect((await onRequestPost({ ...context, request: request({}) })).status).toBe(400)
})
