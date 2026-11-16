"""나라장터 입찰공고 목록 API 호출 래퍼. 재시도·백오프, 에러코드 22, 오퍼레이션별 호출 카운터, 비밀값 가리기."""
import json
import logging
import re
import time
from dataclasses import dataclass, field
from urllib.parse import quote, urlencode

import requests

from .db import fmt, get_setting, now_kst, set_setting
from .redact import mask_secrets, register_secrets

log = logging.getLogger("g2b.api")

SERVICE = "BidPublicInfoService02"
BASE_PATH = "apis.data.go.kr/1230000/ad/" + SERVICE

# 종류 -> 오퍼레이션 (물품·용역·공사만. 외자 제외)
OPERATIONS = {
    "물품": "getBidPblancListInfoThng02",
    "용역": "getBidPblancListInfoServc02",
    "공사": "getBidPblancListInfoCnstwk02",
}

KEY_ERROR_CODES = {"20", "21", "30", "31", "32", "33"}
RETRY_CODES = {"01", "02", "04", "05", "99"}
NODATA_CODE = "03"
QUOTA_CODE = "22"


class ApiError(Exception):
    """메시지는 항상 mask_secrets를 거친 뒤 만든다."""


class AuthError(ApiError):
    pass


class QuotaExceeded(ApiError):
    pass


class DailyStop(ApiError):
    """우리가 정한 중단선(기본 990회)에 닿아 호출을 멈춤."""


class FormatError(ApiError):
    pass


class RequestRejected(ApiError):
    """요청 값 문제(조회기간 초과 등). 재시도해도 소용없음."""

    def __init__(self, msg, code=None):
        super().__init__(msg)
        self.code = code


@dataclass
class Page:
    total_count: int
    items: list
    num_rows: int = 0
    result_code: str = "00"


def to_api_dt(dt):
    return dt.strftime("%Y%m%d%H%M")


def _find_header(obj):
    """정상 응답은 {"response":{"header","body"}}, 오류 응답은 다른 최상위 이름일 수 있어 header를 찾는다."""
    if isinstance(obj, dict):
        if "header" in obj and isinstance(obj["header"], dict):
            return obj
        for v in obj.values():
            r = _find_header(v)
            if r is not None:
                return r
    return None


def _normalize_items(items):
    if items in (None, "", []):
        return []
    if isinstance(items, dict):
        items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
    out = []
    for it in items or []:
        if isinstance(it, dict) and set(it.keys()) == {"item"} and isinstance(it["item"], dict):
            it = it["item"]
        if isinstance(it, dict):
            out.append(it)
    return out


def parse_response(text):
    """응답 본문 -> (result_code, result_msg, total_count, items). 형식이 이상하면 FormatError."""
    t = (text or "").strip()
    if t.startswith("<"):
        m = re.search(r"<returnReasonCode>\s*(\d+)\s*</returnReasonCode>", t) or \
            re.search(r"<resultCode>\s*(\w+)\s*</resultCode>", t)
        msg = re.search(r"<returnAuthMsg>(.*?)</returnAuthMsg>", t, re.S) or \
            re.search(r"<errMsg>(.*?)</errMsg>", t, re.S) or re.search(r"<resultMsg>(.*?)</resultMsg>", t, re.S)
        if not m:
            raise FormatError("XML 응답인데 오류 코드를 읽지 못함")
        return m.group(1), (msg.group(1).strip() if msg else ""), 0, []
    try:
        data = json.loads(t)
    except ValueError:
        raise FormatError("JSON으로 읽을 수 없는 응답") from None
    root = _find_header(data)
    if root is None:
        raise FormatError("응답에서 header를 찾지 못함")
    header = root["header"]
    code = str(header.get("resultCode", "")).strip()
    msg = str(header.get("resultMsg", ""))
    body = root.get("body") or {}
    try:
        total = int(body.get("totalCount", 0) or 0)
    except (TypeError, ValueError):
        raise FormatError("totalCount가 숫자가 아님") from None
    return code, msg, total, _normalize_items(body.get("items"))


