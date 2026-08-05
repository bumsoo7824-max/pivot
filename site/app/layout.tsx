import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { meta } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supply-Pivot — 데이터로 발굴한 공급망 사각지대와 대체 경로",
  description:
    "관세청 수출입통계로 구조적 취약성을 깔고, 한국은행 수입물가지수와 KOTRA 정책 동향으로 방아쇠를 당긴다. 전시용 정적 데모.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const built = meta.generated_at.slice(0, 10);
  return (
    <html lang="ko">
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-5 py-10">{children}</main>
        <footer className="border-t border-white/10 px-5 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Supply-Pivot 전시용 데모 · 모든 수치는 빌드 시점({built})에 사전 계산된 값이며
              화면에서 외부 API를 호출하지 않는다.
            </p>
            <p>관세청 · 한국은행 ECOS · KOTRA · UN Comtrade</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
