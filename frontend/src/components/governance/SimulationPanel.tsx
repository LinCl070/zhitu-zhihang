import { useCallback, useEffect, useState } from 'react'
import { Play, RefreshCw, Download } from 'lucide-react'
import {
  api,
  ApiError,
  SimulationDefaults,
  SimulationDetail,
  SimulationSummary,
  StrategyReport,
} from '../../api/client'
import { useToast } from '../Toast'
import { METRIC_OPTIONS, MetricKey, scenarioLabel } from './labels'
import { SimulationCharts, SkillGapChart } from './SimulationCharts'
import { StrategyReportView } from './StrategyReport'

const SCENARIO_OPTIONS = [
  { key: 'baseline', label: '现状基线', required: true },
  { key: 'skill_training', label: '技能补强培训' },
  { key: 'precision_coaching', label: '精准帮扶' },
  { key: 'job_push', label: '岗位精准推送' },
  { key: 'combined', label: '组合策略' },
]

export function SimulationPanel({ token }: { token: string }) {
  const { showToast } = useToast()
  const [defaults, setDefaults] = useState<SimulationDefaults | null>(null)
  const [cohortSize, setCohortSize] = useState(300)
  const [weeks, setWeeks] = useState(16)
  const [replications, setReplications] = useState(10)
  const [seed, setSeed] = useState(1)
  const [supplyRatio, setSupplyRatio] = useState(0.8)
  const [counselorCount, setCounselorCount] = useState(4)
  const [scenarios, setScenarios] = useState<string[]>(['baseline', 'precision_coaching'])

  const [history, setHistory] = useState<SimulationSummary[]>([])
  const [currentRun, setCurrentRun] = useState<SimulationDetail | null>(null)
  const [report, setReport] = useState<StrategyReport | null>(null)
  const [metric, setMetric] = useState<MetricKey>('matched_rate')
  const [running, setRunning] = useState(false)
  const [adopting, setAdopting] = useState(false)

  const loadDefaults = useCallback(async () => {
    try {
      const payload = await api.readSimulationDefaults(token)
      setDefaults(payload)
      setCohortSize(payload.cohort_size.default)
      setWeeks(payload.weeks.default)
      setReplications(payload.replications.default)
    } catch (error) {
      showToast('读取仿真参数失败', getErrorMessage(error), 'warning')
    }
  }, [token, showToast])

  const loadHistory = useCallback(async () => {
    try {
      const items = await api.listSimulations(token)
      setHistory(items)
    } catch (error) {
      showToast('读取历史仿真失败', getErrorMessage(error), 'warning')
    }
  }, [token, showToast])

  useEffect(() => {
    void loadDefaults()
    void loadHistory()
  }, [loadDefaults, loadHistory])

  const toggleScenario = (key: string) => {
    setScenarios((current) => {
      if (key === 'baseline') return current
      return current.includes(key) ? current.filter((s) => s !== key) : [...current, key]
    })
  }

  const handleRun = async () => {
    if (scenarios.length === 0 || !scenarios.includes('baseline')) {
      showToast('请选择场景', '至少包含现状基线。', 'warning')
      return
    }
    setRunning(true)
    setReport(null)
    try {
      const summary = await api.createSimulation(token, {
        cohort_size: cohortSize,
        weeks,
        replications,
        seed,
        counselor_count: counselorCount,
        sessions_per_week: 8,
        supply_ratio: supplyRatio,
        scenarios,
      })
      const detail = await api.readSimulation(token, summary.id)
      setCurrentRun(detail)
      await loadHistory()
      showToast('仿真完成', '已生成多场景对比结果。', 'success')
    } catch (error) {
      showToast('仿真失败', getErrorMessage(error), 'warning')
    } finally {
      setRunning(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!currentRun) return
    try {
      const payload = await api.generateReport(token, currentRun.id)
      setReport(payload)
      showToast('报告已生成', '策略对比报告已就绪。', 'success')
    } catch (error) {
      showToast('报告生成失败', getErrorMessage(error), 'warning')
    }
  }

  const handleAdopt = async (scenario: string) => {
    if (!currentRun) return
    setAdopting(true)
    try {
      await api.adoptSimulation(token, currentRun.id, scenario)
      await loadHistory()
      showToast('策略已采纳', '已写入脱敏审计，不触发任何自动操作。', 'success')
    } catch (error) {
      showToast('采纳失败', getErrorMessage(error), 'warning')
    } finally {
      setAdopting(false)
    }
  }

  const handleOpenHistory = async (id: string) => {
    try {
      const detail = await api.readSimulation(token, id)
      setCurrentRun(detail)
      setReport(null)
    } catch (error) {
      showToast('读取仿真详情失败', getErrorMessage(error), 'warning')
    }
  }

  const scenariosDetail = currentRun?.results.scenarios || {}

  return (
    <section data-panel="simulation" className="simulation-panel">
      <div className="page-head">
        <div>
          <h1>策略仿真</h1>
          <p className="desc">基于多智能体模型对比不同治理策略对就业准备的影响。</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3 className="panel-title">仿真参数</h3>
          <div className="sim-form">
            <div className="field">
              <label>群体规模</label>
              <input type="number" value={cohortSize} min={50} max={1000} onChange={(e) => setCohortSize(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>仿真周数</label>
              <input type="number" value={weeks} min={4} max={26} onChange={(e) => setWeeks(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>重复次数</label>
              <input type="number" value={replications} min={1} max={20} onChange={(e) => setReplications(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>随机种子</label>
              <input type="number" value={seed} min={1} max={1000000} onChange={(e) => setSeed(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>岗位供给比例</label>
              <input type="number" step="0.1" value={supplyRatio} min={0} max={2} onChange={(e) => setSupplyRatio(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>教师数量</label>
              <input type="number" value={counselorCount} min={0} max={100} onChange={(e) => setCounselorCount(Number(e.target.value))} />
            </div>
          </div>

          <div className="scenario-picker">
            <label className="col-label">治理策略（可多选，基线必选）</label>
            {SCENARIO_OPTIONS.map((option) => (
              <label key={option.key} className="scenario-check">
                <input
                  type="checkbox"
                  checked={scenarios.includes(option.key)}
                  disabled={option.required}
                  onChange={() => toggleScenario(option.key)}
                />
                <span>{option.label}{option.required ? '（必选）' : ''}</span>
              </label>
            ))}
          </div>

          <div className="textarea-actions">
            <button type="button" className="btn btn-primary" onClick={handleRun} disabled={running}>
              {running ? <><RefreshCw size={14} className="spin" /> 正在运行…</> : <><Play size={14} /> 运行仿真</>}
            </button>
          </div>
          {defaults && (
            <p className="sim-hint">
              默认参数：{defaults.cohort_size.default} 人 × {defaults.weeks.default} 周，重复 {defaults.replications.default} 次。
            </p>
          )}
        </div>

        <div className="panel">
          <h3 className="panel-title">历史仿真</h3>
          {history.length === 0 ? (
            <div className="empty"><strong>暂无仿真记录</strong><div>运行一次仿真后会显示在此。</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>时间</th><th>规模</th><th>场景</th><th>采纳</th><th>操作</th></tr></thead>
                <tbody>
                  {history.map((run) => (
                    <tr key={run.id}>
                      <td>{formatDateTime(run.created_at)}</td>
                      <td>{run.cohort_size}</td>
                      <td>{run.scenarios.map(scenarioLabel).join('、')}</td>
                      <td>{run.adopted_scenario ? scenarioLabel(run.adopted_scenario) : '—'}</td>
                      <td><button type="button" className="btn btn-ghost" onClick={() => handleOpenHistory(run.id)}>查看</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {currentRun && (
        <>
          <div className="panel" style={{ marginTop: '14px' }}>
            <div className="chart-head">
              <h3 className="panel-title">逐周指标对比</h3>
              <div className="metric-switch">
                {METRIC_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`metric-btn ${metric === option.key ? 'is-active' : ''}`}
                    onClick={() => setMetric(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <SimulationCharts scenarios={scenariosDetail} metric={metric} />
          </div>

          <div className="panel" style={{ marginTop: '14px' }}>
            <h3 className="panel-title">终点指标对比（含 95% 置信区间）</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>场景</th>
                    <th>准备达标率</th>
                    <th>匹配达成率</th>
                    <th>高风险人数</th>
                    <th>平均技能缺口</th>
                    <th>采纳</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(scenariosDetail).map((scenario) => (
                    <tr key={scenario.scenario}>
                      <td>{scenarioLabel(scenario.scenario)}</td>
                      <td>{formatPct(scenario.summary.readiness_rate)}</td>
                      <td>{formatPct(scenario.summary.matched_rate)}</td>
                      <td>{Math.round(scenario.summary.high_risk_count.mean)}</td>
                      <td>{scenario.summary.avg_gap.mean.toFixed(1)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={adopting}
                          onClick={() => handleAdopt(scenario.scenario)}
                        >
                          采纳
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ marginTop: '14px' }}>
            <h3 className="panel-title">Top 技能供需缺口</h3>
            {Object.values(scenariosDetail).map((scenario) => (
              <div key={scenario.scenario} className="skill-gap-block">
                <div className="col-label">{scenarioLabel(scenario.scenario)}</div>
                <SkillGapChart scenario={scenario} />
              </div>
            ))}
          </div>

          <div className="textarea-actions" style={{ marginTop: '14px' }}>
            <button type="button" className="btn btn-primary" onClick={handleGenerateReport}>
              <Download size={14} />
              生成策略报告
            </button>
          </div>
        </>
      )}

      {report && (
        <div className="report-section" style={{ marginTop: '14px' }}>
          <StrategyReportView report={report} />
        </div>
      )}
    </section>
  )
}

function formatPct(stats: { mean: number; ci_low: number; ci_high: number }): string {
  return `${(stats.mean * 100).toFixed(1)}% (${(stats.ci_low * 100).toFixed(1)}–${(stats.ci_high * 100).toFixed(1)})`
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace(/\+00:00$/, '').slice(0, 16)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message
  return '服务暂时不可用，请确认后端与数据库已启动后重试。'
}
