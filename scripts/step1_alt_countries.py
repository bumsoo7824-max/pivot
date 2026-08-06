# -*- coding: utf-8 -*-
"""STEP 1 — 대체 공급국 산출 → data/processed/alt_countries.csv

두 갈래로 채운다.

  (A) UN Comtrade  : mvp_10.csv 10개 품목. COMTRADE_KEY 로 1회 호출한다.
                     pipeline_demo.py 의 대체공급국 로직(1위국 비중 70% 이상이면
                     해당 위험국까지 제외)을 그대로 옮겼다.
  (B) 관세청 원자료 : customs_item_country 에 국가별 실적이 들어 있는 HS4 10개.
                     1위국을 제외한 수입액 상위 5개국을 직접 계산한다.

(A)가 네트워크·키 문제로 실패하면 그 품목은 status="unavailable" 로 기록하고
사유를 남긴다. 없는 국가를 지어내거나 0을 채우지 않는다.

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

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

COMTRADE_BASE = "https://comtradeapi.un.org/data/v1/get/C/A/HS"
TOP_N = 5
RISK_SHARE_CUT = 0.70  # 1위국 비중이 이 이상이면 공급 차단을 전제로 그 나라를 제외한다

# 위험국 한글 → Comtrade 표기 키워드
COUNTRY_MAP_EN = {
    "중국": "China", "러시아": "Russian", "일본": "Japan", "미국": "USA",
    "호주": "Australia", "베트남": "Viet Nam", "인도": "India",
}

COLUMNS = [
    "hs4", "품목명", "위험국", "위험국비중", "rank", "alt_country",
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


# ───────────────────────────────────────────── (A) UN Comtrade
def fetch_comtrade(hs4: str, key: str) -> tuple[pd.DataFrame | None, str]:
    """HS4 한 건의 세계 수출국 순위를 가져온다. (df, 사유) 를 돌려준다."""
    import requests

    params = {
        "reporterCode": None, "period": "2024", "cmdCode": hs4,
        "flowCode": "X", "partnerCode": "0", "maxRecords": 500,
        "breakdownMode": "classic", "includeDesc": "true",
    }
    params = {k: v for k, v in params.items() if v is not None}
    try:
        r = requests.get(
            COMTRADE_BASE, params=params,
            headers={"Ocp-Apim-Subscription-Key": key}, timeout=60,
        )
    except Exception as exc:
        detail = str(exc)
        if "403" in detail and "Tunnel" in detail:
            # 이그레스 정책 차단. 키 문제가 아니라 호스트가 막힌 것이다.
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
        risk = t.위험국
        risk_en = COUNTRY_MAP_EN.get(risk, risk)
        df, reason = fetch_comtrade(t.hs4, key)

        if df is None:
            # 값이 없으면 '산출 불가'로 남긴다. 임의의 국가나 0을 넣지 않는다.
            out.append({
                "hs4": t.hs4, "품목명": t.품목명, "위험국": risk,
                "위험국비중": t.위험국비중, "rank": None, "alt_country": None,
                "alt_country_en": None, "value_usd": None, "share": None,
                "source": "UN Comtrade", "status": "unavailable", "note": reason,
            })
            print(f"  {t.hs4} 산출 불가 — {reason}")
            continue

        name_col = "reporterDesc" if "reporterDesc" in df.columns else "reporterISO"
        df = df.dropna(subset=[name_col, "primaryValue"])
        # World(합계)와 자국은 항상 제외, 1위국은 의존도 70% 이상일 때만 제외
        exclude = ["World", "Korea", "Rep. of Korea"]
        if float(t.위험국비중) >= RISK_SHARE_CUT:
            exclude.append(risk_en)
        df = df[~df[name_col].str.contains("|".join(exclude), case=False, na=False)]
        df = df.sort_values("primaryValue", ascending=False).head(TOP_N)
        total = df["primaryValue"].sum()

        for i, row in enumerate(df.itertuples(), start=1):
            out.append({
                "hs4": t.hs4, "품목명": t.품목명, "위험국": risk,
                "위험국비중": t.위험국비중, "rank": i,
                "alt_country": getattr(row, name_col),
                "alt_country_en": getattr(row, name_col),
                "value_usd": int(row.primaryValue),
                "share": round(row.primaryValue / total, 6) if total else None,
                "source": "UN Comtrade", "status": "ok", "note": "2024년 수출액 기준",
            })
        print(f"  {t.hs4} 수집 완료 — 상위 {len(df)}개국")
    return out


# ───────────────────────────────────────────── (B) 관세청 국가별 원자료
def build_items_overview(mvp: pd.DataFrame) -> pd.DataFrame:
    """MVP 10개와 관세청 실측 보유 10개를 같은 스키마로 합친 품목 목록."""
    c = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    c = c[c["impDlr"] > 0]
    names = (pq.read_table(RAW / "crosswalk_hs_temper.parquet").to_pandas()
             .drop_duplicates("hs4").set_index("hs4")["세번4단위품명"])

    rows = [{
        "hs4": t.hs4, "품목명": t.품목명, "HHI": t.HHI, "1위국": t.위험국,
        "1위국비중": t.위험국비중, "수입액합계": t.수입액합계, "수입국수": t.수입국수,
        "위험등급": t.위험등급, "group": "MVP 10",
    } for t in mvp.itertuples()]

    for hs4, d in c.groupby("hs4"):
        by_country = d.groupby("statCdCntnKor1")["impDlr"].sum().sort_values(ascending=False)
        total = by_country.sum()
        shares = by_country / total
        hhi = float((shares ** 2).sum())
        share1 = float(shares.iloc[0])
        # 등급은 MVP 와 동일한 진단 규칙으로 매긴다 (예측이 아니라 구조 진단)
        grade = ("RED" if hhi >= 0.50 and share1 >= 0.70
                 else "YELLOW" if hhi >= 0.25 or share1 >= 0.40 else "GREEN")
        rows.append({
            "hs4": hs4, "품목명": names.get(hs4, "")[:40], "HHI": round(hhi, 4),
            "1위국": by_country.index[0], "1위국비중": round(share1, 4),
            "수입액합계": float(total), "수입국수": int(len(by_country)),
            "위험등급": grade, "group": "관세청 실측 보유",
        })
    return pd.DataFrame(rows)


def build_customs_rows() -> list[dict]:
    """국가별 실적이 실제로 있는 HS4 에 대해 대체 공급국을 직접 계산한다."""
    c = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    c = c[c["impDlr"] > 0]
    names = (pq.read_table(RAW / "crosswalk_hs_temper.parquet").to_pandas()
             .drop_duplicates("hs4").set_index("hs4")["세번4단위품명"])

    out: list[dict] = []
    for hs4, d in c.groupby("hs4"):
        by_country = d.groupby("statCdCntnKor1")["impDlr"].sum().sort_values(ascending=False)
        total = by_country.sum()
        risk = by_country.index[0]
        risk_share = by_country.iloc[0] / total
        alts = by_country.iloc[1 : 1 + TOP_N]
        for i, (country, amt) in enumerate(alts.items(), start=1):
            out.append({
                "hs4": hs4, "품목명": names.get(hs4, "")[:40], "위험국": risk,
                "위험국비중": round(float(risk_share), 6), "rank": i,
                "alt_country": country, "alt_country_en": None,
                "value_usd": int(amt), "share": round(float(amt / total), 6),
                "source": "관세청 국가별 원자료", "status": "ok",
                "note": f"{d['ym'].min()}~{d['ym'].max()} 수입액 합계 기준, 1위국 제외",
            })
        print(f"  {hs4} 실측 산출 — 1위국 {risk}({risk_share:.1%}) 제외 상위 {len(alts)}개국")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-api", action="store_true", help="Comtrade 호출을 건너뛴다")
    args = ap.parse_args()

    load_env()
    key = os.environ.get("COMTRADE_KEY", "").strip()

    mvp = pd.read_csv(RAW / "mvp_10.csv")
    mvp["hs4"] = mvp["hs4"].astype(str).str.zfill(4)
    mvp = mvp.rename(columns={"1위국": "위험국", "1위국비중": "위험국비중"})

    rows: list[dict] = []

    print("[A] UN Comtrade — mvp_10.csv 10개 품목")
    if args.skip_api:
        print("  --skip-api 지정 → 건너뜀")
    elif not key:
        print("  COMTRADE_KEY 없음 → 건너뜀")
        for t in mvp.itertuples():
            rows.append({**{c: None for c in COLUMNS}, "hs4": t.hs4, "품목명": t.품목명,
                         "위험국": t.위험국, "위험국비중": t.위험국비중,
                         "source": "UN Comtrade", "status": "unavailable",
                         "note": "COMTRADE_KEY 미설정"})
    else:
        rows += build_comtrade_rows(mvp, key)

    print("\n[B] 관세청 국가별 원자료 — 실적 보유 HS4")
    rows += build_customs_rows()

    df = pd.DataFrame(rows, columns=COLUMNS)
    path = OUT / "alt_countries.csv"
    df.to_csv(path, index=False, encoding="utf-8-sig")

    overview = build_items_overview(mvp)
    overview.to_csv(OUT / "items_overview.csv", index=False, encoding="utf-8-sig")
    print(f"\n→ data/processed/items_overview.csv ({len(overview)}행) "
          f"{overview['group'].value_counts().to_dict()}")

    ok = df[df["status"] == "ok"]
    print(f"\n→ {path.relative_to(ROOT)} ({len(df)}행)")
    print(f"   실측 확보 {len(ok)}행 / 산출 불가 {len(df) - len(ok)}행")
    print(f"   출처별 {df.groupby(['source', 'status']).size().to_dict()}")
    print(f"   생성 {datetime.now(timezone.utc).isoformat(timespec='seconds')}")


if __name__ == "__main__":
    sys.exit(main())
