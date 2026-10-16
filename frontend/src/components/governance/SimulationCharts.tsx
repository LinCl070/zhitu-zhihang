import { ScenarioDetail } from '../../api/client'
import { METRIC_OPTIONS, MetricKey, scenarioColor, scenarioLabel } from './labels'

export function SimulationCharts({
  scenarios,
  metric,
}: {
  scenarios: Record<string, ScenarioDetail>
  metric: MetricKey
}) {
  const entries = Object.values(scenarios)
  if (entries.length === 0 || entries[0].weeks.length === 0) {
    return <div className="empty">暂无仿真数据。</div>
  }

  const width = 640
  const height = 320
  const padding = { top: 20, right: 20, bottom: 40, left: 56 }

  const weeks = entries[0].weeks.map((point) => point.week)
  const allValues = entries.flatMap((entry) => entry.weeks.map((point) => point[metric]))
  const maxValue = Math.max(1, ...allValues)
  const minValue = Math.min(0, ...allValues)
  const range = maxValue - minValue || 1

  const x = (week: number) =>
    padding.left + (week / Math.max(1, weeks.length - 1)) * (width - padding.left - padding.right)
  const y = (value: number) =>
    padding.top + (1 - (value - minValue) / range) * (height - padding.top - padding.bottom)

  const isPercent = metric === 'readiness_rate' || metric === 'matched_rate' || metric === 'counselor_utilization'

  const pathFor = (entry: ScenarioDetail) =>
    entry.weeks
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.week).toFixed(1)} ${y(point[metric]).toFixed(1)}`)
      .join(' ')

  const yTicks = Array.from({ length: 5 }, (_, index) => minValue + (range * index) / 4)

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`各场景 ${METRIC_OPTIONS.find((m) => m.key === metric)?.label} 逐周折线图`}
        className="sim-chart"
      >
        <title>各场景{METRIC_OPTIONS.find((m) => m.key === metric)?.label}逐周变化</title>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e2e8e0"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="#66756f">
              {formatTick(tick, isPercent)}
            </text>
          </g>
        ))}
        {weeks.map((week) => (
          <text key={week} x={x(week)} y={height - 16} textAnchor="middle" fontSize={10} fill="#66756f">
            {week}
          </text>
        ))}
        {entries.map((entry) => (
          <path
            key={entry.scenario}
            d={pathFor(entry)}
            fill="none"
            stroke={scenarioColor(entry.scenario)}
            strokeWidth={2}
          />
        ))}
        {entries.map((entry) =>
          entry.weeks.map((point) => (
            <circle
              key={`${entry.scenario}-${point.week}`}
              cx={x(point.week)}
              cy={y(point[metric])}
              r={3}
              fill={scenarioColor(entry.scenario)}
            />
          ))
        )}
      </svg>
      <div className="chart-legend">
        {entries.map((entry) => (
          <span key={entry.scenario} className="legend-item">
            <span className="legend-swatch" style={{ background: scenarioColor(entry.scenario) }} />
            {scenarioLabel(entry.scenario)}
          </span>
        ))}
      </div>
    </div>
  )
}

export function SkillGapChart({ scenario }: { scenario: ScenarioDetail }) {
  const gaps = scenario.top_skill_gaps
  if (!gaps || gaps.length === 0) {
    return <div className="empty">暂无技能缺口数据。</div>
  }

  const maxDemand = Math.max(1, ...gaps.map((gap) => gap.demand))
  const barHeight = 20
  const labelWidth = 140
  const chartWidth = 460

  return (
    <div className="skill-gap-chart">
      <svg
        viewBox={`0 0 ${labelWidth + chartWidth + 40} ${gaps.length * (barHeight + 10) + 20}`}
        role="img"
        aria-label="Top 技能供需缺口条形图"
        className="skill-gap-svg"
      >
        <title>Top 技能供需缺口</title>
        {gaps.map((gap, index) => {
          const yPos = index * (barHeight + 10)
          const barWidth = (gap.demand / maxDemand) * chartWidth
          return (
            <g key={gap.skill}>
              <text x={0} y={yPos + barHeight - 6} fontSize={12} fill="#18332d">
                {gap.skill}
              </text>
              <rect x={labelWidth} y={yPos} width={barWidth} height={barHeight} rx={4} fill="#0b6956" />
              <text x={labelWidth + barWidth + 8} y={yPos + barHeight - 6} fontSize={11} fill="#66756f">
                {gap.demand}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function formatTick(value: number, isPercent: boolean): string {
  if (isPercent) return `${Math.round(value * 100)}%`
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1)
}
