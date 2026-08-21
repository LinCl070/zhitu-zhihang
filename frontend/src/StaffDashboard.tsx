import { FormEvent, useEffect, useState } from 'react'
import {
  BadgeCheck,
  BookOpenCheck,
  ClipboardList,
  LockKeyhole,
  Send,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'

import { AdminOverview, api, CounselorStudent } from './api/client'
import { brand } from './config/brand'

type StaffRole = 'counselor' | 'admin'

export function StaffDashboard({
  token,
  name,
  role,
  onSwitch,
}: {
  token: string
  name: string
  role: StaffRole
  onSwitch: () => void
}) {
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <main className="app-shell dashboard-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark"><ShieldCheck size={21} /></span>
          <div><strong>{brand.productName}</strong><span>{brand.universityName}</span></div>
        </div>
        <div className="session-summary">
          <span className="mode-label">{role === 'admin' ? '管理员演示' : '教师演示'}</span>
          <strong>{name}</strong>
          <button className="role-switch" type="button" onClick={onSwitch}>切换角色</button>
        </div>
      </header>
      <section className="dashboard-intro">
        <div><p>{role === 'admin' ? '治理工作台' : '教师协助工作台'}</p><h1>{role === 'admin' ? '可信资料与审计追溯' : '在授权范围内提供协助'}</h1></div>
        <div className="readiness"><span><LockKeyhole size={16} />最小权限</span><span><BadgeCheck size={16} />脱敏审计</span></div>
      </section>
      {notice && <div className="notice"><BadgeCheck size={17} /><span>{notice}</span></div>}
      {role === 'counselor' ? <CounselorDesk token={token} onNotice={setNotice} /> : <AdminDesk token={token} onNotice={setNotice} />}
    </main>
  )
}

function CounselorDesk({ token, onNotice }: { token: string; onNotice: (value: string | null) => void }) {
  const [students, setStudents] = useState<CounselorStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [advice, setAdvice] = useState('建议优先复核岗位有效期，再根据能力缺口安排可验证的练习。')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const selected = students.find((student) => student.student_id === selectedId) ?? students[0]

  useEffect(() => {
    async function loadStudents() {
      setLoading(true)
      try {
        const result = await api.getCounselorStudents(token)
        setStudents(result)
        setSelectedId((current) => current || result[0]?.student_id || '')
      } catch (error) {
        onNotice(readError(error))
      } finally {
        setLoading(false)
      }
    }
    void loadStudents()
  }, [token, refresh, onNotice])

  async function submitAdvice(event: FormEvent) {
    event.preventDefault()
    if (!selected?.plans[0]) return
    try {
      await api.createAdvice(token, {
        student_id: selected.student_id,
        action_plan_id: selected.plans[0].id,
        content: advice,
      })
      onNotice('指导意见已保存并记录审计。')
      setRefresh((value) => value + 1)
    } catch (error) {
      onNotice(readError(error))
    }
  }

  return <section className="staff-grid"><aside className="staff-list panel"><div className="panel-heading"><div><p>授权学生</p><h2>协助对象</h2></div></div>{loading ? <span className="muted">加载中...</span> : students.length === 0 ? <div className="empty-state compact"><UsersRound size={26} /><strong>暂无授权学生</strong><span>请由管理员先配置教师授权范围。</span></div> : students.map((student) => <button className={student.student_id === selected?.student_id ? 'student-row selected' : 'student-row'} type="button" key={student.student_id} onClick={() => setSelectedId(student.student_id)}><strong>{student.display_name}</strong><span>{student.major} · {student.target_roles.join('、')}</span></button>)}</aside><section className="staff-content panel">{selected ? <><div className="panel-heading"><div><p>职业摘要</p><h2>{selected.display_name}</h2><span>{selected.major} · {selected.target_roles.join('、')} · {selected.target_cities.join('、')}</span></div><span className="status-dot complete">{selected.job_stage === 'preparing' ? '准备求职' : selected.job_stage}</span></div><div className="summary-counters"><div><ClipboardList size={18} /><span>行动计划</span><strong>{selected.plans.length}</strong></div><div><Send size={18} /><span>已提交意见</span><strong>{selected.advice.length}</strong></div></div><form className="advice-form counselor-form" onSubmit={submitAdvice}><label><span>指导意见</span><textarea rows={4} value={advice} maxLength={500} onChange={(event) => setAdvice(event.target.value)} required /></label><button className="primary-button" disabled={!selected.plans[0]}><Send size={18} />提交指导意见</button></form>{selected.advice.length > 0 && <div className="advice-history"><h3>已提交意见</h3>{selected.advice.map((item) => <article key={item.id}><p>{item.content}</p><span>{new Date(item.created_at).toLocaleString('zh-CN')}</span></article>)}</div>}</> : <div className="empty-state"><UsersRound size={28} /><strong>等待管理员授权</strong><span>教师只会看到已明确授权的学生摘要。</span></div>}</section></section>
}

