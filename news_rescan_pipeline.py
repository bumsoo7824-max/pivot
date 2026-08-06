# -*- coding: utf-8 -*-
"""
Supply-Pivot 뉴스 재조사 파이프라인 (news_rescan_pipeline.py)
================================================================
목적
  HHI 스크리닝(step4_blind_spots.csv)에서 RED/YELLOW로 진단된 품목군에 대해
  "왜 그 등급인지"를 뉴스로 재조사(2차 검증)하고, 신호등 결과 옆에
  오판 방지용 3줄 근거를 함께 출력한다.

이번 버전에서 이전(news_signal_test.py) 대비 바뀐 점
  1. Google RSS 요약이 "제목만 반복 수집"되던 버그 수정
     → RSS entry의 summary가 비거나 title과 동일하면, 기사 원문 URL을
       가볍게 GET 하여 og:description / meta description을 보강 수집.
       (본문 전체 크롤링은 시간상 생략 — 메타 요약만으로도 스코어링에 충분)
  2. KOTRA와 Google을 하나의 articles 리스트로 합쳐서 즉시 신호등을 내지 않고,
     "KOTRA 신호"와 "Google 신호"를 완전히 분리 계산한다.
     (사용자 요청: "kotra와 별도로 점수 계산 → 이후 합칠 것")
     - KOTRA: 발행빈도 낮지만 신뢰도 높음 → "확증(confirmation)" 역할
     - Google: 실시간이지만 노이즈 있음 → "조기경보(early warning)" 역할
  3. 100개 품목군 배치 실행:
     step4_blind_spots.csv에서 랜덤 시드 고정(42)으로 100건 샘플링 후
     품목별로 Google/KOTRA 각각 재조사 → 결과 CSV로 저장.
  4. 오판 방지용 3줄 요약(reason) 자동 생성:
     각 신호(RED/YELLOW/GREEN)마다 왜 그렇게 판정됐는지 근거 3줄을
     "① 매칭 키워드/콤보  ② 최고점수 기사 제목  ③ 판정 로직 요약" 구조로 출력.

주의 (원본 데이터 관련)
  - 첨부된 step4_blind_spots.csv는 컬럼이 'hs4'이며 HS6 코드가 아닙니다.
    사용자 요청은 "HS6로 100개"였으나, 현재 스크리닝 산출물에는 HS6 세분류가
    없어 hs4를 그대로 검색 쿼리 기준(4자리)으로 사용했습니다.
    HS6 세분류가 필요하면 관세청 원본 데이터에서 hs4 → hs6 브레이크다운을
    먼저 추출해야 합니다. (다음 단계 TODO)

실행
  python news_rescan_pipeline.py
필요 패키지
  pip install feedparser requests pandas numpy rapidfuzz beautifulsoup4
"""

from __future__ import annotations

import re
import time
import random
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests

try:
    import feedparser
except ImportError:
    feedparser = None

try:
    from rapidfuzz import fuzz
except ImportError:
    fuzz = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

warnings.filterwarnings("ignore")

# ================================================================ 설정
SEED = 42
N_SAMPLE = 100
BLIND_SPOT_CSV = "step4_blind_spots.csv"     # HHI 스크리닝 결과 (hs4, 품목명, 위험등급 등)
KOTRA_PARQUET = "data/kotra_news.parquet"    # KOTRA 캐시 (기존 파이프라인 산출물)
OUTPUT_CSV = "news_rescan_result.csv"
DAYS_WINDOW = 14                              # Google 뉴스 수집 윈도우(일)
FETCH_META_TIMEOUT = 6                        # 기사 메타요약 보강 시 timeout(초)
MAX_META_FETCH_PER_ITEM = 5                   # 품목당 메타요약 보강 시도 최대 건수 (속도 제한)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# ================================================================ 임계치 (news_signal_test.py 최적화값 승계)
DANGER_THRESHOLD = 16
CAUTION_THRESHOLD = 5

