"""
Supply-Pivot 선행지표 + MVP 선별 + End-to-End 파이프라인

1) ECOS 수입물가지수 수집 (선행지표)
2) 사각지대 256개 중 MVP 10개 선별
3) 선별된 10개에 대해 전체 파이프라인 시연

usage:
    python pipeline_demo.py --ecos-test          # ECOS 연결 테스트만
    python pipeline_demo.py --select-mvp         # MVP 10개 선별
    python pipeline_demo.py --all                # 전체
"""
from __future__ import annotations
import argparse, json, os, sys, time
from pathlib import Path
import pandas as pd
import requests

ROOT = Path(__file__).parent
DATA = ROOT / "data"

ECOS_KEY = os.environ.get("ECOS_KEY", "")  # .env.local 에서 주입. 기본값에 실제 키를 넣지 말 것.
ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch"

COMTRADE_KEY = os.environ.get("COMTRADE_KEY", "")


# ================================================================ ECOS
def ecos_search(stat_code, cycle, start, end, item1="?", item2="?"):
    all_rows = []
    for offset in range(1, 30000, 1000):  # 최대 30페이지
        url = (f"{ECOS_BASE}/{ECOS_KEY}/json/kr/{offset}/{offset+999}"
               f"/{stat_code}/{cycle}/{start}/{end}/{item1}/{item2}")
        r = requests.get(url, timeout=30); r.raise_for_status()
        js = r.json()
        if "StatisticSearch" not in js:
            break
        rows = js["StatisticSearch"]["row"]
        all_rows.extend(rows)
        total = int(js["StatisticSearch"].get("list_total_count", 0))
        if offset + 999 >= total:
            break
        time.sleep(0.2)
    return pd.DataFrame(all_rows)


def step_ecos_test():
    """ECOS 연결 테스트 + 수입물가지수 통계코드 탐색."""
    print("\n=== ECOS 연결 테스트 ===")

    # 100대 주요통계지표 (연결 확인)
    url = f"https://ecos.bok.or.kr/api/KeyStatisticList/{ECOS_KEY}/json/kr/1/5"
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        print(f"  HTTP {r.status_code} — 키를 확인하세요.")
        return False
    js = r.json()
    if "KeyStatisticList" not in js:
        print(f"  응답 이상: {js}")
        return False
    print("  연결 성공!")

    # 수입물가지수 조회 (통계코드 401Y015 = 수입물가지수/품목별)
    print("\n=== 수입물가지수 (401Y015) 테스트 ===")
    df = ecos_search("401Y015", "M", "202501", "202606", "?", "?")
    if df.empty:
        # 다른 코드 시도
        for code in ["404Y014", "401Y013", "402Y014"]:
            print(f"  {code} 시도...")
            df = ecos_search(code, "M", "202501", "202606", "?", "?")
            if not df.empty:
                print(f"  → {code} 성공!")
                break

    if df.empty:
        print("  수입물가지수 통계코드를 찾지 못했습니다.")
        print("  ECOS에서 '수입물가' 검색 후 통계코드를 확인해주세요.")
        print("  https://ecos.bok.or.kr → 통계검색 → '수입물가'")
        return False

    print(f"  행: {len(df)}")
    print(f"  컬럼: {df.columns.tolist()}")
    cols = ["STAT_NAME", "ITEM_NAME1", "ITEM_NAME2", "TIME", "DATA_VALUE"]
    show = [c for c in cols if c in df.columns]
    print(df[show].head(10).to_string(index=False))

    out = DATA / "ecos_import_price.parquet"
    df.to_parquet(out, index=False)
    print(f"\n  [saved] {out}")
    return True


# ================================================================ HS4 정식 품목명 사전 (기타 보정용)
HS4_NAMES = {
    "2841": "산화금속산염·과산화금속산염 (배터리·화학 소재)",
    "7210": "철강 평판압연제품 (도금·도포 강판)",
    "2849": "탄화물 (탄화텅스텐·탄화실리콘 등)",
    "2926": "니트릴관능화합물 (아크릴로니트릴 등)",
    "2825": "히드라진·히드록실아민과 그 무기염 (화학 소재)",
    "2836": "탄산염·과탄산염 (리튬/나트륨 탄산염 등)",
    "2905": "비순환아시클릭 알코올과 그 유도체",
    "3824": "조제 관세/화학공업 생산품",
    "7228": "기타 합금강 봉 및 형강",
    "7607": "알루미늄 박 (배터리 동박/알루미늄박)",
    "7213": "철/비합금강 선재",
    "7209": "철/비합금강 냉간압연 평판제품",
    "6802": "가공용 석재 (대리석·설화석고 등)",
}

