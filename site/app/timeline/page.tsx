import { NextStep, PageHeader, Section, SourceTag } from "@/components/ui";
import { blindspots, importPrice, kotraMap, news } from "@/lib/data";

type Row = {
  phase: string;
  before: string;
  after: string;
  basis: string;
};

const ROWS: Row[] = [
  {
    phase: "① 이상 감지",
    before: "관세청 확정 통계 공표를 기다린다. 관측월 종료 후 익월 중순.",
    after: "한국은행 수입물가지수를 익월 초에 먼저 읽는다.",
    basis: `수입물가지수 ${importPrice.month_count}개월 실측 (${importPrice.range[0]}~${importPrice.range[1]})`,
  },
  {
    phase: "② 대상 좁히기",
    before: "품목이 수천 개다. 어디부터 볼지 정하는 기준이 없다.",
    after: `수입 집중도와 1위국 쏠림으로 추린 사각지대 ${blindspots.blindspot_count}개 품목을 대상으로 좁힌다.`,
    basis: `${blindspots.source} · RED ${blindspots.grade_counts.RED ?? 0} / YELLOW ${blindspots.grade_counts.YELLOW ?? 0}`,
  },
  {
    phase: "③ 원인 확인",
    before: "가격이 왜 움직였는지 별도로 수소문한다.",
    after: `KOTRA 해외시장뉴스 ${news.window_days}일치에서 정책·규제 동향을 품목 키워드로 붙인다.`,
    basis: `수집 ${news.total_collected}건 중 공급망 매칭 ${news.supply_chain_matched}건`,
  },
  {
    phase: "④ 경보 판단",
    before: "단일 지표 하나가 튀면 그때그때 판단한다.",
    after: "물가·구조·정책 세 계층 임계값을 모두 넘을 때만 경보로 올린다.",
    basis: "3계층 동시 충족 규칙 — 예측이 아니라 확정 통계 기반 산출",
  },
  {
    phase: "⑤ 대안 탐색",
    before: "대체 공급처를 개별 기업이 각자 수소문한다.",
    after: "1위국을 제외한 수입 상위국을 실측으로 뽑아 대체 공급 후보 국가를 제시한다.",
    basis: "관세청 국가별 원자료 · UN Comtrade(키 주입 시 빌드 단계 1회 수집)",
  },
  {
    phase: "⑥ 실행 연결",
    before: "후보 국가를 찾아도 현지에서 누구를 만나야 할지 모른다.",
    after: `해당 국가의 KOTRA 해외법인 수를 붙여 지원기관 접점까지 이어준다.`,
    basis: `해외법인 ${kotraMap.total_companies.toLocaleString("ko-KR")}사 / ${kotraMap.country_count}개국`,
  },
];

export default function TimelinePage() {
  return (
    <>
      <PageHeader
        step="6 / 8 · Before / After"
        title="무엇이 어떻게 달라지는가"
        lead="각 단계마다 근거 데이터를 함께 적었습니다. 근거가 없는 개선은 표에 넣지 않았습니다."
      />

      <Section className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                <th className="w-32 pb-3 pr-4 font-medium">단계</th>
                <th className="pb-3 pr-4 font-medium">Before</th>
                <th className="pb-3 pr-4 font-medium text-pivot-500">After — Supply-Pivot</th>
                <th className="w-64 pb-3 font-medium">근거 데이터</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ROWS.map((r) => (
                <tr key={r.phase} className="align-top">
                  <td className="py-4 pr-4 text-sm font-semibold text-white">{r.phase}</td>
                  <td className="py-4 pr-4 text-sm leading-relaxed text-slate-500">{r.before}</td>
                  <td className="py-4 pr-4 text-sm leading-relaxed text-slate-200">{r.after}</td>
                  <td className="py-4 text-xs leading-relaxed text-slate-500">{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceTag>
          관세청 수출입통계 · 한국은행 ECOS 수입물가지수 · KOTRA 해외시장뉴스 · KOTRA 해외진출기업
        </SourceTag>
      </Section>

      <Section title="이 표에 넣지 않은 것">
        <ul className="space-y-2 text-sm leading-relaxed text-slate-400">
          <li>
            · <b className="text-slate-200">일일 가격 모니터링</b> — 실제 지표는 월 단위
            수입물가지수다. 공공 API가 없는 일일가격을 있는 것처럼 쓰지 않았다.
          </li>
          <li>
            · <b className="text-slate-200">대체 공급 기업 매칭</b> — 국가 단위 발굴과 지원기관
            연결까지가 현재 범위다.
          </li>
          <li>
            · <b className="text-slate-200">가격 예측</b> — 예측 모델은 없다. 확정 통계에 대한
            진단·산출·경보다.
          </li>
          <li>
            · <b className="text-slate-200">자금 신청 자동화</b> — 협의 단계다. 로드맵에 상태
            그대로 적었다.
          </li>
        </ul>
      </Section>

      <NextStep href="/roadmap/" label="7. 로드맵 — 지금 되는 것과 협의 중인 것" />
    </>
  );
}
