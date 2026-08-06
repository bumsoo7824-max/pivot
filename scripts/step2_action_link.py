# -*- coding: utf-8 -*-
"""STEP 2 — 지원기관 연결(Action) 테이블 → data/processed/action_link.csv

"위험 품목 → 대체 공급국 → 그 국가의 중진공 해외전략네트워크 거점" 을 한 줄로 잇는다.

주의 — 이 조인은 **국가 단위 접점**이다.
  중진공 해외전략네트워크는 국가별 거점 기관 목록이고, 대체 공급국도 국가 단위
  산출 결과다. 따라서 여기서 나오는 연결은 "그 나라에 가면 이 창구를 통할 수
  있다" 는 뜻이지, 특정 공급 기업과 특정 수요 기업을 붙여 주는
  기업 대 기업(B2B) 매칭이 아니다. 화면·문서에서도 그렇게 표기해야 한다.

usage: python scripts/step2_action_link.py
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
OUT.mkdir(parents=True, exist_ok=True)

SMBA_CSV = (RAW / "데이터셋 (primary key hscode 6자리)" / "kotra 국내기업 해외법인 api"
            / "중소벤처기업진흥공단_해외 전략 네트워크 현황_20260713.csv")

# 출처마다 국가 표기가 달라 조인 전에 하나로 맞춘다.
COUNTRY_ALIAS = {
    "아랍에미리트 연합": "아랍에미리트",
    "러시아 연방": "러시아연방",
    "미합중국": "미국",
    "대만": "타이완",
    "홍콩": "홍콩",
}


def norm_country(s: object) -> str:
    name = str(s).strip()
    return COUNTRY_ALIAS.get(name, name)


def read_csv_fallback(path: Path) -> pd.DataFrame:
    for enc in ("utf-8", "utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"인코딩 판별 실패: {path}")


def main() -> None:
    print("[1] 중진공 해외전략네트워크 로딩")
    smba = read_csv_fallback(SMBA_CSV)
    smba.columns = [str(c).strip() for c in smba.columns]
    smba["country_key"] = smba["국가"].map(norm_country)
    print(f"  {len(smba)}개 거점 / {smba['country_key'].nunique()}개국")
    print(f"  컬럼 {list(smba.columns[:-1])}")

    print("\n[2] 대체 공급국 로딩")
    alt = pd.read_csv(OUT / "alt_countries.csv")
    ok = alt[alt["status"] == "ok"].copy()
    ok["country_key"] = ok["alt_country"].map(norm_country)
    print(f"  전체 {len(alt)}행 중 실측 {len(ok)}행 / {ok['country_key'].nunique()}개국")

    print("\n[3] 국가 기준 조인 (기업 대 기업 매칭 아님)")
    merged = ok.merge(
        smba[["country_key", "권역", "네트워크명", "총괄", "진출형태",
              "지원업종(품목)", "지원범위(프로세스)", "해당분야 지원실적 및 네트워크만의 강점"]],
        on="country_key", how="left", suffixes=("", "_smba"),
    )
    merged = merged.rename(columns={
        "권역": "smba_권역", "네트워크명": "smba_네트워크명", "총괄": "smba_총괄",
        "진출형태": "smba_지원형태", "지원업종(품목)": "smba_지원업종",
        "지원범위(프로세스)": "smba_지원범위",
        "해당분야 지원실적 및 네트워크만의 강점": "smba_강점",
    })

    # 보조 지표 — 해당 국가에 나가 있는 KOTRA 해외진출기업 수 (접점 규모 참고용)
    kotra = pq.read_table(RAW / "kotra_overseas_root.parquet").to_pandas()
    counts = kotra["진출국가"].map(norm_country).value_counts()
    merged["kotra_해외법인수"] = merged["country_key"].map(counts)

    merged["연결상태"] = merged["smba_네트워크명"].notna().map(
        {True: "중진공 거점 있음", False: "중진공 거점 없음"}
    )

    cols = [
        "hs4", "품목명", "위험국", "위험국비중", "rank", "alt_country", "country_key",
        "share", "value_usd", "source", "연결상태", "smba_권역", "smba_네트워크명",
        "smba_총괄", "smba_지원형태", "smba_지원업종", "smba_지원범위", "smba_강점",
        "kotra_해외법인수",
    ]
    merged = merged[cols].sort_values(["hs4", "rank"])

    path = OUT / "action_link.csv"
    merged.to_csv(path, index=False, encoding="utf-8-sig")

    linked = merged[merged["smba_네트워크명"].notna()]
    print(f"  결과 {len(merged)}행 (품목-대체국 조합)")
    print(f"  중진공 거점으로 이어진 조합 {len(linked)}행 / {linked['hs4'].nunique()}개 품목 "
          f"/ {linked['country_key'].nunique()}개국")
    print(f"  연결된 국가: {sorted(linked['country_key'].unique())}")
    print(f"  거점 없는 국가: {sorted(set(merged['country_key']) - set(linked['country_key']))}")

    print(f"\n→ {path.relative_to(ROOT)}")
    print(f"   컬럼 {len(cols)}개, 국가 단위 접점 (B2B 매칭 아님)")


if __name__ == "__main__":
    main()
