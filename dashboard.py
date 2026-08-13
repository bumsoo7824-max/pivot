# -*- coding: utf-8 -*-
"""Supply-Pivot 데모 대시보드 (Streamlit)

실행:
    streamlit run dashboard.py

읽는 파일은 전부 사전 계산 산출물이다. 화면에서 외부 API 를 호출하지 않는다.
  data/raw/mvp_10.csv                    MVP 10개 품목
  data/raw/step4_blind_spots.csv         사각지대 256개 (단일 출처)
  data/raw/kotra_news.parquet            KOTRA 해외시장뉴스
  data/processed/alt_countries.csv       STEP 1 대체 공급국
  data/processed/action_link.csv         STEP 2 지원기관 연결
  data/processed/backtest_leadtime*.csv  STEP 3 소급 검증 (42개월 리드타임)
  data/news_signal_test.json             뉴스 신호 모듈 실시간 테스트 결과

표기 원칙 — 데이터가 없는 칸에 0 을 넣지 않고 '산출 불가'로 적는다.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw"
PROC = ROOT / "data" / "processed"

GRADE_COLOR = {"RED": "#f0526d", "YELLOW": "#f5a524", "GREEN": "#3ecf8e"}

st.set_page_config(page_title="Supply-Pivot 대시보드", page_icon="🧭", layout="wide")


# ────────────────────────────────────────────────────────────── 로더
@st.cache_data
def load_csv(path: Path) -> pd.DataFrame | None:
    if not path.exists():
        return None
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    return None


@st.cache_data
def load_news() -> pd.DataFrame | None:
    path = RAW / "kotra_news.parquet"
    if not path.exists():
        return None
    import html
    import re

    df = pd.read_parquet(path)
    df = df[df["공급망_관련"]].copy()
    df["제목"] = df["newsTitl"].map(
        lambda s: re.sub(r"\s+", " ", html.unescape(str(s))).strip()
    )
    return df


@st.cache_data
def load_news_signal_meta() -> dict | None:
    """뉴스 신호 모듈의 역할·실시간 테스트 결과. 값은 모듈 검증 결과를 그대로 싣는다."""
    import json

    path = ROOT / "data" / "news_signal_test.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def missing(label: str, path: Path) -> None:
    st.warning(f"**산출 불가** — {label}\n\n`{path.relative_to(ROOT)}` 파일이 없습니다. "
               f"해당 STEP 스크립트를 먼저 실행하세요.")


mvp = load_csv(RAW / "mvp_10.csv")
blind = load_csv(RAW / "step4_blind_spots.csv")
alt = load_csv(PROC / "alt_countries.csv")
action = load_csv(PROC / "action_link.csv")
overview = load_csv(PROC / "items_overview.csv")
lead = load_csv(PROC / "backtest_leadtime.csv")
lead_series = load_csv(PROC / "backtest_leadtime_series.csv")
news = load_news()
news_meta = load_news_signal_meta()

if mvp is None:
    st.error("data/raw/mvp_10.csv 가 없습니다. 데이터를 먼저 배치하세요.")
    st.stop()

mvp["hs4"] = mvp["hs4"].astype(str).str.zfill(4)

GROUP_MAIN = "MVP 10"
GROUP_REF = "비철금속 15 (참고)"

if overview is None:
    st.error("data/processed/items_overview.csv 가 없습니다. "
             "`python scripts/step1_alt_countries.py` 를 먼저 실행하세요.")
    st.stop()

items = overview.copy()
items["code"] = items["code"].astype(str)
# code_level 에 맞춰 자릿수를 채운다 (MVP 10 은 HS4, 비철금속 15 는 HS6)
items["code"] = [c.zfill(6) if lv == "hs6" else c.zfill(4)
                 for c, lv in zip(items["code"], items["code_level"])]


# ────────────────────────────────────────────────────────────── 사이드바
st.sidebar.title("🧭 Supply-Pivot")
st.sidebar.caption("데이터로 발굴한 공급망 사각지대 → 대체 경로")

# 기본 화면은 MVP 10 만 보여준다. 비철금속 15 는 참고용이라 체크해야 나온다.
show_ref = st.sidebar.toggle(
    "비철금속 15 (참고용) 함께 보기", value=False,
    help="관세청 국가별 원자료가 있는 HS6 15개 품목. 대체 공급국이 실측으로 "
         "채워져 지원기관 연결까지 이어집니다.",
)
pool = items if show_ref else items[items["group"] == GROUP_MAIN]

labels = {
    r.code: (f"{r.code} · {r.품목명}"
             + (f"  [{GROUP_REF}]" if r.group == GROUP_REF else ""))
    for r in pool.itertuples()
}
sel_code = st.sidebar.selectbox(
    "품목 선택", options=list(labels), format_func=lambda k: labels[k]
)
item = pool[pool["code"] == sel_code].iloc[0]

st.sidebar.divider()
st.sidebar.markdown(
    f"""
