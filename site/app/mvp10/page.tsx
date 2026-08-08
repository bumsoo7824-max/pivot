import Link from "next/link";
import { AlertFlow } from "@/components/LayerDiagram";
import { GradeBadge, PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { blindspots, fmtPct, fmtUsd, mvp10, type Signal } from "@/lib/data";

function SignalDot({ signal }: { signal: Signal }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          signal.triggered ? "bg-signal-red" : "bg-slate-600"
        }`}
      />
      <span className={`text-xs ${signal.triggered ? "text-slate-300" : "text-slate-500"}`}>
        {signal.label}
      </span>
      <span
        className={`ml-auto font-mono text-xs ${
          signal.triggered ? "text-slate-200" : "text-slate-600"
        }`}
      >
        {signal.value === null ? "산출 불가" : signal.value.toFixed(2)}
      </span>
    </div>
  );
}

export default function Mvp10Page() {
  const alerts = mvp10.items.filter((i) => i.alert).length;

  return (
    <>
      <PageHeader
        step="경보 현황"
        title="추적 중인 10개 품목"
        lead="사각지대 전체가 아니라, 파급이 큰 순서로 고른 10개 품목의 경보 상태를 상시 추적한다."
      />

      {/* 10개가 전부 중국·RED인 이유를 카드보다 먼저 설명한다. */}
      <div className="mb-6 rounded-xl border border-signal-amber/30 bg-signal-amber/[0.07] p-5">
        <p className="text-sm font-semibold text-signal-amber">
          10개가 전부 중국·RED로 나온 이유를 먼저 밝힙니다
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          우연이 아니라 <b className="text-white">선정 기준의 결과</b>입니다. 선정 규칙은{" "}
          <b className="text-white">{mvp10.selection_rule}</b> 입니다. 중국 의존 품목만 후보로
          두었으니 1위국은 전부 중국이고, HHI 0.50 이상만 남겼으니 등급도 전부 RED가 됩니다. 사각지대{" "}
          {blindspots.blindspot_count}개 전체의 1위국 분포는{" "}
          <Link href="/top-country/" className="text-pivot-500 underline underline-offset-2">
            1위국 분포 페이지
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="MVP 품목" value={`${mvp10.items.length}개`} sub={`사각지대 ${blindspots.blindspot_count}개 중 대표`} />
        <Stat
          label="3계층 경보 발령"
          value={`${alerts} / ${mvp10.items.length}`}
          sub="물가·구조·정책 임계값을 모두 넘은 품목"
          tone="red"
        />
        <Stat
          label="합계 수입액"
          value={fmtUsd(mvp10.items.reduce((s, i) => s + i.import_usd, 0))}
          sub="10개 품목 합산"
        />
      </div>

      <Section title="경보 판정 순서" className="mb-6">
        <AlertFlow steps={mvp10.alert_order} />
      </Section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mvp10.items.map((item) => (
          <Link
            key={item.hs4}
            href={`/items/${item.hs4}/`}
            className="group card transition hover:border-pivot-500/40 hover:bg-ink-700/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-slate-500">HS {item.hs4}</p>
                <h3 className="mt-1 text-sm font-semibold leading-snug text-white group-hover:text-pivot-500">
                  {item.name}
                </h3>
              </div>
              <GradeBadge grade={item.grade} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-500">HHI</dt>
                <dd className="font-mono text-sm text-white">{item.hhi.toFixed(4)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">1위국 비중</dt>
                <dd className="font-mono text-sm text-signal-red">{fmtPct(item.top_share)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">1위국</dt>
                <dd className="text-sm text-slate-200">{item.top_country}</dd>
              </div>
              <div>
                <dt className="text-slate-500">수입액</dt>
                <dd className="font-mono text-sm text-slate-200">{fmtUsd(item.import_usd)}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
              <SignalDot signal={item.signals.price} />
              <SignalDot signal={item.signals.structure} />
              <SignalDot signal={item.signals.news} />
            </div>

            <p
              className={`mt-3 rounded-md px-2.5 py-1.5 text-center text-xs font-semibold ${
                item.alert
                  ? "bg-signal-red/15 text-signal-red"
                  : "bg-white/[0.04] text-slate-500"
              }`}
            >
              {item.alert ? "3계층 임계값 초과 — 경보" : "임계값 일부 미달 — 경보 없음"}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold text-slate-300">선정 기준</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          수입액 상위 + 중국 의존 우선. {mvp10.selection_note} 위험등급은 예측값이 아니라 사각지대
          원본 목록({blindspots.source})에 확정 기재된 값을 그대로 가져왔다.
        </p>
        <SourceTag>
          관세청 수출입통계 HS4 집계 · 한국은행 수입물가지수 전월대비 · KOTRA 해외시장뉴스 매칭 건수
        </SourceTag>
      </div>
    </>
  );
}
