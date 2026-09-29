import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";
import { newsValidation } from "@/lib/news-validation-data";
import adminEvents from "@data/admin_sample_events.json";
import todayEventsJson from "@data/today_events.json";
import AdminEventBrowser, { type TodayEvent } from "@/components/AdminEventBrowser";
import RecallRoundsChart from "@/components/charts/RecallRoundsChart";

/**
 * 관리자 UI(뉴스 이벤트 검토) — 뉴스수집 워크플로우 페이지.
 * 2026-09-29: 뉴스 소급 검증(구 /workflow/news/) 페이지를 이 페이지로 합치고, 상단 4box를
 * discover.db 원자료(today_events.json, 매일 자동 export)와 연결해 클릭하면 실제 목록이 뜨게 했다.
 * 정적 export라 승인/반려 백엔드는 없다 — 아래 5건 예시 카드는 그 시안이다.
 */

const todayEvents = todayEventsJson as unknown as { as_of: string; events: TodayEvent[] };

const RIBBON = [
  { n: "①", label: "뉴스 수집", done: true },
  { n: "②", label: "중복 제거", done: false },
  { n: "③", label: "HS6·국가 매핑", done: false },
  { n: "④", label: "classify() 신호등", done: true },
  { n: "⑤", label: "AI 검증", done: false },
  { n: "⑥", label: "관리자 확정", done: false },
] as const;

const SIGNAL_CLS: Record<string, string> = {
  RELEVANT: "border-signal-green/40 bg-signal-green/10 text-signal-green",
  CANDIDATE: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
};

function Mark({ ok }: { ok: boolean }) {
  return ok ? <span className="text-signal-green">✓</span> : <span className="text-slate-600">✗</span>;
}

