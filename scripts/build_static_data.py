# -*- coding: utf-8 -*-
"""Supply-Pivot 사전 계산 파이프라인.

data/raw/ 의 원자료를 읽어 site/public/data/*.json 을 만든다.
사이트는 런타임에 API를 전혀 호출하지 않는다. 모든 수치는 여기서 확정된다.

usage:
    python scripts/build_static_data.py

설계 원칙
  - 데이터가 없는 항목에 0을 대입하지 않는다. status="unavailable" 과 사유를 남긴다.
  - 모든 산출물은 재현 가능한 규칙으로만 만든다. 임의 보정값을 넣지 않는다.
"""
from __future__ import annotations

import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).parent))
from country_coords import lookup as coord_lookup  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "site" / "public" / "data"
NESTED = RAW / "데이터셋 (primary key hscode 6자리)"

# 산점도 참조선. 사각지대 판정에는 쓰지 않는다 — 판정은 step4_blind_spots.csv 원본을 따른다.
HHI_THRESHOLD = 0.25
TOP_SHARE_THRESHOLD = 0.40
# MVP 선정 기준 — 사각지대 원본 ∩ 중국 1위 ∩ HHI≥0.5 중 수입액 상위 10
MVP_HHI_FLOOR = 0.50
MVP_COUNT = 10
# HS–KSIC 브리지 신뢰도 임계값. 미만은 업종 판정에서 제외한다.
BRIDGE_CONFIDENCE_FLOOR = 0.9

# 공표 시차 — 관측월이 끝난 뒤 며칠째에 그 달 수치를 볼 수 있는가.
# 한국은행 수입물가지수는 익월 초, 관세청 수출입통계는 익월 중순에 확인된다.
ECOS_RELEASE_LAG_DAYS = 5       # 익월 초
CUSTOMS_RELEASE_LAG_DAYS = 15   # 익월 중순

log_lines: list[str] = []


def log(msg: str) -> None:
    print(msg)
    log_lines.append(msg)


def read_csv_fallback(path: Path) -> pd.DataFrame:
    """utf-8-sig → utf-8 → cp949 순으로 폴백해 읽는다.

    utf-8-sig 를 먼저 시도한다 — BOM 유무와 무관하게 안전하게 디코딩되며(BOM 없는
    파일도 동일하게 읽힌다), 반대로 utf-8을 먼저 쓰면 BOM이 첫 컬럼명 앞에
    "﻿"로 눌어붙어 컬럼을 못 찾는 문제가 생긴다.
    """
    last = None
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            df = pd.read_csv(path, encoding=enc)
            log(f"  read {path.name} (encoding={enc}, rows={len(df)})")
            return df
        except (UnicodeDecodeError, UnicodeError) as exc:
            last = exc
    raise RuntimeError(f"{path} 인코딩 판별 실패: {last}")


def clean_text(s: object) -> str:
    """KOTRA 뉴스 제목의 HTML 엔티티와 잉여 공백을 정리한다."""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return re.sub(r"\s+", " ", html.unescape(str(s))).strip()


def write_json(name: str, payload: object) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, allow_nan=False),
        encoding="utf-8",
    )
    log(f"  → {name} ({path.stat().st_size / 1024:.1f} KB)")


