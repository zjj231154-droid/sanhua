import { getJson, putJson } from './asset-store.js'
import { createSession, createUser, createWorkspace, listUsers, memberKey, publicUser, publicWorkspace, rolePermissions, userKey, workspaceMembership } from './collaboration.js'

export const SEAT_COUNT = 10
const enterpriseKey = 'metadata/collaboration/enterprise.json'
const seatKey = id => `metadata/collaboration/seats/${id}.json`
const inviteKey = hash => `metadata/collaboration/seat-invites/${hash}.json`
const inviteIndexKey = id => `metadata/collaboration/seat-invite-index/${id}.json`
const seatId = index => `S${String(index).padStart(2, '0')}`
const now = () => new Date().toISOString()
const normalizeUsername = value => String(value || '').trim().toLowerCase()
const hashToken = async value => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/[+/=]/g, char => ({ '+': '-', '/': '_', '=': '' }[char]))
}
const inviteMask = invite => invite && ({ id: invite.id, seatId: invite.seatId, role: invite.role, status: invite.status, expiresAt: invite.expiresAt, codeLast4: invite.codeLast4, consumedBy: invite.consumedBy || null, consumedAt: invite.consumedAt || null, createdAt: invite.createdAt })
const codeIsValid = code => /^SH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(code || '').trim())
const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), byte => alphabet[byte % alphabet.length]).join('')
  return `SH-${part()}-${part()}-${part()}`
}

export async function enterprise(bucket) { return getJson(bucket, enterpriseKey) }

export async function bootstrapEnterprise(context, { username, password, inviteCodes = [], name = '管理员', workspaceName = '叁花创作工作台' }) {
  const bucket = context.env?.SANHUA_ASSETS
  if (!bucket) return { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }
  if (await enterprise(bucket)) return { error: 'ENTERPRISE_ALREADY_INITIALIZED' }
  const normalizedUsername = normalizeUsername(username)
  if (!/^\d{11}$/.test(normalizedUsername)) return { error: 'INVALID_OWNER_USERNAME' }
  if (String(password || '').length < 10) return { error: 'PASSWORD_TOO_SHORT' }
  if (!Array.isArray(inviteCodes) || inviteCodes.length !== SEAT_COUNT - 1 || inviteCodes.some(code => !codeIsValid(code))) return { error: 'INVALID_INITIAL_INVITE_CODES', limit: SEAT_COUNT - 1 }
  if (new Set(inviteCodes.map(code => String(code).trim().toUpperCase())).size !== inviteCodes.length) return { error: 'DUPLICATE_INITIAL_INVITE_CODES' }
  const created = await createUser(bucket, { name, username: normalizedUsername, password })
  if (created.error) return created
  const workspace = await createWorkspace(bucket, { name: workspaceName, ownerId: created.user.id })
  const createdAt = now()
  await putJson(bucket, enterpriseKey, { id: 'sanhua-primary', workspaceId: workspace.id, ownerId: created.user.id, seatCount: SEAT_COUNT, createdAt, updatedAt: createdAt })
  await putJson(bucket, seatKey(seatId(1)), { id: seatId(1), workspaceId: workspace.id, status: 'occupied', assignedUserId: created.user.id, role: 'owner', version: 1, createdAt, updatedAt: createdAt })
  for (let index = 2; index <= SEAT_COUNT; index += 1) {
    const code = String(inviteCodes[index - 2]).trim().toUpperCase(); const tokenHash = await hashToken(code); const id = seatId(index)
    const invite = { id: crypto.randomUUID(), seatId: id, workspaceId: workspace.id, tokenHash, codeLast4: code.slice(-4), role: 'editor', status: 'active', createdBy: created.user.id, createdAt, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }
    await putJson(bucket, seatKey(id), { id, workspaceId: workspace.id, status: 'reserved', assignedUserId: null, role: 'editor', version: 1, createdAt, updatedAt: createdAt })
    await putJson(bucket, inviteKey(tokenHash), invite); await putJson(bucket, inviteIndexKey(id), { seatId: id, tokenHash })
  }
  const session = await createSession(context, created.user.id, workspace.id)
  return { user: publicUser(created.user), workspace: publicWorkspace(workspace, { role: 'owner' }), session }
}

