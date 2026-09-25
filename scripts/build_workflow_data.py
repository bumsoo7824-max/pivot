# -*- coding: utf-8 -*-
"""
build_workflow_data.py — 뉴스 조기경보 워크플로우(①~⑩) 전용 데이터 빌드.

build_static_data.py(272/355 기준, 기존 페이지 전체가 쓰는 파이프라인)는 건드리지 않는
별도 스크립트다. 입력도 별도(data/workflow_raw/), 출력도 별도(site/public/data/workflow.json)
라 기존 9개 JSON·기존 페이지는 이 스크립트를 실행해도 전혀 영향받지 않는다.

지금은 2026-09-25 세션(별도 저장소 supply_pivot_v2)에서 확정한 값을
data/workflow_raw/session_summary.json에 수동으로 옮겨 담은 스냅샷을 그대로 정제해서 내보낸다.
추후 pipeline_v2/discover_collect.py를 실제로 돌리게 되면(=.github/workflows/refresh_workflow.yml),
그 실행 결과(수집 건수, CANDIDATE 큐 크기 등)로 session_summary.json의 해당 필드를 덮어쓰도록
확장하면 된다 — 지금 이 스크립트의 구조(steps/recall_rounds/operations 그대로 통과)는 안 바뀐다.

실행:
    python scripts/build_workflow_data.py
산출물:
    site/public/data/workflow.json
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "workflow_raw" / "session_summary.json"
TODAY_COUNTS = ROOT / "data" / "workflow_raw" / "today_counts.json"
OUT = ROOT / "site" / "public" / "data" / "workflow.json"

REQUIRED_STEP_KEYS = {"id", "title", "tone", "status", "summary", "detail"}
VALID_TONES = {"gray", "blue", "red", "amber", "green"}
VALID_STATUS = {"done", "partial", "reference_only", "planned"}


def load_raw() -> dict:
    if not RAW.exists():
        raise SystemExit(f"[오류] 원자료 없음: {RAW}")
    return json.loads(RAW.read_text(encoding="utf-8"))


def validate(data: dict) -> list[str]:
    problems = []
    steps = data.get("steps", [])
    if len(steps) != 10:
        problems.append(f"steps 개수가 10이 아님: {len(steps)}")
    ids = [s.get("id") for s in steps]
    if ids != list(range(1, len(steps) + 1)):
        problems.append(f"step id가 1..10 순서가 아님: {ids}")
    for s in steps:
        missing = REQUIRED_STEP_KEYS - s.keys()
        if missing:
            problems.append(f"step {s.get('id')}: 필드 누락 {missing}")
        if s.get("tone") not in VALID_TONES:
            problems.append(f"step {s.get('id')}: tone 값 이상함({s.get('tone')})")
        if s.get("status") not in VALID_STATUS:
            problems.append(f"step {s.get('id')}: status 값 이상함({s.get('status')})")
    for r in data.get("recall_rounds", []):
        if not (0 <= r.get("recall", -1) <= 100):
            problems.append(f"round {r.get('round')}: recall 값 범위 이상함({r.get('recall')})")
    return problems


def main() -> None:
    data = load_raw()
    problems = validate(data)
    if problems:
        print("[검증 실패] 아래 문제를 고치기 전엔 workflow.json을 새로 쓰지 않음(이전 산출물 유지):")
        for p in problems:
            print(f"  - {p}")
        raise SystemExit(1)

    live = None
    if TODAY_COUNTS.exists():
        try:
            live = json.loads(TODAY_COUNTS.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"[경고] today_counts.json 파싱 실패({e}) — live 카운터 없이 진행")

    out = {
        **data,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "supply_pivot_v2 세션(2026-09-25) — build_static_data.py(기존 9개 JSON)와 독립",
        "live": live,  # pipeline_v2/aggregate_today.py 산출물. 아직 실측 가동 전이면 null.
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[저장] {OUT} ({OUT.stat().st_size:,} bytes) — steps {len(out['steps'])}개, "
          f"recall_rounds {len(out['recall_rounds'])}개")


if __name__ == "__main__":
    main()
