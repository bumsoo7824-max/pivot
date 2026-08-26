import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { mappingRows } from "@/data/mapping";
import { jobPostings } from "@/data/jobs";

const steps = [
  {
    n: "01",
    title: "재북 경력 선택",
    desc: "협동농장 관리원, 공장 노동자, 의료인 등 재북 시절 직업 카테고리를 선택합니다.",
  },
  {
    n: "02",
    title: "NCS 직무로 자동 매핑",
    desc: "국가직무능력표준(NCS) 체계에 맞춰 역량 태그와 대응 직무, 신뢰도를 계산합니다.",
  },
  {
    n: "03",
    title: "채용공고 · 취업률 확인",
    desc: "매칭된 직무 기준 참고 취업률과 실제 유사 채용공고(예시)를 함께 보여줍니다.",
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
            <p className="mb-4 inline-flex items-center rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
              2026 통일부 공공데이터 활용 공모전 · 프로토타입
            </p>
            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              재북 경력을, 남한 직무와{" "}
              <span className="text-brand-600">잇다.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              북한이탈주민의 재북 학력·경력을 국가직무능력표준(NCS) 기반의
              남한 직무 역량으로 치환하고, 신뢰도와 참고 취업률, 실제 유사
              채용공고까지 한 번에 보여주는 AI 매칭 서비스입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"
              >
                매칭 데모 체험하기 →
              </Link>
              <a
                href="#how"
                className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                작동 방식 보기
              </a>
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="매핑된 재북 직업" value={`${mappingRows.length}개`} />
              <Stat
                label="연결 NCS 직무"
                value={`${new Set(mappingRows.map((r) => r.ncsField)).size}종`}
              />
              <Stat label="예시 채용공고" value={`${jobPostings.length}건`} />
              <Stat
                label="최고 참고 취업률"
                value={`${Math.max(
                  ...mappingRows.map((r) => r.employmentRate2025)
                )}%`}
              />
            </dl>
          </div>
        </section>

        {/* Why */}
        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            왜 &ldquo;잇다&rdquo;인가
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            재북 시절의 직업 경력은 남한의 채용시장에서 제대로 인정받지
            못하는 경우가 많습니다. 협동농장 관리원의 &lsquo;자원배분·생산계획
            관리&rsquo; 역량은 남한 산업 현장의 생산관리 직무와 맞닿아
            있지만, 이를 연결해주는 도구가 없었습니다. 잇다는 이 간극을
            데이터로 잇습니다.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title="NCS 기반 표준 매핑"
              desc="한국산업인력공단 국가직무능력표준(NCS) 체계를 기준으로 재북 직업의 역량을 남한 직무 언어로 번역합니다."
            />
            <FeatureCard
              title="근거 있는 신뢰도"
              desc="직무 매칭 결과에 신뢰도 등급과, 고용노동부 통계 기반 참고 취업률을 함께 제시해 판단 근거를 보여줍니다."
            />
            <FeatureCard
              title="바로 보는 채용공고"
              desc="매칭된 직무와 연결되는 채용공고 예시를 카드 형태로 제공해, 다음 행동으로 자연스럽게 이어집니다."
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-slate-200 bg-slate-100/60">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              작동 방식
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              세 단계로 재북 경력이 남한 채용공고까지 연결됩니다.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={s.n}
                  className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <span className="text-3xl font-extrabold text-brand-100">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-slate-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {s.desc}
                  </p>
                  {i < steps.length - 1 && (
                    <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl text-slate-300 sm:block">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/demo"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"
              >
                지금 매칭 데모 체험하기 →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}