export async function registerWithSeatInvite(context, { username, password, name, inviteCode }) {
  const bucket = context.env?.SANHUA_ASSETS
  if (!bucket) return { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }
  const configured = await enterprise(bucket)
  if (!configured) return { error: 'ENTERPRISE_NOT_INITIALIZED' }
  const normalizedUsername = normalizeUsername(username); const code = String(inviteCode || '').trim().toUpperCase()
  if (!(/^[a-z0-9_]{3,32}$/.test(normalizedUsername) || /^\d{11}$/.test(normalizedUsername))) return { error: 'INVALID_USERNAME' }
  if (String(password || '').length < 10) return { error: 'PASSWORD_TOO_SHORT' }
  if (!codeIsValid(code)) return { error: 'INVALID_INVITE_CODE' }
  const tokenHash = await hashToken(code); const invite = await getJson(bucket, inviteKey(tokenHash))
  if (!invite || invite.status !== 'active' || Date.parse(invite.expiresAt) <= Date.now()) return { error: 'INVALID_OR_EXPIRED_INVITE' }
  const seat = await getJson(bucket, seatKey(invite.seatId))
  if (!seat || seat.status !== 'reserved') return { error: 'INVITE_UNAVAILABLE' }
  if ((await listUsers(bucket)).some(user => user.username === normalizedUsername)) return { error: 'USERNAME_ALREADY_REGISTERED' }
  const created = await createUser(bucket, { name: name || normalizedUsername, username: normalizedUsername, password })
  if (created.error) return created
  const updatedAt = now(); const member = { workspaceId: configured.workspaceId, userId: created.user.id, role: invite.role, status: 'active', createdAt: updatedAt, updatedAt }
  await putJson(bucket, memberKey(configured.workspaceId, created.user.id), member)
  await putJson(bucket, seatKey(seat.id), { ...seat, status: 'occupied', assignedUserId: created.user.id, role: invite.role, version: Number(seat.version || 0) + 1, updatedAt })
  await putJson(bucket, inviteKey(tokenHash), { ...invite, status: 'consumed', consumedBy: created.user.id, consumedAt: updatedAt })
  const session = await createSession(context, created.user.id, configured.workspaceId)
  return { user: publicUser(created.user), workspace: publicWorkspace(await getJson(bucket, `metadata/collaboration/workspaces/${configured.workspaceId}.json`), member), session }
}

export async function seatsForAdmin(bucket) {
  const configured = await enterprise(bucket); if (!configured) return { error: 'ENTERPRISE_NOT_INITIALIZED' }
  const users = await listUsers(bucket); const seats = []
  for (let index = 1; index <= SEAT_COUNT; index += 1) {
    const seat = await getJson(bucket, seatKey(seatId(index))); const pointer = await getJson(bucket, inviteIndexKey(seatId(index))); const invite = pointer ? await getJson(bucket, inviteKey(pointer.tokenHash)) : null
    seats.push({ ...seat, user: publicUser(users.find(user => user.id === seat?.assignedUserId)), invite: inviteMask(invite) })
  }
  return { enterprise: configured, seats }
}

export async function createSeatInvite(bucket, actor, seatIdValue, role = 'editor') {
  const configured = await enterprise(bucket); const seat = await getJson(bucket, seatKey(seatIdValue))
  if (!configured || !seat || seat.workspaceId !== configured.workspaceId || seat.status !== 'available') return { error: 'SEAT_NOT_AVAILABLE' }
  const code = randomCode(); const tokenHash = await hashToken(code); const createdAt = now(); const safeRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'editor'
  const invite = { id: crypto.randomUUID(), seatId: seat.id, workspaceId: configured.workspaceId, tokenHash, codeLast4: code.slice(-4), role: safeRole, status: 'active', createdBy: actor.id, createdAt, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }
  await putJson(bucket, seatKey(seat.id), { ...seat, status: 'reserved', role: safeRole, version: Number(seat.version || 0) + 1, updatedAt: createdAt })
  await putJson(bucket, inviteKey(tokenHash), invite); await putJson(bucket, inviteIndexKey(seat.id), { seatId: seat.id, tokenHash })
  return { invite: inviteMask(invite), code }
}

export const initialSeatCodesExpected = SEAT_COUNT - 1