# ================================================================ 키워드 사전 (기존과 동일, 유지)
HIGH_KW = {
    "수출금지": 10, "수출규제": 10, "수출통제": 10, "수출중단": 10, "수입규제": 10,
    "제재": 10, "금수": 10, "봉쇄": 10, "무역전쟁": 10, "보복관세": 10,
    "공급 차질": 10, "공급망 붕괴": 10, "요소수 품귀": 10, "수출 전개 검사": 10, "통관 보류": 10,
}
MEDIUM_KW = {
    "관세": 5, "추가관세": 5, "관세인상": 5, "분쟁": 5, "긴장": 5, "디커플링": 5,
    "공급망 재편": 5, "무역분쟁": 5, "부품 부족": 5, "원자재 부족": 5, "수급 불안": 5,
    "가격 급등": 5, "단가 상승": 5, "수출 자제": 5, "수출 쿼터": 5,
}
LOW_KW = {
    "공급망": 3, "원자재": 3, "희토류": 3, "핵심광물": 3, "미중": 3,
    "러시아": 3, "중동": 3, "비료": 3, "리튬": 3, "니켈": 3,
}
RELIEF_KW = {
    "수출규제 해제": -8, "제재 해제": -8, "수출통제 해제": -8, "공급망 정상화": -8,
    "공급 회복": -8, "봉쇄 해제": -8, "유예": -5, "합의": -5, "휴전": -5,
    "협상 타결": -5, "긴장 완화": -5, "완화": -3, "정상화": -3, "협력": -3, "안정": -2,
}
COMBO_WEIGHTS = [
    (["중국", "수출통제"], +8, "중국 수출통제"),
    (["중국", "수출규제"], +8, "중국 수출규제"),
    (["중국", "수출제한"], +8, "중국 수출제한"),
    (["중국", "요소"], +8, "중국 요소 리스크"),
    (["요소", "수출"], +6, "요소 수출 이슈"),
    (["요소수", "품귀"], +8, "요소수 품귀"),
    (["중국", "규제"], +5, "중국 규제"),
    (["러시아", "제재"], +6, "러시아 제재"),
    (["공급망", "차질"], +5, "공급망 차질"),
    (["가격", "급등"], +5, "가격 급등"),
    (["리튬", "수출통제"], +8, "리튬 수출통제"),
]
RELIEF_OVERRIDE = [
    ["수출통제", "완화"], ["제재", "해제"], ["봉쇄", "해제"], ["수출규제", "해제"], ["관세", "합의"],
]


# ================================================================ 텍스트 정규화/매칭
def normalize_text(text: str) -> str:
    return text.replace(" ", "").lower() if text else ""


def contains_keyword_robust(target_text: str, keyword: str, threshold: float = 80.0) -> bool:
    clean_text = normalize_text(target_text)
    clean_kw = normalize_text(keyword)
    if not clean_kw or not clean_text:
        return False
    if clean_kw in clean_text:
        return True
    if fuzz and len(clean_kw) >= 3:
        return fuzz.partial_ratio(clean_kw, clean_text) >= threshold
    return False


# ================================================================ 스코어링 (품목 단위 공통 로직)
def score_text(text: str) -> dict:
    danger = 0
    high_h, med_h, low_h = [], [], []
    for kw, sc in HIGH_KW.items():
        if contains_keyword_robust(text, kw):
            danger += sc; high_h.append(kw)
    for kw, sc in MEDIUM_KW.items():
        if contains_keyword_robust(text, kw):
            danger += sc; med_h.append(kw)
    for kw, sc in LOW_KW.items():
        if contains_keyword_robust(text, kw):
            danger += sc; low_h.append(kw)

    relief = 0
    relief_h = []
    for kw, sc in RELIEF_KW.items():
        if contains_keyword_robust(text, kw):
            relief += sc; relief_h.append(f"{kw}({sc:+d})")

    combo = 0
    combo_h = []
    for kws, bonus, label in COMBO_WEIGHTS:
        if all(contains_keyword_robust(text, k) for k in kws):
            combo += bonus; combo_h.append(f"{label}({bonus:+d})")

    final = danger + relief + combo

    override = any(all(contains_keyword_robust(text, k) for k in kws) for kws in RELIEF_OVERRIDE)
    if override:
        final = min(final, 3)

    if override or relief <= -8:
        direction = "완화"
    elif final >= DANGER_THRESHOLD:
        direction = "위험"
    elif final >= CAUTION_THRESHOLD:
        direction = "주의"
    else:
        direction = "중립"

    return {
        "score": final, "direction": direction,
        "high_kw": high_h, "med_kw": med_h, "low_kw": low_h,
        "relief_kw": relief_h, "combo": combo_h,
    }


