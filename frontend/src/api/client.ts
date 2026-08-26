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

export type CounselorStudent = {
  id: string
  name: string
  major: string
  targetRole: string
  targetCity: string
  stage: string
  planCount: number
  adviceCount: number
  history: Array<{ id: string; at: string; text: string }>
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

export type DemoSession = {
  access_token: string
  display_name: string
  role: 'student' | 'teacher' | 'admin'
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

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
    if (response.ok) {
      return (await response.json()) as T
    }
  } catch {
    // Network or offline fallback
  }

  return handleFallback<T>(path, init)
}

function handleFallback<T>(path: string, init?: RequestInit): Promise<T> {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}

  if (path.includes('/demo/sessions')) {
    const identity = (body.identity as string) || 'student'
    if (identity === 'teacher' || identity === 'counselor') {
      return Promise.resolve({
        access_token: 'token-teacher',
        display_name: '陈老师',
        role: 'teacher',
      } as T)
    }
    if (identity === 'admin') {
      return Promise.resolve({
        access_token: 'token-admin',
        display_name: '就业管理员',
        role: 'admin',
      } as T)
    }
    return Promise.resolve({
      access_token: 'token-student',
      display_name: '王同学',
      role: 'student',
    } as T)
  }

  if (path.includes('/career-profile/me')) {
    return Promise.resolve({
      id: 'p1',
      student_id: 's1',
      major: '软件工程',
      skills: ['Java', 'Spring Boot', 'MySQL', 'Git'],
      projects: ['参与校园二手交易平台后端模块，负责订单状态机与接口鉴权（已脱敏）。'],
      target_roles: ['后端开发实习生'],
      target_cities: ['成都'],
      job_stage: 'preparing',
    } as T)
  }

  if (path.includes('/matches')) {
    return Promise.resolve({
      matches: INITIAL_JOBS,
      handoff_recommended: false,
      message: '推荐结果已生成',
    } as T)
  }

  return Promise.resolve({} as T)
}

export const api = {
  startDemo: (identity: 'student' | 'teacher' | 'admin' | 'student-a' | 'student-b' | 'counselor') => {
    let cleanRole: 'student' | 'teacher' | 'admin' = 'student'
    if (identity === 'teacher' || identity === 'counselor') cleanRole = 'teacher'
    else if (identity === 'admin') cleanRole = 'admin'
    return request<DemoSession>('/api/v1/demo/sessions', undefined, {
      method: 'POST',
      body: JSON.stringify({ identity: cleanRole }),
    })
  },
}

export { ApiError }
