# 学生注册档案任务清单

> **功能名称：** 学生注册档案与入学年份选择
> **关联规范：** `student-account-profile-product.md` · `student-account-profile-architecture.md`
> **最后更新：** 2026-09-09
> **进度：** 6 / 6 已完成

## 阶段 1：数据与治理

- [x] **T-PROFILE-001:** 更新 `users` 模型并添加学生档案迁移。
  - 涉及文件：`backend/app/models/entities.py`、`backend/alembic/versions/`
  - 验证标准：学号唯一约束存在；历史非学生账号可保持档案字段为空。
  - 依赖：无

- [x] **T-PROFILE-002:** 更新数据治理边界与隐私回归测试。
  - 涉及文件：`docs/data-governance/`、`backend/tests/test_privacy.py`
  - 验证标准：仅授权账号档案可使用联系字段，模型/匹配/审计路径仍禁止。
  - 依赖：T-PROFILE-001

## 阶段 2：认证与权限

- [x] **T-PROFILE-003:** 扩展学生注册校验、响应与学号冲突处理。
  - 涉及文件：`backend/app/api/auth.py`、认证测试
  - 验证标准：所有字段必填；学号仅接受 10 位数字且重复返回 `409`；公开响应不回显电话和邮箱。
  - 依赖：T-PROFILE-001

- [x] **T-PROFILE-004:** 在既有授权教师摘要和管理员台账中暴露学生档案字段。
  - 涉及文件：`backend/app/api/staff.py`、`frontend/src/StaffDashboard.tsx`、权限测试
  - 验证标准：已授权教师与管理员可读；未授权教师不可读。
  - 依赖：T-PROFILE-003

## 阶段 3：注册体验

- [x] **T-PROFILE-005:** 更新注册页和 API 客户端，新增必填字段与居中滚动年份选择器。
  - 涉及文件：`frontend/src/components/WelcomeScreen.tsx`、`frontend/src/api/client.ts`、`frontend/src/styles.css`
  - 验证标准：无显示名称；所有新标签含红色 `*`；年份滚动、键盘和窄屏可用。
  - 依赖：T-PROFILE-003

## 阶段 4：验证与修复

- [x] **T-PROFILE-006:** 运行定向后端测试、lint、前端 lint/build；随后执行 `B-REG-002` 和 `B-REG-003` 修复运行数据库迁移遗漏。
  - 涉及文件：`backend/tests/`、`docs/testing/`、`docs/specs/bugfix-student-registration-migration-tasks.md`
  - 验证标准：新档案流程通过，并在运行数据库上完成迁移、注册和登录验收。
  - 依赖：T-PROFILE-004、T-PROFILE-005

## 风险标记

| 任务 ID | 风险类别 | 风险描述 |
|:---|:---|:---|
| T-PROFILE-001 | 数据库/隐私 | 新增可识别个人信息和数据库迁移。 |
| T-PROFILE-004 | 授权/隐私 | 教师列表不得越过已有学生授权关系。 |
| T-PROFILE-006 | 运行数据库 | 既有认证迁移必须在新功能迁移之前安全执行。 |

## 完成日志

| 任务 ID | 完成时间 | 备注 |
|:---|:---|:---|
| T-PROFILE-001 至 T-PROFILE-006 | 2026-09-09 | 后端 41 项测试、Ruff、前端 ESLint/Vite build 均通过；运行数据库迁移至 `20260909_0005`，学生注册与登录闭环通过。 |
