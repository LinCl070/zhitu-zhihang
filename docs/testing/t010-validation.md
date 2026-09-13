# T-010 验收记录

> 更新时间：2026-09-09
> 范围：职途智航本地脱敏演示环境

## 自动化验证

| 项目 | 命令 | 通过条件 |
|:---|:---|:---|
| 后端单元测试 | `backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v` | 配置、模型、RBAC、匹配、FastGPT 适配、隐私边界和教师工作台测试通过 |
| 后端静态检查 | `backend\.venv\Scripts\ruff.exe check backend` | 无错误 |
| 前端构建 | `npm run build`（在 `frontend/`） | TypeScript 编译与 Vite 构建成功 |
| 前端静态检查 | `npm run lint`（在 `frontend/`） | ESLint 零警告 |
| 数据库迁移 | `backend\.venv\Scripts\alembic.exe upgrade head`（在 `backend/`） | 当前版本为 `20260909_0005` |

本地验收于 2026-08-28 完成：后端 `unittest` 28 项通过，Ruff 检查通过，前端 ESLint 零警告，TypeScript 与 Vite 生产构建通过。真实 PostgreSQL HTTP 链路中，管理员 overview 返回 30 条岗位、2 名学生和 1 名教师；教师意见提交后可重新读取；教师访问管理员接口返回 403。

2026-09-09 补充验收：数据库从 `20260723_0003` 顺序迁移至 `20260909_0005`。新增学生账号档案注册的后端 `unittest` 共 41 项通过，Ruff、前端 ESLint 与 Vite production build 均通过；唯一测试学生注册返回 `201`，随后登录返回 `200` 且角色为 `student`。

## 三角色关键路径

| 角色 | 路径 | 预期结果 |
|:---|:---|:---|
| 学生 | 登录 -> 画像 -> 匹配 -> 计划 -> 咨询 | 返回模拟岗位、规则分和行动计划；资料不足时显示人工确认建议 |
| 教师 | 管理员授权 -> 教师登录 -> 查看学生 -> 提交意见 | 仅显示已授权学生的摘要、计划数量和教师本人意见 |
| 管理员 | 登录 -> 查看资料台账、岗位与审计 -> 授权教师 | 仅显示审核/追溯字段；不显示完整画像、意见正文或密钥 |

上述三条路径已在本地演示环境验证。浏览器三角色入口均可进入对应工作台；`375px` 移动视口下页面 `scrollWidth` 与可视宽度一致，浏览器控制台未发现错误。

## 隐私与安全检查

- 前端源代码不含 SF-FastGPT API Key、工作流 ID 或 PostgreSQL 连接串。
- 姓名、学号、电话、邮箱和入学年份仅保存在学生账号档案；学生本人、已授权教师和管理员可按角色边界读取，且不进入职业画像、匹配、模型提示词或审计元数据。
- 后端业务模型不包含性别、籍贯、健康或政治面貌字段。
- 审计响应只包含角色、操作、资源类型、资源标识和时间，不返回请求体、画像、意见正文或密钥。
- 模拟岗位均标识为演示数据，不能作为真实招聘承诺。

## SF-FastGPT 联调状态

当前服务端健康检查返回 `fastgpt_mode=sf_fastgpt`。职业与政策接口已接入独立服务端路由；本次验收中平台返回无可信来源，因此页面按设计显示人工确认提示，未将无来源响应包装为可信答案。完成知识库和工作流来源审核后，再运行下方诊断脚本确认正式联调通过。

真实模式中，服务端向 `POST ${FASTGPT_BASE_URL}/api/v1/chat/completions` 发送 `Authorization: Bearer <API Key>`、应用 ID（请求体 `appId`）和独立会话 ID（请求体 `chatId`）。环境变量仍使用 `FASTGPT_WORKFLOW_*_ID` 以兼容早期配置，但其值必须是 SANGFOR Agent Builder 的应用 ID，不能填入 API Key 或会话 ID。

完成真实联调前，需在根目录 `.env` 配置以下内容，不得写入仓库或录屏：

```env
FASTGPT_MODE=sf_fastgpt
FASTGPT_BASE_URL=https://<platform-host>
FASTGPT_API_KEY_CAREER=<career-server-side-key>
FASTGPT_API_KEY_POLICY=<policy-server-side-key>
FASTGPT_CHAT_COMPLETIONS_PATH=/api/v1/chat/completions
FASTGPT_WORKFLOW_CAREER_ID=<career-workflow-id>
FASTGPT_WORKFLOW_POLICY_ID=<policy-workflow-id>
```

配置后应验证职业与政策两类咨询均返回资料标题、链接和版本/日期；若平台路径或响应结构不同，先更新 `docs/specs/design.md` 的 4.7 节和服务端适配器，再重新联调。

完成配置后，在项目根目录执行以下命令。脚本只输出两条工作流的运行模式、来源数量、来源完整性和通过状态，不会输出回答正文、密钥或原始平台响应。

```powershell
$env:PYTHONPATH = (Join-Path (Get-Location) 'backend')
& backend\.venv\Scripts\python.exe -m scripts.verify_fastgpt
```