**데이터 현황**

- 사각지대 {len(blind) if blind is not None else '—'}개 품목
- MVP {int((items["group"] == GROUP_MAIN).sum())}개 · 비철금속 참고 {int((items["group"] == GROUP_REF).sum())}개
- 대체 공급국 {int((alt['status'] == 'ok').sum()) if alt is not None else '—'}행 (실측)
- 지원기관 연결 {len(action) if action is not None else '—'}행
- 공급망 뉴스 {len(news) if news is not None else '—'}건
"""
)
st.sidebar.divider()
st.sidebar.caption(
    "지표는 **월 단위 수입물가지수**이며 일일 가격이 아닙니다. "
    "대체 공급은 **국가 단위 발굴 + 지원기관 연결**까지이고 기업 대 기업 매칭이 아닙니다. "
    "예측이 아니라 확정 통계에 대한 진단·산출·경보입니다."
)


# ────────────────────────────────────────────────────────────── 헤더
st.title("Supply-Pivot 데모 대시보드")
st.caption(
    "구조적 취약성은 관세청 통계로 깔고, 방아쇠는 수입물가지수와 정책 동향으로 당긴다."
)

grade = str(item["위험등급"])
color = GRADE_COLOR.get(grade, "#94a3b8")

st.markdown(f"### {item['품목명']}  <span style='color:{color}'>● {grade}</span>",
            unsafe_allow_html=True)
if "등급출처" in item.index and pd.notna(item["등급출처"]):
    st.caption(f"위험등급 출처 · {item['등급출처']}"
               + (f" · 기준월 {str(item['기준월']).split('.')[0]}"
                  if pd.notna(item.get("기준월")) else ""))

c1, c2, c3, c4 = st.columns(4)
c1.metric("HHI (수입 집중도)", f"{item['HHI']:.4f}", help="1에 가까울수록 한 나라에 쏠림")
c2.metric("1위국", str(item["1위국"]), f"비중 {item['1위국비중'] * 100:.1f}%",
          delta_color="off")
c3.metric("수입액", f"{item['수입액합계'] / 1e8:.1f}억 달러"
          if pd.notna(item["수입액합계"]) else "산출 불가")
c4.metric("수입 상대국 수", f"{int(item['수입국수'])}개국"
          if pd.notna(item["수입국수"]) else "산출 불가")

st.markdown(
    f"<div style='height:6px;background:{color};border-radius:3px;margin:4px 0 20px'></div>",
    unsafe_allow_html=True,
)


# ────────────────────────────────────────────────────────────── 사각지대 산점도
st.subheader("사각지대 스크리닝")
if blind is None:
    missing("사각지대 산점도", RAW / "step4_blind_spots.csv")
else:
    b = blind.copy()
    b["hs4"] = b["hs4"].astype(str).str.zfill(4)
    # 사각지대 목록은 HS4 기준이라 HS6 선택 시 앞 4자리로 맞춘다
    sel_hs4 = sel_code[:4]
    b["선택품목"] = (b["hs4"] == sel_hs4).map({True: "선택 품목", False: "그 외"})
    fig = px.scatter(
        b, x="HHI", y="1위국비중", color="위험등급",
        color_discrete_map=GRADE_COLOR, symbol="선택품목",
        symbol_map={"선택 품목": "star", "그 외": "circle"},
        size=b["수입액합계"].clip(lower=1).pow(0.25),
        hover_data={"hs4": True, "품목명": True, "1위국": True,
                    "수입액합계": ":,.0f", "선택품목": False},
        labels={"HHI": "HHI (수입 집중도)", "1위국비중": "1위국 비중"},
        height=480,
    )
    fig.add_vline(x=0.25, line_dash="dash", line_color="#f0526d", opacity=0.5,
                  annotation_text="참조선 HHI 0.25")
    fig.add_hline(y=0.40, line_dash="dash", line_color="#f0526d", opacity=0.5,
                  annotation_text="참조선 1위국 비중 0.40")
    fig.update_layout(legend_title_text="", margin=dict(t=30, b=10))
    st.plotly_chart(fig, use_container_width=True)
    in_list = sel_hs4 in set(b["hs4"])
    st.caption(
        f"원본 목록 step4_blind_spots.csv {len(b)}행을 그대로 표시합니다. "
        f"점선 두 개는 읽기 보조용 참조선이며 판정 기준이 아닙니다."
    )
    if in_list:
        st.caption(f"선택한 품목({sel_code} → HS4 {sel_hs4})은 ★ 로 표시됩니다.")
    else:
        # 선택 품목이 사각지대 목록 밖이면 없는 점을 찍지 않고 그 사실을 적는다.
        st.info(
            f"선택한 품목 **{sel_code}(HS4 {sel_hs4})**는 이 사각지대 목록에 없습니다. "
            "사각지대 256개는 step3_hhi_all(HS4 339개, 화학·철강 중심) 모집단에서 나온 목록입니다. "
            "위 산점도는 전체 분포 참고용으로만 보십시오."
        )


# ────────────────────────────────────── 대체 공급국 + 지원기관 연결
left, right = st.columns(2)

with left:
    st.subheader("대체 공급국")
    if alt is None:
        missing("대체 공급국", PROC / "alt_countries.csv")
    else:
        rows = alt[alt["code"].astype(str).str.zfill(len(sel_code)) == sel_code]
        ok = rows[rows["status"] == "ok"]
        if len(ok):
            st.success(f"**실측 데이터** · 출처 {ok['source'].iat[0]}")
            for r in ok.sort_values("rank").itertuples():
                st.markdown(
                    f"**{int(r.rank)}. {r.alt_country}** — 비중 {r.share * 100:.1f}% "
                    f"· ${r.value_usd:,.0f}"
                )
            st.caption(str(ok["note"].iat[0]))
        elif len(rows):
            st.warning(
                f"**산출 불가** — {rows['note'].iat[0]}\n\n"
                "값이 없으므로 0을 대입하지 않습니다. "
                "`COMTRADE_KEY` 와 네트워크가 확보되면 "
                "`python scripts/step1_alt_countries.py` 로 이 칸이 채워집니다."
            )
        else:
            st.info("이 품목에 대한 대체 공급국 산출 기록이 없습니다.")

with right:
    st.subheader("지원기관 연결")
    if action is None:
        missing("지원기관 연결", PROC / "action_link.csv")
    else:
        rows = action[action["code"].astype(str).str.zfill(len(sel_code)) == sel_code]
        linked = rows[rows["smba_네트워크명"].notna()]
        if len(linked):
            for r in linked.sort_values("rank").itertuples():
                with st.expander(
                    f"{r.alt_country} · {r.smba_네트워크명}"
                    + (f" (KOTRA 법인 {int(r.kotra_해외법인수)}사)"
                       if pd.notna(r.kotra_해외법인수) else "")
                ):
                    st.markdown(f"**권역** {r.smba_권역}")
                    st.markdown(f"**지원형태** {r.smba_지원형태}")
                    st.markdown(f"**지원업종** {r.smba_지원업종}")
                    st.caption(str(r.smba_지원범위)[:300])
            st.caption("국가 단위 접점입니다. 기업 대 기업 매칭이 아닙니다.")
        elif len(rows):
            st.warning(
                "**산출 불가** — 이 품목의 대체 공급국에 대응하는 "
                "중진공 해외전략네트워크 거점이 없습니다 (전체 11개 거점 / 9개국)."
            )
        else:
            st.warning(
                "**산출 불가** — 대체 공급국이 산출되지 않아 지원기관까지 이어지지 않습니다."
            )


# ──────────────────────────────────────────────── 과거 사태 소급 검증 (HHI)
st.subheader("과거 사태 소급 검증 — 관세청 HHI 기반 구조 진단")
st.caption(
    "소급 검증은 관세청 HHI 기반 구조 진단이 담당합니다. "
    "42개월 실측 구간에서 RED 경보가 단가 급등보다 얼마나 앞섰는지를 측정합니다."
)

if lead is None or lead_series is None:
    missing("백테스트", PROC / "backtest_leadtime.csv")
else:
    ok = lead[lead["status"] == "ok"]
    detected = lead[lead["status"].isin(["ok", "급등 전 RED 없음 (미탐지)"])]
    m1, m2, m3 = st.columns(3)
    m1.metric("급등 발생 품목", f"{len(detected)}개")
    m2.metric("사전 경보 성공", f"{len(ok)}개",
              f"{len(ok) / len(detected) * 100:.0f}%" if len(detected) else None)
    m3.metric("선행 개월 중앙값",
              f"{ok['lead_months'].median():.1f}개월" if len(ok) else "산출 불가")

    pick = st.selectbox(
        "품목별 타임라인",
        options=lead["hs6"].astype(str).tolist(),
        format_func=lambda h: f"{h} · {lead.loc[lead['hs6'].astype(str) == h, '품목명'].iat[0]}",
    )
    s = lead_series[lead_series["hs6"].astype(str) == pick].sort_values("ym").copy()
    # "202301" 이 202301 이라는 수로 해석되지 않도록 라벨을 만들고 범주축으로 고정한다
    s["ym_str"] = s["ym"].astype(str).str.zfill(6)
    # 범주축에 수직선을 얹으면 눈금이 무너져 실제 날짜축을 쓴다.
    s["x"] = pd.to_datetime(s["ym_str"], format="%Y%m")

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=s["x"], y=s["unit_price"], mode="lines+markers",
        name="수입 단가 (USD/톤)", line=dict(color="#57a6ff", width=2),
    ))
    reds = s[s["grade_calc"] == "RED"]
    if len(reds):
        fig.add_trace(go.Scatter(
            x=reds["x"], y=reds["unit_price"], mode="markers",
            name="RED 경보", marker=dict(color="#f0526d", size=11, symbol="triangle-up"),
        ))
    surges = s[s["surge"] == True]  # noqa: E712 — pandas 불리언 비교
    if len(surges):
        fig.add_trace(go.Scatter(
            x=surges["x"], y=surges["unit_price"], mode="markers",
            name="급등 구간", marker=dict(color="#f5a524", size=13, symbol="x"),
        ))
    row = lead[lead["hs6"].astype(str) == pick].iloc[0]
    if row["status"] == "ok":
        for col, color, label, y_pos in (("alert_ym", "#f0526d", "경보", 1.10),
                                         ("surge_ym", "#f5a524", "급등", 1.02)):
            raw = str(row[col]).split(".")[0].zfill(6)
            x = pd.to_datetime(raw, format="%Y%m")
            fig.add_shape(type="line", x0=x, x1=x, yref="paper", y0=0, y1=1,
                          line=dict(color=color, dash="dot", width=1.5))
            fig.add_annotation(x=x, yref="paper", y=y_pos, showarrow=False,
                               text=f"{label} {raw[:4]}.{raw[4:]}",
                               font=dict(color=color, size=11))
    fig.update_layout(height=430, margin=dict(t=50, b=10),
                      xaxis_title="관측월", yaxis_title="수입 단가 (USD/톤)",
                      xaxis=dict(type="date", tickformat="%Y.%m", dtick="M4",
                                 tickangle=-45))
    st.plotly_chart(fig, use_container_width=True)

    if row["status"] == "ok":
        st.info(
            f"**{row['품목명']}** — 경보 {str(row['alert_ym']).split('.')[0]} → "
            f"급등 {str(row['surge_ym']).split('.')[0]}, "
            f"**{int(row['lead_months'])}개월 선행**. "
            f"급등월 전월대비 {row['surge_mom']:+.1f}%."
        )
    else:
        st.warning(f"**{row['품목명']}** — {row['status']}")

    st.caption(
        "경보(RED) = 구조 취약(HHI ≥ 0.50 이고 1위국 비중 ≥ 70%) **그리고** "
        "초기 가격 신호(전월대비 ≥ 3% 또는 3개월 누적 ≥ 6%). "
        "급등 = 3개월 누적 ≥ 20% 또는 전월대비 ≥ 10%. "
        "검증 구간은 관세청 원자료 42개월(2023-01~2026-06)입니다."
    )
    with st.expander("품목별 선행성 요약 (backtest_leadtime.csv)"):
        st.dataframe(lead, use_container_width=True, hide_index=True)


# ────────────────────────────────────────────────────────────── 뉴스 신호
st.subheader("뉴스 신호 — 실시간 정책·규제 동향 감지")

if news_meta is not None:
    st.caption(news_meta.get("role_note", ""))
    rt = news_meta.get("realtime_test", {})
    if rt:
        srcs = " + ".join(f"{x['name']} {x['count']}건" for x in rt.get("sources", []))
        st.success(
            f"**{rt.get('label', '실시간 테스트')}: {rt.get('case', '')} 기준 "
            f"{rt.get('result', '')}** ({srcs})"
        )
        st.caption(rt.get("provenance", ""))

if news is None:
    missing("뉴스 신호", RAW / "kotra_news.parquet")
else:
    countries = ["전체"] + sorted(news["natn"].dropna().unique().tolist())
    pick_c = st.selectbox("국가 필터", countries, index=0)
    view = news if pick_c == "전체" else news[news["natn"] == pick_c]
    st.caption(
        f"최근 90일 수집분 중 공급망 관련 {len(news)}건 "
        f"({news['othbcDt'].min()} ~ {news['othbcDt'].max()}) · 현재 표시 {len(view)}건"
    )
    st.dataframe(
        view[["othbcDt", "natn", "indstCl", "제목", "kotraNewsUrl"]]
        .rename(columns={"othbcDt": "일자", "natn": "국가",
                         "indstCl": "산업", "kotraNewsUrl": "링크"})
        .sort_values("일자", ascending=False),
        use_container_width=True, hide_index=True,
        column_config={"링크": st.column_config.LinkColumn("링크", display_text="열기")},
    )

st.divider()
st.caption(
    "전시용 데모입니다. 모든 수치는 사전 계산된 값이며 화면에서 외부 API를 호출하지 않습니다. "
    "데이터가 없는 항목은 0이 아니라 '산출 불가'로 표기합니다."
)
