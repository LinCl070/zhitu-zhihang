import { FormEvent, useEffect, useState } from 'react'
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronRight,
  Compass,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
  Route,
  Save,
  Sparkles,
  Target,
} from 'lucide-react'

import { ActionPlan, api, ApiError, AssistantResponse, CareerProfile, JobStage, Match } from './api/client'
import { brand } from './config/brand'
import { StaffDashboard } from './StaffDashboard'

type View = 'profile' | 'matches' | 'plans' | 'advice'

type ProfileForm = {
  major: string
  skills: string
  projects: string
  targetRoles: string
  targetCities: string
  jobStage: JobStage
}

const initialForm: ProfileForm = {
  major: '软件工程',
  skills: 'Python, SQL, Git, REST API',
  projects: '接口设计项目',
  targetRoles: '后端开发',
  targetCities: '成都',
  jobStage: 'preparing',
}

const navItems: Array<{ id: View; label: string; icon: typeof Compass }> = [
  { id: 'profile', label: '职业画像', icon: Compass },
  { id: 'matches', label: '岗位推荐', icon: BriefcaseBusiness },
  { id: 'plans', label: '行动计划', icon: Route },
  { id: 'advice', label: '就业咨询', icon: MessageSquareText },
]

export default function App() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('career-demo-token'))
  const [studentName, setStudentName] = useState(() => sessionStorage.getItem('career-demo-name') ?? '')
  const [role, setRole] = useState(() => sessionStorage.getItem('career-demo-role') ?? 'student')
  const [view, setView] = useState<View>('profile')
  const [form, setForm] = useState<ProfileForm>(initialForm)
  const [profile, setProfile] = useState<CareerProfile | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [plans, setPlans] = useState<ActionPlan[]>([])
  const [advice, setAdvice] = useState<AssistantResponse | null>(null)
  const [question, setQuestion] = useState('我该如何准备后端开发实习？')
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    void loadProfile(token)
  }, [token])

  async function loadProfile(currentToken: string) {
    try {
      const savedProfile = await api.getProfile(currentToken)
      setProfile(savedProfile)
      setForm(profileToForm(savedProfile))
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return
      setNotice(readError(error))
    }
  }

  async function enterDemo(identity: 'student-a' | 'student-b' | 'counselor' | 'admin') {
    setLoading('login')
    setNotice(null)
    try {
      const session = await api.startDemo(identity)
      sessionStorage.setItem('career-demo-token', session.access_token)
      sessionStorage.setItem('career-demo-name', session.display_name)
      sessionStorage.setItem('career-demo-role', session.role)
      setToken(session.access_token)
      setStudentName(session.display_name)
      setRole(session.role)
    } catch (error) {
      setNotice(readError(error))
    } finally {
      setLoading(null)
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setLoading('profile')
    setNotice(null)
    try {
      const savedProfile = await api.saveProfile(token, {
        major: form.major.trim(),
        skills: splitTags(form.skills),
        projects: splitTags(form.projects),
        target_roles: splitTags(form.targetRoles),
        target_cities: splitTags(form.targetCities),
        job_stage: form.jobStage,
      })
      setProfile(savedProfile)
      setMatches([])
      setView('matches')
      setLoading('matches')
      try {
        const response = await api.generateMatches(token)
        setMatches(response.matches)
        setNotice(response.message ?? '职业画像已保存，岗位推荐已按最新目标更新。')
      } catch (error) {
        setNotice(`职业画像已保存，但${readError(error)}，可手动重新生成推荐。`)
      }
    } catch (error) {
      setNotice(readError(error))
    } finally {
      setLoading(null)
    }
  }

  async function generateMatches() {
    if (!token) return
    setLoading('matches')
    setNotice(null)
    try {
      const response = await api.generateMatches(token)
      setMatches(response.matches)
      setNotice(response.message ?? '推荐结果已按岗位要求和职业画像生成。')
    } catch (error) {
      setNotice(readError(error))
      if (error instanceof ApiError && error.status === 409) setView('profile')
    } finally {
      setLoading(null)
    }
  }

  async function createPlan(match: Match) {
    if (!token) return
    setLoading(`plan-${match.id}`)
    setNotice(null)
    try {
      const plan = await api.createPlan(token, match.id)
      setPlans((current) => [plan, ...current.filter((item) => item.match_id !== plan.match_id)])
      setView('plans')
      setNotice(`已生成「${match.title}」的行动计划。`)
    } catch (error) {
      setNotice(readError(error))
    } finally {
      setLoading(null)
    }
  }

  async function askAssistant(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setLoading('advice')
    setNotice(null)
    try {
      setAdvice(await api.ask(token, question))
    } catch (error) {
      setNotice(readError(error))
    } finally {
      setLoading(null)
    }
  }

  if (!token) {
    return <WelcomeScreen loading={loading === 'login'} notice={notice} onEnter={enterDemo} />
  }

  function resetSession() {
    sessionStorage.removeItem('career-demo-token')
    sessionStorage.removeItem('career-demo-name')
    sessionStorage.removeItem('career-demo-role')
    setToken(null)
    setStudentName('')
    setRole('student')
    setProfile(null)
    setMatches([])
    setPlans([])
    setAdvice(null)
  }

  if (role === 'counselor' || role === 'admin') {
    return <StaffDashboard token={token} name={studentName} role={role} onSwitch={resetSession} />
  }

  return (
    <main className="app-shell dashboard-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true"><Compass size={21} /></span>
          <div><strong>{brand.productName}</strong><span>{brand.universityName}</span></div>
        </div>
        <div className="session-summary"><span className="mode-label">学生演示</span><strong>{studentName || '演示学生'}</strong><button className="role-switch" type="button" onClick={resetSession}><LogOut size={15}/>切换角色</button></div>
      </header>

      <section className="dashboard-intro" aria-labelledby="dashboard-title">
        <div><p>职业规划工作台</p><h1 id="dashboard-title">把方向变成可执行的下一步</h1></div>
        <div className="readiness"><span><BadgeCheck size={16} /> 规则匹配</span><span><ShieldMark /> 脱敏演示</span></div>
      </section>

      <div className="dashboard-grid">
        <nav className="side-nav" aria-label="学生工作台导航">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => setView(id)}>
              <Icon size={18} /><span>{label}</span>{id === 'matches' && matches.length > 0 && <b>{matches.length}</b>}
            </button>
          ))}
          <div className="nav-note"><Target size={17} /><span>只使用模拟岗位与脱敏职业信息</span></div>
        </nav>

        <section className="workbench" aria-live="polite">
          {notice && <div className="notice"><Lightbulb size={17} /><span>{notice}</span></div>}
          {view === 'profile' && <ProfilePanel form={form} setForm={setForm} saved={Boolean(profile)} loading={loading === 'profile'} onSave={saveProfile} />}
          {view === 'matches' && <MatchesPanel matches={matches} loading={loading === 'matches'} onGenerate={generateMatches} onPlan={createPlan} planLoading={loading} />}
          {view === 'plans' && <PlansPanel plans={plans} onGoMatches={() => setView('matches')} />}
          {view === 'advice' && <AdvicePanel question={question} setQuestion={setQuestion} advice={advice} loading={loading === 'advice'} onAsk={askAssistant} />}
        </section>
      </div>
    </main>
  )
}

