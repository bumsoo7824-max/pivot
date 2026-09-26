import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";
import { coverageCounts } from "@/lib/coverage-data";
import { workflow } from "@/lib/workflow-data";

export default function AltSupplyPage() {
  const s9 = workflow.steps.find((s) => s.id === 9)!;
  const s10 = workflow.steps.find((s) => s.id === 10)!;
  const counts = coverageCounts();
  const universeTotal =
    counts.collected +
    counts.collected_unintegrated +
    counts.collected_partial +
    counts.pending +
    counts.no_trade;
  const readyPct = Math.round((counts.collected / universeTotal) * 100);

  return (
    <>
      <PageHeader
        step="워크플로우 · 대체공급처·지원정책 (유료 범위)"
        title="영향국을 제외하고 후보를 추천한다"
        lead="경보가 확정된 사건이 고객이 실제로 수입하는 품목·공급국과 겹치는지 확인하고, 영향국을 제외한 대체공급국과 지원정책을 연결한다. ⑨⑩은 유료 버전 범위이며, 현재 379개 기준 데이터로 시연한다."
      >
        <p className="mt-3 max-w-3xl rounded-lg border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-xs leading-relaxed text-signal-red">
          이 단계는 MVP(무료 ①~⑧)에 포함되지 않는 유료 버전 범위입니다. 대체공급처 매칭까지
          데이터가 완비된 품목은 1,109개 중 {counts.collected}개(약 {readyPct}%)뿐이며, 나머지는{" "}
          <Link href="/workflow/coverage/" className="underline">
            품목 커버리지 검색
          </Link>
          에서 확인할 수 있습니다.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="대체공급처까지 완비" value={`${counts.collected}개`} tone="pivot" sub="1,109개 중 — 379개 기준 우선 시연" />
        <Stat label="수집 완료·미통합" value={`${counts.collected_unintegrated}개`} sub="52HS4군 — 최종 테이블 반영 전" />
        <Stat
          label="수입액·공급국만 확보"
          value={`${counts.collected_partial}개`}
          sub="nitemtrade 12개월 — 후보국 참고용, HHI 미계산"
        />
        <Stat label="진짜 사각지대" value={`${counts.pending}개`} tone="amber" sub="12개월간 수입 자체 미확인" />
      </div>

      <Section title={`⑨ ${s9.title}`} className="mb-6" hint="유료 버전 범위 — 고객 HS6 ∩ 공급국 ∩ 사건 영향국">
        <p className="text-sm leading-relaxed text-slate-300">{s9.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{s9.detail}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {["고객 수입 HS6 목록", "고객 현재 공급국", "사건 영향국(뉴스 매핑)"].map((t, i) => (
            <div key={t} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center">
              <span className="font-mono text-xs text-slate-600">{i + 1}</span>
              <p className="mt-1 text-xs text-slate-300">{t}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-slate-600">세 조건이 겹칠 때만 &quot;내 회사에 영향&quot;으로 경보를 좁힌다</p>
      </Section>

      <Section title={`⑩ ${s10.title}`} className="mb-6" hint="영향국 제외 후 후보 추천 · 정책은 유형표+자격 필터">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-white">대체 공급국 후보</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              KOTRA 무역 데이터에서 사건 영향국을 제외한 뒤, 동일 HS6 품목을 실제로 수출하고 있는
              국가를 수입 비중 순으로 추천한다. 379개 기준 품목은 이미 대체공급국 상위 5개국까지
              연결돼 있다.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">지원정책 연계</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              공급망 전환에 활용 가능한 정부·기관 지원정책을 유형표(자금·세제·컨설팅 등)와 자격
              요건 필터로 매칭한다. 고객이 실제로 신청 가능한 정책만 추려서 보여주는 것이 목표다.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{s10.detail}</p>
      </Section>

      <Section title="현재 시연 범위와 남은 일">
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
          <li>
            <b className="text-white">379개 기준으로 우선 시연.</b> 대체공급국 매칭까지 실데이터가
            연결된 품목은 이미 379개뿐이라, 발표 데모는 이 범위 안에서 진행한다.
          </li>
          <li>
            <b className="text-white">552개는 nitemtrade로 보완 수집 중.</b> 완료되는 대로 같은
            매칭 로직을 그대로 적용할 수 있도록 파이프라인을 설계해뒀다.
          </li>
          <li>
            <b className="text-white">HHI/노출도는 참고용.</b>{" "}
            <Link href="/workflow/alerts/" className="text-pivot-500 hover:underline">
              HHI 등급·경보 흐름
            </Link>
            에서 다운그레이드 근거를 확인할 수 있다 — ⑨⑩ 매칭 자체는 HHI 값에 의존하지 않는다.
          </li>
        </ul>
      </Section>

      <SourceTag>
        진행현황_결정사항_내일할일_0924.md · 최종_통합_리스크_테이블.md · KOTRA 매칭 데이터 · 2026-09-25 기준
      </SourceTag>
    </>
  );
}
