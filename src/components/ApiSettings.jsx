import { useEffect, useState } from 'react'

export default function ApiSettings({ session }) {
  const [connection, setConnection] = useState(null)
  const [form, setForm] = useState({ provider: 'usegoodai', baseUrl: 'https://api.usegoodai.com/v1', apiKey: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState([])
  const [invite, setInvite] = useState({ email: '', role: 'editor' })
  const [memberMessage, setMemberMessage] = useState('')
  const load = async () => {
    const response = await fetch('/api/v1/me/provider-connection')
    const value = await response.json().catch(() => ({}))
    if (response.ok) { setConnection(value.connection); if (value.connection) setForm(current => ({ ...current, provider: value.connection.provider, baseUrl: value.connection.baseUrl })) }
  }
  useEffect(() => { load().catch(() => setMessage('无法读取个人模型连接。')) }, [])
  const loadMembers = async () => {
    if (!session?.workspace?.id || !session.workspace.permissions?.includes('manage')) return
    const response = await fetch(`/api/v1/workspaces/${session.workspace.id}/members`)
    const value = await response.json().catch(() => ({})); if (response.ok) setMembers(value.members || [])
  }
  useEffect(() => { loadMembers().catch(() => setMemberMessage('无法读取协作者。')) }, [session?.workspace?.id])
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }))
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
    try { const response = await fetch('/api/v1/me/provider-connection', { method: 'DELETE' }); if (!response.ok) throw new Error('删除失败'); setConnection(null); setForm(current => ({ ...current, apiKey: '' })); setMessage('个人模型连接已删除。') } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const sendInvite = async event => {
    event.preventDefault(); setMemberMessage('')
    try {
      const response = await fetch(`/api/v1/workspaces/${session.workspace.id}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invite) })
      const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || '邀请创建失败')
      setInvite(current => ({ ...current, email: '' })); setMemberMessage(`已创建给 ${value.invite.email} 的 ${value.invite.role} 邀请。请通过受控邀请渠道发送接受链接。`)
    } catch (error) { setMemberMessage(error.message) }
  }
  const updateMember = async (member, patch) => {
    const response = await fetch(`/api/v1/workspaces/${session.workspace.id}/members/${member.userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    const value = await response.json().catch(() => ({})); if (!response.ok) { setMemberMessage(value.error || '成员更新失败'); return }; await loadMembers()
  }
  return <section className="page-content api-settings"><span className="kicker">SECURITY & CONNECTIONS</span><h1>管理设置</h1><h2>个人模型服务连接</h2><p>每位用户只能管理自己的 API Key。密钥只在提交时通过 HTTPS 发送，由服务端加密保存；界面、日志、链接和资产记录不会显示完整密钥。</p>
    <form onSubmit={event => { event.preventDefault(); save() }}><fieldset disabled={busy}>
      <label>服务商<input value={form.provider} onChange={update('provider')} maxLength={40} /></label>
      <label>HTTPS 服务地址<input type="url" value={form.baseUrl} onChange={update('baseUrl')} placeholder="https://api.usegoodai.com/v1" required /></label>
      <label>API Key<input type="password" value={form.apiKey} onChange={update('apiKey')} autoComplete="new-password" placeholder={connection ? `已保存（末尾 ${connection.apiKeyLast4}）；输入新密钥才会覆盖` : '输入你的个人 API Key'} required={!connection} /></label>
      {connection && <p className="api-cloud-notice">当前连接：{connection.provider} · {connection.baseUrl} · 末尾 {connection.apiKeyLast4} · {connection.verificationStatus === 'verified' ? '已验证' : '待验证'}</p>}
      <p>验证会向你填写的 HTTPS 公网服务发起一次低成本的模型列表请求。内网、localhost 和非 HTTPS 地址会被拒绝，避免服务端请求伪造风险。</p>
      <div><button className="primary-button" type="submit">{busy ? '正在验证…' : '验证并保存'}</button>{connection && <button className="secondary-button" type="button" onClick={remove}>删除个人连接</button>}</div>
    </fieldset></form><p role="status">{message}</p>
    {session?.workspace && <section className="workspace-members"><span className="kicker">WORKSPACE ACCESS</span><h2>工作空间成员</h2><p>当前工作空间：{session.workspace.name} · 你的角色：{session.workspace.role}</p>
      {session.workspace.permissions?.includes('manage') ? <><form className="workspace-invite" onSubmit={sendInvite}><input type="email" value={invite.email} onChange={event => setInvite(current => ({ ...current, email: event.target.value }))} placeholder="协作者邮箱" required /><select value={invite.role} onChange={event => setInvite(current => ({ ...current, role: event.target.value }))}><option value="admin">管理员</option><option value="editor">编辑者</option><option value="viewer">查看者</option></select><button className="secondary-button" type="submit">创建邀请</button></form><div className="member-list">{members.map(member => <div className="member-row" key={member.userId}><span><strong>{member.user?.name || member.userId}</strong><small>{member.user?.email || '未提供邮箱'} · {member.status}</small></span>{member.role === 'owner' ? <em>所有者</em> : <><select value={member.role} aria-label={`变更 ${member.user?.name || member.userId} 的角色`} onChange={event => updateMember(member, { role: event.target.value })}><option value="admin">管理员</option><option value="editor">编辑者</option><option value="viewer">查看者</option></select><button className="text-button" type="button" onClick={() => updateMember(member, { status: 'revoked' })}>移除</button></>}</div>)}</div></> : <p>你可以查看当前权限；只有所有者和管理员可以邀请成员或调整访问权。</p>}
      <p role="status">{memberMessage}</p>
    </section>}</section>
}
