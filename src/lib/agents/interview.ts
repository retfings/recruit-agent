/**
 * Interview Agent — AI 模拟面试官
 *
 * 核心能力: 根据 JD + 简历自动生成个性化面试题，实时评估追问
 * 支持三种题型: 技术面、项目深挖、行为面
 */

import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, END } from "@langchain/langgraph";
import type {
  Job,
  Candidate,
  InterviewQuestion,
  InterviewReport,
  MatchResult,
} from "@/lib/types";

const LLM_CONFIG = {
  model: process.env.LLM_MODEL || "deepseek-v4-pro",
  temperature: 0.3,
  maxTokens: 2048,
  configuration: {
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY!,
  },
};

/**
 * 根据 JD + 简历 + 匹配结果，生成个性化面试题
 */
export async function generateQuestions(
  job: Job,
  candidate: Candidate,
  matchResult: MatchResult
): Promise<InterviewQuestion[]> {
  const llm = new ChatOpenAI({ ...LLM_CONFIG, temperature: 0.5 });

  const prompt = `你是一位资深技术面试官。请根据以下信息生成个性化面试题目。

## 岗位要求
${job.structuredRequirements.map((r) => `- [${r.level === "must" ? "必须" : "加分"}] ${r.name}${r.yearsRequired ? ` (${r.yearsRequired}年)` : ""}`).join("\n")}

## 候选人简历
${candidate.resumeText}

## 匹配分析中的风险点（需重点考察）
${matchResult.concerns.map((c) => `- ${c}`).join("\n")}

## 匹配分析中的追问建议
${matchResult.followUpQuestions.map((q) => `- ${q}`).join("\n")}

## 出题要求
生成 5-8 道面试题，覆盖以下类型：
- technical: 技术题（编程、架构设计）
- project_deep_dive: 项目深挖题（针对候选人简历中的具体项目）
- behavioral: 行为面试题（团队协作、解决问题等）
- case_study: 案例分析题（实际业务场景）

每题需要包含：
- type: 题型
- question: 题目内容
- expectedPoints: 期望回答的关键要点（2-3个）
- difficulty: easy/medium/hard

请以 JSON 数组格式返回：[
  {"type":"technical","question":"...","expectedPoints":["...","..."],"difficulty":"medium"}
]`;

  const response = await llm.invoke(prompt);
  try {
    const cleaned = response.content
      .toString()
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse interview questions");
    return [];
  }
}

/**
 * 评估候选人单题回答
 */
export async function evaluateAnswer(
  question: InterviewQuestion,
  answer: string,
  resumeContext: string
): Promise<{ score: number; feedback: string; shouldFollowUp: boolean; followUp?: string }> {
  const llm = new ChatOpenAI(LLM_CONFIG);

  const prompt = `你是一位技术面试官。请评估候选人对以下问题的回答。

## 题目
${question.question}

## 期望回答要点
${question.expectedPoints.map((p) => `- ${p}`).join("\n")}

## 候选人回答
${answer}

## 候选人背景
${resumeContext}

请评估并提供：
- score: 0-100分
- feedback: 具体的评价和建议（2-3句话，要有针对性）
- shouldFollowUp: 是否需要追问（true/false）
- followUp: 如果需要追问，写出追问的问题

以 JSON 返回：{"score":75,"feedback":"...","shouldFollowUp":false}`;

  const response = await llm.invoke(prompt);
  try {
    const cleaned = response.content
      .toString()
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      score: 50,
      feedback: "评估失败，请手动审核",
      shouldFollowUp: false,
    };
  }
}

/**
 * 生成综合面试报告
 */
export async function generateReport(
  job: Job,
  candidate: Candidate,
  questions: InterviewQuestion[],
  answers: { questionId: string; question: string; answer: string; score: number; feedback: string }[]
): Promise<InterviewReport> {
  const llm = new ChatOpenAI({ ...LLM_CONFIG, temperature: 0.2 });

  const qaHistory = answers
    .map(
      (a, i) =>
        `Q${i + 1}: ${a.question}\nA: ${a.answer}\n评分: ${a.score} | 反馈: ${a.feedback}`
    )
    .join("\n\n");

  const prompt = `你是一位资深招聘顾问。请根据面试记录生成综合评估报告。

## 岗位
${job.title} - ${job.description.slice(0, 500)}

## 候选人
${candidate.name}

## 面试记录
${qaHistory}

请生成评估报告，包含：
- overallScore: 0-100
- technicalScore: 0-100
- behavioralScore: 0-100
- strengths: 突出优势（3-5条）
- weaknesses: 需要改进的地方（2-3条）
- recommendation: strong_hire / hire / weak_hire / no_hire
- summary: 综合总结（100-150字）

以 JSON 返回，不要其他内容。`;

  const response = await llm.invoke(prompt);
  try {
    const cleaned = response.content
      .toString()
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      ...parsed,
      detailedFeedback: answers.map((a) => ({
        questionId: a.questionId,
        question: a.question,
        answer: a.answer,
        score: a.score,
        feedback: a.feedback,
      })),
    };
  } catch (err) {
    console.error("Failed to generate report:", err);
    return {
      overallScore: 0,
      technicalScore: 0,
      behavioralScore: 0,
      strengths: [],
      weaknesses: [],
      recommendation: "no_hire",
      summary: "报告生成失败",
      detailedFeedback: [],
    };
  }
}
