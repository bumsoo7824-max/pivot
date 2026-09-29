import Link from "next/link";
import { PageHeader, Section, SourceTag, Stat } from "@/components/ui";

/**
 * ⑥ 기술력 — 워크플로우 허브의 6번째 페이지.
 * 2026-09-29: 전체 워크플로우(overview) 페이지를 진단·경보·전환 3챕터로 압축하면서,
 * 중복제거·HS6매핑·classify()·매칭엔진·신뢰도가중치 같은 "구현 디테일"은 이 페이지로 분리했다.
 * AI 기술 활용(심사 15점) 항목을 한 곳에 모아 밀도 있게 보여주는 목적.
 */

const TECH_ITEMS = [
  {
    n: "①",
    title: "중복 제거",
    desc: "여러 매체가 같은 사건을 다른 제목으로 보도하는 경우가 많다. 제목·본문의 텍스트 유사도로 같은 사건을 하나로 묶어, 같은 이슈가 경보 개수를 부풀리지 않도록 한다.",
  },
  {
    n: "②",
    title: "HS6·국가 매핑",
    desc: "뉴스 본문의 자유 텍스트(품목명·국가명)를 관세청 HS6 코드와 국가 코드로 규칙 기반 매핑한다. 동음이의어(예: 금속 '은' vs 사람 이름 '은') 오탐을 materials 사전에서 걸러낸다.",
  },
  {
    n: "③",
    title: "classify() 신호등 판정",
    desc: "disrupt(공급 차단 신호) + materials(품목 매칭) 두 조건이 모두 맞으면 RELEVANT, materials만 비어 있으면 CANDIDATE로 분류한다. 생성형 AI가 아닌 규칙 기반이라 판정 근거를 항상 역추적할 수 있다.",
  },
  {
    n: "④",
    title: "정밀 매칭 엔진",
    desc: "Kiwi 형태소분석 + TF-IDF 코사인 유사도로 대체공급국 후보와 KOTRA 해외법인 657건을 매칭한다. 매칭이 안 되면 0이나 추정치를 넣지 않고 정직하게 '매칭 없음'으로 표시한다.",
  },
  {
    n: "⑤",
    title: "뉴스 소스별 신뢰도 가중치",
    desc: "과거 확정 사건 4건(안티모니·칼륨비료·콜타르·희토류)을 네이버·구글·KOTRA 3개 소스로 사후 교차검증해, 소스별 적중률을 그대로 신뢰도 가중치에 반영했다(네이버 1.0 · 구글 1.0 · KOTRA 0.5).",
  },
] as const;

export default function WorkflowTechPage() {
  return (
    <>
      <PageHeader
        step="워크플로우 · 페이지 6"
        title="기술력 — 어떻게 구현했는가"
        lead="진단·경보·전환 3챕터의 각 단계를 실제로 돌리는 구현 로직만 모았다. AI가 핵심 역할을 어디서, 어떻게 하는지를 여기서 확인한다."
      >
        <Link href="/workflow/overview/" className="chip mt-3 inline-block border-pivot-500/40 bg-pivot-500/10 text-pivot-500">
          ← 전체 워크플로우
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="뉴스 재현율(결합 OR)" value="53%" tone="pivot" sub="held-out 15개 사건 중 8건 · 네이버 47%+구글 47% 결합" />
        <Stat label="사후 교차검증" value="4개 사건 × 3소스" sub="안티모니·칼륨비료·콜타르·희토류" />
        <Stat label="정밀 매칭 대상" value="KOTRA 657건" sub="Kiwi+TF-IDF 코사인 유사도" />
      </div>

      <div className="flex flex-col gap-4">
        {TECH_ITEMS.map((t) => (
          <Section key={t.title} title={`${t.n} ${t.title}`}>
            <p className="text-sm leading-relaxed text-slate-300">{t.desc}</p>
          </Section>
        ))}
      </div>

      <SourceTag>
        discover_collect.py classify() · pipeline_v2/discover.db · 키워드_재현율_검증_라운드별_요약.md ·
        사후검증_3소스_교차검증.md
      </SourceTag>
    </>
  );
}
