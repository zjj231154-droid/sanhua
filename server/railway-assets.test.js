import { mkdtemp, rm } from 'node:fs/promises'
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