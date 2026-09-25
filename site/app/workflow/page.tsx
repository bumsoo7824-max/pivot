import { PageHeader, Section, Stat } from "@/components/ui";
import { STATUS_META, TONE_DOT, TONE_RING, workflow } from "@/lib/workflow-data";
import RecallRoundsChart from "@/components/charts/RecallRoundsChart";

/**
 * 뉴스 조기경보 워크플로우(①~⑩) 전용 신규 페이지.
 * 2026-09-25 세션(별도 저장소 supply_pivot_v2)에서 확정된 내용을 담는다.
 * 기존 페이지(272/355 기준, /mvp10·/blindspots 등)와는 데이터 소스가 완전히 분리돼 있어
 * 이 페이지의 숫자가 기존 페이지와 다른 건 버그가 아니라 아직 두 파이프라인이 안 합쳐진 상태라서다
 * — 이 페이지 하단에 그 점을 명시한다.
 */
export default function WorkflowPage() {
  const last = workflow.recall_rounds[workflow.recall_rounds.length - 1];

  return (
    <>
      <PageHeader
        step="워크플로우"
        title="뉴스 조기경보 파이프라인 (①~⑩)"
        lead="사람이 웹을 훑는 단계부터 대체공급국 연계까지, 실제로 돌아가는 순서 그대로 보여준다. 신호등은 Yes/CANDIDATE/No 3단계다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          이 페이지는 기존 사각지대 272개(/mvp10 등)와는 별도 검증 세트 기준입니다 — 아래 숫자와
          다른 페이지의 숫자가 다르게 보이는 건 정상이며, 두 파이프라인 통합은 진행 중입니다.
        </p>
      </PageHeader>

      {workflow.live ? (
        <Section title="실측 가동 현황 (자동 갱신)" className="mb-6" hint={`오늘(${workflow.live.as_of}) 자동 수집 기준`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="누적 수집" value={workflow.live.cumulative.total_events.toLocaleString("ko-KR")} sub="전체 기간 총 건수" />
            <Stat
              label="오늘 신규 Yes(RELEVANT)"
              value={workflow.live.today.new_relevant.toLocaleString("ko-KR")}
              tone="pivot"
              sub={`오늘 신규 ${workflow.live.today.new_events}건 중`}
            />
            <Stat
              label="오늘 신규 CANDIDATE"
              value={workflow.live.today.new_candidate.toLocaleString("ko-KR")}
              tone="amber"
              sub="사람+LLM 검토 대기"
            />
          </div>
        </Section>
      ) : (
        <Section title="실측 가동 현황" className="mb-6">
          <p className="text-sm text-slate-400">
            아직 자동 수집이 시작되지 않았습니다 — <code className="text-slate-300">refresh_workflow.yml</code>이
            처음 실행되면 여기에 오늘 자 수집·CANDIDATE 큐 규모가 표시됩니다(실측 가동 예정:{" "}
            {workflow.operations.field_run_window}).
          </p>
        </Section>
      )}

      <Section title="10단계 흐름" className="mb-6" hint={`기준일 ${workflow.as_of}`}>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {workflow.steps.map((s) => {
            const meta = STATUS_META[s.status];
            return (
              <li
                key={s.id}
                className={`relative rounded-xl border ${TONE_RING[s.tone]} bg-ink-800/60 p-4`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${TONE_DOT[s.tone]}`} />
                  <span className="font-mono text-[11px] text-slate-600">
                    {String(s.id).padStart(2, "0")}
                  </span>
                  <span className={`chip ml-auto ${meta.cls}`}>{meta.label}</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-snug text-white">{s.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.summary}</p>
                {s.detail && (
                  <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
                    {s.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="라운드별 재현율 (이벤트 수준)" className="lg:col-span-2">
          <RecallRoundsChart rounds={workflow.recall_rounds} />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            같은 파이프라인이라도 검증셋을 무엇으로 잡느냐에 따라 재현율이 크게 달라진다(라운드11
            "유명 사건" 세트 67% vs 라운드12 "구조적 RED 379 유니버스 안 진짜 과녁" 세트 최종{" "}
            {last.recall}%). 발표에서 재현율을 말할 땐 반드시 어떤 사건 기준인지 명시해야 한다.
          </p>
        </Section>

        <Section title="현재(라운드12) 미탐 원인">
          <div className="flex flex-col gap-3">
            {workflow.round12_misses.map((m) => (
              <Stat key={m.cause} label={m.cause} value={`${m.count}건`} tone="amber" />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {workflow.operations.niche_miss_policy}
          </p>
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="운영 스케줄">
          <p className="text-sm leading-relaxed text-slate-300">{workflow.operations.schedule}</p>
          <p className="mt-3 text-xs text-slate-500">
            실측 가동 기간: <span className="text-slate-300">{workflow.operations.field_run_window}</span>
          </p>
        </Section>

        <Section title="다음 할 일">
          <ol className="flex flex-col gap-2">
            {workflow.next_tasks.map((t, i) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-[10px] text-slate-400">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-600">
        출처 · {workflow.source} · 데이터 갱신 {new Date(workflow.generated_at).toLocaleString("ko-KR")}
      </p>
    </>
  );
}
