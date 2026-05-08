import { pgTable, text, integer, timestamp, jsonb, real, uuid, pgEnum } from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", ["draft", "active", "closed"]);
export const candidateStatusEnum = pgEnum("candidate_status", [
  "new", "screening", "interviewed", "passed", "rejected",
]);
export const sessionStatusEnum = pgEnum("session_status", [
  "invited", "in_progress", "completed",
]);
export const recommendationEnum = pgEnum("recommendation", [
  "strong_hire", "hire", "weak_hire", "no_hire",
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  structuredRequirements: jsonb("structured_requirements").notNull().default("[]"),
  status: jobStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  resumeText: text("resume_text").notNull(),
  resumeUrl: text("resume_url"),
  status: candidateStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matchResults = pgTable("match_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  overallScore: real("overall_score").notNull(),
  dimensionScores: jsonb("dimension_scores").notNull().default("[]"),
  highlights: jsonb("highlights").notNull().default("[]"),
  concerns: jsonb("concerns").notNull().default("[]"),
  followUpQuestions: jsonb("follow_up_questions").notNull().default("[]"),
  rawAnalysis: text("raw_analysis"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").notNull().references(() => candidates.id),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  token: text("token").notNull().unique(),
  status: sessionStatusEnum("status").notNull().default("invited"),
  questions: jsonb("questions").notNull().default("[]"),
  responses: jsonb("responses").notNull().default("[]"),
  report: jsonb("report"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
