"use client";

import { useMemo, useState } from "react";

export type TodayEvent = {
  source: string;
  published: string;
  title: string;
  url: string;
  disrupt: string;
  materials: string;
  status: "RELEVANT" | "CANDIDATE" | "NONE";
};

type Filter = "ALL" | "RELEVANT" | "CANDIDATE";

const SIGNAL_CLS: Record<string, string> = {
  RELEVANT: "border-signal-green/40 bg-signal-green/10 text-signal-green",
  CANDIDATE: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
  NONE: "border-white/15 bg-white/5 text-slate-500",
};

function StatButton({
  label,
  value,
  sub,
  active,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${
        active
          ? "border-pivot-500/60 bg-pivot-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`stat-value mt-1 ${active ? "text-pivot-400" : "text-white"}`}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{sub}</p>
    </button>
  );
}

/** 관리자 UI 상단 4box — 클릭하면 그 상태(전체/CANDIDATE/확정 Yes)로 아래 이벤트 목록이
 * 필터링된다. today_events.json(discover.db에서 그날 published 기준으로 export)을 그대로 쓴다. */
export default function AdminEventBrowser({
  cumulativeTotal,
  events,
  asOf,
}: {
  cumulativeTotal: number;
  events: TodayEvent[];
  asOf: string;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(20);

  const counts = useMemo(() => {
    const c = { RELEVANT: 0, CANDIDATE: 0, NONE: 0 };
    for (const e of events) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter((e) => e.status === filter);
  }, [events, filter]);

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatButton
          label="누적 수집"
          value={cumulativeTotal.toLocaleString("ko-KR")}
          sub="전체 기간 총 건수"
          active={false}
          onClick={() => setFilter("ALL")}
        />
        <StatButton
          label={`오늘(${asOf}) 수집`}
          value={events.length.toLocaleString("ko-KR")}
          sub="네이버+구글뉴스 — 클릭 시 전체 목록"
          active={filter === "ALL"}
          onClick={() => setFilter("ALL")}
        />
        <StatButton
          label="오늘 CANDIDATE"
          value={counts.CANDIDATE.toLocaleString("ko-KR")}
          sub="materials 미매칭 — 클릭 시 목록"
          active={filter === "CANDIDATE"}
          onClick={() => setFilter("CANDIDATE")}
        />
        <StatButton
          label="오늘 확정 Yes"
          value={counts.RELEVANT.toLocaleString("ko-KR")}
          sub="disrupt+materials 둘 다 매칭 — 클릭 시 목록"
          active={filter === "RELEVANT"}
          onClick={() => setFilter("RELEVANT")}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["ALL", "RELEVANT", "CANDIDATE"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`chip transition ${
              filter === f ? "border-pivot-500/50 bg-pivot-500/15 text-pivot-400" : "border-white/10 text-slate-400 hover:border-white/25"
            }`}
          >
            {f === "ALL" ? `전체 ${events.length}` : f === "RELEVANT" ? `Yes ${counts.RELEVANT}` : `CANDIDATE ${counts.CANDIDATE}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.slice(0, limit).map((e) => (
          <div key={e.url + e.published} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-start gap-2.5">
              <span className={`chip shrink-0 ${SIGNAL_CLS[e.status]}`}>{e.status}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <a href={e.url} target="_blank" rel="noreferrer noopener" className="text-sm text-slate-200 hover:text-pivot-400">
                    {e.title}
                  </a>
                  <span className="font-mono text-[10.5px] text-slate-600">
                    {e.source} · {e.published}
                  </span>
                </div>
                {(e.disrupt || e.materials) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10.5px]">
                    {e.disrupt && <span className="rounded bg-signal-red/10 px-1.5 py-0.5 text-signal-red">disrupt: {e.disrupt}</span>}
                    <span className="rounded bg-signal-blue/10 px-1.5 py-0.5 text-signal-blue">materials: {e.materials || "(없음)"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 20)}
          className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-slate-400 hover:border-white/25 hover:text-slate-200"
        >
          {limit}건 표시 중 — {filtered.length - limit}건 더 보기
        </button>
      )}
    </>
  );
}
