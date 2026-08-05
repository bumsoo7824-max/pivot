// 빌드 시점에 인라인되는 사전 계산 데이터. 런타임 fetch·API 호출은 없다.
import blindspotsJson from "@data/blindspots.json";
import comtradeJson from "@data/comtrade_alts.json";
import customsAltJson from "@data/customs_alternatives.json";
import importPriceJson from "@data/import_price.json";
import kotraMapJson from "@data/kotra_map.json";
import metaJson from "@data/meta.json";
import mvp10Json from "@data/mvp10.json";
import newsJson from "@data/news.json";
import notesJson from "@data/notes.json";

export type Grade = "RED" | "YELLOW" | "GREEN";

export type BlindspotPoint = {
  hs4: string;
  name: string;
  detail: string;
  sector: string | null;
  sector_major: string | null;
  ksic_mid: string | null;
  hhi: number;
  top_country: string;
  top_country_code: string;
  top_share: number;
  import_usd: number;
  country_count: number;
  is_blindspot: boolean;
  gov_managed: boolean;
  /** step4_blind_spots.csv 의 위험등급. 사각지대가 아닌 품목에는 등급이 없다. */
  grade: Grade | null;
};

export type Signal = { triggered: boolean; value: number | null; label: string };

export type MvpItem = {
  hs4: string;
  name: string;
  hs4_name: string;
  detail: string;
  sector: string | null;
  hhi: number;
  top_country: string;
  top_country_code: string;
  top_share: number;
  import_usd: number;
  country_count: number;
  grade: Grade;
  ecos_item_name: string;
  latest_mom: number | null;
  news_matched: number;
  signals: { price: Signal; structure: Signal; news: Signal };
  alert: boolean;
};

export type NewsRow = {
  id: string;
  title: string;
  url: string;
  country: string;
  region: string;
  date: string;
  industry: string;
  hs_name: string;
  commodity: string;
  office: string;
  category: string;
};

export type ItemMatch = {
  hs4: string;
  top_country: string;
  matched: { news_id: string; keywords: string[]; country_match: boolean; score: number }[];
  matched_count: number;
  china_matched_count: number;
};

export type CustomsItem = {
  hs4: string;
  name: string;
  hhi: number;
  top_country: string;
  top_share: number;
  country_count: number;
  import_usd: number;
  months: number;
  series: { ym: string; unit_price: number }[];
  alternatives: {
    country: string;
    import_usd: number;
    share: number;
    kotra_offices: number | null;
  }[];
  latest_grade: Grade | null;
};

export const blindspots = blindspotsJson as unknown as {
  source: string;
  /** 산점도 참조선. 사각지대 판정 기준이 아니다. */
  reference_lines: { hhi: number; top_share: number; note: string };
  universe_count: number;
  blindspot_count: number;
  china_count: number;
  china_share: number;
  grade_counts: Record<string, number>;
  sector_axis: string;
  sector_counts: Record<string, number>;
  top_country_counts: Record<string, number>;
  points: BlindspotPoint[];
};

export const mvp10 = mvp10Json as unknown as {
  selection_rule: string;
  selection_note: string;
  alert_order: string[];
  items: MvpItem[];
};

export const importPrice = importPriceJson as unknown as {
  basis: string;
  stat_name: string;
  cadence: string;
  note: string;
  months: string[];
  month_count: number;
  range: [string, string];
  total_index: { ym: string; value: number | null; mom: number | null }[];
  customs_unit_index: { ym: string; value: number | null }[];
  customs_index_note: string;
  lead_lag: {
    ym: string;
    ecos_value: number | null;
    ecos_raw: number | null;
    customs_value: number | null;
  }[];
  index_base: string;
  release_lag: {
    ecos_days: number;
    customs_days: number;
    golden_time_days: number;
    note: string;
  };
  items: {
    hs4: string;
    ecos_item_code: string;
    ecos_item_name: string;
    series: { ym: string; value: number | null; mom: number | null }[];
    latest_mom: number | null;
    latest_value: number | null;
  }[];
};

export const news = newsJson as unknown as {
  window_days: number;
  total_collected: number;
  supply_chain_matched: number;
  date_range: [string, string];
  by_country: Record<string, number>;
  news: NewsRow[];
  item_matches: ItemMatch[];
  match_method: string;
};

export const kotraMap = kotraMapJson as unknown as {
  total_companies: number;
  country_count: number;
  mapped_country_count: number;
  by_region: Record<string, number>;
  by_type: Record<string, number>;
  countries: {
    name: string;
    iso2: string;
    lat: number;
    lon: number;
    count: number;
    region: string;
  }[];
  note: string;
};

export const customsAlternatives = customsAltJson as unknown as {
  source: string;
  period: [string, string];
  month_count: number;
  method: string;
  items: CustomsItem[];
};

export const comtrade = comtradeJson as unknown as {
  status: "ok" | "unavailable";
  reason: string | null;
  fetched_at: string | null;
  items: { hs4: string; status: string; alternatives: { country: string; export_usd: number }[] }[];
};

export const notes = notesJson as unknown as {
  generated_at: string;
  items: { key: string; title: string; body: string; impact: string }[];
};

export const meta = metaJson as unknown as {
  generated_at: string;
  layers: { tier: string; source: string; role: string; detail: string }[];
  build_log: string[];
};

// ─────────────────────────────────────────────────────────────── 헬퍼
export const newsById = new Map(news.news.map((n) => [n.id, n]));
export const matchByHs4 = new Map(news.item_matches.map((m) => [m.hs4, m]));
export const priceByHs4 = new Map(importPrice.items.map((p) => [p.hs4, p]));
export const mvpByHs4 = new Map(mvp10.items.map((m) => [m.hs4, m]));
export const customsByHs4 = new Map(customsAlternatives.items.map((c) => [c.hs4, c]));

/** 상세 페이지를 생성할 전체 HS4 목록 (MVP 10 + 관세청 원자료 보유 10). */
export function allDetailHs4(): string[] {
  return [...mvp10.items.map((m) => m.hs4), ...customsAlternatives.items.map((c) => c.hs4)];
}

export function fmtUsd(v: number): string {
  if (v >= 1e9) return `${(v / 1e8).toFixed(0)}억 달러`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억 달러`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}백만 달러`;
  return `${v.toLocaleString("ko-KR")} 달러`;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "산출 불가";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtYm(ym: string): string {
  return `${ym.slice(0, 4)}.${ym.slice(4)}`;
}

export const GRADE_COLOR: Record<Grade, string> = {
  RED: "#f0526d",
  YELLOW: "#f5a524",
  GREEN: "#3ecf8e",
};
