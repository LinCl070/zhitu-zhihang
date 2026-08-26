export type StudentNav = 'profile' | 'jobs' | 'plan' | 'consult'

interface TaskFlowProps {
  currentNav: StudentNav
  onSelectNav: (nav: StudentNav) => void
  profileSaved: boolean
  jobsCount: number
  planCount: number
}

export function TaskFlow({
  currentNav,
  onSelectNav,
  profileSaved,
  jobsCount,
  planCount,
}: TaskFlowProps) {
  const steps: Array<{
    id: StudentNav
    num: string
    title: string
    hint: string
    state: 'done' | 'current' | 'todo'
  }> = [
    {
      id: 'profile',
      num: '1',
      title: '职业画像',
      hint: profileSaved ? '已保存' : '待保存',
      state: currentNav === 'profile' ? 'current' : profileSaved ? 'done' : 'todo',
    },
    {
      id: 'jobs',
      num: '2',
      title: '岗位推荐',
      hint: jobsCount > 0 ? `${jobsCount} 条未过期` : '待生成',
      state: currentNav === 'jobs' ? 'current' : jobsCount > 0 ? 'done' : 'todo',
    },
    {
      id: 'plan',
      num: '3',
      title: '行动计划',
      hint: planCount > 0 ? `${planCount} 项任务` : '待生成',
      state: currentNav === 'plan' ? 'current' : planCount > 0 ? 'done' : 'todo',
    },
    {
      id: 'consult',
      num: '4',
      title: '就业咨询',
      hint: '可转人工',
      state: currentNav === 'consult' ? 'current' : 'todo',
    },
  ]

  return (
    <ol className="task-flow" data-stepper aria-label="择业任务进度">
      {steps.map((s) => (
        <li
          key={s.id}
          data-step={s.id}
          data-state={s.state}
          aria-current={s.state === 'current' ? 'step' : undefined}
          onClick={() => onSelectNav(s.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className="tf-idx" aria-hidden="true">
            {s.num}
          </span>
          <span className="tf-copy">
            <b>{s.title}</b>
            <em>{s.hint}</em>
          </span>
        </li>
      ))}
    </ol>
  )
}
