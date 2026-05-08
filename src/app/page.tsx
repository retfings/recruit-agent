"use client";

import { useState, useRef, useCallback } from "react";

function uuid(): string {
  // crypto.randomUUID requires secure context (HTTPS)
  try { return crypto.randomUUID(); } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface ResumeFile {
  name: string;
  text: string;
  status: "uploading" | "parsed" | "error";
  error?: string;
}

interface MatchResult {
  candidateId: string;
  overallScore: number;
  dimensionScores: { dimension: string; score: number; reasoning: string }[];
  highlights: string[];
  concerns: string[];
  followUpQuestions: string[];
}

const DEMO_FILES = [
  { name: "张三-高级前端.txt", label: "张三 · 4年React全栈 · 强匹配" },
  { name: "李四-中级前端.txt", label: "李四 · 2年Vue · 低匹配" },
  { name: "王五-全栈专家.txt", label: "王五 · 6年全栈 · 强匹配" },
];

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [screening, setScreening] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

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

  // File upload handler
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(
      (f) => f.name.match(/\.(pdf|docx?|txt)$/i) || f.type === "text/plain"
    );

    if (fileArr.length === 0) {
      setError("请上传 PDF、Word 或 TXT 格式的文件");
      return;
    }

    // Set uploading state
    const uploading: ResumeFile[] = fileArr.map((f) => ({
      name: f.name,
      text: "",
      status: "uploading" as const,
    }));
    setResumes((prev) => [...prev, ...uploading]);

    const formData = new FormData();
    fileArr.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("解析失败");

      const data = await res.json();
      const parsed: ResumeFile[] = data.results.map((r: any) => ({
        name: r.name,
        text: r.text,
        status: r.error ? ("error" as const) : ("parsed" as const),
        error: r.error,
      }));

      // Replace uploading placeholders with parsed results
      setResumes((prev) => {
        const uploadNames = new Set(fileArr.map((f) => f.name));
        const others = prev.filter((r) => !uploadNames.has(r.name));
        return [...others, ...parsed];
      });
    } catch (err: any) {
      setError(`文件解析失败: ${err.message}`);
      // Remove uploading placeholders
      setResumes((prev) => {
        const uploadNames = new Set(fileArr.map((f) => f.name));
        return prev.filter((r) => !uploadNames.has(r.name) || r.status !== "uploading");
      });
    }
  }, []);

  // Drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Load demo files
  const loadDemo = async () => {
    setDemoLoading(true);
    setError("");
    try {
      const files: File[] = [];
      for (const demo of DEMO_FILES) {
        const res = await fetch(`/demo/${demo.name}`);
        if (!res.ok) continue;
        const text = await res.text();
        const blob = new Blob([text], { type: "text/plain" });
        files.push(new File([blob], demo.name, { type: "text/plain" }));
      }
      if (files.length > 0) handleFiles(files);
    } catch (err: any) {
      setError(`示例加载失败: ${err.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const removeResume = (name: string) => {
    setResumes((prev) => prev.filter((r) => r.name !== name));
  };

  // Step 2: Screen Candidates
  const handleScreen = async () => {
    const parsed = resumes.filter((r) => r.status === "parsed");
    if (parsed.length === 0 || !job) return;

    setScreening(true);
    setError("");

    try {
      const candidateList = parsed.map((r, i) => ({
        id: uuid(),
        name: r.name.replace(/\.[^.]+$/, ""),
        email: `candidate${i + 1}@example.com`,
        resumeText: r.text,
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
    setResumes([]);
    setError("");
  };

  // Export PDF for screening results
  const exportScreeningPdf = async () => {
    if (!results || !job) return;
    try {
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "screening",
          jobTitle: job.title,
          date: new Date().toLocaleString("zh-CN"),
          results: results.map((r) => ({
            candidateId: r.candidateId,
            overallScore: r.overallScore,
            dimensionScores: r.dimensionScores,
            highlights: r.highlights,
            concerns: r.concerns,
          })),
        }),
      });
      if (!res.ok) throw new Error("PDF 生成失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `筛选报告-${job.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`导出失败: ${err.message}`);
    }
  };

  // --- RENDER ---

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤖</span>
              <h1 className="text-3xl font-bold">Recruit Agent</h1>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/dashboard"
                className="text-sm bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
              >
                📊 仪表盘
              </a>
              <a
                href="/settings"
                className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
              >
                ⚙️ 语音面试设置
              </a>
            </div>
          </div>
          <p className="text-lg text-blue-100 mb-1">AI 智能招聘 — 让 Agent 替你筛选、面试、评估候选人</p>
          <p className="text-sm text-blue-200">上传简历 → AI 自动匹配打分 → 降本增效</p>
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
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="岗位名称，例：高级前端工程师"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="职位描述，描述技能要求、经验、学历等&#10;例：需要3年以上 React 经验，精通 TypeScript 和 Node.js，有大型项目架构经验优先，本科及以上学历..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
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
                <h3 className="font-semibold text-green-800">✅ {job.title}</h3>
                <div className="flex items-center gap-3">
                  <a
                    href={`/interview/demo?job=${encodeURIComponent(job.title)}`}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition"
                  >
                    🎤 对该岗位面试
                  </a>
                  <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700">重置</button>
                </div>
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
                    {req.yearsRequired ? ` ≥${req.yearsRequired}年` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Upload Resumes */}
        {job && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</span>
              <h2 className="text-xl font-semibold">上传简历 · 支持 PDF / Word / TXT</h2>
            </div>

            {/* Upload area */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                dragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,text/plain"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-700 font-medium">拖拽简历文件到此处，或点击选择</p>
              <p className="text-sm text-gray-400 mt-1">支持 PDF · Word (.docx) · TXT，可多选</p>
            </div>

            {/* Demo files quick load */}
            {resumes.length === 0 && (
              <div className="mt-4 text-center">
                <span className="text-sm text-gray-400 mr-2">没有简历？试试示例：</span>
                <button
                  onClick={loadDemo}
                  disabled={demoLoading}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium underline disabled:opacity-50"
                >
                  {demoLoading ? "加载中..." : "📥 加载 3 份示例简历"}
                </button>
              </div>
            )}

            {/* Resume list */}
            {resumes.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700">
                    📄 已上传 {resumes.length} 份简历
                    <span className="text-gray-400 text-sm ml-2">
                      ({resumes.filter((r) => r.status === "parsed").length} 份就绪)
                    </span>
                  </h3>
                  {resumes.length < 3 && (
                    <button
                      onClick={loadDemo}
                      disabled={demoLoading}
                      className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                    >
                      {demoLoading ? "..." : "+ 加载示例"}
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                  {resumes.map((r) => {
                    const isExpanded = expanded.has(r.name);
                    const wordCount = r.text.length;
                    const firstLine = r.text.split("\n")[0]?.trim() || r.name;
                    const expMatch = r.text.match(/(\d+)\s*年/);
                    const experience = expMatch ? expMatch[0] : null;

                    return (
                      <div
                        key={r.name}
                        className={`rounded-xl border transition-all ${
                          r.status === "parsed"
                            ? "bg-white border-gray-200 shadow-sm hover:shadow-md"
                            : r.status === "error"
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200 animate-pulse"
                        }`}
                      >
                        {/* Header — always visible */}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 ${
                            r.status === "parsed" ? "cursor-pointer" : ""
                          }`}
                          onClick={() => r.status === "parsed" && toggleExpand(r.name)}
                        >
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                            r.text.includes("全栈") || r.text.includes("6年") || r.text.includes("5年")
                              ? "bg-indigo-500"
                              : r.text.includes("4年") || r.text.includes("3年")
                              ? "bg-blue-500"
                              : "bg-gray-400"
                          }`}>
                            {firstLine.charAt(0)}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800 text-sm truncate">
                                {firstLine}
                              </span>
                              {experience && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                                  {experience}经验
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {r.status === "parsed" ? (
                                <>
                                  <span className="text-xs text-gray-400">
                                    {wordCount} 字
                                  </span>
                                  <span className="text-xs text-gray-300">·</span>
                                  <span className="text-xs text-blue-500">{isExpanded ? "收起 ▲" : "展开预览 ▼"}</span>
                                </>
                              ) : r.status === "error" ? (
                                <span className="text-xs text-red-500">{r.error}</span>
                              ) : (
                                <span className="text-xs text-gray-400">解析中...</span>
                              )}
                            </div>
                          </div>

                          {/* Status + Remove */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              r.status === "parsed"
                                ? "bg-green-100 text-green-700"
                                : r.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-200 text-gray-500"
                            }`}>
                              {r.status === "parsed" ? "就绪" : r.status === "error" ? "失败" : "处理中"}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeResume(r.name); }}
                              className="text-gray-300 hover:text-red-400 text-lg leading-none p-1"
                              title="移除"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && r.status === "parsed" && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                              <pre className="text-xs text-gray-700 font-sans whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                {r.text}
                              </pre>
                            </div>
                            <div className="flex gap-4 mt-3 text-xs text-gray-400">
                              <span>📝 {wordCount} 字</span>
                              <span>📄 {r.text.split("\n").filter(l => l.trim()).length} 行</span>
                              <span>📋 {r.name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Screen button */}
            {resumes.filter((r) => r.status === "parsed").length > 0 && (
              <button
                onClick={handleScreen}
                disabled={screening}
                className="mt-6 w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {screening ? "🤖 AI 正在分析每份简历..." : `🚀 开始 AI 筛选（${resumes.filter((r) => r.status === "parsed").length} 份简历）`}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">❌ {error}</div>
        )}

        {/* Results */}
        {results && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📊 筛选结果 — 按匹配度降序</h2>
              <button
                onClick={exportScreeningPdf}
                className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                📄 导出报告 PDF
              </button>
            </div>
            <div className="space-y-4">
              {results.map((r, i) => (
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
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          r.overallScore >= 80
                            ? "bg-green-100 text-green-800"
                            : r.overallScore >= 60
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.overallScore >= 80 ? "🔥 强烈推荐" : r.overallScore >= 60 ? "🟡 待定" : "🔴 不推荐"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-3xl font-bold ${
                          r.overallScore >= 80
                            ? "text-green-600"
                            : r.overallScore >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {r.overallScore}
                      </span>
                      <span className="text-gray-400">/100</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {r.dimensionScores?.map((d, j) => (
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
                        {r.highlights.map((h, k) => (
                          <li key={k}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.concerns?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-amber-700 mb-1">⚠️ 关注点</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {r.concerns.map((c, k) => (
                          <li key={k}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {r.followUpQuestions?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-1">💬 建议追问</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {r.followUpQuestions.map((q, k) => (
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

        {/* Feature Cards */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
            <h2 className="text-2xl font-semibold mb-8 text-center">核心能力</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "📋", title: "JD 智能生成", desc: "输入需求 → AI 自动解析为结构化标签" },
                { icon: "🔍", title: "简历精准匹配", desc: "支持 PDF/Word/TXT，四维度智能打分" },
                { icon: "🎤", title: "AI 语音面试", desc: "MiniMax TTS 语音面试官，自动出题+生成报告", href: "/interview/demo" },
              ].map((f, i) => (
                <div
                  key={i}
                  onClick={() => f.href && (window.location.href = f.href)}
                  className={`bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition ${f.href ? "cursor-pointer hover:border-blue-300" : ""}`}
                >
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
    </main>
  );
}
