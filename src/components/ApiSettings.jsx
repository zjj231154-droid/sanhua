import { useEffect, useState } from 'react'

const DEFAULT_REASONING = { provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', model: 'gpt-5.5', apiKey: '' }
const DEFAULT_IMAGE = { provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', model: 'gpt-image-2', apiKey: '' }
const DEFAULT_VIDEO = { provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', model: 'doubao-seedance-2-0-260128', apiKey: '' }

function ConnectionForm({ title, kicker, connection, form, setForm, busy, message, onSave, onRemove, onCheck, checking, label }) {
  const signal = connection && <span className={`connection-signal is-${connection.healthStatus || 'unknown'}`} title={connection.lastCheckedAt ? `最后检测：${new Date(connection.lastCheckedAt).toLocaleString()}` : '尚未检测'}><i aria-hidden="true" />{connection.healthStatus === 'online' ? '已连通' : connection.healthStatus === 'offline' ? '连接异常' : checking ? '检测中' : '待检测'}</span>
  return <section className="key-settings-section"><span className="kicker">{kicker}</span><h2>{title}</h2><form onSubmit={event => { event.preventDefault(); onSave() }}><fieldset disabled={busy}>
    <label>服务商<input value={form.provider} onChange={event => setForm(current => ({ ...current, provider: event.target.value }))} maxLength={40} /></label>
    <label>HTTPS 服务地址<input type="url" value={form.baseUrl} onChange={event => setForm(current => ({ ...current, baseUrl: event.target.value }))} required /></label>
    <label>{label}模型 ID<input value={form.model} onChange={event => setForm(current => ({ ...current, model: event.target.value }))} maxLength={160} required /></label>
    <label>API Key<input type="password" value={form.apiKey} onChange={event => setForm(current => ({ ...current, apiKey: event.target.value }))} autoComplete="new-password" placeholder={connection ? `已保存（末尾 ${connection.apiKeyLast4}）；输入新密钥才会覆盖` : '输入你的个人 API Key'} required={!connection} /></label>
    {connection && <p className="api-cloud-notice">当前连接：{connection.provider} · {connection.model || connection.reasoningModel} · 末尾 {connection.apiKeyLast4} · {signal}</p>}
    <p>验证会真实请求服务商的模型列表；页面打开后及每 30 秒会重新检测。内网、localhost 和非 HTTPS 地址会被拒绝。</p>
    <div><button className="primary-button" type="submit">{busy ? '正在真实验证…' : '验证并保存'}</button>{connection && <button className="secondary-button" type="button" onClick={onCheck} disabled={checking}>重新检测</button>} {connection && <button className="secondary-button" type="button" onClick={onRemove}>删除连接</button>}</div>
  </fieldset></form><p role="status">{message}</p></section>
}

export default function ApiSettings() {
  const [reasoning, setReasoning] = useState(null); const [image, setImage] = useState(null); const [video, setVideo] = useState(null)
  const [reasoningForm, setReasoningForm] = useState(DEFAULT_REASONING); const [imageForm, setImageForm] = useState(DEFAULT_IMAGE); const [videoForm, setVideoForm] = useState(DEFAULT_VIDEO)
  const [busy, setBusy] = useState(''); const [checking, setChecking] = useState(false); const [messages, setMessages] = useState({ reasoning: '', image: '', video: '' })
  const load = async () => {
    const [r, i, v] = await Promise.all(['/api/v1/me/provider-connection', '/api/v1/me/image-provider-connection', '/api/v1/me/video-provider-connection'].map(url => fetch(url).then(response => response.json().catch(() => ({})))))
    setReasoning(r.connection || null); setImage(i.connection || null); setVideo(v.connection || null)
    if (r.connection) setReasoningForm(current => ({ ...current, provider: r.connection.provider, baseUrl: r.connection.baseUrl, model: r.connection.reasoningModel || current.model }))
    if (i.connection) setImageForm(current => ({ ...current, provider: i.connection.provider, baseUrl: i.connection.baseUrl, model: i.connection.model || current.model }))
    if (v.connection) setVideoForm(current => ({ ...current, provider: v.connection.provider, baseUrl: v.connection.baseUrl, model: v.connection.model || current.model }))
  }
  const check = async () => {
    setChecking(true)
    try {
      const [r, i, v] = await Promise.all(['/api/v1/me/provider-connection/status', '/api/v1/me/image-provider-connection/status', '/api/v1/me/video-provider-connection/status'].map(url => fetch(url).then(response => response.json().catch(() => ({})))))
      if (r.connection) setReasoning(r.connection); if (i.connection) setImage(i.connection); if (v.connection) setVideo(v.connection)
    } finally { setChecking(false) }
  }
  useEffect(() => { void load().then(check).catch(() => setMessages(current => ({ ...current, reasoning: '无法读取模型连接。' }))) }, [])
  useEffect(() => { const timer = window.setInterval(() => void check(), 30000); return () => window.clearInterval(timer) }, [])
  const save = async (kind, form, setter, endpoint) => {
    setBusy(kind); setMessages(current => ({ ...current, [kind]: '' }))
    try { const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind === 'reasoning' ? { ...form, reasoningModel: form.model } : form) }); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.hint || value.error || '保存失败'); setter(value.connection); if (kind === 'reasoning') setReasoningForm(current => ({ ...current, apiKey: '' })); if (kind === 'image') setImageForm(current => ({ ...current, apiKey: '' })); if (kind === 'video') setVideoForm(current => ({ ...current, apiKey: '' })); setMessages(current => ({ ...current, [kind]: '已真实连接服务商并加密保存。' })) } catch (error) { setMessages(current => ({ ...current, [kind]: error.message })) } finally { setBusy('') }
  }
  const remove = async (kind, setter, endpoint) => { if (!window.confirm('确定删除已保存的模型连接吗？')) return; await fetch(endpoint, { method: 'DELETE' }); setter(null); setMessages(current => ({ ...current, [kind]: '模型连接已删除。' })) }
  return <section className="page-content api-settings"><span className="kicker">MODEL CONNECTIONS</span><h1>模型 Key 设置</h1><p>推理、生图和视频模型分别配置、分别验证、分别监测。密钥只在服务端加密保存，绝不会回传到浏览器。</p>
    <ConnectionForm title="推理模型" kicker="REASONING" connection={reasoning} form={reasoningForm} setForm={setReasoningForm} busy={busy === 'reasoning'} checking={checking} message={messages.reasoning} onSave={() => save('reasoning', reasoningForm, setReasoning, '/api/v1/me/provider-connection/verify')} onRemove={() => remove('reasoning', setReasoning, '/api/v1/me/provider-connection')} onCheck={() => void check()} label="推理" />
    <ConnectionForm title="生图模型" kicker="IMAGE GENERATION" connection={image} form={imageForm} setForm={setImageForm} busy={busy === 'image'} checking={checking} message={messages.image} onSave={() => save('image', imageForm, setImage, '/api/v1/me/image-provider-connection/verify')} onRemove={() => remove('image', setImage, '/api/v1/me/image-provider-connection')} onCheck={() => void check()} label="生图" />
    <ConnectionForm title="短剧视频模型" kicker="SHORT DRAMA VIDEO" connection={video} form={videoForm} setForm={setVideoForm} busy={busy === 'video'} checking={checking} message={messages.video} onSave={() => save('video', videoForm, setVideo, '/api/v1/me/video-provider-connection/verify')} onRemove={() => remove('video', setVideo, '/api/v1/me/video-provider-connection')} onCheck={() => void check()} label="视频" />
  </section>
}
