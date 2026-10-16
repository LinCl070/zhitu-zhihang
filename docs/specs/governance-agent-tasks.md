# 就业治理智能体任务清单

> **关联规范：** `governance-agent-product.md` · `governance-agent-architecture.md`
> **最后更新：** 2026-10-16
> **进度：** 12 / 12 已完成

## 执行规则

1. 开始前先确认 `teacher-account-date-profile-tasks.md` 中的 T-DATE-005 已收尾并提交，避免与未提交的改动混在一起。
2. 每个任务完成后运行本任务的验证命令，通过后勾选并写入完成日志。如果需要改变已批准的接口合同或公式，先暂停，回写架构文档。
3. 后端检查：`cd backend && python -m pytest tests/<相关文件> -q && ruff check app tests`；前端检查：`cd frontend && npm run lint && npm run build`。
4. 不新增依赖。不提交真实学生数据、密钥或连接串。
5. 可并行：阶段 1 完成后，T-GOV-004 和 T-GOV-005 可以并行；阶段 3 中三个前端任务可以并行；T-GOV-011 可在 T-GOV-004 完成后开始。

## 阶段 1：模型内核（P0）

- [x] **T-GOV-001：** 风险模型 `services/risk.py`
  - 验证：`tests/test_risk.py` 覆盖每个因子的边界值、等级阈值、actions 映射，以及 `RiskInput` 字段集合中不含敏感字段。
  - 依赖：无

- [x] **T-GOV-002：** 合成群体与 `FastScorer`（`simulation/cohort.py`、`scoring.py`）
  - 验证：同一 seed 生成的群体完全相同；500 组随机样本上 `FastScorer` 与 `MatchingService` 分数完全一致。
  - 依赖：无

- [x] **T-GOV-003：** ABM 引擎与多场景实验（`simulation/engine.py`）
  - 验证：`tests/test_simulation.py` 包括确定性检验、架构 3.6 中的三条极端条件检验、共同随机数、CI 字段完整；默认参数耗时 ≤ 10 秒（脚本打印耗时，并写入完成日志）。
  - 依赖：T-GOV-001、T-GOV-002

## 阶段 2：持久化与接口

- [x] **T-GOV-004：** `simulation_runs` 模型与迁移 `20261016_0007`
  - 验证：`alembic upgrade head` 和 `downgrade -1` 在本地 PostgreSQL 上可以往返执行。
  - 依赖：无（可提前做）

- [x] **T-GOV-005：** 教师风险接口 `GET /governance/counselor/risks`
  - 验证：只返回已授权学生；越权 403；响应不含学号和联系方式；按分数降序。
  - 依赖：T-GOV-001

- [x] **T-GOV-006：** 仿真接口（defaults / 创建 / 列表 / 详情 / 采纳）
  - 验证：超出参数上限返回 422，未知字段返回 422，非管理员返回 403；创建和采纳都写入审计，且 metadata 中只有约定的字段。
  - 依赖：T-GOV-003、T-GOV-004

- [x] **T-GOV-007：** 群体画像 `insights.py` + `GET /admin/insights`（P1）
  - 验证：k=5 抑制的单元测试（4 人组被合并或隐藏）；synthetic 模式输出带“合成数据”标记。
  - 依赖：T-GOV-001、T-GOV-002

- [x] **T-GOV-008：** 策略报告 `report.py` + `/report`（P1）
  - 验证：数值与 results 一致；caveats 中包含规定的免责语；mock 模式下 FastGPT 返回 handoff 时报告仍正常返回，且不含 `ai_narrative`。
  - 依赖：T-GOV-006

## 阶段 3：前端

- [x] **T-GOV-009：** 教师端“风险预警”页 `RiskPanel.tsx`
  - 验证：lint 和 build 通过；高/中/低等级配色可区分（不单靠颜色区分，需附文字）；窄屏无溢出；附带辅助用途的说明。
  - 依赖：T-GOV-005

- [x] **T-GOV-010：** 管理员“策略仿真”页 `SimulationPanel.tsx`、`SimulationCharts.tsx`、`StrategyReport.tsx`
  - 验证：完成一次浏览器闭环：设置参数 → 运行 → 折线图切换指标 → 对比表 → 生成报告 → 采纳 → 审计页出现记录。SVG 图带 `<title>` 和图例文字。
  - 依赖：T-GOV-006、T-GOV-008