export default function WorkflowAdminPage() {
  const last = workflow.recall_rounds[workflow.recall_rounds.length - 1];
  const naverOnly = newsValidation.round12_events.filter((e) => e.naver && !e.google).length;
  const googleOnly = newsValidation.round12_events.filter((e) => e.google && !e.naver).length;

  return (
    <>
      <PageHeader step="워크플로우 · 페이지 3" title="관리자 UI">
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-500">
          discover_collect.py 실제 수집·판정 결과. 승인/반려는 정적 데모라 비활성화.
        </p>
      </PageHeader>

      <AdminEventBrowser
        cumulativeTotal={workflow.live ? workflow.live.cumulative.total_events : 0}
        events={todayEvents.events}
        asOf={todayEvents.as_of}
      />

      <Section title="처리 흐름" className="mb-6 mt-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {RIBBON.map((r, i) => (
            <div key={r.label} className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                  r.done ? "bg-signal-green/10 border border-signal-green/30" : "bg-white/5 border border-white/10"
                }`}
              >
                <span className={`font-mono text-[10.5px] ${r.done ? "text-signal-green" : "text-slate-500"}`}>{r.n}</span>
                <span className={`text-xs font-medium ${r.done ? "text-slate-200" : "text-slate-500"}`}>{r.label}</span>
                {!r.done && <span className="text-[9px] text-slate-600">예정</span>}
              </span>
              {i < RIBBON.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="대표 사례 (discover.db 원자료, 2026-09-25~26)" hint="materials가 비어 있으면 CANDIDATE다." className="mb-6">
        <div className="flex flex-col gap-2.5">
          {adminEvents.events.map((e) => (
            <div
              key={e.title}
              className={`rounded-xl border p-4 ${
                "fix_example" in e && e.fix_example ? "border-pivot-500/30 bg-pivot-600/5" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className={`chip shrink-0 ${SIGNAL_CLS[e.status]}`}>{e.status}</span>
                {"fix_example" in e && e.fix_example && (
                  <span className="chip shrink-0 border-pivot-500/40 bg-pivot-600/15 text-pivot-500">수정 사례</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <a href={e.url} target="_blank" rel="noreferrer noopener" className="text-sm font-semibold text-white hover:text-pivot-500">
                      {e.title}
                    </a>
                    <span className="font-mono text-[10.5px] text-slate-600">
                      {e.source} · {e.published}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px]">
                    <span className="rounded bg-signal-red/10 px-1.5 py-0.5 text-signal-red">disrupt: {e.disrupt}</span>
                    <span className="rounded bg-signal-blue/10 px-1.5 py-0.5 text-signal-blue">
                      materials: {e.materials || "(없음 — CANDIDATE)"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" disabled title="정적 데모" className="cursor-not-allowed rounded-md border border-signal-green/30 bg-signal-green/10 px-2.5 py-1 text-[11px] font-semibold text-signal-green opacity-70">
                    승인
                  </button>
                  <button type="button" disabled title="정적 데모" className="cursor-not-allowed rounded-md border border-signal-red/30 bg-signal-red/10 px-2.5 py-1 text-[11px] font-semibold text-signal-red opacity-70">
                    반려
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-pivot-500">{adminEvents.fix_example_note}</p>
      </Section>

      <Section title="뉴스 소급 검증 — naver+google OR 결합" hint={`②단계 재현율. 최종 '진짜 과녁' 15개 기준 결합(OR) ${last.recall}%.`} className="mb-6">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="naver 단독" value="47% (7/15)" sub={`정밀도 ${newsValidation.precision.naver}`} />
          <Stat label="google 단독" value="47% (7/15)" sub={`정밀도 ${newsValidation.precision.google}`} />
          <Stat label="결합(OR)" value={`${last.recall}% (8/15)`} tone="pivot" sub={newsValidation.combine_rule} />
        </div>
        <RecallRoundsChart rounds={workflow.recall_rounds} />
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          naver만 잡은 사건 {naverOnly}건, google만 잡은 사건 {googleOnly}건 — 서로 다른 사건을 보완해 결합이 실익이 있음.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">사건</th>
                <th className="py-1.5 pr-2 text-center font-medium">naver</th>
                <th className="py-1.5 pr-2 text-center font-medium">google</th>
                <th className="py-1.5 pr-3 text-center font-medium">결합</th>
                <th className="py-1.5 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {newsValidation.round12_events.map((e) => (
                <tr key={e.event} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-slate-300">{e.event}</td>
                  <td className="py-2 pr-2 text-center"><Mark ok={e.naver} /></td>
                  <td className="py-2 pr-2 text-center"><Mark ok={e.google} /></td>
                  <td className="py-2 pr-3 text-center"><Mark ok={e.combined} /></td>
                  <td className="py-2 leading-relaxed text-slate-500">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="현재(라운드12) 미탐 원인">
          <div className="flex flex-col gap-3">
            {workflow.round12_misses.map((m) => (
              <Stat key={m.cause} label={m.cause} value={`${m.count}건`} tone="amber" />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{workflow.operations.niche_miss_policy}</p>
        </Section>
        <Section title="핵심 교훈">
          <ul className="space-y-2.5 text-xs leading-relaxed text-slate-300">
            {newsValidation.lessons.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-pivot-500">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="materials 사전 — 동음이의어 오탐 수정">
        <p className="text-sm leading-relaxed text-slate-300">
          <code className="text-slate-200">은</code>(275건)·<code className="text-slate-200">럼프</code>(152건) 제거 후
          discover.db 724건 재분류(RELEVANT 618→451, CANDIDATE 145→312). {adminEvents.new_risk_found}
        </p>
      </Section>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
        중복 제거·HS6/국가 매핑은{" "}
        <Link href="/workflow/overview/" className="text-pivot-500 hover:underline">전체 워크플로우</Link>의 ②③단계 참고.
      </p>

      <SourceTag>
        discover_collect.py classify() · pipeline_v2/discover.db · 키워드_재현율_검증_라운드별_요약.md · {workflow.source}
      </SourceTag>
    </>
  );
}
