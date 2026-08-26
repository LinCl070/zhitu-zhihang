import { useState } from 'react'
import { brand } from '../config/brand'

interface WelcomeScreenProps {
  onEnterRole: (role: 'student' | 'teacher' | 'admin') => void
}

export function WelcomeScreen({ onEnterRole }: WelcomeScreenProps) {
  const [enteringRole, setEnteringRole] = useState<string | null>(null)

  const handleRoleClick = (role: 'student' | 'teacher' | 'admin') => {
    setEnteringRole(role)
    setTimeout(() => {
      onEnterRole(role)
      setEnteringRole(null)
    }, 200)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* Topbar inside Login */}
        <header className="login-topbar">
          <div className="login-brand">
            <div className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5" />
                <path d="M4 17c4-3 8-3 12 0V7c-4-3-8-3-12 0" />
                <path d="M16 19l4-2V5l-4 2" />
              </svg>
            </div>
            <div>
              <div className="login-brand-title">{brand.productName}</div>
              <div className="login-brand-sub">{brand.universityName} · 就业择业规划工作台</div>
            </div>
          </div>
          <div className="login-top-meta">
            <span className="meta-chip">演示数据 · 已脱敏</span>
          </div>
        </header>

        <div className="login-main">
          <div className="login-heading">
            <h1>选择角色进入工作台</h1>
            <p className="login-lead">学生、就业指导教师与就业管理员使用同一套账号体系，可见范围按角色授权。</p>
          </div>

          <div className="role-cards">
            {/* Student Card */}
            <button
              type="button"
              className="role-card"
              onClick={() => handleRoleClick('student')}
              disabled={Boolean(enteringRole)}
            >
              <span className="icon">
                <svg viewBox="0 0 24 24">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </span>
              <span className="role-kicker">STUDENT</span>
              <h2>学生</h2>
              <p>职业画像、岗位推荐、行动计划与就业咨询，按阶段推进择业任务。</p>
              <span className="enter">
                <span>{enteringRole === 'student' ? '进入中...' : '进入学生工作台'}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>

            {/* Teacher Card */}
            <button
              type="button"
              className="role-card"
              onClick={() => handleRoleClick('teacher')}
              disabled={Boolean(enteringRole)}
            >
              <span className="icon">
                <svg viewBox="0 0 24 24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="role-kicker">TEACHER</span>
              <h2>就业指导教师</h2>
              <p>仅查看授权学生摘要，提交指导意见并跟踪历史记录。</p>
              <span className="enter">
                <span>{enteringRole === 'teacher' ? '进入中...' : '进入教师工作台'}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>

            {/* Admin Card */}
            <button
              type="button"
              className="role-card"
              onClick={() => handleRoleClick('admin')}
              disabled={Boolean(enteringRole)}
            >
              <span className="icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                </svg>
              </span>
              <span className="role-kicker">ADMIN</span>
              <h2>就业管理员</h2>
              <p>配置授权范围，管理岗位与资料台账，查看脱敏审计事件。</p>
              <span className="enter">
                <span>{enteringRole === 'admin' ? '进入中...' : '进入管理工作台'}</span>
                <span aria-hidden="true">→</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="footer-note">
        {brand.universityName}就业指导中心 · 演示环境使用脱敏示例数据，不含真实学生信息
      </div>
    </div>
  )
}
