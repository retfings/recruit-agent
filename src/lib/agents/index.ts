/**
 * Recruit Agent — AI 智能招聘平台
 *
 * Agent 模块汇总
 * - screening: 简历智能筛选（解析 JD、匹配简历、批量打分）
 * - interview: AI 模拟面试（出题、评估、报告生成）
 * - graph: LangGraph 编排多步流程
 */

export { parseJDToRequirements, matchResume, batchScreenResumes } from "./screening";
export {
  generateQuestions,
  evaluateAnswer,
  generateReport,
} from "./interview";
export { createScreeningGraph, runScreening } from "./graph";
