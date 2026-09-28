import { getJson, putJson } from '../../../_lib/asset-store.js'
import { changeUserPassword, clearSessionCookie, collaborationPaths, createSession, createUser, createWorkspace, currentIdentity, listMemberships, listUsers, memberKey, permissionForRole, publicUser, publicWorkspace, requireIdentity, saveProviderConnection, saveUserAvatar, saveVideoProviderConnection, updateUserProfile, validProviderBaseUrl, verifyUserPassword, withCookie, workspaceKey, workspaceMembership } from '../../../_lib/collaboration.js'
import { json } from '../../../_lib/tokenspace.js'

const body = async request => { try { return await request.json() } catch { return {} } }
const route = request => new URL(request.url).pathname
const safeWorkspaceName = value => String(value || '').trim().slice(0, 100)

async function sessionPayload(context, identity = null) {
  const current = identity || await currentIdentity(context)
  if (current.error) return current
  const memberships = await listMemberships(current.bucket, current.user.id)
  return { user: publicUser(current.user), workspace: publicWorkspace(await getJson(current.bucket, workspaceKey(current.workspaceId)), current.membership), workspaces: memberships.map(row => publicWorkspace(row.workspace, row.member)) }
}

export async function onRequestGet(context) {
  const pathname = route(context.request)
  if (pathname === '/api/v1/session') {
    const payload = await sessionPayload(context)
    return payload.error || json(200, payload)
  }
  if (pathname === '/api/v1/me/provider-connection') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const record = await getJson(identity.bucket, collaborationPaths.connectionKey(identity.user.id))
    return json(200, { connection: record ? { provider: record.provider, baseUrl: record.baseUrl, reasoningModel: record.reasoningModel || '', imageModel: record.imageModel || '', apiKeyLast4: record.apiKeyLast4, verificationStatus: record.verificationStatus, updatedAt: record.updatedAt } : null })
  }
  if (pathname === '/api/v1/me/video-provider-connection') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const record = await getJson(identity.bucket, collaborationPaths.videoConnectionKey(identity.user.id))
    return json(200, { connection: record ? { provider: record.provider, baseUrl: record.baseUrl, model: record.model, apiKeyLast4: record.apiKeyLast4, verificationStatus: record.verificationStatus, updatedAt: record.updatedAt } : null })
  }
  if (pathname === '/api/v1/me/avatar') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const avatar = identity.user.avatar
    if (!avatar?.storageKey) return json(404, { error: 'AVATAR_NOT_FOUND' })
    const object = await identity.bucket.get(avatar.storageKey)
    if (!object) return json(404, { error: 'AVATAR_NOT_FOUND' })
    return new Response(object.body, { headers: { 'content-type': avatar.mimeType || object.httpMetadata?.contentType || 'image/png', 'cache-control': 'private, max-age=3600' } })
  }
  if (pathname === '/api/v1/me') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    return json(200, { user: publicUser(identity.user) })
  }
  if (/^\/api\/v1\/workspaces\/[^/]+\/members$/.test(pathname)) {
    const identity = await requireIdentity(context, 'manage'); if (identity.error) return identity.error
    const workspaceId = pathname.split('/')[4]
    const member = await workspaceMembership(identity.bucket, workspaceId, identity.user.id)
    if (!member || !permissionForRole(member.role).includes('manage')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
    const listed = await identity.bucket.list({ prefix: `metadata/collaboration/members/${workspaceId}/`, limit: 500 })
    const memberships = (await Promise.all(listed.objects.map(item => getJson(identity.bucket, item.key)))).filter(Boolean)
    const users = await listUsers(identity.bucket)
    return json(200, { members: memberships.map(item => ({ ...item, user: publicUser(users.find(user => user.id === item.userId)) })) })
  }
  return json(404, { error: 'NOT_FOUND' })
}

