# -*- coding: utf-8 -*-
"""
aggregate_today.py — discover_collect.py가 쌓아온 SQLite(discover.db)에서 오늘 자 실측
현황을 뽑아 data/workflow_raw/today_counts.json으로 저장한다. build_workflow_data.py가 이
파일을 읽어 workflow.json에 "today"(실측 가동 라이브 카운터) 필드로 얹는다.

discover.db는 GitHub Actions 작업이 끝날 때마다 저장소에 커밋해서(=.github/workflows/
refresh_workflow.yml) 다음 실행에서도 이어서 누적되게 한다 — 매번 새 DB로 시작하면
"오늘 신규" 집계가 실행할 때마다 리셋돼버림.

실행:
    python pipeline_v2/aggregate_today.py --db pipeline_v2/discover.db
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "workflow_raw" / "today_counts.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(Path(__file__).resolve().parent / "discover.db"))
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"[안내] discover.db 없음({db_path}) — 아직 한 번도 수집 안 됨. today_counts.json 생성 건너뜀.")
        return

    con = sqlite3.connect(str(db_path))
    day = datetime.now().strftime("%Y-%m-%d")

    total_row = con.execute("SELECT COUNT(*), COALESCE(SUM(relevant),0) FROM events_raw").fetchone()
    cand_total = con.execute("SELECT COUNT(*) FROM events_raw WHERE status='CANDIDATE'").fetchone()[0]

    today_row = con.execute(
        "SELECT COUNT(*), COALESCE(SUM(relevant),0), "
        "SUM(CASE WHEN status='CANDIDATE' THEN 1 ELSE 0 END) "
        "FROM events_raw WHERE first_seen>=?", (day,)
    ).fetchone()

    last_run = con.execute(
        "SELECT run_at, source, fetched, new, new_relevant, err FROM runs ORDER BY run_at DESC LIMIT 5"
    ).fetchall()

    out = {
        "as_of": day,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "cumulative": {"total_events": total_row[0], "total_relevant": total_row[1], "total_candidate": cand_total},
        "today": {
            "new_events": today_row[0] or 0,
            "new_relevant": today_row[1] or 0,
            "new_candidate": today_row[2] or 0,
        },
        "last_runs": [
            {"run_at": r[0], "source": r[1], "fetched": r[2], "new": r[3], "new_relevant": r[4], "err": r[5] or None}
            for r in last_run
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[저장] {OUT} — 누적 {total_row[0]}건(relevant {total_row[1]}) / 오늘 신규 {today_row[0] or 0}건")


if __name__ == "__main__":
    main()
