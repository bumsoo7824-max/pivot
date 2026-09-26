import Link from "next/link";
import { notFound } from "next/navigation";
import KotraMap from "@/components/charts/KotraMap";
import { PageHeader, Section, SourceTag, Stat, Unavailable } from "@/components/ui";
import { allDetailHs4, comtrade, customsAlternatives, fmtPct, fmtUsd } from "@/lib/data";
import { STATUS_META, universe, type CoverageItem } from "@/lib/coverage-data";

const byHs6 = new Map(universe.map((i) => [i.hs6, i]));
const PILOT_HS4 = new Set(allDetailHs4());

const SUPPORT_POLICIES = [
  {
    title: "소부장 공급망안정 종합지원 사업",
    org: "산업통상자원부",
    desc: "소재·부품·장비 대체 공급망 확보를 위한 R&D·자금·세제 종합 지원. 공급망 특정국 의존도가 높은 품목에 우선 배정된다.",
    url: "https://www.motie.go.kr",
  },
  {
    title: "소재·부품·장비 으뜸기업 선정",
    org: "산업통상자원부",
    desc: "소부장 핵심 기술을 보유한 기업을 선정해 R&D·금융·해외마케팅을 묶어 지원한다.",
    url: "https://www.motie.go.kr",
  },
  {
    title: "요소 수급 안정화 지원사업",
    org: "산업통상자원부 · KOTRA",
    desc: "특정 원자재의 수급 위기 시 대체 수입선 발굴·물량 확보를 지원한 선례 — 유사 원자재 위기 대응의 참고 모델.",
    url: "https://www.kotra.or.kr",
  },
  {
    title: "해외 진출·수출물류 지원사업",
    org: "KOTRA",
    desc: "대체 공급국과의 신규 거래선 발굴, 물류·통관 애로 해소를 지원한다.",
    url: "https://www.kotra.or.kr",
  },
] as const;

export function generateStaticParams() {
  return universe.map((i) => ({ hs6: i.hs6 }));
}

function CountryTable({ item }: { item: CoverageItem }) {
  if (item.top5_countries && item.top5_countries.length > 0) {
    return (
      <ul className="space-y-2">
        {item.top5_countries.map((c, i) => (
          <li key={c.country} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
            <span className="font-mono text-xs text-slate-600">{i + 1}</span>
            <span className="flex-1 text-sm text-slate-200">{c.country}</span>
            <span className="font-mono text-xs text-slate-400">{c.share_pct}%</span>
            <span className="font-mono text-xs text-slate-500">${(c.usd / 1000).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}K</span>
          </li>
        ))}
      </ul>
    );
  }
  if (item.top_country_hs4_ref) {
    return (
      <Unavailable
        reason={`같은 HS4(${item.hs4}) 리스크 테이블 기준 1위국은 ${item.top_country_hs4_ref}(비중 ${item.top_share_hs4_ref}%)이지만, 국가별 상세 목록은 이 HS4 안 형제 HS6 전체가 공유하는 집계값이라 HS6 단위로 쪼갤 수 없다. 수입 상대국 수는 ${item.country_count_hs4_ref ?? "산출 불가"}개국.`}
      />
    );
  }
  return <Unavailable reason="이 품목은 아직 국가별 실측 데이터가 없다 — 품목 커버리지 검색에서 상태를 확인하라." />;
}

