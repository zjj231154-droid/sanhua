import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'
import { onRequestGet as listAssets } from '../assets.js'
import { putJson } from '../../../_lib/asset-store.js'
import { resolvedImageProviderConnection } from '../../../_lib/collaboration.js'

const bucket = () => {
  const data = new Map()
  return {
    async put(key, value, options = {}) { data.set(key, { value, options }) },
    async get(key) { const item = data.get(key); return item ? { async json() { return JSON.parse(item.value) }, body: new Blob([item.value]), httpMetadata: item.options.httpMetadata } : null },
    async list({ prefix = '', limit = 1000 }) { return { objects: [...data.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } },
    async delete(key) { data.delete(key) },
  }
}
const request = (path, method = 'GET', body, cookie) => new Request(`https://example.test${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
const inviteCodes = ['SH-TEST-0001-AAAA', 'SH-TEST-0002-BBBB', 'SH-TEST-0003-CCCC', 'SH-TEST-0004-DDDD', 'SH-TEST-0005-EEEE', 'SH-TEST-0006-FFFF', 'SH-TEST-0007-GGGG', 'SH-TEST-0008-HHHH', 'SH-TEST-0009-JJJJ']
const bootstrap = async env => onRequestPost({ env, request: request('/api/v1/admin/bootstrap', 'POST', { bootstrapSecret: 'test-bootstrap', username: '13882052720', password: 'secure-owner-password', name: '管理员', inviteCodes }) })

describe('workspace collaboration boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('initializes one owner plus nine reserved invitation seats without persisting full codes', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const owner = await bootstrap(env)
    expect(owner.status).toBe(201)
    const cookie = owner.headers.get('set-cookie').split(';')[0]
    const response = await onRequestGet({ env, request: request('/api/v1/admin/seats', 'GET', null, cookie) })
    const value = await response.json()
    expect(response.status).toBe(200)
    expect(value.seats).toHaveLength(10)
    expect(value.seats.filter(seat => seat.status === 'occupied')).toHaveLength(1)
    expect(value.seats.filter(seat => seat.status === 'reserved')).toHaveLength(9)
    expect(value.seats[0].user).toMatchObject({ username: '13882052720' })
    expect(value.seats[1].invite).toMatchObject({ codeLast4: 'AAAA', status: 'active' })
    expect(JSON.stringify(value)).not.toContain(inviteCodes[0])
  })

  it('creates server sessions, scopes assets, and prevents a second workspace from listing them', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const first = await bootstrap(env)
    expect(first.status).toBe(201); const firstCookie = first.headers.get('set-cookie').split(';')[0]
    const firstSession = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, firstCookie) }); const firstData = await firstSession.json()
    await putJson(assets, 'metadata/assets/owned.json', { id: 'owned', workspaceId: firstData.workspace.id, tenantId: firstData.workspace.id, projectId: 'brand', createdBy: firstData.user.id, visibility: 'private', assetSpace: 'brand', name: '私有设计', storageKey: 'uploads/a.png', thumbnailKey: 'uploads/a.png', createdAt: new Date().toISOString() })
    const second = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '乙', username: 'member_b', password: 'secure-password-2', inviteCode: inviteCodes[0] }) })
    const secondCookie = second.headers.get('set-cookie').split(';')[0]
    const invisible = await listAssets({ env, request: request('/api/v1/assets', 'GET', null, secondCookie) })
    expect((await invisible.json()).assets).toEqual([])
    const visible = await listAssets({ env, request: request('/api/v1/assets', 'GET', null, firstCookie) })
    expect((await visible.json()).assets.map(asset => asset.id)).toEqual(['owned'])
  })

  it('never returns the API key while verifying and saving a personal connection', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const account = await bootstrap(env)
    const cookie = account.headers.get('set-cookie').split(';')[0]
    const upstream = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'gpt-5.5' }] }), { status: 200 }))
    vi.stubGlobal('fetch', upstream)
    const response = await onRequestPost({ env, request: request('/api/v1/me/provider-connection/verify', 'POST', { provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', apiKey: 'sk-secret-never-return' }, cookie) })
    const value = await response.json()
    expect(response.status).toBe(200); expect(upstream).toHaveBeenCalledWith('https://api.usegoodai.com/v1/models', expect.objectContaining({ headers: { Authorization: 'Bearer sk-secret-never-return' } })); expect(JSON.stringify(value)).not.toContain('sk-secret-never-return'); expect(value.connection.apiKeyLast4).toBe('turn'); expect(value.connection.healthStatus).toBe('online')
    const listed = await onRequestGet({ env, request: request('/api/v1/me/provider-connection', 'GET', null, cookie) })
    expect(JSON.stringify(await listed.json())).not.toContain('sk-secret-never-return')
  })

  it('rechecks an encrypted connection and records an offline state when the provider becomes unreachable', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const account = await bootstrap(env)
    const cookie = account.headers.get('set-cookie').split(';')[0]
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await onRequestPost({ env, request: request('/api/v1/me/provider-connection/verify', 'POST', { provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', apiKey: 'sk-health-secret' }, cookie) })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network unavailable') }))
    const health = await onRequestGet({ env, request: request('/api/v1/me/provider-connection/status', 'GET', null, cookie) })
    const value = await health.json()
    expect(health.status).toBe(503); expect(value.healthy).toBe(false); expect(value.connection.healthStatus).toBe('offline'); expect(value.connection.verificationStatus).toBe('unhealthy'); expect(JSON.stringify(value)).not.toContain('sk-health-secret')
  })

  it('stores image and reasoning connections independently', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const account = await bootstrap(env)
    const cookie = account.headers.get('set-cookie').split(';')[0]
    const session = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, cookie) })
    const userId = (await session.json()).user.id
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await onRequestPost({ env, request: request('/api/v1/me/provider-connection/verify', 'POST', { provider: 'reasoning-gateway', baseUrl: 'https://reasoning.example.com/v1', apiKey: 'sk-reasoning-secret', reasoningModel: 'reasoning-1' }, cookie) })
    const imageSaved = await onRequestPost({ env, request: request('/api/v1/me/image-provider-connection/verify', 'POST', { provider: 'image-gateway', baseUrl: 'https://images.example.com/v1', apiKey: 'sk-image-secret', model: 'image-1' }, cookie) })
    expect(imageSaved.status).toBe(200)
    const [reasoning, image] = await Promise.all([onRequestGet({ env, request: request('/api/v1/me/provider-connection', 'GET', null, cookie) }), onRequestGet({ env, request: request('/api/v1/me/image-provider-connection', 'GET', null, cookie) })])
    expect((await reasoning.json()).connection).toMatchObject({ provider: 'reasoning-gateway', reasoningModel: 'reasoning-1', apiKeyLast4: 'cret' })
    expect((await image.json()).connection).toMatchObject({ provider: 'image-gateway', model: 'image-1', apiKeyLast4: 'cret' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network unavailable') }))
    await onRequestGet({ env, request: request('/api/v1/me/image-provider-connection/status', 'GET', null, cookie) })
    expect(await resolvedImageProviderConnection({ env }, userId)).toBeNull()
  })

  it('lets only the signed-in user update profile and password after current-password verification', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_SECRET: 'test-bootstrap' }
    const account = await bootstrap(env)
    const cookie = account.headers.get('set-cookie').split(';')[0]
    const profile = await onRequestPatch({ env, request: request('/api/v1/me', 'PATCH', { name: '新名称', email: 'renamed@example.com' }, cookie) })
    expect((await profile.json()).user).toMatchObject({ name: '新名称', email: 'renamed@example.com' })
    const denied = await onRequestPost({ env, request: request('/api/v1/me/password', 'POST', { currentPassword: 'incorrect-password', newPassword: 'secure-password-5' }, cookie) })
    expect(denied.status).toBe(400)
    const changed = await onRequestPost({ env, request: request('/api/v1/me/password', 'POST', { currentPassword: 'secure-owner-password', newPassword: 'secure-password-5' }, cookie) })
    expect(changed.status).toBe(200)
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: '13882052720', password: 'secure-password-5' }) })
    expect(login.status).toBe(200)
  })
})
