export type JobStage = 'exploring' | 'preparing' | 'applying'

export type CareerProfile = {
  id: string
  student_id: string
  major: string
  skills: string[]
  projects: string[]
  target_roles: string[]
  target_cities: string[]
  job_stage: JobStage
}

export type Match = {
  id: string
  job_id: string
  title: string
  company_name: string
  score: number
  score_breakdown: Record<string, number>
  gaps: string[]
  reasons: string[]
  source: {
    title: string
    url: string | null
    published_on: string
    valid_until: string
    demo_only: boolean
  }
}

export type ActionPlanItem = {
  id?: string
  phase: string
  priority: string
  status: string
  title: string
  detail: string
}

export type ActionPlan = {
  id: string
  match_id: string
  status: string
  job_title: string
  created_at: string
  advice_count: number
  items: ActionPlanItem[]
}

export type ActionPlanResponse = {
  id: string
  match_id: string
  status: string
  items: Array<{
    phase: string
    priority: string
    task: string
  }>
  job_title: string
  company_name: string
  created_at: string
  advice_count: number
}

export type CounselorStudent = {
  id: string
  name: string
  studentNumber: string | null
  phone: string | null
  email: string | null
  enrollmentYear: number | null
  enrollmentDate: string | null
  major: string
  targetRole: string
  targetCity: string
  stage: string
  planCount: number
  adviceCount: number
  history: Array<{ id: string; at: string; text: string }>
  planId?: string
}

export type AdminJob = {
  title: string
  org: string
  status: string
  visibility: string
  expire: string
}

export type AdminKnowledge = {
  title: string
  type: string
  updated: string
  status: string
}

export type AdminAudit = {
  time: string
  actor: string
  action: string
  scope: string
  result: string
}

export type AuthSession = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  display_name: string
  role: 'student' | 'counselor' | 'admin'
  must_change_password: boolean
}

export type StudentRegistrationRequest = {
  username: string
  password: string
  passwordConfirmation: string
  name: string
  studentNumber: string
  phone: string
  email: string
  enrollmentDate: string
}

export type TeacherCreateRequest = {
  username: string
  displayName: string
  phone: string
  email: string
  employmentDate: string
  password: string
}

export type CounselorStudentResponse = {
  student_id: string
  display_name: string
  student_number: string | null
  phone: string | null
  email: string | null
  enrollment_year: number | null
  enrollment_date: string | null
  major: string
  target_roles: string[]
  target_cities: string[]
  job_stage: string
  plans: Array<{ id: string; status: string; created_at: string }>
  advice: Array<{ id: string; action_plan_id: string; content: string; created_at: string }>
}

export type AdminOverviewResponse = {
  jobs: Array<{
    id: string
    title: string
    city: string
    published_on: string
    valid_until: string
    status: string
    source_title: string
    demo_only: boolean
  }>
  sources: Array<Record<string, string>>
  audits: Array<{
    id: string
    actor_role: string | null
    action: string
    resource_type: string
    resource_id: string | null
    created_at: string
  }>
  students: Array<{
    id: string
    display_name: string
    role: string
    student_number: string | null
    phone: string | null
    email: string | null
    enrollment_year: number | null
    enrollment_date: string | null
  }>
  counselors: Array<{
    id: string
    display_name: string
    role: string
    phone: string | null
    email: string | null
    employment_date: string | null
  }>
  accesses: Array<{ counselor_id: string; student_id: string }>
}

export type CareerProfilePayload = Omit<CareerProfile, 'id' | 'student_id'>

export type MatchesResponse = {
  matches: Match[]
  handoff_recommended: boolean
  message?: string | null
}

export type AssistantResponse = {
  answer: string
  sources: Array<{
    title: string
    url: string | null
    version_or_date: string | null
  }>
  disclaimer: string
  handoff_recommended: boolean
  mode: string
}

