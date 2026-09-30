import { getJson, putJson, requiredBucket } from './asset-store.js'
const json = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

const SESSION_COOKIE = 'sanhua_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
const text = value => String(value || '').trim()
const now = () => new Date().toISOString()
const base64 = bytes => btoa(String.fromCharCode(...bytes))
const bytesFromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0))
const randomToken = () => base64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, char => ({ '+': '-', '/': '_', '=': '' }[char]))
const sha256 = async value => base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
const keyFor = async (secret, purpose) => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}:${secret}`)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
const isTest = () => typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'

export const collaborationBucket = context => requiredBucket(context)
export const userKey = id => `metadata/collaboration/users/${id}.json`
export const workspaceKey = id => `metadata/collaboration/workspaces/${id}.json`
export const memberKey = (workspaceId, userId) => `metadata/collaboration/members/${workspaceId}/${userId}.json`
export const sessionKey = hash => `metadata/collaboration/sessions/${hash}.json`
const connectionKey = id => `metadata/collaboration/connections/${id}.json`
const imageConnectionKey = id => `metadata/collaboration/image-connections/${id}.json`
const videoConnectionKey = id => `metadata/collaboration/video-connections/${id}.json`
const avatarKey = (id, extension) => `metadata/collaboration/avatars/${id}.${extension}`
const inviteKey = tokenHash => `metadata/collaboration/invites/${tokenHash}.json`

export const rolePermissions = {
  owner: ['view', 'use', 'edit', 'manage'],
  admin: ['view', 'use', 'edit', 'manage'],
  editor: ['view', 'use', 'edit'],
  viewer: ['view'],
}

export const permissionForRole = role => rolePermissions[role] || []
export const hasPermission = (member, permission) => permissionForRole(member?.role).includes(permission)
export const cookieValue = (request, name) => String(request?.headers?.get?.('cookie') || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || ''

export async function passwordHash(password, salt = base64(crypto.getRandomValues(new Uint8Array(16)))) {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytesFromBase64(salt), iterations: 210000 }, raw, 256)
  return { salt, hash: base64(new Uint8Array(bits)) }
}

export const normalizeUsername = value => text(value).toLowerCase()
export const validUsername = value => /^[a-z0-9_]{3,32}$/.test(normalizeUsername(value)) || /^\d{11}$/.test(normalizeUsername(value))

export async function buildUserRecord(bucket, { name, username, email, phone, password }) {
  const rawEmail = text(email).toLowerCase()
  const normalizedEmail = /^\S+@\S+\.\S+$/.test(rawEmail) ? rawEmail : ''
  const normalizedPhone = text(phone || (/^\d{11}$/.test(rawEmail) ? rawEmail : ''))
  const normalizedUsername = normalizeUsername(username || normalizedPhone || normalizedEmail.split('@')[0])
  if (!validUsername(normalizedUsername)) return { error: 'INVALID_USERNAME' }
  const users = await listUsers(bucket)
  if (users.some(user => normalizeUsername(user.username) === normalizedUsername)) return { error: 'USERNAME_ALREADY_REGISTERED' }
  if (normalizedEmail && users.some(user => text(user.email).toLowerCase() === normalizedEmail)) return { error: 'EMAIL_ALREADY_REGISTERED' }
  if (normalizedPhone && users.some(user => text(user.phone) === normalizedPhone)) return { error: 'PHONE_ALREADY_REGISTERED' }
  const credential = await passwordHash(password)
  const id = crypto.randomUUID()
  const user = { id, username: normalizedUsername, email: normalizedEmail || null, phone: normalizedPhone || null, name: text(name).slice(0, 80) || normalizedUsername, passwordHash: credential.hash, passwordSalt: credential.salt, status: 'active', createdAt: now(), updatedAt: now() }
  return { user }
}

export async function createUser(bucket, input) {
  const created = await buildUserRecord(bucket, input)
  if (created.error) return created
  await putJson(bucket, userKey(created.user.id), created.user)
  return created
}

export async function listUsers(bucket) {
  const listed = await bucket.list({ prefix: 'metadata/collaboration/users/', limit: 1000 })
  const users = await Promise.all(listed.objects.map(item => getJson(bucket, item.key)))
  return users.filter(Boolean)
}

export async function findUserByLoginIdentifier(bucket, identifier) {
  const normalized = text(identifier).toLowerCase()
  if (!normalized) return null
  return (await listUsers(bucket)).find(candidate => normalizeUsername(candidate.username) === normalized || text(candidate.email).toLowerCase() === normalized || text(candidate.phone).toLowerCase() === normalized || text(candidate.account).toLowerCase() === normalized) || null
}

export async function verifyUserPasswordDetailed(bucket, identifier, password) {
  const user = await findUserByLoginIdentifier(bucket, identifier)
  if (!user) return { user: null, userFound: false, status: null, passwordMatch: false }
  if (user.status !== 'active' || !user.passwordHash || !user.passwordSalt) return { user: null, userFound: true, status: user.status || 'invalid', passwordMatch: false }
  const candidate = await passwordHash(password, user.passwordSalt)
  const passwordMatch = candidate.hash === user.passwordHash
  return { user: passwordMatch ? user : null, userFound: true, status: user.status, passwordMatch }
}

export async function verifyUserPassword(bucket, identifier, password) {
  return (await verifyUserPasswordDetailed(bucket, identifier, password)).user
}

export async function updateUserProfile(bucket, user, { name, email }) {
  const nextName = name === undefined ? user.name : text(name).slice(0, 80)
  const nextEmail = email === undefined ? user.email : text(email).toLowerCase()
  if (!nextName) return { error: 'NAME_REQUIRED' }
  if (nextEmail && !/^\S+@\S+\.\S+$/.test(nextEmail)) return { error: 'INVALID_EMAIL' }
  if (nextEmail !== user.email && (await listUsers(bucket)).some(item => item.id !== user.id && item.email === nextEmail)) return { error: 'EMAIL_ALREADY_REGISTERED' }
  const value = { ...user, name: nextName, email: nextEmail, updatedAt: now() }
  await putJson(bucket, userKey(user.id), value)
  return { user: value }
}

export async function changeUserPassword(bucket, user, currentPassword, newPassword) {
  if (String(newPassword || '').length < 10) return { error: 'PASSWORD_TOO_SHORT' }
  const candidate = await passwordHash(currentPassword, user.passwordSalt)
  if (candidate.hash !== user.passwordHash) return { error: 'CURRENT_PASSWORD_INCORRECT' }
  const credential = await passwordHash(newPassword)
  const value = { ...user, passwordHash: credential.hash, passwordSalt: credential.salt, passwordChangedAt: now(), updatedAt: now() }
  await putJson(bucket, userKey(user.id), value)
  return { user: value }
}

const avatarFromDataUrl = value => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''))
  if (!match) return null
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
  if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024) return null
  return { bytes, mimeType: match[1], extension: match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1] }
}

export async function saveUserAvatar(bucket, user, dataUrl) {
  const avatar = avatarFromDataUrl(dataUrl)
  if (!avatar) return { error: 'INVALID_AVATAR_IMAGE' }
  const storageKey = avatarKey(user.id, avatar.extension)
  await bucket.put(storageKey, avatar.bytes, { httpMetadata: { contentType: avatar.mimeType } })
  const value = { ...user, avatar: { storageKey, mimeType: avatar.mimeType, updatedAt: now() }, updatedAt: now() }
  await putJson(bucket, userKey(user.id), value)
  return { user: value }
}

export async function createWorkspace(bucket, { name, ownerId }) {
  const id = crypto.randomUUID()
  const workspace = { id, name: text(name).slice(0, 100) || '未命名工作空间', createdBy: ownerId, updatedBy: ownerId, version: 1, createdAt: now(), updatedAt: now() }
  const member = { workspaceId: id, userId: ownerId, role: 'owner', status: 'active', createdAt: now(), updatedAt: now() }
  await putJson(bucket, workspaceKey(id), workspace)
  await putJson(bucket, memberKey(id, ownerId), member)
  return workspace
}

export async function workspaceMembership(bucket, workspaceId, userId) {
  return getJson(bucket, memberKey(workspaceId, userId))
}

export async function listMemberships(bucket, userId) {
  const listed = await bucket.list({ prefix: 'metadata/collaboration/members/', limit: 5000 })
  const members = await Promise.all(listed.objects.map(item => getJson(bucket, item.key)))
  const own = members.filter(member => member?.userId === userId && member.status === 'active')
  return Promise.all(own.map(async member => ({ workspace: await getJson(bucket, workspaceKey(member.workspaceId)), member }))).then(rows => rows.filter(row => row.workspace))
}

export function secureCookie(context) {
  const url = new URL(context.request.url)
  return url.protocol === 'https:' || context.env?.SANHUA_SECURE_COOKIES === 'true'
}

export async function createSession(context, userId, workspaceId) {
  const bucket = collaborationBucket(context)
  if (!bucket) return null
  const token = randomToken(); const tokenHash = await sha256(token)
  const record = { tokenHash, userId, workspaceId, createdAt: now(), expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString() }
  await putJson(bucket, sessionKey(tokenHash), record)
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureCookie(context) ? '; Secure' : ''}`
  return { record, cookie }
}

