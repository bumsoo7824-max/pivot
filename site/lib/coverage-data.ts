// 1,109개 HS6 전체 유니버스(전산 품목 커버리지) 전용 데이터 모듈.
// site/lib/data.ts(기존 272/355 사각지대 기준 9개 JSON)는 건드리지 않는다 — 이 파일은
// hs6_universe.json 하나만 읽고, /workflow/coverage 페이지에서만 import된다.
// 출처: hs6_universe_named.csv (2026-09-24 기준 관세청 HS6 유니버스 감사 결과).
import universeJson from "@data/hs6_universe.json";

export type CoverageStatus = "collected" | "collected_unintegrated" | "pending" | "no_trade";

export type CoverageItem = {
  hs6: string;
  hs4: string;
  status: CoverageStatus;
  name: string;
  name_full: string;
  category: string;
};

export const universe = universeJson as unknown as CoverageItem[];

export const STATUS_META: Record<
  CoverageStatus,
  { label: string; short: string; cls: string; dot: string; desc: string }
> = {
  collected: {
    label: "실데이터 확보(기존 379)",
    short: "확보 완료",
    cls: "border-signal-green/40 bg-signal-green/10 text-signal-green",
    dot: "bg-signal-green",
    desc: "TRASS(bandtrass.or.kr) 15개월 수집 완료 — 노출도·통관 스파이크까지 전 단계 연결됨.",
  },
  collected_unintegrated: {
    label: "수집 완료 · 미통합(52HS4군 170)",
    short: "미통합",
    cls: "border-signal-blue/40 bg-signal-blue/10 text-signal-blue",
    dot: "bg-signal-blue",
    desc: "TRASS 수집 자체는 끝났지만 최종 리스크 테이블(대체공급국 매칭)에는 아직 반영되지 않음.",
  },
  pending: {
    label: "수집 예정(사각지대 552)",
    short: "수집 예정",
    cls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
    dot: "bg-signal-amber",
    desc: "TRASS 미수집 구간 — 공공데이터포털 nitemtrade API(계정 3개 분산)로 보완 수집 진행 중. 현재 이 페이지에는 실데이터가 없고 뉴스 조기경보(①~⑥)만 적용됨.",
  },
  no_trade: {
    label: "15개월 거래 0건(8)",
    short: "거래 없음",
    cls: "border-white/15 bg-white/5 text-slate-400",
    dot: "bg-slate-400",
    desc: "관측 기간(15개월) 동안 수입 실적 자체가 없어 구조 지표를 계산할 모집단이 없음.",
  },
};

export function coverageCounts() {
  const counts: Record<CoverageStatus, number> = {
    collected: 0,
    collected_unintegrated: 0,
    pending: 0,
    no_trade: 0,
  };
  for (const it of universe) counts[it.status]++;
  return counts;
}

export const hs4Count = new Set(universe.map((i) => i.hs4)).size;
