# -*- coding: utf-8 -*-
"""dashboard.py 와 같은 데이터·같은 섹션 구성으로 정적 HTML 을 만든다 → site/index.html

Streamlit 은 서버 런타임이 필요해 정적 export 가 되지 않는다. 그래서 대시보드를
'변환'하는 게 아니라, 같은 산출물을 읽어 서버 없이 열리는 단일 HTML 로 다시 그린다.
Plotly 는 CDN 이 아니라 인라인으로 넣어 오프라인에서도 열린다.

섹션 구성은 dashboard.py 와 동일하다.
  품목 카드 → 사각지대 산점도 → 대체 공급국 / 지원기관 연결
  → 과거 사태 소급 검증(HHI) → 뉴스 신호(실시간)

usage: python scripts/build_static_html.py
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"
OUT = ROOT / "site" / "index.html"

GRADE_COLOR = {"RED": "#f0526d", "YELLOW": "#f5a524", "GREEN": "#3ecf8e"}
GROUP_MAIN = "MVP 10"
GROUP_REF = "비철금속 15 (참고)"


def read_csv(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    return None


def ym(v: object) -> str:
    """202302.0 처럼 실수로 읽힌 연월을 202302 로 되돌린다."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).split(".")[0]


def esc(v: object) -> str:
    return html.escape("" if v is None or (isinstance(v, float) and pd.isna(v)) else str(v))


def fig_html(fig: go.Figure, first: bool) -> str:
    """첫 그림에만 plotly.js 를 인라인으로 넣고, 나머지는 재사용한다."""
    return pio.to_html(fig, include_plotlyjs=("inline" if first else False),
                       full_html=False, config={"displayModeBar": False})


# ─────────────────────────────────────────────────────────── 섹션
def section_items(items: pd.DataFrame) -> str:
    main = items[items["group"] == GROUP_MAIN]
    cards = []
    for r in main.itertuples():
        color = GRADE_COLOR.get(str(r.위험등급), "#94a3b8")
        imp = ("산출 불가" if pd.isna(r.수입액합계)
               else f"{r.수입액합계 / 1e8:.1f}억 달러")
        cnt = "산출 불가" if pd.isna(r.수입국수) else f"{int(r.수입국수)}개국"
        cards.append(f"""
        <article class="card" style="border-top:4px solid {color}">
          <div class="code">{esc(r.code)}</div>
          <h3>{esc(r.품목명)}</h3>
          <span class="badge" style="background:{color}1a;color:{color}">● {esc(r.위험등급)}</span>
          <dl>
            <div><dt>HHI</dt><dd>{r.HHI:.4f}</dd></div>
            <div><dt>1위국</dt><dd>{esc(r._5)} {r._6 * 100:.1f}%</dd></div>
            <div><dt>수입액</dt><dd>{esc(imp)}</dd></div>
            <div><dt>상대국</dt><dd>{esc(cnt)}</dd></div>
          </dl>
        </article>""")
    note = esc(main["등급출처"].iat[0]) if len(main) else ""
    return f"""
    <section id="items">
      <h2>MVP {len(main)}개 품목</h2>
      <p class="hint">위험등급 출처 · {note} · 기준월 {esc(str(main['기준월'].iat[0]).split('.')[0]) if len(main) else ''}</p>
      <div class="grid">{''.join(cards)}</div>
    </section>"""


