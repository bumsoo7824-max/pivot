"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// /data-notes 는 심사 질의 대비용 숨김 페이지라 내비게이션에 넣지 않는다.
// Before/After·로드맵은 제작 배경 설명 자료라 하단 푸터로 옮기고, 여기는 실사용 화면만 남긴다.
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/items/", label: "품목 검색" },
  { href: "/mvp10/", label: "경보 현황" },
  { href: "/blindspots/", label: "사각지대 스크리닝" },
  { href: "/top-country/", label: "1위국 분포" },
  { href: "/golden-time/", label: "골든타임" },
];

export default function Nav({ builtDate }: { builtDate: string }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, ""));

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-pivot-600/20 font-mono text-pivot-500">
            SP
          </span>
          Supply-Pivot
        </Link>
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-2.5 py-1.5 transition ${
                active(l.href)
                  ? "bg-white/10 font-medium text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto hidden text-xs text-slate-500 lg:block">
          데이터 기준 {builtDate}
        </span>
      </div>
    </header>
  );
}
