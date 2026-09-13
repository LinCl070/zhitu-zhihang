# 缺陷修复规范 (Bugfix Specification)

> **问题名称：** Web 端未严格使用 Agent Builder 生成的问答 API 请求
> **版本：** v1.0
> **状态：** 已批准
> **严重级别：** P1
> **影响环境：** 本地演示环境
> **最后更新：** 2026-09-11

## 1. 问题概述

Agent Builder 为当前应用生成的 Chat Completions 示例仅包含 `chatId`、`stream`、`detail` 和 `messages`。项目额外发送 `appId` 与 `variables`，导致同一应用在测试页和 Web 端的工作流分支结果不一致。

## 2. 证据与复现

- 官方生成请求：`POST /api/v1/chat/completions`，认证由 `Authorization: Bearer API_KEY` 提供，未列出 `appId` 或 `variables`。
- 当前 `FastGPTClient` 在请求体中额外加入 `appId` 和画像变量。
- 同一应用、同一问题的项目请求曾返回资料不足文本，而测试页返回完整回答。

## 3. 当前错误行为

### BUG-001: 请求体偏离当前平台合同

- **WHEN** Web 端调用职业或政策咨询。
- **THEN** 服务端向平台发送未在应用生成示例中定义的 `appId` 和 `variables`，可能触发不同的工作流处理结果。

## 4. 修复后的期望行为

### FIX-001: 严格匹配应用生成的请求

- **WHEN** Web 端调用任一咨询路由。
- **THEN** 请求体只包含 `chatId`、`stream=false`、`detail=false` 和单条用户 `messages`；应用由对应 API Key 选择。

## 5. 必须保持不变的行为

- 职业和政策仍使用各自服务端 API Key。
- API Key 不返回浏览器、不写入日志。
- 无来源回答仍显示原文并附人工确认提示；平台异常仍安全降级。
- Web API 请求和响应 schema 不变。

## 6. 范围与约束

### 修复范围内

- `backend/app/clients/fastgpt.py` 的请求体构造和对应定向测试。

### 明确不在范围内

- 修改 FastGPT 应用、知识库、提示词或发布配置。
- 修改数据库、前端 API 合同或来源安全策略。

### 假设

- 当前 Sangfor Agent Builder 的 API Key 已绑定对应应用；应用 ID 不需要作为请求体字段传入。
- `chatId` 仍可用于多轮会话，首轮使用服务端生成的随机值符合官方可选字段定义。

## 7. 风险与回滚提示

- **主要风险：** 若平台实际仍要求 `appId`，删除后会导致请求失败。
- **回滚方式：** 恢复原请求体字段并重新启动后端。
- **观察指标：** 职业和政策两路定向测试及实际 Web 咨询结果。

## 8. 审批记录

| 日期 | 审批人 | 决定 | 备注 |
|:---|:---|:---|:---|
| 2026-09-11 | 用户 | 批准 | 按 Agent Builder 生成的 cURL 对齐请求体。 |
