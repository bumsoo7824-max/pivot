# -*- coding: utf-8 -*-
"""
export_today_events.py — discover.db에서 "오늘"(as_of) 수집된 이벤트 전체를 status별로
site/public/data/today_events.json으로 내보낸다.

2026-09-29: 관리자 UI의 4개 통계 박스(오늘 수집/CANDIDATE/확정 Yes)를 눌렀을 때 실제 수집된
이벤트 목록으로 연결하기 위해 추가. workflow.json(집계 숫자만)과 달리 이 파일은 이벤트 단위
원자료를 담는다 — 너무 커지지 않도록 오늘 하루 치만 내보낸다(전체 누적은 discover.db에만 존재).

사용법: python export_today_events.py --db discover.db --out ../site/public/data/today_events.json
build_workflow_data.py 실행 직후, 같은 CI 스텝에서 함께 실행한다.
"""
import argparse
import json
import sqlite3
from datetime import datetime, timezone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="discover.db")
    ap.add_argument("--out", default="../site/public/data/today_events.json")
    a = ap.parse_args()

    con = sqlite3.connect(a.db)
    con.row_factory = sqlite3.Row

    # today_counts.json/workflow.json과 동일한 기준: published 날짜의 "오늘"(KST 기준 as_of 날짜).
    # discover.db published는 로컬 실행 시각 그대로 저장되므로 최신 published 날짜를 as_of로 삼는다.
    row = con.execute("SELECT max(substr(published,1,10)) AS d FROM events_raw").fetchone()
    as_of = row["d"] if row and row["d"] else datetime.now().strftime("%Y-%m-%d")

    rows = con.execute(
        "SELECT source, published, title, url, disrupt, materials, status "
        "FROM events_raw WHERE substr(published,1,10) = ? ORDER BY published DESC",
        (as_of,),
    ).fetchall()

    events = [
        {
            "source": r["source"],
            "published": r["published"],
            "title": r["title"],
            "url": r["url"],
            "disrupt": r["disrupt"] or "",
            "materials": r["materials"] or "",
            "status": r["status"] or "NONE",
        }
        for r in rows
    ]

    out = {
        "as_of": as_of,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(events),
        "events": events,
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"[저장] {a.out} — {as_of} 기준 {len(events)}건")


if __name__ == "__main__":
    main()
