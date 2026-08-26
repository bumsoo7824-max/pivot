export type MappingRow = {
  id: number;
  category: string; // 재북_직업_카테고리
  description: string; // 재북_직업_설명
  tags: string[]; // 역량_태그
  ncsGroup: string; // NCS_대분류
  ncsField: string; // NCS_중분류_예시
  kecoJob: string; // 남한_추천직무_KECO
  employmentRate2025: number; // 2025_참고_취업률(%)
  confidence: "최상" | "상" | "중" | "낮음";
};

export const mappingRows: MappingRow[] = [
  { id: 1, category: "협동농장 관리원", description: "협동농장의 작업 배분·인력 조직·생산계획을 총괄", tags: ["자원배분", "인력조직", "생산계획관리"], ncsGroup: "농림어업", ncsField: "농산물유통관리", kecoJob: "농림어업직", employmentRate2025: 49.9, confidence: "중" },
  { id: 2, category: "협동농장 관리원", description: "(대안2) 조직관리 역량 중심", tags: ["조직관리", "성과관리", "대인역량"], ncsGroup: "경영·회계·사무", ncsField: "생산관리", kecoJob: "경영·행정·사무직", employmentRate2025: 51.0, confidence: "중" },
  { id: 3, category: "공장 작업반장", description: "생산라인 인력 배치 및 작업 진도 관리", tags: ["생산관리", "품질관리", "조직관리"], ncsGroup: "기계", ncsField: "생산설비관리", kecoJob: "기계 설치·정비·생산직", employmentRate2025: 64.7, confidence: "상" },
  { id: 4, category: "협동농장원(일반 농장원)", description: "농작업 실무 수행", tags: ["현장실무", "체력", "협업"], ncsGroup: "농림어업", ncsField: "작물재배", kecoJob: "농림어업직", employmentRate2025: 49.9, confidence: "중" },
  { id: 5, category: "공장 노동자(경공업)", description: "방직·의류 등 경공업 생산라인 근무", tags: ["생산실무", "정밀작업", "반복작업숙련"], ncsGroup: "섬유의복", ncsField: "생산공정관리", kecoJob: "섬유·의복 생산직", employmentRate2025: 41.2, confidence: "중" },
  { id: 6, category: "공장 노동자(중공업/금속)", description: "금속가공·기계조립 라인 근무", tags: ["정밀가공", "용접", "설비조작"], ncsGroup: "재료", ncsField: "금속재료가공", kecoJob: "금속·재료 설치·정비·생산직", employmentRate2025: 64.1, confidence: "상" },
  { id: 7, category: "식료품 가공 노동자", description: "식품 생산·가공 공정 근무", tags: ["위생관리", "공정관리", "품질관리"], ncsGroup: "식품가공", ncsField: "식품생산관리", kecoJob: "식품 가공·생산직", employmentRate2025: 45.7, confidence: "중" },
  { id: 8, category: "교육자(교원)", description: "학교에서 학생 교육 및 생활지도", tags: ["교수설계", "생활지도", "커뮤니케이션"], ncsGroup: "교육·자연·사회과학", ncsField: "교육프로그램운영", kecoJob: "교육직", employmentRate2025: 33.7, confidence: "중" },
  { id: 9, category: "의료인(의사·간호원)", description: "진료·간호 등 보건의료 업무 수행", tags: ["전문지식", "환자관리", "위생관리"], ncsGroup: "보건·의료", ncsField: "보건의료서비스", kecoJob: "보건·의료직", employmentRate2025: 76.4, confidence: "최상" },
  { id: 10, category: "과학기술인(기술자)", description: "산업현장의 기술직무 수행", tags: ["기술분석", "문제해결", "현장적용"], ncsGroup: "정보통신 또는 기계(세부직종에 따라 상이)", ncsField: "기술지원", kecoJob: "정보통신 연구개발직 및 공학기술직", employmentRate2025: 50.4, confidence: "중" },
  { id: 11, category: "예술인(무용수·연주자 등)", description: "공연·예술활동 종사", tags: ["표현력", "공연기획", "대인역량"], ncsGroup: "문화·예술·디자인·방송", ncsField: "공연예술기획", kecoJob: "예술·디자인·방송직", employmentRate2025: 49.0, confidence: "중" },
  { id: 12, category: "체육인(운동선수·지도원)", description: "체육 지도 및 훈련 지도 업무", tags: ["체력관리", "지도역량", "조직관리"], ncsGroup: "이용·숙박·여행·오락·스포츠", ncsField: "스포츠지도", kecoJob: "스포츠·레크리에이션직", employmentRate2025: 37.7, confidence: "낮음" },
  { id: 13, category: "상업 종사자(장마당 상인 등)", description: "소규모 상거래 및 판매 실무", tags: ["협상력", "고객응대", "재고관리"], ncsGroup: "영업판매", ncsField: "매장관리", kecoJob: "영업·판매직", employmentRate2025: 44.2, confidence: "중" },
  { id: 14, category: "사무원(행정 보조)", description: "행정 문서작성 및 사무보조 업무", tags: ["문서작성", "행정처리", "커뮤니케이션"], ncsGroup: "경영·회계·사무", ncsField: "일반사무", kecoJob: "경영·행정·사무직", employmentRate2025: 51.0, confidence: "중" },
  { id: 15, category: "운전원(운수 종사자)", description: "차량 운행 및 물류 이동 업무", tags: ["운행관리", "안전관리", "물류이해"], ncsGroup: "운전운송", ncsField: "화물운송관리", kecoJob: "운전·운송직", employmentRate2025: 58.6, confidence: "상" },
  { id: 16, category: "건설 노동자", description: "건축·토목 현장 실무 종사", tags: ["현장시공", "안전관리", "체력"], ncsGroup: "건설", ncsField: "건설시공관리", kecoJob: "건설·채굴직", employmentRate2025: 50.3, confidence: "중" },
  { id: 17, category: "보육/가사 담당자", description: "아동 돌봄 및 가사 지원 업무", tags: ["돌봄역량", "생활지원", "책임감"], ncsGroup: "사회복지·종교", ncsField: "돌봄서비스기획", kecoJob: "돌봄 서비스직(간병·육아)", employmentRate2025: 63.0, confidence: "상" },
  { id: 18, category: "군인(직업군인 복무 이력)", description: "조직관리 및 임무수행 경험 보유", tags: ["조직관리", "위기대응", "책임감"], ncsGroup: "경비·청소", ncsField: "보안관리", kecoJob: "경호·경비직", employmentRate2025: 51.5, confidence: "중" },
  { id: 19, category: "무직/부양가족(경력공백)", description: "재북 시절 정규 직업력 없음", tags: ["생활역량", "적응력"], ncsGroup: "경영·회계·사무 또는 서비스 전반", ncsField: "기초직무훈련 연계", kecoJob: "청소 및 기타 개인서비스직", employmentRate2025: 40.0, confidence: "낮음" },
  { id: 20, category: "학생(재북 재학 이력)", description: "학업 이수 이력만 존재", tags: ["학습역량", "기초소양"], ncsGroup: "교육 또는 희망분야에 따라 상이", ncsField: "진로설계 상담 연계", kecoJob: "경영·행정·사무직", employmentRate2025: 51.0, confidence: "낮음" },
];

export const confidenceOrder: MappingRow["confidence"][] = ["최상", "상", "중", "낮음"];
