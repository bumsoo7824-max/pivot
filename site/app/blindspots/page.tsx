import BlindspotScatter from "@/components/charts/BlindspotScatter";
import { NextStep, PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { blindspots } from "@/lib/data";

export default function BlindspotsPage() {
  const sectors = Object.entries(blindspots.sector_counts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        step="2 / 8 · 사각지대 스크리닝"
        title={`사각지대 ${blindspots.blindspot_count}개 품목`}
        lead={`수입 집중도(HHI)가 높거나 1위국 한 곳에 쏠려 관리 사각에 놓인 품목 목록입니다. 화면에 그리는 값은 원본 목록(${blindspots.source})을 그대로 싣고, 배경에는 비교를 위해 HS4 ${blindspots.universe_count}개 모집단을 함께 찍었습니다.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="사각지대"
          value={blindspots.blindspot_count}
          sub="원본 목록 행 수"
          tone="pivot"
        />
        <Stat
          label="1위국 = 중국"
          value={blindspots.china_count}
          sub={`사각지대의 ${(blindspots.china_share * 100).toFixed(1)}%`}
          tone="red"
        />
        <Stat
          label="위험등급 RED"
          value={blindspots.grade_counts.RED ?? 0}
          sub={`YELLOW ${blindspots.grade_counts.YELLOW ?? 0}개`}
          tone="red"
        />
        <Stat
          label="배경 모집단"
          value={blindspots.universe_count}
          sub={`이 중 ${blindspots.blindspot_count}개가 사각지대 목록에 포함`}
        />
      </div>

      <Section
        title={`HHI × 1위국 비중 산점도 — ${blindspots.universe_count}개 원본 점`}
        hint={`강조색이 사각지대 원본 목록 ${blindspots.blindspot_count}개, 회색이 목록 밖 품목이다. 점선 두 개는 ${blindspots.reference_lines.note}이며 판정에 쓰이지 않는다. 핵심전략기술 연계로 추정되는 정부 관리 품목은 회색 십자 표식으로 따로 구분했다.`}
        className="mb-6"
      >
        <BlindspotScatter />
        <SourceTag>
          관세청 수출입통계 HS4 집계 · 업종축은 {blindspots.sector_axis}(커버리지{" "}
          {blindspots.universe_count}/{blindspots.universe_count}). HS–KSIC 브리지는 신뢰도 미달로
          업종 판정에 쓰지 않았다 — 사유는 /data-notes 참조
        </SourceTag>
      </Section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Section title="업종별 사각지대 분포" hint={blindspots.sector_axis}>
          <ul className="space-y-2.5">
            {sectors.map(([name, count]) => {
              const pct = (count / blindspots.blindspot_count) * 100;
              return (
                <li key={name}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-300">{name}</span>
                    <span className="font-mono text-xs text-slate-400">
                      {count}개 · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-pivot-600"
                      style={{ width: `${Math.max(pct, 1.5)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="데이터 출처와 검증">
          <ol className="space-y-3 text-sm leading-relaxed text-slate-300">
            <li>
              <span className="mr-2 font-mono text-xs text-pivot-500">01</span>
              사각지대 {blindspots.blindspot_count}개는{" "}
              <b className="text-white">{blindspots.source}</b> 를 단일 출처로 그대로 싣는다.
              HHI·1위국·위험등급 모두 원본 값이며 화면에서 다시 계산하지 않는다.
            </li>
            <li>
              <span className="mr-2 font-mono text-xs text-pivot-500">02</span>
              배경의 회색 점은 관세청 수출입통계를 HS4로 집계한 모집단{" "}
              {blindspots.universe_count}개 중 사각지대 목록에 들지 않은 품목이다. 목록의 위치를
              전체 분포 안에서 읽기 위한 비교 배경이다.
            </li>
            <li>
              <span className="mr-2 font-mono text-xs text-pivot-500">03</span>
              원본 목록에서 1위국이 중국이고 HHI ≥ 0.50 인 품목의 수입액 상위 10개를 뽑으면 사전에
              확정돼 있던 MVP 10개 목록과 <b className="text-white">정확히 일치</b>한다. 재검증을
              통과했다.
            </li>
          </ol>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-500">
            산점도의 점은 요약값이 아니라 개별 품목 레코드다. 없는 데이터를 그리지 않았고, 업종을
            판정할 수 없는 품목은 회색 처리 대신 관세청 신성질 분류로 채웠다.
          </div>
        </Section>
      </div>

      <NextStep href="/top-country/" label="3. 1위국 분포 — 쏠림은 어디로 향하는가" />
    </>
  );
}
