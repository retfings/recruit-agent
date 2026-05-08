/**
 * POST /api/jobs
 * 创建招聘岗位，自动解析 JD 为结构化需求
 */
import { NextRequest, NextResponse } from "next/server";
import { parseJDToRequirements } from "@/lib/agents";

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();
    if (!title || !description) {
      return NextResponse.json(
        { error: "title 和 description 为必填项" },
        { status: 400 }
      );
    }

    const requirements = await parseJDToRequirements(description);

    // In production: save to DB
    const job = {
      id: crypto.randomUUID(),
      title,
      description,
      structuredRequirements: requirements,
      status: "draft" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json(job);
  } catch (err) {
    console.error("Failed to create job:", err);
    return NextResponse.json(
      { error: "岗位创建失败" },
      { status: 500 }
    );
  }
}
