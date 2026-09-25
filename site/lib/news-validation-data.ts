// 뉴스 소급 검증(naver+google) 전용 데이터 모듈. 수작업으로 정리한 스냅샷이라
// build 스크립트 없이 news_validation.json을 그대로 읽는다. workflow-data.ts와는 독립.
import newsJson from "@data/news_validation.json";

export type RoundRow = { round: string; dataset: string; recall: number; note: string };
export type EventRow = {
  event: string;
  naver: boolean;
  google: boolean;
  combined: boolean;
  note: string;
};
export type MissRow = { cause: string; count: number; examples: string };

export const newsValidation = newsJson as unknown as {
  as_of: string;
  combine_rule: string;
  rounds: RoundRow[];
  round12_events: EventRow[];
  precision: { naver: string; google: string };
  misses: MissRow[];
  lessons: string[];
};
