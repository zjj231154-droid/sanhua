import { useEffect, useState } from 'react'
import { isCloudDeployment } from '../lib/deployment'
export default function ApiSettings() {
  const [config, setConfig] = useState({ enabled: false, model: 'gpt-image-2', hasKey: false })
  const [key, setKey] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [models, setModels] = useState([])
  const [cloudStatus, setCloudStatus] = useState(null)
  const cloudMode = isCloudDeployment()
  async function call(suffix = '', data) {
    const res = await fetch(`/api/retouch/settings${suffix}`, data === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const raw = await res.text()
    let value
    try { value = JSON.parse(raw) } catch { throw new Error(res.ok ? '服务返回了无效响应' : '线上版本暂未部署本地精修服务；UseGoodAI 云端接口需要配置 USEGOODAI_API_KEY') }
    if (!res.ok) throw new Error(value.error || '请求失败')
    return value
  }
  useEffect(() => { if (!cloudMode) call().then(setConfig).catch(error => setMessage(error.message)) }, [cloudMode])
  useEffect(() => { if (cloudMode) fetch('/api/debug/tokenspace').then(async response => { const text = await response.text(); return JSON.parse(text) }).then(setCloudStatus).catch(() => setCloudStatus(null)) }, [cloudMode])
  async function testCloud() {
    setBusy(true); setMessage('')
    try {
      const res = await fetch('/api/tokenspace/test')
      const raw = await res.text()
      let value
      try { value = JSON.parse(raw) } catch { throw new Error('云端服务返回了无效响应，请刷新后重试。') }
      if (!res.ok) throw new Error(`${value.upstream || '服务'} HTTP ${value.status || res.status}: ${value.error || '请求失败'}`)
      const seconds = Number.isFinite(Number(value.elapsedMs)) ? `，耗时 ${(Number(value.elapsedMs) / 1000).toFixed(1)} 秒` : ''
      const reply = value.reply ? ` 返回“${value.reply}”` : ''
      setMessage(`UseGoodAI 已实际调用 ${value.respondedModel || value.requestedModel || '推理模型'} 并收到响应${seconds}。${reply} 未生成图片。`)
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
  return <section className="page-content api-settings"><h1>管理设置</h1><h2>模型服务 API</h2><p>服务：UseGoodAI · https://api.usegoodai.com/v1</p><p>推理、生图与图片编辑均通过 UseGoodAI 服务端中转；图片请求最长等待 30 分钟。</p>
    <form onSubmit={event => { event.preventDefault(); if (!cloudMode) save(false) }}><fieldset disabled={busy}>
      {cloudMode ? <p className="api-cloud-notice">{cloudStatus?.configured ? 'UseGoodAI API 密钥已由服务端环境变量管理' : '未检测到 USEGOODAI_API_KEY'}{cloudStatus && ` · ${cloudStatus.keyLength} 位 · ${cloudStatus.startsWithSk ? 'sk- 格式' : '非 sk- 格式'}`}</p> : <label>API Key<input type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} placeholder="仅本地开发模式使用" /></label>}
      <label>图片编辑模型<input list="image-model-options" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="输入中转站支持的图片编辑模型 ID" /></label>
      <datalist id="image-model-options">{models.map(id => <option key={id} value={id} />)}</datalist>
      <label className="api-toggle"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />启用中转 API（关闭时使用本地 Codex）</label>
      <p>启用后，推理、生成和精修请求会由服务端发送给 UseGoodAI，费用按中转站规则计算。密钥不会返回浏览器；请勿共享 storage/private 目录。</p>
      <p className="api-test-note">测试会由 Railway 发送一条最小推理请求并等待模型响应，不会生成图片。</p>
      <div>{!cloudMode && <button className="primary-button" type="submit">保存设置</button>}<button className="secondary-button" type="button" onClick={testCloud}>{busy ? '正在调用模型…' : '测试模型连接'}</button></div>
    </fieldset></form><p role="status">{message}</p></section>
}