export const INITIAL_JOBS: Match[] = [
  {
    id: 'j1',
    job_id: 'j1',
    score: 86,
    title: '后端开发实习生',
    company_name: '成都示例科技有限公司',
    score_breakdown: { skills: 42, major: 18, projects: 12, city: 5, target_role: 9 },
    gaps: ['Docker', 'Redis'],
    reasons: [
      '专业与目标岗位高度一致，软件工程背景匹配后端实习要求',
      '技能标签覆盖 Java / Spring Boot / MySQL 核心栈',
      '项目摘要体现接口鉴权与状态机经验，贴近岗位职责',
    ],
    source: {
      title: '模拟岗位来源 · 校招示例库',
      url: null,
      published_on: '2026-03-12',
      valid_until: '2026-09-30',
      demo_only: true,
    },
  },
  {
    id: 'j2',
    job_id: 'j2',
    score: 79,
    title: 'Java 开发助理',
    company_name: '天府云数科技',
    score_breakdown: { skills: 36, major: 16, projects: 10, city: 8, target_role: 9 },
    gaps: ['消息队列', '单元测试'],
    reasons: [
      '目标城市一致，本地岗位加分',
      '目标岗位表述与 Java 方向重合',
      '项目经验可支撑基础业务开发，但中间件实践不足',
    ],
    source: {
      title: '公开岗位来源 · 示例招聘页',
      url: 'https://example.com/careers/java-assistant',
      published_on: '2026-04-02',
      valid_until: '2026-08-31',
      demo_only: false,
    },
  },
  {
    id: 'j3',
    job_id: 'j3',
    score: 71,
    title: '软件测试实习生',
    company_name: '锦城数据服务',
    score_breakdown: { skills: 28, major: 15, projects: 11, city: 8, target_role: 9 },
    gaps: ['接口自动化', '缺陷管理'],
    reasons: [
      '专业背景可迁移至质量保障方向',
      '项目中的状态机理解有助于用例设计',
      '与目标岗位存在方向偏差，总分因此低于后端岗',
    ],
    source: {
      title: '模拟岗位来源 · 就业中心样例',
      url: null,
      published_on: '2026-02-18',
      valid_until: '2026-10-15',
      demo_only: true,
    },
  },
]

export const INITIAL_PLAN_ITEMS: ActionPlanItem[] = [
  {
    id: 'p1',
    phase: '本周',
    priority: '高',
    status: '进行中',
    title: '补充 Redis 基础练习并整理项目说明',
    detail: '完成字符串/哈希常用命令实验，并在脱敏项目摘要中补充缓存使用场景。',
  },
  {
    id: 'p2',
    phase: '下周',
    priority: '中',
    status: '待开始',
    title: '完成一轮后端面试题与模拟面试',
    detail: '覆盖集合、事务隔离级别与常见接口设计题，预约教师一次模拟点评。',
  },
  {
    id: 'p3',
    phase: '两周内',
    priority: '中',
    status: '待开始',
    title: '搭建 Docker 本地运行示例',
    detail: '将示例 Spring Boot 服务容器化，理解镜像、端口映射与基础编排。',
  },
]

export const INITIAL_TEACHER_STUDENTS: CounselorStudent[] = [
  {
    id: 's1',
    name: '王同学',
    studentNumber: null,
    phone: null,
    email: null,
    enrollmentYear: null,
    enrollmentDate: null,
    major: '软件工程',
    targetRole: '后端开发实习生',
    targetCity: '成都',
    stage: '准备求职',
    planCount: 3,
    adviceCount: 1,
    history: [
      {
        id: 'a1',
        at: '2026-05-12 14:20',
        text: '建议本周先补 Redis 与项目说明，再约一次模拟面试。岗位方向清晰，可优先投递本地后端实习。',
      },
    ],
  },
  {
    id: 's2',
    name: '李同学',
    studentNumber: null,
    phone: null,
    email: null,
    enrollmentYear: null,
    enrollmentDate: null,
    major: '数据科学与大数据技术',
    targetRole: '数据分析实习生',
    targetCity: '成都',
    stage: '投递中',
    planCount: 2,
    adviceCount: 0,
    history: [],
  },
  {
    id: 's3',
    name: '赵同学',
    studentNumber: null,
    phone: null,
    email: null,
    enrollmentYear: null,
    enrollmentDate: null,
    major: '网络工程',
    targetRole: '运维开发实习生',
    targetCity: '重庆',
    stage: '准备求职',
    planCount: 1,
    adviceCount: 2,
    history: [
      {
        id: 'a2',
        at: '2026-05-08 10:05',
        text: '目标城市可同时关注成都与重庆，注意补充 Linux 基础与脚本能力说明。',
      },
      {
        id: 'a3',
        at: '2026-05-15 16:40',
        text: '已阅行动计划，建议将 Docker 任务提前到本周。',
      },
    ],
  },
]

export const INITIAL_ADMIN_JOBS: AdminJob[] = [
  { title: '后端开发实习生', org: '成都示例科技', status: '已发布', visibility: '模拟', expire: '2026-09-30' },
  { title: 'Java 开发助理', org: '天府云数科技', status: '已发布', visibility: '公开', expire: '2026-08-31' },
  { title: '软件测试实习生', org: '锦城数据服务', status: '待审核', visibility: '模拟', expire: '2026-10-15' },
  { title: '前端开发实习生', org: '青羊互联', status: '已过期', visibility: '模拟', expire: '2026-03-01' },
]

