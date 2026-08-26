import { FormEvent, useState } from 'react'
import {
  ActionPlan,
  INITIAL_JOBS,
  INITIAL_PLAN_ITEMS,
  Match,
} from './api/client'
import { AdvicePanel } from './components/AdvicePanel'
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
  const [studentNav, setStudentNav] = useState<StudentNav>('profile')
  const [profileSaved, setProfileSaved] = useState(true)
  const [form, setForm] = useState<ProfileForm>(defaultProfileForm)
  const [jobs, setJobs] = useState<Match[]>(INITIAL_JOBS)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [planLoadingId, setPlanLoadingId] = useState<string | null>(null)
  const [plan, setPlan] = useState<ActionPlan>({
    id: 'p1',
    match_id: 'j1',
    status: 'active',
    job_title: '后端开发实习生 · 成都示例科技',
    created_at: '2026-05-14 11:06',
    advice_count: 1,
    items: INITIAL_PLAN_ITEMS,
  })

  const handleEnterRole = (selectedRole: 'student' | 'teacher' | 'admin') => {
    setRole(selectedRole)
    if (selectedRole === 'student') {
      setStudentNav('profile')
      showToast('已进入学生工作台', '演示数据环境，可在右上角退出并切换角色。', 'info')
    } else if (selectedRole === 'teacher') {
      showToast('已进入教师工作台', '演示数据环境，可在右上角退出并切换角色。', 'info')
    } else if (selectedRole === 'admin') {
      showToast('已进入管理工作台', '演示数据环境，可在右上角退出并切换角色。', 'info')
    }
  }

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)

    setTimeout(() => {
      setProfileSaved(true)
      setSavingProfile(false)
      setJobs(INITIAL_JOBS)
      setStudentNav('jobs')
      showToast('画像已保存', '已用于后续匹配。正在带你查看岗位推荐。', 'success')
    }, 650)
  }

  const handleResetProfile = () => {
    setForm(defaultProfileForm)
    setProfileSaved(false)
    showToast('已重置画像', '已恢复默认示例画像。', 'info')
  }

  const handleGenerateJobs = () => {
    setLoadingJobs(true)
    setJobs([])

    setTimeout(() => {
      setJobs(INITIAL_JOBS)
      setLoadingJobs(false)
      showToast('推荐结果已生成', `共 ${INITIAL_JOBS.length} 条未过期岗位，可展开查看匹配依据。`, 'success')
    }, 750)
  }

  const handleMakePlan = (job: Match) => {
    setPlanLoadingId(`plan-${job.id}`)

    setTimeout(() => {
      const targetGap = job.gaps[0] || '核心缺口'
      const updatedItems = INITIAL_PLAN_ITEMS.map((item, idx) => {
        if (idx === 0) {
          return {
            ...item,
            title: `针对「${targetGap}」完成专项练习并更新项目说明`,
            detail: `围绕 ${job.gaps.join('、')} 制定本周练习，关联岗位：${job.title}。`,
          }
        }
        return item
      })

      const now = new Date()
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`

      setPlan({
        id: `plan-${Date.now()}`,
        match_id: job.id,
        status: 'active',
        job_title: `${job.title} · ${job.company_name}`,
        created_at: stamp,
        advice_count: 1,
        items: updatedItems,
      })

      setPlanLoadingId(null)
      setStudentNav('plan')
      showToast('行动计划已生成', '缺口已转换为分阶段任务，可在行动计划中查看。', 'success')
    }, 700)
  }

  if (!role) {
    return <WelcomeScreen onEnterRole={handleEnterRole} />
  }

  if (role === 'teacher' || role === 'admin') {
    return (
      <StaffDashboard
        token="token"
        name={role === 'teacher' ? '陈老师' : '就业管理员'}
        role={role}
        onSwitch={() => setRole(null)}
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
                onClick={() => setRole(null)}
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
              planCount={plan.items.length}
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

            {studentNav === 'consult' && <AdvicePanel />}
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
