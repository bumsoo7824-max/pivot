# -*- coding: utf-8 -*-
"""STEP 3 — 리스크 스코어 소급 계산(백테스트)

요청은 "2021년 요소수 사태 6개월 전부터 소급"이었으나, 제공된 원자료에는
요소수 계열(HS 2921 / 3102)이 한 건도 없고 기간도 202301~202606 이라
2021년 구간 자체가 존재하지 않는다. 없는 데이터를 지어내지 않는다.

그래서 두 개를 낸다.
  (1) backtest_urea.csv     — 요소수 백테스트 시도 결과와 불가 사유를 기록한다.
                              나중에 원자료가 들어오면 그대로 다시 돌리면 된다.
  (2) backtest_leadtime.csv — 같은 스코어링 로직을 42개월 실측 데이터에 적용해
                              "RED 경보가 단가 정점보다 몇 개월 앞섰는가"를 측정한다.
                              사태 이름표가 없을 뿐, 선행성 검증 자체는 실데이터다.

usage: python scripts/step3_backtest.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

RISK_MONTHLY = (RAW / "데이터셋 (primary key hscode 6자리)"
                / "관세청_(품목별 국가별) 수출입실적 HHI, 물가변동률 계산"
                / "risk_hs6_monthly.parquet")

# 요소수 사태: 중국이 2021-10-15 요소 수출검사 의무화를 발표하며 촉발됐다.
UREA_EVENT = "2021-10"
UREA_HS = ["2921", "3102", "310210", "292111", "292119"]
LOOKBACK_MONTHS = 6

# 경보 규칙 — 프로젝트의 3계층 논리를 그대로 옮겼다.
# 구조가 취약한 상태에서 '초기' 가격 신호가 잡힐 때만 RED 로 올린다.
# 구조만 취약한 것은 상시 조건이라 그것만으로는 경보가 되지 않는다.
HHI_VULN, SHARE_VULN = 0.50, 0.70      # 구조 취약
EARLY_MOM = 3.0                         # 초기 가격 신호 (전월대비 %)
EARLY_CUM = 6.0                         # 초기 가격 신호 (3개월 누적 %)

# '사태'의 조작적 정의 — 뒤늦게 누구나 알아채는 대규모 급등 구간
SURGE_CUM = 20.0                        # 3개월 누적 %
SURGE_MOM = 10.0                        # 전월대비 %

W_HHI, W_SHARE, W_MOM, W_CUM = 0.35, 0.35, 0.20, 0.10


def risk_score(hhi: float, share: float, mom: float | None, cum: float | None) -> float:
    """0~1 참고 스코어. 결측 변동률은 0 이 아니라 가중치에서 제외한다."""
    parts, weights = [], []
    for value, weight in ((hhi, W_HHI), (share, W_SHARE)):
        if pd.notna(value):
            parts.append(min(float(value), 1.0) * weight)
            weights.append(weight)
    for value, weight in ((mom, W_MOM), (cum, W_CUM)):
        if pd.notna(value):
            parts.append(min(max(float(value), 0.0) / 30.0, 1.0) * weight)
            weights.append(weight)
    return round(sum(parts) / sum(weights), 4) if weights else float("nan")


def is_structural(hhi: float, share: float) -> bool:
    return bool(pd.notna(hhi) and pd.notna(share)
                and float(hhi) >= HHI_VULN and float(share) >= SHARE_VULN)


def is_early_price(mom: float | None, cum: float | None) -> bool:
    return bool((pd.notna(mom) and float(mom) >= EARLY_MOM)
                or (pd.notna(cum) and float(cum) >= EARLY_CUM))


def is_surge(mom: float | None, cum: float | None) -> bool:
    """사태로 인지될 만한 대규모 급등."""
    return bool((pd.notna(cum) and float(cum) >= SURGE_CUM)
                or (pd.notna(mom) and float(mom) >= SURGE_MOM))


def grade_of(structural: bool, early: bool) -> str:
    if structural and early:
        return "RED"
    if structural or early:
        return "YELLOW"
    return "GREEN"


def build_urea_record() -> pd.DataFrame:
    """요소수 백테스트 가능 여부를 코드별로 남긴다."""
    customs = pq.read_table(RAW / "customs_item_country_root.parquet").to_pandas()
    monthly = pq.read_table(RISK_MONTHLY).to_pandas()
    have_codes = set(customs["hsCd"].astype(str)) | set(monthly["hs6"].astype(str))
    period = f"{customs['ym'].min()}~{customs['ym'].max()}"
    window = f"2021-04~{UREA_EVENT} (사태 6개월 전 소급 구간)"

    rows = []
    for code in UREA_HS:
        matched = [c for c in have_codes if c.startswith(code)]
        rows.append({
            "hs_code": code,
            "event": "2021 요소수 사태",
            "event_month": UREA_EVENT,
            "lookback_window": window,
            "matched_codes_in_data": ",".join(sorted(matched)) or None,
            "status": "ok" if matched else "unavailable",
            "reason": None if matched else
                      "원자료에 해당 HS 코드 없음 + 보유 기간(2023-01~2026-06)이 "
                      "2021년 사태 구간을 포함하지 않음",
            "data_period_available": period,
            "rows_in_2021": int((customs["ym"].astype(str).str[:4] == "2021").sum()),
        })
    return pd.DataFrame(rows)


def build_leadtime() -> tuple[pd.DataFrame, pd.DataFrame]:
    """월별로 등급을 소급 산출하고, RED 경보가 '급등'보다 몇 개월 앞섰는지 잰다.

    선행 개월 = (첫 급등 시점) − (그 직전 RED 경보 시점).
    추세 상승 구간에서 마지막 달이 늘 최고가로 잡히는 문제를 피하려고
    정점이 아니라 '급등이 시작된 달'을 사태 시점으로 본다.
    """
    m = pq.read_table(RISK_MONTHLY).to_pandas().sort_values(["hs6", "ym"]).copy()
    m = m.rename(columns={"1위국명": "top_country", "1위국비중": "top_share",
                          "단가": "unit_price", "등급": "grade_source"})
    m["structural"] = [is_structural(r.HHI, r.top_share) for r in m.itertuples()]
    m["early_price"] = [is_early_price(r.전월대비, r._14) for r in m.itertuples()]
    m["surge"] = [is_surge(r.전월대비, r._14) for r in m.itertuples()]
    m["score"] = [risk_score(r.HHI, r.top_share, r.전월대비, r._14) for r in m.itertuples()]
    m["grade_calc"] = [grade_of(r.structural, r.early_price) for r in m.itertuples()]

    series = m[["hs6", "품목명", "ym", "HHI", "top_country", "top_share", "unit_price",
                "전월대비", "3개월누적", "score", "structural", "early_price", "surge",
                "grade_calc", "grade_source"]]

    summary = []
    for hs6, d in series.groupby("hs6"):
        d = d.sort_values("ym").reset_index(drop=True)
        surges = d.index[d["surge"]].tolist()
        reds = d.index[d["grade_calc"] == "RED"].tolist()

        if not surges:
            summary.append({"hs6": hs6, "품목명": d["품목명"].iat[0],
                            "status": "급등 구간 없음", "lead_months": None})
            continue
        first_surge = surges[0]
        prior = [i for i in reds if i < first_surge]
        if not prior:
            summary.append({
                "hs6": hs6, "품목명": d["품목명"].iat[0],
                "surge_ym": d["ym"].iat[first_surge],
                "status": "급등 전 RED 없음 (미탐지)", "lead_months": 0,
            })
            continue
        # 급등 직전에 연속으로 이어진 RED 의 시작점을 경보 시점으로 본다
        red_at = prior[-1]
        while red_at - 1 in prior:
            red_at -= 1
        summary.append({
            "hs6": hs6, "품목명": d["품목명"].iat[0],
            "alert_ym": d["ym"].iat[red_at],
            "alert_score": d["score"].iat[red_at],
            "surge_ym": d["ym"].iat[first_surge],
            "surge_mom": d["전월대비"].iat[first_surge],
            "surge_cum3": d["3개월누적"].iat[first_surge],
            "price_at_alert": round(float(d["unit_price"].iat[red_at]), 1),
            "price_at_surge": round(float(d["unit_price"].iat[first_surge]), 1),
            "lead_months": int(first_surge - red_at),
            "status": "ok",
        })
    return series, pd.DataFrame(summary)


def main() -> None:
    print("[1] 요소수 백테스트 가능 여부")
    urea = build_urea_record()
    urea.to_csv(OUT / "backtest_urea.csv", index=False, encoding="utf-8-sig")
    for r in urea.itertuples():
        print(f"  HS {r.hs_code}: {r.status}" + (f" — {r.reason}" if r.reason else ""))
    print(f"  → data/processed/backtest_urea.csv ({len(urea)}행, 전부 unavailable)")

    print("\n[2] 동일 로직 실데이터 검증 — RED 전환 대비 단가 정점 선행")
    series, summary = build_leadtime()
    series.to_csv(OUT / "backtest_leadtime_series.csv", index=False, encoding="utf-8-sig")
    summary.to_csv(OUT / "backtest_leadtime.csv", index=False, encoding="utf-8-sig")

    print(f"  대상 {len(summary)}개 HS6 | 상태별 {summary['status'].value_counts().to_dict()}")
    ok = summary[summary["status"] == "ok"]
    if len(ok):
        detected = summary[summary["status"].isin(["ok", "급등 전 RED 없음 (미탐지)"])]
        print(f"  급등이 발생한 {len(detected)}개 중 사전 경보 성공 {len(ok)}개 "
              f"({len(ok) / len(detected) * 100:.0f}%)")
        print(f"  선행 개월 중앙값 {ok['lead_months'].median():.1f}개월 "
              f"(최소 {int(ok['lead_months'].min())} / 최대 {int(ok['lead_months'].max())})")
        for r in ok.sort_values("lead_months", ascending=False).itertuples():
            print(f"    {r.hs6} {str(r.품목명)[:14]:14s} 경보 {r.alert_ym} → "
                  f"급등 {r.surge_ym} ({r.lead_months}개월 선행, "
                  f"급등월 전월대비 {r.surge_mom:+.1f}%)")
    print(f"  → data/processed/backtest_leadtime.csv ({len(summary)}행)")
    print(f"  → data/processed/backtest_leadtime_series.csv ({len(series)}행, 월별 스코어)")


if __name__ == "__main__":
    main()
