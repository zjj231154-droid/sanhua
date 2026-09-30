import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet, onRequestPatch, onRequestPost } from './[[path]].js'
import { createSeatInvite, prepareAuthentication, releaseSeat } from '../../../_lib/auth-system.js'
import { createUser, listUsers, resolvedImageProviderConnection } from '../../../_lib/collaboration.js'

const bucket = (data = new Map()) => ({
  data,
  async put(key, value, options = {}) { data.set(key, { value, options }) },
  async get(key) { const item = data.get(key); return item ? { async json() { return JSON.parse(item.value) }, body: new Blob([item.value]), httpMetadata: item.options.httpMetadata } : null },
  async list({ prefix = '', limit = 1000 }) { return { objects: [...data.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } },
  async delete(key) { data.delete(key) },
})
const request = (path, method = 'GET', body, cookie, protocol = 'https') => new Request(`${protocol}://example.test${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
const environment = assets => ({ SANHUA_ASSETS: assets, SANHUA_CONNECTION_ENCRYPTION_KEY: 'test-secret', SANHUA_BOOTSTRAP_ADMIN_USERNAME: 'admin', SANHUA_BOOTSTRAP_ADMIN_PASSWORD: 'secure-admin-password' })
const adminSession = async assets => {
  const env = environment(assets); await prepareAuthentication({ env })
  const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'admin', password: 'secure-admin-password' }) })
  return { env, login, cookie: login.headers.get('set-cookie').split(';')[0] }
}
const registerUser = async (assets, env, username, seat = 'S02') => {
  const owner = (await listUsers(assets)).find(user => user.username === 'admin')
  const invitation = await createSeatInvite(assets, owner, seat)
  const response = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: username, username, password: `secure-${username}-password`, inviteCode: invitation.code }) })
  return { response, cookie: response.headers.get('set-cookie')?.split(';')[0], invitation }
}

describe('authentication and collaboration boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('admin_can_login and login_sets_session_cookie', async () => {
    const assets = bucket(); const { login } = await adminSession(assets)
    expect(login.status).toBe(200)
    expect(await login.json()).toMatchObject({ user: { username: 'admin' }, workspace: { id: 'main', role: 'owner' } })
    expect(login.headers.get('set-cookie')).toContain('HttpOnly')
    expect(login.headers.get('set-cookie')).toContain('Secure')
  })

  it('username_user_can_login and session_restores_user', async () => {
    const assets = bucket(); const { env } = await adminSession(assets)
    const registered = await registerUser(assets, env, 'member_a')
    expect(registered.response.status).toBe(201)
    const session = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, registered.cookie) })
    expect(session.status).toBe(200)
    expect(await session.json()).toMatchObject({ user: { username: 'member_a' }, workspace: { id: 'main', role: 'editor' } })
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'member_a', password: 'secure-member_a-password' }) })
    expect(login.status).toBe(200)
  })

  it('admin sees the complete invite code and a member can register then log in with it', async () => {
    const assets = bucket(); const { env, cookie } = await adminSession(assets)
    const inviteResponse = await onRequestPost({ env, request: request('/api/v1/admin/seats/S02/invites', 'POST', { role: 'editor' }, cookie) })
    const created = await inviteResponse.json()
    expect(inviteResponse.status).toBe(201)
    expect(created.code).toMatch(/^SH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    const seatsResponse = await onRequestGet({ env, request: request('/api/v1/admin/seats', 'GET', null, cookie) })
    const seats = await seatsResponse.json()
    expect(seats.seats.find(seat => seat.seatId === 'S02').invite.inviteCode).toBe(created.code)

    const register = await onRequestPost({ env, request: request('/api/v1/auth/register', 'POST', { name: '邀请码成员', username: 'invite_member', password: 'secure-invite-member-password', inviteCode: created.code }) })
    expect(register.status).toBe(201)
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'invite_member', password: 'secure-invite-member-password' }) })
    expect(login.status).toBe(200)
    expect(await login.json()).toMatchObject({ user: { username: 'invite_member' }, workspace: { id: 'main', role: 'editor' } })
  })

  it('wrong_password_returns_invalid_credentials and unknown username is indistinguishable', async () => {
    const assets = bucket(); const { env } = await adminSession(assets)
    const wrong = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'admin', password: 'definitely-wrong' }) })
    const unknown = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'missing', password: 'definitely-wrong' }) })
    expect(wrong.status).toBe(401); expect(await wrong.json()).toEqual({ error: 'INVALID_CREDENTIALS' })
    expect(unknown.status).toBe(401); expect(await unknown.json()).toEqual({ error: 'INVALID_CREDENTIALS' })
  })

  it('user_without_workspace_returns_expected_error', async () => {
    const assets = bucket(); const env = environment(assets)
    await createUser(assets, { username: 'orphan_user', password: 'secure-orphan-password' })
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'orphan_user', password: 'secure-orphan-password' }) })
    expect(login.status).toBe(403); expect(await login.json()).toEqual({ error: 'NO_WORKSPACE_ACCESS' })
  })

  it('disabled_user_cannot_login', async () => {
    const assets = bucket(); const { env } = await adminSession(assets); const registered = await registerUser(assets, env, 'disabled_user')
    const owner = (await listUsers(assets)).find(user => user.username === 'admin'); await releaseSeat(assets, owner, 'S02')
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { username: 'disabled_user', password: 'secure-disabled_user-password' }) })
    expect(registered.response.status).toBe(201); expect(login.status).toBe(401); expect(await login.json()).toEqual({ error: 'INVALID_CREDENTIALS' })
  })

  it('logout_invalidates_session', async () => {
    const assets = bucket(); const { env, cookie } = await adminSession(assets)
    const logout = await onRequestPost({ env, request: request('/api/v1/auth/logout', 'POST', {}, cookie) })
    expect(logout.status).toBe(204)
    const session = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, cookie) })
    expect(session.status).toBe(401)
  })

  it('two_users_can_login_at_same_time and sessions stay isolated', async () => {
    const assets = bucket(); const { env } = await adminSession(assets)
    const a = await registerUser(assets, env, 'member_a', 'S02'); const b = await registerUser(assets, env, 'member_b', 'S03')
    const [aSession, bSession] = await Promise.all([onRequestGet({ env, request: request('/api/v1/session', 'GET', null, a.cookie) }), onRequestGet({ env, request: request('/api/v1/session', 'GET', null, b.cookie) })])
    expect((await aSession.json()).user.username).toBe('member_a')
    expect((await bSession.json()).user.username).toBe('member_b')
  })

  it('never returns API keys and stores image and reasoning connections independently', async () => {
    const assets = bucket(); const { env, cookie } = await adminSession(assets)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    const reasoning = await onRequestPost({ env, request: request('/api/v1/me/provider-connection/verify', 'POST', { provider: 'reasoning-gateway', baseUrl: 'https://reasoning.example.com/v1', apiKey: 'sk-reasoning-secret', reasoningModel: 'reasoning-1' }, cookie) })
    const image = await onRequestPost({ env, request: request('/api/v1/me/image-provider-connection/verify', 'POST', { provider: 'image-gateway', baseUrl: 'https://images.example.com/v1', apiKey: 'sk-image-secret', model: 'image-1' }, cookie) })
    expect(reasoning.status).toBe(200); expect(image.status).toBe(200)
    expect(JSON.stringify(await reasoning.json())).not.toContain('sk-reasoning-secret')
    const identity = await onRequestGet({ env, request: request('/api/v1/session', 'GET', null, cookie) }); const userId = (await identity.json()).user.id
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network unavailable') }))
    await onRequestGet({ env, request: request('/api/v1/me/image-provider-connection/status', 'GET', null, cookie) })
    expect(await resolvedImageProviderConnection({ env }, userId)).toBeNull()
  })

  it('lets the signed-in user update optional email and password', async () => {
    const assets = bucket(); const { env, cookie } = await adminSession(assets)
    const profile = await onRequestPatch({ env, request: request('/api/v1/me', 'PATCH', { name: '新名称', email: 'renamed@example.com' }, cookie) })
    expect((await profile.json()).user).toMatchObject({ name: '新名称', email: 'renamed@example.com' })
    const changed = await onRequestPost({ env, request: request('/api/v1/me/password', 'POST', { currentPassword: 'secure-admin-password', newPassword: 'secure-admin-password-2' }, cookie) })
    expect(changed.status).toBe(200)
    const login = await onRequestPost({ env, request: request('/api/v1/auth/login', 'POST', { email: 'renamed@example.com', password: 'secure-admin-password-2' }) })
    expect(login.status).toBe(200)
  })
})
