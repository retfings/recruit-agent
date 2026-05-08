/**
 * POST /api/report/pdf
 * Generate PDF report from interview/assessment data using jsPDF
 */
import { NextRequest, NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const runtime = "nodejs";

interface PdfRequest {
  type: "interview" | "screening";
  title?: string;
  jobTitle?: string;
  candidateName?: string;
  date?: string;
  report?: {
    overallScore?: number;
    summary?: string;
    recommendation?: string;
    dimensions?: { name: string; score: number; comment?: string }[];
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    interviewSummary?: string;
    selfAssessment?: {
      dimensions: { name: string; selfScore: number; aiScore: number }[];
      bias?: number;
    };
  };
  results?: {
    candidateId: string;
    overallScore: number;
    recommendation?: string;
    dimensionScores?: { dimension: string; score: number; reasoning?: string }[];
    highlights?: string[];
    concerns?: string[];
  }[];
}

function getRecommendationLabel(score: number): string {
  if (score >= 80) return "强烈推荐";
  if (score >= 60) return "待定";
  return "不推荐";
}

function getScoreColor(score: number): [number, number, number] {
  if (score >= 80) return [34, 197, 94];  // green
  if (score >= 60) return [245, 158, 11]; // amber
  return [239, 68, 68];                    // red
}

export async function POST(req: NextRequest) {
  try {
    const body: PdfRequest = await req.json();
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    let y = 20;

    // ===== HEADER =====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Recruit Agent — AI 智能招聘报告", 105, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`生成时间: ${body.date || new Date().toLocaleString("zh-CN")}`, 105, y, { align: "center" });

    if (body.jobTitle) {
      y += 6;
      doc.text(`岗位: ${body.jobTitle}`, 105, y, { align: "center" });
    }
    if (body.candidateName) {
      y += 6;
      doc.text(`候选人: ${body.candidateName}`, 105, y, { align: "center" });
    }

    y += 10;

    if (body.type === "interview" && body.report) {
      const r = body.report;

      // Overall Score
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("综合评估", 20, y);
      y += 8;

      if (r.overallScore != null) {
        doc.setFontSize(36);
        const [cr, cg, cb] = getScoreColor(r.overallScore);
        doc.setTextColor(cr, cg, cb);
        doc.text(String(r.overallScore), 105, y, { align: "center" });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("/ 100 分", 105, y + 5, { align: "center" });
        y += 16;
      }

      if (r.recommendation) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`结论: ${r.recommendation}`, 20, y);
        y += 8;
      }

      if (r.summary) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(r.summary, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5 + 4;
      }

      // Dimensions table
      if (r.dimensions?.length) {
        y += 4;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("维度评分", 20, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [["维度", "评分", "点评"]],
          body: r.dimensions.map((d) => {
            const comment = (d.comment || "").slice(0, 80);
            return [d.name, `${d.score}/100`, comment];
          }),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Self Assessment vs AI
      if (r.selfAssessment?.dimensions?.length) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("自评 vs AI 评分对比", 20, y);
        y += 7;

        autoTable(doc, {
          startY: y,
          head: [["维度", "自评", "AI 评分", "偏差"]],
          body: r.selfAssessment.dimensions.map((d) => {
            const gap = d.selfScore - d.aiScore;
            const gapStr = gap > 0 ? `+${gap}` : String(gap);
            return [d.name, `${d.selfScore}`, `${d.aiScore}`, gapStr];
          }),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [139, 92, 246] },
        });
        y = (doc as any).lastAutoTable.finalY + 4;

        if (r.selfAssessment.bias != null) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          const biasLabel = r.selfAssessment.bias > 0
            ? `偏高 (+${r.selfAssessment.bias.toFixed(1)}) — 候选人可能过于自信`
            : r.selfAssessment.bias < 0
              ? `偏低 (${r.selfAssessment.bias.toFixed(1)}) — 候选人可能低估自己`
              : `准确 — 自评与AI评分非常一致`;
          doc.text(`自我认知偏差: ${biasLabel}`, 20, y);
          y += 8;
        }
      }

      // Strengths
      if (r.strengths?.length) {
        y += 2;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(34, 197, 94);
        doc.text("✅ 优势", 20, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        r.strengths.forEach((s) => {
          doc.text(`• ${s}`, 25, y);
          y += 5;
        });
      }

      // Weaknesses
      if (r.weaknesses?.length) {
        y += 2;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(239, 68, 68);
        doc.text("⚠️ 待改进", 20, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        r.weaknesses.forEach((w) => {
          doc.text(`• ${w}`, 25, y);
          y += 5;
        });
      }

      // Suggestions
      if (r.suggestions?.length) {
        y += 4;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(59, 130, 246);
        doc.text("💡 改进建议", 20, y);
        doc.setTextColor(0, 0, 0);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        r.suggestions.forEach((sg, i) => {
          doc.text(`${i + 1}. ${sg}`, 25, y);
          y += 5;
        });
      }

      if (r.interviewSummary) {
        y += 6;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("面试总结", 20, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(r.interviewSummary, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5;
      }

    } else if (body.type === "screening" && body.results) {
      // Screening results table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("批量筛选结果", 20, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["排名", "候选人", "综合分", "推荐结论", "关键维度"]],
        body: body.results.map((r, i) => {
          const dims = (r.dimensionScores || [])
            .map((d) => `${d.dimension}:${d.score}`)
            .join(", ");
          const label = getRecommendationLabel(r.overallScore);
          return [
            `#${i + 1}`,
            r.candidateId.slice(0, 12),
            `${r.overallScore}`,
            label,
            dims.slice(0, 60),
          ];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Per-candidate detail
      body.results.forEach((r, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(245, 245, 245);
        doc.rect(18, y, 175, 8, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`#${idx + 1}  ${r.candidateId} — ${r.overallScore}分`, 20, y + 5.5);
        y += 12;

        if (r.dimensionScores?.length) {
          autoTable(doc, {
            startY: y,
            head: [["维度", "分数", "分析"]],
            body: r.dimensionScores.map((d) => [d.dimension, `${d.score}`, (d.reasoning || "").slice(0, 80)]),
            styles: { fontSize: 7 },
            headStyles: { fillColor: [100, 100, 100] },
          });
          y = (doc as any).lastAutoTable.finalY + 4;
        }

        if (r.highlights?.length) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(34, 197, 94);
          doc.text("亮点:", 20, y);
          doc.setTextColor(0, 0, 0);
          r.highlights.slice(0, 3).forEach((h) => {
            doc.text(`• ${h.slice(0, 80)}`, 32, y);
            y += 4;
          });
        }

        if (r.concerns?.length) {
          doc.setTextColor(245, 158, 11);
          doc.text("关注:", 20, y);
          doc.setTextColor(0, 0, 0);
          r.concerns.slice(0, 2).forEach((c) => {
            doc.text(`• ${c.slice(0, 80)}`, 32, y);
            y += 4;
          });
        }

        y += 4;
      });
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Recruit Agent · AI 智能招聘平台 · 第 ${i}/${pages} 页`,
        105,
        290,
        { align: "center" }
      );
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recruit-report-${Date.now()}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: `PDF 生成失败: ${err.message}` }, { status: 500 });
  }
}
