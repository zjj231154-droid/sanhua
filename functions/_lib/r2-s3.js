const encoder = new TextEncoder()

const toBytes = value => {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return encoder.encode(String(value || ''))
}

const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', toBytes(value))))
}

async function hmac(key, value) {
  const cryptoKey = await crypto.subtle.importKey('raw', toBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, toBytes(value)))
}

const encode = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
const decodeXml = value => String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

class R2S3Bucket {
  constructor(env) {
    this.accountId = String(env.R2_ACCOUNT_ID || '').trim()
    this.accessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim()
    this.secretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim()
    this.bucket = String(env.R2_BUCKET_NAME || '').trim()
    this.endpoint = String(env.R2_ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, '')
  }

  async request(method, key = '', { body, contentType, query = {}, allowNotFound = false } = {}) {
    const endpoint = new URL(this.endpoint)
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const canonicalUri = `${endpoint.pathname.replace(/\/$/, '')}/${encode(this.bucket)}${key ? `/${key.split('/').map(encode).join('/')}` : '/'}`
    const canonicalQuery = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([name, value]) => [encode(name), encode(value)])
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${name}=${value}`)
      .join('&')
    const payloadHash = await sha256(body || '')
    const host = endpoint.host
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`
    const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`
    const dateKey = await hmac(`AWS4${this.secretAccessKey}`, dateStamp)
    const regionKey = await hmac(dateKey, 'auto')
    const serviceKey = await hmac(regionKey, 's3')
    const signingKey = await hmac(serviceKey, 'aws4_request')
    const signature = hex(await hmac(signingKey, stringToSign))
    const authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    const url = new URL(endpoint.toString())
    url.pathname = canonicalUri
    url.search = canonicalQuery
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        ...(contentType ? { 'content-type': contentType } : {}),
      },
      body: body === undefined ? undefined : toBytes(body),
    })
    if (response.status === 404 && allowNotFound) return null
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`R2 ${method} ${response.status}: ${detail.slice(0, 400)}`)
    }
    return response
  }

  async put(key, value, options = {}) {
    await this.request('PUT', key, { body: value, contentType: options.httpMetadata?.contentType })
  }

  async get(key) {
    const response = await this.request('GET', key, { allowNotFound: true })
    if (!response) return null
    return {
      body: response.body,
      httpMetadata: { contentType: response.headers.get('content-type') || undefined },
      json: () => response.json(),
    }
  }

  async list({ prefix = '', limit = 1000 } = {}) {
    const response = await this.request('GET', '', { query: { 'list-type': '2', prefix, 'max-keys': Math.min(Number(limit) || 1000, 1000) } })
    const xml = await response.text()
    return { objects: [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map(match => ({ key: decodeXml(match[1]) })) }
  }
}

export function r2S3BucketFor(env = {}) {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
  return required.every(name => String(env[name] || '').trim()) ? new R2S3Bucket(env) : null
}