import Link from "next/link";
import LayerDiagram, { AlertFlow } from "@/components/LayerDiagram";
import { NextStep, Section, SourceTag, Stat } from "@/components/ui";
import { blindspots, importPrice, kotraMap, mvp10, news } from "@/lib/data";

export default function IntroPage() {
  return (
    <>
      <section className="mb-12">
        <p className="kicker">Supply-Pivot</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
          구조적 취약성은 <span className="text-slate-400">관세청 통계</span>로 깔고,
          <br className="hidden sm:block" /> 방아쇠는{" "}
          <span className="text-signal-amber">수입물가지수</span>와{" "}
          <span className="text-signal-blue">정책 동향</span>으로 당긴다.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-400">
          확정 통계는 정확하지만 늦게 옵니다. 빠른 지표는 이르지만 구조를 모릅니다. Supply-Pivot은
          둘을 층으로 쌓아, 관세청 통계가 공표되기 전에 <b className="text-slate-200">어느 품목이
          위험한지</b> 좁히고 <b className="text-slate-200">어디로 돌릴 수 있는지</b>까지 이어붙입니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/golden-time/"
            className="rounded-lg bg-pivot-600 px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-pivot-500"
          >
            골든타임부터 보기 →
          </Link>
          <Link
            href="/mvp10/"
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
          >
            MVP 10개 품목
          </Link>
        </div>
      </section>

      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="사각지대 품목"
          value={blindspots.blindspot_count}
          sub={`RED ${blindspots.grade_counts.RED ?? 0} · YELLOW ${blindspots.grade_counts.YELLOW ?? 0}`}
          tone="pivot"
        />
        <Stat
          label="1위국이 중국인 품목"
          value={`${blindspots.china_count}개`}
          sub={`사각지대의 ${(blindspots.china_share * 100).toFixed(1)}%`}
          tone="red"
        />
        <Stat
          label="선행지표 확보 기간"
          value={`${importPrice.month_count}개월`}
          sub={`${importPrice.range[0]}~${importPrice.range[1]} 월 단위 수입물가지수`}
          tone="amber"
        />
        <Stat
          label="연결 가능한 해외법인"
          value={kotraMap.total_companies.toLocaleString("ko-KR")}
          sub={`${kotraMap.country_count}개국 · 국가 단위 발굴 결과와 연결`}
        />
      </div>

      <Section
        title="데이터 계층 구조"
        hint="아래에서 위로 쌓입니다. 베이스가 구조를 정의하고, 선행 두 층이 시점을 앞당기고, 실행층이 대안을 제시합니다."
        className="mb-6"
      >
        <LayerDiagram />
      </Section>

      <Section
        title="경보 발령 순서"
        hint="한 층만으로는 경보를 내지 않습니다. 세 계층 임계값을 모두 넘을 때만 발령합니다."
        className="mb-6"
      >
        <AlertFlow steps={mvp10.alert_order} />
        <SourceTag>
          한국은행 ECOS 수입물가지수(월 단위, 익월 초 공표) · 관세청 수출입통계(익월 중순) · KOTRA
          해외시장뉴스(90일 {news.total_collected}건 중 공급망 매칭 {news.supply_chain_matched}건)
        </SourceTag>
      </Section>

      <Section title="이 데모가 하는 일과 하지 않는 일">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-pivot-500">
              한다
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
              <li>· 확정 통계로 품목별 수입 집중도(HHI)와 1위국 의존도를 <b>진단</b>한다</li>
              <li>· 월 단위 수입물가지수 변동과 정책 동향을 겹쳐 <b>경보를 산출</b>한다</li>
              <li>· 대체 공급 <b>국가</b>를 찾고 그 나라의 지원기관·법인 네트워크로 연결한다</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              하지 않는다
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-400">
              <li>· 가격을 <b>예측</b>하지 않는다 — 확정 통계에 대한 진단·산출·경보다</li>
              <li>· 일일 가격을 다루지 않는다 — 지표는 <b>월 단위</b> 수입물가지수다</li>
              <li>· 대체 <b>기업</b>을 매칭하지 않는다 — 국가 단위 발굴과 기관 연결까지다</li>
              <li>· 데이터가 없는 칸에 0을 넣지 않는다 — <b>산출 불가</b>로 표기한다</li>
            </ul>
          </div>
        </div>
      </Section>

      <NextStep href="/golden-time/" label="1. 골든타임 — 선행지표가 벌어주는 시간" />
    </>
  );
}
