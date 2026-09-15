import { useEffect, useState } from 'react'
export default function ApiSettings() {
  const [config, setConfig] = useState({ enabled: false, model: 'gpt-image-2', hasKey: false })
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [models, setModels] = useState([])
  const [cloudStatus, setCloudStatus] = useState(null)
  const cloudMode = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev')
  async function call(suffix = '', data) {
    const res = await fetch(`/api/retouch/settings${suffix}`, data === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const raw = await res.text()
    let value
    try { value = JSON.parse(raw) } catch { throw new Error(res.ok ? '服务返回了无效响应' : '线上版本暂未部署本地精修服务；TokenSpace 云端接口需要在 Cloudflare 中配置 TOKENSPACE_API_KEY') }
    if (!res.ok) throw new Error(value.error || '请求失败')
    return value
  }
  useEffect(() => { if (!cloudMode) call().then(setConfig).catch(error => setMessage(error.message)) }, [cloudMode])
  useEffect(() => { if (cloudMode) fetch('/api/debug/tokenspace').then(response => response.json()).then(setCloudStatus).catch(() => setCloudStatus(null)) }, [cloudMode])
  async function testCloud() {
    setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/tokenspace/test')
      const value = await res.json()
      if (!res.ok) throw new Error(`${value.upstream || '服务'} HTTP ${value.status || res.status}: ${value.error || '请求失败'}`)
      setMessage('云端 TokenSpace 连接成功。')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  async function save(test) {
    setBusy(true); setMessage('')
    try {
      const value = await call('', { ...config, apiKey: key })
      setConfig(value); setKey('')
      if (test) { const result = await call('/test', {}); setModels(result.models); setMessage(result.message) }
      else setMessage('配置已保存，后续新建精修任务使用此设置。')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <section className="page-content api-settings"><h1>管理设置</h1><h2>图片精修 API</h2><p>服务：TokenSpace · https://tokenspace.io</p><p>支持文生图与图片编辑，图片请求最长等待 30 分钟。测试连接通过 Cloudflare 服务端验证鉴权。</p>
    <form onSubmit={event => { event.preventDefault(); if (!cloudMode) save(false) }}><fieldset disabled={busy}>
      {cloudMode ? <p className="api-cloud-notice">{cloudStatus?.configured ? 'TokenSpace API 密钥已由 Cloudflare Secret 管理' : '未检测到 Cloudflare TOKENSPACE_API_KEY'}{cloudStatus && ` · ${cloudStatus.keyLength} 位 · ${cloudStatus.startsWithSk ? 'sk- 格式' : '非 sk- 格式'}`}</p> : <label>API Key<input type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} placeholder="仅本地开发模式使用" /></label>}
      <label>图片编辑模型<input list="image-model-options" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="输入中转站支持的图片编辑模型 ID" /></label>
      <datalist id="image-model-options">{models.map(id => <option key={id} value={id} />)}</datalist>
      <label className="api-toggle"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />启用中转 API（关闭时使用本地 Codex）</label>
      <p>启用后，确认精修计划会将原图和要求发送给 TokenSpace，费用按中转站规则计算。密钥保存在本机服务端配置文件，不返回浏览器；请勿共享 storage/private 目录。</p>
      <div>{!cloudMode && <button className="primary-button" type="submit">保存设置</button>}<button className="secondary-button" type="button" onClick={testCloud}>测试云端连接</button></div>
    </fieldset></form><p role="status">{message}</p></section>
}