def section_blindspots(blind: pd.DataFrame, items: pd.DataFrame) -> tuple[str, go.Figure]:
    b = blind.copy()
    b["hs4"] = b["hs4"].astype(str).str.zfill(4)
    fig = go.Figure()
    for grade, d in b.groupby("위험등급"):
        fig.add_trace(go.Scatter(
            x=d["HHI"], y=d["1위국비중"], mode="markers", name=str(grade),
            marker=dict(color=GRADE_COLOR.get(str(grade), "#94a3b8"),
                        size=(d["수입액합계"].clip(lower=1) ** 0.16), opacity=0.75),
            text=d["hs4"] + " · " + d["품목명"].astype(str).str[:30],
            hovertemplate="%{text}<br>HHI %{x:.4f}<br>1위국 비중 %{y:.1%}<extra></extra>",
        ))
    fig.add_vline(x=0.25, line_dash="dash", line_color="#f0526d", opacity=0.5,
                  annotation_text="참조선 HHI 0.25")
    fig.add_hline(y=0.40, line_dash="dash", line_color="#f0526d", opacity=0.5,
                  annotation_text="참조선 1위국 비중 0.40")
    fig.update_layout(height=460, margin=dict(t=30, b=40, l=50, r=20),
                      xaxis_title="HHI (수입 집중도)", yaxis_title="1위국 비중",
                      legend_title_text="", plot_bgcolor="#fff")

    main_hs4 = {c[:4] for c in items.loc[items["group"] == GROUP_MAIN, "code"].astype(str)}
    overlap = sorted(main_hs4 & set(b["hs4"]))
    note = (f"MVP {len(overlap)}개 품목이 이 사각지대 목록에 포함돼 있습니다: "
            f"{', '.join(overlap)}" if overlap else
            "MVP 품목(" + "·".join(sorted(main_hs4)) + ")은 이 사각지대 목록에 "
            "포함되지 않습니다. 위 산점도는 전체 분포 참고용입니다.")
    return f"""
    <section id="blindspots">
      <h2>사각지대 스크리닝</h2>
      <p class="hint">원본 목록 step4_blind_spots.csv {len(b)}행을 그대로 표시합니다.
         점선 두 개는 읽기 보조용 참조선이며 판정 기준이 아닙니다.</p>
      __FIG_BLIND__
      <p class="callout">{esc(note)}</p>
    </section>""", fig


def section_alt(items: pd.DataFrame, alt: pd.DataFrame, action: pd.DataFrame) -> str:
    main = items[items["group"] == GROUP_MAIN]
    blocks = []
    for r in main.itertuples():
        code = str(r.code)
        rows = alt[alt["code"].astype(str).str.zfill(len(code)) == code]
        ok = rows[rows["status"] == "ok"].sort_values("rank")
        if len(ok):
            lis = "".join(
                f"<li><b>{int(a.rank)}. {esc(a.alt_country)}</b> — 비중 "
                f"{a.share * 100:.1f}% · ${a.value_usd:,.0f}</li>"
                for a in ok.itertuples())
            alt_html = f'<span class="ok">실측 데이터 · {esc(ok["source"].iat[0])}</span><ul>{lis}</ul>'
        else:
            reason = esc(rows["note"].iat[0]) if len(rows) else "산출 기록 없음"
            alt_html = f'<div class="na"><b>산출 불가</b><br>{reason}</div>'

        arows = action[action["code"].astype(str).str.zfill(len(code)) == code]
        linked = arows[arows["smba_네트워크명"].notna()].sort_values("rank")
        if len(linked):
            lis = "".join(
                f"<li>{esc(a.alt_country)} · {esc(a.smba_네트워크명)}"
                + (f" <span class='muted'>(KOTRA 법인 {int(a.kotra_해외법인수)}사)</span>"
                   if pd.notna(a.kotra_해외법인수) else "") + "</li>"
                for a in linked.itertuples())
            act_html = f"<ul>{lis}</ul><p class='muted'>국가 단위 접점입니다. 기업 대 기업 매칭이 아닙니다.</p>"
        else:
            act_html = ('<div class="na"><b>산출 불가</b><br>대체 공급국에 대응하는 '
                        '중진공 해외전략네트워크 거점이 없습니다.</div>')

        blocks.append(f"""
        <details>
          <summary><span class="code">{esc(r.code)}</span> {esc(r.품목명)}
            <span class="badge" style="background:{GRADE_COLOR.get(str(r.위험등급), '#94a3b8')}1a;
              color:{GRADE_COLOR.get(str(r.위험등급), '#94a3b8')}">{esc(r.위험등급)}</span></summary>
          <div class="two">
            <div><h4>대체 공급국</h4>{alt_html}</div>
            <div><h4>지원기관 연결</h4>{act_html}</div>
          </div>
        </details>""")
    return f"""
    <section id="alt">
      <h2>대체 공급국 · 지원기관 연결</h2>
      <p class="hint">품목을 펼치면 1위국을 제외한 상위 5개국과 그 나라의 중진공 거점이 나옵니다.</p>
      {''.join(blocks)}
    </section>"""


