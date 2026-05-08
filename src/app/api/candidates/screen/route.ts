/**
 * POST /api/candidates/screen
 * 批量简历筛选：输入 JD + 简历列表，返回匹配排序
 */
import { NextRequest, NextResponse } from "next/server";
import { batchScreenResumes } from "@/lib/agents";
import type { Job, Candidate } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { job, candidates } = await req.json();

    if (!job || !candidates?.length) {
      return NextResponse.json(
        { error: "请提供岗位信息和至少一份候选人简历" },
        { status: 400 }
      );
    }

    const results = await batchScreenResumes(
      job as Job,
      candidates as Candidate[],
      (completed, total) => {
        console.log(`Screening progress: ${completed}/${total}`);
      }
    );

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    console.error("Failed to screen candidates:", err);
    return NextResponse.json(
      { error: "简历筛选失败" },
      { status: 500 }
    );
  }
}
