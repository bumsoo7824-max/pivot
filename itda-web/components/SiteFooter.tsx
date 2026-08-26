export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-5 py-8 text-xs leading-relaxed text-slate-400">
        <p>
          잇다(IT-DA)는 2026년 통일부 공공데이터 활용 공모전 출품을 위한{" "}
          <strong className="text-slate-500">비영리 프로토타입 데모</strong>
          입니다. 실제 서비스가 아니며, 화면의 채용공고·신뢰도 점수는 시연을
          위한 예시 데이터입니다.
        </p>
        <p className="mt-1">
          참고 취업률은 고용노동부 「실업자훈련취업률현황」(KECO 직종 기준,
          2025년) 통계를 활용했습니다. NCS 매핑 체계는 한국산업인력공단
          「국가직무능력표준 정보」를 참고했습니다.
        </p>
      </div>
    </footer>
  );
}
