import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createRailwayVolumeBucket } from './railway-assets.mjs'

let directory = ''

afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = '' })

it('persists images and JSON metadata in a Railway volume directory', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'sanhua-volume-'))
  const bucket = createRailwayVolumeBucket(directory)
  await bucket.put('generated/retouch/output.png', new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: 'image/png' } })
  await bucket.put('metadata/assets/example.json', JSON.stringify({ id: 'example' }), { httpMetadata: { contentType: 'application/json' } })

  const image = await bucket.get('generated/retouch/output.png')
  expect(image.httpMetadata.contentType).toBe('image/png')
  expect([...image.body]).toEqual([1, 2, 3])
  expect(await (await bucket.get('metadata/assets/example.json')).json()).toEqual({ id: 'example' })
  expect((await bucket.list({ prefix: 'metadata/assets/' })).objects).toEqual([{ key: 'metadata/assets/example.json' }])
  expect(await bucket.get('missing.png')).toBeNull()
})

it('creates a non-destructive authentication migration backup and preserves it across restart', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'sanhua-volume-'))
  const first = createRailwayVolumeBucket(directory)
  await first.put('metadata/collaboration/users/legacy.json', JSON.stringify({ id: 'legacy' }), { httpMetadata: { contentType: 'application/json' } })
  await first.put('metadata/assets/asset-1.json', JSON.stringify({ id: 'asset-1' }), { httpMetadata: { contentType: 'application/json' } })
  const backupPath = await first.createBackup(['metadata/collaboration/users', 'metadata/assets'], 'auth-migration-test')
  await first.put('metadata/collaboration/users/legacy.json', JSON.stringify({ id: 'legacy', username: 'legacy' }), { httpMetadata: { contentType: 'application/json' } })

  const restarted = createRailwayVolumeBucket(directory)
  expect(await (await restarted.get('metadata/collaboration/users/legacy.json')).json()).toMatchObject({ username: 'legacy' })
  expect(JSON.parse(await readFile(path.join(backupPath, 'metadata/collaboration/users/legacy.json'), 'utf8'))).toEqual({ id: 'legacy' })
  expect(JSON.parse(await readFile(path.join(backupPath, 'metadata/assets/asset-1.json'), 'utf8'))).toEqual({ id: 'asset-1' })
}, 15000)
