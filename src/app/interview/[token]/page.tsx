"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

const STORAGE_KEY = "recruit_agent_minimax_key";
const MINIMAX_VOICES = [
  { id: "male-qn-qingse", label: "青涩男声" },
  { id: "female-shaonv", label: "少女女声" },
  { id: "male-qn-jingying", label: "精英男声" },
  { id: "female-yujie", label: "御姐女声" },
  { id: "presenter_male", label: "男主持人" },
  { id: "presenter_female", label: "女主持人" },
];

interface ChatMessage {
  role: "interviewer" | "candidate";
  content: string;
  audioUrl?: string | null;
  playing?: boolean;
}

// Convert hex to WAV/audio URL
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

  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("male-qn-qingse");
  const [speed, setSpeed] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"intro" | "qa" | "done">("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Predefined demo questions
  const demoQuestions = [
    "你好！欢迎参加今天的模拟面试。首先，请简单介绍一下你自己，包括你的技术背景和主要项目经验。",
    "请描述一个你遇到的最有挑战性的技术问题，以及你是如何解决的？",
    "在你之前的项目中，你是如何进行技术选型的？举一个具体的例子。",
    "你如何看待代码质量？你通常会采取哪些措施来保证代码的可维护性？",
    "最后一个问题：你对未来3年的职业规划是什么？",
    "好的，面试到此结束。感谢你的参与，系统正在生成评估报告..."
  ];

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  // TTS: text → audio
  const speak = useCallback(async (text: string): Promise<string | null> => {
    const key = apiKey || localStorage.getItem(STORAGE_KEY);
    if (!key) {
      setError("未配置 API Key，请先去设置页配置");
      return null;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          speed,
          emotion: "happy",
          model: "speech-2.8-hd",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "TTS 失败");
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

    // Generate voice for first question
    const audioUrl = await speak(firstMsg.content);
    firstMsg.audioUrl = audioUrl;

    setMessages([firstMsg]);
    setQuestionIndex(0);
    setLoading(false);

    // Auto-play
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  // Submit answer
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) return;

    const answer: ChatMessage = {
      role: "candidate",
      content: currentAnswer.trim(),
    };

    const newMessages = [...messages, answer];
    setMessages(newMessages);
    setCurrentAnswer("");
    setLoading(true);

    const nextIdx = questionIndex + 1;

    if (nextIdx >= demoQuestions.length) {
      setPhase("done");
      setLoading(false);
      return;
    }

    // AI asks next question
    const nextQ: ChatMessage = {
      role: "interviewer",
      content: demoQuestions[nextIdx],
    };

    const audioUrl = await speak(nextQ.content);
    nextQ.audioUrl = audioUrl;

    setMessages([...newMessages, nextQ]);
    setQuestionIndex(nextIdx);
    setLoading(false);

    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white">← 返回</a>
            <h1 className="text-lg font-semibold">🎤 AI 语音模拟面试</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none"
            >
              {MINIMAX_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              语速:
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 outline-none"
              >
                <option value="0.8">0.8x</option>
                <option value="1">1x</option>
                <option value="1.2">1.2x</option>
                <option value="1.5">1.5x</option>
              </select>
            </label>
            <span className="text-gray-400">
              {phase === "qa" ? `Q${questionIndex + 1}/${demoQuestions.length}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {(!apiKey) && (
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

        {phase === "intro" && (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🎤</div>
            <h2 className="text-2xl font-bold mb-3">AI 语音模拟面试</h2>
            <p className="text-gray-400 mb-2 max-w-md mx-auto">
              AI 面试官将通过语音提问，您用文字回答。
              面试结束后自动生成评估报告。
            </p>
            <p className="text-sm text-gray-500 mb-8">
              面试 Token: {token} ｜ 共 {demoQuestions.length - 1} 题
            </p>
            <button
              onClick={startInterview}
              disabled={loading || !apiKey}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-lg"
            >
              {loading ? "准备中..." : "🎤 开始面试"}
            </button>
          </div>
        )}

        {phase !== "intro" && (
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
                              audioRef.current.play();
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

            {/* Input area */}
            {phase === "qa" && (
              <div className="border-t border-gray-700 pt-4">
                <div className="flex gap-3">
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitAnswer();
                      }
                    }}
                    placeholder="输入你的回答... (Enter 发送)"
                    rows={3}
                    className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!currentAnswer.trim() || loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium self-end transition"
                  >
                    发送
                  </button>
                </div>
              </div>
            )}

            {phase === "done" && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold mb-3">面试结束！</h2>
                <p className="text-gray-400 mb-6">
                  感谢参与模拟面试。评估报告正在生成中...
                </p>
                <button
                  onClick={() => {
                    setPhase("intro");
                    setMessages([]);
                    setQuestionIndex(0);
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition"
                >
                  重新开始
                </button>
              </div>
            )}
          </>
        )}

        <audio ref={audioRef} className="hidden" />
      </div>
    </main>
  );
}