def section_backtest(lead: pd.DataFrame, series: pd.DataFrame) -> tuple[str, go.Figure]:
    ok = lead[lead["status"] == "ok"]
    detected = lead[lead["status"].isin(["ok", "급등 전 RED 없음 (미탐지)"])]
    pick = ok.sort_values("lead_months", ascending=False)["hs6"].astype(str).iat[0]
    s = series[series["hs6"].astype(str) == pick].sort_values("ym").copy()
    s["ym_str"] = s["ym"].astype(str).str.zfill(6)
    s["x"] = pd.to_datetime(s["ym_str"], format="%Y%m")
    row = lead[lead["hs6"].astype(str) == pick].iloc[0]

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=s["x"], y=s["unit_price"], mode="lines+markers",
                             name="수입 단가 (USD/톤)", line=dict(color="#57a6ff", width=2)))
    reds = s[s["grade_calc"] == "RED"]
    if len(reds):
        fig.add_trace(go.Scatter(x=reds["x"], y=reds["unit_price"], mode="markers",
                                 name="RED 경보",
                                 marker=dict(color="#f0526d", size=11, symbol="triangle-up")))
    surges = s[s["surge"].astype(bool)]
    if len(surges):
        fig.add_trace(go.Scatter(x=surges["x"], y=surges["unit_price"], mode="markers",
                                 name="급등 구간",
                                 marker=dict(color="#f5a524", size=13, symbol="x")))
    # 범주축에서는 add_vline 의 자동 주석 위치 계산이 깨진다.
    # 선과 주석을 따로 그린다.
    # 주석이 서로 겹치지 않게 위아래로 어긋나게 둔다.
    for (col, color, label), y_pos in zip(
        (("alert_ym", "#f0526d", "경보"), ("surge_ym", "#f5a524", "급등")), (1.10, 1.02)
    ):
        lbl = ym(row[col]).zfill(6)
        x = pd.to_datetime(lbl, format="%Y%m")
        fig.add_shape(type="line", x0=x, x1=x, yref="paper", y0=0, y1=1,
                      line=dict(color=color, dash="dot", width=1.5))
        fig.add_annotation(x=x, yref="paper", y=y_pos, showarrow=False,
                           text=f"{label} {lbl[:4]}.{lbl[4:]}",
                           font=dict(color=color, size=11))
    fig.update_layout(height=430, margin=dict(t=60, b=40, l=60, r=20),
                      xaxis_title="관측월", yaxis_title="수입 단가 (USD/톤)",
                      xaxis=dict(type="date", tickformat="%Y.%m", dtick="M4", tickangle=-45),
                      plot_bgcolor="#fff")

    trs = "".join(
        f"<tr><td>{esc(r.hs6)}</td><td>{esc(r.품목명)}</td>"
        f"<td>{ym(getattr(r, 'alert_ym', ''))}</td><td>{ym(getattr(r, 'surge_ym', ''))}</td>"
        f"<td class='num'>{'' if pd.isna(r.lead_months) else int(r.lead_months)}</td>"
        f"<td>{esc(r.status)}</td></tr>"
        for r in lead.itertuples())

    return f"""
    <section id="backtest">
      <h2>과거 사태 소급 검증 — 관세청 HHI 기반 구조 진단</h2>
      <p class="hint">소급 검증은 관세청 HHI 기반 구조 진단이 담당합니다.
         42개월 실측 구간에서 RED 경보가 단가 급등보다 얼마나 앞섰는지를 측정합니다.</p>
      <div class="metrics">
        <div><span class="label">급등 발생 품목</span><span class="value">{len(detected)}개</span></div>
        <div><span class="label">사전 경보 성공</span><span class="value">{len(ok)}개</span>
             <span class="sub">{len(ok) / len(detected) * 100:.0f}%</span></div>
        <div><span class="label">선행 개월 중앙값</span>
             <span class="value">{ok['lead_months'].median():.1f}개월</span></div>
      </div>
      <h4>{esc(row['품목명'])} ({esc(pick)}) — 경보 {ym(row['alert_ym'])} → 급등 {ym(row['surge_ym'])},
          {int(row['lead_months'])}개월 선행</h4>
      __FIG_BACKTEST__
      <p class="hint">경보(RED) = 구조 취약(HHI ≥ 0.50 이고 1위국 비중 ≥ 70%) <b>그리고</b>
        초기 가격 신호(전월대비 ≥ 3% 또는 3개월 누적 ≥ 6%).
        급등 = 3개월 누적 ≥ 20% 또는 전월대비 ≥ 10%.
        검증 구간은 관세청 원자료 42개월(2023-01~2026-06)입니다.</p>
      <table><thead><tr><th>HS6</th><th>품목명</th><th>경보</th><th>급등</th>
        <th>선행(개월)</th><th>상태</th></tr></thead><tbody>{trs}</tbody></table>
    </section>""", fig