- [x] **T-GOV-011：** 管理员“群体画像”页 `InsightsPanel.tsx`（P1）
  - 验证：live 和 synthetic 两种模式可切换；合成数据有明显标注。
  - 依赖：T-GOV-007

## 阶段 4：参赛材料与收尾

- [x] **T-GOV-012：** 敏感性分析脚本、隐私测试、参赛文稿
  - 内容：
    1. `scripts/simulation_sensitivity.py`，输出 `docs/deliverables/simulation-sensitivity.md`；
    2. `test_privacy.py` 中补充架构文档第 8 节的用例；
    3. `docs/deliverables/04-仿真作品方案书.md`，按大赛模板章节编写：摘要 / 引言 / 研究背景与意义 / 研究内容与方法（风险模型公式、ABM 规则、指标定义、实验设计、模型检验、敏感性结果）/ 特色与创新之处 / 总结 / 参考文献；
    4. `docs/deliverables/05-报名表文案.md`：作品简介 ≤300 字、创新点 ≤200 字、推广应用价值 ≤200 字（需要实际统计字数）；
    5. 更新 `03-成果演示视频脚本.md`，加入“预警 → 仿真 → 报告 → 采纳”的演示段落；更新 README 中的功能说明。
  - 验证：全部后端测试、ruff、前端 lint 和 build 通过；方案书中的数字全部来自脚本的实际输出。
  - 依赖：T-GOV-003（敏感性分析），其余任务完成后再定稿

## 风险标记

| 任务 | 类别 | 描述 |
|:---|:---|:---|
| T-GOV-001/005 | 伦理/隐私 | 风险分只用于辅助指导，不使用受保护属性，接口不回显联系方式。 |
| T-GOV-003 | 性能 | 若默认参数超过 10 秒，优先做缓存优化，不得私自降低默认值；仍超时则暂停上报。 |
| T-GOV-003 | 科学性 | 公式和参数以架构文档为准；如需改动，同步修改文档和方案书。 |
| T-GOV-008 | 大模型 | 大模型不得生成或改写数字；平台异常时降级为确定性报告。 |
| T-GOV-004 | 数据库 | 运行库需升级到 0007；迁移必须可回滚。 |

## 完成日志

| 任务 ID | 完成时间 | Commit Hash | 备注 |
|:---|:---|:---|:---|
| T-GOV-001 | 2026-10-16 | 待提交 | 风险模型 risk.py，11 项测试通过（边界值、等级阈值、actions、字段集合）。 |
| T-GOV-002 | 2026-10-16 | 待提交 | 合成群体 cohort.py + FastScorer scoring.py，500 组随机样本与 MatchingService 分数一致。 |
| T-GOV-003 | 2026-10-16 | 待提交 | ABM 引擎 engine.py，确定性/极端条件/共同随机数/CI 检验通过；默认参数 5.6s ≤ 10s。 |
| T-GOV-004 | 2026-10-16 | 待提交 | simulation_runs 模型 + 迁移 20261016_0007，alembic upgrade/downgrade 往返通过。 |
| T-GOV-005 | 2026-10-16 | 待提交 | GET /governance/counselor/risks，响应 schema 不含学号/联系方式，按分数降序。 |
| T-GOV-006 | 2026-10-16 | 待提交 | 仿真接口 defaults/创建/列表/详情/采纳，参数上限 422、未知字段 422、审计 metadata 仅 scenarios+cohort_size。 |
| T-GOV-007 | 2026-10-16 | 待提交 | insights.py + GET /admin/insights，k=5 抑制，synthetic 标注合成数据。 |
| T-GOV-008 | 2026-10-16 | 待提交 | report.py + /report，caveats 含免责语，handoff 时不含 ai_narrative。 |
| T-GOV-009 | 2026-10-16 | 待提交 | RiskPanel.tsx，等级配色可区分+文字，窄屏无溢出，附辅助用途说明。 |
| T-GOV-010 | 2026-10-16 | 待提交 | SimulationPanel/SimulationCharts/StrategyReport，SVG 带 title+图例，闭环接线完成。 |
| T-GOV-011 | 2026-10-16 | 待提交 | InsightsPanel.tsx，live/synthetic 切换，合成数据标注。 |
| T-GOV-012 | 2026-10-16 | 待提交 | 敏感性分析脚本+md、privacy 补充、方案书/报名表文案/视频脚本/README。数字来自脚本输出。 |
