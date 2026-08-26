import { ActionPlan } from '../api/client'

interface PlansPanelProps {
  plan: ActionPlan
  onGoJobs: () => void
}

export function PlansPanel({ plan, onGoJobs }: PlansPanelProps) {
  return (
    <section data-panel="plan">
      <div className="page-head">
        <div>
          <h1>行动计划</h1>
          <p className="desc">将岗位缺口转为分阶段可执行任务，可回看教师意见数量。</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" id="btn-go-jobs" onClick={onGoJobs}>
            返回岗位
          </button>
        </div>
      </div>

      <div className="status-strip">
        <div className="stat-card">
          <div className="k">关联岗位</div>
          <div className="v" id="plan-job" style={{ fontSize: '14px' }}>
            {plan.job_title}
          </div>
          <div className="s">由岗位推荐生成</div>
        </div>
        <div className="stat-card">
          <div className="k">计划状态</div>
          <div className="v" id="plan-status">
            {plan.status === 'active' ? '进行中' : plan.status}
          </div>
          <div className="s" id="plan-created">
            创建于 {plan.created_at}
          </div>
        </div>
        <div className="stat-card">
          <div className="k">教师意见</div>
          <div className="v" id="plan-advice">
            {plan.advice_count}
          </div>
          <div className="s">条已读意见</div>
        </div>
      </div>

      <div id="plan-list" className="plan-list">
        {plan.items.map((p, idx) => {
          const pr = p.priority === '高' ? 'tag-warning' : 'tag-neutral'
          const st = p.status === '进行中' ? 'tag-primary' : 'tag-neutral'

          return (
            <div key={p.id || idx} className="plan-item">
              <div className="plan-idx">{idx + 1}</div>
              <div>
                <h3>{p.title}</h3>
                <p>{p.detail}</p>
              </div>
              <div className="plan-tags">
                <span className="tag tag-info">{p.phase}</span>
                <span className={`tag ${pr}`}>{p.priority}</span>
                <span className={`tag ${st}`}>{p.status}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
