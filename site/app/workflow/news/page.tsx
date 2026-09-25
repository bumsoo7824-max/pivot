import RecallRoundsChart from "@/components/charts/RecallRoundsChart";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { newsValidation } from "@/lib/news-validation-data";

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="text-signal-green">✓</span>
  ) : (
    <span className="text-slate-600">✗</span>
  );
}

export default function NewsValidationPage() {
  const last = newsValidation.rounds[newsValidation.rounds.length - 1];
  const naverOnly = newsValidation.round12_events.filter((e) => e.naver && !e.google).length;
  const googleOnly = newsValidation.round12_events.filter((e) => e.google && !e.naver).length;

  return (
    <>
      <PageHeader
        step="워크플로우 · 뉴스 소급 검증"
        title="네이버+구글뉴스 OR 결합 — 왜, 그리고 얼마나 잡히는가"
        lead={`②단계(뉴스 검색)의 재현율을 라운드 3~12까지 반복 측정한 기록. 최종 확정치는 '진짜 과녁'(구조적 RED 379개 유니버스 안 실제 사건) 15개 기준 결합(OR) ${last.recall}%다.`}
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-amber/30 bg-signal-amber/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-amber">
          &quot;유명한 세계 뉴스&quot;를 잡는 성능(라운드7~11, 67~83%)과 &quot;우리 제품이 실제로
          신경써야 할 사건&quot;을 잡는 성능(라운드12, 47~53%)은 전혀 다른 숫자입니다. 이 페이지의
          숫자는 후자 기준입니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="naver 단독" value="47% (7/15)" sub={`정밀도 ${newsValidation.precision.naver}`} />
        <Stat label="google 단독" value="47% (7/15)" sub={`정밀도 ${newsValidation.precision.google}`} />
        <Stat label="결합(OR)" value={`${last.recall}% (8/15)`} tone="pivot" sub={newsValidation.combine_rule} />
      </div>

      <Section title="라운드별 재현율 추이" className="mb-6" hint="같은 사전이라도 검증셋을 무엇으로 잡느냐에 따라 크게 달라진다.">
        <RecallRoundsChart rounds={newsValidation.rounds.map((r) => ({ round: r.round, dataset: r.dataset, recall: r.recall, note: r.note }))} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">라운드</th>
                <th className="py-1.5 pr-3 font-medium">대상 데이터셋</th>
                <th className="py-1.5 pr-3 font-medium">재현율</th>
                <th className="py-1.5 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {newsValidation.rounds.map((r) => (
                <tr key={r.round} className="border-t border-white/5">
                  <td className="py-2 pr-3 font-mono text-pivot-500">{r.round}</td>
                  <td className="py-2 pr-3 text-slate-300">{r.dataset}</td>
                  <td className="py-2 pr-3 font-mono text-slate-200">{r.recall}%</td>
                  <td className="py-2 leading-relaxed text-slate-500">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="라운드12(최종) — 사건 15개 상세"
        className="mb-6"
        hint={`naver만 잡은 사건 ${naverOnly}건, google만 잡은 사건 ${googleOnly}건 — 서로 다른 사건을 보완해 결합이 실익이 있음을 확인.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">사건</th>
                <th className="py-1.5 pr-2 text-center font-medium">naver</th>
                <th className="py-1.5 pr-2 text-center font-medium">google</th>
                <th className="py-1.5 pr-3 text-center font-medium">결합</th>
                <th className="py-1.5 font-medium">비고</th>
              </tr>
            </thead>
            <tbody>
              {newsValidation.round12_events.map((e) => (
                <tr key={e.event} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-slate-300">{e.event}</td>
                  <td className="py-2 pr-2 text-center"><Mark ok={e.naver} /></td>
                  <td className="py-2 pr-2 text-center"><Mark ok={e.google} /></td>
                  <td className="py-2 pr-3 text-center"><Mark ok={e.combined} /></td>
                  <td className="py-2 leading-relaxed text-slate-500">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="미탐 7건 원인">
          <div className="flex flex-col gap-3">
            {newsValidation.misses.map((m) => (
              <div key={m.cause} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-200">{m.cause}</p>
                  <span className="chip border-signal-amber/40 bg-signal-amber/10 text-signal-amber">
                    {m.count}건
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{m.examples}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            2026-09-25 결정: 니치 B2B 산업뉴스 공백은 구조적 한계로 보고서에 기록하되, 발표용
            GitHub 시각화(재현율 타임라인 등)에는 포함하지 않는다.
          </p>
        </Section>

        <Section title="핵심 교훈">
          <ul className="space-y-2.5 text-xs leading-relaxed text-slate-300">
            {newsValidation.lessons.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-pivot-500">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <SourceTag>
        키워드_재현율_검증_라운드별_요약.md · discover_collect.py classify() · naver_retro_articles.csv ·
        google_retro_articles.csv · event_hs6_map.csv 기준 2026-09-25 최종 확정치
      </SourceTag>
    </>
  );
}
