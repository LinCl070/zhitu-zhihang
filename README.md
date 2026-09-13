# 职途智航

职途智航是一个面向高校学生、就业指导教师和就业管理员的就业择业规划智能体。系统使用脱敏画像、带来源的模拟/公开岗位数据和 SF-FastGPT 服务端工作流，展示可解释岗位匹配、求职行动计划与人工就业指导闭环。

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
