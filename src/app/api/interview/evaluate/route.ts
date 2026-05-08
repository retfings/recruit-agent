/**
 * POST /api/interview/evaluate
 * Takes Q&A history, returns evaluation report via DeepSeek
 */
import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { qaPairs } = body;

    if (!qaPairs || qaPairs.length === 0) {
      return NextResponse.json({ error: "缺少问答内容" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "服务器未配置 DeepSeek API Key" }, { status: 500 });
    }

    const qaText = qaPairs
      .map(
        (qa: { question: string; answer: string }, i: number) =>
          `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`
      )
      .join("\n\n");

    const prompt = `你是一位资深的 HR 面试官。请根据以下面试问答，对候选人进行综合评估。

${qaText}

请从以下维度打分并给出详细评估（1-100分）：

1. **沟通表达** — 语言组织、逻辑清晰度、表达自信度
2. **技术深度** — 对技术理解的深度、是否有自己的思考
3. **项目经验** — 过往项目的复杂度、个人角色和贡献
4. **解决问题** — 面对挑战时的思路和方法论
5. **综合素质** — 职业规划、团队协作、学习能力

请返回 JSON 格式：

{
  "overallScore": 82,
  "summary": "候选人整体表现 XXXX，优势在于...，需要提升的是...",
  "dimensions": [
    {"name": "沟通表达", "score": 80, "comment": "..."},
    {"name": "技术深度", "score": 85, "comment": "..."}
  ],
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["待改进1", "待改进2"],
  "recommendation": "推荐面试通过" | "建议复试" | "暂不推荐",
  "suggestions": ["改进建议1", "改进建议2"]
}

只返回 JSON，不要其他内容。`;

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("DeepSeek evaluate error:", resp.status, err);
      return NextResponse.json({ error: "AI 评估请求失败" }, { status: resp.status });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Parse JSON
    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Repair truncated JSON
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        let s = cleaned;
        let lastBrace = s.lastIndexOf("}");
        while (lastBrace > 0) {
          try { parsed = JSON.parse(s.substring(0, lastBrace + 1)); break; } catch {}
          lastBrace = s.lastIndexOf("}", lastBrace - 1);
        }
      } catch {}
    }

    if (!parsed) {
      return NextResponse.json({ error: "AI 评估解析失败", raw }, { status: 500 });
    }

    return NextResponse.json({
      overallScore: parsed.overallScore,
      summary: parsed.summary,
      dimensions: parsed.dimensions,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      recommendation: parsed.recommendation,
      suggestions: parsed.suggestions,
    });
  } catch (err: any) {
    console.error("Interview evaluate error:", err);
    return NextResponse.json({ error: "评估生成失败" }, { status: 500 });
  }
}
