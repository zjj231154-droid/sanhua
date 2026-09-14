import { providerRequest, provider } from '../server/provider.mjs'
import { promises as fs } from 'node:fs'
const config = await provider()
// Bound diagnostics separately from the application's 30-minute generation timeout.
const nativeFetch = globalThis.fetch
globalThis.fetch = (url, options) => nativeFetch(url, { ...options, signal: AbortSignal.timeout(25000) })
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64')
const tests = [
  ['A connectivity', 'models', {}],
  ['B generation', 'images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, prompt: 'A plain blue circle on a white background.', size: '1024x1024', response_format: 'b64_json' }) }],
  ...[1, 2].map(count => {
    const form = new FormData()
    form.append('model', config.model)
    form.append('prompt', 'Create a plain blue circle on white using the supplied image as reference.')
    form.append('response_format', 'b64_json')
    for (let i = 0; i < count; i++) form.append(count === 1 ? 'image' : 'image[]', new Blob([pixel], { type: 'image/png' }), `test-${i}.png`)
    return [count === 1 ? 'C single edit' : 'D multi edit', 'images/edits', { method: 'POST', body: form }]
  }),
]
for (const [name, route, options] of tests) {
  try {
    const result = await providerRequest(route, options)
    if (route !== 'models') {
      if (!result.data?.[0]?.b64_json) throw new Error('Missing data[0].b64_json')
      await fs.mkdir('storage/api-checks', { recursive: true })
      await fs.writeFile(`storage/api-checks/${name[0]}.png`, Buffer.from(result.data[0].b64_json, 'base64'))
    }
    console.log(name, 'PASS')
  } catch (error) { console.log(name, 'FAIL', error.message) }
}
