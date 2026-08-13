"""
Google News RSS 원자재 공급망 리스크 크롤러 (fetch_google_news.py)

원본: 구글_뉴스_크롤링_코드_.ipynb 의 v6(cell 8)을 기반으로 정리.
KOTRA 해외시장뉴스(fetch_kotra_news.py)와 상호보완:
  - KOTRA 뉴스: 국내 무역관 큐레이션, 신뢰도 높지만 커버리지 좁음(월 ~900건)
  - Google News: 커버리지 넓지만(전세계 매체) 노이즈 많음 → risk_score로 걸러야 함

[원본 대비 수정한 부분]
  1. MATERIAL_MAP을 12개 범용 원자재 하드코딩 → HS4_KEYWORD_MAP(256개 품목) 기반으로 교체.
     이래야 pipeline_final.py의 hs4별 2단계 뉴스검증과 실제로 이어진다.
  2. 국가 목록(COUNTRIES)을 10개 하드코딩 → COUNTRY_MAP_EN 키(전체 매핑 국가)로 확장.
  3. 출력 경로를 output/*.csv → data/google_news.parquet 로 통일 (다른 fetch_*.py와 일관성).
  4. requests 호출에 재시도(retry) 로직 추가 (다른 fetch_*.py와 동일 패턴).

usage:
    python fetch_google_news.py --start 2026-07-01 --end 2026-08-13
    python fetch_google_news.py --days 30   # 최근 30일 (rolling 31일 필터와 별개로 수집기간 지정)
"""
from __future__ import annotations

import argparse
import ast
import os
import re
import sys
import sqlite3
import time
import urllib3
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse, quote

import feedparser
import pandas as pd
import requests
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT = Path(__file__).parent
DATA = ROOT / "data"
DB_PATH = ROOT / "google_news_cache.db"

ROLLING_DAYS = 31          # 원본 v6 실측 근거 유지: 당일기사 0.6%뿐이라 rolling window 필수
STEP_DAYS = 7

DANGER_THRESHOLD = 15
CAUTION_THRESHOLD = 8

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# ======================================================
# [수정 1] RSS 검색어 — 원본 20개 유지 (일반 공급망 리스크 토픽, 품목 무관 광역 검색)
# ======================================================
RSS_KEYWORDS = {
    "공급망리스크": "공급망 리스크", "반도체": "반도체 공급망 수출규제",
    "희토류": "희토류 핵심광물 수출통제", "배터리": "배터리 이차전지 공급망",
    "에너지": "원유 천연가스 에너지 리스크", "미중갈등": "미중 갈등 공급망",
    "관세전쟁": "관세 전쟁", "핵심광물": "핵심광물 확보",
    "홍해": "홍해 봉쇄 물류", "해상운임": "해상운임 급등",
    "IRA": "IRA 반도체 배터리", "CHIPS": "CHIPS Act 반도체",
    "중국갈륨": "중국 갈륨 수출통제", "중국흑연": "중국 흑연 수출",
    "러시아가스": "러시아 가스 제재", "요소수": "요소수 공급망",
    "광물가격": "광물 가격 급등", "물류차질": "글로벌 물류 차질",
    "전략광물": "전략광물 공급망", "디커플링": "디커플링 공급망",
}

HIGH_KW = {"수출금지": 10, "수출규제": 10, "수출통제": 10, "봉쇄": 10, "전쟁": 10, "제재": 10, "금수": 10}
MEDIUM_KW = {"관세": 5, "디커플링": 5, "무역갈등": 5, "공급망 재편": 5, "부족": 5, "차질": 5}
LOW_KW = {"공급망": 3, "반도체": 3, "희토류": 3, "배터리": 3, "에너지": 3}
RELIEF_KW = {"완화": -3, "합의": -5, "정상화": -5, "해제": -5, "협력": -3}


