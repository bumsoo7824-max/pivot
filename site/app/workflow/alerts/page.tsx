import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { workflow } from "@/lib/workflow-data";

const TIER_STYLE = {
  Yes: "border-signal-green/40 bg-signal-green/10 text-signal-green",
  CANDIDATE: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
  No: "border-white/15 bg-white/5 text-slate-400",
};

export default function AlertFlowPage() {
  const s5 = workflow.steps.find((s) => s.id === 5)!;
  const s6 = workflow.steps.find((s) => s.id === 6)!;
  const s7 = workflow.steps.find((s) => s.id === 7)!;
  const s8 = workflow.steps.find((s) => s.id === 8)!;

  return (
    <>
      <PageHeader
        step="워크플로우 · HHI 등급·경보 흐름"
        title="사전 판정에서 경보 발행까지 — ⑤~⑧ 상세"
        lead="뉴스 사건이 HS6·국가에 매핑된 뒤, classify()가 자동으로 방향을 점검하고, 신호등 3단계를 거쳐, 노출도(HHI)와 통관 지표로 심각도를 붙이기까지의 과정."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="사전 크기" value="1,229개" sub="DISRUPT + MATERIALS(관세청 품목명 전체 반영)" />
        <Stat label="신호등 판정" value="Yes / CANDIDATE / No" tone="amber" sub="사람 검토 없이 자동 발행되는 단계는 없음" />
        <Stat label="HHI 위상" value="참고용" tone="pivot" sub="논문 검토 결과 판정력 낮음 — 핵심은 ②~⑥ 뉴스" />
      </div>

      <Section title={`⑤ ${s5.title}`} className="mb-6" hint="사람이 직접 읽지 않고 제목+발췌만으로 1차 방향을 자동 점검한다.">
        <p className="text-sm leading-relaxed text-slate-300">{s5.detail}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-slate-300">DISRUPT (차질 신호)</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              수출금지·통제·파업·불가항력 등 공급이 흔들렸다는 사건 언어. ACTION_ROOT(행위어근)와
              TRADE_WORD(무역어)가 공존하면 정확한 어순이 아니어도 신호로 인정한다.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-slate-300">MATERIALS (품목 신호)</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              관세청 HS부호단위별품목명 공식자료 전체 유니버스(HS4 256 / HS6 1,109)를 Kiwi
              형태소분석기로 정제해 만든 MATERIALS_TIER2(1,078개)를 병합 — 총 1,229개.
            </p>
          </div>
        </div>
      </Section>

      <Section title={`⑥ ${s6.title}`} className="mb-6" hint="Yes 판정도 사람이 직접 확인한 뒤에만 발행된다 — 자동 발행 단계는 없음.">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`rounded-xl border p-4 ${TIER_STYLE.Yes}`}>
            <p className="text-sm font-semibold">Yes (RELEVANT)</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-90">
              차질 신호 + 품목 신호가 둘 다 걸린 명확한 사건. 사람이 직접 검토·확정 후 다음날 09시
              발행.
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${TIER_STYLE.CANDIDATE}`}>
            <p className="text-sm font-semibold">CANDIDATE</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-90">
              사건 언어는 있는데 사전에 없는 표현이라 품목어가 안 걸린 절충안 구간. LLM이 구조화
              요약(관련여부·추정 HS6·확신도·판단근거)을 만들면 사람이 최종 검토한다.
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${TIER_STYLE.No}`}>
            <p className="text-sm font-semibold">No (NONE)</p>
            <p className="mt-1.5 text-xs leading-relaxed opacity-90">
              차질/품목 신호가 모두 없는 무관 기사. 조용히 버려지며 사람 검토 대상이 아니다.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{s6.detail}</p>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title={`⑦ ${s7.title}`} hint="2026-09-25 결정: 참고용 지표로 다운그레이드">
          <p className="text-sm leading-relaxed text-slate-300">{s7.detail}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            HHI(허핀달-허쉬만지수)는 과거 세션 논문 검토(스파이크 P=0.45, 단가 P=0.50, HS6 좁힘
            P=0.588 n=45 비유의)에서 판정력이 크지 않다고 확인됐다. 552개 사각지대의 HHI 전량
            계산은 필수가 아니며, 핵심 판정은 여전히 ②~⑥ 뉴스 소급이다.
          </p>
        </Section>
        <Section title={`⑧ ${s8.title}`} hint="확인/심각도(소급용) — 신호등 판정 자체를 바꾸지 않는다">
          <p className="text-sm leading-relaxed text-slate-300">{s8.detail}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            관세청 통관 통계는 익월 중순에야 확정되므로(골든타임 참고), 뉴스 경보가 나간 지
            3~4개월 뒤 &quot;실제로 수치에도 찍혔는지&quot;를 소급 확인하는 사후 검증 지표다.
          </p>
        </Section>
      </div>

      <Section title="CANDIDATE 검토 → 사전 피드백 루프">
        <p className="text-sm leading-relaxed text-slate-300">
          사람이 CANDIDATE를 검토하다 새 키워드(사전에 없던 사건어·품목어)를 확인하면{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-300">
            discover_candidates.csv
          </code>
          를 통해 ②·⑤단계 사전으로 다시 피드백한다 — 이 루프가 있어 &quot;처음 보는 표현으로
          보도되는 새 사건&quot;에 대한 안전망이 된다.
        </p>
      </Section>

      <SourceTag>
        discover_collect.py classify()/tag() · CANDIDATE_보조검토_LLM_프롬프트.md · 2026-09-25 확정
      </SourceTag>
    </>
  );
}
