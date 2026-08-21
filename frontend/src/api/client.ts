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
  source: {
    title: string
    url: string | null
    published_on: string
    valid_until: string
    demo_only: boolean
  }
}

export type ActionPlan = {
  id: string
  match_id: string
  status: string
  items: Array<{ phase: string; priority: string; task: string }>
}

export type CounselorStudent = {
  student_id: string
  display_name: string
  major: string
  target_roles: string[]
  target_cities: string[]
  job_stage: string
  plans: Array<{ id: string; status: string; created_at: string }>
  advice: Array<{ id: string; action_plan_id: string; content: string; created_at: string }>
}

export type AdminOverview = {
  jobs: Array<{ id: string; title: string; city: string; published_on: string; valid_until: string; status: string; source_title: string; demo_only: boolean }>
  sources: Array<{ asset_id: string; title: string; status: string; published_on: string; effective_until: string; applicable_scope: string }>
  audits: Array<{ id: string; actor_role: string | null; action: string; resource_type: string; resource_id: string | null; created_at: string }>
  students: Array<{ id: string; display_name: string; role: string }>
  counselors: Array<{ id: string; display_name: string; role: string }>
}

export type AssistantResponse = {
  answer: string
  sources: Array<{ title: string; url: string | null; version_or_date: string | null }>
  disclaimer: string
  handoff_recommended: boolean
  mode: string
}

export type DemoSession = {
  access_token: string
  display_name: string
  role: string
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new ApiError(response.status, body?.detail ?? '请求暂时无法完成')
  }
  return response.json() as Promise<T>
}

export const api = {
  startDemo: (identity: 'student-a' | 'student-b' | 'counselor' | 'admin') =>
    request<DemoSession>('/api/v1/demo/sessions', undefined, {
      method: 'POST',
      body: JSON.stringify({ identity }),
    }),
  getProfile: (token: string) => request<CareerProfile>('/api/v1/career-profile/me', token),
  saveProfile: (token: string, profile: Omit<CareerProfile, 'id' | 'student_id'>) =>
    request<CareerProfile>('/api/v1/career-profile/me', token, {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
  generateMatches: (token: string) =>
    request<{ matches: Match[]; handoff_recommended: boolean; message?: string }>('/api/v1/matches', token, {
      method: 'POST',
      body: JSON.stringify({ limit: 10 }),
    }),
  createPlan: (token: string, matchId: string) =>
    request<ActionPlan>('/api/v1/action-plans', token, {
      method: 'POST',
      body: JSON.stringify({ match_id: matchId }),
    }),
  ask: (token: string, question: string) =>
    request<AssistantResponse>('/api/v1/assistant/query', token, {
      method: 'POST',
      body: JSON.stringify({ consultation_type: 'career', question }),
    }),
  getCounselorStudents: (token: string) =>
    request<CounselorStudent[]>('/api/v1/staff/counselor/students', token),
  createAdvice: (token: string, payload: { student_id: string; action_plan_id: string; content: string }) =>
    request<{ id: string }>('/api/v1/staff/counselor/advice', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAdminOverview: (token: string) => request<AdminOverview>('/api/v1/staff/admin/overview', token),
  grantCounselorAccess: (token: string, counselorId: string, studentId: string) =>
    request<{ status: string }>('/api/v1/staff/admin/counselor-access', token, {
      method: 'POST',
      body: JSON.stringify({ counselor_id: counselorId, student_id: studentId }),
    }),
}

export { ApiError }
