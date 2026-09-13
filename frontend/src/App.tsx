import { FormEvent, useState } from 'react'
import {
  ActionPlan,
  ApiError,
  api,
  CareerProfile,
  CareerProfilePayload,
  AuthSession,
  Match,
  ActionPlanResponse,
} from './api/client'
import { AdvicePanel } from './components/AdvicePanel'
import { ChangePasswordDialog } from './components/ChangePasswordDialog'
import { MatchesPanel } from './components/MatchesPanel'
import { PlansPanel } from './components/PlansPanel'
import { ProfilePanel } from './components/ProfilePanel'
import { StudentNav, TaskFlow } from './components/TaskFlow'
import { ToastProvider, useToast } from './components/Toast'
import { WelcomeScreen } from './components/WelcomeScreen'
import { brand } from './config/brand'
import { StaffDashboard } from './StaffDashboard'
import { defaultProfileForm, ProfileForm } from './types/career'

export type AppRole = 'student' | 'teacher' | 'admin' | null

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

function AppContent() {
  const { showToast } = useToast()
  const [role, setRole] = useState<AppRole>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [studentNav, setStudentNav] = useState<StudentNav>('profile')
  const [profileSaved, setProfileSaved] = useState(false)
  const [form, setForm] = useState<ProfileForm>(defaultProfileForm)
  const [jobs, setJobs] = useState<Match[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [matchesMessage, setMatchesMessage] = useState<string | null>(null)
  const [handoffRecommended, setHandoffRecommended] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [planLoadingId, setPlanLoadingId] = useState<string | null>(null)
  const [plan, setPlan] = useState<ActionPlan | null>(null)

  const handleAuthenticated = async (nextSession: AuthSession) => {
    try {
      const selectedRole = nextSession.role === 'counselor' ? 'teacher' : nextSession.role
      if (selectedRole === 'student') {
        setProfileSaved(false)
        setJobs([])
        setPlan(null)
        setMatchesMessage(null)
        setHandoffRecommended(false)
        try {
          const profile = await api.readCareerProfile(nextSession.access_token)
          setForm(profileToForm(profile))
          setProfileSaved(true)
          try {
            const savedPlan = await api.readLatestActionPlan(nextSession.access_token)
            setPlan(actionPlanToView(savedPlan))
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 404)) throw error
          }
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 409)) throw error
        }
        setStudentNav('profile')
        showToast('已进入学生工作台', '账号登录成功。', 'info')
      } else if (selectedRole === 'teacher') {
        showToast('已进入教师工作台', '账号登录成功。', 'info')
      } else {
        showToast('已进入管理工作台', '账号登录成功。', 'info')
      }
      setSession(nextSession)
      setRole(selectedRole)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '无法完成登录，请稍后重试。'
      showToast('登录失败', message, 'warning')
    }
  }

  const handleExit = () => {
    setSession(null)
    setRole(null)
  }

  const handlePasswordChanged = () => {
    handleExit()
    showToast('密码已修改', '请使用新密码重新登录。', 'success')
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return
    setSavingProfile(true)
    try {
      const savedProfile = await api.saveCareerProfile(session.access_token, formToPayload(form))
      setForm(profileToForm(savedProfile))
      setProfileSaved(true)
      setJobs([])
      setMatchesMessage(null)
      setHandoffRecommended(false)
      setStudentNav('jobs')
      await refreshMatches(session.access_token)
      showToast('画像已保存', '已用于后续匹配，推荐已按最新画像更新。', 'success')
    } catch (error) {
      showApiError(error, '保存画像失败')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleResetProfile = () => {
    setForm(defaultProfileForm)
    setProfileSaved(false)
    showToast('已重置画像', '已恢复默认示例画像。', 'info')
  }

  const refreshMatches = async (token = session?.access_token) => {
    if (!token) return
    setLoadingJobs(true)
    setJobs([])
    setMatchesMessage(null)
    setHandoffRecommended(false)
    try {
      const result = await api.generateMatches(token)
      setJobs(result.matches)
      setMatchesMessage(result.message || null)
      setHandoffRecommended(result.handoff_recommended)
      if (result.matches.length > 0) {
        showToast('推荐结果已生成', `已返回 ${result.matches.length} 条未过期岗位。`, 'success')
      }
    } catch (error) {
      setMatchesMessage('岗位推荐暂时无法生成，请稍后重试。')
      showApiError(error, '生成推荐失败')
    } finally {
      setLoadingJobs(false)
    }
  }

  const handleGenerateJobs = () => {
    void refreshMatches()
  }

  const handleMakePlan = async (job: Match) => {
    if (!session) return
    setPlanLoadingId(`plan-${job.id}`)
    try {
      const response = await api.createActionPlan(session.access_token, job.id)
      setPlan(actionPlanToView(response))
      setStudentNav('plan')
      showToast('行动计划已生成', '已保存为当前岗位的分阶段任务。', 'success')
    } catch (error) {
      showApiError(error, '生成行动计划失败')
    } finally {
      setPlanLoadingId(null)
    }
  }

  const showApiError = (error: unknown, title: string) => {
    const message = error instanceof ApiError ? error.message : '操作未完成，请稍后重试。'
    if (error instanceof ApiError && error.status === 401) handleExit()
    showToast(title, message, 'warning')
  }

  if (!role) {
    return <WelcomeScreen onAuthenticated={handleAuthenticated} />
  }

  if (session?.must_change_password) {
    return <ChangePasswordDialog token={session.access_token} required onComplete={handlePasswordChanged} />
  }

  if ((role === 'teacher' || role === 'admin') && session) {
    return (
      <StaffDashboard
        token={session.access_token}
        name={session.display_name}
        role={role}
        onSwitch={handleExit}
      />
    )
  }

  return (
    <div id="app" className="app" data-od-id="zhitu-style-lab">
      <div id="view-student" className="shell" data-role-view="student">
        {/* Topbar */}
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5" />
                <path d="M4 17c4-3 8-3 12 0V7c-4-3-8-3-12 0" />
                <path d="M16 19l4-2V5l-4 2" />
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-name">{brand.productName}</div>
              <div className="brand-sub">{brand.universityName} · 学生工作台</div>
            </div>
          </div>
          <div className="top-meta">
            <span className="meta-chip hide-sm">演示数据</span>
            <span className="meta-chip">
              <b>王同学</b> · 软件工程
            </span>
            <div className="top-actions">
              <button
                type="button"
                className="btn btn-ghost"
                data-action="switch-role"
                onClick={handleExit}
              >
                退出并切换角色
              </button>
            </div>
          </div>
        </header>

        <div className="body-row">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="nav-section-label">工作台导航</div>
            <nav className="nav-list">
              <button
                type="button"
                className="nav-item"
                data-nav="profile"
                aria-current={studentNav === 'profile' ? 'page' : undefined}
                onClick={() => setStudentNav('profile')}
              >
                <span>
                  <svg viewBox="0 0 24 24">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
                </span>
                <span className="nav-copy">
                  <div className="nav-title">职业画像</div>
                  <div className="nav-hint">基础信息</div>
                </span>
                <span className={`stage-dot ${profileSaved ? 'done' : 'warn'}`} data-stage-for="profile" />
              </button>

              <button
                type="button"
                className="nav-item"
                data-nav="jobs"
                aria-current={studentNav === 'jobs' ? 'page' : undefined}
                onClick={() => setStudentNav('jobs')}
              >
                <span>
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                  </svg>
                </span>
                <span className="nav-copy">
                  <div className="nav-title">岗位推荐</div>
                  <div className="nav-hint">匹配与缺口</div>
                </span>
                <span className={`stage-dot ${jobs.length > 0 ? 'active' : ''}`} data-stage-for="jobs" />
              </button>

              <button
                type="button"
                className="nav-item"
                data-nav="plan"
                aria-current={studentNav === 'plan' ? 'page' : undefined}
                onClick={() => setStudentNav('plan')}
              >
                <span>
                  <svg viewBox="0 0 24 24">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                </span>
                <span className="nav-copy">
                  <div className="nav-title">行动计划</div>
                  <div className="nav-hint">可执行任务</div>
                </span>
                <span className="stage-dot active" data-stage-for="plan" />
              </button>

              <button
                type="button"
                className="nav-item"
                data-nav="consult"
                aria-current={studentNav === 'consult' ? 'page' : undefined}
                onClick={() => setStudentNav('consult')}
              >
                <span>
                  <svg viewBox="0 0 24 24">
                    <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.8A8 8 0 1 1 21 12z" />
                  </svg>
                </span>
                <span className="nav-copy">
                  <div className="nav-title">就业咨询</div>
                  <div className="nav-hint">智能建议</div>
                </span>
                <span className="stage-dot" data-stage-for="consult" />
              </button>
            </nav>

            <div className="sidebar-note">
              <strong>数据边界</strong>
              演示环境仅展示脱敏字段与模拟/公开岗位。不会请求真实学校库或密钥。
            </div>
          </aside>

          {/* Main Area */}
          <main className="main">
            {/* Task Stepper */}
            <TaskFlow
              currentNav={studentNav}
              onSelectNav={(n) => setStudentNav(n)}
              profileSaved={profileSaved}
              jobsCount={jobs.length}
              planCount={plan?.items.length || 0}
            />

            {/* Panels */}
            {studentNav === 'profile' && (
              <ProfilePanel
                form={form}
                setForm={(updater) => {
                  setForm(updater)
                  setProfileSaved(false)
                }}
                saved={profileSaved}
                loading={savingProfile}
                onSave={handleSaveProfile}
                onReset={handleResetProfile}
              />
            )}

            {studentNav === 'jobs' && (
              <MatchesPanel
                matches={jobs}
                loading={loadingJobs}
                message={matchesMessage}
                handoffRecommended={handoffRecommended}
                planLoadingId={planLoadingId}
                onGenerate={handleGenerateJobs}
                onPlan={handleMakePlan}
              />
            )}

            {studentNav === 'plan' && (
              <PlansPanel
                plan={plan}
                onGoJobs={() => setStudentNav('jobs')}
              />
            )}

            {studentNav === 'consult' && session && <AdvicePanel token={session.access_token} />}
          </main>
        </div>

        {/* Mobile Navigation */}
        <nav className="mobile-nav" aria-label="移动导航">
          <button
            type="button"
            data-nav="profile"
            aria-current={studentNav === 'profile' ? 'page' : undefined}
            onClick={() => setStudentNav('profile')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="4" />
            </svg>
            <span>画像</span>
          </button>
          <button
            type="button"
            data-nav="jobs"
            aria-current={studentNav === 'jobs' ? 'page' : undefined}
            onClick={() => setStudentNav('jobs')}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>推荐</span>
          </button>
          <button
            type="button"
            data-nav="plan"
            aria-current={studentNav === 'plan' ? 'page' : undefined}
            onClick={() => setStudentNav('plan')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M8 6h13M8 12h13M8 18h13" />
            </svg>
            <span>计划</span>
          </button>
          <button
            type="button"
            data-nav="consult"
            aria-current={studentNav === 'consult' ? 'page' : undefined}
            onClick={() => setStudentNav('consult')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.8A8 8 0 1 1 21 12z" />
            </svg>
            <span>咨询</span>
          </button>
        </nav>
      </div>

      <div className="footer-note">
        {brand.universityName}就业指导中心 · 演示环境使用脱敏示例数据，不含真实学生信息
      </div>
    </div>
  )
}

function formToPayload(form: ProfileForm): CareerProfilePayload {
  return {
    major: form.major.trim(),
    skills: splitList(form.skills),
    projects: splitList(form.projects),
    target_roles: splitList(form.targetRoles),
    target_cities: splitList(form.targetCities),
    job_stage: form.jobStage,
  }

}

function profileToForm(profile: CareerProfile): ProfileForm {
  return {
    major: profile.major,
    skills: profile.skills.join(', '),
    projects: profile.projects.join('\n'),
    targetRoles: profile.target_roles.join(', '),
    targetCities: profile.target_cities.join(', '),
    jobStage: profile.job_stage,
  }
}

function splitList(value: string): string[] {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function actionPlanToView(response: ActionPlanResponse): ActionPlan {
  return {
    id: response.id,
    match_id: response.match_id,
    status: response.status,
    job_title: [response.job_title, response.company_name].filter(Boolean).join(' · '),
    created_at: response.created_at,
    advice_count: response.advice_count,
    items: response.items.map((item, index) => ({
      id: `${response.id}-${index}`,
      phase: item.phase,
      priority: item.priority,
      status: '待开始',
      title: item.task,
      detail: '根据当前岗位匹配结果生成，请结合实际情况执行。',
    })),
  }
}
