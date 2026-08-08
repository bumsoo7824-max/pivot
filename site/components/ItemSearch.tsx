"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GradeBadge } from "@/components/ui";
import type { SearchableItem } from "@/lib/data";

export default function ItemSearch({
  items,
  placeholder = "HS 코드 또는 품목명으로 검색 (예: 7228, 냉연강판)",
  autoFocus = false,
}: {
  items: SearchableItem[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return items
      .filter((i) => i.hs4.includes(query) || i.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [q, items]);

  return (
    <div className="relative">
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
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-lg border border-white/15 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-pivot-500/50 focus:bg-white/[0.06] focus:outline-none"
        />
      </div>
      {q.trim() && (
        <ul className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-800 shadow-2xl">
          {results.length > 0 ? (
            results.map((r) => (
              <li key={r.hs4} className="border-b border-white/5 last:border-0">
                <Link
                  href={`/items/${r.hs4}/`}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-white/5"
                >
                  <span className="font-mono text-xs text-pivot-500">{r.hs4}</span>
                  <span className="line-clamp-1 flex-1 text-slate-200">{r.name}</span>
                  {r.hasAlert && (
                    <span className="rounded-full bg-signal-red/15 px-2 py-0.5 text-[10px] font-medium text-signal-red">
                      경보
                    </span>
                  )}
                  {r.grade && <GradeBadge grade={r.grade} />}
                </Link>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-xs text-slate-500">
              &quot;{q}&quot;와 일치하는 품목이 없습니다. 현재 20개 품목만 확보돼 있습니다.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