# ================================================================ MVP 선별 함수 수정
def step_select_mvp(top_n: int = 10) -> pd.DataFrame:
    """사각지대 256개 중 MVP 10개 선별."""
    print(f"\n=== MVP {top_n}개 선별 ===")

    blind_path = DATA / "step4_blind_spots.csv"
    if not blind_path.exists():
        print("  step4_blind_spots.csv가 없습니다. screening.py를 먼저 실행하세요.")
        return pd.DataFrame()

    df = pd.read_csv(blind_path, dtype={"hs4": str})

    # [수정 포인트] 품목명이 '기타'이거나 매핑 가능한 HS4는 정식 명칭으로 보정
    def fix_item_name(row):
        hs = str(row["hs4"]).zfill(4)
        if hs in HS4_NAMES:
            return HS4_NAMES[hs]
        return row["품목명"]

    df["품목명"] = df.apply(fix_item_name, axis=1)

    # 1차: RED만
    red = df[df["위험등급"] == "RED"].copy()
    print(f"  RED 등급: {len(red)}개")

    # 2차: 수입액 상위
    red = red.sort_values("수입액합계", ascending=False)

    # 3차: 중국 의존 보너스
    red["china_flag"] = (red["1위국"] == "중국").astype(int)
    red = red.sort_values(["china_flag", "수입액합계"], ascending=[False, False])

    mvp = red.head(top_n).copy()
    mvp = mvp.drop(columns=["china_flag"])

    out = DATA / "mvp_10.csv"
    mvp.to_csv(out, index=False)

    print(f"\n  선별된 MVP {len(mvp)}개:")
    cols = ["hs4", "품목명", "HHI", "1위국", "1위국비중", "수입액합계", "위험등급"]
    view = mvp[cols].copy()
    view["HHI"] = view["HHI"].round(3)
    view["수입액합계"] = view["수입액합계"].map("{:,.0f}".format)
    print(view.to_string(index=False))
    print(f"\n  [saved] {out}")
    return mvp