function WelcomeScreen({ loading, notice, onEnter }: { loading: boolean; notice: string | null; onEnter: (identity: 'student-a' | 'student-b' | 'counselor' | 'admin') => void }) {
  return <main className="app-shell welcome-shell"><header className="topbar"><div className="brand-block"><span className="brand-mark"><Compass size={21} /></span><div><strong>{brand.productName}</strong><span>{brand.universityName}</span></div></div><span className="mode-label">模拟模式</span></header><section className="welcome-panel"><div className="welcome-copy"><p>高校就业择业规划智能体</p><h1>职业画像、规则匹配与下一步行动</h1><span>使用合成学生身份和本地模拟岗位完成职业规划演示。</span>{notice && <div className="notice"><Lightbulb size={17} /><span>{notice}</span></div>}<div className="demo-role-actions"><button className="primary-button" type="button" onClick={() => onEnter('student-a')} disabled={loading}><LogIn size={18}/>{loading ? '进入中...' : '进入学生演示'}</button><button className="secondary-button" type="button" onClick={() => onEnter('counselor')} disabled={loading}>教师工作台</button><button className="secondary-button" type="button" onClick={() => onEnter('admin')} disabled={loading}>管理员工作台</button></div></div><div className="flow-list"><FlowStep index="01" icon={Compass} title="建立画像" text="专业、技能、项目与目标"/><FlowStep index="02" icon={BriefcaseBusiness} title="查看推荐" text="规则分、差距与岗位来源"/><FlowStep index="03" icon={Route} title="生成计划" text="以阶段性待办推进准备"/></div></section></main>
}

