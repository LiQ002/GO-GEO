import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://geohelper.cn"),
  title: {
    default: "GEOHelper - AI 时代的品牌增长引擎",
    template: "%s | GEOHelper",
  },
  description:
    "追踪品牌在主流 AI 平台中的可见度，持续优化内容与知识资产，让品牌成为 AI 答案中的首选。",
  keywords: ["GEO", "生成式引擎优化", "AI 搜索", "品牌增长", "内容营销"],
  openGraph: {
    title: "GEOHelper - AI 时代的品牌增长引擎",
    description: "监测、洞察、优化、增长，让每一次 AI 提问都成为品牌机会。",
    locale: "zh_CN",
    siteName: "GEOHelper",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GEOHelper - AI 时代的品牌增长引擎",
    description: "让品牌成为 AI 答案中的首选。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
