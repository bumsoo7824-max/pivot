# Supply-Pivot 데모 사이트

데이터로 발굴한 공급망 사각지대와 대체 경로를 보여주는 **전시용 정적 데모**입니다.
실서비스가 아니라 발표·시연용이며, 화면에서 외부 API를 호출하지 않습니다. 모든 수치는
빌드 시점에 사전 계산된 JSON에서 나옵니다.

## 데이터 계층 구조

| 계층 | 출처 | 역할 | 확보 범위 |
|---|---|---|---|
| 베이스 | 관세청 수출입통계 | 구조적 취약성 진단 (HHI, 의존도) | HS6 × 국가 42개월 |
| 선행① | 한국은행 ECOS 수입물가지수 | **월 단위** 지수, 관세청 통계 공표보다 선행 | 202501~202606 18개월 |
| 선행② | KOTRA 해외시장뉴스 | 실시간 정책·규제 동향 | 90일 884건 중 공급망 매칭 60건 |
| 실행 | UN Comtrade + KOTRA 해외법인 | 대체 공급국 발굴 및 지원기관 연결 | 해외법인 9,927사 / 84개국 |

경보는 세 계층 임계값을 모두 넘을 때만 발령합니다:
수입물가지수 이상 감지(익월 초) → HHI 구조 확인(관세청, 익월 중순) → KOTRA 뉴스 정책 동향(실시간).

## 표기 원칙

- 지표는 **월 단위 수입물가지수**입니다. 일일 가격이 아닙니다. KOMIS 일일가격은 공공 API가 없어
  한국은행 수입물가지수로 대체했습니다.
- 대체 공급은 **국가 단위 발굴 + 지원기관 연결**까지입니다. 기업 매칭이 아닙니다.
- **예측하지 않습니다.** 확정 통계에 대한 진단·산출·경보입니다.
- 데이터가 없는 항목에 0을 대입하지 않고 **"산출 불가"**로 표기합니다.

## 구조

```
data/raw/                     원자료 (파케이·CSV·XLSX)
scripts/
  build_static_data.py        사전 계산 파이프라인 → site/public/data/*.json
  country_coords.py           국가명 → 좌표 룩업 (지도 마커용)
site/                         Next.js(App Router) + Tailwind + recharts, 정적 배포
  public/data/*.json          빌드 산출물 (사이트가 읽는 유일한 데이터)
```

## 실행

```bash
# 1) 사전 계산 (원자료 → JSON)
pip install pandas pyarrow openpyxl
python scripts/build_static_data.py

# 2) 사이트
cd site
npm install
npm run dev          # 개발 서버
npm run build        # 도메인 루트용 내보내기 → site/out/
npm run build:pages  # GitHub Pages용 내보내기 (basePath=/pivot + .nojekyll)
```

`output: "export"` 설정이라 서버 런타임 없이 정적 파일만 서빙하면 됩니다.

### 배포 위치와 basePath

프로젝트 페이지는 `https://<user>.github.io/<repo>/` 처럼 저장소명이 경로에 붙습니다.
이 접두사를 빌드에 알려주지 않으면 CSS·JS·내부 링크가 전부 404가 되므로,
`NEXT_PUBLIC_BASE_PATH` 환경변수로 주입합니다.

| 배포 위치 | 명령 | basePath |
|---|---|---|
| 도메인 루트 (Vercel 등) | `npm run build` | 없음 |
| GitHub Pages 프로젝트 페이지 | `npm run build:pages` | `/pivot` |

**GitHub Pages 갱신 절차** — `gh-pages` 브랜치는 빌드 산출물만 담습니다.

```bash
python scripts/build_static_data.py     # 데이터가 바뀐 경우에만
cd site && npm run build:pages
# site/out/ 내용을 gh-pages 브랜치 루트에 덮어쓴 뒤 푸시
```

`.nojekyll`은 `build:pages`가 자동으로 넣습니다. 이 파일이 없으면 Jekyll이
밑줄로 시작하는 `_next/` 디렉터리를 무시해 사이트가 통째로 깨집니다.

## API 키

키는 사전 계산 단계에서만 쓰이고, 사이트 런타임에는 필요하지 않습니다.
`.env.example`을 복사해 `.env.local`을 만들고 값을 채우세요. `.env*`는 커밋되지 않습니다.

```bash
cp .env.example .env.local
COMTRADE_KEY=... python scripts/build_static_data.py
```

- `ECOS_KEY` — 한국은행 ECOS
- `DATA_GO_KR_KEY` — 공공데이터포털
- `COMTRADE_KEY` — UN Comtrade. 있으면 빌드 시 **1회** 호출해 캐싱하고, 이후 재호출하지 않습니다.
  없으면 이 단계를 건너뛰고 화면에는 "산출 불가"로 표시됩니다.

기본값에 실제 키를 넣지 마세요. 원자료 스크립트(`pipeline_demo.py`,
`nonferrous_daily_price.py`)에 하드코딩돼 있던 키는 제거하고 `os.environ` 조회만 남겼습니다.

## 페이지

| 경로 | 내용 |
|---|---|
| `/` | 인트로 — 3계층 구조와 경보 순서 |
| `/golden-time` | 공표 시차 10일과 두 통계의 동행 |
| `/blindspots` | HHI × 1위국 비중 산점도 |
| `/top-country` | 사각지대의 1위국 분포 |
| `/mvp10` | MVP 10개 위험 신호등 카드 |
| `/items/[hs4]` | 품목 상세 20개 (MVP 10 + 관세청 원자료 보유 10) |
| `/timeline` | Before / After |
| `/roadmap` | 지금 되는 것과 협의 중인 것 |
| `/data-notes` | **숨김 페이지.** 데이터 한계 정리 (내비게이션에 없음, URL 직접 접근) |

## 데이터 관련 주의

사각지대 목록은 `data/raw/step4_blind_spots.csv`(256행)가 **단일 출처**입니다.
임계값으로 역산하지 않습니다. 산점도의 임계선 두 개(HHI 0.25 / 1위국비중 0.40)는 읽기
보조용 참조선입니다.

그 밖의 한계(HS–KSIC 브리지 수작업 매핑, 관세청 국가별 원자료의 품목 범위, 조달청 스냅샷
미사용 사유 등)는 `/data-notes`에 정리돼 있으며, 그 내용은 파이프라인이 기록한
`site/public/data/notes.json`에서 그대로 나옵니다.
