import { assetMetadataKey, getJson, listJson, putJson } from './asset-store.js'
import { buildUserRecord, createSession, findUserByLoginIdentifier, listUsers, memberKey, normalizeUsername, publicUser, publicWorkspace, userKey, validUsername, verifyUserPassword, workspaceKey } from './collaboration.js'

export const AUTH_SCHEMA_VERSION = 3
export const SEAT_COUNT = 10
export const MAIN_WORKSPACE_ID = 'main'
const enterpriseKey = 'metadata/collaboration/enterprise.json'
const migrationKey = 'metadata/collaboration/migrations/auth-v3.json'
const seatKey = id => `metadata/collaboration/seats/${id}.json`
const inviteKey = hash => `metadata/collaboration/seat-invites/${hash}.json`
const inviteIndexKey = id => `metadata/collaboration/seat-invite-index/${id}.json`
const seatId = index => `S${String(index).padStart(2, '0')}`
const now = () => new Date().toISOString()
const base64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, char => ({ '+': '-', '/': '_', '=': '' }[char]))
const hashInvite = async value => base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '').trim().toUpperCase()))))
const inviteCodeValid = code => /^SH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(code || '').trim())
const randomInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), byte => alphabet[byte % alphabet.length]).join('')
  return `SH-${part()}-${part()}-${part()}`
}
const normalizedInvite = (invite, fallbackHash = '') => invite && ({ ...invite, inviteId: invite.inviteId || invite.id, inviteCodeHash: invite.inviteCodeHash || invite.tokenHash || fallbackHash, inviteCodeLast4: invite.inviteCodeLast4 || invite.codeLast4 || '', boundUserId: invite.boundUserId || invite.consumedBy || null, usedAt: invite.usedAt || invite.consumedAt || null, updatedAt: invite.updatedAt || invite.createdAt })
const publicInvite = source => { const invite = normalizedInvite(source); return invite && ({ inviteId: invite.inviteId, seatId: invite.seatId, role: invite.role, status: invite.status, expiresAt: invite.expiresAt, inviteCode: invite.inviteCode || null, inviteCodeLast4: invite.inviteCodeLast4, usedAt: invite.usedAt || null, boundUserId: invite.boundUserId || null, createdAt: invite.createdAt, updatedAt: invite.updatedAt }) }

const inMemoryLocks = new WeakMap()
async function localLock(bucket, name, action) {
  let locks = inMemoryLocks.get(bucket)
  if (!locks) { locks = new Map(); inMemoryLocks.set(bucket, locks) }
  const previous = locks.get(name) || Promise.resolve()
  let release
  const gate = new Promise(resolve => { release = resolve })
  const tail = previous.catch(() => {}).then(() => gate)
  locks.set(name, tail)
  await previous.catch(() => {})
  try { return await action() } finally { release(); if (locks.get(name) === tail) locks.delete(name) }
}

export const withAuthLock = (bucket, name, action) => typeof bucket?.withLock === 'function' ? bucket.withLock(`auth-${name}`, action) : localLock(bucket, name, action)

async function snapshotJson(bucket, keys) {
  const values = new Map()
  for (const key of keys) values.set(key, await getJson(bucket, key))
  return values
}

async function restoreJson(bucket, snapshots) {
  for (const [key, value] of snapshots) {
    if (value === null || value === undefined) await bucket.delete?.(key)
    else await putJson(bucket, key, value)
  }
}

async function atomicJsonWrites(bucket, writes, afterWrite) {
  const snapshots = await snapshotJson(bucket, writes.map(([key]) => key))
  try {
    for (const [key, value] of writes) await putJson(bucket, key, value)
    return await afterWrite?.()
  } catch (error) {
    await restoreJson(bucket, snapshots)
    throw error
  }
}

export async function enterprise(bucket) { return getJson(bucket, enterpriseKey) }

