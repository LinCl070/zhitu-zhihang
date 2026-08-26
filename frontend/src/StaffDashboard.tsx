import { useState } from 'react'
import {
  CounselorStudent,
  INITIAL_ADMIN_AUDIT,
  INITIAL_ADMIN_JOBS,
  INITIAL_ADMIN_KNOWLEDGE,
  INITIAL_TEACHER_STUDENTS,
} from './api/client'
import { useToast } from './components/Toast'
import { brand } from './config/brand'

export type TeacherNav = 'students' | 'summary' | 'advice'
export type AdminNav = 'access' | 'jobs' | 'knowledge' | 'audit'

export function StaffDashboard({
  role,
  onSwitch,
}: {
  token: string
  name: string
  role: 'teacher' | 'admin'
  onSwitch: () => void
}) {
  if (role === 'teacher') {
    return <TeacherWorkbench onSwitch={onSwitch} />
  }
  return <AdminWorkbench onSwitch={onSwitch} />
}

function TeacherWorkbench({ onSwitch }: { onSwitch: () => void }) {
  const { showToast } = useToast()
  const [nav, setNav] = useState<TeacherNav>('students')
  const [students, setStudents] = useState<CounselorStudent[]>(INITIAL_TEACHER_STUDENTS)
  const [selectedId, setSelectedId] = useState('s1')
  const [adviceText, setAdviceText] = useState('')

  const selectedStudent = students.find((s) => s.id === selectedId) || students[0]

  const handleSubmitAdvice = () => {
    if (!adviceText.trim()) {
      showToast('请填写意见', '指导意见不能为空。', 'warning')
      return
    }

    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`

    const newHistoryItem = {
      id: `a${Date.now()}`,
      at: stamp,
      text: adviceText.trim(),
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.id === selectedStudent.id
          ? {
              ...s,
              adviceCount: s.adviceCount + 1,
              history: [newHistoryItem, ...s.history],
            }
          : s
      )
    )

    setAdviceText('')
    showToast('意见已提交', '已写入审计事件（演示）。', 'success')
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
            <b>陈老师</b> · 就业指导
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
                    {students.map((s) => {
                      const isActive = s.id === selectedStudent.id
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
                    <dd>3 名（本演示数据）</dd>
                    <dt>可见字段</dt>
                    <dd>专业、目标、阶段、计划数、意见数</dd>
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
                  <p className="desc">授权可见字段：专业、目标、阶段、计划数、意见数。</p>
                </div>
              </div>
              <div className="panel" id="teacher-summary-panel">
                <h3 className="panel-title">{selectedStudent.name} · 摘要</h3>
                <dl className="kv">
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
              <div className="grid-2">
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
                    >
                      提交指导意见
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
              </div>
            </section>
          )}
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
      </nav>
    </div>
  )
}

function AdminWorkbench({ onSwitch }: { onSwitch: () => void }) {
  const { showToast } = useToast()
  const [nav, setNav] = useState<AdminNav>('access')

  const statusTagClass = (status: string) => {
    if (status === '已发布' || status === '可用' || status === '成功' || status === '已记录' || status === '已脱敏') return 'tag-success'
    if (status === '待审核' || status === '维护中' || status === '待处理') return 'tag-warning'
    if (status === '已过期') return 'tag-danger'
    return 'tag-neutral'
  }

  const handleSaveGrant = () => {
    showToast('授权已保存', '教师-学生范围已更新，并写入脱敏审计。', 'success')
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
            <b>就业管理员</b>
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
                <div className="stat-card"><div className="k">授权关系</div><div className="v">12</div><div className="s">教师-学生</div></div>
                <div className="stat-card"><div className="k">在岗教师</div><div className="v">4</div><div className="s">本学期</div></div>
                <div className="stat-card"><div className="k">覆盖学生</div><div className="v">36</div><div className="s">授权有效</div></div>
                <div className="stat-card"><div className="k">待处理</div><div className="v">2</div><div className="s">范围变更</div></div>
              </div>
              <div className="grant-box">
                <div className="panel">
                  <h3 className="panel-title">选择教师</h3>
                  <div className="field">
                    <label>教师</label>
                    <select id="admin-teacher"><option>陈老师 · 就业指导</option><option>刘老师 · 生涯咨询</option></select>
                  </div>
                  <div className="field" style={{ marginTop: '10px' }}>
                    <label>授权范围</label>
                    <select><option>软件工程 2023 级 1-2 班</option><option>数据科学 2022 级</option></select>
                  </div>
                  <div className="textarea-actions">
                    <button type="button" className="btn btn-primary" id="btn-save-grant" onClick={handleSaveGrant}>
                      保存授权
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
                        <tr><td>陈老师</td><td>软工 2023 · 授权学生 18</td><td><span className="tag tag-success">有效</span></td></tr>
                        <tr><td>刘老师</td><td>数据 2022 · 授权学生 12</td><td><span className="tag tag-success">有效</span></td></tr>
                        <tr><td>周老师</td><td>网络 2023 · 待确认</td><td><span className="tag tag-warning">待处理</span></td></tr>
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
                    {INITIAL_ADMIN_JOBS.map((r, i) => (
                      <tr key={i}>
                        <td>{r.title}</td>
                        <td>{r.org}</td>
                        <td>{r.visibility}</td>
                        <td><span className={`tag ${statusTagClass(r.status)}`}>{r.status}</span></td>
                        <td>{r.expire}</td>
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
                    {INITIAL_ADMIN_KNOWLEDGE.map((r, i) => (
                      <tr key={i}>
                        <td>{r.title}</td>
                        <td>{r.type}</td>
                        <td>{r.updated}</td>
                        <td><span className={`tag ${statusTagClass(r.status)}`}>{r.status}</span></td>
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
                    {INITIAL_ADMIN_AUDIT.map((r, i) => (
                      <tr key={i}>
                        <td>{r.time}</td>
                        <td>{r.actor}</td>
                        <td>{r.action}</td>
                        <td>{r.scope}</td>
                        <td><span className={`tag ${statusTagClass(r.result)}`}>{r.result}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
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
