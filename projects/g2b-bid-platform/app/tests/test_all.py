import json
import os
import tempfile
import unittest
from datetime import timedelta

import requests

from app import db as dbm
from app.api import (OPERATIONS, AuthError, DailyStop, G2BClient, QuotaExceeded, RequestRejected, UsageCounter,
                     parse_response, ApiError)
from app.collector import Collector, split_windows
from app.db import KST
from app.fields import sanitize_item, to_row
from app.redact import clear_secrets, mask_contacts, mask_secrets, register_secrets
from app.run_cycle import CycleLock, run_cycle
from app.tests.fakes import (FAKE_KEY_DEC, FAKE_KEY_ENC, FAKE_TOKEN, FIXED_NOW, FakeResponse, FakeServer, json_err,
                         json_ok, make_settings, mk_item)

THNG = OPERATIONS["물품"]
SERVC = OPERATIONS["용역"]
CNSTWK = OPERATIONS["공사"]


def build(settings=None, server=None, now=FIXED_NOW):
    settings = settings or make_settings()
    server = server or FakeServer()
    conn = dbm.connect(":memory:")
    sleeps = []
    client = G2BClient(settings, conn, session=server, now_fn=lambda: now, sleep_fn=sleeps.append)
    col = Collector(settings, conn, client, now_fn=lambda: now)
    return settings, server, conn, client, col, sleeps


class RedactTests(unittest.TestCase):
    def setUp(self):
        clear_secrets()
        register_secrets([FAKE_KEY_ENC, FAKE_KEY_DEC, FAKE_TOKEN])

    def test_secret_values_masked(self):
        txt = f"url ...serviceKey={FAKE_KEY_ENC}&x=1 raw {FAKE_KEY_DEC} token {FAKE_TOKEN}"
        out = mask_secrets(txt)
        for s in (FAKE_KEY_ENC, FAKE_KEY_DEC, FAKE_TOKEN):
            self.assertNotIn(s, out)
        self.assertIn("***", out)

    def test_unregistered_key_in_url_masked_by_pattern(self):
        self.assertNotIn("SECRETVALUE123", mask_secrets("GET /x?serviceKey=SECRETVALUE123&pageNo=1"))

    def test_phone_and_email_masked(self):
        t = "문의 02-123-4567 또는 031) 123-4567, 010-1234-5678, 01012345678, 1588-1234, a.b@x.go.kr 로"
        out = mask_contacts(t)
        for s in ("02-123-4567", "123-4567", "010-1234-5678", "01012345678", "1588-1234", "a.b@x.go.kr"):
            self.assertNotIn(s, out)
        self.assertIn("[전화]", out)
        self.assertIn("[이메일]", out)

    def test_bid_number_and_money_not_masked(self):
        t = "공고 20261112345-000 금액 1,234,567,890원 규격 2026-11-16"
        self.assertEqual(mask_contacts(t), t)

    def test_exception_message_hides_key(self):
        server = FakeServer()
        server.exc = requests.ConnectionError
        _, _, _, client, _, _ = build(server=server)
        with self.assertRaises(ApiError) as cm:
            client.fetch_page("물품", FIXED_NOW - timedelta(hours=1), FIXED_NOW, 1)
        msg = str(cm.exception)
        self.assertNotIn(FAKE_KEY_ENC, msg)
        self.assertNotIn("FAKEkeyENC", msg)
        self.assertIsNone(cm.exception.__cause__)
        self.assertIsNone(cm.exception.__context__)


class FieldTests(unittest.TestCase):
    def test_only_allowed_fields_kept(self):
        unknown = set()
        clean = sanitize_item(mk_item("A1"), "물품", unknown)
        for bad in ("ntceInsttOfclNm", "ntceInsttOfclTelNo", "ntceInsttOfclEmailAdrs",
                    "dminsttOfclEmailAdrs", "exctvNm", "someNewField"):
            self.assertNotIn(bad, clean)
        self.assertEqual(clean["bidNtceNo"], "A1")
        self.assertEqual(unknown, {"someNewField"})     # 이름만 기록, 값은 저장 안 함
        self.assertNotIn("홍길동", json.dumps(clean, ensure_ascii=False))

    def test_free_text_masked(self):
        item = mk_item("A2", chgNtceRsn="담당 홍길동 02-123-4567 hong@x.go.kr 로 문의")
        clean = sanitize_item(item, "물품")
        self.assertNotIn("02-123-4567", clean["chgNtceRsn"])
        self.assertNotIn("hong@x.go.kr", clean["chgNtceRsn"])

    def test_kind_specific_fields(self):
        item = mk_item("A3", mainCnsttyNm="토목", cnstrtsiteRgnNm="서울", srvceDivNm="일반용역")
        self.assertIn("mainCnsttyNm", sanitize_item(item, "공사"))
        self.assertNotIn("mainCnsttyNm", sanitize_item(item, "물품"))
        self.assertIn("srvceDivNm", sanitize_item(item, "용역"))
        row = to_row(sanitize_item(item, "공사"), "공사")
        self.assertEqual(row["region"], "서울")
        self.assertEqual(row["industry"], "토목")

    def test_no_bid_number_skipped(self):
        self.assertIsNone(to_row({"bidNtceNm": "x"}, "물품"))


