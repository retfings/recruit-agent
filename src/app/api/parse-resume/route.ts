/**
 * POST /api/parse-resume
 * 上传简历文件，解析为纯文本
 * 支持: PDF, DOCX, TXT
 */

import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

// Dynamic import for pdfjs-dist (heavy ESM module)
async function parsePDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Use a minimal worker approach for server-side
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "请上传至少一个文件" }, { status: 400 });
    }

    const results: { name: string; text: string; error?: string }[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split(".").pop()?.toLowerCase();

        let text = "";

        switch (ext) {
          case "txt":
            text = new TextDecoder().decode(buffer);
            break;

          case "pdf":
            text = await parsePDF(buffer);
            break;

          case "docx":
            const docxResult = await mammoth.extractRawText({ buffer });
            text = docxResult.value;
            break;

          default:
            results.push({
              name: file.name,
              text: "",
              error: `不支持 .${ext}，请上传 PDF/Word/TXT`,
            });
            continue;
        }

        text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

        if (!text) {
          results.push({ name: file.name, text: "", error: "文件为空" });
          continue;
        }

        results.push({ name: file.name, text });
      } catch (err: any) {
        results.push({
          name: file.name,
          text: "",
          error: `解析失败: ${err.message}`,
        });
      }
    }

    return NextResponse.json({ results, total: results.length });
  } catch (err: any) {
    console.error("Resume parse error:", err);
    return NextResponse.json({ error: "文件解析失败" }, { status: 500 });
  }
}
