import Link from "next/link";
import { PageHeader, Section, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";
import WorkflowDiagram from "@/components/charts/WorkflowDiagram";

/**
 * 페이지 1 · 전체 워크플로우.
 * 2026-09-29: 기존 "경보·자동(①~⑥) / 심각도참고지표(⑦⑧) / 전환(⑨⑩)" 3분류를
 * "진단 → 경보 → 전환" 3챕터로 재구성. 중복제거·HS6매핑·classify() 같은 구현 디테일은
 * /workflow/tech/ (⑥ 기술력)로 분리하고, 이 페이지는 큰 단계와 공공데이터만 남긴다.
 */

const DIAGNOSIS = {
  screened: 402,
  analyzed: 377,
  blindspot: 256,
  blindspotPct: 67.9,
  chinaTop: 149,
  chinaPct: 58.2,
} as const;

const CHAPTERS = [
  {
    n: "1",
    label: "진단",
    tone: "border-signal-amber/40 bg-signal-amber/5",
    dot: "bg-signal-amber",
    desc: "공공데이터로 사각지대를 먼저 특정한다 — 1회성 스크리닝.",
    steps: [
      {
        title: "원자재 유니버스 스크리닝",
        detail: "관세청 HS4 402개 → 분석대상 377개 → 정부 미관리 고의존 256개(67.9%) 특정",
        data: "관세청 수출입실적 · 소부장 핵심전략기술 200대 · 핵심광물 33종",
      },
      {
        title: "위험도 스코어링",
        detail: "HHI·1위국 비중 계산 → RED/YELLOW/GREEN 등급",
        data: "관세청 HS6 통계 · TRASS",
      },
    ],
  },
  {
    n: "2",
    label: "경보",
    tone: "border-signal-blue/40 bg-signal-blue/5",
    dot: "bg-signal-blue",
    desc: "후행지표 위에 선행지표를 얹어 매일 자동 실행한다.",
    steps: [
      {
        title: "뉴스 신호 판정",
        detail: "수집→매핑→classify() 판정까지 자동 — 구현 로직은 ⑥ 기술력 참고",
        data: "네이버뉴스 · Google News · KOTRA 해외시장뉴스 · 한국은행 수입물가지수",
      },
      {
        title: "관리자 확정",
        detail: "사람이 최종 검토하는 확정 게이트",
        data: "discover.db (자체 수집 DB)",
      },
    ],
  },
  {
    n: "3",
    label: "전환",
    tone: "border-signal-red/40 bg-signal-red/5",
    dot: "bg-signal-red",
    desc: "경보에서 끝나지 않고 실행 경로까지 연결한다 — 무료 MVP 범위 밖.",
    steps: [
      {
        title: "고객 필터링",
        detail: "고객 수입 HS6 ∩ 현재 공급국 ∩ 사건 영향국이 겹칠 때만 경보를 좁힌다",
        data: "고객 입력값",
      },
      {
        title: "대체공급국·정책 추천",
        detail: "영향국 제외 후 대체공급국 후보 + 지원정책(K-Startup·중진공) 매칭",
        data: "UN Comtrade · KOTRA 해외법인망 · K-Startup 지원정책 · 중진공 정책",
      },
    ],
  },
] as const;

export default function WorkflowOverviewPage() {
  return (
    <>
      <PageHeader step="워크플로우 · 페이지 1" title="전체 워크플로우 — 진단 → 경보 → 전환">
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/workflow/" className="chip border-pivot-500/40 bg-pivot-500/10 text-pivot-500">
            ← 워크플로우 허브
          </Link>
          <Link href="/workflow/coverage/" className="chip border-signal-blue/40 bg-signal-blue/10 text-signal-blue">
            HS6 품목 유니버스 1,109개 →
          </Link>
          <Link href="/workflow/admin/" className="chip border-signal-amber/40 bg-signal-amber/10 text-signal-amber">
            뉴스수집 워크플로우(관리자 UI) →
          </Link>
          <Link href="/workflow/tech/" className="chip border-signal-green/40 bg-signal-green/10 text-signal-green">
            ⑥ 기술력 자세히 보기 →
          </Link>
        </div>
      </PageHeader>

      <Section
        title="1. 진단 — 공공데이터 기반 사각지대 스크리닝"
        className="mb-6"
        hint="경보·전환이 상시 자동 실행되기 전, 관세청 원자재 전체를 한 번 훑어 '정부가 안 보는 곳'을 먼저 특정한다"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="관세청 HS4 스크리닝" value={`${DIAGNOSIS.screened}개`} sub="원자재 전체 유니버스" />
          <Stat label="분석 대상" value={`${DIAGNOSIS.analyzed}개`} sub="유효 데이터 확보 품목" />
          <Stat
            label="정부 미관리 고의존 품목"
            value={`${DIAGNOSIS.blindspot}개`}
            tone="pivot"
            sub={`${DIAGNOSIS.blindspotPct}% — 소부장 200대·핵심광물 33종 밖`}
          />
          <Stat
            label="1위 수입국 = 중국"
            value={`${DIAGNOSIS.chinaTop}개`}
            tone="amber"
            sub={`${DIAGNOSIS.chinaPct}% — 고의존 품목 중 비중`}
          />
        </div>
      </Section>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {CHAPTERS.map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.tone}`}>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${c.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-white">
                {c.n}. {c.label}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{c.desc}</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {c.steps.map((s) => (
                <div key={s.title} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">{s.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.detail}</p>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">공공데이터 · {s.data}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Section
        title="경보 자동화 파이프라인"
        className="mb-6"
        hint={`기준일 ${workflow.as_of} · 구현 세부(중복제거·매핑 규칙 등)는 ⑥ 기술력 페이지에서`}
      >
        <WorkflowDiagram steps={workflow.steps} />
      </Section>

      <p className="mt-8 text-[11px] leading-relaxed text-slate-600">
        출처 · {workflow.source} · 데이터 갱신 {new Date(workflow.generated_at).toLocaleString("ko-KR")}
      </p>
    </>
  );
}
