import { describe, expect, it } from 'vitest'
import { createSession } from '../functions/_lib/collaboration.js'
import { externalRequestUrl } from './request-origin.mjs'

describe('Railway forwarded HTTPS requests', () => {
  it('secure_cookie_on_forwarded_https', async () => {
    const incoming = { headers: { host: 'sanhua-production.up.railway.app', 'x-forwarded-proto': 'https' }, url: '/api/v1/auth/login' }
    const url = externalRequestUrl(incoming)
    const bucket = { async put() {} }
    const session = await createSession({ env: { SANHUA_ASSETS: bucket }, request: new Request(url) }, 'user-1', 'main')
    expect(url).toBe('https://sanhua-production.up.railway.app/api/v1/auth/login')
    expect(session.cookie).toContain('Path=/')
    expect(session.cookie).toContain('HttpOnly')
    expect(session.cookie).toContain('SameSite=Lax')
    expect(session.cookie).toContain('; Secure')
  })

  it('localhost development remains non-secure', async () => {
    const url = externalRequestUrl({ headers: { host: 'localhost:3000' }, url: '/api/v1/auth/login' })
    const session = await createSession({ env: { SANHUA_ASSETS: { async put() {} } }, request: new Request(url) }, 'user-1', 'main')
    expect(session.cookie).not.toContain('; Secure')
  })
})
