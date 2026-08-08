import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui";
import { meta, notes } from "@/lib/data";

// 내비게이션에 노출하지 않는 숨김 페이지. URL 직접 접근으로만 들어온다.
export const metadata: Metadata = {
  title: "데이터 노트 — Supply-Pivot",
  robots: { index: false, follow: false },
};

export default function DataNotesPage() {
  return (
    <>
      <PageHeader
        step="부록 · 숨김 페이지"
        title="데이터 노트"
        lead="심사 질의 대비용입니다. 이 데모가 쓰는 데이터의 한계와, 그 한계에 맞춰 화면을 어떻게 조정했는지 정리했습니다."
      />

      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-slate-400">
        빌드 시각 {meta.generated_at.replace("T", " ").slice(0, 16)} UTC · 아래 내용은 사전 계산
        파이프라인(<code className="font-mono text-slate-300">scripts/build_static_data.py</code>)이
        기록한 값에서 그대로 가져온 것이며, 화면에서 다시 계산하지 않습니다.
      </div>

      <Section title="다루는 범위와 다루지 않는 범위" className="mb-6">
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

      <div className="mb-6 space-y-4">
        {notes.items.map((n, i) => (
          <Section key={n.key}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xs text-slate-600">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">{n.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{n.body}</p>
                <p className="mt-3 rounded-lg border border-pivot-500/20 bg-pivot-600/[0.07] px-3 py-2 text-xs leading-relaxed text-pivot-500">
                  화면 반영 · {n.impact}
                </p>
              </div>
            </div>
          </Section>
        ))}
      </div>

      <Section title="빌드 로그" hint="원자료 로딩부터 JSON 산출까지 파이프라인이 남긴 기록 전문.">
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-slate-400">
          {meta.build_log.join("\n")}
        </pre>
      </Section>

      <Section title="데이터 계층 요약" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                <th className="pb-2 pr-4 font-medium">계층</th>
                <th className="pb-2 pr-4 font-medium">출처</th>
                <th className="pb-2 pr-4 font-medium">역할</th>
                <th className="pb-2 font-medium">확보 범위</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {meta.layers.map((l) => (
                <tr key={l.tier} className="align-top">
                  <td className="py-3 pr-4 text-sm font-semibold text-white">{l.tier}</td>
                  <td className="py-3 pr-4 text-sm text-slate-300">{l.source}</td>
                  <td className="py-3 pr-4 text-xs leading-relaxed text-slate-400">{l.role}</td>
                  <td className="py-3 font-mono text-xs text-slate-500">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
