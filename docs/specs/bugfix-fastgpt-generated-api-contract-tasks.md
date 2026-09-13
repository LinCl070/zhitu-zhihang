# Bugfix 任务清单 (Task Breakdown)

> **问题名称：** Web 端未严格使用 Agent Builder 生成的问答 API 请求
> **关联规范：** `docs/specs/bugfix-fastgpt-generated-api-contract.md` · `docs/specs/bugfix-fastgpt-generated-api-contract-design.md`
> **最后更新：** 2026-09-11
> **进度：** 2 / 3 已完成

- [x] **B-001:** 更新 FastGPT 请求体以匹配 Agent Builder 生成的官方示例
  - 📁 涉及文件：`backend/app/clients/fastgpt.py`、`backend/tests/test_fastgpt.py`
  - ✅ 验证标准：请求体不含 `appId`、`variables`，保留官方示例字段。
  - 🔗 依赖：无

- [x] **B-002:** 运行职业/政策路由、回答解析、异常和人工确认定向回归测试
  - 📁 涉及文件：`backend/tests/test_fastgpt.py`
  - ✅ 验证标准：所有 FastGPT 定向测试通过。
  - 🔗 依赖：B-001

- [ ] **B-003:** 运行 Web 端实际咨询并记录结果
  - 📁 涉及文件：`docs/specs/bugfix-fastgpt-generated-api-contract-tasks.md`
  - ✅ 验证标准：Web 端结果与应用测试页使用同一已发布应用配置，且无敏感信息泄露。
  - 🔗 依赖：B-002

## 完成日志

| 任务 ID | 完成时间 | Commit Hash | 备注 |
|:---|:---|:---|:---|
| B-001 | 2026-09-11 | — | 已删除请求体中的 `appId` 与 `variables`，保留官方四类字段。 |
| B-002 | 2026-09-11 | — | FastGPT 定向测试 6/6 通过。 |
| B-003 | — | — | 未完成：Web 实测仍收到应用自身“资料不足”回答，待确认 API Key/发布版本绑定。 |
