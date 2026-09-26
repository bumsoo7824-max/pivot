import Link from "next/link";
import { PageHeader, Section, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";
import { coverageCounts } from "@/lib/coverage-data";
import RecallRoundsChart from "@/components/charts/RecallRoundsChart";

/**
 * 뉴스 조기경보 워크플로우(①~⑩) 허브 페이지.
 * 2026-09-25 세션(별도 저장소 supply_pivot_v2)에서 확정된 내용을 담는다.
 * 기존 페이지(272/355 기준, /mvp10·/blindspots 등)와는 데이터 소스가 완전히 분리돼 있어
 * 이 페이지의 숫자가 기존 페이지와 다른 건 버그가 아니라 아직 두 파이프라인이 안 합쳐진 상태라서다
 * — 이 페이지 하단에 그 점을 명시한다.
 */

const SUBPAGES = [
  {
    href: "/workflow/overview/",
    title: "페이지1 · 전체 워크플로우",
    desc: "①~⑩ 전체 흐름도와 10단계 상세를 한 화면에서 — 경보/참고지표/전환 3단계 구조",
    tone: "blue",
  },
  {
    href: "/workflow/admin/",
    title: "페이지3 · 관리자 UI",
    desc: "수집→중복제거→URL 요약(AI)→매핑후보→classify() 판정을 거친 뉴스 이벤트 검토 큐",
    tone: "amber",
  },
  {
    href: "/workflow/coverage/",
    title: "페이지4 · 품목 커버리지 검색",
    desc: "HS4·HS6 1,109개 전체를 검색하고, 12개월 수입액·최대 공급국을 바로 확인",
    tone: "blue",
  },
  {
    href: "/workflow/paid-report/",
    title: "페이지5 · 유료 리포트",
    desc: "무료 MVP 이후 유료 버전에서 제공하는 리포트 구성과 발행 방식",
    tone: "red",
  },
  {
    href: "/workflow/alt-supply/",
    title: "페이지6 · 대체공급처·지원정책",
    desc: "고객 노출 결합, 영향국 제외 후보 추천, KOTRA·UN Comtrade 기반 대체국 후보 (유료 범위)",
    tone: "red",
  },
  {
    href: "/workflow/news/",
    title: "뉴스 소급 검증",
    desc: "네이버+구글뉴스 OR 결합 근거, 라운드별 재현율, held-out 15개 사건 상세",
    tone: "amber",
  },
  {
    href: "/workflow/alerts/",
    title: "HHI 등급·경보 흐름",
    desc: "classify() 판정 → 신호등 3단계 → 노출도(HHI)·통관 스파이크 심각도까지",
    tone: "green",
  },
] as const;

const CARD_TONE: Record<string, string> = {
  blue: "hover:border-signal-blue/40",
  amber: "hover:border-signal-amber/40",
  green: "hover:border-signal-green/40",
  red: "hover:border-signal-red/40",
};

export default function WorkflowPage() {
  const last = workflow.recall_rounds[workflow.recall_rounds.length - 1];
  const counts = coverageCounts();
  const universeTotal =
    counts.collected + counts.collected_unintegrated + counts.collected_partial + counts.pending + counts.no_trade;
  const dataReadyPct = Math.round(((universeTotal - counts.pending - counts.no_trade) / universeTotal) * 100);

  return (
    <>
      <PageHeader
        step="워크플로우 · 페이지 2"
        title="뉴스 조기경보 워크플로우 (①~⑩)"
        lead="사람이 웹을 훑는 단계부터 대체공급국 연계까지, 실제로 돌아가는 순서 그대로 보여준다. 신호등은 Yes/CANDIDATE/No 3단계다. 전체 흐름도·10단계 상세는 페이지 1(전체 워크플로우)로 옮겼다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          이 페이지는 기존 사각지대 272개(/mvp10 등)와는 별도 검증 세트 기준입니다 — 아래 숫자와
          다른 페이지의 숫자가 다르게 보이는 건 정상이며, 두 파이프라인 통합은 진행 중입니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/workflow/admin/"
          className="rounded-2xl border border-pivot-500/50 bg-gradient-to-br from-pivot-500/15 to-pivot-500/[0.02] p-5 transition hover:border-pivot-500/70 sm:col-span-2"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-pivot-400">최우선 지표 · 결합 재현율 (naver OR google)</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-5xl font-extrabold text-white">
              {last.recall}
              <span className="text-2xl text-pivot-400">%</span>
            </span>
            <span className="text-xs text-slate-400">held-out 15개 사건 감사({last.round}) 기준</span>
          </div>
          <p className="mt-2 text-[11px] text-pivot-400">관리자 UI에서 재현율 검토 근거 보기 →</p>
        </Link>
        <Stat label="품목 데이터 확보율" value={`${dataReadyPct}%`} tone="pivot" sub={`HS6 ${universeTotal}개 중 진짜 사각지대 ${counts.pending}개만 남음`} />
        <Stat
          label="오늘 신규 Yes"
          value={workflow.live ? `${workflow.live.today.new_relevant} / ${workflow.live.today.new_events}건` : "-"}
          tone="amber"
          sub="CANDIDATE 검토대기는 관리자 UI에서 확인"
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUBPAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.04] ${CARD_TONE[p.tone]}`}
          >
            <p className="text-sm font-semibold text-white">{p.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
          </Link>
        ))}
      </div>

      {workflow.live ? (
        <Section
          title="뉴스 수집 현황 (②~⑥ 단계 전용, 자동 갱신)"
          className="mb-6"
          hint={`오늘(${workflow.live.as_of}) 네이버+구글뉴스 자동 수집 기준 — HHI·통관·대체공급국(④·⑦~⑩)은 별도 수집 경로라 여기 숫자에 포함되지 않음`}
        >
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
          <p className="mt-3 text-xs text-slate-500">
            <Link href="/workflow/admin/" className="text-pivot-500 hover:underline">
              관리자 UI에서 검토 큐 보기 →
            </Link>
          </p>
        </Section>
      ) : (
        <Section title="뉴스 수집 현황 (②~⑥ 단계 전용)" className="mb-6">
          <p className="text-sm text-slate-400">
            아직 자동 수집이 시작되지 않았습니다 — <code className="text-slate-300">refresh_workflow.yml</code>이
            처음 실행되면 여기에 오늘 자 수집·CANDIDATE 큐 규모가 표시됩니다(실측 가동 예정:{" "}
            {workflow.operations.field_run_window}). HHI·통관·대체공급국(④·⑦~⑩)은 이 카운터에
            포함되지 않는 별도 수집 경로입니다.
          </p>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="라운드별 재현율 (이벤트 수준)" className="lg:col-span-2">
          <RecallRoundsChart rounds={workflow.recall_rounds} />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            같은 파이프라인이라도 검증셋을 무엇으로 잡느냐에 따라 재현율이 크게 달라진다(라운드11
            "유명 사건" 세트 67% vs 라운드12 "구조적 RED 379 유니버스 안 진짜 과녁" 세트 최종{" "}
            {last.recall}%). 자세한 근거는{" "}
            <Link href="/workflow/news/" className="text-pivot-500 hover:underline">
              뉴스 소급 검증
            </Link>{" "}
            페이지에.
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