export const INITIAL_ADMIN_KNOWLEDGE: AdminKnowledge[] = [
  { title: '后端实习岗位能力说明', type: '岗位资料', updated: '2026-04-18', status: '可用' },
  { title: '脱敏项目摘要撰写指引', type: '指导材料', updated: '2026-03-02', status: '可用' },
  { title: '模拟面试题库（后端）', type: '题库', updated: '2026-05-01', status: '维护中' },
]

export const INITIAL_ADMIN_AUDIT: AdminAudit[] = [
  { time: '2026-05-16 09:12', actor: '教师 · 陈老师', action: '提交指导意见', scope: '学生摘要', result: '已记录' },
  { time: '2026-05-15 16:40', actor: '管理员 · 系统', action: '更新授权范围', scope: '教师-学生', result: '成功' },
  { time: '2026-05-14 11:03', actor: '学生 · 王同学', action: '保存职业画像', scope: '画像字段', result: '已脱敏' },
  { time: '2026-05-13 15:28', actor: '系统', action: '生成岗位推荐', scope: '模拟/公开岗位', result: '成功' },
]

export type RiskItem = {
  student_id: string
  display_name: string
  major: string
  job_stage: string | null
  score: number
  level: 'high' | 'medium' | 'low'
  factors: Record<string, number>
  reasons: string[]
  actions: string[]
}

export type InsightsResponse = {
  source: string
  synthetic: boolean
  groups: Array<{
    major: string
    stage: string
    count: number
    readiness_mean: number
    risk_distribution: Record<string, number>
  }>
  total_count: number
}

export type SimulationDefaults = {
  cohort_size: { default: number; min: number; max: number }
  weeks: { default: number; min: number; max: number }
  replications: { default: number; min: number; max: number }
  seed: { default: number; min: number; max: number }
  counselor_count: { default: number; min: number; max: number }
  sessions_per_week: { default: number; min: number; max: number }
  supply_ratio: { default: number; min: number; max: number }
  scenarios: string[]
}

export type SimulationSummary = {
  id: string
  created_at: string
  model_version: string
  seed: number
  cohort_size: number
  scenarios: string[]
  adopted_scenario: string | null
}

export type WeekPoint = {
  week: number
  readiness_rate: number
  matched_rate: number
  high_risk_count: number
  avg_gap: number
  counselor_utilization: number
}

export type ScenarioDetail = {
  scenario: string
  weeks: WeekPoint[]
  summary: Record<string, { mean: number; ci_low: number; ci_high: number }>
  top_skill_gaps: Array<{ skill: string; demand: number; supply: number; gap: number }>
}

export type SimulationDetail = {
  id: string
  created_at: string
  model_version: string
  seed: number
  params: Record<string, unknown>
  results: { scenarios: Record<string, ScenarioDetail> }
  adopted_scenario: string | null
}

export type StrategyReport = {
  ranking: Array<{ scenario: string; label: string; matched_rate: number }>
  findings: string[]
  recommendation: string
  caveats: string[]
  ai_narrative: string | null
  requires_review: boolean
}

export type SimulationCreatePayload = {
  cohort_size: number
  weeks: number
  replications: number
  seed: number
  counselor_count: number
  sessions_per_week: number
  supply_ratio: number
  scenarios: string[]
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, '暂时无法连接服务，请确认后端与数据库已启动后重试。')
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }

  if (response.status === 204) return undefined as T

  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status, '服务返回的数据格式无法识别，请稍后重试。')
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim()
    }
    if (Array.isArray(payload.detail)) {
      const firstError = payload.detail[0] as { msg?: unknown } | undefined
      if (typeof firstError?.msg === 'string' && firstError.msg.trim()) return firstError.msg.trim()
    }
  } catch {
    // Do not expose raw server responses in the browser.
  }

  if (response.status === 401) return '登录会话已失效，请重新登录。'
  if (response.status === 403) return '当前角色没有访问此数据的权限。'
  if (response.status === 409) return '请先完成并保存职业画像。'
  return '操作未完成，请稍后重试。'
}

