"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const STORAGE_KEY = "recruit_agent_interviews";

interface InterviewRecord {
  id: string;
  date: string;
  jobTitle: string;
  template: string;
  candidateName: string;
  overallScore: number;
  dimensions: { name: string; score: number; comment?: string }[];
  selfAssessment?: {
    dimensions: { name: string; selfScore: number; aiScore: number }[];
    bias: number;
  };
  qaCount: number;
  recommendation: string;
  report: any;
}

interface ExpandedState {
  id: string | null;
  detail: InterviewRecord | null;
  compareIds: Set<string>;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50";
  if (score >= 60) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function getBadgeColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 60) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function getLabel(score: number): string {
  if (score >= 80) return "🔥 强烈推荐";
  if (score >= 60) return "🟡 待定";
  return "🔴 不推荐";
}

// Canvas radar chart
function drawRadarChart(
  ctx: CanvasRenderingContext2D,
  size: number,
  labels: string[],
  datasets: { label: string; values: number[]; color: string }[]
) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const count = labels.length;

  ctx.clearRect(0, 0, size, size);

  // Background grid
  for (let level = 1; level <= 5; level++) {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const r = (radius * level) / 5;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis lines
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.stroke();
  }

  // Labels
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#374151";
  ctx.textAlign = "center";
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const lr = radius + 18;
    ctx.fillText(labels[i], cx + lr * Math.cos(angle), cy + lr * Math.sin(angle) + 4);
  }

  // Data polygons
  datasets.forEach((ds) => {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const val = Math.min(ds.values[i], 100) / 100;
      const r = radius * val;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = ds.color + "33";
    ctx.fill();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    datasets.forEach((ds2, di) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const val = Math.min(ds2.values[i], 100) / 100;
        const r = radius * val;
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(angle), cy + r * Math.sin(angle), 3, 0, Math.PI * 2);
        ctx.fillStyle = ds2.color;
        ctx.fill();
      }
    });
  });

  // Legend
  let lx = 10;
  let ly = size - 16;
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  datasets.forEach((ds) => {
    ctx.fillStyle = ds.color;
    ctx.fillRect(lx, ly - 8, 12, 8);
    ctx.fillStyle = "#374151";
    ctx.fillText(ds.label, lx + 16, ly);
    lx += 80 + ctx.measureText(ds.label).width;
  });
}

