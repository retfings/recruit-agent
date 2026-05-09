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

const MINIMAX_URL = "https://api.minimaxi.com/v1/chat/completions";

/** MiniMax M2 models include <think>...</think> — strip before parsing */
function stripThinking(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

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
      "算法工程师": "你面试的是一位算法工程师候选人。重点考察：数据结构与算法基础、时间空间复杂度、机器学习基础、模型评估与调参。给出实际算法场景题。",
      "大模型": "你面试的是一位大模型/LLM 方向候选人。重点考察：Transformer 原理、预训练/微调/RLHF、RAG、推理优化、幻觉问题。追问具体实现细节。",
      "AIGC": "你面试的是一位 AIGC 应用方向候选人。重点考察：扩散模型原理、多模态模型、Prompt Engineering、图像/视频生成。追问项目中的技术选型。",
      "AI Agent": "你面试的是一位 AI Agent 智能体方向候选人。重点考察：Agent 架构、ReAct 模式、多 Agent 协作、LangChain 框架、工具调用与安全。追问搭建过的 Agent 系统细节。",
      "MLOps": "你面试的是一位 MLOps 工程方向候选人。重点考察：模型训练 pipeline、CI/CD/CT、模型 serving、AB 测试、模型监控。追问线上部署实际问题。",
      "数据分析": "你面试的是一位数据分析方向候选人。重点考察：SQL 查询与优化、统计推断、AB 实验设计、数据可视化、Python 数据处理。给出实际业务场景题。",
      "行为面试": "你正在进行行为面试（STAR 法则）。重点考察：团队协作、冲突处理、领导力、压力应对、失败反思。让候选人给出具体的真实案例，追问情境-任务-行动-结果。",
      "管理岗": "你面试的是一位管理岗候选人。重点考察：团队建设、项目管理、战略规划、跨部门协调、人才培养。追问具体的团队规模和实际案例。",
    };

    const templatePrompt = template ? (TEMPLATE_PROMPTS[template] || "") : "";

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 MiniMax API Key" }, { status: 500 });
    }

    const isFirstTurn = !history || history.length === 0;
    const jobContext = jobTitle ? `岗位：${jobTitle}` : "";

    const COMPANY_MAP: Record<string, string> = {
      "前端专场": "星辰科技（StarTech）",
      "后端专场": "星辰科技（StarTech）",
      "算法工程师": "深智算法（DeepMind Labs 中国分部）",
      "大模型": "启元智能（OriginAI）",
      "AIGC": "像素涌现（PixelGen）",
      "AI Agent": "智体科技（AgentX）",
      "MLOps": "数帆科技（DataSail）",
      "数据分析": "观远数据（InsightView）",
      "行为面试": "星辰科技（StarTech）",
      "管理岗": "星辰科技（StarTech）",
    };
    const company = (template && COMPANY_MAP[template]) ? COMPANY_MAP[template] : "星辰科技（StarTech）";
    const roleName = template || "技术";

    const systemPrompt = `你是一位资深的 HR 面试官，代表【${company}】，正在面试一位【${roleName}】岗位的候选人。${jobContext}

${templatePrompt}

面试流程要求：
1. 第一句话自我介绍："你好！欢迎参加${company}的${roleName}面试，我是今天的面试官..." 然后自然地提出第一个问题
2. 每次只问一个问题，不要一次问多个
3. 根据候选人的回答动态调整下一个问题——可以追问细节、深挖技术点、切换话题
4. 覆盖维度：技术深度、项目经验、解决问题能力、沟通表达、团队协作、学习能力、职业规划
5. 面试总共约 5-7 轮
6. 最后一轮（isComplete=true 时），问题必须是："好的，我们今天的面试就到这里。你对我们公司或者这个岗位还有什么想了解的吗？"
7. 提问风格专业但不冷酷，就像一个经验丰富的面试官

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

    const resp = await fetch(MINIMAX_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-M2.5",
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
      console.error("MiniMax chat error:", resp.status);
      return NextResponse.json({ error: "AI 请求失败" }, { status: resp.status });
    }

    const data = await resp.json();
    const raw = stripThinking(data.choices?.[0]?.message?.content || "");

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
