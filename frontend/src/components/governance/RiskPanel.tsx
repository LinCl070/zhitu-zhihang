import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageSquareText, ShieldAlert } from 'lucide-react'
import { api, ApiError, RiskItem } from '../../api/client'
import { useToast } from '../Toast'

const LEVEL_LABEL: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
}

const FACTOR_LABEL: Record<string, string> = {
  profile: '画像完整度',
  match: '岗位匹配',
  gap: '技能缺口',
  stage: '求职阶段',
  plan: '行动计划',
  stale: '画像更新',
}

// Maximum score per factor (architecture section 2); bars scale to their own max.
const FACTOR_MAX: Record<string, number> = {
  profile: 25,
  match: 25,
  gap: 15,
  stage: 20,
  plan: 10,
  stale: 5,
}

export function RiskPanel({
  token,
  onAdvise,
}: {
  token: string
  onAdvise?: (studentId: string) => void
}) {
  const { showToast } = useToast()
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const items = await api.readCounselorRisks(token)
        if (!cancelled) setRisks(items)
      } catch (error) {
        if (!cancelled) showToast('读取风险清单失败', getErrorMessage(error), 'warning')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [showToast, token])

  const highCount = risks.filter((r) => r.level === 'high').length

  return (
    <section data-panel="risks" className="risk-panel">
      <div className="page-head">
        <div>
          <h1>风险预警</h1>
          <p className="desc">按就业准备风险排序的授权学生清单，供优先干预参考。</p>
        </div>
      </div>

      <div className="risk-summary">
        <div className="stat-card">
          <div className="k">授权学生</div>
          <div className="v">{risks.length}</div>
          <div className="s">已进入预警评估</div>
        </div>
        <div className="stat-card">
          <div className="k">高风险</div>
          <div className="v">{highCount}</div>
          <div className="s">建议优先面谈</div>
        </div>
      </div>

      <div className="alert alert-warning" style={{ marginTop: '14px' }}>
        <ShieldAlert size={18} />
        <div className="alert-body">
          <strong>仅用于辅助指导，不作为评价或处分依据。</strong>
          风险分由画像完整度、岗位匹配、技能缺口、求职阶段、行动计划与更新时间等可解释因子构成，
          不涉及性别、籍贯、健康等敏感属性。
        </div>
      </div>

      {loading ? (
        <div className="empty" style={{ marginTop: '16px' }}>
          <strong>正在评估风险…</strong>
          <div>请稍候，系统正在对授权学生计算就业准备风险。</div>
        </div>
      ) : risks.length === 0 ? (
        <div className="empty" style={{ marginTop: '16px' }}>
          <strong>暂无授权学生</strong>
          <div>请联系管理员配置教师-学生授权关系。</div>
        </div>
      ) : (
        <div className="risk-list">
          {risks.map((risk) => (
            <RiskCard key={risk.student_id} risk={risk} onAdvise={onAdvise} />
          ))}
        </div>
      )}
    </section>
  )
}

function RiskCard({
  risk,
  onAdvise,
}: {
  risk: RiskItem
  onAdvise?: (studentId: string) => void
}) {
  const levelClass = `risk-level risk-${risk.level}`
  const factorEntries = Object.entries(risk.factors).filter(([, value]) => value > 0)

  return (
    <div className="panel risk-card" data-risk-level={risk.level}>
      <div className="risk-card-head">
        <div>
          <h3 className="panel-title">{risk.display_name}</h3>
          <div className="risk-meta">
            <span>{risk.major}</span>
            <span className="risk-sep">·</span>
            <span>{risk.job_stage ? stageLabel(risk.job_stage) : '未设置阶段'}</span>
          </div>
        </div>
        <div className="risk-score">
          <span className={levelClass}>
            <span className="risk-level-dot" aria-hidden="true" />
            {LEVEL_LABEL[risk.level]}
          </span>
          <strong className="risk-score-num">{risk.score}</strong>
          <span className="risk-score-max">/100</span>
        </div>
      </div>

      {factorEntries.length > 0 && (
        <div className="factor-bars">
          {factorEntries.map(([key, value]) => (
            <div className="factor-row" key={key}>
              <span className="factor-label">{FACTOR_LABEL[key] || key}</span>
              <div className="factor-track" role="img" aria-label={`${FACTOR_LABEL[key] || key} 得分 ${value}`}>
                <div
                  className="factor-fill"
                  style={{
                    width: `${Math.min(100, (value / (FACTOR_MAX[key] || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span className="factor-value">{value}</span>
            </div>
          ))}
        </div>
      )}

      {risk.reasons.length > 0 && (
        <ul className="risk-reasons">
          {risk.reasons.map((reason, index) => (
            <li key={index}>
              <AlertTriangle size={14} className="risk-reason-icon" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      {risk.actions.length > 0 && (
        <div className="risk-actions">
          {risk.actions.map((action, index) => (
            <span className="risk-action-chip" key={index}>
              <CheckCircle2 size={14} />
              {action}
            </span>
          ))}
        </div>
      )}

      {onAdvise && (
        <div className="risk-advise">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onAdvise(risk.student_id)}
          >
            <MessageSquareText size={14} />
            去提交指导意见
          </button>
        </div>
      )}
    </div>
  )
}

function stageLabel(stage: string): string {
  return (
    {
      exploring: '探索期',
      preparing: '准备期',
      applying: '投递期',
    }[stage] || stage
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '服务暂时不可用，请确认后端与数据库已启动后重试。'
}