def section_news(news: pd.DataFrame, meta: dict | None) -> str:
    badge = ""
    if meta:
        rt = meta.get("realtime_test", {})
        srcs = " + ".join(f"{x['name']} {x['count']}건" for x in rt.get("sources", []))
        badge = f"""
        <p class="role">{esc(meta.get('role_note', ''))}</p>
        <p class="ok big">{esc(rt.get('label', ''))}: {esc(rt.get('case', ''))} 기준
           {esc(rt.get('result', ''))} ({esc(srcs)})</p>
        <p class="muted">{esc(rt.get('provenance', ''))}</p>"""

    rows = news.sort_values("othbcDt", ascending=False).head(40)
    trs = "".join(
        f"<tr><td>{esc(r.othbcDt)}</td><td>{esc(r.natn)}</td><td>{esc(r.indstCl)}</td>"
        f"<td><a href='{esc(r.kotraNewsUrl)}' target='_blank' rel='noopener'>{esc(r.제목)}</a></td></tr>"
        for r in rows.itertuples())
    return f"""
    <section id="news">
      <h2>뉴스 신호 — 실시간 정책·규제 동향 감지</h2>
      {badge}
      <p class="hint">최근 90일 수집분 중 공급망 관련 {len(news)}건
         ({esc(news['othbcDt'].min())} ~ {esc(news['othbcDt'].max())}) · 최신 {len(rows)}건 표시</p>
      <table><thead><tr><th>일자</th><th>국가</th><th>산업</th><th>제목</th></tr></thead>
        <tbody>{trs}</tbody></table>
    </section>"""


CSS = """
*{box-sizing:border-box}
body{margin:0;font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  color:#1c2333;background:#f7f8fb;line-height:1.6}
header{background:#0b1020;color:#fff;padding:32px 24px}
header h1{margin:0 0 6px;font-size:28px}
header p{margin:0;color:#9fb0c9;font-size:14px}
main{max-width:1180px;margin:0 auto;padding:24px}
section{background:#fff;border:1px solid #e5e8f0;border-radius:12px;padding:22px;margin-bottom:22px}
h2{margin:0 0 6px;font-size:20px}
h3{margin:6px 0;font-size:15px;line-height:1.4}
h4{margin:14px 0 8px;font-size:14px}
.hint{margin:0 0 14px;color:#64748b;font-size:13px}
.muted{color:#94a3b8;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.card{border:1px solid #e5e8f0;border-radius:10px;padding:14px;background:#fcfdff}
.code{font-family:ui-monospace,monospace;font-size:12px;color:#2dd4bf}
.badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
dl{margin:10px 0 0;font-size:13px}
dl div{display:flex;justify-content:space-between;border-top:1px solid #f1f3f8;padding:4px 0}
dt{color:#94a3b8}dd{margin:0;font-family:ui-monospace,monospace}
.metrics{display:flex;gap:28px;flex-wrap:wrap;margin:12px 0 18px}
.metrics .label{display:block;color:#94a3b8;font-size:12px}
.metrics .value{font-size:26px;font-weight:700;font-family:ui-monospace,monospace}
.metrics .sub{color:#3ecf8e;font-size:12px;margin-left:6px}
details{border:1px solid #e5e8f0;border-radius:10px;padding:10px 14px;margin-bottom:8px}
summary{cursor:pointer;font-weight:600;font-size:14px}
summary .badge{margin-left:8px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:12px}
@media(max-width:820px){.two{grid-template-columns:1fr}}
ul{margin:8px 0;padding-left:18px;font-size:13px}
.ok{display:inline-block;background:#eafaf3;color:#0f9d6b;border-radius:6px;
  padding:4px 10px;font-size:12px;font-weight:600}
.ok.big{font-size:14px;padding:10px 14px;display:block}
.role{background:#f1f5ff;border-left:3px solid #57a6ff;padding:10px 14px;
  border-radius:0 8px 8px 0;font-size:13px;color:#334155;margin:0 0 12px}
.na{background:#fff8e6;border:1px dashed #f0c975;border-radius:8px;padding:10px 12px;font-size:13px}
.callout{background:#f1f5ff;border-radius:8px;padding:12px 14px;font-size:13px;color:#334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
th{text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e5e8f0;padding:8px 6px}
td{border-bottom:1px solid #f1f3f8;padding:7px 6px;vertical-align:top}
td.num{font-family:ui-monospace,monospace;text-align:right}
a{color:#0f766e}
footer{max-width:1180px;margin:0 auto;padding:8px 24px 40px;color:#94a3b8;font-size:12px}
"""


