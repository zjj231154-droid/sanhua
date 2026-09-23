import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './[[path]].js'

afterEach(() => vi.unstubAllGlobals())

describe('UseGoodAI model connection probe', () => {
  it('makes a real chat-completions style probe and returns the responding model', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ model: 'gpt-5.5-2026-09', choices: [{ message: { content: 'connection successful' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    const response = await onRequestGet({ request: new Request('https://example.test/api/tokenspace/test'), params: { path: 'test' }, env: { USEGOODAI_API_KEY: 'test-key', USEGOODAI_REASONING_MODEL: 'gpt-5.5' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, requestedModel: 'gpt-5.5', respondedModel: 'gpt-5.5-2026-09', reply: 'connection successful' })
    expect(fetch).toHaveBeenCalledWith('https://api.usegoodai.com/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ model: 'gpt-5.5', max_tokens: 16 })
  })

  it('reports an unconfigured server key without making an upstream call', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const response = await onRequestGet({ request: new Request('https://example.test/api/tokenspace/test'), params: { path: 'test' }, env: {} })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ error: 'API_KEY_NOT_CONFIGURED' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
