# 职途智航

职途智航是一个面向高校学生、就业指导教师和就业管理员的就业择业规划智能体。系统使用脱敏画像、带来源的模拟/公开岗位数据和 SF-FastGPT 服务端工作流，展示可解释岗位匹配、求职行动计划与人工就业指导闭环。

本期进一步升级为**就业治理智能体**，按"感知 → 预警 → 仿真推演 → 决策建议 → 人工确认 → 反馈"闭环运行：

- **风险预警**（教师）：可解释的就业准备度风险分级，逐因子拆解并给出干预清单；
- **群体画像**（管理员）：按专业×阶段聚合的就业准备度分布，小样本抑制，支持真实/合成数据切换；
- **策略仿真**（管理员）：多智能体（ABM）仿真对比基线、技能培训、精准帮扶、岗位推送与组合策略的群体效果，输出逐周指标与 95% 置信区间；
- **策略报告**（管理员）：确定性报告辅助决策，可选大模型解读（不产生数字），采纳写入审计、不自动干预。

## 本地运行

### 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

访问 `http://127.0.0.1:8000/health`，应返回健康检查和当前 FastGPT 模式。

### 前端

```powershell
cd frontend
npm install
npm run dev
```

访问 `http://127.0.0.1:5173`。

## 环境变量

复制根目录 `.env.example` 为 `.env`。开发阶段可使用 `FASTGPT_MODE=mock`；获得赛事平台 API Key、应用/工作流 ID 和授权后，服务端可切换为 `sf_fastgpt`。无可信来源时系统会保留人工确认提示，不伪造模型回答。

不得提交真实学生简历、联系方式、企业联系人、学校生产系统凭据或 SF-FastGPT 密钥。岗位匹配与就业建议不构成录用承诺或就业决定。

## 目录结构

```text
frontend/  React + TypeScript 网页端
backend/   FastAPI 服务端
docs/      需求、架构、任务和比赛材料
```
