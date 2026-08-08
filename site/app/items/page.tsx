import Link from "next/link";
import ItemSearch from "@/components/ItemSearch";
import { GradeBadge, PageHeader, Section, SourceTag } from "@/components/ui";
import { allItems, blindspots, customsAlternatives, fmtPct, fmtUsd, mvp10 } from "@/lib/data";

export default function ItemsIndexPage() {
  return (
    <>
      <PageHeader
        step="품목 검색"
        title="품목 검색"
        lead="HS 코드나 품목명으로 검색하세요. 구조 진단, 선행지표, 정책 동향, 대체 공급국, 지원기관 연결까지 한 화면에서 확인합니다. 품목마다 확보된 원자료가 달라, 없는 항목은 '산출 불가'로 표기합니다."
      >
        <div className="mt-5 max-w-xl">
          <ItemSearch items={allItems} />
        </div>
      </PageHeader>

      <Section
        title="MVP 10개 품목"
        hint={`사각지대 ${blindspots.blindspot_count}개 중 수입액 상위 + 중국 의존 우선으로 선정. 구조 지표와 수입물가 선행지표, 관련 뉴스를 제공합니다.`}
        className="mb-6"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {mvp10.items.map((i) => (
            <Link
              key={i.hs4}
              href={`/items/${i.hs4}/`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3 transition hover:border-pivot-500/40 hover:bg-white/5"
            >
              <span className="font-mono text-xs text-pivot-500">{i.hs4}</span>
              <span className="line-clamp-1 flex-1 text-sm text-slate-200">{i.name}</span>
              <span className="hidden font-mono text-xs text-slate-500 sm:inline">
                HHI {i.hhi.toFixed(2)}
              </span>
              <GradeBadge grade={i.grade} />
            </Link>
          ))}
        </div>
      </Section>

      <Section
        title={`관세청 국가별 원자료 보유 품목 ${customsAlternatives.items.length}개`}
        hint={`${customsAlternatives.month_count}개월 × 국가별 실적이 확보된 품목입니다. 월별 수입 단가 시계열과 실측 기반 대체 공급국 상위 5개국을 제공합니다.`}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {customsAlternatives.items.map((c) => (
            <Link
              key={c.hs4}
              href={`/items/${c.hs4}/`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3 transition hover:border-signal-blue/40 hover:bg-white/5"
            >
              <span className="font-mono text-xs text-signal-blue">{c.hs4}</span>
              <span className="line-clamp-1 flex-1 text-sm text-slate-200">{c.name}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">
                {c.top_country} {fmtPct(c.top_share, 0)}
              </span>
              <span className="hidden font-mono text-xs text-slate-500 lg:inline">
                {fmtUsd(c.import_usd)}
              </span>
            </Link>
          ))}
        </div>
        <SourceTag>
          {customsAlternatives.source} · {customsAlternatives.period[0]}~
          {customsAlternatives.period[1]}
        </SourceTag>
      </Section>
    </>
  );
}
