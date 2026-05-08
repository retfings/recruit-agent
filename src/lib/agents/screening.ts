/**
 * Resume Screening Agent — 简历智能筛选
 *
 * 输入: JD + 批量简历
 * 输出: 匹配度打分 + 维度分析 + 追问建议
 *
 * 核心设计: 结构化提取 + LLM 语义兜底，不做纯向量匹配
 * 每个判断附带原文引用，HR 可追溯
 */

import { ChatOpenAI } from "@langchain/openai";
import type {
  Job,
  Candidate,
  MatchResult,
  DimensionScore,
} from "@/lib/types";

const LLM_CONFIG = {
  model: process.env.LLM_MODEL || "deepseek-v4-flash",
  temperature: 0.1, // 低温度保证一致性
  maxTokens: 2048,
  configuration: {
    baseURL: process.env.LLM_BASE_URL || "https://api.deepseek.com",
    apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY!,
  },
};

/**
 * 解析 JD 为结构化需求标签
 */
export async function parseJDToRequirements(
  jdText: string
): Promise<Job["structuredRequirements"]> {
  const llm = new ChatOpenAI(LLM_CONFIG);

  const prompt = `你是一个专业的招聘需求分析师。请将以下职位描述(JD)解析为结构化的需求标签。

对每条需求，提取：
- category: skill（技能）/ experience（经验）/ education（学历）/ soft_skill（软技能）
- name: 具体名称（如 React、团队管理）
- level: must（必须）或 nice_to_have（加分）
- yearsRequired: 如涉及年限，填写数字；否则不填

JD 内容：
${jdText}

请以 JSON 数组格式返回，只返回 JSON，不要其他内容。
格式: [{"category":"skill","name":"React","level":"must","yearsRequired":3},...]`;

  const response = await llm.invoke(prompt);
  try {
    const cleaned = response.content
      .toString()
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: 返回空数组，不中断流程
    console.error("Failed to parse JD requirements:", response.content);
    return [];
  }
}

/**
 * 单份简历匹配打分
 */
export async function matchResume(
  job: Job,
  candidate: Candidate,
  llm?: ChatOpenAI
): Promise<MatchResult> {
  const model = llm || new ChatOpenAI(LLM_CONFIG);

  const requirementsText = job.structuredRequirements
    .map((r) => `[${r.level === "must" ? "必须" : "加分"}] ${r.category}: ${r.name}${r.yearsRequired ? ` (${r.yearsRequired}年+)` : ""}`)
    .join("\n");

  const prompt = `你是一位资深招聘专家。请仔细对比职位要求和候选人简历，给出匹配评估。

## 职位要求
${requirementsText}

## 候选人简历
${candidate.resumeText}

## 评估要求
请从以下维度打分（0-100分），并提供详细分析：

1. **技能匹配**: 候选人技能与岗位要求的匹配度
2. **经验匹配**: 工作经验和项目经历是否达到要求
3. **学历匹配**: 学历背景是否符合要求
4. **综合素质**: 沟通能力、团队协作等软技能

对于每个低分或高分项，**必须引用简历原文**作为依据。

同时请提供：
- highlights: 该候选人的突出亮点（3-5条）
- concerns: 需要关注的风险点（2-3条）
- followUpQuestions: 建议在面试中追问的问题（3-5个，要具体）

请以 JSON 格式返回：
{
  "overallScore": 85,
  "dimensionScores": [
    {"dimension": "技能匹配", "score": 90, "reasoning": "候选人熟练掌握 React 和 TypeScript...基于简历原文：'...'"}
  ],
  "highlights": ["..."],
  "concerns": ["..."],
  "followUpQuestions": ["..."]
}`;

  const response = await model.invoke(prompt);
  try {
    const cleaned = response.content
      .toString()
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    return {
      candidateId: candidate.id,
      jobId: job.id,
      overallScore: parsed.overallScore,
      dimensionScores: parsed.dimensionScores,
      highlights: parsed.highlights,
      concerns: parsed.concerns,
      followUpQuestions: parsed.followUpQuestions,
      rawAnalysis: response.content.toString(),
      createdAt: new Date(),
    };
  } catch (err) {
    console.error("Failed to parse match result:", err);
    throw new Error(`简历匹配分析失败: ${err}`);
  }
}

/**
 * 批量简历筛选
 * 分批处理，控制 token 消耗
 */
export async function batchScreenResumes(
  job: Job,
  candidates: Candidate[],
  onProgress?: (completed: number, total: number) => void
): Promise<MatchResult[]> {
  const llm = new ChatOpenAI(LLM_CONFIG);
  const results: MatchResult[] = [];
  const batchSize = 5; // 每批 5 份，避免超限

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((candidate) => matchResume(job, candidate, llm))
    );
    results.push(...batchResults);
    onProgress?.(Math.min(i + batchSize, candidates.length), candidates.length);
  }

  // 按综合得分降序排列
  results.sort((a, b) => b.overallScore - a.overallScore);
  return results;
}
