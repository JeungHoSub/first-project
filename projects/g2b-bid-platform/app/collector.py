"""증분 수집(등록일시+변경일시 두 갈래, 겹침, 6일 조각, totalCount 검사)과 백필."""
import json
import logging
import math
from datetime import datetime, timedelta

from .api import (OPERATIONS, ApiError, AuthError, DailyStop, QuotaExceeded)
from .db import KST, fmt, get_setting, now_kst, set_setting
from .fields import sanitize_item, to_row
from .redact import mask_secrets

log = logging.getLogger("g2b.collector")

DIV_REG = 1      # 등록일시
DIV_CHG = 3      # 변경일시(정정공고)


def parse_dt(text):
    for f in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y%m%d%H%M"):
        try:
            return datetime.strptime(text, f).replace(tzinfo=KST)
        except (TypeError, ValueError):
            continue
    return None


def floor_minute(dt):
    return dt.replace(second=0, microsecond=0)


def split_windows(start, end, days=6):
    """[start, end]를 days일 이하 조각으로 오래된 것부터 나눈다. 조각은 서로 이어진다."""
    out = []
    cur = start
    step = timedelta(days=days)
    while cur < end:
        nxt = min(cur + step, end)
        out.append((cur, nxt))
        cur = nxt
    return out


UPSERT_SQL = """
INSERT INTO bids (bid_no,bid_ord,kind,title,ntce_instt_nm,dminstt_nm,region,industry,prdct_clsfc,
  presmpt_prce,asign_bdgt_amt,bid_ntce_dt,bid_clse_dt,openg_dt,rgst_dt,chg_dt,url,
  first_seen_at,from_backfill,reg_delay_min,updated_at,raw_json)
VALUES (:bid_no,:bid_ord,:kind,:title,:ntce_instt_nm,:dminstt_nm,:region,:industry,:prdct_clsfc,
  :presmpt_prce,:asign_bdgt_amt,:bid_ntce_dt,:bid_clse_dt,:openg_dt,:rgst_dt,:chg_dt,:url,
  :first_seen_at,:from_backfill,:reg_delay_min,:updated_at,:raw_json)
ON CONFLICT(bid_no,bid_ord) DO UPDATE SET
  title=excluded.title, ntce_instt_nm=excluded.ntce_instt_nm, dminstt_nm=excluded.dminstt_nm,
  region=excluded.region, industry=excluded.industry, prdct_clsfc=excluded.prdct_clsfc,
  presmpt_prce=excluded.presmpt_prce, asign_bdgt_amt=excluded.asign_bdgt_amt,
  bid_ntce_dt=excluded.bid_ntce_dt, bid_clse_dt=excluded.bid_clse_dt, openg_dt=excluded.openg_dt,
  rgst_dt=excluded.rgst_dt, chg_dt=excluded.chg_dt, url=excluded.url,
  updated_at=excluded.updated_at, raw_json=excluded.raw_json
"""
# first_seen_at, from_backfill, reg_delay_min, kind는 처음 저장한 값을 유지한다(알림 제외 표시가 바뀌면 안 됨).


class WindowResult:
    def __init__(self):
        self.status = "ok"
        self.pages = 0
        self.calls = 0
        self.total = 0
        self.received = 0
        self.new = 0
        self.message = ""


