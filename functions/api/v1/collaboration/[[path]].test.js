import { describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'
import { onRequestGet as listAssets } from '../assets.js'
import { putJson } from '../../../_lib/asset-store.js'

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

describe('workspace collaboration boundaries', () => {
  it('creates server sessions, scopes assets, and prevents a second workspace from listing them', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret' }
    const first = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '甲', email: 'a@example.com', password: 'secure-password-1', workspaceName: '甲工作台' }) })
    expect(first.status).toBe(201); const firstCookie = first.headers.get('set-cookie').split(';')[0]
    const firstSession = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, firstCookie) }); const firstData = await firstSession.json()
    await putJson(assets, 'metadata/assets/owned.json', { id: 'owned', workspaceId: firstData.workspace.id, tenantId: firstData.workspace.id, projectId: 'brand', createdBy: firstData.user.id, visibility: 'workspace', assetSpace: 'brand', name: '私有设计', storageKey: 'uploads/a.png', thumbnailKey: 'uploads/a.png', createdAt: new Date().toISOString() })
    const second = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '乙', email: 'b@example.com', password: 'secure-password-2', workspaceName: '乙工作台' }) })
    const secondCookie = second.headers.get('set-cookie').split(';')[0]
    const invisible = await listAssets({ env, request: request('/api/v1/assets', 'GET', null, secondCookie) })
    expect((await invisible.json()).assets).toEqual([])
    const visible = await listAssets({ env, request: request('/api/v1/assets', 'GET', null, firstCookie) })
    expect((await visible.json()).assets.map(asset => asset.id)).toEqual(['owned'])
  })

  it('never returns the API key while verifying and saving a personal connection', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret' }
    const account = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '甲', email: 'key@example.com', password: 'secure-password-3' }) })
    const cookie = account.headers.get('set-cookie').split(';')[0]
    const response = await onRequestPost({ env, request: request('/api/v1/me/provider-connection', 'POST', { provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', apiKey: 'sk-secret-never-return' }, cookie) })
    const value = await response.json()
    expect(response.status).toBe(200); expect(JSON.stringify(value)).not.toContain('sk-secret-never-return'); expect(value.connection.apiKeyLast4).toBe('turn')
    const listed = await onRequestGet({ env, request: request('/api/v1/me/provider-connection', 'GET', null, cookie) })
    expect(JSON.stringify(await listed.json())).not.toContain('sk-secret-never-return')
  })

  it('lets only the signed-in user update profile and password after current-password verification', async () => {
    const assets = bucket(); const env = { SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret' }
    const account = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '原名称', email: 'profile@example.com', password: 'secure-password-4' }) })
    const cookie = account.headers.get('set-cookie').split(';')[0]
    const profile = await onRequestPatch({ env, request: request('/api/v1/me', 'PATCH', { name: '新名称', email: 'renamed@example.com' }, cookie) })
    expect((await profile.json()).user).toMatchObject({ name: '新名称', email: 'renamed@example.com' })
    const denied = await onRequestPost({ env, request: request('/api/v1/me/password', 'POST', { currentPassword: 'incorrect-password', newPassword: 'secure-password-5' }, cookie) })
    expect(denied.status).toBe(400)
    const changed = await onRequestPost({ env, request: request('/api/v1/me/password', 'POST', { currentPassword: 'secure-password-4', newPassword: 'secure-password-5' }, cookie) })
    expect(changed.status).toBe(200)
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { email: 'renamed@example.com', password: 'secure-password-5' }) })
    expect(login.status).toBe(200)
  })
})
