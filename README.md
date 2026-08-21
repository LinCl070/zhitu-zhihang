# 职途智航

职途智航是一个面向高校学生、就业指导教师和就业管理员的就业择业规划智能体。首版使用脱敏画像、模拟岗位数据和 SF-FastGPT 模拟模式，展示可解释岗位匹配与人工就业指导的基础工程。

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

复制根目录 `.env.example` 为 `.env`。默认 `FASTGPT_MODE=mock`，只有在获得赛事平台 API Key、工作流 ID 和授权后，才能切换为 `sf_fastgpt`。

不得提交真实学生简历、联系方式、企业联系人、学校生产系统凭据或 SF-FastGPT 密钥。岗位匹配与就业建议不构成录用承诺或就业决定。

## 目录结构

```text
frontend/  React + TypeScript 网页端
backend/   FastAPI 服务端
docs/      需求、架构、任务和比赛材料
```