export const api = {
  login: (username: string, password: string) => request<AuthSession>('/api/v1/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  registerStudent: (payload: StudentRegistrationRequest) =>
    request<{ id: string; username: string; display_name: string; role: string }>('/api/v1/auth/register/student', undefined, {
      method: 'POST',
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        password_confirmation: payload.passwordConfirmation,
        name: payload.name,
        student_number: payload.studentNumber,
        phone: payload.phone,
        email: payload.email,
        enrollment_date: payload.enrollmentDate,
      }),
    }),
  changePassword: (token: string, currentPassword: string, newPassword: string, confirmation: string) =>
    request<void>('/api/v1/auth/change-password', token, {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword, password_confirmation: confirmation }),
    }),
  createTeacher: (token: string, payload: TeacherCreateRequest) =>
    request<{ id: string; username: string; display_name: string; role: string; must_change_password: boolean }>('/api/v1/admin/users/teachers', token, {
      method: 'POST',
      body: JSON.stringify({
        username: payload.username,
        display_name: payload.displayName,
        phone: payload.phone,
        email: payload.email,
        employment_date: payload.employmentDate,
        password: payload.password,
      }),
    }),
  resetAccountPassword: (token: string, userId: string) =>
    request<{ id: string; username: string; display_name: string; role: string; temporary_password: string }>(`/api/v1/admin/users/${userId}/reset-password`, token, { method: 'POST' }),
  setAccountStatus: (token: string, userId: string, isActive: boolean) =>
    request<{ id: string; username: string; display_name: string; role: string }>(`/api/v1/admin/users/${userId}/status`, token, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) }),
  readCareerProfile: (token: string) => request<CareerProfile>('/api/v1/career-profile/me', token),
  saveCareerProfile: (token: string, payload: CareerProfilePayload) =>
    request<CareerProfile>('/api/v1/career-profile/me', token, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  generateMatches: (token: string, limit = 10) =>
    request<MatchesResponse>('/api/v1/matches', token, {
      method: 'POST',
      body: JSON.stringify({ limit }),
    }),
  createActionPlan: (token: string, matchId: string) =>
    request<ActionPlanResponse>('/api/v1/action-plans', token, {
      method: 'POST',
      body: JSON.stringify({ match_id: matchId }),
    }),
  readLatestActionPlan: (token: string) =>
    request<ActionPlanResponse>('/api/v1/action-plans/latest', token),
  queryAssistant: (token: string, consultationType: 'career' | 'policy', question: string) =>
    request<AssistantResponse>('/api/v1/assistant/query', token, {
      method: 'POST',
      body: JSON.stringify({ consultation_type: consultationType, question }),
    }),
  readCounselorStudents: (token: string) =>
    request<CounselorStudentResponse[]>('/api/v1/staff/counselor/students', token),
  createTeacherAdvice: (token: string, studentId: string, actionPlanId: string, content: string) =>
    request<{ id: string; student_id: string; action_plan_id: string; content: string; created_at: string }>(
      '/api/v1/staff/counselor/advice',
      token,
      { method: 'POST', body: JSON.stringify({ student_id: studentId, action_plan_id: actionPlanId, content }) }
    ),
  readAdminOverview: (token: string) => request<AdminOverviewResponse>('/api/v1/staff/admin/overview', token),
  grantCounselorAccess: (token: string, counselorId: string, studentId: string) =>
    request<{ status: string }>('/api/v1/staff/admin/counselor-access', token, {
      method: 'POST',
      body: JSON.stringify({ counselor_id: counselorId, student_id: studentId }),
    }),
  readCounselorRisks: (token: string) => request<RiskItem[]>('/api/v1/governance/counselor/risks', token),
  readAdminInsights: (token: string, source: 'live' | 'synthetic', seed = 1, cohortSize = 300) =>
    request<InsightsResponse>(
      `/api/v1/governance/admin/insights?source=${source}&seed=${seed}&cohort_size=${cohortSize}`,
      token
    ),
  readSimulationDefaults: (token: string) =>
    request<SimulationDefaults>('/api/v1/governance/admin/simulations/defaults', token),
  createSimulation: (token: string, payload: SimulationCreatePayload) =>
    request<SimulationSummary>('/api/v1/governance/admin/simulations', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listSimulations: (token: string) =>
    request<SimulationSummary[]>('/api/v1/governance/admin/simulations', token),
  readSimulation: (token: string, runId: string) =>
    request<SimulationDetail>(`/api/v1/governance/admin/simulations/${runId}`, token),
  generateReport: (token: string, runId: string) =>
    request<StrategyReport>(`/api/v1/governance/admin/simulations/${runId}/report`, token, {
      method: 'POST',
    }),
  adoptSimulation: (token: string, runId: string, scenario: string) =>
    request<{ status: string; scenario: string }>(
      `/api/v1/governance/admin/simulations/${runId}/adopt`,
      token,
      { method: 'POST', body: JSON.stringify({ scenario }) }
    ),
}
