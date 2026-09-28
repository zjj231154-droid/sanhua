import { useEffect, useState } from 'react'

export default function ApiSettings() {
  const [connection, setConnection] = useState(null)
  const [form, setForm] = useState({ provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', reasoningModel: 'gpt-5.5', imageModel: 'gpt-image-2', apiKey: '' })
  const [videoConnection, setVideoConnection] = useState(null)
  const [videoForm, setVideoForm] = useState({ provider: 'tokenspace', baseUrl: 'https://tokenspace.io/v1', model: 'doubao-seedance-2-0-260128', apiKey: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [videoMessage, setVideoMessage] = useState('')
  const [videoBusy, setVideoBusy] = useState(false)

  const load = async () => {
    const [response, videoResponse] = await Promise.all([fetch('/api/v1/me/provider-connection'), fetch('/api/v1/me/video-provider-connection')])
    const [value, videoValue] = await Promise.all([response.json().catch(() => ({})), videoResponse.json().catch(() => ({}))])
    if (response.ok) {
      setConnection(value.connection)
      if (value.connection) setForm(current => ({ ...current, provider: value.connection.provider, baseUrl: value.connection.baseUrl, reasoningModel: value.connection.reasoningModel || current.reasoningModel, imageModel: value.connection.imageModel || current.imageModel }))
    }
    if (videoResponse.ok) {
      setVideoConnection(videoValue.connection)
      if (videoValue.connection) setVideoForm(current => ({ ...current, provider: videoValue.connection.provider, baseUrl: videoValue.connection.baseUrl, model: videoValue.connection.model }))
    }
  }

  useEffect(() => { load().catch(() => setMessage('无法读取个人模型连接。')) }, [])
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
  const updateVideo = key => event => setVideoForm(current => ({ ...current, [key]: event.target.value }))
  const save = async () => {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/v1/me/provider-connection/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(value.hint || value.error || '保存失败')
      setConnection(value.connection); setForm(current => ({ ...current, apiKey: '' })); setMessage('连接已验证并加密保存。后续任务将使用你的个人模型连接。')
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm('确定删除已保存的个人模型密钥吗？这不会影响其他成员。')) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/v1/me/provider-connection', { method: 'DELETE' })
      if (!response.ok) throw new Error('删除失败')
      setConnection(null); setForm(current => ({ ...current, apiKey: '' })); setMessage('个人模型连接已删除。')
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const saveVideo = async () => {
    setVideoBusy(true); setVideoMessage('')
    try {
      const response = await fetch('/api/v1/me/video-provider-connection/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(videoForm) })
      const value = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(value.hint || value.error || '保存失败')
      setVideoConnection(value.connection); setVideoForm(current => ({ ...current, apiKey: '' })); setVideoMessage('视频模型连接已验证并加密保存。短剧视频任务将使用此连接。')
    } catch (error) { setVideoMessage(error.message) } finally { setVideoBusy(false) }
  }
  const removeVideo = async () => {
    if (!window.confirm('确定删除已保存的视频模型密钥吗？这不会影响图片和文本模型连接。')) return
    setVideoBusy(true); setVideoMessage('')
    try {
      const response = await fetch('/api/v1/me/video-provider-connection', { method: 'DELETE' })
      if (!response.ok) throw new Error('删除失败')
      setVideoConnection(null); setVideoForm(current => ({ ...current, apiKey: '' })); setVideoMessage('视频模型连接已删除。')
    } catch (error) { setVideoMessage(error.message) } finally { setVideoBusy(false) }
  }

  return <section className="page-content api-settings"><span className="kicker">MODEL CONNECTIONS</span><h1>模型 Key 设置</h1><p>这里只管理当前账号的模型服务连接。API Key 只在提交时通过 HTTPS 发送，并由服务端加密保存；界面、日志、链接和资产记录均不会显示完整密钥。</p>
    <section className="key-settings-section"><span className="kicker">TEXT & IMAGE</span><h2>UseGoodAI 推理与生图</h2><form onSubmit={event => { event.preventDefault(); save() }}><fieldset disabled={busy}>
      <label>服务商<input value={form.provider} onChange={update('provider')} maxLength={40} /></label>
      <label>HTTPS 服务地址<input type="url" value={form.baseUrl} onChange={update('baseUrl')} placeholder="https://api.usegoodai.com/v1" required /></label>
      <label>推理模型 ID<input value={form.reasoningModel} onChange={update('reasoningModel')} maxLength={160} placeholder="例如：gpt-5.5" /></label>
      <label>生图模型 ID<input value={form.imageModel} onChange={update('imageModel')} maxLength={160} placeholder="例如：gpt-image-2" /></label>
      <label>API Key<input type="password" value={form.apiKey} onChange={update('apiKey')} autoComplete="new-password" placeholder={connection ? `已保存（末尾 ${connection.apiKeyLast4}）；输入新密钥才会覆盖` : '输入你的个人 API Key'} required={!connection} /></label>
      {connection && <p className="api-cloud-notice">当前连接：{connection.provider} · 推理 {connection.reasoningModel || '未预填'} · 生图 {connection.imageModel || '未预填'} · 末尾 {connection.apiKeyLast4} · {connection.verificationStatus === 'verified' ? '已验证' : '待验证'}</p>}
      <p>验证会向你填写的 HTTPS 公网服务发起一次低成本的模型列表请求。内网、localhost 和非 HTTPS 地址会被拒绝，避免服务端请求伪造风险。</p>
      <div><button className="primary-button" type="submit">{busy ? '正在验证…' : '验证并保存'}</button>{connection && <button className="secondary-button" type="button" onClick={remove}>删除个人连接</button>}</div>
    </fieldset></form><p role="status">{message}</p></section>
    <section className="video-provider-settings key-settings-section"><span className="kicker">SHORT DRAMA VIDEO</span><h2>TokenSpace 视频生成</h2><p>独立保存视频密钥，不会覆盖推理或生图模型。当前默认模型为 Doubao Seedance 2.0，单条视频支持 4–15 秒。</p>
      <form onSubmit={event => { event.preventDefault(); saveVideo() }}><fieldset disabled={videoBusy}>
        <label>服务商<input value={videoForm.provider} onChange={updateVideo('provider')} maxLength={40} /></label>
        <label>HTTPS 服务地址<input type="url" value={videoForm.baseUrl} onChange={updateVideo('baseUrl')} placeholder="https://tokenspace.io/v1" required /></label>
        <label>视频模型 ID<input value={videoForm.model} onChange={updateVideo('model')} maxLength={160} required /></label>
        <label>视频 API Key<input type="password" value={videoForm.apiKey} onChange={updateVideo('apiKey')} autoComplete="new-password" placeholder={videoConnection ? `已保存（末尾 ${videoConnection.apiKeyLast4}）；输入新密钥才会覆盖` : '输入 TokenSpace 视频 API Key'} required={!videoConnection} /></label>
        {videoConnection && <p className="api-cloud-notice">当前视频连接：{videoConnection.provider} · {videoConnection.model} · 末尾 {videoConnection.apiKeyLast4} · {videoConnection.verificationStatus === 'verified' ? '已验证' : '待验证'}</p>}
        <p>验证仅请求模型列表；密钥只在提交时经 HTTPS 发送并由服务端加密保存。生成任务会按模型视频秒数计费。</p>
        <div><button className="primary-button" type="submit">{videoBusy ? '正在验证…' : '验证并保存视频连接'}</button>{videoConnection && <button className="secondary-button" type="button" onClick={removeVideo}>删除视频连接</button>}</div>
      </fieldset></form><p role="status">{videoMessage}</p>
    </section>
  </section>
}
