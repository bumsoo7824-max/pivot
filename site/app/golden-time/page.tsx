import GoldenTimeChart, { ReleaseCalendar } from "@/components/charts/GoldenTimeChart";
import PriceSeriesChart from "@/components/charts/PriceSeriesChart";
import { NextStep, PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { fmtYm, importPrice } from "@/lib/data";

export default function GoldenTimePage() {
  const { ecos_days, customs_days, golden_time_days } = importPrice.release_lag;
  const total = importPrice.total_index;
  const latest = total[total.length - 1];
  const first = total[0];
  const change =
    latest.value !== null && first.value !== null
      ? ((latest.value - first.value) / first.value) * 100
      : null;

  return (
    <>
      <PageHeader
        step="1 / 8 · 골든타임"
        title="확정 통계를 기다리면 이미 늦다"
        lead={`같은 달의 수입 상황을 한국은행 수입물가지수로는 익월 +${ecos_days}일에, 관세청 수출입통계로는 익월 +${customs_days}일에 확인할 수 있다. 그 사이 ${golden_time_days}일이 먼저 움직일 수 있는 시간이다.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="선행지표 확보 기간"
          value={`${importPrice.month_count}개월`}
          sub={`${fmtYm(importPrice.range[0])} ~ ${fmtYm(importPrice.range[1])} 실측`}
          tone="amber"
        />
        <Stat
          label="골든타임"
          value={`${golden_time_days}일`}
          sub="익월 초 공표와 익월 중순 확인의 차이"
          tone="pivot"
        />
        <Stat
          label={`총지수 변화 (${fmtYm(importPrice.range[0])} → ${fmtYm(importPrice.range[1])})`}
          value={change === null ? "산출 불가" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          sub={`${importPrice.basis} · 2020=100`}
        />
      </div>

      <Section
        title="공표 일정 — 관측월이 끝난 뒤 30일"
        hint={importPrice.release_lag.note}
        className="mb-6"
      >
        <ReleaseCalendar />
      </Section>

      <Section
        title="두 통계는 같은 방향을 가리킨다"
        hint={`먼저 오는 지표가 쓸모 있으려면 나중에 오는 확정 통계와 같은 움직임을 보여야 한다. 두 계열을 ${importPrice.index_base}으로 맞춰 겹쳤다.`}
        className="mb-6"
      >
        <GoldenTimeChart />
        <SourceTag>
          {importPrice.stat_name} ({importPrice.basis}, {importPrice.month_count}개월 실측) ·{" "}
          {importPrice.customs_index_note}
        </SourceTag>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section
          title={`수입물가지수 총지수 (${importPrice.basis})`}
          hint={`${importPrice.cadence} 지수. 2020년을 100으로 한다.`}
        >
          <PriceSeriesChart series={importPrice.total_index} label="총지수" />
        </Section>
        <Section title="이 지표를 어떻게 읽는가">
          <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
            <li>
              <b className="text-white">월 단위 지수다.</b> 일일 가격이 아니다. KOMIS 일일가격은
              공공 API가 없어 한국은행 수입물가지수로 대체했고, 이 지수는 관세청 통계 공표보다
              앞서 나온다.
            </li>
            <li>
              <b className="text-white">예측이 아니다.</b> 확정 공표된 지수의 전월대비 변동을 읽어
              어느 품목군을 먼저 들여다볼지 <span className="text-pivot-500">우선순위를 산출</span>
              할 뿐이다.
            </li>
            <li>
              <b className="text-white">단독으로 경보를 내지 않는다.</b> 물가 이상은 1단계일 뿐이고,
              HHI 구조 확인과 정책 동향까지 세 층이 겹칠 때만 경보로 올린다.
            </li>
          </ul>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold text-slate-300">공표 시차 근거</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              수입물가지수는 관측월 종료 후 익월 초(+{ecos_days}일), 관세청 수출입통계는 익월
              중순(+{customs_days}일)에 확인되는 것으로 두고 계산했다. 위 공표 일정 그림의 눈금은 이
              값을 실제 비율로 그린 것이다.
            </p>
          </div>
        </Section>
      </div>

      <NextStep href="/blindspots/" label="2. 사각지대 스크리닝 — 그래서 어느 품목인가" />
    </>
  );
}
