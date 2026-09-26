import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";
import adminEvents from "@data/admin_sample_events.json";

/**
 * 관리자 UI(뉴스 이벤트 검토) 시안.
 * 이 사이트는 정적 export라 실제 승인/반려 액션을 처리할 백엔드가 없다.
 * 아래 이벤트 카드는 discover_collect.py가 실제로 수집·판정한 pipeline_v2/discover.db
 * 원자료 그대로다(2026-09-25~26) — 지어낸 예시가 아니다. 다만 중복제거·HS6/국가 매핑은
 * 아직 실제로 동작하지 않는 단계라 그렇게 표시하지 않는다(workflow.json 상 4단계 status=partial).
 * 2026-09-27: materials 사전 오탐(은/럼프) 제거 + discover.db 724건 전체 재분류(backfill) 완료.
 * 같은 날, AI 2차 검증(⑤단계)의 범위를 "CANDIDATE만"에서 "CANDIDATE 재검색·요약 + RELEVANT 표본
 * 팩트체크"로 넓히기로 확정 — 사전 정리로도 못 잡는 잔여 오탐(아래 '높이' 사례 참고)을 상시 잡기
 * 위함. AI 제공사는 OpenAI로 확정(요약 품질·비용 비교 후, Claude 대비 저렴). 파이프라인 함수
 * (ai_verify_candidate/ai_verify_relevant_sample)는 구현했지만 OPENAI_API_KEY가 필요해 이 정적
 * 사이트에서 자동 실행되진 않는다 — 로컬에서 --ai-verify-*-n 플래그로 수동 실행한다.
 */

const RIBBON = [
  { n: "①", label: "뉴스 수집", done: true },
  { n: "②", label: "중복 제거", done: false },
  { n: "③", label: "HS6·국가 매핑", done: false },
  { n: "④", label: "classify() 신호등", done: true },
  { n: "⑤", label: "AI 검증(CANDIDATE 요약 + RELEVANT 표본)", done: false },
  { n: "⑥", label: "관리자 확정", done: false },
] as const;

const SIGNAL_CLS: Record<string, string> = {
  RELEVANT: "border-signal-green/40 bg-signal-green/10 text-signal-green",
  CANDIDATE: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
};

