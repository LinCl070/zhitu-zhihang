import { JobStage } from '../api/client'

export interface ProfileForm {
  major: string
  skills: string
  projects: string
  targetRoles: string
  targetCities: string
  jobStage: JobStage
}

export const defaultProfileForm: ProfileForm = {
  major: '软件工程',
  skills: 'Java, Spring Boot, MySQL, Git, REST API',
  projects: '参与校园二手交易平台后端模块开发，负责订单状态机设计与接口鉴权治理（已脱敏）。',
  targetRoles: '后端开发实习生',
  targetCities: '成都',
  jobStage: 'preparing',
}
