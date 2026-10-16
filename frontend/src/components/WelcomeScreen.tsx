import { FormEvent, useState } from 'react'
import { ApiError, api, AuthSession } from '../api/client'
import { brand } from '../config/brand'
import { DatePickerField } from './DatePickerField'

const today = new Date().toLocaleDateString('en-CA')

export function WelcomeScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [name, setName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'register') {
        await api.registerStudent({
          username,
          password,
          passwordConfirmation: confirmation,
          name,
          studentNumber,
          phone,
          email,
          enrollmentDate,
        })
        setMode('login')
        setPassword('')
        setConfirmation('')
        setMessage('注册成功，请使用新账号登录。')
      } else {
        await onAuthenticated(await api.login(username, password))
      }
    } catch (reason) {
      setMessage(reason instanceof ApiError ? reason.message : '操作未完成，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <header className="login-topbar">
          <div className="login-brand"><div className="brand-mark" aria-hidden="true">↗</div><div><div className="login-brand-title">{brand.productName}</div><div className="login-brand-sub">{brand.universityName} · 就业择业规划工作台</div></div></div>
          <span className="meta-chip">账号登录</span>
        </header>
        <div className="login-main">
          <div className="login-heading"><h1>{mode === 'login' ? '登录工作台' : '注册学生账号'}</h1><p className="login-lead">登录后系统将按账号角色展示对应工作台。</p></div>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <>
              <label><span><i className="required-mark" aria-hidden="true">*</i>姓名</span><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoComplete="name" /></label>
              <label><span><i className="required-mark" aria-hidden="true">*</i>学号</span><input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} required inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} /></label>
              <label><span><i className="required-mark" aria-hidden="true">*</i>电话号码</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" autoComplete="tel" /></label>
              <label><span><i className="required-mark" aria-hidden="true">*</i>联系邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
              <DatePickerField id="student-enrollment-date" label="入学时间" value={enrollmentDate} onChange={setEnrollmentDate} max={today} required />
            </>}
            <label><span>{mode === 'register' && <i className="required-mark" aria-hidden="true">*</i>}用户名</span><input value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={64} autoComplete="username" /></label>
            <label><span>{mode === 'register' && <i className="required-mark" aria-hidden="true">*</i>}密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {mode === 'register' && <label><span><i className="required-mark" aria-hidden="true">*</i>确认密码</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></label>}
            {message && <p className="auth-message" role="alert">{message}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '处理中…' : mode === 'login' ? '登录' : '注册学生账号'}</button>
          </form>
          <div className="auth-switch">
            {mode === 'login' ? <button type="button" className="btn btn-ghost" onClick={() => { setMode('register'); setMessage('') }}>注册学生账号</button> : <button type="button" className="btn btn-ghost" onClick={() => { setMode('login'); setMessage('') }}>返回登录</button>}
            <span>教师和管理员账号由管理员创建。</span>
          </div>
        </div>
      </div>
      <div className="footer-note">{brand.universityName}就业指导中心 · 账号权限由服务端统一校验</div>
    </div>
  )
}
