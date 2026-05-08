# Recruit Agent 🤖

> AI Agent 驱动的企业智能招聘平台 — 从 JD 生成到候选人评估，全流程自动化。

## 🎯 一句话定位

用 AI Agent 替代 80% 重复性招聘工作，让 HR 只做最后的"人情判断"。

## 🧠 核心能力

| 模块 | 功能 | 状态 |
|------|------|------|
| JD Agent | 输入需求 → AI 生成结构化职位描述 | 🟢 已实现 |
| Match Agent | 简历批量解析 + 多维度匹配打分 | 🟢 已实现 |
| Interview Agent | 个性化面试题生成 + 实时评估 | 🟢 已实现 |
| Report Agent | 综合面试报告 + 候选人对比 | 🟢 已实现 |

## 🏗️ 技术栈

- **前端**: React 19 + Next.js 16 + TypeScript + Tailwind CSS
- **Agent**: LangChain.js + LangGraph (TypeScript)
- **LLM**: DeepSeek (兼容 OpenAI)
- **数据库**: PostgreSQL + Drizzle ORM
- **部署**: Docker

## 🚀 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 API Key

# 3. 启动开发服务器
pnpm dev
```

## 📁 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（创建岗位）
│   ├── layout.tsx            # 全局布局
│   ├── (dashboard)/          # HR 管理后台
│   ├── (interview)/          # 候选人面试
│   └── api/                  # API 路由
│       ├── jobs/             # 岗位管理
│       ├── candidates/       # 简历筛选
│       └── interview/        # 面试流程
├── lib/
│   ├── agents/               # AI Agent 核心逻辑
│   │   ├── screening.ts      # 简历筛选 Agent
│   │   ├── interview.ts      # 面试 Agent
│   │   ├── graph.ts          # LangGraph 编排
│   │   └── index.ts          # 统一导出
│   ├── db/                   # 数据库
│   │   ├── schema.ts         # Drizzle schema
│   │   └── index.ts          # DB 连接
│   ├── types/                # TypeScript 类型
│   │   └── index.ts
│   └── utils/                # 工具函数
└── components/
    ├── dashboard/            # 后台组件
    └── interview/            # 面试组件
```

## 🔌 API 端点

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/jobs` | 创建岗位（自动解析 JD） |
| POST | `/api/candidates/screen` | 批量简历匹配 |
| POST | `/api/interview/generate` | 生成面试题 |
| POST | `/api/interview/evaluate` | 评估回答 |
| POST | `/api/interview/report` | 生成面试报告 |

## 📝 License

MIT
