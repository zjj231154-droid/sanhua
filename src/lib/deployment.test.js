import { expect, it } from 'vitest'
import { isCloudDeployment } from './deployment'

it('treats public deployment hosts as cloud environments', () => {
  expect(isCloudDeployment('sanhua.up.railway.app')).toBe(true)
  expect(isCloudDeployment('sanhua-872.pages.dev')).toBe(true)
})

it('keeps local development in local mode', () => {
  expect(isCloudDeployment('localhost')).toBe(false)
  expect(isCloudDeployment('127.0.0.1')).toBe(false)
})