export async function onRequestPost(context) {
  const pathname = route(context.request); const input = await body(context.request)
  if (pathname === '/api/v1/auth/register') {
    const bucket = context.env?.SANHUA_ASSETS
    const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || '')
    if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) return json(400, { error: 'INVALID_REGISTRATION', hint: '请填写有效邮箱，并使用至少 10 位密码。' })
    const created = await createUser(bucket, { name: input.name, email, password })
    if (created.error) return json(409, { error: created.error })
    const workspace = await createWorkspace(bucket, { name: safeWorkspaceName(input.workspaceName) || `${created.user.name} 的工作台`, ownerId: created.user.id })
    const session = await createSession(context, created.user.id, workspace.id)
    return withCookie(json(201, { user: publicUser(created.user), workspace: publicWorkspace(workspace, { role: 'owner' }) }), session.cookie)
  }
  if (pathname === '/api/v1/auth/login') {
    const bucket = context.env?.SANHUA_ASSETS; if (!bucket) return json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' })
    const user = await verifyUserPassword(bucket, input.email, String(input.password || ''))
    if (!user) return json(401, { error: 'INVALID_CREDENTIALS' })
    const memberships = await listMemberships(bucket, user.id); if (!memberships.length) return json(403, { error: 'NO_WORKSPACE_ACCESS' })
    const selected = memberships[0]
    const session = await createSession(context, user.id, selected.workspace.id)
    return withCookie(json(200, { user: publicUser(user), workspace: publicWorkspace(selected.workspace, selected.member) }), session.cookie)
  }
  if (pathname === '/api/v1/auth/logout') return withCookie(json(204, {}), clearSessionCookie(context))
  if (pathname === '/api/v1/me/password') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const changed = await changeUserPassword(identity.bucket, identity.user, input.currentPassword, input.newPassword)
    return changed.error ? json(400, { error: changed.error }) : json(200, { user: publicUser(changed.user) })
  }
  if (pathname === '/api/v1/me/avatar') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const saved = await saveUserAvatar(identity.bucket, identity.user, input.avatar)
    return saved.error ? json(400, { error: saved.error, hint: '请上传 2MB 以内的 PNG、JPG 或 WebP 图片。' }) : json(200, { user: publicUser(saved.user) })
  }
  if (pathname === '/api/v1/workspaces') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const name = safeWorkspaceName(input.name); if (!name) return json(400, { error: 'WORKSPACE_NAME_REQUIRED' })
    const workspace = await createWorkspace(identity.bucket, { name, ownerId: identity.user.id })
    return json(201, { workspace: publicWorkspace(workspace, { role: 'owner' }) })
  }
  if (/^\/api\/v1\/workspaces\/[^/]+\/switch$/.test(pathname)) {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const workspaceId = pathname.split('/')[4]; const membership = await workspaceMembership(identity.bucket, workspaceId, identity.user.id)
    if (!membership || membership.status !== 'active') return json(403, { error: 'WORKSPACE_ACCESS_REVOKED' })
    const session = await createSession(context, identity.user.id, workspaceId)
    return withCookie(json(200, { workspace: publicWorkspace(await getJson(identity.bucket, workspaceKey(workspaceId)), membership) }), session.cookie)
  }
  if (/^\/api\/v1\/workspaces\/[^/]+\/invites$/.test(pathname)) {
    const identity = await requireIdentity(context, 'manage'); if (identity.error) return identity.error
    const workspaceId = pathname.split('/')[4]; const membership = await workspaceMembership(identity.bucket, workspaceId, identity.user.id)
    if (!membership || !permissionForRole(membership.role).includes('manage')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
    const email = String(input.email || '').trim().toLowerCase(); const role = ['admin', 'editor', 'viewer'].includes(input.role) ? input.role : 'viewer'
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'INVALID_EMAIL' })
    const token = crypto.randomUUID() + crypto.randomUUID(); const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); const hash = btoa(String.fromCharCode(...new Uint8Array(tokenHash)))
    const invite = { workspaceId, email, role, tokenHash: hash, createdBy: identity.user.id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), createdAt: new Date().toISOString() }
    await putJson(identity.bucket, collaborationPaths.inviteKey(hash), invite)
    return json(201, { invite: { email, role, expiresAt: invite.expiresAt }, acceptToken: token })
  }
  if (/^\/api\/v1\/invites\/[^/]+\/accept$/.test(pathname)) {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const token = pathname.split('/')[4]; const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)); const hash = btoa(String.fromCharCode(...new Uint8Array(digest)))
    const invite = await getJson(identity.bucket, collaborationPaths.inviteKey(hash))
    if (!invite || Date.parse(invite.expiresAt) < Date.now() || invite.email !== identity.user.email) return json(400, { error: 'INVALID_OR_EXPIRED_INVITE' })
    const member = { workspaceId: invite.workspaceId, userId: identity.user.id, role: invite.role, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await putJson(identity.bucket, memberKey(invite.workspaceId, identity.user.id), member)
    return json(200, { workspace: publicWorkspace(await getJson(identity.bucket, workspaceKey(invite.workspaceId)), member) })
  }
  if (pathname === '/api/v1/me/provider-connection/verify' || pathname === '/api/v1/me/provider-connection') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const baseUrl = validProviderBaseUrl(input.baseUrl)
    const apiKey = String(input.apiKey || '').trim()
    if (!baseUrl || apiKey.length < 8) return json(400, { error: 'INVALID_PROVIDER_CONNECTION', hint: '仅允许 HTTPS 公网地址和有效的 API Key。' })
    if (pathname.endsWith('/verify')) {
      try {
        const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) })
        if (!response.ok) return json(400, { error: 'PROVIDER_VERIFICATION_FAILED', status: response.status })
      } catch { return json(400, { error: 'PROVIDER_VERIFICATION_FAILED' }) }
    }
    const reasoningModel = String(input.reasoningModel || '').trim().slice(0, 160)
    const imageModel = String(input.imageModel || '').trim().slice(0, 160)
    const saved = await saveProviderConnection(context, identity.user.id, { provider: input.provider || 'usegoodai', baseUrl, apiKey, reasoningModel, imageModel, verificationStatus: 'verified' })
    if (saved.error) return saved.error
    return json(200, { connection: { provider: saved.record.provider, baseUrl: saved.record.baseUrl, reasoningModel: saved.record.reasoningModel, imageModel: saved.record.imageModel, apiKeyLast4: saved.record.apiKeyLast4, verificationStatus: saved.record.verificationStatus, updatedAt: saved.record.updatedAt } })
  }
  if (pathname === '/api/v1/me/video-provider-connection/verify' || pathname === '/api/v1/me/video-provider-connection') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const baseUrl = validProviderBaseUrl(input.baseUrl)
    const apiKey = String(input.apiKey || '').trim()
    const model = String(input.model || '').trim().slice(0, 160)
    if (!baseUrl || apiKey.length < 8 || !model) return json(400, { error: 'INVALID_VIDEO_PROVIDER_CONNECTION', hint: '请填写 HTTPS 服务地址、视频模型 ID 和有效的 API Key。' })
    if (pathname.endsWith('/verify')) {
      try {
        const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000) })
        if (!response.ok) return json(400, { error: 'PROVIDER_VERIFICATION_FAILED', status: response.status })
      } catch { return json(400, { error: 'PROVIDER_VERIFICATION_FAILED' }) }
    }
    const saved = await saveVideoProviderConnection(context, identity.user.id, { provider: input.provider || 'tokenspace', baseUrl, apiKey, model, verificationStatus: 'verified' })
    if (saved.error) return saved.error
    return json(200, { connection: { provider: saved.record.provider, baseUrl: saved.record.baseUrl, model: saved.record.model, apiKeyLast4: saved.record.apiKeyLast4, verificationStatus: saved.record.verificationStatus, updatedAt: saved.record.updatedAt } })
  }
  return json(404, { error: 'NOT_FOUND' })
}

