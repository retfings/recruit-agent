export interface Job {
  id: string;
  title: string;
  description: string; // raw JD text
  structuredRequirements: StructuredRequirement[];
  status: "draft" | "active" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface StructuredRequirement {
  category: "skill" | "experience" | "education" | "soft_skill";
  name: string; // e.g. "React", "TypeScript", "团队协作"
  level: "must" | "nice_to_have";
  yearsRequired?: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  resumeText: string; // parsed plain text
  resumeUrl?: string; // original file URL
  status: "new" | "screening" | "interviewed" | "passed" | "rejected";
  createdAt: Date;
}

export interface MatchResult {
  candidateId: string;
  jobId: string;
  overallScore: number; // 0-100
  dimensionScores: DimensionScore[];
  highlights: string[]; // 匹配亮点
  concerns: string[]; // 风险点
  followUpQuestions: string[]; // 追问建议
  rawAnalysis: string; // LLM 原始分析
  createdAt: Date;
}

export interface DimensionScore {
  dimension: string; // "技能匹配", "经验匹配", "学历匹配", "综合素质"
  score: number; // 0-100
  reasoning: string;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  jobId: string;
  token: string; // unique access token for candidate
  status: "invited" | "in_progress" | "completed";
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  report?: InterviewReport;
  createdAt: Date;
  expiresAt: Date;
}

export interface InterviewQuestion {
  id: string;
  type: "technical" | "project_deep_dive" | "behavioral" | "case_study";
  question: string;
  expectedPoints: string[]; // 期望回答要点
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewResponse {
  questionId: string;
  answer: string;
  feedback?: string; // Agent 实时反馈
  score?: number; // 单题得分
}

export interface InterviewReport {
  overallScore: number;
  technicalScore: number;
  behavioralScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: "strong_hire" | "hire" | "weak_hire" | "no_hire";
  summary: string;
  detailedFeedback: QuestionFeedback[];
}

export interface QuestionFeedback {
  questionId: string;
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

// Agent state types (for LangGraph)
export interface ScreeningState {
  jobId: string;
  job: Job;
  candidates: Candidate[];
  matchResults: MatchResult[];
  currentStep: "parsing" | "matching" | "ranking" | "done";
  errors: string[];
}

export interface InterviewState {
  session: InterviewSession;
  currentQuestionIndex: number;
  candidateLastAnswer: string;
  messages: { role: "ai" | "candidate"; content: string }[];
  nextAction: "ask_question" | "wait_answer" | "evaluate" | "done";
}
