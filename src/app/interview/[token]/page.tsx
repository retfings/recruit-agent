"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

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

interface ChatMessage {
  role: "interviewer" | "candidate";
  content: string;
  audioUrl?: string | null;
}

// Convert hex to audio blob URL
function hexToAudioUrl(hex: string, format = "mp3"): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  const blob = new Blob([bytes], { type: `audio/${format}` });
  return URL.createObjectURL(blob);
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("male-qn-qingse");
  const [speed, setSpeed] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"countdown" | "intro" | "qa" | "done">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [error, setError] = useState("");
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);

  // Predefined demo questions
  const demoQuestions = [
    "你好！欢迎参加今天的模拟面试。首先，请简单介绍一下你自己，包括你的技术背景和主要项目经验。",
    "请描述一个你遇到的最有挑战性的技术问题，以及你是如何解决的？",
    "在你之前的项目中，你是如何进行技术选型的？举一个具体的例子。",
    "你如何看待代码质量？你通常会采取哪些措施来保证代码的可维护性？",
    "最后一个问题：你对未来3年的职业规划是什么？",
    "好的，面试到此结束。感谢你的参与，系统正在生成评估报告..."
  ];

  // Load API key
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  // Auto-play pending audio
  useEffect(() => {
    if (pendingAudio && audioRef.current) {
      audioRef.current.src = pendingAudio;
      audioRef.current.play().catch((e) => console.log("Autoplay blocked:", e));
      setPendingAudio(null);
    }
  }, [pendingAudio]);

  // 3-2-1 countdown → auto-start interview
  useEffect(() => {
    if (phase !== "countdown" || !apiKey) return;
    if (countdown <= 0) {
      startInterview();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase, apiKey]);

  // TTS: text → audio URL
  const speak = useCallback(async (text: string): Promise<string | null> => {
    const key = apiKey || localStorage.getItem(STORAGE_KEY);
    if (!key) {
      setError("未配置 API Key，请先去设置页配置");
      return null;
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          speed,
          emotion: "happy",
          model: "speech-2.8-hd",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "TTS 失败");
      }
      const data = await res.json();
      return hexToAudioUrl(data.audio, data.format);
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [apiKey, voiceId, speed]);

  // Start interview
  const startInterview = async () => {
    setLoading(true);
    setPhase("qa");
    setError("");

    const firstMsg: ChatMessage = {
      role: "interviewer",
      content: demoQuestions[0],
    };
    const audioUrl = await speak(firstMsg.content);
    firstMsg.audioUrl = audioUrl;

    setMessages([firstMsg]);
    setQuestionIndex(0);
    setLoading(false);
    if (audioUrl) setPendingAudio(audioUrl);
  };

  // Voice input — start/stop speech recognition
  const toggleListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("浏览器不支持语音识别，请使用 Chrome");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setCurrentAnswer((prev) => prev + transcript);
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      console.log("Speech error:", event.error);
      setListening(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  // Submit answer
  const handleSubmitAnswer = async (messagesForReport?: ChatMessage[]) => {
    if (!currentAnswer.trim()) return;

    const answer: ChatMessage = {
      role: "candidate",
      content: currentAnswer.trim(),
    };
    const newMessages = [...(messagesForReport || messages), answer];
    setMessages(newMessages);
    setCurrentAnswer("");

    const nextIdx = questionIndex + 1;
    // Last real question is index 4 (index 5 is closing message)
    const lastQuestionIdx = demoQuestions.length - 2;

    if (questionIndex >= lastQuestionIdx) {
      // Speak closing message then show report
      setLoading(true);
      const closing: ChatMessage = {
        role: "interviewer",
        content: demoQuestions[demoQuestions.length - 1],
      };
      const audioUrl = await speak(closing.content);
      closing.audioUrl = audioUrl;
      setMessages([...newMessages, closing]);
      setPhase("done");
      setLoading(false);
      setReportLoading(true);
      await generateReport([...newMessages, closing]);
      setReportLoading(false);
      return;
    }

    setLoading(true);
    const nextQ: ChatMessage = {
      role: "interviewer",
      content: demoQuestions[nextIdx],
    };
    const audioUrl = await speak(nextQ.content);
    nextQ.audioUrl = audioUrl;

    setMessages([...newMessages, nextQ]);
    setQuestionIndex(nextIdx);
    setLoading(false);
    if (audioUrl) setPendingAudio(audioUrl);
  };

  // Generate interview evaluation report
  const generateReport = async (msgs: ChatMessage[]) => {
    const qaPairs = [];
    for (let i = 0; i < msgs.length - 1; i += 2) {
      const q = msgs[i];
      const a = msgs[i + 1];
      if (q?.role === "interviewer" && a?.role === "candidate") {
        qaPairs.push({ question: q.content, answer: a.content });
      }
    }
    if (qaPairs.length === 0) return;

    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaPairs }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const err = await res.json();
        setError(err.error || "评估生成失败");
      }
    } catch (err: any) {
      setError("评估生成失败: " + err.message);
    }
  };

  // Render
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white">← 返回</a>
            <h1 className="text-lg font-semibold">🎤 AI 语音模拟面试</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none text-xs"
            >
              {MINIMAX_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs">
              语速:
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none"
              >
                <option value="0.6">0.6x</option>
                <option value="0.8">0.8x</option>
                <option value="1">1x</option>
                <option value="1.2">1.2x</option>
                <option value="1.5">1.5x</option>
              </select>
            </label>
            <span className="text-gray-400 text-xs">
              {phase === "qa" ? `Q${questionIndex + 1}/${demoQuestions.length - 1}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {!apiKey && (
          <div className="bg-amber-900/50 border border-amber-700 text-amber-200 rounded-lg p-4 mb-6">
            ⚠️ 未配置 MiniMax API Key —{" "}
            <a href="/settings" className="underline font-medium">前往设置</a>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg p-3 mb-6 text-sm">
            ❌ {error}
            <button onClick={() => setError("")} className="ml-2 underline">关闭</button>
          </div>
        )}

        {/* Countdown */}
        {phase === "countdown" && (
          <div className="text-center py-24">
            <div className="text-8xl font-bold mb-4 animate-pulse text-blue-400">
              {countdown}
            </div>
            <p className="text-gray-400 text-lg">
              面试即将开始，请准备好你的麦克风 🎤
            </p>
            <button
              onClick={() => { setCountdown(0); }}
              className="mt-6 text-sm text-gray-500 hover:text-gray-300 underline"
            >
              跳过倒计时
            </button>
          </div>
        )}

        {/* Chat */}
        {phase !== "countdown" && (
          <>
            <div ref={chatRef} className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "candidate" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                      msg.role === "candidate"
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-gray-800 border border-gray-700 rounded-bl-md"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs opacity-70">
                        {msg.role === "interviewer" ? "🤖 AI 面试官" : "👤 我"}
                      </span>
                      {msg.audioUrl && (
                        <button
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.src = msg.audioUrl!;
                              audioRef.current.play().catch(() => {});
                            }
                          }}
                          className="text-xs opacity-70 hover:opacity-100 underline"
                        >
                          🔊 播放
                        </button>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-bl-md px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      <span className="text-sm text-gray-400">AI 正在准备下一个问题...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            {phase === "qa" && (
              <div className="border-t border-gray-700 pt-4">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitAnswer();
                        }
                      }}
                      placeholder="输入回答或点击麦克风语音输入... (Enter 发送)"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none pr-12"
                    />
                    <button
                      onClick={toggleListening}
                      className={`absolute right-2 bottom-2 w-9 h-9 rounded-lg flex items-center justify-center transition ${
                        listening
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                      title="语音输入"
                    >
                      🎤
                    </button>
                  </div>
                  <button
                    onClick={() => handleSubmitAnswer()}
                    disabled={!currentAnswer.trim() || loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium self-end transition"
                  >
                    发送
                  </button>
                </div>
                {listening && (
                  <p className="text-xs text-green-400 mt-2 animate-pulse">
                    🎤 正在聆听... 请说出你的回答
                  </p>
                )}
              </div>
            )}

            {phase === "done" && (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-2xl font-bold mb-3">面试结束！</h2>
                </div>

                {/* Loading */}
                {reportLoading && (
                  <div className="text-center py-8">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-400">AI 正在分析你的回答，生成评估报告...</p>
                  </div>
                )}

                {/* Report */}
                {report && !reportLoading && (
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 space-y-5">
                    {/* Overall Score */}
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-blue-500 bg-blue-500/10 mb-3">
                        <span className="text-3xl font-bold text-blue-400">{report.overallScore}</span>
                      </div>
                      <h3 className="text-lg font-semibold">综合评分</h3>
                      <p className="text-gray-400 text-sm mt-1 max-w-lg mx-auto">{report.summary}</p>
                      {report.recommendation && (
                        <div className={`mt-3 inline-block px-4 py-1 rounded-full text-sm font-medium ${
                          report.recommendation.includes("通过")
                            ? "bg-green-900/50 text-green-400 border border-green-700"
                            : report.recommendation.includes("复试")
                            ? "bg-amber-900/50 text-amber-400 border border-amber-700"
                            : "bg-red-900/50 text-red-400 border border-red-700"
                        }`}>
                          {report.recommendation}
                        </div>
                      )}
                    </div>

                    {/* Dimension Scores */}
                    <div>
                      <h4 className="font-medium mb-3 text-gray-300">📊 维度评分</h4>
                      <div className="space-y-3">
                        {report.dimensions?.map((d: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-400">{d.name}</span>
                              <span className="text-sm font-medium">{d.score}/100</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  d.score >= 80 ? "bg-green-500" : d.score >= 60 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${d.score}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{d.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
                        <h4 className="font-medium text-green-400 mb-2">✅ 优势</h4>
                        <ul className="space-y-1">
                          {report.strengths?.map((s: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                              <span>•</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
                        <h4 className="font-medium text-red-400 mb-2">⚠️ 待改进</h4>
                        <ul className="space-y-1">
                          {report.weaknesses?.map((w: string, i: number) => (
                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                              <span>•</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {report.suggestions?.length > 0 && (
                      <div className="bg-gray-750 border border-gray-600 rounded-xl p-4">
                        <h4 className="font-medium text-gray-300 mb-2">💡 改进建议</h4>
                        <ul className="space-y-1">
                          {report.suggestions.map((sg: string, i: number) => (
                            <li key={i} className="text-sm text-gray-400 flex gap-2">
                              <span>{i + 1}.</span> {sg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Restart */}
                <div className="text-center pb-8">
                  <button
                    onClick={() => {
                      setPhase("countdown");
                      setCountdown(3);
                      setMessages([]);
                      setQuestionIndex(0);
                      setReport(null);
                    }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition"
                  >
                    重新开始
                  </button>
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