export async function onRequestPatch(context) {
  const pathname = route(context.request); const input = await body(context.request)
  if (pathname === '/api/v1/me') {
    const identity = await requireIdentity(context); if (identity.error) return identity.error
    const saved = await updateUserProfile(identity.bucket, identity.user, input)
    return saved.error ? json(saved.error === 'EMAIL_ALREADY_REGISTERED' ? 409 : 400, { error: saved.error }) : json(200, { user: publicUser(saved.user) })
  }
  const match = /^\/api\/v1\/workspaces\/([^/]+)\/members\/([^/]+)$/.exec(pathname)
  if (!match) return json(404, { error: 'NOT_FOUND' })
  const identity = await requireIdentity(context, 'manage'); if (identity.error) return identity.error
  const [, workspaceId, userId] = match; const actor = await workspaceMembership(identity.bucket, workspaceId, identity.user.id)
  if (!actor || !permissionForRole(actor.role).includes('manage')) return json(403, { error: 'INSUFFICIENT_PERMISSION' })
  const member = await workspaceMembership(identity.bucket, workspaceId, userId); if (!member) return json(404, { error: 'MEMBER_NOT_FOUND' })
  if (member.role === 'owner') return json(400, { error: 'OWNER_ROLE_PROTECTED' })
  const role = ['admin', 'editor', 'viewer'].includes(input.role) ? input.role : member.role; const status = ['active', 'revoked'].includes(input.status) ? input.status : member.status
  await putJson(identity.bucket, memberKey(workspaceId, userId), { ...member, role, status, updatedAt: new Date().toISOString() })
  return json(200, { member: { ...member, role, status } })
}

export async function onRequestDelete(context) {
  const pathname = route(context.request)
  if (!['/api/v1/me/provider-connection', '/api/v1/me/video-provider-connection'].includes(pathname)) return json(404, { error: 'NOT_FOUND' })
  const identity = await requireIdentity(context); if (identity.error) return identity.error
  await identity.bucket.delete(pathname === '/api/v1/me/video-provider-connection' ? collaborationPaths.videoConnectionKey(identity.user.id) : collaborationPaths.connectionKey(identity.user.id))
  return json(204, {})
}
