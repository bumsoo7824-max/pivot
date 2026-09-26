import Link from "next/link";
import { PageHeader, Section } from "@/components/ui";
import { STATUS_META, TONE_DOT, TONE_RING, workflow } from "@/lib/workflow-data";
import WorkflowDiagram from "@/components/charts/WorkflowDiagram";

/**
 * 페이지 1 · 전체 워크플로우.
 * 기존 /workflow(허브) 페이지에 있던 "전체 흐름도"·"10단계 요약"을 이 페이지로 옮겼다 —
 * 허브는 실시간 현황(재현율·수집 카운터)에 집중하고, 전체 그림은 여기서 한 번에 본다.
 */

const PHASES = [
  {
    label: "경보 · 자동 (①~⑥)",
    tone: "border-signal-blue/40 bg-signal-blue/5",
    dot: "bg-signal-blue",
    desc: "뉴스 수집·중복제거·HS6 매핑·classify() 판정까지 사람 개입 없이 매일 자동 실행된다. 신호등 3단계로 분류해 다음 단계로 넘긴다.",
  },
  {
    label: "심각도 참고지표 (⑦⑧)",
    tone: "border-signal-green/40 bg-signal-green/5",
    dot: "bg-signal-green",
    desc: "노출도(HHI)·통관 스파이크는 경보 확정 여부와 무관한 참고 지표다 — 판정 자체를 좌우하지 않고, 심각도를 가늠하는 보조 정보로만 쓴다.",
  },
  {
    label: "전환 · 유료 예정 (⑨⑩)",
    tone: "border-signal-red/40 bg-signal-red/5",
    dot: "bg-signal-red",
    desc: "확정된 경보를 고객의 실제 수입 HS6·공급국과 결합해, 영향국을 제외한 대체공급국 후보와 지원정책을 매칭한다. 무료 MVP 범위 밖.",
  },
] as const;

export default function WorkflowOverviewPage() {
  return (
    <>
      <PageHeader
        step="워크플로우 · 페이지 1"
        title="전체 워크플로우 (①~⑩)"
        lead="뉴스 수집부터 대체공급처 연계까지 전체 10단계를 한 화면에서 본다. 실시간 재현율·수집 현황은 워크플로우 허브에, 관리자 검토 큐는 관리자 UI에 따로 있다."
      >
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/workflow/" className="chip border-pivot-500/40 bg-pivot-500/10 text-pivot-500">
            ← 워크플로우 허브(실시간 현황)
          </Link>
          <Link href="/workflow/admin/" className="chip border-signal-amber/40 bg-signal-amber/10 text-signal-amber">
            관리자 UI(뉴스 이벤트 검토) →
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {PHASES.map((p) => (
          <div key={p.label} className={`rounded-xl border p-4 ${p.tone}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${p.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-white">{p.label}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{p.desc}</p>
          </div>
        ))}
      </div>

      <Section title="전체 흐름도" className="mb-6" hint={`기준일 ${workflow.as_of}`}>
        <WorkflowDiagram steps={workflow.steps} />
      </Section>

      <Section title="10단계 상세" hint={`대제목만 표시 — 각 카드의 "자세히"를 눌러 펼치기`}>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {workflow.steps.map((s) => {
            const meta = STATUS_META[s.status];
            return (
              <li key={s.id} className={`relative rounded-xl border ${TONE_RING[s.tone]} bg-ink-800/60 p-4`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${TONE_DOT[s.tone]}`} />
                  <span className="font-mono text-[11px] text-slate-600">
                    {String(s.id).padStart(2, "0")}
                  </span>
                  <span className={`chip ml-auto ${meta.cls}`}>{meta.label}</span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-snug text-white">{s.title}</p>
                {(s.summary || s.detail) && (
                  <details className="group mt-1.5">
                    <summary className="cursor-pointer list-none text-[11px] text-slate-600 hover:text-slate-400">
                      자세히 <span className="inline-block transition-transform group-open:rotate-90">›</span>
                    </summary>
                    {s.summary && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.summary}</p>}
                    {s.detail && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
                        {s.detail}
                      </p>
                    )}
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-600">
        출처 · {workflow.source} · 데이터 갱신 {new Date(workflow.generated_at).toLocaleString("ko-KR")}
      </p>
    </>
  );
}
