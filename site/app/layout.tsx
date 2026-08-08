import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import { meta } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supply-Pivot — 공급망 사각지대 조기경보 · 대체 공급국 조회",
  description:
    "관세청 수출입통계로 구조적 취약성을 진단하고, 한국은행 수입물가지수와 KOTRA 정책 동향으로 경보를 산출한다. 대체 공급국과 지원기관 접점까지 한 화면에서 확인한다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const built = meta.generated_at.slice(0, 10);
  return (
    <html lang="ko">
      <body>
        <Nav builtDate={built} />
        <main className="mx-auto max-w-7xl px-5 py-10">{children}</main>
        <footer className="border-t border-white/10 px-5 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              모든 수치는 데이터 기준일({built}) 배치 처리 값이며, 화면에서 외부 API를 다시
              호출하지 않는다. 데이터 출처 · 산출 방식은{" "}
              <Link href="/data-notes/" className="text-slate-400 underline underline-offset-2 hover:text-pivot-500">
                데이터 노트
              </Link>
              에 적었다.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/timeline/" className="hover:text-slate-300">
                Before/After
              </Link>
              <Link href="/roadmap/" className="hover:text-slate-300">
                로드맵
              </Link>
              <span>관세청 · 한국은행 ECOS · KOTRA · UN Comtrade</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
