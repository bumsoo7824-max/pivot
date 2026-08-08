import Link from "next/link";
import { notFound } from "next/navigation";
import ItemSearch from "@/components/ItemSearch";
import KotraMap from "@/components/charts/KotraMap";
import PriceSeriesChart from "@/components/charts/PriceSeriesChart";
import UnitPriceChart from "@/components/charts/UnitPriceChart";
import {
  GradeBadge,
  PageHeader,
  Section,
  SourceTag,
  Stat,
  Unavailable,
} from "@/components/ui";
import {
  allDetailHs4,
  allItems,
  comtrade,
  customsAlternatives,
  customsByHs4,
  fmtPct,
  fmtUsd,
  fmtYm,
  importPrice,
  kotraMap,
  matchByHs4,
  mvpByHs4,
  news,
  newsById,
  priceByHs4,
  type NewsRow,
} from "@/lib/data";

export function generateStaticParams() {
  return allDetailHs4().map((hs4) => ({ hs4 }));
}

const officesOf = (country: string) =>
  kotraMap.countries.find((c) => c.name === country)?.count ?? null;

function NewsList({ rows, reasons }: { rows: NewsRow[]; reasons?: Map<string, string[]> }) {
  if (rows.length === 0) {
    return (
      <Unavailable reason={`최근 ${news.window_days}일 수집분(공급망 매칭 ${news.supply_chain_matched}건)에서 이 품목과 연결되는 기사가 없다. 0건이 아니라 매칭 결과가 비어 있다는 뜻이다.`} />
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((n) => (
        <li key={n.id} className="py-3 first:pt-0 last:pb-0">
          <a
            href={n.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group block"
          >
            <p className="text-sm leading-snug text-slate-200 group-hover:text-pivot-500">
              {n.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span className="text-slate-400">{n.country}</span>
              <span>{n.date}</span>
              {n.industry && <span className="line-clamp-1">{n.industry}</span>}
              {reasons?.get(n.id)?.length ? (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-slate-400">
                  키워드 {reasons.get(n.id)!.join(" · ")}
                </span>
              ) : null}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ hs4: string }>;
}) {
  const { hs4 } = await params;
  const mvp = mvpByHs4.get(hs4);
  const cus = customsByHs4.get(hs4);
  if (!mvp && !cus) notFound();

  const name = mvp?.name ?? cus?.name ?? hs4;
  const hhi = mvp?.hhi ?? cus?.hhi ?? 0;
  const topCountry = mvp?.top_country ?? cus?.top_country ?? "";
  const topShare = mvp?.top_share ?? cus?.top_share ?? 0;
  const importUsd = mvp?.import_usd ?? cus?.import_usd ?? 0;
  const countryCount = mvp?.country_count ?? cus?.country_count ?? 0;

  const price = priceByHs4.get(hs4);
  const match = matchByHs4.get(hs4);

  // MVP 품목은 키워드 매칭 결과를, 관세청 원자료 품목은 관련국 기사를 붙인다.
  const reasons = new Map<string, string[]>();
  let related: NewsRow[] = [];
  if (match) {
    match.matched.forEach((m) => reasons.set(m.news_id, m.keywords));
    related = match.matched
      .map((m) => newsById.get(m.news_id))
      .filter((n): n is NewsRow => Boolean(n));
  } else if (cus) {
    const countries = new Set([cus.top_country, ...cus.alternatives.map((a) => a.country)]);
    related = news.news.filter((n) => countries.has(n.country));
  }

  const comtradeItem = comtrade.items.find((i) => i.hs4 === hs4);

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/items/" className="hover:text-pivot-500">
          품목 검색
        </Link>
        <span>/</span>
        <span className="font-mono text-pivot-500">HS {hs4}</span>
      </div>

      <PageHeader step={`HS ${hs4}`} title={name}>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mvp && <GradeBadge grade={mvp.grade} />}
          {cus?.latest_grade && !mvp && <GradeBadge grade={cus.latest_grade} />}
          <span className="chip border-white/10 text-slate-400">
            {mvp ? "MVP 10 품목" : "관세청 국가별 원자료 보유 품목"}
          </span>
          {mvp?.sector && <span className="chip border-white/10 text-slate-400">{mvp.sector}</span>}
          {mvp?.alert && (
            <span className="chip border-signal-red/40 bg-signal-red/10 text-signal-red">
              3계층 임계값 초과 — 경보
            </span>
          )}
        </div>
        <div className="mt-5 max-w-sm">
          <ItemSearch items={allItems} placeholder="다른 품목 검색..." />
        </div>
      </PageHeader>

      {/* ── 1. 구조 진단 (베이스: 관세청) */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="HHI (수입 집중도)" value={hhi.toFixed(4)} sub="1에 가까울수록 한 나라에 쏠림" />
        <Stat
          label="1위국"
          value={topCountry}
          sub={`비중 ${fmtPct(topShare)}`}
          tone={topShare >= 0.7 ? "red" : "amber"}
        />
        <Stat label="수입액" value={fmtUsd(importUsd)} sub="집계 기간 합계" />
        <Stat label="수입 상대국 수" value={`${countryCount}개국`} sub="실적이 잡힌 국가 기준" />
      </div>

      {/* ── 2. 선행지표 (ECOS) + 실측 단가 시계열 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="선행지표 — 수입물가지수"
          hint={
            price
              ? `한국은행 ${price.ecos_item_name} 계열(${importPrice.basis}, 월 단위). 관세청 통계 공표보다 선행한다.`
              : undefined
          }
        >
          {price ? (
            <>
              <PriceSeriesChart series={price.series} label={price.ecos_item_name} />
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="rounded-md border border-white/10 px-2.5 py-1 text-slate-400">
                  최신 지수{" "}
                  <b className="font-mono text-slate-100">
                    {price.latest_value?.toFixed(2) ?? "산출 불가"}
                  </b>
                </span>
                <span className="rounded-md border border-white/10 px-2.5 py-1 text-slate-400">
                  전월대비{" "}
                  <b
                    className={`font-mono ${
                      (price.latest_mom ?? 0) > 0 ? "text-signal-red" : "text-signal-green"
                    }`}
                  >
                    {price.latest_mom === null
                      ? "산출 불가"
                      : `${price.latest_mom > 0 ? "+" : ""}${price.latest_mom.toFixed(2)}%`}
                  </b>
                </span>
              </div>
            </>
          ) : (
            <Unavailable reason="이 품목에 대응하는 한국은행 수입물가지수 세부 계열을 매핑하지 않았다." />
          )}
        </Section>

        <Section
          title={`실측 단가 시계열 (${customsAlternatives.month_count}개월)`}
          hint="관세청 국가별 원자료에서 계산한 월별 수입 단가(USD/톤)."
        >
          {cus ? (
            <>
              <UnitPriceChart series={cus.series} />
              <p className="mt-3 text-xs text-slate-500">
                {cus.months}개월 · {fmtYm(cus.series[0]?.ym ?? "")} ~{" "}
                {fmtYm(cus.series[cus.series.length - 1]?.ym ?? "")}
              </p>
            </>
          ) : (
            <Unavailable reason="확보된 관세청 국가별 원자료의 HS4 범위(비철금속 10개)에 이 품목이 포함되지 않아 42개월 단가 시계열을 계산할 수 없다. 대신 위의 수입물가지수 계열을 선행지표로 쓴다." />
          )}
        </Section>
      </div>

      {/* ── 3. 정책 동향 (KOTRA 뉴스) */}
      <Section
        title="정책·규제 동향"
        hint={
          match
            ? `최근 ${news.window_days}일 KOTRA 해외시장뉴스 중 공급망 매칭 ${news.supply_chain_matched}건에서 품목 키워드로 연결한 ${match.matched_count}건 (1위국 ${match.top_country} 관련 ${match.china_matched_count}건).`
            : `이 품목의 1위국·대체 공급국 후보와 관련된 기사 ${related.length}건.`
        }
        className="mb-6"
      >
        <NewsList rows={related.slice(0, 10)} reasons={reasons} />
        <SourceTag>KOTRA 해외시장뉴스 · {news.match_method}</SourceTag>
      </Section>

      {/* ── 4. 실행 — 대체 공급국 + 지원기관 연결 */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="대체 공급국 상위 5 — 관세청 실측"
          hint="1위국을 제외한 수입액 상위 5개국. 국가 단위 발굴이며 기업 매칭이 아니다."
        >
          {cus ? (
            <ul className="space-y-2">
              {cus.alternatives.map((a, i) => (
                <li
                  key={a.country}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="font-mono text-xs text-slate-600">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-200">{a.country}</span>
                  <span className="font-mono text-xs text-slate-400">{fmtPct(a.share)}</span>
                  <span className="font-mono text-xs text-slate-500">{fmtUsd(a.import_usd)}</span>
                  <span className="rounded-md border border-pivot-500/25 bg-pivot-600/10 px-2 py-1 text-[11px] text-pivot-500">
                    KOTRA 법인{" "}
                    {a.kotra_offices === null ? "산출 불가" : `${a.kotra_offices.toLocaleString("ko-KR")}사`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable reason="이 품목은 관세청 국가별 원자료 범위 밖이라 실측 기반 대체 공급국을 계산할 수 없다." />
          )}
        </Section>

        <Section
          title="대체 공급국 — UN Comtrade"
          hint={
            comtrade.status === "ok" && comtrade.fetched_at
              ? `최근 수집 ${comtrade.fetched_at.slice(0, 10)} 기준.`
              : undefined
          }
        >
          {comtrade.status === "ok" && comtradeItem?.alternatives.length ? (
            <ul className="space-y-2">
              {comtradeItem.alternatives.map((a, i) => (
                <li
                  key={a.country}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-3"
                >
                  <span className="font-mono text-xs text-slate-600">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-200">{a.country}</span>
                  <span className="font-mono text-xs text-slate-500">{fmtUsd(a.export_usd)}</span>
                  <span className="rounded-md border border-pivot-500/25 bg-pivot-600/10 px-2 py-1 text-[11px] text-pivot-500">
                    KOTRA 법인 {officesOf(a.country)?.toLocaleString("ko-KR") ?? "산출 불가"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable
              reason={`${comtrade.reason ?? "수집되지 않음"}. 값이 없으므로 0을 대입하지 않는다.`}
            />
          )}
        </Section>
      </div>

      {/* ── 5. 지원기관 네트워크 */}
      <Section
        title="연결 가능한 지원 네트워크"
        hint={`KOTRA 해외진출기업 ${kotraMap.total_companies.toLocaleString("ko-KR")}사를 국가별로 집계했다. ${kotraMap.note}`}
      >
        <KotraMap highlight={cus ? cus.alternatives.map((a) => a.country) : []} />
      </Section>
    </>
  );
}
