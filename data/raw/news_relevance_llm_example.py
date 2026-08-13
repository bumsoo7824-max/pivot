"""
[예시/POC] 뉴스 관련도 LLM 판정 — news_relevance_llm_example.py

목적: pipeline_final.py의 [2단계]가 뽑아낸 뉴스 제목 목록을 Claude API로
     "이 품목과 직결되는가"만 1차 분류해보는 예시. 본 파이프라인(step_e2e_one)에는
     아직 엮여있지 않음 — MVP 단계에서 정식 도입 예정, 지금은 방향성 확인용.

전제:
  - pip install anthropic
  - export ANTHROPIC_API_KEY='...' (Positron 연결용으로 이미 발급받은 키 그대로 사용 가능)
  - 입력은 e2e_results_all.csv의 "news_기사_목록" 컬럼
    (형식: "날짜|제목|URL ;; 날짜|제목|URL ;; ...")

usage:
    export ANTHROPIC_API_KEY='...'
    python news_relevance_llm_example.py
"""
from __future__ import annotations

import json
import os

import anthropic
import pandas as pd

MODEL = "claude-haiku-4-5-20251001"  # 대량 분류용 — 빠르고 저렴


def parse_news_list(cell: str) -> list[dict]:
    """"날짜|제목|URL ;; ..." 문자열을 dict 리스트로 파싱."""
    if not isinstance(cell, str) or not cell.strip():
        return []
    articles = []
    for chunk in cell.split(";;"):
        parts = chunk.strip().split("|", 2)
        if len(parts) == 3:
            date, title, url = parts
            articles.append({"date": date.strip(), "title": title.strip(), "url": url.strip()})
    return articles


def classify_relevance(client: anthropic.Anthropic, hs4: str, item_name: str,
                        articles: list[dict]) -> list[dict]:
    """기사 제목 목록을 한 번에 LLM에 보내 품목별 관련도(Yes/No)+근거 판정."""
    if not articles:
        return []

    numbered = "\n".join(f"{i+1}. {a['title']}" for i, a in enumerate(articles))
    prompt = f"""너는 무역 공급망 리스크 분석가다. 아래는 HS4 {hs4}({item_name}) 품목의
공급망 리스크와 관련이 있을 수 있는 KOTRA 해외시장뉴스 제목 목록이다.

각 기사 제목만 보고, 이 품목의 공급/가격/규제 리스크와 "직접적으로" 관련이 있는지
판정해라. 단순히 비슷한 단어(예: "배터리", "소재", "공급망")가 겹치는 것만으로는
관련 있다고 보지 마라 — 실제로 이 품목의 원자재·생산·수출입에 영향을 줄 만한
내용인지가 기준이다.

[기사 목록]
{numbered}

각 기사에 대해 JSON 배열로만 응답해라. 다른 텍스트는 절대 포함하지 마라:
[{{"index": 1, "relevant": true/false, "reason": "10단어 이내 근거"}}, ...]
"""

    resp = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        judgments = json.loads(raw)
    except json.JSONDecodeError:
        print(f"  ⚠ JSON 파싱 실패, 원본 응답: {raw[:200]}")
        return []

    results = []
    for j in judgments:
        idx = j.get("index", 0) - 1
        if 0 <= idx < len(articles):
            results.append({**articles[idx], "relevant": j.get("relevant"),
                             "reason": j.get("reason", "")})
    return results


def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("환경변수 ANTHROPIC_API_KEY 를 설정하세요.")

    client = anthropic.Anthropic(api_key=api_key)

    path = "data/e2e_results_all.csv"
    if not os.path.exists(path):
        raise SystemExit(f"{path} 가 없습니다. pipeline_final.py를 먼저 실행하세요.")

    df = pd.read_csv(path, dtype={"hs4": str})

    for _, row in df.iterrows():
        hs4 = row["hs4"]
        item_name = row["품목명"]
        articles = parse_news_list(row.get("news_기사_목록", ""))
        risk_articles = parse_news_list(row.get("위험국_공급망뉴스_목록", ""))
        all_articles = articles + risk_articles
        # 중복 제거 (url 기준)
        seen = set()
        dedup = []
        for a in all_articles:
            if a["url"] not in seen:
                seen.add(a["url"])
                dedup.append(a)

        if not dedup:
            print(f"\n[{hs4}] {item_name} — 판정할 기사 없음")
            continue

        print(f"\n[{hs4}] {item_name} — 기사 {len(dedup)}건 LLM 판정 중...")
        results = classify_relevance(client, hs4, item_name, dedup)

        relevant = [r for r in results if r["relevant"]]
        print(f"  관련 있음: {len(relevant)}/{len(results)}건")
        for r in relevant:
            print(f"    ✓ [{r['date']}] {r['title']}")
            print(f"        이유: {r['reason']}")
            print(f"        {r['url']}")


if __name__ == "__main__":
    main()