# ================================================================ E2E 시연
def step_e2e_demo(mvp: pd.DataFrame):
    """MVP 품목 1개에 대해 전체 파이프라인 시연."""
    if mvp.empty:
        return

    # 첫 번째 MVP로 시연
    target = mvp.iloc[0]
    hs4 = target["hs4"]
    item_name = target["품목명"]
    risk_country = target["1위국"]
    hhi = target["HHI"]

    print(f"\n{'='*70}")
    print(f"End-to-End 시연: HS {hs4} ({item_name})")
    print(f"{'='*70}")

    # [1] 구조 진단
    print(f"\n[1단계: 구조 진단]")
    print(f"  HHI: {hhi:.3f}")
    print(f"  1위국: {risk_country} ({target['1위국비중']})")
    print(f"  수입액: ${target['수입액합계']:,.0f}")
    print(f"  → 등급: RED")

    # [2] KOTRA 뉴스 검증
    print(f"\n[2단계: KOTRA 뉴스 검증]")
    news_path = DATA / "kotra_news.parquet"
    if news_path.exists():
        news = pd.read_parquet(news_path)
        

        clean_item_name = item_name.split("(")[0].strip()  # 괄호 설명 제거
        hits = news[news["newsTitl"].str.contains(clean_item_name, na=False)]
        if len(hits) == 0 and " " in clean_item_name:
           first_word = clean_item_name.split()[0]
           hits = news[news["newsTitl"].str.contains(first_word, na=False)]
    
        print(f"  '{clean_item_name}' 관련 뉴스: {len(hits)}건")
        if len(hits):
            for _, h in hits.head(3).iterrows():
                print(f"    [{h.get('othbcDt','')}] {h.get('newsTitl','')[:60]}")

    # [3] 대체 공급국 (UN Comtrade)
    print(f"\n[3단계: 대체 공급국 (UN Comtrade)]")
    if COMTRADE_KEY:
        try:
            import comtradeapicall
            # 위험국 한글->영문 키워드 매칭 사전
            COUNTRY_MAP_EN = {
                "중국": "China",
                "러시아": "Russian",
                "일본": "Japan",
                "미국": "USA",
                "호주": "Australia",
                "베트남": "Viet Nam"
            }
            risk_country_en = COUNTRY_MAP_EN.get(risk_country, risk_country)

            # UN Comtrade API 호출 (hs4 또는 hs6 매칭)
            cmd_code = str(hs4 if 'hs4' in locals() else target.get('hs6', target.get('hs4'))).zfill(4)
            
            ct = comtradeapicall.getFinalData(
                subscription_key=COMTRADE_KEY,
                typeCode='C', freqCode='A', clCode='HS',
                period='2024', reporterCode=None,
                cmdCode=cmd_code, flowCode='X',  # X: 수출(Export) 기준
                partnerCode='0',
                partner2Code=None, customsCode='C00', motCode='0'
            )


            ref = comtradeapicall.getReference('reporter')
            ct2 = ct.merge(ref[['id','text']], left_on='reporterCode', right_on='id', how='left')
            ct2 = ct2.dropna(subset=['text'])

            # -------------------------------------------------------------
            # [신호등 체계 반영 필터링 수정]
            # 1. 기본 제외: World(전체 합계) 및 자국(Korea)
            # 2. 조건부 제외: 1위국 비중 70% 이상인 경우에만 해당 위험국(1위국) 제외
            # -------------------------------------------------------------
            exclude_keywords = ['World', 'Korea', 'Rep. of Korea']
            # 비중 데이터 전처리 (문자열 % 포함이나 소수점 등 방어적 파싱)
            raw_share = str(target['1위국비중']).replace('%', '').strip()
            risk_share = float(raw_share)
            if risk_share > 1.0:
                risk_share = risk_share / 100.0  # 0~1 사이의 비율(float)로 통일

            # 조건부 로직 적용
            if risk_share >= 0.70:
                exclude_keywords.append(risk_country_en)
                print(f"  [위기 시나리오 작동] {risk_country} 의존도 70% 이상({risk_share*100:.1f}%) -> {risk_country} 공급 차단 전제 하에 대체국 탐색")
            else:
                print(f"  [일반 대안 분석] {risk_country} 의존도 70% 미만({risk_share*100:.1f}%) -> {risk_country} 포함하여 전체 주요 공급국 탐색")

            filter_pattern = '|'.join(exclude_keywords)

            alts = ct2[~ct2['text'].str.contains(filter_pattern, case=False, na=False)]
            alts = alts.sort_values('primaryValue', ascending=False)

            print(f"  위험국({risk_country}/{risk_country_en}) 및 자국(한국) 제외 대체 공급국 상위 5:")
            for _, row in alts.head(5).iterrows():
                print(f"    {row['text']:25s}  ${row['primaryValue']:,.0f}")
        
        except Exception as e:
            print(f"  Comtrade 조회 실패: {e}")

    else:
        print("  (COMTRADE_KEY 환경변수 없음)")



    # [4] KOTRA 현지 법인
    print(f"\n[4단계: 대체국 내 한국 기업]")
    kotra_path = DATA / "kotra_overseas.parquet"
    if kotra_path.exists():
        kotra = pd.read_parquet(kotra_path)
        mfg = kotra[
            kotra["업종대분류"].str.startswith("C", na=False)
            & kotra["진출형태"].isin(["생산법인", "판매법인"])
            & (kotra["진출국가"] != risk_country)
        ]
        top_countries = mfg["진출국가"].value_counts().head(5)
        print(f"  위험국 제외 제조업 생산/판매법인 보유 국가 상위 5:")
        for country, cnt in top_countries.items():
            print(f"    {country:12s}  {cnt}개사")
    else:
        print("  (kotra_overseas.parquet 없음)")

    print(f"\n{'='*70}")
    print(f"시연 완료: {hs4} {item_name}")
    print(f"{'='*70}")


# ================================================================ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ecos-test", action="store_true", help="ECOS 연결 테스트")
    ap.add_argument("--select-mvp", action="store_true", help="MVP 10개 선별")
    ap.add_argument("--all", action="store_true", help="전체 실행")
    ap.add_argument("--top-n", type=int, default=10)
    args = ap.parse_args()

    if not any([args.ecos_test, args.select_mvp, args.all]):
        args.all = True

    DATA.mkdir(exist_ok=True)

    if args.ecos_test or args.all:
        step_ecos_test()

    mvp = pd.DataFrame()
    if args.select_mvp or args.all:
        mvp = step_select_mvp(args.top_n)

    if args.all and not mvp.empty:
        step_e2e_demo(mvp)


if __name__ == "__main__":
    main()
