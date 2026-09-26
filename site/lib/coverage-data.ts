// 1,109개 HS6 전체 유니버스(전산 품목 커버리지) 전용 데이터 모듈.
// site/lib/data.ts(기존 272/355 사각지대 기준 9개 JSON)는 건드리지 않는다 — 이 파일은
// hs6_universe.json 하나만 읽고, /workflow/coverage 페이지에서만 import된다.
// 출처: hs6_universe_named.csv (2026-09-24 기준 관세청 HS6 유니버스 감사 결과) +
// collect_gap552.py 실행 결과(2026-09-26, nitemtrade API, 12개월 수입액 집계, 543/552건 확보) +
// blindspots.json(step4_blind_spots.csv, TRASS 기반 HS4 단위 리스크 테이블)에서 hs4 매칭으로
// 끌어온 collected/collected_unintegrated 참고치(2026-09-26 병합).
import universeJson from "@data/hs6_universe.json";

export type CoverageStatus =
  | "collected"
  | "collected_unintegrated"
  | "collected_partial"
  | "pending"
  | "no_trade";

export type CoverageItem = {
  hs6: string;
  hs4: string;
  status: CoverageStatus;
  name: string;
  name_full: string;
  category: string;
  // nitemtrade 12개월(2025.09~2026.08) HS6 단위 실측 — collected_partial(543개)에만 있음.
  import_usd_12m?: number;
  top_country?: string;
  top_country_share_pct?: number;
  n_country?: number;
  // TRASS 기반 리스크 테이블(step4_blind_spots.csv, HS4 단위 집계) 참고치 —
  // collected(379개)·collected_unintegrated(170개)에서 매핑되는 HS4가 있을 때만 붙는다.
  // HS6별 실측이 아니라 "같은 HS4 안 형제 HS6가 함께 쓰는 HS4 집계값"이므로
  // UI에서 반드시 nitemtrade HS6 실측과 구분해서 보여준다.
  import_usd_hs4_ref?: number;
  top_country_hs4_ref?: string;
  top_share_hs4_ref?: number;
  hhi_hs4_ref?: number;
  country_count_hs4_ref?: number;
  // nitemtrade 원자료(gap552_import_by_country.csv) 재집계 — collected_partial(543개)의
  // 국가별 수입액 상위 5개국 실측 목록 (2026-09-27 추가, /workflow/coverage/[hs6] 상세 페이지 전용).
  top5_countries?: { country: string; usd: number; share_pct: number }[];
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
    desc: "TRASS(bandtrass.or.kr) 15개월 수집 완료 — 노출도·통관 스파이크까지 전 단계 연결됨. 표의 수입액·1위국은 같은 HS4의 리스크 테이블 집계치(HS4 참고).",
  },
  collected_unintegrated: {
    label: "수집 완료 · 미통합(52HS4군 170)",
    short: "미통합",
    cls: "border-signal-blue/40 bg-signal-blue/10 text-signal-blue",
    dot: "bg-signal-blue",
    desc: "TRASS 수집 자체는 끝났지만 최종 리스크 테이블(대체공급국 매칭)에는 아직 반영되지 않음. 표의 수입액·1위국은 같은 HS4의 리스크 테이블 집계치(HS4 참고).",
  },
  collected_partial: {
    label: "수입액·국가 확보(nitemtrade, 543)",
    short: "수입액 확보",
    cls: "border-pivot-500/40 bg-pivot-500/10 text-pivot-500",
    dot: "bg-pivot-500",
    desc: "공공데이터포털 nitemtrade API로 2026-09-26 수집 — 12개월(2025.09~2026.08) 국가별 수입액·최대 공급국을 확보했다. TRASS의 15개월 다지표 시계열은 아니라 HHI·통관 스파이크 계산에는 아직 못 쓰지만, 대체공급국 후보 확인에는 바로 쓸 수 있다.",
  },
  pending: {
    label: "수집 예정",
    short: "수집 예정",
    cls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber",
    dot: "bg-signal-amber",
    desc: "nitemtrade 조회 결과 12개월(2025.09~2026.08) 동안에도 40개 주요국 전체에서 수입 실적이 잡히지 않은 품목 — TRASS 등 다른 경로로 재확인이 필요하다. 현재 이 페이지에는 실데이터가 없고 뉴스 조기경보(①~⑥)만 적용됨.",
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
    collected_partial: 0,
    pending: 0,
    no_trade: 0,
  };
  for (const it of universe) counts[it.status]++;
  return counts;
}

export const hs4Count = new Set(universe.map((i) => i.hs4)).size;