const usernameCandidate = user => {
  const phone = String(user.phone || user.account || '').trim()
  if (/^\d{11}$/.test(phone)) return phone
  const legacyEmail = String(user.email || '').trim().toLowerCase()
  if (/^\d{11}$/.test(legacyEmail)) return legacyEmail
  const prefix = legacyEmail.includes('@') ? legacyEmail.split('@')[0] : ''
  return /^[a-z0-9_]{3,32}$/.test(prefix) ? prefix : `user_${String(user.id || '').replace(/-/g, '').slice(0, 8)}`
}

const uniqueUsername = (candidate, used) => {
  let value = normalizeUsername(candidate).replace(/[^a-z0-9_]/g, '_').slice(0, 32)
  if (!validUsername(value)) value = `user_${value.replace(/^_+|_+$/g, '').slice(0, 20) || crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
  const base = value.slice(0, 28)
  let index = 2
  while (used.has(value)) { value = `${base}_${index}`; index += 1 }
  used.add(value)
  return value
}

async function ensureBackup(bucket) {
  const previous = await getJson(bucket, migrationKey)
  if (previous?.backupPath && previous?.sharedAssetMigrationVersion === 1) return previous.backupPath
  if (typeof bucket.createBackup !== 'function') return 'test-memory-snapshot'
  return bucket.createBackup([
    'metadata/collaboration/users', 'metadata/collaboration/workspaces', 'metadata/collaboration/members',
    'metadata/assets', 'metadata/master-assets', 'metadata/scripts', 'metadata/tasks',
  ], `auth-migration-${new Date().toISOString().replace(/[:.]/g, '-')}`)
}

async function bootstrapEnterpriseUnlocked(bucket, env) {
  const existing = await enterprise(bucket)
  if (existing) return { enterprise: existing, created: false }
  const username = normalizeUsername(env?.SANHUA_BOOTSTRAP_ADMIN_USERNAME)
  const password = String(env?.SANHUA_BOOTSTRAP_ADMIN_PASSWORD || '')
  if (!username || !password) return { error: 'BOOTSTRAP_ADMIN_NOT_CONFIGURED' }
  if (!validUsername(username)) return { error: 'INVALID_BOOTSTRAP_ADMIN_USERNAME' }
  if (password.length < 10) return { error: 'BOOTSTRAP_ADMIN_PASSWORD_TOO_SHORT' }

  const existingUser = await findUserByLoginIdentifier(bucket, username)
  let owner = existingUser
  if (owner && !(await verifyUserPassword(bucket, username, password))) return { error: 'BOOTSTRAP_ADMIN_CREDENTIAL_CONFLICT' }
  if (!owner) {
    const created = await buildUserRecord(bucket, { username, phone: /^\d{11}$/.test(username) ? username : '', name: env?.SANHUA_BOOTSTRAP_ADMIN_NAME || '管理员', password })
    if (created.error) return created
    owner = created.user
  } else if (!owner.username) {
    owner = { ...owner, username, phone: owner.phone || (/^\d{11}$/.test(username) ? username : null), updatedAt: now() }
  }

  const createdAt = now()
  const workspace = await getJson(bucket, workspaceKey(MAIN_WORKSPACE_ID)) || { id: MAIN_WORKSPACE_ID, name: String(env?.SANHUA_MAIN_WORKSPACE_NAME || '叁花 AI 创作工作台').trim().slice(0, 100), createdBy: owner.id, updatedBy: owner.id, version: 1, createdAt, updatedAt: createdAt }
  const member = { workspaceId: workspace.id, userId: owner.id, role: 'owner', status: 'active', createdAt, updatedAt: createdAt }
  const company = { id: 'sanhua-primary', schemaVersion: AUTH_SCHEMA_VERSION, workspaceId: workspace.id, ownerId: owner.id, seatCount: SEAT_COUNT, createdAt, updatedAt: createdAt }
  const writes = [[userKey(owner.id), owner], [workspaceKey(workspace.id), workspace], [memberKey(workspace.id, owner.id), member], [enterpriseKey, company]]
  for (let index = 1; index <= SEAT_COUNT; index += 1) writes.push([seatKey(seatId(index)), { seatId: seatId(index), workspaceId: workspace.id, status: index === 1 ? 'occupied' : 'available', boundUserId: index === 1 ? owner.id : null, role: index === 1 ? 'owner' : 'editor', createdAt, updatedAt: createdAt }])
  await atomicJsonWrites(bucket, writes)
  return { enterprise: company, owner: publicUser(owner), workspace: publicWorkspace(workspace, member), created: true }
}

async function normalizeEnterpriseStructureUnlocked(bucket, company, env) {
  const owner = await getJson(bucket, userKey(company.ownerId))
  if (!owner) return { error: 'ENTERPRISE_OWNER_MISSING' }
  const updatedAt = now()
  const workspace = await getJson(bucket, workspaceKey(company.workspaceId)) || { id: company.workspaceId || MAIN_WORKSPACE_ID, name: String(env?.SANHUA_MAIN_WORKSPACE_NAME || '叁花 AI 创作工作台').trim().slice(0, 100), createdBy: owner.id, updatedBy: owner.id, version: 1, createdAt: updatedAt, updatedAt }
  const normalizedCompany = { ...company, schemaVersion: AUTH_SCHEMA_VERSION, workspaceId: workspace.id, seatCount: SEAT_COUNT, updatedAt }
  const writes = [[enterpriseKey, normalizedCompany], [workspaceKey(workspace.id), workspace], [memberKey(workspace.id, owner.id), { workspaceId: workspace.id, userId: owner.id, role: 'owner', status: 'active', createdAt: company.createdAt || updatedAt, updatedAt }]]
  for (let index = 1; index <= SEAT_COUNT; index += 1) {
    const id = seatId(index); const source = await getJson(bucket, seatKey(id)); const pointer = await getJson(bucket, inviteIndexKey(id))
    const pointerHash = pointer?.inviteCodeHash || pointer?.tokenHash || ''
    const legacyInvite = pointerHash ? await getJson(bucket, inviteKey(pointerHash)) : null
    const invite = normalizedInvite(legacyInvite, pointerHash)
    const legacyStatus = source?.status === 'reserved' ? 'invited' : source?.status
    const normalizedSeat = { ...source, seatId: id, workspaceId: workspace.id, status: index === 1 ? 'occupied' : legacyStatus || (invite?.status === 'active' ? 'invited' : 'available'), boundUserId: index === 1 ? owner.id : source?.boundUserId || source?.assignedUserId || null, role: index === 1 ? 'owner' : source?.role || invite?.role || 'editor', createdAt: source?.createdAt || updatedAt, updatedAt: source?.updatedAt || updatedAt }
    delete normalizedSeat.id; delete normalizedSeat.assignedUserId
    writes.push([seatKey(id), normalizedSeat])
    if (invite?.inviteCodeHash) writes.push([inviteKey(invite.inviteCodeHash), invite], [inviteIndexKey(id), { seatId: id, inviteCodeHash: invite.inviteCodeHash }])
  }
  await atomicJsonWrites(bucket, writes)
  return { enterprise: normalizedCompany, owner, workspace }
}

async function migrateLegacyUsersUnlocked(bucket, company, backupPath) {
  const previousReport = await getJson(bucket, migrationKey)
  const users = (await listUsers(bucket)).sort((left, right) => left.id === company.ownerId ? -1 : right.id === company.ownerId ? 1 : 0)
  const used = new Set()
  const seats = []
  for (let index = 1; index <= SEAT_COUNT; index += 1) seats.push(await getJson(bucket, seatKey(seatId(index))))
  const changes = []; const migratedUsers = []; const joinedMainWorkspace = []; const skippedNoSeat = []
  for (const source of users) {
    let user = source
    const currentUsername = normalizeUsername(user.username)
    if (!validUsername(currentUsername) || used.has(currentUsername)) {
      const username = uniqueUsername(validUsername(currentUsername) ? currentUsername : usernameCandidate(user), used)
      user = { ...user, username, phone: user.phone || (/^\d{11}$/.test(String(user.email || '')) ? String(user.email) : null), email: /^\S+@\S+\.\S+$/.test(String(user.email || '')) ? String(user.email).toLowerCase() : null, updatedAt: now() }
      changes.push([userKey(user.id), user]); migratedUsers.push({ userId: user.id, username })
    } else used.add(currentUsername)
    const currentMember = await getJson(bucket, memberKey(company.workspaceId, user.id))
    if (currentMember) continue
    const freeSeat = seats.find(seat => ['available', 'released'].includes(seat?.status))
    if (!freeSeat) { skippedNoSeat.push(user.id); continue }
    const updatedAt = now(); const role = user.id === company.ownerId ? 'owner' : 'editor'
    const member = { workspaceId: company.workspaceId, userId: user.id, role, status: user.status === 'active' ? 'active' : 'disabled', createdAt: updatedAt, updatedAt }
    const occupied = { ...freeSeat, status: 'occupied', boundUserId: user.id, role, updatedAt }
    changes.push([memberKey(company.workspaceId, user.id), member], [seatKey(freeSeat.seatId), occupied])
    Object.assign(freeSeat, occupied); joinedMainWorkspace.push(user.id)
  }
  const historicalAssets = await listJson(bucket, 'metadata/assets/', 1000)
  const sharedAssetIds = []; const unsharedLegacySeedIds = []; let skippedPrivateAssetCount = 0
  for (const asset of historicalAssets) {
    const sharedWorkspaceIds = Array.isArray(asset.sharedWorkspaceIds) ? asset.sharedWorkspaceIds : []
    if (asset.sourceModule === 'legacy-cloud-sync' && asset.workspaceId !== company.workspaceId && asset.tenantId !== company.workspaceId) {
      if (sharedWorkspaceIds.includes(company.workspaceId)) {
        const { sharedAt, ...preserved } = asset
        changes.push([assetMetadataKey(asset.id), { ...preserved, sharedWorkspaceIds: sharedWorkspaceIds.filter(id => id !== company.workspaceId) }])
        unsharedLegacySeedIds.push(asset.id)
      }
      continue
    }
    if (asset.workspaceId === company.workspaceId || asset.tenantId === company.workspaceId || sharedWorkspaceIds.includes(company.workspaceId)) continue
    if (asset.visibility === 'private') { skippedPrivateAssetCount += 1; continue }
    changes.push([assetMetadataKey(asset.id), { ...asset, sharedWorkspaceIds: [...sharedWorkspaceIds, company.workspaceId], sharedAt: now() }])
    sharedAssetIds.push(asset.id)
  }
  if (changes.length) await atomicJsonWrites(bucket, changes)
  const removed = new Set(unsharedLegacySeedIds)
  const allSharedAssetIds = [...new Set([...(previousReport?.sharedAssetIds || []).filter(id => !removed.has(id)), ...sharedAssetIds])]
  const report = { id: 'auth-v3', schemaVersion: AUTH_SCHEMA_VERSION, sharedAssetMigrationVersion: 1, backupPath, migratedUsers, joinedMainWorkspace, skippedNoSeat, sharedAssetCount: allSharedAssetIds.length, sharedAssetIds: allSharedAssetIds, skippedPrivateAssetCount, preservedPasswordHashes: true, preservedLegacyWorkspaces: true, completedAt: now() }
  await putJson(bucket, migrationKey, report)
  return report
}

export async function prepareAuthentication(context) {
  const bucket = context?.env?.SANHUA_ASSETS
  if (!bucket) return { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }
  return withAuthLock(bucket, 'bootstrap-migration', async () => {
    const backupPath = await ensureBackup(bucket)
    const bootstrapped = await bootstrapEnterpriseUnlocked(bucket, context.env)
    if (bootstrapped.error) return { ...bootstrapped, backupPath }
    const normalized = await normalizeEnterpriseStructureUnlocked(bucket, bootstrapped.enterprise, context.env)
    if (normalized.error) return { ...normalized, backupPath }
    const migration = await migrateLegacyUsersUnlocked(bucket, normalized.enterprise, backupPath)
    return { status: 'ready', ...bootstrapped, enterprise: normalized.enterprise, migration, backupPath }
  })
}

export async function seatsForAdmin(bucket) {
  const company = await enterprise(bucket)
  if (!company) return { error: 'ENTERPRISE_NOT_INITIALIZED' }
  const users = await listUsers(bucket); const seats = []
  for (let index = 1; index <= SEAT_COUNT; index += 1) {
    const seat = await getJson(bucket, seatKey(seatId(index)))
    const pointer = await getJson(bucket, inviteIndexKey(seatId(index)))
    const inviteHash = pointer?.inviteCodeHash || pointer?.tokenHash || ''
    const invite = inviteHash ? normalizedInvite(await getJson(bucket, inviteKey(inviteHash)), inviteHash) : null
    seats.push({ ...seat, user: publicUser(users.find(user => user.id === seat?.boundUserId)), invite: publicInvite(invite) })
  }
  return { enterprise: company, seats, migration: await getJson(bucket, migrationKey) }
}

export async function createSeatInvite(bucket, actor, seatIdValue, role = 'editor') {
  return withAuthLock(bucket, 'seat-invites', async () => {
    const company = await enterprise(bucket); const seat = await getJson(bucket, seatKey(seatIdValue))
    if (!company || !seat || seat.workspaceId !== company.workspaceId || seat.seatId === 'S01' || !['available', 'released', 'invited'].includes(seat.status)) return { error: 'SEAT_NOT_AVAILABLE' }
    const pointer = await getJson(bucket, inviteIndexKey(seat.seatId)); const previousHash = pointer?.inviteCodeHash || pointer?.tokenHash || ''; const previous = previousHash ? normalizedInvite(await getJson(bucket, inviteKey(previousHash)), previousHash) : null
    const code = randomInviteCode(); const inviteCodeHash = await hashInvite(code); const createdAt = now(); const safeRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'editor'
    const invite = { inviteId: crypto.randomUUID(), seatId: seat.seatId, workspaceId: company.workspaceId, inviteCodeHash, inviteCode: code, inviteCodeLast4: code.slice(-4), role: safeRole, status: 'active', createdBy: actor.id, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), createdAt, updatedAt: createdAt }
    const writes = [[seatKey(seat.seatId), { ...seat, status: 'invited', boundUserId: null, role: safeRole, updatedAt: createdAt }], [inviteKey(inviteCodeHash), invite], [inviteIndexKey(seat.seatId), { seatId: seat.seatId, inviteCodeHash }]]
    if (previous?.status === 'active') writes.push([inviteKey(previous.inviteCodeHash), { ...previous, status: 'disabled', updatedAt: createdAt }])
    await atomicJsonWrites(bucket, writes)
    return { invite: publicInvite(invite), code }
  })
}

export async function registerWithSeatInvite(context, { username, password, name, email, inviteCode }) {
  const bucket = context?.env?.SANHUA_ASSETS
  if (!bucket) return { error: 'SANHUA_ASSETS_NOT_CONFIGURED' }
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!inviteCodeValid(code)) return { error: 'INVALID_INVITE_CODE' }
  const inviteCodeHash = await hashInvite(code)
  return withAuthLock(bucket, 'seat-invites', async () => {
    const company = await enterprise(bucket)
    if (!company) return { error: 'ENTERPRISE_NOT_INITIALIZED' }
    const invite = normalizedInvite(await getJson(bucket, inviteKey(inviteCodeHash)), inviteCodeHash)
    if (!invite) return { error: 'INVALID_INVITE_CODE' }
    if (invite.status === 'used') return { error: 'INVITE_ALREADY_USED' }
    if (invite.status === 'disabled') return { error: 'INVITE_DISABLED' }
    if (Date.parse(invite.expiresAt) <= Date.now()) return { error: 'INVITE_EXPIRED' }
    const seat = await getJson(bucket, seatKey(invite.seatId))
    if (!seat || seat.status !== 'invited') return { error: 'SEAT_NOT_AVAILABLE' }
    if (!validUsername(username)) return { error: 'INVALID_USERNAME' }
    if (String(password || '').length < 10) return { error: 'PASSWORD_TOO_SHORT' }
    const created = await buildUserRecord(bucket, { username, password, name, email })
    if (created.error) return created
    const updatedAt = now(); const user = created.user
    const member = { workspaceId: company.workspaceId, userId: user.id, role: invite.role, status: 'active', createdAt: updatedAt, updatedAt }
    const occupied = { ...seat, status: 'occupied', boundUserId: user.id, role: invite.role, updatedAt }
    const used = { ...invite, status: 'used', usedAt: updatedAt, boundUserId: user.id, updatedAt }
    const writes = [[userKey(user.id), user], [memberKey(company.workspaceId, user.id), member], [seatKey(seat.seatId), occupied], [inviteKey(inviteCodeHash), used]]
    const snapshots = await snapshotJson(bucket, writes.map(([key]) => key))
    try {
      for (const [key, value] of writes) await putJson(bucket, key, value)
      const session = await createSession(context, user.id, company.workspaceId)
      if (!session) throw new Error('SESSION_CREATE_FAILED')
      return { user: publicUser(user), workspace: publicWorkspace(await getJson(bucket, workspaceKey(company.workspaceId)), member), session }
    } catch (error) {
      await restoreJson(bucket, snapshots)
      return { error: 'REGISTRATION_ROLLED_BACK', reason: error.message }
    }
  })
}

async function changeSeatState(bucket, actor, seatIdValue, target) {
  return withAuthLock(bucket, 'seat-invites', async () => {
    const company = await enterprise(bucket); const seat = await getJson(bucket, seatKey(seatIdValue))
    if (!company || !seat || seat.workspaceId !== company.workspaceId || seat.seatId === 'S01') return { error: 'SEAT_PROTECTED_OR_MISSING' }
    const updatedAt = now(); const writes = []
    const pointer = await getJson(bucket, inviteIndexKey(seat.seatId)); const inviteHash = pointer?.inviteCodeHash || pointer?.tokenHash || ''; const invite = inviteHash ? normalizedInvite(await getJson(bucket, inviteKey(inviteHash)), inviteHash) : null
    if (invite && !['used', 'disabled'].includes(invite.status)) writes.push([inviteKey(invite.inviteCodeHash), { ...invite, status: 'disabled', updatedAt }])
    if (seat.boundUserId) {
      const user = await getJson(bucket, userKey(seat.boundUserId)); const member = await getJson(bucket, memberKey(company.workspaceId, seat.boundUserId))
      if (user) writes.push([userKey(user.id), { ...user, status: 'disabled', disabledBy: actor.id, updatedAt }])
      if (member) writes.push([memberKey(company.workspaceId, member.userId), { ...member, status: 'disabled', updatedAt }])
    }
    writes.push([seatKey(seat.seatId), { ...seat, status: target, boundUserId: null, updatedAt }])
    await atomicJsonWrites(bucket, writes)
    return { seat: { ...seat, status: target, boundUserId: null, updatedAt } }
  })
}

export const disableSeat = (bucket, actor, seatIdValue) => changeSeatState(bucket, actor, seatIdValue, 'disabled')
export const releaseSeat = (bucket, actor, seatIdValue) => changeSeatState(bucket, actor, seatIdValue, 'released')

export const authPaths = { enterpriseKey, migrationKey, seatKey, inviteKey, inviteIndexKey }
