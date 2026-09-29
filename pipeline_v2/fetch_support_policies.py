# -*- coding: utf-8 -*-
r"""
fetch_support_policies.py — K-Startup Open API(창업진흥원)에서 지원사업 공고·사업소개 정보를 가져와
policies.db(SQLite)에 저장하고, hs6_universe.json(1,109개 품목)과 연결해 policy_matches.json을 만든다.

2026-09-28: 리나가 공공데이터포털에서 발급받은 K-Startup Open API 사용 확정 — 활용신청 상세기능 4개 중
1(통합공고 지원사업 정보, getBusinessInformation01)·2(지원사업 공고 정보, getAnnouncementInformation01)만
쓴다(3 콘텐츠정보·4 통계보고서는 지원정책 연결과 무관해서 제외).
END POINT: https://apis.data.go.kr/B552735/kisedKstartupService01

매칭 방식(중요): K-Startup 응답 스키마에는 HS코드·품목 필드가 없다 — 업력·지역·연령 등 "창업" 중심 필드뿐이다
(getAnnouncementInformation01 API 명세 문서 기준: biz_pbanc_nm, pbanc_ctnt, supt_biz_clsfc, aply_trgt_ctnt,
aply_trgt, supt_regin 등). 그래서 공고 본문을 discover_collect.py의 MATERIALS 사전 중 이미 오탐 검증을 거친
핵심 키워드로만 훑고, 그 키워드가 hs6_universe.json 품목명에도 들어있으면 그 품목과 연결하는 2-hop 매칭을
쓴다. '은'·'금'·'주석'·'자석' 같은 동음이의어 위험 키워드는 여기서도 제외한다 — discover.db에서 겪은 문제를
그대로 반복하지 않기 위함. 대부분의 K-Startup 공고(청년창업, 지역센터, 데모데이) 는 애초에 특정 품목과
무관하므로 매칭 없이 비어있는 게 정상이다 — 매칭 안 된다고 억지로 붙이지 않는다.

주의(보안): 공공데이터포털 서비스키를 이 파일이나 다른 코드에 절대 하드코딩하지 말 것 — 이 리포는 GitHub에
공개돼 있다. 반드시 환경변수로만 넘긴다.

사용(로컬, PowerShell):
    $env:KSTARTUP_API_KEY="공공데이터포털에서 받은 서비스키(디코딩 전 그대로 붙여넣기)"
    cd pipeline_v2
    python fetch_support_policies.py --debug --pages 1 --per-page 5   # 먼저 이걸로 응답 형식부터 확인
    python fetch_support_policies.py --pages 10 --per-page 100        # 문제 없으면 본 수집

--debug로 첫 페이지 원본 응답을 그대로 찍어준다 — 이 스크립트는 이 세션(클라우드 샌드박스)에서
apis.data.go.kr에 접근이 막혀 있어(방화벽 정책상 pypi/npm/GitHub만 허용) 실제 응답을 확인하지 못한 채
API 명세 문서만 보고 작성했다. 로컬에서 --debug 실행 결과가 예상과 다르면(에러코드, 다른 JSON 구조 등)
그 출력을 그대로 보여주면 바로 고쳐줄 수 있다.
"""
import argparse, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime

API_BASE = "https://apis.data.go.kr/B552735/kisedKstartupService01"
CONTACT = os.environ.get("CONTACT", "unknown")
UA = f"SupplyPivotResearch/0.1 (public-interest contest project; {CONTACT})"

# discover_collect.py에서 이미 오탐 검증된 핵심 소재 키워드만 재사용 — '은'·'금'·'주석'·'자석'·'높이'·
# '지지'·'순수'·'보조'·'부분' 류(2026-09-27~28에 발견한 동음이의어 오탐들)는 전부 제외.
CORE_MATERIALS = [
    "희토류", "희토", "반도체", "알루미늄", "리튬", "텅스텐", "갈륨", "게르마늄",
    "구리", "코발트", "니켈", "흑연", "강판", "웨이퍼", "배터리", "우라늄", "요소수", "비료",
]