def _load_hs4_keyword_map() -> dict[str, list[str]]:
    """pipeline_final.py의 HS4_KEYWORD_MAP을 파일 파싱으로 읽어온다(임포트 대신 ast 사용 —
    pipeline_final.py의 argparse가 있는 main()을 실행하지 않기 위함)."""
    pf_path = ROOT / "pipeline_final.py"
    if not pf_path.exists():
        print("  ⚠ pipeline_final.py를 찾지 못해 HS4_KEYWORD_MAP 없이 진행합니다(원자재 태깅 비활성).")
        return {}
    tree = ast.parse(pf_path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "HS4_KEYWORD_MAP" for t in node.targets
        ):
            return ast.literal_eval(node.value)
    return {}


def _load_countries() -> list[str]:
    """pipeline_final.py의 COUNTRY_MAP_EN 키(한글 국가명 전체)를 가져온다."""
    pf_path = ROOT / "pipeline_final.py"
    if not pf_path.exists():
        return ["중국", "미국", "일본", "러시아", "인도", "호주", "독일", "대만", "이란", "이스라엘"]
    tree = ast.parse(pf_path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "COUNTRY_MAP_EN" for t in node.targets
        ):
            return list(ast.literal_eval(node.value).keys())
    return []


HS4_KEYWORD_MAP = _load_hs4_keyword_map()
COUNTRIES = _load_countries()


def init_db() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("CREATE TABLE IF NOT EXISTS articles (link TEXT PRIMARY KEY)")
    conn.commit()
    conn.close()


