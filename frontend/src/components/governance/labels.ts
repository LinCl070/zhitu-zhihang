export const METRIC_OPTIONS = [
  { key: 'readiness_rate', label: '就业准备达标率' },
  { key: 'matched_rate', label: '岗位匹配达成率' },
  { key: 'high_risk_count', label: '高风险人数' },
  { key: 'avg_gap', label: '平均技能缺口' },
  { key: 'counselor_utilization', label: '教师工时占用率' },
] as const

export type MetricKey = (typeof METRIC_OPTIONS)[number]['key']

const SCENARIO_COLORS: Record<string, string> = {
  baseline: '#66756f',
  skill_training: '#47728a',
  precision_coaching: '#0b6956',
  job_push: '#c56a42',
  combined: '#b34c43',
}

const SCENARIO_LABEL: Record<string, string> = {
  baseline: '现状基线',
  skill_training: '技能补强培训',
  precision_coaching: '精准帮扶',
  job_push: '岗位精准推送',
  combined: '组合策略',
}

export function scenarioLabel(key: string): string {
  return SCENARIO_LABEL[key] || key
}

export function scenarioColor(key: string): string {
  return SCENARIO_COLORS[key] || '#66756f'
}