export default async function Hs6DetailPage({ params }: { params: Promise<{ hs6: string }> }) {
  const { hs6 } = await params;
  const item = byHs6.get(hs6);
  if (!item) notFound();

  const meta = STATUS_META[item.status];
  const pilotDetailAvailable = PILOT_HS4.has(item.hs4);
  const comtradeItem = comtrade.items.find((i) => i.hs4 === item.hs4);
  const customsItem = customsAlternatives.items.find((i) => i.hs4 === item.hs4);

  const hhi = item.hhi_hs4_ref;
  const topCountry = item.top_country ?? item.top_country_hs4_ref;
  const topSharePct = item.top_country_share_pct ?? item.top_share_hs4_ref;
  const importUsd = item.import_usd_12m ?? item.import_usd_hs4_ref;
  const countryCount = item.n_country ?? item.country_count_hs4_ref;

  // 대체공급국 후보: nitemtrade 543개는 top5 국가 중 1위국 제외 상위4개국을 그대로 후보로 쓸 수 있다(실측).
  const nitemtradeAlts = item.top5_countries?.slice(1) ?? [];

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/workflow/coverage/" className="hover:text-pivot-500">
          품목 커버리지 검색
        </Link>
        <span>/</span>
        <span className="font-mono text-pivot-500">HS {hs6}</span>
      </div>

      <PageHeader step={`HS ${hs6} · HS4 ${item.hs4}`} title={item.name || item.category}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`chip ${meta.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.short}
          </span>
          {pilotDetailAvailable && (
            <span className="chip border-pivot-500/30 bg-pivot-600/10 text-pivot-500">우선 매칭 20개 품목</span>
          )}
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="HHI (수입 집중도)"
          value={hhi !== undefined ? hhi.toFixed(4) : "산출 불가"}
          sub={hhi !== undefined ? "1에 가까울수록 한 나라에 쏠림 · HS4 참고" : "355개 구조 HHI 계산 대상 밖"}
        />
        <Stat
          label="1위국"
          value={topCountry ?? "산출 불가"}
          sub={topSharePct !== undefined ? `비중 ${topSharePct}%` : "데이터 없음"}
          tone={topSharePct !== undefined && topSharePct >= 70 ? "red" : "amber"}
        />
        <Stat label="수입액" value={importUsd ? fmtUsd(importUsd) : "산출 불가"} sub={item.import_usd_12m ? "nitemtrade 12개월 실측" : item.import_usd_hs4_ref ? "HS4 리스크 테이블 참고" : "데이터 없음"} />
        <Stat label="수입 상대국 수" value={countryCount ? `${countryCount}개국` : "산출 불가"} sub="실적이 잡힌 국가 기준" />
      </div>

      <Section
        title="수입 국가 구성"
        hint={item.status === "collected_partial" ? "nitemtrade 12개월(2025.09~2026.08) 실측 — 상위 5개국" : undefined}
        className="mb-6"
      >
        <CountryTable item={item} />
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="대체 공급국 후보"
          hint={
            pilotDetailAvailable
              ? "관세청 실측 또는 UN Comtrade 기반 사전 산출 — 아래 품목 상세에서 KOTRA 법인 정보까지 확인"
              : item.status === "collected_partial"
              ? "1위국을 제외한 nitemtrade 상위 4개국 — 국가 단위 실측, 기업 매칭 아님"
              : "무료 참고용 후보 산출 전 — 유료 버전에서 국가별 원자료 확장 예정"
          }
        >
          {pilotDetailAvailable ? (
            <div className="space-y-3">
              {comtradeItem?.alternatives.slice(0, 5).map((a) => (
                <div key={a.country} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="font-mono text-xs text-slate-600">{a.rank}</span>
                  <span className="flex-1 text-sm text-slate-200">{a.country}</span>
                  <span className="rounded-md border border-pivot-500/25 bg-pivot-600/10 px-2 py-1 text-[11px] text-pivot-500">
                    KOTRA 법인 {a.kotra_offices === null ? "산출 불가" : `${a.kotra_offices}사`}
                  </span>
                </div>
              ))}
              {customsItem?.alternatives.slice(0, 5).map((a, i) => (
                <div key={a.country} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="font-mono text-xs text-slate-600">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-200">{a.country}</span>
                  <span className="font-mono text-xs text-slate-400">{fmtPct(a.share)}</span>
                </div>
              ))}
              <Link href={`/items/${item.hs4}/`} className="inline-block text-xs text-pivot-500 hover:underline">
                이 품목의 뉴스·시계열 상세 보기 →
              </Link>
            </div>
          ) : nitemtradeAlts.length > 0 ? (
            <ul className="space-y-2">
              {nitemtradeAlts.map((c, i) => (
                <li key={c.country} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                  <span className="font-mono text-xs text-slate-600">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-200">{c.country}</span>
                  <span className="font-mono text-xs text-slate-400">{c.share_pct}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable reason="이 품목은 국가별 실측 데이터가 없어 대체 공급국 후보를 계산할 수 없다." />
          )}
        </Section>

        <Section title="지원정책 추천" hint="유료 버전에서 자격요건·품목 매칭 필터 제공 예정 — 아래는 공급망 전환에 쓸 수 있는 일반 지원제도 목록">
          <ul className="space-y-2.5">
            {SUPPORT_POLICIES.map((p) => (
              <li key={p.title} className="rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{p.title}</p>
                    <p className="text-[11px] text-slate-500">{p.org}</p>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer noopener" className="shrink-0 text-[11px] text-pivot-500 hover:underline">
                    바로가기 →
                  </a>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="관련 뉴스" className="mb-6">
        {pilotDetailAvailable ? (
          <p className="text-sm text-slate-300">
            이 품목은 우선 매칭 20개 품목 중 하나라 KOTRA 뉴스·Google News 매칭이 이미 돼 있다.{" "}
            <Link href={`/items/${item.hs4}/`} className="text-pivot-500 hover:underline">
              품목 상세에서 관련 뉴스 보기 →
            </Link>
          </p>
        ) : (
          <Unavailable reason="자동 뉴스-품목 매칭은 아직 신뢰할 수 있는 정확도로 만들어지지 않았다 — classify() 소재사전에 동음이의어 노이즈(예: '주석'이 금속과 '설명'을 함께 뜻함)가 있어, 오탐을 걸러낼 때까지는 이 품목에 뉴스를 자동으로 붙이지 않는다." />
        )}
      </Section>

      <Section title="연결 가능한 지원 네트워크">
        <KotraMap highlight={nitemtradeAlts.map((c) => c.country)} />
      </Section>

      <SourceTag>
        hs6_universe_named.csv · {item.status === "collected_partial" ? "공공데이터포털 nitemtrade(2026-09-26)" : "step4_blind_spots.csv(TRASS)"} ·
        kotra_map.json
      </SourceTag>
    </>
  );
}