class UsageCounter:
    """하루(KST) 호출 수를 오퍼레이션별로 센다. 700/900 경고, 990 중단."""

    def __init__(self, conn, settings, now_fn=now_kst, alert_fn=None):
        self.conn, self.s, self.now_fn = conn, settings, now_fn
        self.alerts = []
        self.alert_fn = alert_fn

    def today(self):
        return self.now_fn().strftime("%Y-%m-%d")

    def count(self, operation, date=None):
        r = self.conn.execute("SELECT call_count FROM api_usage WHERE date=? AND operation=?",
                              (date or self.today(), operation)).fetchone()
        return r["call_count"] if r else 0

    def level(self, operation):
        c = self.count(operation)
        if c >= self.s.stop_at:
            return "stop"
        if c >= self.s.danger_at:
            return "danger"
        if c >= self.s.warn_at:
            return "warn"
        return "ok"

    def max_level(self):
        order = ["ok", "warn", "danger", "stop"]
        best = "ok"
        for op in OPERATIONS.values():
            lv = self.level(op)
            if order.index(lv) > order.index(best):
                best = lv
        return best

    def increment(self, service, operation):
        d = self.today()
        self.conn.execute(
            "INSERT INTO api_usage(date,service,operation,call_count) VALUES(?,?,?,1) "
            "ON CONFLICT(date,operation) DO UPDATE SET call_count=call_count+1", (d, service, operation))
        self.conn.commit()
        c = self.count(operation, d)
        for threshold, name in ((self.s.warn_at, "주의"), (self.s.danger_at, "위험")):
            if c == threshold:
                self._alert(f"[호출 {name}] {operation} 오늘 {c}회 도달 (임계 {threshold})")
        return c

    def _alert(self, msg):
        key = "alert:" + msg
        d = self.today()
        if get_setting(self.conn, f"{key}:{d}"):
            return
        set_setting(self.conn, f"{key}:{d}", "1")
        self.alerts.append(msg)
        log.warning(msg)
        if self.alert_fn:
            self.alert_fn(msg)

    def daily_summary(self, date=None):
        rows = self.conn.execute("SELECT operation, call_count FROM api_usage WHERE date=? ORDER BY operation",
                                 (date or self.today(),)).fetchall()
        return {r["operation"]: r["call_count"] for r in rows}