export default function WorkflowAdminPage() {
  const last = workflow.recall_rounds[workflow.recall_rounds.length - 1];

  return (
    <>
      <PageHeader
        step="워크플로우 · 페이지 3"
        title="관리자 UI (뉴스 이벤트 검토)"
        lead="discover_collect.py가 실제로 수집·판정한 이벤트를 그대로 보여준다. 지금 실제로 되는 건 ①수집과 ④classify() 판정뿐이고, 나머지(중복제거·HS6매핑·AI검증·관리자확정 화면)는 아직 기획 단계다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          이 사이트는 정적으로 배포되는 데모라 승인/반려를 처리하는 백엔드가 없습니다. 아래 5건은
          가짜 예시가 아니라 <code className="text-slate-300">pipeline_v2/discover.db</code>에 실제
          기록된 원자료(2026-09-25~26, materials 사전 수정 후 재분류 기준)이며, 승인/반려 버튼만
          정적 데모라 비활성화했습니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="결합 재현율" value={`${last.recall}%`} tone="pivot" sub={`held-out 15개 사건(${last.round})`} />
        <Stat label="오늘 수집" value={workflow.live ? workflow.live.today.new_events.toLocaleString("ko-KR") : "-"} sub="네이버+구글뉴스" />
        <Stat
          label="오늘 CANDIDATE"
          value={workflow.live ? workflow.live.today.new_candidate.toLocaleString("ko-KR") : "-"}
          tone="amber"
          sub="materials 미매칭 — 사람 확인 필요"
        />
        <Stat
          label="오늘 확정 Yes"
          value={workflow.live ? workflow.live.today.new_relevant.toLocaleString("ko-KR") : "-"}
          sub="disrupt+materials 둘 다 매칭"
        />
      </div>

      <Section title="처리 흐름 — 지금 실제로 되는 것과 안 되는 것" className="mb-6">
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

      <Section
        title="실제 수집 이벤트 (discover.db 원자료, 2026-09-25~26)"
        hint="materials가 비어 있으면 CANDIDATE다 — disrupt(행위어근)는 걸렸지만 materials(품목어)가 사전에 없어 자동 확정하지 않는다."
        className="mb-6"
      >
        <div className="flex flex-col gap-2.5">
          {adminEvents.events.map((e) => (
            <div
              key={e.title}
              className={`rounded-xl border p-4 ${
                "fix_example" in e && e.fix_example
                  ? "border-pivot-500/30 bg-pivot-600/5"
                  : "border-white/10 bg-white/[0.02]"
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
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{adminEvents.note}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-pivot-500">{adminEvents.fix_example_note}</p>
      </Section>

      <Section title="발견 및 수정한 문제 — materials 사전의 동음이의어 노이즈" className="mb-6">
        <p className="text-sm leading-relaxed text-slate-300">
          이 페이지를 만들며 discover.db를 직접 열어보니, materials 사전에{" "}
          <code className="text-slate-200">은</code>(275건 매칭)·<code className="text-slate-200">럼프</code>
          (152건, &quot;트럼프&quot;의 일부)처럼 실제 품목명이 아닌 항목이 섞여 다수의 오탐(false
          positive)을 만들고 있었다. &quot;은&quot;은 한국어 조사(&quot;~은/는&quot;)와 겹쳐 거의 모든
          문장에서 매칭되고, &quot;럼프&quot;는 애초에 정상적인 품목 단어가 아니다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          <b className="text-white">2026-09-27 조치:</b> 두 항목을 사전에서 삭제하고
          discover.db 누적 724건을 새 사전으로 재분류(backfill)했다 — RELEVANT 618→451건,
          CANDIDATE 145→312건(167건 이동, 새로 NONE이 된 건은 0건). &quot;위험 키워드와 N자
          이내로 근접해야 인정&quot;하는 매칭 로직도 검토했지만, &quot;은&quot;은 조사라 disrupt
          단어 바로 옆에 우연히 오는 경우가 있어(167건 중 11건) 근접조건만으로는 완전히 못 걸러
          — 알고리즘을 더 만들기보다 노이즈 항목 삭제 + 아래 AI 표본 검증으로 처리하기로 했다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{adminEvents.new_risk_found}</p>
      </Section>

      <Section title="실제 적용 시 남은 일">
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
          <li>
            <b className="text-white">materials 사전 정리 — 완료.</b> &quot;은&quot;·&quot;럼프&quot;
            제거 + 전체 재분류(backfill)까지 끝났다(위 섹션 참고). 다만 MATERIALS_TIER2(사람 재검토
            전 Kiwi 자동추출 초안)에는 &quot;높이&quot; 같은 유사 항목이 더 있을 수 있어, 전량
            검토는 별도 과제로 남아 있다.
          </li>
          <li>
            <b className="text-white">AI 2차 검증 파이프라인 — 설계·구현 완료, 실행은 로컬에서.</b>{" "}
            <code className="text-slate-300">discover_collect.py --ai-verify-candidates-n</code>과{" "}
            <code className="text-slate-300">--ai-verify-relevant-n</code> 두 경로로 나눴다: (1)
            CANDIDATE는 AI가 관련 기사를 추가 검색해 corroborating 근거를 모으고 요약 — 결합
            재현율을 올리는 목적. (2) RELEVANT는 매 실행마다 일부를 무작위 표본으로 뽑아 AI가
            매칭된 disrupt·materials 키워드가 원문 맥락에서 실제로 그 의미인지 되물어 팩트체크 —
            사전 정리로도 못 잡는 &quot;높이&quot; 같은 잔여 오탐(정밀도 문제)을 상시 잡는 목적.
            AI 제공사는 OpenAI(요약 품질·비용 비교 후 확정)로 <code className="text-slate-300">OPENAI_API_KEY</code>가
            필요해 이 정적 사이트에서 자동 실행되지는 않고, 사람이 최종 승인/반려하는 건 그대로다 —
            AI는 판단을 대신하는 게 아니라 사람이 볼 요약을 만들어주는 보조 역할.
          </li>
          <li>
            <b className="text-white">중복 제거·HS6/국가 매핑.</b> 지금은 사전에 없어, 같은 사건이
            여러 기사로 중복 집계되고 품목·국가 태깅도 안 된다 —{" "}
            <Link href="/workflow/overview/" className="text-pivot-500 hover:underline">
              전체 워크플로우
            </Link>
            의 ②③단계가 이걸 가리킨다.
          </li>
          <li>
            <b className="text-white">인증·승인 백엔드 구축.</b> 정적 export 사이트라 서버 상태가
            없다 — 실제 승인/반려를 처리하려면 별도 API·DB가 필요하다.
          </li>
        </ul>
      </Section>

      <SourceTag>discover_collect.py classify() · pipeline_v2/discover.db(2026-09-25~26 원자료) · {workflow.source}</SourceTag>
    </>
  );
}
