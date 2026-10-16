import { useCallback, useEffect, useState } from 'react'
import {
  api,
  ApiError,
  CounselorStudent,
  CounselorStudentResponse,
  AdminOverviewResponse,
} from './api/client'
import { useToast } from './components/Toast'
import { DatePickerField } from './components/DatePickerField'
import { brand } from './config/brand'
import { RiskPanel } from './components/governance/RiskPanel'
import { InsightsPanel } from './components/governance/InsightsPanel'
import { SimulationPanel } from './components/governance/SimulationPanel'

export type TeacherNav = 'students' | 'summary' | 'advice' | 'risks'
export type AdminNav = 'access' | 'jobs' | 'knowledge' | 'audit' | 'insights' | 'simulation'

export function StaffDashboard({
  token,
  name,
  role,
  onSwitch,
}: {
  token: string
  name: string
  role: 'teacher' | 'admin'
  onSwitch: () => void
}) {
  if (role === 'teacher') {
    return <TeacherWorkbench token={token} name={name} onSwitch={onSwitch} />
  }
  return <AdminWorkbench token={token} name={name} onSwitch={onSwitch} />
}

function TeacherWorkbench({ token, name, onSwitch }: { token: string; name: string; onSwitch: () => void }) {
  const { showToast } = useToast()
  const [nav, setNav] = useState<TeacherNav>('students')
  const [students, setStudents] = useState<CounselorStudent[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [adviceText, setAdviceText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.readCounselorStudents(token)
      const mapped = response.map(mapCounselorStudent)
      setStudents(mapped)
      setSelectedId((current) => current || mapped[0]?.id || '')
    } catch (error) {
      showToast('读取授权学生失败', getErrorMessage(error), 'warning')
    } finally {
      setLoading(false)
    }
  }, [showToast, token])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const selectedStudent = students.find((s) => s.id === selectedId) || students[0]

  const handleSubmitAdvice = async () => {
    if (!selectedStudent || !adviceText.trim()) {
      showToast('请填写意见', '指导意见不能为空。', 'warning')
      return
    }

    if (!selectedStudent.planId) {
      showToast('暂不能提交', '该学生还没有行动计划，无法关联指导意见。', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await api.createTeacherAdvice(token, selectedStudent.id, selectedStudent.planId, adviceText.trim())
      setAdviceText('')
      await loadStudents()
      showToast('意见已提交', '已保存到服务端并写入脱敏审计。', 'success')
    } catch (error) {
      showToast('意见提交失败', getErrorMessage(error), 'warning')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="shell" data-role-view="teacher">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5" />
              <path d="M4 17c4-3 8-3 12 0V7c-4-3-8-3-12 0" />
              <path d="M16 19l4-2V5l-4 2" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-name">{brand.productName}</div>
            <div className="brand-sub">{brand.universityName} · 教师工作台</div>
          </div>
        </div>
        <div className="top-meta">
          <span className="meta-chip hide-sm">演示数据</span>
          <span className="meta-chip">
            <b>{name}</b> · 就业指导
          </span>
          <div className="top-actions">
            <button type="button" className="btn btn-ghost" onClick={onSwitch}>
              退出并切换角色
            </button>
          </div>
        </div>
      </header>

      <div className="body-row">
        <aside className="sidebar">
          <div className="nav-section-label">工作台导航</div>
          <nav className="nav-list">
            <button
              type="button"
              className="nav-item"
              data-nav="students"
              aria-current={nav === 'students' ? 'page' : undefined}
              onClick={() => setNav('students')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">授权学生</div>
                <div className="nav-hint">仅授权范围</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="summary"
              aria-current={nav === 'summary' ? 'page' : undefined}
              onClick={() => setNav('summary')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">当前学生摘要</div>
                <div className="nav-hint">列表-详情</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="advice"
              aria-current={nav === 'advice' ? 'page' : undefined}
              onClick={() => setNav('advice')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.8A8 8 0 1 1 21 12z" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">指导意见</div>
                <div className="nav-hint">提交与历史</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="risks"
              aria-current={nav === 'risks' ? 'page' : undefined}
              onClick={() => setNav('risks')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
                  <path d="M12 8v4" />
                  <path d="M12 15h.01" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">风险预警</div>
                <div className="nav-hint">可解释分级</div>
              </span>
            </button>
          </nav>
          <div className="sidebar-note">
            <strong>教师可见范围</strong>仅授权学生；不含技能/项目原文。意见提交写入审计。
          </div>
        </aside>

        <main className="main">
          {nav === 'students' && (
            <section data-panel="students">
              <div className="page-head">
                <div>
                  <h1>授权学生</h1>
                  <p className="desc">仅展示授权范围内学生摘要。不含技能/项目原文。</p>
                </div>
              </div>
              <div className="list-detail">
                <div className="ld-list">
                  <div className="col-label">授权学生 · {students.length} 名</div>
                  <div id="teacher-student-list">
                    {loading ? (
                      <div className="empty">正在读取授权学生…</div>
                    ) : students.length === 0 ? (
                      <div className="empty">
                        <strong>暂无授权学生</strong>
                        <div>请联系管理员配置教师-学生授权关系。</div>
                      </div>
                    ) : students.map((s) => {
                      const isActive = s.id === selectedStudent?.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`student-row ${isActive ? 'is-active' : ''}`}
                          data-student-id={s.id}
                          aria-current={isActive ? 'true' : undefined}
                          onClick={() => {
                            setSelectedId(s.id)
                            setNav('summary')
                          }}
                        >
                          <strong>{s.name}</strong>
                          <span>{s.major} · {s.stage}</span>
                          <span>目标 {s.targetRole} · {s.targetCity}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="panel">
                  <h3 className="panel-title">本学期授权范围</h3>
                  <dl className="kv">
                    <dt>授权班级</dt>
                    <dd>软件工程 2023 级 1-2 班</dd>
                    <dt>授权学生</dt>
                    <dd>{students.length} 名（服务端数据）</dd>
                    <dt>可见字段</dt>
                    <dd>姓名、学号、联系方式、入学年份及职业摘要</dd>
                    <dt>不可见</dt>
                    <dd>技能标签、项目原文</dd>
                  </dl>
                  <div className="alert alert-info" style={{ marginTop: '14px' }}>
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8h.01M11 12h1v4h1" />
                    </svg>
                    <div className="alert-body">
                      选择左侧学生后，「当前学生摘要」与「指导意见」会同步切换到该学生。
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {nav === 'summary' && (
            <section data-panel="summary">
              <div className="page-head">
                <div>
                  <h1>当前学生摘要</h1>
                  <p className="desc">授权可见账号档案与职业摘要，技能标签和项目原文除外。</p>
                </div>
              </div>
              <div className="panel" id="teacher-summary-panel">
                {!selectedStudent ? (
                  <div className="empty">
                    <strong>暂无可查看学生</strong>
                    <div>请先由管理员配置授权关系。</div>
                  </div>
                ) : <>
                <h3 className="panel-title">{selectedStudent.name} · 摘要</h3>
                <dl className="kv">
                  <dt>学号</dt>
                  <dd>{selectedStudent.studentNumber || '未登记'}</dd>
                  <dt>电话号码</dt>
                  <dd>{selectedStudent.phone || '未登记'}</dd>
                  <dt>联系邮箱</dt>
                  <dd>{selectedStudent.email || '未登记'}</dd>
                  <dt>入学时间</dt>
                  <dd>{selectedStudent.enrollmentDate || selectedStudent.enrollmentYear || '未登记'}</dd>
                  <dt>专业</dt>
                  <dd>{selectedStudent.major}</dd>
                  <dt>目标岗位</dt>
                  <dd>{selectedStudent.targetRole}</dd>
                  <dt>目标城市</dt>
                  <dd>{selectedStudent.targetCity}</dd>
                  <dt>阶段</dt>
                  <dd>{selectedStudent.stage}</dd>
                  <dt>行动计划</dt>
                  <dd>{selectedStudent.planCount} 项</dd>
                  <dt>指导意见</dt>
                  <dd>{selectedStudent.adviceCount} 条</dd>
                </dl>
                <div className="alert alert-info" style={{ marginTop: '14px' }}>
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8h.01M11 12h1v4h1" />
                  </svg>
                  <div className="alert-body">技能标签与项目原文不在教师可见范围。</div>
                </div>
                </>}
              </div>
            </section>
          )}

          {nav === 'advice' && (
            <section data-panel="advice">
              <div className="page-head">
                <div>
                  <h1>指导意见</h1>
                  <p className="desc">提交后写入审计，学生端仅见意见正文与时间。</p>
                </div>
              </div>
              {!selectedStudent ? <div className="panel"><div className="empty"><strong>暂无可指导学生</strong><div>请先由管理员配置授权关系。</div></div></div> : <div className="grid-2">
                <div className="panel">
                  <h3 className="panel-title">撰写意见 · <span id="advice-student-name">{selectedStudent.name}</span></h3>
                  <div className="field">
                    <label htmlFor="advice-text">意见内容</label>
                    <textarea
                      id="advice-text"
                      value={adviceText}
                      onChange={(e) => setAdviceText(e.target.value)}
                      placeholder="请基于摘要给出可执行建议…"
                    />
                  </div>
                  <div className="textarea-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="btn-submit-advice"
                      onClick={handleSubmitAdvice}
                      disabled={submitting}
                    >
                      {submitting ? '正在提交…' : '提交指导意见'}
                    </button>
                  </div>
                </div>
                <div className="panel">
                  <h3 className="panel-title">历史意见</h3>
                  <div id="advice-history">
                    {selectedStudent.history.length === 0 ? (
                      <div className="empty">
                        <strong>暂无历史意见</strong>
                        <div>提交后将显示在此。</div>
                      </div>
                    ) : (
                      selectedStudent.history.map((h) => (
                        <div key={h.id} className="history-item">
                          <div className="when">{h.at}</div>
                          <p>{h.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>}
            </section>
          )}

          {nav === 'risks' && <RiskPanel token={token} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动导航">
        <button
          type="button"
          aria-current={nav === 'students' ? 'page' : undefined}
          onClick={() => setNav('students')}
        >
          <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          <span>学生</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'summary' ? 'page' : undefined}
          onClick={() => setNav('summary')}
        >
          <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /></svg>
          <span>摘要</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'advice' ? 'page' : undefined}
          onClick={() => setNav('advice')}
        >
          <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.8A8 8 0 1 1 21 12z" /></svg>
          <span>意见</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'risks' ? 'page' : undefined}
          onClick={() => setNav('risks')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /><path d="M12 8v4" /></svg>
          <span>预警</span>
        </button>
      </nav>
    </div>
  )
}

function AdminWorkbench({ token, name, onSwitch }: { token: string; name: string; onSwitch: () => void }) {
  const { showToast } = useToast()
  const [nav, setNav] = useState<AdminNav>('access')
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCounselorId, setSelectedCounselorId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [teacherUsername, setTeacherUsername] = useState('')
  const [teacherDisplayName, setTeacherDisplayName] = useState('')
  const [teacherPhone, setTeacherPhone] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')
  const [teacherEmploymentDate, setTeacherEmploymentDate] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.readAdminOverview(token)
      setOverview(response)
      setSelectedCounselorId((current) => current || response.counselors[0]?.id || '')
      setSelectedStudentId((current) => current || response.students[0]?.id || '')
    } catch (error) {
      showToast('读取管理台账失败', getErrorMessage(error), 'warning')
    } finally {
      setLoading(false)
    }
  }, [showToast, token])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  const statusTagClass = (status: string) => {
    if (status === '已发布' || status === 'published' || status === '可用' || status === 'approved' || status === '成功' || status === '已记录' || status === '已脱敏') return 'tag-success'
    if (status === '待审核' || status === 'draft' || status === 'pending_review' || status === 'pending_source' || status === '维护中' || status === '待处理') return 'tag-warning'
    if (status === '已过期' || status === 'expired') return 'tag-danger'
    return 'tag-neutral'
  }

  const statusLabel = (status: string) => ({
    published: '已发布',
    draft: '待审核',
    expired: '已过期',
    approved: '可用',
    pending_review: '待审核',
    pending_source: '待补充来源',
  }[status] || status)

  const roleLabel = (role: string | null) => ({
    student: '学生',
    counselor: '教师',
    admin: '管理员',
  }[role || ''] || '系统')

  const handleSaveGrant = async () => {
    if (!selectedCounselorId || !selectedStudentId) {
      showToast('请选择授权对象', '教师和学生均不能为空。', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await api.grantCounselorAccess(token, selectedCounselorId, selectedStudentId)
      await loadOverview()
      showToast('授权已保存', '教师-学生关系已持久化，并写入脱敏审计。', 'success')
    } catch (error) {
      showToast('授权保存失败', getErrorMessage(error), 'warning')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateTeacher = async () => {
    if (!teacherUsername.trim() || !teacherDisplayName.trim() || !teacherPhone.trim() || !teacherEmail.trim() || !teacherEmploymentDate || !teacherPassword) {
      showToast('请完善教师信息', '用户名、教师身份、联系电话、联系邮箱、入职时间和密码均不能为空。', 'warning')
      return
    }
    setSubmitting(true)
    try {
      const account = await api.createTeacher(token, {
        username: teacherUsername,
        displayName: teacherDisplayName,
        phone: teacherPhone,
        email: teacherEmail,
        employmentDate: teacherEmploymentDate,
        password: teacherPassword,
      })
      setTemporaryPassword('')
      setTeacherUsername('')
      setTeacherDisplayName('')
      setTeacherPhone('')
      setTeacherEmail('')
      setTeacherEmploymentDate('')
      setTeacherPassword('')
      await loadOverview()
      showToast('教师账号已创建', `教师 ${account.display_name} 可使用管理员设置的初始密码登录。`, 'success')
    } catch (error) {
      showToast('创建教师账号失败', getErrorMessage(error), 'warning')
    } finally { setSubmitting(false) }
  }

  const handleResetPassword = async (userId: string) => {
    setSubmitting(true)
    try {
      const account = await api.resetAccountPassword(token, userId)
      setTemporaryPassword(`${account.display_name} 的临时密码：${account.temporary_password}`)
      showToast('密码已重置', '请安全地交付一次性临时密码。', 'success')
    } catch (error) {
      showToast('密码重置失败', getErrorMessage(error), 'warning')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="shell" data-role-view="admin">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19V5" />
              <path d="M4 17c4-3 8-3 12 0V7c-4-3-8-3-12 0" />
              <path d="M16 19l4-2V5l-4 2" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-name">{brand.productName}</div>
            <div className="brand-sub">{brand.universityName} · 管理工作台</div>
          </div>
        </div>
        <div className="top-meta">
          <span className="meta-chip hide-sm">演示数据</span>
          <span className="meta-chip">
            <b>{name}</b> · 就业管理员
          </span>
          <div className="top-actions">
            <button type="button" className="btn btn-ghost" onClick={onSwitch}>
              退出并切换角色
            </button>
          </div>
        </div>
      </header>

      <div className="body-row">
        <aside className="sidebar">
          <div className="nav-section-label">工作台导航</div>
          <nav className="nav-list">
            <button
              type="button"
              className="nav-item"
              data-nav="access"
              aria-current={nav === 'access' ? 'page' : undefined}
              onClick={() => setNav('access')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">权限配置</div>
                <div className="nav-hint">教师-学生</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="jobs"
              aria-current={nav === 'jobs' ? 'page' : undefined}
              onClick={() => setNav('jobs')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">岗位资料</div>
                <div className="nav-hint">模拟台账</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="knowledge"
              aria-current={nav === 'knowledge' ? 'page' : undefined}
              onClick={() => setNav('knowledge')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">知识资料</div>
                <div className="nav-hint">资料台账</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="audit"
              aria-current={nav === 'audit' ? 'page' : undefined}
              onClick={() => setNav('audit')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">脱敏审计</div>
                <div className="nav-hint">事件扫描</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="insights"
              aria-current={nav === 'insights' ? 'page' : undefined}
              onClick={() => setNav('insights')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M3 3v18h18" />
                  <path d="M7 15l4-4 3 3 5-6" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">群体画像</div>
                <div className="nav-hint">聚合统计</div>
              </span>
            </button>
            <button
              type="button"
              className="nav-item"
              data-nav="simulation"
              aria-current={nav === 'simulation' ? 'page' : undefined}
              onClick={() => setNav('simulation')}
            >
              <span>
                <svg viewBox="0 0 24 24">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
              </span>
              <span className="nav-copy">
                <div className="nav-title">策略仿真</div>
                <div className="nav-hint">ABM 推演</div>
              </span>
            </button>
          </nav>
          <div className="sidebar-note">
            <strong>管理边界</strong>不展示完整画像、意见正文、平台密钥或数据库连接信息。
          </div>
        </aside>

        <main className="main">
          {nav === 'access' && (
            <section data-panel="access">
              <div className="page-head">
                <div>
                  <h1>权限配置</h1>
                  <p className="desc">配置教师可访问的学生范围。不展示密钥或连接串。</p>
                </div>
              </div>
              <div className="admin-overview">
                <div className="stat-card"><div className="k">授权关系</div><div className="v">{overview?.accesses.length ?? 0}</div><div className="s">教师-学生</div></div>
                <div className="stat-card"><div className="k">教师账号</div><div className="v">{overview?.counselors.length ?? 0}</div><div className="s">可配置授权</div></div>
                <div className="stat-card"><div className="k">学生账号</div><div className="v">{overview?.students.length ?? 0}</div><div className="s">可授权对象</div></div>
                <div className="stat-card"><div className="k">审计事件</div><div className="v">{overview?.audits.length ?? 0}</div><div className="s">最近 50 条</div></div>
              </div>
              <div className="grant-box">
                <div className="panel">
                  <h3 className="panel-title">选择教师</h3>
                  <div className="field">
                    <label htmlFor="admin-teacher">教师</label>
                    <select id="admin-teacher" value={selectedCounselorId} onChange={(e) => setSelectedCounselorId(e.target.value)} disabled={loading}>
                      <option value="">请选择教师</option>
                      {(overview?.counselors || []).map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ marginTop: '10px' }}>
                    <label htmlFor="admin-student">学生</label>
                    <select id="admin-student" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={loading}>
                      <option value="">请选择学生</option>
                      {(overview?.students || []).map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                    </select>
                  </div>
                  <div className="textarea-actions">
                    <button type="button" className="btn btn-primary" id="btn-save-grant" onClick={handleSaveGrant} disabled={submitting || loading}>
                      {submitting ? '正在保存…' : '保存授权'}
                    </button>
                  </div>
                </div>
                <div className="panel">
                  <h3 className="panel-title">当前生效</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>教师</th><th>范围</th><th>状态</th></tr>
                      </thead>
                      <tbody>
                        {loading ? <tr><td colSpan={3}>正在读取服务端授权状态…</td></tr> : (overview?.accesses || []).map((access) => (
                          <tr key={`${access.counselor_id}-${access.student_id}`}>
                            <td>{overview?.counselors.find((user) => user.id === access.counselor_id)?.display_name || '未知教师'}</td>
                            <td>{overview?.students.find((user) => user.id === access.student_id)?.display_name || '未知学生'}</td>
                            <td><span className="tag tag-success">有效</span></td>
                          </tr>
                        ))}
                        {!loading && overview?.accesses.length === 0 && <tr><td colSpan={3}>当前暂无授权关系。</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="panel">
                  <h3 className="panel-title">教师账号</h3>
                  <div className="teacher-create-form">
                    <div className="field"><label htmlFor="teacher-username"><span><i className="required-mark" aria-hidden="true">*</i>用户名</span></label><input id="teacher-username" value={teacherUsername} onChange={(event) => setTeacherUsername(event.target.value)} required minLength={3} maxLength={64} autoComplete="username" /></div>
                    <div className="field"><label htmlFor="teacher-name"><span><i className="required-mark" aria-hidden="true">*</i>教师身份</span></label><input id="teacher-name" value={teacherDisplayName} onChange={(event) => setTeacherDisplayName(event.target.value)} required maxLength={100} autoComplete="name" /></div>
                    <div className="field"><label htmlFor="teacher-phone"><span><i className="required-mark" aria-hidden="true">*</i>联系电话</span></label><input id="teacher-phone" type="tel" value={teacherPhone} onChange={(event) => setTeacherPhone(event.target.value)} required inputMode="tel" autoComplete="tel" /></div>
                    <div className="field"><label htmlFor="teacher-email"><span><i className="required-mark" aria-hidden="true">*</i>联系邮箱</span></label><input id="teacher-email" type="email" value={teacherEmail} onChange={(event) => setTeacherEmail(event.target.value)} required autoComplete="email" /></div>
                    <DatePickerField id="teacher-employment-date" label="入职时间" value={teacherEmploymentDate} onChange={setTeacherEmploymentDate} max={new Date().toLocaleDateString('en-CA')} required disabled={submitting} />
                    <div className="field"><label htmlFor="teacher-password"><span><i className="required-mark" aria-hidden="true">*</i>密码</span></label><input id="teacher-password" type="password" value={teacherPassword} onChange={(event) => setTeacherPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></div>
                  </div>
                  <div className="textarea-actions"><button type="button" className="btn btn-primary" onClick={handleCreateTeacher} disabled={submitting || loading}>创建教师账号</button></div>
                  {temporaryPassword && <p className="auth-message">{temporaryPassword}</p>}
                  <div className="table-wrap" style={{ marginTop: '14px' }}><table><thead><tr><th>教师</th><th>电话</th><th>邮箱</th><th>入职时间</th><th>操作</th></tr></thead><tbody>{(overview?.counselors || []).map((user) => <tr key={user.id}><td>{user.display_name}</td><td>{user.phone || '未登记'}</td><td>{user.email || '未登记'}</td><td>{user.employment_date || '未登记'}</td><td><button type="button" className="btn btn-ghost" onClick={() => handleResetPassword(user.id)} disabled={submitting}>重置密码</button></td></tr>)}</tbody></table></div>
                </div>
                <div className="panel">
                  <h3 className="panel-title">学生账号档案</h3>
                  <div className="table-wrap" style={{ marginTop: '14px' }}>
                    <table>
                      <thead><tr><th>姓名</th><th>学号</th><th>电话</th><th>邮箱</th><th>入学时间</th></tr></thead>
                      <tbody>
                        {(overview?.students || []).map((student) => <tr key={student.id}>
                          <td>{student.display_name}</td>
                          <td>{student.student_number || '未登记'}</td>
                          <td>{student.phone || '未登记'}</td>
                          <td>{student.email || '未登记'}</td>
                          <td>{student.enrollment_date || student.enrollment_year || '未登记'}</td>
                        </tr>)}
                        {!loading && overview?.students.length === 0 && <tr><td colSpan={5}>当前暂无学生账号。</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {nav === 'jobs' && (
            <section data-panel="jobs">
              <div className="page-head">
                <div>
                  <h1>岗位资料</h1>
                  <p className="desc">模拟/公开岗位台账，支持状态扫描。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table id="admin-jobs-table">
                  <thead>
                    <tr><th>岗位</th><th>单位</th><th>可见性</th><th>状态</th><th>到期</th></tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={5}>正在读取服务端岗位台账…</td></tr> : (overview?.jobs || []).map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td>{r.source_title}</td>
                        <td>{r.demo_only ? '模拟' : '公开'}</td>
                        <td><span className={`tag ${statusTagClass(r.status)}`}>{statusLabel(r.status)}</span></td>
                        <td>{r.valid_until}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {nav === 'knowledge' && (
            <section data-panel="knowledge">
              <div className="page-head">
                <div>
                  <h1>知识资料</h1>
                  <p className="desc">指导材料与题库台账，不含正文全文。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table id="admin-knowledge-table">
                  <thead>
                    <tr><th>标题</th><th>类型</th><th>更新</th><th>状态</th></tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4}>正在读取服务端知识资料台账…</td></tr> : (overview?.sources || []).map((r) => (
                      <tr key={r.asset_id}>
                        <td>{r.title}</td>
                        <td>{r.asset_type || '资料'}</td>
                        <td>{r.published_on || '未登记'}</td>
                        <td><span className={`tag ${statusTagClass(r.status)}`}>{statusLabel(r.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {nav === 'audit' && (
            <section data-panel="audit">
              <div className="page-head">
                <div>
                  <h1>脱敏审计</h1>
                  <p className="desc">关键写操作事件扫描。不展示敏感原文。</p>
                </div>
              </div>
              <div className="table-wrap">
                <table id="admin-audit-table">
                  <thead>
                    <tr><th>时间</th><th>操作者</th><th>动作</th><th>范围</th><th>结果</th></tr>
                  </thead>
                  <tbody>
                    {loading ? <tr><td colSpan={5}>正在读取服务端审计事件…</td></tr> : (overview?.audits || []).map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateTime(r.created_at)}</td>
                        <td>{roleLabel(r.actor_role)}</td>
                        <td>{auditActionLabel(r.action)}</td>
                        <td>{r.resource_type}</td>
                        <td><span className="tag tag-success">已记录</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {nav === 'insights' && <InsightsPanel token={token} />}
          {nav === 'simulation' && <SimulationPanel token={token} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动导航">
        <button
          type="button"
          aria-current={nav === 'access' ? 'page' : undefined}
          onClick={() => setNav('access')}
        >
          <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /></svg>
          <span>权限</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'jobs' ? 'page' : undefined}
          onClick={() => setNav('jobs')}
        >
          <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /></svg>
          <span>岗位</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'knowledge' ? 'page' : undefined}
          onClick={() => setNav('knowledge')}
        >
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
          <span>资料</span>
        </button>
        <button
          type="button"
          aria-current={nav === 'audit' ? 'page' : undefined}
          onClick={() => setNav('audit')}
        >
          <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></svg>
          <span>审计</span>
        </button>
      </nav>
    </div>
  )
}

function mapCounselorStudent(response: CounselorStudentResponse): CounselorStudent {
  const latestPlan = response.plans[0]
  return {
    id: response.student_id,
    name: response.display_name,
    studentNumber: response.student_number,
    phone: response.phone,
    email: response.email,
    enrollmentYear: response.enrollment_year,
    enrollmentDate: response.enrollment_date,
    major: response.major,
    targetRole: response.target_roles.join('、') || '未设置',
    targetCity: response.target_cities.join('、') || '未设置',
    stage: response.job_stage,
    planCount: response.plans.length,
    adviceCount: response.advice.length,
    planId: latestPlan?.id,
    history: response.advice.map((item) => ({
      id: item.id,
      at: formatDateTime(item.created_at),
      text: item.content,
    })),
  }
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace(/\+00:00$/, '').slice(0, 16)
}

function auditActionLabel(action: string): string {
  return ({
    career_profile_updated: '保存职业画像',
    matches_generated: '生成岗位推荐',
    action_plan_created: '生成行动计划',
    teacher_advice_created: '提交指导意见',
    counselor_access_granted: '更新授权关系',
  }[action] || action)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '服务暂时不可用，请确认后端与数据库已启动后重试。'
}
