# -*- coding: utf-8 -*-
"""위험등급(RED/YELLOW/GREEN) 산출 규칙 — 단일 출처.

임계치는 여기서만 고친다. 스크립트와 대시보드는 이 모듈을 import 해서 쓴다.

────────────────────────────────────────────────────────────────────────
현재 상태: 새 임계치 **미확정**.
  전하늘님이 조정한 값이 전달되지 않아, 아래 THRESHOLDS 는 원자료
  risk_hs6_monthly.parquet 의 기존 등급을 역산해 맞춘 '추정치'다.
  RECALCULATED 가 False 인 동안 파이프라인은 이 규칙으로 등급을 덮어쓰지 않고
  원자료의 기존 등급을 그대로 쓴다.

  새 값을 받으면 THRESHOLDS 를 고치고 RECALCULATED = True 로 바꾼 뒤
  `python scripts/step1_alt_countries.py` 를 다시 돌리면 전 화면에 반영된다.
────────────────────────────────────────────────────────────────────────

역산 근거 (202606 스냅샷 15개 품목)
  RED  6건: HHI 0.447~0.737, 단가_z 2.06~7.86
  YEL  9건: 단가_z 2.0 이상인 6건은 모두 HHI 0.302 이하
  경계가 단가_z 1.99(YELLOW, 740319) 대 2.06(RED, 790111) 으로 매우 좁다.
  즉 등급은 구조(HHI)와 가격 이상(단가_z)의 결합이며 HHI 단독 함수가 아니다.
  실제로 780110 은 HHI 0.99998 이지만 단가_z 가 -2.75 라 YELLOW 다.
"""
from __future__ import annotations

import pandas as pd

# 새 임계치를 받으면 이 값만 교체한다.
THRESHOLDS = {
    "red_hhi": 0.40,        # RED 최소 HHI
    "red_price_z": 2.00,    # RED 최소 단가 z-score
    "yellow_hhi": 0.25,     # YELLOW 최소 HHI
    "yellow_share": 0.40,   # YELLOW 최소 1위국 비중
}

# 새 임계치가 확정되면 True 로 바꾼다.
# False 인 동안은 원자료의 기존 등급을 그대로 쓰고 재계산하지 않는다.
RECALCULATED = False

GRADE_SOURCE_LABEL = (
    "원자료 기존 등급 (새 임계치 미적용)" if not RECALCULATED
    else f"재계산 등급 (HHI≥{THRESHOLDS['red_hhi']}, 단가_z≥{THRESHOLDS['red_price_z']})"
)


def grade(hhi: float | None, top_share: float | None,
          price_z: float | None = None) -> str:
    """임계치 규칙에 따른 등급. 판단에 필요한 값이 없으면 '산출 불가'."""
    if pd.isna(hhi) or pd.isna(top_share):
        return "산출 불가"
    hhi, top_share = float(hhi), float(top_share)

    # RED 는 구조 취약과 가격 이상이 동시에 잡힐 때만 준다.
    if pd.notna(price_z) and price_z is not None:
        if hhi >= THRESHOLDS["red_hhi"] and float(price_z) >= THRESHOLDS["red_price_z"]:
            return "RED"
    if hhi >= THRESHOLDS["yellow_hhi"] or top_share >= THRESHOLDS["yellow_share"]:
        return "YELLOW"
    return "GREEN"


def resolve_grade(source_grade: str | None, hhi: float | None,
                  top_share: float | None, price_z: float | None = None) -> str:
    """RECALCULATED 스위치에 따라 기존 등급을 쓸지 재계산할지 정한다."""
    if RECALCULATED:
        return grade(hhi, top_share, price_z)
    if source_grade and str(source_grade) not in ("nan", "None", ""):
        return str(source_grade)
    return "산출 불가"
