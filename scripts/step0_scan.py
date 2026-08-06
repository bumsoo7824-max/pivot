# -*- coding: utf-8 -*-
"""STEP 0 — data/raw/ 전수 점검.

모든 parquet / csv 를 훑어 행 수·컬럼·결측치 비율·날짜 범위를 출력한다.
추가로 두 가지를 확인한다.
  1. step4_blind_spots.csv 존재 여부 (없으면 재생성 가능성 판단)
  2. mvp_10.csv / risk_hs6.csv 의 hscode 자릿수 통일 여부

usage: python scripts/step0_scan.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# 날짜로 볼 컬럼 이름 패턴 (YYYYMM 문자열, 날짜형, 연도 등)
DATE_HINT = re.compile(r"(ym|date|dt|time|year|연도|기간|일자)", re.I)


def read_any(path: Path) -> tuple[pd.DataFrame, str]:
    """parquet 은 그대로, csv 는 utf-8 → utf-8-sig → cp949 폴백으로 읽는다."""
    if path.suffix == ".parquet":
        return pq.read_table(path).to_pandas(), "parquet"
    last = None
    for enc in ("utf-8", "utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc), f"csv/{enc}"
        except UnicodeDecodeError as exc:
            last = exc
    raise RuntimeError(f"인코딩 판별 실패: {last}")


def date_range(df: pd.DataFrame) -> str:
    """날짜성 컬럼을 찾아 범위를 문자열로 만든다. 없으면 명시적으로 알린다."""
    out = []
    for col in df.columns:
        if not DATE_HINT.search(str(col)):
            continue
        s = df[col].dropna()
        if s.empty:
            continue
        vals = s.astype(str)
        # YYYYMM / YYYY-MM-DD / YYYY 형태만 범위로 취급한다
        if vals.str.fullmatch(r"\d{6}").all() or vals.str.fullmatch(r"\d{4}").all() \
                or vals.str.match(r"\d{4}[-.]\d{2}").all():
            out.append(f"{col}: {vals.min()}~{vals.max()} ({vals.nunique()}개 값)")
    return " | ".join(out) if out else "날짜 컬럼 없음"


def scan(path: Path) -> None:
    rel = path.relative_to(RAW)
    try:
        df, kind = read_any(path)
    except Exception as exc:  # 손상 파일도 보고 대상이다
        print(f"\n■ {rel}\n  읽기 실패: {exc}")
        return

    print(f"\n■ {rel}")
    print(f"  형식 {kind} | 행 {len(df):,} | 열 {len(df.columns)}")
    print(f"  기간 {date_range(df)}")
    print(f"  컬럼 {list(df.columns)}")

    null = (df.isna().mean() * 100).round(1)
    missing = null[null > 0].sort_values(ascending=False)
    if missing.empty:
        print("  결측치 없음")
    else:
        print("  결측치 " + ", ".join(f"{c} {v}%" for c, v in missing.items()))


def check_blind_spots() -> None:
    print("\n" + "=" * 78)
    print("확인 1 — step4_blind_spots.csv (사각지대 목록)")
    path = RAW / "step4_blind_spots.csv"
    if path.exists():
        df, _ = read_any(path)
        print(f"  존재함: {len(df)}행, 컬럼 {list(df.columns)}")
        print(f"  위험등급 분포 {df['위험등급'].value_counts().to_dict()}"
              if "위험등급" in df.columns else "  위험등급 컬럼 없음")
        # 재생성 가능성도 함께 확인해 둔다 (원본이 사라져도 복원 가능한지)
        s3 = pq.read_table(RAW / "step3_hhi_all.parquet").to_pandas()
        s3["hs4"] = s3["hs4"].astype(str).str.zfill(4)
        df["hs4"] = df["hs4"].astype(str).str.zfill(4)
        contained = set(df["hs4"]) <= set(s3["hs4"])
        rule = s3[(s3["HHI"] >= 0.25) | (s3["1위국비중"] >= 0.40)]
        same = set(rule["hs4"]) == set(df["hs4"])
        print(f"  step3_hhi_all({len(s3)}행) 부분집합 여부: {contained}")
        print(f"  재현 규칙(HHI≥0.25 OR 1위국비중≥0.40) 일치 여부: {same} "
              f"→ 원본 분실 시 복원 가능")
    else:
        print("  없음 — 재생성 필요")


def check_hscode_digits() -> None:
    print("\n" + "=" * 78)
    print("확인 2 — hscode 자릿수 통일 여부")
    for name, col in [("mvp_10.csv", None), ("risk_hs6.csv", None)]:
        df, _ = read_any(RAW / name)
        code_col = next((c for c in df.columns if re.fullmatch(r"hs\d?|hs4|hs6|hscode", str(c), re.I)), None)
        if code_col is None:
            print(f"  {name}: hscode 컬럼을 찾지 못함 (컬럼 {list(df.columns)})")
            continue
        codes = df[code_col].astype(str).str.strip()
        lens = codes.str.len().value_counts().to_dict()
        print(f"  {name}: 컬럼 '{code_col}' | 자릿수 분포 {lens} | 예시 {codes.head(3).tolist()}")


def check_urea() -> None:
    """STEP 3 백테스트 전제 확인 — 요소수 HS(2921/3102)와 2021년 데이터가 있는가."""
    print("\n" + "=" * 78)
    print("확인 3 — 요소수 백테스트 전제 (HS 2921/3102, 2021년 구간)")
    targets = ("2921", "3102", "310210", "292119")
    for rel in ["customs_item_country_root.parquet",
                "데이터셋 (primary key hscode 6자리)/관세청_(품목별 국가별) 수출입실적 HHI, 물가변동률 계산/risk_hs6_monthly.parquet"]:
        p = RAW / rel
        if not p.exists():
            print(f"  {rel}: 파일 없음")
            continue
        df = pq.read_table(p).to_pandas()
        code_cols = [c for c in df.columns if str(c).lower() in ("hs4", "hs6", "hscd")]
        hit = False
        for c in code_cols:
            codes = df[c].astype(str)
            if codes.str.startswith(targets).any():
                hit = True
        ym = df["ym"].astype(str) if "ym" in df.columns else None
        print(f"  {Path(rel).name}: 요소수 HS 포함 {hit} | "
              f"기간 {ym.min()}~{ym.max()}" if ym is not None else f"  {Path(rel).name}: 요소수 HS 포함 {hit}")
        if code_cols:
            uniq = sorted(set(df[code_cols[0]].astype(str)))
            print(f"    보유 {code_cols[0]} 목록({len(uniq)}개): {uniq}")


def main() -> None:
    if not RAW.exists():
        sys.exit(f"{RAW} 없음")
    files = sorted(
        [p for p in RAW.rglob("*") if p.suffix in (".parquet", ".csv")],
        key=lambda p: str(p),
    )
    print("=" * 78)
    print(f"STEP 0 — data/raw 스캔 대상 {len(files)}개 (parquet/csv)")
    print("=" * 78)
    for p in files:
        scan(p)
    check_blind_spots()
    check_hscode_digits()
    check_urea()
    print("\n" + "=" * 78)
    print("STEP 0 완료")


if __name__ == "__main__":
    main()
