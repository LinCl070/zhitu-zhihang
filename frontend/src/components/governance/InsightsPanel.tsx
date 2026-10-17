import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Database, Search, Users } from 'lucide-react'
import { api, ApiError, InsightsResponse } from '../../api/client'
import { useToast } from '../Toast'

const STAGE_LABEL: Record<string, string> = {
  exploring: '探索期',
  preparing: '准备期',
  applying: '投递期',
}

export function InsightsPanel({ token }: { token: string }) {
  const { showToast } = useToast()
  const [source, setSource] = useState<'live' | 'synthetic'>('live')
  const [seed, setSeed] = useState<number | ''>(1)
  const [cohortSize, setCohortSize] = useState<number | ''>(300)
  const [applied, setApplied] = useState<{ seed: number; cohortSize: number; source: 'live' | 'synthetic' }>({
    seed: 1,
    cohortSize: 300,
    source: 'live',
  })
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Each request only applies its result if it is still the latest one, so a slow
  // live response cannot overwrite the synthetic view after the user switches source.
  const load = useCallback(async (isCurrent: () => boolean) => {
    setLoading(true)
    try {
      const payload = await api.readAdminInsights(
        token,
        applied.source,
        applied.seed,
        applied.cohortSize
      )
      if (isCurrent()) setInsights(payload)
    } catch (error) {
      if (isCurrent()) showToast('读取群体画像失败', getErrorMessage(error), 'warning')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [token, applied, showToast])

  useEffect(() => {
    let current = true
    void load(() => current)
    return () => {
      current = false
    }
  }, [load])

  const applySource = (next: 'live' | 'synthetic') => {
    setSource(next)
    setApplied((current) => ({ ...current, source: next }))
  }

  const applyParams = () => {
    if (seed === '' || cohortSize === '') {
      showToast('参数不完整', '种子和规模不能为空。', 'warning')
      return
    }
    setApplied({ source, seed, cohortSize })
  }

  const total = insights?.total_count ?? 0

  return (
    <section data-panel="insights" className="insights-panel">
      <div className="page-head">
        <div>
          <h1>群体画像</h1>
          <p className="desc">按专业与求职阶段聚合的就业准备度分布，不含个人记录。</p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={`seg-btn ${source === 'live' ? 'is-active' : ''}`}
            onClick={() => applySource('live')}
          >
            <Users size={14} />
            真实账号
          </button>
          <button
            type="button"
            className={`seg-btn ${source === 'synthetic' ? 'is-active' : ''}`}
            onClick={() => applySource('synthetic')}
          >
            <Database size={14} />
            仿真合成
          </button>
        </div>
      </div>

      {source === 'synthetic' && (
        <div className="alert alert-info" style={{ marginTop: '14px' }}>
          <BarChart3 size={18} />
          <div className="alert-body">
            <strong>合成数据。</strong>
            以下统计来自仿真合成群体，与真实账号无关。
          </div>
        </div>
      )}

      {insights?.synthetic && source === 'synthetic' && (
        <div className="synthetic-badge">合成数据</div>
      )}

      <div className="insights-meta">
        <span>数据源：{source === 'live' ? '真实账号' : '仿真合成'}</span>
        <span>覆盖人数：{total}</span>
        {source === 'synthetic' && (
          <span className="field-inline">
            种子
            <input
              type="number"
              value={seed}
              min={1}
              max={1000000}
              onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={applyParams}
              style={{ width: '90px' }}
            />
            规模
            <input
              type="number"
              value={cohortSize}
              min={50}
              max={1000}
              onChange={(e) => setCohortSize(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={applyParams}
              style={{ width: '90px' }}
            />
            <button type="button" className="btn btn-ghost" onClick={applyParams}>
              <Search size={14} />
              查询
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="empty">
          <strong>正在聚合画像…</strong>
          <div>请稍候，系统正在按专业与阶段聚合。</div>
        </div>
      ) : !insights || insights.groups.length === 0 ? (
        <div className="empty">
          <strong>暂无可用分组</strong>
          <div>分组人数少于 5 时会合并或隐藏，以保护个体隐私。</div>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginTop: '14px' }}>
          <table>
            <thead>
              <tr>
                <th>专业</th>
                <th>阶段</th>
                <th>人数</th>
                <th>准备度均值</th>
                <th>高风险</th>
                <th>中风险</th>
                <th>低风险</th>
              </tr>
            </thead>
            <tbody>
              {insights.groups.map((group, index) => (
                <tr key={`${group.major}-${group.stage}-${index}`}>
                  <td>{group.major}</td>
                  <td>{STAGE_LABEL[group.stage] || group.stage}</td>
                  <td>{group.count}</td>
                  <td>{group.readiness_mean}</td>
                  <td>{group.risk_distribution.high ?? 0}</td>
                  <td>{group.risk_distribution.medium ?? 0}</td>
                  <td>{group.risk_distribution.low ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="insights-note">
        <strong>小样本抑制说明：</strong>
        任一分组人数少于 5 时，将归入「其他（小样本已合并）」；合并后仍不足 5 的分组不输出，
        确保不返回任何个人记录。
      </div>
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '服务暂时不可用，请确认后端与数据库已启动后重试。'
}
