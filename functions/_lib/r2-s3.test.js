import { expect, it } from 'vitest'
import { r2S3BucketFor } from './r2-s3'

const config = {
  R2_ACCOUNT_ID: 'account-id',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_BUCKET_NAME: 'sanhua-assets',
}

it('creates an S3-compatible R2 bucket for Railway credentials', () => {
  const bucket = r2S3BucketFor(config)
  expect(bucket).toMatchObject({ bucket: 'sanhua-assets' })
  expect(bucket.put).toBeTypeOf('function')
  expect(bucket.get).toBeTypeOf('function')
  expect(bucket.list).toBeTypeOf('function')
})

it('requires every R2 credential before enabling Railway storage', () => {
  expect(r2S3BucketFor({ ...config, R2_SECRET_ACCESS_KEY: '' })).toBeNull()
})