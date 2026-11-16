"""실측 도구. 사용자 PC에서 직접 실행한다: python -m app.probe
확인하는 것: (1) https 동작 (2) numOfRows 999->500->100 (3) 30분당 신규 건수 n (4) 7일 경계.
결과는 화면과 logs\\probe-날짜시각.txt/.json 에 남는다. 키 값은 화면·파일 어디에도 나오지 않는다.
호출 수는 약 25회 안팎이고 오늘 호출 카운터에 함께 세어진다."""
import json
import math
import sys
from datetime import timedelta
from pathlib import Path

from . import db as dbm
from .api import ApiError, G2BClient, OPERATIONS, RequestRejected
from .collector import floor_minute
from .config import load_settings
from .db import fmt, now_kst
from .redact import mask_secrets, register_secrets


class Reporter:
    def __init__(self):
        self.lines = []

    def __call__(self, text=""):
        text = mask_secrets(text)
        self.lines.append(text)
        print(text)


def _try(fn):
    """호출 하나를 시도하고 (결과, 오류문구)를 돌려준다. 오류 문구는 이미 가려진 상태."""
    try:
        return fn(), None
    except RequestRejected as e:
        return None, f"요청 거절(코드 {e.code}): {mask_secrets(e)}"
    except ApiError as e:
        return None, f"{type(e).__name__}: {mask_secrets(e)}"


def estimate_daily_calls(n_by_stream, rows_per_page, overlap_min):
    """겹침 포함 하루 호출 수 추정. n_by_stream: {(종류, 조회구분): 30분당 건수}. 스트림마다 최소 1회."""
    factor = (30 + overlap_min) / 30
    total = 0
    for n in n_by_stream.values():
        total += 48 * max(1, math.ceil(factor * n / rows_per_page))
    return total


