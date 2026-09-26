import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";

/**
 * 관리자 UI(뉴스 이벤트 검토) 시안.
 * 이 사이트는 정적 export라 실제 승인/반려 액션을 처리할 백엔드가 없다 —
 * 아래 이벤트 카드는 실제 검토 이력이 아니라 화면 구성을 보여주는 예시 데이터다.
 */

const RIBBON = [
  { n: "①", label: "뉴스 수집" },
  { n: "②", label: "중복 제거" },
  { n: "③", label: "URL 불러오기" },
  { n: "④", label: "AI 요약" },
  { n: "⑤", label: "HS6·국가 매핑후보" },
  { n: "⑥", label: "classify() 신호등" },
  { n: "⑦", label: "관리자 확정" },
] as const;

const EXAMPLE_EVENTS = [
  {
    signal: "Yes",
    signalCls: "border-signal-green/40 bg-signal-green/10 text-signal-green",
    title: "동남아 주요 항만 하역 파업 확산",
    domain: "news.naver.com",
    time: "09:14",
    dupCount: 4,
    summary: "베트남·태국 항만 노조 파업 3일차 — 컨테이너 적체로 수출 지연 우려, 물류업계 대체항 검토 중.",
    hs6: ["854231", "760612"],
    country: "베트남",
    status: "관리자 확인 대기",
  },
  {
    signal: "CANDIDATE",
    signalCls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
    title: "리튬 정제시설 가동 중단 관련 보도",
    domain: "news.google.com",
    time: "09:41",
    dupCount: 2,
    summary: "칠레 리튬 정제 설비 정기보수로 일부 가동 중단 — 품목어 미확인, 사전에 없는 표현이라 CANDIDATE 분류.",
    hs6: ["283691"],
    country: "칠레",
    status: "LLM 요약 완료 · 검토 대기",
  },
  {
    signal: "Yes",
    signalCls: "border-signal-green/40 bg-signal-green/10 text-signal-green",
    title: "반도체 소재 수출통제 강화 발표",
    domain: "news.naver.com",
    time: "10:02",
    dupCount: 6,
    summary: "특정 국가발 반도체 공정용 특수가스 수출 승인 절차 강화 — 국내 팹리스 대체소재 확보 움직임.",
    hs6: ["280429", "381800"],
    country: "일본",
    status: "관리자 확인 대기",
  },
  {
    signal: "CANDIDATE",
    signalCls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
    title: "구리 광산 노사 갈등 장기화",
    domain: "news.google.com",
    time: "10:37",
    dupCount: 1,
    summary: "임금 협상 결렬로 조업 재개 지연 가능성 — 사건언어만 확인, 품목어 매칭 신뢰도 낮음.",
    hs6: ["740200"],
    country: "페루",
    status: "LLM 요약 완료 · 검토 대기",
  },
] as const;

export default function WorkflowAdminPage() {
  const last = workflow.recall_rounds[workflow.recall_rounds.length - 1];

  return (
    <>
      <PageHeader
        step="워크플로우 · 관리자 UI"
        title="뉴스 이벤트 검토"
        lead="수집 → 중복제거 → URL 불러오기 → AI 요약 → HS6·국가 매핑후보 → classify() 신호등 → 관리자 확정. 자동으로 끝까지 발행되는 이벤트는 없다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          이 사이트는 정적으로 배포되는 데모라 실제 승인/반려를 처리하는 백엔드가 없습니다. 아래
          이벤트 카드·승인/반려 버튼은 화면 구성을 보여주는 예시이며, 실제 검토 이력이 아닙니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="결합 재현율" value={`${last.recall}%`} tone="pivot" sub={`held-out 15개 사건(${last.round})`} />
        <Stat label="오늘 수집" value={workflow.live ? workflow.live.today.new_events.toLocaleString("ko-KR") : "-"} sub="네이버+구글뉴스" />
        <Stat
          label="검토 대기 (CANDIDATE)"
          value={workflow.live ? workflow.live.today.new_candidate.toLocaleString("ko-KR") : "-"}
          tone="amber"
          sub="LLM 요약 완료, 사람 확정 대기"
        />
        <Stat
          label="오늘 확정 Yes"
          value={workflow.live ? workflow.live.today.new_relevant.toLocaleString("ko-KR") : "-"}
          sub="사람이 검토 후 확정"
        />
      </div>

      <Section title="처리 흐름" className="mb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {RIBBON.map((r, i) => (
            <div key={r.label} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5">
                <span className="font-mono text-[10.5px] text-pivot-500">{r.n}</span>
                <span className="text-xs font-medium text-slate-300">{r.label}</span>
              </span>
              {i < RIBBON.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="이벤트 검토 큐 (예시)"
        hint="실제 검토 이력이 아니라, 관리자 화면이 어떻게 구성되는지 보여주는 예시 카드입니다."
        className="mb-6"
      >
        <div className="flex flex-col gap-2.5">
          {EXAMPLE_EVENTS.map((e) => (
            <div key={e.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`chip shrink-0 ${e.signalCls}`}>{e.signal}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-white">{e.title}</span>
                    <span className="font-mono text-[10.5px] text-slate-600">
                      {e.domain} · {e.time}
                    </span>
                    <span className="text-[10.5px] text-slate-600">중복묶음 {e.dupCount}건</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    <span className="font-semibold text-pivot-500">AI 요약</span> — {e.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.hs6.map((h) => (
                      <span key={h} className="rounded bg-signal-blue/10 px-1.5 py-0.5 font-mono text-[10.5px] text-signal-blue">
                        {h}
                      </span>
                    ))}
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-slate-300">{e.country}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-[10.5px] font-medium text-signal-amber">{e.status}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled
                      title="정적 데모 — 실제 승인 기능 없음"
                      className="cursor-not-allowed rounded-md border border-signal-green/30 bg-signal-green/10 px-2.5 py-1 text-[11px] font-semibold text-signal-green opacity-70"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      disabled
                      title="정적 데모 — 실제 반려 기능 없음"
                      className="cursor-not-allowed rounded-md border border-signal-red/30 bg-signal-red/10 px-2.5 py-1 text-[11px] font-semibold text-signal-red opacity-70"
                    >
                      반려
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="실제 적용 시 남은 일">
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
          <li>
            <b className="text-white">인증·승인 백엔드 구축.</b> 지금은 정적 export 사이트라 서버
            상태가 없다 — 실제 승인/반려를 처리하려면 별도 API·DB(또는 discover.db 직접 조작
            어드민)가 필요하다.
          </li>
          <li>
            <b className="text-white">CANDIDATE LLM 요약 파이프라인 연결.</b> classify()가
            CANDIDATE로 분류한 이벤트를 LLM이 구조화 요약하는 단계는{" "}
            <Link href="/workflow/news/" className="text-pivot-500 hover:underline">
              뉴스 소급 검증
            </Link>{" "}
            페이지의 검증 로직과 같은 사전을 공유한다.
          </li>
          <li>
            <b className="text-white">확정 이력 로그.</b> 관리자가 확정한 이벤트는 다음날 09:00
            발행 전까지 하루 유예를 두고, 확정·반려 이력을 별도로 남겨야 한다.
          </li>
        </ul>
      </Section>

      <SourceTag>discover_collect.py classify() · pipeline_v2/discover.db · {workflow.source}</SourceTag>
    </>
  );
}