def main() -> None:
    items = read_csv(PROC / "items_overview.csv")
    alt = read_csv(PROC / "alt_countries.csv")
    action = read_csv(PROC / "action_link.csv")
    blind = read_csv(RAW / "step4_blind_spots.csv")
    lead = read_csv(PROC / "backtest_leadtime.csv")
    series = read_csv(PROC / "backtest_leadtime_series.csv")
    news = pd.read_parquet(RAW / "kotra_news.parquet")
    news = news[news["공급망_관련"]].copy()
    news["제목"] = news["newsTitl"].map(
        lambda s: re.sub(r"\s+", " ", html.unescape(str(s))).strip())
    meta_path = ROOT / "data" / "news_signal_test.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else None

    for name, df in [("items_overview", items), ("alt_countries", alt),
                     ("action_link", action), ("step4_blind_spots", blind),
                     ("backtest_leadtime", lead)]:
        if df is None:
            raise SystemExit(f"{name} 없음 — 파이프라인을 먼저 실행하세요")

    items["code"] = [str(c).zfill(6) if lv == "hs6" else str(c).zfill(4)
                     for c, lv in zip(items["code"], items["code_level"])]

    s_items = section_items(items)
    s_blind, fig_blind = section_blindspots(blind, items)
    s_alt = section_alt(items, alt, action)
    s_back, fig_back = section_backtest(lead, series)
    s_news = section_news(news, meta)

    s_blind = s_blind.replace("__FIG_BLIND__", fig_html(fig_blind, first=True))
    s_back = s_back.replace("__FIG_BACKTEST__", fig_html(fig_back, first=False))

    built = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Supply-Pivot 대시보드 (정적)</title><style>{CSS}</style></head>
<body>
<header>
  <h1>Supply-Pivot 대시보드</h1>
  <p>구조적 취약성은 관세청 통계로 깔고, 방아쇠는 수입물가지수와 정책 동향으로 당긴다.</p>
</header>
<main>
{s_items}
{s_blind}
{s_alt}
{s_back}
{s_news}
</main>
<footer>
  dashboard.py 와 같은 산출물로 만든 정적 페이지입니다. 빌드 {built} ·
  모든 수치는 사전 계산된 값이며 화면에서 외부 API를 호출하지 않습니다.
  데이터가 없는 항목은 0이 아니라 '산출 불가'로 표기합니다.
</footer>
</body></html>"""

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"→ {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")
    print(f"   섹션 5개 · 품목 {int((items['group'] == GROUP_MAIN).sum())}개 · "
          f"뉴스 {len(news)}건 · 소급 검증 {len(lead)}행")


if __name__ == "__main__":
    main()
