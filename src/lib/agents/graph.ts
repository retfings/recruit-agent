/**
 * Screening Graph — 简历筛选流程编排
 * 使用 LangGraph 管理多步筛选流程
 */

import { StateGraph, Annotation, END } from "@langchain/langgraph";
import type { ScreeningState, MatchResult } from "@/lib/types";
import { matchResume } from "./screening";

// State annotation for LangGraph
const ScreeningAnnotation = Annotation.Root({
  jobId: Annotation<string>,
  job: Annotation<any>,
  candidates: Annotation<any[]>,
  matchResults: Annotation<MatchResult[]>({
    reducer: (current, update) => update ?? current ?? [],
    default: () => [],
  }),
  currentStep: Annotation<"parsing" | "matching" | "ranking" | "done">,
  errors: Annotation<string[]>({
    reducer: (current, update) => [...(current ?? []), ...(update ?? [])],
    default: () => [],
  }),
});

// --- Graph Nodes ---

async function parseResumes(state: typeof ScreeningAnnotation.State): Promise<Partial<typeof ScreeningAnnotation.State>> {
  console.log(`Parsing ${state.candidates.length} resumes for job ${state.jobId}`);
  return { currentStep: "matching" };
}

async function matchCandidates(state: typeof ScreeningAnnotation.State): Promise<Partial<typeof ScreeningAnnotation.State>> {
  const results: MatchResult[] = [];
  const errors: string[] = [];

  for (const candidate of state.candidates) {
    try {
      const result = await matchResume(state.job, candidate);
      results.push(result);
    } catch (err) {
      console.error(`Failed to match candidate ${candidate.id}:`, err);
      errors.push(`Candidate ${candidate.name}: 匹配失败`);
    }
  }

  return {
    matchResults: results,
    errors,
    currentStep: "ranking",
  };
}

async function rankResults(state: typeof ScreeningAnnotation.State): Promise<Partial<typeof ScreeningAnnotation.State>> {
  const sorted = [...state.matchResults].sort((a, b) => b.overallScore - a.overallScore);
  return { matchResults: sorted, currentStep: "done" };
}

function routeStep(state: typeof ScreeningAnnotation.State): string {
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
  return new StateGraph(ScreeningAnnotation)
    .addNode("parseResumes", parseResumes)
    .addNode("matchCandidates", matchCandidates)
    .addNode("rankResults", rankResults)
    .addEdge("__start__", "parseResumes")
    .addConditionalEdges("parseResumes", routeStep)
    .addConditionalEdges("matchCandidates", routeStep)
    .addConditionalEdges("rankResults", routeStep)
    .compile();
}

// Run screening for a job
export async function runScreening(state: ScreeningState): Promise<ScreeningState> {
  const graph = createScreeningGraph();
  const result = await graph.invoke({
    jobId: state.jobId,
    job: state.job,
    candidates: state.candidates,
    matchResults: state.matchResults,
    currentStep: state.currentStep,
    errors: state.errors,
  });
  return result as unknown as ScreeningState;
}
