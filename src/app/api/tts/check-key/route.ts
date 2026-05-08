/**
 * GET /api/tts/check-key
 * Returns server-configured MiniMax API key (only existence, not full key)
 * Used by invite code flow to check if env key is available
 */
import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.MINIMAX_API_KEY;
  return NextResponse.json({
    configured: !!key,
    key: key || null,
  });
}