class G2BClient:
    def __init__(self, settings, conn, session=None, now_fn=now_kst, sleep_fn=time.sleep, alert_fn=None):
        self.s = settings
        self.conn = conn
        self.session = session or requests.Session()
        self.now_fn = now_fn
        self.sleep_fn = sleep_fn
        register_secrets(settings.all_secrets())
        self.usage = UsageCounter(conn, settings, now_fn, alert_fn)
        # 시도할 키 모양(중복 제거, 순서대로): 인코딩 키 그대로 -> 디코딩 키를 퍼센트 인코딩 -> 디코딩 키 원본
        cands = []
        for c in (settings.key_encoding, quote(settings.key_decoding, safe="") if settings.key_decoding else "",
                  settings.key_decoding):
            if c and c not in cands:
                cands.append(c)
        self._key_candidates = cands
        self.key_index = 0
        self.scheme = settings.scheme
        self.last_call_count = 0  # fetch_page 호출 직전 이후 HTTP 시도 수 계산용

    # ---- 내부 ----
    def _key_param(self):
        return self._key_candidates[self.key_index]   # 인코딩 키는 이미 퍼센트 인코딩이라 그대로 붙인다

    def _has_key(self):
        return bool(self._key_candidates)

    def _url(self, op, params, scheme=None):
        return f"{scheme or self.scheme}://{BASE_PATH}/{op}?serviceKey={self._key_param()}&{urlencode(params)}"

    def _quota_flag(self, op):
        return f"quota_exhausted:{self.usage.today()}:{op}"

    def _precheck(self, op):
        if get_setting(self.conn, self._quota_flag(op)):
            raise QuotaExceeded(f"{op}: 오늘 한도 초과(22) 상태라 호출하지 않음")
        if self.usage.count(op) >= self.s.stop_at:
            self.usage._alert(f"[호출 중단] {op} 오늘 {self.s.stop_at}회에 닿아 호출을 멈춤")
            raise DailyStop(f"{op}: 오늘 호출 {self.s.stop_at}회 도달, 중단")

    def _once(self, op, params, scheme):
        """HTTP 한 번. 호출 수를 센 뒤 보낸다. 성공하면 Page, 실패하면 예외."""
        self._precheck(op)
        self.usage.increment(SERVICE, op)
        url = self._url(op, params, scheme)
        try:
            resp = self.session.get(url, timeout=self.s.timeout_sec)
        except (requests.RequestException, OSError) as e:
            # 예외 문구에 URL(서비스키)이 들어 있을 수 있어 가린 뒤 새 예외로 바꾼다(원인 연결 끊기)
            raise _Retryable(mask_secrets(f"{type(e).__name__}: {e}")) from None
        status = getattr(resp, "status_code", 200)
        if status == 429 or status >= 500:
            raise _Retryable(f"HTTP {status}")
        code, msg, total, items = parse_response(resp.text) if status == 200 else (None, None, 0, [])
        if status != 200:
            raise RequestRejected(f"HTTP {status}", code=str(status))
        if code == "00":
            return Page(total, items, result_code=code)
        if code == NODATA_CODE:
            return Page(0, [], result_code=code)
        if code == QUOTA_CODE:
            set_setting(self.conn, self._quota_flag(op), "1")
            self.usage._alert(f"[한도 초과 22] {op} 오늘 호출 불가. 내일 초기화 후 이어서 받음")
            raise QuotaExceeded(f"{op}: 에러코드 22 일일 활용건수 초과")
        if code in KEY_ERROR_CODES:
            raise AuthError(mask_secrets(f"{op}: 서비스키 오류 코드 {code} {msg}"))
        if code in RETRY_CODES:
            raise _Retryable(mask_secrets(f"코드 {code} {msg}"))
        raise RequestRejected(mask_secrets(f"{op}: 코드 {code} {msg}"), code=code)

    def _call(self, op, params, scheme=None):
        if not self._has_key():
            raise AuthError("서비스키가 설정되지 않음(.env 확인)")
        last = None
        i = 0
        while i < self.s.max_attempts:
            try:
                return self._once(op, params, scheme)
            except _Retryable as e:
                last = str(e)
                log.warning("재시도 %d/%d %s: %s", i + 1, self.s.max_attempts, op, last)
                i += 1
                if i < self.s.max_attempts:
                    self.sleep_fn(self.s.backoff_base_sec * (2 ** (i - 1)))
            except FormatError as e:
                last = str(e)
                i += 1
                if i < self.s.max_attempts:
                    self.sleep_fn(self.s.backoff_base_sec * (2 ** (i - 1)))
                else:
                    raise FormatError(mask_secrets(f"{op}: 응답 형식 오류 - {last}")) from None
            except AuthError:
                # 키 모양이 안 맞을 수 있어 아직 안 써 본 다른 모양으로 바꿔 다시 시도한다
                if self.key_index + 1 < len(self._key_candidates):
                    self.key_index += 1
                    continue
                raise
        raise ApiError(mask_secrets(f"{op}: 재시도 {self.s.max_attempts}회 모두 실패 - {last}"))

    # ---- 공개 ----
    def fetch_page(self, kind, begin, end, inqry_div, page_no=1, num_rows=None, scheme=None):
        op = OPERATIONS[kind]
        params = {
            "pageNo": page_no,
            "numOfRows": num_rows or self.s.num_rows,
            "inqryDiv": inqry_div,
            "inqryBgnDt": to_api_dt(begin),
            "inqryEndDt": to_api_dt(end),
            "type": "json",
        }
        pg = self._call(op, params, scheme)
        pg.num_rows = params["numOfRows"]
        return pg


class _Retryable(Exception):
    pass