function FlowStep({ index, icon: Icon, title, text }: { index: string; icon: typeof Compass; title: string; text: string }) { return <div className="flow-step"><span>{index}</span><Icon size={20}/><div><strong>{title}</strong><p>{text}</p></div></div> }

function ProfilePanel({ form, setForm, saved, loading, onSave }: { form: ProfileForm; setForm: (value: ProfileForm) => void; saved: boolean; loading: boolean; onSave: (event: FormEvent) => void }) {
  const update = (key: keyof ProfileForm, value: string) => setForm({ ...form, [key]: value })
  return <section className="panel"><div className="panel-heading"><div><p>01 / 职业画像</p><h2>{saved ? '更新你的职业画像' : '先建立你的职业画像'}</h2><span>仅填写真实、可验证的学习与项目经历。</span></div><span className={saved ? 'status-dot complete' : 'status-dot'}>{saved ? '已保存' : '待完善'}</span></div><form className="profile-form" onSubmit={onSave}><label className="form-field wide"><span>专业</span><input value={form.major} onChange={(event) => update('major', event.target.value)} required /></label><label className="form-field"><span>技能标签</span><input value={form.skills} onChange={(event) => update('skills', event.target.value)} required /><small>使用逗号分隔，例如 Python, SQL</small></label><label className="form-field"><span>目标岗位</span><input value={form.targetRoles} onChange={(event) => update('targetRoles', event.target.value)} required /></label><label className="form-field wide"><span>脱敏项目摘要</span><textarea rows={3} value={form.projects} onChange={(event) => update('projects', event.target.value)} required /><small>可填写接口设计、数据分析等真实项目类型，不填写个人联系方式。</small></label><label className="form-field"><span>目标城市</span><input value={form.targetCities} onChange={(event) => update('targetCities', event.target.value)} required /></label><label className="form-field"><span>当前阶段</span><select value={form.jobStage} onChange={(event) => update('jobStage', event.target.value)}><option value="exploring">探索方向</option><option value="preparing">准备求职</option><option value="applying">正在投递</option></select></label><div className="form-actions"><button className="primary-button" disabled={loading}><Save size={18}/>{loading ? '保存中...' : '保存职业画像'}</button></div></form></section>
}

