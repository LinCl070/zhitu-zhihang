# T-010 验收记录

> 更新时间：2026-07-23
> 范围：职途智航本地脱敏演示环境

## 自动化验证

| 项目 | 命令 | 通过条件 |
|:---|:---|:---|
| 后端单元测试 | `backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v` | 配置、模型、RBAC、匹配、FastGPT 适配、隐私边界和教师工作台测试通过 |
| 后端静态检查 | `backend\.venv\Scripts\ruff.exe check backend` | 无错误 |
| 前端构建 | `npm run build`（在 `frontend/`） | TypeScript 编译与 Vite 构建成功 |
| 前端静态检查 | `npm run lint`（在 `frontend/`） | ESLint 零警告 |
| 数据库迁移 | `backend\.venv\Scripts\alembic.exe -c backend\alembic.ini upgrade head` | 当前版本为 `20260723_0003` |

本地验收于 2026-07-23 完成：后端 `unittest` 26 项通过，Ruff 检查与格式校验通过，前端 ESLint 通过，生产构建通过，数据库当前版本为 `20260723_0003 (head)`。

## 三角色关键路径

| 角色 | 路径 | 预期结果 |
|:---|:---|:---|
| 学生 | 登录 -> 画像 -> 匹配 -> 计划 -> 咨询 | 返回模拟岗位、规则分和行动计划；资料不足时显示人工确认建议 |
| 教师 | 管理员授权 -> 教师登录 -> 查看学生 -> 提交意见 | 仅显示已授权学生的摘要、计划数量和教师本人意见 |
| 管理员 | 登录 -> 查看资料台账、岗位与审计 -> 授权教师 | 仅显示审核/追溯字段；不显示完整画像、意见正文或密钥 |

上述三条路径已在本地演示环境验证。学生端与教师端在 `375px` 宽度下无水平溢出，浏览器控制台未发现错误。

## 隐私与安全检查

- 前端源代码不含 SF-FastGPT API Key、工作流 ID 或 PostgreSQL 连接串。
- 后端业务模型不包含电话、邮箱、学号、性别、籍贯、健康或政治面貌字段。
- 审计响应只包含角色、操作、资源类型、资源标识和时间，不返回请求体、画像、意见正文或密钥。
- 模拟岗位均标识为演示数据，不能作为真实招聘承诺。

## SF-FastGPT 联调状态

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
