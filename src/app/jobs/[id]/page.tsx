"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

function uuid(): string {
  try { return crypto.randomUUID(); } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function JobDetailPage() {
  const params = useParams();
  const [candidates, setCandidates] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleScreen = async () => {
    if (!candidates.trim()) return;
    setLoading(true);
    setError("");

    try {
      // Parse resume text input — each resume separated by "---"
      const resumeBlocks = candidates
        .split("---")
        .map((s) => s.trim())
        .filter(Boolean);

      const candidateList = resumeBlocks.map((text, i) => ({
        id: uuid(),
        name: `候选人 ${i + 1}`,
        email: `candidate${i + 1}@example.com`,
        resumeText: text,
        status: "new" as const,
        createdAt: new Date().toISOString(),
      }));

      const job = {
        id: params.id,
        title: "高级前端工程师",
        description: "React TypeScript Next.js",
        structuredRequirements: [],
        status: "active" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

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
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="text-blue-600 hover:underline text-sm">
            ← 返回首页
          </a>
          <h1 className="text-2xl font-bold">📋 岗位详情 — 简历筛选</h1>
        </div>

        {/* Resume Input */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="font-semibold mb-3">📥 粘贴候选人简历</h2>
          <p className="text-sm text-gray-500 mb-3">
            每份简历以 <code className="bg-gray-100 px-1 rounded">---</code>{" "}
            分隔，每份简历自由文本即可（姓名 + 技能 + 经验 + 学历）
          </p>
          <textarea
            rows={12}
            value={candidates}
            onChange={(e) => setCandidates(e.target.value)}
            placeholder={`张三 --- 3年前端，React/TypeScript/Vue，本科计算机，参与过大型电商项目...

---
李四 --- 5年全栈，Node.js/React/Python，硕士学历，带过3人团队...`}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm font-mono"
          />

          <button
            onClick={handleScreen}
            disabled={loading || !candidates.trim()}
            className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "🤖 AI 正在筛选..." : "🚀 开始 AI 筛选"}
          </button>

          {error && (
            <p className="mt-3 text-red-600 text-sm">❌ {error}</p>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              📊 筛选结果（{results.length} 人，按匹配度降序）
            </h2>

            {results.map((r: any, i: number) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm p-6 border-l-4"
                style={{
                  borderLeftColor:
                    r.overallScore >= 80
                      ? "#22c55e"
                      : r.overallScore >= 60
                      ? "#f59e0b"
                      : "#ef4444",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-lg font-semibold">
                      #{i + 1} {r.candidateId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-2xl font-bold ${
                        r.overallScore >= 80
                          ? "text-green-600"
                          : r.overallScore >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {r.overallScore}
                    </span>
                    <span className="text-gray-400 text-sm"> / 100</span>
                  </div>
                </div>

                {/* Dimension Scores */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {r.dimensionScores?.map((d: any, j: number) => (
                    <div
                      key={j}
                      className="bg-gray-50 rounded-lg p-3 text-center"
                    >
                      <div className="text-xs text-gray-500 mb-1">
                        {d.dimension}
                      </div>
                      <div className="text-lg font-bold text-gray-800">
                        {d.score}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Highlights */}
                {r.highlights?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-green-700 mb-1">
                      ✨ 亮点
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                      {r.highlights.map((h: string, k: number) => (
                        <li key={k}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Concerns */}
                {r.concerns?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-amber-700 mb-1">
                      ⚠️ 关注点
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                      {r.concerns.map((c: string, k: number) => (
                        <li key={k}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Follow-up Questions */}
                {r.followUpQuestions?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 mb-1">
                      💬 建议追问
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                      {r.followUpQuestions.map((q: string, k: number) => (
                        <li key={k}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
