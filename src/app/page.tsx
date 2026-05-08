"use client";

import { useState } from "react";

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [candidates, setCandidates] = useState("");
  const [screening, setScreening] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  // Step 1: Create Job
  const handleCreateJob = async () => {
    if (!title || !description) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error("岗位创建失败");
      const data = await res.json();
      setJob(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Screen Candidates
  const handleScreen = async () => {
    if (!candidates.trim() || !job) return;
    setScreening(true);
    setError("");
    try {
      const resumeBlocks = candidates
        .split("---")
        .map((s) => s.trim())
        .filter(Boolean);

      const candidateList = resumeBlocks.map((text, i) => ({
        id: crypto.randomUUID(),
        name: `候选人 ${i + 1}`,
        email: `candidate${i + 1}@example.com`,
        resumeText: text,
        status: "new" as const,
        createdAt: new Date().toISOString(),
      }));

      const res = await fetch("/api/candidates/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, candidates: candidateList }),
      });

      if (!res.ok) throw new Error("筛选失败");
      const data = await res.json();
      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScreening(false);
    }
  };

  const handleReset = () => {
    setJob(null);
    setResults(null);
    setCandidates("");
    setError("");
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🤖</span>
            <h1 className="text-3xl font-bold">Recruit Agent</h1>
          </div>
          <p className="text-lg text-blue-100 mb-1">
            AI 智能招聘 — 让 Agent 替你筛选、面试、评估候选人
          </p>
          <p className="text-sm text-blue-200">降本 70%，提速 10x</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-6">
        {/* Step 1: Create Job */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</span>
            <h2 className="text-xl font-semibold">创建岗位 · AI 自动解析 JD</h2>
          </div>

          {!job ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">岗位名称</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：高级前端工程师"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">职位描述</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="粘贴或描述职位要求...&#10;例：需要3年以上 React 经验，熟悉 TypeScript 和 Node.js，有大型项目架构经验优先..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
              <button
                onClick={handleCreateJob}
                disabled={loading || !title || !description}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "🤖 AI 解析中..." : "创建岗位 → AI 自动解析需求"}
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-800">✅ 岗位已创建：{job.title}</h3>
                <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">重置</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {job.structuredRequirements?.map((req: any, i: number) => (
                  <span
                    key={i}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      req.level === "must" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {req.level === "must" ? "❗必须" : "👍加分"} {req.name}
                    {req.yearsRequired ? ` (${req.yearsRequired}年+)` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Screen Candidates */}
        {job && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</span>
              <h2 className="text-xl font-semibold">粘贴简历 · AI 批量筛选</h2>
            </div>

            <p className="text-sm text-gray-500 mb-3">
              每份简历以 <code className="bg-gray-100 px-1 rounded">---</code> 分隔，自由文本格式
            </p>
            <textarea
              rows={10}
              value={candidates}
              onChange={(e) => setCandidates(e.target.value)}
              placeholder={`张三，3年前端开发，精通 React/TypeScript/Vue，本科计算机，参与过电商平台架构设计...

---
李四，5年全栈工程师，Node.js/Python/React，硕士学历，带过3人团队，负责过百万级用户系统...

---
王五，2年前端，Vue/JavaScript，大专学历，做过3个外包项目...`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm font-mono"
            />

            <button
              onClick={handleScreen}
              disabled={screening || !candidates.trim()}
              className="mt-4 w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {screening ? "🤖 AI 正在逐份分析..." : "🚀 开始 AI 筛选"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            ❌ {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-4">
              📊 筛选结果 — {results.length} 人，按匹配度降序
            </h2>

            <div className="space-y-4">
              {results.map((r: any, i: number) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-sm p-6 border-l-4"
                  style={{
                    borderLeftColor:
                      r.overallScore >= 80 ? "#22c55e" : r.overallScore >= 60 ? "#f59e0b" : "#ef4444",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-300">#{i + 1}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        r.overallScore >= 80 ? "bg-green-100 text-green-800" :
                        r.overallScore >= 60 ? "bg-amber-100 text-amber-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {r.overallScore >= 80 ? "🔥 强烈推荐" : r.overallScore >= 60 ? "🟡 待定" : "🔴 不推荐"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-3xl font-bold ${
                        r.overallScore >= 80 ? "text-green-600" : r.overallScore >= 60 ? "text-amber-600" : "text-red-600"
                      }`}>{r.overallScore}</span>
                      <span className="text-gray-400">/100</span>
                    </div>
                  </div>

                  {/* Dimension Scores */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {r.dimensionScores?.map((d: any, j: number) => (
                      <div key={j} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">{d.dimension}</div>
                        <div className="text-lg font-bold text-gray-800">{d.score}</div>
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{d.reasoning}</div>
                      </div>
                    ))}
                  </div>

                  {r.highlights?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-green-700 mb-1">✨ 亮点</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {r.highlights.map((h: string, k: number) => (
                          <li key={k}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.concerns?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-amber-700 mb-1">⚠️ 关注点</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {r.concerns.map((c: string, k: number) => (
                          <li key={k}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.followUpQuestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-1">💬 建议追问</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {r.followUpQuestions.map((q: string, k: number) => (
                          <li key={k}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feature Cards */}
      {!job && (
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">核心能力</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "📋", title: "JD 智能生成", desc: "输入需求 → AI 自动解析为结构化标签" },
              { icon: "🔍", title: "简历精准匹配", desc: "技能/经验/学历/素质四维打分，原文引用" },
              { icon: "🎤", title: "AI 模拟面试", desc: "JD+简历自动出题，实时评估，生成报告" },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
