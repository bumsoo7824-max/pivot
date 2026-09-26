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
          2026-09-26 nitemtrade 수집 완료: 원래 사각지대 552개 중 543개는 12개월 수입액·최대
          공급국을 확보했습니다(&quot;HS6실측&quot;). 다만 이건 TRASS의 15개월 다지표 시계열이
          아니라 HHI·통관 스파이크 계산에는 아직 못 씁니다 — 대체공급국 후보 확인용 참고
          데이터입니다. 확보완료(379)·미통합(170) 549개 중 513개는 같은 HS4를 쓰는 기존 리스크
          테이블(TRASS)에서 수입액·1위국을 끌어와 &quot;HS4참고&quot;로 표시합니다 — 형제 HS6가
          함께 쓰는 HS4 집계값이라 HS6별 실측과는 정밀도가 다릅니다. 실데이터가 없는 품목에
          0이나 추정치를 채우지 않고 있는 그대로 표시합니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label={STATUS_META.collected.short}
          value={counts.collected.toLocaleString("ko-KR")}
          sub="TRASS 15개월 수집 완료, 전 단계 연결 · 수입액·1위국 HS4참고"
          tone="pivot"
        />
        <Stat
          label={STATUS_META.collected_unintegrated.short}
          value={counts.collected_unintegrated.toLocaleString("ko-KR")}
          sub="52HS4군 — 리스크 테이블 미반영 · 수입액·1위국 HS4참고"
        />
        <Stat
          label={STATUS_META.collected_partial.short}
          value={counts.collected_partial.toLocaleString("ko-KR")}
          sub="nitemtrade 12개월 수입액·공급국 확보"
        />
        <Stat
          label={STATUS_META.pending.short}
          value={counts.pending.toLocaleString("ko-KR")}
          tone="amber"
          sub="nitemtrade에서도 12개월간 수입 미확인"
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
            <b className="text-white">&quot;수입액 확보&quot;는 &quot;완전한 데이터&quot;가 아니다.</b>{" "}
            543개는 nitemtrade API로 12개월(2025.09~2026.08) 국가별 수입액·최대 공급국을 확보했지만,
            TRASS처럼 월별 시계열은 아니라 HHI·통관 스파이크 계산에는 아직 못 쓴다. 대체공급국
            후보를 빠르게 확인하는 용도로만 쓴다.
          </li>
          <li>
            <b className="text-white">진짜 사각지대는 9개로 줄었다.</b> 552개 중 543개는 실데이터가
            생겼고, 나머지 9개만 12개월간 40개 주요국 전체에서 수입 실적이 안 잡혀 여전히 수집
            예정 상태다 — TRASS 등 다른 경로로 재확인이 필요하다.
          </li>
          <li>
            <b className="text-white">세 단계로 나뉜 &quot;수집 완료&quot;.</b> 기존 379개는 대체공급국
            매칭까지 전 단계가 연결돼 있고, 52HS4군 170개는 TRASS 수집만 끝나고 최종 리스크
            테이블 통합은 아직이며, 543개는 수입액·공급국만 확보된 상태다 — 활용 가능한 범위가
            셋 다 다르다.
          </li>
          <li>
            <b className="text-white">HS4참고 vs HS6실측 — 정밀도가 다르다.</b> 379+170개 중
            513개는 같은 HS4를 쓰는 기존 리스크 테이블(TRASS)에서 수입액·1위국을 그대로 끌어온
            것이라, 한 HS4 안 여러 HS6가 같은 값을 공유한다. 543개(nitemtrade)는 HS6 단위로 직접
            조회한 실측값이라 더 정밀하다.
          </li>
          <li>
            <b className="text-white">8개는 구조적으로 제외.</b> 15개월간 수입 실적이 0인 품목은
            모집단 자체가 없어 계산 대상에서 뺀다.
          </li>
        </ul>
        <SourceTag>
          관세청 HS6 유니버스 감사(2026-09-24) · hs6_universe_named.csv · TRASS(bandtrass.or.kr) ·
          step4_blind_spots.csv(HS4 리스크 테이블) · 공공데이터포털 nitemtrade(2026-09-26 수집,
          계정 3개 분산 22,080콜)
        </SourceTag>
      </Section>
    </>
  );
}
