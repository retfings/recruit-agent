# Recruit Agent - 企业智能招聘平台

## 一句话定位
企业面试招人全流程 Agent 化，从 JD 生成到候选人评估，降本增效。

## 当前状态: 🔴 规划中

## 核心功能设想
- [ ] JD 智能生成（输入需求 → Agent 产出职位描述）
- [ ] 简历筛选 Agent（批量解析、打分、匹配）
- [ ] 面试题目生成 Agent（技术面、行为面、案例面）
- [ ] AI 模拟面试（候选人答题，Agent 评估）
- [ ] 候选人综合评估报告
- [ ] 企业 HR 后台管理

## 技术选型
- 前端: React 19 + Next.js 15 (App Router)
- 后端: Next.js API Routes / Server Actions
- Agent 框架: LangChain.js + LangGraph (TypeScript)
- 语言: TypeScript 全栈
- LLM: DeepSeek（首选），兼容 OpenAI/Anthropic/Azure 多提供商
- 数据库: PostgreSQL
- 部署: Docker

## 关键决策
- 2026-05-08: 复用 ai-writer 的共享底座，独立业务层
- 2026-05-08: 等 ai-writer 核心链路跑通后再启动

## 踩坑记录
_暂无_