class Collector:
    def __init__(self, settings, conn, client, now_fn=now_kst):
        self.s, self.conn, self.client, self.now_fn = settings, conn, client, now_fn
        self.unknown_fields = set()

    # ---- 저장 ----
    def store_items(self, items, kind, from_backfill, track_delay=False):
        now = self.now_fn()
        new = 0
        rows = []
        for it in items:
            clean = sanitize_item(it, kind, self.unknown_fields)
            row = to_row(clean, kind)
            if row is None:
                continue
            delay = None
            if track_delay and not from_backfill:
                posted = parse_dt(row["bid_ntce_dt"])
                if posted:
                    delay = round((now - posted).total_seconds() / 60, 1)
            row.update(first_seen_at=fmt(now), from_backfill=1 if from_backfill else 0,
                       reg_delay_min=delay, updated_at=fmt(now))
            rows.append(row)
        before = self.conn.execute("SELECT COUNT(*) c FROM bids").fetchone()["c"]
        with self.conn:
            self.conn.executemany(UPSERT_SQL, rows)
        after = self.conn.execute("SELECT COUNT(*) c FROM bids").fetchone()["c"]
        new = after - before
        if self.unknown_fields:
            log.info("허용 목록에 없는 필드(저장 안 함): %s", ", ".join(sorted(self.unknown_fields)))
        return new

    def _log_run(self, run_type, kind, div, start, end, res):
        with self.conn:
            self.conn.execute(
                "INSERT INTO collect_runs(run_type,operation,inqry_div,window_start,window_end,overlap_min,"
                "pages,calls,total_count,received_rows,status,message,finished_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (run_type, OPERATIONS[kind], div, fmt(start), fmt(end), self.s.overlap_min, res.pages, res.calls,
                 res.total, res.received, res.status, mask_secrets(res.message), fmt(self.now_fn())))

    # ---- 구간 하나 받기 ----
    def _fetch_window_once(self, kind, start, end, div, from_backfill):
        res = WindowResult()
        op = OPERATIONS[kind]
        c0 = self.client.usage.count(op)
        try:
            page_no = 1
            total_pages = 1
            while page_no <= total_pages:
                pg = self.client.fetch_page(kind, start, end, div, page_no)
                res.pages += 1
                if page_no == 1:
                    res.total = pg.total_count
                    total_pages = max(1, math.ceil(pg.total_count / self.s.num_rows))
                if not pg.items:
                    break
                res.received += len(pg.items)
                res.new += self.store_items(pg.items, kind, from_backfill, track_delay=(div == DIV_REG))
                page_no += 1
        finally:
            res.calls = self.client.usage.count(op) - c0
        return res

    def collect_window(self, kind, start, end, div, from_backfill=False):
        """totalCount와 받은 행 수가 다르면 한 번 더 받는다. 그래도 다르면 incomplete."""
        res = self._fetch_window_once(kind, start, end, div, from_backfill)
        if res.received != res.total:
            log.warning("%s div=%s 완전성 불일치(total=%s, 받음=%s) - 한 번 더 수집", kind, div, res.total, res.received)
            retry = self._fetch_window_once(kind, start, end, div, from_backfill)
            retry.calls += res.calls
            retry.pages += res.pages
            retry.new += res.new
            res = retry
            if res.received != res.total:
                res.status = "incomplete"
                res.message = f"totalCount {res.total} != 받은 행 {res.received}"
        return res

    # ---- 증분 ----
    def _last_ok_key(self, kind, div):
        return f"last_ok:{OPERATIONS[kind]}:{div}"

    def run_incremental(self):
        end = floor_minute(self.now_fn())
        summary = []
        for kind in OPERATIONS:
            stop_kind = False
            for div in (DIV_REG, DIV_CHG):
                if stop_kind:
                    break
                key = self._last_ok_key(kind, div)
                last = parse_dt(get_setting(self.conn, key))
                start = (last - timedelta(minutes=self.s.overlap_min)) if last else \
                    end - timedelta(minutes=30 + self.s.overlap_min)
                if start >= end:
                    start = end - timedelta(minutes=1)
                for ws, we in split_windows(start, end, self.s.max_window_days):
                    res = WindowResult()
                    try:
                        res = self.collect_window(kind, ws, we, div)
                    except (QuotaExceeded, DailyStop) as e:
                        res.status, res.message = "quota", str(e)
                        stop_kind = True
                    except AuthError as e:
                        res.status, res.message = "error", str(e)
                        self._log_run("incremental", kind, div, ws, we, res)
                        raise
                    except ApiError as e:
                        res.status, res.message = "error", str(e)
                    self._log_run("incremental", kind, div, ws, we, res)
                    summary.append((kind, div, res.status, res.received, res.new))
                    if res.status == "ok":
                        set_setting(self.conn, key, fmt(we))
                    else:
                        if res.status == "error":
                            stop_kind = True
                        break
        return summary

    # ---- 백필 ----
    def _init_backfill(self):
        if get_setting(self.conn, "backfill_state"):
            return json.loads(get_setting(self.conn, "backfill_state"))
        range_end = floor_minute(self.now_fn())
        range_start = range_end - timedelta(days=self.s.backfill_days)
        tasks = []
        e = range_end
        while e > range_start:                       # 최근 하루 조각부터 거꾸로
            s = max(e - timedelta(days=1), range_start)
            for kind in OPERATIONS:
                tasks.append({"s": fmt(s), "e": fmt(e), "kind": kind, "page": 1, "total": None,
                              "recv": 0, "done": False})
            e = s
        state = {"range_start": fmt(range_start), "range_end": fmt(range_end), "tasks": tasks}
        set_setting(self.conn, "backfill_state", json.dumps(state, ensure_ascii=False))
        return state

    def _bf_used_key(self, op):
        return f"bf_used:{self.client.usage.today()}:{op}"

    def backfill_budget(self, kind):
        """오늘 이 오퍼레이션에서 백필로 더 쓸 수 있는 호출 수. 정규 수집을 먼저 확보한다.
        B = min(400 - 오늘 백필로 쓴 수, 700 - 오늘 전체 호출 수)."""
        op = OPERATIONS[kind]
        used = int(get_setting(self.conn, self._bf_used_key(op), 0))
        return min(self.s.backfill_daily_cap - used, self.s.warn_at - self.client.usage.count(op))

    def backfill_status(self):
        raw = get_setting(self.conn, "backfill_state")
        if not raw:
            return None
        st = json.loads(raw)
        left = sum(1 for t in st["tasks"] if not t["done"])
        return {"tasks": len(st["tasks"]), "left": left, "range_start": st["range_start"],
                "range_end": st["range_end"]}

    def run_backfill(self):
        state = self._init_backfill()
        out = {"calls": 0, "pages": 0, "finished_tasks": 0}
        blocked = set()
        for t in state["tasks"]:
            if t["done"] or t["kind"] in blocked:
                continue
            kind = t["kind"]
            op = OPERATIONS[kind]
            s, e = parse_dt(t["s"]), parse_dt(t["e"])
            res = WindowResult()
            res.total = t["total"] or 0
            res.received = t["recv"]
            try:
                while not t["done"]:
                    if self.backfill_budget(kind) <= 0:
                        blocked.add(kind)
                        break
                    c0 = self.client.usage.count(op)
                    try:
                        pg = self.client.fetch_page(kind, s, e, DIV_REG, t["page"])
                    finally:
                        spent = self.client.usage.count(op) - c0
                        used = int(get_setting(self.conn, self._bf_used_key(op), 0)) + spent
                        set_setting(self.conn, self._bf_used_key(op), used)
                        res.calls += spent
                        out["calls"] += spent
                    res.pages += 1
                    out["pages"] += 1
                    if t["page"] == 1:
                        t["total"] = pg.total_count
                    t["recv"] += len(pg.items)
                    res.new += self.store_items(pg.items, kind, from_backfill=True)
                    total_pages = max(1, math.ceil((t["total"] or 0) / self.s.num_rows))
                    t["page"] += 1
                    if not pg.items or t["page"] > total_pages:
                        t["done"] = True
                    set_setting(self.conn, "backfill_state", json.dumps(state, ensure_ascii=False))
            except (QuotaExceeded, DailyStop) as ex:
                res.status, res.message = "quota", str(ex)
                blocked.add(kind)
            except AuthError:
                raise
            except ApiError as ex:
                res.status, res.message = "error", str(ex)
                blocked.add(kind)
            res.total, res.received = t["total"] or 0, t["recv"]
            if t["done"]:
                out["finished_tasks"] += 1
                if res.received != res.total:
                    res.status, res.message = "incomplete", f"totalCount {res.total} != 받은 행 {res.received}"
            if res.pages or t["done"]:
                self._log_run("backfill", kind, DIV_REG, s, e, res)
        return out
