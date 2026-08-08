import Link from "next/link";
import ItemSearch from "@/components/ItemSearch";
import LayerDiagram, { AlertFlow } from "@/components/LayerDiagram";
import { GradeBadge, Section, SourceTag, Stat } from "@/components/ui";
import { allItems, blindspots, fmtPct, fmtUsd, importPrice, kotraMap, mvp10, news } from "@/lib/data";

export default function HomePage() {
  const alerts = mvp10.items.filter((i) => i.alert);

  return (
    <>
      <section className="mb-8">
        <p className="kicker">Supply-Pivot</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
          내 품목의 공급망, <span className="text-slate-400">지금</span> 위험한가.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-400">
          HS 코드나 품목명을 입력하면 수입 집중도, 최신 물가 신호, 정책 동향, 대체 공급국까지
          한 화면에서 확인합니다. 확정 통계가 공표되기 전에 먼저 움직이는 지표를 씁니다.
        </p>
        <div className="mt-6 max-w-xl">
          <ItemSearch items={allItems} autoFocus />
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="사각지대 품목"
          value={blindspots.blindspot_count}
          sub={`RED ${blindspots.grade_counts.RED ?? 0} · YELLOW ${blindspots.grade_counts.YELLOW ?? 0}`}
          tone="pivot"
        />
        <Stat
          label="1위국이 중국인 품목"
          value={`${blindspots.china_count}개`}
          sub={`사각지대의 ${(blindspots.china_share * 100).toFixed(1)}%`}
          tone="red"
        />
        <Stat
          label="선행지표 확보 기간"
          value={`${importPrice.month_count}개월`}
          sub={`${importPrice.range[0]}~${importPrice.range[1]} 월 단위 수입물가지수`}
          tone="amber"
        />
        <Stat
          label="연결 가능한 해외법인"
          value={kotraMap.total_companies.toLocaleString("ko-KR")}
          sub={`${kotraMap.country_count}개국 · 국가 단위 발굴 결과와 연결`}
        />
      </div>

      <Section
        title={`지금 경보 상태인 품목 ${alerts.length}개`}
        hint="물가·구조·정책 세 계층 임계값을 모두 넘어 경보가 발령된 품목입니다. 바로 상세로 이동해 대체 공급국까지 확인하세요."
        className="mb-6"
      >
        {alerts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map((item) => (
              <Link
                key={item.hs4}
                href={`/items/${item.hs4}/`}
                className="flex items-center gap-3 rounded-lg border border-signal-red/25 bg-signal-red/[0.05] px-3.5 py-3 transition hover:border-signal-red/50 hover:bg-signal-red/10"
              >
                <span className="font-mono text-xs text-signal-red">{item.hs4}</span>
                <span className="line-clamp-1 flex-1 text-sm text-slate-200">{item.name}</span>
                <span className="hidden font-mono text-xs text-slate-500 sm:inline">
                  {item.top_country} {fmtPct(item.top_share, 0)}
                </span>
                <GradeBadge grade={item.grade} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">현재 3계층 임계값을 동시에 넘긴 품목이 없습니다.</p>
        )}
        <SourceTag>
          한국은행 ECOS 수입물가지수(월 단위, 익월 초 공표) · 관세청 수출입통계(익월 중순) · KOTRA
          해외시장뉴스(90일 {news.total_collected}건 중 공급망 매칭 {news.supply_chain_matched}건)
        </SourceTag>
      </Section>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/items/"
          className="rounded-lg bg-pivot-600 px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-pivot-500"
        >
          전체 품목 목록 보기 →
        </Link>
        <Link
          href="/blindspots/"
          className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
        >
          사각지대 전체 스크리닝
        </Link>
      </div>

      <Section
        title="경보는 어떻게 산출되는가"
        hint="한 층만으로는 경보를 내지 않습니다. 세 계층 임계값을 모두 넘을 때만 발령합니다. 자세한 근거는 골든타임 페이지에 있습니다."
        className="mb-6"
      >
        <AlertFlow steps={mvp10.alert_order} />
      </Section>

      <Section title="데이터 계층 구조" hint="베이스가 구조를 정의하고, 선행 두 층이 시점을 앞당기고, 실행층이 대안을 제시합니다.">
        <LayerDiagram />
      </Section>
    </>
  );
}
