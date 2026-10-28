import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { getJson, putJson } from '../functions/_lib/asset-store.js'
import { enterprise, prepareAuthentication } from '../functions/_lib/auth-system.js'
import { passwordHash, userKey, verifyUserPassword } from '../functions/_lib/collaboration.js'
import { createRailwayVolumeBucket } from './railway-assets.mjs'
import { recoverOwnerPassword } from './owner-recovery.mjs'

let directory = ''
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })

it('recovers only the existing owner password after a backup, without changing other account data', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'sanhua-recovery-'))
  const bucket = createRailwayVolumeBucket(directory)
  const username = '13882052720'
  const password = 'new-password-123'
  const prepared = await prepareAuthentication({ env: {
    SANHUA_ASSETS: bucket,
    SANHUA_BOOTSTRAP_ADMIN_USERNAME: username,
    SANHUA_BOOTSTRAP_ADMIN_PASSWORD: password,
  } })
  expect(prepared.status).toBe('ready')
  const company = await enterprise(bucket)
  const key = userKey(company.ownerId)
  const original = await getJson(bucket, key)
  const oldCredential = await passwordHash('previous-password-123')
  await putJson(bucket, key, { ...original, passwordHash: oldCredential.hash, passwordSalt: oldCredential.salt })

  expect(await recoverOwnerPassword(bucket, { username, password })).toMatchObject({ status: 'password-mismatch' })
  expect(await verifyUserPassword(bucket, username, password)).toBeNull()
  const result = await recoverOwnerPassword(bucket, { username, password, apply: true })
  expect(result.status).toBe('recovered')
  expect((await verifyUserPassword(bucket, username, password))?.id).toBe(company.ownerId)
  expect(await getJson(bucket, key)).toMatchObject({ id: original.id, username, phone: original.phone, status: 'active' })
  expect(JSON.parse(await readFile(path.join(result.backupPath, key), 'utf8'))).toMatchObject({ passwordHash: oldCredential.hash })
  expect(await recoverOwnerPassword(bucket, { username, password, apply: true })).toMatchObject({ status: 'already-matches' })
}, 45000)

it('refuses recovery when the configured account does not match the enterprise owner', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'sanhua-recovery-'))
  const bucket = createRailwayVolumeBucket(directory)
  await prepareAuthentication({ env: {
    SANHUA_ASSETS: bucket,
    SANHUA_BOOTSTRAP_ADMIN_USERNAME: '13882052720',
    SANHUA_BOOTSTRAP_ADMIN_PASSWORD: 'new-password-123',
  } })
  await expect(recoverOwnerPassword(bucket, { username: 'other-admin', password: 'new-password-123', apply: true }))
    .rejects.toThrow('OWNER_IDENTITY_MISMATCH')
}, 45000)
