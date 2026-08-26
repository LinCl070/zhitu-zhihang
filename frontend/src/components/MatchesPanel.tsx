import { useState } from 'react'
import { Match } from '../api/client'

interface MatchesPanelProps {
  matches: Match[]
  loading: boolean
  planLoadingId: string | null
  onGenerate: () => void
  onPlan: (match: Match) => void
}

const dimLabels: Record<string, string> = {
  skills: '技能',
  major: '专业',
  projects: '项目',
  city: '城市',
  target_role: '意向',
}

const dimMax: Record<string, number> = {
  skills: 45,
  major: 20,
  projects: 15,
  city: 10,
  target_role: 10,
}

export function MatchesPanel({
  matches,
  loading,
  planLoadingId,
  onGenerate,
  onPlan,
}: MatchesPanelProps) {
  const [openJobId, setOpenJobId] = useState<string | null>(null)

  const topScore = matches.reduce((max, j) => Math.max(max, j.score), 0)

  const toggleJob = (id: string) => {
    setOpenJobId((prev) => (prev === id ? null : id))
  }

  return (
    <section data-panel="jobs">
      <div className="page-head">
        <div>
          <h1>岗位推荐</h1>
          <p className="desc">基于画像生成未过期岗位列表。可展开匹配依据与分项得分。</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            id="btn-gen-jobs"
            onClick={onGenerate}
            disabled={loading}
          >
            {loading ? '生成中…' : '重新生成推荐'}
          </button>
        </div>
      </div>

      {loading && (
        <div id="jobs-loading" className="empty">
          <div className="spinner" />
          <strong>正在生成推荐…</strong>
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div id="jobs-empty" className="empty">
          <strong>暂无推荐结果</strong>
          <div>请先保存职业画像，或点击重新生成。</div>
          <button
            type="button"
            className="btn btn-primary"
            id="btn-gen-jobs-empty"
            onClick={onGenerate}
            style={{ marginTop: '12px' }}
          >
            生成推荐
          </button>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div id="job-list" className="job-list">
          {matches.map((job) => {
            const isOpen = openJobId === job.id
            const isTop = job.score === topScore
            const isPlanning = planLoadingId === `plan-${job.id}`
            const typeTag = job.source.demo_only ? 'tag-primary' : 'tag-info'

            return (
              <article
                key={job.id}
                className={`job-card ${isOpen ? 'is-open' : ''} ${isTop ? 'is-top' : ''}`}
                data-job-id={job.id}
              >
                <div className="job-main">
                  <div className="score-block">
                    <div className="num">{job.score}</div>
                    <div className="lbl">匹配</div>
                  </div>

                  <div className="job-meta">
                    <h3>{job.title}</h3>
                    <div className="sub">
                      <span>{job.company_name}</span>
                      <span className={`tag ${typeTag}`}>
                        {job.source.demo_only ? '模拟岗位' : '公开岗位'}
                      </span>
                    </div>
                  </div>

                  <div className="job-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-toggle-job"
                      onClick={() => toggleJob(job.id)}
                    >
                      {isOpen ? '收起依据' : '展开依据'}
                    </button>
                    <button
                      type="button"
                      className={`btn ${isTop ? 'btn-primary' : 'btn-secondary'} btn-make-plan`}
                      onClick={() => onPlan(job)}
                      disabled={isPlanning}
                    >
                      {isPlanning ? (
                        <>
                          <span className="spinner" /> 生成中
                        </>
                      ) : (
                        '生成行动计划'
                      )}
                    </button>
                  </div>
                </div>

                <div className="dims">
                  {Object.entries(job.score_breakdown).map(([k, val]) => {
                    const max = dimMax[k] || 10
                    const pct = Math.min(100, Math.round((val / max) * 100))
                    return (
                      <div key={k} className="dim">
                        <div className="n">{dimLabels[k] || k}</div>
                        <div className="s">{val}</div>
                        <div className="bar">
                          <i style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="job-gaps">
                  <span className="label">主要缺口</span>
                  {job.gaps.map((gap) => (
                    <span key={gap} className="tag tag-warning">
                      {gap}
                    </span>
                  ))}
                </div>

                {isOpen && (
                  <div className="job-expand">
                    <h4>匹配依据</h4>
                    <ol>
                      {job.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="job-source">
                  <span>{job.source.title}</span>
                  <span>发布 {job.source.published_on}</span>
                  <span>到期 {job.source.valid_until}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
