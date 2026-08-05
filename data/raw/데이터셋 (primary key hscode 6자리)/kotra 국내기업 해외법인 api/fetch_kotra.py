"""
KOTRA 해외진출기업 (data.go.kr 15034787) 수집기

- odcloud 자동변환 API. 지원 파라미터는 page / perPage / returnType 뿐 (cond[] 미지원).
- serviceKey 는 반드시 **Decoding 키**를 params 로 전달. Encoding 키를 넣으면 이중 인코딩으로 401.
- 개발계정 트래픽 한도(통상 일 1,000건)가 있으므로 1회 수집 후 parquet 캐시 사용.

usage:
    export DATA_GO_KR_KEY='...Decoding키...'
    python fetch_kotra.py            # 최신본만
    python fetch_kotra.py --all      # 3개 버전 전부 (이력 비교용)
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path

import pandas as pd
import requests

BASE = "https://api.odcloud.kr/api"
DS_ID = "15034787"

# Swagger(namespace=15034787/v1)에서 확인한 실제 uddi
VERSIONS: dict[str, str] = {
    "20230620": "uddi:5f05b868-80f8-4914-92b3-c11a1147fcae",
    "20240607": "uddi:ee4397d3-4692-4292-97f9-af95ac3470b2",
    "20250703": "uddi:9cf4dfdd-41e9-4eed-a1b1-c8f7ca4874fd",  # 최신
}
LATEST = "20250703"

OUT_DIR = Path(__file__).parent / "data"

# 2023년판만 '기업명(국문)', '업종 대분류' 처럼 괄호/공백 포함 → 통일
CANON_COLS = [
    "지역", "진출국가", "관할무역관", "기업명국문", "기업명영문",
    "주소", "우편번호", "진출형태", "투자형태", "모기업명",
    "업종대분류", "업종중분류",
]


def _norm_col(c: str) -> str:
    return re.sub(r"[\s()（）]", "", str(c)).strip()


def fetch_version(version: str, key: str, per_page: int = 1000,
                  timeout: int = 30, max_retry: int = 3) -> pd.DataFrame:
    uddi = VERSIONS[version]
    url = f"{BASE}/{DS_ID}/v1/{uddi}"
    rows: list[dict] = []
    page = 1
    total = None

    while True:
        params = {"page": page, "perPage": per_page,
                  "returnType": "JSON", "serviceKey": key}
        for attempt in range(max_retry):
            try:
                r = requests.get(url, params=params, timeout=timeout)
                if r.status_code == 401:
                    raise SystemExit(
                        "401: 인증 실패. Decoding 키를 쓰고 있는지, "
                        "해당 데이터셋에 활용신청이 승인됐는지 확인하세요."
                    )
                r.raise_for_status()
                js = r.json()
                break
            except (requests.RequestException, ValueError) as e:
                if attempt == max_retry - 1:
                    raise
                wait = 2 ** attempt
                print(f"  [retry {attempt+1}/{max_retry}] {e} → {wait}s 대기",
                      file=sys.stderr)
                time.sleep(wait)

        chunk = js.get("data") or []
        rows.extend(chunk)
        total = js.get("totalCount", 0)
        print(f"  page {page}: +{len(chunk)}  ({len(rows)}/{total})")

        if not chunk or len(rows) >= total:
            break
        page += 1
        time.sleep(0.2)  # 서버 예의

    df = pd.DataFrame(rows)
    df.columns = [_norm_col(c) for c in df.columns]
    df["_src_version"] = version
    return df


def postprocess(df: pd.DataFrame) -> pd.DataFrame:
    """공백 정리 + 결측 정규화 + 중복 제거."""
    for c in df.select_dtypes(include="object").columns:
        df[c] = (df[c].astype("string")
                      .str.replace(r"\s+", " ", regex=True)
                      .str.strip()
                      .replace({"": pd.NA, "-": pd.NA, "N/A": pd.NA}))

    # 매칭 단계 dedup 키 (HS6 전환 시 벤더 중복 폭증 방지용으로 미리 고정)
    key_cols = [c for c in ("기업명국문", "진출국가", "주소") if c in df.columns]
    df["_vendor_key"] = (df[key_cols].fillna("").agg("|".join, axis=1)
                                     .str.lower())
    before = len(df)
    df = df.drop_duplicates(subset=["_vendor_key", "_src_version"])
    print(f"  dedup: {before} → {len(df)} (-{before - len(df)})")
    return df.reset_index(drop=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="3개 버전 전부 수집")
    ap.add_argument("--per-page", type=int, default=1000)
    args = ap.parse_args()

    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("환경변수 DATA_GO_KR_KEY (Decoding 키) 를 설정하세요.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets = list(VERSIONS) if args.all else [LATEST]

    frames = []
    for v in targets:
        print(f"[fetch] {v}")
        frames.append(fetch_version(v, key, per_page=args.per_page))

    df = postprocess(pd.concat(frames, ignore_index=True))

    missing = [c for c in CANON_COLS if c not in df.columns]
    if missing:
        print(f"  ⚠ 예상 컬럼 누락: {missing} (원본 스키마 변경 가능성)",
              file=sys.stderr)

    out = OUT_DIR / "kotra_overseas.parquet"
    df.to_parquet(out, index=False)
    print(f"\n[saved] {out}  rows={len(df)}  cols={len(df.columns)}")

    if "업종중분류" in df.columns:
        print("\n[업종중분류 상위 25] ← HS↔KSIC 브릿지 매핑 대상")
        print(df["업종중분류"].value_counts().head(25).to_string())
    if "진출형태" in df.columns:
        print("\n[진출형태 분포]")
        print(df["진출형태"].value_counts().to_string())


if __name__ == "__main__":
    main()