def num(x) -> float | None:
    """NaN/Inf 를 None 으로 바꿔 JSON 에 0이 섞이지 않게 한다."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    if pd.isna(f) or f in (float("inf"), float("-inf")):
        return None
    return round(f, 6)


# ─────────────────────────────────────────────────────────── 원자료 로딩
def load_sources() -> dict:
    log("[1] 원자료 로딩")
    src = {}

    src["hhi_all"] = pq.read_table(RAW / "step3_hhi_all.parquet").to_pandas()
    log(f"  step3_hhi_all: {len(src['hhi_all'])} HS4")

    # 루트본(16,128행 / HS4 10개)이 중첩본(8,975행 / HS4 6개)의 상위집합이라 루트본을 쓴다.
    src["customs"] = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    log(f"  customs_item_country: {len(src['customs'])}행, "
        f"{src['customs'].ym.nunique()}개월, HS4 {src['customs'].hs4.nunique()}개")

    src["ecos"] = pq.read_table(RAW / "ecos_import_price.parquet").to_pandas()
    log(f"  ecos_import_price: {len(src['ecos'])}행, "
        f"{src['ecos'].TIME.min()}~{src['ecos'].TIME.max()} ({src['ecos'].TIME.nunique()}개월)")

    src["news"] = pq.read_table(RAW / "kotra_news.parquet").to_pandas()
    log(f"  kotra_news: {len(src['news'])}건 (공급망 매칭 {int(src['news']['공급망_관련'].sum())}건)")

    # 중첩폴더의 kotra_overseas.parquet 은 _src_version=MOCK 인 더미(3,000행)라 쓰지 않는다.
    src["overseas"] = pq.read_table(RAW / "kotra_overseas_root.parquet").to_pandas()
    log(f"  kotra_overseas: {len(src['overseas'])}사, {src['overseas']['진출국가'].nunique()}개국")

    src["risk_monthly"] = pq.read_table(
        NESTED / "관세청_(품목별 국가별) 수출입실적 HHI, 물가변동률 계산" / "risk_hs6_monthly.parquet"
    ).to_pandas()
    src["crosswalk"] = pq.read_table(RAW / "crosswalk_hs_temper.parquet").to_pandas()
    # 사각지대의 단일 출처. 임계값 역산으로 만들지 않는다.
    src["blind_spots"] = read_csv_fallback(RAW / "step4_blind_spots.csv")
    log(f"  step4_blind_spots: {len(src['blind_spots'])}행 (사각지대 원본)")
    src["mvp_ref"] = read_csv_fallback(RAW / "mvp_10.csv")
    src["bridge"] = read_csv_fallback(RAW / "bridge_hs_ksic.csv")
    src["strategic"] = read_csv_fallback(
        RAW / "한국산업기술기획평가원_소재부품장비 핵심전략기술 목록_20250610.csv"
    )
    # cp949 가 섞여 있는 파일. 폴백 경로가 실제로 동작하는지 여기서 확인된다.
    src["smba_net"] = read_csv_fallback(
        NESTED / "kotra 국내기업 해외법인 api" / "중소벤처기업진흥공단_해외 전략 네트워크 현황_20260713.csv"
    )
    return src


# ─────────────────────────────────────────── 사각지대 로딩 + MVP 선별
def build_blindspots(src: dict) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    log("[2] 사각지대 로딩")
    df = src["hhi_all"].copy()
    df["hs4"] = df["hs4"].astype(str).str.zfill(4)

    # 업종: bridge_hs_ksic 는 신뢰도 0.9 건만 채택(0.7 수작업 330건 제외)
    bridge = src["bridge"].copy()
    bridge["hs4"] = bridge["hs_code"].astype(str).str.zfill(4).str[:4]
    usable = bridge[bridge["confidence"] >= BRIDGE_CONFIDENCE_FLOOR]
    ksic = usable.drop_duplicates("hs4").set_index("hs4")["ksic_mid"]
    df["ksic_mid"] = df["hs4"].map(ksic)
    covered = int(df["ksic_mid"].notna().sum())
    log(f"  KSIC 업종 매핑(confidence≥{BRIDGE_CONFIDENCE_FLOOR}): {covered}/{len(df)} — 커버리지 부족")

    # 대체 업종축: 관세청 신성질 분류 (커버리지 100%)
    cw = src["crosswalk"].drop_duplicates("hs4").set_index("hs4")
    df["sector"] = df["hs4"].map(cw["신성질_중분류명"])
    df["sector_major"] = df["hs4"].map(cw["신성질_대분류명"])
    df["hs4_name"] = df["hs4"].map(cw["세번4단위품명"])
    log(f"  신성질 중분류 업종 매핑: {int(df['sector'].notna().sum())}/{len(df)}")

    # 정부 관리 품목 플래그 — 핵심전략기술 목록 분야 키워드와 HS4 품목명/업종 매칭
    fields = {re.sub(r"\(.*?\)", "", f).strip() for f in src["strategic"]["분야"].dropna().unique()}
    kw_by_field = {
        "반도체": ["반도체", "실리콘", "규소", "웨이퍼", "집적회로"],
        "이차전지": ["리튬", "코발트", "니켈", "흑연", "전지"],
        "디스플레이": ["디스플레이", "액정", "유리기판"],
        "기계금속": ["티타늄", "텅스텐", "몰리브덴", "희토류"],
        "전기전자": ["희토류", "영구자석"],
    }
    keywords = sorted({k for f in fields for k in kw_by_field.get(f, [])})
    name_blob = (df["hs4_name"].fillna("") + " " + df["품목명"].fillna(""))
    df["gov_managed"] = name_blob.apply(lambda s: any(k in s for k in keywords))
    log(f"  핵심전략기술 연계 추정(정부 관리 품목): {int(df['gov_managed'].sum())}건 "
        f"— 목록 CSV에 HS 코드가 없어 키워드 매칭으로 표기용 플래그만 부여")

    df = df.rename(columns={
        "품목명": "item_name", "수입액합계": "import_usd", "수입국수": "country_count",
        "HHI": "hhi", "1위국": "top_country", "1위국코드": "top_country_code",
        "1위국비중": "top_share",
    })

    # 사각지대는 원본 step4_blind_spots.csv 가 단일 출처다. 임계값으로 역산하지 않는다.
    bs = src["blind_spots"].copy()
    bs["hs4"] = bs["hs4"].astype(str).str.zfill(4)
    blind_ids = set(bs["hs4"])
    df["is_blindspot"] = df["hs4"].isin(blind_ids)
    df["grade"] = df["hs4"].map(bs.set_index("hs4")["위험등급"])

    # 모집단에 없는 사각지대 품목이 있으면 산점도에 빠지므로 원본 행을 그대로 덧붙인다.
    orphan_ids = blind_ids - set(df["hs4"])
    if orphan_ids:
        orphan = bs[bs["hs4"].isin(orphan_ids)].rename(columns={
            "품목명": "item_name", "수입액합계": "import_usd", "수입국수": "country_count",
            "HHI": "hhi", "1위국": "top_country", "1위국코드": "top_country_code",
            "1위국비중": "top_share", "위험등급": "grade",
        })
        orphan["sector"] = orphan["hs4"].map(cw["신성질_중분류명"])
        orphan["sector_major"] = orphan["hs4"].map(cw["신성질_대분류명"])
        orphan["hs4_name"] = orphan["hs4"].map(cw["세번4단위품명"])
        orphan["ksic_mid"] = orphan["hs4"].map(ksic)
        orphan["gov_managed"] = False
        orphan["is_blindspot"] = True
        df = pd.concat([df, orphan[df.columns]], ignore_index=True)
        log(f"  모집단 밖 사각지대 품목 {len(orphan_ids)}건을 원본에서 보충: {sorted(orphan_ids)}")

    blind = df[df["is_blindspot"]].copy()
    china = int((blind["top_country"] == "중국").sum())
    log(f"  사각지대(원본 CSV): {len(blind)}건 / 모집단 {len(df)}건, 1위국=중국 {china}건 "
        f"({china / len(blind) * 100:.1f}%)")
    log(f"  위험등급 분포: {blind['grade'].value_counts().to_dict()}")
    if len(blind) != len(bs):
        raise RuntimeError(f"검증 실패 — 원본 {len(bs)}행 중 {len(blind)}행만 반영됨")

    # 참고 검증: 원본 목록이 임계 규칙(HHI ≥ 0.25 OR 1위국비중 ≥ 0.40)과 어떻게 대응하는지 기록만 남긴다.
    rule_ids = set(df[(df["hhi"] >= HHI_THRESHOLD) | (df["top_share"] >= TOP_SHARE_THRESHOLD)]["hs4"])
    log(f"  참고: 임계 규칙 집합과의 차이 — 원본에만 {len(blind_ids - rule_ids)}건, "
        f"규칙에만 {len(rule_ids - blind_ids)}건 (판정에는 쓰지 않음)")

    # 검증: mvp_10.csv 10개가 전부 사각지대 원본에 포함되어야 한다.
    mvp_ref = set(src["mvp_ref"]["hs4"].astype(str).str.zfill(4))
    missing = mvp_ref - blind_ids
    if missing:
        raise RuntimeError(f"검증 실패 — mvp_10.csv 품목이 사각지대 원본에 누락: {sorted(missing)}")
    log(f"  검증 OK: mvp_10.csv 10개 품목이 모두 사각지대 원본에 포함")

    # MVP 10 재선별 후 mvp_10.csv 와 대조
    mvp = (blind[(blind["top_country"] == "중국") & (blind["hhi"] >= MVP_HHI_FLOOR)]
           .nlargest(MVP_COUNT, "import_usd").copy())
    if set(mvp["hs4"]) != mvp_ref:
        raise RuntimeError(f"검증 실패 — 재선별 MVP가 mvp_10.csv 와 불일치: {sorted(set(mvp['hs4']) ^ mvp_ref)}")
    log(f"  검증 OK: 재선별 MVP 10개 = mvp_10.csv (기준: 수입액 상위 + 중국 의존 우선)")

    # 화면용 품목명은 mvp_10.csv 의 정리된 명칭을 우선 사용
    label = src["mvp_ref"].assign(hs4=lambda d: d["hs4"].astype(str).str.zfill(4)) \
                          .set_index("hs4")["품목명"]
    mvp["display_name"] = mvp["hs4"].map(label)

    stats = {
        "universe": len(df),
        "blindspot_count": len(blind),
        "china_count": china,
        "china_share": round(china / len(blind), 4),
        "ksic_covered": covered,
        "gov_managed_count": int(df["gov_managed"].sum()),
        "grade_counts": {str(k): int(v) for k, v in blind["grade"].value_counts().items()},
    }
    return df, mvp, stats


# ─────────────────────────────────────────────────── ECOS 수입물가지수
# MVP 10개 HS4 → 한국은행 수입물가지수 세부 계열 매핑
ECOS_ITEM_MAP = {
    "2841": ("305122AA", "기초무기화합물"),
    "2811": ("305122AA", "기초무기화합물"),
    "2849": ("305122AA", "기초무기화합물"),
    "2926": ("305114AA", "기타기초유기화합물"),
    "7209": ("307131AA", "냉간압연강재"),
    "7210": ("307141AA", "표면처리강재"),
    "7213": ("307121AA", "철근및봉강"),
    "7228": ("307122AA", "형강"),
    "7607": ("307222AA", "알루미늄1차제품"),
    "6802": ("306242AA", "석제품"),
    # 관세청 국가별 원자료 보유 품목(비철금속)
    "7403": ("307211AA", "동제련,정련및합금제품"),
    "7601": ("307212AA", "알루미늄제련,정련및합금제품"),
    "7801": ("307213AA", "연및아연제련,정련및합금제품"),
    "7901": ("307213AA", "연및아연제련,정련및합금제품"),
    "7502": ("307215AA", "기타비철금속제련,정련및합금제품"),
    "8001": ("307215AA", "기타비철금속제련,정련및합금제품"),
    "8105": ("307215AA", "기타비철금속제련,정련및합금제품"),
    "2504": ("201223AA", "기타비금속광물"),
    "2602": ("201212AA", "기타비철금속광석"),
    "2825": ("305122AA", "기초무기화합물"),
}
ECOS_BASIS = ("W", "원화기준")


def build_import_price(src: dict) -> dict:
    log("[3] 수입물가지수 · 골든타임")
    e = src["ecos"].copy()
    e = e[e["ITEM_CODE2"] == ECOS_BASIS[0]]
    e["value"] = pd.to_numeric(e["DATA_VALUE"], errors="coerce")
    months = sorted(e["TIME"].unique())

    def series_for(code: str) -> list[dict]:
        s = e[e["ITEM_CODE1"] == code].sort_values("TIME")
        out, prev = [], None
        for r in s.itertuples():
            v = num(r.value)
            mom = num((v - prev) / prev * 100) if (v is not None and prev) else None
            out.append({"ym": r.TIME, "value": v, "mom": mom})
            prev = v
        return out

    total = series_for("*AA")

    # 관세청 수입단가지수: 42개월 원자료의 비철금속 가중평균 단가를 202501=100 으로 지수화
    c = src["customs"].copy()
    c = c[c["impDlr"] > 0]
    # impWgt 단위는 kg 이므로 1000을 곱해 USD/톤 으로 맞춘다.
    g = c.groupby("ym").apply(
        lambda d: d["impDlr"].sum() / d["impWgt"].sum() * 1000 if d["impWgt"].sum() else None,
        include_groups=False,
    )
    base = g.get("202501")
    customs_idx = [
        {"ym": ym, "value": num(v / base * 100)}
        for ym, v in g.items() if base and ym in months
    ]

    # 두 계열을 같은 기준(202501=100)으로 맞춰 관측월 축에 겹친다.
    cmap = {x["ym"]: x["value"] for x in customs_idx}
    tmap = {x["ym"]: x["value"] for x in total}
    ecos_base = tmap.get("202501")
    overlap = [m for m in months if m in cmap and cmap[m] is not None]
    lead = []
    for m in overlap:
        ev = tmap.get(m)
        lead.append({
            "ym": m,
            "ecos_value": num(ev / ecos_base * 100) if (ev and ecos_base) else None,
            "ecos_raw": ev,
            "customs_value": cmap.get(m),
        })

    items = []
    for hs4 in ECOS_ITEM_MAP:
        code, name = ECOS_ITEM_MAP[hs4]
        s = series_for(code)
        latest = s[-1] if s else None
        items.append({
            "hs4": hs4,
            "ecos_item_code": code,
            "ecos_item_name": name,
            "series": s,
            "latest_mom": latest["mom"] if latest else None,
            "latest_value": latest["value"] if latest else None,
        })

    log(f"  ECOS {ECOS_BASIS[1]} {len(months)}개월 ({months[0]}~{months[-1]}), "
        f"품목 계열 매핑 {len(items)}건")
    log(f"  관세청 수입단가지수 겹침 구간: {len(overlap)}개월, "
        f"골든타임 {CUSTOMS_RELEASE_LAG_DAYS - ECOS_RELEASE_LAG_DAYS}일")

    return {
        "basis": ECOS_BASIS[1],
        "stat_name": "한국은행 ECOS 수입물가지수(기본분류, 401Y015)",
        "cadence": "월 단위",
        "note": "일일 가격이 아니라 월 단위 수입물가지수다. 관세청 통계 공표보다 선행한다.",
        "months": months,
        "month_count": len(months),
        "range": [months[0], months[-1]],
        "total_index": total,
        "customs_unit_index": customs_idx,
        "customs_index_note": "관세청 원자료(비철금속 HS4 10개)의 수입 단가를 202501=100 으로 지수화한 값",
        "lead_lag": lead,
        "index_base": "202501=100 (두 계열 공통)",
        "release_lag": {
            "ecos_days": ECOS_RELEASE_LAG_DAYS,
            "customs_days": CUSTOMS_RELEASE_LAG_DAYS,
            "golden_time_days": CUSTOMS_RELEASE_LAG_DAYS - ECOS_RELEASE_LAG_DAYS,
            "note": "관측월이 끝난 뒤 경과 일수 기준. 익월 초 공표와 익월 중순 공표의 차이다.",
        },
        "items": items,
    }


# ────────────────────────────────────────────────────────── KOTRA 뉴스
# 팀 검증(pipeline_final.py)을 거친 키워드 사전. MVP 10개만 채웠다 —
# build_news()가 mvp.itertuples()만 순회해 이 10개 밖은 쓰이지 않는다.
HS4_KEYWORD_MAP = {
    "2811": ["규소", "silica", "silicon", "화학", "chemical"],
    "2841": ["화학", "케미칼", "chemical", "소재", "배터리", "battery", "산화"],
    "2849": ["탄화물", "carbide", "텅스텐", "tungsten", "소재"],
    "2926": ["니트릴", "nitrile", "석유화학", "petrochemical", "화학"],
    "6802": ["석재", "stone", "대리석", "marble", "건자재", "타일"],
    "7209": ["냉연", "cold rolled", "철강", "steel", "코일"],
    "7210": ["철강", "steel", "금속", "metal", "포스코", "posco", "현대제철", "강판"],
    "7213": ["선재", "wire", "제강", "철강", "steel"],
    "7228": ["합금", "alloy", "특수강", "metal", "steel", "특강"],
    "7607": ["알루미늄", "aluminum", "aluminium", "동박", "foil", "박"],
}


def build_news(src: dict, mvp: pd.DataFrame) -> dict:
    log("[4] KOTRA 해외시장뉴스")
    n = src["news"]
    s = n[n["공급망_관련"]].copy()

    rows = []
    for i, r in enumerate(s.itertuples()):
        rows.append({
            "id": f"n{i:03d}",
            "title": clean_text(r.newsTitl),
            "url": clean_text(r.kotraNewsUrl),
            "country": clean_text(r.natn),
            "region": clean_text(r.regn),
            "date": clean_text(r.othbcDt),
            "industry": clean_text(r.indstCl),
            "hs_name": clean_text(r.hsCdNm),
            "commodity": clean_text(r.cmdltNmKorn),
            "office": clean_text(r.ovrofInfo),
            "category": clean_text(r.infoCl),
            # hsCdNm 은 실제로는 콤마로 구분된 HS 코드 태그 목록이다("847950,853710,...").
            # 태그 매칭(1순위)에 쓰고, hs_name 은 그 원문을 그대로 화면 표시용으로 남긴다.
            "hs_codes_tagged": clean_text(r.hsCdNm),
        })

    matches = []
    for r in mvp.itertuples():
        hs4 = r.hs4
        kws = HS4_KEYWORD_MAP.get(hs4, [])
        hits = []

        # 1순위: hsCdNm에 이 HS4가 정확히 태깅된 기사. 가장 신뢰도가 높지만
        # 태깅된 기사 자체가 드물어(공급망 매칭 60건 중 실제로 걸리는 경우는 극소수)
        # 대부분은 2순위로 넘어간다.
        for row in rows:
            tagged = [c.strip() for c in row["hs_codes_tagged"].split(",") if c.strip()]
            if any(c.startswith(hs4) for c in tagged):
                hits.append({
                    "news_id": row["id"],
                    "keywords": ["HS 코드 태깅"],
                    "country_match": row["country"] == r.top_country,
                    "score": 100 + (1 if row["country"] == r.top_country else 0),
                })

        # 2순위(1순위가 비었을 때만): 제목·품목명(cmdltNmKorn)에 키워드가 걸리고
        # 동시에 공급망_관련이 True인 기사만 채택한다(rows는 이미 그 조건으로
        # 걸러져 있다). "배터리"·"화학" 같은 범용 단어 단독 매칭은 무관한 기사까지
        # 잡는 오탐이 많아, 대분류(indstCl) 필드는 매칭에 쓰지 않는다.
        if not hits:
            # 한 글자 키워드("박" 등)는 빼고 매칭한다 — "박람회"처럼 무관한 단어
            # 안에 우연히 포함되는 오탐이 나기 쉽다.
            usable_kws = [k for k in kws if len(k) > 1]
            for row in rows:
                blob = f"{row['title']} {row['commodity']}".lower()
                matched = [k for k in usable_kws if k.lower() in blob]
                if not matched:
                    continue
                hits.append({
                    "news_id": row["id"],
                    "keywords": matched,
                    "country_match": row["country"] == r.top_country,
                    "score": len(matched) + (1 if row["country"] == r.top_country else 0),
                })

        hits.sort(key=lambda h: -h["score"])
        matches.append({
            "hs4": hs4,
            "top_country": r.top_country,
            "matched": hits,
            "matched_count": len(hits),
            "china_matched_count": sum(1 for h in hits if h["country_match"]),
        })

    by_country = (s["natn"].map(clean_text).value_counts().to_dict())
    total_matched = sum(m["matched_count"] for m in matches)
    log(f"  공급망 매칭 뉴스 {len(rows)}건, 품목–뉴스 연결 {total_matched}건 "
        f"(중국 기사 {by_country.get('중국', 0)}건)")

    return {
        "window_days": 90,
        "total_collected": int(len(n)),
        "supply_chain_matched": len(rows),
        "date_range": [min(r["date"] for r in rows), max(r["date"] for r in rows)],
        "by_country": by_country,
        "news": rows,
        "item_matches": matches,
        "match_method": "품목별 키워드 사전 × (제목·업종·HS명·품목명) 문자열 매칭 + 1위국 일치 가점. 예측 모델이 아니다.",
    }


# ───────────────────────────────────────────────── KOTRA 해외법인 지도
def build_kotra_map(src: dict) -> dict:
    log("[5] KOTRA 해외법인 국가별 집계")
    k = src["overseas"]
    g = k.groupby("진출국가").agg(
        count=("기업명국문", "size"),
        region=("지역", lambda x: x.mode().iat[0] if len(x.mode()) else ""),
    ).reset_index().sort_values("count", ascending=False)

    countries, unmapped = [], []
    for r in g.itertuples():
        c = coord_lookup(r.진출국가)
        if c is None:
            unmapped.append(r.진출국가)
            continue
        lat, lon, iso = c
        countries.append({
            "name": r.진출국가, "iso2": iso, "lat": lat, "lon": lon,
            "count": int(r.count), "region": r.region,
        })
    if unmapped:
        log(f"  좌표 미매핑 국가 {len(unmapped)}개: {unmapped}")

    types = src["overseas"]["진출형태"].fillna("미상").value_counts().to_dict()
    log(f"  {len(countries)}개국 / {int(g['count'].sum())}사")
    return {
        "total_companies": int(len(k)),
        "country_count": int(g["진출국가"].nunique()),
        "mapped_country_count": len(countries),
        "by_region": {k2: int(v) for k2, v in k["지역"].value_counts().items()},
        "by_type": {str(k2): int(v) for k2, v in types.items()},
        "countries": countries,
        "note": "국가 단위 발굴 결과에 연결되는 지원기관·법인 네트워크다. 기업 단위 매칭이 아니다.",
    }


# ────────────────────────────────── 관세청 원자료 기반 대체 공급국 (실측)
def build_customs_alternatives(src: dict) -> dict:
    log("[6] 관세청 원자료 기반 대체 공급국 (HS4 10개)")
    c = src["customs"].copy()
    c = c[c["impDlr"] > 0]
    cw = src["crosswalk"].drop_duplicates("hs4").set_index("hs4")["세번4단위품명"]
    kotra_counts = src["overseas"]["진출국가"].value_counts().to_dict()
    risk = src["risk_monthly"].copy()

    items = []
    for hs4, d in c.groupby("hs4"):
        by_country = d.groupby("statCdCntnKor1")["impDlr"].sum().sort_values(ascending=False)
        total = by_country.sum()
        shares = (by_country / total)
        hhi = float((shares ** 2).sum())
        top = by_country.index[0]

        alts = []
        for name, amt in by_country.iloc[1:6].items():
            alts.append({
                "country": name,
                "import_usd": int(amt),
                "share": num(amt / total),
                "kotra_offices": int(kotra_counts.get(name, 0)) if name in kotra_counts else None,
            })

        # impWgt 는 kg 단위다. USD/톤 으로 환산한다.
        monthly = (d.groupby("ym")
                   .apply(lambda x: x["impDlr"].sum() / x["impWgt"].sum() * 1000 if x["impWgt"].sum() else None,
                          include_groups=False))
        series = [{"ym": ym, "unit_price": num(v)} for ym, v in monthly.items() if num(v) is not None]

        hs6_grades = risk[risk["hs6"].str.startswith(hs4)]
        latest_grade = None
        if len(hs6_grades):
            last_ym = hs6_grades["ym"].max()
            g = hs6_grades[hs6_grades["ym"] == last_ym]["등급"]
            order = {"RED": 0, "YELLOW": 1, "GREEN": 2}
            latest_grade = sorted(g.tolist(), key=lambda x: order.get(x, 9))[0] if len(g) else None

        items.append({
            "hs4": hs4,
            "name": cw.get(hs4, ""),
            "hhi": num(hhi),
            "top_country": top,
            "top_share": num(shares.iloc[0]),
            "country_count": int(len(by_country)),
            "import_usd": int(total),
            "months": int(d["ym"].nunique()),
            "series": series,
            "alternatives": alts,
            "latest_grade": latest_grade,
        })

    items.sort(key=lambda x: -x["import_usd"])
    log(f"  {len(items)}개 HS4 × 42개월 단가 시계열 + 대체 공급국 상위 5개 산출")
    return {
        "source": "관세청 수출입통계 (품목별·국가별) 원자료",
        "period": [c["ym"].min(), c["ym"].max()],
        "month_count": int(c["ym"].nunique()),
        "method": "1위국을 제외한 수입액 상위 5개국. 국가 단위 발굴이며 기업 매칭이 아니다.",
        "items": items,
    }


# ──────────────────────────────────── 대체 공급국 (e2e_results_all.csv 사전 산출)
# KOTRA_현지법인_top5 / _기업명_top5 컬럼은 국가명이 한글이고, 대체국_top10은
# 영문이라 같은 국가를 서로 다른 표기로 들고 있다. 이 표에 등장하는 한글
# 국가명만 옮겨 적었다 — 새 국가가 추가되면 이 사전도 함께 늘려야 한다.
KOTRA_KR_TO_EN = {
    "네덜란드": "Netherlands", "독일": "Germany", "말레이시아": "Malaysia",
    "멕시코": "Mexico", "미국": "USA", "베트남": "Viet Nam", "영국": "United Kingdom",
    "이탈리아": "Italy", "인도": "India", "인도네시아": "Indonesia", "일본": "Japan",
    "태국": "Thailand", "폴란드": "Poland", "호주": "Australia",
}


def _parse_kotra_offices(cell: object) -> dict[str, int]:
    """'미국(16); 인도(8)' → {"USA": 16, "India": 8} (영문 국가명 키로 정규화)."""
    out: dict[str, int] = {}
    if not isinstance(cell, str) or not cell.strip():
        return out
    for part in cell.split(";"):
        m = re.match(r"(.+?)\((\d+)\)$", part.strip())
        if not m:
            continue
        kr, count = m.group(1).strip(), int(m.group(2))
        out[KOTRA_KR_TO_EN.get(kr, kr)] = count
    return out


def _parse_kotra_companies(cell: object) -> dict[str, list[str]]:
    """'금호석유화학(말레이시아); 롯데케미칼 타이탄(말레이시아)' → {"Malaysia": [...]}."""
    out: dict[str, list[str]] = {}
    if not isinstance(cell, str) or not cell.strip():
        return out
    for part in cell.split(";"):
        m = re.match(r"(.+)\(([^()]+)\)$", part.strip())
        if not m:
            continue
        name, kr = m.group(1).strip(), m.group(2).strip()
        out.setdefault(KOTRA_KR_TO_EN.get(kr, kr), []).append(name)
    return out


def build_comtrade(mvp: pd.DataFrame) -> dict:
    log("[7] 대체 공급국 (팀 내부 사전 산출 결과)")
    path = RAW / "e2e_results_all.csv"
    if not path.exists():
        log("  e2e_results_all.csv 없음 → 이 단계를 건너뛴다. 화면에는 '산출 불가'로 표기된다.")
        return {
            "status": "unavailable",
            "reason": "e2e_results_all.csv 미확보",
            "source": None,
            "items": [],
        }

    df = read_csv_fallback(path)
    df["hs4"] = df["hs4"].astype(str).str.zfill(4)

    items = []
    for r in df.itertuples():
        countries = [c.strip() for c in str(r.대체국_top10).split(",") if c.strip()]
        offices = _parse_kotra_offices(r.KOTRA_현지법인_top5)
        companies = _parse_kotra_companies(r.KOTRA_현지법인_기업명_top5)
        items.append({
            "hs4": r.hs4,
            "status": "ok",
            "alternatives": [
                {
                    "rank": i + 1,
                    "country": c,
                    # 이 CSV에는 국가별 수출금액이 없다. 0을 넣지 않고 null로 둔다.
                    "kotra_offices": offices.get(c),
                    "kotra_companies": companies.get(c, []),
                }
                for i, c in enumerate(countries)
            ],
        })
    log(f"  {len(items)}개 품목 · e2e_results_all.csv 기반 (API 실호출 없음)")
    return {
        "status": "ok",
        "reason": None,
        "source": "e2e_results_all.csv — 팀 내부 사전 산출 결과. UN Comtrade API를 빌드·런타임 어디서도 호출하지 않는다.",
        "items": items,
    }


# ───────────────────────────────────────────────────────────── 산출물
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = load_sources()
    universe, mvp, stats = build_blindspots(src)

    price = build_import_price(src)
    news = build_news(src, mvp)
    kmap = build_kotra_map(src)
    customs_alt = build_customs_alternatives(src)
    comtrade = build_comtrade(mvp)

    # --- blindspots.json : 산점도 원본 점 (사각지대는 step4_blind_spots.csv 원본)
    points = []
    for r in universe.itertuples():
        points.append({
            "hs4": r.hs4,
            "name": (r.hs4_name or r.item_name or "")[:60],
            "detail": r.item_name,
            "sector": r.sector,
            "sector_major": r.sector_major,
            "ksic_mid": r.ksic_mid if isinstance(r.ksic_mid, str) else None,
            "hhi": num(r.hhi),
            "top_country": r.top_country,
            "top_country_code": r.top_country_code,
            "top_share": num(r.top_share),
            "import_usd": int(r.import_usd),
            "country_count": int(r.country_count),
            "is_blindspot": bool(r.is_blindspot),
            "gov_managed": bool(r.gov_managed),
            # 위험등급도 원본 CSV 값이다. 사각지대가 아닌 품목에는 등급이 없다.
            "grade": r.grade if isinstance(r.grade, str) else None,
        })
    sectors = (universe[universe["is_blindspot"]]["sector"].value_counts().to_dict())
    top_countries = (universe[universe["is_blindspot"]]["top_country"].value_counts().to_dict())

    write_json("blindspots.json", {
        "source": "step4_blind_spots.csv",
        # 임계선은 산점도의 참조선 표기용이다. 사각지대 판정에는 쓰지 않는다.
        "reference_lines": {"hhi": HHI_THRESHOLD, "top_share": TOP_SHARE_THRESHOLD,
                            "note": "참조선 — 판정 기준이 아니라 읽기 보조선"},
        "universe_count": stats["universe"],
        "blindspot_count": stats["blindspot_count"],
        "china_count": stats["china_count"],
        "china_share": stats["china_share"],
        "grade_counts": stats["grade_counts"],
        "sector_axis": "관세청 신성질 중분류",
        "sector_counts": {k: int(v) for k, v in sectors.items()},
        "top_country_counts": {k: int(v) for k, v in top_countries.items()},
        "points": points,
    })

    # --- mvp10.json
    match_by_hs = {m["hs4"]: m for m in news["item_matches"]}
    price_by_hs = {i["hs4"]: i for i in price["items"]}
    mvp_rows = []
    for r in mvp.itertuples():
        p = price_by_hs[r.hs4]
        m = match_by_hs[r.hs4]
        mom = p["latest_mom"]
        signals = {
            "price": {"triggered": mom is not None and mom >= 1.0, "value": mom,
                      "label": "수입물가지수 전월대비"},
            "structure": {"triggered": float(r.hhi) >= MVP_HHI_FLOOR and float(r.top_share) >= 0.70,
                          "value": num(r.hhi), "label": "HHI 구조 취약"},
            "news": {"triggered": m["matched_count"] > 0, "value": m["matched_count"],
                     "label": "정책·규제 동향"},
        }
        mvp_rows.append({
            "hs4": r.hs4,
            "name": r.display_name,
            "hs4_name": r.hs4_name,
            "detail": r.item_name,
            "sector": r.sector,
            "hhi": num(r.hhi),
            "top_country": r.top_country,
            "top_country_code": r.top_country_code,
            "top_share": num(r.top_share),
            "import_usd": int(r.import_usd),
            "country_count": int(r.country_count),
            "grade": r.grade,  # step4_blind_spots.csv 의 위험등급
            "ecos_item_name": p["ecos_item_name"],
            "latest_mom": mom,
            "news_matched": m["matched_count"],
            "signals": signals,
            "alert": all(s["triggered"] for s in signals.values()),
        })
    write_json("mvp10.json", {
        "selection_rule": "사각지대 원본 목록 중 1위국=중국 · HHI ≥ 0.50 인 품목의 수입액 상위 10개",
        "selection_note": "10개 모두 중국·RED인 것은 선정 기준(수입액 상위 + 중국 의존 우선)의 결과다.",
        "alert_order": ["수입물가지수 이상 감지(익월 초)", "HHI 구조 확인(관세청, 익월 중순)",
                        "KOTRA 뉴스 정책 동향(실시간)", "세 계층 임계값 초과 시 경보"],
        "items": mvp_rows,
    })

    write_json("import_price.json", price)
    write_json("news.json", news)
    write_json("kotra_map.json", kmap)
    write_json("customs_alternatives.json", customs_alt)
    write_json("comtrade_alts.json", comtrade)

    # --- notes.json : /data-notes 단일 출처
    write_json("notes.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": [
            {
                "key": "ecos",
                "title": "ECOS 수입물가지수 기간",
                "body": f"{price['range'][0]}~{price['range'][1]} 총 {price['month_count']}개월"
                        f"({ECOS_BASIS[1]}). 월 단위 지수이며 일일 가격이 아니다. "
                        f"KOMIS 일일가격은 공공 API가 없어 이 지수로 대체했다.",
                "impact": "골든타임 차트는 실측 18개월 구간으로 그린다.",
            },
            {
                "key": "bridge",
                "title": "HS–KSIC 브리지 수작업 매핑",
                "body": "bridge_hs_ksic.csv 390건 중 330건이 confidence 0.7(수작업)이고, "
                        "그 330건의 HS 코드는 740000·740001처럼 실재하지 않는 순번 코드다. "
                        f"신뢰도 {BRIDGE_CONFIDENCE_FLOOR} 이상 60건만 채택하면 HS 74류·85류만 남아 "
                        f"모집단 {stats['universe']}개 중 {stats['ksic_covered']}개만 업종 판정이 된다.",
                "impact": "산점도 업종축은 관세청 신성질 중분류(커버리지 339/339)로 대체했다. "
                          "KSIC 업종 판정은 화면에서 쓰지 않는다.",
            },
            {
                "key": "blindspot",
                "title": f"사각지대 {stats['blindspot_count']}개의 출처",
                "body": f"사각지대는 원본 목록 step4_blind_spots.csv({stats['blindspot_count']}행)를 "
                        "단일 출처로 그대로 싣는다. 임계값으로 역산하지 않는다. "
                        f"1위국=중국 {stats['china_count']}개({stats['china_share'] * 100:.1f}%), "
                        f"위험등급 " + ", ".join(f"{k} {v}건" for k, v in stats["grade_counts"].items()) + ". "
                        f"산점도의 배경 점은 step3_hhi_all.parquet의 HS4 {stats['universe']}개 모집단이며, "
                        "이 중 원본 목록에 든 품목을 사각지대로 강조한다. "
                        "원본 목록에서 중국 1위·HHI ≥ 0.50 품목의 수입액 상위 10개를 뽑으면 "
                        "mvp_10.csv 10개 품목과 정확히 일치한다(재검증 통과).",
                "impact": f"산점도의 임계선 두 개(HHI {HHI_THRESHOLD} / 1위국비중 "
                          f"{TOP_SHARE_THRESHOLD})는 읽기 보조용 참조선이며 판정 기준이 아니다. "
                          "이전에 쓰던 역산 스크리닝 로직은 제거했다.",
            },
            {
                "key": "customs_scope",
                "title": "관세청 국가별 원자료의 품목 범위",
                "body": "customs_item_country.parquet은 42개월·134개국을 담고 있으나 HS4가 "
                        "2504·2602·2825·7403·7502·7601·7801·7901·8001·8105 10개(비철금속)뿐이고, "
                        "MVP 10개 품목과 교집합이 없다.",
                "impact": "MVP 10개의 42개월 단가 시계열은 '산출 불가'로 표기하고 "
                          "매핑된 ECOS 수입물가 계열을 대신 싣는다. 42개월 실측 시계열과 "
                          "국가별 대체 공급국은 원자료가 있는 비철금속 10개 품목에서 보여준다.",
            },
            {
                "key": "news_match",
                "title": "뉴스 매칭 로직 교체 — HS 코드 태깅 우선, 키워드는 AND 조건",
                "body": "이전에는 저장소 자체 키워드 사전(NEWS_KEYWORDS)으로 제목·업종·HS품목명·상세품목명 "
                        "네 필드를 통틀어 느슨하게 매칭했다. 그 결과 '건설'·'인프라' 같은 범용 키워드가 "
                        "니켈 채굴 쿼터, 미국 항만 인프라 투자처럼 무관한 기사까지 6802(가공용 석재) 매칭으로 "
                        "잡아냈다. 팀에서 검증한 pipeline_final.py 로직으로 교체했다 — 1순위는 hsCdNm에 이 "
                        "HS4가 정확히 태깅된 기사, 2순위(1순위가 없을 때만)는 제목·품목명(cmdltNmKorn) 두 "
                        "필드에서만 키워드가 걸리고 동시에 공급망_관련이 True인 기사만 채택한다. 업종 "
                        "대분류 필드는 매칭에서 뺐고, 한 글자 키워드는 무관한 단어에 우연히 포함되는 오탐이 "
                        "잦아 매칭에서 제외했다.",
                "impact": f"품목–뉴스 연결이 87건에서 "
                          f"{sum(m['matched_count'] for m in news['item_matches'])}건으로 줄었다. "
                          f"{', '.join(m['hs4'] for m in news['item_matches'] if m['matched_count'] == 0) or '없음'}"
                          "은 이 조건에서 매칭되는 기사가 없어 news_hits=0이다 — 데이터가 없는 게 아니라 "
                          "공급망 매칭 60건 안에 해당 품목과 직결되는 기사가 실제로 없다는 뜻이다. "
                          "2811·6802는 예전의 느슨한 매칭 때문에 3계층 경보에 잘못 포함돼 있었는데, "
                          "이번 교체로 경보 목록에서 빠졌다(거짓 양성 제거).",
            },
            {
                "key": "comtrade",
                "title": "대체 공급국 — 사전 산출 결과",
                "body": f"현재 상태: {comtrade['status']}"
                        + (f" — {comtrade['source']}" if comtrade.get("source") else f" — {comtrade['reason'] or ''}")
                        + ". UN Comtrade API를 실호출하던 이전 방식은 폐기했다 — "
                          "COMTRADE_KEY가 매일 만료돼 빌드마다 키를 갱신해야 했고, "
                          "이 환경에서는 comtradeapi.un.org 접속 자체가 막혀 있어 재현이 안 됐다. "
                          "대신 e2e_results_all.csv(팀 내부에서 미리 뽑아둔 MVP 10개 품목의 대체 공급국 "
                          "top10 + KOTRA 현지법인 매칭)를 빌드 시점에 읽어 그대로 정적으로 굳힌다.",
                "impact": "국가별 수출금액은 이 CSV에 없어 표시하지 않는다(0을 대입하지 않는다). "
                          "국가 순위, KOTRA 현지법인 수·기업명만 채운다. "
                          "CSV가 없으면 MVP 상세의 이 항목은 0이 아니라 '산출 불가'로 표시된다.",
            },
            {
                "key": "pps",
                "title": "조달청 비축물자 스냅샷 미사용 사유",
                "body": "nonferrous_daily_price.csv는 날짜 컬럼이 없는 6행 스냅샷(LME 지수·종가)이다. "
                        "관측 시점을 특정할 수 없어 시계열로 쓸 수 없다.",
                "impact": "시계열·차트 어디에도 쓰지 않았다.",
            },
            {
                "key": "kotra_mock",
                "title": "중복 파일 중 더미 데이터 제외",
                "body": "kotra_overseas.parquet이 두 벌 있었고 그중 3,000행짜리는 "
                        "기업명이 '테스트기업0000', _src_version이 MOCK인 더미였다.",
                "impact": "실데이터 9,927사 버전만 사용했다.",
            },
            {
                "key": "gov_managed",
                "title": "정부 관리 품목 플래그의 한계",
                "body": "핵심전략기술 목록 CSV(200건)에는 HS 코드가 없고 기술명만 있어 "
                        f"HS4 품목명 키워드 매칭으로 {stats['gov_managed_count']}건을 추정 표기했다.",
                "impact": "산점도에서 참고 표시로만 쓰고, 사각지대 판정 자체에서는 제외하지 않았다.",
            },
        ],
    })

    write_json("meta.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "layers": [
            {"tier": "베이스", "source": "관세청 수출입통계",
             "role": "구조적 취약성 진단 (HHI, 의존도)",
             "detail": f"HS6 × 국가 {int(src['customs']['ym'].nunique())}개월"},
            {"tier": "선행①", "source": "한국은행 ECOS 수입물가지수",
             "role": "월 단위 지수, 관세청 통계 공표보다 선행",
             "detail": f"{price['range'][0]}~{price['range'][1]} {price['month_count']}개월"},
            {"tier": "선행②", "source": "KOTRA 해외시장뉴스",
             "role": "실시간 정책·규제 동향",
             "detail": f"90일 {news['total_collected']}건 중 공급망 매칭 {news['supply_chain_matched']}건"},
            {"tier": "실행", "source": "사전 산출 대체 공급국 + KOTRA 해외법인",
             "role": "대체 공급국 발굴 및 지원기관 연결",
             "detail": f"해외법인 {kmap['total_companies']:,}사 / {kmap['country_count']}개국"},
        ],
        "build_log": log_lines,
    })

    log("\n완료.")


if __name__ == "__main__":
    main()
