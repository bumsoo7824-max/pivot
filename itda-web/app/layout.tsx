import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "잇다(IT-DA) — 재북 경력을 남한 직무로 잇다",
  description:
    "북한이탈주민의 재북 경력·학력을 NCS 기반 남한 직무로 치환해주는 AI 매칭 서비스 잇다(IT-DA) 데모",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
