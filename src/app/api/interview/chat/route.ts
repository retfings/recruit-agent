/**
 * POST /api/interview/chat
 * Dynamic interview conversation — AI asks, gives feedback, adapts questions
 * 
 * Takes full conversation history, returns:
 *   feedback: real-time critique of the last answer
 *   nextQuestion: next interview question (could be follow-up)
 *   intent: what this question aims to assess
 *   isComplete: true when interview should end
 */

import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

interface Turn {
  role: "interviewer" | "candidate";
  content: string;
  intent?: string;
  feedback?: {
    praise: string;
    critique: string;
    suggestion: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { history, jobTitle, template } = body as {
      history: Turn[];
      jobTitle?: string;
      template?: string;
    };

    const TEMPLATE_PROMPTS: Record<string, string> = {
      "前端专场": "你面试的是一位前端工程师候选人。重点考察：React/Vue/TS 技术深度、CSS/性能优化、浏览器原理、工程化实践、前端架构设计。根据回答追问具体的技术细节。",
      "后端专场": "你面试的是一位后端工程师候选人。重点考察：数据库设计/优化、并发处理、系统架构、API 设计、分布式系统、DevOps。追问技术方案的 trade-off。",
      "行为面试": "你正在进行行为面试（STAR 法则）。重点考察：团队协作、冲突处理、领导力、压力应对、失败反思。让候选人给出具体的真实案例，追问情境-任务-行动-结果。",
      "管理岗": "你面试的是一位管理岗候选人。重点考察：团队建设、项目管理、战略规划、跨部门协调、人才培养。追问具体的团队规模和实际案例。",
    };

    const templatePrompt = template ? (TEMPLATE_PROMPTS[template] || "") : "";

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 DeepSeek API Key" }, { status: 500 });
    }

    const isFirstTurn = !history || history.length === 0;
    const jobContext = jobTitle ? `岗位：${jobTitle}` : "";

    const systemPrompt = `你是一位资深的 HR 面试官 AI，正在进行一场语音模拟面试。${jobContext}

${templatePrompt}

你的核心原则：
1. 每次只问一个问题，不要一次问多个
2. 根据候选人的回答动态调整下一个问题——可以追问细节、深挖技术点、切换话题
3. 覆盖维度：技术深度、项目经验、解决问题能力、沟通表达、团队协作、学习能力、职业规划
4. 面试总共约 5-7 轮，当收集到足够信息后结束
5. 提问风格专业但不冷酷，就像一个经验丰富的面试官

每个回答你需要给出：
- feedback: 对该回答的即时点评（赞扬优点 + 指出不足 + 优化建议）
- nextQuestion: 下一个问题（如面试结束则为空）
- intent: 你问这个问题的目的是什么，想考察候选人哪方面能力
- isComplete: 是否结束面试（true/false）

返回严格 JSON：
{
  "feedback": {"praise": "做得好的地方", "critique": "可以改进的地方", "suggestion": "更好的回答建议"},
  "nextQuestion": "下一个问题",
  "intent": "这个问题的考察目的",
  "isComplete": false
}`;

    const userMessage = isFirstTurn
      ? `面试刚开始，请向候选人提出第一个问题（开场+自我介绍类），尽量自然友好。`
      : `以下是目前的面试记录：

${history
  .slice(-6)
  .map(
    (t) =>
      `${t.role === "interviewer" ? "🤖 面试官" : "👤 候选人"}: ${t.content}` +
      (t.intent ? `\n  [出题意图: ${t.intent}]` : "")
  )
  .join("\n\n")}

候选人的最新回答是：${history[history.length - 1]?.content || ""}

请根据这个回答：
1. 给出即时点评（feedback: praise + critique + suggestion）
2. 决定下一个问题：可以追问细节、切换到新维度、或结束面试
3. 说明下一个问题的考察意图
4. 如果已经问够 5-7 轮且信息收集充分，设置 isComplete: true

返回 JSON，不要其他内容。`;

    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      console.error("DeepSeek chat error:", resp.status);
      return NextResponse.json({ error: "AI 请求失败" }, { status: resp.status });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Parse JSON — robust extraction
    let parsed;
    const text = raw.trim();

    // Try 1: direct parse
    try { parsed = JSON.parse(text); } catch {}

    // Try 2: extract from markdown code block
    if (!parsed) {
      const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (m) try { parsed = JSON.parse(m[1]); } catch {}
    }

    // Try 3: find outermost JSON object
    if (!parsed) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try { parsed = JSON.parse(text.substring(start, end + 1)); } catch {}
      }
    }

    // Try 4: fix truncated JSON
    if (!parsed) {
      const start = text.indexOf("{");
      let s = start >= 0 ? text.substring(start) : text;
      let lastBrace = s.lastIndexOf("}");
      while (lastBrace > 0) {
        try { parsed = JSON.parse(s.substring(0, lastBrace + 1)); break; } catch {}
        lastBrace = s.lastIndexOf("}", lastBrace - 1);
      }
    }

    if (!parsed) {
      console.error("Chat JSON parse failed. Raw:", raw.substring(0, 400));
      return NextResponse.json({ error: "AI 响应解析失败", raw }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Interview chat error:", err);
    return NextResponse.json({ error: "面试对话失败" }, { status: 500 });
  }
}
