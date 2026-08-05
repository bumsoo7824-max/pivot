import { PageHeader, Section } from "@/components/ui";
import { blindspots, comtrade, importPrice, kotraMap, mvp10, news } from "@/lib/data";

type Status = "done" | "partial" | "discussing";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  done: { label: "구현 완료", cls: "border-signal-green/40 bg-signal-green/10 text-signal-green" },
  partial: { label: "부분 구현", cls: "border-signal-amber/40 bg-signal-amber/10 text-signal-amber" },
  discussing: { label: "연계 방식 협의 중", cls: "border-white/15 bg-white/5 text-slate-400" },
};

const ITEMS: { phase: string; title: string; status: Status; body: string }[] = [
  {
    phase: "현재",
    title: "구조적 취약성 진단",
    status: "done",
    body: `관세청 수출입통계를 HS4로 집계해 HHI·1위국 의존도를 산출하고, 임계선 두 개로 사각지대 ${blindspots.blindspot_count}개를 걸러낸다. 재현 가능한 규칙이며 MVP 10개 목록과 대조 검증을 통과했다.`,
  },
  {
    phase: "현재",
    title: "선행지표 연동",
    status: "done",
    body: `한국은행 ECOS 수입물가지수 ${importPrice.month_count}개월을 수집해 MVP 10개 품목의 세부 계열에 매핑했다. 월 단위 지수이며, 관세청 통계 공표보다 앞선다.`,
  },
  {
    phase: "현재",
    title: "정책 동향 매칭",
    status: "done",
    body: `KOTRA 해외시장뉴스 ${news.window_days}일치 ${news.total_collected}건에서 공급망 관련 ${news.supply_chain_matched}건을 골라 품목 키워드로 연결했다. 규칙 기반 문자열 매칭이며 학습 모델이 아니다.`,
  },
  {
    phase: "현재",
    title: "3계층 경보 산출",
    status: "done",
    body: `물가·구조·정책 세 층의 임계값을 모두 넘는 품목만 경보로 올린다. MVP ${mvp10.items.length}개 중 ${mvp10.items.filter((i) => i.alert).length}개가 현재 경보 상태다.`,
  },
  {
    phase: "다음",
    title: "대체 공급국 발굴 범위 확대",
    status: "partial",
    body:
      comtrade.status === "ok"
        ? "UN Comtrade 수집분과 관세청 실측을 병행한다."
        : `관세청 국가별 원자료가 확보된 품목에서는 실측으로 대체 공급국 상위 5개국을 산출한다. UN Comtrade 경로는 현재 ${comtrade.reason ?? "미수집"} 상태이며, 키가 주입되면 빌드 단계에서 1회 수집해 나머지 품목까지 채운다.`,
  },
  {
    phase: "다음",
    title: "지원기관 연결",
    status: "partial",
    body: `대체 공급 후보국의 KOTRA 해외법인 수(${kotraMap.total_companies.toLocaleString("ko-KR")}사 / ${kotraMap.country_count}개국)를 붙여 접점을 제시한다. 국가 단위 연결까지이며 기업 대 기업 매칭은 범위 밖이다.`,
  },
  {
    phase: "협의",
    title: "중진공 자금 매칭",
    status: "discussing",
    body:
      "중소벤처기업진흥공단 정책자금과의 연계 방식을 협의 중이다. 현재 자동 심사·자동 신청서 생성 기능은 없으며, 이 데모에도 구현돼 있지 않다.",
  },
  {
    phase: "협의",
    title: "품목 커버리지 확대",
    status: "discussing",
    body: `현재 국가별 원자료는 비철금속 HS4 10개 범위이고 나머지 품목은 집계 지표만 확보돼 있다. 원자료 범위를 넓히면 MVP 10개에도 실측 단가 시계열과 대체 공급국을 채울 수 있다.`,
  },
];

export default function RoadmapPage() {
  const phases = ["현재", "다음", "협의"] as const;

  return (
    <>
      <PageHeader
        step="7 / 8 · 로드맵"
        title="지금 되는 것과 아직 아닌 것"
        lead="되는 것처럼 보이게 쓰지 않았습니다. 협의 단계는 협의 단계로 적었습니다."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {phases.map((phase) => (
          <div key={phase}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className={`h-2 w-2 rounded-full ${
                  phase === "현재"
                    ? "bg-signal-green"
                    : phase === "다음"
                      ? "bg-signal-amber"
                      : "bg-slate-500"
                }`}
              />
              {phase}
            </h2>
            <div className="space-y-3">
              {ITEMS.filter((i) => i.phase === phase).map((i) => (
                <article key={i.title} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold leading-snug text-white">{i.title}</h3>
                    <span className={`chip shrink-0 ${STATUS_META[i.status].cls}`}>
                      {STATUS_META[i.status].label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{i.body}</p>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Section title="표기 원칙" className="mt-6">
        <ul className="space-y-2 text-sm leading-relaxed text-slate-400">
          <li>· 지표는 <b className="text-slate-200">월 단위 수입물가지수</b>다. 일일 가격이 아니다.</li>
          <li>· 대체 공급은 <b className="text-slate-200">국가 단위 발굴 + 지원기관 연결</b>까지다.</li>
          <li>· <b className="text-slate-200">예측하지 않는다.</b> 확정 통계에 대한 진단·산출·경보다.</li>
          <li>· 데이터가 없는 항목은 <b className="text-slate-200">산출 불가</b>로 적고 0을 넣지 않는다.</li>
        </ul>
      </Section>
    </>
  );
}
