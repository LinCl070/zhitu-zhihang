import { FormEvent, useState } from 'react'
import { ApiError, api } from '../api/client'

export function ChangePasswordDialog({ token, required, onComplete }: { token: string; required: boolean; onComplete: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      await api.changePassword(token, currentPassword, newPassword, confirmation)
      onComplete()
    } catch (reason) {
      setMessage(reason instanceof ApiError ? reason.message : '密码修改失败，请稍后重试。')
    } finally { setBusy(false) }
  }

  return <div className="auth-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="change-password-title"><form className="auth-dialog" onSubmit={submit}>
    <h2 id="change-password-title">{required ? '请先修改初始密码' : '修改密码'}</h2>
    <p>{required ? '初始或重置密码仅可使用一次。修改后需重新登录。' : '修改后，当前账号的所有会话将退出。'}</p>
    <label>当前密码<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
    <label>新密码<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
    <label>确认新密码<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
    {message && <p className="auth-message" role="alert">{message}</p>}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '提交中…' : '确认修改并退出'}</button>
  </form></div>
}