class DbTests(unittest.TestCase):
    def test_wal_mode_on_file_db(self):
        with tempfile.TemporaryDirectory() as d:
            conn = dbm.connect(os.path.join(d, "t.db"))
            self.assertEqual(conn.execute("PRAGMA journal_mode").fetchone()[0].lower(), "wal")
            names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            for t in ("accounts", "channels", "digest_settings", "conditions", "bids", "pending_notifications",
                      "digests", "notifications", "collect_runs", "api_usage", "settings"):
                self.assertIn(t, names)
            conn.close()

    def test_duplicate_store_and_ord_key(self):
        _, _, conn, _, col, _ = build()
        items = [mk_item("N1"), mk_item("N1"), mk_item("N2")]
        col.store_items(items, "물품", False)
        col.store_items([mk_item("N1")], "물품", False)          # 다시 받아도 그대로
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 2)
        col.store_items([mk_item("N1", ord_="001")], "물품", False)  # 차수가 다르면 새 공고
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 3)

    def test_upsert_updates_fields_but_keeps_first_seen_and_backfill_flag(self):
        _, _, conn, _, col, _ = build()
        col.store_items([mk_item("B1")], "물품", True)
        col.store_items([mk_item("B1", bidNtceNm="정정된 제목")], "물품", False)
        r = conn.execute("SELECT * FROM bids WHERE bid_no='B1'").fetchone()
        self.assertEqual(r["title"], "정정된 제목")
        self.assertEqual(r["from_backfill"], 1)

    def test_stored_row_has_no_personal_fields(self):
        _, _, conn, _, col, _ = build()
        col.store_items([mk_item("P1", chgNtceRsn="전화 010-1234-5678")], "물품", False)
        r = conn.execute("SELECT * FROM bids").fetchone()
        blob = json.dumps(dict(r), ensure_ascii=False)
        for bad in ("홍길동", "02-123-4567", "hong@example.go.kr", "010-1234-5678", "김집행", "someNewField"):
            self.assertNotIn(bad, blob)


