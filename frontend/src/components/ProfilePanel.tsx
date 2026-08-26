import { FormEvent } from 'react'
import { JobStage } from '../api/client'
import { ProfileForm } from '../types/career'

interface ProfilePanelProps {
  form: ProfileForm
  setForm: (val: ProfileForm | ((prev: ProfileForm) => ProfileForm)) => void
  saved: boolean
  loading: boolean
  onSave: (e: FormEvent) => void
  onReset: () => void
}

export function ProfilePanel({
  form,
  setForm,
  saved,
  loading,
  onSave,
  onReset,
}: ProfilePanelProps) {
  const update = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <section data-panel="profile">
      <div className="page-head">
        <div>
          <h1>职业画像</h1>
          <p className="desc">填写基础求职信息。保存后用于岗位匹配，字段在演示中已脱敏。</p>
        </div>
        <div className="page-actions">
          <span className={`tag ${saved ? 'tag-success' : 'tag-warning'}`} id="profile-saved-tag">
            {saved ? '已保存' : '未保存'}
          </span>
        </div>
      </div>

      <div className="status-strip">
        <div className="stat-card">
          <div className="k">当前阶段</div>
          <div className="v" id="stat-stage">{form.jobStage === 'exploring' ? '探索方向' : form.jobStage === 'applying' ? '投递中' : '准备求职'}</div>
          <div className="s">学生任务起点</div>
        </div>
        <div className="stat-card">
          <div className="k">目标岗位</div>
          <div className="v" id="stat-role" style={{ fontSize: '15px' }}>{form.targetRoles || '后端开发实习生'}</div>
          <div className="s">用于匹配加权</div>
        </div>
        <div className="stat-card">
          <div className="k">目标城市</div>
          <div className="v" id="stat-city">{form.targetCities || '成都'}</div>
          <div className="s">本地岗位加分</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <div className="form-group">
            <h3>基础信息</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-major">专业</label>
                <input
                  id="f-major"
                  value={form.major}
                  onChange={(e) => update('major', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="f-stage">求职阶段</label>
                <select
                  id="f-stage"
                  value={form.jobStage}
                  onChange={(e) => update('jobStage', e.target.value as JobStage)}
                >
                  <option value="preparing">准备求职</option>
                  <option value="applying">投递中</option>
                  <option value="exploring">探索方向</option>
                </select>
              </div>
              <div className="field span-2">
                <label htmlFor="f-skills">技能标签</label>
                <input
                  id="f-skills"
                  value={form.skills}
                  onChange={(e) => update('skills', e.target.value)}
                />
                <div className="hint">逗号分隔，用于技能维度计分</div>
              </div>
              <div className="field span-2">
                <label htmlFor="f-project">项目摘要（脱敏）</label>
                <textarea
                  id="f-project"
                  rows={3}
                  value={form.projects}
                  onChange={(e) => update('projects', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <h3>求职意向</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-target">目标岗位</label>
                <input
                  id="f-target"
                  value={form.targetRoles}
                  onChange={(e) => update('targetRoles', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="f-city">目标城市</label>
                <input
                  id="f-city"
                  value={form.targetCities}
                  onChange={(e) => update('targetCities', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="sticky-actions">
            <button
              type="button"
              className="btn btn-secondary"
              id="btn-reset-profile"
              onClick={onReset}
            >
              重置示例
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="btn-save-profile"
              onClick={onSave}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> 保存中...
                </>
              ) : (
                '保存画像并查看推荐'
              )}
            </button>
          </div>
        </div>

        <div className="panel">
          <h3 className="panel-title">字段用途与可见范围</h3>
          <div className="alert alert-info">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
            <div className="alert-body">
              <div className="alert-title">保存后会发生什么</div>
              技能标签与目标岗位会立即重算匹配分，并进入岗位推荐；已生成的行动计划不会被覆盖。
            </div>
          </div>
          <dl className="kv" style={{ marginTop: '14px' }}>
            <dt>可见范围</dt>
            <dd>本人画像字段</dd>
            <dt>不可见</dt>
            <dd>密钥、教师意见草稿、其他学生数据</dd>
            <dt>下游用途</dt>
            <dd>匹配分、缺口、行动计划</dd>
          </dl>
        </div>
      </div>
    </section>
  )
}