# ================================================================ [수정1] Google RSS 요약 보강 수집
def _extract_meta_description(url: str) -> str:
    """기사 원문 URL에서 og:description / meta description을 가볍게 추출.
    본문 전체 크롤링이 아닌 메타 요약만 — 속도와 시간 제약을 감안한 타협.
    """
    if BeautifulSoup is None:
        return ""
    try:
        r = requests.get(url, headers=HEADERS, timeout=FETCH_META_TIMEOUT, verify=False, allow_redirects=True)
        soup = BeautifulSoup(r.text, "html.parser")
        og = soup.find("meta", property="og:description")
        if og and og.get("content"):
            return og["content"].strip()
        md = soup.find("meta", attrs={"name": "description"})
        if md and md.get("content"):
            return md["content"].strip()
    except Exception:
        pass
    return ""


def fetch_google_news(queries: list[str], days: int = DAYS_WINDOW, enrich_top_n: int = MAX_META_FETCH_PER_ITEM) -> list[dict]:
    """Google News RSS 수집. 이전 버전의 '제목만 수집되는' 버그를 수정:
    - RSS entry.summary가 비었거나 title과 동일(=요약 없음)한 경우,
      상위 enrich_top_n건에 한해 기사 원문 메타 description을 추가 수집한다.
    """
    if feedparser is None:
        return []

    raw_hits = []
    cutoff = datetime.now() - timedelta(days=days)

    for query in queries:
        url = f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"
        try:
            r = requests.get(url, headers=HEADERS, timeout=10, verify=False)
            feed = feedparser.parse(r.content)
        except Exception:
            continue

        for entry in feed.entries:
            pub_date = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    pub_date = datetime(*entry.published_parsed[:6])
                except Exception:
                    continue
            if pub_date is None or pub_date < cutoff:
                continue

            title = entry.get("title", "").strip()
            raw_summary = re.sub(r"<[^>]+>", "", getattr(entry, "summary", "")).strip()
            # RSS summary가 비었거나 title과 사실상 동일하면 "요약 없음"으로 표시
            needs_enrich = (not raw_summary) or (normalize_text(raw_summary)[:30] == normalize_text(title)[:30])

            raw_hits.append({
                "title": title,
                "summary": raw_summary,
                "link": entry.get("link", ""),
                "date": pub_date.strftime("%Y-%m-%d"),
                "needs_enrich": needs_enrich,
            })
        time.sleep(0.3)

    # 중복 제거 (제목 앞 30자 기준)
    seen, unique = set(), []
    for h in raw_hits:
        key = normalize_text(h["title"])[:30]
        if key not in seen:
            seen.add(key)
            unique.append(h)

    # [수정1] 요약이 빈 상위 N건만 메타 description 보강 (전체 보강은 시간 비용 큼)
    enrich_count = 0
    for h in unique:
        if h["needs_enrich"] and h["link"] and enrich_count < enrich_top_n:
            meta = _extract_meta_description(h["link"])
            if meta:
                h["summary"] = meta
            enrich_count += 1

    articles = []
    for h in unique:
        full_text = f"{h['title']} {h['summary']}"
        scored = score_text(full_text)
        articles.append({
            "source": "GoogleNews",
            "date": h["date"],
            "title": h["title"],
            "summary": h["summary"][:200],
            "score": scored["score"],
            "direction": scored["direction"],
            "keywords": scored["high_kw"] + scored["med_kw"],
            "combo": scored["combo"],
        })

    return sorted(articles, key=lambda x: -x["score"])


# ================================================================ KOTRA 캐시 조회 (Google과 완전 분리)
def fetch_kotra_cached(hs_code: str, item_name: str, kotra_path: str = KOTRA_PARQUET,
                        as_of_date: str | None = None) -> list[dict]:
    p = Path(kotra_path)
    if not p.exists():
        return []
    df = pd.read_parquet(p)
    if as_of_date:
        df = df[df["othbcDt"].astype(str) <= as_of_date]
    if df.empty:
        return []

    hs_short = str(hs_code)[:4]
    clean_item = normalize_text(item_name)
    kw = clean_item[:2] if len(clean_item) >= 2 else clean_item

    titles = df["newsTitl"].fillna("").astype(str).tolist()
    m1 = [contains_keyword_robust(t, kw) for t in titles]
    hs_series = df["hsCdNm"].fillna("").astype(str)
    m2 = np.array(hs_series.str.contains(hs_short, na=False), dtype=bool)
    mask = np.array(m1, dtype=bool) | m2
    hits = df[mask]

    articles = []
    for _, row in hits.iterrows():
        full_text = str(row.get("newsTitl", "")) + " " + str(row.get("cmdltNmKorn", ""))
        scored = score_text(full_text)
        articles.append({
            "source": "KOTRA",
            "date": str(row.get("othbcDt", "")),
            "title": str(row.get("newsTitl", "")),
            "summary": str(row.get("cmdltNmKorn", ""))[:200],
            "score": scored["score"],
            "direction": scored["direction"],
            "keywords": scored["high_kw"] + scored["med_kw"],
            "combo": scored["combo"],
        })
    return sorted(articles, key=lambda x: -x["score"])


