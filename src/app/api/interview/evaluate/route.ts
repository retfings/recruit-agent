/**
 * POST /api/interview/evaluate
 * Takes Q&A history with intents, returns comprehensive evaluation report
 */
import { NextRequest, NextResponse } from "next/server";

const MINIMAX_URL = "https://api.minimaxi.com/v1/chat/completions";

/** MiniMax M2 models include <think>...</think> and sometimes ```json blocks — strip before parsing */
function stripThinking(content: string): string {
  let c = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const m = c.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (m) c = m[1].trim();
  return c;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { qaPairs } = body; // [{question, answer, intent?, feedback?}]

    if (!qaPairs || qaPairs.length === 0) {
      return NextResponse.json({ error: "缺少问答内容" }, { status: 400 });
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 MiniMax API Key" }, { status: 500 });
    }

    const qaText = qaPairs
      .map(
        (qa: any, i: number) =>
          `Q${i + 1}: ${qa.question}\n  考察意图: ${qa.intent || "综合评估"}\nA${i + 1}: ${qa.answer}\n  即时点评: ${qa.feedback?.praise || "无"} | 不足: ${qa.feedback?.critique || "无"}`
      )
      .join("\n\n");

    const prompt = `你是一位资深 HR 面试官。请根据以下面试问答及考察意图，生成最终评估报告。

${qaText}

请综合所有问题和回答，给出全面评估。返回 JSON：

{
  "overallScore": 82,
  "summary": "一句话总结候选人整体表现",
  "dimensions": [
    {"name": "技术深度", "score": 85, "comment": "结合问答中的具体表现点评"},
    {"name": "项目经验", "score": 80, "comment": "..."},
    {"name": "解决问题", "score": 78, "comment": "..."},
    {"name": "沟通表达", "score": 82, "comment": "..."},
    {"name": "学习能力", "score": 75, "comment": "..."}
  ],
  "strengths": ["具体优势1", "具体优势2", "具体优势3"],
  "weaknesses": ["具体不足1", "具体不足2"],
  "recommendation": "推荐面试通过" | "建议复试" | "暂不推荐",
  "suggestions": ["改进建议1", "改进建议2", "改进建议3"],
  "interviewSummary": "用一段话总结整场面试的亮点和关键发现"
}

只返回 JSON，不要其他内容。`;

    const resp = await fetch(MINIMAX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-M2.5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: "AI 评估请求失败" }, { status: resp.status });
    }

    const data = await resp.json();
    const raw = stripThinking(data.choices?.[0]?.message?.content || "");

    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        let lastBrace = cleaned.lastIndexOf("}");
        while (lastBrace > 0) {
          try { parsed = JSON.parse(cleaned.substring(0, lastBrace + 1)); break; } catch {}
          lastBrace = cleaned.lastIndexOf("}", lastBrace - 1);
        }
      } catch {}
    }

    if (!parsed) {
      return NextResponse.json({ error: "AI 评估解析失败", raw }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Interview evaluate error:", err);
    return NextResponse.json({ error: "评估生成失败" }, { status: 500 });
  }
}
