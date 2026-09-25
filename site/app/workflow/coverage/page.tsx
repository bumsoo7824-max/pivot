import CoverageSearch from "@/components/CoverageSearch";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { STATUS_META, coverageCounts, hs4Count, universe } from "@/lib/coverage-data";

export default function CoveragePage() {
  const counts = coverageCounts();

  return (
    <>
      <PageHeader
        step="워크플로우 · 품목 커버리지"
        title="HS6 1,109개 품목 커버리지 검색"
        lead={`관세청 HS6 전체 유니버스(HS4 ${hs4Count}개 · HS6 ${universe.length}개)를 검색하고, 품목별로 '대체공급처 단계까지 데이터가 실제로 연결돼 있는지'를 바로 확인합니다.`}
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          이 페이지는 기존 사각지대 272개(/items 등)와는 별도 검증 세트입니다 — 여기서 &quot;수집
          예정&quot;으로 표시된 552개는 아직 TRASS급 원자료가 없고, 뉴스 조기경보(①~⑥)만 적용된
          상태입니다. 실데이터가 없는 품목에 0이나 추정치를 채우지 않고 있는 그대로 표시합니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={STATUS_META.collected.short}
          value={counts.collected.toLocaleString("ko-KR")}
          sub="TRASS 15개월 수집 완료, 전 단계 연결"
          tone="pivot"
        />
        <Stat
          label={STATUS_META.collected_unintegrated.short}
          value={counts.collected_unintegrated.toLocaleString("ko-KR")}
          sub="52HS4군 — 수집됐지만 리스크 테이블 미반영"
        />
        <Stat
          label={STATUS_META.pending.short}
          value={counts.pending.toLocaleString("ko-KR")}
          sub="nitemtrade API로 보완 수집 중"
          tone="amber"
        />
        <Stat
          label={STATUS_META.no_trade.short}
          value={counts.no_trade.toLocaleString("ko-KR")}
          sub="15개월간 거래 실적 자체 없음"
        />
      </div>

      <Section
        title="품목 검색"
        hint="HS4/HS6 코드나 품목명으로 검색하고, 상태 칩으로 좁혀보세요. 표는 스크롤 가능하며 80건씩 불러옵니다."
        className="mb-6"
      >
        <CoverageSearch items={universe} />
      </Section>

      <Section title="이 데이터를 어떻게 읽는가">
        <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
          <li>
            <b className="text-white">&quot;수집 예정&quot;은 &quot;위험 없음&quot;이 아니다.</b> 552개
            사각지대는 원자료가 아직 없어 HHI·대체공급국을 계산하지 못하는 것이지, 리스크가 낮다는
            뜻이 아니다. 뉴스 조기경보(①~⑥)는 1,109개 전체에 이미 적용되고 있다.
          </li>
          <li>
            <b className="text-white">두 단계로 나뉜 &quot;수집 완료&quot;.</b> 기존 379개는 대체공급국
            매칭까지 전 단계가 연결돼 있고, 52HS4군 170개는 TRASS 수집만 끝나고 최종 리스크
            테이블 통합은 아직이다 — 같은 &quot;수집 완료&quot;라도 활용 가능한 범위가 다르다.
          </li>
          <li>
            <b className="text-white">8개는 구조적으로 제외.</b> 15개월간 수입 실적이 0인 품목은
            모집단 자체가 없어 계산 대상에서 뺀다.
          </li>
        </ul>
        <SourceTag>
          관세청 HS6 유니버스 감사(2026-09-24) · hs6_universe_named.csv · TRASS(bandtrass.or.kr) ·
          공공데이터포털 nitemtrade
        </SourceTag>
      </Section>
    </>
  );
}
