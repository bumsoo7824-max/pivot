import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MatchDemo from "@/components/MatchDemo";

export const metadata = {
  title: "매칭 데모 — 잇다(IT-DA)",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            매칭 데모
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            재북 직업을 선택하면, 남한 직무와 채용공고가 연결됩니다
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            아래 카드에서 재북 시절 직업 카테고리를 선택해보세요. NCS 매핑
            결과, 근거 지표(참고 취업률), 실제와 유사한 형태의 채용공고
            예시가 순서대로 제공됩니다.
          </p>
        </div>
        <MatchDemo />
      </main>
      <SiteFooter />
    </>
  );
}
