# 잇다(IT-DA) 데모 웹

북한이탈주민의 재북 학력·경력을 국가직무능력표준(NCS) 기반 남한 직무로
치환해주는 AI 매칭 서비스 「잇다(IT-DA)」의 프로토타입입니다.
2026년 통일부 공공데이터 활용 공모전 출품용 보조 자료로 제작되었습니다.

랜딩 페이지와 매칭 데모 페이지 2개로 구성된 정적 사이트이며, 외부 API를
호출하지 않고 `data/` 아래 정적 데이터(`재북직업_NCS_매핑표.csv`,
`mock_jobs.json`을 TypeScript 모듈로 옮긴 것)만 사용합니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:3000
npm run build         # 도메인 루트용 정적 내보내기 → out/
npm run build:pages   # GitHub Pages용 내보내기 (basePath=/pivot) → out/
```

## 배포 (GitHub Pages)

저장소 루트의 `.github/workflows/deploy-itda.yml`이 `itda-web/`의 변경
사항을 감지해 자동으로 빌드 후 GitHub Pages에 배포합니다. 처음 한 번은
저장소 Settings → Pages → Source를 **GitHub Actions**로 지정해야 합니다.

배포 후 URL: `https://<github-user>.github.io/pivot/`

## 데이터 출처 및 주의사항

- `data/mapping.ts` — `재북직업_NCS_매핑표.csv`를 그대로 옮김 (재북 직업
  20개 카테고리 → NCS 직무 → KECO 직종 → 2025년 참고 취업률·신뢰도 예시)
- `data/jobs.ts` — `mock_jobs.json`을 그대로 옮김. **워크넷 실제 채용정보
  API가 아닌 데모용 mock 데이터**이며, 화면 하단에도 이를 명시합니다.
