import { useEffect, useState } from 'react'
export default function ApiSettings() {
  const [config, setConfig] = useState({ enabled: false, model: 'gpt-image-2', hasKey: false })
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [models, setModels] = useState([])
  async function call(suffix = '', data) {
    const res = await fetch(`/api/retouch/settings${suffix}`, data === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const raw = await res.text()
    let value
    try { value = JSON.parse(raw) } catch { throw new Error(res.ok ? '服务返回了无效响应' : '线上版本暂未部署本地精修服务；TokenSpace 云端接口需要在 Cloudflare 中配置 TOKENSPACE_API_KEY') }
    if (!res.ok) throw new Error(value.error || '请求失败')
    return value
  }
  useEffect(() => { call().then(setConfig).catch(error => setMessage(error.message)) }, [])
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
  return <section className="page-content api-settings"><h1>管理设置</h1><h2>图片精修 API</h2><p>服务：TokenSpace · https://api.tokenspace.tech</p><p>支持文生图与图片编辑，图片请求最长等待 30 分钟。测试连接仅验证模型列表与鉴权。</p>
    <form onSubmit={event => { event.preventDefault(); save(false) }}><fieldset disabled={busy}>
      <label>API Key<input type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} placeholder={config.hasKey ? '已保存，留空保持原密钥' : '填写新生成的密钥'} /></label>
      <label>图片编辑模型<input list="image-model-options" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="输入中转站支持的图片编辑模型 ID" /></label>
      <datalist id="image-model-options">{models.map(id => <option key={id} value={id} />)}</datalist>
      <label className="api-toggle"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />启用中转 API（关闭时使用本地 Codex）</label>
      <p>启用后，确认精修计划会将原图和要求发送给 TokenSpace，费用按中转站规则计算。密钥保存在本机服务端配置文件，不返回浏览器；请勿共享 storage/private 目录。</p>
      <div><button className="primary-button" type="submit">{busy ? '处理中…' : '保存设置'}</button><button className="secondary-button" type="button" onClick={() => save(true)}>保存并测试连接</button></div>
    </fieldset></form><p role="status">{message}</p></section>
}
