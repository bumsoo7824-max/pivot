# -*- coding: utf-8 -*-
"""STEP 1 — 품목 목록 + 대체 공급국 산출

산출물
    data/processed/items_overview.csv   품목 목록 (핵심 15 + MVP 10 참고용)
    data/processed/alt_countries.csv    품목별 대체 공급국 상위 5

품목 그룹
  MVP 10 (기본)      mvp_10.csv 의 HS4 10개 (화학·철강). 기본 화면에 나온다.
                     관세청 국가별 원자료가 없어 대체 공급국은 UN Comtrade 가 있어야 채워진다.
  비철금속 15 (참고)  risk_hs6.csv 의 HS6 15개. 참고용으로만 남기고 기본 화면에는 띄우지 않는다.
                     국가별 원자료가 있어 대체 공급국까지 실측으로 이어진다.

대체 공급국
  (A) UN Comtrade  MVP 10 품목. COMTRADE_KEY 로 1회 호출한다.
                   pipeline_demo.py 의 로직(1위국 비중 70% 이상이면 그 위험국까지 제외)을 옮겼다.
  (B) 관세청 원자료  비철금속 15 품목. HS6 단위로 1위국을 제외한 수입액 상위 5개국을 계산한다.

(A)가 네트워크·키 문제로 실패하면 status="unavailable" 로 남긴다.
없는 국가를 지어내거나 0을 채우지 않는다.

위험등급은 scripts/grading.py 가 단일 출처다. 새 임계치가 확정되기 전에는
원자료의 기존 등급을 그대로 쓴다.

usage:
    python scripts/step1_alt_countries.py
    python scripts/step1_alt_countries.py --skip-api   # (B)만 다시 계산
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).parent))
from grading import GRADE_SOURCE_LABEL, RECALCULATED, resolve_grade  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

RISK_MONTHLY = (RAW / "데이터셋 (primary key hscode 6자리)"
                / "관세청_(품목별 국가별) 수출입실적 HHI, 물가변동률 계산"
                / "risk_hs6_monthly.parquet")

COMTRADE_BASE = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
TOP_N = 5
RISK_SHARE_CUT = 0.70

GROUP_MAIN = "MVP 10"
GROUP_REF = "비철금속 15 (참고)"

COUNTRY_MAP_EN = {
    "중국": "China", "러시아": "Russian", "일본": "Japan", "미국": "USA",
    "호주": "Australia", "베트남": "Viet Nam", "인도": "India",
}

# 품목 키는 code / code_level 로 통일한다 (핵심 15 는 HS6, MVP 10 은 HS4).
COLUMNS = [
    "code", "code_level", "품목명", "위험국", "위험국비중", "rank", "alt_country",
    "alt_country_en", "value_usd", "share", "source", "status", "note",
]


def load_env() -> None:
    """.env 를 읽어 환경변수로 올린다. 키를 코드에 하드코딩하지 않는다."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def read_csv_fallback(path: Path) -> pd.DataFrame:
    for enc in ("utf-8", "utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"인코딩 판별 실패: {path}")


# ───────────────────────────────────────────── 품목 목록
def build_items_overview(mvp: pd.DataFrame) -> pd.DataFrame:
    """MVP 10(HS4, 기본) + 비철금속 15(HS6, 참고) 를 같은 스키마로 합친다."""
    r6 = read_csv_fallback(RAW / "risk_hs6.csv")
    r6["hs6"] = r6["hs6"].astype(str).str.zfill(6)

    m = pq.read_table(RISK_MONTHLY).to_pandas()
    m["hs6"] = m["hs6"].astype(str).str.zfill(6)
    latest = m.sort_values("ym").groupby("hs6").tail(1).set_index("hs6")

    c = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    c = c[c["impDlr"] > 0]
    c["hs6"] = c["hs6"].astype(str).str.zfill(6)

    rows = []
    for hs6 in r6["hs6"]:
        if hs6 not in latest.index:
            print(f"  경고: {hs6} 가 월별 원자료에 없음 — 건너뜀")
            continue
        s = latest.loc[hs6]
        d = c[c["hs6"] == hs6]
        by_country = d.groupby("statCdCntnKor1")["impDlr"].sum()
        rows.append({
            "code": hs6, "code_level": "hs6", "품목명": s["품목명"],
            "HHI": round(float(s["HHI"]), 4),
            "1위국": s["1위국명"], "1위국비중": round(float(s["1위국비중"]), 4),
            "단가_z": None if pd.isna(s["단가_z"]) else round(float(s["단가_z"]), 4),
            "수입액합계": float(by_country.sum()) if len(by_country) else None,
            "수입국수": int(len(by_country)) if len(by_country) else None,
            "위험등급": resolve_grade(s["등급"], s["HHI"], s["1위국비중"], s["단가_z"]),
            "등급출처": GRADE_SOURCE_LABEL,
            "기준월": str(s["ym"])[:6],
            "group": GROUP_REF,
        })

    for t in mvp.itertuples():
        rows.append({
            "code": t.hs4, "code_level": "hs4", "품목명": t.품목명,
            "HHI": t.HHI, "1위국": t.위험국, "1위국비중": t.위험국비중,
            "단가_z": None,  # MVP 10 은 월별 단가 원자료가 없어 가격 신호를 못 만든다
            "수입액합계": t.수입액합계, "수입국수": t.수입국수,
            "위험등급": resolve_grade(t.위험등급, t.HHI, t.위험국비중, None),
            "등급출처": GRADE_SOURCE_LABEL, "기준월": None, "group": GROUP_MAIN,
        })
    return pd.DataFrame(rows)


# ───────────────────────────────────────────── (A) UN Comtrade
def fetch_comtrade(code: str, key: str) -> tuple[pd.DataFrame | None, str]:
    import requests

    params = {
        "period": "2024", "cmdCode": code, "flowCode": "X", "partnerCode": "0",
        "maxRecords": 500, "breakdownMode": "classic", "includeDesc": "true",
    }
    try:
        r = requests.get(COMTRADE_BASE, params=params,
                         headers={"Ocp-Apim-Subscription-Key": key}, timeout=60)
    except Exception as exc:
        detail = str(exc)
        if "403" in detail and "Tunnel" in detail:
            return None, "네트워크 정책 차단 — comtradeapi.un.org 접근 불가 (CONNECT 403)"
        return None, f"네트워크 실패: {type(exc).__name__}"
    if r.status_code == 401:
        return None, "인증 실패 — COMTRADE_KEY 확인 필요 (HTTP 401)"
    if r.status_code != 200:
        return None, f"HTTP {r.status_code}"
    rows = r.json().get("data", [])
    if not rows:
        return None, "응답에 데이터 없음"
    return pd.DataFrame(rows), ""


def build_comtrade_rows(mvp: pd.DataFrame, key: str) -> list[dict]:
    out: list[dict] = []
    for t in mvp.itertuples():
        risk, risk_en = t.위험국, COUNTRY_MAP_EN.get(t.위험국, t.위험국)
        df, reason = fetch_comtrade(t.hs4, key)
        base = {"code": t.hs4, "code_level": "hs4", "품목명": t.품목명,
                "위험국": risk, "위험국비중": t.위험국비중, "source": "UN Comtrade"}

        if df is None:
            out.append({**{c: None for c in COLUMNS}, **base,
                        "status": "unavailable", "note": reason})
            print(f"  {t.hs4} 산출 불가 — {reason}")
            continue

        name_col = "reporterDesc" if "reporterDesc" in df.columns else "reporterISO"
        df = df.dropna(subset=[name_col, "primaryValue"])
        exclude = ["World", "Korea", "Rep. of Korea"]
        if float(t.위험국비중) >= RISK_SHARE_CUT:
            exclude.append(risk_en)
        df = df[~df[name_col].str.contains("|".join(exclude), case=False, na=False)]
        df = df.sort_values("primaryValue", ascending=False).head(TOP_N)
        total = df["primaryValue"].sum()
        for i, row in enumerate(df.itertuples(), start=1):
            out.append({**base, "rank": i, "alt_country": getattr(row, name_col),
                        "alt_country_en": getattr(row, name_col),
                        "value_usd": int(row.primaryValue),
                        "share": round(row.primaryValue / total, 6) if total else None,
                        "status": "ok", "note": "2024년 수출액 기준"})
        print(f"  {t.hs4} 수집 완료 — 상위 {len(df)}개국")
    return out


# ───────────────────────────────────────────── (B) 관세청 원자료 (HS6)
def build_customs_rows(codes: list[str]) -> list[dict]:
    """국가별 원자료가 있는 HS6 품목의 대체 공급국을 계산한다."""
    c = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    c = c[c["impDlr"] > 0]
    c["hs6"] = c["hs6"].astype(str).str.zfill(6)
    m = pq.read_table(RISK_MONTHLY).to_pandas()
    m["hs6"] = m["hs6"].astype(str).str.zfill(6)
    names = m.drop_duplicates("hs6").set_index("hs6")["품목명"]

    out: list[dict] = []
    for hs6 in codes:
        d = c[c["hs6"] == hs6]
        if d.empty:
            out.append({**{k: None for k in COLUMNS}, "code": hs6, "code_level": "hs6",
                        "품목명": names.get(hs6), "source": "관세청 국가별 원자료",
                        "status": "unavailable", "note": "국가별 원자료에 실적 없음"})
            print(f"  {hs6} 산출 불가 — 국가별 실적 없음")
            continue
        by_country = d.groupby("statCdCntnKor1")["impDlr"].sum().sort_values(ascending=False)
        total = by_country.sum()
        risk, risk_share = by_country.index[0], by_country.iloc[0] / total
        alts = by_country.iloc[1 : 1 + TOP_N]
        for i, (country, amt) in enumerate(alts.items(), start=1):
            out.append({
                "code": hs6, "code_level": "hs6", "품목명": names.get(hs6),
                "위험국": risk, "위험국비중": round(float(risk_share), 6), "rank": i,
                "alt_country": country, "alt_country_en": None,
                "value_usd": int(amt), "share": round(float(amt / total), 6),
                "source": "관세청 국가별 원자료", "status": "ok",
                "note": f"{d['ym'].min()}~{d['ym'].max()} 수입액 합계 기준, 1위국 제외",
            })
        print(f"  {hs6} 실측 산출 — 1위국 {risk}({risk_share:.1%}) 제외 상위 {len(alts)}개국")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-api", action="store_true", help="Comtrade 호출을 건너뛴다")
    args = ap.parse_args()

    load_env()
    key = os.environ.get("COMTRADE_KEY", "").strip()

    mvp = read_csv_fallback(RAW / "mvp_10.csv")
    mvp["hs4"] = mvp["hs4"].astype(str).str.zfill(4)
    mvp = mvp.rename(columns={"1위국": "위험국", "1위국비중": "위험국비중"})

    print(f"[0] 품목 목록  (등급 출처: {GRADE_SOURCE_LABEL})")
    overview = build_items_overview(mvp)
    overview.to_csv(OUT / "items_overview.csv", index=False, encoding="utf-8-sig")
    print(f"  {overview['group'].value_counts().to_dict()}")
    print(f"  등급 분포 {overview.groupby('group')['위험등급'].value_counts().to_dict()}")
    if not RECALCULATED:
        print("  ※ 새 임계치 미확정 — 원자료 기존 등급을 그대로 사용 중")

    ref_codes = overview.loc[overview["group"] == GROUP_REF, "code"].tolist()
    rows: list[dict] = []

    print("\n[A] UN Comtrade — MVP 10 (기본 그룹)")
    if args.skip_api:
        print("  --skip-api 지정 → 건너뜀")
    elif not key:
        print("  COMTRADE_KEY 없음 → 건너뜀")
        for t in mvp.itertuples():
            rows.append({**{c: None for c in COLUMNS}, "code": t.hs4,
                         "code_level": "hs4", "품목명": t.품목명, "위험국": t.위험국,
                         "위험국비중": t.위험국비중, "source": "UN Comtrade",
                         "status": "unavailable", "note": "COMTRADE_KEY 미설정"})
    else:
        rows += build_comtrade_rows(mvp, key)

    print("\n[B] 관세청 국가별 원자료 — 비철금속 15 참고 그룹 (HS6 단위)")
    rows += build_customs_rows(ref_codes)

    df = pd.DataFrame(rows, columns=COLUMNS)
    df.to_csv(OUT / "alt_countries.csv", index=False, encoding="utf-8-sig")

    ok = df[df["status"] == "ok"]
    print(f"\n→ data/processed/items_overview.csv ({len(overview)}행)")
    print(f"→ data/processed/alt_countries.csv ({len(df)}행)")
    print(f"   실측 확보 {len(ok)}행 / 산출 불가 {len(df) - len(ok)}행")
    print(f"   출처별 {df.groupby(['source', 'status']).size().to_dict()}")
    print(f"   생성 {datetime.now(timezone.utc).isoformat(timespec='seconds')}")


if __name__ == "__main__":
    sys.exit(main())
