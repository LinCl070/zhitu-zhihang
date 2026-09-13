# 修复设计 (Bugfix Design)

> **问题名称：** Web 端未严格使用 Agent Builder 生成的问答 API 请求
> **关联规范：** `docs/specs/bugfix-fastgpt-generated-api-contract.md`
> **版本：** v1.0
> **状态：** 已批准
> **最后更新：** 2026-09-11

## 1. 根因分析

平台生成的当前应用调用示例使用 API Key 作为应用授权，不携带 `appId`，也未定义 `variables`。项目适配器沿用了旧版通用 FastGPT 合同，额外传入应用 ID 和画像变量，造成平台工作流处理路径与测试页不一致。

## 2. 最小安全修复方案

1. 在 `FastGPTClient.query` 中删除 `appId` 与 `variables`。
2. 保留 `chatId`、`stream=false`、`detail=false` 和 `messages`。
3. 保留职业/政策 API Key 路由映射；不向前端暴露密钥。
4. 更新请求体断言，并保留异常、来源和人工确认回归测试。

## 3. 明确不修改的区域

- `AssistantService` 的无来源回答展示规则。
- FastGPT 平台应用、知识库、提示词和发布状态。
- 数据库、认证授权和前端组件。

## 4. 测试策略

- 断言请求体不含 `appId` 和 `variables`。
- 断言职业/政策使用正确 API Key。
- 断言回答解析、无来源人工确认和平台异常降级保持通过。

## 5. 审批记录

| 日期 | 审批人 | 决定 | 备注 |
|:---|:---|:---|:---|
| 2026-09-11 | 用户 | 批准 | 采用官方生成请求作为当前平台合同。 |
