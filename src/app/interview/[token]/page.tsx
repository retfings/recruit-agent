"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";

const STORAGE_KEY = "recruit_agent_minimax_key";
const MINIMAX_VOICES: { id: string; label: string }[] = [
  { id: "male-qn-qingse", label: "青涩男声" },
  { id: "male-qn-jingying", label: "精英男声" },
  { id: "male-qn-badao", label: "霸道男声" },
  { id: "female-shaonv", label: "少女音" },
  { id: "female-yujie", label: "御姐音" },
  { id: "female-tianmei", label: "甜美女声" },
  { id: "Chinese (Mandarin)_News_Anchor", label: "新闻女声" },
  { id: "Chinese (Mandarin)_Reliable_Executive", label: "沉稳高管" },
];

interface Feedback {
  praise: string;
  critique: string;
  suggestion: string;
}

interface ChatMessage {
  role: "interviewer" | "candidate" | "feedback";
  content: string;
  audioUrl?: string | null;
  intent?: string;
  feedback?: Feedback;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function hexToAudioUrl(hex: string, format = "mp3"): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  const blob = new Blob([bytes], { type: `audio/${format}` });
  return URL.createObjectURL(blob);
}

export default function VoiceInterviewPage() {
  const params = useParams();
  const token = params.token as string;
  const searchParams = useSearchParams();
  const jobTitle = searchParams.get("job") || "";

  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("male-qn-qingse");
  const [speed, setSpeed] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"countdown" | "qa" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState("");
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (pendingAudio && audioRef.current) {
      audioRef.current.src = pendingAudio;
      audioRef.current.play().catch(() => {});
      setPendingAudio(null);
    }
  }, [pendingAudio]);

  useEffect(() => {
    if (phase !== "countdown" || !apiKey) return;
    if (countdown <= 0) { startInterview(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase, apiKey]);

  // TTS
  const speak = useCallback(async (text: string): Promise<string | null> => {
    const key = apiKey || localStorage.getItem(STORAGE_KEY);
    if (!key) { setError("未配置 API Key"); return null; }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ text, voice_id: voiceId, speed, model: "speech-2.8-hd" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "TTS 失败");
      const data = await res.json();
      return hexToAudioUrl(data.audio, data.format);
    } catch (err: any) { setError(err.message); return null; }
  }, [apiKey, voiceId, speed]);

  // AI Chat — get next question + feedback
  const chatWithAI = useCallback(async (history: ChatMessage[]): Promise<{
    feedback?: Feedback;
    nextQuestion?: string;
    intent?: string;
    isComplete: boolean;
  } | null> => {
    try {
      const turns = history
        .filter((m) => m.role === "interviewer" || m.role === "candidate")
        .map((m) => ({
          role: m.role as "interviewer" | "candidate",
          content: m.content,
          intent: m.intent,
          feedback: m.feedback,
        }));

      const res = await fetch("/api/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: turns, jobTitle }),
      });
      if (res.ok) return await res.json();
      throw new Error((await res.json()).error || "AI chat 失败");
    } catch (err: any) { setError(err.message); return null; }
  }, [jobTitle]);

  // Start interview — get first question from AI
  const startInterview = async () => {
    setLoading(true);
    setPhase("qa");
    setError("");

    const result = await chatWithAI([]);
    if (!result?.nextQuestion) {
      setError("AI 无法生成面试问题"); setLoading(false); return;
    }

    const firstMsg: ChatMessage = {
      role: "interviewer",
      content: result.nextQuestion,
      intent: result.intent,
    };
    const audioUrl = await speak(firstMsg.content);
    firstMsg.audioUrl = audioUrl;

    setMessages([firstMsg]);
    setLoading(false);
    if (audioUrl) setPendingAudio(audioUrl);
  };

  // Submit answer → get feedback + next question
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || loading) return;

    const answer: ChatMessage = { role: "candidate", content: currentAnswer.trim() };
    const withAnswer = [...messages, answer];
    setMessages(withAnswer);
    setCurrentAnswer("");
    setLoading(true);

    const result = await chatWithAI(withAnswer);
    if (!result) { setLoading(false); return; }

    const newMsgs = [...withAnswer];

    // Add feedback if provided
    if (result.feedback) {
      newMsgs.push({ role: "feedback", content: "", feedback: result.feedback });
    }

    // Interview complete?
    if (result.isComplete) {
      setMessages(newMsgs);
      setPhase("done");
      setLoading(false);
      setReportLoading(true);
      await generateReport(newMsgs);
      setReportLoading(false);
      return;
    }

    // Next question
    if (result.nextQuestion) {
      const nextQ: ChatMessage = {
        role: "interviewer",
        content: result.nextQuestion,
        intent: result.intent,
      };
      const audioUrl = await speak(nextQ.content);
      nextQ.audioUrl = audioUrl;
      newMsgs.push(nextQ);
      setMessages(newMsgs);
      if (audioUrl) setPendingAudio(audioUrl);
    }

    setLoading(false);
  };

  const generateReport = async (msgs: ChatMessage[]) => {
    const qaPairs = [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role === "interviewer" && msgs[i + 1]?.role === "candidate") {
        qaPairs.push({
          question: m.content,
          answer: msgs[i + 1].content,
          intent: m.intent,
          feedback: msgs[i + 2]?.role === "feedback" ? msgs[i + 2].feedback : undefined,
        });
      }
    }
    if (qaPairs.length === 0) return;

    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaPairs }),
      });
      if (res.ok) setReport(await res.json());
      else setError((await res.json()).error || "评估失败");
    } catch (err: any) { setError("评估生成失败: " + err.message); }
  };

  // Voice input
  const toggleListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("浏览器不支持语音识别"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }

    const r = new SR();
    r.lang = "zh-CN"; r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => { setCurrentAnswer((p) => p + e.results[0]?.[0]?.transcript || ""); setListening(false); };
    r.onerror = (e: any) => { setListening(false); if (e.error !== "aborted" && e.error !== "no-speech") setError(`语音识别: ${e.error}`); };
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    r.start(); setListening(true);
  }, [listening]);

  // Render
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white">← 返回</a>
            <h1 className="text-lg font-semibold">🎤 AI 语音面试</h1>
            {jobTitle && <span className="text-sm text-gray-500">| {jobTitle}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none text-xs">
              {MINIMAX_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs">
              语速:
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none">
                <option value="0.6">0.6x</option><option value="0.8">0.8x</option>
                <option value="1">1x</option><option value="1.2">1.2x</option>
                <option value="1.5">1.5x</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {!apiKey && (
          <div className="bg-amber-900/50 border border-amber-700 text-amber-200 rounded-lg p-4 mb-6">
            ⚠️ 未配置 API Key — <a href="/settings" className="underline font-medium">前往设置</a>
          </div>
        )}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg p-3 mb-6 text-sm">
            ❌ {error} <button onClick={() => setError("")} className="ml-2 underline">关闭</button>
          </div>
        )}

        {phase === "countdown" && (
          <div className="text-center py-24">
            <div className="text-8xl font-bold mb-4 animate-pulse text-blue-400">{countdown}</div>
            <p className="text-gray-400 text-lg">面试即将开始，AI 面试官将动态出题 🎤</p>
            <button onClick={() => setCountdown(0)} className="mt-6 text-sm text-gray-500 hover:text-gray-300 underline">跳过</button>
          </div>
        )}

        {phase !== "countdown" && (
          <>
            <div ref={chatRef} className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto pr-2">
              {messages.map((msg, i) => {
                if (msg.role === "feedback" && msg.feedback) {
                  return (
                    <div key={i} className="flex justify-center my-2">
                      <div className="max-w-[85%] bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-green-400">
                          <span>👍</span> <span className="font-medium">点评</span>
                        </div>
                        <div className="text-gray-300">
                          <span className="text-green-400">✅ </span>{msg.feedback.praise}
                        </div>
                        <div className="text-gray-300">
                          <span className="text-amber-400">⚠️ </span>{msg.feedback.critique}
                        </div>
                        <div className="text-gray-300">
                          <span className="text-blue-400">💡 </span>{msg.feedback.suggestion}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={i} className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                      msg.role === "candidate"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-gray-800 border border-gray-700 rounded-bl-md"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs opacity-70">
                          {msg.role === "interviewer" ? "🤖 AI 面试官" : "👤 我"}
                        </span>
                        {msg.audioUrl && (
                          <button onClick={() => { if (audioRef.current) { audioRef.current.src = msg.audioUrl!; audioRef.current.play().catch(() => {}); } }}
                            className="text-xs opacity-70 hover:opacity-100 underline">🔊 播放</button>
                        )}
                        {msg.intent && (
                          <span className="text-xs text-gray-500 ml-1" title={msg.intent}>
                            🎯 {msg.intent.length > 25 ? msg.intent.slice(0, 25) + "..." : msg.intent}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-bl-md px-5 py-3">
                    <span className="animate-spin mr-2">⏳</span>
                    <span className="text-sm text-gray-400">AI 正在思考...</span>
                  </div>
                </div>
              )}
            </div>

            {phase === "qa" && (
              <div className="border-t border-gray-700 pt-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer(); } }}
                      placeholder="输入回答或点击 🎤 语音输入..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none pr-12"
                    />
                    <button onClick={toggleListening}
                      className={`absolute right-2 bottom-2 w-9 h-9 rounded-lg flex items-center justify-center ${
                        listening ? "bg-red-500 text-white animate-pulse" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`} title="语音输入">🎤</button>
                  </div>
                  <button onClick={() => handleSubmitAnswer()}
                    disabled={!currentAnswer.trim() || loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium self-end transition">发送</button>
                </div>
                {listening && <p className="text-xs text-green-400 mt-2 animate-pulse">🎤 正在聆听...</p>}
              </div>
            )}

            {phase === "done" && (
              <div className="space-y-4 pb-8">
                <div className="text-center py-4">
                  <div className="text-5xl mb-2">🎉</div>
                  <h2 className="text-2xl font-bold">面试评估报告</h2>
                </div>

                {reportLoading && (
                  <div className="text-center py-12">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-400">AI 正在分析面试记录，生成评估报告...</p>
                  </div>
                )}

                {report && !reportLoading && (
                  <div className="space-y-5">
                    {/* Overall */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-blue-500 bg-blue-500/10 mb-3">
                        <span className="text-3xl font-bold text-blue-400">{report.overallScore}</span>
                      </div>
                      <h3 className="text-lg font-semibold">综合评分</h3>
                      <p className="text-gray-400 text-sm mt-1 max-w-lg mx-auto">{report.summary}</p>
                      <p className="text-gray-500 text-sm mt-2 italic">{report.interviewSummary}</p>
                      {report.recommendation && (
                        <div className={`mt-3 inline-block px-4 py-1 rounded-full text-sm font-medium ${
                          report.recommendation.includes("通过") ? "bg-green-900/50 text-green-400 border border-green-700"
                          : report.recommendation.includes("复试") ? "bg-amber-900/50 text-amber-400 border border-amber-700"
                          : "bg-red-900/50 text-red-400 border border-red-700"}`}>{report.recommendation}</div>
                      )}
                    </div>

                    {/* Dimensions */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                      <h4 className="font-medium mb-4 text-gray-300">📊 维度评分</h4>
                      <div className="space-y-4">
                        {report.dimensions?.map((d: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-400">{d.name}</span>
                              <span className="text-sm font-medium">{d.score}<span className="text-gray-600">/100</span></span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div className={`h-2 rounded-full ${d.score >= 80 ? "bg-green-500" : d.score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${d.score}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{d.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Question Review */}
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
                      <h4 className="font-medium mb-4 text-gray-300">📋 问答回顾</h4>
                      <div className="space-y-4">
                        {messages
                          .filter((m) => m.role === "interviewer")
                          .map((q, qi) => {
                            const a = messages[messages.indexOf(q) + 1];
                            const fb = messages[messages.indexOf(q) + 2];
                            return (
                              <div key={qi} className="border-l-2 border-gray-700 pl-4 py-1">
                                <p className="text-sm font-medium text-gray-300">
                                  Q{qi + 1}: {q.content}
                                </p>
                                {q.intent && (
                                  <p className="text-xs text-blue-400 mt-1">
                                    🎯 考察目的: {q.intent}
                                  </p>
                                )}
                                {a?.role === "candidate" && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    答: {a.content.slice(0, 150)}{a.content.length > 150 ? "..." : ""}
                                  </p>
                                )}
                                {fb?.role === "feedback" && fb.feedback && (
                                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                    <div className="bg-green-900/20 rounded p-2">
                                      <span className="text-green-400">👍 {fb.feedback.praise.slice(0, 60)}</span>
                                    </div>
                                    <div className="bg-amber-900/20 rounded p-2">
                                      <span className="text-amber-400">⚠️ {fb.feedback.critique.slice(0, 60)}</span>
                                    </div>
                                    <div className="bg-blue-900/20 rounded p-2">
                                      <span className="text-blue-400">💡 {fb.feedback.suggestion.slice(0, 60)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Strengths/Weaknesses */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
                        <h4 className="font-medium text-green-400 mb-2">✅ 优势</h4>
                        <ul className="space-y-1">
                          {report.strengths?.map((s: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300">• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
                        <h4 className="font-medium text-red-400 mb-2">⚠️ 待改进</h4>
                        <ul className="space-y-1">
                          {report.weaknesses?.map((w: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {report.suggestions?.length > 0 && (
                      <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                        <h4 className="font-medium text-gray-300 mb-2">💡 改进建议</h4>
                        {report.suggestions.map((sg: string, i: number) => (
                          <p key={i} className="text-sm text-gray-400">{i + 1}. {sg}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-center pt-4">
                  <button onClick={() => {
                    setPhase("countdown"); setCountdown(3); setMessages([]); setCurrentAnswer(""); setReport(null);
                  }} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition">重新开始</button>
                </div>
              </div>
            )}
          </>
        )}
        <audio ref={audioRef} className="hidden" />
      </div>
    </main>
  );
}
