import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { coverageCounts } from "@/lib/coverage-data";
import { workflow } from "@/lib/workflow-data";

/**
 * 페이지 5 · 유료 리포트 기능 설명.
 * 무료 MVP(①~⑧)와 구분되는 유료 범위(⑨⑩ + HHI/통관 참고지표를 묶은 리포트 발행)를
 * 지금 확보된 실데이터 기준으로 설명한다 — 아직 만들지 않은 기능을 마치 동작하는 것처럼
 * 보여주지 않고, "무엇을 근거로 무엇을 보여줄 것인지"를 명시한다.
 */

const REPORT_SECTIONS = [
  {
    title: "1. 경보 요약",
    desc: "확정된 Yes 경보의 사건 내용, 영향국, 관련 HS6·발생 시각을 한 장으로 정리한다.",
    basis: "①~⑧ 무료 MVP 파이프라인 결과 그대로 사용",
  },
  {
    title: "2. 노출도 · 심각도",
    desc: "HHI(수입 집중도)·통관 스파이크를 참고 지표로 함께 보여줘, 같은 Yes 경보라도 얼마나 심각한지 가늠하게 한다.",
    basis: "TRASS 15개월 시계열(⑦⑧) — 379개 확보완료 품목 기준, 나머지는 HS4참고치",
  },
  {
    title: "3. 고객 노출 결합",
    desc: "고객사가 실제로 수입하는 HS6·공급국을 사건 영향국과 겹쳐, \"내 회사에 영향이 있는 경보만\" 남긴다.",
    basis: "⑨ 고객 노출 결합 — 유료 범위, 고객별 HS6 등록 필요",
  },
  {
    title: "4. 대체공급국 후보",
    desc: "영향국을 제외하고, 같은 HS6를 실제로 수출 중인 국가를 수입 비중 순으로 추천한다.",
    basis: "customs_alternatives.json(관세청 수출입통계) · comtrade_alts.json(UN Comtrade 기반, 현재 10개 우선품목)",
  },
  {
    title: "5. 지원정책·네트워크 연계",
    desc: "대체공급국에 KOTRA 해외 법인·사무소가 있는지, 공급망 전환에 쓸 수 있는 정부·기관 지원정책이 있는지 매칭한다.",
    basis: "kotra_map.json(9,927개 법인·84개국) — 지원정책 자격요건 필터는 후속 구축",
  },
] as const;

export default function PaidReportPage() {
  const counts = coverageCounts();

  return (
    <>
      <PageHeader
        step="워크플로우 · 페이지 5"
        title="유료 리포트"
        lead="무료 MVP(①~⑧)는 경보를 확정해서 보여주는 데까지다. 유료 리포트는 그 경보를 고객사 실제 공급망과 연결해, 대체공급국·지원정책까지 한 장으로 묶어 발행한다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-red">
          아래 구성은 기획 중인 유료 리포트의 목차이자, 각 항목을 무엇으로 채울지의 근거다. 실제
          발행 자동화는 아직 없고,{" "}
          <Link href="/workflow/alt-supply/" className="underline">
            대체공급처·지원정책
          </Link>{" "}
          페이지에서 지금 가진 데이터로 무엇을 보여줄 수 있는지 확인할 수 있다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="무료 MVP 범위" value="①~⑧" sub="경보 확정까지 — 리포트 발행은 유료" />
        <Stat label="대체공급처까지 완비" value={`${counts.collected}개`} tone="pivot" sub="1,109개 중 — 379개 기준 우선 시연" />
        <Stat label="수입액·후보국 확보" value={`${counts.collected_partial + counts.collected}개`} sub="리포트에 후보국을 채울 수 있는 품목 수" />
        <Stat label="결합 재현율" value={`${workflow.recall_rounds[workflow.recall_rounds.length - 1].recall}%`} sub="경보 자체의 신뢰도" />
      </div>

      <Section title="리포트 구성" hint="각 섹션이 무엇을 근거로 채워지는지 함께 표시한다" className="mb-6">
        <div className="flex flex-col gap-3">
          {REPORT_SECTIONS.map((s) => (
            <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{s.desc}</p>
              <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500">
                근거 데이터 · {s.basis}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="발행 방식 (기획)">
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
          <li>
            <b className="text-white">발행 주기.</b> 확정된 Yes 경보가 고객 등록 HS6·공급국과
            겹칠 때마다 건별로 발행한다 — 정기 리포트가 아니라 이벤트 트리거 방식.
          </li>
          <li>
            <b className="text-white">형식.</b> 웹에서 바로 보는 대시보드 + PDF 다운로드를
            함께 제공한다(기획 단계, 자동 PDF 생성은 미구현).
          </li>
          <li>
            <b className="text-white">데이터 정밀도 표기.</b>{" "}
            <Link href="/workflow/coverage/" className="text-pivot-500 hover:underline">
              품목 커버리지 검색
            </Link>
            에서 쓰는 &quot;HS6실측 / HS4참고&quot; 구분을 리포트에도 그대로 노출해, 어떤 근거가
            더 정밀한지 고객이 알 수 있게 한다.
          </li>
        </ul>
      </Section>

      <SourceTag>
        최종_통합_리스크_테이블.md · customs_alternatives.json · comtrade_alts.json · kotra_map.json ·{" "}
        {workflow.source}
      </SourceTag>
    </>
  );
}
