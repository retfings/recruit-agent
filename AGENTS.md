<!-- BEGIN:project-overview -->
# Recruit Agent - AI 招聘平台

## 技术栈

- **前端**: React 19 + Next.js 16 + TypeScript + Tailwind CSS
- **Agent**: LangChain.js + LangGraph (TypeScript)
- **LLM**: DeepSeek (兼容 OpenAI 格式)
- **数据库**: PostgreSQL + Drizzle ORM

## 核心模块

| 模块 | 文件 | 说明 |
|------|------|------|
| 简历筛选 | `src/lib/agents/screening.ts` | 批量解析简历 + 多维度匹配打分 |
| 面试 Agent | `src/lib/agents/interview.ts` | 个性化面试题生成 + 实时评估 |
| 工作流编排 | `src/lib/agents/graph.ts` | LangGraph 状态机编排 |
<!-- END:project-overview -->

<!-- BEGIN:code-conventions -->
## 代码规范

### 目录结构

```
src/
├── app/                    # Next.js App Router 页面和 API
│   ├── api/               # API 路由
│   │   ├── jobs/          # 岗位管理
│   │   ├── candidates/    # 候选人管理
│   │   ├── interview/     # 面试流程
│   │   └── report/        # 报告生成
│   ├── dashboard/         # HR 管理后台
│   ├── interview/         # 候选人面试页面
│   └── jobs/              # 岗位详情页
├── lib/
│   ├── agents/            # AI Agent 核心逻辑
│   ├── db/                # Drizzle ORM 数据库
│   └── types/             # TypeScript 类型定义
```

### API 响应格式

```typescript
// 成功响应
{
  success: true,
  data: T
}

// 错误响应
{
  success: false,
  error: string
}
```

### Agent 调用模式

使用 LangChain.js 的 `invoke()` 方法调用 Agent：

```typescript
import { screeningAgent } from '@/lib/agents';
const result = await screeningAgent.invoke({ resume, job });
```
<!-- END:code-conventions -->

<!-- BEGIN:development -->
## 开发指南

### 环境配置

1. 复制环境变量模板:
   ```bash
   cp .env.example .env.local
   ```

2. 必需的环境变量:
   - `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` - LLM API Key
   - `DATABASE_URL` - PostgreSQL 连接字符串

### 常用命令

```bash
pnpm install    # 安装依赖
pnpm dev        # 启动开发服务器
pnpm build      # 构建生产版本
pnpm lint       # 代码检查
```

### 数据库操作

```bash
pnpm db:generate  # 生成 Drizzle 迁移
pnpm db:migrate   # 执行数据库迁移
pnpm db:studio    # 打开 Drizzle Studio
```
<!-- END:development -->