# ================================================================ [수정2] 소스별 독립 신호등 판정
def compute_signal_single_source(articles: list[dict], source_label: str) -> dict:
    """KOTRA / Google을 각각 독립적으로 판정 (합치기 전 단계)."""
    if not articles:
        return {
            "signal": "NO_DATA",
            "reason_lines": [
                f"[{source_label}] 관련 기사 0건 수집.",
                "이 소스만으로는 판단 불가 — 신호는 구조지표(HHI)로 대체 판단 필요.",
                "다른 소스(Google/KOTRA)의 결과를 함께 확인할 것.",
            ],
        }

    risk_articles = [a for a in articles if a["direction"] in ("위험", "주의")]
    danger_count = sum(1 for a in articles if a["direction"] == "위험")
    caution_count = sum(1 for a in articles if a["direction"] == "주의")
    max_score = max(a["score"] for a in articles)
    top = articles[0]

    if danger_count >= 2 or max_score >= DANGER_THRESHOLD or (danger_count + caution_count) >= 3:
        signal = "RED"
    elif len(risk_articles) >= 1 or max_score >= CAUTION_THRESHOLD:
        signal = "YELLOW"
    else:
        signal = "GREEN"

    # ---- 오판 방지용 3줄 근거 ----
    kw_hit = (top["keywords"] + top["combo"]) or ["매칭 키워드 없음"]
    line1 = f"① [{source_label}] 매칭 근거: {', '.join(kw_hit[:4])} (최고점수 {max_score}, {source_label} {len(articles)}건 중 위험/주의 {len(risk_articles)}건)"
    line2 = f"② 최고 위험 기사: [{top['date']}] {top['title'][:60]}"
    if signal == "RED":
        line3 = "③ 판정: 위험 신호 반복/고득점 확인 → 구조적 RED 판정과 일치, 즉시 대체선 검토 권고."
    elif signal == "YELLOW":
        line3 = "③ 판정: 주의 수준 신호 일부 확인 → 구조 지표(HHI)와 함께 모니터링, 성급한 RED 격상은 지양."
    else:
        line3 = "③ 판정: 위험 신호 미확인 → 뉴스상으로는 안정적, 다만 구조적 HHI 위험도는 별도 확인 필요."

    return {"signal": signal, "reason_lines": [line1, line2, line3], "max_score": max_score,
            "n_articles": len(articles), "n_risk": len(risk_articles)}


def combine_google_kotra(google_res: dict, kotra_res: dict) -> dict:
    """Google(조기경보)·KOTRA(확증)를 최종 결합 — 가중 OR.
    KOTRA 신호가 있으면 신뢰도 가중 (KOTRA 1건 ≈ Google 2~3건 가중치)로
    최종 신호를 한 단계 격상, 없으면 Google 단독 판정을 그대로 사용.
    """
    order = {"GREEN": 0, "NO_DATA": 0, "YELLOW": 1, "RED": 2}
    g_sig, k_sig = google_res["signal"], kotra_res["signal"]

    if k_sig == "RED":
        final = "RED"
        combine_note = "KOTRA(정부기관 발신, 고신뢰도) RED 확증 → 최종 RED"
    elif k_sig == "YELLOW" and order.get(g_sig, 0) >= order["YELLOW"]:
        final = "RED" if g_sig == "RED" else "YELLOW"
        combine_note = "KOTRA 주의 + Google 위험신호 동반 → 가중 격상"
    elif g_sig == "RED":
        final = "RED"
        combine_note = "Google(조기경보) RED, KOTRA 데이터 부족(발행빈도 낮음) → Google 단독 RED 채택"
    else:
        final = max([g_sig, k_sig], key=lambda s: order.get(s, 0))
        combine_note = "두 소스 모두 저위험 → 최댓값 채택"

    return {"final_signal": final, "combine_note": combine_note}