function MatchesPanel({ matches, loading, onGenerate, onPlan, planLoading }: { matches: Match[]; loading: boolean; onGenerate: () => void; onPlan: (match: Match) => void; planLoading: string | null }) {
  return <section className="panel"><div className="panel-heading"><div><p>02 / 岗位推荐</p><h2>从画像出发的规则匹配</h2><span>展示已发布、未过期的公开与模拟岗位；公开岗位请以招聘方页面为准。</span></div><button className="primary-button" type="button" onClick={onGenerate} disabled={loading}><Sparkles size={18}/>{loading ? '匹配中...' : '生成推荐'}</button></div>{matches.length === 0 ? <div className="empty-state"><BriefcaseBusiness size={28}/><strong>还没有推荐结果</strong><span>保存职业画像后，生成最多 10 条可解释的岗位推荐。</span></div> : <div className="match-list">{matches.map((match) => <article className="match-card" key={match.id}><div className="match-score"><strong>{match.score}</strong><span>匹配分</span></div><div className="match-main"><div className="match-title"><div><h3>{match.title}</h3><span>{match.company_name} · <MapPin size={13}/>{match.source.demo_only ? '模拟岗位' : '公开岗位'}</span></div><button className="text-action" type="button" onClick={() => onPlan(match)} disabled={planLoading === `plan-${match.id}`}>{planLoading === `plan-${match.id}` ? '生成中...' : <>生成计划 <ChevronRight size={16}/></>}</button></div><div className="score-list">{Object.entries(match.score_breakdown).map(([key, value]) => <span key={key}>{scoreLabel(key)} <b>{value}</b></span>)}</div>{match.gaps.length > 0 ? <p className="gaps">待补强：{match.gaps.join('、')}</p> : <p className="gaps matched">当前画像已覆盖岗位核心技能</p>}<footer>来源：{match.source.url ? <a href={match.source.url} target="_blank" rel="noreferrer">{match.source.title}</a> : match.source.title} · {match.source.demo_only ? '有效至' : '信息复核至'} {match.source.valid_until}</footer></div></article>)}</div>}</section>
}

function PlansPanel({ plans, onGoMatches }: { plans: ActionPlan[]; onGoMatches: () => void }) { return <section className="panel"><div className="panel-heading"><div><p>03 / 行动计划</p><h2>把差距转成阶段性任务</h2><span>计划基于规则匹配缺口生成，不替代教师指导。</span></div></div>{plans.length === 0 ? <div className="empty-state"><Route size={28}/><strong>先选择一个推荐岗位</strong><span>在岗位推荐中生成对应的行动计划。</span><button className="secondary-button" type="button" onClick={onGoMatches}>查看岗位推荐</button></div> : <div className="plan-list">{plans.map((plan) => <article className="plan-card" key={plan.id}><header><strong>行动计划</strong><span>{plan.status === 'active' ? '进行中' : plan.status}</span></header>{plan.items.map((item, index) => <div className="plan-item" key={`${plan.id}-${item.phase}`}><b>{index + 1}</b><div><span>{item.phase} · {item.priority}优先级</span><p>{item.task}</p></div></div>)}</article>)}</div>}</section> }

function AdvicePanel({ question, setQuestion, advice, loading, onAsk }: { question: string; setQuestion: (value: string) => void; advice: AssistantResponse | null; loading: boolean; onAsk: (event: FormEvent) => void }) { return <section className="panel"><div className="panel-heading"><div><p>04 / 就业咨询</p><h2>围绕真实准备问题进行咨询</h2><span>建议会显示资料状态，资料不足时转人工确认。</span></div></div><form className="advice-form" onSubmit={onAsk}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={500} required/><button className="primary-button" disabled={loading}><MessageSquareText size={18}/>{loading ? '咨询中...' : '提交咨询'}</button></form>{advice && <article className="advice-answer"><header><span><Sparkles size={17}/>智能建议</span><b>{advice.mode === 'mock' ? '模拟模式' : '已返回'}</b></header><p>{advice.answer}</p><small>{advice.disclaimer}</small>{advice.handoff_recommended && <div className="handoff"><BadgeCheck size={16}/>建议联系学校就业指导部门人工确认</div>}</article>}</section> }

function ShieldMark() { return <span className="shield-mark" aria-hidden="true">◎</span> }
function splitTags(value: string) { return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }
function profileToForm(profile: CareerProfile): ProfileForm { return { major: profile.major, skills: profile.skills.join(', '), projects: profile.projects.join(', '), targetRoles: profile.target_roles.join(', '), targetCities: profile.target_cities.join(', '), jobStage: profile.job_stage } }
function scoreLabel(key: string) { return ({ skills: '技能', major: '专业', projects: '项目', city: '城市', target_role: '目标' } as Record<string, string>)[key] ?? key }
function readError(error: unknown) { return error instanceof Error ? error.message : '请求暂时无法完成，请稍后重试。' }
