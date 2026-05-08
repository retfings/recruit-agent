/**
 * POST /api/tts — MiniMax Text-to-Speech proxy
 * 
 * Reads API key from:
 * 1. Request header `x-api-key` (frontend-configured, highest priority)
 * 2. Server env `MINIMAX_API_KEY` (via invite code or server config)
 * 
 * Proxies to MiniMax T2A v2 API, returns hex-encoded audio.
 */

import { NextRequest, NextResponse } from "next/server";

const MINIMAX_TTS_URL = "https://api.minimaxi.com/v1/t2a_v2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice_id, speed, emotion, model } = body;

    if (!text) {
      return NextResponse.json({ error: "text 是必填项" }, { status: 400 });
    }

    // API key priority: header > env
    const apiKey =
      req.headers.get("x-api-key") ||
      process.env.MINIMAX_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "未配置 MiniMax API Key，请在设置页输入或使用邀请码加载" },
        { status: 401 }
      );
    }

    const requestBody: any = {
      model: model || "speech-2.8-hd",
      text,
      stream: false,
      voice_setting: {
        voice_id: voice_id || "male-qn-qingse",
        speed: speed || 1,
        vol: 1,
        pitch: 0,
        emotion: emotion || "happy",
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1,
      },
    };

    const resp = await fetch(MINIMAX_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("MiniMax TTS error:", resp.status, errText);
      return NextResponse.json(
        { error: `TTS 请求失败: ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();

    // Return the hex audio + metadata
    return NextResponse.json({
      audio: data.data?.audio,
      format: data.extra_info?.audio_format || "mp3",
      sampleRate: data.extra_info?.audio_sample_rate || 32000,
      duration: data.extra_info?.audio_length,
      chars: data.extra_info?.usage_characters,
    });
  } catch (err: any) {
    console.error("TTS proxy error:", err);
    return NextResponse.json(
      { error: "语音合成失败" },
      { status: 500 }
    );
  }
}
