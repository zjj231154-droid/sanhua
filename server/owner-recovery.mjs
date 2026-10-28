import { enterprise } from '../functions/_lib/auth-system.js'
import { getJson, putJson } from '../functions/_lib/asset-store.js'
import { memberKey, normalizeUsername, passwordHash, userKey } from '../functions/_lib/collaboration.js'

export async function recoverOwnerPassword(bucket, { username, password, apply = false }) {
  const company = await enterprise(bucket)
  if (!company?.ownerId || !company?.workspaceId) throw new Error('OWNER_NOT_INITIALIZED')
  const key = userKey(company.ownerId)
  const owner = await getJson(bucket, key)
  if (!owner || normalizeUsername(owner.username) !== normalizeUsername(username) || owner.status !== 'active') {
    throw new Error('OWNER_IDENTITY_MISMATCH')
  }
  const member = await getJson(bucket, memberKey(company.workspaceId, owner.id))
  if (member?.role !== 'owner' || member?.status !== 'active') throw new Error('OWNER_MEMBERSHIP_MISMATCH')
  if (String(password || '').length < 10) throw new Error('RECOVERY_PASSWORD_TOO_SHORT')
  const current = owner.passwordSalt && owner.passwordHash
    ? await passwordHash(password, owner.passwordSalt)
    : null
  if (current?.hash === owner.passwordHash) return { status: 'already-matches', username: owner.username }
  if (!apply) return { status: 'password-mismatch', username: owner.username }

  const backupPath = await bucket.createBackup(['metadata/collaboration/users'], `owner-password-recovery-${Date.now()}`)
  const credential = await passwordHash(password)
  const updatedAt = new Date().toISOString()
  try {
    await putJson(bucket, key, { ...owner, passwordHash: credential.hash, passwordSalt: credential.salt, passwordChangedAt: updatedAt, updatedAt })
    const saved = await getJson(bucket, key)
    if (saved?.passwordHash !== credential.hash || saved?.passwordSalt !== credential.salt) throw new Error('RECOVERY_WRITE_FAILED')
  } catch (error) {
    await putJson(bucket, key, owner)
    throw error
  }
  return { status: 'recovered', username: owner.username, backupPath }
}
