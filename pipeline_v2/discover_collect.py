# -*- coding: utf-8 -*-
r"""
discover_collect.py — 키 없이 쓸 수 있는 공개 소스에서 공급망 차질 '후보 사건'을 모아 SQLite에 누적한다.

기본 소스: 네이버 뉴스(naver, NAVER_ID/NAVER_SECRET 필요) + 구글뉴스(google, 키 불필요) 둘 다, OR 결합.
  2026-09-25 기준, naver_retro/google_news_retro 소급검증(held-out 15개 실사건 두 세트 — "유명 사건" 세트와
  "구조적 RED 379개 유니버스 안 진짜 과녁" 세트, `키워드_재현율_검증_라운드별_요약.md`)으로 두 소스 모두
  "실시간성 + 정확성"이 실측 확인됨. 처음엔 naver만 기본이었는데(2026-09-25 오전 결정), 진짜 과녁 세트
  재검증(라운드12)에서 naver·google이 서로 다른 사건을 잡는 상호보완 사례(기니보크사이트 가격급등=google만,
  후판 반덤핑=naver만)가 나와 OR 결합 재현율이 naver 단독보다 실측 개선(47%→53%)되어 google도 기본에 추가함
  (같은 날 오후 결정). 정밀도가 naver·google 서로 비슷해(43~58% vs 54~58%) **가중치는 따로 안 쓰고 단순 OR**.
  소스 개수보다 정확성·실시간성을 우선한다는 원칙은 유지 — naver/google 둘 다 그 기준을 통과했을 뿐.
그 외 소스는 전부 기본에서 뺐지만 함수는 남겨둠(향후 개별 검증 후 필요하면 --sources로 켤 수 있게):
  - kotra: 단신속보 — KOTRA 0건 미스터리 진단 결과 실시간성이 안 맞는 것으로 판단해 제외(속보라기보다 후행 정리성 기사 위주)
  - fr, sec, rss, gdacs, gdelt: 해외 소스 — 소급검증 결과 구조적 한계 확인(FR/SEC는 재현율 13%, RSS/GDACS는
    애초에 날짜범위+키워드 소급검색이 불가능한 구조) — 제외 확정
원칙: 소스당 요청은 소수, 요청 사이 대기, 식별 가능한 User-Agent(연락처는 환경변수 CONTACT), 응답 저장 후 중복 제거(url 기준).
classify()가 RELEVANT/CANDIDATE/NONE 3단으로 나눔(2026-09-25 추가) — CANDIDATE는 사건언어는 있는데 품목어가
사전에 없어 못 걸린 경우로, --export-candidates 로 뽑아서 사람이 보고 새 키워드 후보를 발굴하는 데 쓴다.
정확도는 사람이 라벨링해서 측정한다(--export).
2026-09-27: MATERIALS 사전에서 오탐 유발 항목('은'=조사 충돌, '럼프'="트럼프" 일부) 제거. 추가로
--ai-verify-candidates-n / --ai-verify-relevant-n 으로 AI 2차 검증(CANDIDATE 재검색·요약 + RELEVANT
표본 팩트체크)을 돌릴 수 있음 — OPENAI_API_KEY 필요, 아래 ai_verify_candidate()/ai_verify_relevant_sample() 참고.

usage (PowerShell):
    $env:CONTACT="본인이메일"          # 정중한 관행(다른 소스를 나중에 켤 경우 대비, naver만 쓸 땐 필수는 아님)
    $env:NAVER_ID="..."; $env:NAVER_SECRET="..."   # 네이버 뉴스검색 API 키(네이버클라우드 애플리케이션에서 발급)
    python discover_collect.py                        # 최근 3일, 네이버+구글 OR 결합, C:\Temp\discover.db 에 누적
    python discover_collect.py --days 30              # 소급(네이버는 최대 1000건 정렬결과 내에서)
    python discover_collect.py --sources fr sec       # 검증 안 된 해외소스를 굳이 켜고 싶을 때만 명시
    python discover_collect.py --export                # 새로 들어온 relevant 후보를 CSV로 (C:\Temp\discover_new.csv)
    python discover_collect.py --export-candidates      # 새로 들어온 CANDIDATE(품목어 미매칭) 후보를 CSV로 — 새 키워드 발굴용
    $env:OPENAI_API_KEY="sk-..."
    python discover_collect.py --ai-verify-candidates-n 20   # CANDIDATE 20건 AI 2차 검색·요약(재현율)
    python discover_collect.py --ai-verify-relevant-n 20     # RELEVANT 20건 표본 AI 팩트체크(정밀도)
매일 자동 실행: 작업 스케줄러에 'python discover_collect.py --days 2' 등록(하루 1회).
"""
import argparse, csv, json, os, re, sqlite3, sys, tempfile, time
from datetime import datetime, timedelta, timezone
import urllib.request, urllib.error, urllib.parse
import xml.etree.ElementTree as ET

CONTACT = os.environ.get("CONTACT", "unknown")
UA = f"SupplyPivotResearch/0.1 (public-interest contest project; {CONTACT})"

