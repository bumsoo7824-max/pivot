import Link from "next/link";
import { PageHeader, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";
import { coverageCounts } from "@/lib/coverage-data";

/**
 * 뉴스 조기경보 워크플로우 허브. 2026-09-29: 라운드별 재현율·미탐원인은 관리자 UI로 옮기고
 * 이 페이지는 진입점(서브페이지 카드)과 실시간 요약만 남겼다. 뉴스 소급 검증(/workflow/news)과
 * HHI 등급·경보 흐름(/workflow/alerts)은 각각 관리자 UI에 합치고 제거했다.
 */

const SUBPAGES = [
  { href: "/workflow/overview/", title: "① 전체 워크플로우", desc: "①~⑩ 흐름도와 10단계 상세", tone: "blue" },
  { href: "/workflow/admin/", title: "② 관리자 UI", desc: "뉴스 이벤트 검토 + 재현율 근거", tone: "amber" },
  { href: "/workflow/coverage/", title: "③ 품목 커버리지 검색", desc: "HS6 1,109개 검색 · 수입액·공급국", tone: "blue" },
  { href: "/workflow/paid-report/", title: "④ 유료 리포트", desc: "유료 버전 리포트 구성", tone: "red" },
  { href: "/workflow/alt-supply/", title: "⑤ 대체공급처·지원정책", desc: "영향국 제외 후보 추천 (유료 범위)", tone: "red" },
  { href: "/workflow/tech/", title: "⑥ 기술력", desc: "중복제거·매핑·판정·매칭엔진·신뢰도 가중치", tone: "green" },
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
      <PageHeader step="워크플로우" title="뉴스 조기경보 워크플로우 (①~⑩)" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/workflow/admin/"
          className="rounded-2xl border border-pivot-500/50 bg-gradient-to-br from-pivot-500/15 to-pivot-500/[0.02] p-5 transition hover:border-pivot-500/70 sm:col-span-2"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-pivot-400">결합 재현율 (naver OR google)</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-5xl font-extrabold text-white">
              {last.recall}
              <span className="text-2xl text-pivot-400">%</span>
            </span>
            <span className="text-xs text-slate-400">held-out 15개 사건({last.round})</span>
          </div>
          <p className="mt-2 text-[11px] text-pivot-400">관리자 UI에서 근거 보기 →</p>
        </Link>
        <Stat label="품목 데이터 확보율" value={`${dataReadyPct}%`} tone="pivot" sub={`HS6 ${universeTotal}개 중 ${counts.pending}개 남음`} />
        <Stat
          label="오늘 신규 Yes"
          value={workflow.live ? `${workflow.live.today.new_relevant} / ${workflow.live.today.new_events}건` : "-"}
          tone="amber"
          sub="관리자 UI에서 전체 목록"
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
        출처 · {workflow.source} · 데이터 갱신 {new Date(workflow.generated_at).toLocaleString("ko-KR")}
      </p>
    </>
  );
}
