"use client";

import { useMemo, useState } from "react";
import { STATUS_META, type CoverageItem, type CoverageStatus } from "@/lib/coverage-data";

const FILTERS: { key: CoverageStatus | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "collected", label: STATUS_META.collected.short },
  { key: "collected_unintegrated", label: STATUS_META.collected_unintegrated.short },
  { key: "collected_partial", label: STATUS_META.collected_partial.short },
  { key: "pending", label: STATUS_META.pending.short },
  { key: "no_trade", label: STATUS_META.no_trade.short },
];

function fmtUsd(n?: number) {
  if (!n) return "-";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

const PAGE_SIZE = 80;

export default function CoverageSearch({ items }: { items: CoverageItem[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<CoverageStatus | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (!query) return true;
      return (
        i.hs6.includes(query) ||
        i.hs4.includes(query) ||
        i.name.toLowerCase().includes(query) ||
        i.category.toLowerCase().includes(query)
      );
    });
  }, [items, q, filter]);

  const visible = filtered.slice(0, shown);

  return (
    <div>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE_SIZE);
          }}
          placeholder="HS4/HS6 코드 또는 품목명으로 검색 (예: 7228, 리튬)"
          className="w-full rounded-lg border border-white/15 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-pivot-500/50 focus:bg-white/[0.06] focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setShown(PAGE_SIZE);
            }}
            className={`chip transition ${
              filter === f.key
                ? "border-pivot-500/50 bg-pivot-500/15 text-pivot-500"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-slate-500">
          {filtered.length.toLocaleString("ko-KR")}건 중 {visible.length.toLocaleString("ko-KR")}건 표시
        </span>
      </div>

      <div className="mt-3 max-h-[560px] overflow-y-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-ink-800 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">HS6</th>
              <th className="px-3 py-2 font-medium">HS4</th>
              <th className="px-3 py-2 font-medium">품목명</th>
              <th className="px-3 py-2 font-medium">상태</th>
              <th className="px-3 py-2 font-medium">12개월 수입액 · 최대 공급국</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => {
              const meta = STATUS_META[i.status];
              return (
                <tr key={i.hs6} className="border-t border-white/5 hover:bg-white/[0.03]" title={i.name_full}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-pivot-500">{i.hs6}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">{i.hs4}</td>
                  <td className="max-w-[420px] truncate px-3 py-2 text-slate-200">{i.name || i.category}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`chip ${meta.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.short}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {i.status === "collected_partial" ? (
                      <>
                        {fmtUsd(i.import_usd_12m)}
                        {i.top_country && (
                          <span className="text-slate-500"> · {i.top_country} {i.top_country_share_pct}%</span>
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-500">
                  일치하는 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {shown < filtered.length && (
        <button
          onClick={() => setShown((s) => s + PAGE_SIZE)}
          className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
        >
          {Math.min(PAGE_SIZE, filtered.length - shown).toLocaleString("ko-KR")}건 더 보기 (남은{" "}
          {(filtered.length - shown).toLocaleString("ko-KR")}건)
        </button>
      )}
    </div>
  );
}