# 2026-09-27: admin UI(관리자 검토 페이지)용으로 discover.db를 실측 감사하다가 발견 — MATERIALS의 '은'과
# MATERIALS_TIER2의 '럼프'가 오탐(false positive) 유발 1위였다('은'은 한국어 조사 "~은/는"과 겹쳐 거의 모든
# 문장에서 매칭, '럼프'는 "트럼프"의 일부일 뿐 품목어가 아님). 실측: RELEVANT 618건 중 167건(27%)이 materials가
# 이 둘 뿐이었음. "위험키워드+품목키워드가 서로 N자 이내여야 인정" 근접조건도 검증해봤는데 167건 중 156건(93%)은
# 걸러지지만 11건은 조사 "은"이 우연히 disrupt 단어 근처에 와서 근접조건도 못 잡음 — 그래서 근접매칭 알고리즘을
# 새로 만들지 않고 그냥 두 항목을 사전에서 제거하기로 함(비용 0, 정상 품목어가 아니므로 재현율 손실 없음).
# 남는 극소량의 유사 오탐(다른 키워드 기인)은 아래 ai_verify_relevant_sample()이 RELEVANT 표본도 함께 검증해
# 잡아내는 쪽으로 결정(CANDIDATE만 보던 기존 계획을 RELEVANT 샘플까지 확장).
DISRUPT = ['export ban', 'export control', 'export restriction', 'export licen', 'export quota', 'export curb', 'export halt', 'suspend export', 'halts export', 'force majeure', 'anti-dumping', 'antidumping', 'countervailing', 'safeguard', 'sanction', 'embargo', 'shortage', 'supply disruption', 'supply crunch', 'plant shutdown', 'plant closure', 'shut down', 'outage', 'explosion', 'fire at', 'strike', 'lockout', 'blockade', 'tariff', 'quota', 'licensing requirement', '수출통제', '수출 통제', '수출금지', '수출 금지', '수출제한', '수출 제한', '수출 허가', '수출허가', '불가항력', '반덤핑', '상계관세', '세이프가드', '제재', '금수', '공급 차질', '공급차질', '품귀', '생산 중단', '생산중단', '가동 중단', '가동중단', '폐쇄', '파업', '화재', '폭발', '쿼터', '봉쇄', '공급망 안전', '공급 부족', 'surge', 'rally', 'price hike', 'price increase', 'price cut', 'price rise', 'soar', 'jump', 'spike', 'plunge', 'rebound', 'tightness', '급등', '급락', '가격 인상', '가격 인하', '가격 상승', '가격 하락', '반등', '강세', '약세', 'revoke', 'revocation', 'suspend', 'cancel rebate', 'vat rebate', 'minimum import price', 'quota cut', 'capacity cut', 'restructuring', 'crackdown', 'mine offline', 'decree', 'reopen', 'resume', 'freight surge', 'concession revoked', '수출 허가제', '할당량', '쿼터 축소', '면허 취소', '영업 취소', '단속', '조업 중단', '구조조정', '최저수입가격', '환급 취소', '재개', '운임 급등', 'duties', 'duty', 'restrict', 'clos', 'lifts price', 'lifting price', 'driving up', 'boosts price', '관세', '차단']
MATERIALS = ['gallium', 'germanium', 'graphite', 'antimony', 'tungsten', 'molybdenum', 'rare earth', 'dysprosium', 'terbium', 'cobalt', 'nickel', 'lithium', 'manganese', 'copper', 'aluminium', 'aluminum', 'alumina', 'bauxite', 'zinc', 'tin ', 'magnesium', 'titanium', 'vanadium', 'indium', 'tellurium', 'bismuth', 'silicon', 'polysilicon', 'sulphur', 'sulfur', 'sulphuric', 'urea', 'ammonia', 'fertili', 'potash', 'phosphate', 'dap', 'methanol', 'ethylene', 'propylene', 'naphtha', 'pvc', 'polyethylene', 'polypropylene', 'epoxy', 'mdi', 'tdi', 'silicone', 'vitamin', 'methionine', 'titanium dioxide', 'tio2', 'steel', 'hot-rolled', 'coil', 'semiconductor', 'wafer', 'neon', 'helium', 'magnet', 'battery', 'cathode', '갈륨', '게르마늄', '흑연', '안티모니', '텅스텐', '몰리브덴', '희토류', '코발트', '니켈', '리튬', '망간', '구리', '알루미늄', '알루미나', '보크사이트', '아연', '마그네슘', '티타늄', '바나듐', '인듐', '요소수', '비료', '칼륨', '인산', '황산', '유황', '암모니아', '메탄올', '에틸렌', '프로필렌', '나프타', '폴리에틸렌', '폴리프로필렌', '에폭시', '실리콘', '비타민', '메티오닌', '이산화티타늄', '철강', '열연', '강판', '전기강판', '냉연', '반도체', '웨이퍼', '네온', '헬륨', '자석', '배터리', '양극재', '광물', '원자재', 'gold', 'silver', 'platinum', 'palladium', 'precious metal', 'palm oil', 'palm kernel', 'oleochemical', 'glufosinate', 'glyphosate', 'herbicide', 'pesticide', 'heavy plate', 'h-beam', 'rebar', 'steel bar', 'scrap', 'thermal coal', 'coal', 'diamond', 'e-waste', '금', '백금', '팔라듐', '귀금속', '안티몬', '팜유', '팜핵유', '제초제', '농약', '후판', '형강', '봉강', '철근', '고철', '스크랩', '석탄', '다이아몬드']
MATERIALS_TIER2 = ['Aedes', 'Al', 'CFCs', 'Fe', 'HCFCs', 'HFCs', 'ISO', 'PCBs', 'PFCs', 'Portland', 'SiO', 'Zika', 'alabaster', 'aluminous', 'amalgam', 'anti', 'ballast', 'bead', 'blade', 'brewers', 'carbon', 'cermet', 'chamotte', 'clinker', 'coachwork', 'corundum', 'creosote', 'crossing', 'crystalline', 'cupel', 'diatomite', 'dinas', 'dross', 'dust', 'filler', 'fish', 'flake', 'flint', 'frit', 'gate', 'inhibitor', 'kieselguhr', 'knock', 'lacquer', 'leaded', 'lithopone', 'luminophore', 'lump', 'lustre', 'macadam', 'micro', 'microsphere', 'mullite', 'ovoid', 'ozokerite', 'paring', 'particle', 'piling', 'pitch', 'point', 'pregelatinised', 'rack', 'rail', 'rain', 'ramming', 'retort', 'rocket', 'rosin', 'roving', 'sheath', 'shingle', 'slag', 'slate', 'sleeve', 'slide', 'sole', 'spiegeleisen', 'spirit', 'square', 'stick', 'strip', 'submerged', 'sulphate', 'super', 'switch', 'tablet', 'tall', 'tarred', 'tile', 'travertine', 'tripolite', 'varnish', 'wadding', 'washer', 'wool', 'worked', '가루와', '가성', '가솔린', '가장자리', '가정용품', '가죽산업', '갈탄', '갈탄왁스', '감염', '강화유리', '건설', '건설용품', '건설재료', '건조', '건축', '건축물', '검화억제제', '겉보기', '게이트', '격재', '결합재', '겹염', '경질', '경화', '계산', '고결', '고령토', '고령토질', '고리', '고무', '고온', '고착', '고체', '공기', '공업', '공정', '과당', '과불화탄소', '과붕산염', '과브롬산염', '과산화금속산염', '과산화나트륨', '과산화마그네슘', '과산화벤조일', '과산화붕산염', '과산화산염', '과산화아세탈', '과산화아연', '과산화알코올', '과산화에테르', '과산화칼륨', '과산화케톤', '과산화헤미아세탈', '과염소산염', '과요드산염', '광물유', '광원', '광택', '광학', '광학소자', '교차구류', '구리합금', '구멍', '군청', '굴뚝', '굴뚝갓', '굴뚝통', '궤도', '귀석', '규산', '규산염', '규산질', '규선석', '규조토', '규화물', '그림물감', '글라스', '글루콘산', '글루탐산', '글리코시드', '금강사', '금속표면처리', '기관', '기와', '길이', '나선가공', '나트륨', '나프탈렌술폰산', '나프틸아민', '남정석', '납땜', '내장재', '내화', '내화모르타르', '내화벽돌', '내화블록', '내화시멘트', '내화콘크리트', '내화타일', '냉간압연', '냉간환원', '널말뚝', '노즐', '녹니석', '농축', '농축물', '높이', '뇌관', '니오븀광', '니켈광', '니코틴', '니트', '니트로', '니트릴관능화합물', '다공', '다이나스', '다이어토마이트', '다포', '단백질', '단조', '담배', '당아세탈', '당에스테르', '당에테르', '대리석', '대팻밥', '더스트', '덱스트린', '도가니', '도관', '도구모음', '도로포장', '도자', '도자제', '도자제의', '도자제품', '도폭선', '도화선', '독중석', '동물', '동석', '동위원소', '뒤편', '뒷면', '뒷편', '드레싱', '드로스', '디메틸아민', '디스크', '디아미노톨루엔', '디아조화합물', '디에탄올아민', '디에틸렌글리콜', '디클로로', '디티오카르바메이트', '디페닐아민', '뚜껑', '락탐', '락토포스페이트', '락톤', '락트산', '래밍믹스', '래커', '랙레일', '램프', '러스터', '런검', '레드라이트', '레시틴', '레이크', '레인로켓', '레일', '레일클립', '레토르트', '로빙', '로진', '로진유', '루미노퍼', '루토시드', '루틴', '리그닌', '리놀레산', '리놀렌산', '리벳', '리브', '리신', '리토폰', '링커', '마개', '마그네사이트', '마그네시아', '마디', '마루', '마이크로스피어', '마이크로크리스털린', '마찰', '막대', '말라리아', '망입', '매스틱', '매염제', '매트', '맥아당', '머캐덤', '머플', '멀라이트', '메타', '메타아크릴', '메타아크릴산', '메탄', '메틸', '메틸디에탄올아민', '메틸시클로헥사논', '메틸아민', '메틸이오논', '모기', '모노아민', '모노알킬에테르', '모노에탄올아민', '모노카르복시', '모노클로로', '모노필라멘트', '모래', '모자이크', '모조', '목욕통', '목재', '목재펄프', '목적', '몰리브덴광', '무계목', '무기', '무기물', '무기산', '무기산염', '무기화합물', '무늬', '무반', '무반사', '무수', '물통', '미생물', '민관능화합물', '밑판', '바깥지름', '바나듐광', '바니시', '바닥깔개', '바닷물', '바륨', '바이러스', '바이오디젤', '반귀석', '반사층', '반성', '반제품', '반콜로이드흑연', '받침', '받침목', '받침판', '방향', '방향족', '배소', '배양', '백동', '백류석', '백미러', '백운석', '밸러스트', '벌브', '법랑', '베이스플레이트', '베타', '벤드', '벤조산', '벤조티아졸고리', '벽돌', '변기', '변기통', '변성', '변성염', '변성전분', '보강재', '보드', '보조', '보존', '보존병', '복층', '복합가소제', '복합안정제', '봉합', '부분', '부분품', '부석', '부식방지', '부조', '부직포', '부착', '부착물', '부타디엔', '분리', '분비물', '분산', '불꽃제품', '불포화비환식모노카르복시산', '불포화지환식', '불포화지환식아민', '붕산', '붕산염', '붕소', '붕화물', '브레이크', '브롬', '브롬산염', '브롬화나트륨', '브롬화물', '브롬화칼륨', '브루어피치', '블레이드', '블록', '비금속', '비닐중합체', '비데', '비드', '비소', '비중', '비환', '사무', '사진', '사진플레이트', '사진필름', '산소관능아미노화합물', '산업폐기물', '산화금속산염', '산화니켈', '산화마그네슘', '산화망간', '산화물', '산화바륨', '산화방지', '산화브롬화물', '산화시안화나트륨', '산화시안화물', '산화아연', '산화알루미늄', '산화억제제', '산화염화구리', '산화염화물', '산화요드화물', '산화제이철', '산화철', '산화칼슘', '산화코발트', '산화티타늄', '산화할로겐화물', '살리실산의', '상관', '상관습', '색상', '색유리', '생석회', '생활폐기물', '샤모트', '서멧', '서브머지드아크', '서포트', '서포트타일', '석고', '석류석', '석면', '석면시멘트', '석유', '석유역청', '석유왁스', '석유젤리', '석유코크스', '석재', '석회', '석회석', '석회질', '선로', '선박', '선별', '선철', '설거지통', '설화석고', '섬유', '섬유산업', '섬장암', '성분', '세공품', '세그먼트', '세라믹', '세로', '세면대', '세바스산', '셀룰로오스', '셀룰로오스파이버시멘트', '소결', '소금', '소다', '소량', '소매', '소변기', '소석회', '소호', '소화', '소화기', '소화유도체', '소화탄', '쇄석', '수경', '수경성', '수분흡수계수', '수산', '수산화나트륨', '수산화마그네슘', '수산화물', '수산화알루미늄', '수산화염화구리', '수산화염화물', '수산화철', '수산화칼륨', '수산화칼슘', '수성', '수세식', '수소불화탄소', '수소염화불화탄소', '수소화물', '수송', '수용액', '수은', '수지', '수지산', '순수', '술폭실산나트륨', '술폭실산염', '술폰산', '술폰아미드', '쉬드', '슈퍼설페이트', '스위치', '스칸듐과', '스퀘어', '스테아르산', '스테인리스강', '스트렙토마이신', '스트론튬이', '스티렌', '스피그라이즌', '스피릿', '슬라이드', '슬래그', '슬래브', '슬랙왁스', '슬레이트', '슬리브', '슬립', '승화황', '시멘트', '시멘트동', '시안착염', '시안화나트륨', '시안화물', '시약', '시클로테르펜', '시클로테르펜모노카르복시산', '시클로헥사논', '시트르산의', '식물', '식탁', '식탁염', '식탁용품', '신발', '신변장식용품', '신호', '신호용품', '실내장식', '실리카', '실리콘수지', '실험실', '싱글', '쐐기', '아닐린', '아닐린유도체', '아디프산', '아말감', '아미노', '아미노산페놀', '아미노수지', '아미노히드록시', '아미드관능화합물', '아세탈', '아세트산', '아스팔트', '아에데스', '아염소산염', '아이', '아이티온산나트륨', '아이티온산염', '아인산염', '아젤라산', '아조화합물', '아족시화합물', '아지드화물', '아진포스', '아질산염', '아크릴', '아크릴산', '아황산염', '안개', '안구', '안료', '안전유리', '안티녹', '안티피린', '알갱이', '알긴산', '알데히드', '알라클로르', '알루미노실리케이트', '알칼리금속', '알칼리토', '알코올', '알코올페놀', '알키드수지', '알파', '암모늄', '암모늄염', '암모니아수', '암석', '앞부분', '애시드유', '액체', '앰플', '약병', '양극', '양백', '어스', '어스컬러', '에나멜', '에나멜공업', '에리즈로마이신', '에멀션', '에스테르화', '에이치', '에탄', '에테르', '에테르알코올', '에테르알코올페놀', '에테르페놀', '에틸디에탄올아민', '에틸렌글리콜', '에틸렌디아민', '에폭시드', '에폭시수지', '에폭시알코올', '에폭시에테르', '에폭시페놀', '엔도설판', '엘보', '역청', '역청유', '역청질', '연결구류', '연관공업', '연료', '연마', '연마가루', '연마재료', '연마페이스트', '연석', '연소', '연탄', '열간인발', '염과', '염료', '염산', '염색', '염색캐리어', '염소', '염소산염', '염수', '염화나트륨', '염화메탄', '염화메틸', '염화물', '염화벤조일', '염화불화탄소', '염화비닐', '염화수소', '염화에탄', '염화에틸', '영화', '예방', '오르토', '오르토프탈산', '오르토프탈산디노닐', '오르토프탈산디데실', '오르토프탈산디옥틸', '오산화인', '오일', '오조케라이트', '오픈심', '옥살산', '올레산', '올레핀', '와셔', '왁스', '완성가공', '왕자갈', '외피', '요드', '요드산염', '요드화물', '요드화합물', '요법', '용기', '용매', '용액', '용융', '용접', '용접봉', '용해', '우레', '우주선', '운모', '워딩', '원료', '원형', '유기', '유기화합물', '유당', '유동', '유리거울', '유리공업', '유리섬유', '유리용', '유리제품', '유백', '유약', '유연탄', '유지', '융제', '음극선관', '음극선관용', '응결', '의약품', '이산화규소', '이소시아네이트', '이소프렌', '이트륨', '인공', '인산비료', '인산에스테르', '인산염', '인산일나트륨', '인상법', '인스턴트', '인조', '인조석', '인조흑연', '인철', '인체', '인체물질', '인화물', '인화지', '입방체', '잉곳', '자갈', '자기제의', '자당', '잔재물', '장석', '장식', '장식품', '장전', '장전물', '재생고무', '전극', '전기뇌관', '전도도수', '전분', '전염', '전용', '전자', '전자부품', '전지', '전철봉', '전해정제', '절연유닛', '점도향상제', '점토', '점화', '접착', '접착제', '접합유리', '정광', '정사각형', '정석', '정제', '제련', '제지산업', '조각', '조각상', '조개탄', '조립식', '조명탄', '조성', '조제', '조제시약', '조합', '좌철', '주물제품', '주방', '주방용품', '주석', '주입법', '주철', '주형', '중간생산물', '중량기준', '중합체', '증류', '증류수', '지르코늄광', '지름', '지방', '지방산', '지연', '지지', '지지물', '지카', '직사각', '직사각형', '직조', '진단', '진주', '진주암', '질병', '질산염', '질석', '질소관능화합물', '질화물', '찌꺼기', '차량', '차체', '착색유리', '착색제', '착염', '천연고무', '천연색', '천연중합체', '천장', '철광', '철광석', '철도', '철제품', '첨가', '첨가제', '첵레일', '초산노르말부틸', '촉진제', '추출물', '축전지', '취입법', '치료', '침강황', '침전동', '카드뮴', '카르복시', '카르복시메틸셀룰로오스', '카르복시산', '카보이', '카본', '칼륨비료', '칼슘', '커런덤', '커플링', '컷백', '케톤', '케톤관능기', '코어', '코일', '코크스', '콘크리트', '콜로이드', '콜로이드황', '콜로이드흑연', '콜린', '콜타르', '퀴논', '큐브', '큐펠', '크레오소트', '크로스타이', '크로싱피스', '크림', '클러치', '클로로황산', '키절구어', '타르', '타르유', '타르타르산', '타일', '탄산', '탄산마그네슘', '탄산바륨', '탄소', '탄탈륨광', '탄화물', '태블릿', '텅스텐광', '테레프탈산', '테이프', '테트라사이클린', '테트라히드', '토탄', '토탄왁스', '톨루이딘', '톨유', '톱니', '톱밥', '투여량', '튜브', '트래버틴', '트리메틸아민', '트리클로로', '트리폴리트', '티아졸고리', '티오카르바메이트', '티오황산염', '티우람디술파이드', '티우람모노술파이드', '티우람테트라술파이드', '티타늄광', '파라', '파라티온', '파라포름알데히드', '파라핀왁스', '파티클', '파편', '판석', '팔미트산', '패널', '패드', '팽창', '퍼센트', '페나존', '페노티아진고리', '페놀', '페놀수지', '페니실린', '페니실린산', '페닐렌디아민', '페어링', '페이스트', '페인트', '페인팅', '펠릿', '펠트', '평면', '평직물', '폐기물', '폐액', '포도당', '포름산', '포석', '포스포네이트', '포스포아미노리피드', '포스피네이트', '포틀랜드', '포화비환식모노카르복시산', '포화비환식탄화수소', '포화지환식', '포화지환식아민', '폭약', '폴리머', '폴리아릴에스테르', '폴리아미드', '폴리아민', '폴리아세탈수지', '폴리에스테르', '폴리에테르', '폴리염화비페닐', '폴리우레탄', '폴리인산', '폴리인산염', '폴리카르복시산', '폴리카보네', '폴리크롬', '표면', '표준물질', '푸르푸릴', '프레임', '프로비타민', '프로판', '프리젤라티나이지드', '프리트', '프린트필름', '플라스크', '플라스터', '플러그', '플레이크', '플레이트', '플로트유리', '플루오르', '플루오르착염', '플루오르화규산염', '플루오르화물', '플루오르화수소', '플루오르화수소산', '플루오르화알루미늄산염', '플루오르화칼슘', '플린트', '피그', '피니싱', '피리딘', '피복', '피복재', '피치', '피치코크스', '피페리딘', '필러타일', '필수요소', '하석', '하소', '하수', '하이포아브롬산염', '하이포아염소', '하이포아염소산염', '하이포아인산염', '할로겐유도체', '할로겐화수소', '할로겐화은', '함유량', '합금선철', '항공기', '항생물질', '항아리', '해면', '핵산', '헤미아세탈', '헤파린', '헥사메틸렌디아민', '현상', '형석', '형재', '형태', '혼합알킬나프탈렌', '혼합알킬벤젠', '홈통', '홍주석', '화공품', '화약', '화장실', '화장용품', '화학공업', '화학비료', '화학조제품', '화합철분', '환식모노카르복시산', '환식중합체', '활석', '활성', '황산바륨', '황산칼륨', '황산칼슘', '황아연', '황촉진제', '황화물', '황화인', '황화철광', '횡단면', '희가스', '희토', '히단토인', '히드라진', '히드록실아민']  # 2차(Kiwi 형태소분석기 강화판): 관세청 HS부호단위별품목명(2026-01-01) 전체 유니버스 HS6 1109개/HS4 256개, Kiwi 명사추출+문서빈도필터+실제뉴스 대조(keywords/build_tier2_kiwi.py, tier2_keyword_stats_kiwi.csv 참고, 사람 재검토 전 초안)
MATERIALS = MATERIALS + [w for w in MATERIALS_TIER2 if w.lower() not in {m.lower() for m in MATERIALS}]
def http(url, timeout=30, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")

ACTION_ROOT = ["ban","restrict","control","quota","licen","embargo","sanction","suspend","halt","curb",
    "duty","duties","tariff","anti-dump","antidump","countervail","safeguard","closure","shutdown","strike",
    "blockade","outage","explosion","crackdown","revoke","decree","surge","rally","hike","soar","jump","spike",
    "plunge","rebound","tightness","shortage",
    "금지","제한","통제","허가","쿼터","제재","중단","폐쇄","단속","취소","급등","급락","인상","인하","반등","부족","품귀","관세","차단"]
TRADE_WORD = ["export","trade","import","수출","교역","수입"]
def tag(title, text=""):
    """1단계 참조판정(재현율 우선): (a) 기존 정확 문구 목록 DISRUPT, (b) 행위어근+무역어 공존(어순에 안 흔들림) 중
    하나라도 걸리면 차질 신호로 보고, 여기에 품목 용어가 같이 있으면 relevant=1. (a)만으로는 held-out 검증에서
    새 사건의 절반을 놓쳤고((b) 추가 전 47%), (b)를 더한 뒤 87%로 개선됨(학습 50건 재현율 86%는 그대로).
    다만 이 수치도 이번 held-out 15건 기준일 뿐이며, 실제 실시간 수집분으로 다시 확인해야 한다."""
    t = f"{title} {text}".lower()
    d = sorted({k for k in DISRUPT if k in t})
    co = any(a in t for a in ACTION_ROOT) and any(w in t for w in TRADE_WORD)
    m = sorted({k.strip() for k in MATERIALS if k in t})
    return d, m, int(bool((d or co) and m))

def classify(title, text=""):
    """2026-09-25 추가: Polight 발표사례(증권 담보명↔약관 조항명 표기 불일치를, 실패해도 서비스가
    안 멈추는 4단 폴백으로 연결)에서 착안한 3단계 상태 분류. tag()의 이분법(relevant 0/1)은 품목 사전에
    없는 새 용어가 나오면 조용히 버려짐 — 그 대신 '사건성 문구는 있는데 품목어가 안 걸리는' 경우를
    CANDIDATE로 남겨서 사람이 보고 사전에 새 키워드를 추가할 수 있게 한다(4차 tier 확장의 발견 경로를
    공식 파이프라인에 넣은 것).
      RELEVANT  : (d 또는 co) AND m  — 기존 relevant=1과 동일
      CANDIDATE : (d 또는 co) AND NOT m — 사건 신호는 있는데 품목어 매칭 실패. 사람이 확인해서
                  (a) 진짜 관련 있으면 빠진 품목어를 tier4_changelog.csv에 근거와 함께 추가
                  (b) 무관하면 버림
      NONE      : 그 외 (사건 신호 자체가 없음)
    12개 실제 사건(recall_check_tagged.csv, 1281건) 검증 결과: RELEVANT 459건, CANDIDATE 113건, 이벤트
    수준 재현율은 10/12(83%)로 tag()와 동일 — 이번 held-out에 남은 2개 미탐(인도_철강_수입관세_인상,
    짐바브웨_리튬원광_수출금지)은 품목어 사전 문제가 아니라 수집된 기사 자체가 1건뿐이고 그마저 사건과
    무관/사건언어 자체가 없는 "검색 커버리지" 문제라 이 폴백으로는 못 건짐 — 그건 키워드가 아니라 검색
    쿼리·소스 다양화로 풀어야 할 별개 과제. CANDIDATE는 review 물량을 459->572건(+25%)으로 늘리므로,
    사람 확인 여력에 맞춰 --export-candidates 로 상태 확인 후 채택 여부를 판단할 것."""
    t = f"{title} {text}".lower()
    d = sorted({k for k in DISRUPT if k in t})
    co = any(a in t for a in ACTION_ROOT) and any(w in t for w in TRADE_WORD)
    m = sorted({k.strip() for k in MATERIALS if k in t})
    if (d or co) and m:
        status = "RELEVANT"
    elif d or co:
        status = "CANDIDATE"
    else:
        status = "NONE"
    return d, m, status

# ---------- AI 2차 검증(요약·팩트체크) ----------
# 2026-09-27 결정 — 두 방향 모두 커버:
#   (1) CANDIDATE(사건언어는 있는데 품목어 미매칭) — 관련기사를 추가 검색해 corroborating 증거를 모으고
#       AI가 진짜 관련 사건인지 판단·요약. 결합 재현율을 올리는 목적(품목어 사전 확장 후보 발굴).
#   (2) RELEVANT 확정 이벤트 중 표본 — AI가 매칭된 disrupt/materials 키워드가 원문 맥락에서 실제로 그
#       의미로 쓰였는지 되물어 팩트체크. '은'/'럼프' 사전 오류를 지운 뒤에도 남을 수 있는 유사 잔여
#       오탐(정밀도 문제)을 잡는 목적 — 애초에 CANDIDATE만 보던 계획을 RELEVANT 표본까지 넓힌 것.
#   두 경로 모두 결과를 events_raw에 저장하고, 최종 승인/반려는 여전히 사람(admin UI)이 한다 — AI는
#   판단을 대신하는 게 아니라 사람이 볼 요약을 만들어주는 보조 역할.
# 2026-09-27: OpenAI로 확정(요약 품질·비용 비교 후 — Claude 대비 저렴). OPENAI_API_KEY 필요
# (pip install openai). 키/패키지가 없으면 조용히 스킵해 파이프라인 자체는 안 죽는다.
AI_MODEL = os.environ.get("SUPPLY_PIVOT_AI_MODEL", "gpt-4o-mini")

def _ai_client():
    try:
        import openai
    except ImportError:
        print("  [AI] openai 패키지 없음 — `pip install openai` 후 다시 실행하세요. 이번 단계는 건너뜁니다.")
        return None
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        print("  [AI] OPENAI_API_KEY 없음 — 이번 단계는 건너뜁니다.")
        return None
    return openai.OpenAI(api_key=key)

def _ai_ask(client, system, user, max_tokens=500):
    try:
        resp = client.chat.completions.create(
            model=AI_MODEL, max_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        return f"[AI 호출 오류: {str(e)[:200]}]"

def _google_search_free(query, days=5):
    """CANDIDATE 사건 제목으로 직접 자유검색(구글뉴스 RSS) — src_google()과 달리 고정된
    NAVER_EVENTS x NAVER_MATERIALS 조합이 아니라 사건별 맞춤 쿼리를 한 번 던진다. 2차 검증 전용,
    기본 수집 루프(main)에는 안 쓴다."""
    import html as _html
    end = datetime.now(timezone.utc); start = end - timedelta(days=days)
    full_q = f"{query} after:{start:%Y-%m-%d} before:{end:%Y-%m-%d}"
    url = f"{GOOGLE_NEWS_URL}?" + urllib.parse.urlencode({"q": full_q, "hl": "ko", "gl": "KR", "ceid": "KR:ko"})
    clean = lambda x: re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", "", x or ""))).strip()
    out = []
    try:
        root = ET.fromstring(http(url, headers={"Accept": "application/rss+xml, */*"}))
    except Exception as e:
        print(f"  [AI-검증] 관련기사 재검색 실패: {str(e)[:80]}"); return out
    for it in root.iter("item"):
        title = clean((it.findtext("title") or "")); link = it.findtext("link") or ""
        source = (it.find("source").text if it.find("source") is not None else "GOOGLE")
        pub = it.findtext("pubDate") or ""
        out.append(dict(source=source, title=title, url=link, published=pub))
    return out[:8]

def ai_verify_candidate(con, ev):
    """CANDIDATE 이벤트 1건 처리: 제목으로 관련기사 재검색 → AI에게 (a) 진짜 공급망 차질 사건인지,
    (b) 그렇다면 사전에 빠진 품목어 후보는 뭔지 판단·요약시킨다. events_raw.ai_summary/ai_sources/
    ai_verdict/ai_checked_at에 저장. 반환값 True면 실제로 AI를 호출했다는 뜻(키 없으면 False)."""
    client = _ai_client()
    if client is None:
        return False
    corroborating = [h for h in _google_search_free(ev["title"]) if h.get("url") != ev["url"]][:5]
    evidence = "\n".join(f"- {h['title']} ({h['source']}, {h['published']})" for h in corroborating) or "(추가 기사 없음)"
    user = (f"제목: {ev['title']}\n스니펫: {ev.get('snippet', '')}\n걸린 사건어(disrupt): {ev['disrupt']}\n\n"
            f"추가로 찾은 관련 기사:\n{evidence}\n\n"
            "이 사건이 실제 '공급망 원자재·부품 차질' 사건인지 판단해라. 관련 있다면 이 품목어 사전에 빠진 것으로 "
            "보이는 한국어 명사(짧게, 있으면)를 제안하고 2~3문장으로 요약해라. 무관하면 이유를 1문장으로 써라. "
            "마지막 줄에 반드시 'VERDICT: RELEVANT_CONFIRMED' 또는 'VERDICT: IRRELEVANT' 또는 'VERDICT: UNCERTAIN' "
            "중 하나만 적어라.")
    summary = _ai_ask(client, "너는 한국 중소기업 공급망 리스크 조기경보 파이프라인의 사람 검토를 보조하는 애널리스트다. "
                               "과장하지 말고 근거 기반으로만 판단해라.", user)
    verdict = next((v for v in ("RELEVANT_CONFIRMED", "IRRELEVANT", "UNCERTAIN") if f"VERDICT: {v}" in summary), "UNCERTAIN")
    con.execute("UPDATE events_raw SET ai_status='DONE', ai_summary=?, ai_sources=?, ai_verdict=?, ai_checked_at=? WHERE url=?",
                (summary, ";".join(h["url"] for h in corroborating), verdict, datetime.now().strftime("%Y-%m-%d %H:%M"), ev["url"]))
    return True

def ai_verify_relevant_sample(con, ev):
    """RELEVANT 확정 이벤트 1건 표본 검사: 이미 걸린 disrupt/materials 키워드가 원문 맥락에서 실제로
    그 의미로 쓰였는지 AI에게 되묻는다 — '은'(조사) '럼프'(트럼프 일부) 같은 사전 노이즈로 인한 잔여
    오탐(2026-09-27 실측: 근접조건으로도 못 걸러진 11/167건 등)을 표본검사로 잡는 목적. 전량이 아니라
    --ai-verify-relevant-n 만큼만 매 실행마다 표본으로 돈다(비용 통제)."""
    client = _ai_client()
    if client is None:
        return False
    user = (f"제목: {ev['title']}\n스니펫: {ev.get('snippet', '')}\n"
            f"매칭 근거 — 사건어(disrupt): {ev['disrupt']} / 품목어(materials): {ev['materials']}\n\n"
            "위 사건어·품목어가 이 기사 맥락에서 실제로 그 의미로 쓰였는지 확인해라(예: 품목어가 조사·다른 "
            "단어의 일부로 우연히 매칭됐거나, 기사 주제와 무관하게 등장했다면 오탐이다). 1~2문장으로 판단 근거를 "
            "쓰고, 마지막 줄에 'VERDICT: RELEVANT_CONFIRMED' 또는 'VERDICT: FALSE_POSITIVE' 중 하나만 적어라.")
    summary = _ai_ask(client, "너는 한국 중소기업 공급망 리스크 조기경보 파이프라인의 정밀도 검증을 보조하는 애널리스트다.",
                       user, max_tokens=250)
    verdict = "FALSE_POSITIVE" if "VERDICT: FALSE_POSITIVE" in summary else "RELEVANT_CONFIRMED"
    con.execute("UPDATE events_raw SET ai_status='DONE', ai_summary=?, ai_verdict=?, ai_checked_at=? WHERE url=?",
                (summary, verdict, datetime.now().strftime("%Y-%m-%d %H:%M"), ev["url"]))
    return True

# ---------- 소스별 수집: 각 함수는 dict 리스트를 반환 ----------
def src_fr(days, **_):
    out = []; start = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    for ag in ("industry-and-security-bureau", "international-trade-administration", "international-trade-commission"):
        url = ("https://www.federalregister.gov/api/v1/documents.json?per_page=100&order=newest"
               f"&conditions[agencies][]={ag}&conditions[publication_date][gte]={start}"
               "&fields[]=title&fields[]=publication_date&fields[]=html_url&fields[]=abstract&fields[]=document_number")
        try:
            j = json.loads(http(url))
        except Exception as e:
            print(f"  FR {ag} 실패: {e}"); continue
        for d in j.get("results", []):
            out.append(dict(source=f"FR:{ag}", published=d.get("publication_date"), title=d.get("title",""), url=d.get("html_url"), snippet=(d.get("abstract") or "")[:400]))
        time.sleep(1.0)
    return out

SEC_SIC = {"10","12","13","14","26","28","29","30","32","33","34","35","36","37"}   # 광업·화학·석유·고무플라스틱·유리·금속·기계·전자·수송장비
def src_sec(days, **_):
    out = []; end = datetime.now(timezone.utc); start = end - timedelta(days=days)
    for forms in ("8-K", "6-K"):
        q = urllib.parse.quote('"force majeure"')
        url = (f"https://efts.sec.gov/LATEST/search-index?q={q}&forms={forms}&dateRange=custom"
               f"&startdt={start:%Y-%m-%d}&enddt={end:%Y-%m-%d}")
        try:
            j = json.loads(http(url))
        except Exception as e:
            print(f"  SEC {forms} 실패: {e}"); continue
        for h in j.get("hits", {}).get("hits", []):
            s = h.get("_source", {}); _id = h.get("_id", ""); adsh, _, fn = _id.partition(":")
            cik = (s.get("ciks") or [""])[0].lstrip("0")
            link = f"https://www.sec.gov/Archives/edgar/data/{cik}/{adsh.replace('-','')}/{fn}" if cik and fn else f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
            name = (s.get("display_names") or ["?"])[0]
            sics = ",".join(str(x) for x in (s.get("sics") or []))
            out.append(dict(source=f"SEC:{forms}", published=s.get("file_date"), title=f"{name} — force majeure ({s.get('form')})", url=link, snippet=f"sic:{sics}", force_rel=any(str(x)[:2] in SEC_SIC for x in (s.get("sics") or []))))
        time.sleep(1.0)
    return out

GDELT_Q = ['"export ban"', '"export controls" (gallium OR germanium OR graphite OR antimony OR tungsten OR "rare earth" OR cobalt OR nickel)',
           '"force majeure" (plant OR mine OR refinery OR smelter)', '"anti-dumping" (steel OR chemical OR fertilizer)', '(shortage OR "supply disruption") (fertilizer OR urea OR sulfur OR copper OR aluminium)']
def src_gdelt(days, gdelt_timespan=None, **_):
    out = []; span = gdelt_timespan or f"{max(days,1)}d"
    for q in GDELT_Q:
        url = ("https://api.gdeltproject.org/api/v2/doc/doc?query=" + urllib.parse.quote(q) +
               f"&mode=artlist&maxrecords=50&format=json&sort=datedesc&timespan={span}")
        j = None
        for attempt in (1, 2):
            try:
                j = json.loads(http(url, timeout=45)); break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 1:
                    print("  GDELT 429 — 40초 대기 후 1회 재시도"); time.sleep(40); continue
                print(f"  GDELT '{q[:30]}' 실패: HTTP {e.code}"); break
            except Exception as e:
                print(f"  GDELT '{q[:30]}' 실패: {str(e)[:80]}"); break
        if j is None:
            time.sleep(10); continue
        for a in j.get("articles", []):
            sd = a.get("seendate", "")
            pub = f"{sd[:4]}-{sd[4:6]}-{sd[6:8]}" if len(sd) >= 8 else ""
            out.append(dict(source="GDELT", published=pub, title=a.get("title",""), url=a.get("url"), snippet=f"{a.get('domain','')} {a.get('language','')} {a.get('sourcecountry','')}"))
        time.sleep(10)         # GDELT: 5초에 1건 제한(여유 있게 10초)
    return out

RSS = {"gcaptain": "https://gcaptain.com/feed/", "hellenic": "https://www.hellenicshippingnews.com/feed/",
       "splash247": "https://splash247.com/feed/", "scdive": "https://www.supplychaindive.com/feeds/news/"}
def parse_rss(xml_text, name):
    out = []; root = ET.fromstring(xml_text)
    for it in root.iter("item"):
        g = lambda t: (it.findtext(t) or "").strip()
        desc = re.sub(r"<[^>]+>", " ", g("description"))[:400]
        pub = g("pubDate")
        try: pub = datetime.strptime(pub[:25].strip(), "%a, %d %b %Y %H:%M:%S").strftime("%Y-%m-%d")
        except Exception: pass
        out.append(dict(source=f"RSS:{name}", published=pub, title=g("title"), url=g("link"), snippet=desc))
    return out
def src_rss(days, **_):
    out = []
    for n, u in RSS.items():
        try: out += parse_rss(http(u), n)
        except Exception as e: print(f"  RSS {n} 실패: {str(e)[:80]}")
        time.sleep(1.0)
    return out

def src_gdacs(days, **_):
    out = []
    try: root = ET.fromstring(http("https://www.gdacs.org/xml/rss.xml"))
    except Exception as e:
        print(f"  GDACS 실패: {e}"); return out
    for it in root.iter("item"):
        lv = ""; 
        for ch in it:
            if ch.tag.lower().endswith("alertlevel"): lv = (ch.text or "").strip()
        if lv.lower() not in ("orange", "red"): continue
        out.append(dict(source="GDACS", published=(it.findtext("pubDate") or "")[:16], title=f"[{lv}] " + (it.findtext("title") or ""), url=it.findtext("link"), snippet=(it.findtext("description") or "")[:300]))
    return out


KOTRA_BASE = "https://apis.data.go.kr/B410001/shortBreakingNews"
KOTRA_CANDS = ["", "/shortBreakingNews", "/getShortBreakingNews", "/shortBreakingNewsList", "/shortBreakingNewsInfo", "/getShortBreakingNewsList"]
_kotra_cache = {}
def _find_items(j):
    if isinstance(j, dict):
        for k in ("item", "items", "data", "list", "result"):
            if k in j:
                r = _find_items(j[k])
                if r: return r
        for v in j.values():
            r = _find_items(v)
            if r: return r
    if isinstance(j, list) and j and isinstance(j[0], dict): return j
    return []
def src_kotra(days, **_):
    import html as _html
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("  KOTRA: 환경변수 DATA_GO_KR_KEY 없음 — 건너뜀"); return []
    k = urllib.parse.quote(key, safe="")
    def call(op, typ, page): return json.loads(http(f"{KOTRA_BASE}{op}?serviceKey={k}&pageNo={page}&numOfRows=100&{typ}"))
    if "combo" not in _kotra_cache:
        for op in KOTRA_CANDS:
            for typ in ("type=json", "_type=json", "resultType=json"):
                try:
                    if _find_items(call(op, typ, 1)): _kotra_cache["combo"] = (op, typ); break
                except Exception: pass
                time.sleep(0.4)
            if "combo" in _kotra_cache: break
        if "combo" not in _kotra_cache:
            print("  KOTRA: 동작하는 경로를 못 찾음(kotra_short_probe.py 로 확인)"); return []
        print("  KOTRA 경로:", _kotra_cache["combo"])
    op, typ = _kotra_cache["combo"]; out = []; cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    for p in range(1, 6):
        try: its = _find_items(call(op, typ, p))
        except Exception as e:
            print(f"  KOTRA p{p} 실패: {str(e)[:80]}"); break
        if not its: break
        ds = sorted(str(r.get("othbcDt", ""))[:10] for r in its)
        print(f"  KOTRA p{p}: {len(its)}건, 날짜 {ds[0]}~{ds[-1]}, 기준일(cutoff) {cutoff}")
        old = 0
        for r in its:
            pub = str(r.get("othbcDt", ""))[:10]
            if pub and pub < cutoff: old += 1; continue
            body = _html.unescape(re.sub(r"<[^>]+>", " ", str(r.get("nttCn", ""))))
            body = re.sub(r"\s+", " ", body).strip()[:600]
            out.append(dict(source="KOTRA단신", published=pub, title=_html.unescape(str(r.get("nttSj", ""))), url=r.get("kotraNewsUrl"),
                            snippet=f"{r.get('nat','')}/{r.get('kbc','')} {body}"))
        if old == len(its): break            # 이 페이지가 전부 기간 밖 → 종료
        time.sleep(0.7)
    return out

NAVER_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
NAVER_EVENTS = ["수출통제", "수출 금지", "수출 제한", "불가항력", "공급 차질", "생산 중단", "금수 제재", "봉쇄"]
NAVER_MATERIALS = ["희토류", "갈륨 게르마늄", "흑연", "알루미늄", "니켈 코발트", "리튬", "텅스텐 몰리브덴", "요소 비료", "황 유황", "메탄올", "나프타", "철강 강판", "헬륨 네온", "반도체 소재", "광물"]
NAVER_BROAD = ["호르무즈", "중국 수출통제 품목", "원자재 공급 차질", "공급망 안전 규정"]   # 품목 없이 보는 광역 쿼리

def src_naver(days, **_):
    """네이버 뉴스 검색(NAVER API HUB). 쿼리당 최신순 1페이지(100건). 키는 환경변수 NAVER_ID / NAVER_SECRET.
    저장은 제목·링크·발행시각·발췌(200자)만. 검색어별 total(누적 총건수)은 naver_total 테이블에 일자별로 기록."""
    import html as _html, email.utils
    kid, sec = os.environ.get("NAVER_ID"), os.environ.get("NAVER_SECRET")
    if not (kid and sec):
        print("  NAVER: 환경변수 NAVER_ID / NAVER_SECRET 없음 — 건너뜀"); return []
    hdr = {"X-NCP-APIGW-API-KEY-ID": kid, "X-NCP-APIGW-API-KEY": sec}
    qs = [f"{e} {m}" for e in NAVER_EVENTS for m in NAVER_MATERIALS] + NAVER_BROAD
    cutoff = datetime.now(timezone.utc) - timedelta(days=days); out = []; totals = []; fails = 0
    for q in qs:
        url = f"{NAVER_URL}?query={urllib.parse.quote(q)}&display=100&start=1&sort=date&format=json"
        try:
            try: js = json.loads(http(url, headers=hdr))
            except urllib.error.HTTPError as e:
                if e.code == 429: time.sleep(5); js = json.loads(http(url, headers=hdr))
                else: raise
        except Exception as e:
            fails += 1; print(f"  NAVER '{q}' 실패: {str(e)[:60]}")
            if fails >= 5: print("  NAVER: 연속 실패 5회 — 중단(키/한도 확인)"); break
            continue
        totals.append((datetime.now().strftime("%Y-%m-%d"), q, js.get("total")))
        for r in js.get("items", []):
            try: dt = email.utils.parsedate_to_datetime(r.get("pubDate", ""))
            except Exception: continue
            if dt.astimezone(timezone.utc) < cutoff: continue
            clean = lambda x: re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", "", x or ""))).strip()
            out.append(dict(source="NAVER", published=dt.strftime("%Y-%m-%d %H:%M"), title=clean(r.get("title")),
                            url=r.get("originallink") or r.get("link"), snippet=f"[{q}] " + clean(r.get("description"))[:200]))
        time.sleep(0.15)
    _naver_totals.extend(totals)
    return out
_naver_totals = []

GOOGLE_NEWS_URL = "https://news.google.com/rss/search"

def src_google(days, **_):
    """구글뉴스 RSS 검색. naver와 같은 쿼리 목록(NAVER_EVENTS x NAVER_MATERIALS + NAVER_BROAD)을 그대로 재사용해서
    naver와 동일한 사건 정의로 OR 결합되게 함. after:/before: 연산자로 최근 `days`일 날짜범위를 진짜로 지정
    (naver처럼 sort=date 최신순 페이징에 의존할 필요 없음). 키 불필요.
    2026-09-25 결정: naver 단독 대비 held-out 재검증(구조적 RED 379개 유니버스 안 15개 사건, `키워드_재현율_검증_라운드별_요약.md`
    라운드12)에서 naver·google이 서로 다른 사건을 잡는 사례(기니보크사이트 가격급등=google만, 후판 반덤핑=naver만)가
    확인되어 결합(OR) 재현율이 naver 단독보다 실측으로 개선됨(47%→53%, +2건/15). 정밀도도 naver(43~58%)·google(54~58%)로
    비슷한 수준이라 **가중치를 따로 설계하지 않고 단순 OR 결합**으로 확정(라운드11에서 이미 가중치 설계 실익 없음을
    확인했고, 라운드12는 그 결론을 뒤집지 않음 — naver/google 둘 다 "메인" 소스로 동급 취급, kotra만 0.5가중치는
    다른 축의 결정이라 유지)."""
    import html as _html
    end = datetime.now(timezone.utc); start = end - timedelta(days=days)
    qs = [f"{e} {m}" for e in NAVER_EVENTS for m in NAVER_MATERIALS] + NAVER_BROAD
    clean = lambda x: re.sub(r"\s+", " ", _html.unescape(re.sub(r"<[^>]+>", "", x or ""))).strip()
    out = []; fails = 0
    for q in qs:
        full_q = f"{q} after:{start:%Y-%m-%d} before:{end:%Y-%m-%d}"
        url = f"{GOOGLE_NEWS_URL}?" + urllib.parse.urlencode({"q": full_q, "hl": "ko", "gl": "KR", "ceid": "KR:ko"})
        try:
            xml_text = http(url, headers={"Accept": "application/rss+xml, */*"})
            root = ET.fromstring(xml_text)
        except Exception as e:
            fails += 1; print(f"  GOOGLE '{q}' 실패: {str(e)[:60]}")
            if fails >= 5: print("  GOOGLE: 연속 실패 5회 — 중단"); break
            continue
        for it in root.iter("item"):
            g = lambda t: (it.findtext(t) or "").strip()
            pub = g("pubDate")
            try: dt = datetime.strptime(pub[:25].strip(), "%a, %d %b %Y %H:%M:%S")
            except Exception: continue
            out.append(dict(source="GOOGLE", published=dt.strftime("%Y-%m-%d %H:%M"), title=clean(g("title")),
                            url=g("link"), snippet=f"[{q}]"))
        time.sleep(0.5)
    return out

SRC = {"fr": src_fr, "sec": src_sec, "rss": src_rss, "gdacs": src_gdacs, "kotra": src_kotra, "naver": src_naver, "google": src_google, "gdelt": src_gdelt}
DEFAULT_SRC = ["naver", "google"]  # 2026-09-25 확정: naver 단독 대비 held-out(구조적 RED 379개 유니버스 안 15개
                          # 사건) 재검증에서 OR 결합 재현율이 47%→53%로 실측 개선됨(라운드12) — naver·google이 서로
                          # 다른 사건을 잡는 진짜 상호보완 사례를 확인했기 때문. 정밀도가 서로 비슷해(43~58%) 가중치는
                          # 따로 설계하지 않고 단순 OR(둘 중 하나라도 RELEVANT면 채택). 다만 니치 B2B 산업뉴스
                          # 계열(예: 해외 화학공장 불가항력, 항만 노사분규)은 naver·google 둘 다 0건인 경우가 많아
                          # (라운드12 미탐 7건) 이 결합으로도 못 잡음 — 이건 소스 카테고리 자체를 넓혀야 풀리는
                          # 별개 과제로 남겨둠. kotra=실시간성 안 맞아 제외, fr/sec/rss/gdacs/gdelt=검증 결과 구조적
                          # 한계 확인돼 제외 — 필요하면 --sources 로 개별 지정

def pick_dir(want):
    for d in (want, tempfile.gettempdir()):
        try:
            os.makedirs(d, exist_ok=True); t = os.path.join(d, ".w"); open(t, "w").write("ok"); os.remove(t); return d
        except OSError: print(f"저장 폴더 사용 불가: {d}")
    raise SystemExit("쓸 수 있는 폴더가 없습니다. --out-dir 로 지정하세요.")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--days", type=int, default=3); ap.add_argument("--sources", nargs="+", default=DEFAULT_SRC, choices=list(SRC), help="기본: naver+google(둘 다 검증된 소스, OR 결합). fr/sec/rss/gdacs/kotra/gdelt는 검증 결과 구조적 한계가 있어 기본에서 뺌 — 필요시 직접 지정")
    ap.add_argument("--out-dir", default=r"C:\Temp"); ap.add_argument("--gdelt-timespan", default=None, help="예: 3months (기본 --days)")
    ap.add_argument("--export", action="store_true", help="오늘 새로 들어온 relevant 후보를 CSV로 저장하고 종료")
    ap.add_argument("--export-candidates", action="store_true", help="오늘 새로 들어온 CANDIDATE(사건언어는 있는데 품목어 미매칭) 후보를 CSV로 저장하고 종료 — 새 키워드 발굴용")
    ap.add_argument("--ai-verify-candidates-n", type=int, default=0, help="ai_status가 아직 없는 CANDIDATE 이벤트 중 N건을 AI 2차 검색·요약(재현율 개선용). OPENAI_API_KEY 필요.")
    ap.add_argument("--ai-verify-relevant-n", type=int, default=0, help="ai_status가 아직 없는 RELEVANT 이벤트 중 N건을 표본으로 AI 팩트체크(정밀도 검증용, 잔여 오탐 탐지). OPENAI_API_KEY 필요.")
    a = ap.parse_args(); d = pick_dir(a.out_dir); db = os.path.join(d, "discover.db")
    con = sqlite3.connect(db)
    con.execute("""CREATE TABLE IF NOT EXISTS events_raw(source TEXT, published TEXT, title TEXT, url TEXT PRIMARY KEY, snippet TEXT,
                   disrupt TEXT, materials TEXT, relevant INTEGER, first_seen TEXT, label TEXT, status TEXT)""")
    for col in ("status TEXT", "ai_status TEXT", "ai_summary TEXT", "ai_sources TEXT", "ai_verdict TEXT", "ai_checked_at TEXT"):
        try:
            con.execute(f"ALTER TABLE events_raw ADD COLUMN {col}")  # 기존 DB 마이그레이션 — 이미 있으면 무시
        except sqlite3.OperationalError:
            pass  # 이미 있음
    if a.ai_verify_candidates_n or a.ai_verify_relevant_n:
        if a.ai_verify_candidates_n:
            rows = con.execute("SELECT * FROM events_raw WHERE status='CANDIDATE' AND ai_status IS NULL ORDER BY published DESC LIMIT ?",
                                (a.ai_verify_candidates_n,)).fetchall()
            cols = [c[0] for c in con.execute("SELECT * FROM events_raw LIMIT 0").description]
            n_done = 0
            for r in rows:
                ev = dict(zip(cols, r))
                if ai_verify_candidate(con, ev):
                    n_done += 1; con.commit()
            print(f"[AI-CANDIDATE] {n_done}/{len(rows)}건 검증 완료")
        if a.ai_verify_relevant_n:
            rows = con.execute("SELECT * FROM events_raw WHERE status='RELEVANT' AND ai_status IS NULL ORDER BY RANDOM() LIMIT ?",
                                (a.ai_verify_relevant_n,)).fetchall()
            cols = [c[0] for c in con.execute("SELECT * FROM events_raw LIMIT 0").description]
            n_done = 0
            for r in rows:
                ev = dict(zip(cols, r))
                if ai_verify_relevant_sample(con, ev):
                    n_done += 1; con.commit()
            print(f"[AI-RELEVANT표본] {n_done}/{len(rows)}건 검증 완료")
        return
    con.execute("CREATE TABLE IF NOT EXISTS runs(run_at TEXT, source TEXT, fetched INTEGER, new INTEGER, new_relevant INTEGER, err TEXT)")
    con.execute("CREATE TABLE IF NOT EXISTS naver_total(day TEXT, query TEXT, total INTEGER)")
    if a.export:
        day = datetime.now().strftime("%Y-%m-%d"); p = os.path.join(d, "discover_new.csv")
        rows = con.execute("SELECT first_seen,published,source,title,url,materials,disrupt,label FROM events_raw WHERE relevant=1 AND first_seen>=? ORDER BY published DESC", (day,)).fetchall()
        with open(p, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f); w.writerow(["first_seen","published","source","title","url","materials","disrupt","label(사람이 y/n)"]); w.writerows(rows)
        print(f"{len(rows)}건 저장: {p}"); return
    if a.export_candidates:
        day = datetime.now().strftime("%Y-%m-%d"); p = os.path.join(d, "discover_candidates.csv")
        rows = con.execute("SELECT first_seen,published,source,title,url,disrupt,label FROM events_raw WHERE status='CANDIDATE' AND first_seen>=? ORDER BY published DESC", (day,)).fetchall()
        with open(p, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f); w.writerow(["first_seen","published","source","title","url","disrupt","신규품목어_있으면_적기"]); w.writerows(rows)
        print(f"{len(rows)}건 저장(CANDIDATE — 사건언어는 있는데 품목어 미매칭, 새 키워드 후보 발굴용): {p}"); return
    print(f"[DB] {db}  | User-Agent: {UA}")
    for name in a.sources:
        print(f"[{name}] 수집 중..."); err = ""
        try: items = SRC[name](days=a.days, gdelt_timespan=a.gdelt_timespan)
        except Exception as e: items, err = [], str(e)[:200]
        n_new = n_rel = n_cand = 0; now = datetime.now().strftime("%Y-%m-%d %H:%M")
        for it in items:
            if not it.get("url"): continue
            dz, ms, status = classify(it["title"], it.get("snippet", ""))
            if it.get("force_rel"): status = "RELEVANT"
            rel = int(status == "RELEVANT")
            # 2026-09-27: ai_status 등 5개 컬럼이 ALTER TABLE로 추가돼 테이블이 16컬럼이 됐는데,
            # 예전처럼 컬럼명 없이 VALUES(...)만 쓰면 "16 columns but 11 values" 에러가 난다(실제
            # GitHub Actions에서 이렇게 실패함) — 컬럼명을 명시해서 나머지(ai_*)는 NULL 기본값으로 둔다.
            cur = con.execute(
                "INSERT OR IGNORE INTO events_raw (source, published, title, url, snippet, disrupt, materials, relevant, first_seen, label, status) "
                "VALUES(?,?,?,?,?,?,?,?,?,NULL,?)",
                (it["source"], it["published"], it["title"], it["url"], it.get("snippet",""), ";".join(dz), ";".join(ms), rel, now, status),
            )
            if cur.rowcount:
                n_new += 1; n_rel += rel; n_cand += int(status == "CANDIDATE")
        if name == "naver":
            con.executemany("INSERT INTO naver_total VALUES(?,?,?)", _naver_totals); _naver_totals.clear()
        con.execute("INSERT INTO runs VALUES(?,?,?,?,?,?)", (now, name, len(items), n_new, n_rel, err)); con.commit()
        print(f"   받음 {len(items)} | 신규 {n_new} | 신규 relevant {n_rel} | 신규 candidate(사건언어O·품목어X) {n_cand}" + (f" | 오류 {err}" if err else ""))
    tot = con.execute("SELECT COUNT(*), SUM(relevant) FROM events_raw").fetchone(); print(f"[누적] 전체 {tot[0]}건, relevant {tot[1]}건")
if __name__ == "__main__": main()
