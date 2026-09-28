import { useEffect, useState } from 'react'

export default function UserProfile({ session, onSessionChange }) {
  const [profile, setProfile] = useState({ name: session?.user?.name || '', email: session?.user?.email || '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setProfile({ name: session?.user?.name || '', email: session?.user?.email || '' }) }, [session?.user?.name, session?.user?.email])
  const refreshSession = async () => { const response = await fetch('/api/v1/session'); if (response.ok) onSessionChange?.(await response.json()) }
  const saveProfile = async event => {
    event.preventDefault(); setBusy(true); setMessage('')
    try { const response = await fetch('/api/v1/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || '账户资料保存失败'); await refreshSession(); setMessage('账户资料已更新。') } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  const uploadAvatar = async event => {
    const file = event.target.files?.[0]; if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setMessage('头像仅支持 2MB 内的 PNG、JPG 或 WebP 图片。'); event.target.value = ''; return }
    setBusy(true); setMessage('')
    try { const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) }); const response = await fetch('/api/v1/me/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: dataUrl }) }); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.hint || value.error || '头像上传失败'); await refreshSession(); setMessage('头像已更新。') } catch (error) { setMessage(error.message) } finally { setBusy(false); event.target.value = '' }
  }
  const changePassword = async event => {
    event.preventDefault(); if (passwords.newPassword !== passwords.confirmPassword) { setMessage('两次输入的新密码不一致。'); return }
    setBusy(true); setMessage('')
    try { const response = await fetch('/api/v1/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(passwords) }); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error === 'CURRENT_PASSWORD_INCORRECT' ? '当前密码不正确。' : value.error || '密码更新失败'); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); setMessage('密码已更新，请妥善保管。') } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }
  return <section className="page-content user-profile"><span className="kicker">ACCOUNT & SECURITY</span><h1>个人资料</h1><p>此处只管理当前账号的头像、名称、登录邮箱与密码。</p><section className="account-settings"><h2>账户资料</h2><div className="account-avatar"><span>{session?.user?.avatarUrl ? <img src={session.user.avatarUrl} alt="当前头像" /> : (session?.user?.name || '我').slice(0, 1)}</span><label className="secondary-button">更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} hidden /></label></div><form onSubmit={saveProfile}><fieldset disabled={busy}><label>显示名称<input value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} maxLength={80} required /></label><label>登录邮箱<input type="email" value={profile.email} onChange={event => setProfile(current => ({ ...current, email: event.target.value }))} required /></label><button className="primary-button" type="submit">保存账户资料</button></fieldset></form><form onSubmit={changePassword}><fieldset disabled={busy}><h3>修改密码</h3><label>当前密码<input type="password" value={passwords.currentPassword} onChange={event => setPasswords(current => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required /></label><label>新密码<input type="password" value={passwords.newPassword} onChange={event => setPasswords(current => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" minLength={10} required /></label><label>确认新密码<input type="password" value={passwords.confirmPassword} onChange={event => setPasswords(current => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" minLength={10} required /></label><button className="secondary-button" type="submit">更新密码</button></fieldset></form><p role="status">{message}</p></section></section>
}
