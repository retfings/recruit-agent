"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleCreateJob = async () => {
    if (!title || !description) return;
    setLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h1 className="text-4xl font-bold mb-4">
            Recruit Agent 🤖
          </h1>
          <p className="text-xl text-blue-100 mb-2">
            AI 智能招聘平台 — 让 Agent 替你筛选、面试、评估候选人
          </p>
          <p className="text-sm text-blue-200">
            降本 70%，提速 10x，HR 只做最后的决策
          </p>
        </div>
      </div>

      {/* Quick Start: Create Job */}
      <div className="max-w-3xl mx-auto px-6 -mt-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">🚀 快速开始：创建岗位</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                岗位名称
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：高级前端工程师"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                职位描述 (JD)
              </label>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="粘贴或描述职位要求...&#10;&#10;例：我们正在寻找一位高级前端工程师，负责公司核心产品的前端架构设计和开发。要求：3年以上 React 经验，熟悉 TypeScript..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleCreateJob}
              disabled={loading || !title || !description}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? "AI 解析中..." : "创建岗位 → AI 自动解析需求"}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-3">
                ✅ 岗位创建成功！AI 已解析以下需求：
              </h3>
              <div className="space-y-2">
                {result.structuredRequirements?.map((req: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.level === "must"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {req.level === "must" ? "必须" : "加分"}
                    </span>
                    <span className="text-gray-500 capitalize">
                      {req.category === "skill"
                        ? "🛠"
                        : req.category === "experience"
                        ? "💼"
                        : req.category === "education"
                        ? "🎓"
                        : "🤝"}{" "}
                      {req.name}
                    </span>
                    {req.yearsRequired && (
                      <span className="text-gray-400">
                        {req.yearsRequired}年+
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push(`/jobs/${result.id}`)}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
              >
                查看岗位详情 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-8 text-center">核心能力</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "📋",
              title: "JD 智能生成",
              desc: "输入岗位需求，AI 自动生成专业职位描述并提取结构化需求标签",
            },
            {
              icon: "🔍",
              title: "简历精准匹配",
              desc: "多维度打分：技能、经验、学历、素质。每项判断附带原文引用",
            },
            {
              icon: "🎤",
              title: "AI 模拟面试",
              desc: "根据 JD + 简历自动出题，实时评估追问，生成综合面试报告",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
