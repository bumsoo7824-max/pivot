export type JobPosting = {
  id: string; // 구인인증번호
  company: string; // 회사명
  title: string; // 채용제목
  region: string; // 근무지역
  employmentType: string; // 고용형태
  minEducation: string; // 최소학력
  career: string; // 경력
  preferred: string; // 우대조건
  salary: string; // 급여
  postedAt: string; // 등록일자
  closesAt: string; // 마감일자
  matchedNcs: string; // 매칭_NCS_직무
  mappingId: number; // 매핑표_연결_id
};

export const jobsNote =
  "워크넷 채용정보 API 실제 응답 스키마를 참고하여 제작한 데모용 mock 데이터입니다. 실제 공공데이터가 아니며, 데모/프로토타입 시연 목적으로만 사용합니다.";

export const jobPostings: JobPosting[] = [
  { id: "MOCK-001", company: "(주)전북로지스틱스", title: "물류센터 재고관리 담당자 채용", region: "전북 완주군", employmentType: "정규직", minEducation: "고졸", career: "무관(신입 가능)", preferred: "재고관리·자원배분 경험자 우대", salary: "월 240만원", postedAt: "2026-08-20", closesAt: "2026-09-20", matchedNcs: "생산관리/자원배분", mappingId: 1 },
  { id: "MOCK-002", company: "한빛금속가공", title: "금속 조립·용접 생산직 모집", region: "전북 익산시", employmentType: "정규직", minEducation: "무관", career: "1년 이상 우대", preferred: "용접·설비조작 경험자 우대", salary: "월 280만원", postedAt: "2026-08-18", closesAt: "2026-09-15", matchedNcs: "금속재료가공", mappingId: 6 },
  { id: "MOCK-003", company: "새아침요양센터", title: "요양보호 및 돌봄서비스 인력 채용", region: "전북 전주시", employmentType: "정규직/계약직", minEducation: "무관", career: "무관", preferred: "돌봄·생활지원 경험자 우대", salary: "월 220만원", postedAt: "2026-08-15", closesAt: "2026-09-30", matchedNcs: "돌봄서비스기획", mappingId: 17 },
  { id: "MOCK-004", company: "청우물류운송", title: "화물차 운전기사 모집", region: "전북 군산시", employmentType: "정규직", minEducation: "무관", career: "운전경력 우대", preferred: "1종 대형면허, 화물운송 경험", salary: "월 300만원", postedAt: "2026-08-21", closesAt: "2026-09-25", matchedNcs: "화물운송관리", mappingId: 15 },
  { id: "MOCK-005", company: "전북건설산업", title: "건설 현장관리 보조 인력 채용", region: "전북 전주시", employmentType: "계약직", minEducation: "무관", career: "무관(현장경험 우대)", preferred: "현장시공·안전관리 경험자 우대", salary: "일급 15만원", postedAt: "2026-08-19", closesAt: "2026-09-19", matchedNcs: "건설시공관리", mappingId: 16 },
  { id: "MOCK-006", company: "농협전북유통", title: "농산물 유통·재배관리 직원 채용", region: "전북 김제시", employmentType: "정규직", minEducation: "무관", career: "무관", preferred: "농업 실무 경험자 우대", salary: "월 230만원", postedAt: "2026-08-22", closesAt: "2026-09-22", matchedNcs: "농산물유통관리", mappingId: 1 },
  { id: "MOCK-007", company: "믿음푸드", title: "식품 생산라인 및 위생관리 담당자", region: "전북 정읍시", employmentType: "정규직", minEducation: "무관", career: "무관", preferred: "위생관리·품질관리 경험 우대", salary: "월 250만원", postedAt: "2026-08-17", closesAt: "2026-09-17", matchedNcs: "식품생산관리", mappingId: 7 },
  { id: "MOCK-008", company: "전주행정지원센터", title: "행정 사무보조 인력 채용", region: "전북 전주시", employmentType: "무기계약직", minEducation: "고졸", career: "무관", preferred: "문서작성·행정처리 경험자 우대, 사무자동화산업기사 우대", salary: "월 235만원", postedAt: "2026-08-23", closesAt: "2026-09-30", matchedNcs: "일반사무", mappingId: 14 },
  { id: "MOCK-009", company: "전북경비보안", title: "시설 경비 및 보안 관리 인력 채용", region: "전북 완주군", employmentType: "정규직", minEducation: "무관", career: "무관", preferred: "조직관리·위기대응 경험자 우대(군 경력 우대)", salary: "월 245만원", postedAt: "2026-08-16", closesAt: "2026-09-16", matchedNcs: "보안관리", mappingId: 18 },
  { id: "MOCK-010", company: "함박웃음마트", title: "매장 판매·재고관리 직원 모집", region: "전북 전주시", employmentType: "정규직/파트타임", minEducation: "무관", career: "무관", preferred: "고객응대·판매 경험자 우대", salary: "시급 11,000원", postedAt: "2026-08-24", closesAt: "2026-09-24", matchedNcs: "매장관리", mappingId: 13 },
];
