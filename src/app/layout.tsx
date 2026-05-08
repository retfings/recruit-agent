import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruit Agent — AI 智能招聘平台",
  description:
    "AI Agent 驱动的企业招聘自动化平台：简历筛选、模拟面试、候选人评估，降本增效。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