def http_raw(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def http_json(url):
    raw = http_raw(url)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("  [경고] JSON 파싱 실패 — 원본 응답 앞 300자:")
        print("  " + raw[:300].replace("\n", " "))
        raise


def build_url(path, key, page, per_page):
    qs = urllib.parse.urlencode({"serviceKey": key, "page": page, "perPage": per_page, "returnType": "json"})
    return f"{API_BASE}/{path}?{qs}"


def extract_items(j):
    """data.go.kr 신형 포맷({"data":[...]})과 구형 egov 포맷({"response":{"body":{"items":{"item":[...]}}}})을
    둘 다 시도한다 — 실제 형식은 로컬 --debug 실행으로 확인 전까지는 확정할 수 없다."""
    items = j.get("data")
    if items is None:
        items = (j.get("response") or {}).get("body", {}).get("items", {})
        if isinstance(items, dict):
            items = items.get("item") or []
    if items is None:
        return []
    if isinstance(items, dict):
        items = [items]
    return items


def fetch_endpoint(path, key, pages, per_page, debug=False):
    out = []
    for page in range(1, pages + 1):
        url = build_url(path, key, page, per_page)
        try:
            j = http_json(url)
        except Exception as e:
            print(f"  [{path}] page{page} 실패: {str(e)[:150]}")
            break
        if debug:
            print(f"  [DEBUG] {path} 원본 응답(앞 800자):")
            print("  " + json.dumps(j, ensure_ascii=False)[:800])
        items = extract_items(j)
        if not items:
            print(f"  [{path}] page{page}: 0건 — 수집 종료(또는 이 페이지가 마지막)")
            break
        out.extend(items)
        print(f"  [{path}] page {page}: {len(items)}건 (누적 {len(out)}건)")
        if len(items) < per_page:
            break
        time.sleep(0.2)
    return out


def match_materials(text):
    t = text or ""
    return sorted({k for k in CORE_MATERIALS if k in t})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=5, help="엔드포인트별 최대 페이지 수")
    ap.add_argument("--per-page", type=int, default=100)
    ap.add_argument("--debug", action="store_true", help="첫 페이지 원본 응답을 그대로 찍고 진행(응답 형식 확인용)")
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--hs6-universe", default="../site/public/data/hs6_universe.json")
    ap.add_argument("--out-json", default="../site/public/data/policy_matches.json")
    a = ap.parse_args()

    key_raw = os.environ.get("KSTARTUP_API_KEY")
    if not key_raw:
        print('KSTARTUP_API_KEY 환경변수가 없습니다. $env:KSTARTUP_API_KEY="..." 로 설정 후 다시 실행하세요.')
        sys.exit(1)
    # 공공데이터포털 키는 이미 URL-encode된 채로 발급되는 경우가 많다 — 그대로 쓰면 이중 인코딩돼 인증
    # 실패할 수 있어, 디코드한 원문으로 정규화한 뒤 urlencode에 맡긴다.
    key = urllib.parse.unquote(key_raw)

    db_path = os.path.join(a.out_dir, "policies.db")
    con = __import__("sqlite3").connect(db_path)
    con.execute(
        """CREATE TABLE IF NOT EXISTS policies(
            source TEXT, pbanc_sn TEXT, title TEXT, category TEXT, target TEXT, content TEXT,
            region TEXT, start_dt TEXT, end_dt TEXT, url TEXT PRIMARY KEY, matched_materials TEXT, first_seen TEXT)"""
    )

    print("[1/2] 지원사업 공고 정보(getAnnouncementInformation01) 수집 중...")
    ann = fetch_endpoint("getAnnouncementInformation01", key, a.pages, a.per_page, a.debug)
    print("[2/2] 통합공고 지원사업 정보(getBusinessInformation01) 수집 중...")
    biz = fetch_endpoint("getBusinessInformation01", key, a.pages, a.per_page, a.debug)

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    n_new = n_matched = 0
    for it in ann:
        title = it.get("biz_pbanc_nm", "")
        content = it.get("pbanc_ctnt", "")
        category = it.get("supt_biz_clsfc", "")
        target = it.get("aply_trgt_ctnt") or it.get("aply_trgt", "")
        url = it.get("detl_pg_url") or it.get("Detl_pg_url") or f"pbanc_sn:{it.get('pbanc_sn', '')}"
        materials = match_materials(f"{title} {content} {category} {target}")
        cur = con.execute(
            "INSERT OR IGNORE INTO policies VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                "ANNOUNCEMENT", it.get("pbanc_sn", ""), title, category, target, content,
                it.get("supt_regin", ""), it.get("pbanc_rcpt_bgng_dt", ""), it.get("pbanc_rcpt_end_dt", ""),
                url, ";".join(materials), now,
            ),
        )
        if cur.rowcount:
            n_new += 1
            n_matched += int(bool(materials))
    for it in biz:
        title = it.get("supt_biz_titl_nm", "")
        content = " ".join(
            x for x in [it.get("biz_supt_ctnt", ""), it.get("supt_biz_intrd_info", ""), it.get("supt_biz_chrct", "")] if x
        )
        target = it.get("biz_supt_trgt_info", "")
        url = it.get("Detl_pg_url") or it.get("detl_pg_url") or f"biz:{title}"
        materials = match_materials(f"{title} {content} {target}")
        cur = con.execute(
            "INSERT OR IGNORE INTO policies VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            ("BUSINESS", "", title, "", target, content, "", "", "", url, ";".join(materials), now),
        )
        if cur.rowcount:
            n_new += 1
            n_matched += int(bool(materials))
    con.commit()
    print(f"[누적] 신규 {n_new}건, 품목 키워드 매칭 {n_matched}건")

    hs6_path = os.path.join(os.path.dirname(__file__), a.hs6_universe)
    with open(hs6_path, encoding="utf-8") as f:
        universe = json.load(f)
    rows = con.execute("SELECT source, title, url, matched_materials FROM policies WHERE matched_materials != ''").fetchall()

    out = {}
    for hs6_item in universe:
        hs6 = hs6_item["hs6"]
        name_text = f"{hs6_item.get('name', '')} {hs6_item.get('name_full', '')} {hs6_item.get('category', '')}"
        item_materials = set(match_materials(name_text))
        if not item_materials:
            continue
        for source, title, url, matched in rows:
            overlap = item_materials & set(matched.split(";"))
            if overlap:
                out.setdefault(hs6, []).append(
                    {"title": title, "url": url, "source": source, "matched_on": sorted(overlap)}
                )

    out_path = os.path.join(os.path.dirname(__file__), a.out_json)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"[저장] {out_path} — {len(out)}개 품목에 정책 연결됨")


if __name__ == "__main__":
    main()
