import { promises as fs } from 'node:fs'
import path from 'node:path'
const file = path.resolve('storage/private/provider.json')
export const BASE_URL = 'https://api.tokenspace.tech'
export async function provider() {
  try { const value = JSON.parse(await fs.readFile(file, 'utf8')); if (!value.model || value.model === 'gpt-5.6-luna') value.model = 'gpt-image-2'; return value } catch (error) { if (error.code === 'ENOENT') return { enabled: false, model: 'gpt-image-2', apiKey: '' }; throw error }
}
export const publicProvider = value => ({ enabled: !!value.enabled, model: value.model || 'gpt-image-2', hasKey: !!value.apiKey, baseUrl: BASE_URL, protocol: 'OpenAI Images' })
export async function saveProvider(data) {
  const old = await provider()
  const value = { enabled: data.enabled === true, model: String(data.model || '').trim().slice(0, 160), apiKey: typeof data.apiKey === 'string' && data.apiKey.trim() ? data.apiKey.trim() : old.apiKey }
  if (value.enabled && (!value.apiKey || !value.model)) throw new Error('请填写密钥和图片编辑模型')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value), { mode: 0o600 })
  return publicProvider(value)
}
export async function providerRequest(route, options = {}) {
  const config = await provider()
  if (!config.apiKey) throw new Error('请先在管理设置保存 API Key')
  if (!['models', 'images/edits', 'images/generations'].includes(route)) throw new Error('无效的图片 API 路径')
  const url = `${BASE_URL}/v1/${route}`
  const redact = value => String(value ?? '').split(config.apiKey).join('[REDACTED]').replace(/Bearer\s+\S+|sk-[\w-]+/gi, '[REDACTED]')
  let res
  let responseBody = ''
  try {
    res = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(route === 'models' ? 30000 : 1800000), headers: { ...options.headers, Authorization: `Bearer ${config.apiKey}` } })
    responseBody = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return JSON.parse(responseBody)
  } catch (error) {
    const cause = error.cause ? JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause)) : ''
    console.error('[TokenSpace]', { url, status: res?.status ?? null, message: redact(error.message), cause: redact(cause), responseBody: res?.ok ? '[invalid JSON response]' : redact(responseBody).slice(0, 12000) })
    const safeCause = error.cause ? [error.cause.code, error.cause.message].filter(Boolean).join(': ') : ''
    throw new Error(`TokenSpace ${url}：${redact(error.message)}${safeCause ? '；' + redact(safeCause) : ''}${!res?.ok && responseBody ? '；' + redact(responseBody).slice(0, 1000) : ''}`, { cause: error })
  }
}
export async function generateViaProvider(prompt) {
  const config = await provider()
  return providerRequest('images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, prompt, size: '1024x1024', response_format: 'b64_json' }) })
}
export async function editViaProvider(job, dir) {
  const config = await provider()
  const form = new FormData()
  const input = await fs.readFile(path.join(dir, job.input))
  const mime = job.input.endsWith('.png') ? 'image/png' : job.input.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'
  form.append('model', config.model)
  const files = [job.input, ...(job.references || [])]
  for (const name of files) {
    const bytes = name === job.input ? input : await fs.readFile(path.join(dir, name))
    form.append(files.length > 1 ? 'image[]' : 'image', new Blob([bytes], { type: name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : mime }), name)
  }
  form.append('prompt', `按已确认计划精修原图，保留商品与文字，不新增文案：\n${job.plan}`)
  form.append('response_format', 'b64_json')
  const response = await providerRequest('images/edits', { method: 'POST', body: form })
  const encoded = response.data?.[0]?.b64_json
  if (!encoded) throw new Error('接口未返回 base64 图片；当前适配 images/edits 的 b64_json 返回格式，请核对中转站图片接口文档')
  const bytes = Buffer.from(encoded, 'base64')
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
  if (!(png || jpg || webp)) throw new Error('返回内容不是有效的 PNG、JPG 或 WebP 图片')
  const name = `retouched.${png ? 'png' : jpg ? 'jpg' : 'webp'}`
  await fs.writeFile(path.join(dir, 'outputs', name), bytes)
  return name
}
