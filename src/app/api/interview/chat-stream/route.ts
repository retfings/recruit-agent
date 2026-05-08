/**
 * POST /api/interview/chat-stream
 * Streaming version — SSE tokens → parse JSON at end
 * Uses DeepSeek stream API
 */

import { NextRequest } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

const TEMPLATE_PROMPTS: Record<string, string> = {
  "前端专场": "你面试的是一位前端工程师候选人。重点考察：React/Vue/TS 技术深度、CSS/性能优化、浏览器原理、工程化实践、前端架构设计。根据回答追问具体的技术细节。",
  "后端专场": "你面试的是一位后端工程师候选人。重点考察：数据库设计/优化、并发处理、系统架构、API 设计、分布式系统、DevOps。追问技术方案的 trade-off。",
  "算法工程师": "你面试的是一位算法工程师候选人。重点考察：数据结构与算法基础（链表/树/图/动态规划）、时间空间复杂度分析、机器学习基础（监督/无监督）、模型评估与调参。给出实际算法场景题，追问优化思路。",
  "大模型": "你面试的是一位大模型/LLM 方向候选人。重点考察：Transformer 架构原理、预训练/微调/SFT/RLHF 技术细节、Prompt Engineering、RAG（检索增强生成）、推理加速（量化/vLLM）、幻觉问题与解决。追问具体实现细节和论文理解。",
  "AIGC": "你面试的是一位 AIGC 应用方向候选人。重点考察：扩散模型（Stable Diffusion）原理、VAE/GAN/Flow 对比、多模态模型（CLIP/BLIP/DALL-E）、Prompt Engineering、图像/视频/3D 生成、生成质量评估。追问具体项目中的技术选型和优化。",
  "AI Agent": "你面试的是一位 AI Agent 智能体方向候选人。重点考察：Agent 架构设计（规划/记忆/工具使用）、ReAct/Plan-and-Execute 模式、多 Agent 协作编排、LangChain/LangGraph/AutoGPT 框架、函数调用实现、安全与对齐。追问实际搭建过的 Agent 系统细节。",
  "MLOps": "你面试的是一位 MLOps/机器学习工程方向候选人。重点考察：模型训练 pipeline、CI/CD/CT 持续训练、特征平台与特征工程、模型 serving 与 A/B 测试、模型监控与漂移检测、GPU 资源调度。追问线上部署中遇到的实际问题。",
  "数据分析": "你面试的是一位数据分析/数据科学方向候选人。重点考察：SQL 复杂查询与优化、统计推断与假设检验、AB 实验设计与评估、数据可视化叙事、Python 数据处理栈（pandas/numpy）、业务指标的拆解与归因。给出实际业务场景题。",
  "行为面试": "你正在进行行为面试（STAR 法则）。重点考察：团队协作、冲突处理、领导力、压力应对、失败反思。让候选人给出具体的真实案例，追问情境-任务-行动-结果。",
  "管理岗": "你面试的是一位管理岗候选人。重点考察：团队建设、项目管理、战略规划、跨部门协调、人才培养。追问具体的团队规模和实际案例。",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { history, jobTitle, template } = body as {
      history: { role: string; content: string; intent?: string; feedback?: any }[];
      jobTitle?: string;
      template?: string;
    };

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "未配置 DeepSeek API Key" }), { status: 500 });
    }

    const jobContext = jobTitle ? `岗位：${jobTitle}` : "";
    const templatePrompt = template ? (TEMPLATE_PROMPTS[template] || "") : "";

    const systemPrompt = `你是一位资深的 HR 面试官 AI，正在进行一场语音模拟面试。${jobContext}

${templatePrompt}

你的核心原则：
1. 每次只问一个问题，不要一次问多个
2. 根据候选人的回答动态调整下一个问题——可以追问细节、深挖技术点、切换话题
3. 覆盖维度：技术深度、项目经验、解决问题能力、沟通表达、团队协作、学习能力、职业规划
4. 面试总共约 5-7 轮，当收集到足够信息后结束
5. 提问风格专业但不冷酷，就像一个经验丰富的面试官

每个回答你必须给出（严格JSON，不要任何其他文本）：
{
  "feedback": {"praise": "做得好的地方", "critique": "可以改进的地方", "suggestion": "更好的回答建议"},
  "nextQuestion": "下一个问题",
  "intent": "这个问题的考察目的",
  "isComplete": false
}`;

    const isFirstTurn = !history || history.length === 0;
    const userMessage = isFirstTurn
      ? `面试刚开始，请向候选人提出第一个问题（开场+自我介绍类），尽量自然友好。`
      : `以下是目前的面试记录：

${history
  .slice(-6)
  .map((t) => `${t.role === "interviewer" ? "🤖 面试官" : "👤 候选人"}: ${t.content}`)
  .join("\n\n")}

候选人的最新回答是：${history[history.length - 1]?.content || ""}

请根据这个回答给出即时点评 + 下一个问题。严格返回JSON。`;

    // Call DeepSeek with streaming
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
        stream: true,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "DeepSeek 请求失败" }), { status: resp.status });
    }

    // Stream: forward DeepSeek SSE to client, accumulating content
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // DeepSeek SSE format: data: {...}\n\n
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  // Send each token as SSE to client
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`));
                }
              } catch {}
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Send completion with accumulated full content
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, content: fullContent })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Chat stream error:", err);
    return new Response(JSON.stringify({ error: "面试对话流失败" }), { status: 500 });
  }
}
