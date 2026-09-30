import { describe, expect, it } from 'vitest'
import { getJson, putJson } from './asset-store.js'
import { authPaths, createSeatInvite, disableSeat, prepareAuthentication, registerWithSeatInvite, releaseSeat, seatsForAdmin } from './auth-system.js'
import { createUser, listMemberships, listUsers, memberKey, passwordHash, userKey, verifyUserPassword } from './collaboration.js'

const memoryBucket = (data = new Map(), options = {}) => {
  let failed = false
  return {
    data,
    async put(key, value, metadata = {}) {
      if (!failed && options.failOncePrefix && key.startsWith(options.failOncePrefix)) { failed = true; throw new Error('simulated write failure') }
      data.set(key, { value, metadata })
    },
    async get(key) { const item = data.get(key); return item ? { async json() { return JSON.parse(item.value) }, body: new Blob([item.value]), httpMetadata: item.metadata.httpMetadata } : null },
    async list({ prefix = '', limit = 1000 }) { return { objects: [...data.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(key => ({ key })) } },
    async delete(key) { data.delete(key) },
  }
}
const envFor = bucket => ({ SANHUA_ASSETS: bucket, SANHUA_BOOTSTRAP_ADMIN_USERNAME: 'admin', SANHUA_BOOTSTRAP_ADMIN_PASSWORD: 'secure-admin-password', SANHUA_BOOTSTRAP_ADMIN_NAME: '唯一管理员' })
const contextFor = bucket => ({ env: envFor(bucket), request: new Request('https://example.test/api/v1/auth/register') })

describe('auth system storage and transactions', () => {
  it('bootstrap_admin_creates_real_user and is idempotent', async () => {
    const bucket = memoryBucket(); const first = await prepareAuthentication({ env: envFor(bucket) }); const second = await prepareAuthentication({ env: envFor(bucket) })
    const users = await listUsers(bucket); const seats = await seatsForAdmin(bucket)
    expect(first.status).toBe('ready'); expect(second.status).toBe('ready')
    expect(users).toHaveLength(1); expect(users[0]).toMatchObject({ username: 'admin', status: 'active' })
    expect(await getJson(bucket, memberKey('main', users[0].id))).toMatchObject({ role: 'owner', status: 'active' })
    expect(seats.seats).toHaveLength(10); expect(seats.seats[0]).toMatchObject({ seatId: 'S01', status: 'occupied', boundUserId: users[0].id })
  })

  it('valid_invite_registers_user in main workspace and invite is single use', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    const invitation = await createSeatInvite(bucket, owner, 'S02', 'editor')
    const first = await registerWithSeatInvite(contextFor(bucket), { username: 'member_a', password: 'secure-member-password', inviteCode: invitation.code })
    const second = await registerWithSeatInvite(contextFor(bucket), { username: 'member_b', password: 'secure-member-password', inviteCode: invitation.code })
    expect(first.user).toMatchObject({ username: 'member_a' }); expect(first.workspace).toMatchObject({ id: 'main', role: 'editor' })
    expect(second.error).toBe('INVITE_ALREADY_USED')
    expect(await getJson(bucket, memberKey('main', first.user.id))).toMatchObject({ status: 'active' })
  })

  it('rejects invalid, expired and disabled invites with stable error codes', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    expect((await registerWithSeatInvite(contextFor(bucket), { username: 'invalid_user', password: 'secure-member-password', inviteCode: 'not-an-invite' })).error).toBe('INVALID_INVITE_CODE')

    const expired = await createSeatInvite(bucket, owner, 'S02')
    const expiredPointer = await getJson(bucket, authPaths.inviteIndexKey('S02'))
    const expiredRecord = await getJson(bucket, authPaths.inviteKey(expiredPointer.inviteCodeHash))
    await putJson(bucket, authPaths.inviteKey(expiredPointer.inviteCodeHash), { ...expiredRecord, expiresAt: '2000-01-01T00:00:00.000Z' })
    expect((await registerWithSeatInvite(contextFor(bucket), { username: 'expired_user', password: 'secure-member-password', inviteCode: expired.code })).error).toBe('INVITE_EXPIRED')

    const disabled = await createSeatInvite(bucket, owner, 'S03')
    await createSeatInvite(bucket, owner, 'S03')
    expect((await registerWithSeatInvite(contextFor(bucket), { username: 'disabled_user', password: 'secure-member-password', inviteCode: disabled.code })).error).toBe('INVITE_DISABLED')
  })

  it('concurrent_same_invite_only_one_success', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    const invitation = await createSeatInvite(bucket, owner, 'S02')
    const results = await Promise.all([
      registerWithSeatInvite(contextFor(bucket), { username: 'member_a', password: 'secure-member-password', inviteCode: invitation.code }),
      registerWithSeatInvite(contextFor(bucket), { username: 'member_b', password: 'secure-member-password', inviteCode: invitation.code }),
    ])
    expect(results.filter(result => result.user)).toHaveLength(1)
    expect(results.filter(result => result.error)).toHaveLength(1)
    expect((await listUsers(bucket)).filter(user => user.username.startsWith('member_'))).toHaveLength(1)
  })

  it('duplicate_username_rejected', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    const firstInvite = await createSeatInvite(bucket, owner, 'S02'); const secondInvite = await createSeatInvite(bucket, owner, 'S03')
    await registerWithSeatInvite(contextFor(bucket), { username: 'same_name', password: 'secure-member-password', inviteCode: firstInvite.code })
    const duplicate = await registerWithSeatInvite(contextFor(bucket), { username: 'same_name', password: 'secure-member-password', inviteCode: secondInvite.code })
    expect(duplicate.error).toBe('USERNAME_ALREADY_REGISTERED')
  })

  it('registration_failure_rolls_back every partial record', async () => {
    const shared = new Map(); const healthy = memoryBucket(shared); await prepareAuthentication({ env: envFor(healthy) }); const owner = (await listUsers(healthy))[0]
    const invitation = await createSeatInvite(healthy, owner, 'S02')
    const failing = memoryBucket(shared, { failOncePrefix: 'metadata/collaboration/members/main/' })
    const failed = await registerWithSeatInvite(contextFor(failing), { username: 'rolled_back', password: 'secure-member-password', inviteCode: invitation.code })
    expect(failed.error).toBe('REGISTRATION_ROLLED_BACK')
    expect((await listUsers(healthy)).some(user => user.username === 'rolled_back')).toBe(false)
    expect((await seatsForAdmin(healthy)).seats.find(seat => seat.seatId === 'S02')).toMatchObject({ status: 'invited', boundUserId: null })
  })

  it('seat_release_disables_identity without deleting existing assets', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    const invitation = await createSeatInvite(bucket, owner, 'S02'); const registered = await registerWithSeatInvite(contextFor(bucket), { username: 'member_a', password: 'secure-member-password', inviteCode: invitation.code })
    await putJson(bucket, 'metadata/assets/existing.json', { id: 'existing', workspaceId: 'main', createdBy: registered.user.id })
    await releaseSeat(bucket, owner, 'S02')
    expect((await verifyUserPassword(bucket, 'member_a', 'secure-member-password'))).toBeNull()
    expect(await getJson(bucket, 'metadata/assets/existing.json')).toMatchObject({ id: 'existing', createdBy: registered.user.id })
    expect(await getJson(bucket, userKey(registered.user.id))).toMatchObject({ status: 'disabled' })
    expect(await getJson(bucket, memberKey('main', registered.user.id))).toMatchObject({ status: 'disabled' })
  })

  it('disabled seat cannot issue an invite until it is released', async () => {
    const bucket = memoryBucket(); await prepareAuthentication({ env: envFor(bucket) }); const owner = (await listUsers(bucket))[0]
    await disableSeat(bucket, owner, 'S02')
    expect((await createSeatInvite(bucket, owner, 'S02')).error).toBe('SEAT_NOT_AVAILABLE')
    await releaseSeat(bucket, owner, 'S02')
    expect((await createSeatInvite(bucket, owner, 'S02')).code).toMatch(/^SH-/)
  })

  it('legacy_email_user_can_login and migration preserves password hashes, legacy workspaces and existing assets', async () => {
    const bucket = memoryBucket(); const credential = await passwordHash('legacy-password')
    const legacy = { id: 'legacy-user', name: '旧用户', email: 'legacy@example.com', passwordHash: credential.hash, passwordSalt: credential.salt, status: 'active', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }
    await putJson(bucket, userKey(legacy.id), legacy)
    await putJson(bucket, 'metadata/collaboration/workspaces/legacy-space.json', { id: 'legacy-space', name: '历史空间' })
    await putJson(bucket, memberKey('legacy-space', legacy.id), { workspaceId: 'legacy-space', userId: legacy.id, role: 'owner', status: 'active' })
    await putJson(bucket, 'metadata/assets/legacy-asset.json', { id: 'legacy-asset', workspaceId: 'legacy-space' })
    await putJson(bucket, 'metadata/assets/legacy-seed.json', { id: 'legacy-seed', workspaceId: 'legacy-space', sourceModule: 'legacy-cloud-sync', sharedWorkspaceIds: ['main'] })
    await putJson(bucket, 'metadata/assets/private-asset.json', { id: 'private-asset', workspaceId: 'legacy-space', visibility: 'private' })
    const result = await prepareAuthentication({ env: envFor(bucket) }); const migrated = await getJson(bucket, userKey(legacy.id))
    expect(migrated.username).toBe('legacy'); expect(migrated.passwordHash).toBe(credential.hash); expect(migrated.passwordSalt).toBe(credential.salt)
    expect(await verifyUserPassword(bucket, 'legacy@example.com', 'legacy-password')).toMatchObject({ id: legacy.id })
    expect(await getJson(bucket, 'metadata/assets/legacy-asset.json')).toMatchObject({ id: 'legacy-asset', workspaceId: 'legacy-space', sharedWorkspaceIds: ['main'] })
    expect(await getJson(bucket, 'metadata/assets/legacy-seed.json')).toMatchObject({ id: 'legacy-seed', workspaceId: 'legacy-space', sharedWorkspaceIds: [] })
    expect(await getJson(bucket, 'metadata/assets/private-asset.json')).toEqual({ id: 'private-asset', workspaceId: 'legacy-space', visibility: 'private' })
    expect(await getJson(bucket, 'metadata/collaboration/workspaces/legacy-space.json')).toMatchObject({ id: 'legacy-space' })
    expect(result.migration.joinedMainWorkspace).toContain(legacy.id)
    expect(result.migration).toMatchObject({ sharedAssetMigrationVersion: 1, sharedAssetCount: 1, skippedPrivateAssetCount: 1 })
    const rerun = await prepareAuthentication({ env: envFor(bucket) })
    expect(rerun.migration).toMatchObject({ sharedAssetMigrationVersion: 1, sharedAssetCount: 1, skippedPrivateAssetCount: 1 })
  })

  it('legacy_phone_user_can_login after migration', async () => {
    const bucket = memoryBucket(); const credential = await passwordHash('legacy-phone-password')
    await putJson(bucket, userKey('legacy-phone'), { id: 'legacy-phone', name: '旧管理员', phone: '13900000000', passwordHash: credential.hash, passwordSalt: credential.salt, status: 'active' })
    await prepareAuthentication({ env: envFor(bucket) })
    expect(await verifyUserPassword(bucket, '13900000000', 'legacy-phone-password')).toMatchObject({ id: 'legacy-phone', username: '13900000000' })
  })

  it('normalizes legacy v3 seat and invite field names without deleting them', async () => {
    const bucket = memoryBucket(); const ownerCredential = await passwordHash('secure-admin-password')
    await putJson(bucket, userKey('owner-old'), { id: 'owner-old', username: 'admin', name: '管理员', passwordHash: ownerCredential.hash, passwordSalt: ownerCredential.salt, status: 'active' })
    await putJson(bucket, 'metadata/collaboration/enterprise.json', { id: 'old-enterprise', workspaceId: 'old-main', ownerId: 'owner-old', seatCount: 10 })
    await putJson(bucket, 'metadata/collaboration/workspaces/old-main.json', { id: 'old-main', name: '旧主工作区' })
    await putJson(bucket, 'metadata/collaboration/seats/S01.json', { id: 'S01', workspaceId: 'old-main', status: 'occupied', assignedUserId: 'owner-old', role: 'owner' })
    await putJson(bucket, 'metadata/collaboration/seats/S02.json', { id: 'S02', workspaceId: 'old-main', status: 'reserved', assignedUserId: null, role: 'editor' })
    await putJson(bucket, 'metadata/collaboration/seat-invite-index/S02.json', { seatId: 'S02', tokenHash: 'old-hash' })
    await putJson(bucket, 'metadata/collaboration/seat-invites/old-hash.json', { id: 'old-invite', seatId: 'S02', workspaceId: 'old-main', tokenHash: 'old-hash', codeLast4: 'ABCD', role: 'editor', status: 'active', expiresAt: new Date(Date.now() + 86400000).toISOString() })
    await prepareAuthentication({ env: envFor(bucket) })
    const seats = await seatsForAdmin(bucket)
    expect(seats.enterprise).toMatchObject({ workspaceId: 'old-main', schemaVersion: 3 })
    expect(seats.seats[0]).toMatchObject({ seatId: 'S01', boundUserId: 'owner-old', status: 'occupied' })
    expect(seats.seats[1]).toMatchObject({ seatId: 'S02', status: 'invited', invite: { inviteId: 'old-invite', inviteCodeLast4: 'ABCD' } })
  })

  it('restart_preserves_users_and_login', async () => {
    const shared = new Map(); const firstProcess = memoryBucket(shared); await prepareAuthentication({ env: envFor(firstProcess) })
    const owner = (await listUsers(firstProcess))[0]; const invitation = await createSeatInvite(firstProcess, owner, 'S02')
    await registerWithSeatInvite(contextFor(firstProcess), { username: 'persistent_user', password: 'persistent-password', inviteCode: invitation.code })
    const restartedProcess = memoryBucket(shared)
    expect(await verifyUserPassword(restartedProcess, 'persistent_user', 'persistent-password')).toMatchObject({ username: 'persistent_user' })
    expect((await listMemberships(restartedProcess, (await verifyUserPassword(restartedProcess, 'persistent_user', 'persistent-password')).id))[0].workspace.id).toBe('main')
  })
})