export default function DashboardPage() {
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [detail, setDetail] = useState<InterviewRecord | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        setRecords(arr.sort((a: InterviewRecord, b: InterviewRecord) => b.overallScore - a.overallScore));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const size = 340;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const selected = records.filter((r) => compareIds.has(r.id)).slice(0, 4);
    if (selected.length === 0 && records.length > 0) {
      // Draw top 2 by default
      const top2 = records.slice(0, 2);
      const dimNames = top2[0]?.dimensions?.map((d) => d.name) || [];
      if (dimNames.length === 0) return;
      drawRadarChart(ctx, size, dimNames, top2.map((r, i) => ({
        label: r.candidateName || `候选人 ${i + 1}`,
        values: r.dimensions.map((d) => d.score),
        color: i === 0 ? "#3b82f6" : "#f59e0b",
      })));
    } else if (selected.length > 0) {
      const dimNames = selected[0]?.dimensions?.map((d) => d.name) || [];
      if (dimNames.length === 0) return;
      const colors = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"];
      drawRadarChart(ctx, size, dimNames, selected.map((r, i) => ({
        label: r.candidateName || `候选人 ${i + 1}`,
        values: r.dimensions.map((d) => d.score),
        color: colors[i % colors.length],
      })));
    }
  }, [records, compareIds]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportPdf = async (record: InterviewRecord) => {
    try {
      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "interview",
          title: "面试评估报告",
          jobTitle: record.jobTitle || "通用面试",
          candidateName: record.candidateName || "候选人",
          date: record.date,
          report: {
            overallScore: record.overallScore,
            recommendation: record.recommendation,
            summary: record.report?.summary || "",
            dimensions: record.dimensions,
            strengths: record.report?.strengths || [],
            weaknesses: record.report?.weaknesses || [],
            suggestions: record.report?.suggestions || [],
            interviewSummary: record.report?.interviewSummary || "",
            selfAssessment: record.selfAssessment,
          },
        }),
      });
      if (!res.ok) throw new Error("PDF 生成失败");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `面试报告-${record.candidateName || record.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`导出失败: ${err.message}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-indigo-200 hover:text-white text-sm mb-2 block">
                ← 返回首页
              </Link>
              <h1 className="text-2xl font-bold">📊 候选人对比仪表盘</h1>
              <p className="text-indigo-200 text-sm mt-1">
                可视化对比所有候选人，快速做出招聘决策
              </p>
            </div>
            <div className="text-right text-sm text-indigo-200">
              记录数: <span className="font-bold text-white">{records.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-4">
        {records.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无面试记录</h3>
            <p className="text-gray-500 mb-6">完成一次 AI 面试后，记录将自动出现在这里</p>
            <Link
              href="/interview/demo"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
            >
              🎤 开始面试
            </Link>
          </div>
        ) : (
          <>
            {/* Radar Chart Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">🎯 雷达图对比</h3>
                <p className="text-xs text-gray-400">
                  勾选下方候选人进行对比（最多 4 人）
                </p>
              </div>
              <div className="flex justify-center">
                <canvas ref={canvasRef} className="max-w-full" />
              </div>
            </div>

            {/* Comparison Table */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 overflow-x-auto">
              <h3 className="font-semibold text-gray-800 mb-4">📋 候选人总览</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">对比</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">候选人</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">岗位</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">综合分</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">推荐结论</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">问答轮数</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-100 ${
                        i % 2 === 0 ? "bg-gray-50/50" : "bg-white"
                      } hover:bg-blue-50/30 cursor-pointer`}
                      onClick={() => setDetail(r)}
                    >
                      <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleCompare(r.id)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                            compareIds.has(r.id)
                              ? "bg-indigo-500 border-indigo-500 text-white"
                              : "border-gray-300 hover:border-indigo-400"
                          }`}
                        >
                          {compareIds.has(r.id) && "✓"}
                        </button>
                      </td>
                      <td className="py-3 px-2 font-medium text-gray-800">
                        {r.candidateName || `候选人 ${i + 1}`}
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {r.jobTitle || "通用面试"} {r.template ? `· ${r.template}` : ""}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeColor(r.overallScore)}`}
                        >
                          {r.overallScore}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`text-xs font-medium ${getScoreColor(r.overallScore)} px-2 py-0.5 rounded`}>
                          {getLabel(r.overallScore)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-gray-500">{r.qaCount || "-"}</td>
                      <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setDetail(r)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            查看
                          </button>
                          <button
                            onClick={() => exportPdf(r)}
                            className="text-xs text-green-600 hover:text-green-800 underline"
                          >
                            导出
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dimension Detail */}
            {detail && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">
                    📄 {detail.candidateName || "候选人"} — 详细报告
                  </h3>
                  <button
                    onClick={() => setDetail(null)}
                    className="text-gray-400 hover:text-gray-600 text-xl"
                  >
                    ×
                  </button>
                </div>

                {/* Overall */}
                <div className="text-center mb-6 p-4 bg-gray-50 rounded-xl">
                  <div className="text-3xl font-bold text-gray-800">{detail.overallScore}
                    <span className="text-sm text-gray-400">/100</span>
                  </div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${getBadgeColor(detail.overallScore)}`}>
                    {detail.recommendation || getLabel(detail.overallScore)}
                  </div>
                  {detail.jobTitle && (
                    <p className="text-sm text-gray-500 mt-2">岗位: {detail.jobTitle}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{detail.date}</p>
                </div>

                {/* Dimensions */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-medium text-gray-700">📊 维度评分</h4>
                  {detail.dimensions?.map((d, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{d.name}</span>
                        <span className="text-sm font-medium">{d.score}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            d.score >= 80 ? "bg-green-500" : d.score >= 60 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${d.score}%` }}
                        />
                      </div>
                      {d.comment && (
                        <p className="text-xs text-gray-400 mt-1">{d.comment}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Self Assessment comparison */}
                {detail.selfAssessment && (
                  <div className="mb-6 p-4 bg-purple-50 rounded-xl">
                    <h4 className="text-sm font-medium text-purple-800 mb-3">
                      🎯 自评 vs AI 评分对比
                      <span className="ml-2 text-xs font-normal">
                        (偏差: {detail.selfAssessment.bias != null ? (
                          detail.selfAssessment.bias > 0
                            ? `+${detail.selfAssessment.bias.toFixed(1)} 偏高`
                            : detail.selfAssessment.bias < 0
                              ? `${detail.selfAssessment.bias.toFixed(1)} 偏低`
                              : "准确"
                        ) : "—"})
                      </span>
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-purple-700">
                          <th className="py-1">维度</th>
                          <th className="py-1 text-center">自评</th>
                          <th className="py-1 text-center">AI 评分</th>
                          <th className="py-1 text-center">偏差</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.selfAssessment.dimensions?.map((d, i) => {
                          const gap = d.selfScore - d.aiScore;
                          return (
                            <tr key={i} className="border-t border-purple-200">
                              <td className="py-1.5 text-purple-900">{d.name}</td>
                              <td className="py-1.5 text-center font-medium">{d.selfScore}</td>
                              <td className="py-1.5 text-center font-medium">{d.aiScore}</td>
                              <td className={`py-1.5 text-center font-medium ${
                                gap > 0 ? "text-red-600" : gap < 0 ? "text-green-600" : "text-gray-500"
                              }`}>
                                {gap > 0 ? `+${gap}` : gap}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-2">✅ 优势</h4>
                    <ul className="space-y-1">
                      {(detail.report?.strengths || []).length > 0
                        ? detail.report.strengths.map((s: string, j: number) => (
                            <li key={j} className="text-xs text-green-700">• {s}</li>
                          ))
                        : <li className="text-xs text-gray-400">暂无记录</li>
                      }
                    </ul>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-red-800 mb-2">⚠️ 待改进</h4>
                    <ul className="space-y-1">
                      {(detail.report?.weaknesses || []).length > 0
                        ? detail.report.weaknesses.map((w: string, j: number) => (
                            <li key={j} className="text-xs text-red-700">• {w}</li>
                          ))
                        : <li className="text-xs text-gray-400">暂无记录</li>
                      }
                    </ul>
                  </div>
                </div>

                {detail.report?.suggestions?.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">💡 改进建议</h4>
                    {detail.report.suggestions.map((sg: string, j: number) => (
                      <p key={j} className="text-xs text-gray-600">{j + 1}. {sg}</p>
                    ))}
                  </div>
                )}

                {detail.report?.interviewSummary && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">📝 面试总结</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{detail.report.interviewSummary}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
