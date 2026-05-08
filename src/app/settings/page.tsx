"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "recruit_agent_minimax_key";
const DEFAULT_INVITE_CODE = "jackliu";

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      setHasKey(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(STORAGE_KEY, apiKey.trim());
    setSaved(true);
    setHasKey(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInviteCode = async () => {
    setInviteError("");
    setInviteSuccess(false);

    if (inviteCode.trim().toLowerCase() !== DEFAULT_INVITE_CODE) {
      setInviteError("邀请码无效");
      return;
    }

    // Invite code valid → fetch server-configured key
    try {
      const res = await fetch("/api/tts/check-key");
      const data = await res.json();

      if (data.key) {
        localStorage.setItem(STORAGE_KEY, data.key);
        setApiKey(data.key);
        setHasKey(true);
        setInviteSuccess(true);
        setInviteError("");
      } else {
        setInviteError("服务器未配置 MiniMax API Key，请手动输入");
      }
    } catch {
      setInviteError("网络错误，请稍后重试");
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey("");
    setHasKey(false);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <a href="/" className="text-blue-600 hover:underline text-sm mb-6 block">
          ← 返回首页
        </a>

        <h1 className="text-3xl font-bold mb-2">⚙️ 语音面试设置</h1>
        <p className="text-gray-500 mb-8">
          配置 MiniMax API Key 以启用 AI 语音面试功能
        </p>

        {/* Invite Code */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-3">🎫 使用邀请码加载 Key</h2>
          <p className="text-sm text-gray-500 mb-3">
            输入管理员提供的邀请码，自动加载系统配置的 API Key
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="输入邀请码"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleInviteCode}
              disabled={!inviteCode.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              验证
            </button>
          </div>
          {inviteError && (
            <p className="mt-2 text-sm text-red-600">❌ {inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="mt-2 text-sm text-green-600">
              ✅ 邀请码验证成功，API Key 已自动加载
            </p>
          )}
        </div>

        {/* Manual API Key */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-3">🔑 手动配置 API Key</h2>
          <p className="text-sm text-gray-500 mb-3">
            从{" "}
            <a
              href="https://platform.minimaxi.com"
              target="_blank"
              className="text-blue-600 underline"
            >
              MiniMax 开放平台
            </a>{" "}
            获取 API Key，粘贴到下方
          </p>
          <div className="flex gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="粘贴 MiniMax API Key..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
            />
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              保存
            </button>
          </div>
          {saved && (
            <p className="mt-2 text-sm text-green-600">✅ 已保存到本地</p>
          )}
          {hasKey && (
            <div className="mt-4 flex items-center gap-4">
              <span className="text-sm text-gray-500">
                🟢 API Key 已配置 ({apiKey.slice(0, 8)}...{apiKey.slice(-4)})
              </span>
              <button
                onClick={handleClear}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                清除
              </button>
            </div>
          )}
        </div>

        {/* Quick nav */}
        {hasKey && (
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push("/interview/demo")}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
            >
              🎤 开始语音面试 Demo →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