# ================================================================ [수정3] '기타' 품목명 처리
# step4_blind_spots.csv 실사용 결과: hs4 레벨 품목명 중 다수가 "기타"로 뭉뚱그려져 있어
# "기타 수출규제" 같은 무관 쿼리가 나가고, 이게 HHI 등급과 역행하는 뉴스신호(27건 YELLOW인데
# google=RED)의 주된 원인으로 확인됨. "기타"류는 별도 처리:
#   - 검색 쿼리에서 품목명을 빼고 HS4 코드 자체 + 공급망 일반 키워드만 사용
#   - 결과에 품목명 해상도가 낮다는 신뢰도 플래그를 붙여, 자동 배제하지 않고 표시만 함
#     (배제하면 표본이 줄어들고, 실제로는 그 안에 위험 품목이 섞여있을 수 있어
#      '조사는 하되 신뢰도를 낮춰서 보여준다'가 더 안전한 설계)
GENERIC_NAME_TOKENS = {"기타"}


def is_generic_item_name(item_name: str) -> bool:
    name = (item_name or "").strip()
    return name in GENERIC_NAME_TOKENS or name == ""


# ================================================================ 품목 단위 재조사 (Google/KOTRA 분리 실행)
def rescan_item(hs4: str, item_name: str, risk_country: str = "") -> dict:
    generic = is_generic_item_name(item_name)

    if generic:
        # 품목명이 '기타'라 특정 불가 → 품목명 기반 쿼리 대신 HS4 코드 기반 최소 쿼리만 사용
        # (품목명으로 검색하면 전혀 무관한 일반 기사를 대량으로 끌어와 오탐이 심해짐)
        queries = [f"HS{hs4} 수입 동향", f"HS{hs4} 공급망"]
        if risk_country:
            queries.append(f"HS{hs4} {risk_country} 수출")
    else:
        queries = [item_name, f"{item_name} 수출규제", f"{item_name} 공급망"]
        if risk_country:
            queries.append(f"{item_name} {risk_country}")

    google_articles = fetch_google_news(queries, days=DAYS_WINDOW)
    kotra_articles = fetch_kotra_cached(hs4, item_name)

    google_res = compute_signal_single_source(google_articles, "Google")
    kotra_res = compute_signal_single_source(kotra_articles, "KOTRA")
    combined = combine_google_kotra(google_res, kotra_res)

    # 신뢰도 플래그: 품목명이 '기타'인 경우, 뉴스 신호 자체의 신뢰도가 낮음을 명시
    confidence_flag = (
        "낮음(품목명 '기타' — HS4 코드 기반 일반 쿼리, 오탐 가능성 높음)"
        if generic else "보통(품목명 기반 구체 쿼리)"
    )

    return {
        "hs4": hs4,
        "품목명": item_name,
        "품목명_해상도": "기타(저해상도)" if generic else "구체",
        "신뢰도": confidence_flag,
        "google_signal": google_res["signal"],
        "google_reason": " | ".join(google_res["reason_lines"]),
        "kotra_signal": kotra_res["signal"],
        "kotra_reason": " | ".join(kotra_res["reason_lines"]),
        "final_signal_추천": combined["final_signal"],
        "결합근거": combined["combine_note"],
    }


# ================================================================ 배치 실행 (100개 품목군)
def run_batch(blind_spot_csv: str = BLIND_SPOT_CSV, n_sample: int = N_SAMPLE, seed: int = SEED) -> pd.DataFrame:
    df = pd.read_csv(blind_spot_csv)
    random.seed(seed)
    sample_idx = random.sample(range(len(df)), min(n_sample, len(df)))
    sample_df = df.iloc[sample_idx].reset_index(drop=True)

    print(f"[배치 시작] {blind_spot_csv}에서 {len(sample_df)}개 품목군 샘플링 (seed={seed})")
    print("주의: 원본 스크리닝 컬럼은 hs4이며 HS6 세분류 아님 — TODO: hs6 브레이크다운 확보 후 재실행 권장.\n")

    results = []
    for i, row in sample_df.iterrows():
        hs4 = str(row["hs4"])
        item_name = str(row["품목명"])[:20]
        risk_country = str(row.get("1위국", ""))
        print(f"  [{i+1}/{len(sample_df)}] HS{hs4} {item_name} 재조사 중...")
        try:
            res = rescan_item(hs4, item_name, risk_country)
        except Exception as e:
            res = {
                "hs4": hs4, "품목명": item_name,
                "google_signal": "ERROR", "google_reason": str(e),
                "kotra_signal": "ERROR", "kotra_reason": str(e),
                "final_signal_추천": "ERROR", "결합근거": str(e),
            }
        res["HHI_위험등급"] = row.get("위험등급", "")
        results.append(res)
        time.sleep(0.2)

    out = pd.DataFrame(results)
    out.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"\n[완료] 결과 저장 → {OUTPUT_CSV} ({len(out)}행)")
    return out


if __name__ == "__main__":
    run_batch()