class ApiTests(unittest.TestCase):
    def fetch(self, client, kind="물품"):
        return client.fetch_page(kind, FIXED_NOW - timedelta(hours=1), FIXED_NOW, 1)

    def test_encoding_key_sent_as_is_and_params(self):
        _, server, _, client, _, _ = build()
        self.fetch(client)
        op, params, url = server.calls[0]
        self.assertEqual(op, THNG)
        self.assertIn("serviceKey=" + FAKE_KEY_ENC, url)
        self.assertEqual(params["inqryDiv"], "1")
        self.assertEqual(params["type"], "json")
        self.assertEqual(params["inqryEndDt"], "202611161200")

    def test_error_22_quota(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse(json_err("22", "LIMITED"))
        _, _, conn, client, _, _ = build(server=server)
        with self.assertRaises(QuotaExceeded):
            self.fetch(client)
        n = len(server.calls)
        with self.assertRaises(QuotaExceeded):                # 같은 날 같은 오퍼레이션은 HTTP 없이 거절
            self.fetch(client)
        self.assertEqual(len(server.calls), n)
        server.override = None
        self.fetch(client, "용역")                              # 다른 오퍼레이션은 계속 가능
        self.assertTrue(any("22" in a for a in client.usage.alerts))

    def test_xml_quota_error(self):
        xml = ("<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>"
               "<returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>"
               "<returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>")
        self.assertEqual(parse_response(xml)[0], "22")

    def test_retry_with_backoff_then_success(self):
        server = FakeServer()
        seq = [FakeResponse("", 500), FakeResponse("", 429)]
        server.override = lambda op, p: seq.pop(0) if seq else None
        _, _, _, client, _, sleeps = build(server=server)
        pg = self.fetch(client)
        self.assertEqual(pg.total_count, 0)
        self.assertEqual(len(server.calls), 3)
        self.assertEqual(len(sleeps), 2)

    def test_retry_gives_up_after_max_attempts(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse("", 503)
        _, _, _, client, _, _ = build(server=server)
        with self.assertRaises(ApiError):
            self.fetch(client)
        self.assertEqual(len(server.calls), 3)

    def test_rejected_range_not_retried(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse(json_err("07", "입력범위값 초과 에러"))
        _, _, _, client, _, _ = build(server=server)
        with self.assertRaises(RequestRejected) as cm:
            self.fetch(client)
        self.assertEqual(cm.exception.code, "07")
        self.assertEqual(len(server.calls), 1)

    def test_key_error_switches_to_other_key_once(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse(json_err("30", "NOT REGISTERED")) \
            if "serviceKey=" + FAKE_KEY_ENC in server.calls[-1][2] else None
        _, _, _, client, _, _ = build(server=server)
        pg = self.fetch(client)                               # 디코딩 키(퍼센트 인코딩해서)로 바꿔 성공
        self.assertEqual(client.key_index, 1)       # 퍼센트 인코딩한 디코딩 키는 인코딩 키와 같아 건너뛰고 원본으로
        self.assertEqual(pg.total_count, 0)

    def test_key_error_both_fail(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse(json_err("30", "NOT REGISTERED"))
        _, _, _, client, _, _ = build(server=server)
        with self.assertRaises(AuthError) as cm:
            self.fetch(client)
        self.assertNotIn("FAKEkeyENC", str(cm.exception))
        self.assertEqual(len(server.calls), 2)       # 인코딩 키 -> 디코딩 원본(중복 모양은 건너뜀)

    def test_counter_per_operation_and_thresholds(self):
        s = make_settings(warn_at=3, danger_at=5, stop_at=7)
        _, server, conn, client, _, _ = build(settings=s)
        for _ in range(3):
            self.fetch(client, "물품")
        self.fetch(client, "용역")
        self.assertEqual(client.usage.count(THNG), 3)
        self.assertEqual(client.usage.count(SERVC), 1)
        self.assertEqual(client.usage.count(CNSTWK), 0)
        self.assertEqual(client.usage.level(THNG), "warn")
        self.assertEqual(client.usage.level(SERVC), "ok")
        for _ in range(2):
            self.fetch(client, "물품")
        self.assertEqual(client.usage.level(THNG), "danger")
        self.assertEqual(len([a for a in client.usage.alerts if "주의" in a]), 1)
        self.assertEqual(len([a for a in client.usage.alerts if "위험" in a]), 1)
        for _ in range(2):
            self.fetch(client, "물품")
        with self.assertRaises(DailyStop):
            self.fetch(client, "물품")
        self.fetch(client, "공사")                              # 다른 오퍼레이션은 영향 없음

    def test_default_thresholds_are_700_900(self):
        s = make_settings()
        self.assertEqual((s.warn_at, s.danger_at), (700, 900))


class CollectorTests(unittest.TestCase):
    def test_split_windows_6_days(self):
        end = FIXED_NOW
        wins = split_windows(end - timedelta(days=14), end, 6)
        self.assertEqual(len(wins), 3)
        for s, e in wins:
            self.assertLessEqual(e - s, timedelta(days=6))
        self.assertEqual(wins[0][0], end - timedelta(days=14))
        self.assertEqual(wins[-1][1], end)
        for a, b in zip(wins, wins[1:]):
            self.assertEqual(a[1], b[0])
        self.assertEqual(len(split_windows(end - timedelta(days=6), end, 6)), 1)
        self.assertEqual(len(split_windows(end - timedelta(minutes=45), end, 6)), 1)

    def test_incremental_two_branches_and_overlap(self):
        _, server, conn, client, col, _ = build()
        server.add(THNG, [mk_item("T1", reg="2026-11-16 11:40:00"), mk_item("T2", reg="2026-11-16 11:55:00")])
        col.run_incremental()
        thng = server.calls_for(THNG)
        self.assertEqual({c[1]["inqryDiv"] for c in thng}, {"1", "3"})
        self.assertEqual(thng[0][1]["inqryBgnDt"], "202611161115")   # 첫 실행: 12:00 - 30 - 15분
        self.assertEqual(len(server.calls), 6)                        # 3종 x 2갈래
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 2)
        # 두 번째 실행: 마지막 성공 시각(12:00) - 겹침 15분 = 11:45부터
        later = FIXED_NOW + timedelta(minutes=30)
        client.now_fn = client.usage.now_fn = col.now_fn = lambda: later
        server.calls.clear()
        col.run_incremental()
        self.assertEqual(server.calls_for(THNG)[0][1]["inqryBgnDt"], "202611161145")
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 2)   # 중복 저장 없음

    def test_overlap_is_configurable(self):
        s = make_settings(overlap_min=10)
        _, server, _, _, col, _ = build(settings=s)
        col.run_incremental()
        self.assertEqual(server.calls[0][1]["inqryBgnDt"], "202611161120")

    def test_catch_up_uses_6_day_pieces(self):
        _, server, conn, client, col, _ = build()
        from app.db import set_setting, fmt
        old = FIXED_NOW - timedelta(days=14)
        for op in OPERATIONS.values():
            for div in (1, 3):
                set_setting(conn, f"last_ok:{op}:{div}", fmt(old))
        col.run_incremental()
        calls = [c for c in server.calls_for(THNG) if c[1]["inqryDiv"] == "1"]
        self.assertEqual(len(calls), 3)
        from app.collector import parse_dt
        for _, p, _u in calls:
            span = parse_dt(p["inqryEndDt"]) - parse_dt(p["inqryBgnDt"])
            self.assertLessEqual(span, timedelta(days=6))

    def test_multi_page_and_total_count_ok(self):
        s = make_settings(num_rows=10)
        _, server, conn, _, col, _ = build(settings=s)
        server.add(THNG, [mk_item(f"M{i:03d}", reg="2026-11-16 11:50:00") for i in range(25)])
        col.run_incremental()
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 25)
        run = conn.execute("SELECT * FROM collect_runs WHERE operation=? AND inqry_div=1", (THNG,)).fetchone()
        self.assertEqual((run["status"], run["total_count"], run["received_rows"], run["pages"]), ("ok", 25, 25, 3))

    def test_total_count_mismatch_retries_and_holds_cursor(self):
        from app.db import get_setting
        s = make_settings(num_rows=10)
        server = FakeServer()
        server.add(THNG, [mk_item(f"X{i:03d}") for i in range(15)])
        orig = server.get

        def lying(url, timeout=None):                     # 2쪽이 비어 오는 서버
            r = orig(url, timeout)
            if "pageNo=2" in url and THNG in url:
                return FakeResponse(json_ok([], 15, 2, 10))
            return r
        server.get = lying
        _, _, conn, client, col, _ = build(settings=s, server=server)
        col.run_incremental()
        run = conn.execute("SELECT * FROM collect_runs WHERE operation=? AND inqry_div=1", (THNG,)).fetchone()
        self.assertEqual(run["status"], "incomplete")
        self.assertIsNone(get_setting(conn, f"last_ok:{THNG}:1"))     # 마지막 성공 시각은 갱신 안 됨

    def test_quota_on_one_operation_does_not_block_others(self):
        server = FakeServer()
        server.override = lambda op, p: FakeResponse(json_err("22")) if op == THNG else None
        _, _, conn, _, col, _ = build(server=server)
        col.run_incremental()
        statuses = {r["operation"]: r["status"] for r in conn.execute("SELECT operation,status FROM collect_runs")}
        self.assertEqual(statuses[THNG], "quota")
        self.assertEqual(statuses[SERVC], "ok")
        self.assertEqual(statuses[CNSTWK], "ok")

    def test_change_branch_catches_correction(self):
        _, server, conn, client, col, _ = build()
        server.add(THNG, [mk_item("C1", reg="2026-11-10 09:00:00", chg="2026-11-16 11:58:00", chgNtceRsn="정정")])
        col.run_incremental()
        row = conn.execute("SELECT * FROM bids WHERE bid_no='C1'").fetchone()
        self.assertIsNotNone(row)                        # 등록일은 오래됐지만 변경일시 갈래로 잡힘
        self.assertEqual(row["from_backfill"], 0)

    def test_backfill_spreads_over_days_within_budget_and_flags(self):
        s = make_settings(num_rows=5, backfill_daily_cap=2, backfill_days=2)
        server = FakeServer()
        items = [mk_item(f"F{i:03d}", reg=f"2026-11-1{5 if i % 2 else 4} 1{i % 10}:00:00") for i in range(40)]
        server.add(THNG, items)
        _, server, conn, client, col, _ = build(settings=s, server=server)
        r1 = col.run_backfill()
        self.assertLessEqual(client.usage.count(THNG), 2)            # 하루 예산 안
        left1 = col.backfill_status()["left"]
        self.assertGreater(left1, 0)
        later = FIXED_NOW + timedelta(days=1)                        # 다음 날: 예산 새로 시작
        client.now_fn = client.usage.now_fn = col.now_fn = lambda: later
        r2 = col.run_backfill()
        self.assertGreater(r2["calls"], 0)                           # 다음 날 이어서 받음
        self.assertLessEqual(client.usage.count(THNG), 2)            # 그날 예산도 지킴
        for _ in range(12):                                          # 며칠 더 돌리면 끝남
            later += timedelta(days=1)
            client.now_fn = client.usage.now_fn = col.now_fn = (lambda t=later: t)
            col.run_backfill()
        self.assertEqual(col.backfill_status()["left"], 0)
        self.assertGreater(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids WHERE from_backfill=0").fetchone()[0], 0)

    def test_backfill_stops_at_warning_level(self):
        s = make_settings(warn_at=2, backfill_days=1)
        _, server, conn, client, col, _ = build(settings=s)
        col.run_backfill()
        self.assertLessEqual(client.usage.count(THNG), 2)

    def test_registration_delay_recorded_for_live_only(self):
        _, server, conn, _, col, _ = build()
        server.add(THNG, [mk_item("D1", reg="2026-11-16 11:40:00")])
        col.run_incremental()
        d = conn.execute("SELECT reg_delay_min FROM bids WHERE bid_no='D1'").fetchone()[0]
        self.assertEqual(d, 20.0)


class RunCycleTests(unittest.TestCase):
    def test_run_cycle_collects_and_releases_lock(self):
        with tempfile.TemporaryDirectory() as d:
            s = make_settings(db_path=os.path.join(d, "g2b.db"), backfill_days=1)
            server = FakeServer()
            server.add(THNG, [mk_item("R1")])
            conn = dbm.connect(s.db_path)
            client = G2BClient(s, conn, session=server, now_fn=lambda: FIXED_NOW, sleep_fn=lambda x: None)
            res = run_cycle(s, conn=conn, client=client, now_fn=lambda: FIXED_NOW)
            self.assertEqual(res["status"], "ok")
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM bids").fetchone()[0], 1)
            self.assertFalse(os.path.exists(os.path.join(d, "run_cycle.lock")))
            conn.close()

    def test_second_run_is_blocked_by_lock(self):
        with tempfile.TemporaryDirectory() as d:
            lock = CycleLock(os.path.join(d, "run_cycle.lock"))
            self.assertTrue(lock.acquire())
            self.assertFalse(CycleLock(os.path.join(d, "run_cycle.lock")).acquire())
            s = make_settings(db_path=os.path.join(d, "g2b.db"))
            self.assertEqual(run_cycle(s, now_fn=lambda: FIXED_NOW)["status"], "locked")
            lock.release()

    def test_auth_error_reported_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            s = make_settings(db_path=os.path.join(d, "g2b.db"))
            server = FakeServer()
            server.override = lambda op, p: FakeResponse(json_err("30"))
            conn = dbm.connect(s.db_path)
            client = G2BClient(s, conn, session=server, now_fn=lambda: FIXED_NOW, sleep_fn=lambda x: None)
            res = run_cycle(s, conn=conn, client=client, now_fn=lambda: FIXED_NOW)
            self.assertEqual(res["status"], "error")
            self.assertNotIn("FAKEkeyENC", res["error"])
            conn.close()


class ProbeTests(unittest.TestCase):
    def test_probe_runs_on_fake_server_and_leaks_no_key(self):
        from app.probe import Reporter, run_probe
        server = FakeServer()
        server.add(THNG, [mk_item(f"Z{i:04d}", reg="2026-11-16 11:30:00") for i in range(30)])

        def cap(op, p):                                   # 가짜 서버: 8일 이상은 거절, 999행은 100으로 잘라 줌
            from datetime import datetime
            b = datetime.strptime(p["inqryBgnDt"], "%Y%m%d%H%M")
            e = datetime.strptime(p["inqryEndDt"], "%Y%m%d%H%M")
            if (e - b) > timedelta(days=7):
                return FakeResponse(json_err("07", "입력범위값 초과 에러"))
            return None
        server.override = cap
        settings, _, conn, client, _, _ = build(server=server)
        out = Reporter()
        report = run_probe(settings, conn, client, out, now_fn=lambda: FIXED_NOW)
        text = "\n".join(out.lines)
        self.assertNotIn("FAKEkeyENC", text)
        self.assertTrue(report["scheme"]["https"]["ok"])
        self.assertIn("정확히 7일", report["boundary"])
        self.assertTrue(report["boundary"]["정확히 7일"]["ok"])
        self.assertFalse(report["boundary"]["8일"]["ok"])
        self.assertIn("recommended_num_rows", report["summary"])


if __name__ == "__main__":
    unittest.main()