function AdminDesk({ token, onNotice }: { token: string; onNotice: (value: string | null) => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [studentId, setStudentId] = useState('')
  const [counselorId, setCounselorId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    async function loadOverview() {
      setLoading(true)
      try {
        const result = await api.getAdminOverview(token)
        setOverview(result)
        setStudentId((value) => value || result.students[0]?.id || '')
        setCounselorId((value) => value || result.counselors[0]?.id || '')
      } catch (error) {
        onNotice(readError(error))
      } finally {
        setLoading(false)
      }
    }
    void loadOverview()
  }, [token, refresh, onNotice])

  async function grantAccess() {
    if (!studentId || !counselorId) return
    try {
      await api.grantCounselorAccess(token, counselorId, studentId)
      onNotice('教师访问范围已更新，并写入脱敏审计。')
      setRefresh((value) => value + 1)
    } catch (error) {
      onNotice(readError(error))
    }
  }

  if (loading || !overview) return <section className="panel staff-loading">正在加载治理总览...</section>

  return <section className="admin-stack"><section className="admin-top-grid"><article className="panel grant-panel"><div className="panel-heading"><div><p>权限配置</p><h2>教师授权范围</h2><span>只建立固定演示身份之间的访问许可。</span></div></div><label>教师<select value={counselorId} onChange={(event) => setCounselorId(event.target.value)}>{overview.counselors.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><label>学生<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{overview.students.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><button className="primary-button" type="button" onClick={grantAccess}><UsersRound size={18} />授予访问范围</button></article><article className="panel stats-panel"><p>治理概览</p><div><span><BookOpenCheck size={18} />资料台账</span><strong>{overview.sources.length}</strong></div><div><span><ClipboardList size={18} />模拟岗位</span><strong>{overview.jobs.length}</strong></div><div><span><ShieldCheck size={18} />审计事件</span><strong>{overview.audits.length}</strong></div></article></section><article className="panel table-panel"><div className="panel-heading"><div><p>岗位资料</p><h2>模拟岗位审核状态</h2></div><span className="status-dot complete">仅演示数据</span></div><Table headers={['岗位', '城市', '有效期', '状态', '来源']} rows={overview.jobs.map((job) => [job.title, job.city, job.valid_until, job.status, job.source_title])} /></article><article className="panel table-panel"><div className="panel-heading"><div><p>知识资料</p><h2>资料台账</h2></div></div><Table headers={['资料', '状态', '发布日期', '适用范围']} rows={overview.sources.map((source) => [source.title, source.status, source.published_on, source.applicable_scope])} /></article><article className="panel table-panel"><div className="panel-heading"><div><p>操作追溯</p><h2>脱敏审计</h2><span>不显示完整画像、意见正文或平台密钥</span></div></div><Table headers={['角色', '操作', '资源类型', '时间']} rows={overview.audits.slice(0, 10).map((audit) => [audit.actor_role ?? 'system', audit.action, audit.resource_type, new Date(audit.created_at).toLocaleString('zh-CN')])} /></article></section>
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function readError(error: unknown) { return error instanceof Error ? error.message : '请求暂时无法完成，请稍后重试。' }