export const clearSessionCookie = context => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(context) ? '; Secure' : ''}`

export async function destroyCurrentSession(context) {
  const bucket = collaborationBucket(context)
  const token = cookieValue(context.request, SESSION_COOKIE)
  if (bucket && token && typeof bucket.delete === 'function') await bucket.delete(sessionKey(await sha256(token)))
}

export async function currentIdentity(context) {
  const bucket = collaborationBucket(context)
  if (!bucket) return { error: json(503, { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }) }
  const token = cookieValue(context.request, SESSION_COOKIE)
  if (!token) return { error: json(401, { error: 'AUTHENTICATION_REQUIRED' }) }
  const session = await getJson(bucket, sessionKey(await sha256(token)))
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return { error: json(401, { error: 'SESSION_EXPIRED' }) }
  const user = await getJson(bucket, userKey(session.userId))
  const membership = await workspaceMembership(bucket, session.workspaceId, session.userId)
  if (!user || user.status !== 'active' || !membership || membership.status !== 'active') return { error: json(403, { error: 'WORKSPACE_ACCESS_REVOKED' }) }
  return { bucket, session, user, workspaceId: session.workspaceId, membership }
}

export async function requireIdentity(context, permission = 'view') {
  const identity = await currentIdentity(context)
  if (identity.error) {
    const compat = context.env?.SANHUA_ALLOW_LEGACY_DEMO === 'true' || isTest()
    if (!compat) return identity
    const url = context.request?.url ? new URL(context.request.url) : null
    const workspaceId = url?.searchParams.get('workspaceId') || url?.searchParams.get('workspace') || 'retouch'
    return { bucket: collaborationBucket(context), user: { id: 'test-user', name: '测试用户', email: 'test@example.invalid' }, workspaceId, membership: { role: 'owner', status: 'active' }, compatibilityMode: true }
  }
  if (!hasPermission(identity.membership, permission)) return { error: json(403, { error: 'INSUFFICIENT_PERMISSION', permission }) }
  return identity
}

export const publicUser = user => user && ({ id: user.id, username: user.username || user.phone || String(user.email || '').split('@')[0], name: user.name, email: user.email || null, phone: user.phone || null, avatarUrl: user.avatar?.storageKey ? `/api/v1/me/avatar?v=${encodeURIComponent(user.avatar.updatedAt || user.updatedAt || '')}` : null, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt || null })
export const publicWorkspace = (workspace, member) => workspace && ({ id: workspace.id, name: workspace.name, createdAt: workspace.createdAt, updatedAt: workspace.updatedAt, version: workspace.version, role: member?.role, permissions: permissionForRole(member?.role) })

export async function updateVersioned(bucket, key, current, change, actorId, expectedVersion) {
  if (!Number.isInteger(expectedVersion) || expectedVersion !== current.version) return { error: json(409, { error: 'VERSION_CONFLICT', currentVersion: current.version, updatedBy: current.updatedBy, updatedAt: current.updatedAt }) }
  const next = { ...current, ...change, version: current.version + 1, updatedBy: actorId, updatedAt: now() }
  await putJson(bucket, key, next)
  return { value: next }
}

export function validProviderBaseUrl(value) {
  try {
    const url = new URL(text(value))
    const host = url.hostname.toLowerCase()
    const privateHost = host === 'localhost' || host.endsWith('.local') || host === '::1' || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    return url.protocol === 'https:' && !url.username && !url.password && !privateHost ? url.toString().replace(/\/$/, '') : null
  } catch { return null }
}

export async function encryptSecret(context, plaintext) {
  const secret = text(context.env?.SANHUA_CONNECTION_ENCRYPTION_KEY || context.env?.SANHUA_SESSION_SECRET)
  if (!secret && !isTest()) return null
  const key = await keyFor(secret || 'test-only-connection-secret', 'provider-connection')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return { iv: base64(iv), cipher: base64(new Uint8Array(cipher)) }
}

export async function decryptSecret(context, encrypted) {
  const secret = text(context.env?.SANHUA_CONNECTION_ENCRYPTION_KEY || context.env?.SANHUA_SESSION_SECRET)
  if (!secret && !isTest()) return null
  try {
    const key = await keyFor(secret || 'test-only-connection-secret', 'provider-connection')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytesFromBase64(encrypted.iv) }, key, bytesFromBase64(encrypted.cipher))
    return new TextDecoder().decode(plain)
  } catch { return null }
}

export async function saveProviderConnection(context, userId, { provider, baseUrl, apiKey, reasoningModel, imageModel, verificationStatus = 'verified' }) {
  const encrypted = await encryptSecret(context, apiKey)
  if (!encrypted) return { error: json(503, { error: 'CONNECTION_ENCRYPTION_NOT_CONFIGURED', hint: '请配置 SANHUA_CONNECTION_ENCRYPTION_KEY 后再保存个人密钥。' }) }
  const checkedAt = now()
  const record = { userId, provider: text(provider) || 'usegoodai', baseUrl, reasoningModel: text(reasoningModel).slice(0, 160), imageModel: text(imageModel).slice(0, 160), encrypted, apiKeyLast4: apiKey.slice(-4), verificationStatus, healthStatus: verificationStatus === 'verified' ? 'online' : 'unknown', lastCheckedAt: checkedAt, createdAt: checkedAt, updatedAt: checkedAt }
  await putJson(collaborationBucket(context), connectionKey(userId), record)
  return { record }
}

export async function providerConnection(context, userId) { return getJson(collaborationBucket(context), connectionKey(userId)) }
export async function resolvedProviderConnection(context, userId) {
  const record = await providerConnection(context, userId)
  if (!record || record.verificationStatus !== 'verified') return null
  const apiKey = await decryptSecret(context, record.encrypted)
  return apiKey ? { name: record.provider, baseUrl: record.baseUrl, reasoningModel: record.reasoningModel || '', imageModel: record.imageModel || '', apiKey } : null
}

export async function saveImageProviderConnection(context, userId, { provider, baseUrl, apiKey, model, verificationStatus = 'verified' }) {
  const encrypted = await encryptSecret(context, apiKey)
  if (!encrypted) return { error: json(503, { error: 'CONNECTION_ENCRYPTION_NOT_CONFIGURED', hint: '请配置 SANHUA_CONNECTION_ENCRYPTION_KEY 后再保存个人密钥。' }) }
  const checkedAt = now()
  const record = { userId, provider: text(provider) || 'usegoodai', baseUrl, model: text(model).slice(0, 160), encrypted, apiKeyLast4: apiKey.slice(-4), verificationStatus, healthStatus: verificationStatus === 'verified' ? 'online' : 'unknown', lastCheckedAt: checkedAt, createdAt: checkedAt, updatedAt: checkedAt }
  await putJson(collaborationBucket(context), imageConnectionKey(userId), record)
  return { record }
}
export async function imageProviderConnection(context, userId) { return getJson(collaborationBucket(context), imageConnectionKey(userId)) }
export async function resolvedImageProviderConnection(context, userId) {
  const record = await imageProviderConnection(context, userId)
  if (record?.verificationStatus === 'verified') {
    const apiKey = await decryptSecret(context, record.encrypted)
    if (apiKey) return { name: record.provider, baseUrl: record.baseUrl, imageModel: record.model || '', apiKey }
  }
  // Only legacy accounts without a dedicated image connection may reuse the old shared key.
  // Once an image connection exists, an unhealthy state must block image calls instead of hiding it.
  return record ? null : resolvedProviderConnection(context, userId)
}

export async function saveVideoProviderConnection(context, userId, { provider, baseUrl, apiKey, model, verificationStatus = 'verified' }) {
  const encrypted = await encryptSecret(context, apiKey)
  if (!encrypted) return { error: json(503, { error: 'CONNECTION_ENCRYPTION_NOT_CONFIGURED', hint: '请配置 SANHUA_CONNECTION_ENCRYPTION_KEY 后再保存个人密钥。' }) }
  const checkedAt = now()
  const record = { userId, provider: text(provider) || 'tokenspace', baseUrl, model: text(model).slice(0, 160), encrypted, apiKeyLast4: apiKey.slice(-4), verificationStatus, healthStatus: verificationStatus === 'verified' ? 'online' : 'unknown', lastCheckedAt: checkedAt, createdAt: checkedAt, updatedAt: checkedAt }
  await putJson(collaborationBucket(context), videoConnectionKey(userId), record)
  return { record }
}

export async function videoProviderConnection(context, userId) { return getJson(collaborationBucket(context), videoConnectionKey(userId)) }
export async function resolvedVideoProviderConnection(context, userId) {
  const record = await videoProviderConnection(context, userId)
  if (!record || record.verificationStatus !== 'verified' || !record.model) return null
  const apiKey = await decryptSecret(context, record.encrypted)
  return apiKey ? { name: record.provider, baseUrl: record.baseUrl, model: record.model, apiKey } : null
}

export function withCookie(response, cookie) {
  const headers = new Headers(response.headers); headers.set('set-cookie', cookie)
  return new Response(response.body, { status: response.status, headers })
}

export const collaborationPaths = { connectionKey, imageConnectionKey, videoConnectionKey, inviteKey }
