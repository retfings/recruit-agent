/**
 * Screening Graph — 简历筛选流程编排
 * 使用 LangGraph 管理多步筛选流程
 */

import { StateGraph, END } from "@langchain/langgraph";
import type { ScreeningState, MatchResult } from "@/lib/types";
import { matchResume } from "./screening";

// --- Graph Nodes ---

async function parseResumes(state: ScreeningState): Promise<Partial<ScreeningState>> {
  // Candidates already have resumeText, nothing to parse here
  // In production, this would use a PDF parser
  console.log(`Parsing ${state.candidates.length} resumes for job ${state.jobId}`);
  return { currentStep: "matching" as const };
}

async function matchCandidates(state: ScreeningState): Promise<Partial<ScreeningState>> {
  const results: MatchResult[] = [];

  for (const candidate of state.candidates) {
    try {
      const result = await matchResume(state.job, candidate);
      results.push(result);
    } catch (err) {
      console.error(`Failed to match candidate ${candidate.id}:`, err);
      state.errors.push(`Candidate ${candidate.name}: 匹配失败`);
    }
  }

  return {
    matchResults: results,
    currentStep: "ranking" as const,
  };
}

async function rankResults(state: ScreeningState): Promise<Partial<ScreeningState>> {
  state.matchResults.sort((a, b) => b.overallScore - a.overallScore);
  return { currentStep: "done" as const };
}

function shouldContinue(state: ScreeningState): string {
  if (state.errors.length > 0 && state.matchResults.length === 0) {
    return END;
  }
  switch (state.currentStep) {
    case "parsing":
      return "matchCandidates";
    case "matching":
      return "rankResults";
    case "ranking":
      return END;
    default:
      return END;
  }
}

// --- Graph Definition ---

export function createScreeningGraph() {
  const graph = new StateGraph({ channels: screeningStateSchema })
    .addNode("parseResumes", parseResumes)
    .addNode("matchCandidates", matchCandidates)
    .addNode("rankResults", rankResults)
    .addEdge("__start__", "parseResumes")
    .addConditionalEdges("parseResumes", shouldContinue)
    .addConditionalEdges("matchCandidates", shouldContinue)
    .addConditionalEdges("rankResults", shouldContinue);

  return graph.compile();
}

// State schema for type safety
const screeningStateSchema = {
  jobId: null as any,
  job: null as any,
  candidates: null as any,
  matchResults: null as any,
  currentStep: null as any,
  errors: null as any,
};

// Run screening for a job
export async function runScreening(
  state: ScreeningState
): Promise<ScreeningState> {
  const graph = createScreeningGraph();
  const result = await graph.invoke(state);
  return result as unknown as ScreeningState;
}
