import ClickableRow from "@/components/ClickableRow";
import TopCountryBar from "@/components/charts/TopCountryBar";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { allDetailHs4, blindspots, fmtUsd } from "@/lib/data";

const HAS_DETAIL = new Set(allDetailHs4());

export default function TopCountryPage() {
  const counts = blindspots.top_country_counts;
  const chinaShare = blindspots.china_share;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const second = entries[1];

  const chinaItems = blindspots.points
    .filter((p) => p.is_blindspot && p.top_country === "중국")
    .sort((a, b) => b.import_usd - a.import_usd)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        step="1위국 분포"
        title={`사각지대 ${blindspots.blindspot_count}개 중 ${blindspots.china_count}개가 중국을 1위국으로 둔다`}
        lead="쏠림은 품목마다 흩어져 있지 않고 한 방향으로 모인다. 개별 품목의 문제가 아니라 포트폴리오 전체의 문제라는 뜻이다."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="1위국 = 중국"
          value={`${blindspots.china_count}개`}
          sub={`전체 사각지대의 ${(chinaShare * 100).toFixed(1)}%`}
          tone="red"
        />
        <Stat
          label={`2위 ${second?.[0] ?? "—"}`}
          value={`${second?.[1] ?? 0}개`}
          sub={`중국의 ${second ? ((second[1] / blindspots.china_count) * 100).toFixed(0) : 0}% 수준`}
        />
        <Stat label="등장하는 1위국 수" value={`${entries.length}개국`} sub="사각지대 기준" />
      </div>

      <Section
        title="사각지대 품목의 1위국 분포"
        hint="상위 12개국과 나머지 합계. 중국을 강조색으로 표시했다."
        className="mb-6"
      >
        <TopCountryBar />
        <SourceTag>관세청 수출입통계 HS4 집계 · 사각지대 {blindspots.blindspot_count}개 기준</SourceTag>
      </Section>

      <Section
        title="중국 의존 상위 품목"
        hint="1위국이 중국인 사각지대 품목을 수입액 순으로 정렬했다. 상세 데이터가 있는 품목은 클릭해 바로 확인할 수 있다."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4 font-medium">HS4</th>
                <th className="pb-2 pr-4 font-medium">품목</th>
                <th className="pb-2 pr-4 text-right font-medium">HHI</th>
                <th className="pb-2 pr-4 text-right font-medium">중국 비중</th>
                <th className="pb-2 text-right font-medium">수입액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {chinaItems.map((p) => {
                const linked = HAS_DETAIL.has(p.hs4);
                const cells = (
                  <>
                    <td className="py-2.5 pr-4 font-mono text-xs text-pivot-500">{p.hs4}</td>
                    <td className="py-2.5 pr-4">
                      <span className="line-clamp-1">{p.name}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs">
                      {p.hhi.toFixed(4)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-signal-red">
                      {(p.top_share * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs">{fmtUsd(p.import_usd)}</td>
                  </>
                );
                return linked ? (
                  <ClickableRow key={p.hs4} href={`/items/${p.hs4}/`} className="text-slate-300">
                    {cells}
                  </ClickableRow>
                ) : (
                  <tr key={p.hs4} className="text-slate-300">
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