def run_probe(settings, conn, client, out, now_fn=now_kst):
    end = floor_minute(now_fn())
    report = {"started_at": fmt(end), "scheme": {}, "num_rows": {}, "n": {}, "boundary": {}, "summary": {}}

    out("=== 나라장터 실측(probe) ===")
    out(f"시작 시각(KST): {fmt(end)}")
    out("")

    # 1. https / http
    out("[1] https 동작 여부 (물품 공고 목록, 최근 1시간, 1건)")
    scheme_ok = {}
    for scheme in ("https", "http"):
        pg, err = _try(lambda: client.fetch_page("물품", end - timedelta(hours=1), end, 1, 1, num_rows=1, scheme=scheme))
        scheme_ok[scheme] = pg is not None
        report["scheme"][scheme] = {"ok": pg is not None, "error": err}
        out(f"  {scheme}: {'되는 중' if pg is not None else '안 됨 - ' + str(err)}")
    if scheme_ok["https"]:
        client.scheme = "https"
        out("  -> 결론: https 사용(.env의 G2B_SCHEME 은 비워 두면 됨)")
    elif scheme_ok["http"]:
        client.scheme = "http"
        out("  -> 결론: https는 안 되고 http만 됨. .env에 G2B_SCHEME=http 를 적어야 함")
    else:
        out("  -> 결론: 둘 다 안 됨. 서비스키 또는 네트워크를 확인해야 함(키 값은 알리지 말 것)")
        report["summary"]["abort"] = "scheme_fail"
        return report
    out("")

    # 2. numOfRows 999 -> 500 -> 100
    out("[2] 한 페이지 행 수(numOfRows) 시험 (물품, 최근 6일, 999 -> 500 -> 100 순서)")
    win_start = end - timedelta(days=6)
    best = None
    for rows in (999, 500, 100):
        pg, err = _try(lambda: client.fetch_page("물품", win_start, end, 1, 1, num_rows=rows))
        if pg is None:
            report["num_rows"][str(rows)] = {"ok": False, "error": err}
            out(f"  {rows}: 실패 - {err}")
            continue
        got, total = len(pg.items), pg.total_count
        accepted = got == min(rows, total)
        report["num_rows"][str(rows)] = {"ok": True, "received": got, "total_count": total, "accepted": accepted}
        out(f"  {rows}: 받은 행 {got}, 전체(totalCount) {total} -> {'그대로 받아짐' if accepted else '더 적게 잘림'}")
        if accepted and total >= rows:
            best = rows
            break
        if accepted and total < rows:
            out("      (전체 건수가 요청 행 수보다 적어 상한은 아직 모름. 이 값은 일단 가능으로 봄)")
            best = rows
            break
        if got > 0 and best is None:
            best = got
    recommended_rows = best or 100
    report["summary"]["recommended_num_rows"] = recommended_rows
    out(f"  -> 결론: 한 페이지 행 수 R = {recommended_rows} (.env의 G2B_NUM_ROWS 에 적을 값)")
    out("")

    # 3. 30분당 신규 건수 n
    out("[3] 30분당 건수 n (건수만 세므로 1건씩 요청. 등록일시=1, 변경일시=3)")
    n_stream_avg, n_stream_recent = {}, {}
    for kind in OPERATIONS:
        entry = {}
        for div, label, hours in ((1, "등록", 24), (1, "등록", 1), (3, "변경", 24)):
            pg, err = _try(lambda: client.fetch_page(kind, end - timedelta(hours=hours), end, div, 1, num_rows=1))
            if pg is None:
                entry[f"{label}_{hours}h"] = {"error": err}
                out(f"  {kind} {label} 최근 {hours}시간: 실패 - {err}")
                continue
            per30 = pg.total_count / (hours * 2)
            entry[f"{label}_{hours}h"] = {"total": pg.total_count, "per30min": round(per30, 2)}
            out(f"  {kind} {label} 최근 {hours}시간: {pg.total_count}건 -> 30분당 {per30:.1f}건")
            if hours == 24:
                n_stream_avg[(kind, div)] = per30
            if div == 1 and hours == 1:
                n_stream_recent[(kind, div)] = per30
        report["n"][kind] = entry
    out("  (하루 평균은 24시간 값, 지금 시간대는 1시간 값. 오전에 몰리면 평균보다 큼. 시간대를 바꿔 다시 돌리면 더 정확함)")
    if n_stream_avg:
        for label, streams in (("하루 평균 기준", n_stream_avg),
                               ("지금 시간대 등록 건수를 두 갈래 모두에 적용한 보수 기준",
                                {(k, d): n_stream_recent.get((k, 1), n_stream_avg.get((k, 1), 0))
                                 for (k, d) in n_stream_avg})):
            est = estimate_daily_calls(streams, recommended_rows, settings.overlap_min)
            report["summary"][f"estimated_daily_calls_{'avg' if '평균' in label else 'peak'}"] = est
            out(f"  하루 호출 추정({label}, R={recommended_rows}, 겹침 {settings.overlap_min}분, 3종 x 2갈래): {est}회")
        out("  (기준: 오퍼레이션별 한도 1,000이면 종류마다 위 값의 약 1/3. 경고 700/900은 오퍼레이션별로 셈)")
    out("")

    # 4. 7일 경계
    out("[4] 조회기간 경계 시험 (물품, 1건씩, 등록일시)")
    tests = [("6일", timedelta(days=6)), ("정확히 7일", timedelta(days=7)),
             ("7일 + 1분", timedelta(days=7, minutes=1)), ("8일", timedelta(days=8))]
    for label, delta in tests:
        pg, err = _try(lambda: client.fetch_page("물품", end - delta, end, 1, 1, num_rows=1))
        ok = pg is not None
        report["boundary"][label] = {"ok": ok, "error": err}
        out(f"  {label}: {'받아짐' if ok else '거절 - ' + str(err)}")
    b = report["boundary"]
    if b["정확히 7일"]["ok"]:
        out("  -> 결론: 정확히 7일까지 됨. 조각을 7일로 늘릴 수 있음(코드의 max_window_days 변경은 Claude가 함)")
    else:
        out("  -> 결론: 정확히 7일은 안 됨. 6일 조각 유지")
    out("")

    out("[5] 오늘 호출 카운터(오퍼레이션별)")
    summary = client.usage.daily_summary()
    report["summary"]["usage_today"] = summary
    for op, c in summary.items():
        out(f"  {op}: {c}회")
    out("")
    out("끝. 위 내용(또는 logs 폴더의 probe 파일)을 Claude에게 알려 주세요. 키 값은 들어 있지 않습니다.")
    return report


def _utf8_console():
    """Windows 명령 프롬프트에서 한글이 깨져 예외가 나지 않게 한다."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass


def main():
    _utf8_console()
    settings = load_settings()
    register_secrets(settings.all_secrets())
    if not (settings.key_encoding or settings.key_decoding):
        print("서비스키가 없습니다. app\\.env 에 DATA_GO_KR_KEY_ENCODING / DATA_GO_KR_KEY_DECODING 를 적어 주세요.")
        return 1
    conn = dbm.connect(settings.db_path)
    client = G2BClient(settings, conn)
    out = Reporter()
    report = run_probe(settings, conn, client, out)
    log_dir = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    stamp = now_kst().strftime("%Y%m%d-%H%M%S")
    (log_dir / f"probe-{stamp}.txt").write_text("\n".join(out.lines), encoding="utf-8")
    (log_dir / f"probe-{stamp}.json").write_text(mask_secrets(json.dumps(report, ensure_ascii=False, indent=2)),
                                                 encoding="utf-8")
    print(f"저장됨: {log_dir / ('probe-' + stamp + '.txt')}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