def already_collected(link: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT 1 FROM articles WHERE link=?", (link,)).fetchone()
    conn.close()
    return row is not None


def save_link(link: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("INSERT OR IGNORE INTO articles(link) VALUES(?)", (link,))
    conn.commit()
    conn.close()


def normalize_url(url: str) -> str:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}{p.path}"
    except Exception:
        return url


def build_feeds() -> dict[str, str]:
    return {
        k: f"https://news.google.com/rss/search?q={quote(q)}&hl=ko&gl=KR&ceid=KR:ko"
        for k, q in RSS_KEYWORDS.items()
    }


def _get_with_retry(url: str, max_retry: int = 3, **kwargs) -> requests.Response | None:
    """[수정 4] 다른 fetch_*.py와 일관된 재시도 로직."""
    for attempt in range(max_retry):
        try:
            return requests.get(url, timeout=10, verify=False, headers=HEADERS, **kwargs)
        except requests.RequestException as e:
            if attempt == max_retry - 1:
                print(f"  ! 요청 실패: {e}", file=sys.stderr)
                return None
            time.sleep(2 ** attempt)
    return None


def extract_article_text(url: str) -> str:
    r = _get_with_retry(url)
    if r is None:
        return ""
    try:
        soup = BeautifulSoup(r.text, "html.parser")
        texts = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
        texts = [t for t in texts if len(t) > 30]
        return " ".join(texts)[:5000]
    except Exception:
        return ""


def score_text(text: str) -> tuple[int, str]:
    t = text.lower()
    danger = sum(sc for kw, sc in {**HIGH_KW, **MEDIUM_KW, **LOW_KW}.items() if kw in t)
    relief = sum(sc for kw, sc in RELIEF_KW.items() if kw in t)
    final = danger + relief
    if final >= DANGER_THRESHOLD:
        direction = "위험↑"
    elif final >= CAUTION_THRESHOLD:
        direction = "주의→"
    elif final <= 0:
        direction = "완화↓"
    else:
        direction = "중립"
    return final, direction


def extract_hs4_tags(text: str) -> list[str]:
    """[수정 1] 12개 범용 원자재 대신 HS4_KEYWORD_MAP(256개 품목) 기준으로 태깅.
    3글자 이상(구체적인) 키워드는 1개만 걸려도 태깅, 2글자 이하(범용, 예: "소재","화학")
    키워드는 2개 이상 겹쳐야 태깅 — filter_kotra_by_hs4의 제네릭 키워드 문제와 동일한
    이유로, 짧은 키워드 단독 매칭은 오탐 위험이 크다."""
    t = text.lower()
    tags = []
    for hs4, keywords in HS4_KEYWORD_MAP.items():
        hits = [kw for kw in keywords if len(kw) > 1 and kw.lower() in t]
        specific_hits = [kw for kw in hits if len(kw) >= 3]
        if specific_hits or len(hits) >= 2:
            tags.append(hs4)
    return tags


def extract_countries(text: str) -> list[str]:
    return sorted({c for c in COUNTRIES if c in text})


def fetch_feed(category: str, url: str, target_date: datetime) -> list[dict]:
    rows = []
    window_start = target_date - timedelta(days=ROLLING_DAYS)

    r = _get_with_retry(url)
    if r is None:
        return rows
    try:
        feed = feedparser.parse(r.content)
    except Exception as e:
        print(f"  RSS 파싱 오류: {e}")
        return rows

    for entry in feed.entries:
        try:
            if not hasattr(entry, "published_parsed"):
                continue
            pub_date = datetime(*entry.published_parsed[:6])
            if pub_date < window_start or pub_date > target_date:
                continue

            link = normalize_url(entry.get("link", ""))
            if already_collected(link):
                continue

            title = entry.get("title", "")
            summary = re.sub(r"<[^>]+>", "", entry.get("summary", ""))
            article_text = extract_article_text(link)
            full_text = f"{title} {summary} {article_text}"

            risk_score, direction = score_text(full_text)
            countries = extract_countries(full_text)
            hs4_tags = extract_hs4_tags(full_text)

            rows.append({
                "수집일": target_date.strftime("%Y-%m-%d"),
                "발행일": pub_date.strftime("%Y-%m-%d"),
                "카테고리": category,
                "제목": title,
                "링크": link,
                "요약": summary[:300],
                "본문": article_text[:3000],
                "risk_score": risk_score,
                "risk_direction": direction,
                "언급국가": ", ".join(countries),
                "hs4_tags": ", ".join(hs4_tags),   # [수정 1] 원자재태그 → hs4_tags
            })
            save_link(link)
        except Exception:
            continue

    return rows


def crawl_all(start_date: datetime, end_date: datetime) -> pd.DataFrame:
    all_rows = []
    current = start_date
    feeds = build_feeds()

    while current <= end_date:
        print(f"\n📅 {current.strftime('%Y-%m-%d')}")
        for cat, url in feeds.items():
            rows = fetch_feed(cat, url, current)
            print(f"  [{cat}] {len(rows)}건")
            all_rows.extend(rows)
            time.sleep(1)
        current += timedelta(days=STEP_DAYS)

    df = pd.DataFrame(all_rows)
    if len(df) == 0:
        return df
    return (df.sort_values(["발행일", "risk_score"], ascending=[False, False])
              .drop_duplicates(subset=["링크"]).reset_index(drop=True))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=str, help="YYYY-MM-DD")
    ap.add_argument("--end", type=str, help="YYYY-MM-DD")
    ap.add_argument("--days", type=int, default=30, help="--start/--end 생략 시 오늘 기준 최근 N일")
    args = ap.parse_args()

    if args.start and args.end:
        start_date = datetime.strptime(args.start, "%Y-%m-%d")
        end_date = datetime.strptime(args.end, "%Y-%m-%d")
    else:
        end_date = datetime.today()
        start_date = end_date - timedelta(days=args.days)

    init_db()
    print("=" * 60)
    print(f"Google News 공급망 리스크 수집: {start_date.date()} ~ {end_date.date()}")
    print(f"HS4_KEYWORD_MAP 로드: {len(HS4_KEYWORD_MAP)}개 품목 / 국가 {len(COUNTRIES)}개")
    print("=" * 60)

    df = crawl_all(start_date, end_date)
    print(f"\n총 수집: {len(df)}건")

    if df.empty:
        print("수집된 기사가 없습니다.")
        return

    DATA.mkdir(exist_ok=True)
    out = DATA / "google_news.parquet"
    df.to_parquet(out, index=False)
    print(f"[saved] {out}")

    tagged = df[df["hs4_tags"] != ""]
    print(f"\nHS4 태깅된 기사: {len(tagged)}/{len(df)}건")
    if len(tagged):
        print(tagged[["발행일", "제목", "hs4_tags", "언급국가", "risk_direction"]].head(10).to_string(index=False))


if __name__ == "__main__":
    main()
